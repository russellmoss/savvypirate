// popup/popup.js - Popup Controller with Queue & Smart Navigation

// --- DOM ELEMENTS ---
const elements = {
    // Status
    connectionStatus: document.getElementById('connectionStatus'),
    statusText: document.getElementById('statusText'),
    progressFill: document.getElementById('progressFill'),
    
    // Input Sheet
    inputSheetId: document.getElementById('inputSheetId'),
    loadSearchesBtn: document.getElementById('loadSearchesBtn'),
    searchList: document.getElementById('searchList'),
    searchProgressText: document.getElementById('searchProgressText'),
    searchProgressFill: document.getElementById('searchProgressFill'),
    refreshProgressBtn: document.getElementById('refreshProgressBtn'),
    
    // Output Sheet
    newSheetName: document.getElementById('newSheetName'),
    createSheetBtn: document.getElementById('createSheetBtn'),
    loadSheetId: document.getElementById('loadSheetId'),
    loadSheetBtn: document.getElementById('loadSheetBtn'),
    newTabName: document.getElementById('newTabName'),
    addTabBtn: document.getElementById('addTabBtn'),
    outputSheetDisplay: document.getElementById('outputSheetDisplay'),
    outputSheetDisplayText: document.getElementById('outputSheetDisplayText'),
    tabSelector: document.getElementById('tabSelector'),
    currentTabDisplay: document.getElementById('currentTabDisplay'),
    openOutputSheet: document.getElementById('openOutputSheet'),
    
    // Queue Status (NEW)
    queueSection: document.getElementById('queueSection'),
    pendingRows: document.getElementById('pendingRows'),
    syncedRows: document.getElementById('syncedRows'),
    failedRows: document.getElementById('failedRows'),
    failedStat: document.getElementById('failedStat'),
    queueActions: document.getElementById('queueActions'),
    retryFailedBtn: document.getElementById('retryFailedBtn'),
    downloadFailedBtn: document.getElementById('downloadFailedBtn'),
    forceSync: document.getElementById('forceSync'),
    deduplicateBtn: document.getElementById('deduplicateBtn'),
    
    // Actions
    startScrapingBtn: document.getElementById('startScrapingBtn'),
    stopScrapingBtn: document.getElementById('stopScrapingBtn'),
    
    // Smart Navigation (NEW)
    nextSearchPanel: document.getElementById('nextSearchPanel'),
    completedProfiles: document.getElementById('completedProfiles'),
    completedPages: document.getElementById('completedPages'),
    nextSearchSource: document.getElementById('nextSearchSource'),
    nextSearchTitle: document.getElementById('nextSearchTitle'),
    nextSearchInfo: document.getElementById('nextSearchInfo'),
    allCompleteMessage: document.getElementById('allCompleteMessage'),
    proceedNextBtn: document.getElementById('proceedNextBtn'),
    dismissNextBtn: document.getElementById('dismissNextBtn'),
    
    // Workbook Manager (Phase 6)
    savedWorkbooksSelect: document.getElementById('savedWorkbooksSelect'),
    addWorkbookBtn: document.getElementById('addWorkbookBtn'),
    addWorkbookForm: document.getElementById('addWorkbookForm'),
    newWorkbookId: document.getElementById('newWorkbookId'),
    newWorkbookName: document.getElementById('newWorkbookName'),
    saveNewWorkbookBtn: document.getElementById('saveNewWorkbookBtn'),
    cancelAddWorkbookBtn: document.getElementById('cancelAddWorkbookBtn'),
    selectedWorkbookInfo: document.getElementById('selectedWorkbookInfo'),
    selectedWorkbookName: document.getElementById('selectedWorkbookName'),
    selectedWorkbookId: document.getElementById('selectedWorkbookId'),
    removeWorkbookBtn: document.getElementById('removeWorkbookBtn'),
    activeTabDisplay: document.getElementById('activeTabDisplay'),
    activeTabName: document.getElementById('activeTabName'),
    activeTabStatus: document.getElementById('activeTabStatus'),
    workbookActiveCheckbox: document.getElementById('workbookActiveCheckbox'),
    workbookActiveCheck: document.getElementById('workbookActiveCheck'),
    outputActiveCheckbox: document.getElementById('outputActiveCheckbox'),
    outputActiveCheck: document.getElementById('outputActiveCheck'),
    
    // Compare Section (Phase 7)
    compareTab1: document.getElementById('compareTab1'),
    compareTab2: document.getElementById('compareTab2'),
    compareOutputName: document.getElementById('compareOutputName'),
    compareKeyColumn: document.getElementById('compareKeyColumn'),
    compareBtn: document.getElementById('compareBtn'),
    refreshTabsBtn: document.getElementById('refreshTabsBtn'),
    compareResults: document.getElementById('compareResults'),
    compareTab1Count: document.getElementById('compareTab1Count'),
    compareTab2Count: document.getElementById('compareTab2Count'),
    compareNewCount: document.getElementById('compareNewCount'),
    compareOutputTab: document.getElementById('compareOutputTab'),
    compareError: document.getElementById('compareError'),
    
    // --- Phase 8: Source Mapping ---
    mappingSection: document.getElementById('mappingSection'),
    mappingStatusBar: document.getElementById('mappingStatusBar'),
    mappedCount: document.getElementById('mappedCount'),
    unmappedCount: document.getElementById('unmappedCount'),
    mappingList: document.getElementById('mappingList'),
    saveMappingBtn: document.getElementById('saveMappingBtn'),
    clearMappingBtn: document.getElementById('clearMappingBtn'),
    autoMapBtn: document.getElementById('autoMapBtn'),
    
    // Phase 8: Selector Health
    selectorHealthSection: document.getElementById('selectorHealthSection'),
    healthIndicator: document.getElementById('healthIndicator'),
    healthDot: document.querySelector('.health-dot'),
    healthText: document.getElementById('healthText'),
    testSelectorsBtn: document.getElementById('testSelectorsBtn'),
    selectorHealthDetails: document.getElementById('selectorHealthDetails'),
    healthSummary: document.getElementById('healthSummary'),
    healthDetailsContent: document.getElementById('healthDetailsContent'),
    selectorConfigTextarea: document.getElementById('selectorConfigTextarea'),
    updateSelectorsBtn: document.getElementById('updateSelectorsBtn'),
    resetSelectorsBtn: document.getElementById('resetSelectorsBtn'),
    // Phase 8 Enhancement: Notifications
    notificationBanner: document.getElementById('notificationBanner'),
    notificationIcon: document.getElementById('notificationIcon'),
    notificationMessage: document.getElementById('notificationMessage'),
    notificationClose: document.getElementById('notificationClose'),
    
    // --- Phase 8: Auto-Run ---
    autoRunSection: document.getElementById('autoRunSection'),
    selectionSummary: document.getElementById('selectionSummary'),
    selectedSearchCount: document.getElementById('selectedSearchCount'),
    selectedSourceCount: document.getElementById('selectedSourceCount'),
    selectAllSearchesBtn: document.getElementById('selectAllSearchesBtn'),
    deselectAllSearchesBtn: document.getElementById('deselectAllSearchesBtn'),
    autoRunBtn: document.getElementById('autoRunBtn'),
    stopAutoRunBtn: document.getElementById('stopAutoRunBtn'),
    
    // --- Phase 8: Auto-Run Progress ---
    autoRunProgress: document.getElementById('autoRunProgress'),
    autoRunTitle: document.getElementById('autoRunTitle'),
    autoRunDetail: document.getElementById('autoRunDetail'),
    autoRunProgressFill: document.getElementById('autoRunProgressFill'),
    currentSourceName: document.getElementById('currentSourceName'),
    currentSearchInfo: document.getElementById('currentSearchInfo'),
    autoRunProfileCount: document.getElementById('autoRunProfileCount'),
    
    // --- Phase 8: Activity Log ---
    autoRunLog: document.getElementById('autoRunLog'),
    logEntries: document.getElementById('logEntries')
};

// --- STATE ---
let state = {
    searches: [],
    searchIndex: 0,
    outputSheetId: null,
    outputSheetUrl: null,
    outputSheetName: null,
    currentTabName: 'Sheet1',
    isAuthenticated: false,
    isScrapingActive: false,
    totalSynced: 0,
    nextSearchInfo: null,
    
    // Phase 6: Workbook Manager
    savedWorkbooks: [],
    selectedWorkbook: null,
    activeTabName: null,
    activeSheetType: null, // 'workbook' or 'output'
    activeSheetId: null,
    activeSheetTab: null,
    
    // Phase 7: Compare Tabs
    compareTabs: [],
    isComparing: false,
    
    // Phase 8: Selector Health
    selectorHealth: null,
    
    // PHASE 8: Auto-Run Batch Queue
    sourceMapping: {},            // Source name → Workbook ID
    selectedSearches: new Set(),  // Set of selected search indices
    isAutoRunning: false,         // Batch queue running state
    autoRunAborted: false,        // User requested abort
    statusPollInterval: null,     // Interval ID for status polling
    autoRunStats: {
        totalSearches: 0,
        completedSearches: 0,
        totalSources: 0,
        completedSources: 0,
        totalProfiles: 0,
        currentSource: null,
        currentSearch: null,
        startTime: null
    }
};

let queuePollInterval = null;
let statusCheckInterval = null;

// --- HELPERS ---
function sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...data }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (!response) {
                // Service worker might not be responding
                reject(new Error('Service worker not responding. Try reloading the extension.'));
            } else if (response && !response.success) {
                reject(new Error(response.error || 'Unknown error'));
            } else {
                resolve(response || { success: true });
            }
        });
    });
}

/**
 * Send message to content script with timeout
 * Returns null if content script not responding
 */
function sendTabMessage(tabId, message, timeout = 1000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeout);
        
        chrome.tabs.sendMessage(tabId, message, (response) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
                console.log('[POPUP] Tab message failed:', chrome.runtime.lastError.message);
                resolve(null);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * CRITICAL: Ensure content script is injected before sending commands
 * This handles cases where:
 * - Page was loaded before extension was installed
 * - Page was reloaded and content script didn't auto-inject
 * - Navigation happened without triggering content script
 */
async function ensureContentScriptInjected(tabId) {
    console.log('[POPUP] Checking if content script is alive...');
    
    // Try PING first
    const pingResponse = await sendTabMessage(tabId, { action: 'PING' }, 500);
    
    if (pingResponse && pingResponse.status === 'alive') {
        console.log('[POPUP] Content script is alive');
        return true;
    }
    
    // Content script not responding - inject it
    console.log('[POPUP] Content script not responding, injecting...');
    
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        });
        
        // Wait a moment for script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify injection worked
        const verifyResponse = await sendTabMessage(tabId, { action: 'PING' }, 1000);
        
        if (verifyResponse && verifyResponse.status === 'alive') {
            console.log('[POPUP] Content script injected successfully');
            return true;
        } else {
            console.error('[POPUP] Content script injection failed');
            return false;
        }
    } catch (error) {
        console.error('[POPUP] Script injection error:', error);
        return false;
    }
}

/**
 * CSV Parser that handles quoted values with embedded commas
 * Used for parsing Input Sheet data that may contain commas in job titles
 */
function parseCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Don't forget the last field
    result.push(current.trim());
    return result;
}

/**
 * Parse CSV text into array of row arrays
 * Handles quoted values with embedded commas and newlines
 */
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => parseCSVRow(line));
}

function updateStatus(text, progress = null) {
    elements.statusText.textContent = text;
    if (progress !== null) {
        elements.progressFill.style.width = `${progress}%`;
    }
}

function setConnected(connected) {
    state.isAuthenticated = connected;
    elements.connectionStatus.classList.toggle('connected', connected);
    elements.connectionStatus.querySelector('.text').textContent = 
        connected ? 'Connected' : 'Disconnected';
}

function extractSheetId(input) {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input.trim();
}

// ============================================================
// PHASE 6: WORKBOOK MANAGER FUNCTIONS
// ============================================================

/**
 * Load saved workbooks from storage and populate dropdown
 */
async function loadSavedWorkbooks() {
    try {
        const response = await sendMessage('GET_SAVED_WORKBOOKS');
        state.savedWorkbooks = response.workbooks || [];
        renderWorkbooksDropdown();
        console.log('[POPUP] Loaded', state.savedWorkbooks.length, 'saved workbooks');
    } catch (e) {
        console.error('[POPUP] Failed to load workbooks:', e);
    }
}

/**
 * Render workbooks in the dropdown
 */
