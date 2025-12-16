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
        // Strategy 1: New LinkedIn structure - div with acd09c55 class (title container)
        'div.acd09c55 > p',
        // Strategy 2: More specific - full class chain for title
        'div._3c8635b4.b537fe1d.a90e6a91.b351b4d3.febc4ac2.acd09c55.f54c229b > p',
        // Strategy 3: Entity result subtitle (most common legacy)
        '.entity-result__primary-subtitle',
        // Strategy 4: Generic subtitle
        '.entity-result__subtitle',
        // Strategy 5: Search result subtitle
        '.search-result__subtitle',
        // Strategy 6: Second <p> tag in card (common pattern)
        'p:nth-of-type(2)',
        // Strategy 7: Generic subtitle class
        '.subline'
    ],

    /**
     * Profile Location
     * Multiple strategies to find location text
     */
    location: [
        // Strategy 1: New LinkedIn structure - div with bb0216de class (location container)
        'div.bb0216de > p',
        // Strategy 2: More specific - full class chain for location
        'div._3c8635b4.b537fe1d.a90e6a91.b351b4d3.febc4ac2.bb0216de.f54c229b > p',
        // Strategy 3: Entity result secondary subtitle (legacy)
        '.entity-result__secondary-subtitle',
        // Strategy 4: Search result metadata
        '.search-result__metadata',
        // Strategy 5: Third <p> tag in card
        'p:nth-of-type(3)',
        // Strategy 6: Location-specific class
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

