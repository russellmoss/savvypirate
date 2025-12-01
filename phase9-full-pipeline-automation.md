# Phase 9: Full Pipeline Automation

## Prerequisites

Before implementing Phase 9, ensure the following are in place:

1. **Phase 7: Compare Tabs** must be fully working
   - `compareTabs()` function exists in `background/sheets_api.js`
   - Compare Tabs UI is functional in the popup

2. **Phase 8: Auto-Run** must be fully working
   - Auto-run queue processing works correctly
   - Source mapping to workbooks is functional
   - Scraping completes and writes to dated tabs

3. **Apps Script Installation**
   - `janitor-ai.gs` must be installed on target Google Sheets workbooks
   - `enricher.gs` must be installed on target Google Sheets workbooks
   - Both scripts are bound to the workbooks (not standalone projects)

4. **Apps Script Configuration**
   - Gemini API key must be configured in `janitor-ai.gs` (constant `GEMINI_API_KEY`)
   - BigQuery project access must be configured in `enricher.gs` (constant `BQ_PROJECT_ID`)

5. **BigQuery Access**
   - BigQuery tables must be accessible from Apps Script
   - Required tables: `staging_discovery_t1`, `staging_discovery_t2`, `staging_discovery_t3`, `Lead`, `Opportunity`

---

## Quick Start (For Existing Users)

If you already have Phase 7 and Phase 8 working, follow these steps to enable the pipeline:

### Step 1: Deploy Apps Script as Web App

1. Open your Google Sheet with Apps Script installed
2. Go to `Extensions → Apps Script`
3. Add the `doPost()` handlers to both `janitor-ai.gs` and `enricher.gs` (see Step 8)
4. Click `Deploy → New deployment`
5. Select `Web app` as the type
6. Configure:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` or `Anyone with Google account`
7. Click `Deploy` and copy the Web App URL (ends in `/exec`)

### Step 2: Configure Workbook in Extension

1. Open the extension popup
2. Go to **Workbook Manager**
3. Select or add your workbook
4. In the **Pipeline Settings** section:
   - Paste the Web App URL from Step 1
   - Select a **Baseline Tab** (the tab to compare against)
   - Click **Save**

### Step 3: Enable Pipeline

1. In the popup, find the **Pipeline** section
2. Toggle **Enable Pipeline** to ON
3. Check which steps you want: **Compare**, **Janitor**, **Enrich**
4. Settings are saved automatically

### Step 4: Run Auto-Run

1. Load your searches and map sources to workbooks (existing Phase 8 flow)
2. Click **Start Auto-Run** as normal
3. The pipeline will automatically run after scraping completes for each workbook
4. Watch the pipeline badges for progress: 📊 Compare → 🧹 Janitor → 💎 Enrich

**That's it!** The pipeline runs automatically after each scraping session.

---

## Overview

This phase implements a complete automated pipeline that orchestrates:
1. **Scraping** → Scrape LinkedIn searches to new weekly tabs
2. **Comparison** → Compare new scraping against baseline tab to find new leads
3. **Cleaning** → Run Janitor AI on the new leads tab
4. **Enrichment** → Run BigQuery enrichment on the cleaned new leads tab

This extends the existing auto-run functionality to include post-scraping automation without losing any current functionality.

---

## Architecture

### Current Codebase Structure (Audit Results)

#### Saved Workbooks Structure
Each workbook in `savedWorkbooks` array currently has:
```javascript
{
  id: string,              // Workbook ID (e.g., "1abc...")
  name: string,            // User-friendly name
  sheetTitle: string,      // Official sheet title from API
  lastUsed: string,        // ISO date string
  lastTab: string,         // Last tab name used (optional)
  addedAt: string          // ISO date when workbook was added
}
```

#### Source Mapping Structure
`sourceMapping` is a simple object mapping source connection names to workbook IDs:
```javascript
{
  "John Doe": "workbookId123",
  "Jane Smith": "workbookId456"
}
```

#### Existing Functions We'll Reuse
- **`compareTabs()`** in `background/sheets_api.js`
  - Signature: `compareTabs(spreadsheetId, tab1Name, tab2Name, outputTabName, keyColumn = 1)`
  - Returns: `{success: boolean, newEntries: number, tab1Count: number, tab2Count: number, outputTabName: string, error?: string}`
  
- **`getSheetTabs()`** in `background/sheets_api.js`
  - Used to fetch available tabs for a workbook (already used in Compare Tabs UI)

### Minimal Workbook Structure Extensions

**Add to each workbook object** (extend existing structure, don't create parallel):
```javascript
{
  // ... existing properties ...
  webAppUrl: string | null,        // NEW: Apps Script Web App deployment URL
  pipelineBaselineTab: string | null  // NEW: Default baseline tab for comparison
}
```

**Optional global pipeline settings** (stored separately in `chrome.storage.local`):
```javascript
{
  pipelineConfig: {
    enabled: boolean,              // Global pipeline toggle
    compareEnabled: boolean,       // Enable comparison step
    janitorEnabled: boolean,       // Enable Janitor AI step
    enrichEnabled: boolean         // Enable BigQuery enrichment step
  }
}
```

### Pipeline Flow

```
User Configures Pipeline
    ↓
Select Searches + Map to Workbooks (existing sourceMapping)
    ↓
For each workbook:
    - Optionally set baseline tab (stored in workbook.pipelineBaselineTab)
    - Optionally set Apps Script Web App URL (stored in workbook.webAppUrl)
    ↓
Configure Global Pipeline Steps (Compare, Janitor, Enrich)
    ↓
Start Pipeline Run
    ↓
For each source/workbook:
    ├─ Scrape all searches → New Weekly Tab (existing)
    ├─ Compare: New Tab vs Baseline Tab → New Leads Tab (reuse compareTabs())
    ├─ Janitor: Clean New Leads Tab via Web App (if enabled)
    └─ Enrich: BigQuery Enrich New Leads Tab via Web App (if enabled)
    ↓