function renderWorkbooksDropdown() {
    if (!elements.savedWorkbooksSelect) return;
    
    const select = elements.savedWorkbooksSelect;
    
    // Clear existing options (keep the placeholder)
    select.innerHTML = '<option value="">-- Select a Saved Workbook --</option>';
    
    // Add saved workbooks
    state.savedWorkbooks.forEach(wb => {
        const option = document.createElement('option');
        option.value = wb.id;
        option.textContent = wb.name;
        
        // Color-code by recency
        if (wb.lastUsed) {
            const lastUsed = new Date(wb.lastUsed);
            const daysSince = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > 7) {
                option.className = 'stale';
                option.textContent += ` (${Math.floor(daysSince)}d ago)`;
            }
        }
        
        select.appendChild(option);
    });
}

/**
 * Handle workbook selection from dropdown
 */
async function handleWorkbookSelect() {
    if (!elements.savedWorkbooksSelect) return;
    
    const selectedId = elements.savedWorkbooksSelect.value;
    
    if (!selectedId) {
        // Nothing selected
        state.selectedWorkbook = null;
        if (elements.selectedWorkbookInfo) {
            elements.selectedWorkbookInfo.style.display = 'none';
        }
        if (elements.activeTabDisplay) {
            elements.activeTabDisplay.style.display = 'none';
        }
        if (elements.workbookActiveCheckbox) {
            elements.workbookActiveCheckbox.style.display = 'none';
        }
        if (elements.workbookActiveCheck) {
            elements.workbookActiveCheck.checked = false;
        }
        // Clear active sheet if it was workbook
        if (state.activeSheetType === 'workbook') {
            handleActiveSheetChange('output'); // Will uncheck if output not valid
            state.activeSheetType = null;
            state.activeSheetId = null;
            state.activeSheetTab = null;
        }
        return;
    }
    
    // Find the workbook
    const workbook = state.savedWorkbooks.find(w => w.id === selectedId);
    if (!workbook) return;
    
    state.selectedWorkbook = workbook;
    
    // Update UI
    if (elements.selectedWorkbookInfo) {
        elements.selectedWorkbookInfo.style.display = 'flex';
    }
    if (elements.selectedWorkbookName) {
        elements.selectedWorkbookName.textContent = workbook.name;
        elements.selectedWorkbookName.href = `https://docs.google.com/spreadsheets/d/${workbook.id}`;
    }
    if (elements.selectedWorkbookId) {
        elements.selectedWorkbookId.textContent = workbook.id.substring(0, 20) + '...';
    }
    
    // Show active sheet checkbox
    if (elements.workbookActiveCheckbox) {
        elements.workbookActiveCheckbox.style.display = 'block';
    }
    
    // Check if there's a last used tab
    if (workbook.lastTab && elements.activeTabDisplay) {
        elements.activeTabDisplay.style.display = 'flex';
        if (elements.activeTabName) {
            elements.activeTabName.textContent = workbook.lastTab;
        }
        if (elements.activeTabStatus) {
            elements.activeTabStatus.textContent = 'Last Used';
            elements.activeTabStatus.className = 'tab-status existing';
        }
    }
    
    // Phase 7: Load tabs for comparison
    if (elements.compareTab1) {
        await loadTabsForComparison();
    }
}

/**
 * Handle active sheet checkbox change (mutually exclusive)
 */
function handleActiveSheetChange(sheetType) {
    // Uncheck the other checkbox
    if (sheetType === 'workbook') {
        if (elements.outputActiveCheck) {
            elements.outputActiveCheck.checked = false;
        }
        if (state.selectedWorkbook) {
            state.activeSheetType = 'workbook';
            state.activeSheetId = state.selectedWorkbook.id;
            state.activeSheetTab = null; // Will be set when weekly tab is created
            // Phase 7: Load tabs for comparison
            if (elements.compareTab1) {
                loadTabsForComparison();
            }
        } else {
            // Can't activate without selection
            if (elements.workbookActiveCheck) {
                elements.workbookActiveCheck.checked = false;
            }
            state.activeSheetType = null;
            state.activeSheetId = null;
            state.activeSheetTab = null;
        }
    } else if (sheetType === 'output') {
        if (elements.workbookActiveCheck) {
            elements.workbookActiveCheck.checked = false;
        }
        if (state.outputSheetId) {
            state.activeSheetType = 'output';
            state.activeSheetId = state.outputSheetId;
            state.activeSheetTab = state.currentTabName || 'Sheet1';
            // Phase 7: Load tabs for comparison
            if (elements.compareTab1) {
                loadTabsForComparison();
            }
        } else {
            // Can't activate without output sheet
            if (elements.outputActiveCheck) {
                elements.outputActiveCheck.checked = false;
            }
            state.activeSheetType = null;
            state.activeSheetId = null;
            state.activeSheetTab = null;
        }
    }
    
    updateActionButtons();
}

/**
 * Get the currently active sheet info
 */
function getActiveSheet() {
    if (state.activeSheetType === 'workbook' && state.activeSheetId) {
        // For workbook, use activeSheetTab if set, otherwise use lastTab from selected workbook
        // If no tab name yet, that's okay - we'll create the weekly tab when starting scraping
        let tabName = state.activeSheetTab;
        if (!tabName && state.selectedWorkbook && state.selectedWorkbook.lastTab) {
            tabName = state.selectedWorkbook.lastTab;
        }
        // Return sheet object even if tabName is null - handleStartScraping will create the tab
        return {
            type: 'workbook',
            spreadsheetId: state.activeSheetId,
            tabName: tabName // Can be null, will be created when starting
        };
    } else if (state.activeSheetType === 'output' && state.activeSheetId) {
        return {
            type: 'output',
            spreadsheetId: state.activeSheetId,
            tabName: state.currentTabName || 'Sheet1'
        };
    }
    return null;
}

/**
 * Show the add workbook form
 */
function showAddWorkbookForm() {
    if (!elements.addWorkbookForm) return;
    elements.addWorkbookForm.style.display = 'block';
    if (elements.newWorkbookId) {
        elements.newWorkbookId.value = '';
        elements.newWorkbookId.focus();
    }
    if (elements.newWorkbookName) {
        elements.newWorkbookName.value = '';
    }
}

/**
 * Hide the add workbook form
 */
function hideAddWorkbookForm() {
    if (!elements.addWorkbookForm) return;
    elements.addWorkbookForm.style.display = 'none';
    if (elements.newWorkbookId) {
        elements.newWorkbookId.value = '';
    }
    if (elements.newWorkbookName) {
        elements.newWorkbookName.value = '';
    }
}

/**
 * Save a new workbook
 */
async function handleSaveWorkbook() {
    if (!elements.newWorkbookId) return;
    
    let sheetId = elements.newWorkbookId.value.trim();
    const name = elements.newWorkbookName ? elements.newWorkbookName.value.trim() : '';
    
    if (!sheetId) {
        updateStatus('❌ Please enter a Sheet ID or URL');
        return;
    }
    
    // Extract ID from URL if needed
    sheetId = extractSheetId(sheetId);
    
    updateStatus('🔍 Validating spreadsheet...');
    
    try {
        const response = await sendMessage('SAVE_WORKBOOK', { 
            id: sheetId, 
            name: name || null  // Let backend use sheet title if no name provided
        });
        
        if (response.success) {
            updateStatus(`✅ Saved: ${response.workbook.name}`);
            hideAddWorkbookForm();
            await loadSavedWorkbooks();
            await renderSourceMapping(); // Phase 8: Update mapping dropdowns
            
            // Auto-select the new workbook
            if (elements.savedWorkbooksSelect) {
                elements.savedWorkbooksSelect.value = sheetId;
                await handleWorkbookSelect();
            }
        } else {
            updateStatus(`❌ ${response.error}`);
        }
    } catch (e) {
        updateStatus(`❌ ${e.message}`);
    }
}

/**
 * Remove selected workbook from saved list
 */
async function handleRemoveWorkbook() {
    if (!state.selectedWorkbook) return;
    
    const confirmed = confirm(`Remove "${state.selectedWorkbook.name}" from saved workbooks?\n\nThis won't delete the Google Sheet, just removes it from this extension.`);
    
    if (!confirmed) return;
    
    try {
        await sendMessage('DELETE_WORKBOOK', { id: state.selectedWorkbook.id });
        updateStatus(`✅ Removed: ${state.selectedWorkbook.name}`);
        
        state.selectedWorkbook = null;
        if (elements.savedWorkbooksSelect) {
            elements.savedWorkbooksSelect.value = '';
        }
        handleWorkbookSelect();
        
        await loadSavedWorkbooks();
        await renderSourceMapping(); // Phase 8: Update mapping dropdowns
    } catch (e) {
        updateStatus(`❌ ${e.message}`);
    }
}


// --- QUEUE MANAGEMENT ---
async function updateQueueStatus() {
    try {
        const status = await sendMessage('GET_QUEUE_STATUS');
        
        elements.pendingRows.textContent = status.pendingRows || 0;
        elements.syncedRows.textContent = state.totalSynced;
        
        if (status.failedRows > 0) {
            elements.failedRows.textContent = status.failedRows;
            elements.failedStat.style.display = 'block';
            elements.queueActions.style.display = 'flex';
        } else {
            elements.failedStat.style.display = 'none';
            elements.queueActions.style.display = 'none';
        }
    } catch (e) {
        console.warn('[POPUP] Queue status error:', e);
    }
}

function startQueuePolling() {
    if (queuePollInterval) return;
    queuePollInterval = setInterval(updateQueueStatus, 5000);
    console.log('[POPUP] Started queue polling');
}

function stopQueuePolling() {
    if (queuePollInterval) {
        clearInterval(queuePollInterval);
        queuePollInterval = null;
        console.log('[POPUP] Stopped queue polling');
    }
}

/**
 * Start periodic status checking to detect if scraping stops
 */
function startStatusChecking() {
    if (statusCheckInterval) return;
    statusCheckInterval = setInterval(async () => {
        if (state.isScrapingActive) {
            const isStillActive = await checkScrapingStatus();
            if (!isStillActive && state.isScrapingActive) {
                // Scraping stopped but we didn't get notified
                console.log('[POPUP] Detected scraping stopped');
                state.isScrapingActive = false;
                await chrome.storage.local.set({ isScrapingActive: false });
                updateActionButtons();
                stopQueuePolling();
                stopStatusChecking();
                updateStatus('Scraping stopped');
            }
        }
    }, 3000); // Check every 3 seconds
}

function stopStatusChecking() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

async function handleRetryFailed() {
    try {
        updateStatus('Retrying failed rows...');
        const result = await sendMessage('RETRY_FAILED');
        updateStatus(`Moved ${result.retriedCount} items back to queue`);
        await updateQueueStatus();
    } catch (e) {
        updateStatus(`Retry error: ${e.message}`);
    }
}

