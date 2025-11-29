# Savvy Pirate - Technical Documentation

> **For Engineers & Developers**  
> This document covers the technical architecture, code structure, and implementation details of the Savvy Pirate Chrome Extension.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [State Management](#state-management)
6. [Message Passing](#message-passing)
7. [API Integrations](#api-integrations)
8. [Google Apps Scripts](#google-apps-scripts)
9. [Key Algorithms](#key-algorithms)
10. [Error Handling](#error-handling)
11. [Extension Lifecycle](#extension-lifecycle)
12. [Development Patterns](#development-patterns)
13. [Testing & Debugging](#testing--debugging)

---

## 🏗️ Architecture Overview

Savvy Pirate is a **Manifest V3** Chrome Extension that scrapes LinkedIn search results and syncs data to Google Sheets. The architecture follows a **service worker + content script + popup** pattern.

### High-Level Architecture

```
┌─────────────────┐
│   LinkedIn.com  │
│  (Content Page) │
└────────┬────────┘
         │
         │ DOM Interaction
         ▼
┌─────────────────┐
│  content.js     │ ◄── Scrapes LinkedIn profiles
│  (Content Script)│     Sends data via messages
└────────┬────────┘
         │
         │ chrome.runtime.sendMessage
         ▼
┌─────────────────┐
│ service_worker.js│ ◄── Orchestrates everything
│ (Service Worker) │     Handles API calls
│                 │     Manages state & queue
└────────┬────────┘
         │
         │ chrome.runtime.sendMessage
         │ Google Sheets API
         ▼
┌─────────────────┐
│   popup.js      │ ◄── User interface
│   (Popup UI)    │     Controls & monitors
└─────────────────┘
```

### Key Design Decisions

1. **Service Worker as Orchestrator**: All Google Sheets API calls happen in the service worker to avoid CORS issues
2. **Local-First Queue**: Data is queued locally before syncing, ensuring data safety
3. **Message-Based Communication**: All components communicate via `chrome.runtime.sendMessage`
4. **State Persistence**: Critical state is saved to `chrome.storage.local` for persistence across restarts

---

## 📁 Project Structure

```
linkedin_scraper/
├── manifest.json                 # Extension configuration (Manifest V3)
├── background/
│   ├── service_worker.js        # Main orchestrator, message handler
│   ├── auth.js                  # Google OAuth authentication
│   ├── sheets_api.js            # Google Sheets API wrapper
│   └── sync_queue.js            # Local-first sync queue
├── content/
│   └── content.js               # LinkedIn page scraper
├── popup/
│   ├── popup.html               # UI structure
│   ├── popup.js                 # UI logic & event handlers
│   └── popup.css                # Styling (pirate theme)
├── icons/                        # Extension icons
├── google-apps-script/
│   └── janitor-ai.gs            # AI cleanup script for Google Sheets
├── README.md                    # User-facing documentation
├── TECHNICAL.md                 # This file
└── linkedin-scraper-plan.md    # Development roadmap
```

---

## 🔧 Core Components

### 1. Service Worker (`background/service_worker.js`)

**Purpose**: Central orchestrator for all extension operations

**Key Responsibilities**:
- Message routing between components
- Google Sheets API calls (via `sheets_api.js`)
- State management (workbooks, tabs, auto-run state)
- Queue processing coordination
- Auto-run batch queue execution

**Key State Variables**:
```javascript
let currentOutputSheetId = null;      // Active spreadsheet ID
let currentTabName = 'Sheet1';        // Active tab name
let currentActiveTab = null;           // MM_DD_YY tab for weekly runs
let savedWorkbooks = [];               // Array of workbook configs
let sourceMapping = {};                // Source → Workbook mapping
let autoRunState = {                   // Auto-run configuration & progress
    isRunning: false,
    isAborted: false,
    config: null,
    progress: null
};
```

**Key Functions**:
- `processAutoRunQueue()` - Main auto-run processor
- `processSourceGroup()` - Processes all searches for a source
- `sendMessageToSelf()` - Internal message handler
- `updateAutoRunState()` - Updates and persists auto-run state

### 2. Content Script (`content/content.js`)

**Purpose**: Scrapes LinkedIn search results from the page

**Key Responsibilities**:
- DOM parsing (extracts profile data)
- Pagination navigation
- Progress tracking
- Data extraction and formatting

**Key Functions**:
```javascript
function scrapeCurrentPage(sourceName) {
    // Extracts: Name, Title, Location, URL, Accreditations
    // Returns: Array of row arrays
}

function clickNextButton() {
    // Finds and clicks LinkedIn's "Next" button
    // Uses multiple strategies for reliability
}

function detectPaginationState() {
    // Counts visible pages, detects Next button
    // Estimates total entries
}

function waitForEntriesToLoad(expectedCount, maxWaitMs) {
    // Waits for lazy-loaded content
    // Ensures all entries are loaded before scraping
}
```

**Data Format**:
```javascript
[
    Date,              // YYYY-MM-DD
    Name,              // Cleaned name (accreditations separated)
    Title,             // Job title
    Location,          // Geographic location
    ConnectionSource,  // Source from input sheet
    LinkedInURL,       // Profile URL
    Accr1, Accr2, ..., Accr6  // Up to 6 accreditations
]
```

### 3. Popup UI (`popup/popup.js`)

**Purpose**: User interface for controlling the extension

**Key Responsibilities**:
- Input sheet loading
- Workbook management
- Search list display
- Auto-run control & monitoring
- Progress display

**Key State**:
```javascript
const state = {
    searches: [],              // Loaded searches from input sheet
    selectedSearches: new Set(), // Selected for auto-run
    sourceMapping: {},         // Source → Workbook mapping
    isAutoRunning: false,      // Auto-run status
    autoRunStats: {},          // Progress statistics
    savedWorkbooks: []         // Workbook list
};
```

**Key Functions**:
- `handleLoadSearches()` - Loads input sheet
- `handleAutoRun()` - Starts auto-run batch queue
- `checkAutoRunStatus()` - Reconnects to running auto-run
- `updateAutoRunProgress()` - Updates UI from service worker

### 4. Sheets API (`background/sheets_api.js`)

**Purpose**: Wrapper for Google Sheets API v4

**Key Functions**:
```javascript
// Authentication
export async function getAuthToken(interactive = true)

// Sheet Operations
export async function createSheet(title)
export async function readSheet(spreadsheetId, range)
export async function appendRows(spreadsheetId, rows)
export async function appendRowsToTab(spreadsheetId, tabName, rows)

// Tab Management
export async function getSheetTabs(spreadsheetId)
export async function createTab(spreadsheetId, tabName)
export async function ensureWeeklyTab(spreadsheetId)  // Creates MM_DD_YY tab

// Advanced Features
export async function deduplicateSheet(spreadsheetId, tabName)
export async function compareTabs(spreadsheetId, tab1, tab2, outputTab, compareColumn)
```

**Date Handling**:
```javascript
function getTodayTabName() {
    // Returns MM_DD_YY format in Eastern Time
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return `${month}_${day}_${year}`;  // e.g., "11_29_25"
}
```

### 5. Sync Queue (`background/sync_queue.js`)

**Purpose**: Local-first data sync queue

**Design**: Data is saved locally immediately, then synced to Google Sheets in the background. This ensures data safety even if the browser crashes or WiFi drops.

**Key Functions**:
```javascript
export async function addToQueue(rows, spreadsheetId, tabName)
export async function processQueue()  // Processes pending items
export async function updateQueueTabName(spreadsheetId, newTabName)  // Updates tab names
export async function getQueueStatus()  // Returns pending/failed counts
```

**Queue Item Structure**:
```javascript
{
    id: "timestamp-random",
    spreadsheetId: "abc123...",
    tabName: "11_29_25",
    rows: [[...], [...], ...],
    retryCount: 0,
    createdAt: "2025-11-29T...",
    lastAttempt: null,
    lastError: null
}
```

**Retry Logic**:
- Max retries: 5
- Base delay: 2 seconds (doubles each retry)
- Failed items moved to `failedRows` storage

---

## 🔄 Data Flow

### Scraping Flow

```
1. User clicks "Start Scraping" in popup
   ↓
2. popup.js → chrome.runtime.sendMessage('START_SCRAPING')
   ↓
3. service_worker.js receives message
   ↓
4. service_worker.js → chrome.tabs.sendMessage(tabId, {action: 'START_SCRAPING'})
   ↓
5. content.js receives message, starts scraping loop
   ↓
6. content.js scrapes page → chrome.runtime.sendMessage('DATA_SCRAPED', {rows})
   ↓
7. service_worker.js receives DATA_SCRAPED
   ↓
8. service_worker.js → addToQueue(rows, spreadsheetId, tabName)
   ↓
9. sync_queue.js saves to chrome.storage.local (immediate)
   ↓
10. processQueue() → appendRowsToTab() → Google Sheets API
   ↓
11. Data appears in Google Sheet
```

### Auto-Run Flow

```
1. User selects searches, maps sources, clicks "Auto-Run"
   ↓
2. popup.js → chrome.runtime.sendMessage('START_AUTO_RUN', {config})
   ↓
3. service_worker.js:
   - Validates config
   - Creates/gets weekly tab (MM_DD_YY)
   - Updates queue items to use new tab
   - Starts processAutoRunQueue()
   ↓
4. processAutoRunQueue() loops through sources:
   - For each source:
     a. Ensures weekly tab exists
     b. Sets active tab
     c. For each search:
        - Opens LinkedIn URL
        - Injects content script
        - Starts scraping
        - Waits for completion
        - Updates progress
     d. Deduplicates workbook
   ↓
5. Progress updates sent to popup via AUTO_RUN_PROGRESS messages
   ↓
6. Popup displays progress, user can close popup (continues in background)
```

---

## 💾 State Management

### Storage Keys (`chrome.storage.local`)

```javascript
{
    // Settings
    'outputSheetId': 'abc123...',
    'currentTabName': 'Sheet1',
    'activeTab': '11_29_25',  // MM_DD_YY tab
    'inputSheetId': 'xyz789...',
    
    // Searches
    'searches': [...],
    'searchIndex': 0,
    
    // Workbooks
    'savedWorkbooks': [
        {
            id: 'abc123...',
            name: 'Taylor Etoch',
            sheetTitle: 'Taylor Etoch',
            lastUsed: '2025-11-29T...',
            lastTab: '11_29_25',
            addedAt: '2025-11-27T...'
        }
    ],
    
    // Phase 8: Source Mapping
    'sourceMapping': {
        'Taylor Newman': 'workbook-id-1',
        'Morgan Cirotto': 'workbook-id-2'
    },
    
    // Phase 8: Auto-Run State
    'autoRunState': {
        isRunning: true,
        isAborted: false,
        config: {
            searches: [...],
            groupedSearches: {...},
            sources: [...]
        },
        progress: {
            currentSourceIndex: 0,
            currentSearchIndex: 0,
            totalSources: 2,
            totalSearches: 14,
            completedSearches: 5,
            completedSources: 0,
            totalProfiles: 127,
            currentSource: 'Taylor Newman',
            currentSearch: 'Financial Advisor (3/7)',
            startTime: 1732838400000,
            errors: []
        }
    },
    
    // Queue
    'syncQueue': [...],
    'failedRows': [...],
    
    // Scraping state
    'isScrapingActive': false
}
```

### State Initialization

Service worker loads state on startup:
```javascript
async function init() {
    const settings = await getFromStorage([
        'outputSheetId', 'currentTabName', 'activeTab',
        'savedWorkbooks', 'sourceMapping', 'autoRunState'
    ]);
    
    // Restore state
    currentOutputSheetId = settings.outputSheetId;
    currentActiveTab = settings.activeTab;
    savedWorkbooks = settings.savedWorkbooks || [];
    sourceMapping = settings.sourceMapping || {};
    autoRunState = settings.autoRunState || {...};
    
    // Resume auto-run if it was active
    if (autoRunState.isRunning) {
        processAutoRunQueue();
    }
}
```

---

## 📨 Message Passing

### Message Types

#### Popup → Service Worker

```javascript
// Input Sheet
'LOAD_SEARCHES', { inputSheetId }
'GET_SETTINGS'
'SAVE_SETTINGS', { settings }

// Workbook Management
'GET_SAVED_WORKBOOKS'
'SAVE_WORKBOOK', { spreadsheetId, name }
'REMOVE_WORKBOOK', { spreadsheetId }
'ENSURE_WEEKLY_TAB', { spreadsheetId }
'SET_ACTIVE_TAB', { spreadsheetId, tabName }

// Scraping Control
'START_SCRAPING'
'STOP_SCRAPING'
'GET_SCRAPING_STATUS'

// Auto-Run (Phase 8)
'START_AUTO_RUN', { config }
'STOP_AUTO_RUN'
'GET_AUTO_RUN_STATUS'
'CLEAR_AUTO_RUN_STATE'

// Source Mapping (Phase 8)
'GET_SOURCE_MAPPING'
'SAVE_SOURCE_MAPPING', { mapping }

// Queue Management
'GET_QUEUE_STATUS'
'RETRY_FAILED'
'CLEAR_FAILED'

// Comparison (Phase 7)
'COMPARE_TABS', { spreadsheetId, tab1, tab2, outputTab, compareColumn }
```

#### Content Script → Service Worker

```javascript
'DATA_SCRAPED', { rows, pageNumber }
'SCRAPING_COMPLETE', { totalProfiles, totalPages }
'STATUS_UPDATE', { status }
'START_KEEPALIVE'
'STOP_KEEPALIVE'
```

#### Service Worker → Popup

```javascript
'STATUS_UPDATE', { status }
'QUEUE_UPDATED', { synced, failed, pending }
'NOTIFY_COMPLETE', { totalProfiles, totalPages, nextSearch }
'AUTO_RUN_PROGRESS', { progress, isRunning }
```

#### Service Worker → Content Script

```javascript
'START_SCRAPING', { sourceName }
'STOP_SCRAPING'
'GET_STATUS'
'PING'
```

### Message Handler Pattern

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            let response = { success: false };
            
            switch (message.action) {
                case 'ACTION_NAME':
                    // Handle action
                    response = { success: true, data: ... };
                    break;
            }
            
            sendResponse(response);
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    })();
    
    return true; // Keep channel open for async response
});
```

---

## 🔌 API Integrations

### Google Sheets API v4

**Base URL**: `https://sheets.googleapis.com/v4/spreadsheets`

**Authentication**: OAuth 2.0 via `chrome.identity.getAuthToken()`

**Key Endpoints Used**:

```javascript
// Read sheet
GET /{spreadsheetId}/values/{range}

// Append rows
POST /{spreadsheetId}/values/{range}:append

// Batch update (create tab, etc.)
POST /{spreadsheetId}:batchUpdate

// Get spreadsheet metadata
GET /{spreadsheetId}
```

**Range Format**:
- Simple: `Sheet1!A1:Z100`
- With quotes (special chars): `'11_29_25'!A1`
- Append: `'11_29_25'!A1:append` (automatically finds next row)

**Error Handling**:
```javascript
try {
    const result = await apiCall(endpoint, options);
} catch (error) {
    if (error.message.includes('Unable to parse range')) {
        // Tab might not exist, create it
        await createTab(spreadsheetId, tabName);
        // Retry
    }
}
```

### Google Gemini API (Janitor AI)

**Used in**: `google-apps-script/janitor-ai.gs`

**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`

**Purpose**: AI-powered filtering of non-financial advisor profiles

### Google BigQuery API (Enricher)

**Used in**: `google-apps-script/enricher.gs`

**Purpose**: Enriches cleaned differential lists with advisor database and CRM data

**Key Features**:
- Matches profiles against BigQuery discovery tables (advisor database)
- Checks Salesforce CRM (Leads and Opportunities)
- Returns CRD numbers, AUM data, custodian info, CRM status, and more

**Matching Algorithm**:
1. LinkedIn URL match (highest priority)
2. Exact name match
3. Token match + location
4. Token match (no location)
5. Weak fuzzy match (fallback)

**Data Sources**:
- `savvy-gtm-analytics.LeadScoring.staging_discovery_t1/2/3` (advisor database)
- `savvy-gtm-analytics.SavvyGTMData.Lead` (Salesforce Leads)
- `savvy-gtm-analytics.SavvyGTMData.Opportunity` (Salesforce Opportunities)

---

## 🧮 Key Algorithms

### 1. Name Parsing with Accreditations

**Location**: `content/content.js` → `parseNameWithAccreditations()`

**Input**: `"James Weaver, CWS®, QPFC"`

**Output**:
```javascript
{
    cleanName: "James Weaver",
    accreditations: ["CWS®", "QPFC", "", "", "", ""]  // Always 6 columns
}
```

**Logic**:
1. Split by comma
2. First part = name (may include Jr, Sr, II, III, etc.)
3. Remaining parts = accreditations
4. Pad to 6 columns with empty strings

### 2. Pagination Detection

**Location**: `content/content.js` → `detectPaginationState()`

**Logic**:
```javascript
// Count visible page buttons
const pageButtons = document.querySelectorAll('button[data-testid^="pagination-indicator-"]');
const maxPage = Math.max(...pageNumbers);

// Check for Next button
const nextButton = document.querySelector('button[data-testid="pagination-controls-next-button-visible"]');
const hasNext = nextButton !== null;

// Estimate total
let estimatedTotal = maxPage * 10;  // 10 entries per page
if (hasNext) estimatedTotal += 10;  // At least one more page
```

### 3. Deduplication

**Location**: `background/sheets_api.js` → `deduplicateSheet()`

**Algorithm**:
1. Read all rows from sheet
2. Group by Name (Column B)
3. Keep first occurrence of each name
4. Delete duplicate rows (in reverse order to maintain indices)
5. Return statistics

### 4. Tab Comparison (Differential Analysis)

**Location**: `background/sheets_api.js` → `compareTabs()`

**Algorithm**:
1. Read both tabs (baseline and compare)
2. Extract comparison column (Name or LinkedIn URL)
3. Create Set from baseline tab
4. Filter compare tab: keep only rows NOT in baseline Set
5. Write filtered rows to new output tab
6. Return statistics

### 5. Auto-Run Queue Processing

**Location**: `background/service_worker.js` → `processAutoRunQueue()`

**Algorithm**:
```javascript
for each source in sources:
    workbookId = sourceMapping[source]
    ensureWeeklyTab(workbookId)  // Creates MM_DD_YY tab
    updateQueueItemsToNewTab(workbookId, tabName)
    
    for each search in source.searches:
        navigateToLinkedIn(search.url)
        injectContentScript()
        startScraping()
        waitForCompletion()
        updateProgress()
        delay(30-60 seconds)
    
    deduplicateSheet(workbookId, tabName)
    delay(60 seconds)  // Between sources
```

---

## ⚠️ Error Handling

### Queue Retry Logic

```javascript
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

// In processQueue():
if (error) {
    item.retryCount++;
    if (item.retryCount >= MAX_RETRIES) {
        // Move to failed queue
        newFailedRows.push(item);
    } else {
        // Keep in queue for retry
        remainingQueue.push(item);
    }
}
```

### Service Worker Lifecycle

**Problem**: Service workers can be terminated by Chrome

**Solution**: Use `chrome.alarms` to keep worker alive:

```javascript
// During active operations
chrome.alarms.create('AUTO_RUN_KEEPALIVE', { periodInMinutes: 0.167 }); // Every 10 seconds

// Alarm listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'AUTO_RUN_KEEPALIVE') {
        // Check state, log progress
        // This keeps the worker alive
    }
});
```

### Tab Creation Race Conditions

**Problem**: Multiple writes to non-existent tab

**Solution**: Check and create if needed:

```javascript
export async function appendRowsToTab(spreadsheetId, tabName, rows) {
    try {
        await apiCall(...);
    } catch (error) {
        if (error.message.includes('Unable to parse range')) {
            // Tab doesn't exist, create it
            const tabs = await getSheetTabs(spreadsheetId);
            if (!tabs.some(t => t.title === tabName)) {
                await createTab(spreadsheetId, tabName);
                await writeHeadersToTab(spreadsheetId, tabName);
            }
            // Retry append
        }
    }
}
```

---

## 🔄 Extension Lifecycle

### Service Worker Startup

```javascript
// background/service_worker.js
async function init() {
    // 1. Load state from storage
    const settings = await getFromStorage([...]);
    
    // 2. Restore in-memory state
    currentOutputSheetId = settings.outputSheetId;
    currentActiveTab = settings.activeTab;
    // ...
    
    // 3. Resume interrupted operations
    if (autoRunState.isRunning) {
        // Check if alarm exists (not stale)
        const alarm = await chrome.alarms.get('AUTO_RUN_KEEPALIVE');
        if (alarm) {
            processAutoRunQueue();  // Resume
        } else {
            // Stale state, clear it
            autoRunState = { isRunning: false, ... };
        }
    }
    
    // 4. Start queue processor
    startQueueProcessor();
}
```

### Content Script Injection

**When**: On LinkedIn search results pages

**Method**: Programmatic injection via `chrome.scripting.executeScript()`

```javascript
async function ensureContentScript(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { action: 'PING' });
        return true;  // Already injected
    } catch (e) {
        // Not injected, inject it
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/content.js']
        });
        return true;
    }
}
```

### Popup Initialization

```javascript
// popup/popup.js
async function init() {
    // 1. Load settings
    const settings = await sendMessage('GET_SETTINGS');
    
    // 2. Restore UI state
    if (settings.inputSheetId) {
        elements.inputSheetId.value = settings.inputSheetId;
    }
    
    // 3. Load workbooks
    await loadSavedWorkbooks();
    
    // 4. Check for active operations
    await checkAutoRunStatus();  // Reconnect to running auto-run
    await checkScrapingStatus();  // Reconnect to active scraping
    
    // 5. Render UI
    renderSearchList();
    renderSourceMapping();
    updateActionButtons();
}
```

---

## 🛠️ Development Patterns

### Async/Await Pattern

All API calls use async/await:

```javascript
async function doSomething() {
    try {
        const result = await apiCall(endpoint, options);
        return result;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
```

### Storage Helpers

```javascript
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
```

### Message Sending Utility

```javascript
// popup/popup.js
async function sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...data }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}
```

### Error Logging

```javascript
// Consistent error logging format
console.log('[COMPONENT] Action description');
console.error('[COMPONENT] Error description:', error);
console.warn('[COMPONENT] Warning description');
```

**Component prefixes**:
- `[SW]` - Service Worker
- `[CS]` - Content Script
- `[POPUP]` - Popup
- `[SHEETS]` - Sheets API
- `[QUEUE]` - Sync Queue

---

## 🧪 Testing & Debugging

### Chrome DevTools

**Service Worker Console**:
1. Go to `chrome://extensions`
2. Find "Savvy Pirate"
3. Click "service worker" link (opens DevTools)
4. View console logs, set breakpoints

