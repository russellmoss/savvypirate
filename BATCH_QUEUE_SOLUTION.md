# Batch Queue with Source Grouping Solution

## Problem
Currently, all searches go to one workbook. We need to:
- Group searches by Source Connection (Taylor Newman, Morgan Cirotto, etc.)
- Scrape all searches for each source into THEIR workbook
- Automatically switch workbooks when source changes

## Solution Architecture

### 1. Group Searches by Source

```javascript
// In popup.js
function groupSearchesBySource(searches) {
    const grouped = {};
    
    searches.forEach(search => {
        const source = search.source || 'Unknown';
        if (!grouped[source]) {
            grouped[source] = [];
        }
        grouped[source].push(search);
    });
    
    return grouped;
}

// Example output:
// {
//   "Taylor Newman": [
//     { source: "Taylor Newman", title: "Financial Advisor", url: "..." },
//     { source: "Taylor Newman", title: "Wealth Manager", url: "..." },
//     ...
//   ],
//   "Morgan Cirotto": [
//     { source: "Morgan Cirotto", title: "Financial Advisor", url: "..." },
//     ...
//   ]
// }
```

### 2. Find or Create Workbook by Source Name

```javascript
// In popup.js
async function findOrCreateWorkbookForSource(sourceName) {
    // 1. Check if workbook exists with this name
    const existing = state.savedWorkbooks.find(
        w => w.name.toLowerCase() === sourceName.toLowerCase()
    );
    
    if (existing) {
        console.log(`[POPUP] Found existing workbook: ${existing.name}`);
        return existing;
    }
    
    // 2. Workbook doesn't exist - need to create it
    // Option A: Auto-create new sheet
    // Option B: Prompt user to provide sheet ID
    
    // For now, we'll prompt user (safer)
    return await promptForWorkbookCreation(sourceName);
}

async function promptForWorkbookCreation(sourceName) {
    // Show modal/dialog asking user to:
    // 1. Create a new Google Sheet for this source
    // 2. Paste the Sheet ID
    // 3. Save it as a workbook
    
    // This could be automated later with CREATE_SHEET API call
    return null; // User needs to create manually
}
```

### 3. Batch Queue Processor

```javascript
// In popup.js
async function startBatchQueue() {
    if (!state.searches || state.searches.length === 0) {
        updateStatus('❌ No searches loaded');
        return;
    }
    
    // Group searches by source
    const groupedSearches = groupSearchesBySource(state.searches);
    const sources = Object.keys(groupedSearches);
    
    console.log(`[POPUP] Found ${sources.length} sources:`, sources);
    
    // Process each source group
    for (let i = 0; i < sources.length; i++) {
        const sourceName = sources[i];
        const searches = groupedSearches[sourceName];
        
        updateStatus(`📚 Processing ${sourceName} (${searches.length} searches)...`);
        
        // 1. Find or create workbook for this source
        const workbook = await findOrCreateWorkbookForSource(sourceName);
        
        if (!workbook) {
            updateStatus(`⚠️ Skipping ${sourceName} - workbook not found. Please create it first.`);
            continue;
        }
        
        // 2. Set this workbook as active
        await setWorkbookActive(workbook);
        
        // 3. Scrape all searches for this source
        for (let j = 0; j < searches.length; j++) {
            const search = searches[j];
            
            updateStatus(
                `🔄 ${sourceName}: ${search.title} (${j + 1}/${searches.length})`
            );
            
            // Open LinkedIn URL
            const tab = await chrome.tabs.create({
                url: search.url,
                active: true
            });
            
            // Wait for page load
            await waitForPageLoad(tab.id);
            
            // Start scraping
            await startScrapingForSearch(tab.id, search, workbook);
            
            // Wait for completion
            await waitForScrapeComplete(tab.id);
            
            // Close tab (optional)
            // await chrome.tabs.remove(tab.id);
            
            // Delay between searches (30-60 seconds)
            if (j < searches.length - 1) {
                const delay = 30000 + Math.random() * 30000; // 30-60 seconds
                await wait(delay);
            }
        }
        
        // Delay between sources (longer break)
        if (i < sources.length - 1) {
            updateStatus(`⏳ Break before next source...`);
            await wait(60000); // 1 minute break between sources
        }
    }
    
    updateStatus('✅ Batch queue complete!');
}

async function setWorkbookActive(workbook) {
    // Set workbook as active in Workbook Manager
    state.activeSheetId = workbook.id;
    state.activeSheetType = 'workbook';
    state.selectedWorkbook = workbook;
    
    // Update UI
    if (elements.savedWorkbooksSelect) {
        elements.savedWorkbooksSelect.value = workbook.id;
    }
    
    // Ensure weekly tab exists
    const tabResult = await sendMessage('ENSURE_WEEKLY_TAB', {
        spreadsheetId: workbook.id
    });
    
    // Set as active output in service worker
    await sendMessage('SET_ACTIVE_TAB', {
        spreadsheetId: workbook.id,
        tabName: tabResult.tabName
    });
    
    console.log(`[POPUP] Activated workbook: ${workbook.name}`);
}

async function startScrapingForSearch(tabId, search, workbook) {
    // Inject content script if needed
    await ensureContentScriptInjected(tabId);
    
    // Start scraping
    await chrome.tabs.sendMessage(tabId, {
        action: 'START_SCRAPING',
        sourceName: search.source
    });
    
    // Wait for completion (poll for status)
    return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
            const status = await checkScrapingStatus(tabId);
            if (!status.isActive) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 2000);
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPageLoad(tabId) {
    return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab.status === 'complete') {
                    clearInterval(checkInterval);
                    // Additional wait for LinkedIn to fully load
                    await wait(3000);
                    resolve();
                }
            } catch (e) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 500);
    });
}
```

### 4. UI Integration

Add a "Start Batch Queue" button in the popup:

```html
<!-- In popup.html, add to search list section -->
<button id="startBatchQueueBtn" class="btn btn-primary" style="margin-top: 10px;">
    🚀 Start Batch Queue
</button>
```

```javascript
// In popup.js
if (elements.startBatchQueueBtn) {
    elements.startBatchQueueBtn.addEventListener('click', async () => {
        if (confirm('Start batch queue? This will process all searches grouped by source.')) {
            await startBatchQueue();
        }
    });
}
```

## Safety Features

1. **Workbook Validation**: Check workbook exists before starting
2. **Error Handling**: Skip source if workbook not found, continue with next
3. **Progress Tracking**: Show which source/search is being processed
4. **Delays**: 30-60 seconds between searches, 1 minute between sources
5. **User Presence**: Keep tabs visible so user can monitor

## Detection Risk

- **Low Risk**: Sequential processing, delays between searches
- **Medium Risk**: If fully automated (no user watching)
- **Recommendation**: User should be present during batch processing

## Implementation Steps

1. Add `groupSearchesBySource()` function
2. Add `findOrCreateWorkbookForSource()` function
3. Add `startBatchQueue()` function
4. Add `setWorkbookActive()` function
5. Add UI button and event handlers
6. Test with 2-3 sources first

## Future Enhancements

1. **Auto-create workbooks**: Use Google Sheets API to create sheets automatically
2. **Resume capability**: Save progress, resume if interrupted
3. **Scheduling**: Schedule batch queue to run weekly
4. **Notifications**: Alert when batch completes

