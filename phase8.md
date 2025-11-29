# Phase 8: Auto-Run Batch Queue with Source Mapping

## 🎯 Objective

Build an automated batch processing system that:
1. **Maps Sources to Workbooks**: Explicit user-defined mapping between Source Connections and their target workbooks
2. **Selective Auto-Run**: Checkbox selection for which searches to include in batch
3. **Automatic Processing**: Works through selected searches, automatically switching workbooks per source
4. **Auto-Deduplication**: Automatically deduplicates each workbook after completing all searches for that source (uses existing DEDUPLICATE_SHEET handler)
5. **Uses Existing Conventions**: MM_DD_YY tab naming, weekly tab creation
6. **Manual Deduplication Still Available**: The existing "🧹 Deduplicate" button still works for manual use

**Use Case Example:**
- Input Sheet has 20 searches across 4 sources (Taylor Newman, Morgan Cirotto, etc.)
- User maps each source to their respective workbook using dropdowns
- User selects 15 searches to auto-run (checkboxes)
- Clicks "🚀 Auto-Run Selected"
- System processes each source group sequentially:
  - Switches to source's workbook
  - Creates/uses weekly tab (MM_DD_YY)
  - Scrapes all selected searches for that source
  - Auto-deduplicates the workbook
  - Moves to next source
- User keeps popup open during entire process

---

## 📋 Pre-Implementation Checklist

> ⚠️ **STOP**: Verify these conditions before starting any code generation.

```
✅ Phase 6 (Workbook Manager) is complete and working
✅ Phase 7 (Tab Comparison) is complete (optional but recommended)
✅ Saved workbooks can be loaded and selected
✅ ENSURE_WEEKLY_TAB message handler works (creates MM_DD_YY tabs)
✅ DEDUPLICATE_SHEET message handler works
✅ GET_ACTIVE_OUTPUT message handler works (returns current tab name)
✅ Content script injection works (ensureContentScriptInjected function exists)
✅ Scraping completion detection works (NOTIFY_COMPLETE message from content script)
✅ sendMessage helper function exists in popup.js
✅ getActiveSheet function exists in popup.js
✅ loadSavedWorkbooks function exists (from Phase 6)
✅ Content script has PING handler (responds to { action: 'PING' })
✅ Service worker supports chrome.alarms API
✅ ensureWeeklyTab function is exported from sheets_api.js
✅ deduplicateSheet function is exported from sheets_api.js
```

---

## 🏗️ Architecture Overview

### New Components

```
service_worker.js
├── GET_SOURCE_MAPPING          # NEW: Retrieve saved source-to-workbook mapping
├── SAVE_SOURCE_MAPPING         # NEW: Save source-to-workbook mapping
├── START_AUTO_RUN              # NEW: Start batch queue in background
├── STOP_AUTO_RUN               # NEW: Stop batch queue
├── GET_AUTO_RUN_STATUS         # NEW: Get current progress
├── AUTO_RUN_KEEPALIVE_ALARM    # NEW: Keep service worker alive during auto-run
├── processAutoRunQueue()       # NEW: Main batch queue processor (background)
├── processSourceGroup()        # NEW: Process all searches for one source
└── State: sourceMapping, autoRunState

popup.html
├── Source Mapping Section      # NEW: UI for mapping sources to workbooks
├── Search Selection Checkboxes # MODIFY: Add checkboxes to search list
└── Auto-Run Controls           # NEW: Button and progress display

popup.js
├── State additions             # NEW: sourceMapping, selectedSearches
├── renderSourceMapping()       # NEW: Render mapping interface
├── saveSourceMapping()         # NEW: Persist mapping to storage
├── loadSourceMapping()         # NEW: Load mapping from storage
├── renderSearchListWithCheckboxes()  # MODIFY: Add checkbox selection
├── handleAutoRun()             # MODIFY: Send START_AUTO_RUN message (not process)
├── pollAutoRunStatus()         # NEW: Poll service worker for progress
├── updateAutoRunProgress()     # NEW: Update UI from stored progress
└── groupSearchesBySource()     # NEW: Group selected searches by source

popup.css
├── .mapping-section            # NEW: Mapping UI styles
├── .search-checkbox            # NEW: Checkbox styles
└── .auto-run-controls          # NEW: Auto-run UI styles
```

### Data Flow

```
┌────────────────┐     ┌────────────────┐     ┌─────────────────┐
│ Load Searches  │ ──► │ Show Mapping   │ ──► │ User Maps       │
│ from Input     │     │ Interface      │     │ Sources to WBs  │
└────────────────┘     └────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
┌────────────────┐     ┌────────────────┐     ┌─────────────────┐
│ Select Searches│ ──► │ Click Auto-Run │ ──► │ Send START_     │
│ with Checkboxes│     │                │     │ AUTO_RUN msg     │
└────────────────┘     └────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
┌────────────────────────────────────────────────────────────────┐
│              SERVICE WORKER (Background Processing)             │
│                                                                 │
│  1. Store auto-run config in chrome.storage                    │
│  2. Start AUTO_RUN_KEEPALIVE alarm (keeps SW alive)            │
│  3. FOR EACH SOURCE GROUP:                                     │
│     a. Find mapped workbook                                    │
│     b. Set workbook as active (ENSURE_WEEKLY_TAB)             │
│     c. FOR EACH SEARCH in group:                               │
│        i. Find/create LinkedIn tab                            │
│        ii. Navigate to LinkedIn URL                            │
│        iii. Inject content script                              │
│        iv. Start scraping                                      │
│        v. Wait for completion (NOTIFY_COMPLETE)                │
│        vi. Update progress in chrome.storage                   │
│        vii. Delay 30-60 seconds                                │
│     d. Auto-deduplicate workbook (DEDUPLICATE_SHEET)          │
│     e. Delay 60 seconds before next source                     │
│  4. Mark complete, stop keep-alive alarm                        │
└────────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
┌────────────────────────────────────────────────────────────────┐
│                    POPUP (Can Reconnect Anytime)                │
│                                                                 │
│  - Polls GET_AUTO_RUN_STATUS periodically                      │
│  - Updates progress display from storage                       │
│  - Shows current source/search being processed                 │
│  - Can send STOP_AUTO_RUN message anytime                      │
└────────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │ ✅ Batch Complete│
                                            └─────────────────┘
```

### Storage Schema

```javascript
// chrome.storage.local structure:
{
    // ... existing keys ...
    
    // NEW: Source to Workbook mapping
    sourceMapping: {
        "Taylor Newman": "spreadsheet-id-123",
        "Morgan Cirotto": "spreadsheet-id-456",
        "John Smith": "spreadsheet-id-789"
    },
    
    // NEW: Auto-run state (persisted for popup reconnection)
    autoRunState: {
        isRunning: false,
        isAborted: false,
        config: {
            searches: [...],           // Selected searches with indices
            groupedSearches: {...},    // Grouped by source
            sources: [...]             // Source names in order
        },
        progress: {
            currentSourceIndex: 0,
            currentSearchIndex: 0,
            totalSources: 0,
            totalSearches: 0,
            completedSearches: 0,
            completedSources: 0,
            totalProfiles: 0,
            currentSource: null,
            currentSearch: null,
            startTime: null,
            errors: []
        }
    }
}
```

---

## 🔧 Task 8.1: Add Message Handlers for Source Mapping & Auto-Run

**Status:** 🔲 Not Started  
**Dependencies:** None  
**Estimated Time:** 30-40 minutes

### Objective
Add service worker message handlers for:
1. Source-to-workbook mapping (save/load)
2. Auto-run control (start/stop/status)
3. Auto-run state management

### Files to Modify
- `background/service_worker.js`

### Step-by-Step Instructions

**Step 1: Add state variable for sourceMapping**

**Agent Prompt:**
```
Add a state variable for sourceMapping near the top of background/service_worker.js.

LOCATE: The STATE section (around line 14-20) where other state variables are defined:
// --- STATE ---
let currentOutputSheetId = null;
let currentTabName = 'Sheet1';
let isScrapingActive = false;
let currentSearchIndex = 0;

// PHASE 6: Workbook & Tab State
let currentActiveTab = null;
let savedWorkbooks = [];

ADD after the Phase 6 state variables (after line 22):
// PHASE 8: Source Mapping State
let sourceMapping = {};    // Source Connection → Workbook ID mapping

This will cache the mapping in memory for quick access.
```

**Expected Output:**

```javascript
// --- STATE ---
let currentOutputSheetId = null;
let currentTabName = 'Sheet1';
let isScrapingActive = false;
let currentSearchIndex = 0;

// PHASE 6: Workbook & Tab State
let currentActiveTab = null;
let savedWorkbooks = [];

// PHASE 8: Source Mapping State
let sourceMapping = {};    // Source Connection → Workbook ID mapping
```

**Step 2: Add GET_SOURCE_MAPPING message handler**

**Agent Prompt:**
```
Add a new case 'GET_SOURCE_MAPPING' to the message handler switch statement in service_worker.js.

LOCATE: The switch statement inside chrome.runtime.onMessage.addListener
FIND: Add after the Phase 6 cases, before the 'default:' case

The handler should:
1. Load sourceMapping from chrome.storage.local
2. Update the in-memory sourceMapping variable
3. Return the mapping object

Use existing getFromStorage helper function.
```

**Expected Output:**

```javascript
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
```

**Step 3: Add SAVE_SOURCE_MAPPING message handler**

