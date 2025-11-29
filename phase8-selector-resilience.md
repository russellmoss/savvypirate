# Phase 8: LinkedIn DOM Selector Resilience System
## Agentic Execution Plan

### Agent Context
```
You are a Senior Chrome Extension Developer working on Phase 8 of the Savvy Pirate extension.
Current state: Extension uses hardcoded LinkedIn DOM selectors that can break when LinkedIn updates their UI.
Goal: Implement a robust, self-healing selector system with fallbacks, health monitoring, and configurable selectors.

EXECUTION RULES:
1. Complete tasks in ORDER (8.1 → 8.2 → 8.3 → 8.4 → 8.5)
2. After each task, verify syntax with linter before proceeding
3. Test each component as you build it
4. Do NOT proceed to next task until current task passes gate check
5. All changes must maintain backward compatibility
6. Use existing patterns from the codebase (logging, error handling, etc.)
7. DO NOT break existing functionality - this is an enhancement, not a rewrite
```

---

## 🚀 EXECUTION START

**Before starting, read this entire section:**

### Quick Start Command
```
Follow the plan in phase8-selector-resilience.md exactly.

EXECUTION ORDER:
Task 8.1 → Gate Check 8.1 → Task 8.2 → Gate Check 8.2 → Task 8.3 → Gate Check 8.3 
→ Task 8.4 → Gate Check 8.4 → Task 8.5 → Gate Check 8.5 → Integration Testing

START: Task 8.1 - Create Selector Configuration System
```

### Pre-Flight Verification
Before starting Task 8.1, verify these files exist:
```bash
ls content/content.js          # Should exist
ls background/service_worker.js # Should exist
ls popup/popup.html            # Should exist
ls popup/popup.js              # Should exist
```

**⚠️ SAFETY CHECK - Verify Current Selectors Work:**
Before implementing, test that these selectors currently work on LinkedIn:
1. Navigate to a LinkedIn search results page
2. Open DevTools Console
3. Run these commands to verify:
```javascript
// Test current profile card selector
document.querySelectorAll('div[data-view-name="people-search-result"]').length  // Should be > 0

// Test current name link selector (inside a card)
document.querySelector('div[data-view-name="people-search-result"] a[data-view-name="search-result-lockup-title"]')  // Should find element

// Test title/location selectors
const card = document.querySelector('div[data-view-name="people-search-result"]');
card.querySelectorAll('p').length  // Should be >= 2
```

**If all tests pass → Safe to proceed!**
**If any fail → Update selectors in Task 8.1 before implementing.**

### Important Notes
- **This is an enhancement, not a rewrite** - Existing functionality must continue to work
- **Backward compatibility** - Old hardcoded selectors remain as ultimate fallback
- **Gradual rollout** - New system runs alongside old system, can be toggled
- **No breaking changes** - All existing tests should continue to pass

---

## 🎯 Phase Overview

This phase transforms the extension from "hardcoded selectors that break" to "self-healing selector system that adapts."

### What This Phase Adds:
1. **Fallback Selector Chains** - Try multiple selectors in order of reliability
2. **Selector Health Monitoring** - Track which selectors work/don't work
3. **Configurable Selectors** - Update selectors via chrome.storage without code changes
4. **Auto-Validation** - Check selector health on extension startup and during scraping
5. **Comprehensive Logging** - Detailed diagnostics when selectors fail
6. **Selector Test UI** - Manual validation button in popup

### Problem This Solves:
- LinkedIn changes DOM structure → Extension breaks overnight
- No visibility into why scraping fails
- Can't update selectors without code deployment
- Hard to debug selector issues

### Solution Benefits:
- ✅ Extension continues working even if primary selector breaks
- ✅ Can update selectors without redeploying extension
- ✅ Early detection of selector issues via health monitoring
- ✅ Better debugging with comprehensive failure logs
- ✅ Users can validate selectors before scraping

---

## 📋 Execution Checklist

Before starting, verify these files exist and are readable:
- [ ] `content/content.js` - Current scraping logic with hardcoded selectors
- [ ] `background/service_worker.js` - Service worker for message handling
- [ ] `popup/popup.html` - UI for selector testing
- [ ] `popup/popup.js` - Popup logic

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────┐
│  Chrome Storage (Local)         │
│  - selectorConfig (JSON)        │
│  - selectorStats (success rates)│
│  - selectorVersion              │
└─────────────────────────────────┘
            ▲                │
            │                ▼
┌──────────────────────────────────────────────┐
│  Content Script (content/content.js)         │
│  - querySelectorWithFallbacks()              │
│  - validateSelectors()                       │
│  - logSelectorFailure()                      │
│  - trackSelectorSuccess()                    │
└──────────────────────────────────────────────┘
            ▲                │
            │                ▼
┌──────────────────────────────────────────────┐
│  Service Worker (background/service_worker.js)│
│  - updateSelectorConfig()                    │
│  - getSelectorHealth()                       │
│  - resetSelectorStats()                      │
└──────────────────────────────────────────────┘
            ▲                │
            │                ▼
┌──────────────────────────────────────────────┐
│  Popup UI (popup/popup.html + popup.js)      │
│  - Selector Test Button                      │
│  - Selector Health Display                   │
│  - Manual Selector Update Form (optional)    │
└──────────────────────────────────────────────┘
```

---

## 📁 Files to Modify

| File | Changes |
|------|---------|
| `content/content.js` | Add fallback selector system, health monitoring, validation |
| `background/service_worker.js` | Add selector config management handlers |
| `popup/popup.html` | Add selector test UI section |
| `popup/popup.js` | Add selector test and health check logic |
| `background/selector_config.js` | **NEW** - Default selector configurations |

---

## 🔧 Task 8.1: Create Selector Configuration System

**Status:** ⏳ Pending  
**Dependencies:** None (foundational task)  
**Estimated Time:** 20-30 minutes

### Objective
Create a selector configuration system with default selectors, versioning, and storage management.

### Files to Create/Modify
- **NEW**: `background/selector_config.js` - Default selector configurations
- `background/service_worker.js` - Add selector config handlers

### Step-by-Step Instructions

**Step 1: Create selector configuration module**

**Agent Prompt:**
```
Create background/selector_config.js with default LinkedIn selector configurations.

This module should:
1. Export DEFAULT_SELECTORS object with fallback chains
2. Export SELECTOR_VERSION constant
3. Export functions to load/save selector config from storage
4. Include comprehensive selector arrays for all scraping targets

Selector structure:
- Each key (e.g., 'profileCard') has an array of selectors
- Selectors ordered by preference (most reliable first)
- Include context comments for each selector
```

### Expected Code Output

**Create `background/selector_config.js`:**

```javascript
// background/selector_config.js - LinkedIn Selector Configuration System

/**
 * Selector Configuration Version
 * Increment this when selector structure changes or new selectors added
 */
export const SELECTOR_VERSION = '1.0.0';

/**
 * Default LinkedIn DOM Selectors with Fallback Chains
 * Ordered by reliability: most reliable first, fallbacks follow
 * 
 * NOTE: These are fallback defaults. User can override via chrome.storage.
 */
export const DEFAULT_SELECTORS = {
    /**
     * Profile Card Container
     * Multiple strategies to find profile cards on search results page
     */
    profileCard: [
        // Strategy 1: Modern LinkedIn data attribute (most reliable)
        'div[data-view-name="people-search-result"]',
        // Strategy 2: Reusable search result container
        'li.reusable-search__result-container',
        // Strategy 3: Generic search result wrapper
        '.search-result__wrapper',
        // Strategy 4: Entity result container
        '.entity-result__item',
        // Strategy 5: Last resort - any list item with profile link
        'li:has(a[href*="/in/"])'
    ],

    /**
     * Profile Name Link
     * Multiple strategies to find the clickable name link
     */
    nameLink: [
        // Strategy 1: Modern LinkedIn data attribute
        'a[data-view-name="search-result-lockup-title"]',
        // Strategy 2: Entity result title text link
        '.entity-result__title-text a',
        // Strategy 3: Entity result title line link
        'span.entity-result__title-line a',
        // Strategy 4: Generic profile link by href pattern
        'a[href*="/in/"][href*="/?originalSubdomain"]',
        // Strategy 5: Last resort - any link to LinkedIn profile
        'a[href^="https://www.linkedin.com/in/"]'
    ],

    /**
     * Profile Title (Job Title)
     * Multiple strategies to find the job title text
     */
    title: [
        // Strategy 1: Entity result subtitle (most common)
        '.entity-result__primary-subtitle',
        // Strategy 2: Generic subtitle
        '.entity-result__subtitle',
        // Strategy 3: Search result subtitle
        '.search-result__subtitle',
        // Strategy 4: Second <p> tag in card (common pattern)
        'p:nth-of-type(2)',
        // Strategy 5: Generic subtitle class
        '.subline'
    ],

    /**
     * Profile Location
     * Multiple strategies to find location text
     */
    location: [
        // Strategy 1: Entity result secondary subtitle
        '.entity-result__secondary-subtitle',
        // Strategy 2: Search result metadata
        '.search-result__metadata',
        // Strategy 3: Third <p> tag in card
        'p:nth-of-type(3)',
        // Strategy 4: Location-specific class
        '.search-result__location'
    ],

    /**
     * Connection Source Indicator
     * Multiple strategies to find mutual connection info
     */
    connectionSource: [
        // Strategy 1: Social proof insight link
        'a[data-view-name="search-result-social-proof-insight"]',
        // Strategy 2: Entity result insights
        '.entity-result__insights',
        // Strategy 3: Search result insights
        '.search-result__insights',
        // Strategy 4: Social proof text
        '.social-proof-text'
    ],

    /**
     * Next Page Button
     * Multiple strategies to find pagination "Next" button
     */
    nextButton: [
        // Strategy 1: Aria label button (most accessible)
        'button[aria-label="Next"]',
        // Strategy 2: Text content "Next"
        'button:has-text("Next")',
        // Strategy 3: Pagination next button class
        '.artdeco-pagination__button--next:not([disabled])',
        // Strategy 4: Generic next button
        'button.next-button',
        // Strategy 5: Link with "Next" text
        'a:has-text("Next")'
    ],

    /**
     * Filter Bar (for connection source extraction)
     * Multiple strategies to find active filters
     */
    filterBar: [
        // Strategy 1: Modern filter top bar
        'div[data-view-name="search-filter-top-bar-select"]',
        // Strategy 2: Search filters container
        '.search-filters',
        // Strategy 3: Filter bar wrapper
        '.search-filter-bar'
    ],

    /**
     * LinkedIn Security/Warning Pages
     * Detect security checkpoints and unusual activity warnings
     * CRITICAL: If detected, scraping should pause and notify user
     */
    linkedInWarning: [
        // Strategy 1: Security challenge dialog
        '[data-test-id="security-challenge"]',
        // Strategy 2: Challenge dialog class
        '.challenge-dialog',
        // Strategy 3: Checkpoint form
        'form[action*="checkpoint"]',
        // Strategy 4: Security checkpoint container
        '.security-checkpoint',
        // Strategy 5: Unusual activity warning (text-based detection)
        'div:contains("unusual activity")',
        // Strategy 6: Verification required
        'div:contains("verification required")',
        // Strategy 7: Security verification page
        '[data-view-name="security-verification"]'
    ]
};

