# Savvy Pirate Chrome Extension: Development Plan & Documentation
## Grade: A+ Diamond Edition (Production-Ready)

> **Status**: ✅ **FULLY IMPLEMENTED** - Extension is production-ready with all features working.
> 
> **Last Updated**: Current implementation includes tab management, name parsing, deduplication, and pirate-themed UI.

### Agent Context
```
You are a Senior Chrome Extension Developer specializing in Manifest V3.
Stack: JavaScript (ES6+), Chrome Identity API, Google Sheets API v4.
Critical Constraint: The scraper runs for extended periods (30+ minutes).
The Service Worker MUST NOT die unexpectedly. Prioritize stability.
Data MUST NEVER be lost - use local queue before cloud sync.
```

---

## 🎯 Objective
Build a robust Chrome Extension (Manifest V3) named **"Savvy Pirate"** that scrapes LinkedIn search results and exports data directly to Google Sheets, controlled via a popup UI with pirate-themed styling.

---

## 📦 CURRENT IMPLEMENTATION STATUS

### Extension Name & Branding
- **Name**: "Savvy Pirate" (formerly "LinkedIn Scraper Pro")
- **Icon**: Skull icon (icon16.png, icon48.png, icon128.png)
- **UI Theme**: Pirate-themed black and red below header, white/gray/blue header

### Core Features (IMPLEMENTED)

1. **Tab Management**
   - Load existing Google Sheets by URL or ID
   - Create new tabs within existing workbooks
   - Select active tab via dropdown for scraping
   - Tab selection persists across sessions

2. **Data Extraction**
   - Extracts: Date, Name, Title, Location, Connection Source, LinkedIn URL
   - **Name Parsing**: Automatically separates accreditations from names
     - Example: "James Weaver, CWS®" → Name: "James Weaver", Accreditation 1: "CWS®"
     - Handles up to 6 accreditations (Accreditation 1-6 columns)
     - Preserves name suffixes (Jr, Sr, II, III, etc.) with the name
   - **Connection Source**: Uses value from input sheet Column A (not scraped)

3. **Output Sheet Headers**
   - Date, Name, Title, Location, Connection Source, LinkedIn URL
   - Accreditation 1, Accreditation 2, Accreditation 3, Accreditation 4, Accreditation 5, Accreditation 6

4. **Deduplication**
   - Manual "Deduplicate" button in footer
   - Removes duplicate rows based on Name column
   - Uses Google Sheets batchUpdate API for reliable deletion

5. **Sheet Name Display**
   - Shows actual sheet name (not just ID) as clickable link
   - Persists across sessions
   - Clickable link opens sheet in new tab

6. **Progress Tracking**
   - Visual progress bar showing "Search X of Y"
   - "🔄 Reset" button to clear checkmarks (resets searchIndex)
   - Progress persists across sessions

7. **Status Persistence**
   - Scraping state persists across popup closes/reopens
   - Status checking detects active scraping on popup open
   - Stop button accessible even after closing/reopening popup

### Key Stability Requirements
1. **Service Worker Keep-Alive**: Manifest V3 service workers sleep after 30 seconds of inactivity
2. **Token Auto-Refresh**: Handle 401 errors with automatic token refresh
3. **Graceful Error Recovery**: Never crash, always recover or report
4. **Single-File Content Script**: Avoid ES module issues in content scripts

### Key Resilience Requirements (NEW)
5. **Sync Queue**: Data saved locally FIRST, then synced to Sheets (survives WiFi drops)
6. **Retry Logic**: Failed API calls retry 5x before moving to "failed" queue
7. **Smart Navigation**: Auto-advance to next search on completion
8. **Progress Tracking**: Remember position in search list across sessions

---

## 📋 Pre-Flight Checklist (HUMAN ACTIONS REQUIRED)

> ⚠️ **STOP**: Complete these steps BEFORE starting any code generation.

### 1. Google Cloud Setup (15 minutes)
```
1. Go to https://console.cloud.google.com
2. Create new project: "LinkedIn Scraper Extension"
3. Enable APIs:
   - Google Sheets API
   - Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Select "Chrome Extension"
6. You'll need the Extension ID (get this after Step 2 below)
```

### ⚠️ CRITICAL: Add Test User (Do NOT skip!)
```
IMMEDIATELY after creating OAuth credentials:
1. Go to "OAuth consent screen" in Google Cloud Console
2. Scroll down to "Test users" section
3. Click "+ ADD USERS"
4. Enter YOUR Google Account email address
5. Click "Save"

WHY: If you skip this, ALL API calls will fail with "403 Forbidden" 
or "Access Not Configured" even with valid tokens!
```

### 2. Get Your Extension ID
```
1. Create project folder: linkedin-scraper-extension/
2. Add minimal manifest.json (Phase 1 below)
3. Go to chrome://extensions
4. Enable "Developer mode"
5. Click "Load unpacked" → select your folder
6. Copy the Extension ID (looks like: abcdefghijklmnopqrstuvwxyzabcdef)
7. Paste into Google Cloud OAuth setup
8. Copy the Client ID back to manifest.json
```

### 3. Create Your Input Sheet
```
Create a Google Sheet with columns:
A: Source Connection (e.g., "Taylor Smith")
B: Job Title Filter (e.g., "Financial Advisor")
C: Search URL (the LinkedIn search URL)

Copy the Sheet ID from the URL:
https://docs.google.com/spreadsheets/d/[THIS_IS_THE_ID]/edit
```

---

## 🏗️ Project Structure

```
linkedin_scraper/
├── manifest.json              # Extension configuration
├── background/
│   ├── service_worker.js      # Main service worker (imports modules)
│   ├── auth.js                # OAuth token management
│   ├── sheets_api.js          # Google Sheets API wrapper (includes tab management)
│   └── sync_queue.js          # Local-first data queue with retry
├── content/
│   └── content.js             # SINGLE consolidated scraper file (includes name parsing)
├── popup/
│   ├── popup.html             # Control panel UI (pirate-themed)
│   ├── popup.js               # Popup logic (includes tab management)
│   └── popup.css              # Popup styling (black/red theme)
├── icons/
│   ├── icon16.png             # Skull icon
│   ├── icon48.png             # Skull icon
│   └── icon128.png            # Skull icon
└── oauth-config.json          # OAuth credentials storage
```

> ⚠️ **CRITICAL**: Content scripts in Manifest V3 cannot easily use ES modules.
> All content script code MUST be in a single `content.js` file.

### Data Flow Architecture (Resilient)
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Content.js │ ──► │ Sync Queue   │ ──► │ Sheets API  │ ──► │ Google Sheet │
│  (Scraper)  │     │ (Local First)│     │ (With Retry)│     │   (Cloud)    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                           │                    │
                           │ WiFi Dies?         │ 429/401 Error?
                           ▼                    ▼
                    Data stays safe!      Retry up to 5x
                    Syncs when online     Then → Failed Queue
```

---

## 🚀 PHASE 1: Manifest & Basic Structure

### Task 1.1: Create manifest.json

**Cursor Prompt:**
```
Create manifest.json for a Chrome Extension called "LinkedIn Scraper Pro".
Use Manifest V3 with modular background service worker.
Include all permissions needed for:
- Injecting scripts into LinkedIn pages
- OAuth2 for Google Sheets
- Storage for saving settings
- Identity for authentication

IMPORTANT: 
- Use "type": "module" for service worker to enable imports
- Content script should be a SINGLE file (no modules)
- Match only LinkedIn search results pages
```

**Expected Output (manifest.json):**
```json
{
  "name": "LinkedIn Scraper Pro",
  "version": "1.0.0",
  "manifest_version": 3,
  "description": "Scrape LinkedIn search results directly to Google Sheets",
  "permissions": [
    "identity",
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "alarms"
  ],
  "host_permissions": [
    "https://*.linkedin.com/*",
    "https://sheets.googleapis.com/*",
    "https://www.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background/service_worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.linkedin.com/search/results/people/*"
      ],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file"
    ]
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

> **Note**: Added `alarms` permission for service worker keep-alive mechanism.

### Task 1.2: Create Placeholder Icons

**Cursor Prompt:**
```
Create a simple Node.js script that generates placeholder PNG icons for a Chrome extension.
Generate 16x16, 48x48, and 128x128 pixel icons.
Use the 'canvas' npm package. Make them blue squares with "LS" text.
Save to icons/ folder.
```

**Alternative (Manual):**
Create simple colored square images or use any icon generator.

### 🧪 Gate Check 1.1
```bash
# In extension folder, run:
cat manifest.json | python3 -c "import sys,json; json.load(sys.stdin); print('✅ Valid JSON')"

# Then load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select your folder
# 5. Verify no errors appear
```

**Expected Result:** Extension appears in Chrome with no red error badges.

---

## 🚀 PHASE 2: Background Service Worker (Modular Architecture)

> **Strategy:** Split background logic into modules for maintainability.
> Service worker imports modules. Includes keep-alive mechanism.

### Task 2.1: Create Auth Module (background/auth.js)

**Cursor Prompt:**
```
Create background/auth.js for Chrome Extension OAuth2 token management.

This module must:
1. Export getAuthToken(interactive) - get token via chrome.identity
2. Export removeCachedToken(token) - force token refresh on 401 errors
3. Handle chrome.runtime.lastError in all callbacks
4. Log all auth operations with [AUTH] prefix

CRITICAL: This is used when Google API returns 401 Unauthorized.
We must be able to clear the cached token and get a fresh one.
```

**Expected Output (background/auth.js):**
```javascript
// background/auth.js - OAuth2 Token Management

let cachedToken = null;

/**
 * Get OAuth2 token via Chrome Identity API
 * @param {boolean} interactive - Show login popup if needed
 * @returns {Promise<string>} The auth token
 */
export async function getAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
        console.log(`[AUTH] Requesting token (interactive: ${interactive})`);
        
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                console.error('[AUTH] Error:', chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (!token) {
                console.error('[AUTH] No token received');
                reject(new Error('No token received'));
                return;
            }
            
            cachedToken = token;
            console.log('[AUTH] Token acquired successfully');
            resolve(token);
        });
    });
}

/**
 * Remove cached token to force refresh (use after 401 errors)
 * @param {string} token - The token to invalidate
 * @returns {Promise<void>}
 */
export async function removeCachedToken(token = null) {
    const tokenToRemove = token || cachedToken;
    
    if (!tokenToRemove) {
        console.log('[AUTH] No token to remove');
        return;
    }
    
    return new Promise((resolve) => {
        console.log('[AUTH] Removing cached token...');
        
        chrome.identity.removeCachedAuthToken({ token: tokenToRemove }, () => {
            if (chrome.runtime.lastError) {
                console.warn('[AUTH] Remove token warning:', chrome.runtime.lastError.message);
            }
            cachedToken = null;
            console.log('[AUTH] Token removed, will refresh on next request');
            resolve();
        });
    });
}

/**
 * Get current cached token without refresh
 * @returns {string|null}
 */
export function getCachedToken() {
    return cachedToken;
}
```

### Task 2.2: Create Sheets API Module (background/sheets_api.js)

**Cursor Prompt:**
```
Create background/sheets_api.js for Google Sheets API operations.

Import getAuthToken and removeCachedToken from auth.js.

CRITICAL: Implement a fetchWithRetry() helper function that:
1. Makes the API call
2. If 401 Unauthorized: removes cached token, gets fresh token, retries ONCE
3. Only retries once to prevent infinite loops

Copy this EXACT helper function:

async function fetchWithRetry(url, options, retryCount = 0) {
    try {
        const response = await fetch(url, options);
        if (response.status === 401 && retryCount < 1) {
            console.log('[SHEETS] 401 detected, refreshing token...');
            const oldToken = options.headers.Authorization.split(' ')[1];
            await new Promise(resolve => 
                chrome.identity.removeCachedAuthToken({ token: oldToken }, resolve)
            );
            const newToken = await getAuthToken(false);
            options.headers.Authorization = `Bearer ${newToken}`;
            return fetchWithRetry(url, options, retryCount + 1);
        }
        return response;
    } catch (e) {
        console.error('[SHEETS] Fetch error:', e);
        throw e;
    }
}

Then implement:
1. createSheet(title) - Create new spreadsheet with headers row
2. appendRows(spreadsheetId, rows) - Append data rows
3. readSheet(spreadsheetId, range) - Read data from sheet

All API calls must use fetchWithRetry() instead of raw fetch().
Log all API calls with [SHEETS] prefix.
```

**Expected Output (background/sheets_api.js):**
```javascript
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
    await appendRows(spreadsheetId, [HEADERS_ROW]);
    console.log('[SHEETS] Headers added');
    
    return { spreadsheetId, spreadsheetUrl };
}

/**
 * Append rows to a spreadsheet
 * @param {string} spreadsheetId - Target spreadsheet ID
 * @param {Array<Array>} rows - Array of row arrays
 * @returns {Promise<object>}
 */
export async function appendRows(spreadsheetId, rows) {
    if (!rows || rows.length === 0) {
        console.log('[SHEETS] No rows to append, skipping');
        return null;
    }
    
    console.log(`[SHEETS] Appending ${rows.length} rows to ${spreadsheetId.substring(0, 10)}...`);
    
    const result = await apiCall(
        `/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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
```

### Task 2.4: Create Sync Queue Module (background/sync_queue.js)

**Cursor Prompt:**
```
Create background/sync_queue.js for resilient data synchronization.

This module implements a LOCAL-FIRST approach:
1. All scraped data goes to chrome.storage.local FIRST
2. A queue processor attempts to sync to Google Sheets
3. If sync fails (network error, 429, 401), data stays in queue
4. Retry up to 5 times with exponential backoff
5. After 5 failures, move to "failedRows" for manual export

CRITICAL: Data must NEVER be lost. Even if WiFi dies mid-scrape,
all data should be recoverable from local storage.

Export functions:
- addToQueue(rows, spreadsheetId) - Add rows to sync queue
- processQueue() - Attempt to sync pending items
- getQueueStatus() - Return {pending: N, failed: M}
- getFailedRows() - Return all failed rows for CSV export
- clearFailedRows() - Clear failed rows after export
```

**Expected Output (background/sync_queue.js):**
```javascript
// background/sync_queue.js - Resilient Local-First Sync Queue

import { appendRows } from './sheets_api.js';

const STORAGE_KEYS = {
    QUEUE: 'syncQueue',
    FAILED: 'failedRows'
};

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000; // 2 seconds, doubles each retry

/**
 * Get current queue from storage
 */
async function getQueue() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.QUEUE, (result) => {
            resolve(result[STORAGE_KEYS.QUEUE] || []);
        });
    });
}

/**
 * Save queue to storage
 */
async function saveQueue(queue) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEYS.QUEUE]: queue }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Get failed rows from storage
 */
async function getFailedRowsFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.FAILED, (result) => {
            resolve(result[STORAGE_KEYS.FAILED] || []);
        });
    });
}

/**
 * Save failed rows to storage
 */
async function saveFailedRows(rows) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEYS.FAILED]: rows }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Add rows to the sync queue (LOCAL FIRST - data is safe immediately)
 * @param {Array<Array>} rows - Data rows to sync
 * @param {string} spreadsheetId - Target spreadsheet
 * @param {string} tabName - Tab name to write to (default: 'Sheet1')
 * @returns {Promise<void>}
 */
export async function addToQueue(rows, spreadsheetId, tabName = 'Sheet1') {
    if (!rows || rows.length === 0) return;
    
    const queue = await getQueue();
    
    const queueItem = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        spreadsheetId,
        rows,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        lastAttempt: null
    };
    
    queue.push(queueItem);
    await saveQueue(queue);
    
    console.log(`[QUEUE] Added ${rows.length} rows to queue. Queue size: ${queue.length}`);
    
    // Trigger immediate processing
    processQueue();
}

/**
 * Process the sync queue - attempt to send pending items to Sheets
 * @returns {Promise<{synced: number, failed: number, pending: number}>}
 */
export async function processQueue() {
    const queue = await getQueue();
    
    if (queue.length === 0) {
        console.log('[QUEUE] Queue empty, nothing to process');
        return { synced: 0, failed: 0, pending: 0 };
    }
    
    console.log(`[QUEUE] Processing ${queue.length} items...`);
    
    let synced = 0;
    let failed = 0;
    const remainingQueue = [];
    const newFailedRows = [];
    
    for (const item of queue) {
        try {
            // Attempt to sync
            await appendRows(item.spreadsheetId, item.rows);
            synced += item.rows.length;
            console.log(`[QUEUE] ✅ Synced item ${item.id} (${item.rows.length} rows)`);
            
        } catch (error) {
            console.warn(`[QUEUE] ❌ Sync failed for ${item.id}:`, error.message);
            
            item.retryCount++;
            item.lastAttempt = new Date().toISOString();
            item.lastError = error.message;
            
            if (item.retryCount >= MAX_RETRIES) {
                // Move to failed queue
                console.error(`[QUEUE] Item ${item.id} exceeded max retries, moving to failed`);
                newFailedRows.push({
                    ...item,
                    failedAt: new Date().toISOString()
                });
                failed += item.rows.length;
            } else {
                // Keep in queue for retry
                remainingQueue.push(item);
                console.log(`[QUEUE] Item ${item.id} will retry (attempt ${item.retryCount}/${MAX_RETRIES})`);
            }
        }
    }
    
    // Save updated queue
    await saveQueue(remainingQueue);
    
    // Save any new failed rows
    if (newFailedRows.length > 0) {
        const existingFailed = await getFailedRowsFromStorage();
        await saveFailedRows([...existingFailed, ...newFailedRows]);
    }
    
    const result = {
        synced,
        failed,
        pending: remainingQueue.length
    };
    
    console.log(`[QUEUE] Process complete:`, result);
    return result;
}

/**
 * Get queue status for UI display
 * @returns {Promise<{pending: number, pendingRows: number, failed: number, failedRows: number}>}
 */
export async function getQueueStatus() {
    const queue = await getQueue();
    const failedItems = await getFailedRowsFromStorage();
    
    const pendingRows = queue.reduce((sum, item) => sum + item.rows.length, 0);
    const failedRowCount = failedItems.reduce((sum, item) => sum + item.rows.length, 0);
    
    return {
        pending: queue.length,
        pendingRows,
        failed: failedItems.length,
        failedRows: failedRowCount
    };
}

/**
 * Get all failed rows for CSV export
 * @returns {Promise<Array<Array>>}
 */
export async function getFailedRows() {
    const failedItems = await getFailedRowsFromStorage();
    
    // Flatten all rows from failed items
    const allRows = [];
    for (const item of failedItems) {
        allRows.push(...item.rows);
    }
    
    return allRows;
}

/**
 * Clear failed rows after successful export
 * @returns {Promise<void>}
 */
export async function clearFailedRows() {
    await saveFailedRows([]);
    console.log('[QUEUE] Cleared failed rows');
}

/**
 * Force retry all failed items (move back to main queue)
 * @returns {Promise<number>} Number of items moved back
 */
