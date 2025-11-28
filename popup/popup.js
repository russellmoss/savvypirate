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
    compareError: document.getElementById('compareError')
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
    isComparing: false
};

let queuePollInterval = null;
let statusCheckInterval = null;

// --- HELPERS ---
function sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...data }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && !response.success) {
                reject(new Error(response.error || 'Unknown error'));
            } else {
                resolve(response);
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
        
        return `
        <div class="${itemClass}" data-index="${index}">
            <div>
                <div class="name">${escapeHtml(search.source || 'Unknown')}</div>
                <div class="title">${escapeHtml(search.title || '')}</div>
            </div>
            <button class="open-btn" data-index="${index}">Open</button>
        </div>
    `}).join('');

    // Add click handlers
    elements.searchList.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('open-btn')) {
                selectSearch(parseInt(item.dataset.index));
            }
        });
    });

    elements.searchList.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSearch(parseInt(btn.dataset.index));
        });
    });
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
            }
        } catch (error) {
            console.error('[POPUP] Message handler error:', error);
        }
    })();

    sendResponse({ received: true });
    return true;
});

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
