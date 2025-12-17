// background/service_worker.js - Main Service Worker

import { getAuthToken, removeCachedToken } from './auth.js';
import { createSheet, appendRows, readSheet, deduplicateSheet, getSheetName, addTabToSheet, loadSheet, getSheetTabs, ensureWeeklyTab, appendRowsToTab, validateSpreadsheet, getTabData, compareTabs } from './sheets_api.js';
import { 
    addToQueue, 
    processQueue, 
    getQueueStatus, 
    getFailedRows, 
    clearFailedRows,
    retryFailedItems,
    updateQueueTabName
} from './sync_queue.js';
// PHASE 8: Selector Configuration
import {
    loadSelectorConfig,
    saveSelectorConfig,
    resetSelectorConfig,
    loadSelectorStats,
    saveSelectorStats,
    updateSelectorStat,
    autoLearnSelectorOrder,
    DEFAULT_SELECTORS,
    SELECTOR_VERSION
} from './selector_config.js';

// --- STATE ---
let currentOutputSheetId = null;
let currentTabName = 'Sheet1'; // Default tab name
let isScrapingActive = false;
let currentSearchIndex = 0;

// PHASE 6: Workbook & Tab State
let currentActiveTab = null;        // The MM_DD_YY tab name we're writing to (weekly runs)
let savedWorkbooks = [];            // Array of { id, name, sheetTitle, lastUsed, lastTab, addedAt }

// PHASE 8: Source Mapping State
let sourceMapping = {};    // Source Connection → Workbook ID mapping

// PHASE 8: Auto-Run State
let autoRunState = {
    isRunning: false,
    isAborted: false,
    config: null,
    progress: null
};

// --- ALARMS ---
const KEEPALIVE_ALARM = 'keepalive-alarm';
const QUEUE_PROCESS_ALARM = 'queue-process-alarm';

// --- KEEP-ALIVE MECHANISM ---
function startKeepAlive() {
    console.log('[SW] Starting keep-alive alarm');
    chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 }); // ~24 seconds
    isScrapingActive = true;
}

function stopKeepAlive() {
    console.log('[SW] Stopping keep-alive alarm');
    chrome.alarms.clear(KEEPALIVE_ALARM);
    isScrapingActive = false;
}

// --- QUEUE PROCESSING ALARM ---
function startQueueProcessor() {
    console.log('[SW] Starting queue processor');
    chrome.alarms.create(QUEUE_PROCESS_ALARM, { periodInMinutes: 0.5 }); // Every 30 seconds
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === KEEPALIVE_ALARM) {
        console.log('[SW] Keep-alive ping');
    } else if (alarm.name === QUEUE_PROCESS_ALARM) {
        console.log('[SW] Queue process tick');
        try {
            const result = await processQueue();
            if (result.synced > 0 || result.failed > 0) {
                // Notify popup of queue changes
                chrome.runtime.sendMessage({
                    action: 'QUEUE_UPDATED',
                    ...result
                }).catch(() => {});
            }
        } catch (e) {
            console.error('[SW] Queue process error:', e);
        }
    } else if (alarm.name === 'AUTO_RUN_KEEPALIVE') {
        console.log('[SW] Keep-alive alarm fired');
        
        // Check if auto-run is still active
        const stored = await getFromStorage(['autoRunState']);
        const state = stored.autoRunState;
        
        if (!state?.isRunning) {
            // Auto-run finished or was stopped, clear the alarm
            console.log('[SW] Auto-run not active, clearing keep-alive alarm');
            chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
            return;
        }
        
        // Log current progress to keep worker active
        // Also send progress update to popup if it's open
        console.log(`[SW] Auto-run progress: ${state.progress?.completedSearches || 0}/${state.progress?.totalSearches || 0} searches`);
        
        // Send progress update to popup (if open)
        if (state.progress) {
            chrome.runtime.sendMessage({
                action: 'AUTO_RUN_PROGRESS',
                progress: state.progress,
                isRunning: true
            }).catch(() => {}); // Ignore if no listeners
        }
    }
});

// --- STORAGE HELPERS ---
async function saveToStorage(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

async function getFromStorage(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(result);
            }
        });
    });
}

// ============================================================
// PHASE 8: AUTO-RUN STATE MANAGEMENT
// ============================================================

/**
 * Update auto-run state and persist to storage
 * @param {Object} updates - Partial state updates
 */
async function updateAutoRunState(updates) {
    autoRunState = { ...autoRunState, ...updates };
    await saveToStorage({ autoRunState });
    
    // Notify popup if it's listening (non-blocking)
    chrome.runtime.sendMessage({
        action: 'AUTO_RUN_PROGRESS',
        progress: autoRunState.progress,
        isRunning: autoRunState.isRunning
    }).catch(() => {}); // Ignore if no listeners
}

/**
 * Main auto-run queue processor (runs in background)
 * Processes searches grouped by source, switching workbooks automatically
 */
