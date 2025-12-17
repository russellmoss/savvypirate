# LinkedIn Scraper Extension - Technical Architecture Documentation

**Version:** 1.0  
**Date:** December 2024  
**Purpose:** Comprehensive technical documentation for understanding the extension's architecture, mechanisms, and design decisions. This document serves as the foundation for building a cleaner, more efficient automated version.

---

## Table of Contents

1. [Data Flow: Scraping to Google Sheets](#1-data-flow-scraping-to-google-sheets)
2. [DOM Resilience: Fallbacks and Safeguards](#2-dom-resilience-fallbacks-and-safeguards)
3. [Anti-Detection Strategies](#3-anti-detection-strategies)
4. [Workbook Mapping System](#4-workbook-mapping-system)
5. [Input Sheet Reading and Search Management](#5-input-sheet-reading-and-search-management)
6. [Key Learnings and Recommendations](#6-key-learnings-and-recommendations)

---

## 1. Data Flow: Scraping to Google Sheets

### 1.1 Architecture Overview

The extension uses a **three-layer architecture**:

```
┌─────────────────┐
│  Content Script │  (content/content.js)
│  - DOM Scraping │
│  - Data Extract │
└────────┬────────┘
         │ Message Passing
         ▼
┌─────────────────┐
│ Service Worker  │  (background/service_worker.js)
│  - Orchestration│
│  - Queue Mgmt   │
└────────┬────────┘
         │ Google Sheets API
         ▼
┌─────────────────┐
│  Google Sheets  │
│  - Storage      │
│  - Tab Mgmt     │
└─────────────────┘
```

### 1.2 Scraping Process

#### Step 1: Content Script Initialization

**File:** `content/content.js`

When a LinkedIn search results page loads:

1. **Content script injection** (via `manifest.json` content_scripts)
2. **Selector initialization** - Loads optimized selectors from service worker
3. **Message listener setup** - Waits for `START_SCRAPING` command

```javascript
// Content script listens for scraping commands
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'START_SCRAPING') {
        startScraping(message.sourceName);
    }
});
```

#### Step 2: Page Scraping Loop

**Function:** `scrapeCurrentPage(sourceName)`

For each page of search results:

1. **Scroll to load lazy content**
   ```javascript
   window.scrollTo(0, document.body.scrollHeight);
   await wait(CONFIG.SCROLL_WAIT_MS); // 2000ms
   ```

2. **Find all profile cards**
   - Uses `querySelectorAllWithFallbacks()` with multiple selector strategies
   - Primary: `div[data-view-name="people-search-result"]`
   - Fallbacks: `li.reusable-search__result-container`, `.entity-result__item`, etc.

3. **Extract data from each card**
   - **Name**: From `a[data-view-name="search-result-lockup-title"]`
   - **Title/Location**: Multi-layer extraction (see Section 2.2)
   - **LinkedIn URL**: From `href` attribute, normalized (removes query params)
   - **Accreditations**: Parsed from name using `parseNameWithAccreditations()`
   - **Connection Source**: Passed from input sheet (Column A)

4. **Format row data**
   ```javascript
   [
       today,              // Date (Column A)
       cleanName,          // Name (Column B)
       title,              // Title (Column C)
       location,           // Location (Column D)
       connectionSource,   // Connection Source (Column E)
       url,                // LinkedIn URL (Column F)
       ...accreditations   // Accreditations 1-6 (Columns G-L)
   ]
   ```

5. **Send to service worker**
   ```javascript
   chrome.runtime.sendMessage({
       action: 'DATA_SCRAPED',
       rows: pageRows,
       pageNumber: pageCount
   });
   ```

#### Step 3: Service Worker Queue Management

**File:** `background/service_worker.js`  
**Module:** `background/sync_queue.js`

When `DATA_SCRAPED` message received:

1. **Add to local queue** (immediate - data is safe)
   ```javascript
   await addToQueue(message.rows, currentOutputSheetId, currentTabName);
   ```
   - Data stored in `chrome.storage.local` under key `syncQueue`
   - Each queue item contains: `{ id, spreadsheetId, tabName, rows, retryCount, createdAt }`

2. **Trigger queue processing**
   - Queue processor runs every 30 seconds (alarm-based)
   - Also triggered immediately after adding items

3. **Process queue items**
   ```javascript
   async function processQueue() {
       const queue = await getQueue();
       for (const item of queue) {
           try {
               await appendRowsToTab(
                   item.spreadsheetId,
                   item.tabName,
                   item.rows
               );
               // Remove from queue on success
           } catch (error) {
               // Increment retry count, exponential backoff
           }
       }
   }
   ```

#### Step 4: Google Sheets API Write

**File:** `background/sheets_api.js`

**Function:** `appendRowsToTab(spreadsheetId, tabName, rows)`

1. **Get OAuth token** (with auto-refresh on 401)
   ```javascript
   const token = await getAuthToken(true);
   ```

2. **Format tab name for range**
   - Tab names with spaces/special chars: `'Tab Name'!A:Z`
   - Simple names: `TabName!A:Z`

3. **Batch append via Sheets API**
   ```javascript
   POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}:append
   {
       "values": rows,
       "valueInputOption": "USER_ENTERED"
   }
   ```

4. **Retry logic**
   - 401 errors: Auto-refresh token, retry once
   - Other errors: Exponential backoff (2s, 4s, 8s, 16s, 32s)
   - Max 5 retries per item

### 1.3 Data Persistence Strategy

**Local-First Architecture:**

1. **Immediate local storage** - Data saved to `chrome.storage.local` queue immediately
2. **Background sync** - Queue processed asynchronously
3. **Retry on failure** - Failed items retry with exponential backoff
4. **No data loss** - Data persists even if browser closes mid-scrape

**Storage Structure:**
```javascript
chrome.storage.local = {
    syncQueue: [
        {
            id: "timestamp-random",
            spreadsheetId: "abc123...",
            tabName: "12_16_25",
            rows: [[...], [...]],
            retryCount: 0,
            createdAt: "2024-12-16T10:30:00Z"
        }
    ],
    failedRows: [...],  // Items that failed after max retries
    selectorConfig: {...},
    selectorStats: {...}
}
```

### 1.4 Tab Management

**Weekly Tab Creation:**

- Tabs named by date: `MM_DD_YY` (e.g., `12_16_25`)
- Created automatically when needed via `ensureWeeklyTab()`
- Each source connection writes to its own workbook's weekly tab
- Tab selection via dropdown in popup UI

---

## 2. DOM Resilience: Fallbacks and Safeguards

### 2.1 Multi-Layer Selector System

**File:** `background/selector_config.js`

The extension uses a **fallback chain** for each element type:

```javascript
export const DEFAULT_SELECTORS = {
    title: [
        // Strategy 1: Most reliable (current LinkedIn structure)
        'div[data-view-name="people-search-result"] div.d395caa1:not(.a7293f27) > p',
        // Strategy 2: Alternative positional selector
        'div[data-view-name="people-search-result"] div.d395caa1:first-of-type > p',
        // Strategy 3-13: Older selectors, class-based, nth-of-type, etc.
        ...
    ],
    location: [
        // Strategy 1: Current structure (location has .a7293f27 class)
        'div[data-view-name="people-search-result"] div.d395caa1.a7293f27 > p',
        // Strategy 2-11: Fallbacks
        ...
    ]
}
```

**Selector Priority:**
1. **Data attributes** (`data-view-name`, `data-testid`) - Most stable
2. **Relative positional** (`:first-of-type`, `~`, `+`) - Structure-based
3. **Class-based** - May change, but often stable
4. **Generic** (`p:nth-of-type(2)`) - Last resort

### 2.2 Multi-Layer Extraction System

**File:** `content/content.js`  
**Function:** `scrapeCurrentPage()`

**Layer 1: Structure-Aware Extraction**

```javascript
const structureResult = extractByStructure(card);
```

- Finds name link first: `a[href*="/in/"]`
- Traverses DOM tree to find sibling/child elements
- Uses positional relationships rather than classes
- Identifies title/location by content patterns

**Layer 2: Direct P-Tag Extraction**

If structure-aware fails:

```javascript
const allPTags = Array.from(card.querySelectorAll('p'));
const dataPTags = allPTags.filter(p => {
    // Filter out name, connection indicators, noise
    const text = p.innerText?.trim() || '';
    return !text.includes('mutual connection') &&
           !text.includes('• 1st') &&
           text.length > 3 && text.length < 200;
});

// First p-tag = title, Second = location
title = dataPTags[0]?.innerText?.trim() || '';
location = dataPTags[1]?.innerText?.trim() || '';
```

**Layer 3: Selector Fallbacks**

If direct extraction fails:

```javascript
const titleElement = querySelectorWithFallbacks(card, 'title');
```

- Tries each selector in the fallback chain
- Tracks success/failure for optimization
- Uses first successful selector

**Layer 4: Content Pattern Validation**

```javascript
if (looksLikeLocation(title) && looksLikeTitle(location)) {
    [title, location] = [location, title]; // Swap if misidentified
}
```

- Regex patterns to identify title vs location
- Swaps if content suggests misidentification

### 2.3 Selector Optimization System

**File:** `background/selector_config.js`  
**Function:** `autoLearnSelectorOrder()`

**How it works:**

1. **Track selector performance**
   ```javascript
   selectorStats = {
       'title': {
           'selector1': { attempts: 100, successes: 95 },
           'selector2': { attempts: 50, successes: 30 }
       }
   }
   ```

2. **Calculate success rates**
   ```javascript
   successRate = successes / attempts
   ```

3. **Reorder selectors by success rate**
   - Most successful selectors tried first
   - Failed selectors moved to end
   - Dynamic adaptation to LinkedIn changes

4. **Persist optimized order**
   - Saved to `chrome.storage.local.selectorConfig`
   - Loaded on extension startup
   - Shared across all scraping sessions

### 2.4 Page Fingerprinting

**File:** `content/content.js`  
**Function:** `generatePageFingerprint()`

**Purpose:** Detect when LinkedIn changes their DOM structure

**Fingerprint includes:**
- URL base (without query params)
- Data attributes (`data-view-name`, `data-testid`)
- Key CSS classes (non-randomized ones)
- DOM structure sample (first 5 profile cards)

**Usage:**
- Generated before each scrape
- Sent to service worker for comparison
- If fingerprint changes → LinkedIn may have updated UI
- Triggers selector revalidation

### 2.5 Health Monitoring

**File:** `background/service_worker.js`  
**Function:** `getSelectorHealthReport()`

**Metrics tracked:**
- Overall health percentage
- Per-selector-type success rates
- Recommendations for selector updates
- Critical failures (0% success rate)

**Display:**
- Health indicator in popup UI
- Color-coded (green/yellow/red)
- Clickable for detailed report

---

## 3. Anti-Detection Strategies

### 3.1 Human-Like Timing

**File:** `content/content.js`

**Random Delays:**

```javascript
const randomDelay = () => {
    const base = CONFIG.MIN_WAIT_SECONDS;      // 5 seconds
    const variance = CONFIG.MAX_WAIT_SECONDS - CONFIG.MIN_WAIT_SECONDS; // 3 seconds
    return (base + Math.random() * variance) * 1000; // 5-8 seconds random
};
```

**Applied at:**
- Between page navigations (5-8 seconds)
- After scrolling (2 seconds fixed)
- Before clicking "Next" button

**Between Sources (Auto-Run):**

```javascript
// 30-60 second random delay between different source connections
const totalDelay = 30000 + Math.random() * 30000;
```

### 3.2 Scrolling Behavior

**File:** `content/content.js`

**Natural scrolling:**
```javascript
window.scrollTo(0, document.body.scrollHeight);
await wait(CONFIG.SCROLL_WAIT_MS); // 2000ms
```

- Scrolls to bottom to trigger lazy loading
- Waits for content to load
- Mimics human reading behavior

### 3.3 Keep-Alive Mechanism

**File:** `background/service_worker.js`

**Purpose:** Prevent service worker from going idle during long scrapes

```javascript
function startKeepAlive() {
    chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 }); // ~24 seconds
}
```

- Service worker stays active during scraping
- Prevents Chrome from terminating background script
- Critical for long-running scrapes (100+ pages)

### 3.4 Request Throttling

**Google Sheets API:**

- Queue-based batching (not immediate API calls)
- 30-second processing interval
- Prevents rate limiting
- Exponential backoff on errors

### 3.5 Browser Fingerprint Avoidance

**Current Implementation:**
- Uses standard Chrome extension APIs
- No headless browser detection
- Runs in real browser context
- User is logged into LinkedIn (legitimate session)

**Future Considerations:**
- Residential proxies (if needed)
- User-Agent rotation (if needed)
- Canvas fingerprint randomization (if needed)

### 3.6 Error Handling and Recovery

**Graceful degradation:**
- If selector fails → try next in chain
- If page structure changes → fallback to generic selectors
- If API fails → retry with backoff
- If scrape interrupted → data already saved locally

**No abrupt failures:**
- All errors caught and logged
- Scraping continues even if some cards fail
- Partial data saved (better than nothing)

---

## 4. Workbook Mapping System

### 4.1 Architecture

**File:** `popup/popup.js`, `sidebar/sidebar.js`

**Purpose:** Map each "Source Connection" (Column A from input sheet) to a specific Google Sheets workbook.

**Data Structure:**
```javascript
sourceMapping = {
    "Taylor Smith": "workbook-id-123",
    "John Davis": "workbook-id-456",
    "Sarah Johnson": "workbook-id-789"
}
```

### 4.2 Mapping Creation

**Manual Mapping:**
1. User loads input sheet (reads Column A = Source Connections)
2. Extension displays mapping UI
3. User selects workbook from dropdown for each source
4. Mapping saved to `chrome.storage.local.sourceMapping`

**Auto-Mapping:**
```javascript
async function autoMapSources() {
    // For each unmapped source:
    // Find workbook with matching name
    const matchingWorkbook = state.savedWorkbooks.find(wb => {
        const wbName = wb.name.toLowerCase().trim();
        const sourceName = sourceName.toLowerCase().trim();
        return wbName === sourceName || 
               wbName.includes(sourceName) || 
               sourceName.includes(wbName);
    });
}
```

- Matches source name to workbook name
- Fuzzy matching (includes/contains)
- Case-insensitive

### 4.3 Mapping Usage During Scraping

**File:** `background/service_worker.js`  
**Function:** `processSourceGroup()`

**During auto-run:**

1. **Group searches by source**
   ```javascript
   const sourceGroups = {};
   searches.forEach(search => {
       if (!sourceGroups[search.source]) {
           sourceGroups[search.source] = [];
       }
       sourceGroups[search.source].push(search);
   });
   ```

2. **Get workbook for each source**
   ```javascript
   const workbookId = sourceMapping[sourceName];
   if (!workbookId) {
       console.error(`No workbook mapped for source: ${sourceName}`);
       continue; // Skip this source
   }
   ```

3. **Process all searches for that source**
   - All searches for "Taylor Smith" → same workbook
   - Each search creates/uses weekly tab (MM_DD_YY)
   - Data appended to correct tab

### 4.4 Tab Management Per Workbook

**Weekly Tabs:**
- Each workbook has date-based tabs: `12_16_25`, `12_23_25`, etc.
- Created automatically via `ensureWeeklyTab()`
- Last used tab remembered per workbook
- Tab selection via dropdown in popup

**Tab Naming:**
```javascript
function getWeeklyTabName() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    return `${month}_${day}_${year}`;
}
```

### 4.5 Saved Workbooks

**Storage:**
```javascript
savedWorkbooks = [
    {
        id: "workbook-id-123",
        name: "Taylor Smith Connections",
        sheetTitle: "Taylor Smith Connections", // From Sheets API
        lastUsed: "2024-12-16T10:30:00Z",
        lastTab: "12_16_25",
        addedAt: "2024-12-01T08:00:00Z"
    }
]
```

**Management:**
- Loaded from `chrome.storage.local.savedWorkbooks`
- Updated when workbook is selected/used
- Displayed in dropdown for selection

---

## 5. Input Sheet Reading and Search Management

### 5.1 Input Sheet Format

**Required Columns:**
- **Column A**: Source Connection (e.g., "Taylor Smith")
- **Column B**: Job Title Filter (e.g., "Financial Advisor")
- **Column C**: LinkedIn Search URL (full URL with filters)

**Example:**
```
| Source Connection | Job Title Filter | LinkedIn Search URL |
|-------------------|------------------|---------------------|
| Taylor Smith      | Financial Advisor| https://linkedin.com/search/... |
| John Davis        | Wealth Manager   | https://linkedin.com/search/... |
```

### 5.2 Reading Input Sheet

**File:** `popup/popup.js`  
**Function:** `handleLoadSearches()`

**Process:**

1. **User enters Sheet ID**
   ```javascript
   const sheetId = extractSheetId(elements.inputSheetId.value);
   ```

2. **Read Sheet via API**
   ```javascript
   const response = await sendMessage('READ_SHEET', {
       spreadsheetId: sheetId,
       range: 'Sheet1!A:C'  // Columns A, B, C
   });
   ```

3. **Parse rows**
   ```javascript
   const rows = response.data || [];
   const startRow = rows[0]?.[0]?.toLowerCase().includes('source') ? 1 : 0;
   
   state.searches = rows.slice(startRow).map(row => ({
       source: row[0] || '',      // Column A
       title: row[1] || '',      // Column B
       url: row[2] || ''         // Column C
   })).filter(s => s.url);  // Only rows with URLs
   ```

4. **Save to storage**
   ```javascript
   await sendMessage('SAVE_SETTINGS', {
       settings: {
           inputSheetId: sheetId,
           searches: state.searches
       }
   });
   ```

### 5.3 Search Display and Selection

**File:** `popup/popup.js`  
**Function:** `renderSearchList()`

**UI Display:**
- List of all loaded searches
- Shows: Source, Title, URL (truncated)
- Checkboxes for selection (auto-run)
- "Open" button for manual scraping

**Search State:**
```javascript
state.searches = [
    {
        source: "Taylor Smith",
        title: "Financial Advisor",
        url: "https://linkedin.com/search/..."
    },
    ...
]
```

### 5.4 Auto-Run Configuration

**File:** `popup/popup.js`  
**Function:** `handleAutoRun()`

**User selects:**
- Which searches to run (checkboxes)
- Auto-run processes them sequentially

**Configuration:**
```javascript
const config = {
    selectedSearches: [search1, search2, ...],
    sourceMapping: {
        "Taylor Smith": "workbook-id-123",
        ...
    }
};
```

### 5.5 Search Execution Flow

**File:** `background/service_worker.js`  
**Function:** `processSourceGroup()`

**For each selected search:**

1. **Navigate to LinkedIn URL**
   ```javascript
   await chrome.tabs.update(linkedInTab.id, {
       url: search.url,
       active: true
   });
   ```

2. **Wait for page load**
   ```javascript
   await waitForTabLoad(linkedInTab.id);
   ```

3. **Inject content script** (if needed)
   ```javascript
   await ensureContentScript(linkedInTab.id);
   ```

4. **Start scraping**
   ```javascript
   await chrome.tabs.sendMessage(linkedInTab.id, {
       action: 'START_SCRAPING',
       sourceName: search.source  // Passed to content script
   });
   ```

5. **Wait for completion**
   - Content script sends `SCRAPING_COMPLETE` when done
   - Service worker waits for this message

6. **Delay before next search**
   - 30-60 second random delay
   - Prevents detection
   - Allows user to see progress

### 5.6 Progress Tracking

**File:** `background/service_worker.js`

**Progress updates:**
```javascript
chrome.runtime.sendMessage({
    action: 'AUTO_RUN_PROGRESS',
    progress: {
        currentSearch: searchNum,
        totalSearches: searches.length,
        currentSource: sourceName,
        completedSearches: completedCount
    }
});
```

**Displayed in:**
- Popup UI (progress bar, status text)
- Sidebar UI (if open)

---

## 6. Key Learnings and Recommendations

### 6.1 What Works Well

1. **Local-First Queue System**
   - Data never lost, even on crashes
   - Resilient to network issues
   - Can resume after browser restart

2. **Multi-Layer Selector System**
   - Handles LinkedIn DOM changes gracefully
   - Self-optimizing (learns which selectors work)
   - Multiple fallback strategies

3. **Structure-Aware Extraction**
   - More resilient than class-based selectors
   - Works even when classes change
   - Content pattern validation catches errors

4. **Workbook Mapping**
   - Clean separation of data by source
   - Weekly tabs for time-based organization
   - Flexible mapping (manual or auto)

### 6.2 Pain Points

1. **Chrome Extension Limitations**
   - Service worker can be terminated
   - Requires keep-alive mechanism
   - Complex message passing

2. **LinkedIn DOM Volatility**
   - Classes change frequently
   - Structure changes occasionally
   - Requires constant selector updates

3. **Google Sheets API Rate Limits**
   - Need queue/throttling
   - 401 token refresh complexity
   - Tab name formatting edge cases

4. **Manual Configuration**
   - User must set up input sheet
   - Manual workbook mapping
   - Tab selection required

### 6.3 Recommendations for Automated Version

#### 6.3.1 Architecture Changes

**Move to Server-Side:**
- Node.js/Python service running 24/7
- No browser extension limitations
- Better error handling and logging
- Can use headless browser (Puppeteer/Playwright)

**Database Instead of Google Sheets:**
- Primary storage: PostgreSQL/MySQL
- Export to Sheets periodically (if needed)
- Better querying and deduplication
- Faster writes

**Configuration via Database:**
- Store searches in database table
- Store workbook mappings in database
- No manual input sheet needed
- API for adding/updating searches

#### 6.3.2 Selector Strategy

**Keep Multi-Layer System:**
- Structure-aware extraction (most reliable)
- Direct p-tag fallback (works when structure changes)
- Selector fallback chain (for edge cases)
- Content pattern validation (catches swaps)

**Add Automated Testing:**
- Daily selector health checks
- Alert when success rate drops
- Auto-update selectors based on DOM analysis
- A/B test new selectors

#### 6.3.3 Anti-Detection Enhancements

**Residential Proxies:**
- Rotate IP addresses
- Use real user IPs (not datacenter)
- Geographic distribution

**Browser Fingerprinting:**
- Randomize User-Agent
- Canvas fingerprint randomization
- WebGL fingerprint randomization
- Font fingerprint randomization

**Timing Improvements:**
- More variable delays (not just 5-8 seconds)
- Human-like pause patterns
- Random mouse movements (if visible)
- Variable scroll speeds

**Session Management:**
- Multiple LinkedIn accounts (rotation)
- Session cookies persistence
- Account health monitoring
- Auto-switch on detection

#### 6.3.4 Automation Features

**Scheduled Execution:**
- Cron-based scheduling (weekly runs)
- Configurable per source
- Time-of-day randomization
- Automatic retry on failure

**Monitoring and Alerts:**
- Success rate tracking
- Failure notifications (email/Slack)
- Health dashboards
- Performance metrics

**Data Quality:**
- Automatic deduplication
- Data validation rules
- Missing field detection
- Quality scoring

#### 6.3.5 Technical Stack Recommendations

**Backend:**
- **Language**: Node.js (familiar) or Python (better scraping libs)
- **Browser**: Puppeteer (Chrome) or Playwright (multi-browser)
- **Database**: PostgreSQL (structured data) or MongoDB (flexible)
- **Queue**: Redis (fast) or RabbitMQ (reliable)
- **Scheduler**: node-cron or APScheduler

**Infrastructure:**
- **Hosting**: AWS EC2, Google Cloud VM, or dedicated server
- **Proxy Service**: Bright Data, Oxylabs, or Smartproxy
- **Monitoring**: Prometheus + Grafana or Datadog
- **Logging**: ELK Stack or CloudWatch

**Architecture Pattern:**
```
┌─────────────┐
│  Scheduler  │  (Cron jobs)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Queue     │  (Redis/RabbitMQ)
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│   Worker    │─────▶│   Browser    │
│  (Node.js)  │      │  (Puppeteer) │
└──────┬──────┘      └──────────────┘
       │
       ▼
┌─────────────┐
│  Database   │
│ (PostgreSQL)│
└─────────────┘
```

### 6.4 Migration Path

**Phase 1: Proof of Concept**
1. Build Node.js scraper with Puppeteer
2. Port selector system from extension
3. Test on single source
4. Compare results with extension

**Phase 2: Core Features**
1. Database schema design
2. Queue system implementation
3. Workbook mapping logic
4. Google Sheets export (if needed)

**Phase 3: Automation**
1. Scheduler implementation
2. Multi-account support
3. Proxy integration
4. Monitoring setup

**Phase 4: Production**
1. Error handling and recovery
2. Performance optimization
3. Documentation
4. Deployment

### 6.5 Critical Success Factors

1. **Selector Resilience**
   - Must handle LinkedIn DOM changes
   - Multi-layer fallback system is essential
   - Automated testing/validation

2. **Anti-Detection**
   - Human-like timing is critical
   - Residential proxies recommended
   - Multiple accounts for rotation

3. **Data Quality**
   - Deduplication is essential
   - Validation rules prevent bad data
   - Monitoring catches issues early

4. **Reliability**
   - Queue system prevents data loss
   - Retry logic handles transient failures
   - Monitoring alerts on problems

5. **Maintainability**
   - Clear code structure
   - Comprehensive logging
   - Easy selector updates
   - Good documentation

---

## Appendix A: File Reference

### Core Files

- `content/content.js` - DOM scraping, data extraction
- `background/service_worker.js` - Orchestration, queue management
- `background/sheets_api.js` - Google Sheets API wrapper
- `background/sync_queue.js` - Local queue with retry logic
- `background/selector_config.js` - Selector definitions and optimization
- `popup/popup.js` - UI for manual control
- `sidebar/sidebar.js` - Sidebar UI (alternative interface)

### Configuration Files

- `manifest.json` - Extension configuration
- `background/auth.js` - OAuth token management

### Google Apps Script

- `google-apps-script/enricher.gs` - BigQuery enrichment
- `google-apps-script/janitor-ai.gs` - AI-based lead cleaning

---

## Appendix B: Key Constants

```javascript
// content/content.js
CONFIG = {
    MAX_PAGES: 1000,
    MIN_WAIT_SECONDS: 5,
    MAX_WAIT_SECONDS: 8,
    SCROLL_WAIT_MS: 2000
}

// background/sync_queue.js
MAX_RETRIES = 5
BASE_DELAY_MS = 2000

// background/service_worker.js
KEEPALIVE_ALARM = 'keepalive-alarm'  // Every 24 seconds
QUEUE_PROCESS_ALARM = 'queue-process-alarm'  // Every 30 seconds
```

---

## Appendix C: Data Formats

### Scraped Row Format
```javascript
[
    "2024-12-16",           // Date
    "John Smith",           // Name
    "Financial Advisor",    // Title
    "New York, NY",         // Location
    "Taylor Smith",         // Connection Source
    "https://linkedin.com/in/john-smith",  // LinkedIn URL
    "CFP®",                 // Accreditation 1
    "AIF®",                 // Accreditation 2
    "",                     // Accreditation 3
    "",                     // Accreditation 4
    "",                     // Accreditation 5
    ""                      // Accreditation 6
]
```

### Queue Item Format
```javascript
{
    id: "1702734000000-abc123xyz",
    spreadsheetId: "1abc...",
    tabName: "12_16_25",
    rows: [[...], [...]],
    retryCount: 0,
    createdAt: "2024-12-16T10:30:00Z",
    lastAttempt: null
}
```

### Search Object Format
```javascript
{
    source: "Taylor Smith",
    title: "Financial Advisor",
    url: "https://linkedin.com/search/results/people/..."
}
```

---

**End of Document**