Pipeline Complete
```

### Key Components

1. **Pipeline Configuration UI** (popup)
   - Global toggle and step checkboxes
   - Per-workbook baseline tab selector (stored in workbook object)
   - Per-workbook Apps Script Web App URL input (stored in workbook object)
   - New leads tab naming convention (global default)

2. **Pipeline Orchestrator** (service_worker.js)
   - Extends `processSourceGroup()` to run pipeline steps after scraping
   - Reads pipeline config from workbook objects (not separate structure)
   - Reuses existing `compareTabs()` function
   - Calls Apps Script Web Apps via HTTP POST

3. **Apps Script Integration** (new: `background/apps_script_api.js`)
   - Executes Janitor AI and Enricher via Web App HTTP POST
   - No OAuth needed (Web Apps are deployed with public access)
   - Simple fetch() calls to Web App deployment URLs

4. **State Management**
   - Pipeline config extends existing `savedWorkbooks` structure
   - Global pipeline settings stored separately (for defaults)
   - No parallel data structures needed

---

## Implementation Steps

### Step 0: Verify Existing Codebase (Agent Pre-Flight)

**Before implementing, verify these exist in the codebase:**

1. **In `background/sheets_api.js`**:
   - [ ] `compareTabs()` function exists with signature: `compareTabs(spreadsheetId, tab1Name, tab2Name, outputTabName, keyColumn)`
   - [ ] `getSheetTabs()` function exists

2. **In `background/service_worker.js`**:
   - [ ] `processSourceGroup()` function exists
   - [ ] `updateAutoRunState()` function exists
   - [ ] `getFromStorage()` / `saveToStorage()` helpers exist
   - [ ] `savedWorkbooks` state variable exists

3. **In `popup/popup.js`**:
   - [ ] `sendMessage()` helper exists (wrapper for `chrome.runtime.sendMessage`)
   - [ ] `state.workbooks` or `state.savedWorkbooks` exists
   - [ ] Workbook Manager section exists in HTML

**If any are missing, stop and report before proceeding.**

---

### Step 1: Create Apps Script Web App Integration Module

**File**: `background/apps_script_api.js` (NEW)

**Purpose**: Execute Google Apps Script functions via Web App HTTP POST. This approach doesn't require OAuth scopes and is simpler than the Apps Script API.

**Complete implementation**:

```javascript
/**
 * Call an Apps Script function via Web App deployment
 * @param {string} webAppUrl - The deployed Web App URL (ends in /exec)
 * @param {string} action - Action to perform ('cleanTab' or 'enrichTab')
 * @param {string} tabName - Target tab name
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function callAppsScriptWebApp(webAppUrl, action, tabName, retries = 3) {
  console.log(`[APPS_SCRIPT] Calling Web App: ${action} on tab "${tabName}"`);
  
  // Ensure URL ends with /exec
  const url = webAppUrl.endsWith('/exec') ? webAppUrl : `${webAppUrl.replace(/\/$/, '')}/exec`;
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          tabName: tabName
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText || errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error from Apps Script');
      }
      
      console.log(`[APPS_SCRIPT] ✅ ${action} completed: ${result.message || 'Success'}`);
      return result;
      
    } catch (error) {
      lastError = error;
      console.warn(`[APPS_SCRIPT] Attempt ${attempt}/${retries} failed for ${action}:`, error.message);
      
      // If this was the last attempt, return failure
      if (attempt === retries) {
        return {
          success: false,
          error: error.message || 'Request failed after retries'
        };
      }
      
      // Exponential backoff: wait 2s, 4s, 8s before retry
      const delay = 2000 * Math.pow(2, attempt - 1);
      console.log(`[APPS_SCRIPT] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Should never reach here, but just in case
  return {
    success: false,
    error: lastError?.message || 'Request failed after retries'
  };
}

/**
 * Run Janitor AI on a specific tab
 * @param {string} webAppUrl - Apps Script Web App URL (from workbook.webAppUrl)
 * @param {string} tabName - Tab to clean
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function runJanitorAI(webAppUrl, tabName) {
  if (!webAppUrl) {
    return {
      success: false,
      error: 'No Web App URL configured for this workbook'
    };
  }
  
  return await callAppsScriptWebApp(webAppUrl, 'cleanTab', tabName);
}

/**
 * Run BigQuery Enrichment on a specific tab
 * @param {string} webAppUrl - Apps Script Web App URL (from workbook.webAppUrl)
 * @param {string} tabName - Tab to enrich
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function runBigQueryEnrichment(webAppUrl, tabName) {
  if (!webAppUrl) {
    return {
      success: false,
      error: 'No Web App URL configured for this workbook'
    };
  }
  
  return await callAppsScriptWebApp(webAppUrl, 'enrichTab', tabName);
}
```

**Implementation Notes**:
- Uses simple HTTP POST to Web App deployment URL (must end in `/exec`)
- No OAuth tokens or special scopes needed
- Includes exponential backoff retry logic (3 attempts by default)
- Web Apps must be deployed with "Execute as: Me" and "Who has access: Anyone" (or "Anyone with Google account")
- Actions are simplified: `'cleanTab'` for Janitor, `'enrichTab'` for Enrichment
- **Note**: `callAppsScriptWebApp()` is a private helper function (not exported) - only the wrapper functions `runJanitorAI()` and `runBigQueryEnrichment()` are exported

**Gate Check 1.1:**
- [ ] `background/apps_script_api.js` file created
- [ ] `runJanitorAI` and `runBigQueryEnrichment` functions export correctly
- [ ] `callAppsScriptWebApp` helper function exists (private, not exported)
- [ ] No syntax errors (run linter)

---

### Step 2: Update Manifest.json

**File**: `manifest.json`

**Changes**: None required!

- Web App HTTP POST doesn't require additional permissions
- Uses standard `fetch()` API (no special scopes needed)
- Web App URLs are just regular HTTPS endpoints
- No special OAuth scopes needed
- Existing `host_permissions` for `https://www.googleapis.com/*` is sufficient (Web Apps use `script.google.com` which doesn't need special permissions)

---

### Step 3: Extend Pipeline Configuration State

**File**: `popup/popup.js`

**Changes**:

1. **Add simplified global pipeline config** to state (only step toggles):
```javascript
state: {
  // ... existing state ...
  pipelineConfig: {
    enabled: false,           // Master toggle - enable/disable entire pipeline
    compareEnabled: true,     // Run comparison step
    janitorEnabled: true,     // Run Janitor AI step
    enrichEnabled: true       // Run BigQuery enrichment step
  }
}
```

2. **Extend savedWorkbooks structure** - Each workbook object gains pipeline-specific properties:
   - `workbook.pipelineBaselineTab` - Tab name to compare against (e.g., "master_list")
   - `workbook.webAppUrl` - Apps Script Web App URL for this workbook

   **Extended workbook structure**:
```javascript
{
  id: "spreadsheet-id",
  name: "Morgan Cirotto",
  sheetTitle: "Morgan Cirotto",
  lastUsed: "2024-01-15T10:30:00.000Z",
  lastTab: "11_28_25",          // existing
  addedAt: "2024-01-01T00:00:00.000Z",
  
  // NEW pipeline properties (optional, defaults to null):
  pipelineBaselineTab: null,    // Tab name to compare against (e.g., "master_list")
  webAppUrl: null               // Apps Script Web App URL for this workbook
}
```

3. **Load/save pipeline config** (global settings only):
```javascript
const defaultPipelineConfig = {
  enabled: false,
  compareEnabled: true,
  janitorEnabled: true,
  enrichEnabled: true
};

async function loadPipelineConfig() {
  const stored = await chrome.storage.local.get(['pipelineConfig']);
  if (stored.pipelineConfig) {
    state.pipelineConfig = { ...defaultPipelineConfig, ...stored.pipelineConfig };
  } else {
    state.pipelineConfig = { ...defaultPipelineConfig };
  }
}

async function savePipelineConfig() {
  await chrome.storage.local.set({ pipelineConfig: state.pipelineConfig });
}
```

4. **Workbook loading** - Workbooks are loaded via existing `GET_WORKBOOKS` message:
```javascript
// Existing function - workbooks now include pipeline properties
async function loadWorkbooks() {
  const response = await sendMessage('GET_WORKBOOKS');
  if (response.success) {
    state.workbooks = response.workbooks || [];
    // Backwards compatibility: ensure pipeline properties exist
    state.workbooks.forEach(wb => {
      if (wb.pipelineBaselineTab === undefined) wb.pipelineBaselineTab = null;
      if (wb.webAppUrl === undefined) wb.webAppUrl = null;
    });
  }
}
```

5. **Backwards compatibility**:
   - Existing workbooks without `pipelineBaselineTab` or `webAppUrl` will have these set to `null`
   - Pipeline will be disabled for workbooks with `null` baseline tab (if comparison is enabled)
   - Pipeline will skip Janitor/Enrichment steps if `webAppUrl` is `null`
   - Users must configure per-workbook settings before pipeline can run for that workbook

**Key Points**:
- **No separate mappings**: All per-workbook pipeline settings are stored in the workbook object itself
- **Simplified global config**: Only contains master toggle and step toggles
- **Backwards compatible**: Existing workbooks work fine, just need configuration
- **Service worker updates**: The `SAVE_WORKBOOK` handler in service_worker.js already saves the entire workbook object, so pipeline properties will be persisted automatically

---

### Step 4: Create Pipeline Configuration UI

**File**: `popup/popup.html`

**Location**: 
- Main Pipeline Section: Add after "Auto-Run Searches" section, before "Compare Tabs" section
- Pipeline Settings in Workbook Manager: Add inside existing "📚 Workbook Manager" section, after `selectedWorkbookInfo` div

**Part A: Main Pipeline Section** (simple, minimal)

**Location**: Add new section after "Auto-Run Searches" section, before "Compare Tabs" section.

```html
<!-- Full Pipeline Automation Section -->
<details class="section pipeline-section">
    <summary>🤖 Full Pipeline Automation</summary>
    <div class="section-content">
        <p class="section-description">
            Automate the complete workflow: Scrape → Compare → Clean → Enrich
        </p>
        
        <!-- Pipeline Toggle -->
        <div class="form-group">
            <label>
                <input type="checkbox" id="pipelineEnabled" />
                Enable Full Pipeline (runs after auto-run completes)
            </label>
        </div>
        
        <!-- Pipeline Steps (shown when enabled) -->
        <div id="pipelineSteps" style="display: none;">
            <div class="form-group">
                <label>
                    <input type="checkbox" id="pipelineCompare" checked />
                    Run Comparison (find new leads)
                </label>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="pipelineJanitor" checked />
                    Run Janitor AI (clean new leads)
                </label>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="pipelineEnrichment" checked />
                    Run BigQuery Enrichment
                </label>
            </div>
            
            <!-- Workbook Pipeline Readiness Summary -->
            <div class="pipeline-readiness-summary" id="pipelineReadinessSummary" style="margin-top: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
                <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">Workbook Configuration Status:</div>
                <div id="pipelineReadinessList" style="font-size: 11px; color: #666;">
                    <em>Loading workbooks...</em>
                </div>
            </div>
        </div>
        
        <div class="button-row" style="margin-top: 12px;">
            <button id="savePipelineConfigBtn" class="btn btn-primary btn-small">
                💾 Save Pipeline Config
            </button>
        </div>
        
        <div id="pipelineConfigStatus" class="status-message" style="display: none; margin-top: 8px;"></div>
    </div>
</details>
```

**Part B: Pipeline Settings in Workbook Manager** (integrated into existing section)

**Location**: Inside the existing "📚 Workbook Manager" section, after the `selectedWorkbookInfo` div.

```html
<!-- Pipeline Settings for Selected Workbook (NEW - Phase 9) -->
<div class="workbook-pipeline-settings" id="workbookPipelineSettings" style="display: none; margin-top: 12px; padding: 12px; background: #f9f9f9; border-radius: 4px; border: 1px solid #ddd;">
    <div style="font-size: 13px; font-weight: bold; margin-bottom: 10px; color: #333;">
        ⚙️ Pipeline Settings
    </div>
    
    <!-- Baseline Tab Selector -->
    <div class="form-group" style="margin-bottom: 10px;">
        <label for="workbookBaselineTab" style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">
            Baseline Tab for Comparison:
        </label>
        <select id="workbookBaselineTab" class="workbook-pipeline-input" style="width: 100%; font-size: 12px; padding: 4px;">
            <option value="">-- Select Baseline Tab --</option>
            <!-- Dynamically populated -->
        </select>
        <small style="font-size: 10px; color: #888; display: block; margin-top: 2px;">
            Compare new scraping against this tab to find new leads
        </small>
    </div>
    
    <!-- Web App URL Input -->
    <div class="form-group" style="margin-bottom: 10px;">
        <label for="workbookWebAppUrl" style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">
            Apps Script Web App URL:
        </label>
        <div style="display: flex; gap: 4px;">
            <input type="text" id="workbookWebAppUrl" class="workbook-pipeline-input" 
                   placeholder="https://script.google.com/macros/s/..." 
                   style="flex: 1; font-size: 11px; padding: 4px; font-family: monospace;" />
            <button id="testWebAppBtn" class="btn btn-secondary btn-small" title="Test Web App connection">
                🧪 Test
            </button>
        </div>
        <small style="font-size: 10px; color: #888; display: block; margin-top: 2px;">
            Deploy your Apps Script (janitor-ai.gs + enricher.gs) as Web App and paste the URL here
        </small>
    </div>
    
    <!-- Save Pipeline Settings Button -->
    <div style="margin-top: 8px;">
        <button id="saveWorkbookPipelineBtn" class="btn btn-primary btn-small">
            💾 Save Pipeline Settings
        </button>
        <span id="workbookPipelineSaveStatus" style="margin-left: 8px; font-size: 11px; color: #4CAF50; display: none;">✅ Saved</span>
    </div>
</div>
```

**Integration Notes**:
- The `workbookPipelineSettings` div appears when a workbook is selected (same condition as `selectedWorkbookInfo`)
- Follows the same styling patterns as the existing workbook manager section
- Uses existing form patterns (`form-group`, `btn-small`, etc.)
- Tab dropdown is populated using the same `GET_SHEET_TABS` message pattern used elsewhere

**Part C: Update CSS** (add to `popup/popup.css`):

**Location**: Add at the end of the file or in an appropriate section

```css
/* Pipeline Section */
.pipeline-section .form-group {
  margin-bottom: 12px;
}

.pipeline-section label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.pipeline-section input[type="checkbox"] {
  cursor: pointer;
}