async function processAutoRunQueue() {
    console.log('[SW] Starting auto-run queue processor');
    
    try {
        // Load current state
        const stored = await getFromStorage(['autoRunState', 'sourceMapping']);
        let state = stored.autoRunState;
        const mapping = stored.sourceMapping || {};
        
        if (!state || !state.isRunning) {
            console.log('[SW] Auto-run not active, exiting');
            return;
        }
        
        const { config, progress } = state;
        const { sources, groupedSearches } = config;
        
        // Process each source group
        for (let sourceIndex = progress.currentSourceIndex; sourceIndex < sources.length; sourceIndex++) {
            // Check for abort
            const currentState = await getFromStorage(['autoRunState']);
            if (currentState.autoRunState?.isAborted) {
                console.log('[SW] Auto-run aborted by user');
                await updateAutoRunState({ 
                    isRunning: false, 
                    isAborted: true 
                });
                chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
                return;
            }
            
            const sourceName = sources[sourceIndex];
            const workbookId = mapping[sourceName];
            
            if (!workbookId) {
                console.error(`[SW] No workbook mapped for source: ${sourceName}`);
                await updateAutoRunState({
                    progress: {
                        ...progress,
                        errors: [...(progress.errors || []), `No workbook mapped for ${sourceName}`]
                    }
                });
                continue;
            }
            
            // Update progress
            await updateAutoRunState({
                progress: {
                    ...progress,
                    currentSourceIndex: sourceIndex,
                    currentSource: sourceName,
                    currentSearchIndex: 0
                }
            });
            
            // Process this source group
            const searches = groupedSearches[sourceName] || [];
            await processSourceGroup(sourceName, workbookId, searches, sourceIndex);
            
            // Update completed sources count
            const updatedState = await getFromStorage(['autoRunState']);
            const updatedProgress = updatedState.autoRunState.progress;
            await updateAutoRunState({
                progress: {
                    ...updatedProgress,
                    completedSources: updatedProgress.completedSources + 1
                }
            });
            
            // Delay between sources (60 seconds)
            if (sourceIndex < sources.length - 1) {
                console.log('[SW] Waiting 60 seconds before next source...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
        
        // All done!
        console.log('[SW] Auto-run completed successfully');
        await updateAutoRunState({ 
            isRunning: false,
            progress: {
                ...progress,
                currentSource: null,
                currentSearch: null
            }
        });
        chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
        
    } catch (error) {
        console.error('[SW] Auto-run error:', error);
        const freshState = await getFromStorage(['autoRunState']);
        const currentProgress = freshState.autoRunState?.progress || {};
        const currentErrors = currentProgress.errors || [];
        
        await updateAutoRunState({ 
            isRunning: false,
            progress: {
                ...currentProgress,
                errors: [...currentErrors, `Fatal: ${error.message}`]
            }
        });
        chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
    }
}

/**
 * Process all searches for a single source
 * @param {string} sourceName - Source connection name
 * @param {string} workbookId - Target workbook ID
 * @param {Array} searches - Array of search objects with url, title, index
 * @param {number} sourceIndex - Index of this source in the overall queue
 */
async function processSourceGroup(sourceName, workbookId, searches, sourceIndex) {
    console.log(`[SW] Processing source: ${sourceName} (${searches.length} searches)`);
    
    try {
        // Step 1: Activate workbook and ensure weekly tab
        const tabResult = await sendMessageToSelf('ENSURE_WEEKLY_TAB', {
            spreadsheetId: workbookId
        });
        
        if (!tabResult.success) {
            throw new Error(tabResult.error || 'Failed to ensure weekly tab');
        }
        
        const tabName = tabResult.tabName;
        console.log(`[SW] Using tab: ${tabName} for ${sourceName}`);
        
        // Set as active output
        await sendMessageToSelf('SET_ACTIVE_TAB', {
            spreadsheetId: workbookId,
            tabName: tabName
        });
        
        // Step 2: Find or create LinkedIn tab
        let linkedInTab = await findLinkedInTab();
        if (!linkedInTab) {
            console.log('[SW] No LinkedIn tab found, creating one...');
            linkedInTab = await chrome.tabs.create({ 
                url: 'https://www.linkedin.com/feed/',
                active: true  // Make active to ensure proper loading
            });
            
            // Wait for tab to fully load
            await waitForTabLoad(linkedInTab.id, 30000);
            console.log('[SW] LinkedIn tab created and loaded');
        } else {
            console.log(`[SW] Using existing LinkedIn tab: ${linkedInTab.id}`);
        }
        
        // Step 3: Process each search
        const state = await getFromStorage(['autoRunState']);
        let progress = state.autoRunState.progress;
        
        for (let i = 0; i < searches.length; i++) {
            // Check for abort
            const currentState = await getFromStorage(['autoRunState']);
            if (currentState.autoRunState?.isAborted) {
                console.log('[SW] Aborted during source processing');
                return;
            }
            
            const search = searches[i];
            const searchNum = i + 1;
            
            // Update progress
            await updateAutoRunState({
                progress: {
                    ...progress,
                    currentSearchIndex: i,
                    currentSearch: `${search.title} (${searchNum}/${searches.length})`
                }
            });
            
            console.log(`[SW] Processing search ${searchNum}/${searches.length}: ${search.title}`);
            
            try {
                // Navigate to LinkedIn URL and make tab active so user can see it
                await chrome.tabs.update(linkedInTab.id, { 
                    url: search.url,
                    active: true  // Make tab active so user can see the navigation
                });
                
                // Bring window to front
                try {
                    const tab = await chrome.tabs.get(linkedInTab.id);
                    if (tab.windowId) {
                        await chrome.windows.update(tab.windowId, { focused: true });
                    }
                } catch (e) {
                    console.warn('[SW] Could not bring window to front:', e);
                }
                
                // Wait for page load
                await waitForTabLoad(linkedInTab.id);
                
                // Ensure content script is injected
                await ensureContentScript(linkedInTab.id);
                
                // Wait for scraping completion (set up listener BEFORE starting)
                console.log(`[SW] Setting up completion listener for search ${searchNum}...`);
                const completionPromise = waitForScrapingComplete();
                
                // Small delay to ensure listener is registered
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Start scraping
                console.log(`[SW] Sending START_SCRAPING to tab ${linkedInTab.id}...`);
                await chrome.tabs.sendMessage(linkedInTab.id, {
                    action: 'START_SCRAPING',
                    sourceName: sourceName
                });
                
                // Wait for completion
                console.log(`[SW] Waiting for scraping to complete...`);
                const completionData = await completionPromise;
                console.log(`[SW] Scraping completed: ${completionData.totalProfiles} profiles`);
                
                // Update progress
                progress = (await getFromStorage(['autoRunState'])).autoRunState.progress;
                await updateAutoRunState({
                    progress: {
                        ...progress,
                        completedSearches: progress.completedSearches + 1,
                        totalProfiles: progress.totalProfiles + (completionData.totalProfiles || 0)
                    }
                });
                
                console.log(`[SW] ✅ Completed search: ${completionData.totalProfiles} profiles`);
                
                // Deduplicate after each search (based on LinkedIn URL)
                console.log(`[SW] Deduplicating workbook after search ${searchNum}...`);
                try {
                    const dedupeResult = await sendMessageToSelf('DEDUPLICATE_SHEET', {
                        spreadsheetId: workbookId,
                        tabName: tabName
                    });
                    
                    if (dedupeResult.success) {
                        console.log(`[SW] ✅ Deduplicated after search ${searchNum}: removed ${dedupeResult.removedCount || 0} duplicates`);
                    } else {
                        console.error(`[SW] Deduplication failed after search ${searchNum}:`, dedupeResult.error);
                    }
                } catch (dedupeError) {
                    console.error(`[SW] Error during deduplication after search ${searchNum}:`, dedupeError);
                    // Continue even if deduplication fails
                }
                
                // Delay before next search (30-60 seconds, random)
                // Use shorter chunks to keep service worker alive
                if (i < searches.length - 1) {
                    const totalDelay = 30000 + Math.random() * 30000; // 30-60 seconds
                    const chunkDelay = 5000; // 5 second chunks
                    const chunks = Math.ceil(totalDelay / chunkDelay);
                    console.log(`[SW] Waiting ${Math.round(totalDelay/1000)}s before next search (${chunks} chunks)...`);
                    
                    // Wait in chunks to keep service worker active
                    for (let chunk = 0; chunk < chunks; chunk++) {
                        // Check for abort between chunks
                        const currentState = await getFromStorage(['autoRunState']);
                        if (currentState.autoRunState?.isAborted) {
                            console.log('[SW] Aborted during delay');
                            return;
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, chunkDelay));
                    }
                    
                    console.log(`[SW] Delay complete, continuing to next search...`);
                }
                
            } catch (error) {
                console.error(`[SW] Error processing search ${searchNum}:`, error);
                const freshState = await getFromStorage(['autoRunState']);
                const currentProgress = freshState.autoRunState?.progress || {};
                const currentErrors = currentProgress.errors || [];
                
                await updateAutoRunState({
                    progress: {
                        ...currentProgress,
                        errors: [...currentErrors, `${sourceName} - ${search.title}: ${error.message}`]
                    }
                });
                // Continue to next search
            }
        }
        
        // Note: Deduplication now runs after each individual search (see above)
        // This ensures duplicates are removed immediately rather than accumulating
        
    } catch (error) {
        console.error(`[SW] Error processing source ${sourceName}:`, error);
        const freshState = await getFromStorage(['autoRunState']);
        const currentProgress = freshState.autoRunState?.progress || {};
        const currentErrors = currentProgress.errors || [];
        
        await updateAutoRunState({
            progress: {
                ...currentProgress,
                errors: [...currentErrors, `${sourceName}: ${error.message}`]
            }
        });
    }
}

/**
 * Call internal handler functions directly (we're in the service worker)
 * This avoids message-passing complexity for internal operations
 * @param {string} action - The action to perform
 * @param {Object} data - Parameters for the action
 * @returns {Promise<Object>} Result object with success status
 */
async function sendMessageToSelf(action, data = {}) {
    console.log(`[SW] Internal call: ${action}`);
    
    try {
        switch (action) {
            case 'ENSURE_WEEKLY_TAB': {
                const result = await ensureWeeklyTab(data.spreadsheetId);
                
                // Update active tab immediately
                currentActiveTab = result.tabName;
                currentOutputSheetId = data.spreadsheetId;
                
                // Save to storage
                await saveToStorage({ 
                    activeTab: result.tabName,
                    outputSheetId: data.spreadsheetId,
                    currentTabName: result.tabName
                });
                
                // Update queue items to use new tab
                await updateQueueTabName(data.spreadsheetId, result.tabName);
                
                return { success: true, ...result };
            }
            
            case 'SET_ACTIVE_TAB': {
                currentOutputSheetId = data.spreadsheetId;
                currentTabName = data.tabName;
                await saveToStorage({ 
                    outputSheetId: data.spreadsheetId,
                    currentTabName: data.tabName
                });
                return { success: true };
            }
            
            case 'DEDUPLICATE_SHEET': {
                const result = await deduplicateSheet(data.spreadsheetId, data.tabName);
                return { success: true, removedCount: result.removedCount || 0 };
            }
            
            case 'GET_ACTIVE_OUTPUT': {
                return { 
                    success: true, 
                    spreadsheetId: currentOutputSheetId,
                    tabName: currentTabName 
                };
            }
            
            default:
                console.warn(`[SW] Unknown internal action: ${action}`);
                return { success: false, error: `Unknown action: ${action}` };
        }
    } catch (error) {
        console.error(`[SW] Internal call failed (${action}):`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Find existing LinkedIn tab
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function findLinkedInTab() {
    try {
        const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
        return tabs.length > 0 ? tabs[0] : null;
    } catch (error) {
        console.error('[SW] Error finding LinkedIn tab:', error);
        return null;
    }
}

/**
 * Wait for tab to finish loading
 * @param {number} tabId - Chrome tab ID
 * @param {number} timeoutMs - Maximum wait time in milliseconds
 * @returns {Promise<void>}
 */
async function waitForTabLoad(tabId, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('Tab load timeout'));
        }, timeoutMs);
        
        const checkInterval = setInterval(async () => {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab.status === 'complete') {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    // Additional wait for dynamic content
                    await new Promise(r => setTimeout(r, 3000));
                    resolve();
                }
            } catch (e) {
                clearInterval(checkInterval);
                clearTimeout(timeout);
                reject(e);
            }
        }, 500);
    });
}