**Content Script Console**:
1. Open LinkedIn page
2. Press F12 (DevTools)
3. Console tab shows `[CS]` logs

**Popup Console**:
1. Right-click extension icon → "Inspect popup"
2. Console tab shows `[POPUP]` logs

### Common Debugging Scenarios

**Issue**: Data not appearing in Google Sheets

**Debug Steps**:
1. Check service worker console for `[QUEUE]` logs
2. Check `chrome.storage.local`:
   ```javascript
   chrome.storage.local.get(['syncQueue', 'failedRows'], console.log);
   ```
3. Check queue status in popup UI
4. Verify tab name matches (check `activeTab` in storage)

**Issue**: Auto-run stops unexpectedly

**Debug Steps**:
1. Check service worker console for errors
2. Verify `AUTO_RUN_KEEPALIVE` alarm exists:
   ```javascript
   chrome.alarms.getAll(console.log);
   ```
3. Check `autoRunState` in storage:
   ```javascript
   chrome.storage.local.get(['autoRunState'], console.log);
   ```
4. Look for `isAborted: true` or error messages in `progress.errors`

**Issue**: Tab name wrong (timezone issue)

**Debug Steps**:
1. Check `getTodayTabName()` function in `sheets_api.js`
2. Verify Eastern Time conversion:
   ```javascript
   const now = new Date();
   const eastern = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
   console.log('Eastern time:', eastern);
   ```