async function handleDownloadFailed() {
    try {
        const result = await sendMessage('GET_FAILED_ROWS');
        const rows = result.rows || [];
        
        if (rows.length === 0) {
            updateStatus('No failed rows to export');
            return;
        }
        
        // Convert to CSV
        const headers = ['Date', 'Name', 'Title', 'Location', 'Connection Source', 'LinkedIn URL', 'Accreditation 1', 'Accreditation 2', 'Accreditation 3', 'Accreditation 4', 'Accreditation 5', 'Accreditation 6'];
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `failed_rows_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        // Clear failed rows
        await sendMessage('CLEAR_FAILED_ROWS');
        await updateQueueStatus();
        updateStatus(`Exported ${rows.length} rows`);
    } catch (e) {
        updateStatus(`Export error: ${e.message}`);
    }
}

// --- SEARCH LIST RENDERING ---
/**
 * Render search list with selection checkboxes
 * MODIFIED for Phase 8: Added checkbox selection for auto-run
 */
function renderSearchList() {
    if (state.searches.length === 0) {
        elements.searchList.innerHTML = '<p class="placeholder">No searches loaded</p>';
        elements.searchProgressText.textContent = 'Search 0 of 0';
        elements.searchProgressFill.style.width = '0%';
        elements.refreshProgressBtn.style.display = 'none';
        return;
    }

    // Update progress
    const completed = state.searchIndex;
    const total = state.searches.length;
    elements.searchProgressText.textContent = `Search ${completed + 1} of ${total}`;
    elements.searchProgressFill.style.width = `${(completed / total) * 100}%`;
    
    // Show refresh button if searches are loaded
    elements.refreshProgressBtn.style.display = 'inline-block';

    elements.searchList.innerHTML = state.searches.map((search, index) => {
        let itemClass = 'search-item';
        if (index < state.searchIndex) itemClass += ' completed';
        if (index === state.searchIndex) itemClass += ' current';
        if (state.selectedSearches.has(index)) itemClass += ' selected';
        
        const isSelected = state.selectedSearches.has(index);
        
        return `
        <div class="${itemClass}" data-index="${index}">
            <div class="search-checkbox-container">
                <input type="checkbox" 
                       class="search-checkbox" 
                       data-index="${index}"
                       ${isSelected ? 'checked' : ''}>
            </div>
            <div class="search-content">
                <div class="name">${escapeHtml(search.source || 'Unknown')}</div>
                <div class="title">${escapeHtml(search.title || '')}</div>
            </div>
            <button class="open-btn" data-index="${index}">Open</button>
        </div>
    `}).join('');

    // Add click handlers for items
    elements.searchList.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking checkbox or button
            if (e.target.classList.contains('search-checkbox') || 
                e.target.classList.contains('open-btn')) {
                return;
            }
            selectSearch(parseInt(item.dataset.index));
        });
    });

    // Add click handlers for open buttons
    elements.searchList.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSearch(parseInt(btn.dataset.index));
        });
    });
    
    // Add change handlers for checkboxes (Phase 8)
    elements.searchList.querySelectorAll('.search-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            handleSearchCheckboxChange(e);
        });
    });
    
    // Update selection summary
    updateSelectionSummary();
}

/**
 * Handle search checkbox change
 */
function handleSearchCheckboxChange(event) {
    const checkbox = event.target;
    const index = parseInt(checkbox.dataset.index);
    const item = checkbox.closest('.search-item');
    
    if (checkbox.checked) {
        state.selectedSearches.add(index);
        if (item) {
            item.classList.add('selected');
        }
    } else {
        state.selectedSearches.delete(index);
        if (item) {
            item.classList.remove('selected');
        }
    }
    
    updateSelectionSummary();
    updateAutoRunButtonState();
}

/**
 * Select all searches for auto-run
 */
function selectAllSearches() {
    state.searches.forEach((_, index) => {
        state.selectedSearches.add(index);
    });
    
    // Update checkboxes
    if (elements.searchList) {
        elements.searchList.querySelectorAll('.search-checkbox').forEach(cb => {
            cb.checked = true;
            const item = cb.closest('.search-item');
            if (item) {
                item.classList.add('selected');
            }
        });
    }
    
    updateSelectionSummary();
    updateAutoRunButtonState();
    addLogEntry(`Selected all ${state.searches.length} searches`, 'info');
}

/**
 * Deselect all searches
 */
function deselectAllSearches() {
    state.selectedSearches.clear();
    
    // Update checkboxes
    if (elements.searchList) {
        elements.searchList.querySelectorAll('.search-checkbox').forEach(cb => {
            cb.checked = false;
            const item = cb.closest('.search-item');
            if (item) {
                item.classList.remove('selected');
            }
        });
    }
    
    updateSelectionSummary();
    updateAutoRunButtonState();
    addLogEntry('Deselected all searches', 'info');
}

/**
 * Update the selection summary display
 */
function updateSelectionSummary() {
    const selectedCount = state.selectedSearches.size;
    
    // Count unique sources in selection
    const selectedSources = new Set();
    state.selectedSearches.forEach(index => {
        const search = state.searches[index];
        if (search) {
            selectedSources.add(search.source || 'Unknown');
        }
    });
    
    if (elements.selectedSearchCount) {
        elements.selectedSearchCount.textContent = selectedCount;
    }
    if (elements.selectedSourceCount) {
        elements.selectedSourceCount.textContent = selectedSources.size;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function selectSearch(index) {
    state.searchIndex = index;
    sendMessage('SAVE_SETTINGS', { settings: { searchIndex: index } });
    renderSearchList();
    updateActionButtons();
}

async function openSearch(index) {
    const search = state.searches[index];
    if (!search || !search.url) {
        updateStatus('❌ Invalid search URL');
        return;
    }

    selectSearch(index);
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: search.url });
    
    updateStatus(`Opening: ${search.source}`);
    
    // Hide next search panel if visible
    elements.nextSearchPanel.style.display = 'none';
}

// --- SMART NAVIGATION ---
function showNextSearchPanel(completionData) {
    const { totalProfiles, totalPages, nextSearch } = completionData;
    
    elements.completedProfiles.textContent = totalProfiles || 0;
    elements.completedPages.textContent = totalPages || 0;
    
    state.totalSynced += totalProfiles || 0;
    elements.syncedRows.textContent = state.totalSynced;
    
    if (nextSearch && !nextSearch.complete) {
        // There's a next search
        elements.nextSearchSource.textContent = nextSearch.search?.source || '-';
        elements.nextSearchTitle.textContent = nextSearch.search?.title || '-';
        elements.nextSearchInfo.style.display = 'block';
        elements.allCompleteMessage.style.display = 'none';
        elements.proceedNextBtn.style.display = 'block';
        
        state.nextSearchInfo = nextSearch;
    } else {
        // All searches complete
        elements.nextSearchInfo.style.display = 'none';
        elements.allCompleteMessage.style.display = 'block';
        elements.proceedNextBtn.style.display = 'none';
        
        state.nextSearchInfo = null;
    }
    
    elements.nextSearchPanel.style.display = 'block';
    state.searchIndex = nextSearch?.index || state.searchIndex;
    renderSearchList();
}

async function handleProceedNext() {
    if (!state.nextSearchInfo || !state.nextSearchInfo.search) return;
    
    const nextSearch = state.nextSearchInfo.search;
    elements.nextSearchPanel.style.display = 'none';
    
    // Open the next search URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: nextSearch.url });
    
    updateStatus(`Opening: ${nextSearch.source}`);
    state.nextSearchInfo = null;
}

function handleDismissNext() {
    elements.nextSearchPanel.style.display = 'none';
    state.nextSearchInfo = null;
}

// --- ACTION BUTTON STATE ---
function updateActionButtons() {
    const hasActiveSheet = !!getActiveSheet(); // Check if any sheet is marked active
    const hasSearches = state.searches.length > 0;
    const canStart = hasActiveSheet && hasSearches && !state.isScrapingActive;

    elements.startScrapingBtn.disabled = !canStart;
    elements.stopScrapingBtn.disabled = !state.isScrapingActive;

    if (state.outputSheetId) {
        const sheetUrl = state.outputSheetUrl || 
            `https://docs.google.com/spreadsheets/d/${state.outputSheetId}`;
        
        // Show as clickable link with name
        if (state.outputSheetName) {
            elements.outputSheetDisplay.textContent = state.outputSheetName;
            elements.outputSheetDisplay.href = sheetUrl;
            elements.outputSheetDisplay.style.display = 'inline';
            elements.outputSheetDisplayText.style.display = 'none';
        } else {
            // Fallback to ID if name not loaded yet
            elements.outputSheetDisplay.textContent = state.outputSheetId.substring(0, 20) + '...';
            elements.outputSheetDisplay.href = sheetUrl;
            elements.outputSheetDisplay.style.display = 'inline';
            elements.outputSheetDisplayText.style.display = 'none';
        }
        
        elements.openOutputSheet.style.display = 'inline';
        elements.openOutputSheet.href = sheetUrl;
    } else {
        elements.outputSheetDisplay.style.display = 'none';
        elements.outputSheetDisplayText.textContent = 'None';
        elements.outputSheetDisplayText.style.display = 'inline';
        elements.openOutputSheet.style.display = 'none';
    }
    
    // Update current tab display
    if (state.currentTabName) {
        elements.currentTabDisplay.textContent = state.currentTabName;
    } else {
        elements.currentTabDisplay.textContent = 'Sheet1';
    }
}

// --- TAB MANAGEMENT ---
function populateTabSelector(tabs) {
    console.log('[POPUP] populateTabSelector called with tabs:', tabs);
    
    if (!elements.tabSelector) {
        console.error('[POPUP] tabSelector element not found');
        return;
    }

    if (!tabs || tabs.length === 0) {
        console.log('[POPUP] No tabs to populate, hiding dropdown');
        elements.tabSelector.style.display = 'none';
        if (elements.currentTabDisplay) {
            elements.currentTabDisplay.style.display = 'inline';
        }
        return;
    }

    // Populate dropdown - show dropdown even if only one tab (user might add more)
    elements.tabSelector.innerHTML = '';
    tabs.forEach(tab => {
        const option = document.createElement('option');
        option.value = tab.title;
        option.textContent = tab.title;
        if (tab.title === state.currentTabName) {
            option.selected = true;
        }
        elements.tabSelector.appendChild(option);
    });

    // Show dropdown, hide text display
    elements.tabSelector.style.display = 'inline-block';
    elements.tabSelector.style.visibility = 'visible';
    if (elements.currentTabDisplay) {
        elements.currentTabDisplay.style.display = 'none';
    }
    console.log('[POPUP] Tab dropdown populated and shown with', tabs.length, 'tabs. Current tab:', state.currentTabName);
}

async function loadTabsForSheet(spreadsheetId) {
    if (!spreadsheetId) {
        if (elements.tabSelector) {
            elements.tabSelector.style.display = 'none';
        }
        if (elements.currentTabDisplay) {
            elements.currentTabDisplay.style.display = 'inline';
        }
        return;
    }

    if (!elements.tabSelector) {
        console.error('[POPUP] tabSelector element not found');
        return;
    }

    try {
        const response = await sendMessage('GET_SHEET_TABS', { spreadsheetId });
        console.log('[POPUP] Tabs response:', response);
        
        if (response.success && response.tabs && response.tabs.length > 0) {
            populateTabSelector(response.tabs);
        } else {
            // No tabs or error, show text display
            elements.tabSelector.style.display = 'none';
            if (elements.currentTabDisplay) {
                elements.currentTabDisplay.style.display = 'inline';
            }
            console.log('[POPUP] No tabs found or error, showing text display');
        }
    } catch (error) {
        console.error('[POPUP] Error loading tabs:', error);
        elements.tabSelector.style.display = 'none';
        if (elements.currentTabDisplay) {
            elements.currentTabDisplay.style.display = 'inline';
        }
    }
}

async function handleTabChange() {
    const selectedTab = elements.tabSelector.value;
    if (!selectedTab || selectedTab === state.currentTabName) {
        return;
    }

    try {
        const response = await sendMessage('SET_CURRENT_TAB', { tabName: selectedTab });
        if (response.success) {
            state.currentTabName = selectedTab;
            
            // Update active sheet tab if output sheet is active
            if (state.activeSheetType === 'output') {
                state.activeSheetTab = selectedTab;
            }
            
            updateActionButtons();
            updateStatus(`✅ Switched to tab: ${selectedTab}`);
        }
    } catch (error) {
        console.error('[POPUP] Error switching tab:', error);
        updateStatus(`❌ Error switching tab: ${error.message}`);
    }
}

/**
 * Check if scraping is actually active by querying content scripts
 * This persists across popup closes/reopens
 */
async function checkScrapingStatus() {
    try {
        // Get all LinkedIn tabs
        const tabs = await chrome.tabs.query({ url: 'https://*.linkedin.com/*' });
        
        for (const tab of tabs) {
            try {
                const response = await sendTabMessage(tab.id, { action: 'GET_STATUS' }, 500);
                if (response && response.isActive) {
                    console.log('[POPUP] Found active scraping on tab:', tab.id);
                    state.isScrapingActive = true;
                    return true;
                }
            } catch (e) {
                // Tab might not have content script, continue checking
                continue;
            }
        }
        
        // No active scraping found
        state.isScrapingActive = false;
        return false;
    } catch (error) {
        console.warn('[POPUP] Error checking scraping status:', error);
        return false;
    }
}

// --- EVENT HANDLERS ---
async function handleLoadSearches() {
    const sheetId = extractSheetId(elements.inputSheetId.value);
    if (!sheetId) {
        updateStatus('❌ Please enter a Sheet ID');
        return;
    }

    elements.loadSearchesBtn.disabled = true;
    updateStatus('Loading searches...', 30);

    try {
        const response = await sendMessage('READ_SHEET', {
            spreadsheetId: sheetId,
            range: 'Sheet1!A:C'
        });

        const rows = response.data || [];
        
        // Parse rows: Col A = Source, Col B = Title Filter, Col C = URL
        // Skip header if present
        const startRow = rows[0]?.[0]?.toLowerCase().includes('source') ? 1 : 0;
        
        state.searches = rows.slice(startRow).map(row => ({
            source: row[0] || '',
            title: row[1] || '',
            url: row[2] || ''
        })).filter(s => s.url);

        // Get current search index
        const settings = await sendMessage('GET_SETTINGS');
        state.searchIndex = settings.settings?.searchIndex || 0;

        // Save to storage
        await sendMessage('SAVE_SETTINGS', {
            settings: { inputSheetId: sheetId, searches: state.searches }
        });

        renderSearchList();
        updateStatus(`✅ Loaded ${state.searches.length} searches`, 100);
        setConnected(true);
        
        // PHASE 8: Initialize selection and mapping
        selectAllSearches();
        
        // Load saved mapping first, then render
        await loadSourceMapping();
        await renderSourceMapping(); // Phase 8: Show mapping interface

    } catch (error) {
        console.error('[POPUP] Load error:', error);
        updateStatus(`❌ ${error.message}`);
    } finally {
        elements.loadSearchesBtn.disabled = false;
    }
}

