# Workbook Mapping Solution

## Overview
Manual mapping interface where users explicitly link Source Connections to workbooks. This ensures:
- Clear, explicit relationships
- No guessing or auto-matching
- Handles edge cases (multiple sources, name variations)
- User has full control

## UI Design

### Option A: Mapping Section (Recommended)
Add a new collapsible section after loading searches:

```html
<!-- In popup.html, after Input Sheet section -->
<section class="section mapping-section" id="mappingSection" style="display: none;">
    <h2>🔗 Source → Workbook Mapping</h2>
    <p class="section-description">
        Map each Source Connection to its workbook. This tells the extension where to save each person's leads.
    </p>
    
    <!-- Mapping List -->
    <div class="mapping-list" id="mappingList">
        <!-- Dynamically populated -->
    </div>
    
    <!-- Actions -->
    <div class="mapping-actions">
        <button id="saveMappingBtn" class="btn btn-primary">💾 Save Mapping</button>
        <button id="clearMappingBtn" class="btn btn-secondary">🗑️ Clear</button>
    </div>
    
    <!-- Batch Queue Button -->
    <button id="startBatchQueueBtn" class="btn btn-primary" style="margin-top: 10px; width: 100%;" disabled>
        🚀 Start Batch Queue
    </button>
</section>
```

### Mapping Item Design
Each mapping shows:
- Source Connection name
- Dropdown to select workbook
- Status indicator (mapped/unmapped)

```html
<div class="mapping-item">
    <div class="mapping-source">
        <span class="source-name">Taylor Newman</span>
        <span class="search-count">(7 searches)</span>
    </div>
    <select class="workbook-mapping-select">
        <option value="">-- Select Workbook --</option>
        <option value="workbook-id-1">Taylor Newman</option>
        <option value="workbook-id-2">Morgan Cirotto</option>
        <!-- All saved workbooks -->
    </select>
    <span class="mapping-status">✓</span>
</div>
```

## Implementation

### 1. Extract Unique Sources
```javascript
// In popup.js
function getUniqueSources(searches) {
    const sources = new Set();
    const sourceCounts = {};
    
    searches.forEach(search => {
        const source = search.source || 'Unknown';
        sources.add(source);
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    return Array.from(sources).map(source => ({
        name: source,
        count: sourceCounts[source],
        searches: searches.filter(s => s.source === source)
    }));
}
```

### 2. Load Mapping from Storage
```javascript
// In popup.js
async function loadSourceMapping() {
    try {
        const response = await sendMessage('GET_SETTINGS');
        state.sourceMapping = response.settings?.sourceMapping || {};
        return state.sourceMapping;
    } catch (e) {
        console.error('[POPUP] Failed to load mapping:', e);
        return {};
    }
}

// Mapping structure:
// {
//   "Taylor Newman": "workbook-id-123",
//   "Morgan Cirotto": "workbook-id-456"
// }
```

### 3. Render Mapping Interface
```javascript
// In popup.js
async function renderSourceMapping() {
    if (!state.searches || state.searches.length === 0) {
        elements.mappingSection.style.display = 'none';
        return;
    }
    
    // Show mapping section
    elements.mappingSection.style.display = 'block';
    
    // Get unique sources
    const uniqueSources = getUniqueSources(state.searches);
    
    // Load saved mapping
    const mapping = await loadSourceMapping();
    
    // Load workbooks
    await loadSavedWorkbooks();
    
    // Render mapping list
    elements.mappingList.innerHTML = uniqueSources.map(source => {
        const mappedWorkbookId = mapping[source.name] || '';
        const mappedWorkbook = state.savedWorkbooks.find(w => w.id === mappedWorkbookId);
        
        return `
            <div class="mapping-item" data-source="${escapeHtml(source.name)}">
                <div class="mapping-source">
                    <span class="source-name">${escapeHtml(source.name)}</span>
                    <span class="search-count">(${source.count} searches)</span>
                </div>
                <select class="workbook-mapping-select" data-source="${escapeHtml(source.name)}">
                    <option value="">-- Select Workbook --</option>
                    ${state.savedWorkbooks.map(wb => `
                        <option value="${wb.id}" ${wb.id === mappedWorkbookId ? 'selected' : ''}>
                            ${escapeHtml(wb.name)}
                        </option>
                    `).join('')}
                </select>
                <span class="mapping-status ${mappedWorkbookId ? 'mapped' : 'unmapped'}">
                    ${mappedWorkbookId ? '✓' : '⚠'}
                </span>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    elements.mappingList.querySelectorAll('.workbook-mapping-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const source = e.target.dataset.source;
            const workbookId = e.target.value;
            
            // Update status indicator
            const item = e.target.closest('.mapping-item');
            const status = item.querySelector('.mapping-status');
            
            if (workbookId) {
                status.textContent = '✓';
                status.className = 'mapping-status mapped';
            } else {
                status.textContent = '⚠';
                status.className = 'mapping-status unmapped';
            }
            
            // Update batch queue button state
            updateBatchQueueButtonState();
        });
    });
    
    // Update batch queue button
    updateBatchQueueButtonState();
}