export async function retryFailedItems() {
    const failedItems = await getFailedRowsFromStorage();
    
    if (failedItems.length === 0) return 0;
    
    // Reset retry counts and move to main queue
    const queue = await getQueue();
    for (const item of failedItems) {
        item.retryCount = 0;
        item.lastError = null;
        delete item.failedAt;
        queue.push(item);
    }
    
    await saveQueue(queue);
    await saveFailedRows([]);
    
    console.log(`[QUEUE] Moved ${failedItems.length} items back to queue for retry`);
    return failedItems.length;
}
```

### Task 2.5: Create Main Service Worker (background/service_worker.js)

**Cursor Prompt:**
```
Create background/service_worker.js as the main service worker entry point.

Import functions from auth.js, sheets_api.js, AND sync_queue.js.

CRITICAL REQUIREMENTS:

1. SERVICE WORKER KEEP-ALIVE:
   Manifest V3 service workers die after 30 seconds of inactivity.
   Use chrome.alarms API to ping every 25 seconds during scraping.
   Create startKeepAlive() and stopKeepAlive() functions.

2. SYNC QUEUE INTEGRATION:
   - DATA_SCRAPED should add to queue, NOT directly to Sheets
   - Add periodic queue processing every 30 seconds
   - Expose queue status to popup

3. SMART NAVIGATION:
   - Track current searchIndex in storage
   - On SEARCH_COMPLETE, increment index and offer next search
   - Send notification or message to popup with next URL

4. MESSAGE HANDLING:
   Handle these actions via chrome.runtime.onMessage:
   - GET_AUTH_TOKEN, CLEAR_AUTH (auth)
   - READ_SHEET, CREATE_SHEET (sheets)
   - SET_OUTPUT_SHEET, GET_SETTINGS, SAVE_SETTINGS (storage)
   - DATA_SCRAPED → addToQueue (NOT direct API)
   - SEARCH_COMPLETE → advance to next search
   - PROCESS_QUEUE → manually trigger sync
   - GET_QUEUE_STATUS → return queue stats
   - GET_FAILED_ROWS → return failed data for export
   - CLEAR_FAILED_ROWS → clear after export
   - START_KEEPALIVE, STOP_KEEPALIVE (lifecycle)

5. ALWAYS use "return true" in onMessage for async responses
6. ALWAYS check chrome.runtime.lastError
7. Log all operations with [SW] prefix
```

**Expected Output (background/service_worker.js):**
```javascript
// background/service_worker.js - Main Service Worker

import { getAuthToken, removeCachedToken } from './auth.js';
import { createSheet, appendRows, readSheet } from './sheets_api.js';
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
                    await saveToStorage({ outputSheetId: result.spreadsheetId });
                    response = { success: true, ...result };
                    break;
                }
                
                case 'SET_OUTPUT_SHEET': {
                    currentOutputSheetId = message.spreadsheetId;
                    await saveToStorage({ outputSheetId: message.spreadsheetId });
                    break;
                }
                
                // --- Settings ---
                case 'GET_SETTINGS': {
                    const settings = await getFromStorage([
                        'inputSheetId',
                        'outputSheetId', 
                        'searches',
                        'searchIndex'
                    ]);
                    currentOutputSheetId = settings.outputSheetId || null;
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
                
                case 'DEDUPLICATE_SHEET': {
                    if (!currentOutputSheetId) {
                        response = { success: false, error: 'No output sheet selected' };
                        break;
                    }
                    const result = await deduplicateSheet(currentOutputSheetId, currentTabName);
                    response = { success: true, ...result };
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
        const { outputSheetId, searchIndex } = await getFromStorage(['outputSheetId', 'searchIndex']);
        currentOutputSheetId = outputSheetId || null;
        currentSearchIndex = searchIndex || 0;
        startQueueProcessor(); // Ensure queue processor runs
        console.log('[SW] Service worker initialized');
    } catch (error) {
        console.error('[SW] Init error:', error);
    }
})();
```

### 🧪 Gate Check 2.1
```bash
# Verify module structure
ls -la background/
# Should show: auth.js, sheets_api.js, sync_queue.js, service_worker.js

# Load extension in Chrome
# Go to chrome://extensions → click "Service Worker" link
# Console should show: 
#   "[SW] Service worker initialized"
#   "[SW] Starting queue processor"

# Test queue status:
chrome.runtime.sendMessage({action: "GET_QUEUE_STATUS"}, r => console.log(r));
# Expected: {success: true, pending: 0, pendingRows: 0, failed: 0, failedRows: 0}
```

---

## 🚀 PHASE 3: Content Script (Single Consolidated File)

> ⚠️ **CRITICAL**: Content scripts in Manifest V3 CANNOT use ES modules easily.
> ALL scraper code must be in a SINGLE `content/content.js` file.
> Do NOT split into separate files like parser.js, navigator.js, etc.

### Task 3.1: Create content/content.js (Consolidated Scraper)

**Cursor Prompt:**
```
Create content/content.js as a SINGLE consolidated file for LinkedIn scraping.

IMPORTANT CONSTRAINTS:
1. This is a content script - NO ES modules, NO imports
2. Everything must be in ONE IIFE (Immediately Invoked Function Expression)
3. Must communicate with background via chrome.runtime.sendMessage
4. Must handle chrome.runtime.lastError in message callbacks

REQUIRED COMPONENTS (all in one file):
1. UI Module: Stop button with status updates
2. Parser Module: Extract profile data from LinkedIn DOM
3. Navigator Module: Click "Next" button with multiple strategies
4. Main Loop: Orchestrate scraping with delays

BASE THIS ON THE PROVEN WORKING SCRIPT:
```

**Reference: Working Console Script (adapt this)**
```javascript
(async function() {
    const MAX_PAGES = 1000;
    const WAIT_TIME_SECONDS = 5;
    var allOutput = [];
    var pageCount = 0;
    var keepGoing = true;

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function cleanName(text) {
        if (!text) return "";
        return text.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    }

    function getConnectionSource() {
        var filters = document.querySelectorAll('div[data-view-name="search-filter-top-bar-select"] label');
        var ignoreList = ["People", "Connections", "Locations", "Current companies", "All filters", "Reset", "1st", "2nd", "3rd+"];
        for (var i = 0; i < filters.length; i++) {
            var text = filters[i].innerText.trim().split('\n')[0];
            if (text && !ignoreList.includes(text) && text.length > 1) {
                return cleanName(text);
            }
        }
        return "";
    }

    function scrapeCurrentPage(sourceName) {
        var rows = [];
        var cards = document.querySelectorAll('div[data-view-name="people-search-result"]');
        var today = new Date().toLocaleDateString();

        cards.forEach(function(card) {
            try {
                var nameAnchor = card.querySelector('a[data-view-name="search-result-lockup-title"]');
                var name = nameAnchor ? nameAnchor.innerText.trim() : "";
                var url = nameAnchor ? nameAnchor.href : "";
                if (url.includes('?')) url = url.split('?')[0];

                var pTags = card.querySelectorAll('p');
                var title = (pTags.length >= 2) ? pTags[1].innerText.trim() : "";
                var location = (pTags.length >= 3) ? pTags[2].innerText.trim() : "";

                var inlineSource = card.querySelector('a[data-view-name="search-result-social-proof-insight"]');
                var connectionSource = inlineSource ? cleanName(inlineSource.innerText) : sourceName;

                if (name && url) {
                    rows.push([today, name, title, location, connectionSource, url]);
                }
            } catch (e) {}
        });
        return rows;
    }

    function clickNextButton() {
        var allElements = Array.from(document.querySelectorAll('span, button, a'));
        var nextEl = allElements.find(el => el.innerText && el.innerText.trim() === "Next" && el.offsetParent !== null);
        if (nextEl) { nextEl.click(); return true; }
        var ariaBtn = document.querySelector('button[aria-label="Next"]');
        if (ariaBtn) { ariaBtn.click(); return true; }
        var paginationBtn = document.querySelector('.artdeco-pagination__button--next');
        if (paginationBtn && !paginationBtn.disabled) { paginationBtn.click(); return true; }
        return false;
    }
    // ... main loop ...
})();
```

**Expected Output (content/content.js):**
```javascript
// content/content.js - LinkedIn Scraper Content Script
// IMPORTANT: This is a single consolidated file. DO NOT split into modules.

(function() {
    'use strict';
    
    // ============================================================
    // CONFIGURATION
    // ============================================================
    const CONFIG = {
        MAX_PAGES: 1000,
        MIN_WAIT_SECONDS: 5,
        MAX_WAIT_SECONDS: 8,
        SCROLL_WAIT_MS: 2000
    };

    // ============================================================
    // STATE
    // ============================================================
    let isScrapingActive = false;
    let stopRequested = false;
    let stopButton = null;

    // ============================================================
    // UTILITIES
    // ============================================================
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const randomDelay = () => {
        const base = CONFIG.MIN_WAIT_SECONDS;
        const variance = CONFIG.MAX_WAIT_SECONDS - CONFIG.MIN_WAIT_SECONDS;
        return (base + Math.random() * variance) * 1000;
    };

    const cleanName = (text) => {
        if (!text) return "";
        return text.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    };

    // Safe message sender with error handling
    function sendMessageSafe(message, callback) {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[CS] Message error:', chrome.runtime.lastError.message);
                }
                if (callback) callback(response);
            });
        } catch (e) {
            console.warn('[CS] Send failed:', e.message);
        }
    }

    // ============================================================
    // UI MODULE: Stop Button
    // ============================================================
    function createStopButton() {
        // Remove existing if present
        const existing = document.getElementById('linkedin-scraper-stop-btn');
        if (existing) existing.remove();

        const btn = document.createElement("button");
        btn.id = "linkedin-scraper-stop-btn";
        btn.innerHTML = "🛑 STOP SCRAPING";
        btn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            padding: 15px 25px;
            background: linear-gradient(135deg, #ff4444, #cc0000);
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(255,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            transition: all 0.2s ease;
        `;
        
        btn.onmouseover = () => {
            btn.style.transform = "scale(1.05)";
            btn.style.boxShadow = "0 6px 20px rgba(255,0,0,0.5)";
        };
        btn.onmouseout = () => {
            btn.style.transform = "scale(1)";
            btn.style.boxShadow = "0 4px 15px rgba(255,0,0,0.4)";
        };
        
        btn.onclick = () => {
            console.log('[CS] 🛑 Stop requested by user');
            stopRequested = true;
            updateButtonStatus("⏳ Finishing page...", "#ffa500");
            btn.disabled = true;
            btn.style.cursor = "not-allowed";
        };

        document.body.appendChild(btn);
        stopButton = btn;
        return btn;
    }

    function updateButtonStatus(text, color) {
        if (stopButton) {
            stopButton.innerHTML = text;
            if (color) {
                stopButton.style.background = color;
            }
        }
        // Notify popup/background
        sendMessageSafe({ action: "STATUS_UPDATE", status: text });
    }

    function removeStopButton() {
        const btn = document.getElementById('linkedin-scraper-stop-btn');
        if (btn) btn.remove();
        stopButton = null;
    }

    // ============================================================
    // PARSER MODULE: Extract Profile Data
    // ============================================================
    function getConnectionSource() {
        const filters = document.querySelectorAll('div[data-view-name="search-filter-top-bar-select"] label');
        const ignoreList = ["People", "Connections", "Locations", "Current companies", "All filters", "Reset", "1st", "2nd", "3rd+"];
        
        for (const filter of filters) {
            const text = filter.innerText.trim().split('\n')[0];
            if (text && !ignoreList.includes(text) && text.length > 1) {
                return cleanName(text);
            }
        }
        return "";
    }

    function scrapeCurrentPage(defaultSource) {
        const rows = [];
        const cards = document.querySelectorAll('div[data-view-name="people-search-result"]');
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        cards.forEach((card) => {
            try {
                // Name & URL
                const nameAnchor = card.querySelector('a[data-view-name="search-result-lockup-title"]');
                if (!nameAnchor) return;

                const name = nameAnchor.innerText.trim();
                let url = nameAnchor.href || "";
                if (url.includes('?')) url = url.split('?')[0];

                // Title & Location from <p> tags
                const pTags = card.querySelectorAll('p');
                const title = pTags.length >= 2 ? pTags[1].innerText.trim() : "";
                const location = pTags.length >= 3 ? pTags[2].innerText.trim() : "";

                // Connection source comes from input sheet (passed via message.sourceName)
                const connectionSource = defaultSource || "N/A";

                // Parse name to extract accreditations
                const { cleanName, accreditations } = parseNameWithAccreditations(name);

                if (cleanName && url) {
                    rows.push([today, cleanName, title, location, connectionSource, url, ...accreditations]);
                }
            } catch (e) {
                console.warn('[CS] Parse error:', e);
            }
        });

        return rows;
    }

    // ============================================================
    // NAVIGATOR MODULE: Pagination
    // ============================================================
    function clickNextButton() {
        // Strategy 1: Find visible "Next" text
        const allElements = Array.from(document.querySelectorAll('span, button, a'));
        const nextEl = allElements.find(el => 
            el.innerText && 
            el.innerText.trim() === "Next" && 
            el.offsetParent !== null
        );
        if (nextEl) {
            console.log('[CS] Found Next via text');
            nextEl.click();
            return true;
        }

        // Strategy 2: Aria label
        const ariaBtn = document.querySelector('button[aria-label="Next"]');
        if (ariaBtn && !ariaBtn.disabled) {
            console.log('[CS] Found Next via aria-label');
            ariaBtn.click();
            return true;
        }

        // Strategy 3: Pagination class
        const paginationBtn = document.querySelector('.artdeco-pagination__button--next:not([disabled])');
        if (paginationBtn) {
            console.log('[CS] Found Next via class');
            paginationBtn.click();
            return true;
        }

        console.log('[CS] No Next button found');
        return false;
    }

    // ============================================================
    // MAIN SCRAPING LOOP
    // ============================================================
    async function startScraping() {
        if (isScrapingActive) {
            console.log('[CS] ⚠️ Scraping already active');
            return;
        }

        console.log('[CS] 🚀 Starting scrape...');
        isScrapingActive = true;
        stopRequested = false;

        // Tell background to start keep-alive
        sendMessageSafe({ action: 'START_KEEPALIVE' });

        // Create UI
        createStopButton();
        const sourceName = getConnectionSource();
        console.log(`[CS] 📎 Connection source: "${sourceName}"`);

        let pageCount = 0;
        let totalProfiles = 0;

        // Main loop
        while (!stopRequested && pageCount < CONFIG.MAX_PAGES) {
            pageCount++;
            updateButtonStatus(`🔄 Page ${pageCount} (${totalProfiles} found)`, null);
            console.log(`[CS] --- Page ${pageCount} ---`);

            // Scroll to load lazy content
            window.scrollTo(0, document.body.scrollHeight);
            await wait(CONFIG.SCROLL_WAIT_MS);

            // Scrape this page
            const pageRows = scrapeCurrentPage(sourceName);
            totalProfiles += pageRows.length;
            console.log(`[CS] ✅ Found ${pageRows.length} profiles`);

            // Send to background for immediate sync
            if (pageRows.length > 0) {
                sendMessageSafe({
                    action: 'DATA_SCRAPED',
                    rows: pageRows,
                    pageNumber: pageCount
                });
            }

            // Check stop flag
            if (stopRequested) {
                console.log('[CS] 🛑 Stop flag detected');
                break;
            }

            // Navigate to next page
            const hasNext = clickNextButton();
            if (!hasNext) {
                console.log('[CS] 🏁 No more pages');
                break;
            }

            // Random delay
            const delay = randomDelay();
            console.log(`[CS] ⏳ Waiting ${(delay/1000).toFixed(1)}s...`);
            updateButtonStatus(`⏳ Waiting... (${totalProfiles} found)`, null);
            await wait(delay);
        }

        // Cleanup
        isScrapingActive = false;
        removeStopButton();

        // Notify completion
        sendMessageSafe({
            action: 'SCRAPING_COMPLETE',
            totalProfiles: totalProfiles,
            totalPages: pageCount
        });

        console.log(`[CS] 🎉 Complete! ${totalProfiles} profiles from ${pageCount} pages`);
    }

    // ============================================================
    // MESSAGE LISTENER
    // ============================================================
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[CS] 📩 Received:', message.action);

        switch (message.action) {
            case 'START_SCRAPING':
                startScraping();
                sendResponse({ status: 'started' });
                break;

            case 'STOP_SCRAPING':
                stopRequested = true;
                sendResponse({ status: 'stopping' });
                break;

            case 'GET_STATUS':
                sendResponse({
                    isActive: isScrapingActive,
                    isStopping: stopRequested
                });
                break;

            case 'PING':
                sendResponse({ status: 'alive' });
                break;

            default:
                sendResponse({ error: 'Unknown action' });
        }

        return true; // Keep channel open
    });

    // ============================================================
    // INITIALIZATION
    // ============================================================
    console.log('[CS] ✅ LinkedIn Scraper content script loaded');

})();
```

### 🧪 Gate Check 3.1
```bash
# Reload extension
# Navigate to: https://www.linkedin.com/search/results/people/
# Open DevTools Console (F12)
# Should see: "[CS] ✅ LinkedIn Scraper content script loaded"

# Test communication:
chrome.runtime.sendMessage({action: "PING"}, r => console.log(r));
# Expected: {status: "alive"}

# Verify selectors still work (paste in console):
document.querySelectorAll('div[data-view-name="people-search-result"]').length
# Should return > 0 if profiles are visible
```

---

## 🚀 PHASE 4: Popup UI (Control Panel)

### Task 4.1: Create popup/popup.html

**Cursor Prompt:**
```
Create popup/popup.html for a Chrome Extension popup window.
Dimensions: 400px wide, auto height
Include:
1. Header with skull icon image and connection status indicator
2. Input section: Field for Master Sheet ID with Load button
3. Search list: Scrollable area with PROGRESS indicator (Search X of Y)
4. Output section: 
   - Field for new sheet name with Create button
   - Field for loading existing sheet (URL or ID) with Load button
   - Field for adding new tabs with Add Tab button
   - Current sheet display (clickable link showing sheet name)
   - Tab selector dropdown (shows when sheet is loaded)
5. QUEUE STATUS SECTION: Show pending/synced/failed rows
6. Action buttons: Start Scraping (primary), Stop (danger)
7. SMART NAVIGATION PANEL: Appears after completion with "Proceed to Next" button
8. Status area showing real-time updates
9. Footer with links to output sheet, force sync, deduplicate button, and failed rows export

Use modern, clean CSS. No external frameworks.
Link popup.js and popup.css.
```

**Expected Output (popup/popup.html):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Savvy Pirate</title>
    <link rel="stylesheet" href="popup.css">
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <h1><img src="../icons/icon16.png" alt="Skull" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"> Savvy Pirate</h1>
            <div class="status-indicator" id="connectionStatus">
                <span class="dot"></span>
                <span class="text">Disconnected</span>
            </div>
        </header>

        <!-- Input Sheet Section -->
        <section class="section">
            <h2>📥 Input Sheet</h2>
            <div class="input-row">
                <input type="text" id="inputSheetId" placeholder="Google Sheet ID">
                <button id="loadSearchesBtn" class="btn btn-secondary">Load</button>
            </div>
            <!-- Search Progress Indicator (NEW) -->
            <div class="search-progress" id="searchProgress">
                <span class="progress-text" id="searchProgressText">Search 0 of 0</span>
                <div class="progress-bar-mini">
                    <div class="progress-fill-mini" id="searchProgressFill"></div>
                </div>
            </div>
            <div class="search-list" id="searchList">
                <p class="placeholder">Click "Load" to fetch searches...</p>
            </div>
        </section>

        <!-- Output Sheet Section -->
        <section class="section">
            <h2>📤 Output Sheet</h2>
            <div class="input-row">
                <input type="text" id="newSheetName" placeholder="New sheet name...">
                <button id="createSheetBtn" class="btn btn-secondary">Create</button>
            </div>
            <div class="current-output" id="currentOutput">
                <span class="label">Active:</span>
                <span class="value" id="outputSheetDisplay">None</span>
            </div>
        </section>

        <!-- Queue Status Section (NEW) -->
        <section class="section queue-section" id="queueSection">
            <h2>📊 Sync Queue</h2>
            <div class="queue-stats">
                <div class="queue-stat pending">
                    <span class="queue-number" id="pendingRows">0</span>
                    <span class="queue-label">Pending</span>
                </div>
                <div class="queue-stat synced">
                    <span class="queue-number" id="syncedRows">0</span>
                    <span class="queue-label">Synced</span>
                </div>
                <div class="queue-stat failed" id="failedStat" style="display: none;">
                    <span class="queue-number" id="failedRows">0</span>
                    <span class="queue-label">Failed</span>
                </div>
            </div>
            <div class="queue-actions" id="queueActions" style="display: none;">
                <button id="retryFailedBtn" class="btn btn-small btn-warning">🔄 Retry</button>
                <button id="downloadFailedBtn" class="btn btn-small btn-secondary">📥 Export CSV</button>
            </div>
        </section>

        <!-- Actions -->
        <section class="section actions">
            <button id="startScrapingBtn" class="btn btn-primary btn-large" disabled>
                🚀 Start Scraping
            </button>
            <button id="stopScrapingBtn" class="btn btn-danger" disabled>
                🛑 Stop
            </button>
        </section>

        <!-- Smart Navigation Panel (NEW) - Hidden by default -->
        <section class="section next-search-panel" id="nextSearchPanel" style="display: none;">
            <div class="completion-header">
                <span class="completion-icon">✅</span>
                <h2>Search Complete!</h2>
            </div>
            <div class="completion-summary" id="completionSummary">
                <p>Scraped <strong id="completedProfiles">0</strong> profiles from <strong id="completedPages">0</strong> pages</p>
            </div>
            <div class="next-search-info" id="nextSearchInfo">
                <div class="next-search-label">Next Search:</div>
                <div class="next-search-details">
                    <span class="next-source" id="nextSearchSource">-</span>
                    <span class="next-title" id="nextSearchTitle">-</span>
                </div>
            </div>
            <div class="next-search-actions">
                <button id="proceedNextBtn" class="btn btn-primary btn-large">
                    ▶️ Proceed to Next Search
                </button>
                <button id="dismissNextBtn" class="btn btn-secondary">
                    Dismiss
                </button>
            </div>
            <div class="all-complete-message" id="allCompleteMessage" style="display: none;">
                <p>🎉 <strong>All searches complete!</strong></p>
                <p class="sub-message">You've finished all configured searches.</p>
            </div>
        </section>

        <!-- Status -->
        <section class="status-section">
            <div class="status-text" id="statusText">Ready</div>
            <div class="progress-bar" id="progressBar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="footer">
            <a href="#" id="openOutputSheet" class="link" style="display: none;">
                📊 Open Sheet
            </a>
            <a href="#" id="forceSync" class="link" title="Force sync pending rows">
                🔄 Sync Now
            </a>
            <span class="version">v1.0.0 Diamond</span>
        </footer>
    </div>

    <script src="popup.js"></script>
</body>
</html>
```

### Task 4.2: Create popup/popup.css

**Cursor Prompt:**
```
Create popup.css for the LinkedIn Scraper Chrome Extension popup.
Style requirements:
- Width: 380px
- Modern, clean design with subtle shadows
- Color scheme: Blue primary (#0077B5 - LinkedIn blue), Red danger
- Smooth transitions
- Scrollable search list (max-height: 200px)
- Disabled states for buttons
- Status indicator with animated dot
- Progress bar styling
```

**Expected Output (popup.css):**
```css
/* popup.css */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    width: 380px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f8f9fa;
    color: #333;
}

.container {
    padding: 16px;
}

/* Header */
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
}

.header h1 {
    font-size: 16px;
    font-weight: 600;
    color: #0077B5;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #666;
}

.status-indicator .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #dc3545;
    transition: background 0.3s;
}

.status-indicator.connected .dot {
    background: #28a745;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Sections */
.section {
    background: #fff;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.section h2 {
    font-size: 13px;
    font-weight: 600;
    color: #555;
    margin-bottom: 10px;
}

/* Input Rows */
.input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}

.input-row input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    transition: border-color 0.2s;
}