/**
 * Ensure content script is injected in tab
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<boolean>}
 */
async function ensureContentScript(tabId) {
    try {
        // Try to send a ping message
        await chrome.tabs.sendMessage(tabId, { action: 'PING' });
        return true;
    } catch (error) {
        // Content script not injected, inject it
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content/content.js']
            });
            // Wait a bit for script to initialize
            await new Promise(r => setTimeout(r, 1000));
            return true;
        } catch (injectError) {
            console.error('[SW] Failed to inject content script:', injectError);
            return false;
        }
    }
}

/**
 * Wait for scraping completion notification
 * @param {number} timeoutMs - Maximum wait time (default: 10 minutes)
 * @returns {Promise<Object>} Completion data
 */
function waitForScrapingComplete(timeoutMs = 600000) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                chrome.runtime.onMessage.removeListener(listener);
                reject(new Error('Scraping timeout after 10 minutes'));
            }
        }, timeoutMs);
        
        const listener = (message, sender, sendResponse) => {
            // Listen for the completion messages from content script
            if ((message.action === 'SEARCH_COMPLETE' || message.action === 'SCRAPING_COMPLETE') && !resolved) {
                resolved = true;
                clearTimeout(timeout);
                chrome.runtime.onMessage.removeListener(listener);
                
                console.log('[SW] Received scraping completion:', message.totalProfiles, 'profiles');
                
                resolve({
                    totalProfiles: message.totalProfiles || 0,
                    totalPages: message.totalPages || 0
                });
            }
            
            // Return true to indicate we might send a response asynchronously
            return true;
        };
        
        chrome.runtime.onMessage.addListener(listener);
        console.log('[SW] Registered completion listener for SEARCH_COMPLETE/SCRAPING_COMPLETE');
    });
}

// --- SMART NAVIGATION ---
async function advanceToNextSearch() {
    try {
        const { searches, searchIndex } = await getFromStorage(['searches', 'searchIndex']);
        
        if (!searches || searches.length === 0) {
            console.log('[SW] No searches configured');
            return null;
        }
        
        const nextIndex = (searchIndex || 0) + 1;
        
        if (nextIndex >= searches.length) {
            console.log('[SW] All searches complete!');
            await saveToStorage({ searchIndex: 0 }); // Reset for next time
            return { complete: true, total: searches.length };
        }
        
        await saveToStorage({ searchIndex: nextIndex });
        currentSearchIndex = nextIndex;
        
        const nextSearch = searches[nextIndex];
        console.log(`[SW] Advanced to search ${nextIndex + 1}/${searches.length}: ${nextSearch.source}`);
        
        return {
            complete: false,
            index: nextIndex,
            total: searches.length,
            search: nextSearch
        };
    } catch (e) {
        console.error('[SW] Error advancing search:', e);
        return null;
    }
}

// ============================================================
// PHASE 8 ENHANCED: Dynamic Selector Optimization
// ============================================================

/**
 * Get selectors optimized by success rate
 * Reorders selectors so most successful ones are tried first
 * 
 * @param {string} selectorKey - The selector key (e.g., 'title', 'location')
 * @returns {Promise<Array>} - Optimized selector array
 */
async function getOptimizedSelectors(selectorKey) {
    try {
        // Get current stats and config
        const stats = await loadSelectorStats();
        const configData = await loadSelectorConfig();
        const config = configData.selectors || DEFAULT_SELECTORS;
        
        // Stats are stored with format: "selectorKey:selector" as the stat key
        // Need to extract stats for this selectorKey
        const keyStats = {};
        const prefix = selectorKey + ':';
        for (const [statKey, statValue] of Object.entries(stats)) {
            if (statKey.startsWith(prefix)) {
                const selector = statKey.substring(prefix.length);
                keyStats[selector] = statValue;
            }
        }
        
        const defaultSelectors = config[selectorKey] || DEFAULT_SELECTORS[selectorKey] || [];
        
        // If no stats yet, return default order
        if (Object.keys(keyStats).length === 0) {
            console.log(`[SELECTOR-OPT] No stats for "${selectorKey}", using default order`);
            return defaultSelectors;
        }

        // Calculate success rate for each selector
        const selectorScores = defaultSelectors.map(selector => {
            const selectorStat = keyStats[selector];
            if (!selectorStat) {
                return {
                    selector,
                    successRate: 0.5,
                    attempts: 0,
                    confidence: 'low'
                };
            }
            
            // Handle both old format (successes/failures) and new format (attempts/successes)
            const successes = selectorStat.successes || 0;
            const failures = selectorStat.failures || 0;
            const attempts = successes + failures;
            
            // Require minimum attempts before considering success rate
            const MIN_ATTEMPTS = 10;
            if (attempts < MIN_ATTEMPTS) {
                // Use default position (index-based score)
                return {
                    selector,
                    successRate: 0.5, // Neutral
                    attempts,
                    confidence: 'low'
                };
            }

            const successRate = successes / attempts;
            return {
                selector,
                successRate,
                attempts,
                confidence: 'high'
            };
        });

        // Sort by success rate (highest first), then by attempts (more = better signal)
        selectorScores.sort((a, b) => {
            // High confidence selectors first
            if (a.confidence !== b.confidence) {
                return a.confidence === 'high' ? -1 : 1;
            }
            // Then by success rate
            if (Math.abs(a.successRate - b.successRate) > 0.1) {
                return b.successRate - a.successRate;
            }
            // Then by attempts (more data = more reliable)
            return b.attempts - a.attempts;
        });

        const optimizedSelectors = selectorScores.map(s => s.selector);
        
        console.log(`[SELECTOR-OPT] Optimized "${selectorKey}":`, 
            selectorScores.slice(0, 3).map(s => 
                `${s.selector.substring(0, 30)}... (${(s.successRate * 100).toFixed(0)}%)`
            )
        );

        return optimizedSelectors;
    } catch (error) {
        console.error('[SELECTOR-OPT] Error optimizing selectors:', error);
        return DEFAULT_SELECTORS[selectorKey] || [];
    }
}

/**
 * Get all optimized selectors as a complete config object
 * @returns {Promise<Object>} - Full selector config with optimized order
 */
async function getFullOptimizedConfig() {
    const optimizedConfig = {};
    const keys = Object.keys(DEFAULT_SELECTORS);
    
    for (const key of keys) {
        optimizedConfig[key] = await getOptimizedSelectors(key);
    }
    
    return optimizedConfig;
}

// ============================================================
// PHASE 8 ENHANCED: Selector Health Reporting
// ============================================================

/**
 * Generate comprehensive selector health report
 * @returns {Promise<Object>} - Health report with metrics and recommendations
 */
