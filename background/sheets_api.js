// background/sheets_api.js - Google Sheets API Wrapper with Retry Logic

import { getAuthToken } from './auth.js';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const HEADERS_ROW = ['Date', 'Name', 'Title', 'Location', 'Connection Source', 'LinkedIn URL', 'Accreditation 1', 'Accreditation 2', 'Accreditation 3', 'Accreditation 4', 'Accreditation 5', 'Accreditation 6'];

/**
 * CRITICAL: Fetch with automatic token refresh on 401
 * This prevents "401 Unauthorized" failures during long sessions
 */
async function fetchWithRetry(url, options, retryCount = 0) {
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401 && retryCount < 1) {
            // Token expired - refresh and retry ONCE
            console.log('[SHEETS] 401 detected, refreshing token (attempt ' + (retryCount + 1) + ')...');
            
            // Extract and remove old token
            const oldToken = options.headers.Authorization.split(' ')[1];
            await new Promise(resolve => 
                chrome.identity.removeCachedAuthToken({ token: oldToken }, resolve)
            );
            
            // Get fresh token (non-interactive since user already authed)
            const newToken = await getAuthToken(false);
            options.headers.Authorization = `Bearer ${newToken}`;
            
            // Retry with new token
            return fetchWithRetry(url, options, retryCount + 1);
        }
        
        return response;
    } catch (e) {
        console.error('[SHEETS] Fetch error:', e);
        throw e;
    }
}

/**
 * Make authenticated API call with auto-retry on 401
 */
async function apiCall(endpoint, options = {}) {
    const token = await getAuthToken(true);
    const url = endpoint.startsWith('http') ? endpoint : `${SHEETS_API_BASE}${endpoint}`;
    
    const fetchOptions = {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    console.log(`[SHEETS] ${options.method || 'GET'} ${url.substring(0, 80)}...`);
    
    const response = await fetchWithRetry(url, fetchOptions);
    
    // Handle non-401 errors
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SHEETS] API Error ${response.status}:`, errorText);
        throw new Error(`Sheets API Error: ${response.status} - ${errorText.substring(0, 200)}`);
    }
    
    return response.json();
}

/**
 * Create a new spreadsheet with headers
 * @param {string} title - Name of the new spreadsheet
 * @returns {Promise<{spreadsheetId: string, spreadsheetUrl: string}>}
 */
export async function createSheet(title) {
    console.log(`[SHEETS] Creating spreadsheet: "${title}"`);
    
    // Create the spreadsheet
    const spreadsheet = await apiCall('', {
        method: 'POST',
        body: JSON.stringify({
            properties: { title }
        })
    });
    
    const { spreadsheetId, spreadsheetUrl } = spreadsheet;
    console.log(`[SHEETS] Created: ${spreadsheetId}`);
    
    // Add headers row immediately
    await appendRows(spreadsheetId, [HEADERS_ROW], false, 'Sheet1');
    console.log('[SHEETS] Headers added');
    
    return { spreadsheetId, spreadsheetUrl };
}

/**
 * Normalize LinkedIn URL for consistent comparison
 * Removes query params, trailing slashes, and normalizes http/https
 * @param {string} url - LinkedIn URL to normalize
 * @returns {string} Normalized URL or empty string if invalid
 */
function normalizeLinkedInUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    let normalized = url.trim();
    if (!normalized) return '';
    
    // Remove query parameters
    if (normalized.includes('?')) {
        normalized = normalized.split('?')[0];
    }
    
    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');
    
    // Normalize http/https (convert http to https for consistency)
    normalized = normalized.replace(/^http:\/\//i, 'https://');
    
    // Convert to lowercase for case-insensitive comparison
    normalized = normalized.toLowerCase();
    
    return normalized;
}

/**
 * Append rows to a spreadsheet with automatic deduplication
 * @param {string} spreadsheetId - Target spreadsheet ID
 * @param {Array<Array>} rows - Array of row arrays
 * @param {boolean} deduplicate - Whether to check for duplicates before adding (default: false - disabled for testing)
 * @param {string} tabName - Tab/sheet name to append to (default: 'Sheet1')
 * @returns {Promise<object>}
 */
export async function appendRows(spreadsheetId, rows, deduplicate = false, tabName = 'Sheet1') {
    if (!rows || rows.length === 0) {
        console.log('[SHEETS] No rows to append, skipping');
        return null;
    }
    
    // If deduplication is enabled, filter out duplicates
    let originalCount = rows.length;
    if (deduplicate) {
        try {
            // Read existing data to check for duplicates
            const existingData = await readSheet(spreadsheetId, `${tabName}!A:Z`);
            const existingUrls = new Set();
            
            // Skip header row and collect existing LinkedIn URLs (LinkedIn URL is column F, index 5)
            for (let i = 1; i < existingData.length; i++) {
                const url = existingData[i][5]; // LinkedIn URL column (index 5)
                if (url) {
                    const normalizedUrl = normalizeLinkedInUrl(url);
                    if (normalizedUrl) {
                        existingUrls.add(normalizedUrl);
                    }
                }
            }
            
            // Filter out rows with duplicate LinkedIn URLs
            rows = rows.filter(row => {
                const url = row[5]; // LinkedIn URL column (index 5)
                if (!url) return true; // Keep rows without URLs (they might be valid)
                const normalizedUrl = normalizeLinkedInUrl(url);
                if (!normalizedUrl) return true; // Keep rows with invalid URLs
                if (existingUrls.has(normalizedUrl)) {
                    return false; // Duplicate, skip
                }
                existingUrls.add(normalizedUrl); // Add to set for future checks in this batch
                return true; // New URL, keep
            });
            
            const duplicatesRemoved = originalCount - rows.length;
            if (duplicatesRemoved > 0) {
                console.log(`[SHEETS] Filtered out ${duplicatesRemoved} duplicate(s) before appending (based on LinkedIn URL)`);
            }
        } catch (error) {
            console.warn('[SHEETS] Deduplication check failed, appending all rows:', error.message);
            // Continue with all rows if deduplication check fails
        }
    }
    
    if (rows.length === 0) {
        console.log('[SHEETS] All rows were duplicates, nothing to append');
        return { updatedRows: 0, duplicatesRemoved: originalCount };
    }
    
    console.log(`[SHEETS] Appending ${rows.length} rows to ${spreadsheetId.substring(0, 10)} (tab: ${tabName})...`);
    
    const result = await apiCall(
        `/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
            method: 'POST',
            body: JSON.stringify({ values: rows })
        }
    );
    
    console.log(`[SHEETS] Appended ${rows.length} rows successfully`);
    return result;
}