async function handleRefreshProgress() {
    // Reset search index to 0 (removes all checkmarks)
    state.searchIndex = 0;
    
    // Save to storage
    await sendMessage('SAVE_SETTINGS', {
        settings: { searchIndex: 0 }
    });
    
    // Re-render to update checkmarks
    renderSearchList();
    updateActionButtons();
    
    updateStatus('✅ Search progress reset');
}

async function handleCreateSheet() {
    const name = elements.newSheetName.value.trim();
    if (!name) {
        updateStatus('❌ Please enter a sheet name');
        return;
    }

    elements.createSheetBtn.disabled = true;
    updateStatus('Creating sheet...', 50);

    try {
        const response = await sendMessage('CREATE_SHEET', { title: name });
        
        state.outputSheetId = response.spreadsheetId;
        state.outputSheetUrl = response.spreadsheetUrl;
        state.outputSheetName = response.sheetName || name;
        state.totalSynced = 0; // Reset synced count for new sheet

        // Save sheet name to settings
        await sendMessage('SAVE_SETTINGS', {
            settings: { 
                outputSheetId: state.outputSheetId,
                outputSheetName: state.outputSheetName
            }
        });

        updateActionButtons();
        
        // Show active sheet checkbox for output section
        if (elements.outputActiveCheckbox) {
            elements.outputActiveCheckbox.style.display = 'block';
        }
        
        updateStatus(`✅ Created: ${name}`, 100);
        elements.newSheetName.value = '';

    } catch (error) {
        console.error('[POPUP] Create error:', error);
        updateStatus(`❌ ${error.message}`);
    } finally {
        elements.createSheetBtn.disabled = false;
    }
}

async function handleLoadSheet() {
    const input = elements.loadSheetId.value.trim();
    if (!input) {
        updateStatus('❌ Please enter a sheet ID or URL');
        return;
    }

    // Extract spreadsheet ID from URL or use as-is if it's already an ID
    const sheetId = extractSheetId(input);
    if (!sheetId) {
        updateStatus('❌ Could not extract sheet ID from URL');
        return;
    }

    elements.loadSheetBtn.disabled = true;
    updateStatus('Loading sheet...', 50);

    try {
        const response = await sendMessage('LOAD_SHEET', { 
            spreadsheetId: sheetId,
            tabName: 'Sheet1' // Default to first tab, user can add new tabs
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load sheet');
        }
        
        state.outputSheetId = response.spreadsheetId;
        state.outputSheetUrl = response.spreadsheetUrl;
        state.outputSheetName = response.sheetName;
        state.currentTabName = response.currentTabName || (response.tabs && response.tabs.length > 0 ? response.tabs[0].title : 'Sheet1');
        state.totalSynced = 0; // Reset synced count

        // Save settings
        await sendMessage('SAVE_SETTINGS', {
            settings: { 
                outputSheetId: state.outputSheetId,
                outputSheetName: state.outputSheetName,
                currentTabName: state.currentTabName
            }
        });

        // Populate tabs from response if available, otherwise fetch them
        if (response.tabs && response.tabs.length > 0) {
            // Use tabs from response directly
            populateTabSelector(response.tabs);
        } else {
            // Fallback: fetch tabs separately
            await loadTabsForSheet(state.outputSheetId);
        }

        updateActionButtons();
        
        // Show active sheet checkbox for output section
        if (elements.outputActiveCheckbox) {
            elements.outputActiveCheckbox.style.display = 'block';
        }
        
        // Phase 7: Load tabs for comparison
        if (elements.compareTab1) {
            await loadTabsForComparison();
        }
        
        updateStatus(`✅ Loaded: ${response.sheetName}`, 100);
        elements.loadSheetId.value = '';

    } catch (error) {
        console.error('[POPUP] Load error:', error);
        updateStatus(`❌ ${error.message}`);
    } finally {
        elements.loadSheetBtn.disabled = false;
    }
}

async function handleAddTab() {
    const tabName = elements.newTabName.value.trim();
    if (!tabName) {
        updateStatus('❌ Please enter a tab name');
        return;
    }

    if (!state.outputSheetId) {
        updateStatus('❌ No output sheet loaded');
        return;
    }

    elements.addTabBtn.disabled = true;
    updateStatus(`Adding tab "${tabName}"...`, 50);

    try {
        const response = await sendMessage('ADD_TAB', { tabName });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to add tab');
        }
        
        state.currentTabName = tabName;

        // Save tab name to settings
        await sendMessage('SAVE_SETTINGS', {
            settings: { 
                currentTabName: state.currentTabName
            }
        });

        updateActionButtons();
        updateStatus(`✅ Added tab: ${tabName}`, 100);
        elements.newTabName.value = '';

    } catch (error) {
        console.error('[POPUP] Add tab error:', error);
        updateStatus(`❌ ${error.message}`);
    } finally {
        elements.addTabBtn.disabled = false;
    }
}

async function handleStartScraping() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url?.includes('linkedin.com')) {
        updateStatus('❌ Navigate to LinkedIn first');
        return;
    }

    // Check which sheet is active
    const activeSheet = getActiveSheet();
    if (!activeSheet) {
        updateStatus('❌ Please check an active sheet in Workbook Manager or Output Sheet');
        return;
    }

    state.isScrapingActive = true;
    updateActionButtons();
    
    // Save scraping state to storage
    await chrome.storage.local.set({ isScrapingActive: true, scrapingTabId: tab.id });
    
    updateStatus('⚓ Checking content script...', 5);

    try {
        let targetSheetId = activeSheet.spreadsheetId;
        let targetTabName = activeSheet.tabName;
        
        // If workbook is active, ensure weekly tab exists
        if (activeSheet.type === 'workbook') {
            updateStatus('📅 Setting up weekly tab...', 10);
            
            const tabResult = await sendMessage('ENSURE_WEEKLY_TAB', {
                spreadsheetId: activeSheet.spreadsheetId
            });
            
            targetTabName = tabResult.tabName;
            state.activeSheetTab = tabResult.tabName;
            
            // Update UI to show active tab
            if (elements.activeTabDisplay) {
                elements.activeTabDisplay.style.display = 'flex';
            }
            if (elements.activeTabName) {
                elements.activeTabName.textContent = tabResult.tabName;
            }
            if (elements.activeTabStatus) {
                if (tabResult.isNew) {
                    elements.activeTabStatus.textContent = 'NEW';
                    elements.activeTabStatus.className = 'tab-status new';
                } else {
                    elements.activeTabStatus.textContent = 'Existing';
                    elements.activeTabStatus.className = 'tab-status existing';
                }
            }
            
            // Set as current output in service worker
            await sendMessage('SET_ACTIVE_TAB', {
                spreadsheetId: activeSheet.spreadsheetId,
                tabName: tabResult.tabName
            });
        } else {
            // Output sheet is active - set as current output
            await sendMessage('SET_OUTPUT_SHEET', {
                spreadsheetId: activeSheet.spreadsheetId,
                tabName: activeSheet.tabName
            });
        }
        
        // CRITICAL: Ensure content script is injected before sending commands
        const isInjected = await ensureContentScriptInjected(tab.id);
        
        if (!isInjected) {
            throw new Error('Content script could not be loaded. Please refresh the LinkedIn page.');
        }
        
        updateStatus(`🚀 Starting scraper to ${targetTabName}...`, 10);
        startQueuePolling();
        startStatusChecking();
        
        // Get the current search's source from the input sheet (Column A)
        const currentSearch = state.searches[state.searchIndex];
        const sourceName = currentSearch?.source || null;
        
        await chrome.tabs.sendMessage(tab.id, { 
            action: 'START_SCRAPING',
            sourceName: sourceName
        });
    } catch (error) {
        console.error('[POPUP] Start error:', error);
        updateStatus(`❌ ${error.message}`);
        state.isScrapingActive = false;
        await chrome.storage.local.set({ isScrapingActive: false });
        updateActionButtons();
        stopQueuePolling();
        stopStatusChecking();
    }
}

async function handleStopScraping() {
    // Try to stop on current tab first
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Also try all LinkedIn tabs in case user navigated away
    const linkedinTabs = await chrome.tabs.query({ url: 'https://*.linkedin.com/*' });
    
    let stopped = false;
    
    // Try current tab first
    if (currentTab?.url?.includes('linkedin.com')) {
        try {
            await chrome.tabs.sendMessage(currentTab.id, { action: 'STOP_SCRAPING' });
            stopped = true;
            updateStatus('⏳ Stopping...');
        } catch (error) {
            console.log('[POPUP] Could not stop on current tab, trying others...');
        }
    }
    
    // If that didn't work, try all LinkedIn tabs
    if (!stopped) {
        for (const tab of linkedinTabs) {
            try {
                const response = await sendTabMessage(tab.id, { action: 'STOP_SCRAPING' }, 500);
                if (response) {
                    stopped = true;
                    updateStatus('⏳ Stopping...');
                    break;
                }
            } catch (error) {
                continue;
            }
        }
    }
    
    if (stopped) {
        state.isScrapingActive = false;
        await chrome.storage.local.set({ isScrapingActive: false });
        updateActionButtons();
        stopQueuePolling();
        stopStatusChecking();
    } else {
        updateStatus('⚠️ Could not find active scraping');
    }
}

async function handleForceSync() {
    updateStatus('🔄 Syncing...');
    try {
        const result = await sendMessage('PROCESS_QUEUE');
        updateStatus(`✅ Synced ${result.synced} rows`);
        await updateQueueStatus();
    } catch (e) {
        updateStatus(`❌ Sync error: ${e.message}`);
    }
}

async function handleDeduplicate() {
    // Get the currently active sheet
    const activeSheet = getActiveSheet();
    if (!activeSheet) {
        updateStatus('❌ Please check an active sheet in Workbook Manager or Output Sheet');
        return;
    }
    
    // For workbook type, if no tab name, we need to get the last used tab or ensure weekly tab
    let tabName = activeSheet.tabName;
    if (activeSheet.type === 'workbook' && !tabName) {
        if (state.selectedWorkbook && state.selectedWorkbook.lastTab) {
            tabName = state.selectedWorkbook.lastTab;
        } else {
            // Need to ensure weekly tab exists first
            updateStatus('📅 Creating weekly tab for deduplication...');
            try {
                const tabResult = await sendMessage('ENSURE_WEEKLY_TAB', {
                    spreadsheetId: activeSheet.spreadsheetId
                });
                tabName = tabResult.tabName;
            } catch (e) {
                updateStatus(`❌ Could not create weekly tab: ${e.message}`);
                return;
            }
        }
    }
    
    if (!tabName) {
        updateStatus('❌ Could not determine tab name for deduplication');
        return;
    }
    
    updateStatus('🧹 Deduplicating sheet...');
    try {
        const result = await sendMessage('DEDUPLICATE_SHEET', {
            spreadsheetId: activeSheet.spreadsheetId,
            tabName: tabName
        });
        if (result.success) {
            updateStatus(`✅ Removed ${result.removed} duplicate(s), kept ${result.unique} unique rows`);
        } else {
            updateStatus(`❌ ${result.error || 'Deduplication failed'}`);
        }
    } catch (e) {
        updateStatus(`❌ Deduplication error: ${e.message}`);
    }
}

// ============================================================
// PHASE 7: COMPARE TABS
// ============================================================

/**
 * Load available tabs for comparison dropdowns
 * Uses the currently active workbook
 */
async function loadTabsForComparison() {
    console.log('[POPUP] Loading tabs for comparison...');
    
    // Get active workbook ID from state (check both activeSheetId and outputSheetId)
    // Phase 6 uses activeSheetId for workbook manager, outputSheetId for legacy output sheet
    const spreadsheetId = state.activeSheetId || state.outputSheetId;
    
    if (!spreadsheetId) {
        console.log('[POPUP] No active workbook, cannot load tabs');
        showCompareError('Please select an active workbook first');
        // Clear dropdowns
        if (elements.compareTab1) {
            elements.compareTab1.innerHTML = '<option value="">-- Select Tab --</option>';
        }
        if (elements.compareTab2) {
            elements.compareTab2.innerHTML = '<option value="">-- Select Tab --</option>';
        }
        updateCompareButtonState();
        return;
    }
    
    try {
        const response = await sendMessage('GET_SHEET_TABS', { spreadsheetId });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to get tabs');
        }
        
        const tabs = response.tabs || [];
        state.compareTabs = tabs;
        
        console.log(`[POPUP] Found ${tabs.length} tabs for comparison`);
        
        // Clear and populate both dropdowns
        populateTabDropdown(elements.compareTab1, tabs);
        populateTabDropdown(elements.compareTab2, tabs);
        
        // Clear previous results and errors
        hideCompareResults();
        hideCompareError();
        
        // Update button state
        updateCompareButtonState();
        
    } catch (error) {
        console.error('[POPUP] Error loading tabs:', error);
        showCompareError(`Failed to load tabs: ${error.message}`);
    }
}