async function getSelectorHealthReport() {
    try {
        const stats = await loadSelectorStats();
        const configData = await loadSelectorConfig();
        const config = configData.selectors || DEFAULT_SELECTORS;
        
        const report = {
            timestamp: new Date().toISOString(),
            overallHealth: 0,
            selectorTypes: {},
            problematicSelectors: [],
            recommendations: []
        };

        let totalScore = 0;
        let typeCount = 0;

        // Analyze each selector type
        for (const [key, selectors] of Object.entries(config)) {
            // Extract stats for this selector key
            const keyStats = {};
            const prefix = key + ':';
            for (const [statKey, statValue] of Object.entries(stats)) {
                if (statKey.startsWith(prefix)) {
                    const selector = statKey.substring(prefix.length);
                    keyStats[selector] = statValue;
                }
            }
            
            let workingCount = 0;
            let totalAttempts = 0;
            let totalSuccesses = 0;

            const selectorDetails = selectors.map((selector, index) => {
                const selectorStat = keyStats[selector];
                const attempts = selectorStat ? (selectorStat.successes || 0) + (selectorStat.failures || 0) : 0;
                const successes = selectorStat ? (selectorStat.successes || 0) : 0;
                const successRate = attempts > 0 ? successes / attempts : null;
                
                totalAttempts += attempts;
                totalSuccesses += successes;

                if (successRate !== null && successRate > 0.5) {
                    workingCount++;
                }

                // Flag problematic selectors
                if (attempts > 10 && successRate !== null && successRate < 0.2) {
                    report.problematicSelectors.push({
                        type: key,
                        selector: selector.substring(0, 50),
                        successRate: (successRate * 100).toFixed(1) + '%',
                        attempts
                    });
                }

                return {
                    index,
                    selector: selector.substring(0, 60) + (selector.length > 60 ? '...' : ''),
                    attempts,
                    successRate: successRate !== null ? (successRate * 100).toFixed(1) + '%' : 'N/A'
                };
            });

            const typeHealth = totalAttempts > 0 
                ? Math.round((totalSuccesses / totalAttempts) * 100) 
                : 100; // No attempts = assume healthy

            report.selectorTypes[key] = {
                health: typeHealth,
                totalSelectors: selectors.length,
                workingSelectors: workingCount,
                totalAttempts,
                totalSuccesses,
                details: selectorDetails
            };

            totalScore += typeHealth;
            typeCount++;
        }

        // Calculate overall health
        report.overallHealth = typeCount > 0 ? Math.round(totalScore / typeCount) : 100;

        // Generate recommendations
        if (report.overallHealth < 50) {
            report.recommendations.push('⚠️ CRITICAL: Overall selector health is low. LinkedIn may have changed their structure significantly.');
            report.critical = true;
        }
        
        if (report.problematicSelectors.length > 0) {
            report.recommendations.push(`🔧 ${report.problematicSelectors.length} selector(s) have low success rates and may need updating.`);
        }

        for (const [key, typeData] of Object.entries(report.selectorTypes)) {
            if (typeData.health < 30 && typeData.totalAttempts > 20) {
                report.recommendations.push(`🚨 "${key}" selectors are failing frequently (${typeData.health}% success). Consider adding new selectors.`);
                report.critical = true;
            }
        }

        if (report.recommendations.length === 0) {
            report.recommendations.push('✅ All selectors are healthy!');
        }

        // ENHANCED: Trigger alert if critical
        if (report.critical && report.overallHealth < 50) {
            // Store last alert time to avoid spam
            const alertData = await getFromStorage(['lastCriticalAlert']);
            const lastAlert = alertData.lastCriticalAlert || 0;
            const timeSinceLastAlert = Date.now() - lastAlert;
            const ALERT_COOLDOWN = 3600000; // 1 hour
            
            if (timeSinceLastAlert > ALERT_COOLDOWN) {
                // Send browser notification (requires "notifications" permission in manifest.json)
                try {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                        title: 'LinkedIn Scraper: Critical Selector Health',
                        message: `Selector health dropped to ${report.overallHealth}%. Some fields may not be extracted correctly.`,
                        priority: 2
                    });
                    
                    await saveToStorage({ lastCriticalAlert: Date.now() });
                } catch (notifError) {
                    console.warn('[SELECTOR-HEALTH] Notification failed (may need permissions):', notifError);
                }
            }
        }

        return report;
    } catch (error) {
        console.error('[SELECTOR-HEALTH] Error generating report:', error);
        return {
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// --- MESSAGE HANDLER ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action } = message;
    console.log(`[SW] Received: ${action}`);
    
    // Wrap in async IIFE
    (async () => {
        try {
            let response = { success: true };
            
            switch (action) {
                // --- Authentication ---
                case 'GET_AUTH_TOKEN': {
                    const token = await getAuthToken(message.interactive !== false);
                    response.token = token;
                    break;
                }
                
                case 'CLEAR_AUTH': {
                    await removeCachedToken();
                    break;
                }
                
                // --- Sheet Operations ---
                case 'READ_SHEET': {
                    const data = await readSheet(message.spreadsheetId, message.range);
                    response.data = data;
                    break;
                }
                
                case 'CREATE_SHEET': {
                    const result = await createSheet(message.title);
                    currentOutputSheetId = result.spreadsheetId;
                    currentTabName = 'Sheet1'; // Reset to default tab
                    await saveToStorage({ 
                        outputSheetId: result.spreadsheetId,
                        outputSheetName: message.title,
                        currentTabName: 'Sheet1'
                    });
                    response = { success: true, ...result, sheetName: message.title };
                    break;
                }
                
                case 'LOAD_SHEET': {
                    if (!message.spreadsheetId) {
                        response = { success: false, error: 'No spreadsheet ID provided' };
                        break;
                    }
                    const result = await loadSheet(message.spreadsheetId);
                    currentOutputSheetId = result.spreadsheetId;
                    // Use provided tab, or first tab from result, or default to 'Sheet1'
                    currentTabName = message.tabName || (result.tabs && result.tabs.length > 0 ? result.tabs[0].title : 'Sheet1');
                    await saveToStorage({ 
                        outputSheetId: result.spreadsheetId,
                        currentTabName: currentTabName
                    });
                    response = { success: true, ...result, currentTabName: currentTabName };
                    break;
                }
                
                case 'ADD_TAB': {
                    if (!currentOutputSheetId) {
                        response = { success: false, error: 'No output sheet loaded' };
                        break;
                    }
                    if (!message.tabName) {
                        response = { success: false, error: 'No tab name provided' };
                        break;
                    }
                    const result = await addTabToSheet(currentOutputSheetId, message.tabName);
                    currentTabName = message.tabName; // Switch to the new tab
                    await saveToStorage({ currentTabName: currentTabName });
                    response = { success: true, ...result };
                    break;
                }
                
                case 'SET_OUTPUT_SHEET': {
                    currentOutputSheetId = message.spreadsheetId;
                    currentTabName = message.tabName || 'Sheet1';
                    await saveToStorage({ 
                        outputSheetId: message.spreadsheetId,
                        currentTabName: currentTabName
                    });
                    break;
                }
                
                case 'GET_SHEET_NAME': {
                    if (!message.spreadsheetId) {
                        response = { success: false, error: 'No spreadsheet ID provided' };
                        break;
                    }
                    const sheetName = await getSheetName(message.spreadsheetId);
                    response = { success: true, sheetName };
                    break;
                }
                
                case 'GET_SHEET_TABS': {
                    if (!message.spreadsheetId) {
                        response = { success: false, error: 'No spreadsheet ID provided' };
                        break;
                    }
                    const tabs = await getSheetTabs(message.spreadsheetId);
                    response = { success: true, tabs };
                    break;
                }
                
                case 'SET_CURRENT_TAB': {
                    if (!message.tabName) {
                        response = { success: false, error: 'No tab name provided' };
                        break;
                    }
                    currentTabName = message.tabName;
                    await saveToStorage({ currentTabName: currentTabName });
                    response = { success: true, currentTabName: currentTabName };
                    break;
                }
                
                // --- Settings ---
                case 'GET_SETTINGS': {
                    const settings = await getFromStorage([
                        'inputSheetId',
                        'outputSheetId',
                        'outputSheetName',
                        'currentTabName',
                        'searches',
                        'searchIndex',
                        'savedWorkbooks',
                        'activeTab'
                    ]);
                    currentOutputSheetId = settings.outputSheetId || null;
                    currentTabName = settings.currentTabName || 'Sheet1';
                    currentSearchIndex = settings.searchIndex || 0;
                    savedWorkbooks = settings.savedWorkbooks || [];
                    currentActiveTab = settings.activeTab || null;
                    response.settings = settings;
                    break;
                }
                
                case 'SAVE_SETTINGS': {
                    await saveToStorage(message.settings);
                    if (message.settings.outputSheetId) {
                        currentOutputSheetId = message.settings.outputSheetId;
                    }
                    if (message.settings.searchIndex !== undefined) {
                        currentSearchIndex = message.settings.searchIndex;
                    }
                    break;
                }
                
                // --- Scraping Lifecycle ---
                case 'START_KEEPALIVE': {
                    startKeepAlive();
                    break;
                }
                
                case 'STOP_KEEPALIVE': {
                    stopKeepAlive();
                    break;
                }
                
                // --- DATA HANDLING (Queue-Based) ---
                case 'DATA_SCRAPED': {
                    if (currentOutputSheetId && message.rows && message.rows.length > 0) {
                        // Refresh active tab from storage to ensure we have the latest
                        const stored = await getFromStorage(['activeTab', 'currentTabName']);
                        const activeTab = stored.activeTab || currentActiveTab || stored.currentTabName || currentTabName || 'Sheet1';
                        
                        // PHASE 6: Use currentActiveTab (weekly tab) or fall back to currentTabName (manual selection)
                        const tabName = activeTab;
                        
                        // Update in-memory state if it was stale
                        if (stored.activeTab && stored.activeTab !== currentActiveTab) {
                            currentActiveTab = stored.activeTab;
                            console.log(`[SW] Updated currentActiveTab from storage: ${currentActiveTab}`);
                        }
                        
                        await addToQueue(message.rows, currentOutputSheetId, tabName);
                        console.log(`[SW] Queued page ${message.pageNumber}: ${message.rows.length} rows to tab: ${tabName}`);
                    }
                    break;
                }
                
                // --- SEARCH COMPLETION & SMART NAVIGATION ---
                case 'SEARCH_COMPLETE':
                case 'SCRAPING_COMPLETE': {
                    // Check if auto-run is active - if so, let waitForScrapingComplete handle it
                    const autoRunCheck = await getFromStorage(['autoRunState']);
                    if (autoRunCheck.autoRunState?.isRunning) {
                        console.log('[SW] SCRAPING_COMPLETE received during auto-run - handled by waitForScrapingComplete');
                        // Still process queue and send notification, but don't advance manually
                        stopKeepAlive();
                        await processQueue();
                        
                        // Notify popup (but don't advance - auto-run handles that)
                        chrome.runtime.sendMessage({
                            action: 'NOTIFY_COMPLETE',
                            totalProfiles: message.totalProfiles,
                            totalPages: message.totalPages,
                            nextSearch: null // Auto-run handles navigation
                        }).catch(() => {});
                        
                        response = { success: true, handled: 'auto-run' };
                        break;
                    }
                    
                    // Manual scraping mode - handle normally
                    stopKeepAlive();
                    console.log(`[SW] Search complete: ${message.totalProfiles} profiles`);
                    
                    // Trigger final queue sync
                    await processQueue();
                    
                    // Advance to next search
                    const nextInfo = await advanceToNextSearch();
                    
                    // Notify popup
                    chrome.runtime.sendMessage({
                        action: 'NOTIFY_COMPLETE',
                        totalProfiles: message.totalProfiles,
                        totalPages: message.totalPages,
                        nextSearch: nextInfo
                    }).catch(() => {});
                    
                    response.nextSearch = nextInfo;
                    break;
                }
                
                // --- QUEUE MANAGEMENT ---
                case 'PROCESS_QUEUE': {
                    const result = await processQueue();
                    response = { success: true, ...result };
                    break;
                }
                
                case 'GET_QUEUE_STATUS': {
                    const status = await getQueueStatus();
                    response = { success: true, ...status };
                    break;
                }
                
                case 'GET_FAILED_ROWS': {
                    const rows = await getFailedRows();
                    response = { success: true, rows };
                    break;
                }
                
                case 'CLEAR_FAILED_ROWS': {
                    await clearFailedRows();
                    break;
                }
                
                case 'RETRY_FAILED': {
                    const count = await retryFailedItems();
                    response = { success: true, retriedCount: count };
                    break;
                }
                
                case 'DEDUPLICATE_SHEET': {
                    // Use provided spreadsheetId and tabName, or fall back to current
                    const spreadsheetId = message.spreadsheetId || currentOutputSheetId;
                    const tabName = message.tabName || currentTabName || 'Sheet1';
                    
                    if (!spreadsheetId) {
                        response = { success: false, error: 'No output sheet selected' };
                        break;
                    }
                    
                    const result = await deduplicateSheet(spreadsheetId, tabName);
                    response = { success: true, ...result };
                    break;
                }
                
                // ============================================================
                // PHASE 7: TAB COMPARISON
                // ============================================================
                
                case 'COMPARE_TABS': {
                    const spreadsheetId = message.spreadsheetId || currentOutputSheetId;
                    const { tab1Name, tab2Name, outputTabName, keyColumn } = message;
                    
                    // Validate required parameters
                    if (!spreadsheetId) {
                        response = { success: false, error: 'No spreadsheet selected' };
                        break;
                    }
                    if (!tab1Name || !tab2Name) {
                        response = { success: false, error: 'Please select two tabs to compare' };
                        break;
                    }
                    if (!outputTabName) {
                        response = { success: false, error: 'Please enter a name for the output tab' };
                        break;
                    }
                    if (tab1Name === tab2Name) {
                        response = { success: false, error: 'Please select two different tabs' };
                        break;
                    }
                    
                    console.log(`[SW] Comparing tabs: "${tab1Name}" vs "${tab2Name}" → "${outputTabName}"`);
                    
                    const result = await compareTabs(
                        spreadsheetId, 
                        tab1Name, 
                        tab2Name, 
                        outputTabName, 
                        keyColumn || 1  // Default to Name column
                    );
                    
                    response = { success: result.success, ...result };
                    break;
                }
                
                case 'GET_TAB_DATA': {
                    const spreadsheetId = message.spreadsheetId || currentOutputSheetId;
                    const { tabName } = message;
                    
                    if (!spreadsheetId) {
                        response = { success: false, error: 'No spreadsheet selected' };
                        break;
                    }
                    if (!tabName) {
                        response = { success: false, error: 'No tab name provided' };
                        break;
                    }
                    
                    const data = await getTabData(spreadsheetId, tabName);
                    response = { success: true, ...data };
                    break;
                }
                
                case 'STATUS_UPDATE': {
                    // Forward to popup
                    chrome.runtime.sendMessage(message).catch(() => {});
                    break;
                }
                
                // ============================================================
                // PHASE 6: WORKBOOK MANAGEMENT
                // ============================================================
                
                case 'GET_SAVED_WORKBOOKS': {
                    const stored = await getFromStorage(['savedWorkbooks']);
                    savedWorkbooks = stored.savedWorkbooks || [];
                    response = { success: true, workbooks: savedWorkbooks };
                    break;
                }
                
                case 'SAVE_WORKBOOK': {
                    const { id, name } = message;
                    
                    // Validate the spreadsheet first
                    const validation = await validateSpreadsheet(id);
                    if (!validation.valid) {
                        response = { success: false, error: validation.error };
                        break;
                    }
                    
                    // Load existing workbooks
                    const existingData = await getFromStorage(['savedWorkbooks']);
                    savedWorkbooks = existingData.savedWorkbooks || [];
                    
                    // Check if already saved
                    const existingIndex = savedWorkbooks.findIndex(w => w.id === id);
                    
                    const workbookEntry = {
                        id,
                        name: name || validation.title,
                        sheetTitle: validation.title,
                        lastUsed: new Date().toISOString(),
                        addedAt: existingIndex >= 0 
                            ? savedWorkbooks[existingIndex].addedAt 
                            : new Date().toISOString()
                    };
                    
                    if (existingIndex >= 0) {
                        // Update existing
                        savedWorkbooks[existingIndex] = workbookEntry;
                    } else {
                        // Add new
                        savedWorkbooks.push(workbookEntry);
                    }
                    
                    await saveToStorage({ savedWorkbooks });
                    console.log(`[SW] Saved workbook: ${workbookEntry.name} (${id.substring(0, 10)}...)`);
                    
                    response = { success: true, workbook: workbookEntry };
                    break;
                }
                
                case 'DELETE_WORKBOOK': {
                    const { id } = message;
                    
                    const existingData = await getFromStorage(['savedWorkbooks']);
                    savedWorkbooks = existingData.savedWorkbooks || [];
                    
                    savedWorkbooks = savedWorkbooks.filter(w => w.id !== id);
                    
                    await saveToStorage({ savedWorkbooks });
                    console.log(`[SW] Deleted workbook: ${id.substring(0, 10)}...`);
                    
                    response = { success: true, workbooks: savedWorkbooks };
                    break;
                }
                
                case 'VALIDATE_SPREADSHEET': {
                    const validation = await validateSpreadsheet(message.spreadsheetId);
                    response = { success: validation.valid, ...validation };
                    break;
                }
                
                case 'ENSURE_WEEKLY_TAB': {
                    const result = await ensureWeeklyTab(message.spreadsheetId);
                    
                    // Set this as the active output
                    currentOutputSheetId = result.spreadsheetId;
                    currentActiveTab = result.tabName;
                    
                    // Update last used
                    const stored = await getFromStorage(['savedWorkbooks']);
                    savedWorkbooks = stored.savedWorkbooks || [];
                    const wbIndex = savedWorkbooks.findIndex(w => w.id === result.spreadsheetId);
                    if (wbIndex >= 0) {
                        savedWorkbooks[wbIndex].lastUsed = new Date().toISOString();
                        savedWorkbooks[wbIndex].lastTab = result.tabName;
                        await saveToStorage({ savedWorkbooks });
                    }
                    
                    // Save active tab to storage immediately
                    await saveToStorage({ 
                        outputSheetId: result.spreadsheetId,
                        activeTab: result.tabName,
                        currentTabName: result.tabName  // Also update currentTabName for compatibility
                    });
                    
                    // Update any pending queue items to use the new tab
                    await updateQueueTabName(result.spreadsheetId, result.tabName);
                    
                    console.log(`[SW] ✅ Weekly tab "${result.tabName}" is now active. Updated queue items.`);
                    
                    response = { success: true, ...result };
                    break;
                }
                
                case 'SET_ACTIVE_TAB': {
                    currentActiveTab = message.tabName;
                    currentOutputSheetId = message.spreadsheetId;
                    await saveToStorage({ 
                        activeTab: message.tabName,
                        outputSheetId: message.spreadsheetId
                    });
                    response = { success: true };
                    break;
                }
                
                case 'GET_ACTIVE_OUTPUT': {
                    response = { 
                        success: true, 
                        spreadsheetId: currentOutputSheetId,
                        tabName: currentActiveTab
                    };
                    break;
                }
                
                // ============================================================
                // PHASE 8: SOURCE MAPPING & BATCH QUEUE
                // ============================================================
                
                case 'GET_SOURCE_MAPPING': {
                    try {
                        const stored = await getFromStorage(['sourceMapping']);
                        sourceMapping = stored.sourceMapping || {};
                        console.log(`[SW] Loaded source mapping with ${Object.keys(sourceMapping).length} entries`);
                        response = { success: true, mapping: sourceMapping };
                    } catch (error) {
                        console.error('[SW] Error loading source mapping:', error);
                        response = { success: false, error: error.message, mapping: {} };
                    }
                    break;
                }
                
                case 'SAVE_SOURCE_MAPPING': {
                    try {
                        const newMapping = message.mapping || {};
                        
                        // Validate mapping structure
                        for (const [source, workbookId] of Object.entries(newMapping)) {
                            if (typeof source !== 'string' || typeof workbookId !== 'string') {
                                throw new Error('Invalid mapping structure: keys and values must be strings');
                            }
                        }
                        
                        // Save to storage
                        await saveToStorage({ sourceMapping: newMapping });
                        
                        // Update in-memory cache
                        sourceMapping = newMapping;
                        
                        console.log(`[SW] Saved source mapping: ${Object.keys(sourceMapping).length} entries`);
                        response = { success: true, mapping: sourceMapping };
                    } catch (error) {
                        console.error('[SW] Error saving source mapping:', error);
                        response = { success: false, error: error.message };
                    }
                    break;
                }
                
                case 'START_AUTO_RUN': {
                    try {
                        // Check if already running - verify with alarm check
                        const stored = await getFromStorage(['autoRunState']);
                        const alarm = await chrome.alarms.get('AUTO_RUN_KEEPALIVE');
                        
                        // If state says running, check if it's actually running
                        if (stored.autoRunState?.isRunning) {
                            // Check if alarm exists - if not, it's stale
                            if (!alarm) {
                                console.log('[SW] Detected stale auto-run state on START (no alarm), clearing...');
                                const clearedState = { isRunning: false, isAborted: false, config: null, progress: null };
                                await saveToStorage({ autoRunState: clearedState });
                                autoRunState = clearedState;
                                // Clear any existing alarm just in case
                                await chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
                            } else {
                                // Alarm exists - check if it's actually running by checking progress
                                // If progress hasn't updated in 5 minutes, it's likely stale
                                const progress = stored.autoRunState.progress || {};
                                const lastUpdate = progress.startTime || 0;
                                const timeSinceStart = Date.now() - lastUpdate;
                                
                                // If started more than 5 minutes ago and no progress, might be stale
                                // But if it's been aborted, allow new start
                                if (stored.autoRunState.isAborted) {
                                    console.log('[SW] Previous auto-run was aborted, allowing new start');
                                    // Clear the aborted state
                                    const clearedState = { isRunning: false, isAborted: false, config: null, progress: null };
                                    await saveToStorage({ autoRunState: clearedState });
                                    autoRunState = clearedState;
                                    await chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
                                } else if (timeSinceStart > 300000 && progress.completedSearches === 0) {
                                    // Started 5+ minutes ago with no progress - likely stale
                                    console.log('[SW] Detected stale auto-run state (no progress for 5+ min), clearing...');
                                    const clearedState = { isRunning: false, isAborted: false, config: null, progress: null };
                                    await saveToStorage({ autoRunState: clearedState });
                                    autoRunState = clearedState;
                                    await chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
                                } else {
                                    // Actually running - reject
                                    response = { success: false, error: 'Auto-run is already in progress' };
                                    break;
                                }
                            }
                        }
                        
                        const { config } = message;
                        if (!config || !config.sources || !config.groupedSearches) {
                            response = { success: false, error: 'Invalid auto-run configuration' };
                            break;
                        }
                        
                        // Validate all sources are mapped
                        const unmapped = config.sources.filter(s => !sourceMapping[s]);
                        if (unmapped.length > 0) {
                            response = { success: false, error: `Unmapped sources: ${unmapped.join(', ')}` };
                            break;
                        }
                        
                        // Initialize state
                        const initialState = {
                            isRunning: true,
                            isAborted: false,
                            config: config,
                            progress: {
                                currentSourceIndex: 0,
                                currentSearchIndex: 0,
                                totalSources: config.sources.length,
                                totalSearches: config.searches.length,
                                completedSearches: 0,
                                completedSources: 0,
                                totalProfiles: 0,
                                currentSource: null,
                                currentSearch: null,
                                startTime: Date.now(),
                                errors: []
                            }
                        };
                        
                        // Save to storage
                        await saveToStorage({ autoRunState: initialState });
                        autoRunState = initialState;
                        
                        // Start keep-alive alarm (keeps service worker alive)
                        // Use more frequent alarm during active processing (every 10 seconds)
                        chrome.alarms.create('AUTO_RUN_KEEPALIVE', { periodInMinutes: 0.167 }); // Every 10 seconds
                        
                        // Start processing in background (don't await)
                        processAutoRunQueue().catch(error => {
                            console.error('[SW] Auto-run error:', error);
                            // Update state to show error
                            updateAutoRunState({ isRunning: false, error: error.message });
                        });
                        
                        console.log('[SW] Auto-run started');
                        response = { success: true, message: 'Auto-run started in background' };
                        
                    } catch (error) {
                        console.error('[SW] Error starting auto-run:', error);
                        response = { success: false, error: error.message };
                    }
                    break;
                }
                
                case 'STOP_AUTO_RUN': {
                    try {
                        autoRunState.isAborted = true;
                        await saveToStorage({ 
                            autoRunState: { ...autoRunState, isAborted: true }
                        });
                        console.log('[SW] Auto-run stop requested');
                        response = { success: true, message: 'Stop requested - will stop after current scrape' };
                    } catch (error) {
                        response = { success: false, error: error.message };
                    }
                    break;
                }
                
                case 'CLEAR_AUTO_RUN_STATE': {
                    try {
                        console.log('[SW] Force clearing auto-run state...');
                        // Clear alarm
                        await chrome.alarms.clear('AUTO_RUN_KEEPALIVE');
                        
                        // Clear state
                        const clearedState = {
                            isRunning: false,
                            isAborted: false,
                            config: null,
                            progress: null
                        };
                        await saveToStorage({ autoRunState: clearedState });
                        autoRunState = clearedState;
                        
                        console.log('[SW] Auto-run state cleared');
                        response = { success: true, message: 'Auto-run state cleared' };
                    } catch (error) {
                        console.error('[SW] Error clearing auto-run state:', error);
                        response = { success: false, error: error.message };
                    }
                    break;
                }
                
                case 'GET_AUTO_RUN_STATUS': {
                    try {
                        const stored = await getFromStorage(['autoRunState']);
                        let state = stored.autoRunState || { isRunning: false };
                        
                        // Check if keep-alive alarm is still active
                        // If state says running but alarm is gone, it's stale
                        const alarm = await chrome.alarms.get('AUTO_RUN_KEEPALIVE');
                        if (state.isRunning && !alarm) {
                            console.log('[SW] Detected stale auto-run state (alarm missing), clearing...');
                            // Clear stale state
                            state = { isRunning: false, isAborted: false, config: null, progress: null };
                            await saveToStorage({ autoRunState: state });
                            autoRunState = state;
                        }
                        
                        // Calculate progress percentage
                        const progress = state.progress || {};
                        const percent = progress.totalSearches > 0 
                            ? Math.round((progress.completedSearches / progress.totalSearches) * 100)
                            : 0;
                        
                        response = {
                            success: true,
                            isRunning: state.isRunning || false,
                            isAborted: state.isAborted || false,
                            progress: {
                                ...progress,
                                percent: percent
                            }
                        };
                    } catch (error) {
                        response = { success: false, error: error.message };
                    }
                    break;
                }
                
                // ============================================================
                // PHASE 8: SELECTOR RESILIENCE MANAGEMENT
                // ============================================================
                
                case 'GET_SELECTOR_CONFIG': {
                    try {
                        const config = await loadSelectorConfig();
                        const stats = await loadSelectorStats();
                        response = {
                            success: true,
                            config: config.selectors,
                            version: config.version,
                            stats: stats
                        };
                    } catch (error) {
                        console.error('[SW] Error loading selector config:', error);
                        response = {
                            success: false,
                            error: error.message,
                            config: DEFAULT_SELECTORS,
                            version: SELECTOR_VERSION,
                            stats: {}
                        };
                    }
                    break;
                }

                case 'UPDATE_SELECTOR_CONFIG': {
                    try {
                        const { selectors } = message;
                        
                        // Validate structure
                        if (!selectors || typeof selectors !== 'object') {
                            response = { success: false, error: 'Invalid selector configuration' };
                            break;
                        }
                        
                        await saveSelectorConfig(selectors);
                        console.log('[SW] ✅ Selector config updated');
                        
                        response = { success: true };
                    } catch (error) {
                        console.error('[SW] Error updating selector config:', error);
                        response = { success: false, error: error.message };
                    }
                    break;
                }

                case 'RESET_SELECTOR_CONFIG': {
                    try {
                        await resetSelectorConfig();
                        console.log('[SW] ✅ Selector config reset to defaults');
                        
                        response = { success: true };
                    } catch (error) {
                        console.error('[SW] Error resetting selector config:', error);
                        response = { success: false, error: error.message };
                    }
                    break;
                }

                case 'TRACK_SELECTOR_SUCCESS': {
                    try {
                        const { selectorKey, selector } = message;
                        await updateSelectorStat(selectorKey, selector, true);
                        
                        // Fire and forget - don't block response
                        response = { success: true };
                    } catch (error) {
                        // Don't fail the request if stats tracking fails
                        response = { success: true };
                    }
                    break;
                }

                case 'TRACK_SELECTOR_FAILURE': {
                    try {
                        const { selectorKey, selector } = message;
                        await updateSelectorStat(selectorKey, selector, false);
                        
                        response = { success: true };
                    } catch (error) {
                        response = { success: true };
                    }
                    break;
                }

                case 'GET_OPTIMIZED_SELECTORS': {
                    const { selectorKey } = message;
                    if (selectorKey) {
                        getOptimizedSelectors(selectorKey).then(selectors => {
                            sendResponse({ success: true, selectors });
                        }).catch(error => {
                            sendResponse({ success: false, error: error.message });
                        });
                    } else {
                        getFullOptimizedConfig().then(config => {
                            sendResponse({ success: true, config });
                        }).catch(error => {
                            sendResponse({ success: false, error: error.message });
                        });
                    }
                    return true; // Keep channel open for async
                }

                case 'GET_SELECTOR_HEALTH_REPORT': {
                    getSelectorHealthReport().then(report => {
                        sendResponse({ success: true, report });
                    }).catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                    return true; // Keep channel open for async
                }

                case 'LOG_SELECTOR_FAILURE': {
                    try {
                        const { diagnostics } = message;
                        
                        // Store failure diagnostics (keep last 10)
                        const failures = await getFromStorage(['selectorFailures']);
                        const failureList = failures.selectorFailures || [];
                        
                        failureList.push({
                            ...diagnostics,
                            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        });
                        
                        // Keep only last 10 failures
                        if (failureList.length > 10) {
                            failureList.shift();
                        }
                        
                        await saveToStorage({ selectorFailures: failureList });
                        
                        console.warn('[SW] Selector failure logged:', diagnostics.selectorKey);
                        
                        response = { success: true };
                    } catch (error) {
                        console.error('[SW] Error logging selector failure:', error);
                        response = { success: true };
                    }
                    break;
                }

                case 'SELECTOR_VALIDATION_RESULTS': {
                    try {
                        const { results, pageUrl, timestamp } = message;
                        
                        // Store validation results
                        await saveToStorage({
                            lastSelectorValidation: {
                                results,
                                pageUrl,
                                timestamp
                            }
                        });
                        
                        // Check for critical issues (no selectors working)
                        const criticalIssues = Object.keys(results).filter(key => {
                            return results[key].working === 0;
                        });
                        
                        if (criticalIssues.length > 0) {
                            console.error('[SW] ⚠️ CRITICAL: Selectors failing:', criticalIssues);
                            
                            // PHASE 8 ENHANCEMENT: Trigger auto-learning when critical issues detected
                            try {
                                const config = await loadSelectorConfig();
                                const reorderedConfig = await autoLearnSelectorOrder(config.selectors);
                                const orderChanged = JSON.stringify(reorderedConfig) !== JSON.stringify(config.selectors);
                                
                                if (orderChanged) {
                                    await saveSelectorConfig(reorderedConfig);
                                    console.log('[SW] ✅ Auto-learned selector order after critical failure');
                                }
                            } catch (e) {
                                // Auto-learning failed, but don't fail the validation
                                console.warn('[SW] Auto-learning error:', e);
                            }
                        }
                        
                        response = { success: true, criticalIssues };
                    } catch (error) {
                        console.error('[SW] Error storing validation results:', error);
                        response = { success: true };
                    }
                    break;
                }

                case 'GET_SELECTOR_HEALTH': {
                    try {
                        const config = await loadSelectorConfig();
                        const stats = await loadSelectorStats();
                        const failures = await getFromStorage(['selectorFailures']);
                        const validation = await getFromStorage(['lastSelectorValidation']);
                        
                        // Calculate health summary
                        const health = {
                            version: config.version,
                            configLoaded: !!config.selectors,
                            totalSelectorKeys: Object.keys(config.selectors).length,
                            statsAvailable: Object.keys(stats).length,
                            recentFailures: (failures.selectorFailures || []).length,
                            lastValidation: validation.lastSelectorValidation?.timestamp || null,
                            criticalIssues: []
                        };
                        
                        // Identify selectors with low success rates
                        Object.keys(stats).forEach(statKey => {
                            const stat = stats[statKey];
                            if (stat.attempts >= 10 && stat.successRate < 0.5) {
                                health.criticalIssues.push({
                                    selector: statKey,
                                    successRate: stat.successRate,
                                    attempts: stat.attempts
                                });
                            }
                        });
                        
                        response = {
                            success: true,
                            health
                        };
                    } catch (error) {
                        console.error('[SW] Error getting selector health:', error);
                        response = {
                            success: false,
                            error: error.message
                        };
                    }
                    break;
                }

                case 'RESET_SELECTOR_STATS': {
                    try {
                        await saveSelectorStats({});
                        console.log('[SW] ✅ Selector stats reset');
                        
                        response = { success: true };
                    } catch (error) {
                        response = { success: false, error: error.message };
                    }
                    break;
                }

                case 'LINKEDIN_WARNING_DETECTED': {
                    try {
                        const { pageUrl, timestamp } = message;
                        
                        // Store warning detection
                        const warnings = await getFromStorage(['linkedInWarnings']);
                        const warningList = warnings.linkedInWarnings || [];
                        
                        warningList.push({
                            pageUrl,
                            timestamp: timestamp || new Date().toISOString(),
                            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        });
                        
                        // Keep only last 5 warnings
                        if (warningList.length > 5) {
                            warningList.shift();
                        }
                        
                        await saveToStorage({ linkedInWarnings: warningList });
                        
                        // Trigger notification to all popup instances
                        chrome.runtime.sendMessage({
                            action: 'SHOW_WARNING_NOTIFICATION',
                            message: 'LinkedIn security checkpoint detected. Please complete verification before continuing.',
                            type: 'linkedin_warning'
                        }).catch(() => {}); // Ignore if no popup open
                        
                        console.error('[SW] 🚨 LinkedIn warning detected:', pageUrl);
                        
                        response = { success: true };
                    } catch (error) {
                        console.error('[SW] Error handling LinkedIn warning:', error);
                        response = { success: true };
                    }
                    break;
                }

                case 'AUTO_LEARN_SELECTORS': {
                    try {
                        const config = await loadSelectorConfig();
                        const stats = await loadSelectorStats();
                        
                        // Only auto-learn if we have enough data
                        const hasEnoughData = Object.keys(stats).some(statKey => {
                            const stat = stats[statKey];
                            return stat.attempts >= 10;
                        });
                        
                        if (!hasEnoughData) {
                            response = { success: true, learned: false, reason: 'Insufficient data' };
                            break;
                        }
                        
                        // Reorder selectors based on performance
                        const reorderedConfig = await autoLearnSelectorOrder(config.selectors);
                        
                        // Only save if order changed
                        const orderChanged = JSON.stringify(reorderedConfig) !== JSON.stringify(config.selectors);
                        
                        if (orderChanged) {
                            await saveSelectorConfig(reorderedConfig);
                            console.log('[SW] ✅ Selector order auto-learned and updated');
                            response = { success: true, learned: true, updated: true };
                        } else {
                            response = { success: true, learned: true, updated: false, reason: 'Order already optimal' };
                        }
                    } catch (error) {
                        console.error('[SW] Error auto-learning selectors:', error);
                        response = { success: false, error: error.message };
                    }
                    break;
                }

                case 'CHECK_PAGE_FINGERPRINT': {
                    try {
                        const { fingerprint, pageUrl } = message;
                        
                        // Get last known fingerprint for this URL
                        const fingerprints = await getFromStorage(['pageFingerprints']);
                        const fingerprintMap = fingerprints.pageFingerprints || {};
                        
                        const urlBase = pageUrl.split('?')[0]; // URL without params
                        const lastFingerprint = fingerprintMap[urlBase];
                        
                        if (lastFingerprint && lastFingerprint.fingerprint !== fingerprint) {
                            // Fingerprint changed - possible UI update
                            console.warn('[SW] ⚠️ Page structure changed - LinkedIn may have updated UI:', urlBase);
                            
                            // Store change detection
                            const changes = await getFromStorage(['pageStructureChanges']);
                            const changeList = changes.pageStructureChanges || [];
                            
                            changeList.push({
                                url: urlBase,
                                oldFingerprint: lastFingerprint.fingerprint,
                                newFingerprint: fingerprint,
                                timestamp: new Date().toISOString(),
                                lastSeen: lastFingerprint.timestamp
                            });
                            
                            // Keep only last 10 changes
                            if (changeList.length > 10) {
                                changeList.shift();
                            }
                            
                            await saveToStorage({ pageStructureChanges: changeList });
                            
                            response = {
                                success: true,
                                changed: true,
                                message: 'Page structure changed - LinkedIn UI may have been updated'
                            };
                        } else {
                            // Update fingerprint
                            fingerprintMap[urlBase] = {
                                fingerprint,
                                timestamp: new Date().toISOString()
                            };
                            await saveToStorage({ pageFingerprints: fingerprintMap });
                            
                            response = { success: true, changed: false };
                        }
                    } catch (error) {
                        console.error('[SW] Error checking fingerprint:', error);
                        response = { success: false, error: error.message };
                    }
                    break;
                }

                case 'SELECTOR_CRITICAL_FAILURE': {
                    try {
                        const { failures, pageUrl } = message;
                        
                        // Store critical failure
                        await saveToStorage({
                            lastCriticalSelectorFailure: {
                                failures,
                                pageUrl,
                                timestamp: new Date().toISOString()
                            }
                        });
                        
                        console.error('[SW] 🚨 CRITICAL: Selector failures detected:', failures);
                        
                        // PHASE 8 ENHANCEMENT: Send visible notification to popup
                        chrome.runtime.sendMessage({
                            action: 'SHOW_CRITICAL_FAILURE_NOTIFICATION',
                            failures,
                            pageUrl,
                            message: `Critical selector failures detected: ${failures.join(', ')}. Scraping may fail.`
                        }).catch(() => {}); // Ignore if no popup open
                        
                        // PHASE 8 ENHANCEMENT: Optional webhook notification (if configured)
                        const webhookConfig = await getFromStorage(['webhookUrl']);
                        if (webhookConfig.webhookUrl) {
                            try {
                                fetch(webhookConfig.webhookUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        type: 'selector_critical_failure',
                                        failures,
                                        pageUrl,
                                        timestamp: new Date().toISOString()
                                    })
                                }).catch(() => {}); // Fire and forget
                            } catch (e) {
                                // Ignore webhook errors
                            }
                        }
                        
                        response = { success: true };
                    } catch (error) {
                        console.error('[SW] Error handling critical failure:', error);
                        response = { success: true };
                    }
                    break;
                }

                default:
                    response = { success: false, error: `Unknown action: ${action}` };
            }
            
            sendResponse(response);
            
        } catch (error) {
            console.error(`[SW] Error handling ${action}:`, error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    
    return true; // CRITICAL: Keep channel open for async response
});

// --- SIDEBAR MANAGEMENT ---
// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('[SW] Sidebar opened');
    } catch (error) {
        console.error('[SW] Error opening sidebar:', error);
    }
});

