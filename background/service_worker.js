// background/service_worker.js - Main Service Worker

import { getAuthToken, removeCachedToken } from './auth.js';
import { createSheet, appendRows, readSheet, deduplicateSheet, getSheetName, addTabToSheet, loadSheet, getSheetTabs } from './sheets_api.js';
import { 
    addToQueue, 
    processQueue, 
    getQueueStatus, 
    getFailedRows, 
    clearFailedRows,
    retryFailedItems 
} from './sync_queue.js';

// --- STATE ---
let currentOutputSheetId = null;
let currentTabName = 'Sheet1'; // Default tab name
let isScrapingActive = false;
let currentSearchIndex = 0;

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
                        'searchIndex'
                    ]);
                    currentOutputSheetId = settings.outputSheetId || null;
                    currentTabName = settings.currentTabName || 'Sheet1';
                    currentSearchIndex = settings.searchIndex || 0;
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
                        // Add to queue instead of direct API call (include tab name)
                        await addToQueue(message.rows, currentOutputSheetId, currentTabName);
                        console.log(`[SW] Queued page ${message.pageNumber}: ${message.rows.length} rows to tab: ${currentTabName}`);
                    }
                    break;
                }
                
                // --- SEARCH COMPLETION & SMART NAVIGATION ---
                case 'SEARCH_COMPLETE':
                case 'SCRAPING_COMPLETE': {
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
                    if (!currentOutputSheetId) {
                        response = { success: false, error: 'No output sheet selected' };
                        break;
                    }
                    const result = await deduplicateSheet(currentOutputSheetId, currentTabName);
                    response = { success: true, ...result };
                    break;
                }
                
                case 'STATUS_UPDATE': {
                    // Forward to popup
                    chrome.runtime.sendMessage(message).catch(() => {});
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

// --- INITIALIZATION ---
chrome.runtime.onInstalled.addListener(() => {
    console.log('[SW] Savvy Pirate installed');
    startQueueProcessor(); // Start periodic queue processing
});

// Load settings and start queue processor on startup
(async () => {
    try {
        const settings = await getFromStorage(['outputSheetId', 'currentTabName', 'searchIndex']);
        currentOutputSheetId = settings.outputSheetId || null;
        currentTabName = settings.currentTabName || 'Sheet1';
        currentSearchIndex = settings.searchIndex || 0;
        startQueueProcessor(); // Ensure queue processor runs
        console.log('[SW] Service worker initialized');
    } catch (error) {
        console.error('[SW] Init error:', error);
    }
})();