**Agent Prompt:**
```
Add a new case 'SAVE_SOURCE_MAPPING' to the message handler switch statement.

PLACE: Immediately after the GET_SOURCE_MAPPING case.

The handler should:
1. Accept message.mapping (object with source → workbookId pairs)
2. Save to chrome.storage.local
3. Update in-memory sourceMapping variable
4. Return success status

Use existing saveToStorage helper function.
```

**Expected Output:**

```javascript
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
```

**Step 4: Add auto-run state variable**

**Agent Prompt:**
```
ADD a state variable for auto-run state after sourceMapping:

// PHASE 8: Auto-Run State
let autoRunState = {
    isRunning: false,
    isAborted: false,
    config: null,
    progress: null
};

This tracks the current auto-run status in memory.
```

**Step 5: Add START_AUTO_RUN message handler**

**Agent Prompt:**
```
Add a new case 'START_AUTO_RUN' to the message handler switch statement.

PLACE: After SAVE_SOURCE_MAPPING case.

The handler should:
1. Accept message.config with: searches, groupedSearches, sources
2. Validate all sources are mapped
3. Store config and initialize progress in chrome.storage
4. Start AUTO_RUN_KEEPALIVE alarm
5. Trigger processAutoRunQueue() asynchronously (don't await)
6. Return success immediately (processing happens in background)

CRITICAL: Use chrome.alarms.create() to keep service worker alive.
```

**Expected Output:**

```javascript
case 'START_AUTO_RUN': {
    try {
        // Check if already running
        const stored = await getFromStorage(['autoRunState']);
        if (stored.autoRunState?.isRunning) {
            response = { success: false, error: 'Auto-run is already in progress' };
            break;
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
        chrome.alarms.create('AUTO_RUN_KEEPALIVE', { periodInMinutes: 0.3 }); // Every 18 seconds
        
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

case 'GET_AUTO_RUN_STATUS': {
    try {
        const stored = await getFromStorage(['autoRunState']);
        const state = stored.autoRunState || { isRunning: false };
        
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
```

**Step 6: Add updateAutoRunState helper**

**Agent Prompt:**
```
Add a helper function updateAutoRunState to service_worker.js.

This function should:
1. Accept partial state updates
2. Merge with existing autoRunState
3. Save to chrome.storage
4. Update in-memory autoRunState
5. Send progress update to popup (if popup is listening)

PLACE: Near other helper functions (around line 80-90).
```

**Expected Output:**

```javascript
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
```

**Step 7: Add alarm listener for AUTO_RUN_KEEPALIVE**

**Agent Prompt:**
```
Add a chrome.alarms.onAlarm listener to handle the AUTO_RUN_KEEPALIVE alarm.

LOCATE: After the chrome.runtime.onMessage.addListener block (after all message handlers).

This listener must:
1. Check if alarm name is 'AUTO_RUN_KEEPALIVE'
2. Verify auto-run is still active
3. Clear alarm if auto-run finished
4. Log progress to keep service worker alive

CRITICAL: Without this listener, the service worker will still terminate.
```

**Expected Output:**

```javascript
// ============================================================
// PHASE 8: ALARM HANDLER (Keep Service Worker Alive)
// ============================================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'AUTO_RUN_KEEPALIVE') {
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
        console.log(`[SW] Auto-run progress: ${state.progress?.completedSearches || 0}/${state.progress?.totalSearches || 0} searches`);
    }
});
```

**Step 8: Update initialization to load autoRunState**

**Agent Prompt:**
```
ADD 'autoRunState' to the getFromStorage call in initialization.

Also, if autoRunState.isRunning is true on startup, resume processing.
This handles cases where extension was reloaded during auto-run.
```

**Expected Output:**

```javascript
// In initialization:
const settings = await getFromStorage([
    'outputSheetId', 
    'currentTabName', 
    'searchIndex', 
    'savedWorkbooks', 
    'activeTab',
    'sourceMapping',
    'autoRunState'  // NEW: Add this
]);

// ... existing assignments ...

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
```

**Expected Output:**

```javascript
// Update the initialization section:
(async () => {
    try {
        const settings = await getFromStorage([
            'outputSheetId', 
            'currentTabName', 
            'searchIndex', 
            'savedWorkbooks', 
            'activeTab',
            'sourceMapping'  // NEW: Add this
        ]);
        currentOutputSheetId = settings.outputSheetId || null;
        currentTabName = settings.currentTabName || 'Sheet1';
        currentSearchIndex = settings.searchIndex || 0;
        savedWorkbooks = settings.savedWorkbooks || [];
        currentActiveTab = settings.activeTab || null;
        sourceMapping = settings.sourceMapping || {};  // NEW: Add this
        startQueueProcessor();
        console.log('[SW] Service worker initialized');
    } catch (error) {
        console.error('[SW] Init error:', error);
    }
})();
```

### Verification Steps

1. **Syntax Check:**
   ```bash
   # Reload extension in Chrome
   # Check service worker console for errors
   # Should see: "[SW] Service worker initialized"
   ```

2. **Message Handler Test:**
   ```javascript
   // In popup console or background console:
   chrome.runtime.sendMessage({ action: 'GET_SOURCE_MAPPING' }, console.log);
   // Should return: { success: true, mapping: {} }
   
   chrome.runtime.sendMessage({ 
       action: 'SAVE_SOURCE_MAPPING', 
       mapping: { "Test Source": "test-id-123" } 
   }, console.log);
   // Should return: { success: true, mapping: { "Test Source": "test-id-123" } }
   ```

3. **Persistence Test:**
   ```javascript
   // Save a mapping
   chrome.runtime.sendMessage({ 
       action: 'SAVE_SOURCE_MAPPING', 
       mapping: { "Taylor Newman": "abc123" } 
   }, console.log);
   
   // Reload extension, then:
   chrome.runtime.sendMessage({ action: 'GET_SOURCE_MAPPING' }, console.log);
   // Should return the saved mapping
   ```

### 🧪 Gate Check 8.1

```
✅ sourceMapping state variable added
✅ GET_SOURCE_MAPPING handler returns mapping object
✅ SAVE_SOURCE_MAPPING handler saves and returns mapping
✅ Initialization loads sourceMapping from storage
✅ No syntax errors on extension reload
✅ Messages return expected responses
✅ Mapping persists across extension reloads
```

**If gate check passes:** Proceed to Task 8.2  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 8.2: Add Source Mapping UI to popup.html

**Status:** 🔲 Not Started  
**Dependencies:** Task 8.1 must be complete  
**Estimated Time:** 25-30 minutes

### Objective
Add a Source Mapping section that shows unique sources from loaded searches and allows mapping each to a saved workbook.

### Files to Modify
- `popup/popup.html`

### Step-by-Step Instructions

**Step 1: Locate insertion point**

**Agent Prompt:**
```
Read popup/popup.html and locate the search list section.

The Source Mapping section should be added:
- AFTER the search list section (where searches are displayed)
- BEFORE the scraping action buttons

Look for the element with class "search-list" or id "searchList".
The mapping section should appear between the search list and the action buttons.

IDENTIFY: The exact HTML location by finding:
1. The search list container
2. The action buttons (Start Scraping, Stop, etc.)
```

**Step 2: Add Source Mapping HTML section**

**Agent Prompt:**
```
Add the Source Mapping section HTML at the identified location in popup/popup.html.

REQUIREMENTS:
- Section is hidden by default (shown after searches are loaded)
- Contains a mapping list container that will be dynamically populated
- Has Save Mapping and Clear buttons
- Has an Auto-Run Selected button (disabled until all sources are mapped)
- Includes progress display for auto-run
- Uses consistent class naming with existing sections

Place this section AFTER the search list, BEFORE action buttons.
```

**Expected Output:**