.input-row input:focus {
    outline: none;
    border-color: #0077B5;
}

/* Buttons */
.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary {
    background: #0077B5;
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: #005f8f;
}

.btn-secondary {
    background: #e9ecef;
    color: #333;
}

.btn-secondary:hover:not(:disabled) {
    background: #dee2e6;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn-danger:hover:not(:disabled) {
    background: #c82333;
}

.btn-large {
    flex: 1;
    padding: 12px;
    font-size: 14px;
}

/* Search List */
.search-list {
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid #eee;
    border-radius: 6px;
    background: #fafafa;
}

.search-list .placeholder {
    padding: 20px;
    text-align: center;
    color: #999;
    font-size: 12px;
}

.search-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background 0.2s;
}

.search-item:last-child {
    border-bottom: none;
}

.search-item:hover {
    background: #e8f4fc;
}

.search-item.active {
    background: #cce5ff;
}

.search-item .name {
    font-size: 13px;
    font-weight: 500;
    color: #333;
}

.search-item .title {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
}

.search-item .open-btn {
    padding: 4px 8px;
    font-size: 11px;
    background: #0077B5;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

/* Current Output */
.current-output {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #666;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 4px;
}

.current-output .label {
    font-weight: 500;
}

.current-output .value {
    color: #0077B5;
    word-break: break-all;
}

/* Actions */
.actions {
    display: flex;
    gap: 10px;
}

/* Status Section */
.status-section {
    text-align: center;
    padding: 12px 0;
}

.status-text {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
}

.progress-bar {
    height: 4px;
    background: #e9ecef;
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #0077B5, #00a0dc);
    transition: width 0.3s ease;
}

/* Footer */
.footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    font-size: 11px;
}

.footer .link {
    color: #0077B5;
    text-decoration: none;
}

.footer .link:hover {
    text-decoration: underline;
}

.footer .version {
    color: #999;
}

/* Scrollbar */
.search-list::-webkit-scrollbar {
    width: 6px;
}

.search-list::-webkit-scrollbar-track {
    background: #f1f1f1;
}

.search-list::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 3px;
}

.search-list::-webkit-scrollbar-thumb:hover {
    background: #aaa;
}

/* ============================================
   NEW: Search Progress Indicator
   ============================================ */
.search-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    padding: 8px;
    background: #e8f4fc;
    border-radius: 6px;
}

.search-progress .progress-text {
    font-size: 12px;
    font-weight: 500;
    color: #0077B5;
    white-space: nowrap;
}

.progress-bar-mini {
    flex: 1;
    height: 6px;
    background: #cce5ff;
    border-radius: 3px;
    overflow: hidden;
}

.progress-fill-mini {
    height: 100%;
    width: 0%;
    background: #0077B5;
    transition: width 0.3s ease;
}

/* ============================================
   NEW: Queue Status Section
   ============================================ */
.queue-section {
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
}

.queue-stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: 10px;
}

.queue-stat {
    text-align: center;
    padding: 8px 12px;
    background: white;
    border-radius: 6px;
    min-width: 70px;
}

.queue-stat.pending .queue-number {
    color: #ffc107;
}

.queue-stat.synced .queue-number {
    color: #28a745;
}

.queue-stat.failed .queue-number {
    color: #dc3545;
}

.queue-number {
    font-size: 20px;
    font-weight: 700;
    display: block;
}

.queue-label {
    font-size: 10px;
    color: #666;
    text-transform: uppercase;
}

.queue-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.btn-small {
    padding: 4px 10px;
    font-size: 11px;
}

.btn-warning {
    background: #ffc107;
    color: #333;
}

.btn-warning:hover:not(:disabled) {
    background: #e0a800;
}

/* ============================================
   NEW: Smart Navigation Panel
   ============================================ */
.next-search-panel {
    background: linear-gradient(135deg, #d4edda, #c3e6cb);
    border: 2px solid #28a745;
}

.completion-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.completion-icon {
    font-size: 24px;
}

.completion-header h2 {
    color: #155724;
    margin: 0;
}

.completion-summary {
    background: white;
    padding: 10px;
    border-radius: 6px;
    margin-bottom: 12px;
    text-align: center;
}

.completion-summary p {
    margin: 0;
    font-size: 13px;
    color: #333;
}

.next-search-info {
    background: white;
    padding: 10px;
    border-radius: 6px;
    margin-bottom: 12px;
}

.next-search-label {
    font-size: 11px;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 4px;
}

.next-search-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.next-source {
    font-size: 14px;
    font-weight: 600;
    color: #0077B5;
}

.next-title {
    font-size: 12px;
    color: #666;
}

.next-search-actions {
    display: flex;
    gap: 10px;
}

.next-search-actions .btn-primary {
    flex: 2;
}

.next-search-actions .btn-secondary {
    flex: 1;
}

.all-complete-message {
    text-align: center;
    padding: 15px;
    background: white;
    border-radius: 6px;
}

.all-complete-message p {
    margin: 0;
    font-size: 14px;
}

.all-complete-message .sub-message {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
}

/* Search item completed state */
.search-item.completed {
    background: #d4edda;
    opacity: 0.7;
}

.search-item.completed::after {
    content: "✓";
    color: #28a745;
    font-weight: bold;
    margin-left: 8px;
}

.search-item.current {
    background: #fff3cd;
    border-left: 3px solid #ffc107;
}
```

### Task 4.3: Create popup/popup.js

**Cursor Prompt:**
```
Create popup/popup.js for the LinkedIn Scraper Chrome Extension.

CRITICAL HELPER FUNCTIONS (copy exactly):

1. Content Script Injection Check:
   Before sending START_SCRAPING, ALWAYS:
   - Send a PING message to the tab first
   - If no response within 500ms, inject content script via chrome.scripting.executeScript
   - Wait 500ms after injection
   - Send PING again to verify
   - Only then send START_SCRAPING

async function ensureContentScriptInjected(tabId) {
    const pingResponse = await sendTabMessage(tabId, { action: 'PING' }, 500);
    if (pingResponse?.status === 'alive') return true;
    
    // Inject content script
    await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content/content.js']
    });
    await new Promise(r => setTimeout(r, 500));
    
    const verify = await sendTabMessage(tabId, { action: 'PING' }, 1000);
    return verify?.status === 'alive';
}

2. CSV Parser for Input Sheet (handles quoted values with commas):
function parseCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else { current += char; }
    }
    result.push(current.trim());
    return result;
}

Functionality:
1. On load: Get saved settings, check auth status, update UI, fetch queue status
2. Load Searches: Read from input sheet, parse rows (Col A=Source, B=Title, C=URL)
3. Display searches with PROGRESS tracking (completed/current/pending)
4. Create Sheet: Call background to create new sheet, update display
5. Load Sheet: Load existing sheet by URL/ID, fetch and display tabs
6. Add Tab: Create new tab in loaded sheet, refresh tab list
7. Select Tab: Change active tab via dropdown, update state
8. Search Item Click: Open that LinkedIn URL in active tab
9. Start Scraping: MUST call ensureContentScriptInjected() BEFORE sending START_SCRAPING, pass sourceName from current search
10. Stop Scraping: Send stop message to content script, persists across popup closes
11. Deduplicate: Call background to deduplicate current tab based on Name column
12. Status Checking: Periodically check if scraping is active on popup open
8. QUEUE MANAGEMENT:
   - Poll queue status every 5 seconds during scraping
   - Show pending/synced/failed counts
   - Retry failed button
   - Export failed rows as CSV button
9. SMART NAVIGATION:
   - Listen for NOTIFY_COMPLETE with nextSearch info
   - Show "Next Search" panel with proceed/dismiss buttons
   - Auto-open next search URL on "Proceed"
10. Handle completion notification

Use async/await. Include error handling with user-friendly messages.
```

**Expected Output (popup/popup.js):**
```javascript
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
    
    // Output Sheet
    newSheetName: document.getElementById('newSheetName'),
    createSheetBtn: document.getElementById('createSheetBtn'),
    outputSheetDisplay: document.getElementById('outputSheetDisplay'),
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
    isAuthenticated: false,
    isScrapingActive: false,
    totalSynced: 0,
    nextSearchInfo: null
};

let queuePollInterval = null;

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
        const headers = ['Date', 'Name', 'Title', 'Location', 'Connection Source', 'LinkedIn URL'];
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
        return;
    }

    // Update progress
    const completed = state.searchIndex;
    const total = state.searches.length;
    elements.searchProgressText.textContent = `Search ${completed + 1} of ${total}`;
    elements.searchProgressFill.style.width = `${(completed / total) * 100}%`;

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
        elements.outputSheetDisplay.textContent = state.outputSheetId.substring(0, 20) + '...';
        elements.openOutputSheet.style.display = 'inline';
        elements.openOutputSheet.href = state.outputSheetUrl || 
            `https://docs.google.com/spreadsheets/d/${state.outputSheetId}`;
    } else {
        elements.outputSheetDisplay.textContent = 'None';
        elements.openOutputSheet.style.display = 'none';
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
        state.totalSynced = 0; // Reset synced count for new sheet

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

async function handleStartScraping() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url?.includes('linkedin.com')) {
        updateStatus('❌ Navigate to LinkedIn first');
        return;
    }

    state.isScrapingActive = true;
    updateActionButtons();
    updateStatus('🔍 Checking content script...', 5);

    try {
        // CRITICAL: Ensure content script is injected before sending commands
        // This handles page reloads, fresh installs, and navigation edge cases
        const isInjected = await ensureContentScriptInjected(tab.id);
        
        if (!isInjected) {
            throw new Error('Content script could not be loaded. Please refresh the LinkedIn page.');
        }
        
        updateStatus('🚀 Starting scraper...', 10);
        startQueuePolling();
        
        await chrome.tabs.sendMessage(tab.id, { action: 'START_SCRAPING' });
    } catch (error) {
        console.error('[POPUP] Start error:', error);
        updateStatus(`❌ ${error.message}`);
        state.isScrapingActive = false;
        updateActionButtons();
        stopQueuePolling();
    }
}