/**
 * Format a tab name for use in a range string
 * Wraps tab names with spaces or special characters in single quotes
 * @param {string} tabName - The tab name
 * @returns {string} Formatted tab name for use in ranges
 */
function formatTabNameForRange(tabName) {
    // If tab name contains spaces, single quotes, or special characters, wrap it in single quotes
    // Escape single quotes in the tab name by doubling them
    if (tabName.includes(' ') || tabName.includes("'") || tabName.includes('!') || tabName.includes('[')) {
        return `'${tabName.replace(/'/g, "''")}'`;
    }
    return tabName;
}

/**
 * Read data from a spreadsheet
 * @param {string} spreadsheetId - Source spreadsheet ID
 * @param {string} range - Cell range (e.g., "Sheet1!A:Z")
 * @returns {Promise<Array<Array>>}
 */
export async function readSheet(spreadsheetId, range = 'Sheet1!A:Z') {
    console.log(`[SHEETS] Reading ${spreadsheetId.substring(0, 10)}... range: ${range}`);
    
    const data = await apiCall(`/${spreadsheetId}/values/${encodeURIComponent(range)}`);
    
    const rows = data.values || [];
    console.log(`[SHEETS] Read ${rows.length} rows`);
    return rows;
}

/**
 * Get all data from a specific tab
 * @param {string} spreadsheetId - The workbook ID
 * @param {string} tabName - The tab to read from
 * @returns {Promise<{headers: Array, rows: Array, rowCount: number}>}
 */