.pipeline-readiness-summary {
  margin-top: 12px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.pipeline-readiness-summary ul {
  margin: 4px 0 0 16px;
  padding: 0;
  font-size: 10px;
  list-style-type: disc;
}

/* Workbook Pipeline Settings */
.workbook-pipeline-settings {
  margin-top: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.workbook-pipeline-input {
  font-size: 12px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 3px;
}

.status-message {
  margin-top: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}
```

---

### Step 5: Implement Pipeline UI Logic

**File**: `popup/popup.js`

**Location**: Add new functions throughout the file as indicated. Update `init()` function near the end of the file.

**Part A: Add new DOM element references** (add to `elements` object):

```javascript
const elements = {
  // ... existing elements ...
  
  // Pipeline Section (Phase 9)
  pipelineEnabled: document.getElementById('pipelineEnabled'),
  pipelineSteps: document.getElementById('pipelineSteps'),
  pipelineCompare: document.getElementById('pipelineCompare'),
  pipelineJanitor: document.getElementById('pipelineJanitor'),
  pipelineEnrichment: document.getElementById('pipelineEnrichment'),
  pipelineReadinessSummary: document.getElementById('pipelineReadinessSummary'),
  pipelineReadinessList: document.getElementById('pipelineReadinessList'),
  savePipelineConfigBtn: document.getElementById('savePipelineConfigBtn'),
  pipelineConfigStatus: document.getElementById('pipelineConfigStatus'),
  
  // Workbook Pipeline Settings (Phase 9)
  workbookPipelineSettings: document.getElementById('workbookPipelineSettings'),
  workbookBaselineTab: document.getElementById('workbookBaselineTab'),
  workbookWebAppUrl: document.getElementById('workbookWebAppUrl'),
  testWebAppBtn: document.getElementById('testWebAppBtn'),
  saveWorkbookPipelineBtn: document.getElementById('saveWorkbookPipelineBtn'),
  workbookPipelineSaveStatus: document.getElementById('workbookPipelineSaveStatus')
};
```

**Part B: Pipeline Config Functions**:

```javascript
// Initialize pipeline config UI
async function initPipelineConfig() {
  await loadPipelineConfig();
  updatePipelineConfigUI();
  attachPipelineConfigListeners();
}

// Update UI from state
function updatePipelineConfigUI() {
  const config = state.pipelineConfig;
  
  // Toggle pipeline enabled
  if (elements.pipelineEnabled) {
    elements.pipelineEnabled.checked = config.enabled;
  }
  
  // Show/hide pipeline steps
  if (elements.pipelineSteps) {
    elements.pipelineSteps.style.display = config.enabled ? 'block' : 'none';
  }
  
  // Update checkboxes
  if (elements.pipelineCompare) elements.pipelineCompare.checked = config.compareEnabled;
  if (elements.pipelineJanitor) elements.pipelineJanitor.checked = config.janitorEnabled;
  if (elements.pipelineEnrichment) elements.pipelineEnrichment.checked = config.enrichEnabled;
  
  // Update workbook readiness summary
  if (config.enabled) {
    updatePipelineReadinessSummary();
  }
}

// Update workbook pipeline readiness summary
async function updatePipelineReadinessSummary() {
  if (!elements.pipelineReadinessList) return;
  
  const config = state.pipelineConfig;
  const response = await sendMessage('GET_WORKBOOKS');
  if (!response.success || !response.workbooks) {
    elements.pipelineReadinessList.innerHTML = '<em>No workbooks found</em>';
    return;
  }
  
  const workbooks = response.workbooks;
  const sourceMapping = state.sourceMapping || {};
  const mappedWorkbookIds = new Set(Object.values(sourceMapping));
  
  let readyCount = 0;
  let notReadyCount = 0;
  const issues = [];
  
  // Check each mapped workbook
  for (const [sourceName, workbookId] of Object.entries(sourceMapping)) {
    const workbook = workbooks.find(w => w.id === workbookId);
    if (!workbook) continue;
    
    const missing = [];
    if (config.compareEnabled && !workbook.pipelineBaselineTab) {
      missing.push('baseline tab');
    }
    if ((config.janitorEnabled || config.enrichEnabled) && !workbook.webAppUrl) {
      missing.push('web app URL');
    }
    
    if (missing.length === 0) {
      readyCount++;
    } else {
      notReadyCount++;
      issues.push(`${workbook.name}: missing ${missing.join(', ')}`);
    }
  }
  
  // Update display
  if (mappedWorkbookIds.size === 0) {
    elements.pipelineReadinessList.innerHTML = '<em style="color: #888;">No workbooks mapped to sources</em>';
  } else if (notReadyCount === 0) {
    elements.pipelineReadinessList.innerHTML = `<span style="color: #4CAF50;">✅ All ${readyCount} workbook(s) configured</span>`;
  } else {
    let html = `<span style="color: #4CAF50;">✅ ${readyCount} ready</span>, <span style="color: #f44336;">❌ ${notReadyCount} need config:</span><br>`;
    html += '<ul style="margin: 4px 0 0 16px; padding: 0; font-size: 10px;">';
    issues.forEach(issue => {
      html += `<li style="color: #666;">${issue}</li>`;
    });
    html += '</ul>';
    elements.pipelineReadinessList.innerHTML = html;
  }
}

// Load workbook pipeline settings when a workbook is selected
async function loadWorkbookPipelineSettings(workbook) {
  if (!elements.workbookPipelineSettings || !workbook) {
    if (elements.workbookPipelineSettings) {
      elements.workbookPipelineSettings.style.display = 'none';
    }
    return;
  }
  
  // Show the pipeline settings section
  elements.workbookPipelineSettings.style.display = 'block';
  
  // Load tabs for baseline dropdown
  const tabs = await getTabsForWorkbook(workbook.id);
  
  // Populate baseline tab dropdown
  if (elements.workbookBaselineTab) {
    elements.workbookBaselineTab.innerHTML = '<option value="">-- Select Baseline Tab --</option>';
    tabs.forEach(tab => {
      const option = document.createElement('option');
      option.value = tab.title;
      option.textContent = tab.title;
      option.selected = workbook.pipelineBaselineTab === tab.title;
      elements.workbookBaselineTab.appendChild(option);
    });
  }
  
  // Set Web App URL
  if (elements.workbookWebAppUrl) {
    elements.workbookWebAppUrl.value = workbook.webAppUrl || '';
  }
  
  // Hide save status
  if (elements.workbookPipelineSaveStatus) {
    elements.workbookPipelineSaveStatus.style.display = 'none';
  }
}

// Save workbook pipeline settings
async function handleSaveWorkbookPipeline() {
  if (!state.selectedWorkbook) return;
  
  const baselineTab = elements.workbookBaselineTab?.value || null;
  const webAppUrl = elements.workbookWebAppUrl?.value.trim() || null;
  
  try {
    const response = await sendMessage('UPDATE_WORKBOOK_PIPELINE_CONFIG', {
      workbookId: state.selectedWorkbook.id,
      pipelineBaselineTab: baselineTab,
      webAppUrl: webAppUrl
    });
    
    if (response.success) {
      // Update local state
      state.selectedWorkbook.pipelineBaselineTab = baselineTab;
      state.selectedWorkbook.webAppUrl = webAppUrl;
      
      // Update workbooks list
      const wbIndex = state.workbooks.findIndex(w => w.id === state.selectedWorkbook.id);
      if (wbIndex >= 0) {
        state.workbooks[wbIndex] = { ...state.selectedWorkbook };
      }
      
      // Show success message
      if (elements.workbookPipelineSaveStatus) {
        elements.workbookPipelineSaveStatus.style.display = 'inline';
        setTimeout(() => {
          if (elements.workbookPipelineSaveStatus) {
            elements.workbookPipelineSaveStatus.style.display = 'none';
          }
        }, 3000);
      }
      
      // Update readiness summary
      updatePipelineReadinessSummary();
      
      updateStatus('✅ Pipeline settings saved');
    } else {
      updateStatus(`❌ ${response.error || 'Failed to save pipeline settings'}`);
    }
  } catch (error) {
    updateStatus(`❌ ${error.message}`);
  }
}

// Test Web App connection
async function handleTestWebApp() {
  const webAppUrl = elements.workbookWebAppUrl?.value.trim();
  
  if (!webAppUrl) {
    updateStatus('❌ Please enter a Web App URL first');
    return;
  }
  
  // Validate URL format
  if (!webAppUrl.startsWith('https://script.google.com/macros/s/')) {
    updateStatus('❌ Invalid Web App URL format. Should start with https://script.google.com/macros/s/');
    return;
  }
  
  updateStatus('🧪 Testing Web App connection...');
  
  try {
    // Test with a simple action (we'll use a test endpoint or a no-op action)
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'test',
        tabName: 'test'
      })
    });
    
    if (response.ok) {
      updateStatus('✅ Web App is responding!');
    } else {
      updateStatus(`⚠️ Web App returned status ${response.status}. Check if it's deployed correctly.`);
    }
  } catch (error) {
    updateStatus(`❌ Connection failed: ${error.message}`);
  }
}

// Attach event listeners
function attachPipelineConfigListeners() {
  // Pipeline enabled toggle
  elements.pipelineEnabled?.addEventListener('change', (e) => {
    state.pipelineConfig.enabled = e.target.checked;
    updatePipelineConfigUI();
    updateSaveButtonState();
  });
  
  // Step toggles
  elements.pipelineCompare?.addEventListener('change', (e) => {
    state.pipelineConfig.compareEnabled = e.target.checked;
    updateSaveButtonState();
  });
  
  elements.pipelineJanitor?.addEventListener('change', (e) => {
    state.pipelineConfig.janitorEnabled = e.target.checked;
    updateSaveButtonState();
  });
  
  elements.pipelineEnrichment?.addEventListener('change', (e) => {
    state.pipelineConfig.enrichEnabled = e.target.checked;
    updateSaveButtonState();
  });
  
  
  // Save button
  elements.savePipelineConfigBtn?.addEventListener('click', async () => {
    await savePipelineConfig();
    await sendMessage('SAVE_PIPELINE_CONFIG', { config: state.pipelineConfig });
    showPipelineConfigStatus('✅ Pipeline configuration saved!', 'success');
    updatePipelineReadinessSummary();
  });
}

// Attach workbook pipeline settings listeners
function attachWorkbookPipelineListeners() {
  elements.saveWorkbookPipelineBtn?.addEventListener('click', handleSaveWorkbookPipeline);
  elements.testWebAppBtn?.addEventListener('click', handleTestWebApp);
}

// Helper: Get tabs for a workbook
// NOTE: Uses existing sendMessage() helper function (wrapper for chrome.runtime.sendMessage)
async function getTabsForWorkbook(workbookId) {
  try {
    const response = await sendMessage('GET_SHEET_TABS', { spreadsheetId: workbookId });
    if (response.success) {
      return response.tabs || [];
    }
  } catch (error) {
    console.error('[POPUP] Error loading tabs:', error);
  }
  return [];
}

// Update save button state
function updateSaveButtonState() {
  if (!elements.savePipelineConfigBtn) return;
  
  // Button is always enabled (no validation needed for simple toggles)
  elements.savePipelineConfigBtn.disabled = false;
}

// Show status message
function showPipelineConfigStatus(message, type = 'info') {
  const statusEl = document.getElementById('pipelineConfigStatus');
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}
```

**Update `init()` function** (find existing `init()` function, typically near the end of the file):
```javascript
async function init() {
  // ... existing init code ...
  await initPipelineConfig();  // Add this line
  attachWorkbookPipelineListeners();  // Add this line to attach workbook pipeline event listeners
}
```

**Also update workbook selection handler** (find where workbooks are selected/loaded, typically in `loadWorkbooks()` or workbook selection event handler):
```javascript
// When a workbook is selected, load its pipeline settings
// Find existing workbook selection handler and add:
if (selectedWorkbook) {
  await loadWorkbookPipelineSettings(selectedWorkbook);
}
```

**Gate Check 4.1:**
- [ ] Main Pipeline section HTML added to popup.html
- [ ] Pipeline Settings subsection added to Workbook Manager in popup.html
- [ ] All CSS styles added to popup.css
- [ ] No HTML/CSS syntax errors

**Gate Check 5.1:**
- [ ] All new DOM element references added to `elements` object
- [ ] `initPipelineConfig()` function added
- [ ] `loadWorkbookPipelineSettings()` function added
- [ ] `handleSaveWorkbookPipeline()` function added
- [ ] `handleTestWebApp()` function added
- [ ] `updatePipelineReadinessSummary()` function added
- [ ] Event listeners attached in `attachPipelineConfigListeners()` and `attachWorkbookPipelineListeners()`
- [ ] `init()` function updated to call `initPipelineConfig()`
- [ ] Workbook selection handler updated to call `loadWorkbookPipelineSettings()`
- [ ] No syntax errors (run linter)

---

### Step 6: Add Pipeline State to Service Worker

**File**: `background/service_worker.js`

**Location**: Add imports at the top of the file with other imports

**Changes**:

1. **Import Apps Script Web App functions** (add to existing imports):
```javascript
import { runJanitorAI, runBigQueryEnrichment } from './apps_script_api.js';
```

2. **Import compareTabs function** (verify this import exists, add if missing):
```javascript
import { compareTabs } from './sheets_api.js'; // Verify this import exists
```

**Note**: If `compareTabs` is already imported elsewhere in the file, you don't need to add it again. Check existing imports first.

2. **Add message handler for saving pipeline config** (add to existing message handler switch):
```javascript
case 'SAVE_PIPELINE_CONFIG': {
  await saveToStorage({ pipelineConfig: message.config });
  response = { success: true };
  break;
}
```

3. **Add message handler for getting pipeline config** (add to existing message handler switch):
```javascript
case 'GET_PIPELINE_CONFIG': {
  const stored = await getFromStorage(['pipelineConfig']);
  response = { success: true, config: stored.pipelineConfig || {} };
  break;
}
```

4. **Add message handler for updating workbook pipeline config** (add to existing message handler switch):
```javascript
case 'UPDATE_WORKBOOK_PIPELINE_CONFIG': {
  const { workbookId, pipelineBaselineTab, webAppUrl } = message;
  const workbook = savedWorkbooks.find(w => w.id === workbookId);
  if (workbook) {
    workbook.pipelineBaselineTab = pipelineBaselineTab;
    workbook.webAppUrl = webAppUrl;
    await saveToStorage({ savedWorkbooks });
    response = { success: true };
  } else {
    response = { success: false, error: 'Workbook not found' };
  }
  break;
}
```

**Gate Check 6.1:**
- [ ] Imports added at top of file
- [ ] `compareTabs` import verified or added
- [ ] Message handlers added to switch statement
- [ ] No syntax errors (run linter)

---

### Step 7: Extend processSourceGroup to Run Pipeline

**File**: `background/service_worker.js`

**Function**: `processSourceGroup()`

**Location**: After deduplication step (find where deduplication completes, typically after `DEDUPLICATE_SHEET` message is sent)

**Changes**: Add pipeline execution after all searches complete and deduplication:

```javascript
async function processSourceGroup(sourceName, workbookId, searches, sourceIndex) {
    console.log(`[SW] Processing source: ${sourceName} (${searches.length} searches)`);
    
    try {
        // ... existing code: activate workbook, scrape searches, deduplicate ...
        
        // Step 4: Deduplicate workbook after all searches
        console.log(`[SW] Deduplicating workbook for ${sourceName}...`);
        const dedupeResult = await sendMessageToSelf('DEDUPLICATE_SHEET', {
            spreadsheetId: workbookId,
            // ... existing dedupe params ...
        });
        
        // ==========================================
        // NEW: PIPELINE EXECUTION
        // ==========================================
        
        // Check if pipeline is enabled
        const pipelineState = await getFromStorage(['pipelineConfig', 'savedWorkbooks']);
        const pipelineConfig = pipelineState.pipelineConfig || {};
        
        if (pipelineConfig.enabled) {
            console.log(`[SW] 🚀 Starting pipeline for ${sourceName}...`);
            
            // Get the new tab that was just created (current active tab)
            const currentTabState = await getFromStorage(['currentTabName', 'currentOutputSheetId']);
            const newTabName = currentTabState.currentTabName; // This is the tab we just scraped to
            
            // Get workbook-specific config (stored directly in workbook object)
            savedWorkbooks = pipelineState.savedWorkbooks || [];
            const workbook = savedWorkbooks.find(w => w.id === workbookId);
            
            // Backwards compatibility: ensure properties exist
            const baselineTabName = workbook?.pipelineBaselineTab ?? null;
            const webAppUrl = workbook?.webAppUrl ?? null;
            
            if (!newTabName) {
                console.warn(`[SW] ⚠️ No new tab name found, skipping pipeline`);
            } else if (!baselineTabName && pipelineConfig.compareEnabled) {
                console.warn(`[SW] ⚠️ No baseline tab configured for workbook ${workbookId}, skipping comparison`);
            } else {
                await executePipeline(sourceName, workbookId, newTabName, baselineTabName, webAppUrl, pipelineConfig);
            }
        }
        
        // ... rest of existing code ...
    } catch (error) {
        // ... existing error handling ...
    }
}
```

**Gate Check 7.1:**
- [ ] `processSourceGroup()` function modified to check pipeline config
- [ ] Pipeline execution call added after deduplication
- [ ] Basic `executePipeline()` function added (will be replaced in Step 7.5)
- [ ] No syntax errors (run linter)

**New function to add**:

**Location**: Add `executePipeline()` function near `processSourceGroup()` in the same file

**Note**: The implementation below is the basic version. **See Step 7.5** for the enhanced version with comprehensive error handling, retry logic, and status tracking.

**IMPORTANT**: The `updatePipelineResult()` helper function (defined in Step 7.5) is called within this function. Make sure to implement Step 7.5's enhanced version which includes that helper, or add a placeholder that you'll replace.

```javascript
/**
 * Execute the full pipeline: Compare → Janitor → Enrich
 * @param {string} sourceName - Source name for logging
 * @param {string} workbookId - Target workbook ID
 * @param {string} newTabName - Tab with new scraping results
 * @param {string} baselineTabName - Baseline tab for comparison (from workbook.pipelineBaselineTab)
 * @param {string} webAppUrl - Apps Script Web App URL (from workbook.webAppUrl)
 * @param {Object} config - Global pipeline configuration
 * 
 * NOTE: This is the basic version. See Step 7.5 for enhanced version with error handling.
 * The enhanced version includes updatePipelineResult() helper function.
 */