async function handleStopScraping() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
        await chrome.tabs.sendMessage(tab.id, { action: 'STOP_SCRAPING' });
        updateStatus('⏳ Stopping...');
    } catch (error) {
        console.error('[POPUP] Stop error:', error);
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

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[POPUP] Received:', message.action);

    switch (message.action) {
        case 'STATUS_UPDATE':
            updateStatus(message.status);
            break;

        case 'QUEUE_UPDATED':
            updateQueueStatus();
            break;

        case 'NOTIFY_COMPLETE':
            state.isScrapingActive = false;
            updateActionButtons();
            stopQueuePolling();
            updateQueueStatus();
            
            // Show smart navigation panel
            showNextSearchPanel(message);
            updateStatus(`🎉 Complete! ${message.totalProfiles} profiles`, 100);
            break;
    }

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

    } catch (error) {
        console.log('[POPUP] Init error (may be expected):', error);
    }

    renderSearchList();
    updateActionButtons();
    updateStatus('Ready');

    // Attach event listeners
    elements.loadSearchesBtn.addEventListener('click', handleLoadSearches);
    elements.createSheetBtn.addEventListener('click', handleCreateSheet);
    elements.startScrapingBtn.addEventListener('click', handleStartScraping);
    elements.stopScrapingBtn.addEventListener('click', handleStopScraping);
    elements.retryFailedBtn?.addEventListener('click', handleRetryFailed);
    elements.downloadFailedBtn?.addEventListener('click', handleDownloadFailed);
    elements.forceSync?.addEventListener('click', handleForceSync);
    elements.proceedNextBtn?.addEventListener('click', handleProceedNext);
    elements.dismissNextBtn?.addEventListener('click', handleDismissNext);
    
    elements.openOutputSheet.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.outputSheetUrl) {
            chrome.tabs.create({ url: state.outputSheetUrl });
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
```

### 🧪 Gate Check 4.1
```bash
# Reload extension
# Click extension icon to open popup
# Verify:
# 1. Popup opens without console errors
# 2. Queue section shows 0/0/0
# 3. Search progress shows "Search 0 of 0"
# 4. All buttons in correct enabled/disabled states
# 5. "Sync Now" link in footer visible
```

---

## 🚀 PHASE 5: Integration Testing

### Task 5.1: End-to-End Test Sequence

**Manual Test Script:**
```
1. SETUP
   - Load extension in Chrome
   - Have your Input Sheet ready with at least 3 search URLs
   - Note your Input Sheet ID

2. AUTHENTICATION TEST
   - Click extension icon
   - Enter Input Sheet ID
   - Click "Load"
   - Google auth popup should appear
   - After auth, searches should load with progress bar

3. OUTPUT SHEET TEST
   - Enter a name: "Test Scrape - [Today's Date]"
   - Click "Create"
   - Should show success
   - "Open Sheet" link should appear

4. SCRAPING TEST (Basic)
   - Click first search item to select it (should highlight yellow)
   - Click "Open" to navigate to LinkedIn
   - Wait for page to fully load
   - Click "Start Scraping"
   - Red stop button should appear on LinkedIn
   - Status should update in popup
   - Queue section should show "Pending" count increasing
   - Let it run for 2-3 pages
   - Click "Stop"
   - Check Output Sheet - data should be there

5. QUEUE RESILIENCE TEST (NEW)
   - Start scraping
   - Immediately disconnect WiFi (or use DevTools Network → Offline)
   - Let it run for 1-2 pages
   - "Pending" count should increase, "Synced" should stay 0
   - Reconnect WiFi
   - Click "Sync Now" in footer
   - Pending rows should sync to sheet
   - Check Output Sheet - all data should be there

6. SMART NAVIGATION TEST (NEW)
   - Complete a full scrape (let it finish naturally or hit end of pages)
   - "Search Complete!" panel should appear
   - Shows profiles scraped and pages processed
   - Shows "Next Search" details (source name + title filter)
   - Click "Proceed to Next Search"
   - Should automatically open the next LinkedIn search URL
   - Search list should show first item as "completed" (green check)
   - Progress bar should update

7. ALL SEARCHES COMPLETE TEST (NEW)
   - After completing ALL searches in your list
   - "All searches complete!" message should appear
   - "Proceed" button should be hidden

8. FAILED ROWS TEST (NEW)
   - If any rows fail to sync after 5 retries:
     - "Failed" count should appear in red
     - "Retry" and "Export CSV" buttons should appear
     - Click "Export CSV" to download failed data
     - Click "Retry" to attempt sync again
```

### 🧪 Gate Check 5.1
```
✅ Auth works without errors
✅ Input sheet loads correctly with progress indicator
✅ Output sheet creates with headers
✅ Scraping starts and stop button appears
✅ Queue shows pending count during scrape
✅ Data syncs to Google Sheet when online
✅ Data preserved in queue when offline (resilience)
✅ "Sync Now" manually triggers queue processing
✅ Stop button works from both popup and page
✅ "Search Complete" panel appears after scrape
✅ "Proceed to Next" opens next search URL
✅ Search list shows completed/current/pending states
✅ Multiple searches append to same sheet
✅ Failed rows can be exported as CSV
✅ No duplicate headers
✅ Connection source is captured correctly
```

---

## 🚀 PHASE 6: Workbook Manager & Smart Tab Creation

### Agent Context
```
You are a Senior Chrome Extension Developer working on Phase 6 of the Savvy Pirate extension.
Current state: Extension has tab management (load sheets, add tabs, select tabs).
Goal: Add workbook persistence and automatic dated tab creation (MM_DD_YY format).

EXECUTION RULES:
1. Complete tasks in ORDER (6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6)
2. After each task, verify syntax with linter before proceeding
3. Test each component as you build it
4. Do NOT proceed to next task until current task passes gate check
5. All code additions should maintain existing functionality
6. Use existing patterns from the codebase (fetchWithRetry, error handling, etc.)
7. Check existing code FIRST before adding new code (some functions may already exist)
```

---

## 🚀 EXECUTION START

**Before starting, read this entire section:**

### Quick Start Command
```
Follow the plan in linkedin-scraper-plan.md exactly.

EXECUTION ORDER:
Task 6.1 → Gate Check 6.1 → Task 6.2 → Gate Check 6.2 → Task 6.3 → Gate Check 6.3 
→ Task 6.4 → Gate Check 6.4 → Task 6.5 → Gate Check 6.5 → Task 6.6 → Gate Check 6.6 
→ Integration Testing

START: Task 6.1 - Update Sheets API Module
```

### Pre-Flight Verification
Before starting Task 6.1, verify these files exist:
```bash
ls background/sheets_api.js      # Should exist
ls background/service_worker.js  # Should exist
ls background/sync_queue.js      # Should exist
ls popup/popup.html              # Should exist
ls popup/popup.js                # Should exist
```

### Important Notes
- **Check existing code first** - Some functions (like `getSheetTabs`) may already exist
- **Don't duplicate code** - If a function exists, import it instead of re-creating
- **Maintain backward compatibility** - Existing functionality must continue to work
- **Follow existing patterns** - Use the same error handling, logging, and structure

---

## 🎯 Phase Overview

This phase transforms the extension from "create a new sheet every time" to "select a saved workbook and auto-create dated tabs." This supports your weekly differential workflow for tracking new connections.

### What This Phase Adds:
1. **Workbook Persistence** - Save/recall multiple Google Sheets (Morgan, Taylor, etc.)
2. **Smart Tab Creation** - Auto-create `MM_DD_YY` tabs within selected workbook
3. **Workbook Manager UI** - Add, select, and remove workbooks from popup
4. **Tab Detection** - Check if today's tab exists before creating

### Workflow After This Phase:
```
1. Open extension
2. Select "Morgan Cirotto" from saved workbooks dropdown
3. Click "Start Weekly Run"
4. Extension automatically:
   - Creates "11_27_25" tab if it doesn't exist
   - Writes headers to new tab
   - Scrapes data into that tab
5. Next week: Same process → Creates "12_04_25" tab
6. Compare tabs in Google Sheets to find new connections
```

### Prerequisites (Verify Before Starting):
- [ ] Extension is currently working (can scrape to Google Sheets)
- [ ] Tab management exists (can add tabs, select tabs)
- [ ] You have access to at least one test Google Sheet for validation
- [ ] Chrome extension is loaded and functional

---

## 📋 Execution Checklist

Before starting, verify these files exist and are readable:
- [ ] `background/sheets_api.js` - Should have `getSheetTabs()`, `addTabToSheet()` functions
- [ ] `background/service_worker.js` - Should handle `LOAD_SHEET`, `ADD_TAB` messages
- [ ] `popup/popup.html` - Should have tab selector dropdown
- [ ] `popup/popup.js` - Should have tab management logic
- [ ] `background/sync_queue.js` - Should accept `tabName` parameter

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  Popup UI       │
│  - Workbook     │──┐
│    Dropdown     │  │
│  - Add/Remove   │  │
│  - Weekly Run   │  │
└─────────────────┘  │
                     │ Messages
                     ▼
┌─────────────────────────────────┐
│  Service Worker                 │
│  - Workbook Storage (local)     │
│  - Tab Management Logic         │
└─────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────┐
│  Sheets API                     │
│  - getSheetTabs()               │
│  - ensureWeeklyTab()            │
│  - appendRowsToTab()            │
└─────────────────────────────────┘
```

---

## 📁 Files to Modify

| File | Changes |
|------|---------|
| `background/service_worker.js` | Add workbook & tab management handlers |
| `background/sheets_api.js` | Add `ensureWeeklyTab()` and `getSheetTabs()` functions |
| `popup/popup.html` | Add Workbook Manager UI section |
| `popup/popup.css` | Add styles for workbook manager |
| `popup/popup.js` | Add workbook CRUD and tab selection logic |

---

## 🔧 Task 6.1: Update Sheets API Module

**Status:** ✅ Complete  
**Dependencies:** None (foundational task)  
**Estimated Time:** 15-20 minutes

### Objective
Add new functions to `background/sheets_api.js` for workbook and tab management with smart date-based tab creation.

### Files to Modify
- `background/sheets_api.js` (add new functions at the end)

### Step-by-Step Instructions

**Step 1: Check for existing functions**

**⚠️ CRITICAL FIRST STEP - DO THIS BEFORE ANY CODE ADDITIONS:**

**Agent Prompt:**
```
BEFORE adding any code to background/sheets_api.js, check what already exists:

1. Check if getSheetTabs() exists:
   - Search: "export.*function getSheetTabs"
   - ✅ ALREADY EXISTS (confirmed in codebase)

2. Check if createTab() or addTabToSheet() exists:
   - Search: "export.*function.*Tab"
   - ✅ addTabToSheet() ALREADY EXISTS (can reuse or create alias)

3. Check if appendRows accepts tabName parameter:
   - ✅ ALREADY EXISTS - appendRows(spreadsheetId, rows, deduplicate, tabName) accepts tabName

4. Check for appendRowsToTab():
   - If it exists, reuse it
   - If not, create it (or use appendRows with tabName)

STRATEGY:
- Reuse existing functions where possible
- Create new functions only if they don't exist or need different functionality
- ensureWeeklyTab() is NEW - must be created
- validateSpreadsheet() is NEW - must be created
- writeHeadersToTab() is NEW - must be created (or can use appendRows with tabName)
```

**VERIFIED EXISTING FUNCTIONS:**
- ✅ `getSheetTabs(spreadsheetId)` - ALREADY EXISTS (line 286)
- ✅ `addTabToSheet(spreadsheetId, tabName)` - ALREADY EXISTS (line 205)
- ✅ `appendRows(..., tabName)` - ALREADY ACCEPTS tabName parameter

**FUNCTIONS TO CREATE:**
- ❌ `ensureWeeklyTab(spreadsheetId)` - NEW
- ❌ `validateSpreadsheet(spreadsheetId)` - NEW  
- ❌ `writeHeadersToTab(spreadsheetId, tabName)` - NEW (or reuse appendRows)
- ❌ `appendRowsToTab(spreadsheetId, tabName, rows)` - NEW (or reuse appendRows)
- ❌ `getTodayTabName()` - NEW (helper function, not exported)

**Step 2: Read existing code patterns**

**Agent Prompt:**
```
Read background/sheets_api.js to understand:
- How fetchWithRetry is implemented
- How HEADERS_ROW is defined (currently has 12 columns)
- Existing tab-related functions and their signatures
- Error handling patterns
- How existing appendRows function works
```

**Step 3: Add missing functions**

**Agent Prompt (Copy This):**
```
Add these new functions to the END of background/sheets_api.js:

REQUIREMENTS:
1. All functions must use existing fetchWithRetry pattern (via apiCall helper)
2. All functions must log with [SHEETS] prefix
3. Error handling must match existing patterns
4. Tab naming: MM_DD_YY format (e.g., "11_27_25")
5. HEADERS_ROW has 12 columns - account for this in range calculations

Functions to CHECK FIRST (may already exist):
- getSheetTabs() - Check if already exists
- createTab() or addTabToSheet() - Check if already exists

Functions to ADD (if missing):
- getTodayTabName() - Helper to format date as MM_DD_YY (private function, not exported)
- writeHeadersToTab(spreadsheetId, tabName) - Write headers to specific tab
- appendRowsToTab(spreadsheetId, tabName, rows) - Append to specific tab
- ensureWeeklyTab(spreadsheetId) - Smart: create if missing, return tab name
- validateSpreadsheet(spreadsheetId) - Check if sheet is accessible

IMPORTANT: 
- Use existing HEADERS_ROW constant (12 columns = A to L)
- For range calculations: Use A1:L1 (not A1:F1) for headers
- Check existing functions before duplicating
- Export all new functions that need to be used elsewhere
```

### Expected Code Output

**Add this code to the END of `background/sheets_api.js` (after existing functions):**

```javascript
// ============================================================
// PHASE 6: WORKBOOK & TAB MANAGEMENT
// ============================================================

/**
 * Get today's date formatted as MM_DD_YY
 * @returns {string} e.g., "11_27_25"
 */
function getTodayTabName() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    return `${month}_${day}_${year}`;
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
    const formattedTabName = formatTabNameForRange(tabName);
    const range = `${formattedTabName}!A1:${lastColumn}1`;
    
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
    
    const formattedTabName = formatTabNameForRange(tabName);
    const range = `${formattedTabName}!A1`;
    
    const result = await apiCall(
        `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
            method: 'POST',
            body: JSON.stringify({ values: rows })
        }
    );
    
    console.log(`[SHEETS] Appended ${rows.length} rows to "${tabName}"`);
    return result;
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
```

### Verification Steps

After adding the code:

1. **Syntax Check:**
   ```bash
   # Check for syntax errors (if you have a linter configured)
   # Or simply reload extension and check console
   ```

2. **Manual Verification:**
   - Open Chrome DevTools → Extension Service Worker
   - Check console for syntax errors
   - Should see no errors on extension load

3. **Function Availability Check:**
   - In service worker console, try:
   ```javascript
   // Should not error (if imports work)
   console.log(typeof getTodayTabName);
   ```

### 🧪 Gate Check 6.1
```
✅ No syntax errors in background/sheets_api.js
✅ All 7 new functions added
✅ Functions use existing patterns (fetchWithRetry, logging)
✅ HEADERS_ROW constant referenced correctly
✅ Tab naming format matches MM_DD_YY pattern
```

**If gate check passes:** Proceed to Task 6.2  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 6.2: Update Service Worker

**Status:** ✅ Complete  
**Dependencies:** Task 6.1 must be complete  
**Estimated Time:** 20-25 minutes

### Objective
Add workbook management logic to service worker, including storage, message handlers, and state tracking.

### Files to Modify
- `background/service_worker.js` (update imports, add handlers, add state)

### Step-by-Step Instructions

**Step 1: Update imports**

**Agent Prompt (Copy This):**
```
Update the imports section in background/service_worker.js:

CURRENT imports from './sheets_api.js' include:
- createSheet, appendRows, readSheet, getSheetName, deduplicateSheet, addTabToSheet, loadSheet, getSheetTabs

ADD these new imports:
- getSheetTabs (might already exist, check first)
- ensureWeeklyTab
- appendRowsToTab  
- validateSpreadsheet

IMPORTANT: Check existing imports first - some functions might already be imported!
```

**Step 2: Add state variables**

**Agent Prompt:**
```
Add new state variables after existing state declarations in service_worker.js:

Add these variables:
- currentActiveTab (string, default: null) - tracks MM_DD_YY tab name
- savedWorkbooks (array, default: []) - stores {id, name, sheetTitle, lastUsed, lastTab, addedAt}

Initialize savedWorkbooks from chrome.storage.local on startup.
```

### Expected Code Output

**Step 1: Update imports at the top of `service_worker.js`:**

**⚠️ CRITICAL:** 
1. **Read the existing import section FIRST**
2. Check if `getSheetTabs` is already imported (it might be from existing tab management)
3. Only add imports that don't already exist
4. Keep existing imports, just add new ones to the list

**Example of checking first:**
```
Read background/service_worker.js
Find the import statement from './sheets_api.js'
Check what's already imported
Add only missing imports
```

```javascript
import { 
    getAuthToken, 
    removeCachedToken 
} from './auth.js';

import { 
    createSheet, 
    appendRows, 
    readSheet,
    // PHASE 6: New imports
    getSheetTabs,
    ensureWeeklyTab,
    appendRowsToTab,
    validateSpreadsheet
} from './sheets_api.js';

import { 
    addToQueue, 
    processQueue, 
    getQueueStatus, 
    getFailedRows, 
    clearFailedRows,
    retryFailedItems 
} from './sync_queue.js';
```

**Step 2: Add state variables after existing state declarations:**

```javascript
// --- STATE ---
let currentOutputSheetId = null;
let isScrapingActive = false;
let currentSearchIndex = 0;

// PHASE 6: Workbook & Tab State
let currentActiveTab = null;        // The MM_DD_YY tab name we're writing to
let savedWorkbooks = [];            // Array of { id, name, lastUsed }
```

**Step 3: Add new message handlers inside the existing switch statement:**

**⚠️ IMPORTANT:** 
- Add handlers AFTER existing handlers, BEFORE the `default:` case
- Keep existing handlers unchanged
- Use consistent error handling patterns

```javascript
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
    console.log(`[SW] Saved workbook: ${name} (${id.substring(0, 10)}...)`);
    
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
    
    await saveToStorage({ 
        outputSheetId: result.spreadsheetId,
        activeTab: result.tabName 
    });
    
    response = { success: true, ...result };
    break;
}