export async function getTabData(spreadsheetId, tabName) {
    console.log(`[SHEETS] Getting data from tab "${tabName}"...`);
    
    const formattedTabName = formatTabNameForRange(tabName);
    const allData = await readSheet(spreadsheetId, `${formattedTabName}!A:Z`);
    
    if (!allData || allData.length === 0) {
        console.log(`[SHEETS] Tab "${tabName}" is empty`);
        return { headers: [], rows: [], rowCount: 0 };
    }
    
    const headers = allData[0] || [];
    const rows = allData.slice(1);
    
    console.log(`[SHEETS] Tab "${tabName}" has ${rows.length} data rows`);
    return { headers, rows, rowCount: rows.length };
}

/**
 * Compare two tabs and create a differential list
 * Finds entries that exist in tab2 but NOT in tab1 (new entries)
 * 
 * @param {string} spreadsheetId - The workbook ID
 * @param {string} tab1Name - The "baseline" tab (older data)
 * @param {string} tab2Name - The "compare" tab (newer data) 
 * @param {string} outputTabName - Name for the output tab with differential
 * @param {number} keyColumn - Column index to use as unique key (default: 1 for Name)
 * @returns {Promise<{success: boolean, newEntries: number, tab1Count: number, tab2Count: number, outputTabName: string, error?: string}>}
 */
export async function compareTabs(spreadsheetId, tab1Name, tab2Name, outputTabName, keyColumn = 1) {
    console.log(`[SHEETS] Comparing tabs: "${tab1Name}" vs "${tab2Name}" → "${outputTabName}"`);
    
    try {
        // Step 1: Read data from both tabs
        const tab1Data = await getTabData(spreadsheetId, tab1Name);
        const tab2Data = await getTabData(spreadsheetId, tab2Name);
        
        console.log(`[SHEETS] Tab1 "${tab1Name}": ${tab1Data.rowCount} rows`);
        console.log(`[SHEETS] Tab2 "${tab2Name}": ${tab2Data.rowCount} rows`);
        
        // Step 2: Build a Set of keys from tab1 (baseline)
        const tab1Keys = new Set();
        for (const row of tab1Data.rows) {
            const keyValue = row[keyColumn];
            if (keyValue) {
                tab1Keys.add(String(keyValue).toLowerCase().trim());
            }
        }
        console.log(`[SHEETS] Tab1 has ${tab1Keys.size} unique keys`);
        
        // Step 3: Find rows in tab2 that are NOT in tab1
        const newRows = [];
        const seenInTab2 = new Set(); // Avoid duplicates within tab2
        
        for (const row of tab2Data.rows) {
            const keyValue = row[keyColumn];
            if (!keyValue) continue; // Skip rows without key
            
            const normalizedKey = String(keyValue).toLowerCase().trim();
            
            // Check if this key is NOT in tab1 AND we haven't already added it
            if (!tab1Keys.has(normalizedKey) && !seenInTab2.has(normalizedKey)) {
                newRows.push(row);
                seenInTab2.add(normalizedKey);
            }
        }
        
        console.log(`[SHEETS] Found ${newRows.length} new entries in "${tab2Name}"`);
        
        // Step 4: Check if output tab already exists
        const existingTabs = await getSheetTabs(spreadsheetId);
        const tabExists = existingTabs.some(t => t.title === outputTabName);
        
        if (tabExists) {
            console.log(`[SHEETS] Tab "${outputTabName}" already exists`);
            return {
                success: false,
                error: `Tab "${outputTabName}" already exists. Please choose a different name.`,
                newEntries: 0,
                tab1Count: tab1Data.rowCount,
                tab2Count: tab2Data.rowCount,
                outputTabName
            };
        }
        
        // Step 5: Create new tab (addTabToSheet automatically adds HEADERS_ROW)
        await addTabToSheet(spreadsheetId, outputTabName);
        console.log(`[SHEETS] Created output tab: "${outputTabName}"`);
        
        // Step 6: Write differential rows (if any)
        // Note: Headers are already added by addTabToSheet, so we only write data rows
        if (newRows.length > 0) {
            await appendRows(spreadsheetId, newRows, false, outputTabName);
            console.log(`[SHEETS] Wrote ${newRows.length} rows to "${outputTabName}"`);
        } else {
            console.log(`[SHEETS] No new entries to write (output tab has headers only)`);
        }
        
        console.log(`[SHEETS] ✅ Comparison complete: ${newRows.length} new entries`);
        
        return {
            success: true,
            newEntries: newRows.length,
            tab1Count: tab1Data.rowCount,
            tab2Count: tab2Data.rowCount,
            outputTabName
        };
        
    } catch (error) {
        console.error(`[SHEETS] Compare error:`, error);
        return {
            success: false,
            error: error.message,
            newEntries: 0,
            tab1Count: 0,
            tab2Count: 0,
            outputTabName
        };
    }
}