/**
 * Populate a dropdown with tab options
 */
function populateTabDropdown(selectElement, tabs) {
    if (!selectElement) return;
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Tab --';
    selectElement.appendChild(defaultOption);
    
    // Add tab options
    for (const tab of tabs) {
        const option = document.createElement('option');
        option.value = tab.title;
        option.textContent = tab.title;
        selectElement.appendChild(option);
    }
}

/**
 * Update compare button enabled/disabled state
 */
function updateCompareButtonState() {
    const tab1Selected = elements.compareTab1?.value;
    const tab2Selected = elements.compareTab2?.value;
    const outputName = elements.compareOutputName?.value?.trim();
    // Check both activeSheetId (Phase 6) and outputSheetId (legacy)
    const hasWorkbook = !!(state.activeSheetId || state.outputSheetId);
    
    const canCompare = hasWorkbook && tab1Selected && tab2Selected && outputName && !state.isComparing;
    
    if (elements.compareBtn) {
        elements.compareBtn.disabled = !canCompare;
    }
}

/**
 * Handle Compare button click
 */
async function handleCompare() {
    console.log('[POPUP] Starting comparison...');
    
    const tab1Name = elements.compareTab1.value;
    const tab2Name = elements.compareTab2.value;
    const outputName = elements.compareOutputName.value.trim();
    const keyColumn = parseInt(elements.compareKeyColumn.value, 10) || 1;
    // Check both activeSheetId (Phase 6) and outputSheetId (legacy)
    const spreadsheetId = state.activeSheetId || state.outputSheetId;
    
    // Validation
    if (!tab1Name || !tab2Name) {
        showCompareError('Please select two tabs to compare');
        return;
    }
    if (tab1Name === tab2Name) {
        showCompareError('Please select two different tabs');
        return;
    }
    if (!outputName) {
        showCompareError('Please enter a name for the output tab');
        return;
    }
    if (!spreadsheetId) {
        showCompareError('No active workbook selected');
        return;
    }
    
    // Set loading state
    state.isComparing = true;
    elements.compareBtn.disabled = true;
    elements.compareBtn.classList.add('loading');
    hideCompareError();
    hideCompareResults();
    
    try {
        const response = await sendMessage('COMPARE_TABS', {
            spreadsheetId,
            tab1Name,
            tab2Name,
            outputTabName: outputName,
            keyColumn
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Comparison failed');
        }
        
        console.log('[POPUP] Comparison complete:', response);
        
        // Display results
        showCompareResults(response);
        
        // Clear output name input for next comparison
        elements.compareOutputName.value = '';
        
        // Refresh tabs list to include new tab
        await loadTabsForComparison();
        
    } catch (error) {
        console.error('[POPUP] Compare error:', error);
        showCompareError(error.message);
    } finally {
        // Reset loading state
        state.isComparing = false;
        elements.compareBtn.classList.remove('loading');
        updateCompareButtonState();
    }
}

/**
 * Show comparison results
 */
function showCompareResults(result) {
    if (elements.compareTab1Count) {
        elements.compareTab1Count.textContent = result.tab1Count || 0;
    }
    if (elements.compareTab2Count) {
        elements.compareTab2Count.textContent = result.tab2Count || 0;
    }
    if (elements.compareNewCount) {
        elements.compareNewCount.textContent = result.newEntries || 0;
    }
    if (elements.compareOutputTab) {
        elements.compareOutputTab.textContent = result.outputTabName || '-';
    }
    if (elements.compareResults) {
        elements.compareResults.style.display = 'block';
    }
}

/**
 * Hide comparison results
 */
function hideCompareResults() {
    if (elements.compareResults) {
        elements.compareResults.style.display = 'none';
    }
}

/**
 * Show comparison error
 */
function showCompareError(message) {
    if (elements.compareError) {
        elements.compareError.textContent = message;
        elements.compareError.style.display = 'block';
    }
}

/**
 * Hide comparison error
 */
function hideCompareError() {
    if (elements.compareError) {
        elements.compareError.style.display = 'none';
    }
}

// ============================================================
// PHASE 8: SOURCE MAPPING FUNCTIONS
// ============================================================

/**
 * Extract unique sources from searches array
 * @param {Array} searches - Array of search objects with 'source' property
 * @returns {Array} Array of { name, count, searches, indices } objects
 */
function getUniqueSources(searches) {
    const sourceMap = new Map();
    
    searches.forEach((search, index) => {
        const sourceName = search.source || 'Unknown';
        
        if (!sourceMap.has(sourceName)) {
            sourceMap.set(sourceName, {
                name: sourceName,
                count: 0,
                searches: [],
                indices: []
            });
        }
        
        const sourceData = sourceMap.get(sourceName);
        sourceData.count++;
        sourceData.searches.push(search);
        sourceData.indices.push(index);
    });
    
    // Convert to array and sort by count (descending)
    return Array.from(sourceMap.values())
        .sort((a, b) => b.count - a.count);
}

/**
 * Load source-to-workbook mapping from storage
 * @returns {Promise<Object>} The mapping object
 */
async function loadSourceMapping() {
    try {
        const response = await sendMessage('GET_SOURCE_MAPPING');
        
        if (response.success) {
            state.sourceMapping = response.mapping || {};
            console.log(`[POPUP] Loaded source mapping: ${Object.keys(state.sourceMapping).length} entries`);
        } else {
            console.warn('[POPUP] Failed to load source mapping:', response.error);
            state.sourceMapping = {};
        }
        
        return state.sourceMapping;
    } catch (error) {
        console.error('[POPUP] Error loading source mapping:', error);
        state.sourceMapping = {};
        return {};
    }
}

/**
 * Save source-to-workbook mapping to storage
 * @returns {Promise<boolean>} Success status
 */
async function saveSourceMapping() {
    try {
        const mapping = {};
        
        // Collect all mappings from dropdowns
        const selects = elements.mappingList.querySelectorAll('.mapping-workbook-select');
        selects.forEach(select => {
            const sourceName = select.dataset.source;
            const workbookId = select.value;
            
            if (sourceName && workbookId) {
                mapping[sourceName] = workbookId;
            }
        });
        
        // Save to service worker
        const response = await sendMessage('SAVE_SOURCE_MAPPING', { mapping });
        
        if (response.success) {
            state.sourceMapping = response.mapping;
            updateStatus('✅ Mapping saved!');
            updateMappingStatusDisplay();
            updateAutoRunButtonState();
            addLogEntry('Mapping saved successfully', 'success');
            return true;
        } else {
            throw new Error(response.error || 'Failed to save mapping');
        }
    } catch (error) {
        console.error('[POPUP] Error saving mapping:', error);
        updateStatus(`❌ Save failed: ${error.message}`);
        addLogEntry(`Save failed: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Render the source mapping interface
 */
async function renderSourceMapping() {
    // Check if we have searches loaded
    if (!state.searches || state.searches.length === 0) {
        if (elements.mappingSection) {
            elements.mappingSection.style.display = 'none';
        }
        if (elements.autoRunSection) {
            elements.autoRunSection.style.display = 'none';
        }
        return;
    }
    
    // Show sections
    if (elements.mappingSection) {
        elements.mappingSection.style.display = 'block';
    }
    if (elements.autoRunSection) {
        elements.autoRunSection.style.display = 'block';
    }
    
    // Get unique sources
    const uniqueSources = getUniqueSources(state.searches);
    
    // Load saved mapping and workbooks
    await loadSourceMapping();
    await loadSavedWorkbooks();
    
    // Check if we have any workbooks
    if (!state.savedWorkbooks || state.savedWorkbooks.length === 0) {
        if (elements.mappingList) {
            elements.mappingList.innerHTML = `
                <div class="mapping-empty-state">
                    <p>⚠️ No saved workbooks found.</p>
                    <p>Add workbooks in the Workbook Manager section first.</p>
                </div>
            `;
        }
        return;
    }
    
    // Render mapping items
    if (elements.mappingList) {
        elements.mappingList.innerHTML = uniqueSources.map(source => {
            const mappedWorkbookId = state.sourceMapping[source.name] || '';
            const isMapped = !!mappedWorkbookId;
            
            return `
                <div class="mapping-item" data-source="${escapeHtml(source.name)}">
                    <div class="mapping-source-info">
                        <div class="mapping-source-name" title="${escapeHtml(source.name)}">
                            ${escapeHtml(source.name)}
                        </div>
                        <div class="mapping-search-count">${source.count} search${source.count !== 1 ? 'es' : ''}</div>
                    </div>
                    <select class="mapping-workbook-select ${isMapped ? 'mapped' : ''}" 
                            data-source="${escapeHtml(source.name)}">
                        <option value="">-- Select Workbook --</option>
                        ${state.savedWorkbooks.map(wb => `
                            <option value="${wb.id}" ${wb.id === mappedWorkbookId ? 'selected' : ''}>
                                ${escapeHtml(wb.name || wb.sheetTitle || 'Untitled')}
                            </option>
                        `).join('')}
                    </select>
                    <span class="mapping-status-icon ${isMapped ? 'mapped' : 'unmapped'}">
                        ${isMapped ? '✓' : '⚠'}
                    </span>
                </div>
            `;
        }).join('');
        
        // Add change event listeners
        elements.mappingList.querySelectorAll('.mapping-workbook-select').forEach(select => {
            select.addEventListener('change', handleMappingChange);
        });
    }
    
    // Update status display
    updateMappingStatusDisplay();
    updateAutoRunButtonState();
}

/**
 * Handle mapping dropdown change
 */
function handleMappingChange(event) {
    const select = event.target;
    const sourceName = select.dataset.source;
    const workbookId = select.value;
    const item = select.closest('.mapping-item');
    const statusIcon = item?.querySelector('.mapping-status-icon');
    
    // Update visual state
    if (workbookId) {
        select.classList.add('mapped');
        if (statusIcon) {
            statusIcon.textContent = '✓';
            statusIcon.className = 'mapping-status-icon mapped';
        }
        state.sourceMapping[sourceName] = workbookId;
    } else {
        select.classList.remove('mapped');
        if (statusIcon) {
            statusIcon.textContent = '⚠';
            statusIcon.className = 'mapping-status-icon unmapped';
        }
        delete state.sourceMapping[sourceName];
    }
    
    // Update counts and button state
    updateMappingStatusDisplay();
    updateAutoRunButtonState();
}

/**
 * Update mapping status counts display
 */
function updateMappingStatusDisplay() {
    if (!elements.mappingList) return;
    
    const selects = elements.mappingList.querySelectorAll('.mapping-workbook-select');
    let mapped = 0;
    let unmapped = 0;
    
    selects.forEach(select => {
        if (select.value) {
            mapped++;
        } else {
            unmapped++;
        }
    });
    
    if (elements.mappedCount) {
        elements.mappedCount.textContent = mapped;
    }
    if (elements.unmappedCount) {
        elements.unmappedCount.textContent = unmapped;
    }
}

/**
 * Auto-map sources to workbooks with matching names
 */
async function autoMapSources() {
    if (!state.savedWorkbooks || state.savedWorkbooks.length === 0) {
        updateStatus('❌ No saved workbooks to auto-map');
        return;
    }
    
    let mappedCount = 0;
    if (!elements.mappingList) return;
    
    const selects = elements.mappingList.querySelectorAll('.mapping-workbook-select');
    
    selects.forEach(select => {
        const sourceName = select.dataset.source;
        const sourceNameLower = sourceName.toLowerCase().trim();
        
        // Skip if already mapped
        if (select.value) return;
        
        // Find matching workbook
        const matchingWorkbook = state.savedWorkbooks.find(wb => {
            const wbName = (wb.name || wb.sheetTitle || '').toLowerCase().trim();
            return wbName === sourceNameLower || 
                   wbName.includes(sourceNameLower) || 
                   sourceNameLower.includes(wbName);
        });
        
        if (matchingWorkbook) {
            select.value = matchingWorkbook.id;
            select.dispatchEvent(new Event('change'));
            mappedCount++;
        }
    });
    
    if (mappedCount > 0) {
        updateStatus(`✅ Auto-mapped ${mappedCount} source${mappedCount !== 1 ? 's' : ''}`);
        addLogEntry(`Auto-mapped ${mappedCount} sources`, 'success');
    } else {
        updateStatus('ℹ️ No matching workbooks found');
        addLogEntry('No matching workbooks found for auto-map', 'warning');
    }
}

/**
 * Clear all source mappings
 */
function clearSourceMapping() {
    if (!elements.mappingList) return;
    
    const selects = elements.mappingList.querySelectorAll('.mapping-workbook-select');
    
    selects.forEach(select => {
        select.value = '';
        select.dispatchEvent(new Event('change'));
    });
    
    state.sourceMapping = {};
    updateMappingStatusDisplay();
    updateAutoRunButtonState();
    updateStatus('🗑️ Mapping cleared');
    addLogEntry('Mapping cleared', 'info');
}

/**
 * Add log entry to activity log (placeholder - will be enhanced in later tasks)
 */
function addLogEntry(message, type = 'info') {
    if (!elements.logEntries) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="timestamp">[${timestamp}]</span>${escapeHtml(message)}`;
    
    elements.logEntries.appendChild(entry);
    elements.logEntries.scrollTop = elements.logEntries.scrollHeight;
    
    // Keep only last 100 entries
    while (elements.logEntries.children.length > 100) {
        elements.logEntries.removeChild(elements.logEntries.firstChild);
    }
}

/**
 * Update auto-run button enabled/disabled state
 */
function updateAutoRunButtonState() {
    if (!elements.autoRunBtn) return;
    
    // Check if we have selected searches and all sources are mapped
    const hasSelectedSearches = state.selectedSearches.size > 0;
    
    // Get all unique sources from selected searches
    const selectedSources = new Set();
    state.selectedSearches.forEach(index => {
        const search = state.searches[index];
        if (search && search.source) {
            selectedSources.add(search.source);
        }
    });
    
    // Check if all selected sources are mapped
    const allSourcesMapped = Array.from(selectedSources).every(source => 
        state.sourceMapping[source]
    );
    
    const canRun = hasSelectedSearches && allSourcesMapped && !state.isAutoRunning;
    
    elements.autoRunBtn.disabled = !canRun;
    
    // Update button text to show why disabled
    if (!hasSelectedSearches) {
        elements.autoRunBtn.textContent = '🚀 Select Searches First';
    } else if (!allSourcesMapped) {
        const unmappedList = Array.from(selectedSources).filter(s => !state.sourceMapping[s]);
        elements.autoRunBtn.textContent = `🚀 Map: ${unmappedList.join(', ')}`;
    } else if (state.isAutoRunning) {
        elements.autoRunBtn.textContent = '🚀 Already Running';
    } else {
        elements.autoRunBtn.textContent = '🚀 Auto-Run Selected';
    }
    
    console.log('[POPUP] Auto-run button state:', {
        canRun,
        disabled: elements.autoRunBtn.disabled,
        hasSelectedSearches,
        allSourcesMapped,
        isAutoRunning: state.isAutoRunning,
        selectedSources: Array.from(selectedSources),
        sourceMapping: state.sourceMapping
    });
}

/**
 * Group selected searches by source
 * @returns {Object} Object with source names as keys, arrays of search objects as values
 */
function groupSelectedSearchesBySource() {
    const grouped = {};
    
    state.selectedSearches.forEach(index => {
        const search = state.searches[index];
        if (search) {
            const source = search.source || 'Unknown';
            if (!grouped[source]) {
                grouped[source] = [];
            }
            grouped[source].push({
                ...search,
                index: index
            });
        }
    });
    
    return grouped;
}

/**
 * Update auto-run UI from service worker progress message
 * @param {Object} progress - Progress object from service worker
 * @param {boolean} isRunning - Whether auto-run is still active
 */
function updateAutoRunProgressFromServiceWorker(progress, isRunning) {
    if (!progress) return;
    
    // Update state
    state.isAutoRunning = isRunning;
    state.autoRunStats = {
        ...state.autoRunStats,
        totalSearches: progress.totalSearches || 0,
        completedSearches: progress.completedSearches || 0,
        totalSources: progress.totalSources || 0,
        completedSources: progress.completedSources || 0,
        totalProfiles: progress.totalProfiles || 0,
        currentSource: progress.currentSource,
        currentSearch: progress.currentSearch
    };
    
    // Calculate percentage
    const percent = progress.totalSearches > 0 
        ? Math.round((progress.completedSearches / progress.totalSearches) * 100)
        : 0;
    
    // Update UI elements
    updateAutoRunProgress({
        title: isRunning ? `Processing ${progress.currentSource || '...'}` : 'Complete',
        detail: progress.currentSearch || '-',
        currentSource: progress.currentSource || '-',
        currentSearch: progress.currentSearch || '-',
        profileCount: progress.totalProfiles || 0,
        percent: percent
    });
    
    // Show/hide appropriate buttons
    if (elements.autoRunBtn) elements.autoRunBtn.style.display = isRunning ? 'none' : 'block';
    if (elements.stopAutoRunBtn) elements.stopAutoRunBtn.style.display = isRunning ? 'block' : 'none';
    if (elements.autoRunProgress) elements.autoRunProgress.style.display = isRunning ? 'block' : 'none';
    
    // If completed, show summary
    if (!isRunning && progress.completedSearches > 0) {
        const errors = progress.errors || [];
        addLogEntry(`✅ Auto-run complete: ${progress.completedSearches} searches, ${progress.totalProfiles} profiles${errors.length > 0 ? `, ${errors.length} errors` : ''}`, 'success');
    }
}

/**
 * Calculate overall auto-run progress percentage
 * @returns {number} Progress percentage (0-100)
 */
function calculateOverallProgress() {
    const { totalSearches, completedSearches } = state.autoRunStats;
    if (!totalSearches || totalSearches === 0) return 0;
    return Math.round((completedSearches / totalSearches) * 100);
}

/**
 * Update auto-run progress display
 * @param {Object} data - Progress data object
 */
function updateAutoRunProgress(data) {
    const {
        title = 'Processing...',
        detail = '-',
        currentSource = '-',
        currentSearch = '-',
        profileCount = 0,
        percent = 0
    } = data;
    
    if (elements.autoRunTitle) {
        elements.autoRunTitle.textContent = title;
    }
    if (elements.autoRunDetail) {
        elements.autoRunDetail.textContent = detail;
    }
    if (elements.autoRunProgressFill) {
        elements.autoRunProgressFill.style.width = `${percent}%`;
    }
    if (elements.currentSourceName) {
        elements.currentSourceName.textContent = currentSource;
    }
    if (elements.currentSearchInfo) {
        elements.currentSearchInfo.textContent = currentSearch;
    }
    if (elements.autoRunProfileCount) {
        elements.autoRunProfileCount.textContent = profileCount;
    }
}

/**
 * Handle Auto-Run button click (POPUP SIDE)
 * Sends config to service worker and lets it run in background
 */
async function handleAutoRun() {
    console.log('[POPUP] handleAutoRun called');
    
    // Validate
    const selectedSearches = Array.from(state.selectedSearches);
    console.log('[POPUP] Selected searches:', selectedSearches.length);
    
    if (selectedSearches.length === 0) {
        updateStatus('❌ No searches selected', 0);
        addLogEntry('❌ No searches selected', 'error');
        return;
    }
    
    // Check all sources are mapped
    const grouped = groupSelectedSearchesBySource();
    const sources = Object.keys(grouped);
    console.log('[POPUP] Sources:', sources);
    console.log('[POPUP] Source mapping:', state.sourceMapping);
    
    const unmapped = sources.filter(s => !state.sourceMapping[s]);
    console.log('[POPUP] Unmapped sources:', unmapped);
    
    if (unmapped.length > 0) {
        const errorMsg = `❌ Unmapped sources: ${unmapped.join(', ')}`;
        updateStatus(errorMsg, 0);
        addLogEntry(errorMsg, 'error');
        return;
    }
    
    // Confirm with user
    const confirmMessage = `Start auto-run?\n\n` +
        `• ${selectedSearches.length} searches\n` +
        `• ${sources.length} sources\n` +
        `• Estimated time: ${Math.round(selectedSearches.length * 1.5)} minutes\n\n` +
        `You can close this popup - processing continues in background.\n` +
        `Reopen popup anytime to check progress.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Prepare config for service worker
    const config = {
        searches: selectedSearches.map(idx => ({
            index: idx,
            ...state.searches[idx]
        })),
        groupedSearches: grouped,
        sources: sources
    };
    
    // Send to service worker
    try {
        console.log('[POPUP] Sending START_AUTO_RUN with config:', config);
        addLogEntry('🚀 Starting auto-run...', 'info');
        
        const response = await sendMessage('START_AUTO_RUN', { config });
        console.log('[POPUP] START_AUTO_RUN response:', response);
        
        if (response && response.success) {
            state.isAutoRunning = true;
            
            // Update UI
            if (elements.autoRunBtn) elements.autoRunBtn.style.display = 'none';
            if (elements.stopAutoRunBtn) elements.stopAutoRunBtn.style.display = 'block';
            if (elements.autoRunProgress) elements.autoRunProgress.style.display = 'block';
            if (elements.autoRunLog) elements.autoRunLog.style.display = 'block';
            
            addLogEntry(`📋 Processing ${selectedSearches.length} searches across ${sources.length} sources`, 'info');
            addLogEntry('💡 You can close this popup - auto-run continues in background', 'info');
            
            // Start polling as backup
            startProgressPolling();
            
        } else {
            const errorMsg = response?.error || 'Unknown error';
            addLogEntry(`❌ Failed to start: ${errorMsg}`, 'error');
            updateStatus(`❌ ${errorMsg}`, 0);
            
            // If error is "already in progress", try to clear stale state
            if (errorMsg.includes('already in progress')) {
                addLogEntry('🔄 Attempting to clear stale state...', 'warning');
                const cleared = await forceClearAutoRunState();
                if (cleared) {
                    addLogEntry('✅ Stale state cleared. Try starting auto-run again.', 'success');
                    updateStatus('✅ Stale state cleared. Click Auto-Run again.', 0);
                } else {
                    addLogEntry('⚠️ Could not clear stale state. Try reloading the extension.', 'warning');
                }
            }
        }
        
    } catch (error) {
        console.error('[POPUP] Auto-run start error:', error);
        const errorMsg = error.message || 'Unknown error';
        addLogEntry(`❌ Error: ${errorMsg}`, 'error');
        
        // If error is "already in progress", try to clear stale state
        if (errorMsg.includes('already in progress')) {
            addLogEntry('🔄 Attempting to clear stale state...', 'warning');
            const cleared = await forceClearAutoRunState();
            if (cleared) {
                addLogEntry('✅ Stale state cleared. Try starting auto-run again.', 'success');
                updateStatus('✅ Stale state cleared. Click Auto-Run again.', 0);
            }
        }
    }
}

/**
 * Handle Stop button click
 */
async function handleStopAutoRun() {
    try {
        addLogEntry('⏹️ Requesting stop...', 'warning');
        
        const response = await sendMessage('STOP_AUTO_RUN');
        
        if (response && response.success) {
            addLogEntry('⏹️ Stop requested - will stop after current scrape completes', 'warning');
            // Update UI state optimistically
            state.isAutoRunning = false;
            if (elements.autoRunBtn) elements.autoRunBtn.style.display = 'block';
            if (elements.stopAutoRunBtn) elements.stopAutoRunBtn.style.display = 'none';
        } else {
            addLogEntry(`❌ Stop failed: ${response?.error || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('[POPUP] Stop error:', error);
        const errorMsg = error.message || 'Unknown error';
        addLogEntry(`❌ Error: ${errorMsg}`, 'error');
        
        // Even if message failed, try to update UI optimistically
        // The polling will eventually catch up with the actual state
        state.isAutoRunning = false;
        if (elements.autoRunBtn) elements.autoRunBtn.style.display = 'block';
        if (elements.stopAutoRunBtn) elements.stopAutoRunBtn.style.display = 'none';
    }
}

/**
 * Force clear stale auto-run state
 * Called when user encounters "already in progress" error
 */
async function forceClearAutoRunState() {
    try {
        console.log('[POPUP] Force clearing auto-run state...');
        addLogEntry('🔄 Clearing stale auto-run state...', 'warning');
        
        // Send a message to clear the state
        const clearResponse = await sendMessage('CLEAR_AUTO_RUN_STATE').catch(() => null);
        
        if (clearResponse && clearResponse.success) {
            // Wait a moment for state to clear
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Check status again to verify
            const statusResponse = await sendMessage('GET_AUTO_RUN_STATUS').catch(() => null);
            
            if (statusResponse && !statusResponse.isRunning) {
                addLogEntry('✅ Cleared stale auto-run state', 'success');
                state.isAutoRunning = false;
                resetAutoRunUI();
                return true;
            }
        }
        
        // Fallback: try stop then check
        await sendMessage('STOP_AUTO_RUN').catch(() => null);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const statusResponse = await sendMessage('GET_AUTO_RUN_STATUS').catch(() => null);
        if (statusResponse && !statusResponse.isRunning) {
            addLogEntry('✅ Cleared stale auto-run state (via stop)', 'success');
            state.isAutoRunning = false;
            resetAutoRunUI();
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('[POPUP] Error force clearing state:', error);
        return false;
    }
}

/**
 * Start polling service worker for auto-run status
 */
function startStatusPolling() {
    // Clear any existing polling
    if (state.statusPollInterval) {
        clearInterval(state.statusPollInterval);
    }
    
    // Poll every 2 seconds
    state.statusPollInterval = setInterval(async () => {
        try {
            const status = await sendMessage('GET_AUTO_RUN_STATUS');
            
            if (!status.success) {
                console.error('[POPUP] Error getting status:', status.error);
                return;
            }
            
            // Update UI from status
            updateAutoRunProgressFromStatus(status);
            
            // If not running, stop polling
            if (!status.isRunning) {
                stopStatusPolling();
                
                if (status.isAborted) {
                    addLogEntry('⏹️ Auto-run stopped by user', 'warning');
                } else {
                    addLogEntry('✅ Auto-run completed!', 'success');
                    const progress = status.progress || {};
                    addLogEntry(`📊 Total: ${progress.totalProfiles || 0} profiles scraped`, 'success');
                }
            }
            
        } catch (error) {
            console.error('[POPUP] Error polling status:', error);
        }
    }, 2000); // Poll every 2 seconds
}

/**
 * Stop polling for status
 */
function stopStatusPolling() {
    if (state.statusPollInterval) {
        clearInterval(state.statusPollInterval);
        state.statusPollInterval = null;
    }
}

/**
 * Update progress display from service worker status
 */
function updateAutoRunProgressFromStatus(status) {
    const progress = status.progress || {};
    
    const percent = progress.percent || 0;
    const currentSource = progress.currentSource || '-';
    const currentSearch = progress.currentSearch || '-';
    const totalProfiles = progress.totalProfiles || 0;
    const completedSearches = progress.completedSearches || 0;
    const totalSearches = progress.totalSearches || 0;
    
    // Update progress bar
    if (elements.autoRunProgressFill) {
        elements.autoRunProgressFill.style.width = `${percent}%`;
    }
    
    // Update text displays
    if (elements.autoRunTitle) {
        elements.autoRunTitle.textContent = status.isRunning 
            ? `Processing... ${completedSearches}/${totalSearches} searches`
            : 'Completed';
    }
    
    if (elements.autoRunDetail) {
        elements.autoRunDetail.textContent = status.isRunning
            ? `${currentSource} - ${currentSearch}`
            : 'All searches completed';
    }
    
    if (elements.currentSourceName) {
        elements.currentSourceName.textContent = currentSource;
    }
    
    if (elements.currentSearchInfo) {
        elements.currentSearchInfo.textContent = currentSearch;
    }
    
    if (elements.autoRunProfileCount) {
        elements.autoRunProfileCount.textContent = totalProfiles;
    }
}

/**
 * Check for running or recently completed auto-run
 * Called on popup init to reconnect to background processing
 */
async function checkAutoRunStatus() {
    try {
        const response = await sendMessage('GET_AUTO_RUN_STATUS');
        
        if (!response.success) {
            console.log('[POPUP] No auto-run status available');
            // Reset UI state - no auto-run active
            resetAutoRunUI();
            return;
        }
        
        const { isRunning, isAborted, progress, percent } = response;
        
        console.log('[POPUP] Auto-run status check:', { isRunning, isAborted, hasProgress: !!progress });
        
        // If marked as aborted or not actually running, reset UI
        if (isAborted || !isRunning) {
            console.log('[POPUP] Auto-run is not active, resetting UI');
            state.isAutoRunning = false;
            resetAutoRunUI();
            
            // If there's progress data, show completion summary
            if (progress && progress.completedSearches > 0 && !isAborted) {
                // Show completion UI
                if (elements.autoRunSection) elements.autoRunSection.style.display = 'block';
                if (elements.autoRunProgress) elements.autoRunProgress.style.display = 'block';
                if (elements.autoRunLog) elements.autoRunLog.style.display = 'block';
                
                // Calculate elapsed time
                const elapsed = progress.startTime 
                    ? formatElapsedTime(Date.now() - progress.startTime)
                    : 'unknown';
                
                // Show completion summary
                updateAutoRunProgress({
                    title: '✅ Auto-Run Complete',
                    detail: `Finished in ${elapsed}`,
                    currentSource: '-',
                    currentSearch: '-',
                    profileCount: progress.totalProfiles || 0,
                    percent: 100
                });
                
                const errors = progress.errors || [];
                addLogEntry(`✅ Completed: ${progress.completedSearches} searches, ${progress.totalProfiles} profiles, ${errors.length} errors`, 'success');
                
                if (errors.length > 0) {
                    addLogEntry(`⚠️ Errors: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}`, 'warning');
                }
            }
            return;
        }
        
        // Auto-run is actually running - show UI and start polling
        if (isRunning) {
            console.log('[POPUP] Reconnecting to running auto-run');
            state.isAutoRunning = true;
            
            // Show progress UI
            if (elements.autoRunSection) elements.autoRunSection.style.display = 'block';
            if (elements.autoRunProgress) elements.autoRunProgress.style.display = 'block';
            if (elements.autoRunLog) elements.autoRunLog.style.display = 'block';
            if (elements.autoRunBtn) elements.autoRunBtn.style.display = 'none';
            if (elements.stopAutoRunBtn) elements.stopAutoRunBtn.style.display = 'block';
            
            // Update progress display
            updateAutoRunProgressFromServiceWorker(progress, true);
            
            addLogEntry('🔄 Reconnected to running auto-run', 'info');
            
            // Start polling for updates (backup for missed messages)
            startProgressPolling();
        }
        
    } catch (error) {
        console.error('[POPUP] Error checking auto-run status:', error);
        // On error, reset UI to safe state
        resetAutoRunUI();
    }
}

/**
 * Reset auto-run UI to default state (not running)
 */
function resetAutoRunUI() {
    state.isAutoRunning = false;
    
    // Show start button, hide stop button
    if (elements.autoRunBtn) {
        elements.autoRunBtn.style.display = 'block';
        elements.autoRunBtn.disabled = false; // Will be updated by updateAutoRunButtonState
    }
    if (elements.stopAutoRunBtn) {
        elements.stopAutoRunBtn.style.display = 'none';
    }
    
    // Hide progress if no searches loaded or no active run
    if (elements.autoRunProgress && (!state.searches || state.searches.length === 0)) {
        elements.autoRunProgress.style.display = 'none';
    }
    
    // Update button state based on current selections
    updateAutoRunButtonState();
}

/**
 * Start polling for progress updates (backup mechanism)
 */
function startProgressPolling() {
    // Poll every 5 seconds as backup
    const pollInterval = setInterval(async () => {
        if (!state.isAutoRunning) {
            clearInterval(pollInterval);
            return;
        }
        
        try {
            const response = await sendMessage('GET_AUTO_RUN_STATUS');
            if (response.success) {
                updateAutoRunProgressFromServiceWorker(response.progress, response.isRunning);
                
                if (!response.isRunning) {
                    state.isAutoRunning = false;
                    clearInterval(pollInterval);
                }
            }
        } catch (error) {
            console.error('[POPUP] Polling error:', error);
        }
    }, 5000);
}

/**
 * Format elapsed time in human-readable format
 */
function formatElapsedTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[POPUP] Received:', message.action);

    // Handle async operations in an async IIFE
    (async () => {
        try {
            switch (message.action) {
                case 'STATUS_UPDATE':
                    updateStatus(message.status);
                    break;

                case 'QUEUE_UPDATED':
                    updateQueueStatus();
                    break;

                case 'NOTIFY_COMPLETE':
                    state.isScrapingActive = false;
                    await chrome.storage.local.set({ isScrapingActive: false });
                    updateActionButtons();
                    stopQueuePolling();
                    stopStatusChecking();
                    updateQueueStatus();
                    
                    // Show smart navigation panel
                    showNextSearchPanel(message);
                    updateStatus(`🎉 Complete! ${message.totalProfiles} profiles`, 100);
                    break;
                    
                case 'AUTO_RUN_PROGRESS':
                    console.log('[POPUP] Received progress update:', message);
                    if (message.progress) {
                        updateAutoRunProgressFromServiceWorker(message.progress, message.isRunning);
                    }
                    break;
                
                // PHASE 8 ENHANCEMENT: Handle notifications
                case 'SHOW_CRITICAL_FAILURE_NOTIFICATION':
                    showNotification(message.message || 'Critical selector failures detected', 'error');
                    break;
                
                case 'SHOW_WARNING_NOTIFICATION':
                    showNotification(
                        message.message || 'LinkedIn security checkpoint detected',
                        message.type || 'linkedin_warning'
                    );
                    break;
                    
                case 'SELECTOR_VALIDATION_COMPLETE':
                    if (message.results) {
                        showSelectorTestResults(message.results);
                    }
                    checkSelectorHealth(); // Refresh health display
                    break;
            }
        } catch (error) {
            console.error('[POPUP] Message handler error:', error);
        }
    })();

    sendResponse({ received: true });
    return true;
});

// ============================================================
// PHASE 8: SELECTOR HEALTH FUNCTIONS
// ============================================================

/**
 * Check selector health and update UI
 */
async function checkSelectorHealth() {
    try {
        const response = await sendMessage('GET_SELECTOR_HEALTH');
        
        if (response && response.success) {
            state.selectorHealth = response.health;
            updateSelectorHealthUI(response.health);
        } else {
            updateSelectorHealthUI(null, 'Error checking health');
        }
    } catch (error) {
        console.error('[POPUP] Error checking selector health:', error);
        updateSelectorHealthUI(null, 'Error checking health');
    }
}

/**
 * Update selector health UI based on health data
 */
function updateSelectorHealthUI(health, errorMessage = null) {
    const dot = elements.healthDot;
    const text = elements.healthText;
    
    if (errorMessage || !health) {
        if (dot) dot.className = 'health-dot';
        if (text) text.textContent = errorMessage || 'Unknown';
        return;
    }
    
    // Determine health status
    const hasCriticalIssues = health.criticalIssues.length > 0;
    const hasRecentFailures = health.recentFailures > 0;
    
    if (dot) {
        if (hasCriticalIssues) {
            dot.className = 'health-dot critical';
        } else if (hasRecentFailures) {
            dot.className = 'health-dot warning';
        } else {
            dot.className = 'health-dot healthy';
        }
    }
    
    if (text) {
        if (hasCriticalIssues) {
            text.textContent = `Critical: ${health.criticalIssues.length} issues`;
        } else if (hasRecentFailures) {
            text.textContent = `Warning: ${health.recentFailures} recent failures`;
        } else {
            text.textContent = 'Healthy';
        }
    }
    
    // Update summary
    if (elements.healthSummary) {
        const summaryHTML = `
            <p class="health-summary-text">
                Version: ${health.version} | 
                Selectors: ${health.totalSelectorKeys} | 
                Stats: ${health.statsAvailable} tracked
                ${hasRecentFailures ? ` | Failures: ${health.recentFailures}` : ''}
            </p>
        `;
        elements.healthSummary.innerHTML = summaryHTML;
    }
    
    // Show details if there are issues
    if (hasCriticalIssues || hasRecentFailures) {
        if (elements.selectorHealthDetails) {
            elements.selectorHealthDetails.style.display = 'block';
        }
        updateHealthDetails(health);
    }
}

/**
 * Update detailed health information
 */
function updateHealthDetails(health) {
    if (!elements.healthDetailsContent) return;
    
    let detailsHTML = '<div style="line-height: 1.6;">';
    
    if (health.criticalIssues.length > 0) {
        detailsHTML += '<div style="color: #dc3545; margin-bottom: 8px;"><strong>Critical Issues:</strong></div>';
        health.criticalIssues.forEach(issue => {
            detailsHTML += `<div style="margin-left: 12px; margin-bottom: 4px;">
                ${issue.selector}: ${(issue.successRate * 100).toFixed(1)}% success 
                (${issue.attempts} attempts)
            </div>`;
        });
    }
    
    if (health.lastValidation) {
        detailsHTML += `<div style="margin-top: 8px; color: #888; font-size: 10px;">
            Last validation: ${new Date(health.lastValidation).toLocaleString()}
        </div>`;
    }
    
    detailsHTML += '</div>';
    elements.healthDetailsContent.innerHTML = detailsHTML;
}

/**
 * Test selectors on current LinkedIn page
 */
async function handleTestSelectors() {
    if (!elements.testSelectorsBtn) return;
    
    elements.testSelectorsBtn.disabled = true;
    elements.testSelectorsBtn.textContent = 'Testing...';
    
    updateStatus('🧪 Testing selectors on current page...', 30);
    
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url?.includes('linkedin.com')) {
            updateStatus('❌ Navigate to LinkedIn first');
            elements.testSelectorsBtn.disabled = false;
            elements.testSelectorsBtn.textContent = '🧪 Test Selectors';
            return;
        }
        
        // Send message to content script to validate selectors
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'VALIDATE_SELECTORS'
        });
        
        if (response && response.success) {
            updateStatus('✅ Selector test complete', 100);
            
            // Show results
            if (response.results) {
                showSelectorTestResults(response.results);
            }
            
            // Refresh health check
            await checkSelectorHealth();
        } else {
            updateStatus('⚠️ Selector test failed - content script may not be loaded');
        }
    } catch (error) {
        console.error('[POPUP] Selector test error:', error);
        updateStatus(`❌ Test error: ${error.message}`);
    } finally {
        if (elements.testSelectorsBtn) {
            elements.testSelectorsBtn.disabled = false;
            elements.testSelectorsBtn.textContent = '🧪 Test Selectors';
        }
    }
}

