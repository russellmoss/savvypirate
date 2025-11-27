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
    dismissNextBtn: document.getElementById('dismissNextBtn')
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
    nextSearchInfo: null
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
    const hasOutput = !!state.outputSheetId;
    const hasSearches = state.searches.length > 0;
    const canStart = hasOutput && hasSearches && !state.isScrapingActive;

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

    state.isScrapingActive = true;
    updateActionButtons();
    
    // Save scraping state to storage
    await chrome.storage.local.set({ isScrapingActive: true, scrapingTabId: tab.id });
    
    updateStatus('⚓ Checking content script...', 5);

    try {
        // CRITICAL: Ensure content script is injected before sending commands
        // This handles page reloads, fresh installs, and navigation edge cases
        const isInjected = await ensureContentScriptInjected(tab.id);
        
        if (!isInjected) {
            throw new Error('Content script could not be loaded. Please refresh the LinkedIn page.');
        }
        
        updateStatus('🚀 Starting scraper...', 10);
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
    if (!state.outputSheetId) {
        updateStatus('❌ No output sheet selected');
        return;
    }
    
    updateStatus('🧹 Deduplicating sheet...');
    try {
        const result = await sendMessage('DEDUPLICATE_SHEET');
        if (result.success) {
            updateStatus(`✅ Removed ${result.removed} duplicate(s), kept ${result.unique} unique rows`);
        } else {
            updateStatus(`❌ ${result.error || 'Deduplication failed'}`);
        }
    } catch (e) {
        updateStatus(`❌ Deduplication error: ${e.message}`);
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