```html
<!-- Source Mapping Section (NEW - Phase 8) -->
<section class="section mapping-section" id="mappingSection" style="display: none;">
    <h2>🔗 Source → Workbook Mapping</h2>
    <p class="section-description">
        Map each Source Connection to its destination workbook. All sources must be mapped before Auto-Run.
    </p>
    
    <!-- Mapping Status -->
    <div class="mapping-status-bar" id="mappingStatusBar">
        <span class="mapped-count">Mapped: <strong id="mappedCount">0</strong></span>
        <span class="unmapped-count">Unmapped: <strong id="unmappedCount">0</strong></span>
    </div>
    
    <!-- Mapping List Container -->
    <div class="mapping-list" id="mappingList">
        <!-- Dynamically populated with source → workbook dropdowns -->
        <p class="placeholder">Load searches to see sources</p>
    </div>
    
    <!-- Mapping Actions -->
    <div class="mapping-actions">
        <button id="saveMappingBtn" class="btn btn-primary btn-small">
            💾 Save Mapping
        </button>
        <button id="clearMappingBtn" class="btn btn-secondary btn-small">
            🗑️ Clear All
        </button>
        <button id="autoMapBtn" class="btn btn-secondary btn-small" title="Auto-match sources to workbooks with same name">
            🔮 Auto-Map
        </button>
    </div>
</section>

<!-- Auto-Run Section (NEW - Phase 8) -->
<section class="section auto-run-section" id="autoRunSection" style="display: none;">
    <h2>🚀 Auto-Run Batch Queue</h2>
    
    <!-- Selection Summary -->
    <div class="selection-summary" id="selectionSummary">
        <div class="summary-item">
            <span class="label">Selected Searches:</span>
            <span class="value" id="selectedSearchCount">0</span>
        </div>
        <div class="summary-item">
            <span class="label">Sources to Process:</span>
            <span class="value" id="selectedSourceCount">0</span>
        </div>
    </div>
    
    <!-- Auto-Run Controls -->
    <div class="auto-run-controls">
        <button id="selectAllSearchesBtn" class="btn btn-secondary btn-small">
            ☑️ Select All
        </button>
        <button id="deselectAllSearchesBtn" class="btn btn-secondary btn-small">
            ☐ Deselect All
        </button>
    </div>
    
    <button id="autoRunBtn" class="btn btn-primary btn-large" disabled>
        🚀 Auto-Run Selected
    </button>
    
    <button id="stopAutoRunBtn" class="btn btn-danger btn-large" style="display: none;">
        ⏹️ Stop Auto-Run
    </button>
    
    <!-- Auto-Run Progress -->
    <div class="auto-run-progress" id="autoRunProgress" style="display: none;">
        <div class="progress-header">
            <span class="progress-title" id="autoRunTitle">Processing...</span>
            <span class="progress-detail" id="autoRunDetail">-</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-fill" id="autoRunProgressFill" style="width: 0%;"></div>
        </div>
        <div class="progress-stats">
            <div class="stat">
                <span class="stat-label">Source:</span>
                <span class="stat-value" id="currentSourceName">-</span>
            </div>
            <div class="stat">
                <span class="stat-label">Search:</span>
                <span class="stat-value" id="currentSearchInfo">-</span>
            </div>
            <div class="stat">
                <span class="stat-label">Profiles Scraped:</span>
                <span class="stat-value" id="autoRunProfileCount">0</span>
            </div>
        </div>
    </div>
    
    <!-- Auto-Run Log -->
    <div class="auto-run-log" id="autoRunLog" style="display: none;">
        <h4>Activity Log</h4>
        <div class="log-entries" id="logEntries">
            <!-- Dynamically populated -->
        </div>
    </div>
</section>
```

**Step 3: Modify search list to include checkboxes**

**Agent Prompt:**
```
LOCATE: The search list section in popup.html.

The search list rendering is done dynamically in popup.js, but we need to ensure
the container can support checkboxes. 

CHECK: That the search list container exists:
<div class="search-list" id="searchList">

NO HTML CHANGES NEEDED HERE - the checkboxes will be added via JavaScript.
Just verify the container exists and note its location.
```

### Verification Steps

1. **HTML Validation:**
   - Open popup in browser
   - Check that new sections exist but are hidden
   - Verify no HTML syntax errors in console

2. **Element IDs Check:**
   - All new IDs are unique:
     - `mappingSection`, `mappingStatusBar`, `mappedCount`, `unmappedCount`
     - `mappingList`, `saveMappingBtn`, `clearMappingBtn`, `autoMapBtn`
     - `autoRunSection`, `selectionSummary`, `selectedSearchCount`, `selectedSourceCount`
     - `selectAllSearchesBtn`, `deselectAllSearchesBtn`, `autoRunBtn`, `stopAutoRunBtn`
     - `autoRunProgress`, `autoRunTitle`, `autoRunDetail`, `autoRunProgressFill`
     - `currentSourceName`, `currentSearchInfo`, `autoRunProfileCount`
     - `autoRunLog`, `logEntries`

3. **Structure Check:**
   - Sections are properly nested
   - All tags are closed
   - Classes follow existing patterns

### 🧪 Gate Check 8.2

```
✅ mappingSection added and hidden by default
✅ autoRunSection added and hidden by default
✅ All required element IDs are present and unique
✅ No HTML syntax errors
✅ Sections appear in logical order (after search list)
✅ Button states are correct (autoRunBtn disabled)
```

**If gate check passes:** Proceed to Task 8.3  
**If gate check fails:** Fix HTML issues before continuing

---

## 🔧 Task 8.3: Add CSS Styling for Mapping and Auto-Run

**Status:** 🔲 Not Started  
**Dependencies:** Task 8.2 must be complete  
**Estimated Time:** 20-25 minutes

### Objective
Add CSS styles for the source mapping interface and auto-run controls, matching existing pirate theme.

### Files to Modify
- `popup/popup.css`

### Step-by-Step Instructions

**Agent Prompt:**
```
Add CSS styles to popup/popup.css for Phase 8 components.

REQUIREMENTS:
- Match existing pirate theme (black/red color scheme)
- Style mapping items with source name, dropdown, and status indicator
- Style selection checkboxes in search list
- Style auto-run progress display
- Style activity log
- Add visual feedback for mapped/unmapped states

Add these styles at the END of the CSS file after existing Phase 6/7 styles.
```

**Expected Output:**

```css
/* ============================================================
   PHASE 8: SOURCE MAPPING & AUTO-RUN STYLES
   ============================================================ */

/* --- Mapping Section --- */
.mapping-section {
    margin-top: 15px;
}

.mapping-section .section-description {
    font-size: 12px;
    color: #888;
    margin-bottom: 12px;
    font-style: italic;
}

.mapping-status-bar {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #1a1a1a;
    border-radius: 4px;
    margin-bottom: 10px;
    font-size: 12px;
}

.mapping-status-bar .mapped-count {
    color: #28a745;
}

.mapping-status-bar .unmapped-count {
    color: #ffc107;
}

.mapping-status-bar strong {
    font-weight: 700;
}

.mapping-list {
    max-height: 250px;
    overflow-y: auto;
    border: 1px solid #444;
    border-radius: 6px;
    background: #1a1a1a;
    margin-bottom: 12px;
}

.mapping-list .placeholder {
    padding: 20px;
    text-align: center;
    color: #666;
    font-style: italic;
}

.mapping-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid #333;
}

.mapping-item:last-child {
    border-bottom: none;
}

.mapping-item:hover {
    background: #222;
}

.mapping-source-info {
    flex: 0 0 140px;
    min-width: 0;
}

.mapping-source-name {
    font-weight: 600;
    color: #f0f0f0;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mapping-search-count {
    font-size: 11px;
    color: #888;
}

.mapping-workbook-select {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a2a;
    color: #fff;
    font-size: 12px;
    min-width: 0;
}

.mapping-workbook-select:focus {
    border-color: #dc3545;
    outline: none;
}

.mapping-workbook-select.mapped {
    border-color: #28a745;
}

.mapping-status-icon {
    font-size: 16px;
    min-width: 24px;
    text-align: center;
}

.mapping-status-icon.mapped {
    color: #28a745;
}

.mapping-status-icon.unmapped {
    color: #ffc107;
}

.mapping-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

/* --- Search List Checkboxes --- */
.search-item {
    position: relative;
}

.search-item .search-checkbox-container {
    display: flex;
    align-items: center;
    margin-right: 10px;
}

.search-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #dc3545;
}

.search-item.selected {
    background: rgba(220, 53, 69, 0.1);
    border-left: 3px solid #dc3545;
}

/* --- Auto-Run Section --- */
.auto-run-section {
    margin-top: 15px;
    border: 2px solid #dc3545;
    background: #1a0a0a;
}

.selection-summary {
    display: flex;
    justify-content: space-around;
    padding: 10px;
    background: #0a0a0a;
    border-radius: 6px;
    margin-bottom: 12px;
}

.selection-summary .summary-item {
    text-align: center;
}

.selection-summary .label {
    font-size: 11px;
    color: #888;
    display: block;
}

.selection-summary .value {
    font-size: 20px;
    font-weight: 700;
    color: #dc3545;
}

.auto-run-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.btn-large {
    width: 100%;
    padding: 14px 20px;
    font-size: 16px;
    font-weight: 600;
}

#autoRunBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

#autoRunBtn:not(:disabled) {
    animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
    0%, 100% {
        box-shadow: 0 0 5px rgba(220, 53, 69, 0.3);
    }
    50% {
        box-shadow: 0 0 20px rgba(220, 53, 69, 0.6);
    }
}

/* --- Auto-Run Progress --- */
.auto-run-progress {
    margin-top: 15px;
    padding: 15px;
    background: #0a0a0a;
    border-radius: 8px;
    border: 1px solid #333;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
}

.progress-title {
    font-weight: 600;
    color: #dc3545;
    font-size: 14px;
}

.progress-detail {
    font-size: 12px;
    color: #888;
}

.progress-bar-container {
    height: 8px;
    background: #333;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
}

.auto-run-progress .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #dc3545, #ff6b6b);
    border-radius: 4px;
    transition: width 0.3s ease;
}

.progress-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

.progress-stats .stat {
    text-align: center;
    padding: 8px;
    background: #1a1a1a;
    border-radius: 4px;
}

.progress-stats .stat-label {
    font-size: 10px;
    color: #666;
    display: block;
    margin-bottom: 2px;
}

.progress-stats .stat-value {
    font-size: 13px;
    font-weight: 600;
    color: #f0f0f0;
}

/* --- Activity Log --- */
.auto-run-log {
    margin-top: 15px;
    padding: 12px;
    background: #0a0a0a;
    border-radius: 6px;
    border: 1px solid #333;
}

.auto-run-log h4 {
    margin: 0 0 10px 0;
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.log-entries {
    max-height: 150px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 11px;
}

.log-entry {
    padding: 4px 8px;
    border-bottom: 1px solid #222;
}

.log-entry:last-child {
    border-bottom: none;
}

.log-entry.info {
    color: #888;
}

.log-entry.success {
    color: #28a745;
}

.log-entry.warning {
    color: #ffc107;
}

.log-entry.error {
    color: #dc3545;
}

.log-entry .timestamp {
    color: #555;
    margin-right: 8px;
}

/* --- Auto-Run Running State --- */
.auto-run-section.running {
    border-color: #28a745;
    animation: running-border 1s infinite alternate;
}

@keyframes running-border {
    from {
        border-color: #28a745;
    }
    to {
        border-color: #44ff44;
    }
}

/* --- Responsive Adjustments --- */
@media (max-width: 400px) {
    .progress-stats {
        grid-template-columns: 1fr;
    }
    
    .mapping-item {
        flex-wrap: wrap;
    }
    
    .mapping-source-info {
        flex: 1 1 100%;
        margin-bottom: 8px;
    }
}
```