/**
 * Get spreadsheet name/title
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Promise<string>} The spreadsheet title
 */
export async function getSheetName(spreadsheetId) {
    console.log(`[SHEETS] Getting name for ${spreadsheetId.substring(0, 10)}...`);
    
    const spreadsheet = await apiCall(`/${spreadsheetId}?fields=properties.title`);
    
    const title = spreadsheet.properties?.title || 'Untitled';
    console.log(`[SHEETS] Sheet name: "${title}"`);
    return title;
}

/**
 * Create a new tab/sheet in an existing spreadsheet
 * @param {string} spreadsheetId - Target spreadsheet ID
 * @param {string} tabName - Name for the new tab
 * @returns {Promise<{sheetId: number, title: string}>}
 */
export async function addTabToSheet(spreadsheetId, tabName) {
    console.log(`[SHEETS] Adding tab "${tabName}" to ${spreadsheetId.substring(0, 10)}...`);
    
    const token = await getAuthToken(true);
    
    // Use batchUpdate to add a new sheet
    const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const addSheetRequest = {
        requests: [{
            addSheet: {
                properties: {
                    title: tabName
                }
            }
        }]
    };
    
    const response = await fetchWithRetry(batchUpdateUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(addSheetRequest)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add tab: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const newSheet = result.replies[0].addSheet.properties;
    
    console.log(`[SHEETS] Added tab "${tabName}" with sheetId: ${newSheet.sheetId}`);
    
    // Add headers to the new tab
    await appendRows(spreadsheetId, [HEADERS_ROW], false, tabName);
    console.log(`[SHEETS] Headers added to tab "${tabName}"`);
    
    return {
        sheetId: newSheet.sheetId,
        title: newSheet.title
    };
}

/**
 * Load an existing spreadsheet (verify it exists and get its name)
 * @param {string} spreadsheetId - Spreadsheet ID to load
 * @returns {Promise<{spreadsheetId: string, spreadsheetUrl: string, sheetName: string, tabs: Array<{title: string, sheetId: number}>}>}
 */
export async function loadSheet(spreadsheetId) {
    console.log(`[SHEETS] Loading spreadsheet: ${spreadsheetId.substring(0, 10)}...`);
    
    const spreadsheet = await apiCall(`/${spreadsheetId}?fields=properties.title,spreadsheetUrl,sheets.properties`);
    
    const sheetName = spreadsheet.properties?.title || 'Untitled';
    const spreadsheetUrl = spreadsheet.spreadsheetUrl || 
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    
    // Extract all tabs/sheets
    const tabs = (spreadsheet.sheets || []).map(sheet => ({
        title: sheet.properties?.title || 'Untitled',
        sheetId: sheet.properties?.sheetId
    }));
    
    console.log(`[SHEETS] Loaded: "${sheetName}" with ${tabs.length} tab(s)`);
    
    return {
        spreadsheetId,
        spreadsheetUrl,
        sheetName,
        tabs
    };
}

/**
 * Get list of all tabs/sheets in a spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Promise<Array<{title: string, sheetId: number}>>}
 */
export async function getSheetTabs(spreadsheetId) {
    console.log(`[SHEETS] Getting tabs for ${spreadsheetId.substring(0, 10)}...`);
    
    const spreadsheet = await apiCall(`/${spreadsheetId}?fields=sheets.properties`);
    
    const tabs = (spreadsheet.sheets || []).map(sheet => ({
        title: sheet.properties?.title || 'Untitled',
        sheetId: sheet.properties?.sheetId
    }));
    
    console.log(`[SHEETS] Found ${tabs.length} tab(s)`);
    return tabs;
}

/**
 * Deduplicate a spreadsheet based on the LinkedIn URL column (column F, index 5)
 * Keeps the first occurrence of each LinkedIn URL
 * @param {string} spreadsheetId - Target spreadsheet ID
 * @param {string} tabName - Tab name to deduplicate (default: 'Sheet1')
 * @returns {Promise<{removed: number, total: number, unique: number}>}
 */
export async function deduplicateSheet(spreadsheetId, tabName = 'Sheet1') {
    console.log(`[SHEETS] Deduplicating ${spreadsheetId.substring(0, 10)} (tab: ${tabName}) based on LinkedIn URL...`);
    
    // Format tab name for range (handle spaces and special characters)
    const formattedTabName = formatTabNameForRange(tabName);
    
    // Read all data - use a large range to get everything
    const allRows = await readSheet(spreadsheetId, `${formattedTabName}!A1:Z10000`);
    
    if (allRows.length <= 1) {
        console.log('[SHEETS] No data to deduplicate (only header or empty)');
        return { removed: 0, total: allRows.length - 1, unique: allRows.length - 1 };
    }
    
    const header = allRows[0];
    const dataRows = allRows.slice(1);
    const originalCount = dataRows.length;
    
    console.log(`[SHEETS] Found ${originalCount} data rows to process`);
    
    // Deduplicate based on LinkedIn URL column (index 5, column F)
    const seenUrls = new Set();
    const uniqueRows = [];
    let duplicateCount = 0;
    
    for (const row of dataRows) {
        // Skip completely empty rows
        if (!row || row.length === 0 || row.every(cell => !cell || cell.toString().trim() === '')) {
            continue;
        }
        
        // LinkedIn URL column is index 5 (column F)
        const url = row[5];
        
        // Handle empty or undefined URLs
        if (!url || String(url).trim() === '') {
            // Keep rows without URLs (they might be valid)
            uniqueRows.push(row);
            continue;
        }
        
        // Normalize LinkedIn URL for comparison
        const normalizedUrl = normalizeLinkedInUrl(url);
        
        // If URL is invalid after normalization, keep the row (might be valid data)
        if (!normalizedUrl) {
            uniqueRows.push(row);
            continue;
        }
        
        // Check if we've seen this URL before
        if (!seenUrls.has(normalizedUrl)) {
            seenUrls.add(normalizedUrl);
            uniqueRows.push(row);
        } else {
            duplicateCount++;
            console.log(`[SHEETS] Duplicate #${duplicateCount} found and skipped: "${url}"`);
        }
    }
    
    const duplicatesRemoved = originalCount - uniqueRows.length;
    
    console.log(`[SHEETS] Deduplication result: ${originalCount} original rows, ${uniqueRows.length} unique rows, ${duplicatesRemoved} duplicates to remove`);
    
    if (duplicatesRemoved === 0) {
        console.log('[SHEETS] No duplicates found');
        return { removed: 0, total: originalCount, unique: uniqueRows.length };
    }
    
    // Use batchUpdate API to delete all data rows, then write unique rows
    // This is the most reliable way to ensure no multiplication
    const token = await getAuthToken(true);
    
    // Step 1: Get the sheet ID for the specified tab
    const spreadsheetInfo = await apiCall(`/${spreadsheetId}?fields=sheets.properties`);
    const targetSheet = spreadsheetInfo.sheets.find(s => s.properties.title === tabName);
    if (!targetSheet) {
        throw new Error(`Tab "${tabName}" not found in spreadsheet`);
    }
    const sheetId = targetSheet.properties.sheetId;
    const totalRows = allRows.length;
    
    console.log(`[SHEETS] Sheet has ${totalRows} total rows, will delete ${totalRows - 1} data rows (keeping header)`);
    
    // Step 2: Delete all rows from row 2 onwards (keep header) using batchUpdate
    if (totalRows > 1) {
        const deleteRequest = {
            requests: [{
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: 1, // Row 2 (0-indexed, so 1 = row 2)
                        endIndex: totalRows // End of data (exclusive, so this deletes rows 2 through totalRows)
                    }
                }
            }]
        };
        
        const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
        const deleteResponse = await fetchWithRetry(batchUpdateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(deleteRequest)
        });
        
        if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            throw new Error(`Failed to delete rows: ${deleteResponse.status} - ${errorText}`);
        }
        
        const deleteResult = await deleteResponse.json();
        console.log(`[SHEETS] Successfully deleted all data rows`, deleteResult);
    }
    
    // Step 3: Write header + unique rows
    const allUniqueRows = [header, ...uniqueRows];
    const numCols = Math.max(header.length, 12);
    
    // Convert column number to letter
    const getColumnLetter = (colNum) => {
        let result = '';
        let num = colNum;
        while (num > 0) {
            num--;
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26);
        }
        return result || 'A';
    };
    
    const endCol = getColumnLetter(numCols);
    const range = `${formattedTabName}!A1:${endCol}${allUniqueRows.length}`;
    
    console.log(`[SHEETS] Writing ${allUniqueRows.length} rows (1 header + ${uniqueRows.length} data) to range: ${range}`);
    
    // Write the deduplicated data - this will write to rows 1 through allUniqueRows.length
    await apiCall(
        `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
            method: 'PUT',
            body: JSON.stringify({ values: allUniqueRows })
        }
    );
    
    console.log(`[SHEETS] Successfully wrote deduplicated data`);
    
    console.log(`[SHEETS] Deduplication complete: Removed ${duplicatesRemoved} duplicate(s), kept ${uniqueRows.length} unique rows`);
    
    return {
        removed: duplicatesRemoved,
        total: originalCount,
        unique: uniqueRows.length
    };
}

// ============================================================
// PHASE 6: WORKBOOK & TAB MANAGEMENT
// ============================================================

/**
 * Get today's date formatted as MM_DD_YY in Eastern Time (EST/EDT)
 * @returns {string} e.g., "11_27_25"
 */
function getTodayTabName() {
    // Get current time in Eastern Time (handles EST/EDT automatically)
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    const month = String(easternTime.getMonth() + 1).padStart(2, '0');
    const day = String(easternTime.getDate()).padStart(2, '0');
    const year = String(easternTime.getFullYear()).slice(-2);
    return `${month}_${day}_${year}`;
}

/**
 * Create a new tab in a workbook (without headers)
 * @param {string} spreadsheetId - The workbook ID
 * @param {string} tabName - Name for the new tab
 * @returns {Promise<{sheetId: number, title: string}>}
 */
export async function createTab(spreadsheetId, tabName) {
    console.log(`[SHEETS] Creating tab "${tabName}" in ${spreadsheetId.substring(0, 10)}...`);
    
    const result = await apiCall(`/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
            requests: [{
                addSheet: {
                    properties: {
                        title: tabName
                    }
                }
            }]
        })
    });
    
    const newSheet = result.replies?.[0]?.addSheet?.properties;
    console.log(`[SHEETS] Created tab: ${newSheet?.title} (ID: ${newSheet?.sheetId})`);
    
    return {
        sheetId: newSheet?.sheetId,
        title: newSheet?.title
    };
}