/**
 * Show selector test results in a modal or expandable section
 */
function showSelectorTestResults(results) {
    // Show in health details
    if (elements.healthDetailsContent) {
        let detailsHTML = '<div style="line-height: 1.6; margin-bottom: 8px;"><strong>Test Results:</strong></div>';
        
        Object.keys(results).forEach(key => {
            const result = results[key];
            const status = result.working > 0 ? '✅' : '❌';
            const color = result.working > 0 ? '#28a745' : '#dc3545';
            
            detailsHTML += `<div style="color: ${color}; margin-left: 12px; margin-bottom: 4px;">
                ${status} <strong>${key}</strong>: ${result.working}/${result.tested} working
            </div>`;
        });
        
        elements.healthDetailsContent.innerHTML = detailsHTML;
        if (elements.selectorHealthDetails) {
            elements.selectorHealthDetails.style.display = 'block';
        }
    }
}

/**
 * Handle manual selector config update
 */
async function handleUpdateSelectors() {
    if (!elements.selectorConfigTextarea) return;
    
    const configText = elements.selectorConfigTextarea.value.trim();
    
    if (!configText) {
        updateStatus('❌ Please enter selector configuration');
        return;
    }
    
    try {
        const config = JSON.parse(configText);
        
        updateStatus('🔄 Updating selectors...', 50);
        
        const response = await sendMessage('UPDATE_SELECTOR_CONFIG', {
            selectors: config
        });
        
        if (response && response.success) {
            updateStatus('✅ Selectors updated successfully', 100);
            elements.selectorConfigTextarea.value = '';
            
            // Refresh health
            await checkSelectorHealth();
        } else {
            updateStatus(`❌ Update failed: ${response?.error || 'Unknown error'}`);
        }
    } catch (error) {
        updateStatus(`❌ Invalid JSON: ${error.message}`);
    }
}