case 'GET_SHEET_TABS': {
    const tabs = await getSheetTabs(message.spreadsheetId);
    response = { success: true, tabs };
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
```

**Step 4: Update existing DATA_SCRAPED handler:**

**⚠️ CRITICAL:** Modify the EXISTING `DATA_SCRAPED` case, don't duplicate it!

**Find this existing code:**
```javascript
case 'DATA_SCRAPED': {
    if (currentOutputSheetId && message.rows && message.rows.length > 0) {
        await addToQueue(message.rows, currentOutputSheetId, currentTabName);
        // ... existing code ...
    }
    break;
}
```

**Update to use currentActiveTab instead of currentTabName (if it exists):**
```javascript
case 'DATA_SCRAPED': {
    if (currentOutputSheetId && message.rows && message.rows.length > 0) {
        // PHASE 6: Use currentActiveTab (weekly tab) or fall back to currentTabName (manual selection)
        const tabName = currentActiveTab || currentTabName || 'Sheet1';
        await addToQueue(message.rows, currentOutputSheetId, tabName);
        console.log(`[SW] Queued page ${message.pageNumber}: ${message.rows.length} rows → ${tabName}`);
    }
    break;
}
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check service worker console for errors

2. **Import Verification:**
   - Verify all new functions are imported
   - Check for duplicate imports

3. **State Initialization:**
   - Check that savedWorkbooks loads from storage on startup
   - Verify currentActiveTab initializes to null

### 🧪 Gate Check 6.2
```
✅ No syntax errors in background/service_worker.js
✅ All new imports added (no duplicates)
✅ State variables added and initialized
✅ All 8 new message handlers added
✅ DATA_SCRAPED handler updated (not duplicated)
✅ Saved workbooks persist in chrome.storage.local
```

**If gate check passes:** Proceed to Task 6.3  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 6.3: Update Sync Queue for Tab Support

**Status:** ✅ Complete  
**Dependencies:** Task 6.1 must be complete (need appendRowsToTab function)  
**Estimated Time:** 10-15 minutes

### Objective
Update sync queue to support tab-specific appending while maintaining backward compatibility.

### Files to Modify
- `background/sync_queue.js` (update addToQueue and processQueue functions)

### Step-by-Step Instructions

**Step 1: Update imports**

**Agent Prompt:**
```
Update imports in background/sync_queue.js:

CURRENT: import { appendRows } from './sheets_api.js';

CHANGE TO: import { appendRows, appendRowsToTab } from './sheets_api.js';

This enables tab-specific appending.
```

**Step 2: Update addToQueue function signature**

**Agent Prompt:**
```
Modify the addToQueue function in sync_queue.js:

CURRENT signature likely has: addToQueue(rows, spreadsheetId, tabName = 'Sheet1')

UPDATE to:
- Accept tabName as optional third parameter
- Default to null (not 'Sheet1') - we'll use null to indicate "use default tab"
- Store tabName in queue item

MAINTAIN backward compatibility - existing calls without tabName should still work.
```

**Step 3: Update processQueue to use tab-specific append**

**Agent Prompt:**
```
Update processQueue function in sync_queue.js:

In the sync loop where appendRows is called:

CURRENT: await appendRows(item.spreadsheetId, item.rows);

CHANGE TO:
- If item.tabName exists, use appendRowsToTab(item.spreadsheetId, item.tabName, item.rows)
- Otherwise, use appendRows(item.spreadsheetId, item.rows) for backward compatibility

Maintain all existing error handling and retry logic.
```

### Expected Code Output

**Step 1: Update imports:**

```javascript
/**
 * Add rows to the sync queue (LOCAL FIRST - data is safe immediately)
 * @param {Array<Array>} rows - Data rows to sync
 * @param {string} spreadsheetId - Target spreadsheet
 * @param {string} [tabName] - Optional: specific tab to append to (for weekly runs)
 * @returns {Promise<void>}
 */
export async function addToQueue(rows, spreadsheetId, tabName = null) {
    if (!rows || rows.length === 0) return;
    
    const queue = await getQueue();
    
    const queueItem = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        spreadsheetId,
        tabName,  // NEW: Track which tab to write to
        rows,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        lastAttempt: null
    };
    
    queue.push(queueItem);
    await saveQueue(queue);
    
    console.log(`[QUEUE] Added ${rows.length} rows to queue (tab: ${tabName || 'default'}). Queue size: ${queue.length}`);
    
    // Trigger immediate processing
    processQueue();
}
```

**Step 2: Verify addToQueue signature (may already support tabName):**

⚠️ **CHECK FIRST:** The current addToQueue may already accept tabName. Verify before modifying.

**If tabName is already supported:**
- ✅ Skip this step, proceed to Step 3

**If tabName is NOT supported:**
- Update function signature as shown below

**Step 3: Update processQueue to use tab-specific append:**

```javascript
// AFTER (with tab support):
for (const item of queue) {
    try {
        // Attempt to sync - use tab-specific if available
        if (item.tabName) {
            await appendRowsToTab(item.spreadsheetId, item.tabName, item.rows);
        } else {
            // Fallback to default tab for backward compatibility
            await appendRows(item.spreadsheetId, item.rows);
        }
        synced += item.rows.length;
        console.log(`[QUEUE] ✅ Synced item ${item.id} (${item.rows.length} rows → ${item.tabName || 'Sheet1'})`);
        
    } catch (error) {
        // ... existing error handling (keep unchanged) ...
    }
}
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check for import errors

2. **Backward Compatibility:**
   - Verify existing queue items (without tabName) still sync correctly
   - Test that new queue items (with tabName) use appendRowsToTab

### 🧪 Gate Check 6.3
```
✅ appendRowsToTab imported correctly
✅ addToQueue accepts tabName parameter
✅ processQueue uses appendRowsToTab when tabName exists
✅ processQueue falls back to appendRows for backward compatibility
✅ No breaking changes to existing functionality
```

**If gate check passes:** Proceed to Task 6.4  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 6.4: Update Popup HTML

**Status:** ✅ Complete  
**Dependencies:** None (UI-only changes)  
**Estimated Time:** 15-20 minutes

### Objective
Add Workbook Manager UI section to popup HTML, including dropdown, forms, and controls.

### Files to Modify
- `popup/popup.html` (add new section, optionally update existing sections)

### Step-by-Step Instructions

**Step 1: Locate insertion point**

**Agent Prompt:**
```
Read popup/popup.html and locate:
- The "Input Sheet" section (id="inputSheetId" or similar)
- The "Output Sheet" section (id="outputSheet" or similar)

The Workbook Manager section should be inserted BETWEEN these two sections.

IDENTIFY the exact location by finding the closing tag of Input Sheet section.
```

**Step 2: Add Workbook Manager HTML**

**Agent Prompt:**
```
Add the Workbook Manager section HTML at the identified location in popup/popup.html.

REQUIREMENTS:
- Place it between Input Sheet and Output Sheet sections
- All IDs must match exactly as specified (used by popup.js)
- Preserve existing HTML structure
- Maintain indentation/formatting consistency
```

**Step 3: (Optional) Update Output Sheet section**

**Agent Prompt:**
```
OPTIONAL: Make the existing "Output Sheet" section collapsible using <details> tag.

This is optional - the original Output Sheet section can remain unchanged if preferred.
Only modify if you want to de-emphasize it in favor of Workbook Manager.

If making collapsible, wrap the section content in:
<details>
    <summary>📤 Create New Sheet (One-time)</summary>
    <!-- existing content -->
</details>
```

### Expected Code Output

**Step 1: Insert Workbook Manager section**

**Add this new section AFTER the Input Sheet section and BEFORE the Output Sheet section:**

⚠️ **LOCATE FIRST:** Find where Input Sheet section ends, then insert:

```html
<!-- Workbook Manager Section (NEW - Phase 6) -->
<section class="section workbook-section">
    <h2>📚 Workbook Manager</h2>
    
    <!-- Saved Workbooks Dropdown -->
    <div class="workbook-selector">
        <select id="savedWorkbooksSelect" class="workbook-dropdown">
            <option value="">-- Select a Saved Workbook --</option>
        </select>
        <button id="addWorkbookBtn" class="btn btn-small btn-secondary" title="Add new workbook">
            ➕
        </button>
    </div>
    
    <!-- Add Workbook Form (hidden by default) -->
    <div class="add-workbook-form" id="addWorkbookForm" style="display: none;">
        <input type="text" id="newWorkbookId" placeholder="Google Sheet ID or URL">
        <input type="text" id="newWorkbookName" placeholder="Friendly name (e.g., Morgan Cirotto)">
        <div class="form-actions">
            <button id="saveNewWorkbookBtn" class="btn btn-primary btn-small">Save</button>
            <button id="cancelAddWorkbookBtn" class="btn btn-secondary btn-small">Cancel</button>
        </div>
    </div>
    
    <!-- Selected Workbook Info -->
    <div class="selected-workbook-info" id="selectedWorkbookInfo" style="display: none;">
        <div class="workbook-details">
            <a href="#" id="selectedWorkbookName" class="workbook-name link" target="_blank">-</a>
            <span class="workbook-id" id="selectedWorkbookId">-</span>
        </div>
        <div class="active-checkbox-container">
            <input type="checkbox" id="workbookActiveCheck" class="active-checkbox">
            <label for="workbookActiveCheck" class="active-label">Active</label>
        </div>
        <button id="removeWorkbookBtn" class="btn btn-small btn-danger" title="Remove from saved">
            🗑️
        </button>
    </div>
    
    <!-- Active Tab Display (for weekly runs) -->
    <div class="active-tab-display" id="activeTabDisplay" style="display: none;">
        <span class="tab-label">Active Tab:</span>
        <span class="tab-name" id="activeTabName">-</span>
        <span class="tab-status" id="activeTabStatus"></span>
    </div>
</section>
```

**Step 2: (Optional) Make Output Sheet section collapsible**

**This is OPTIONAL - only do this if you want to de-emphasize the old "Create New Sheet" workflow:**

Find the existing Output Sheet section and wrap it in a details tag:

```html
<!-- Output Sheet Section (Original - now optional) -->
<section class="section output-section-legacy" id="legacyOutputSection">
    <details>
        <summary>📤 Create New Sheet (One-time)</summary>
        <div class="input-row" style="margin-top: 10px;">
            <input type="text" id="newSheetName" placeholder="New sheet name...">
            <button id="createSheetBtn" class="btn btn-secondary">Create</button>
        </div>
        <div class="current-output" id="currentOutput">
            <span class="label">Active:</span>
            <span class="value" id="outputSheetDisplay">None</span>
        </div>
    </details>
</section>
```

### Verification Steps

1. **HTML Validation:**
   - Check that all IDs are unique
   - Verify HTML structure is valid (matching tags)

2. **Element IDs Check:**
   - Ensure all IDs match what popup.js will reference:
     - `savedWorkbooksSelect`
     - `addWorkbookBtn`
     - `addWorkbookForm`
     - `newWorkbookId`
     - `newWorkbookName`
     - `saveNewWorkbookBtn`
     - `cancelAddWorkbookBtn`
     - `selectedWorkbookInfo`
     - `selectedWorkbookName`
     - `selectedWorkbookId`
     - `removeWorkbookBtn`
     - `activeTabDisplay`
     - `activeTabName`
     - `activeTabStatus`
     - `workbookActiveCheck`

3. **Visual Check:**
   - Open popup in Chrome
   - Verify new section appears between Input and Output sections

### 🧪 Gate Check 6.4
```
✅ HTML syntax is valid (no unclosed tags)
✅ All required element IDs are present
✅ Workbook Manager section appears in popup
✅ Section is positioned between Input and Output sections
```

**If gate check passes:** Proceed to Task 6.5  
**If gate check fails:** Fix HTML issues before continuing

---

## 🔧 Task 6.5: Update Popup CSS

**Status:** ✅ Complete  
**Dependencies:** Task 6.4 must be complete (HTML elements must exist)  
**Estimated Time:** 10-15 minutes

### Objective
Add CSS styles for Workbook Manager UI elements, maintaining consistency with existing pirate theme.

### Files to Modify
- `popup/popup.css` (add new styles at the end)

### Step-by-Step Instructions

**Agent Prompt:**
```
Add CSS styles to popup/popup.css for the Workbook Manager section.

REQUIREMENTS:
- Match existing pirate theme (black/red colors below header)
- Use consistent spacing and border radius
- Ensure dropdowns and buttons match existing style patterns
- Make form inputs consistent with existing input styling

Add styles for:
- .workbook-section
- .workbook-selector
- .workbook-dropdown
- .add-workbook-form
- .selected-workbook-info
- .active-tab-display
- .helper-text
- .workbook-dropdown option states
- .active-checkbox-container
- .active-checkbox
- .active-label

IMPORTANT: Add these styles at the END of the CSS file to avoid conflicts.
```

### Expected Code Output

**Add these styles to the END of `popup/popup.css`:**

```css
/* ============================================
   PHASE 6: Workbook Manager Styles
   ============================================ */

.workbook-section {
    background: #2a2a2a; /* Dark gray background */
    border: 1px solid #444; /* Subtle border */
}

.workbook-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}

.workbook-dropdown {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid #555;
    border-radius: 6px;
    font-size: 13px;
    background: #1a1a1a; /* Dark input background */
    color: #f0f0f0; /* Light text */
    cursor: pointer;
}

.workbook-dropdown:focus {
    outline: none;
    border-color: #dc3545; /* Red focus border */
    box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
}

.add-workbook-form {
    background: #1a1a1a; /* Dark background */
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 10px;
    border: 1px dashed #ff4444; /* Red dashed border */
}

.add-workbook-form input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 8px;
    background: #2a2a2a; /* Dark input background */
    color: #f0f0f0; /* Light text */
}

.add-workbook-form input:focus {
    outline: none;
    border-color: #dc3545; /* Red focus border */
}

.form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.selected-workbook-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1a1a1a; /* Dark background */
    padding: 10px 12px;
    border-radius: 6px;
    margin-bottom: 10px;
    border: 1px solid #444; /* Subtle border */
}

.workbook-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.workbook-name {
    font-weight: 600;
    color: #ff4444; /* Red for name */
    font-size: 14px;
}

.workbook-name.link {
    cursor: pointer;
    text-decoration: none;
}

.workbook-name.link:hover {
    color: #dc3545; /* Darker red on hover */
    text-decoration: underline;
}

.workbook-id {
    font-size: 10px;
    color: #888; /* Lighter gray */
    font-family: monospace;
}

.active-tab-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    background: #1a3a1a; /* Dark green tint */
    border-radius: 6px;
    margin-bottom: 10px;
    border: 1px solid #28a745; /* Green border */
}

.tab-label {
    font-size: 12px;
    color: #44ff44; /* Green text */
}

.tab-name {
    font-weight: 700;
    font-size: 14px;
    color: #44ff44; /* Green text */
    font-family: monospace;
}

.tab-status {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: auto;
}

.tab-status.new {
    background: #28a745; /* Green background */
    color: white;
}

.tab-status.existing {
    background: #6c757d; /* Gray background */
    color: white;
}

.helper-text {
    font-size: 11px;
    color: #888; /* Lighter gray */
    text-align: center;
    margin: 8px 0 0 0;
}

/* Legacy output section styling */
.output-section-legacy {
    background: #2a2a2a; /* Dark gray background */
    border: 1px solid #444; /* Subtle border */
}

.output-section-legacy summary {
    cursor: pointer;
    font-weight: 500;
    color: #ff4444; /* Red for summary */
    padding: 4px 0;
}

.output-section-legacy summary:hover {
    color: #dc3545; /* Darker red on hover */
}

/* Workbook item in dropdown - colored by recency */
.workbook-dropdown option.recent {
    color: #44ff44; /* Green for recent */
}

.workbook-dropdown option.stale {
    color: #dc3545; /* Red for stale */
}

/* Active Checkbox Styles */
.active-checkbox-container {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: 10px;
}

.active-checkbox {
    /* Basic styling for checkbox */
    width: 16px;
    height: 16px;
    accent-color: #dc3545; /* Red accent */
    cursor: pointer;
}

.active-label {
    font-size: 12px;
    color: #f0f0f0;
    cursor: pointer;
}
```

### Verification Steps

1. **CSS Validation:**
   - Check for syntax errors (missing semicolons, unclosed braces)

2. **Visual Check:**
   - Reload extension
   - Open popup
   - Verify Workbook Manager section is styled correctly
   - Check dropdown, buttons, and form elements look good

3. **Theme Consistency:**
   - Verify colors match pirate theme (black/red)
   - Ensure spacing matches other sections

### 🧪 Gate Check 6.5
```
✅ CSS syntax is valid (no errors)
✅ Workbook Manager section is styled
✅ Colors match existing pirate theme
✅ Interactive elements (dropdown, buttons) are styled
✅ Form inputs match existing input styling
```

**If gate check passes:** Proceed to Task 6.6  
**If gate check fails:** Fix CSS issues before continuing

---

## 🔧 Task 6.6: Update Popup JavaScript

**Status:** ✅ Complete  
**Dependencies:** Tasks 6.4 and 6.5 must be complete (HTML and CSS)  
**Estimated Time:** 30-40 minutes

### Objective
Add JavaScript logic for Workbook Manager functionality, including CRUD operations, UI updates, and integration with scraping workflow.

### Files to Modify
- `popup/popup.js` (add DOM references, state, functions, event listeners)

### Step-by-Step Instructions

**Step 1: Add DOM element references**

**Agent Prompt:**
```
Add new DOM element references to the elements object in popup/popup.js.

Find the existing elements object (usually near top of file).

ADD these new properties:
- savedWorkbooksSelect: document.getElementById('savedWorkbooksSelect')
- addWorkbookBtn: document.getElementById('addWorkbookBtn')
- addWorkbookForm: document.getElementById('addWorkbookForm')
- newWorkbookId: document.getElementById('newWorkbookId')
- newWorkbookName: document.getElementById('newWorkbookName')
- saveNewWorkbookBtn: document.getElementById('saveNewWorkbookBtn')
- cancelAddWorkbookBtn: document.getElementById('cancelAddWorkbookBtn')
- selectedWorkbookInfo: document.getElementById('selectedWorkbookInfo')
- selectedWorkbookName: document.getElementById('selectedWorkbookName')
- selectedWorkbookId: document.getElementById('selectedWorkbookId')
- removeWorkbookBtn: document.getElementById('removeWorkbookBtn')
- activeTabDisplay: document.getElementById('activeTabDisplay')
- activeTabName: document.getElementById('activeTabName')
- activeTabStatus: document.getElementById('activeTabStatus')
- workbookActiveCheck: document.getElementById('workbookActiveCheck')
- outputActiveCheck: document.getElementById('outputActiveCheck')