// Load settings and start queue processor on startup
(async () => {
    try {
        const settings = await getFromStorage([
            'outputSheetId', 
            'currentTabName', 
            'searchIndex', 
            'savedWorkbooks', 
            'activeTab',
            'sourceMapping',
            'autoRunState'
        ]);
        currentOutputSheetId = settings.outputSheetId || null;
        currentTabName = settings.currentTabName || 'Sheet1';
        currentSearchIndex = settings.searchIndex || 0;
        savedWorkbooks = settings.savedWorkbooks || [];
        currentActiveTab = settings.activeTab || null;
        sourceMapping = settings.sourceMapping || {};
        autoRunState = settings.autoRunState || {
            isRunning: false,
            isAborted: false,
            config: null,
            progress: null
        };
        
        // Resume auto-run if it was running when extension reloaded
        if (autoRunState.isRunning && !autoRunState.isAborted) {
            console.log('[SW] Resuming auto-run after reload');
            chrome.alarms.create('AUTO_RUN_KEEPALIVE', { periodInMinutes: 0.3 });
            processAutoRunQueue().catch(error => {
                console.error('[SW] Auto-run resume error:', error);
                updateAutoRunState({ isRunning: false, error: error.message });
            });
        }
        
        startQueueProcessor(); // Ensure queue processor runs
        
        // PHASE 8: Selector system health check
        try {
            const config = await loadSelectorConfig();
            console.log(`[SW] Selector system v${config.version} loaded`);
            
            // Check for recent failures
            const failures = await getFromStorage(['selectorFailures']);
            const failureList = failures.selectorFailures || [];
            
            if (failureList.length > 0) {
                const recentFailures = failureList.filter(f => {
                    const failTime = new Date(f.timestamp);
                    const hoursAgo = (Date.now() - failTime.getTime()) / (1000 * 60 * 60);
                    return hoursAgo < 24; // Last 24 hours
                });
                
                if (recentFailures.length > 0) {
                    console.warn(`[SW] ⚠️ ${recentFailures.length} selector failures in last 24 hours`);
                }
            }
        } catch (selectorError) {
            console.warn('[SW] Selector system health check failed:', selectorError);
        }
        
        console.log('[SW] Service worker initialized');
    } catch (error) {
        console.error('[SW] Init error:', error);
    }
})();
