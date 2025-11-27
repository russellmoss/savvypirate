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
            const existingNames = new Set();
            
            // Skip header row and collect existing names (Name is column B, index 1)
            for (let i = 1; i < existingData.length; i++) {
                const name = existingData[i][1]; // Name column (index 1)
                if (name) {
                    existingNames.add(name.toLowerCase().trim());
                }
            }
            
            // Filter out rows with duplicate names
            rows = rows.filter(row => {
                const name = row[1]; // Name column (index 1)
                if (!name) return true; // Keep rows without names
                const nameKey = name.toLowerCase().trim();
                if (existingNames.has(nameKey)) {
                    return false; // Duplicate, skip
                }
                existingNames.add(nameKey); // Add to set for future checks in this batch
                return true; // New name, keep
            });
            
            const duplicatesRemoved = originalCount - rows.length;
            if (duplicatesRemoved > 0) {
                console.log(`[SHEETS] Filtered out ${duplicatesRemoved} duplicate(s) before appending`);
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
 * Deduplicate a spreadsheet based on the Name column (column B, index 1)
 * Keeps the first occurrence of each name
 * @param {string} spreadsheetId - Target spreadsheet ID
 * @param {string} tabName - Tab name to deduplicate (default: 'Sheet1')
 * @returns {Promise<{removed: number, total: number, unique: number}>}
 */
export async function deduplicateSheet(spreadsheetId, tabName = 'Sheet1') {
    console.log(`[SHEETS] Deduplicating ${spreadsheetId.substring(0, 10)} (tab: ${tabName})...`);
    
    // Read all data - use a large range to get everything
    const allRows = await readSheet(spreadsheetId, `${tabName}!A1:Z10000`);
    
    if (allRows.length <= 1) {
        console.log('[SHEETS] No data to deduplicate (only header or empty)');
        return { removed: 0, total: allRows.length - 1, unique: allRows.length - 1 };
    }
    
    const header = allRows[0];
    const dataRows = allRows.slice(1);
    const originalCount = dataRows.length;
    
    console.log(`[SHEETS] Found ${originalCount} data rows to process`);
    
    // Deduplicate based on Name column (index 1)
    const seenNames = new Set();
    const uniqueRows = [];
    let duplicateCount = 0;
    
    for (const row of dataRows) {
        // Skip completely empty rows
        if (!row || row.length === 0 || row.every(cell => !cell || cell.toString().trim() === '')) {
            continue;
        }
        
        // Name column is index 1 (column B)
        const name = row[1];
        
        // Handle empty or undefined names
        if (!name || String(name).trim() === '') {
            // Keep rows without names (they might be valid)
            uniqueRows.push(row);
            continue;
        }
        
        // Normalize name for comparison (case-insensitive, trimmed)
        const nameKey = String(name).toLowerCase().trim();
        
        // Check if we've seen this name before
        if (!seenNames.has(nameKey)) {
            seenNames.add(nameKey);
            uniqueRows.push(row);
        } else {
            duplicateCount++;
            console.log(`[SHEETS] Duplicate #${duplicateCount} found and skipped: "${name}"`);
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
    const range = `${tabName}!A1:${endCol}${allUniqueRows.length}`;
    
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