/**
 * Storage Keys for Selector Configuration
 */
const STORAGE_KEYS = {
    SELECTOR_CONFIG: 'selectorConfig',
    SELECTOR_STATS: 'selectorStats',
    SELECTOR_VERSION: 'selectorVersion'
};

/**
 * Load selector configuration from storage or return defaults
 * @returns {Promise<{selectors: object, version: string}>}
 */
export async function loadSelectorConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            STORAGE_KEYS.SELECTOR_CONFIG,
            STORAGE_KEYS.SELECTOR_VERSION
        ], (result) => {
            // Use stored config if available and version matches
            if (result[STORAGE_KEYS.SELECTOR_CONFIG] && 
                result[STORAGE_KEYS.SELECTOR_VERSION] === SELECTOR_VERSION) {
                resolve({
                    selectors: result[STORAGE_KEYS.SELECTOR_CONFIG],
                    version: result[STORAGE_KEYS.SELECTOR_VERSION]
                });
            } else {
                // Use defaults
                resolve({
                    selectors: DEFAULT_SELECTORS,
                    version: SELECTOR_VERSION
                });
            }
        });
    });
}

/**
 * Save selector configuration to storage
 * @param {object} selectors - Selector configuration object
 * @returns {Promise<void>}
 */
export async function saveSelectorConfig(selectors) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({
            [STORAGE_KEYS.SELECTOR_CONFIG]: selectors,
            [STORAGE_KEYS.SELECTOR_VERSION]: SELECTOR_VERSION
        }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Reset selector configuration to defaults
 * @returns {Promise<void>}
 */
export async function resetSelectorConfig() {
    return saveSelectorConfig(DEFAULT_SELECTORS);
}

/**
 * Load selector statistics (success rates)
 * @returns {Promise<object>}
 */
export async function loadSelectorStats() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.SELECTOR_STATS, (result) => {
            resolve(result[STORAGE_KEYS.SELECTOR_STATS] || {});
        });
    });
}

/**
 * Save selector statistics
 * @param {object} stats - Statistics object
 * @returns {Promise<void>}
 */