/**
 * Write headers to a specific tab
 * @param {string} spreadsheetId - The workbook ID
 * @param {string} tabName - The tab to write to
 * @returns {Promise<void>}
 */
export async function writeHeadersToTab(spreadsheetId, tabName) {
    console.log(`[SHEETS] Writing headers to "${tabName}"...`);
    
    // HEADERS_ROW has 12 columns, so use A1:L1
    const lastColumn = String.fromCharCode(64 + HEADERS_ROW.length); // L for 12 columns
    const range = `'${tabName}'!A1:${lastColumn}1`;
    
    await apiCall(
        `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
            method: 'PUT',
            body: JSON.stringify({
                values: [HEADERS_ROW]
            })
        }
    );
    
    console.log(`[SHEETS] Headers written to "${tabName}"`);
}

/**
 * Append rows to a SPECIFIC TAB in a workbook
 * @param {string} spreadsheetId - The workbook ID
 * @param {string} tabName - The tab to append to
 * @param {Array<Array>} rows - Data rows
 * @returns {Promise<object>}
 */
export async function appendRowsToTab(spreadsheetId, tabName, rows) {
    if (!rows || rows.length === 0) {
        console.log('[SHEETS] No rows to append, skipping');
        return null;
    }
    
    console.log(`[SHEETS] Appending ${rows.length} rows to "${tabName}"...`);
    
    // For append operations, Google Sheets API expects: SheetName!A1 or 'SheetName'!A1
    // Tab names with special characters (like underscores, spaces) need to be quoted
    // Format: 'SheetName'!A1 (quotes around sheet name, then !A1)
    const range = tabName.includes(' ') || tabName.includes('_') || tabName.includes('-') 
        ? `'${tabName}'!A1` 
        : `${tabName}!A1`;
    
    try {
        const result = await apiCall(
            `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            {
                method: 'POST',
                body: JSON.stringify({ values: rows })
            }
        );
        
        console.log(`[SHEETS] ✅ Appended ${rows.length} rows to "${tabName}"`);
        return result;
    } catch (error) {
        // If tab doesn't exist or range parsing fails, try to create it first
        if (error.message && (error.message.includes('Unable to parse range') || error.message.includes('Unable to parse'))) {
            console.log(`[SHEETS] Tab "${tabName}" might not exist or range format issue, attempting to create/verify tab...`);
            try {
                // Check if tab exists first
                const tabs = await getSheetTabs(spreadsheetId);
                const tabExists = tabs.some(tab => tab.title === tabName);
                
                if (!tabExists) {
                    await createTab(spreadsheetId, tabName);
                    await writeHeadersToTab(spreadsheetId, tabName);
                    console.log(`[SHEETS] Created tab "${tabName}", retrying append...`);
                } else {
                    console.log(`[SHEETS] Tab "${tabName}" exists, retrying with corrected range format...`);
                }
                
                // Retry the append with the same range format
                const result = await apiCall(
                    `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ values: rows })
                    }
                );
                console.log(`[SHEETS] ✅ Appended ${rows.length} rows to "${tabName}" (after creating/verifying tab)`);
                return result;
            } catch (createError) {
                console.error(`[SHEETS] Failed to create/verify tab "${tabName}":`, createError);
                throw error; // Throw original error
            }
        }
        throw error;
    }
}

/**
 * SMART TAB CREATION: Ensures today's dated tab exists
 * Creates it with headers if it doesn't exist
 * 
 * @param {string} spreadsheetId - The workbook ID
 * @returns {Promise<{tabName: string, isNew: boolean, spreadsheetId: string}>}
 */
export async function ensureWeeklyTab(spreadsheetId) {
    const tabName = getTodayTabName();
    console.log(`[SHEETS] Ensuring weekly tab "${tabName}" exists...`);
    
    // Get existing tabs (returns Array<{title: string, sheetId: number}>)
    const existingTabsData = await getSheetTabs(spreadsheetId);
    const existingTabNames = existingTabsData.map(tab => tab.title);
    
    // Check if today's tab already exists
    if (existingTabNames.includes(tabName)) {
        console.log(`[SHEETS] Tab "${tabName}" already exists, reusing`);
        return {
            tabName,
            isNew: false,
            spreadsheetId
        };
    }
    
    // Create new tab
    console.log(`[SHEETS] Tab "${tabName}" not found, creating...`);
    await createTab(spreadsheetId, tabName);
    
    // Write headers to the new tab
    await writeHeadersToTab(spreadsheetId, tabName);
    
    console.log(`[SHEETS] ✅ Weekly tab "${tabName}" ready`);
    return {
        tabName,
        isNew: true,
        spreadsheetId
    };
}

/**
 * Validate that a spreadsheet ID is accessible
 * @param {string} spreadsheetId - The workbook ID to validate
 * @returns {Promise<{valid: boolean, title: string, error?: string}>}
 */
export async function validateSpreadsheet(spreadsheetId) {
    try {
        console.log(`[SHEETS] Validating spreadsheet ${spreadsheetId.substring(0, 10)}...`);
        
        const data = await apiCall(`/${spreadsheetId}?fields=properties.title`);
        
        return {
            valid: true,
            title: data.properties?.title || 'Untitled'
        };
    } catch (error) {
        console.error(`[SHEETS] Validation failed:`, error.message);
        return {
            valid: false,
            title: '',
            error: error.message
        };
    }
}