async function executePipeline(sourceName, workbookId, newTabName, baselineTabName, webAppUrl, config) {
    console.log(`[SW] 🔄 Starting pipeline for ${sourceName}`);
    
    try {
        // Generate new leads tab name (default pattern: "new_leads_{date}")
        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}_${String(today.getDate()).padStart(2, '0')}_${String(today.getFullYear()).slice(-2)}`;
        const newLeadsTabName = `new_leads_${dateStr}`;
        
        // STEP 1: COMPARE TABS (if enabled) - REUSE EXISTING FUNCTION
        if (config.compareEnabled && baselineTabName) {
            console.log(`[SW] 📊 Pipeline Step 1: Comparing ${baselineTabName} vs ${newTabName}...`);
            
            await updateAutoRunState({
                progress: {
                    ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                    pipelineStep: `Comparing tabs...`,
                    pipelineProgress: '1/3'
                }
            });
            
            // Reuse existing compareTabs function from sheets_api.js
            const compareResult = await compareTabs(
                workbookId,
                baselineTabName,  // older (baseline) - tab1Name
                newTabName,       // newer (just scraped) - tab2Name
                newLeadsTabName,  // output - outputTabName
                1                 // keyColumn: Name (Column B)
            );
            
            if (!compareResult.success) {
                throw new Error(`Comparison failed: ${compareResult.error}`);
            }
            
            console.log(`[SW] ✅ Comparison complete: ${compareResult.newEntries} new entries found`);
            
            // Update pipeline progress
            await updateAutoRunState({
                progress: {
                    ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                    pipelineStep: `Found ${compareResult.newEntries} new leads`,
                    pipelineProgress: '2/3'
                }
            });
            
            // If no new entries, skip remaining steps
            if (compareResult.newEntries === 0) {
                console.log(`[SW] ⚠️ No new entries found, skipping Janitor and Enrichment`);
                await updateAutoRunState({
                    progress: {
                        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                        pipelineStep: `No new leads to process`,
                        pipelineProgress: 'Complete'
                    }
                });
                return;
            }
        } else {
            // If comparison is disabled, use the new tab directly
            newLeadsTabName = newTabName;
            console.log(`[SW] ⚠️ Comparison disabled, using scraped tab directly: ${newLeadsTabName}`);
        }
        
        // STEP 2: JANITOR AI (if enabled)
        if (config.janitorEnabled) {
            if (!webAppUrl) {
                console.warn(`[SW] ⚠️ No Web App URL configured for workbook ${workbookId}, skipping Janitor AI`);
            } else {
                console.log(`[SW] 🧹 Pipeline Step 2: Running Janitor AI on ${newLeadsTabName}...`);
                
                await updateAutoRunState({
                    progress: {
                        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                        pipelineStep: `Cleaning with Janitor AI...`,
                        pipelineProgress: config.enrichEnabled ? '2/3' : 'Complete'
                    }
                });
                
                // Call Web App via HTTP POST
                const janitorResult = await runJanitorAI(webAppUrl, newLeadsTabName);
            
                if (!janitorResult.success) {
                    throw new Error(`Janitor AI failed: ${janitorResult.error || janitorResult.message}`);
                }
                
                console.log(`[SW] ✅ Janitor AI complete: ${janitorResult.message || 'Cleaned successfully'}`);
            }
        }
        
        // STEP 3: BIGQUERY ENRICHMENT (if enabled)
        if (config.enrichEnabled) {
            if (!webAppUrl) {
                console.warn(`[SW] ⚠️ No Web App URL configured for workbook ${workbookId}, skipping BigQuery Enrichment`);
            } else {
                console.log(`[SW] 💎 Pipeline Step 3: Running BigQuery Enrichment on ${newLeadsTabName}...`);
                
                await updateAutoRunState({
                    progress: {
                        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                        pipelineStep: `Enriching with BigQuery...`,
                        pipelineProgress: '3/3'
                    }
                });
                
                // Call Web App via HTTP POST
                const enrichResult = await runBigQueryEnrichment(webAppUrl, newLeadsTabName);
            
                if (!enrichResult.success) {
                    throw new Error(`BigQuery Enrichment failed: ${enrichResult.error || enrichResult.message}`);
                }
                
                console.log(`[SW] ✅ BigQuery Enrichment complete: ${enrichResult.message || 'Enriched successfully'}`);
            }
        }
        
        // Pipeline complete!
        console.log(`[SW] 🎉 Pipeline complete for ${sourceName}!`);
        
        await updateAutoRunState({
            progress: {
                ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                pipelineStep: `Pipeline complete!`,
                pipelineProgress: 'Complete'
            }
        });
        
    } catch (error) {
        console.error(`[SW] ❌ Pipeline error for ${sourceName}:`, error);
        
        // Log error but don't fail the entire auto-run
        const currentState = await getFromStorage(['autoRunState']);
        const currentProgress = currentState.autoRunState?.progress || {};
        const currentErrors = currentProgress.errors || [];
        
        await updateAutoRunState({
            progress: {
                ...currentProgress,
                errors: [...currentErrors, `Pipeline error (${sourceName}): ${error.message}`],
                pipelineStep: `Pipeline failed: ${error.message}`,
                pipelineProgress: 'Error'
            }
        });
    }
}

```

---

### Step 7.5: Error Handling & Recovery

**File**: `background/apps_script_api.js` and `background/service_worker.js`

**Purpose**: Add robust error handling, retry logic, and pipeline status tracking to ensure the pipeline gracefully handles failures without breaking the entire auto-run.

**Part A: Enhanced Web App Call with Timeout** (already updated in Step 1)

The `callAppsScriptWebApp()` function in Step 1 now includes:
- 60-second timeout per attempt
- Exponential backoff retry logic (2s, 4s, 8s delays)
- Detailed error logging
- Graceful failure return

**Part B: Pipeline Status Tracking Structure**

Add to `autoRunState.progress` in service_worker.js:

```javascript
// In the progress object structure:
progress: {
  // ... existing fields ...
  pipelineResults: {
    // Keyed by workbook ID
    'workbook-id-1': {
      scrapeSuccess: true,           // Always true if we reach pipeline
      compareSuccess: true,           // true/false/null (null = not attempted)
      compareNewLeads: 47,            // Number of new leads found (if compare succeeded)
      janitorSuccess: true,           // true/false/null
      janitorError: null,             // Error message if failed
      enrichSuccess: true,            // true/false/null
      enrichError: null,              // Error message if failed
      overallStatus: 'complete'       // 'complete', 'partial', 'failed'
    }
  }
}
```

**Part C: Enhanced executePipeline with Step-by-Step Error Handling**

**File**: `background/service_worker.js`

**Location**: Replace the basic `executePipeline()` function from Step 7 with this enhanced version

**IMPORTANT**: This enhanced version includes the `updatePipelineResult()` helper function defined at the end. Make sure to include both functions.

```javascript
/**
 * Execute the full pipeline: Compare → Janitor → Enrich
 * Enhanced with robust error handling and status tracking
 */
async function executePipeline(sourceName, workbookId, newTabName, baselineTabName, webAppUrl, config) {
    console.log(`[SW] 🔄 Starting pipeline for ${sourceName}`);
    
    // Initialize pipeline result tracking
    const pipelineResult = {
        scrapeSuccess: true,  // We got here, so scraping succeeded
        compareSuccess: null,
        compareNewLeads: 0,
        janitorSuccess: null,
        janitorError: null,
        enrichSuccess: null,
        enrichError: null,
        overallStatus: 'in_progress'
    };
    
    let newLeadsTabName = null;
    let pipelineStepCount = 0;
    const totalSteps = [config.compareEnabled, config.janitorEnabled, config.enrichEnabled].filter(Boolean).length;
    
    try {
        // Generate new leads tab name (default pattern: "new_leads_{date}")
        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}_${String(today.getDate()).padStart(2, '0')}_${String(today.getFullYear()).slice(-2)}`;
        newLeadsTabName = `new_leads_${dateStr}`;
        
        // STEP 1: COMPARE TABS (if enabled)
        if (config.compareEnabled && baselineTabName) {
            pipelineStepCount++;
            console.log(`[SW] 📊 Pipeline Step ${pipelineStepCount}/${totalSteps}: Comparing ${baselineTabName} vs ${newTabName}...`);
            
            await updateAutoRunState({
                progress: {
                    ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                    pipelineStep: `Comparing tabs...`,
                    pipelineProgress: `${pipelineStepCount}/${totalSteps}`
                }
            });
            
            try {
                const compareResult = await compareTabs(
                    workbookId,
                    baselineTabName,
                    newTabName,
                    newLeadsTabName,
                    1
                );
                
                if (!compareResult.success) {
                    throw new Error(compareResult.error || 'Comparison failed');
                }
                
                pipelineResult.compareSuccess = true;
                pipelineResult.compareNewLeads = compareResult.newEntries || 0;
                
                console.log(`[SW] ✅ Comparison complete: ${pipelineResult.compareNewLeads} new entries found`);
                
                await updateAutoRunState({
                    progress: {
                        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                        pipelineStep: `Found ${pipelineResult.compareNewLeads} new leads`,
                        pipelineProgress: `${pipelineStepCount}/${totalSteps}`
                    }
                });
                
                // If no new entries, skip remaining steps
                if (pipelineResult.compareNewLeads === 0) {
                    console.log(`[SW] ⚠️ No new entries found, skipping Janitor and Enrichment`);
                    pipelineResult.overallStatus = 'complete';
                    pipelineResult.janitorSuccess = null;  // Skipped
                    pipelineResult.enrichSuccess = null;   // Skipped
                    
                    // Update tracking and return early
                    await updatePipelineResult(workbookId, pipelineResult);
                    
                    await updateAutoRunState({
                        progress: {
                            ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                            pipelineStep: `No new leads to process`,
                            pipelineProgress: 'Complete'
                        }
                    });
                    return;
                }
                
            } catch (error) {
                console.error(`[SW] ❌ Comparison failed:`, error);
                pipelineResult.compareSuccess = false;
                pipelineResult.overallStatus = 'partial';
                
                // Comparison failure: skip Janitor/Enrich, but don't fail entire pipeline
                await updatePipelineResult(workbookId, pipelineResult);
                
                    await updateAutoRunState({
                        progress: {
                            ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                            pipelineStep: `Comparison failed: ${error.message}`,
                            pipelineProgress: 'Partial'
                        }
                    });
                    
                console.log(`[SW] ⚠️ Comparison failed, skipping remaining pipeline steps`);
                return;  // Skip Janitor and Enrichment
            }
        } else {
            // Comparison disabled, use new tab directly
            newLeadsTabName = newTabName;
            pipelineResult.compareSuccess = null;  // Not attempted
            console.log(`[SW] ⚠️ Comparison disabled, using scraped tab directly: ${newLeadsTabName}`);
        }
        
        // STEP 2: JANITOR AI (if enabled)
        if (config.janitorEnabled) {
            if (!webAppUrl) {
                console.warn(`[SW] ⚠️ No Web App URL configured, skipping Janitor AI`);
                pipelineResult.janitorSuccess = null;
            } else {
                pipelineStepCount++;
                console.log(`[SW] 🧹 Pipeline Step ${pipelineStepCount}/${totalSteps}: Running Janitor AI on ${newLeadsTabName}...`);
                
                await updateAutoRunState({
                    progress: {
                        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                        pipelineStep: `Cleaning with Janitor AI...`,
                        pipelineProgress: `${pipelineStepCount}/${totalSteps}`
                    }
                });
                
                try {
                    const janitorResult = await runJanitorAI(webAppUrl, newLeadsTabName);
                    
                    if (!janitorResult.success) {
                        throw new Error(janitorResult.error || janitorResult.message || 'Janitor AI failed');
                    }
                    
                    pipelineResult.janitorSuccess = true;
                    console.log(`[SW] ✅ Janitor AI complete: ${janitorResult.message || 'Cleaned successfully'}`);
                    
                } catch (error) {
                    console.error(`[SW] ❌ Janitor AI failed:`, error);
                    pipelineResult.janitorSuccess = false;
                    pipelineResult.janitorError = error.message;
                    
                    // Janitor failure: still attempt Enrichment (data exists)
                    console.log(`[SW] ⚠️ Janitor failed, but continuing to Enrichment step`);
                    // Don't return - continue to enrichment
                }
            }
        }
        
        // STEP 3: BIGQUERY ENRICHMENT (if enabled)
        if (config.enrichEnabled) {
            if (!webAppUrl) {
                console.warn(`[SW] ⚠️ No Web App URL configured, skipping BigQuery Enrichment`);
                pipelineResult.enrichSuccess = null;
            } else {
                pipelineStepCount++;
                console.log(`[SW] 💎 Pipeline Step ${pipelineStepCount}/${totalSteps}: Running BigQuery Enrichment on ${newLeadsTabName}...`);
                
                await updateAutoRunState({
                    progress: {
                        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                        pipelineStep: `Enriching with BigQuery...`,
                        pipelineProgress: `${pipelineStepCount}/${totalSteps}`
                    }
                });
                
                try {
                    const enrichResult = await runBigQueryEnrichment(webAppUrl, newLeadsTabName);
                    
                    if (!enrichResult.success) {
                        throw new Error(enrichResult.error || enrichResult.message || 'BigQuery Enrichment failed');
                    }
                    
                    pipelineResult.enrichSuccess = true;
                    console.log(`[SW] ✅ BigQuery Enrichment complete: ${enrichResult.message || 'Enriched successfully'}`);
                    
                } catch (error) {
                    console.error(`[SW] ❌ BigQuery Enrichment failed:`, error);
                    pipelineResult.enrichSuccess = false;
                    pipelineResult.enrichError = error.message;
                    
                    // Enrichment failure: pipeline still counts as partial success
                    console.log(`[SW] ⚠️ Enrichment failed, but scraping and comparison succeeded`);
                }
            }
        }
        
        // Determine overall status
        if (pipelineResult.compareSuccess === false) {
            pipelineResult.overallStatus = 'partial';
        } else if (pipelineResult.janitorSuccess === false || pipelineResult.enrichSuccess === false) {
            pipelineResult.overallStatus = 'partial';
        } else {
            pipelineResult.overallStatus = 'complete';
        }
        
        // Pipeline complete!
        console.log(`[SW] 🎉 Pipeline ${pipelineResult.overallStatus} for ${sourceName}!`);
        
        // Update pipeline result tracking
        await updatePipelineResult(workbookId, pipelineResult);
        
        await updateAutoRunState({
            progress: {
                ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
                pipelineStep: `Pipeline ${pipelineResult.overallStatus === 'complete' ? 'complete' : 'completed with errors'}!`,
                pipelineProgress: 'Complete'
            }
        });
        
    } catch (error) {
        console.error(`[SW] ❌ Pipeline error for ${sourceName}:`, error);
        
        // Mark pipeline as failed
        pipelineResult.overallStatus = 'failed';
        await updatePipelineResult(workbookId, pipelineResult);
        
        // Log error but don't fail the entire auto-run
        const currentState = await getFromStorage(['autoRunState']);
        const currentProgress = currentState.autoRunState?.progress || {};
        const currentErrors = currentProgress.errors || [];
        
        await updateAutoRunState({
            progress: {
                ...currentProgress,
                errors: [...currentErrors, `Pipeline error (${sourceName}): ${error.message}`],
                pipelineStep: `Pipeline failed: ${error.message}`,
                pipelineProgress: 'Error'
            }
        });
    }
}