### Verification Steps

1. **CSS Validation:**
   - Reload extension
   - Check for CSS syntax errors

2. **Visual Check:**
   - Temporarily show mapping section (remove style="display: none")
   - Verify styling matches theme
   - Check responsive behavior

### 🧪 Gate Check 8.3

```
✅ All Phase 8 CSS classes defined
✅ No CSS syntax errors
✅ Styling matches pirate theme
✅ Mapping items have correct layout
✅ Progress display styled
✅ Log entries have color coding
✅ Responsive adjustments work
```

**If gate check passes:** Proceed to Task 8.4  
**If gate check fails:** Fix CSS issues before continuing

---

## 🔧 Task 8.4: Add State and Element References to popup.js

**Status:** 🔲 Not Started  
**Dependencies:** Tasks 8.2 and 8.3 must be complete  
**Estimated Time:** 15-20 minutes

### Objective
Add state variables and DOM element references for the new Phase 8 components.

### Files to Modify
- `popup/popup.js`

### Step-by-Step Instructions

**Step 1: Add state variables**

**Agent Prompt:**
```
Add state variables for Phase 8 to the 'state' object in popup.js.

LOCATE: The 'state' object definition near the top of the file.

ADD these new state variables:
- sourceMapping: {}           // Source name → Workbook ID mapping
- selectedSearches: new Set() // Indices of selected searches for auto-run
- isAutoRunning: false        // Whether batch queue is running
- autoRunAborted: false       // Whether user requested stop
- autoRunStats: { ... }       // Statistics for current auto-run

ENSURE: No duplicate property names with existing state.
```

**Expected Output:**

```javascript
// Add to state object:
const state = {
    // ... existing state properties ...
    
    // PHASE 8: Auto-Run Batch Queue
    sourceMapping: {},            // Source name → Workbook ID
    selectedSearches: new Set(),  // Set of selected search indices
    isAutoRunning: false,         // Batch queue running state
    autoRunAborted: false,        // User requested abort
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
```

**Step 2: Add element references**

**Agent Prompt:**
```
Add element references for Phase 8 components to the 'elements' object in popup.js.

LOCATE: The 'elements' object definition.

ADD references for all new Phase 8 elements:
- Mapping section elements
- Auto-run section elements
- Progress display elements
- Log elements

Group them together with a comment: // --- Phase 8: Auto-Run ---
```

**Expected Output:**

```javascript
// Add to elements object:
const elements = {
    // ... existing element references ...
    
    // --- Phase 8: Source Mapping ---
    mappingSection: document.getElementById('mappingSection'),
    mappingStatusBar: document.getElementById('mappingStatusBar'),
    mappedCount: document.getElementById('mappedCount'),
    unmappedCount: document.getElementById('unmappedCount'),
    mappingList: document.getElementById('mappingList'),
    saveMappingBtn: document.getElementById('saveMappingBtn'),
    clearMappingBtn: document.getElementById('clearMappingBtn'),
    autoMapBtn: document.getElementById('autoMapBtn'),
    
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
    logEntries: document.getElementById('logEntries'),
};
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Open popup
   - Check console for undefined element errors

2. **Element Verification:**
   ```javascript
   // In popup console:
   console.log('Mapping section:', elements.mappingSection);
   console.log('Auto-run button:', elements.autoRunBtn);
   // Both should return HTML elements, not null
   ```

### 🧪 Gate Check 8.4

```
✅ All state variables added to state object
✅ All element references added to elements object
✅ No duplicate property names
✅ No syntax errors on popup load
✅ Elements are accessible (not null)
```

**If gate check passes:** Proceed to Task 8.5  
**If gate check fails:** Fix issues before continuing

---

## 🔧 Task 8.5: Implement Source Mapping Logic

**Status:** 🔲 Not Started  
**Dependencies:** Task 8.4 must be complete  
**Estimated Time:** 35-45 minutes

### Objective
Implement functions to extract unique sources, render mapping interface, and save/load mappings.

### Files to Modify
- `popup/popup.js`

### Step-by-Step Instructions

**Step 1: Add getUniqueSources helper function**

**Agent Prompt:**
```
Add a helper function getUniqueSources to popup.js.

This function should:
1. Accept the searches array
2. Extract unique source names
3. Count searches per source
4. Return array of { name, count, searches } objects

Place this function in the HELPER FUNCTIONS section or create one if needed.
```

**Expected Output:**

```javascript
// ============================================================
// PHASE 8: SOURCE MAPPING FUNCTIONS
// ============================================================

/**
 * Extract unique sources from searches array
 * @param {Array} searches - Array of search objects with 'source' property
 * @returns {Array} Array of { name, count, searches } objects
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
```

**Step 2: Add loadSourceMapping function**

**Agent Prompt:**
```
Add loadSourceMapping function to popup.js.

This function should:
1. Send GET_SOURCE_MAPPING message to service worker
2. Update state.sourceMapping with the response
3. Return the mapping object
4. Handle errors gracefully

Use existing sendMessage helper.
```

**Expected Output:**

```javascript
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
```

**Step 3: Add saveSourceMapping function**

**Agent Prompt:**
```
Add saveSourceMapping function to popup.js.

This function should:
1. Collect mapping from all dropdown selections in the UI
2. Send SAVE_SOURCE_MAPPING message to service worker
3. Update state.sourceMapping
4. Show success/error status
5. Update the mapping status display
```

**Expected Output:**

```javascript
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
```

**Step 4: Add renderSourceMapping function**

**Agent Prompt:**
```
Add renderSourceMapping function to popup.js.

This function should:
1. Get unique sources from loaded searches
2. Load saved mapping
3. Load saved workbooks
4. Render mapping items (source name, dropdown, status)
5. Update mapping status counts
6. Show the mapping section
7. Add change event listeners to dropdowns

CRITICAL: Each dropdown must have data-source attribute for identification.
```

**Expected Output:**

```javascript
/**
 * Render the source mapping interface
 */