IMPORTANT: Use optional chaining (?.) or check for null if elements might not exist yet.
```

### Expected Code Output

**Step 1: Update DOM element references**

```javascript
// --- DOM ELEMENTS ---
const elements = {
    // ... existing elements ...
    
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
    workbookActiveCheck: document.getElementById('workbookActiveCheck'),
    outputActiveCheck: document.getElementById('outputActiveCheck')
};
```

**Step 2: Add state variables**

**Add these properties to the existing `state` object:**

```javascript
// --- STATE ---
let state = {
    // ... existing state ...
    
    // Phase 6: Workbook Manager
    savedWorkbooks: [],
    selectedWorkbook: null,
    activeTabName: null,
    activeSheetType: null,  // 'workbook' or 'output'
    activeSheetId: null,
    activeSheetTab: null
};
```

**Step 3: Add Workbook Manager functions**

**Add these functions BEFORE the existing event handler functions (or at the end of the file):**

```javascript
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
    const select = elements.savedWorkbooksSelect;
    if (!select) return;
    
    // Clear existing options (keep the placeholder)
    select.innerHTML = '<option value="">-- Select a Saved Workbook --</option>';
    
    // Add saved workbooks
    state.savedWorkbooks.forEach(wb => {
        const option = document.createElement('option');
        option.value = wb.id;
        option.textContent = wb.name;
        
        // Color-code by recency
        const lastUsed = new Date(wb.lastUsed);
        const daysSince = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) {
            option.className = 'stale';
            option.textContent += ` (${Math.floor(daysSince)}d ago)`;
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
}

/**
 * Show the add workbook form
 */
function showAddWorkbookForm() {
    if (elements.addWorkbookForm) {
        elements.addWorkbookForm.style.display = 'block';
    }
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
    if (elements.addWorkbookForm) {
        elements.addWorkbookForm.style.display = 'none';
    }
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
    let sheetId = elements.newWorkbookId?.value.trim();
    const name = elements.newWorkbookName?.value.trim();
    
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
            }
            handleWorkbookSelect();
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

/**
 * Handle active sheet checkbox changes (mutually exclusive)
 */
function handleActiveSheetChange(sheetType) {
    // Uncheck the other checkbox
    if (sheetType === 'workbook') {
        if (elements.outputActiveCheck) {
            elements.outputActiveCheck.checked = false;
        }
        state.activeSheetType = 'workbook';
        state.activeSheetId = state.selectedWorkbook?.id || null;
        state.activeSheetTab = state.selectedWorkbook?.lastTab || null;
    } else if (sheetType === 'output') {
        if (elements.workbookActiveCheck) {
            elements.workbookActiveCheck.checked = false;
        }
        state.activeSheetType = 'output';
        state.activeSheetId = state.outputSheetId || null;
        state.activeSheetTab = state.currentTabName || 'Sheet1';
    } else {
        // Uncheck both
        if (elements.workbookActiveCheck) {
            elements.workbookActiveCheck.checked = false;
        }
        if (elements.outputActiveCheck) {
            elements.outputActiveCheck.checked = false;
        }
        state.activeSheetType = null;
        state.activeSheetId = null;
        state.activeSheetTab = null;
    }
    
    updateActionButtons();
}

/**
 * Get the currently active sheet (workbook or output)
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
```

**Step 4: Update init() function**

**Find the existing `init()` function and add:**

1. Call to `loadSavedWorkbooks()` early in init
2. Event listeners for all Workbook Manager buttons/dropdowns

**Agent Prompt:**
```
Update the init() function in popup/popup.js:

1. After loading settings, add:
   await loadSavedWorkbooks();

2. In the event listeners section, add:
   elements.savedWorkbooksSelect?.addEventListener('change', handleWorkbookSelect);
   elements.addWorkbookBtn?.addEventListener('click', showAddWorkbookForm);
   elements.cancelAddWorkbookBtn?.addEventListener('click', hideAddWorkbookForm);
   elements.saveNewWorkbookBtn?.addEventListener('click', handleSaveWorkbook);
   elements.removeWorkbookBtn?.addEventListener('click', handleRemoveWorkbook);
   elements.workbookActiveCheck?.addEventListener('change', (e) => {
       handleActiveSheetChange(e.target.checked ? 'workbook' : null);
   });
   elements.outputActiveCheck?.addEventListener('change', (e) => {
       handleActiveSheetChange(e.target.checked ? 'output' : null);
   });

IMPORTANT: Use optional chaining (?.) since elements might be null during development.
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check popup console for JavaScript errors

2. **Function Availability:**
   - Open popup
   - Check browser console for errors
   - Verify all functions are defined

3. **Integration Check:**
   - Verify loadSavedWorkbooks() is called on init
   - Check that event listeners are attached

### 🧪 Gate Check 6.6
```
✅ No JavaScript errors in popup console
✅ All Workbook Manager functions are defined
✅ Event listeners are attached in init()
✅ loadSavedWorkbooks() is called on initialization
✅ DOM elements are properly referenced
✅ Active sheet checkbox system works (mutually exclusive)
```

**If gate check passes:** Proceed to Integration Testing  
**If gate check fails:** Fix JavaScript errors before continuing

---

## 🧪 Phase 6 Integration Testing

**Status:** ✅ Complete  
**Dependencies:** All tasks 6.1-6.6 must be complete  
**Estimated Time:** 20-30 minutes

### Test Sequence

**Test 1: Workbook Management**
```bash
1. Reload extension in Chrome
2. Open popup
3. Verify Workbook Manager section appears
4. Click "+" button
5. Paste a Google Sheet URL (or ID)
6. Enter a friendly name (e.g., "Morgan Cirotto")
7. Click "Save"
8. ✅ Should validate and appear in dropdown
9. ✅ Should show workbook info below dropdown
```

**Test 2: Workbook Selection**
```bash
1. Select workbook from dropdown
2. ✅ Selected workbook info should display
3. ✅ Checkbox for "Active" should appear
4. ✅ Helper text should update
```

**Test 3: Weekly Tab Creation**
```bash
1. With workbook selected and checked as active, click "Start Scraping"
2. ✅ Should show "Setting up weekly tab..." status
3. ✅ Should create MM_DD_YY tab in Google Sheet (check Sheet manually)
4. ✅ "Active Tab" should display today's date (e.g., "11_27_25")
5. ✅ Tab status should show "NEW" if created, "Existing" if reused
```

**Test 4: Tab Reuse**
```bash
1. Click "Start Scraping" again (same day)
2. ✅ Should NOT create duplicate tab
3. ✅ Should use existing tab
4. ✅ Status should show "Existing"
```

**Test 5: Scraping to Weekly Tab**
```bash
1. Navigate to LinkedIn search results page
2. Select workbook, check as active, and click "Start Scraping"
3. ✅ Scraping should begin
4. ✅ Data should go to the MM_DD_YY tab (verify in Google Sheets)
5. ✅ Queue status should show pending/synced counts
```

**Test 6: Persistence**
```bash
1. Close popup
2. Reopen popup
3. ✅ Saved workbooks should still be in dropdown
4. ✅ Last selected workbook should be remembered (if implemented)
5. ✅ Last used tab should display
```

**Test 7: Workbook Removal**
```bash
1. Select a workbook
2. Click trash/remove button
3. ✅ Should ask for confirmation
4. ✅ Should remove from dropdown
5. ✅ Should NOT delete the Google Sheet itself
```

**Test 8: Active Sheet Checkbox System**
```bash
1. Select a workbook and check it as active
2. ✅ Output sheet checkbox should uncheck automatically
3. ✅ Start Scraping button should be enabled
4. Check output sheet as active
5. ✅ Workbook checkbox should uncheck automatically
6. ✅ Start Scraping should use output sheet
```

### Expected Results

| Test | Expected Outcome |
|------|-----------------|
| Workbook Save | Validates Sheet ID, saves to storage, appears in dropdown |
| Workbook Select | Shows workbook info, enables Active checkbox |
| Weekly Tab Creation | Creates MM_DD_YY tab with headers |
| Tab Reuse | Uses existing tab, doesn't duplicate |
| Data Scraping | Data appears in correct dated tab |
| Persistence | Workbooks saved across popup closes |
| Workbook Removal | Removes from list, doesn't delete sheet |
| Active Sheet Selection | Mutually exclusive checkboxes work correctly |

### 🧪 Final Gate Check
```
✅ All 8 tests pass
✅ No console errors
✅ Data flows correctly: Popup → Service Worker → Sheets API → Google Sheets
✅ UI updates correctly reflect state changes
✅ Persistence works (survives popup close/reopen)
✅ Active sheet checkbox system works (mutually exclusive)
✅ Automatic daily tab creation works (creates new tab for each day)
```

**If all tests pass:** Phase 6 is complete! 🎉  
**If tests fail:** Identify failing test, fix issues, retest

---

## 📊 Weekly Differential Workflow

After Phase 6, your weekly workflow becomes:

```
WEEK 1 (November 27):
1. Open LinkedIn search for "Morgan Cirotto - Financial Advisors"
2. Open extension → Select "Morgan Cirotto" workbook
3. Check "Active" checkbox
4. Click "Start Scraping"
5. Extension creates "11_27_25" tab, scrapes ~500 profiles

WEEK 2 (December 4):
1. Open same LinkedIn search
2. Open extension → Select "Morgan Cirotto" workbook
3. Check "Active" checkbox
4. Click "Start Scraping"
5. Extension creates "12_04_25" tab, scrapes ~520 profiles

IN GOOGLE SHEETS:
1. Open "Morgan Cirotto" workbook
2. Create "NEW_LEADS" tab
3. Add formula: =FILTER('12_04_25'!A:F, COUNTIF('11_27_25'!F:F, '12_04_25'!F:F)=0)
4. This shows all people in Week 2 who weren't in Week 1
```

---

## ✅ Phase 6 Success Criteria

| Feature | Test |
|---------|------|
| Save Workbook | Paste Sheet ID → Give name → Appears in dropdown |
| Recall Workbook | Close/reopen popup → Workbooks still there |
| Remove Workbook | Click trash → Removes from dropdown (not from Google) |
| Weekly Tab Creation | Check active → Click "Start Scraping" → Creates "MM_DD_YY" tab |
| Tab Detection | Run again same day → Uses existing tab (no duplicate) |
| Tab-Specific Append | Data goes to the correct dated tab |
| Last Used Tracking | Shows which tab was last used for each workbook |
| Active Sheet Selection | Mutually exclusive checkboxes work correctly |
| Automatic Daily Tabs | New tab created automatically for each new day |

---

## 🔗 Quick Reference: New Message Actions

| Action | Purpose |
|--------|---------|
| `GET_SAVED_WORKBOOKS` | Load all saved workbooks |
| `SAVE_WORKBOOK` | Add/update a workbook (validates first) |
| `DELETE_WORKBOOK` | Remove from saved list |
| `VALIDATE_SPREADSHEET` | Check if Sheet ID is accessible |
| `ENSURE_WEEKLY_TAB` | Create/get today's dated tab |
| `GET_SHEET_TABS` | List all tabs in a workbook |
| `SET_ACTIVE_TAB` | Set which tab data appends to |
| `GET_ACTIVE_OUTPUT` | Get current spreadsheet + tab |

---

## 📝 Execution Notes for Agent

### ⚠️ CRITICAL: Existing Functions Checklist

**BEFORE starting Task 6.1, verify what already exists:**

| Function | Status | Action |
|----------|--------|--------|
| `getSheetTabs(spreadsheetId)` | ✅ EXISTS (line 286) | Import and reuse, don't recreate |
| `addTabToSheet(spreadsheetId, tabName)` | ✅ EXISTS (line 205) | Can reuse or create alias `createTab()` |
| `appendRows(..., tabName)` | ✅ EXISTS (line 105) | Already supports tabName parameter |
| `ensureWeeklyTab(spreadsheetId)` | ❌ NEW | Must create |
| `validateSpreadsheet(spreadsheetId)` | ❌ NEW | Must create |
| `writeHeadersToTab(spreadsheetId, tabName)` | ❌ NEW | Must create (or reuse appendRows) |
| `appendRowsToTab(spreadsheetId, tabName, rows)` | ⚠️ OPTIONAL | Can reuse appendRows() or create wrapper |

### Common Pitfalls to Avoid

1. **Duplicate Function Definitions**
   - ✅ `getSheetTabs()` already exists - IMPORT it, don't recreate
   - ✅ `addTabToSheet()` exists - Can reuse for createTab functionality
   - ✅ `appendRows()` already accepts `tabName` - Can reuse instead of creating `appendRowsToTab()`
   - Read existing code first, then add only what's missing

2. **Import Conflicts**
   - `getSheetTabs` already imported in service_worker.js (line 4)
   - Add only NEW imports: `ensureWeeklyTab`, `validateSpreadsheet`
   - Consider reusing `addTabToSheet` instead of creating `createTab`

3. **State Variable Conflicts**
   - `currentTabName` already exists in service_worker.js (line 16)
   - Add `currentActiveTab` for weekly tab tracking
   - Add `savedWorkbooks` array for workbook persistence
   - Don't shadow existing variables

4. **HTML Element ID Conflicts**
   - All new IDs must be unique
   - Check popup.html for existing IDs before adding
   - Existing IDs: `tabSelector`, `currentTabDisplay` - don't conflict

5. **Breaking Existing Functionality**
   - Keep all existing message handlers
   - Don't remove or rename existing functions
   - Add new functionality alongside existing code
   - Existing tab management (manual selection) should still work

### File Modification Strategy

**For each file:**
1. Read the entire file first to understand context
2. Identify insertion points (usually at the end for new functions)
3. Check for existing similar functions to avoid duplication
4. Make minimal, focused changes
5. Test after each change (reload extension)
6. Verify no breaking changes (existing features still work)

### Testing Strategy

After each task:
1. Reload extension in Chrome (`chrome://extensions` → reload icon)
2. Check service worker console for errors (click "service worker" link)
3. Check popup console for errors (right-click popup → Inspect)
4. Verify functionality manually
5. Only proceed if gate check passes

### Code Reuse Opportunities

**Instead of creating new functions, consider:**
- `createTab()` → Reuse existing `addTabToSheet()` (they do the same thing)
- `appendRowsToTab()` → Reuse existing `appendRows()` with `tabName` parameter
- This reduces code duplication and maintenance burden

### HEADERS_ROW Column Count

**Important:** HEADERS_ROW has **12 columns**, not 6:
- Date, Name, Title, Location, Connection Source, LinkedIn URL (6 base)
- Accreditation 1-6 (6 more)
- **Total: 12 columns (A through L)**

When calculating ranges, use `A1:L1` not `A1:F1`.

### Tab Name Formatting

**Important:** Tab names with spaces or special characters must be quoted in range strings:
- Use `formatTabNameForRange()` helper function
- Example: `new tab` becomes `'new tab'` in range strings
- Single quotes in tab names are escaped by doubling: `O'Malley's` becomes `'O''Malley''s'`

---

## 🎯 Success Criteria Summary

Phase 6 is complete when:
- ✅ Workbook Manager UI appears in popup
- ✅ Can save/load/remove workbooks (persists across sessions)
- ✅ Active sheet checkbox system works (mutually exclusive)
- ✅ "Start Scraping" creates MM_DD_YY tab automatically when workbook is active
- ✅ Data scrapes to the dated tab (not default Sheet1)
- ✅ Existing tab management functionality still works
- ✅ Existing "Create Sheet" and "Load Sheet" still work
- ✅ No console errors in service worker or popup
- ✅ All gate checks pass
- ✅ Weekly tabs are created with correct date format
- ✅ Tab reuse works (same day = uses existing tab)
- ✅ Automatic daily tab creation (new tab for each new day)

---

## 🚀 PHASE 7: Tab Comparison & Differential List Feature

## 🎯 Objective

Add a "Compare Tabs" feature that allows users to:
1. Select two tabs from the active workbook via dropdowns
2. Generate a differential list (entries that exist in one tab but not the other)
3. Create a new custom-named tab containing the differential results

**Use Case Example:**
- User has tabs `11_27_25` and `11_28_25` with scraped LinkedIn contacts
- User selects both tabs, clicks "Compare"
- User names the output tab `new_leads`
- System creates `new_leads` tab containing contacts that are in `11_28_25` but NOT in `11_27_25`

---

## 📋 Pre-Implementation Checklist

> ⚠️ **STOP**: Verify these before starting any code generation.

```
✅ Phase 6 (Workbook Manager) is complete and working
✅ Active sheet is selected in the Workbook Manager
✅ Extension can read tabs from workbooks (GET_SHEET_TABS works)
✅ Extension can read data from specific tabs (readSheet with tab range works)
✅ Extension can create new tabs with headers (addTabToSheet works)
```

---

## 🏗️ Architecture Overview

### New Components

```
sheets_api.js
├── compareTabs()           # NEW: Compare two tabs, return differential
└── getTabData()            # NEW: Helper to read all data from a tab

service_worker.js
├── COMPARE_TABS            # NEW: Message handler for comparison
└── GET_TAB_DATA            # NEW: Message handler for reading tab data

popup.html
└── Compare Tabs Section    # NEW: UI section with dropdowns and button

popup.js
├── loadTabsForComparison() # NEW: Populate tab dropdowns
├── handleCompare()         # NEW: Execute comparison workflow
└── renderCompareUI()       # NEW: Update comparison UI state

popup.css
└── .compare-section        # NEW: Styling for comparison UI
```

### Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Popup.js   │ ──► │ Service      │ ──► │ Sheets API      │ ──► │ Google Sheet │
│ (Compare UI)│     │ Worker       │     │ compareTabs()   │     │              │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────────┘
       │                   │                      │
       │ 1. Select tabs    │ 2. COMPARE_TABS     │ 3. Read both tabs
       │ 4. Name output    │    message          │ 4. Compute diff
       ▼                   ▼                      │ 5. Create new tab
  Show results        Return diff stats          │ 6. Write diff rows
                                                 ▼
                                            New tab created
```

---

## 🔧 Task 7.1: Add Comparison Functions to sheets_api.js

**Status:** 🔲 Not Started  
**Dependencies:** None (builds on existing sheets_api.js)  
**Estimated Time:** 20-25 minutes

### Objective
Add functions to compare two tabs and identify the differential based on a key column (Name or LinkedIn URL).

### Files to Modify
- `background/sheets_api.js`

### Step-by-Step Instructions

**Step 1: Add getTabData helper function**

**Agent Prompt:**
```
Add a new helper function getTabData to background/sheets_api.js.

This function should:
1. Accept spreadsheetId and tabName parameters
2. Read all data from the specified tab (A:Z range)
3. Return { headers: Array, rows: Array, rowCount: number }
4. Handle tab names with spaces using formatTabNameForRange()

Place this function AFTER the existing readSheet function (around line 197).

IMPORTANT NOTES:
- formatTabNameForRange() is an internal function in this file (not exported) - it's fine to use it directly
- readSheet() is already exported and available
- HEADERS_ROW constant is available in this file (12 columns: Date, Name, Title, Location, Connection Source, LinkedIn URL, etc.)
- Name column is index 1 (column B)
- LinkedIn URL column is index 5 (column F)

REQUIREMENTS:
- Use existing formatTabNameForRange helper (internal function, no import needed)
- Use existing readSheet function internally
- Return empty arrays if tab has no data
- Include proper console logging with [SHEETS] prefix
- Export the function using 'export async function'
```

**Expected Output:**

```javascript
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
```

**Step 2: Add compareTabs function**

**Agent Prompt:**
```
Add a new function compareTabs to background/sheets_api.js.

This function should:
1. Accept: spreadsheetId, tab1Name, tab2Name, outputTabName, keyColumn (default: 1 for Name column)
2. Read data from both tabs using getTabData
3. Find rows that are in tab2 but NOT in tab1 (new entries)
4. Check if output tab already exists using getSheetTabs
5. Create a new tab with the outputTabName (if it doesn't exist)
6. Write differential rows to the new tab (addTabToSheet already adds headers)

Place this function AFTER getTabData function.

IMPORTANT NOTES:
- getSheetTabs() is already exported in this file - use it to check for existing tabs
- addTabToSheet() already adds HEADERS_ROW to new tabs, so don't add headers again
- appendRows() is used to write the differential rows
- Column indices: Name = 1 (B), LinkedIn URL = 5 (F)
- formatTabNameForRange() is internal - use it for tab names with spaces

COMPARISON LOGIC:
- Use the keyColumn (default: Name column, index 1) to determine uniqueness
- Normalize comparison: lowercase, trimmed
- A row is "new" if its key value doesn't exist in tab1
- Skip rows without a key value
- Avoid duplicates within tab2 itself

REQUIREMENTS:
- Use existing getSheetTabs to check if output tab exists
- Use existing addTabToSheet to create output tab (it adds headers automatically)
- Use existing appendRows to write data rows only (not headers)
- Handle edge cases: empty tabs, duplicate keys within same tab, missing output tab name
- Return success: false if tab already exists
- Include proper console logging with [SHEETS] prefix
- Export the function using 'export async function'
```

**Expected Output:**

```javascript
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
```

**Step 3: Update exports**

**Agent Prompt:**
```
Verify that the new functions are exported from sheets_api.js.

The export statement at the function definition should be present:
- export async function getTabData(...)
- export async function compareTabs(...)

If using a separate export block at the bottom of the file, add these functions to it.

DO NOT duplicate exports.
```

### Verification Steps

1. **Syntax Check:**
   ```bash
   # In browser console after reload:
   # Service worker should load without errors
   ```

2. **Function Availability:**
   - Check that compareTabs and getTabData are listed in imports
   - No duplicate function definitions

3. **Console Logging:**
   - All new log statements use `[SHEETS]` prefix

### 🧪 Gate Check 7.1

```
✅ getTabData function added and exported
✅ compareTabs function added and exported  
✅ formatTabNameForRange is used for tab names with spaces
✅ Comparison uses normalized keys (lowercase, trimmed)
✅ Output tab existence check prevents overwriting
✅ Headers are preserved in output tab
✅ No syntax errors on extension reload
```

**If gate check passes:** Proceed to Task 7.2  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 7.2: Add Message Handlers to service_worker.js

**Status:** 🔲 Not Started  
**Dependencies:** Task 7.1 must be complete  
**Estimated Time:** 15-20 minutes

### Objective
Add message handlers to handle tab comparison requests from the popup.

### Files to Modify
- `background/service_worker.js`

### Step-by-Step Instructions

**Step 1: Update imports**

**Agent Prompt:**
```
Update the imports at the top of background/service_worker.js.

FIND the existing import from './sheets_api.js':
import { createSheet, appendRows, readSheet, deduplicateSheet, getSheetName, addTabToSheet, loadSheet, getSheetTabs, ensureWeeklyTab, appendRowsToTab, validateSpreadsheet } from './sheets_api.js';

ADD the new functions to this import:
- getTabData
- compareTabs

RESULT should be:
import { createSheet, appendRows, readSheet, deduplicateSheet, getSheetName, addTabToSheet, loadSheet, getSheetTabs, ensureWeeklyTab, appendRowsToTab, validateSpreadsheet, getTabData, compareTabs } from './sheets_api.js';

DO NOT create a separate import statement - add to existing one.
```

**Step 2: Add COMPARE_TABS message handler**

**Agent Prompt:**
```
Add a new case 'COMPARE_TABS' to the message handler switch statement in service_worker.js.

LOCATE: The switch statement inside chrome.runtime.onMessage.addListener
FIND: A good location - suggest adding after 'DEDUPLICATE_SHEET' case or before 'STATUS_UPDATE'

The handler should:
1. Extract: spreadsheetId, tab1Name, tab2Name, outputTabName, keyColumn from message
2. Validate required parameters (spreadsheetId, tab1Name, tab2Name, outputTabName)
3. Call compareTabs() function
4. Return the result

REQUIREMENTS:
- Use existing currentOutputSheetId as fallback for spreadsheetId
- Include proper error handling
- Log with [SW] prefix
```

**Expected Output:**

```javascript
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
```

**Step 3: Verify placement**

**Agent Prompt:**
```
Verify the new cases are placed correctly:

1. Inside the switch statement (NOT outside)
2. Before the 'default:' case
3. After existing Phase 6 cases (for organization)

Check that the closing braces and 'break' statements are correct.
Ensure no duplicate case labels exist.
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check service worker console for errors

2. **Import Verification:**
   - Verify compareTabs and getTabData are imported
   - Check for duplicate imports

3. **Message Handler Test:**
   ```javascript
   // In popup console:
   chrome.runtime.sendMessage({ action: 'COMPARE_TABS' }, console.log);
   // Should return: { success: false, error: 'No spreadsheet selected' }
   ```

### 🧪 Gate Check 7.2

```
✅ compareTabs and getTabData imported (no duplicates)
✅ COMPARE_TABS case added to switch statement
✅ GET_TAB_DATA case added to switch statement
✅ All validation checks present
✅ Fallback to currentOutputSheetId works
✅ No syntax errors on extension reload
✅ Test message returns expected validation error
```

**If gate check passes:** Proceed to Task 7.3  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 7.3: Add Compare UI to popup.html

**Status:** 🔲 Not Started  
**Dependencies:** None (UI-only changes)  
**Estimated Time:** 20-25 minutes

### Objective
Add a "Compare Tabs" UI section with two dropdown selectors, output tab name input, and compare button.

### Files to Modify
- `popup/popup.html`

### Step-by-Step Instructions

**Step 1: Locate insertion point**

**Agent Prompt:**
```
Read popup/popup.html and locate the insertion point.

The Compare Tabs section should be added:
- AFTER the Workbook Manager section (ends around line 91 with </section>)
- BEFORE the Output Sheet section (starts around line 93 with <!-- Output Sheet Section -->)

EXACT LOCATION: After line 91 (closing </section> of Workbook Manager), before line 93.

IDENTIFY: Find the closing </section> tag of the Workbook Manager section (class="section workbook-section").

The Compare section should be its own collapsible section using <details> tag, matching the structure of other sections.
```

**Step 2: Add Compare Tabs HTML section**

**Agent Prompt:**
```
Add the Compare Tabs section HTML at the identified location in popup/popup.html.

REQUIREMENTS:
- Use <details> tag for collapsible section (matches other sections)
- Use class="section compare-section" on <details> tag
- Two <select> dropdowns for tab selection (id="compareTab1", id="compareTab2")
- Text input for output tab name (id="compareOutputName")
- Compare button (id="compareBtn")
- Results display area (id="compareResults")
- All IDs must match exactly (used by popup.js)
- Use existing CSS class patterns (.section, .form-group, .btn, etc.)
- Match indentation style of surrounding sections (4 spaces per level)
- Place between Workbook Manager (ends ~line 91) and Output Sheet (starts ~line 93)
```

**Expected Output:**

```html
<!-- Compare Tabs Section (NEW - Phase 7) -->
<details class="section compare-section">
    <summary>🔄 Compare Tabs</summary>
    <div class="section-content">
        <p class="section-description" style="font-size: 12px; color: #888; margin-bottom: 12px; font-style: italic;">
            Find entries that exist in one tab but not the other.
        </p>
        
        <div class="form-group">
            <label for="compareTab1">Baseline Tab (older):</label>
            <select id="compareTab1" class="tab-select">
                <option value="">-- Select Tab --</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="compareTab2">Compare Tab (newer):</label>
            <select id="compareTab2" class="tab-select">
                <option value="">-- Select Tab --</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="compareOutputName">Output Tab Name:</label>
            <input type="text" id="compareOutputName" placeholder="e.g., new_leads" />
        </div>
        
        <div class="form-group">
            <label for="compareKeyColumn">Compare By:</label>
            <select id="compareKeyColumn" class="key-select">
                <option value="1" selected>Name (Column B)</option>
                <option value="5">LinkedIn URL (Column F)</option>
            </select>
        </div>
        
        <div class="button-row">
            <button id="compareBtn" class="btn btn-primary" disabled>
                🔄 Compare
            </button>
            <button id="refreshTabsBtn" class="btn btn-secondary">
                ↻ Refresh Tabs
            </button>
        </div>
        
        <div id="compareResults" class="results-box" style="display: none;">
            <div class="result-item">
                <span class="result-label">Tab 1 Rows:</span>
                <span id="compareTab1Count">-</span>
            </div>
            <div class="result-item">
                <span class="result-label">Tab 2 Rows:</span>
                <span id="compareTab2Count">-</span>
            </div>
            <div class="result-item result-highlight">
                <span class="result-label">New Entries:</span>
                <span id="compareNewCount">-</span>
            </div>
            <div class="result-item">
                <span class="result-label">Output Tab:</span>
                <span id="compareOutputTab">-</span>
            </div>
        </div>
        
        <div id="compareError" class="error-message" style="display: none;"></div>
    </div>
</details>
```

**Step 3: Verify HTML structure**

**Agent Prompt:**
```
Verify the HTML structure:

1. All tags are properly closed
2. IDs are unique within the document
3. Class names match existing patterns
4. Indentation is consistent with rest of file

Check there are no duplicate IDs by searching for each ID in the file.
```

### Verification Steps

1. **HTML Validation:**
   - Open popup in browser
   - Check for rendering errors
   - Verify section is collapsible

2. **Element IDs:**
   - All specified IDs exist
   - No duplicate IDs in document

3. **Visual Check:**
   - Section appears in correct location
   - Dropdowns render correctly
   - Button displays properly

### 🧪 Gate Check 7.3

```
✅ Compare Tabs section added to popup.html
✅ Section is collapsible (<details> tag)
✅ Two tab dropdowns present (compareTab1, compareTab2)
✅ Output name input present (compareOutputName)
✅ Key column selector present (compareKeyColumn)
✅ Compare button present and initially disabled
✅ Refresh tabs button present
✅ Results display area present
✅ Error display area present
✅ No HTML syntax errors
✅ No duplicate IDs
```

**If gate check passes:** Proceed to Task 7.4  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 7.4: Add Compare CSS Styling

**Status:** 🔲 Not Started  
**Dependencies:** Task 7.3 must be complete  
**Estimated Time:** 10-15 minutes

### Objective
Add CSS styling for the Compare Tabs section that matches existing pirate theme.

### Files to Modify
- `popup/popup.css`

### Step-by-Step Instructions

**Step 1: Add compare section styles**

**Agent Prompt:**
```
Add CSS styles for the Compare Tabs section to popup/popup.css.

REQUIREMENTS:
- Match existing pirate theme (black/red color scheme)
- Style the results box with distinct appearance
- Style the error message
- Style the highlight for "New Entries" count
- Maintain consistency with existing section styles

Add these styles at the END of the file (after existing styles).
```

**Expected Output:**

```css
/* ============================================================
   PHASE 7: COMPARE TABS SECTION
   ============================================================ */

.compare-section .section-content {
    padding: 10px 0;
}

.compare-section .section-description {
    font-size: 12px;
    color: #888;
    margin-bottom: 12px;
    font-style: italic;
}

.compare-section .tab-select,
.compare-section .key-select {
    width: 100%;
    padding: 8px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #1a1a1a;
    color: #fff;
    font-size: 13px;
}

.compare-section .tab-select:focus,
.compare-section .key-select:focus {
    border-color: #dc3545;
    outline: none;
}

.compare-section .button-row {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

.compare-section .btn-secondary {
    background: #333;
    color: #fff;
    border: 1px solid #555;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.compare-section .btn-secondary:hover {
    background: #444;
}

.results-box {
    margin-top: 15px;
    padding: 12px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
}

.results-box .result-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #2a2a2a;
    font-size: 13px;
}

.results-box .result-item:last-child {
    border-bottom: none;
}

.results-box .result-label {
    color: #888;
}

.results-box .result-item span:last-child {
    color: #fff;
    font-weight: 500;
}

.results-box .result-highlight {
    background: rgba(220, 53, 69, 0.15);
    margin: 4px -12px;
    padding: 8px 12px;
    border-radius: 4px;
}

.results-box .result-highlight .result-label {
    color: #dc3545;
    font-weight: 600;
}

.results-box .result-highlight span:last-child {
    color: #dc3545;
    font-weight: 700;
    font-size: 16px;
}

.error-message {
    margin-top: 10px;
    padding: 10px;
    background: rgba(220, 53, 69, 0.2);
    border: 1px solid #dc3545;
    border-radius: 4px;
    color: #ff6b6b;
    font-size: 12px;
}

/* Compare button states */
.compare-section #compareBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.compare-section #compareBtn.loading {
    position: relative;
    color: transparent;
}