### Storage Inspection

**View all storage**:
```javascript
chrome.storage.local.get(null, (data) => {
    console.table(data);
});
```

**Clear specific key**:
```javascript
chrome.storage.local.remove('autoRunState', () => {
    console.log('Cleared autoRunState');
});
```

**Clear all storage**:
```javascript
chrome.storage.local.clear(() => {
    console.log('Cleared all storage');
});
```

---

## 📝 Code Snippets Reference

### Creating a Weekly Tab

```javascript
// In service_worker.js
const result = await sendMessageToSelf('ENSURE_WEEKLY_TAB', {
    spreadsheetId: workbookId
});

// This calls sheets_api.js
export async function ensureWeeklyTab(spreadsheetId) {
    const tabName = getTodayTabName();  // "11_29_25"
    const tabs = await getSheetTabs(spreadsheetId);
    
    if (tabs.some(t => t.title === tabName)) {
        return { tabName, isNew: false, spreadsheetId };
    }
    
    await createTab(spreadsheetId, tabName);
    await writeHeadersToTab(spreadsheetId, tabName);
    return { tabName, isNew: true, spreadsheetId };
}
```

### Adding Data to Queue

```javascript
// In service_worker.js (DATA_SCRAPED handler)
const tabName = currentActiveTab || currentTabName || 'Sheet1';
await addToQueue(message.rows, currentOutputSheetId, tabName);

// In sync_queue.js
export async function addToQueue(rows, spreadsheetId, tabName) {
    const queueItem = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        spreadsheetId,
        tabName,
        rows,
        retryCount: 0,
        createdAt: new Date().toISOString()
    };
    
    const queue = await getQueue();
    queue.push(queueItem);
    await saveQueue(queue);
    
    processQueue();  // Trigger immediate sync
}
```