async function renderSourceMapping() {
    // Check if we have searches loaded
    if (!state.searches || state.searches.length === 0) {
        elements.mappingSection.style.display = 'none';
        elements.autoRunSection.style.display = 'none';
        return;
    }
    
    // Show sections
    elements.mappingSection.style.display = 'block';
    elements.autoRunSection.style.display = 'block';
    
    // Get unique sources
    const uniqueSources = getUniqueSources(state.searches);
    
    // Load saved mapping and workbooks
    await loadSourceMapping();
    await loadSavedWorkbooks();
    
    // Check if we have any workbooks
    if (!state.savedWorkbooks || state.savedWorkbooks.length === 0) {
        elements.mappingList.innerHTML = `
            <div class="mapping-empty-state">
                <p>⚠️ No saved workbooks found.</p>
                <p>Add workbooks in the Workbook Manager section first.</p>
            </div>
        `;
        return;
    }
    
    // Render mapping items
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
    const statusIcon = item.querySelector('.mapping-status-icon');
    
    // Update visual state
    if (workbookId) {
        select.classList.add('mapped');
        statusIcon.textContent = '✓';
        statusIcon.className = 'mapping-status-icon mapped';
        state.sourceMapping[sourceName] = workbookId;
    } else {
        select.classList.remove('mapped');
        statusIcon.textContent = '⚠';
        statusIcon.className = 'mapping-status-icon unmapped';
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
```

**Step 5: Add autoMap function**

**Agent Prompt:**
```
Add autoMapSources function to popup.js.

This function should:
1. Get all unique sources
2. For each source, find a workbook with matching name (case-insensitive)
3. Auto-select matching workbooks in dropdowns
4. Update mapping state
5. Show how many were auto-mapped

This is a convenience feature - user can override.
```

**Expected Output:**

```javascript
/**
 * Auto-map sources to workbooks with matching names
 */
async function autoMapSources() {
    if (!state.savedWorkbooks || state.savedWorkbooks.length === 0) {
        updateStatus('❌ No saved workbooks to auto-map');
        return;
    }
    
    let mappedCount = 0;
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
```

**Step 6: Add clearMapping function**

**Agent Prompt:**
```
Add clearSourceMapping function to popup.js.

This function should:
1. Clear all dropdown selections
2. Reset mapping state
3. Update displays
```

**Expected Output:**

```javascript
/**
 * Clear all source mappings
 */
function clearSourceMapping() {
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
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check console for errors

2. **Function Tests:**
   ```javascript
   // In popup console after loading searches:
   console.log('Unique sources:', getUniqueSources(state.searches));
   ```

3. **UI Test:**
   - Load searches
   - Verify mapping section appears
   - Verify dropdowns populate with workbooks
   - Verify mapped/unmapped status updates

### 🧪 Gate Check 8.5

```
✅ getUniqueSources returns correct structure
✅ loadSourceMapping loads from storage
✅ saveSourceMapping saves to storage
✅ renderSourceMapping shows mapping interface
✅ handleMappingChange updates state and UI
✅ updateMappingStatusDisplay shows correct counts
✅ autoMapSources matches sources to workbooks
✅ clearSourceMapping resets all mappings
✅ No syntax errors
```

**If gate check passes:** Proceed to Task 8.6  
**If gate check fails:** Fix issues before continuing

---

## 🔧 Task 8.6: Modify Search List for Checkbox Selection

**Status:** 🔲 Not Started  
**Dependencies:** Task 8.5 must be complete  
**Estimated Time:** 25-30 minutes

### Objective
Modify the search list rendering to include checkboxes for selecting which searches to include in auto-run.

### Files to Modify
- `popup/popup.js`

### Step-by-Step Instructions

**Step 1: Modify renderSearchList function**

**Agent Prompt:**
```
LOCATE: The existing renderSearchList function in popup.js.

MODIFY it to:
1. Add a checkbox before each search item
2. Track selected state using state.selectedSearches Set
3. Add 'selected' class to selected items
4. Maintain existing functionality (completed, current states)

IMPORTANT: 
- Keep all existing functionality
- Checkboxes should be checked by default
- Add data-index attribute to checkboxes
```

**Expected Output:**

```javascript
/**
 * Render search list with selection checkboxes
 * MODIFIED for Phase 8: Added checkbox selection for auto-run
 */
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
        item.classList.add('selected');
    } else {
        state.selectedSearches.delete(index);
        item.classList.remove('selected');
    }
    
    updateSelectionSummary();
    updateAutoRunButtonState();
}
```

**Step 2: Add selection helper functions**

**Agent Prompt:**
```
Add functions for selecting/deselecting all searches and updating the selection summary.
```

**Expected Output:**

```javascript
/**
 * Select all searches for auto-run
 */
function selectAllSearches() {
    state.searches.forEach((_, index) => {
        state.selectedSearches.add(index);
    });
    
    // Update checkboxes
    elements.searchList.querySelectorAll('.search-checkbox').forEach(cb => {
        cb.checked = true;
        cb.closest('.search-item').classList.add('selected');
    });
    
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
    elements.searchList.querySelectorAll('.search-checkbox').forEach(cb => {
        cb.checked = false;
        cb.closest('.search-item').classList.remove('selected');
    });
    
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

/**
 * Update auto-run button enabled state
 */
function updateAutoRunButtonState() {
    if (!elements.autoRunBtn) return;
    
    const hasSelectedSearches = state.selectedSearches.size > 0;
    
    // Check if all selected sources are mapped
    const selectedSources = new Set();
    state.selectedSearches.forEach(index => {
        const search = state.searches[index];
        if (search) {
            selectedSources.add(search.source || 'Unknown');
        }
    });
    
    let allMapped = true;
    selectedSources.forEach(source => {
        if (!state.sourceMapping[source]) {
            allMapped = false;
        }
    });
    
    const canAutoRun = hasSelectedSearches && allMapped && !state.isAutoRunning;
    
    elements.autoRunBtn.disabled = !canAutoRun;
    
    // Update button text to show why disabled
    if (!hasSelectedSearches) {
        elements.autoRunBtn.textContent = '🚀 Select Searches First';
    } else if (!allMapped) {
        elements.autoRunBtn.textContent = '🚀 Map All Sources First';
    } else {
        elements.autoRunBtn.textContent = '🚀 Auto-Run Selected';
    }
}
```

**Step 3: Initialize selected searches when loading**

**Agent Prompt:**
```
LOCATE: The handleLoadSearches function in popup.js (around line 990-1037).

FIND the end of the try block, after renderSearchList() is called:
renderSearchList();
updateStatus(`✅ Loaded ${state.searches.length} searches`, 100);
setConnected(true);

ADD after setConnected(true), before the closing brace of the try block:

// PHASE 8: Initialize selection and mapping
selectAllSearches();
await renderSourceMapping();
```

**Expected Output:**

```javascript
// In handleLoadSearches, after setConnected(true):

// PHASE 8: Initialize selection and mapping
selectAllSearches();
await renderSourceMapping();
```

### Verification Steps

1. **Visual Check:**
   - Load searches
   - Verify checkboxes appear
   - Verify all are checked by default

2. **Selection Test:**
   - Toggle checkboxes
   - Verify selection summary updates
   - Verify 'selected' class toggles

3. **Button State Test:**
   - Deselect all - button should disable
   - Select some but don't map - button should show "Map All Sources First"
   - Map all and select - button should enable

### 🧪 Gate Check 8.6

```
✅ Checkboxes render in search list
✅ Checkboxes are checked by default
✅ handleSearchCheckboxChange updates state
✅ selectAllSearches works correctly
✅ deselectAllSearches works correctly
✅ updateSelectionSummary shows correct counts
✅ updateAutoRunButtonState enables/disables correctly
✅ Button text indicates why disabled
✅ renderSourceMapping called after loading searches
```

**If gate check passes:** Proceed to Task 8.7  
**If gate check fails:** Fix issues before continuing

---

## 🔧 Task 8.7: Implement Auto-Run Batch Queue Logic (Service Worker)

**Status:** 🔲 Not Started  
**Dependencies:** Tasks 8.1-8.6 must be complete  
**Estimated Time:** 60-75 minutes

### Objective
Implement the core batch queue processing logic **entirely in the service worker** that:
1. Processes searches grouped by source
2. Switches workbooks automatically
3. Manages LinkedIn tab navigation
4. Waits for scraping completion
5. Auto-deduplicates after each source
6. **Runs independently of popup** (continues when popup closes)
7. **Stores all state in chrome.storage** (popup only reads/displays)

**IMPORTANT:** The popup does NOT process searches. It only:
- Sends START_AUTO_RUN message with config
- Polls GET_AUTO_RUN_STATUS for progress
- Receives AUTO_RUN_PROGRESS messages for real-time updates
- Displays progress UI

### Files to Modify
- `background/service_worker.js` (main processing logic)
- `popup/popup.js` (send START_AUTO_RUN message, poll status)

### Step-by-Step Instructions

**Step 1: Add processAutoRunQueue function to service_worker.js**

**Agent Prompt:**
```
Add processAutoRunQueue async function to service_worker.js.

This is the MAIN processing loop that runs in the background.

LOCATE: Add after the updateAutoRunState helper function (around line 100-120).

The function should:
1. Load autoRunState from storage
2. Loop through sources in order
3. For each source:
   a. Get mapped workbook
   b. Call processSourceGroup (to be created next)
   c. Check for abort flag
4. Mark complete when done
5. Stop keep-alive alarm
6. Handle errors gracefully

CRITICAL: This runs in background, so all state must be persisted to chrome.storage.
```

**Expected Output:**

```javascript
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
```

**Step 2: Add processSourceGroup function to service_worker.js**

**Agent Prompt:**
```
Add processSourceGroup async function to service_worker.js.

This processes all searches for a single source.

LOCATE: Add after processAutoRunQueue function.

The function should:
1. Accept sourceName, workbookId, searches array, and sourceIndex
2. Activate workbook (ENSURE_WEEKLY_TAB message to self)
3. Find or create LinkedIn tab
4. Loop through searches:
   a. Navigate tab to LinkedIn URL
   b. Wait for page load
   c. Inject content script
   d. Send START_SCRAPING message to content script
   e. Wait for NOTIFY_COMPLETE message
   f. Update progress in storage
   g. Delay 30-60 seconds
5. After all searches, deduplicate workbook
6. Update progress

CRITICAL: All state updates must go to chrome.storage for persistence.
```

**Expected Output:**

```javascript
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
                // Navigate to LinkedIn URL
                await chrome.tabs.update(linkedInTab.id, { url: search.url });
                
                // Wait for page load
                await waitForTabLoad(linkedInTab.id);
                
                // Ensure content script is injected
                await ensureContentScript(linkedInTab.id);
                
                // Wait for scraping completion
                const completionPromise = waitForScrapingComplete();
                
                // Start scraping
                await chrome.tabs.sendMessage(linkedInTab.id, {
                    action: 'START_SCRAPING',
                    sourceName: sourceName
                });
                
                // Wait for completion
                const completionData = await completionPromise;
                
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
                
                // Delay before next search (30-60 seconds, random)
                if (i < searches.length - 1) {
                    const delay = 30000 + Math.random() * 30000; // 30-60 seconds
                    console.log(`[SW] Waiting ${Math.round(delay/1000)}s before next search...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
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
        
        // Step 4: Deduplicate workbook after all searches
        console.log(`[SW] Deduplicating workbook for ${sourceName}...`);
        const dedupeResult = await sendMessageToSelf('DEDUPLICATE_SHEET', {
            spreadsheetId: workbookId,
            tabName: tabName
        });
        
        if (dedupeResult.success) {
            console.log(`[SW] ✅ Deduplicated: removed ${dedupeResult.removedCount || 0} duplicates`);
        } else {
            console.error(`[SW] Deduplication failed:`, dedupeResult.error);
        }
        
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
```

**Step 3: Add helper functions to service_worker.js**

**Agent Prompt:**
```
Add these helper functions to service_worker.js:

1. sendMessageToSelf(action, data) - Send message to self (for calling other handlers)
2. findLinkedInTab() - Find existing LinkedIn tab or return null
3. waitForTabLoad(tabId) - Wait for tab to finish loading
4. ensureContentScript(tabId) - Ensure content script is injected
5. waitForScrapingComplete() - Wait for NOTIFY_COMPLETE message

LOCATE: Add after processSourceGroup function.
```

**Expected Output:**

```javascript

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

> ⚠️ **PREREQUISITE:** The content script (`content/content.js`) must have a PING handler.
> 
> **CHECK** that content.js has this in its message listener:
> ```javascript
> case 'PING':
>     sendResponse({ success: true, message: 'Content script active' });
>     break;
> ```
> 
> **IF MISSING**, add it to the content script's message handler switch statement before proceeding.

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
            if (message.action === 'NOTIFY_COMPLETE' && !resolved) {
                resolved = true;
                clearTimeout(timeout);
                chrome.runtime.onMessage.removeListener(listener);
                
                resolve({
                    totalProfiles: message.totalProfiles || 0,
                    totalPages: message.totalPages || 0
                });
            }
            
            sendResponse({ received: true });
            return true;
        };
        
        chrome.runtime.onMessage.addListener(listener);
        console.log('[SW] Registered completion listener');
    });
}
```

**Step 4: Add sendMessageToSelf helper function**

**Agent Prompt:**
```
Add sendMessageToSelf function to service_worker.js.