/**
 * Update pipeline result tracking for a workbook
 * 
 * Location: Add this helper function right after executePipeline() in the same file
 * This function is called by executePipeline() above
 */
async function updatePipelineResult(workbookId, result) {
    const currentState = await getFromStorage(['autoRunState']);
    const currentProgress = currentState.autoRunState?.progress || {};
    
    const pipelineResults = currentProgress.pipelineResults || {};
    pipelineResults[workbookId] = result;
    
    await updateAutoRunState({
        progress: {
            ...currentProgress,
            pipelineResults: pipelineResults
        }
    });
}
```

**Gate Check 7.5.1:**
- [ ] Enhanced `executePipeline()` function replaces basic version
- [ ] `updatePipelineResult()` helper function added
- [ ] All progress updates include `pipelineStep` and `pipelineStepStatus`
- [ ] Error handling for each step implemented
- [ ] No syntax errors (run linter)

**Part D: User-Facing Error Summary**

Add to `popup/popup.js` - Update `updateAutoRunProgressFromServiceWorker()`:

```javascript
function updateAutoRunProgressFromServiceWorker(progress, isRunning) {
  // ... existing code ...
  
  // Add pipeline step info if available
  if (progress.pipelineStep) {
    const pipelineInfo = document.createElement('div');
    pipelineInfo.style.marginTop = '8px';
    pipelineInfo.style.fontSize = '11px';
    pipelineInfo.style.color = '#666';
    pipelineInfo.innerHTML = `
      <strong>Pipeline:</strong> ${progress.pipelineStep} 
      ${progress.pipelineProgress ? `(${progress.pipelineProgress})` : ''}
    `;
    
    if (elements.autoRunProgress) {
      elements.autoRunProgress.appendChild(pipelineInfo);
    }
  }
  
  // NEW: Show pipeline error summary when complete
  if (!isRunning && progress.pipelineResults) {
    const pipelineSummary = generatePipelineSummary(progress.pipelineResults);
    if (pipelineSummary) {
      const summaryDiv = document.createElement('div');
      summaryDiv.style.marginTop = '12px';
      summaryDiv.style.padding = '8px';
      summaryDiv.style.background = '#fff3cd';
      summaryDiv.style.border = '1px solid #ffc107';
      summaryDiv.style.borderRadius = '4px';
      summaryDiv.style.fontSize = '11px';
      summaryDiv.innerHTML = `<strong>Pipeline Results:</strong><br>${pipelineSummary}`;
      
      if (elements.autoRunProgress) {
        elements.autoRunProgress.appendChild(summaryDiv);
      }
    }
  }
}

/**
 * Generate user-friendly pipeline summary from results
 */
function generatePipelineSummary(pipelineResults) {
  if (!pipelineResults || Object.keys(pipelineResults).length === 0) {
    return null;
  }
  
  const summaries = [];
  
  for (const [workbookId, result] of Object.entries(pipelineResults)) {
    const status = result.overallStatus || 'unknown';
    const statusIcon = status === 'complete' ? '✅' : status === 'partial' ? '⚠️' : '❌';
    
    let details = [];
    
    if (result.compareSuccess === true && result.compareNewLeads !== null) {
      details.push(`Found ${result.compareNewLeads} new leads`);
    }
    if (result.compareSuccess === false) {
      details.push(`❌ Comparison failed`);
    }
    
    if (result.janitorSuccess === true) {
      details.push(`✅ Janitor complete`);
    } else if (result.janitorSuccess === false) {
      details.push(`❌ Janitor failed: ${result.janitorError || 'Unknown error'}`);
    }
    
    if (result.enrichSuccess === true) {
      details.push(`✅ Enrichment complete`);
    } else if (result.enrichSuccess === false) {
      details.push(`❌ Enrichment failed: ${result.enrichError || 'Unknown error'}`);
    }
    
    if (details.length > 0) {
      summaries.push(`${statusIcon} ${details.join(', ')}`);
    }
  }
  
  return summaries.length > 0 ? summaries.join('<br>') : null;
}
```

**Error Handling Strategy Summary**:

| Step | Failure Behavior | Pipeline Status | Auto-Run Status |
|------|-----------------|-----------------|-----------------|
| **Compare** | Log error, skip Janitor/Enrich | `partial` | ✅ Continues |
| **Janitor** | Log error, continue to Enrich | `partial` | ✅ Continues |
| **Enrich** | Log error, pipeline ends | `partial` | ✅ Continues |
| **All Steps** | All steps succeed | `complete` | ✅ Continues |

**Key Principles**:
1. **Non-blocking**: Pipeline failures never stop auto-run from continuing
2. **Graceful degradation**: Each step can fail independently
3. **Status tracking**: Detailed results stored per workbook
4. **User visibility**: Clear summary of what succeeded/failed
5. **Retry logic**: Web App calls retry 3 times with exponential backoff
6. **Timeout protection**: 60-second timeout prevents hanging requests

---

### Step 8: Deploy Apps Script as Web App

**Files**: `google-apps-script/janitor-ai.gs` and `google-apps-script/enricher.gs`

**Purpose**: Add Web App entry points to enable remote execution from the extension.

**Part A: Add doPost() Handler to janitor-ai.gs**

**File**: `google-apps-script/janitor-ai.gs`

**Location**: Add at the very end of the file (after all existing functions)

Add this complete, copy-paste-ready function:

```javascript
/**
 * ============================================
 * WEB APP ENTRY POINT - For Chrome Extension
 * ============================================
 * Deploy as: Web App
 * Execute as: Me (your account)
 * Access: Anyone with Google account
 * 
 * This function handles HTTP POST requests from the Chrome extension
 * to trigger Janitor AI cleaning on a specific tab.
 */