### Updating Queue Tab Names

```javascript
// When new weekly tab is created
await updateQueueTabName(spreadsheetId, newTabName);

// In sync_queue.js
export async function updateQueueTabName(spreadsheetId, newTabName) {
    const queue = await getQueue();
    let updatedCount = 0;
    
    for (const item of queue) {
        if (item.spreadsheetId === spreadsheetId) {
            item.tabName = newTabName;
            updatedCount++;
        }
    }
    
    if (updatedCount > 0) {
        await saveQueue(queue);
    }
    
    return updatedCount;
}
```

---

## 🔐 Security Considerations

### OAuth Token Storage

- Tokens stored in Chrome's secure identity storage
- Never logged or exposed in console
- Automatically refreshed by Chrome

### API Keys

- Gemini API key in Google Apps Script (not in extension)
- Google OAuth Client ID in `manifest.json` (can be shared for internal use)

### Data Privacy

- All data stored in user's Google Sheets (their account)
- No data sent to external servers (except Google APIs)
- Local queue data in `chrome.storage.local` (encrypted by Chrome)

---

## 🚀 Performance Optimizations

### Batch Processing

- Queue processes multiple items in sequence
- Google Sheets API calls batched where possible
- Content script scrapes entire page before sending

### Lazy Loading

- Content script waits for lazy-loaded LinkedIn content
- `waitForEntriesToLoad()` ensures all entries are ready

### State Persistence

- Critical state saved to storage immediately
- Prevents data loss on service worker termination
- Auto-run resumes on extension restart

---

## 📚 Additional Resources

- [Chrome Extension Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Google Sheets API v4 Reference](https://developers.google.com/sheets/api/reference/rest)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Runtime Messaging](https://developer.chrome.com/docs/extensions/reference/runtime/#method-sendMessage)

---

**Last Updated**: November 29, 2025  
**Version**: 1.0.0  
**Maintainer**: Engineering Team