/**
 * Handle reset to default selectors
 */
async function handleResetSelectors() {
    const confirmed = confirm('Reset selectors to defaults? This will clear any custom configurations.');
    
    if (!confirmed) return;
    
    try {
        updateStatus('🔄 Resetting to defaults...', 50);
        
        const response = await sendMessage('RESET_SELECTOR_CONFIG');
        
        if (response && response.success) {
            updateStatus('✅ Selectors reset to defaults', 100);
            if (elements.selectorConfigTextarea) {
                elements.selectorConfigTextarea.value = '';
            }
            
            // Refresh health
            await checkSelectorHealth();
        } else {
            updateStatus(`❌ Reset failed: ${response?.error || 'Unknown error'}`);
        }
    } catch (error) {
        updateStatus(`❌ Reset error: ${error.message}`);
    }
}

// PHASE 8 ENHANCEMENT: Notification functions
/**
 * Show notification banner in popup
 */
function showNotification(message, type = 'error') {
    if (!elements.notificationBanner) return;
    
    const banner = elements.notificationBanner;
    const icon = elements.notificationIcon;
    const messageEl = elements.notificationMessage;
    
    // Set type (error, warning, info)
    banner.className = `notification-banner ${type}`;
    
    // Set icon based on type
    const icons = {
        error: '🚨',
        warning: '⚠️',
        info: 'ℹ️',
        linkedin_warning: '🔒'
    };
    if (icon) icon.textContent = icons[type] || icons.error;
    
    // Set message
    if (messageEl) messageEl.textContent = message;
    
    // Show banner
    banner.style.display = 'block';
    
    // Auto-hide after 10 seconds for non-critical messages
    if (type !== 'error' && type !== 'linkedin_warning') {
        setTimeout(() => {
            hideNotification();
        }, 10000);
    }
}