This function calls internal handler logic directly (we're in the same file).

LOCATE: Add after processSourceGroup function, before other helper functions.
```

**Expected Output:**

```javascript
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
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check for errors

2. **Partial Test:**
   - Load 2-3 searches
   - Map sources to workbooks
   - Click Auto-Run
   - Verify it starts processing

3. **Abort Test:**
   - Start auto-run
   - Click Stop
   - Verify it stops after current scrape

### 🧪 Gate Check 8.7

```
✅ groupSelectedSearchesBySource returns correct structure
✅ addLogEntry creates log entries with correct styling
✅ updateAutoRunProgress updates all display elements
✅ wait/waitForPageLoad/waitForScrapingComplete work correctly
✅ processSourceGroup processes all searches for a source
✅ processSourceGroup calls DEDUPLICATE_SHEET after completion
✅ handleAutoRun orchestrates the full batch queue
✅ handleStopAutoRun sets abort flag
✅ UI updates correctly during auto-run
✅ Progress bar updates
```

**If gate check passes:** Proceed to Task 8.8  
**If gate check fails:** Fix issues before continuing

---

## 🔧 Task 8.8: Add Popup UI for Auto-Run (Send Messages & Poll Status)

**Status:** 🔲 Not Started  
**Dependencies:** Task 8.7 must be complete  
**Estimated Time:** 30-40 minutes

### Objective
Update popup.js to:
1. Send `START_AUTO_RUN` message to service worker (not process locally)
2. Poll `GET_AUTO_RUN_STATUS` periodically to update UI
3. Display progress from stored state
4. Allow stopping via `STOP_AUTO_RUN` message
5. **Work even when popup is closed/reopened** (state persists in storage)

### Files to Modify
- `popup/popup.js`

### Step-by-Step Instructions

**Step 1: Add AUTO_RUN_PROGRESS message listener**

**Agent Prompt:**
```
Add a message listener in popup.js to receive real-time progress updates from the service worker.

LOCATE: Near the top of popup.js, after state and element declarations, or in the init() function.
```

**Expected Output:**

```javascript
// ============================================================
// PHASE 8: Listen for Auto-Run Progress Updates from Service Worker
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'AUTO_RUN_PROGRESS') {
        console.log('[POPUP] Received progress update:', message);
        
        // Update UI with progress
        if (message.progress) {
            updateAutoRunProgressFromServiceWorker(message.progress, message.isRunning);
        }
        
        sendResponse({ received: true });
    }
    return true; // Keep channel open for async response
});

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
```

**Step 2: Replace handleAutoRun to send START_AUTO_RUN message**

**Agent Prompt:**
```
REPLACE the entire handleAutoRun function in popup.js.

The new function should:
1. Validate selected searches and mappings
2. Group searches by source
3. Send START_AUTO_RUN message to service worker with config
4. Start polling for status updates
5. Update UI to show progress

LOCATE: Find the existing handleAutoRun function (from old Task 8.7) and replace it entirely.
```

**Expected Output:**

```javascript
/**
 * Handle Auto-Run button click (POPUP SIDE)
 * Sends config to service worker and lets it run in background
 */
async function handleAutoRun() {
    // Validate
    const selectedSearches = Array.from(state.selectedSearches);
    if (selectedSearches.length === 0) {
        updateStatus('❌ No searches selected', 0);
        return;
    }
    
    // Check all sources are mapped
    const grouped = groupSelectedSearchesBySource();
    const sources = Object.keys(grouped);
    const unmapped = sources.filter(s => !state.sourceMapping[s]);
    
    if (unmapped.length > 0) {
        updateStatus(`❌ Unmapped sources: ${unmapped.join(', ')}`, 0);
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
        addLogEntry('🚀 Starting auto-run...', 'info');
        
        const response = await sendMessage('START_AUTO_RUN', { config });
        
        if (response.success) {
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
            addLogEntry(`❌ Failed to start: ${response.error}`, 'error');
            updateStatus(`❌ ${response.error}`, 0);
        }
        
    } catch (error) {
        console.error('[POPUP] Auto-run start error:', error);
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    }
}

/**
 * Handle Stop button click
 */
async function handleStopAutoRun() {
    try {
        addLogEntry('⏹️ Requesting stop...', 'warning');
        
        const response = await sendMessage('STOP_AUTO_RUN');
        
        if (response.success) {
            addLogEntry('⏹️ Stop requested - will stop after current scrape completes', 'warning');
        } else {
            addLogEntry(`❌ Stop failed: ${response.error}`, 'error');
        }
        
    } catch (error) {
        console.error('[POPUP] Stop error:', error);
        addLogEntry(`❌ Error: ${error.message}`, 'error');
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
            return;
        }
        
        const { isRunning, progress, percent } = response;
        
        if (isRunning) {
            // Auto-run in progress - show UI and start polling
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
            
        } else if (progress && progress.completedSearches > 0) {
            // Auto-run completed - show results
            console.log('[POPUP] Found completed auto-run results');
            
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
        
    } catch (error) {
        console.error('[POPUP] Error checking auto-run status:', error);
    }
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
```

**Step 2: Add event listeners for mapping section**

**Agent Prompt:**
```
LOCATE: The initialization section in popup.js where event listeners are registered.

ADD event listeners for:
- saveMappingBtn → saveSourceMapping
- clearMappingBtn → clearSourceMapping
- autoMapBtn → autoMapSources

Use null-safe patterns: elements.saveMappingBtn?.addEventListener(...)
```

**Expected Output:**

```javascript
// Add to init() function or event listener section:

// --- Phase 8: Mapping Event Listeners ---
elements.saveMappingBtn?.addEventListener('click', saveSourceMapping);
elements.clearMappingBtn?.addEventListener('click', clearSourceMapping);
elements.autoMapBtn?.addEventListener('click', autoMapSources);
```

**Step 2: Add event listeners for auto-run section**

**Agent Prompt:**
```
ADD event listeners for:
- selectAllSearchesBtn → selectAllSearches
- deselectAllSearchesBtn → deselectAllSearches
- autoRunBtn → handleAutoRun
- stopAutoRunBtn → handleStopAutoRun
```

**Expected Output:**

```javascript
// --- Phase 8: Auto-Run Event Listeners ---
elements.selectAllSearchesBtn?.addEventListener('click', selectAllSearches);
elements.deselectAllSearchesBtn?.addEventListener('click', deselectAllSearches);
elements.autoRunBtn?.addEventListener('click', handleAutoRun);
elements.stopAutoRunBtn?.addEventListener('click', handleStopAutoRun);
```

**Step 3: Verify or add loadSavedWorkbooks helper**

**Agent Prompt:**
```
CHECK if loadSavedWorkbooks function already exists in popup.js.

SEARCH for: function loadSavedWorkbooks

IF it exists (it should, from Phase 6):
- Verify it sends GET_SAVED_WORKBOOKS message
- Verify it updates state.savedWorkbooks
- No changes needed - it's already implemented

IF it doesn't exist (unlikely):
- Add the function as shown below
- Place it near other Phase 6 workbook functions (around line 273)
```

**Expected Output:**

```javascript
/**
 * Load saved workbooks from storage
 * @returns {Promise<Array>} Array of saved workbooks
 */
async function loadSavedWorkbooks() {
    try {
        const response = await sendMessage('GET_SAVED_WORKBOOKS');
        if (response.success) {
            state.savedWorkbooks = response.workbooks || [];
            console.log(`[POPUP] Loaded ${state.savedWorkbooks.length} saved workbooks`);
        }
        return state.savedWorkbooks;
    } catch (error) {
        console.error('[POPUP] Error loading workbooks:', error);
        state.savedWorkbooks = [];
        return [];
    }
}
```

**Step 4: Add checkAutoRunStatus to initialization**

**Agent Prompt:**
```
LOCATE: The init() function or popup load handler in popup.js.

ADD a call to checkAutoRunStatus() at the end of initialization.

This will reconnect to a running auto-run if the popup is reopened.
```

**Expected Output:**

```javascript
// In init() function or DOMContentLoaded handler:

// ... existing initialization code ...

// PHASE 8: Check for running auto-run (reconnect if popup reopened)
await checkAutoRunStatus();
```

**Step 5: Verify handleLoadSearches integration**

**Agent Prompt:**
```
LOCATE: The handleLoadSearches function in popup.js (around line 990-1037).

VERIFY that at the end of the try block (after renderSearchList()), there are calls to:
1. selectAllSearches() - Select all searches by default
2. await renderSourceMapping() - Show mapping interface

IF these calls are missing (from Task 8.6 Step 3), ADD them:
// PHASE 8: Initialize selection and mapping
selectAllSearches();
await renderSourceMapping();

IF they already exist, verify they are in the correct location and order.
```

### Verification Steps

1. **Click Tests:**
   - Click Save Mapping → Should save
   - Click Clear → Should clear all
   - Click Auto-Map → Should attempt auto-matching
   - Click Select All → Should select all
   - Click Deselect All → Should deselect all
   - Click Auto-Run → Should start (if valid)
   - Click Stop → Should request stop

2. **Integration Test:**
   - Load searches from input sheet
   - Verify mapping section appears
   - Verify all searches are selected
   - Verify source mapping dropdowns work

### 🧪 Gate Check 8.8

```
✅ All mapping buttons have event listeners
✅ All auto-run buttons have event listeners
✅ loadSavedWorkbooks function exists and works
✅ handleLoadSearches calls selectAllSearches
✅ handleLoadSearches calls renderSourceMapping
✅ No console errors on popup load
✅ All click handlers fire correctly
```

**If gate check passes:** Proceed to Task 8.9  
**If gate check fails:** Fix issues before continuing

---

## 🔧 Task 8.9: Integration Testing

**Status:** 🔲 Not Started  
**Dependencies:** All previous tasks must be complete  
**Estimated Time:** 30-45 minutes

### Objective
Comprehensive testing of the complete auto-run batch queue feature.

### Test Scenarios

**Test 1: Basic Flow - Small Scale (Background Processing)**
```
Setup:
1. Create Input Sheet with 4 searches (2 sources, 2 searches each)
   Example: Taylor Newman (2 searches), Morgan Cirotto (2 searches)
2. Create 2 workbooks in Google Sheets, one for each source
3. Save workbooks in Workbook Manager (name them "Taylor Newman" and "Morgan Cirotto")
4. IMPORTANT: Open a LinkedIn page in a tab (any LinkedIn page) before starting

Test:
1. Load searches from Input Sheet
2. Verify mapping section appears with 2 sources
3. Map each source to its workbook (use dropdowns)
4. Click "Save Mapping"
5. Verify all 4 searches are checked by default
6. Verify "Auto-Run Selected" button is enabled
7. Click "Auto-Run Selected"
8. Confirm the dialog (note: says you can close popup!)
9. **CLOSE THE POPUP** (this is the key test!)
10. Wait 30 seconds
11. **REOPEN THE POPUP**
12. Observe:
    - Progress UI shows current status
    - Progress bar shows correct percentage
    - Current source/search displayed
    - Log shows "Reconnected to running auto-run"
13. Close popup again, wait, reopen
14. Verify progress continues to update
15. Wait for completion (or check after completion)
16. Verify:
    - First source processed (2 searches sequentially)
    - After first source: deduplicate ran
   - 60 second delay
    - Second source processed (2 searches)
    - After second source: deduplicate ran
    - Completion message shows

Expected Results:
- Both workbooks have data in dated tabs (MM_DD_YY format)
- No duplicates in either workbook (check manually)
- Progress updates even when popup is closed
- Popup can reconnect and show current status
- Progress bar reaches 100%
- Summary shows correct counts
```

**Test 2: Partial Selection**
```
1. Load searches (4 total)
2. Deselect 2 searches (1 per source)
3. Verify summary shows "2 searches, 2 sources"
4. Auto-Run
5. Verify only selected searches are processed
```

**Test 3: Auto-Map Feature**
```
1. Name workbooks exactly like source names
2. Load searches
3. Clear mapping
4. Click Auto-Map
5. Verify sources auto-match to workbooks
```

**Test 4: Abort Mid-Run**
```
1. Start auto-run with 4+ searches
2. During processing, click Stop
3. Verify current scrape completes
4. Verify no more searches start
5. Verify deduplication still runs for completed source
```

**Test 5: Error Recovery**
```
1. Start auto-run with 3+ searches
2. During second search, close the LinkedIn tab
3. Verify:
   - Error is logged: "Page load timeout" or similar
   - Error is added to stats.errors array
   - Next search attempts to start (may also fail if tab closed)
   - Overall process continues (doesn't crash)
   - Final summary shows errors count
4. Verify partial data was saved before error
```

**Test 6: Mapping Persistence**
```
1. Create and save mapping
2. Close and reopen popup
3. Load same searches
4. Verify mapping is restored
```

### Console Verification

**Service Worker Console:**
```
[SW] Received: GET_SOURCE_MAPPING
[SW] Loaded source mapping with X entries
[SW] Received: ENSURE_WEEKLY_TAB
[SW] Received: SET_ACTIVE_TAB
[SW] Received: DEDUPLICATE_SHEET
```

**Popup Console:**
```
[POPUP] Loaded source mapping: X entries
[POPUP] Loaded X saved workbooks
[AUTO-RUN] [INFO] Starting auto-run: X searches, Y sources
[AUTO-RUN] [INFO] 📚 Starting source: Taylor Newman
[AUTO-RUN] [SUCCESS] ✅ Completed: X profiles
[AUTO-RUN] [SUCCESS] ✅ Deduplicated: removed X duplicates
```

### 🧪 Final Gate Check

```
✅ Source mapping UI renders correctly
✅ Mapping saves and loads correctly
✅ Auto-map feature works
✅ Search selection works (all/none/partial)
✅ Auto-run button enables only when valid
✅ Auto-run processes sources sequentially
✅ Workbook switches correctly between sources
✅ Weekly tabs are created/reused correctly
✅ Scraping works within auto-run
✅ Completion is detected correctly
✅ Auto-deduplicate runs after each source
✅ Delays between searches (30-60s)
✅ Delays between sources (60s)
✅ Abort functionality works
✅ Error recovery continues processing
✅ Progress display updates correctly
✅ Activity log shows all events
✅ Final summary is accurate
✅ No memory leaks (check after long run)
```

---

## ⚠️ CRITICAL REQUIREMENTS

### Background Processing (Service Worker)
**SOLUTION**: Auto-run logic runs in the **background service worker**, not the popup.

**Why This Works:**
- Service workers can run independently of popup
- Use `chrome.alarms` to keep service worker alive (already implemented)
- Progress stored in `chrome.storage` for persistence
- Popup can reconnect and see progress anytime
- User can close popup, switch tabs, work elsewhere - auto-run continues

**Architecture:**
- Popup sends `START_AUTO_RUN` message with configuration
- Service worker processes batch queue in background
- Progress updates stored in `chrome.storage.local`
- Popup queries `GET_AUTO_RUN_STATUS` to see progress
- Service worker sends `AUTO_RUN_PROGRESS` messages (if popup is open)

### LinkedIn Tab Requirement
**IMPORTANT**: Auto-run navigates the CURRENT active tab. User must have a LinkedIn tab open.

**Implementation:**
- Check for LinkedIn tab before starting
- Use `chrome.tabs.update()` to navigate (not create new tabs)
- Verify tab exists before navigation

### Helper Functions That Must Exist
Before starting, verify these functions exist in popup.js:
- `escapeHtml()` - Used for rendering HTML safely (line ~727)
- `sendMessage()` - Message passing helper (line ~123)
- `ensureContentScriptInjected()` - Content script injection (line ~164)
- `getActiveSheet()` - Gets current active sheet (line ~444)
- `loadSavedWorkbooks()` - Loads saved workbooks from Phase 6 (line ~273)
- `updateStatus()` - Updates status message display
- `sendTabMessage()` - Sends message to content script (used by ensureContentScriptInjected)

---

## 🚨 Common Pitfalls & Anti-Bug Directives

### Critical Issues to Avoid

1. **Race Condition: Scrape Completion Detection**
   - **Problem**: waitForScrapingComplete listener might miss the NOTIFY_COMPLETE message
   - **Solution**: 
     - Register listener BEFORE starting scrape (critical!)
     - Create completionPromise BEFORE sendMessage('START_SCRAPING')
     - Use resolved flag to prevent double-resolution
   - **Code Pattern**: 
     ```javascript
     const completionPromise = waitForScrapingComplete(); // Register FIRST
     await chrome.tabs.sendMessage(tabId, { action: 'START_SCRAPING' });
     await completionPromise; // Wait for completion
     ```
   - **Check**: Verify completionPromise is created before START_SCRAPING message

2. **Tab Context Lost**
   - **Problem**: Content script not available after navigation
   - **Solution**: Always call ensureContentScriptInjected after navigation
   - **Code**: See processSourceGroup Step 2

3. **Popup Closes During Auto-Run**
   - **Problem**: Auto-run stops if popup is closed (Chrome extension limitation)
   - **Solution**: 
     - Add warning in confirmation dialog: "Keep popup open during auto-run"
     - Consider using chrome.windows.create() to open popup in a window (future enhancement)
     - For now, user must keep popup open
   - **Note**: This is a fundamental limitation - popup scripts stop when popup closes

4. **Message Listener Accumulation**
   - **Problem**: Multiple listeners registered if not cleaned up
   - **Solution**: Remove listener after receiving completion
   - **Code**: See waitForScrapingComplete

5. **State Not Reset on Error**
   - **Problem**: isAutoRunning stays true after error
   - **Solution**: Use try/finally to always reset state
   - **Code**: See handleAutoRun finally block

6. **Undefined Elements**
   - **Problem**: Accessing properties on null elements
   - **Solution**: Use optional chaining: elements.btn?.disabled
   - **Check**: All element accesses use ?. or null checks

7. **Set vs Array Confusion**
   - **Problem**: selectedSearches is a Set, not Array
   - **Solution**: Use .has(), .add(), .delete(), .size
   - **Check**: Never use [index] on selectedSearches

8. **Async Event Handlers**
   - **Problem**: Unhandled promise rejections
   - **Solution**: Wrap in try/catch
   - **Code**: See all async handlers

### Code Quality Checklist

Before each task completion:

- [ ] All new functions are properly exported/accessible
- [ ] Console logs use correct prefix: `[POPUP]` or `[AUTO-RUN]`
- [ ] All async functions have error handling
- [ ] State is properly initialized
- [ ] UI elements are null-checked before access
- [ ] Event listeners check element existence
- [ ] Sets are used correctly (not as arrays)
- [ ] Promises are properly awaited
- [ ] Cleanup happens in finally blocks

---

## 📚 Reference

### Message Flow Summary

```
Popup                    Service Worker           Sheets API
──────                   ──────────────           ──────────
GET_SOURCE_MAPPING →     getFromStorage()    →    -
                   ←     { mapping }         ←    -

SAVE_SOURCE_MAPPING →    saveToStorage()     →    -
                    ←    { success }         ←    -

ENSURE_WEEKLY_TAB   →    ensureWeeklyTab()  →    API calls
                    ←    { tabName, isNew }  ←    Response

SET_ACTIVE_TAB      →    save to storage    →    -
                    ←    { success }        ←    -

START_SCRAPING      →    content script     →    LinkedIn DOM
(to content script)

NOTIFY_COMPLETE     ←    from content       ←    Scraping done
(from content)           script

DEDUPLICATE_SHEET   →    deduplicateSheet() →    API calls
                    ←    { removed }        ←    Response
```

### State Variables Reference

```javascript
// popup.js state additions for Phase 8
state.sourceMapping = {};            // { "Taylor Newman": "sheet-id-123", ... }
state.selectedSearches = new Set();  // Set(0, 1, 2, 3, ...)
state.isAutoRunning = false;
state.autoRunAborted = false;
state.autoRunStats = {
    totalSearches: 0,
    completedSearches: 0,
    totalSources: 0,
    completedSources: 0,
    totalProfiles: 0,
    currentSource: null,
    currentSearch: null,
    startTime: null
};
```

### Element IDs Reference

| ID | Type | Purpose |
|----|------|---------|
| mappingSection | section | Mapping UI container |
| mappingList | div | List of source → workbook mappings |
| mappedCount | span | Count of mapped sources |
| unmappedCount | span | Count of unmapped sources |
| saveMappingBtn | button | Save mapping to storage |
| clearMappingBtn | button | Clear all mappings |
| autoMapBtn | button | Auto-match by name |
| autoRunSection | section | Auto-run UI container |
| selectedSearchCount | span | Count of selected searches |
| selectedSourceCount | span | Count of sources in selection |
| selectAllSearchesBtn | button | Select all searches |
| deselectAllSearchesBtn | button | Deselect all searches |
| autoRunBtn | button | Start auto-run |
| stopAutoRunBtn | button | Stop auto-run |
| autoRunProgress | div | Progress display container |
| autoRunProgressFill | div | Progress bar fill |
| currentSourceName | span | Current source being processed |
| currentSearchInfo | span | Current search info |
| autoRunProfileCount | span | Total profiles scraped |
| autoRunLog | div | Activity log container |
| logEntries | div | Log entry container |

---

## 🤖 Agent Execution Instructions

### For Cursor AI / Claude Code

**Copy this prompt to start:**

```
Follow the plan in `phase8-auto-run-batch-queue.md` exactly.

EXECUTION RULES:
1. Complete ONE task at a time
2. Do NOT proceed to next task until current task passes Gate Check
3. ALWAYS run linter check after each file modification
4. ALWAYS check for TypeScript/type errors if applicable
5. Test in browser after each task
6. Log progress: "✅ Task 8.X complete, proceeding to 8.Y"

CRITICAL CHECKS:
- After modifying service_worker.js: Reload extension, check SW console
- After modifying popup.html: Open popup, check for render errors
- After modifying popup.css: Verify styling matches theme
- After modifying popup.js: Reload popup, check console for errors

START: Task 8.1 - Add message handlers to service_worker.js

CRITICAL REMINDERS:
- Popup must stay open during auto-run (Chrome limitation)
- User must have a LinkedIn tab open before starting
- All helper functions listed above must exist
- Test with 2-3 searches first before full batch
```

### Task Execution Order

```
Task 8.1: service_worker.js (message handlers)
├── Add: sourceMapping state variable
├── Add: GET_SOURCE_MAPPING case
├── Add: SAVE_SOURCE_MAPPING case
├── Update: initialization to load sourceMapping
└── Gate: Messages return expected responses

Task 8.2: popup.html (UI sections)
├── Add: mappingSection HTML
├── Add: autoRunSection HTML
└── Gate: Sections render, IDs exist

Task 8.3: popup.css (styling)
├── Add: Mapping section styles
├── Add: Auto-run section styles
├── Add: Progress and log styles
└── Gate: Styling matches theme

Task 8.4: popup.js (state & elements)
├── Add: state variables
├── Add: element references
└── Gate: No null element errors

Task 8.5: popup.js (mapping logic)
├── Add: getUniqueSources()
├── Add: loadSourceMapping()
├── Add: saveSourceMapping()
├── Add: renderSourceMapping()
├── Add: handleMappingChange()
├── Add: autoMapSources()
├── Add: clearSourceMapping()
└── Gate: Mapping UI fully functional

Task 8.6: popup.js (search selection)
├── Modify: renderSearchList() for checkboxes
├── Add: handleSearchCheckboxChange()
├── Add: selectAllSearches()
├── Add: deselectAllSearches()
├── Add: updateSelectionSummary()
├── Add: updateAutoRunButtonState()
└── Gate: Selection works, button state correct

Task 8.7: popup.js (batch queue logic)
├── Add: groupSelectedSearchesBySource()
├── Add: addLogEntry()
├── Add: updateAutoRunProgress()
├── Add: wait(), waitForPageLoad(), waitForScrapingComplete()
├── Add: processSourceGroup()
├── Add: handleAutoRun()
├── Add: handleStopAutoRun()
└── Gate: Auto-run processes correctly

Task 8.8: popup.js (event listeners)
├── Add: mapping event listeners
├── Add: auto-run event listeners
├── Add: loadSavedWorkbooks() if missing
├── Update: handleLoadSearches integration
└── Gate: All buttons work

Task 8.9: Integration Testing
├── Test: All scenarios
└── Gate: End-to-end workflow verified
```

### If Agent Gets Stuck

1. **"sourceMapping undefined"**: 
   - Check initialization in service_worker.js (line ~582)
   - Verify 'sourceMapping' is in getFromStorage array
   - Verify sourceMapping = settings.sourceMapping || {}; is executed

2. **"Cannot read property of null"**: 
   - Add null checks: elements.btn?.disabled
   - Verify all element references exist in HTML
   - Check elements object initialization

3. **"Scraping never completes"**: 
   - Verify waitForScrapingComplete listener is registered BEFORE START_SCRAPING
   - Check that NOTIFY_COMPLETE message is being sent from content script
   - Verify listener is not removed prematurely
   - Check timeout value (default 10 minutes)

4. **"Workbook not found"**: 
   - Verify loadSavedWorkbooks() is called before renderSourceMapping()
   - Check state.savedWorkbooks is populated
   - Verify workbook ID matches exactly (case-sensitive)

5. **"Deduplication fails"**: 
   - Verify GET_ACTIVE_OUTPUT returns correct tabName
   - Check that ENSURE_WEEKLY_TAB was called and succeeded
   - Verify tabName is passed to DEDUPLICATE_SHEET message
   - Check tab exists in workbook

6. **"Button stays disabled"**: 
   - Debug updateAutoRunButtonState() logic
   - Check: hasSelectedSearches, allMapped, !isAutoRunning
   - Verify state.sourceMapping has entries for all selected sources
   - Check button text shows why disabled

7. **"Content script injection fails"**: 
   - Verify ensureContentScriptInjected() is called AFTER page load
   - Check manifest.json has content script permissions
   - Verify content/content.js file exists
   - Try refreshing the LinkedIn page manually

8. **"Tab navigation fails"**: 
   - Verify current tab exists: chrome.tabs.query({ active: true })
   - Check tab has permission to navigate
   - Verify URL is valid LinkedIn search URL
   - Check for popup blockers

9. **"Auto-run stops unexpectedly"**: 
   - Check if popup was closed (Chrome limitation)
   - Verify state.autoRunAborted is not being set incorrectly
   - Check for unhandled promise rejections
   - Verify error handling in try/catch blocks

---

*Generated for agentic execution with Cursor AI. Each task is self-contained with verification gates.*