export async function saveSelectorStats(stats) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({
            [STORAGE_KEYS.SELECTOR_STATS]: stats
        }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Update statistics for a selector
 * @param {string} selectorKey - Key in selector config (e.g., 'profileCard')
 * @param {string} selector - The specific selector string
 * @param {boolean} success - Whether the selector succeeded
 * @returns {Promise<void>}
 */
export async function updateSelectorStat(selectorKey, selector, success) {
    const stats = await loadSelectorStats();
    
    const statKey = `${selectorKey}:${selector}`;
    
    if (!stats[statKey]) {
        stats[statKey] = {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttempt: null,
            lastSuccess: null,
            lastFailure: null,
            successRate: 0
        };
    }
    
    const stat = stats[statKey];
    stat.attempts++;
    stat.lastAttempt = new Date().toISOString();
    
    if (success) {
        stat.successes++;
        stat.lastSuccess = stat.lastAttempt;
    } else {
        stat.failures++;
        stat.lastFailure = stat.lastAttempt;
    }
    
    // Calculate success rate
    stat.successRate = stat.successes / stat.attempts;
    
    await saveSelectorStats(stats);
    
    console.log(`[SELECTORS] Updated stat for ${statKey}: ${(stat.successRate * 100).toFixed(1)}% success rate`);
}

/**
 * Auto-learn: Promote best-performing selector to first position
 * Called periodically to reorder selectors based on success rates
 * 
 * @param {object} selectors - Current selector configuration
 * @returns {Promise<object>} - Reordered selectors with best performers first
 */
export async function autoLearnSelectorOrder(selectors) {
    const stats = await loadSelectorStats();
    const reordered = { ...selectors };
    
    for (const key in reordered) {
        if (!Array.isArray(reordered[key])) continue;
        
        const selectorArray = [...reordered[key]];
        const selectorStats = [];
        
        // Get stats for each selector
        for (const selector of selectorArray) {
            const statKey = `${key}:${selector}`;
            const stat = stats[statKey];
            
            if (stat && stat.attempts >= 10) {
                // Only reorder if we have enough data
                selectorStats.push({
                    selector,
                    successRate: stat.successRate,
                    attempts: stat.attempts,
                    index: selectorArray.indexOf(selector)
                });
            }
        }
        
        // Sort by success rate (highest first)
        selectorStats.sort((a, b) => {
            if (a.successRate !== b.successRate) {
                return b.successRate - a.successRate; // Higher success rate first
            }
            return b.attempts - a.attempts; // More attempts as tiebreaker
        });
        
        // Reorder: best performers first, then rest in original order
        if (selectorStats.length > 0) {
            const bestSelectors = selectorStats.map(s => s.selector);
            const remainingSelectors = selectorArray.filter(s => !bestSelectors.includes(s));
            reordered[key] = [...bestSelectors, ...remainingSelectors];
            
            console.log(`[SELECTORS] Auto-learned order for ${key}: ${bestSelectors[0]} promoted (${(selectorStats[0].successRate * 100).toFixed(1)}% success)`);
        }
    }
    
    return reordered;
}

/**
 * Generate page structure fingerprint
 * Creates a hash-like identifier for the current page structure
 * Used to detect when LinkedIn changes their UI dramatically
 * 
 * @param {Document} doc - Document object
 * @returns {string} - Fingerprint string
 */
export function generatePageFingerprint(doc = document) {
    const fingerprint = {
        url: doc.location.href.split('?')[0], // URL without params
        dataAttributes: [],
        keyClasses: [],
        structure: []
    };
    
    try {
        // Collect data attributes (stable identifiers)
        const dataElements = doc.querySelectorAll('[data-view-name], [data-test-id]');
        dataElements.forEach(el => {
            if (el.dataset.viewName) fingerprint.dataAttributes.push(el.dataset.viewName);
            if (el.dataset.testId) fingerprint.dataAttributes.push(el.dataset.testId);
        });
        
        // Collect key classes (common LinkedIn classes)
        const keyClassElements = doc.querySelectorAll('.reusable-search, .entity-result, .search-result');
        keyClassElements.forEach(el => {
            Array.from(el.classList || []).forEach(cls => {
                if (cls.includes('search') || cls.includes('result') || cls.includes('entity')) {
                    if (!fingerprint.keyClasses.includes(cls)) {
                        fingerprint.keyClasses.push(cls);
                    }
                }
            });
        });
        
        // Sample structure (first few results)
        const firstResults = doc.querySelectorAll('[data-view-name*="result"], .reusable-search__result-container');
        fingerprint.structure = Array.from(firstResults).slice(0, 5).map(el => ({
            tag: el.tagName,
            hasDataViewName: !!el.dataset.viewName,
            classCount: (el.classList || []).length
        }));
        
        // Create hash-like string from fingerprint
        const fingerprintString = JSON.stringify({
            url: fingerprint.url,
            dataAttrs: fingerprint.dataAttributes.sort().slice(0, 20), // Limit size
            keyClasses: fingerprint.keyClasses.sort().slice(0, 20),
            structureSample: fingerprint.structure
        });
        
        // Simple hash function (or could use crypto.subtle for real hash)
        let hash = 0;
        for (let i = 0; i < fingerprintString.length; i++) {
            const char = fingerprintString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return hash.toString(36) + fingerprintString.length.toString(36);
    } catch (error) {
        console.warn('[SELECTORS] Error generating fingerprint:', error);
        return 'error';
    }
}
```

### Verification Steps

1. **Syntax Check:**
   ```bash
   # Check for syntax errors
   # Reload extension and check service worker console
   ```

2. **Import Test:**
   - In service worker console, verify imports work:
   ```javascript
   // Should not error
   import { DEFAULT_SELECTORS, loadSelectorConfig } from './selector_config.js';
   ```

3. **Storage Test:**
   - Verify default config loads correctly
   - Verify config can be saved and retrieved

### 🧪 Gate Check 8.1
```
✅ selector_config.js created with no syntax errors
✅ DEFAULT_SELECTORS includes all necessary selector types
✅ loadSelectorConfig() returns defaults when storage empty
✅ saveSelectorConfig() successfully saves to storage
✅ Statistics functions work correctly
✅ All exports are properly defined
```

**If gate check passes:** Proceed to Task 8.2  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 8.2: Implement Fallback Selector System in Content Script

**Status:** ⏳ Pending  
**Dependencies:** Task 8.1 must be complete  
**Estimated Time:** 30-40 minutes

### Objective
Add fallback selector logic to content script, replacing hardcoded selectors with the resilient system.

### Files to Modify
- `content/content.js` - Add fallback selector functions and integrate

### Step-by-Step Instructions

**Step 1: Add selector utilities to content script**

**Agent Prompt:**
```
Add selector utility functions to content/content.js:

1. querySelectorWithFallbacks() - Try multiple selectors, return first match
2. querySelectorAllWithFallbacks() - Try multiple selectors, return all matches from first working selector
3. trackSelectorSuccess() - Track when a selector works
4. logSelectorFailure() - Log comprehensive failure info

IMPORTANT:
- These functions must work in content script context (no chrome.storage access directly)
- Use chrome.runtime.sendMessage to communicate with background for stats
- Maintain backward compatibility with existing selector usage
- Add comprehensive logging with [SELECTOR] prefix
```

### Expected Code Output

**Add these functions to `content/content.js` (near the top, after configuration):**

```javascript
// ============================================================
// PHASE 8: SELECTOR RESILIENCE SYSTEM
// ============================================================

/**
 * Selector configuration loaded from background
 * Will be populated on initialization
 */
let selectorConfig = null;
let selectorStats = {};

/**
 * Initialize selector system
 * Loads configuration from background script
 * PHASE 8 ENHANCEMENT: Also imports fingerprint function
 */
async function initializeSelectors() {
    try {
        // Request selector config from background
        const response = await sendMessageToBackground({
            action: 'GET_SELECTOR_CONFIG'
        });
        
        if (response && response.success) {
            selectorConfig = response.config;
            selectorStats = response.stats || {};
            console.log('[SELECTOR] ✅ Selector system initialized', {
                version: response.version,
                keys: Object.keys(selectorConfig)
            });
            return true;
        } else {
            console.warn('[SELECTOR] ⚠️ Failed to load selector config, using defaults');
            // Fallback to hardcoded defaults (backward compatibility)
            return false;
        }
    } catch (error) {
        console.error('[SELECTOR] ❌ Error initializing:', error);
        return false;
    }
}

// PHASE 8 ENHANCEMENT: Page fingerprinting function
// Note: Define locally in content script (can't import from background modules)
// A simplified version is provided below - full version is in selector_config.js

/**
 * Generate page structure fingerprint (content script version)
 * Simplified version for content script context
 */
function generatePageFingerprint(doc = document) {
    const fingerprint = {
        url: doc.location.href.split('?')[0],
        dataAttributes: [],
        keyClasses: []
    };
    
    try {
        // Collect data attributes
        const dataElements = doc.querySelectorAll('[data-view-name], [data-test-id]');
        Array.from(dataElements).slice(0, 20).forEach(el => {
            if (el.dataset.viewName) fingerprint.dataAttributes.push(el.dataset.viewName);
            if (el.dataset.testId) fingerprint.dataAttributes.push(el.dataset.testId);
        });
        
        // Collect key classes
        const keyClassElements = doc.querySelectorAll('.reusable-search, .entity-result, .search-result');
        Array.from(keyClassElements).slice(0, 20).forEach(el => {
            Array.from(el.classList || []).forEach(cls => {
                if ((cls.includes('search') || cls.includes('result') || cls.includes('entity')) && 
                    !fingerprint.keyClasses.includes(cls)) {
                    fingerprint.keyClasses.push(cls);
                }
            });
        });
        
        // Simple hash from fingerprint data
        const fingerprintString = JSON.stringify({
            url: fingerprint.url,
            attrs: fingerprint.dataAttributes.sort().slice(0, 10),
            classes: fingerprint.keyClasses.sort().slice(0, 10)
        });
        
        let hash = 0;
        for (let i = 0; i < fingerprintString.length; i++) {
            const char = fingerprintString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return hash.toString(36) + fingerprintString.length.toString(36);
    } catch (error) {
        console.warn('[SELECTOR] Error generating fingerprint:', error);
        return 'error';
    }
}

/**
 * Helper: Send message to background script
 */
function sendMessageToBackground(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[SELECTOR] Message error:', chrome.runtime.lastError.message);
                resolve(null);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Query selector with fallback chain
 * Tries each selector in order until one works
 * 
 * @param {Element} rootElement - Root element to search within (or document)
 * @param {string} selectorKey - Key in selector config (e.g., 'profileCard', 'nameLink')
 * @param {object} options - Additional options
 * @returns {Element|null} - First matching element or null
 */
function querySelectorWithFallbacks(rootElement, selectorKey, options = {}) {
    // Fallback to hardcoded selectors if config not loaded
    const selectors = selectorConfig?.[selectorKey] || getHardcodedFallback(selectorKey);
    
    if (!selectors || selectors.length === 0) {
        console.error(`[SELECTOR] No selectors found for key: ${selectorKey}`);
        return null;
    }
    
    // Track attempts for statistics
    const attempts = [];
    
    for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        
        try {
            const result = rootElement.querySelector(selector);
            
            if (result) {
                // Success! Track it
                attempts.push({ selector, found: true, index: i });
                trackSelectorSuccess(selectorKey, selector);
                
                if (options.logSuccess !== false) {
                    console.log(`[SELECTOR] ✅ Found "${selectorKey}" with selector #${i + 1}:`, selector);
                }
                
                return result;
            } else {
                attempts.push({ selector, found: false, index: i });
            }
        } catch (error) {
            attempts.push({ selector, found: false, index: i, error: error.message });
            console.warn(`[SELECTOR] Selector error for "${selectorKey}":`, selector, error);
        }
    }
    
    // All selectors failed
    logSelectorFailure(selectorKey, selectors, attempts, rootElement, options);
    return null;
}

/**
 * Query all elements matching selector with fallback chain
 * Tries selectors in order, returns all matches from first working selector
 * 
 * @param {Element} rootElement - Root element to search within (or document)
 * @param {string} selectorKey - Key in selector config
 * @param {object} options - Additional options
 * @returns {NodeList|Array} - All matching elements or empty array
 */
function querySelectorAllWithFallbacks(rootElement, selectorKey, options = {}) {
    const selectors = selectorConfig?.[selectorKey] || getHardcodedFallback(selectorKey);
    
    if (!selectors || selectors.length === 0) {
        console.error(`[SELECTOR] No selectors found for key: ${selectorKey}`);
        return [];
    }
    
    for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        
        try {
            const results = rootElement.querySelectorAll(selector);
            
            if (results && results.length > 0) {
                // Success! Track it
                trackSelectorSuccess(selectorKey, selector);
                
                if (options.logSuccess !== false) {
                    console.log(`[SELECTOR] ✅ Found ${results.length} "${selectorKey}" with selector #${i + 1}:`, selector);
                }
                
                return results;
            }
        } catch (error) {
            console.warn(`[SELECTOR] Selector error for "${selectorKey}":`, selector, error);
        }
    }
    
    // All selectors failed
    logSelectorFailure(selectorKey, selectors, [], rootElement, options);
    return [];
}

/**
 * Hardcoded fallback selectors (backward compatibility)
 * Used if selector config fails to load
 */
function getHardcodedFallback(selectorKey) {
    const fallbacks = {
        profileCard: ['div[data-view-name="people-search-result"]'],
        nameLink: ['a[data-view-name="search-result-lockup-title"]'],
        title: ['p:nth-of-type(2)'],
        location: ['p:nth-of-type(3)'],
        connectionSource: ['a[data-view-name="search-result-social-proof-insight"]'],
        nextButton: ['button[aria-label="Next"]']
    };
    return fallbacks[selectorKey] || [];
}

/**
 * Track selector success for statistics
 * Sends message to background to update stats
 * 
 * @param {string} selectorKey - Key in config
 * @param {string} selector - The selector string that worked
 */
function trackSelectorSuccess(selectorKey, selector) {
    // Fire and forget - don't block on this
    sendMessageToBackground({
        action: 'TRACK_SELECTOR_SUCCESS',
        selectorKey,
        selector
    }).catch(() => {
        // Ignore errors - stats tracking is non-critical
    });
}

/**
 * Track selector failure for statistics
 * 
 * @param {string} selectorKey - Key in config
 * @param {string} selector - The selector string that failed
 */
function trackSelectorFailure(selectorKey, selector) {
    sendMessageToBackground({
        action: 'TRACK_SELECTOR_FAILURE',
        selectorKey,
        selector
    }).catch(() => {
        // Ignore errors
    });
}

/**
 * Log comprehensive selector failure information
 * Helps debug why selectors are failing
 * 
 * @param {string} selectorKey - Key that failed
 * @param {Array<string>} selectors - All selectors attempted
 * @param {Array} attempts - Details about each attempt
 * @param {Element} rootElement - The root element searched
 * @param {object} options - Additional context
 */
function logSelectorFailure(selectorKey, selectors, attempts, rootElement, options = {}) {
    // Track all failures
    selectors.forEach(selector => {
        trackSelectorFailure(selectorKey, selector);
    });
    
    // Capture diagnostic information
    const diagnostics = {
        selectorKey,
        timestamp: new Date().toISOString(),
        pageUrl: window.location.href,
        selectorsAttempted: selectors,
        attempts,
        domSnapshot: captureRelevantDOM(rootElement),
        options
    };
    
    console.error(`[SELECTOR] ❌ All selectors failed for "${selectorKey}":`, diagnostics);
    
    // Send to background for storage/analysis
    sendMessageToBackground({
        action: 'LOG_SELECTOR_FAILURE',
        diagnostics
    }).catch(() => {
        // Ignore errors
    });
}

/**
 * Capture relevant DOM snapshot for diagnostics
 * Captures a safe snapshot without sensitive data
 * 
 * @param {Element} rootElement - Root element
 * @returns {object} - DOM snapshot
 */
function captureRelevantDOM(rootElement) {
    try {
        // Capture structure without sensitive content
        const snapshot = {
            rootTag: rootElement.tagName,
            childCount: rootElement.children?.length || 0,
            hasProfileCards: rootElement.querySelector('div[data-view-name]') !== null,
            sampleStructure: []
        };
        
        // Capture structure of first few children
        const children = Array.from(rootElement.children || []).slice(0, 3);
        children.forEach(child => {
            snapshot.sampleStructure.push({
                tag: child.tagName,
                classes: Array.from(child.classList || []).slice(0, 5),
                dataAttributes: Object.keys(child.dataset || {}).slice(0, 3)
            });
        });
        
        return snapshot;
    } catch (error) {
        return { error: error.message };
    }
}

/**
 * Check for LinkedIn security warnings or checkpoints
 * Returns true if a warning/checkpoint is detected
 * 
 * @returns {boolean} - True if warning detected
 */
function checkLinkedInWarning() {
    const selectors = selectorConfig?.linkedInWarning || getHardcodedFallback('linkedInWarning');
    
    for (const selector of selectors) {
        try {
            // Handle :contains() pseudo-selector (not supported in querySelector)
            if (selector.includes(':contains(')) {
                const text = selector.match(/:contains\("([^"]+)"\)/)?.[1];
                if (text && document.body.innerText.toLowerCase().includes(text.toLowerCase())) {
                    console.error('[SELECTOR] ⚠️ LINKEDIN WARNING DETECTED:', text);
                    return true;
                }
                continue;
            }
            
            const element = document.querySelector(selector);
            if (element) {
                console.error('[SELECTOR] ⚠️ LINKEDIN WARNING DETECTED:', selector);
                return true;
            }
        } catch (error) {
            // Ignore selector errors
        }
    }
    
    return false;
}

/**
 * Validate all selectors on current page
 * Tests each selector type and reports health
 * 
 * @returns {Promise<object>} - Validation results
 */
async function validateAllSelectors() {
    console.log('[SELECTOR] 🔍 Validating selectors on current page...');
    
    if (!selectorConfig) {
        await initializeSelectors();
    }
    
    const results = {};
    const selectorKeys = Object.keys(selectorConfig || {});
    
    for (const key of selectorKeys) {
        const selectors = selectorConfig[key];
        const validation = {
            key,
            tested: selectors.length,
            working: 0,
            results: []
        };
        
        for (const selector of selectors) {
            try {
                const found = document.querySelector(selector);
                const count = document.querySelectorAll(selector).length;
                
                validation.results.push({
                    selector,
                    found: !!found,
                    count,
                    working: count > 0
                });
                
                if (count > 0) {
                    validation.working++;
                }
            } catch (error) {
                validation.results.push({
                    selector,
                    found: false,
                    error: error.message
                });
            }
        }
        
        results[key] = validation;
    }
    
    // Send results to background for storage
    sendMessageToBackground({
        action: 'SELECTOR_VALIDATION_RESULTS',
        results,
        pageUrl: window.location.href,
        timestamp: new Date().toISOString()
    });
    
    console.log('[SELECTOR] ✅ Validation complete:', results);
    return results;
}
```

**Step 2: Update existing scraping functions to use fallback selectors**

**Agent Prompt:**
```
Update the scrapeCurrentPage() function in content/content.js to use querySelectorWithFallbacks() and querySelectorAllWithFallbacks() instead of hardcoded selectors.

Find all instances of:
- document.querySelector(...)
- card.querySelector(...)
- document.querySelectorAll(...)

Replace with the fallback versions, using appropriate selector keys from config.

IMPORTANT:
- Maintain exact same functionality
- Keep all existing error handling
- Update selector keys appropriately (profileCard, nameLink, title, location, etc.)
```

### Expected Code Changes

**Update `scrapeCurrentPage()` function:**

```javascript
function scrapeCurrentPage(defaultSource) {
    const rows = [];
    
    // Use fallback selector system
    const cards = querySelectorAllWithFallbacks(document, 'profileCard', {
        context: 'scrapeCurrentPage'
    });
    
    if (cards.length === 0) {
        console.warn('[CS] No profile cards found with any selector');
        return rows;
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // PHASE 8 ENHANCEMENT: Check for LinkedIn warnings before scraping
    if (checkLinkedInWarning()) {
        console.error('[CS] ⚠️ LinkedIn security checkpoint detected - pausing scrape');
        
        // Notify background and user
        sendMessageToBackground({
            action: 'LINKEDIN_WARNING_DETECTED',
            pageUrl: window.location.href,
            timestamp: new Date().toISOString()
        });
        
        // Stop scraping
        throw new Error('LinkedIn security checkpoint detected. Please complete the verification and try again.');
    }
    
    cards.forEach((card) => {
        try {
            // Use fallback selectors for each field
            const nameAnchor = querySelectorWithFallbacks(card, 'nameLink', {
                context: 'scrapeCurrentPage.nameLink'
            });
            
            if (!nameAnchor) {
                console.warn('[CS] Name link not found in card');
                return;
            }

            const name = nameAnchor.innerText.trim();
            let url = nameAnchor.href || "";
            if (url.includes('?')) url = url.split('?')[0];

            // Title and location with fallbacks
            const titleElement = querySelectorWithFallbacks(card, 'title', {
                context: 'scrapeCurrentPage.title',
                logSuccess: false // Reduce noise
            });
            const title = titleElement ? titleElement.innerText.trim() : "";

            const locationElement = querySelectorWithFallbacks(card, 'location', {
                context: 'scrapeCurrentPage.location',
                logSuccess: false
            });
            const location = locationElement ? locationElement.innerText.trim() : "";

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
```

**Update `getConnectionSource()` function:**

```javascript
function getConnectionSource() {
    // Use fallback selector for filter bar
    const filterBar = querySelectorWithFallbacks(document, 'filterBar', {
        context: 'getConnectionSource',
        logSuccess: false
    });
    
    if (!filterBar) {
        return "";
    }
    
    const filters = filterBar.querySelectorAll('label');
    const ignoreList = ["People", "Connections", "Locations", "Current companies", "All filters", "Reset", "1st", "2nd", "3rd+"];
    
    for (const filter of filters) {
        const text = filter.innerText.trim().split('\n')[0];
        if (text && !ignoreList.includes(text) && text.length > 1) {
            return cleanName(text);
        }
    }
    
    return "";
}
```

**Update `clickNextButton()` function:**

```javascript
function clickNextButton() {
    // Try fallback selectors for next button
    const nextButton = querySelectorWithFallbacks(document, 'nextButton', {
        context: 'clickNextButton'
    });
    
    if (nextButton && !nextButton.disabled) {
        console.log('[CS] Found Next button via fallback selector');
        nextButton.click();
        return true;
    }
    
    // Fallback: Try text-based search (manual strategy)
    const allElements = Array.from(document.querySelectorAll('span, button, a'));
    const nextEl = allElements.find(el => 
        el.innerText && 
        el.innerText.trim() === "Next" && 
        el.offsetParent !== null
    );
    
    if (nextEl) {
        console.log('[CS] Found Next via text search');
        nextEl.click();
        return true;
    }

    console.log('[CS] No Next button found');
    return false;
}
```

**Add initialization call at script start:**

```javascript
// At the end of the IIFE, after console.log('[CS] ✅ LinkedIn Scraper content script loaded'):

// Initialize selector system
initializeSelectors().then(initialized => {
    if (initialized) {
        console.log('[SELECTOR] Selector resilience system active');
    } else {
        console.warn('[SELECTOR] Using fallback selectors');
    }
});
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check content script console for errors

2. **Selector Loading Test:**
   - Navigate to LinkedIn search page
   - Check console for "[SELECTOR] ✅ Selector system initialized"

3. **Functionality Test:**
   - Start a scrape
   - Verify profiles are still found correctly
   - Check console for selector success/failure logs

### 🧪 Gate Check 8.2
```
✅ querySelectorWithFallbacks() implemented correctly
✅ querySelectorAllWithFallbacks() implemented correctly
✅ scrapeCurrentPage() updated to use fallback selectors
✅ getConnectionSource() updated to use fallback selectors
✅ clickNextButton() updated to use fallback selectors
✅ Selector system initializes on content script load
✅ Existing functionality still works (no regressions)
✅ Comprehensive logging added with [SELECTOR] prefix
```

**If gate check passes:** Proceed to Task 8.3  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 8.3: Add Selector Health Monitoring to Service Worker

**Status:** ⏳ Pending  
**Dependencies:** Task 8.1 and 8.2 must be complete  
**Estimated Time:** 20-25 minutes

### Objective
Add message handlers in service worker to manage selector configuration, track statistics, and provide health monitoring.

### Files to Modify
- `background/service_worker.js` - Add selector management handlers

### Step-by-Step Instructions

**Step 1: Update imports**

**Agent Prompt:**
```
Update imports in background/service_worker.js to include selector_config functions:

ADD imports:
- loadSelectorConfig, saveSelectorConfig, resetSelectorConfig
- loadSelectorStats, saveSelectorStats, updateSelectorStat
- DEFAULT_SELECTORS, SELECTOR_VERSION

IMPORTANT: Check existing imports first, add only missing ones.
```

### Expected Code Output

**Update imports in `background/service_worker.js`:**

```javascript
import { 
    getAuthToken, 
    removeCachedToken 
} from './auth.js';

import { 
    createSheet, 
    appendRows, 
    readSheet,
    // ... existing imports ...
} from './sheets_api.js';

    // PHASE 8: Selector Configuration
import {
    loadSelectorConfig,
    saveSelectorConfig,
    resetSelectorConfig,
    loadSelectorStats,
    saveSelectorStats,
    updateSelectorStat,
    autoLearnSelectorOrder,
    DEFAULT_SELECTORS,
    SELECTOR_VERSION
} from './selector_config.js';

import { 
    addToQueue, 
    processQueue, 
    // ... existing imports ...
} from './sync_queue.js';
```

**Step 2: Add message handlers**

**Agent Prompt:**
```
Add new message handlers in background/service_worker.js for selector management:

Handlers needed:
- GET_SELECTOR_CONFIG - Return current selector config and stats
- UPDATE_SELECTOR_CONFIG - Update selector configuration
- RESET_SELECTOR_CONFIG - Reset to defaults
- TRACK_SELECTOR_SUCCESS - Update success statistics
- TRACK_SELECTOR_FAILURE - Update failure statistics
- LOG_SELECTOR_FAILURE - Store failure diagnostics
- SELECTOR_VALIDATION_RESULTS - Store validation results
- GET_SELECTOR_HEALTH - Return health summary

Add these in the existing switch statement, after existing handlers.
```

### Expected Code Output

**Add handlers in the switch statement in `background/service_worker.js`:**

```javascript
// ============================================================
// PHASE 8: SELECTOR RESILIENCE MANAGEMENT
// ============================================================

case 'GET_SELECTOR_CONFIG': {
    try {
        const config = await loadSelectorConfig();
        const stats = await loadSelectorStats();
        response = {
            success: true,
            config: config.selectors,
            version: config.version,
            stats: stats
        };
    } catch (error) {
        console.error('[SW] Error loading selector config:', error);
        response = {
            success: false,
            error: error.message,
            config: DEFAULT_SELECTORS,
            version: SELECTOR_VERSION,
            stats: {}
        };
    }
    break;
}

case 'UPDATE_SELECTOR_CONFIG': {
    try {
        const { selectors } = message;
        
        // Validate structure
        if (!selectors || typeof selectors !== 'object') {
            response = { success: false, error: 'Invalid selector configuration' };
            break;
        }
        
        await saveSelectorConfig(selectors);
        console.log('[SW] ✅ Selector config updated');
        
        response = { success: true };
    } catch (error) {
        console.error('[SW] Error updating selector config:', error);
        response = { success: false, error: error.message };
    }
    break;
}

case 'RESET_SELECTOR_CONFIG': {
    try {
        await resetSelectorConfig();
        console.log('[SW] ✅ Selector config reset to defaults');
        
        response = { success: true };
    } catch (error) {
        console.error('[SW] Error resetting selector config:', error);
        response = { success: false, error: error.message };
    }
    break;
}

case 'TRACK_SELECTOR_SUCCESS': {
    try {
        const { selectorKey, selector } = message;
        await updateSelectorStat(selectorKey, selector, true);
        
        // Fire and forget - don't block response
        response = { success: true };
    } catch (error) {
        // Don't fail the request if stats tracking fails
        response = { success: true };
    }
    break;
}

case 'TRACK_SELECTOR_FAILURE': {
    try {
        const { selectorKey, selector } = message;
        await updateSelectorStat(selectorKey, selector, false);
        
        response = { success: true };
    } catch (error) {
        response = { success: true };
    }
    break;
}

case 'LOG_SELECTOR_FAILURE': {
    try {
        const { diagnostics } = message;
        
        // Store failure diagnostics (keep last 10)
        const failures = await getFromStorage(['selectorFailures']);
        const failureList = failures.selectorFailures || [];
        
        failureList.push({
            ...diagnostics,
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        });
        
        // Keep only last 10 failures
        if (failureList.length > 10) {
            failureList.shift();
        }
        
        await saveToStorage({ selectorFailures: failureList });
        
        console.warn('[SW] Selector failure logged:', diagnostics.selectorKey);
        
        response = { success: true };
    } catch (error) {
        console.error('[SW] Error logging selector failure:', error);
        response = { success: true };
    }
    break;
}

case 'SELECTOR_VALIDATION_RESULTS': {
    try {
        const { results, pageUrl, timestamp } = message;
        
        // Store validation results
        await saveToStorage({
            lastSelectorValidation: {
                results,
                pageUrl,
                timestamp
            }
        });
        
        // Check for critical issues (no selectors working)
        const criticalIssues = Object.keys(results).filter(key => {
            return results[key].working === 0;
        });
        
        if (criticalIssues.length > 0) {
            console.error('[SW] ⚠️ CRITICAL: Selectors failing:', criticalIssues);
            
            // PHASE 8 ENHANCEMENT: Trigger auto-learning when critical issues detected
            // This may help reorder selectors to find working ones
            try {
                const { autoLearnSelectorOrder } = await import('./selector_config.js');
                const config = await loadSelectorConfig();
                const reorderedConfig = await autoLearnSelectorOrder(config.selectors);
                const orderChanged = JSON.stringify(reorderedConfig) !== JSON.stringify(config.selectors);
                
                if (orderChanged) {
                    await saveSelectorConfig(reorderedConfig);
                    console.log('[SW] ✅ Auto-learned selector order after critical failure');
                }
            } catch (e) {
                // Auto-learning failed, but don't fail the validation
                console.warn('[SW] Auto-learning error:', e);
            }
        }
        
        response = { success: true, criticalIssues };
    } catch (error) {
        console.error('[SW] Error storing validation results:', error);
        response = { success: true };
    }
    break;
}

case 'GET_SELECTOR_HEALTH': {
    try {
        const config = await loadSelectorConfig();
        const stats = await loadSelectorStats();
        const failures = await getFromStorage(['selectorFailures']);
        const validation = await getFromStorage(['lastSelectorValidation']);
        
        // Calculate health summary
        const health = {
            version: config.version,
            configLoaded: !!config.selectors,
            totalSelectorKeys: Object.keys(config.selectors).length,
            statsAvailable: Object.keys(stats).length,
            recentFailures: (failures.selectorFailures || []).length,
            lastValidation: validation.lastSelectorValidation?.timestamp || null,
            criticalIssues: []
        };
        
        // Identify selectors with low success rates
        Object.keys(stats).forEach(statKey => {
            const stat = stats[statKey];
            if (stat.attempts >= 10 && stat.successRate < 0.5) {
                health.criticalIssues.push({
                    selector: statKey,
                    successRate: stat.successRate,
                    attempts: stat.attempts
                });
            }
        });
        
        response = {
            success: true,
            health
        };
    } catch (error) {
        console.error('[SW] Error getting selector health:', error);
        response = {
            success: false,
            error: error.message
        };
    }
    break;
}

case 'RESET_SELECTOR_STATS': {
    try {
        await saveSelectorStats({});
        console.log('[SW] ✅ Selector stats reset');
        
        response = { success: true };
    } catch (error) {
        response = { success: false, error: error.message };
    }
    break;
}

case 'LINKEDIN_WARNING_DETECTED': {
    try {
        const { pageUrl, timestamp } = message;
        
        // Store warning detection
        const warnings = await getFromStorage(['linkedInWarnings']);
        const warningList = warnings.linkedInWarnings || [];
        
        warningList.push({
            pageUrl,
            timestamp: timestamp || new Date().toISOString(),
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        });
        
        // Keep only last 5 warnings
        if (warningList.length > 5) {
            warningList.shift();
        }
        
        await saveToStorage({ linkedInWarnings: warningList });
        
        // Trigger notification to all popup instances
        chrome.runtime.sendMessage({
            action: 'SHOW_WARNING_NOTIFICATION',
            message: 'LinkedIn security checkpoint detected. Please complete verification before continuing.',
            type: 'linkedin_warning'
        }).catch(() => {}); // Ignore if no popup open
        
        console.error('[SW] 🚨 LinkedIn warning detected:', pageUrl);
        
        response = { success: true };
    } catch (error) {
        console.error('[SW] Error handling LinkedIn warning:', error);
        response = { success: true };
    }
    break;
}

case 'AUTO_LEARN_SELECTORS': {
    try {
        const config = await loadSelectorConfig();
        const stats = await loadSelectorStats();
        
        // Only auto-learn if we have enough data
        const hasEnoughData = Object.keys(stats).some(statKey => {
            const stat = stats[statKey];
            return stat.attempts >= 10;
        });
        
        if (!hasEnoughData) {
            response = { success: true, learned: false, reason: 'Insufficient data' };
            break;
        }
        
        // Reorder selectors based on performance
        const reorderedConfig = await autoLearnSelectorOrder(config.selectors);
        
        // Only save if order changed
        const orderChanged = JSON.stringify(reorderedConfig) !== JSON.stringify(config.selectors);
        
        if (orderChanged) {
            await saveSelectorConfig(reorderedConfig);
            console.log('[SW] ✅ Selector order auto-learned and updated');
            response = { success: true, learned: true, updated: true };
        } else {
            response = { success: true, learned: true, updated: false, reason: 'Order already optimal' };
        }
    } catch (error) {
        console.error('[SW] Error auto-learning selectors:', error);
        response = { success: false, error: error.message };
    }
    break;
}

case 'CHECK_PAGE_FINGERPRINT': {
    try {
        const { fingerprint, pageUrl } = message;
        
        // Get last known fingerprint for this URL
        const fingerprints = await getFromStorage(['pageFingerprints']);
        const fingerprintMap = fingerprints.pageFingerprints || {};
        
        const urlBase = pageUrl.split('?')[0]; // URL without params
        const lastFingerprint = fingerprintMap[urlBase];
        
        if (lastFingerprint && lastFingerprint.fingerprint !== fingerprint) {
            // Fingerprint changed - possible UI update
            console.warn('[SW] ⚠️ Page structure changed - LinkedIn may have updated UI:', urlBase);
            
            // Store change detection
            const changes = await getFromStorage(['pageStructureChanges']);
            const changeList = changes.pageStructureChanges || [];
            
            changeList.push({
                url: urlBase,
                oldFingerprint: lastFingerprint.fingerprint,
                newFingerprint: fingerprint,
                timestamp: new Date().toISOString(),
                lastSeen: lastFingerprint.timestamp
            });
            
            // Keep only last 10 changes
            if (changeList.length > 10) {
                changeList.shift();
            }
            
            await saveToStorage({ pageStructureChanges: changeList });
            
            response = {
                success: true,
                changed: true,
                message: 'Page structure changed - LinkedIn UI may have been updated'
            };
        } else {
            // Update fingerprint
            fingerprintMap[urlBase] = {
                fingerprint,
                timestamp: new Date().toISOString()
            };
            await saveToStorage({ pageFingerprints: fingerprintMap });
            
            response = { success: true, changed: false };
        }
    } catch (error) {
        console.error('[SW] Error checking fingerprint:', error);
        response = { success: false, error: error.message };
    }
    break;
}
```

**Step 3: Add auto-validation on extension startup**

**Agent Prompt:**
```
Add automatic selector health check on extension startup.

In the initialization block at the end of service_worker.js, add:
- Log selector system version
- Check for recent selector failures
- Warn if critical issues detected

This should be non-blocking and informational only.
```

### Expected Code Changes

**Update initialization in `background/service_worker.js`:**

```javascript
// Load settings and start queue processor on startup
(async () => {
    try {
        const { outputSheetId, searchIndex } = await getFromStorage(['outputSheetId', 'searchIndex']);
        currentOutputSheetId = outputSheetId || null;
        currentSearchIndex = searchIndex || 0;
        startQueueProcessor();
        
        // PHASE 8: Selector system health check
        try {
            const config = await loadSelectorConfig();
            console.log(`[SW] Selector system v${config.version} loaded`);
            
            // Check for recent failures
            const failures = await getFromStorage(['selectorFailures']);
            const failureList = failures.selectorFailures || [];
            
            if (failureList.length > 0) {
                const recentFailures = failureList.filter(f => {
                    const failTime = new Date(f.timestamp);
                    const hoursAgo = (Date.now() - failTime.getTime()) / (1000 * 60 * 60);
                    return hoursAgo < 24; // Last 24 hours
                });
                
                if (recentFailures.length > 0) {
                    console.warn(`[SW] ⚠️ ${recentFailures.length} selector failures in last 24 hours`);
                }
            }
        } catch (selectorError) {
            console.warn('[SW] Selector system health check failed:', selectorError);
        }
        
        console.log('[SW] Service worker initialized');
    } catch (error) {
        console.error('[SW] Init error:', error);
    }
})();
```

### Verification Steps

1. **Syntax Check:**
   - Reload extension
   - Check service worker console for errors

2. **Handler Test:**
   - Open service worker console
   - Test GET_SELECTOR_CONFIG handler:
   ```javascript
   chrome.runtime.sendMessage({action: 'GET_SELECTOR_CONFIG'}, r => console.log(r));
   ```

3. **Stats Tracking Test:**
   - Perform a scrape
   - Check that stats are being updated

### 🧪 Gate Check 8.3
```
✅ All selector management handlers added
✅ GET_SELECTOR_CONFIG returns config and stats
✅ TRACK_SELECTOR_SUCCESS updates statistics correctly
✅ LOG_SELECTOR_FAILURE stores diagnostics
✅ GET_SELECTOR_HEALTH provides health summary
✅ Auto-validation on startup works
✅ No syntax errors in service_worker.js
```

**If gate check passes:** Proceed to Task 8.4  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 8.4: Add Selector Test UI to Popup

**Status:** ⏳ Pending  
**Dependencies:** Tasks 8.1, 8.2, 8.3 must be complete  
**Estimated Time:** 25-30 minutes

### Objective
Add UI to popup for testing selectors, viewing health, and manual selector updates.

### Files to Modify
- `popup/popup.html` - Add selector test section
- `popup/popup.css` - Style selector test section
- `popup/popup.js` - Add selector test logic

### Step-by-Step Instructions

**Step 1: Add HTML for selector test section**

**Agent Prompt:**
```
Add a new "Selector Health" section to popup/popup.html.

Place it after the Queue Status section and before the Actions section.

Include:
- Selector health status indicator (green/yellow/red)
- "Test Selectors" button
- Health summary display (collapsible)
- Optionally: Manual selector update form (advanced, can be hidden by default)

Use consistent styling with existing sections.
```

### Expected Code Output

**Add to `popup/popup.html` (after Queue Status section):**

```html
<!-- Selector Health Section (NEW - Phase 8) -->
<section class="section selector-health-section" id="selectorHealthSection">
    <h2>🔍 Selector Health</h2>
    
    <div class="selector-health-status" id="selectorHealthStatus">
        <div class="health-indicator" id="healthIndicator">
            <span class="health-dot"></span>
            <span class="health-text" id="healthText">Checking...</span>
        </div>
        <button id="testSelectorsBtn" class="btn btn-small btn-secondary">
            🧪 Test Selectors
        </button>
    </div>
    
    <div class="selector-health-details" id="selectorHealthDetails" style="display: none;">
        <div class="health-summary" id="healthSummary">
            <p class="health-summary-text">Loading health data...</p>
        </div>
        
        <details class="health-details-collapsible">
            <summary>View Details</summary>
            <div class="health-details-content" id="healthDetailsContent">
                <!-- Populated by JavaScript -->
            </div>
        </details>
    </div>
    
    <details class="advanced-selector-controls" style="margin-top: 10px;">
        <summary style="font-size: 11px; color: #888; cursor: pointer;">Advanced: Update Selectors</summary>
        <div class="advanced-controls-content" style="margin-top: 8px; padding: 8px; background: #1a1a1a; border-radius: 4px;">
            <p style="font-size: 11px; color: #888; margin-bottom: 8px;">
                Update selectors manually (JSON format). Use with caution.
            </p>
            <textarea id="selectorConfigTextarea" 
                      placeholder='{"profileCard": ["selector1", "selector2"], ...}'
                      style="width: 100%; min-height: 100px; font-family: monospace; font-size: 11px; padding: 6px; background: #2a2a2a; color: #f0f0f0; border: 1px solid #555; border-radius: 4px; resize: vertical;"></textarea>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button id="updateSelectorsBtn" class="btn btn-small btn-warning">Update</button>
                <button id="resetSelectorsBtn" class="btn btn-small btn-secondary">Reset to Defaults</button>
            </div>
        </div>
    </details>
</section>
```

**Step 2: Add CSS styles**

**Add to `popup/popup.css`:**

```css
/* ============================================
   PHASE 8: Selector Health Styles
   ============================================ */

.selector-health-section {
    background: #2a2a2a;
    border: 1px solid #444;
}

.selector-health-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.health-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
}

.health-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #888; /* Default gray */
    transition: background 0.3s;
}

.health-dot.healthy {
    background: #28a745; /* Green */
    animation: pulse 2s infinite;
}

.health-dot.warning {
    background: #ffc107; /* Yellow */
}

.health-dot.critical {
    background: #dc3545; /* Red */
}

.health-text {
    font-size: 12px;
    color: #f0f0f0;
}

.selector-health-details {
    margin-top: 10px;
    padding: 10px;
    background: #1a1a1a;
    border-radius: 6px;
}

.health-summary-text {
    font-size: 12px;
    color: #f0f0f0;
    margin: 0;
}

.health-details-collapsible {
    margin-top: 10px;
}

.health-details-collapsible summary {
    font-size: 11px;
    color: #888;
    cursor: pointer;
    padding: 4px 0;
}

.health-details-collapsible summary:hover {
    color: #f0f0f0;
}

.health-details-content {
    margin-top: 8px;
    padding: 8px;
    background: #2a2a2a;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    color: #f0f0f0;
    max-height: 200px;
    overflow-y: auto;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* PHASE 8 ENHANCEMENT: Notification Banner Styles */
.notification-banner {
    position: sticky;
    top: 0;
    z-index: 1000;
    margin: -16px -16px 16px -16px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #dc3545, #c82333);
    color: white;
    border-bottom: 2px solid #ff4444;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    animation: slideDown 0.3s ease-out;
}

.notification-banner.warning {
    background: linear-gradient(135deg, #ffc107, #e0a800);
    border-bottom-color: #ffc107;
}

.notification-banner.info {
    background: linear-gradient(135deg, #0077B5, #005f8f);
    border-bottom-color: #0077B5;
}

@keyframes slideDown {
    from {
        transform: translateY(-100%);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.notification-icon {
    font-size: 18px;
    flex-shrink: 0;
}

.notification-message {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
}

.notification-close {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    flex-shrink: 0;
    transition: background 0.2s;
}

.notification-close:hover {
    background: rgba(255,255,255,0.3);
}
```

**Step 3: Add JavaScript logic**

**Add to `popup/popup.js`:**

```javascript
// Add to elements object:
const elements = {
    // ... existing elements ...
    
    // Phase 8: Selector Health
    selectorHealthSection: document.getElementById('selectorHealthSection'),
    healthIndicator: document.getElementById('healthIndicator'),
    healthDot: document.querySelector('.health-dot'),
    healthText: document.getElementById('healthText'),
    testSelectorsBtn: document.getElementById('testSelectorsBtn'),
    selectorHealthDetails: document.getElementById('selectorHealthDetails'),
    healthSummary: document.getElementById('healthSummary'),
    healthDetailsContent: document.getElementById('healthDetailsContent'),
    selectorConfigTextarea: document.getElementById('selectorConfigTextarea'),
    updateSelectorsBtn: document.getElementById('updateSelectorsBtn'),
    resetSelectorsBtn: document.getElementById('resetSelectorsBtn'),
    // Phase 8 Enhancement: Notifications
    notificationBanner: document.getElementById('notificationBanner'),
    notificationIcon: document.getElementById('notificationIcon'),
    notificationMessage: document.getElementById('notificationMessage'),
    notificationClose: document.getElementById('notificationClose')
};

// Add to state object:
let state = {
    // ... existing state ...
    selectorHealth: null
};

/**
 * Check selector health and update UI
 */
async function checkSelectorHealth() {
    try {
        const response = await sendMessage('GET_SELECTOR_HEALTH');
        
        if (response && response.success) {
            state.selectorHealth = response.health;
            updateSelectorHealthUI(response.health);
        } else {
            updateSelectorHealthUI(null, 'Error checking health');
        }
    } catch (error) {
        console.error('[POPUP] Error checking selector health:', error);
        updateSelectorHealthUI(null, 'Error checking health');
    }
}

/**
 * Update selector health UI based on health data
 */
function updateSelectorHealthUI(health, errorMessage = null) {
    const dot = elements.healthDot;
    const text = elements.healthText;
    
    if (errorMessage || !health) {
        dot.className = 'health-dot';
        text.textContent = errorMessage || 'Unknown';
        return;
    }
    
    // Determine health status
    const hasCriticalIssues = health.criticalIssues.length > 0;
    const hasRecentFailures = health.recentFailures > 0;
    
    if (hasCriticalIssues) {
        dot.className = 'health-dot critical';
        text.textContent = `Critical: ${health.criticalIssues.length} issues`;
    } else if (hasRecentFailures) {
        dot.className = 'health-dot warning';
        text.textContent = `Warning: ${health.recentFailures} recent failures`;
    } else {
        dot.className = 'health-dot healthy';
        text.textContent = 'Healthy';
    }
    
    // Update summary
    if (elements.healthSummary) {
        const summaryHTML = `
            <p class="health-summary-text">
                Version: ${health.version} | 
                Selectors: ${health.totalSelectorKeys} | 
                Stats: ${health.statsAvailable} tracked
                ${hasRecentFailures ? ` | Failures: ${health.recentFailures}` : ''}
            </p>
        `;
        elements.healthSummary.innerHTML = summaryHTML;
    }
    
    // Show details if there are issues
    if (hasCriticalIssues || hasRecentFailures) {
        if (elements.selectorHealthDetails) {
            elements.selectorHealthDetails.style.display = 'block';
        }
        updateHealthDetails(health);
    }
}

/**
 * Update detailed health information
 */
function updateHealthDetails(health) {
    if (!elements.healthDetailsContent) return;
    
    let detailsHTML = '<div style="line-height: 1.6;">';
    
    if (health.criticalIssues.length > 0) {
        detailsHTML += '<div style="color: #dc3545; margin-bottom: 8px;"><strong>Critical Issues:</strong></div>';
        health.criticalIssues.forEach(issue => {
            detailsHTML += `<div style="margin-left: 12px; margin-bottom: 4px;">
                ${issue.selector}: ${(issue.successRate * 100).toFixed(1)}% success 
                (${issue.attempts} attempts)
            </div>`;
        });
    }
    
    if (health.lastValidation) {
        detailsHTML += `<div style="margin-top: 8px; color: #888; font-size: 10px;">
            Last validation: ${new Date(health.lastValidation).toLocaleString()}
        </div>`;
    }
    
    detailsHTML += '</div>';
    elements.healthDetailsContent.innerHTML = detailsHTML;
}

/**
 * Test selectors on current LinkedIn page
 */
async function handleTestSelectors() {
    if (!elements.testSelectorsBtn) return;
    
    elements.testSelectorsBtn.disabled = true;
    elements.testSelectorsBtn.textContent = 'Testing...';
    
    updateStatus('🧪 Testing selectors on current page...', 30);
    
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url?.includes('linkedin.com')) {
            updateStatus('❌ Navigate to LinkedIn first');
            elements.testSelectorsBtn.disabled = false;
            elements.testSelectorsBtn.textContent = '🧪 Test Selectors';
            return;
        }
        
        // Send message to content script to validate selectors
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'VALIDATE_SELECTORS'
        });
        
        if (response && response.success) {
            updateStatus('✅ Selector test complete', 100);
            
            // Show results
            if (response.results) {
                showSelectorTestResults(response.results);
            }
            
            // Refresh health check
            await checkSelectorHealth();
        } else {
            updateStatus('⚠️ Selector test failed - content script may not be loaded');
        }
    } catch (error) {
        console.error('[POPUP] Selector test error:', error);
        updateStatus(`❌ Test error: ${error.message}`);
    } finally {
        elements.testSelectorsBtn.disabled = false;
        elements.testSelectorsBtn.textContent = '🧪 Test Selectors';
    }
}

/**
 * Show selector test results in a modal or expandable section
 */
function showSelectorTestResults(results) {
    // Create a summary of results
    let summary = 'Test Results:\n\n';
    
    Object.keys(results).forEach(key => {
        const result = results[key];
        const status = result.working > 0 ? '✅' : '❌';
        summary += `${status} ${key}: ${result.working}/${result.tested} working\n`;
    });
    
    // Show in health details
    if (elements.healthDetailsContent) {
        let detailsHTML = '<div style="line-height: 1.6; margin-bottom: 8px;"><strong>Test Results:</strong></div>';
        
        Object.keys(results).forEach(key => {
            const result = results[key];
            const status = result.working > 0 ? '✅' : '❌';
            const color = result.working > 0 ? '#28a745' : '#dc3545';
            
            detailsHTML += `<div style="color: ${color}; margin-left: 12px; margin-bottom: 4px;">
                ${status} <strong>${key}</strong>: ${result.working}/${result.tested} working
            </div>`;
        });
        
        elements.healthDetailsContent.innerHTML = detailsHTML;
        if (elements.selectorHealthDetails) {
            elements.selectorHealthDetails.style.display = 'block';
        }
    }
}

/**
 * Handle manual selector config update
 */
async function handleUpdateSelectors() {
    if (!elements.selectorConfigTextarea) return;
    
    const configText = elements.selectorConfigTextarea.value.trim();
    
    if (!configText) {
        updateStatus('❌ Please enter selector configuration');
        return;
    }
    
    try {
        const config = JSON.parse(configText);
        
        updateStatus('🔄 Updating selectors...', 50);
        
        const response = await sendMessage('UPDATE_SELECTOR_CONFIG', {
            selectors: config
        });
        
        if (response && response.success) {
            updateStatus('✅ Selectors updated successfully', 100);
            elements.selectorConfigTextarea.value = '';
            
            // Refresh health
            await checkSelectorHealth();
        } else {
            updateStatus(`❌ Update failed: ${response?.error || 'Unknown error'}`);
        }
    } catch (error) {
        updateStatus(`❌ Invalid JSON: ${error.message}`);
    }
}

/**
 * Handle reset to default selectors
 */
async function handleResetSelectors() {
    const confirmed = confirm('Reset selectors to defaults? This will clear any custom configurations.');
    
    if (!confirmed) return;
    
    try {
        updateStatus('🔄 Resetting to defaults...', 50);
        
        const response = await sendMessage('RESET_SELECTOR_CONFIG');
        
        if (response && response.success) {
            updateStatus('✅ Selectors reset to defaults', 100);
            if (elements.selectorConfigTextarea) {
                elements.selectorConfigTextarea.value = '';
            }
            
            // Refresh health
            await checkSelectorHealth();
        } else {
            updateStatus(`❌ Reset failed: ${response?.error || 'Unknown error'}`);
        }
    } catch (error) {
        updateStatus(`❌ Reset error: ${error.message}`);
    }
}

// PHASE 8 ENHANCEMENT: Notification functions
/**
 * Show notification banner in popup
 */
function showNotification(message, type = 'error') {
    if (!elements.notificationBanner) return;
    
    const banner = elements.notificationBanner;
    const icon = elements.notificationIcon;
    const messageEl = elements.notificationMessage;
    
    // Set type (error, warning, info)
    banner.className = `notification-banner ${type}`;
    
    // Set icon based on type
    const icons = {
        error: '🚨',
        warning: '⚠️',
        info: 'ℹ️',
        linkedin_warning: '🔒'
    };
    icon.textContent = icons[type] || icons.error;
    
    // Set message
    messageEl.textContent = message;
    
    // Show banner
    banner.style.display = 'block';
    
    // Auto-hide after 10 seconds for non-critical messages
    if (type !== 'error' && type !== 'linkedin_warning') {
        setTimeout(() => {
            hideNotification();
        }, 10000);
    }
}

/**
 * Hide notification banner
 */
function hideNotification() {
    if (elements.notificationBanner) {
        elements.notificationBanner.style.display = 'none';
    }
}

// Add message handler for content script validation results
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ... existing message handlers ...
    
    if (message.action === 'SELECTOR_VALIDATION_COMPLETE') {
        if (message.results) {
            showSelectorTestResults(message.results);
        }
        checkSelectorHealth(); // Refresh health display
    }
    
    // PHASE 8 ENHANCEMENT: Handle notifications
    if (message.action === 'SHOW_CRITICAL_FAILURE_NOTIFICATION') {
        showNotification(message.message || 'Critical selector failures detected', 'error');
    }
    
    if (message.action === 'SHOW_WARNING_NOTIFICATION') {
        showNotification(
            message.message || 'LinkedIn security checkpoint detected',
            message.type || 'linkedin_warning'
        );
    }
    
    // ... rest of handlers ...
});
```

**Step 4: Add event listeners and initialization**

**Update `init()` function in `popup/popup.js`:**

```javascript
async function init() {
    // ... existing init code ...
    
    // Phase 8: Initialize selector health check
    await checkSelectorHealth();
    
    // Phase 8: Add selector test event listeners
    elements.testSelectorsBtn?.addEventListener('click', handleTestSelectors);
    elements.updateSelectorsBtn?.addEventListener('click', handleUpdateSelectors);
    elements.resetSelectorsBtn?.addEventListener('click', handleResetSelectors);
    
    // PHASE 8 ENHANCEMENT: Notification close button
    elements.notificationClose?.addEventListener('click', hideNotification);
    
    // ... rest of init ...
}
```

**Add VALIDATE_SELECTORS handler to content script:**

```javascript
// In content/content.js message listener:

case 'VALIDATE_SELECTORS': {
    validateAllSelectors().then(results => {
        sendResponse({ success: true, results });
    }).catch(error => {
        sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async
}
```

### Verification Steps

1. **UI Check:**
   - Reload extension
   - Open popup
   - Verify "Selector Health" section appears
   - Check health indicator shows status

2. **Test Button:**
   - Navigate to LinkedIn search page
   - Open popup
   - Click "Test Selectors"
   - Verify results appear

3. **Health Check:**
   - Verify health status updates correctly
   - Check details section shows when there are issues

### 🧪 Gate Check 8.4
```
✅ Selector Health section appears in popup
✅ Health indicator displays correctly (green/yellow/red)
✅ Test Selectors button works
✅ Selector test results display correctly
✅ Health summary updates on check
✅ Advanced controls work (update/reset)
✅ All event listeners attached
✅ No syntax errors
```

**If gate check passes:** Proceed to Task 8.5  
**If gate check fails:** Fix errors before continuing

---

## 🔧 Task 8.5: Add Auto-Validation and Enhanced Logging

**Status:** ⏳ Pending  
**Dependencies:** All previous tasks must be complete  
**Estimated Time:** 15-20 minutes

### Objective
Add automatic selector validation on extension startup and enhanced failure logging.

### Files to Modify
- `content/content.js` - Add auto-validation
- `background/service_worker.js` - Enhance failure logging

### Step-by-Step Instructions

**Step 1: Add auto-validation on page load**

**Agent Prompt:**
```
Add automatic selector validation when content script loads on LinkedIn pages.

In content/content.js, after selector initialization:
- Validate selectors if on a LinkedIn search results page
- Log warnings if critical selectors are failing
- Store validation results for health monitoring

Make this non-blocking and run in background.
```

### Expected Code Output

**Update content script initialization:**

```javascript
// After initializeSelectors() call:

// Auto-validate selectors on LinkedIn pages
if (window.location.href.includes('linkedin.com')) {
    // Wait a bit for page to fully load
    setTimeout(async () => {
        if (window.location.href.includes('/search/results/people')) {
            console.log('[SELECTOR] Auto-validating selectors on search page...');
            
            try {
                const results = await validateAllSelectors();
                
                // Check for critical failures
                const criticalFailures = Object.keys(results).filter(key => {
                    return results[key].working === 0;
                });
                
                if (criticalFailures.length > 0) {
                    console.error('[SELECTOR] ⚠️ CRITICAL: Selectors failing:', criticalFailures);
                    
                    // Notify user (non-intrusive)
                    chrome.runtime.sendMessage({
                        action: 'SELECTOR_CRITICAL_FAILURE',
                        failures: criticalFailures,
                        pageUrl: window.location.href
                    }).catch(() => {});
                } else {
                    console.log('[SELECTOR] ✅ All selectors validated successfully');
                }
            } catch (error) {
                console.warn('[SELECTOR] Auto-validation error:', error);
            }
        }
    }, 2000); // Wait 2 seconds for page to load
}
```

**Step 2: Add periodic health checks during scraping**

**Agent Prompt:**
```
Add periodic selector health checks during active scraping sessions.

In the scraping loop:
- Check selector health every 10 pages
- Warn if selector success rates are declining
- Log selector performance metrics

This helps catch selector degradation early.
```

### Expected Code Output

**Update scraping loop in `startScraping()`:**

```javascript
// In the main scraping loop, after pageCount increment:

// Periodic selector health check (every 10 pages)
if (pageCount % 10 === 0 && pageCount > 0) {
    try {
        const results = await validateAllSelectors();
        
        // Check if we're getting fewer results than expected
        const profileCards = querySelectorAllWithFallbacks(document, 'profileCard', {
            logSuccess: false
        });
        
        if (profileCards.length === 0) {
            console.warn(`[SELECTOR] ⚠️ No profile cards found on page ${pageCount} - possible selector issue`);
        }
        
        // Log selector performance
        console.log(`[SELECTOR] Health check on page ${pageCount}:`, {
            cardsFound: profileCards.length,
            selectorsValidated: Object.keys(results).length
        });
    } catch (error) {
        // Don't interrupt scraping for health check errors
        console.warn('[SELECTOR] Health check error:', error);
    }
}
```

**Step 3: Enhance failure logging with more context**

**Update `logSelectorFailure()` to capture more diagnostic info:**

```javascript
function logSelectorFailure(selectorKey, selectors, attempts, rootElement, options = {}) {
    // ... existing tracking code ...
    
        // PHASE 8 ENHANCEMENT: Generate page fingerprint
        const fingerprint = generatePageFingerprint(document);
        
        // Enhanced diagnostics
        const diagnostics = {
            selectorKey,
            timestamp: new Date().toISOString(),
            pageUrl: window.location.href,
            selectorsAttempted: selectors,
            attempts,
            domSnapshot: captureRelevantDOM(rootElement),
            options,
            // NEW: Additional context
            userAgent: navigator.userAgent,
            pageTitle: document.title,
            urlParams: new URLSearchParams(window.location.search).toString(),
            visibleElements: {
                totalDivs: document.querySelectorAll('div').length,
                totalLinks: document.querySelectorAll('a').length,
                profileLinks: document.querySelectorAll('a[href*="/in/"]').length
            },
            // Sample of what we CAN find (for debugging)
            sampleSelectors: {
                anyDataViewName: document.querySelectorAll('[data-view-name]').length,
                anyReusableSearch: document.querySelectorAll('.reusable-search').length,
                anyEntityResult: document.querySelectorAll('.entity-result').length
            },
            // PHASE 8 ENHANCEMENT: Page structure fingerprint
            pageFingerprint: fingerprint
        };
        
        // PHASE 8 ENHANCEMENT: Check if fingerprint changed (possible UI update)
        sendMessageToBackground({
            action: 'CHECK_PAGE_FINGERPRINT',
            fingerprint,
            pageUrl: window.location.href
        }).catch(() => {});
    
    console.error(`[SELECTOR] ❌ All selectors failed for "${selectorKey}":`, diagnostics);
    
    // Send to background for storage/analysis
    sendMessageToBackground({
        action: 'LOG_SELECTOR_FAILURE',
        diagnostics
    }).catch(() => {});
}
```

**Step 4: Add critical failure notification**

**Add handler in service worker for critical failures:**

```javascript
case 'SELECTOR_CRITICAL_FAILURE': {
    try {
        const { failures, pageUrl } = message;
        
        // Store critical failure
        await saveToStorage({
            lastCriticalSelectorFailure: {
                failures,
                pageUrl,
                timestamp: new Date().toISOString()
            }
        });
        
        console.error('[SW] 🚨 CRITICAL: Selector failures detected:', failures);
        
        // PHASE 8 ENHANCEMENT: Send visible notification to popup
        chrome.runtime.sendMessage({
            action: 'SHOW_CRITICAL_FAILURE_NOTIFICATION',
            failures,
            pageUrl,
            message: `Critical selector failures detected: ${failures.join(', ')}. Scraping may fail.`
        }).catch(() => {}); // Ignore if no popup open
        
        // PHASE 8 ENHANCEMENT: Optional webhook notification (if configured)
        const webhookConfig = await getFromStorage(['webhookUrl']);
        if (webhookConfig.webhookUrl) {
            try {
                fetch(webhookConfig.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'selector_critical_failure',
                        failures,
                        pageUrl,
                        timestamp: new Date().toISOString()
                    })
                }).catch(() => {}); // Fire and forget
            } catch (e) {
                // Ignore webhook errors
            }
        }
        
        response = { success: true };
    } catch (error) {
        console.error('[SW] Error handling critical failure:', error);
        response = { success: true };
    }
    break;
}
```

### Verification Steps

1. **Auto-Validation Test:**
   - Reload extension
   - Navigate to LinkedIn search page
   - Check console for auto-validation logs
   - Verify validation runs automatically

2. **Health Check During Scraping:**
   - Start a scrape
   - Let it run for 10+ pages
   - Check console for periodic health checks
   - Verify no scraping interruption

3. **Failure Logging Test:**
   - Manually break a selector (temporarily)
   - Trigger a scrape
   - Check that enhanced diagnostics are logged
   - Verify diagnostics stored in background

### 🧪 Gate Check 8.5
```
✅ Auto-validation runs on LinkedIn pages
✅ Periodic health checks during scraping work
✅ Enhanced failure logging captures comprehensive diagnostics
✅ Critical failure notifications work
✅ No performance impact on scraping
✅ All logging uses [SELECTOR] prefix consistently
```

**If gate check passes:** Proceed to Integration Testing  
**If gate check fails:** Fix errors before continuing

---

## 🧪 Phase 8 Integration Testing

**Status:** ⏳ Pending  
**Dependencies:** All tasks 8.1-8.5 must be complete  
**Estimated Time:** 30-40 minutes

### Test Sequence

**Test 1: Selector Configuration Loading**
```bash
1. Reload extension
2. Open popup
3. Check "Selector Health" section
4. ✅ Health indicator should show status
5. ✅ Should show version number
6. ✅ Default selectors should be loaded
```

**Test 2: Fallback Selector System**
```bash
1. Navigate to LinkedIn search results page
2. Open DevTools Console
3. Check for "[SELECTOR] ✅ Selector system initialized"
4. Start a scrape
5. ✅ Scraping should work normally
6. ✅ Console should show selector success logs
7. ✅ Profiles should be found and scraped
```

**Test 3: Selector Test Button**
```bash
1. Navigate to LinkedIn search results page
2. Open popup
3. Click "Test Selectors" button
4. ✅ Should show "Testing..." status
5. ✅ Results should appear in health details
6. ✅ Should show which selectors work/don't work
7. ✅ Results should persist until next test
```

**Test 4: Statistics Tracking**
```bash
1. Perform multiple scrapes
2. Navigate to different LinkedIn pages
3. Open popup → Selector Health → View Details
4. ✅ Should show statistics for used selectors
5. ✅ Success rates should be calculated
6. ✅ Last attempt timestamps should be shown
```

**Test 5: Selector Failure Handling**
```bash
1. Temporarily break a selector in config (invalid selector)
2. Start a scrape
3. ✅ Should try all selectors in fallback chain
4. ✅ Should log comprehensive failure info
5. ✅ Should continue with next selector in chain
6. ✅ Scraping should not crash
```

**Test 6: Manual Selector Update**
```bash
1. Open popup → Selector Health → Advanced
2. Paste valid selector config JSON
3. Click "Update"
4. ✅ Should update successfully
5. ✅ Health check should reflect changes
6. ✅ New selectors should be used immediately
7. Click "Reset to Defaults"
8. ✅ Should restore default selectors
```

**Test 7: Auto-Validation**
```bash
1. Reload extension
2. Navigate to LinkedIn search results page
3. Wait 2-3 seconds
4. ✅ Console should show auto-validation logs
5. ✅ Validation results should be stored
6. ✅ Health indicator should update if issues found
```

**Test 8: Critical Failure Detection**
```bash
1. Break all selectors for a key (temporary)
2. Navigate to LinkedIn page
3. ✅ Should detect critical failure
4. ✅ Should log comprehensive diagnostics
5. ✅ Should notify via console warnings
6. ✅ Health indicator should show critical status
```

**Test 9: Backward Compatibility**
```bash
1. Verify existing scraping still works
2. Verify no regressions in functionality
3. ✅ Scraping should work exactly as before
4. ✅ All existing features should still function
5. ✅ No breaking changes to API
```

### Expected Results

| Test | Expected Outcome |
|------|-----------------|
| Configuration Loading | Selectors load from storage or defaults, version tracked |
| Fallback System | Multiple selectors tried, first working one used |
| Test Button | Manual validation works, results displayed clearly |
| Statistics Tracking | Success rates tracked, stored, and displayed |
| Failure Handling | Comprehensive logging, graceful degradation |
| Manual Update | Selectors can be updated via UI, changes persist |
| Auto-Validation | Runs on page load, stores results, updates health |
| Critical Detection | Failures detected early, user notified |
| Backward Compat | All existing functionality works unchanged |

### 🧪 Final Gate Check
```
✅ All 9 tests pass
✅ No console errors during normal operation
✅ Selector system enhances reliability without breaking existing features
✅ Health monitoring provides useful diagnostics
✅ Selectors can be updated without code changes
✅ Comprehensive logging aids debugging
✅ Auto-validation catches issues early
✅ Backward compatibility maintained
```

**If all tests pass:** Phase 8 is complete! 🎉  
**If tests fail:** Identify failing test, fix issues, retest

---

## 📊 Selector System Benefits Summary

After Phase 8, the extension gains:

1. **Resilience** - Multiple fallback selectors prevent overnight breakage
2. **Observability** - Health monitoring shows selector status at a glance
3. **Flexibility** - Selectors can be updated without redeploying extension
4. **Debuggability** - Comprehensive logging helps diagnose issues quickly
5. **Proactivity** - Auto-validation catches problems before users report them
6. **Intelligence** - Statistics track which selectors work best over time

---

## ✅ Phase 8 Success Criteria

| Feature | Test |
|---------|------|
| Fallback Chains | Try selector A, if fails try B, continue until one works |
| Health Monitoring | Track success rates, show health status in UI |
| Configurable Selectors | Update selectors via storage, no code changes needed |
| Auto-Validation | Validate selectors on page load automatically |
| Test Button | Manual selector testing from popup UI |
| Statistics Tracking | Track success/failure rates for each selector |
| Comprehensive Logging | Detailed diagnostics when selectors fail |
| Backward Compatibility | All existing functionality works unchanged |

---

## 🔗 Quick Reference: New Message Actions

| Action | Purpose |
|--------|---------|
| `GET_SELECTOR_CONFIG` | Load selector config and stats |
| `UPDATE_SELECTOR_CONFIG` | Update selector configuration |
| `RESET_SELECTOR_CONFIG` | Reset to default selectors |
| `TRACK_SELECTOR_SUCCESS` | Record selector success |
| `TRACK_SELECTOR_FAILURE` | Record selector failure |
| `LOG_SELECTOR_FAILURE` | Store comprehensive failure diagnostics |
| `SELECTOR_VALIDATION_RESULTS` | Store validation test results |
| `GET_SELECTOR_HEALTH` | Get health summary |
| `VALIDATE_SELECTORS` | Trigger validation (content script) |
| `SELECTOR_CRITICAL_FAILURE` | Report critical selector failures |
| `LINKEDIN_WARNING_DETECTED` | Report LinkedIn security checkpoint |
| `SHOW_WARNING_NOTIFICATION` | Show notification in popup |
| `SHOW_CRITICAL_FAILURE_NOTIFICATION` | Show critical failure notification |
| `AUTO_LEARN_SELECTORS` | Trigger selector auto-learning |
| `CHECK_PAGE_FINGERPRINT` | Check if page structure changed |
| `RESET_SELECTOR_STATS` | Clear selector statistics |

---

## 📝 Execution Notes for Agent

### ⚠️ CRITICAL: Backward Compatibility

**This is an enhancement, not a rewrite:**
- Keep all existing selector code as fallback
- New system runs alongside old system
- If new system fails, old system still works
- No breaking changes to existing APIs

### Common Pitfalls to Avoid

1. **Don't Remove Old Selectors**
   - Keep hardcoded selectors as ultimate fallback
   - New system should enhance, not replace

2. **Don't Block on Stats Tracking**
   - Statistics tracking should be fire-and-forget
   - Don't slow down scraping for stats

3. **Don't Over-Log**
   - Use logSuccess: false for noisy operations
   - Only log failures and significant events

4. **Don't Break Existing Functionality**
   - Test that scraping still works exactly as before
   - Verify no regressions

### File Modification Strategy

1. **Create new files** for new functionality (selector_config.js)
2. **Enhance existing files** without removing old code
3. **Add new features** alongside existing features
4. **Test thoroughly** after each change

---

## 🚨 Troubleshooting During Execution

### Issue: "Selector config not loading"
**Solution:** Check that selector_config.js is imported correctly in service_worker.js

### Issue: "Fallback selectors not working"
**Solution:** Verify querySelectorWithFallbacks() is called correctly, check selector keys match config

### Issue: "Stats not updating"
**Solution:** Check that TRACK_SELECTOR_SUCCESS/FAILURE messages are being sent and handled

### Issue: "Test button not working"
**Solution:** Verify content script is loaded, check VALIDATE_SELECTORS handler exists

---

## 🚀 Phase 8 Enhancements Summary

This plan includes all requested enhancements:

### ✅ 1. LinkedIn Warning Detection

**Implementation:**
- Added `linkedInWarning` selector array to `DEFAULT_SELECTORS` (Task 8.1)
- Created `checkLinkedInWarning()` function in content script (Task 8.2)
- Integrated warning check before scraping starts (Task 8.2)
- Added `LINKEDIN_WARNING_DETECTED` handler in service worker (Task 8.3)
- Shows notification banner when warnings detected (Task 8.4)

**Location:**
- `selector_config.js`: `linkedInWarning` selector array with 7 fallback strategies
- `content/content.js`: `checkLinkedInWarning()` function + integration in `scrapeCurrentPage()`
- `background/service_worker.js`: `LINKEDIN_WARNING_DETECTED` handler
- `popup/popup.html` + `popup.js`: Notification banner UI

---

### ✅ 2. Notification on Critical Failure

**Implementation:**
- Enhanced `SELECTOR_CRITICAL_FAILURE` handler to send visible notifications (Task 8.3)
- Added notification banner HTML/CSS to popup (Task 8.4)
- Added notification handling functions in popup.js (Task 8.4)
- Optional webhook notification support (if configured) (Task 8.3)

**Features:**
- Toast/banner notification appears at top of popup
- Auto-dismisses after 10 seconds (except critical errors)
- Close button for manual dismissal
- Three notification types: error, warning, info
- Optional webhook integration for external monitoring

**Location:**
- `popup/popup.html`: Notification banner HTML
- `popup/popup.css`: Banner styles with animations
- `popup/popup.js`: `showNotification()`, `hideNotification()` functions
- `background/service_worker.js`: Enhanced `SELECTOR_CRITICAL_FAILURE` handler

---

### ✅ 3. Selector Auto-Learning

**Implementation:**
- Added `autoLearnSelectorOrder()` function to `selector_config.js` (Task 8.1)
- Triggers automatically when critical failures detected (Task 8.3)
- Promotes best-performing selectors to first position based on success rates
- Requires minimum 10 attempts per selector before reordering

**How It Works:**
1. Tracks success rates for each selector over time
2. When critical failure detected, analyzes stats
3. Reorders selectors: highest success rate first
4. Saves updated configuration automatically

**Location:**
- `background/selector_config.js`: `autoLearnSelectorOrder()` function
- `background/service_worker.js`: Auto-triggered in `SELECTOR_VALIDATION_RESULTS` handler
- Statistics tracked via `TRACK_SELECTOR_SUCCESS` / `TRACK_SELECTOR_FAILURE`

---

### ✅ 4. Page Structure Fingerprinting

**Implementation:**
- Added `generatePageFingerprint()` function to `selector_config.js` (Task 8.1)
- Integrated fingerprint generation in failure logging (Task 8.5)
- Added `CHECK_PAGE_FINGERPRINT` handler to detect UI changes (Task 8.3)
- Stores fingerprints and compares on each page load

**How It Works:**
1. Generates hash-like identifier from page structure:
   - Data attributes (`data-view-name`, `data-test-id`)
   - Key CSS classes (`.reusable-search`, `.entity-result`)
   - DOM structure sample (first 5 results)
2. Compares with last known fingerprint
3. Flags when fingerprint changes (possible LinkedIn UI update)
4. Stores change history for analysis

**Location:**
- `background/selector_config.js`: `generatePageFingerprint()` function
- `content/content.js`: Fingerprint generation in `logSelectorFailure()`
- `background/service_worker.js`: `CHECK_PAGE_FINGERPRINT` handler
- Storage: `pageFingerprints` and `pageStructureChanges`

---

## 📋 Enhancement Integration Checklist

| Enhancement | Task | Status | Files Modified |
|------------|------|--------|---------------|
| LinkedIn Warning Detection | 8.1, 8.2, 8.3, 8.4 | ✅ Integrated | `selector_config.js`, `content.js`, `service_worker.js`, `popup.html/js` |
| Critical Failure Notifications | 8.3, 8.4 | ✅ Integrated | `service_worker.js`, `popup.html/css/js` |
| Auto-Learning System | 8.1, 8.3 | ✅ Integrated | `selector_config.js`, `service_worker.js` |
| Page Fingerprinting | 8.1, 8.3, 8.5 | ✅ Integrated | `selector_config.js`, `content.js`, `service_worker.js` |

---

## 🎯 Key Enhancement Benefits

1. **Early Warning System**: Detects LinkedIn security checkpoints before scraping fails
2. **User Visibility**: Critical failures now show visible notifications instead of just console logs
3. **Self-Improving**: System learns which selectors work best and promotes them automatically
4. **Change Detection**: Fingerprinting identifies when LinkedIn updates their UI structure

---

*End of Phase 8 Plan - Ready for Agentic Execution*

**START HERE:** Task 8.1 - Create selector configuration system.