/**
 * Hide notification banner
 */
function hideNotification() {
    if (elements.notificationBanner) {
        elements.notificationBanner.style.display = 'none';
    }
}

// --- INITIALIZATION ---
async function init() {
    console.log('[POPUP] Initializing...');
    
    try {
        // Load saved settings
        const response = await sendMessage('GET_SETTINGS');
        const settings = response.settings || {};

        if (settings.inputSheetId) {
            elements.inputSheetId.value = settings.inputSheetId;
        }

        if (settings.searches) {
            state.searches = settings.searches;
        }
        
        state.searchIndex = settings.searchIndex || 0;

        if (settings.outputSheetId) {
            state.outputSheetId = settings.outputSheetId;
            state.outputSheetUrl = `https://docs.google.com/spreadsheets/d/${settings.outputSheetId}`;
            state.currentTabName = settings.currentTabName || 'Sheet1';
            
            // Load saved sheet name if available
            if (settings.outputSheetName) {
                state.outputSheetName = settings.outputSheetName;
            } else {
                // Fetch the sheet name if not saved
                try {
                    const nameResponse = await sendMessage('GET_SHEET_NAME', { 
                        spreadsheetId: settings.outputSheetId 
                    });
                    if (nameResponse.success) {
                        state.outputSheetName = nameResponse.sheetName;
                        // Save it for next time
                        await sendMessage('SAVE_SETTINGS', {
                            settings: { outputSheetName: nameResponse.sheetName }
                        });
                    }
                } catch (e) {
                    console.warn('[POPUP] Could not fetch sheet name:', e);
                }
            }
            
            // Load tabs for the sheet
            await loadTabsForSheet(state.outputSheetId);
            
            // Show active sheet checkbox for output section
            if (elements.outputActiveCheckbox) {
                elements.outputActiveCheckbox.style.display = 'block';
            }
        }

        // Check auth status
        try {
            const authResponse = await sendMessage('GET_AUTH_TOKEN', { interactive: false });
            setConnected(authResponse.success);
        } catch (e) {
            setConnected(false);
        }

        // Initial queue status
        await updateQueueStatus();
        
        // Phase 6: Load saved workbooks
        await loadSavedWorkbooks();
        
        // Phase 8: Initialize selector health check
        await checkSelectorHealth();
        
        // Check if scraping is actually active (persists across popup closes)
        const wasScrapingActive = await checkScrapingStatus();
        if (wasScrapingActive) {
            console.log('[POPUP] Detected active scraping, starting queue polling');
            startQueuePolling();
            startStatusChecking();
            updateStatus('🔄 Scraping in progress...');
        }

    } catch (error) {
        console.log('[POPUP] Init error (may be expected):', error);
    }

    renderSearchList();
    updateActionButtons();
    
    // Phase 8: Check for running auto-run and reconnect
    await checkAutoRunStatus();
    
    if (!state.isScrapingActive) {
        updateStatus('Ready');
    }

    // Attach event listeners
    elements.loadSearchesBtn.addEventListener('click', handleLoadSearches);
    elements.refreshProgressBtn.addEventListener('click', handleRefreshProgress);
    elements.createSheetBtn.addEventListener('click', handleCreateSheet);
    elements.loadSheetBtn.addEventListener('click', handleLoadSheet);
    elements.addTabBtn.addEventListener('click', handleAddTab);
    if (elements.tabSelector) {
        elements.tabSelector.addEventListener('change', handleTabChange);
    }
    elements.startScrapingBtn.addEventListener('click', handleStartScraping);
    elements.stopScrapingBtn.addEventListener('click', handleStopScraping);
    elements.retryFailedBtn?.addEventListener('click', handleRetryFailed);
    elements.downloadFailedBtn?.addEventListener('click', handleDownloadFailed);
    elements.forceSync?.addEventListener('click', (e) => {
        e.preventDefault();
        handleForceSync();
    });
    elements.deduplicateBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        handleDeduplicate();
    });
    elements.proceedNextBtn?.addEventListener('click', handleProceedNext);
    elements.dismissNextBtn?.addEventListener('click', handleDismissNext);
    
    // Phase 6: Workbook Manager event listeners
    elements.savedWorkbooksSelect?.addEventListener('change', handleWorkbookSelect);
    elements.addWorkbookBtn?.addEventListener('click', showAddWorkbookForm);
    elements.cancelAddWorkbookBtn?.addEventListener('click', hideAddWorkbookForm);
    elements.saveNewWorkbookBtn?.addEventListener('click', handleSaveWorkbook);
    elements.removeWorkbookBtn?.addEventListener('click', handleRemoveWorkbook);
    
    // Workbook name link click handler
    elements.selectedWorkbookName?.addEventListener('click', (e) => {
        e.preventDefault();
        const href = elements.selectedWorkbookName.href;
        if (href && href !== '#') {
            chrome.tabs.create({ url: href });
        }
    });
    
    // Phase 8: Selector Health event listeners
    elements.testSelectorsBtn?.addEventListener('click', handleTestSelectors);
    elements.updateSelectorsBtn?.addEventListener('click', handleUpdateSelectors);
    elements.resetSelectorsBtn?.addEventListener('click', handleResetSelectors);
    elements.notificationClose?.addEventListener('click', hideNotification);
    
    // Active sheet checkbox listeners (mutually exclusive)
    elements.workbookActiveCheck?.addEventListener('change', (e) => {
        if (e.target.checked) {
            handleActiveSheetChange('workbook');
        } else {
            state.activeSheetType = null;
            state.activeSheetId = null;
            state.activeSheetTab = null;
            updateActionButtons();
        }
    });
    
    elements.outputActiveCheck?.addEventListener('change', (e) => {
        if (e.target.checked) {
            handleActiveSheetChange('output');
        } else {
            state.activeSheetType = null;
            state.activeSheetId = null;
            state.activeSheetTab = null;
            updateActionButtons();
        }
    });
    
    // Phase 7: Compare Section event listeners
    elements.compareBtn?.addEventListener('click', handleCompare);
    elements.refreshTabsBtn?.addEventListener('click', loadTabsForComparison);
    elements.compareTab1?.addEventListener('change', updateCompareButtonState);
    elements.compareTab2?.addEventListener('change', updateCompareButtonState);
    elements.compareOutputName?.addEventListener('input', updateCompareButtonState);
    
    // Phase 8: Source Mapping event listeners
    elements.saveMappingBtn?.addEventListener('click', saveSourceMapping);
    elements.clearMappingBtn?.addEventListener('click', clearSourceMapping);
    elements.autoMapBtn?.addEventListener('click', autoMapSources);
    
    // Phase 8: Auto-Run selection event listeners
    elements.selectAllSearchesBtn?.addEventListener('click', selectAllSearches);
    elements.deselectAllSearchesBtn?.addEventListener('click', deselectAllSearches);
    
    // Phase 8: Auto-Run event listeners
    if (elements.autoRunBtn) {
        console.log('[POPUP] Attaching autoRunBtn click handler');
        elements.autoRunBtn.addEventListener('click', (e) => {
            console.log('[POPUP] Auto-run button clicked!');
            e.preventDefault();
            e.stopPropagation();
            if (!elements.autoRunBtn.disabled) {
                handleAutoRun();
            } else {
                console.log('[POPUP] Button is disabled, cannot start auto-run');
                addLogEntry('⚠️ Button is disabled - check selections and mappings', 'warning');
            }
        });
    }
    if (elements.stopAutoRunBtn) {
        elements.stopAutoRunBtn.addEventListener('click', handleStopAutoRun);
    }
    
    elements.openOutputSheet.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.outputSheetUrl) {
            chrome.tabs.create({ url: state.outputSheetUrl });
        }
    });
    
    // Make outputSheetDisplay link clickable
    elements.outputSheetDisplay.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.outputSheetUrl || state.outputSheetId) {
            const url = state.outputSheetUrl || 
                `https://docs.google.com/spreadsheets/d/${state.outputSheetId}`;
            chrome.tabs.create({ url });
        }
    });

    // Default sheet name
    const today = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
    elements.newSheetName.placeholder = `LinkedIn Scrape - ${today}`;
}

// Run initialization
init();