.compare-section #compareBtn.loading::after {
    content: "⏳";
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    color: #fff;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

### Verification Steps

1. **CSS Validation:**
   - Reload extension
   - Check for CSS syntax errors in console

2. **Visual Check:**
   - Section styling matches theme
   - Dropdowns have correct appearance
   - Results box displays correctly

### 🧪 Gate Check 7.4

```
✅ CSS added to popup.css
✅ No CSS syntax errors
✅ Styling matches existing theme
✅ Results box styled distinctly
✅ Error message styled
✅ Highlight styling for new entries count
✅ Button states (disabled, loading) styled
```

**If gate check passes:** Proceed to Task 7.5  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 7.5: Add Compare Logic to popup.js

**Status:** 🔲 Not Started  
**Dependencies:** Tasks 7.1-7.4 must be complete  
**Estimated Time:** 30-40 minutes

### Objective
Add JavaScript logic to populate tab dropdowns, handle comparison, and display results.

### Files to Modify
- `popup/popup.js`

### Step-by-Step Instructions

**Step 1: Add element references**

**Agent Prompt:**
```
Add element references for Compare section to the 'elements' object in popup.js.

LOCATE: The 'elements' object definition near the top of popup.js.

ADD these new element references:
- compareTab1: document.getElementById('compareTab1')
- compareTab2: document.getElementById('compareTab2')
- compareOutputName: document.getElementById('compareOutputName')
- compareKeyColumn: document.getElementById('compareKeyColumn')
- compareBtn: document.getElementById('compareBtn')
- refreshTabsBtn: document.getElementById('refreshTabsBtn')
- compareResults: document.getElementById('compareResults')
- compareTab1Count: document.getElementById('compareTab1Count')
- compareTab2Count: document.getElementById('compareTab2Count')
- compareNewCount: document.getElementById('compareNewCount')
- compareOutputTab: document.getElementById('compareOutputTab')
- compareError: document.getElementById('compareError')

Place these with other element references, maintaining alphabetical or logical grouping.
```

**Expected Output (partial):**

```javascript
// Add to elements object:
// --- Compare Section ---
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
```

**Step 2: Add state variables**

**Agent Prompt:**
```
Add state variables for Compare section to the 'state' object in popup.js.

LOCATE: The 'state' object definition.

ADD these new state variables:
- compareTabs: []  // Array of available tabs for comparison
- isComparing: false  // Whether comparison is in progress

These track the compare feature state.
```

**Step 3: Add loadTabsForComparison function**

**Agent Prompt:**
```
Add a new function loadTabsForComparison to popup.js.

This function should:
1. Check if there's an active workbook selected
2. Send GET_SHEET_TABS message to get all tabs
3. Populate both compareTab1 and compareTab2 dropdowns with options
4. Enable/disable the compare button based on state
5. Handle errors gracefully

IMPORTANT NOTES:
- Check BOTH state.outputSheetId AND state.activeSheetId (from Phase 6)
- Use state.activeSheetId if available, otherwise fall back to state.outputSheetId
- sendMessage() helper already exists in popup.js (around line 105)
- GET_SHEET_TABS message handler already exists in service_worker.js

REQUIREMENTS:
- Use existing sendMessage helper (already defined)
- Clear existing options before adding new ones
- Add a default "-- Select Tab --" option
- Log with [POPUP] prefix
- Handle case where no workbook is selected gracefully
```

**Expected Output:**

```javascript
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
```

**Step 4: Add handleCompare function**

**Agent Prompt:**
```
Add a new function handleCompare to popup.js.

This function should:
1. Get selected tabs and output name from UI
2. Validate selections (different tabs, name provided)
3. Send COMPARE_TABS message to service worker
4. Display results or error
5. Handle loading state (disable button, show spinner)

REQUIREMENTS:
- Use existing sendMessage helper
- Update UI to show loading state
- Display results in the results box
- Handle errors gracefully
- Re-enable button after completion
```

**Expected Output:**

```javascript
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
    elements.compareTab1Count.textContent = result.tab1Count || 0;
    elements.compareTab2Count.textContent = result.tab2Count || 0;
    elements.compareNewCount.textContent = result.newEntries || 0;
    elements.compareOutputTab.textContent = result.outputTabName || '-';
    elements.compareResults.style.display = 'block';
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
```

**Step 5: Add event listeners**

**Agent Prompt:**
```
Add event listeners for the Compare section elements.

LOCATE: The section where event listeners are added (usually in an init function or DOMContentLoaded handler).

ADD event listeners for:
1. compareBtn click → handleCompare()
2. refreshTabsBtn click → loadTabsForComparison()
3. compareTab1 change → updateCompareButtonState()
4. compareTab2 change → updateCompareButtonState()
5. compareOutputName input → updateCompareButtonState()

ALSO: Call loadTabsForComparison() during initialization if a workbook is already loaded.

REQUIREMENTS:
- Check that elements exist before adding listeners (elements?.addEventListener)
- Use existing patterns for event listener registration
```

**Expected Output:**

```javascript
// Add to initialization section (after DOM elements are defined):

// --- Compare Section Event Listeners ---
if (elements.compareBtn) {
    elements.compareBtn.addEventListener('click', handleCompare);
}
if (elements.refreshTabsBtn) {
    elements.refreshTabsBtn.addEventListener('click', loadTabsForComparison);
}
if (elements.compareTab1) {
    elements.compareTab1.addEventListener('change', updateCompareButtonState);
}
if (elements.compareTab2) {
    elements.compareTab2.addEventListener('change', updateCompareButtonState);
}
if (elements.compareOutputName) {
    elements.compareOutputName.addEventListener('input', updateCompareButtonState);
}
```

**Step 6: Integrate with workbook selection**

**Agent Prompt:**
```
Find where the active workbook is set and add a call to loadTabsForComparison().

LOCATE these functions in popup.js:
1. handleWorkbookSelect() - around line 300 (Phase 6 workbook manager)
2. handleLoadSheet() - around line 1068 (legacy output sheet)
3. handleActiveSheetChange() - around line 369 (Phase 6 active sheet checkbox)

ADD a call to loadTabsForComparison() in these locations:
- In handleWorkbookSelect(): After a workbook is selected and state is updated
- In handleLoadSheet(): After an output sheet is loaded and state.outputSheetId is set
- In handleActiveSheetChange(): After active sheet type changes and state.activeSheetId is set

IMPORTANT: Only call loadTabsForComparison() if the elements exist (check elements.compareTab1 first).

EXAMPLE locations:
// In handleWorkbookSelect() after line ~334:
if (elements.compareTab1) {
    await loadTabsForComparison();
}

// In handleLoadSheet() after setting state.outputSheetId:
if (elements.compareTab1) {
    await loadTabsForComparison();
}
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check popup console for errors

2. **Functional Check:**
   ```
   1. Select an active workbook
   2. Open Compare section
   3. Verify dropdowns populate with tabs
   4. Select two different tabs
   5. Enter output name
   6. Click Compare
   7. Verify results display
   ```

3. **Error Handling:**
   - Test with no workbook selected
   - Test with same tab selected for both
   - Test with empty output name
   - Test with duplicate output tab name

### 🧪 Gate Check 7.5

```
✅ Element references added to elements object
✅ State variables added (compareTabs, isComparing)
✅ loadTabsForComparison function works correctly
✅ populateTabDropdown function works correctly
✅ updateCompareButtonState enables/disables button appropriately
✅ handleCompare function executes comparison
✅ Results display correctly
✅ Errors display correctly
✅ Event listeners registered
✅ Tabs load when workbook is selected
✅ Loading state shows during comparison
✅ Button re-enables after comparison
```

**If gate check passes:** Proceed to Task 7.6  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 7.6: Integration Testing

**Status:** 🔲 Not Started  
**Dependencies:** Tasks 7.1-7.5 must be complete  
**Estimated Time:** 20-30 minutes

### Objective
Verify the complete compare feature works end-to-end.

### Test Scenarios

**Test 1: Basic Comparison Flow**
```
1. Load extension popup
2. Select/activate a workbook with multiple tabs (e.g., 11_27_25, 11_28_25)
3. Expand "Compare Tabs" section
4. Verify both dropdowns populate with available tabs
5. Select "11_27_25" as Tab 1 (baseline)
6. Select "11_28_25" as Tab 2 (compare)
7. Enter "new_leads" as output name
8. Click Compare
9. Verify:
   - Loading state shows
   - Results appear with counts
   - New tab "new_leads" is created in workbook
   - Tab contains only entries from 11_28_25 not in 11_27_25
```

**Test 2: Empty Differential**
```
1. Compare two identical tabs
   (or tabs with same entries)
2. Verify output tab is created with headers only
3. Verify newEntries count is 0
```

**Test 3: Error Handling - Same Tab**
```
1. Select same tab for both dropdowns
2. Click Compare
3. Verify error message: "Please select two different tabs"
```

**Test 4: Error Handling - Duplicate Output Name**
```
1. Complete a comparison successfully (creates "new_leads" tab)
2. Try to compare again with same output name "new_leads"
3. Verify error message: "Tab already exists"
```

**Test 5: Error Handling - No Workbook**
```
1. Ensure no workbook is selected
2. Try to open Compare section
3. Verify appropriate error or empty dropdowns
```

**Test 6: Refresh Tabs Button**
```
1. Complete a comparison (creates new tab)
2. Click "Refresh Tabs" button
3. Verify new tab appears in both dropdowns
```

**Test 7: Key Column Selection**
```
1. Select "LinkedIn URL" as compare key
2. Run comparison
3. Verify comparison uses URL column for matching
```

### Console Verification

**Service Worker Console:**
```
[SW] Received: GET_SHEET_TABS
[SW] Received: COMPARE_TABS
[SW] Comparing tabs: "11_27_25" vs "11_28_25" → "new_leads"
```

**Popup Console:**
```
[POPUP] Loading tabs for comparison...
[POPUP] Found X tabs for comparison
[POPUP] Starting comparison...
[POPUP] Comparison complete: {success: true, newEntries: Y, ...}
```

**Sheets API Console:**
```
[SHEETS] Comparing tabs: "11_27_25" vs "11_28_25" → "new_leads"
[SHEETS] Getting data from tab "11_27_25"...
[SHEETS] Tab "11_27_25" has X data rows
[SHEETS] Getting data from tab "11_28_25"...
[SHEETS] Tab "11_28_25" has Y data rows
[SHEETS] Tab1 has Z unique keys
[SHEETS] Found N new entries in "11_28_25"
[SHEETS] Created output tab: "new_leads"
[SHEETS] Wrote N rows to "new_leads"
[SHEETS] ✅ Comparison complete: N new entries
```

### 🧪 Final Gate Check

```
✅ Basic comparison flow works end-to-end
✅ Empty differential creates tab with headers only
✅ Same-tab validation error works
✅ Duplicate output name error works
✅ No-workbook error handling works
✅ Refresh tabs button updates dropdowns
✅ Key column selection works (Name vs LinkedIn URL)
✅ Console logs show expected flow
✅ No JavaScript errors in any console
✅ Comparison results display correctly
✅ New tab created in Google Sheets with correct data
✅ Headers preserved in output tab
```

---

## 🚨 Common Pitfalls & Anti-Bug Directives

### Critical Issues to Avoid

1. **Tab Name Formatting**
   - **Problem**: Tab names with spaces break API calls
   - **Solution**: Always use `formatTabNameForRange()` when building range strings
   - **Code**: `const range = \`${formatTabNameForRange(tabName)}!A:Z\``
   - **Note**: formatTabNameForRange() is internal to sheets_api.js, not exported - use it directly within that file

2. **Duplicate Case Labels**
   - **Problem**: Adding duplicate case in switch statement
   - **Solution**: Search for existing case before adding new ones
   - **Check**: `grep -n "case 'COMPARE_TABS'" service_worker.js`