function updateBatchQueueButtonState() {
    const allMapped = Array.from(elements.mappingList.querySelectorAll('.workbook-mapping-select'))
        .every(select => select.value !== '');
    
    if (elements.startBatchQueueBtn) {
        elements.startBatchQueueBtn.disabled = !allMapped;
    }
}
```

### 4. Save Mapping
```javascript
// In popup.js
async function saveSourceMapping() {
    const mapping = {};
    
    elements.mappingList.querySelectorAll('.workbook-mapping-select').forEach(select => {
        const source = select.dataset.source;
        const workbookId = select.value;
        if (workbookId) {
            mapping[source] = workbookId;
        }
    });
    
    // Save to storage
    await sendMessage('SAVE_SETTINGS', {
        settings: { sourceMapping: mapping }
    });
    
    state.sourceMapping = mapping;
    updateStatus('✅ Mapping saved!');
    updateBatchQueueButtonState();
}
```

### 5. Batch Queue with Mapping
```javascript
// In popup.js
async function startBatchQueue() {
    if (!state.sourceMapping || Object.keys(state.sourceMapping).length === 0) {
        updateStatus('❌ Please map all sources to workbooks first');
        return;
    }
    
    // Group searches by source
    const groupedSearches = groupSearchesBySource(state.searches);
    const sources = Object.keys(groupedSearches);
    
    updateStatus(`🚀 Starting batch queue for ${sources.length} sources...`);
    
    // Process each source
    for (let i = 0; i < sources.length; i++) {
        const sourceName = sources[i];
        const searches = groupedSearches[sourceName];
        const workbookId = state.sourceMapping[sourceName];
        
        if (!workbookId) {
            updateStatus(`⚠️ Skipping ${sourceName} - no workbook mapped`);
            continue;
        }
        
        // Find workbook
        const workbook = state.savedWorkbooks.find(w => w.id === workbookId);
        if (!workbook) {
            updateStatus(`⚠️ Skipping ${sourceName} - workbook not found`);
            continue;
        }
        
        // Set workbook as active
        await setWorkbookActive(workbook);
        
        updateStatus(`📚 ${sourceName}: Processing ${searches.length} searches...`);
        
        // Scrape all searches for this source
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
            await startScrapingForSearch(tab.id, search);
            
            // Wait for completion
            await waitForScrapeComplete(tab.id);
            
            // Delay between searches
            if (j < searches.length - 1) {
                await wait(30000 + Math.random() * 30000); // 30-60 seconds
            }
        }
        
        // Delay between sources
        if (i < sources.length - 1) {
            updateStatus(`⏳ Break before next source...`);
            await wait(60000); // 1 minute
        }
    }
    
    updateStatus('✅ Batch queue complete!');
}

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
```

## CSS Styling

```css
/* Mapping Section */
.mapping-section {
    margin-top: 15px;
}

.mapping-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #555;
    border-radius: 6px;
    background: #1a1a1a;
    margin-bottom: 10px;
}

.mapping-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-bottom: 1px solid #444;
}

.mapping-item:last-child {
    border-bottom: none;
}

.mapping-source {
    flex: 1;
    min-width: 150px;
}

.source-name {
    font-weight: 500;
    color: #f0f0f0;
    font-size: 13px;
}

.search-count {
    font-size: 11px;
    color: #888;
    margin-left: 5px;
}

.workbook-mapping-select {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #1a1a1a;
    color: #fff;
    font-size: 12px;
}

.mapping-status {
    font-size: 16px;
    min-width: 20px;
    text-align: center;
}

.mapping-status.mapped {
    color: #28a745;
}

.mapping-status.unmapped {
    color: #ffc107;
}

.mapping-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}
```

## Workflow

1. **Load Searches**: User loads Input Sheet
2. **Show Mapping**: Extension shows unique sources and mapping interface
3. **Map Sources**: User selects workbook for each source
4. **Save Mapping**: Mapping is saved to storage
5. **Start Batch Queue**: User clicks "Start Batch Queue"
6. **Process**: Extension processes each source group, switching workbooks automatically

## Benefits

✅ **Explicit**: No guessing, clear relationships
✅ **Flexible**: Can map multiple sources to one workbook if needed
✅ **Persistent**: Mapping saved across sessions
✅ **Robust**: Handles edge cases (missing workbooks, name variations)
✅ **User Control**: User decides where each source goes

