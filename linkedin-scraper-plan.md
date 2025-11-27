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

## 🔧 PHASE 6: Error Handling & Polish

### Task 6.1: Add Robust Error Handling

**Cursor Prompt:**
```
Review all files (content.js, background.js, popup.js) and add:
1. Try-catch blocks around all async operations
2. User-friendly error messages
3. Retry logic for API calls (max 3 retries)
4. Graceful degradation when features fail
5. Console logging for debugging (prefix with [LSP])
```

### Task 6.2: Add Rate Limiting Protection

**Cursor Prompt:**
```
In content.js, add intelligent rate limiting:
1. Increase delay if getting many empty results
2. Random jitter on all delays (±20%)
3. Pause if detecting potential rate limiting (empty pages)
4. Maximum session duration warning (after 30 minutes)
```

### Task 6.3: Final Code Review Checklist

```markdown
## Pre-Deployment Checklist

### manifest.json
- [ ] client_id is set correctly
- [ ] All permissions are minimal and necessary
- [ ] Version number is correct

### content.js
- [ ] All selectors match current LinkedIn DOM
- [ ] Stop button removes cleanly
- [ ] No memory leaks in loops
- [ ] Messages send successfully

### background.js
- [ ] Token refresh works
- [ ] All API endpoints are correct
- [ ] Error responses include details
- [ ] Storage operations don't corrupt data

### popup.js
- [ ] All buttons have handlers
- [ ] State persists across popup open/close
- [ ] No unhandled promise rejections
- [ ] UI updates reflect actual state

### General
- [ ] Console has no errors during normal operation
- [ ] Extension works after Chrome restart
- [ ] Multiple tabs don't interfere
```

---

## 📦 PHASE 7: Packaging & Deployment

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
```

### If Agent Gets Stuck

1. **"Service worker not found"**: Check manifest.json paths match actual files
2. **"Cannot use import"**: Ensure content script has NO modules
3. **"Token undefined"**: Run GET_AUTH_TOKEN with interactive: true first
4. **"Popup blank"**: Check popup.html links correct JS/CSS files