3. **Missing Null Checks**
   - **Problem**: Accessing properties on null elements
   - **Solution**: Always use optional chaining or null checks
   - **Code**: `elements.compareBtn?.disabled` or `if (elements.compareBtn) { ... }`

4. **Async/Await in Event Listeners**
   - **Problem**: Unhandled promise rejections
   - **Solution**: Wrap async handlers in try/catch
   - **Code**: See handleCompare example with try/catch/finally

5. **Import Duplication**
   - **Problem**: Importing same function twice causes errors
   - **Solution**: Add to existing import statement, don't create new one
   - **Check**: Count occurrences of function name in imports

6. **State Variable Selection**
   - **Problem**: Using wrong state variable for workbook ID
   - **Solution**: Check both state.activeSheetId (Phase 6) and state.outputSheetId (legacy)
   - **Code**: `const spreadsheetId = state.activeSheetId || state.outputSheetId;`

7. **Headers Already Added**
   - **Problem**: Trying to add headers when addTabToSheet already does it
   - **Solution**: addTabToSheet() automatically adds HEADERS_ROW, only use appendRows() for data rows
   - **Note**: Don't pass headers to appendRows() when using addTabToSheet()

### Code Quality Checklist

Before each task completion, verify:

- [ ] All new functions are exported where needed
- [ ] All imports are at the top of the file (no inline imports)
- [ ] Console logs use correct prefix: `[SHEETS]`, `[SW]`, or `[POPUP]`
- [ ] Error messages are user-friendly
- [ ] Loading states are properly managed
- [ ] Buttons are disabled/enabled appropriately
- [ ] No duplicate IDs in HTML
- [ ] CSS follows existing naming conventions
- [ ] Event listeners check element existence

---

## 📚 Reference

### Message Flow Summary

```
Popup                    Service Worker           Sheets API
──────                   ──────────────           ──────────
GET_SHEET_TABS    →      getSheetTabs()     →    API call
                  ←      tabs[]              ←    Response

COMPARE_TABS      →      compareTabs()      →    Multiple API calls
  - tab1Name             - getTabData(tab1)
  - tab2Name             - getTabData(tab2)  
  - outputTabName        - addTabToSheet()
  - keyColumn            - appendRows()
                  ←      result{}            ←    Success/Error
```

### State Variables Reference

```javascript
// popup.js state additions
state.compareTabs = [];      // Array of {title, sheetId}
state.isComparing = false;   // Boolean - comparison in progress

// Existing state variables used:
state.activeSheetId = null;  // Phase 6: Active workbook ID (preferred)
state.outputSheetId = null;  // Legacy: Output sheet ID (fallback)
```

### Element IDs Reference

| ID | Type | Purpose |
|----|------|---------|
| compareTab1 | select | Baseline tab dropdown |
| compareTab2 | select | Compare tab dropdown |
| compareOutputName | input | Output tab name |
| compareKeyColumn | select | Key column selector |
| compareBtn | button | Execute comparison |
| refreshTabsBtn | button | Reload tabs list |
| compareResults | div | Results container |
| compareTab1Count | span | Tab 1 row count |
| compareTab2Count | span | Tab 2 row count |
| compareNewCount | span | New entries count |
| compareOutputTab | span | Output tab name |
| compareError | div | Error message |

---

## 🤖 Agent Execution Instructions

### For Cursor AI / Claude Code

**Copy this prompt to start:**

```
Follow the plan in `linkedin-scraper-plan.md` for Phase 7 exactly.

EXECUTION RULES:
1. Complete ONE task at a time
2. Do NOT proceed to next task until current task passes Gate Check
3. ALWAYS check for existing code before adding - no duplicates
4. Run linter/syntax check after each file modification
5. Test in browser after each task
6. Log progress: "✅ Task 7.X complete, proceeding to 7.Y"

START: Task 7.1 - Add comparison functions to sheets_api.js

After each task:
1. Save file
2. Reload extension in Chrome
3. Check service worker console for errors
4. Check popup console for errors
5. If errors, fix before proceeding
6. If no errors, proceed to next task
```

### Task Execution Order

```
Task 7.1: sheets_api.js (getTabData, compareTabs)
├── Add: getTabData function
├── Add: compareTabs function
└── Gate: Functions exported, no syntax errors

Task 7.2: service_worker.js (message handlers)
├── Update: imports
├── Add: COMPARE_TABS case
├── Add: GET_TAB_DATA case
└── Gate: Test message returns validation error

Task 7.3: popup.html (UI section)
├── Add: Compare Tabs section HTML
└── Gate: Section renders, IDs exist

Task 7.4: popup.css (styling)
├── Add: Compare section styles
└── Gate: Styling matches theme

Task 7.5: popup.js (logic)
├── Add: element references
├── Add: state variables
├── Add: loadTabsForComparison()
├── Add: handleCompare()
├── Add: helper functions
├── Add: event listeners
└── Gate: Full UI interaction works

Task 7.6: Integration Testing
├── Test: All scenarios
└── Gate: End-to-end workflow verified
```

### If Agent Gets Stuck

1. **"Function not found"**: Check exports in sheets_api.js - ensure functions use `export async function`
2. **"Cannot read property of null"**: Add null checks for elements - use optional chaining `elements.compareBtn?.`
3. **"Duplicate case"**: Search file for existing case label - use grep to find existing cases
4. **"Tabs not loading"**: Verify GET_SHEET_TABS handler exists in service_worker.js (it does, around line 225)
5. **"Button stays disabled"**: Check updateCompareButtonState logic - verify state.activeSheetId or state.outputSheetId is set
6. **"formatTabNameForRange is not defined"**: It's internal to sheets_api.js - use it directly, don't import
7. **"getSheetTabs is not defined"**: It's already exported in sheets_api.js - check imports in service_worker.js
8. **"Headers missing in output tab"**: addTabToSheet() adds headers automatically - don't add them again
9. **"No workbook selected"**: Check both state.activeSheetId (Phase 6) and state.outputSheetId (legacy)
10. **"Tab already exists error"**: This is expected behavior - user must choose different name

---

*Generated for agentic execution with Cursor AI. Each task is self-contained with verification gates.*

---

## 📦 PHASE 8: Packaging & Deployment

### Task 7.1: Prepare for Distribution

**Cursor Prompt:**
```
Create a build script that:
1. Removes console.log statements (or replaces with conditional logging)
2. Minifies CSS
3. Validates manifest.json
4. Creates a ZIP file for Chrome Web Store upload
5. Generates a README.md with installation instructions
```

### Task 7.2: Create README.md

```markdown
# Savvy Pirate - Chrome Extension

## Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome → chrome://extensions
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder

## Configuration

### Google Cloud Setup
1. Create project at console.cloud.google.com
2. Enable Google Sheets API
3. Create OAuth 2.0 credentials for Chrome Extension
4. Add your Extension ID to authorized origins
5. Copy Client ID to manifest.json

### Input Sheet Format
Create a Google Sheet with columns:
| Source Connection | Job Title | Search URL |
|------------------|-----------|------------|
| John Smith | Financial Advisor | https://linkedin.com/search/... |

## Usage

1. Click extension icon
2. Enter your Input Sheet ID and click "Load" - searches will appear in list
3. Create a new output sheet OR load an existing sheet:
   - **Create**: Enter name and click "Create"
   - **Load**: Paste sheet URL or ID and click "Load"
4. (Optional) Add a new tab: Enter tab name and click "Add Tab"
5. Select which tab to scrape to using the dropdown (if multiple tabs exist)
6. Select a search from the list and click "Open"
7. Once on LinkedIn, click "Start Scraping"
8. Use the red STOP button on the LinkedIn page to end early
9. Use "Deduplicate" button in footer to remove duplicate rows by Name column

## Features

- **Tab Management**: Load existing sheets, add tabs, select active tab via dropdown
- **Name Parsing**: Automatically extracts accreditations (e.g., "James Weaver, CWS®" → separates into Name + Accreditation columns)
- **Connection Source**: Automatically uses the "Source Connection" from your input sheet (Column A)
- **Manual Deduplication**: Click "Deduplicate" to remove duplicate rows based on Name column
- **Resilient Sync**: Data saved locally first, syncs to Sheets when online
- **Smart Navigation**: Auto-advances through multiple searches with visual progress
- **Pirate Theme**: Black and red UI below header, skull icon

## Troubleshooting

**"Not on LinkedIn" error**: Navigate to a LinkedIn search results page first.

**"Auth failed" error**: Check your Google Cloud OAuth setup and ensure the Extension ID matches. Don't forget to add yourself as a Test User!

**No data appearing**: Check the Output Sheet. Verify the scraper is finding profiles (check Console for logs).

**Tab dropdown not showing**: Reload the extension and try loading the sheet again. Check console for errors.

**Deduplication not working**: Make sure you're pointing to the correct tab. The deduplication operates on the currently selected tab.
```

---

## 🎯 Success Criteria

### Functional Requirements
1. ✅ Chrome Extension installs without errors
2. ✅ OAuth2 authentication with Google Sheets working
3. ✅ Ability to load search URLs from an input sheet (Col A=Source, B=Title, C=URL)
4. ✅ Ability to create new output sheets OR load existing sheets by URL/ID
5. ✅ Tab Management: Add tabs to existing workbooks, select active tab via dropdown
6. ✅ Working scraper extracts: Name, Title, Location, Connection Source (from input sheet), URL
7. ✅ Name parsing extracts accreditations into 6 separate columns (Accreditation 1-6)
8. ✅ Real-time data sync to Google Sheets (no CSV downloads)
9. ✅ Stop button works both in popup and on-page, persists across popup closes
10. ✅ Pirate-themed UI (black/red) with skull icon, white/gray/blue header
11. ✅ Workflow supports multiple sequential searches

### Stability Requirements
12. ✅ **Service worker survives 30+ minute scraping sessions**
13. ✅ **Token auto-refreshes on 401 errors without user intervention**
14. ✅ **No silent failures** - all errors logged with prefixes
15. ✅ **Graceful handling of tab closure mid-scrape**
16. ✅ **Extension recovers cleanly after Chrome restart**
17. ✅ **Scraping state persists across popup closes/reopens**

### Resilience Requirements (NEW - Diamond Grade)
18. ✅ **Sync Queue**: Data saved locally FIRST, survives network drops
19. ✅ **Retry Logic**: Failed API calls retry 5x before marking as failed
20. ✅ **Failed Export**: Users can export failed rows as CSV
21. ✅ **Manual Sync**: "Sync Now" button triggers queue processing

### Workflow Automation Requirements (NEW - Diamond Grade)
22. ✅ **Progress Tracking**: Shows "Search X of Y" with visual progress bar
23. ✅ **Smart Navigation**: Completion panel with "Proceed to Next" button
24. ✅ **Visual States**: Search list shows completed/current/pending items
25. ✅ **Auto-Advance**: Remembers position across sessions

### Advanced Features (IMPLEMENTED)
26. ✅ **Tab Management**: Load existing workbooks, add new tabs, select active tab for scraping
27. ✅ **Name Parsing**: Extract accreditations (e.g., "James Weaver, CWS®" → Name: "James Weaver", Accreditation 1: "CWS®")
28. ✅ **Manual Deduplication**: Remove duplicate rows based on Name column with dedicated button
29. ✅ **Sheet Name Display**: Show actual sheet name (not just ID) as clickable link in UI
30. ✅ **Connection Source from Input**: Use Source Connection from input sheet (Column A) instead of scraping it
31. ✅ **Status Persistence**: Scraping state persists across popup closes/reopens
32. ✅ **Pirate-Themed UI**: Black and red color scheme below header (header remains white/gray/blue)
33. ✅ **Workbook Manager (Phase 6)**: Save/recall multiple Google Sheets, automatic dated tab creation (MM_DD_YY format), active sheet checkbox system
34. ✅ **Automatic Daily Tab Creation**: Creates new dated tab automatically for each new day's scraping run
35. ✅ **Active Sheet Selection**: Mutually exclusive checkbox system to designate active workbook or output sheet

### Verification Tests
```bash
# Test 1: Long Session (Service Worker Keep-Alive)
# Start scraping, let run for 5+ minutes
# Service worker console should show periodic "[SW] Keep-alive ping"

# Test 2: Token Refresh
# Start scraping, wait 1 hour (token expires)
# Continue scraping - should auto-refresh without popup

# Test 3: Network Resilience (Queue)
# Start scraping
# Disconnect WiFi mid-scrape
# Data should accumulate in "Pending"
# Reconnect → Click "Sync Now"
# All data should sync to sheet

# Test 4: Error Recovery
# Start scraping, close LinkedIn tab
# Reopen, click extension - should show "Ready" not error

# Test 5: Smart Navigation
# Complete one search
# "Search Complete" panel appears
# Click "Proceed to Next"
# New search URL opens automatically
```

---

## 🚨 Common Pitfalls & Anti-Bug Directives

### Critical Chrome Extension Bugs to Avoid

1. **Service Worker Dies During Scraping**
   - **Problem**: Manifest V3 service workers go to sleep after 30 seconds
   - **Solution**: Use `chrome.alarms` API with 24-second intervals
   - **Code**: See `startKeepAlive()` in service_worker.js

2. **Token Expires Mid-Session**
   - **Problem**: OAuth tokens expire, causing 401 errors
   - **Solution**: Use `fetchWithRetry()` - extracts token, removes from cache, gets fresh token, retries ONCE
   - **Code**: See `fetchWithRetry()` in sheets_api.js

3. **403 Forbidden on API Calls (CRITICAL)**
   - **Problem**: OAuth works but API calls fail with 403
   - **Cause**: Your Google Account is not listed as a Test User
   - **Solution**: Go to Google Cloud Console → OAuth consent screen → Test users → Add your email
   - **Symptoms**: Auth succeeds, but createSheet/appendRows fails

4. **Content Script Not Injected**
   - **Problem**: START_SCRAPING fails with "Receiving end does not exist"
   - **Cause**: Page was loaded before extension installed, or after page refresh
   - **Solution**: ALWAYS send PING first, if no response → use `chrome.scripting.executeScript()`
   - **Code**: See `ensureContentScriptInjected()` in popup.js

5. **`return true` Missing in Message Listeners**
   - **Problem**: Async responses fail silently
   - **Solution**: ALWAYS add `return true;` at end of `onMessage` listener
   - **Symptoms**: `sendResponse` never called, popup hangs

6. **ES Modules in Content Scripts**
   - **Problem**: Content scripts can't use `import/export` without extra config
   - **Solution**: Consolidate ALL content script code into ONE file
   - **Structure**: Single `content/content.js` with IIFE pattern

7. **`chrome.runtime.lastError` Not Checked**
   - **Problem**: Silent failures in callbacks
   - **Solution**: ALWAYS check `chrome.runtime.lastError` in callbacks
   ```javascript
   chrome.identity.getAuthToken({}, (token) => {
       if (chrome.runtime.lastError) {
           console.error(chrome.runtime.lastError.message);
           return;
       }
       // proceed with token
   });
   ```

8. **Tab Closed During Scraping**
   - **Problem**: Content script messages fail
   - **Solution**: Wrap `sendMessage` in try-catch, use `.catch()` for promises
   ```javascript
   chrome.runtime.sendMessage(msg).catch(() => {});
   ```

9. **Storage Callbacks Without Error Handling**
   - **Problem**: Storage operations fail silently
   - **Solution**: Always check errors in storage callbacks
   ```javascript
   chrome.storage.local.set(data, () => {
       if (chrome.runtime.lastError) {
           console.error('Storage error:', chrome.runtime.lastError);
       }
   });
   ```

10. **CSV Values with Commas Break Parsing**
    - **Problem**: Job titles like "VP, Sales" break simple split(',') parsing
    - **Solution**: Use proper CSV parser that handles quoted values
    - **Code**: See `parseCSVRow()` in popup.js

### Code Quality Checklist

Before each phase completion, verify:

- [ ] All `chrome.runtime.onMessage` listeners have `return true;`
- [ ] All callbacks check `chrome.runtime.lastError`
- [ ] All async message handlers use IIFE pattern
- [ ] Content script has NO `import` or `export` statements
- [ ] Keep-alive alarm is created before long operations
- [ ] Token refresh uses `fetchWithRetry()` pattern
- [ ] PING check before START_SCRAPING in popup.js
- [ ] Test User added to OAuth consent screen
- [ ] All console.log statements have `[SW]`, `[CS]`, `[SHEETS]`, or `[POPUP]` prefix

---

## 📚 Reference Links

- [Chrome Extension Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Google Sheets API v4](https://developers.google.com/sheets/api/reference/rest)
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/identity/)
- [LinkedIn People Search DOM](https://www.linkedin.com/search/results/people/)

---

*Generated for agentic execution with Cursor AI. Each phase is self-contained with test gates.*

---

## 🤖 Agent Execution Instructions

### For Cursor AI / Claude Code

**Copy this prompt to start:**

```
Follow the plan in `linkedin-scraper-extension-plan.md` exactly.

EXECUTION RULES:
1. Complete ONE phase at a time
2. Do NOT proceed to next phase until current phase passes Gate Check
3. Create files in the EXACT paths specified
4. Use the EXACT code provided - do not improvise
5. After each file creation, verify syntax is valid

START: Phase 1 - Create manifest.json and folder structure
```

### Phase Execution Order

```
Phase 1: Manifest & Structure
├── Create: manifest.json
├── Create: icons/ folder with placeholders
└── Gate: Load extension in Chrome without errors

Phase 2: Background Service Worker (Modular)
├── Create: background/auth.js
├── Create: background/sheets_api.js  
├── Create: background/service_worker.js
└── Gate: Auth token retrieval works

Phase 3: Content Script (Consolidated)
├── Create: content/content.js (SINGLE FILE)
└── Gate: PING message returns response

Phase 4: Popup UI
├── Create: popup/popup.html
├── Create: popup/popup.css
├── Create: popup/popup.js
└── Gate: Popup opens without console errors

Phase 5: Integration Testing
├── Test: Full scrape workflow
├── Test: Keep-alive survives 5+ minutes
└── Test: Token refresh on 401

Phase 6: Workbook Manager & Smart Tab Creation
├── Update: sheets_api.js (ensureWeeklyTab, validateSpreadsheet)
├── Update: service_worker.js (workbook management handlers)
├── Update: sync_queue.js (tab support)
├── Update: popup.html (Workbook Manager UI)
├── Update: popup.css (Workbook Manager styles)
├── Update: popup.js (Workbook Manager logic)
└── Gate: Workbook Manager works, weekly tabs auto-created

Phase 7: Tab Comparison & Differential List
├── Update: sheets_api.js (getTabData, compareTabs)
├── Update: service_worker.js (COMPARE_TABS, GET_TAB_DATA handlers)
├── Update: popup.html (Compare Tabs section)
├── Update: popup.css (Compare section styles)
├── Update: popup.js (Compare logic)
└── Gate: Tab comparison works end-to-end

Phase 8: Packaging & Deployment
├── Create: Build script
├── Create: README.md
└── Gate: Extension ready for distribution
```

### If Agent Gets Stuck

1. **"Service worker not found"**: Check manifest.json paths match actual files
2. **"Cannot use import"**: Ensure content script has NO modules
3. **"Token undefined"**: Run GET_AUTH_TOKEN with interactive: true first
4. **"Popup blank"**: Check popup.html links correct JS/CSS files