function doPost(e) {
  try {
    // Parse the incoming request
    const params = JSON.parse(e.postData.contents);
    const { action, tabName } = params;
    
    Logger.log(`[WebApp] Received action: ${action}, tabName: ${tabName}`);
    
    // Validate required parameters
    if (!action || !tabName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required parameters: action and tabName are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle cleanTab action
    if (action === 'cleanTab') {
      // Get the spreadsheet from the bound context
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(tabName);
      
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `Tab "${tabName}" not found in spreadsheet`
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      try {
        // Run the cleaning process (forceAll = false means skip already processed rows)
        Logger.log(`[WebApp] Starting Janitor AI on tab: ${tabName}`);
        const stats = processSheet(sheet, false);
        SpreadsheetApp.flush();
        
        // Archive bad leads (moves rows marked as "No" to trash bin)
        const movedCount = archiveBadLeads(sheet);
        SpreadsheetApp.flush();
        
        Logger.log(`[WebApp] Janitor AI complete: ${stats.kept} kept, ${stats.removed} removed, ${movedCount} archived`);
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: `Cleaned ${tabName}: ${stats.kept} kept, ${stats.removed} removed, ${movedCount} archived`,
          details: {
            total: stats.total,
            kept: stats.kept,
            removed: stats.removed,
            archived: movedCount
          }
        })).setMimeType(ContentService.MimeType.JSON);
        
      } catch (error) {
        Logger.log('[WebApp] Janitor AI error: ' + error.toString());
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `Janitor AI failed: ${error.message || error.toString()}`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Unknown action
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Unknown action: ${action}. Supported actions: 'cleanTab'`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('[WebApp] doPost error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Request processing failed: ${error.message || error.toString()}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function for local testing of the Web App handler
 * Run this in the Apps Script editor to test the doPost function
 */
function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({ 
        action: 'cleanTab', 
        tabName: 'test_tab' 
      })
    }
  };
  
  try {
    const result = doPost(mockEvent);
    Logger.log('Test result: ' + result.getContent());
  } catch (error) {
    Logger.log('Test error: ' + error.toString());
  }
}
```

**Part B: Add doPost() Handler to enricher.gs**

**File**: `google-apps-script/enricher.gs`

**Location**: Add at the very end of the file (after all existing functions)

Add this complete, copy-paste-ready function:

```javascript
/**
 * ============================================
 * WEB APP ENTRY POINT - For Chrome Extension
 * ============================================
 * Deploy as: Web App
 * Execute as: Me (your account)
 * Access: Anyone with Google account
 * 
 * This function handles HTTP POST requests from the Chrome extension
 * to trigger BigQuery enrichment on a specific tab.
 * 
 * NOTE: The runBigQueryEnrichment() function uses getActiveSheet(),
 * so we must activate the target sheet before calling it.
 */
function doPost(e) {
  try {
    // Parse the incoming request
    const params = JSON.parse(e.postData.contents);
    const { action, tabName } = params;
    
    Logger.log(`[WebApp] Received action: ${action}, tabName: ${tabName}`);
    
    // Validate required parameters
    if (!action || !tabName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required parameters: action and tabName are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get the spreadsheet from the bound context
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: `Tab "${tabName}" not found in spreadsheet`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle enrichTab action
    if (action === 'enrichTab') {
      try {
        // Save the current active sheet to restore later
        const originalSheet = ss.getActiveSheet();
        
        try {
          // Activate the target sheet (required because runBigQueryEnrichment uses getActiveSheet)
          sheet.activate();
          SpreadsheetApp.flush();
          
          Logger.log(`[WebApp] Starting BigQuery enrichment on tab: ${tabName}`);
          
          // Run the enrichment function (uses getActiveSheet internally)
          // Note: runBigQueryEnrichment() doesn't return a value, but shows toast messages
          runBigQueryEnrichment();
          SpreadsheetApp.flush();
          
          // Restore the original active sheet
          originalSheet.activate();
          
          Logger.log(`[WebApp] BigQuery enrichment complete for tab: ${tabName}`);
          
          // Get row count for success message
          const lastRow = sheet.getLastRow();
          const dataRowCount = lastRow > 1 ? lastRow - 1 : 0;
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: `Enriched ${tabName} with BigQuery data (${dataRowCount} rows processed)`,
            details: {
              tabName: tabName,
              rowsProcessed: dataRowCount
            }
          })).setMimeType(ContentService.MimeType.JSON);
          
        } catch (enrichError) {
          // Restore original active sheet even on error
          try {
            originalSheet.activate();
          } catch (restoreError) {
            Logger.log('[WebApp] Error restoring original sheet: ' + restoreError.toString());
          }
          throw enrichError;
        }
        
      } catch (error) {
        Logger.log('[WebApp] BigQuery Enrichment error: ' + error.toString());
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `BigQuery Enrichment failed: ${error.message || error.toString()}`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Unknown action
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Unknown action: ${action}. Supported actions: 'enrichTab'`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('[WebApp] doPost error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Request processing failed: ${error.message || error.toString()}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function for local testing of the Web App handler
 * Run this in the Apps Script editor to test the doPost function
 */
function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({ 
        action: 'enrichTab', 
        tabName: 'test_tab' 
      })
    }
  };
  
  try {
    const result = doPost(mockEvent);
    Logger.log('Test result: ' + result.getContent());
  } catch (error) {
    Logger.log('Test error: ' + error.toString());
  }
}
```

**Part C: Deploy as Web App**

1. **Open Apps Script Editor**:
   - Open your Google Sheet
   - Go to `Extensions → Apps Script`
   - Make sure both `janitor-ai.gs` and `enricher.gs` are in the project (or combined in one file)

2. **Deploy Web App**:
   - Click `Deploy → New deployment`
   - Click the gear icon ⚙️ next to "Select type"
   - Choose `Web app`

3. **Configure Deployment**:
   - **Description**: `Pipeline Automation Web App` (optional)
   - **Execute as**: `Me` (important - runs with your permissions)
   - **Who has access**: `Anyone` or `Anyone with Google account` (required for extension to call it)
   - Click `Deploy`

4. **Copy Web App URL**:
   - After deployment, you'll see a Web App URL
   - It should look like: `https://script.google.com/macros/s/AKfycby.../exec`
   - **Important**: Copy the URL ending in `/exec` (not `/dev`)
   - Paste this URL into the Workbook Manager pipeline settings in the extension

5. **Authorization**:
   - On first deployment, Google will ask you to authorize the script
   - Click `Review Permissions` and authorize with your Google account
   - You may need to click "Advanced" → "Go to [Your Project] (unsafe)" if shown

**Important Notes**:
- The Web App URL must end in `/exec` for production use
- For testing, you can use `/dev` but it has different authorization behavior
- Each deployment creates a new version - update the URL in extension settings if you redeploy
- The Web App runs in the context of the bound spreadsheet (it has access to the sheet via `getActiveSpreadsheet()`)

**Gate Check 8.1:**
- [ ] `doPost()` handler added to `janitor-ai.gs`
- [ ] `doPost()` handler added to `enricher.gs`
- [ ] `testDoPost()` functions added to both files for testing
- [ ] Web App deployed successfully
- [ ] Web App URL copied (ends in `/exec`)
- [ ] Web App tested manually (run `testDoPost()` in Apps Script editor)
- [ ] No syntax errors in Apps Script files

---

### Step 9: Update Popup CSS

**File**: `popup/popup.css`

**Add styles for pipeline section**:

```css
/* Pipeline Section */
.pipeline-section {
  /* Same as other sections */
}

.pipeline-section .form-group {
  margin-bottom: 12px;
}

.pipeline-section label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.pipeline-section input[type="checkbox"] {
  cursor: pointer;
}

#baselineTabMappings {
  margin-top: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.baseline-tab-select {
  font-size: 12px;
  padding: 4px 8px;
}


.status-message {
  margin-top: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}
```

---

### Step 10: Update Auto-Run Progress Display

**Files**: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`

**Purpose**: Add visual pipeline step badges and enhanced progress display that integrates with the existing pirate-themed auto-run UI.

**Part A: Add Pipeline Step Badges HTML**

**File**: `popup/popup.html`

**Location**: Add inside the `autoRunProgress` div (find the div with `id="autoRunProgress"`, add after the `progress-stats` div)

```html
<!-- Pipeline Step Badges (NEW - Phase 9) -->
<div id="pipelineStepBadges" class="pipeline-badges" style="display: none;">
    <span class="step-badge" id="stepCompare" data-status="pending">📊 Compare</span>
    <span class="step-badge" id="stepJanitor" data-status="pending">🧹 Janitor</span>
    <span class="step-badge" id="stepEnrich" data-status="pending">💎 Enrich</span>
</div>
```

**Part B: Add Pipeline Badge CSS**

**File**: `popup/popup.css`

**Location**: Add at the end of the file or in an appropriate section

```css
/* Pipeline Step Badges (Phase 9) */
.pipeline-badges {
    display: flex;
    gap: 8px;
    margin: 12px 0 0 0;
    flex-wrap: wrap;
    justify-content: center;
}

.step-badge {
    padding: 6px 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.3s ease;
    user-select: none;
}

/* Status-specific styling matching pirate theme */
.step-badge[data-status="pending"] {
    background: #333;
    color: #888;
    border: 1px solid #444;
}

.step-badge[data-status="running"] {
    background: #8B0000; /* Dark red for pirate theme */
    color: white;
    border: 1px solid #DC143C;
    animation: pulse 1.5s infinite;
    box-shadow: 0 0 8px rgba(220, 20, 60, 0.5);
}

.step-badge[data-status="success"] {
    background: #228B22; /* Forest green */
    color: white;
    border: 1px solid #32CD32;
}

.step-badge[data-status="failed"] {
    background: #DC143C; /* Crimson red */
    color: white;
    border: 1px solid #FF6347;
}

.step-badge[data-status="skipped"] {
    background: #2a2a2a;
    color: #666;
    text-decoration: line-through;
    border: 1px solid #444;
    opacity: 0.6;
}

/* Pulse animation for running state */
@keyframes pulse {
    0%, 100% { 
        opacity: 1;
        transform: scale(1);
    }
    50% { 
        opacity: 0.7;
        transform: scale(1.02);
    }
}

/* Pipeline summary section (from Step 7.5) */
.pipeline-summary {
    margin-top: 12px;
    padding: 10px;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 6px;
    font-size: 11px;
}

.pipeline-summary-title {
    font-weight: 600;
    color: #dc3545;
    margin-bottom: 6px;
    font-size: 12px;
}

.pipeline-summary-content {
    color: #ccc;
    line-height: 1.5;
}
```

**Part C: Update Service Worker Progress Messages**

Update `background/service_worker.js` - In the `executePipeline()` function (Step 7.5), ensure progress updates include pipeline step information:

```javascript
// When starting a pipeline step, update progress:
await updateAutoRunState({
    progress: {
        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
        pipelineStep: 'compare',  // 'compare' | 'janitor' | 'enrich' | null
        pipelineStepStatus: 'running',  // 'running' | 'success' | 'failed' | 'skipped'
        pipelineProgress: `${pipelineStepCount}/${totalSteps}`
    }
});

// When step completes successfully:
await updateAutoRunState({
    progress: {
        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
        pipelineStep: 'compare',  // Keep step name
        pipelineStepStatus: 'success',  // Mark as success
        pipelineProgress: `${pipelineStepCount}/${totalSteps}`
    }
});

// When step fails:
await updateAutoRunState({
    progress: {
        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
        pipelineStep: 'compare',  // Keep step name
        pipelineStepStatus: 'failed',  // Mark as failed
        pipelineProgress: `${pipelineStepCount}/${totalSteps}`
    }
});

// When step is skipped:
await updateAutoRunState({
    progress: {
        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
        pipelineStep: 'janitor',  // Which step was skipped
        pipelineStepStatus: 'skipped',  // Mark as skipped
        pipelineProgress: `${pipelineStepCount}/${totalSteps}`
    }
});

// When pipeline completes, clear current step:
await updateAutoRunState({
    progress: {
        ...(await getFromStorage(['autoRunState'])).autoRunState.progress,
        pipelineStep: null,  // Clear current step
        pipelineStepStatus: null,
        pipelineProgress: 'Complete'
    }
});
```

**Part D: Add Pipeline Badge Elements to popup.js**

**File**: `popup/popup.js`

**Location**: Find the `elements` object (typically near the top of the file) and add these new element references

```javascript
const elements = {
    // ... existing elements ...
    
    // Pipeline badges (NEW - Phase 9)
    pipelineStepBadges: document.getElementById('pipelineStepBadges'),
    stepCompare: document.getElementById('stepCompare'),
    stepJanitor: document.getElementById('stepJanitor'),
    stepEnrich: document.getElementById('stepEnrich'),
};
```

**Part E: Enhanced updateAutoRunProgressFromServiceWorker Function**

**File**: `popup/popup.js`

**Location**: Find the existing `updateAutoRunProgressFromServiceWorker()` function (typically around line 2251) and replace it with this enhanced version

```javascript
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
    
    // NEW: Update pipeline step badges if pipeline is active
    if (progress.pipelineStep && progress.pipelineStepStatus) {
        updatePipelineStepBadges(progress.pipelineStep, progress.pipelineStepStatus);
    }
    
    // Show/hide pipeline badges section
    if (elements.pipelineStepBadges) {
        const hasPipelineActivity = progress.pipelineStep || progress.pipelineResults;
        elements.pipelineStepBadges.style.display = hasPipelineActivity ? 'flex' : 'none';
    }
    
    // Show/hide appropriate buttons
    if (elements.autoRunBtn) elements.autoRunBtn.style.display = isRunning ? 'none' : 'block';
    if (elements.stopAutoRunBtn) elements.stopAutoRunBtn.style.display = isRunning ? 'block' : 'none';
    if (elements.autoRunProgress) elements.autoRunProgress.style.display = isRunning ? 'block' : 'none';
    
    // NEW: Show pipeline error summary when complete (from Step 7.5)
    if (!isRunning && progress.pipelineResults) {
        // Clear any existing summary
        const existingSummary = elements.autoRunProgress?.querySelector('.pipeline-summary');
        if (existingSummary) {
            existingSummary.remove();
        }
        
        const pipelineSummary = generatePipelineSummary(progress.pipelineResults);
        if (pipelineSummary && elements.autoRunProgress) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'pipeline-summary';
            summaryDiv.innerHTML = `
                <div class="pipeline-summary-title">Pipeline Results</div>
                <div class="pipeline-summary-content">${pipelineSummary}</div>
            `;
            elements.autoRunProgress.appendChild(summaryDiv);
        }
    } else {
        // Remove summary if auto-run is running or no results
        const existingSummary = elements.autoRunProgress?.querySelector('.pipeline-summary');
        if (existingSummary) {
            existingSummary.remove();
        }
    }
    
    // If completed, show summary
    if (!isRunning && progress.completedSearches > 0) {
        const errors = progress.errors || [];
        addLogEntry(`✅ Auto-run complete: ${progress.completedSearches} searches, ${progress.totalProfiles} profiles${errors.length > 0 ? `, ${errors.length} errors` : ''}`, 'success');
    }
}

/**
 * Update pipeline step badge status
 * @param {string} step - Step name: 'compare' | 'janitor' | 'enrich'
 * @param {string} status - Status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
 */
function updatePipelineStepStatus(step, status) {
    const stepNames = {
        'compare': 'Compare',
        'janitor': 'Janitor',
        'enrich': 'Enrich'
    };
    
    const badgeId = `step${stepNames[step]}`;
    const badge = document.getElementById(badgeId);
    
    if (badge) {
        badge.dataset.status = status;
    }
}

/**
 * Update all pipeline step badges based on current step and status
 * @param {string} currentStep - Current step: 'compare' | 'janitor' | 'enrich' | null
 * @param {string} currentStatus - Current step status: 'running' | 'success' | 'failed' | 'skipped'
 */
function updatePipelineStepBadges(currentStep, currentStatus) {
    const steps = ['compare', 'janitor', 'enrich'];
    const stepNames = {
        'compare': 'Compare',
        'janitor': 'Janitor',
        'enrich': 'Enrich'
    };
    
    steps.forEach((step, index) => {
        const badge = document.getElementById(`step${stepNames[step]}`);
        if (!badge) return;
        
        if (step === currentStep) {
            // Current step - use the provided status
            badge.dataset.status = currentStatus;
        } else {
            // Determine status based on position relative to current step
            const currentStepIndex = steps.indexOf(currentStep);
            
            if (currentStepIndex === -1) {
                // No current step, all pending
                badge.dataset.status = 'pending';
            } else if (index < currentStepIndex) {
                // Step is before current - should be success
                badge.dataset.status = 'success';
            } else if (index > currentStepIndex) {
                // Step is after current - should be pending
                badge.dataset.status = 'pending';
            }
        }
    });
}

/**
 * Reset all pipeline badges to pending state
 */
function resetPipelineBadges() {
    if (elements.stepCompare) elements.stepCompare.dataset.status = 'pending';
    if (elements.stepJanitor) elements.stepJanitor.dataset.status = 'pending';
    if (elements.stepEnrich) elements.stepEnrich.dataset.status = 'pending';
}

/**
 * Generate user-friendly pipeline summary from results (from Step 7.5)
 */
function generatePipelineSummary(pipelineResults) {
    if (!pipelineResults || Object.keys(pipelineResults).length === 0) {
        return null;
    }
    
    const summaries = [];
    
    for (const [workbookId, result] of Object.entries(pipelineResults)) {
        const status = result.overallStatus || 'unknown';
        const statusIcon = status === 'complete' ? '✅' : status === 'partial' ? '⚠️' : '❌';
        
        let details = [];
        
        if (result.compareSuccess === true && result.compareNewLeads !== null) {
            details.push(`Found ${result.compareNewLeads} new leads`);
        }
        if (result.compareSuccess === false) {
            details.push(`❌ Comparison failed`);
        }
        
        if (result.janitorSuccess === true) {
            details.push(`✅ Janitor complete`);
        } else if (result.janitorSuccess === false) {
            details.push(`❌ Janitor failed: ${result.janitorError || 'Unknown error'}`);
        }
        
        if (result.enrichSuccess === true) {
            details.push(`✅ Enrichment complete`);
        } else if (result.enrichSuccess === false) {
            details.push(`❌ Enrichment failed: ${result.enrichError || 'Unknown error'}`);
        }
        
        if (details.length > 0) {
            summaries.push(`${statusIcon} ${details.join(', ')}`);
        }
    }
    
    return summaries.length > 0 ? summaries.join('<br>') : null;
}
```

**Part F: Reset Badges on Auto-Run Start**

**File**: `popup/popup.js`

**Location**: Find the auto-run start handler (typically where `handleAutoRun()` or similar function starts the auto-run) and add this code:

```javascript
// When starting auto-run, reset pipeline badges:
if (elements.pipelineStepBadges) {
    resetPipelineBadges();
    elements.pipelineStepBadges.style.display = 'none';  // Hide until pipeline starts
}
```

**Gate Check 10.1:**
- [ ] Pipeline step badges HTML added to popup.html
- [ ] Pipeline badge CSS added to popup.css
- [ ] Badge elements added to `elements` object in popup.js
- [ ] `updateAutoRunProgressFromServiceWorker()` function replaced with enhanced version
- [ ] `updatePipelineStepBadges()` function added
- [ ] `resetPipelineBadges()` function added
- [ ] `generatePipelineSummary()` function added
- [ ] Auto-run start handler updated to reset badges
- [ ] No syntax errors (run linter)

**Integration Notes**:

1. **Badge Visibility**: Badges are shown when `progress.pipelineStep` or `progress.pipelineResults` exist
2. **Status Flow**: Badges transition through: `pending` → `running` → `success`/`failed`/`skipped`
3. **Visual Feedback**: Running badges have a pulse animation matching the pirate theme's dark red color scheme
4. **Status Mapping**: 
   - `pending` = Dark gray, not yet started
   - `running` = Dark red with pulse animation (pirate theme)
   - `success` = Green
   - `failed` = Crimson red
   - `skipped` = Grayed out with strikethrough
5. **Summary Display**: Pipeline results summary appears below badges when auto-run completes, styled to match the dark theme

---

## Testing Checklist

### Pre-Pipeline Tests (Setup Validation)

**Workbook Configuration:**
- [ ] Add a new workbook → verify `webAppUrl` field appears in edit modal
- [ ] Add a new workbook → verify `pipelineBaselineTab` dropdown appears in edit modal
- [ ] Select baseline tab dropdown → verify it populates with tabs from that workbook
- [ ] Change workbook selection → verify baseline tab dropdown updates to new workbook's tabs
- [ ] Save workbook with pipeline settings → verify settings persist after popup close/reopen

**Web App URL Configuration:**
- [ ] Enter invalid Web App URL (not ending in /exec) → verify "Test Connection" fails with clear error
- [ ] Enter invalid Web App URL (malformed) → verify "Test Connection" fails with clear error
- [ ] Enter valid Web App URL → verify "Test Connection" succeeds and shows success message
- [ ] Test connection with Web App that doesn't exist → verify clear error message
- [ ] Test connection with Web App that requires auth → verify appropriate error handling

**Pipeline Configuration Validation:**
- [ ] Enable pipeline with missing baseline tab → verify validation error shown before auto-run starts
- [ ] Enable pipeline with missing Web App URL (Janitor enabled) → verify validation error shown
- [ ] Enable pipeline with missing Web App URL (Enrich enabled) → verify validation error shown
- [ ] Enable pipeline with missing Web App URL (only Compare enabled) → verify no error (Web App not needed)
- [ ] Enable pipeline with all required fields → verify "Start Auto-Run" button becomes enabled
- [ ] Disable pipeline → verify auto-run can still start (pipeline just won't run)

**Global Pipeline Settings:**
- [ ] Toggle pipeline master switch → verify step checkboxes enable/disable appropriately
- [ ] Uncheck "Compare" step → verify comparison is skipped in execution
- [ ] Uncheck "Janitor" step → verify Janitor is skipped in execution
- [ ] Uncheck "Enrich" step → verify Enrichment is skipped in execution
- [ ] Save pipeline config → verify settings persist after popup close/reopen

### Pipeline Execution Tests (Happy Path)

**Full Pipeline Run:**
- [ ] Run auto-run with pipeline enabled, all steps on (Compare, Janitor, Enrich)
- [ ] Verify scraping completes to dated tab (e.g., `11_27_25`)
- [ ] Verify comparison runs and creates `new_leads_11_27_25` tab
- [ ] Verify new leads count matches expected (compare Tab A rows not in Tab B)
- [ ] Verify Janitor runs on `new_leads_11_27_25` tab (check `AI_Status` column added)
- [ ] Verify Enrichment runs (check `CRD Number`, `Total AUM (M)` columns added)
- [ ] Verify pipeline badges show correct status progression: `pending` → `running` → `success`
- [ ] Verify final summary shows pipeline results per workbook with correct status icons
- [ ] Verify all steps complete without errors in console

**Progress Display:**
- [ ] Verify pipeline step badges appear when pipeline starts
- [ ] Verify badge status updates in real-time: Compare → Janitor → Enrich
- [ ] Verify pulse animation on running badges
- [ ] Verify success badges turn green when step completes
- [ ] Verify pipeline progress text updates: "Comparing tabs..." → "Cleaning with Janitor AI..." → "Enriching with BigQuery..."
- [ ] Verify pipeline summary appears after auto-run completes

**Data Validation:**
- [ ] Verify comparison output tab contains only rows from new tab not in baseline
- [ ] Verify Janitor adds `AI_Status`, `AI_Category`, `AI_Reasoning` columns
- [ ] Verify Janitor moves rejected rows to `Janitor_Trash_Bin` tab
- [ ] Verify Enrichment adds all expected columns (Match Type, CRM Type, CRD Number, etc.)
- [ ] Verify Enrichment data matches BigQuery results (spot check a few rows)

### Error Handling Tests

**Web App Failures:**
- [ ] Kill Web App mid-Janitor → verify retry logic kicks in (3 attempts with exponential backoff)
- [ ] Use invalid Web App URL → verify graceful failure, enrichment still attempted (if Janitor fails)
- [ ] Use Web App that returns error → verify error message captured and displayed in summary
- [ ] Use Web App that times out (60s) → verify timeout handled and retry attempted
- [ ] Network error during Web App call → verify retry logic and graceful degradation

**Comparison Failures:**
- [ ] Delete baseline tab before running → verify comparison skipped with warning, pipeline continues
- [ ] Use baseline tab with no data → verify comparison handles empty tab gracefully
- [ ] Use baseline tab with different column structure → verify error handled gracefully
- [ ] Comparison API error → verify error logged, Janitor/Enrich skipped, auto-run continues

**Zero Results Handling:**
- [ ] Run pipeline on workbook with 0 new leads → verify Janitor/Enrich skipped (not errored)
- [ ] Verify pipeline status shows "No new leads to process" message
- [ ] Verify badges show Compare as success, Janitor/Enrich as skipped
- [ ] Verify pipeline summary indicates no new leads found

**State Recovery:**
- [ ] Close popup during pipeline → reopen and verify progress restored
- [ ] Close popup during Janitor → reopen and verify badge shows correct status
- [ ] Refresh extension during pipeline → verify state persists and pipeline continues
- [ ] Verify pipeline results stored in `autoRunState.progress.pipelineResults`

**Partial Failures:**
- [ ] Comparison failure → verify Pipeline marks as `partial`, skips Janitor/Enrich, auto-run continues
- [ ] Janitor failure → verify Pipeline marks as `partial`, still attempts Enrich, auto-run continues
- [ ] Enrichment failure → verify Pipeline marks as `partial`, auto-run continues
- [ ] Verify error summary shows which steps failed for which workbooks
- [ ] Verify failed steps show red badges with error messages

### Edge Cases

**Step Combinations:**
- [ ] Run with only Compare enabled (Janitor/Enrich off) → verify only comparison runs
- [ ] Run with only Janitor enabled (Compare/Enrich off) → verify Janitor runs on scraped tab directly
- [ ] Run with only Enrich enabled (Compare/Janitor off) → verify Enrichment runs on scraped tab directly
- [ ] Run with Compare off, Janitor on → verify Janitor runs on scraped tab directly (not new_leads tab)
- [ ] Run with Compare off, Enrich on → verify Enrichment runs on scraped tab directly

**Multiple Workbooks:**
- [ ] Multiple workbooks, only one has pipeline configured → verify pipeline only runs for configured one
- [ ] Multiple workbooks, all have pipeline configured → verify pipeline runs for each after its scraping completes
- [ ] Multiple workbooks, different baseline tabs → verify each uses its own baseline tab
- [ ] Multiple workbooks, same Web App URL → verify Web App called correctly for each

**Tab Naming:**
- [ ] Same baseline tab used for multiple weeks → verify each run creates unique `new_leads_DATE` tab
- [ ] Run pipeline twice in same day → verify second run creates new tab (not overwrites)
- [ ] Tab name with special characters → verify tab creation handles special chars correctly
- [ ] Very long tab name → verify tab creation handles long names

**Data Edge Cases:**
- [ ] Baseline tab with 0 rows → verify comparison handles empty baseline
- [ ] New tab with 0 rows → verify comparison handles empty new tab
- [ ] Baseline tab identical to new tab → verify 0 new leads, Janitor/Enrich skipped
- [ ] New tab has all rows from baseline plus new ones → verify only new rows in output

**Configuration Edge Cases:**
- [ ] Pipeline enabled but no workbooks mapped → verify no errors, pipeline simply doesn't run
- [ ] Pipeline enabled but workbook deleted → verify graceful handling
- [ ] Change baseline tab mid-auto-run → verify change doesn't affect running pipeline
- [ ] Change Web App URL mid-auto-run → verify change doesn't affect running pipeline

### Performance Tests

**Large Dataset Handling:**
- [ ] Run with 500+ row scrape → verify pipeline completes within reasonable time
- [ ] Run with 1000+ row scrape → verify no memory issues, pipeline completes
- [ ] Run Janitor on 200+ rows → verify no Apps Script timeout (Apps Script has 6min limit)
- [ ] Run Enrichment on 500+ rows → verify BigQuery query completes within timeout
- [ ] Verify progress updates continue during long-running operations

**Concurrent Operations:**
- [ ] Run multiple auto-runs in sequence → verify each pipeline completes independently
- [ ] Verify Web App calls don't interfere with each other
- [ ] Verify state management handles concurrent updates correctly

**Resource Usage:**
- [ ] Monitor memory usage during large pipeline run → verify no memory leaks
- [ ] Verify Apps Script quota limits respected (execution time, API calls)
- [ ] Verify extension storage limits not exceeded with large pipelineResults objects

**Timeout Handling:**
- [ ] Verify 60-second timeout per Web App call attempt
- [ ] Verify exponential backoff doesn't exceed reasonable total time (2s + 4s + 8s = 14s between attempts)
- [ ] Verify total pipeline time doesn't exceed auto-run timeout limits

---

## Migration Notes

### For Existing Users

1. **Pipeline is opt-in**: Existing functionality is unchanged. Pipeline only runs if explicitly enabled.

2. **Apps Script Setup Required**: Users must:
   - Deploy Apps Script functions as Web Apps (add `doPost()` handlers to both scripts)
   - Copy the Web App deployment URL (ending in `/exec`)
   - Configure Web App URL in Workbook Manager pipeline settings
   - Ensure Apps Script has necessary permissions (authorize on first deployment)

3. **Baseline Tab Configuration**: Users must configure which tab to use as baseline for comparison per workbook.

---

## Future Enhancements

1. **Pipeline Templates**: Save common pipeline configurations
2. **Pipeline History**: Track pipeline runs and results
3. **Conditional Steps**: Only run Janitor if new entries > threshold
4. **Notifications**: Email/Slack notifications on pipeline completion
5. **Retry Logic**: Automatic retry on transient failures
6. **Pipeline Scheduling**: Run pipelines on a schedule

---

## File Changes Summary

### New Files

**`background/apps_script_api.js`** (NEW)
- `callAppsScriptWebApp(webAppUrl, action, tabName, retries = 3)` - Core Web App HTTP POST function with retry logic
- `runJanitorAI(webAppUrl, tabName)` - Wrapper for Janitor AI Web App call
- `runBigQueryEnrichment(webAppUrl, tabName)` - Wrapper for BigQuery Enrichment Web App call

### Modified Files

**`background/service_worker.js`**
- `executePipeline(sourceName, workbookId, newTabName, baselineTabName, webAppUrl, config)` - NEW: Orchestrates pipeline steps
- `updatePipelineResult(workbookId, result)` - NEW: Updates pipeline status tracking
- `processSourceGroup()` - MODIFIED: Calls `executePipeline()` after scraping completes
- Message handler for `UPDATE_WORKBOOK_PIPELINE_CONFIG` - NEW: Updates workbook pipeline settings

**`popup/popup.html`**
- Pipeline section with master toggle and step checkboxes - NEW
- Pipeline Settings subsection in Workbook Manager - NEW (baseline tab dropdown, Web App URL input, Test Connection button)
- Pipeline step badges in auto-run progress section - NEW

**`popup/popup.js`**
- `loadPipelineConfig()` - NEW: Loads global pipeline settings
- `savePipelineConfig()` - NEW: Saves global pipeline settings
- `initPipelineConfig()` - NEW: Initializes pipeline UI
- `updatePipelineConfigUI()` - NEW: Updates pipeline UI state
- `populateWorkbookPipelineSettings()` - NEW: Populates workbook-specific pipeline settings
- `handleSaveWorkbookPipelineConfig()` - NEW: Saves workbook pipeline settings
- `handleTestWebApp()` - NEW: Tests Web App connection
- `updatePipelineReadinessSummary()` - NEW: Shows which workbooks are pipeline-ready
- `validatePipelineConfig()` - NEW: Validates pipeline config before auto-run
- `updateAutoRunProgressFromServiceWorker()` - MODIFIED: Adds pipeline badge updates and summary display
- `updatePipelineStepBadges(currentStep, currentStatus)` - NEW: Updates badge statuses
- `resetPipelineBadges()` - NEW: Resets badges to pending
- `generatePipelineSummary(pipelineResults)` - NEW: Generates user-friendly summary
- `getTabsForWorkbook(workbookId)` - NEW: Fetches tabs for a workbook
- Elements object - MODIFIED: Adds pipeline badge elements

**`popup/popup.css`**
- `.pipeline-section` styles - NEW
- `.pipeline-badges` and `.step-badge` styles - NEW
- `.pipeline-summary` styles - NEW
- Badge status-specific styles (pending, running, success, failed, skipped) - NEW
- Pulse animation for running badges - NEW

### Apps Script Files (User Must Modify)

**`google-apps-script/janitor-ai.gs`**
- `doPost(e)` - NEW: Web App entry point for `cleanTab` action
- `testDoPost()` - NEW: Test function for local testing

**`google-apps-script/enricher.gs`**
- `doPost(e)` - NEW: Web App entry point for `enrichTab` action
- `testDoPost()` - NEW: Test function for local testing

---

## Implementation Order

**IMPORTANT**: Apps Script changes (Step 8) should be done FIRST as they are a prerequisite for testing. However, the code can be implemented in parallel.

### Phase 1: Prerequisites (Do First)
1. **Step 8**: Deploy Apps Script as Web App
   - Add `doPost()` handlers to `janitor-ai.gs` and `enricher.gs`
   - Deploy as Web App and copy the URL
   - This is required before you can test the pipeline

### Phase 2: Core Implementation
2. **Step 1-2**: Create Apps Script Web App integration module
   - Create `background/apps_script_api.js`
   - No manifest changes needed
   - Can be done in parallel with Step 8

3. **Step 3-5**: Build pipeline configuration UI
   - Add pipeline section to popup HTML
   - Implement pipeline state management in popup.js
   - Add pipeline settings to Workbook Manager
   - Add CSS styles

4. **Step 6-7**: Integrate pipeline execution into auto-run
   - Add `executePipeline()` function to service_worker.js
   - Modify `processSourceGroup()` to call pipeline
   - Basic version without full error handling

5. **Step 7.5**: Add comprehensive error handling and recovery logic
   - Enhance `executePipeline()` with step-by-step error handling
   - Add `updatePipelineResult()` for status tracking
   - Update service worker progress messages

### Phase 3: UI Polish
6. **Step 9-10**: Polish UI and progress display
   - Add pipeline step badges HTML/CSS
   - Enhance `updateAutoRunProgressFromServiceWorker()`
   - Add badge update functions
   - Add pipeline summary display

### Phase 4: Testing
7. **Testing**: Follow testing checklist
   - Start with Pre-Pipeline Tests (setup validation)
   - Then Pipeline Execution Tests (happy path)
   - Then Error Handling Tests
   - Finally Edge Cases and Performance Tests

---

## Notes

- Pipeline execution is **non-blocking** for auto-run. If pipeline fails, auto-run continues.
- Pipeline steps are **sequential** but can be individually disabled.
- Pipeline runs **per source/workbook** after all searches for that source complete.
- Apps Script functions must be **deployed as Web Apps** with execution permissions set to "Anyone" (or use OAuth if more secure).
- **Error Handling**: Pipeline failures are handled gracefully - each step can fail independently without breaking the entire pipeline or auto-run. See Step 7.5 for comprehensive error handling and recovery logic.
- **Retry Logic**: Web App calls automatically retry up to 3 times with exponential backoff (2s, 4s, 8s delays) and a 60-second timeout per attempt.
- **Status Tracking**: Pipeline results are tracked per workbook in `autoRunState.progress.pipelineResults`, allowing users to see exactly which steps succeeded or failed.

---

**END OF IMPLEMENTATION PLAN**

