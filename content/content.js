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

    /**
     * Parse name and extract accreditations
     * Returns: { cleanName: string, accreditations: string[] }
     * 
     * Examples:
     * "James Weaver, CWS®" -> { cleanName: "James Weaver", accreditations: ["CWS®"] }
     * "Marcus Fair Jr, CFP®, QPFC" -> { cleanName: "Marcus Fair Jr", accreditations: ["CFP®", "QPFC"] }
     * "Chris Hardy, CFP®, EA, AIF®, ChFC®, CLU®, NTPI Fellow" -> { cleanName: "Chris Hardy", accreditations: ["CFP®", "EA", "AIF®", "ChFC®", "CLU®", "NTPI Fellow"] }
     */
    function parseNameWithAccreditations(fullName) {
        if (!fullName) {
            return { cleanName: "", accreditations: [] };
        }

        // Trim the name
        let name = fullName.trim();
        
        // If no comma, assume no accreditations
        if (!name.includes(',')) {
            return { cleanName: name, accreditations: [] };
        }

        // Split by comma
        const parts = name.split(',').map(p => p.trim());
        
        // First part is the name (may include Jr, Sr, II, III, IV, etc.)
        let cleanName = parts[0];
        
        // Check if first part ends with common suffixes that should stay with name
        const nameSuffixes = ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const firstPartWords = cleanName.split(/\s+/);
        const lastWord = firstPartWords[firstPartWords.length - 1];
        
        // If the last word is a suffix, keep it with the name
        // Otherwise, if there are more parts, check if second part is a suffix
        if (parts.length > 1) {
            const secondPart = parts[1];
            if (nameSuffixes.includes(secondPart)) {
                // Second part is a suffix (e.g., "John Smith, Jr")
                cleanName = parts[0] + ', ' + secondPart;
                // Start accreditations from third part
                parts.splice(0, 2);
            } else {
                // Second part is likely an accreditation, start from second part
                parts.splice(0, 1);
            }
        } else {
            parts.splice(0, 1);
        }

        // Everything after the name (and optional suffix) are accreditations
        const accreditations = parts.filter(part => part.length > 0);
        
        // Limit to 6 accreditations max
        const limitedAccreditations = accreditations.slice(0, 6);
        
        // Pad with empty strings to always have 6 columns
        while (limitedAccreditations.length < 6) {
            limitedAccreditations.push('');
        }

        return {
            cleanName: cleanName.trim(),
            accreditations: limitedAccreditations
        };
    }

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
    // PHASE 8 ENHANCED: Structure-Aware Extraction System
    // Added in v1.1.0 - Extracts data by DOM position, not classes
    // ============================================================

    /**
     * Extract title and location using DOM structure analysis
     * This method is class-name agnostic and uses positional relationships
     * 
     * @param {Element} card - The profile card container element
     * @returns {Object} - { title, location, method } or null if extraction failed
     */
    function extractByStructure(card) {
        try {
            // Step 1: Find the name link (our anchor point)
            const nameLink = card.querySelector('a[href*="/in/"]');
            if (!nameLink) {
                console.log('[STRUCTURE] No name link found in card');
                return null;
            }

            // Step 2: Get all text-containing elements
            const textElements = findAllTextElementsInCard(card, nameLink);
            if (textElements.length < 2) {
                console.log('[STRUCTURE] Not enough text elements found:', textElements.length, 'elements. First few:', textElements.slice(0, 3).map(e => e.text?.substring(0, 30)));
                return null;
            }

            // Step 3: Identify title and location by position
            const result = identifyTitleAndLocation(textElements, nameLink);
            
            if (result.title || result.location) {
                console.log('[STRUCTURE] ✅ Extracted via structure:', {
                    title: result.title?.substring(0, 50) + '...',
                    location: result.location
                });
                return {
                    title: result.title || '',
                    location: result.location || '',
                    method: 'structure-aware'
                };
            }

            return null;
        } catch (error) {
            console.warn('[STRUCTURE] Extraction error:', error);
            return null;
        }
    }

    /**
     * Find all text-containing elements in a card, excluding the name
     * 
     * @param {Element} card - The profile card
     * @param {Element} nameLink - The name link element to exclude
     * @returns {Array} - Array of {element, text, depth, index} objects
     */
    function findAllTextElementsInCard(card, nameLink) {
        const textElements = [];
        const nameLinkRect = nameLink.getBoundingClientRect();
        const nameText = nameLink.innerText.trim().toLowerCase();

        // Get all potential text containers (updated for December 2024 LinkedIn DOM)
        // LinkedIn's title/location are in p tags inside div.d395caa1 containers
        const candidates = card.querySelectorAll('p, div > p, div.d395caa1 > p');
        
        candidates.forEach((el, index) => {
            const text = el.innerText?.trim();
            
            // Skip if:
            // - No text or too short
            // - Contains the name (is the name element)
            // - Is inside the name link
            // - Is a button or interactive element
            if (!text || text.length < 3) return;
            if (text.toLowerCase() === nameText) return;
            if (nameLink.contains(el)) return;
            if (el.closest('button, [role="button"]')) return;
            
            // Skip common non-content patterns (updated for current LinkedIn)
            const skipPatterns = [
                /^connect$/i,
                /^message$/i,
                /^follow$/i,
                /^see all/i,
                /^\d+ mutual/i,
                /and \d+ other mutual connections/i,
                /^view profile$/i,
                /^•\s*(1st|2nd|3rd)/i  // Connection degree indicators
            ];
            if (skipPatterns.some(p => p.test(text))) return;
            
            // Skip paragraphs that contain connection degree indicators (• 1st, • 2nd, etc.)
            if (/^•\s*(1st|2nd|3rd)/.test(text)) return;

            // Calculate vertical position relative to name
            const elRect = el.getBoundingClientRect();
            const verticalOffset = elRect.top - nameLinkRect.top;

            textElements.push({
                element: el,
                text: text,
                verticalOffset: verticalOffset,
                index: index,
                tagName: el.tagName.toLowerCase()
            });
        });

        // Sort by vertical position (top to bottom)
        textElements.sort((a, b) => a.verticalOffset - b.verticalOffset);

        // Filter to only elements BELOW the name (positive vertical offset)
        const belowName = textElements.filter(el => el.verticalOffset > 5);
        
        // Return only the first 2 candidates (title and location)
        // This prevents getting too many irrelevant elements
        return belowName.slice(0, 2);
    }

    /**
     * Identify which text element is title and which is location
     * ENHANCED: Uses both position and content patterns with improved validation
     * 
     * @param {Array} textElements - Sorted array of text elements
     * @param {Element} nameLink - The name link for reference
     * @returns {Object} - { title, location }
     */
    function identifyTitleAndLocation(textElements, nameLink) {
        // Filter to only elements BELOW the name
        const nameRect = nameLink.getBoundingClientRect();
        const belowName = textElements.filter(el => el.verticalOffset > 5); // 5px threshold

        if (belowName.length === 0) {
            return { title: '', location: '' };
        }

        // Simple case: first element is title, second is location
        let titleCandidate = belowName[0]?.text || '';
        let locationCandidate = belowName[1]?.text || '';

        // ENHANCED: Multi-factor validation
        const titleScore = calculateTitleConfidence(titleCandidate, locationCandidate);
        const locationScore = calculateLocationConfidence(locationCandidate, titleCandidate);
        
        // If confidence scores suggest swap, correct it
        if (locationScore > titleScore && looksLikeLocation(titleCandidate) && looksLikeTitle(locationCandidate)) {
            console.log('[STRUCTURE] Content patterns suggest swap needed (confidence scores)');
            [titleCandidate, locationCandidate] = [locationCandidate, titleCandidate];
        }
        // Also check original pattern-based validation as backup
        else if (looksLikeLocation(titleCandidate) && looksLikeTitle(locationCandidate) && !looksLikeLocation(locationCandidate)) {
            console.log('[STRUCTURE] Content patterns suggest swap needed (pattern match)');
            [titleCandidate, locationCandidate] = [locationCandidate, titleCandidate];
        }

        return {
            title: titleCandidate,
            location: locationCandidate
        };
    }

    /**
     * Calculate confidence score that text is a title
     * ENHANCED: Uses multiple factors for better accuracy
     * @param {string} text - Text to evaluate
     * @param {string} otherText - The other candidate (location)
     * @returns {number} - Confidence score (0-1)
     */
    function calculateTitleConfidence(text, otherText) {
        if (!text) return 0;
        
        let score = 0;
        
        // Strong indicators
        if (/\bat\s+[A-Z]/.test(text)) score += 0.4;  // "at Company"
        if (/\s*\|\s*/.test(text)) score += 0.3;      // "Title | Company"
        if (looksLikeTitle(text)) score += 0.3;
        
        // Negative indicators
        if (looksLikeLocation(text)) score -= 0.2;
        if (text.length < 10) score -= 0.1;  // Too short for most titles
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Calculate confidence score that text is a location
     * ENHANCED: Uses multiple factors for better accuracy
     * @param {string} text - Text to evaluate
     * @param {string} otherText - The other candidate (title)
     * @returns {number} - Confidence score (0-1)
     */
    function calculateLocationConfidence(text, otherText) {
        if (!text) return 0;
        
        let score = 0;
        
        // Strong indicators
        if (/^[A-Z][a-z]+,\s*[A-Z]{2}$/.test(text)) score += 0.5;  // "City, ST"
        if (/\b(?:Area|Metropolitan|County)\s*$/i.test(text)) score += 0.4;
        if (looksLikeLocation(text)) score += 0.3;
        
        // Negative indicators
        if (looksLikeTitle(text)) score -= 0.2;
        if (/\bat\b/.test(text)) score -= 0.3;  // "at" suggests title
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Check if text looks like a location
     * ENHANCED: Improved patterns to reduce false positives with job titles
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    function looksLikeLocation(text) {
        if (!text) return false;
        
        // Exclude common job title patterns that might match location patterns
        if (/\b(?:Area Manager|Regional Director|Territory Sales)\b/i.test(text)) {
            return false; // These are job titles, not locations
        }
        
        const locationPatterns = [
            // Geographic suffixes (strong indicators)
            /\b(?:Area|Metropolitan|County|Region|Province|State)\s*$/i,
            // City, State format (strong indicator)
            /^[A-Z][a-z]+,\s*[A-Z]{2}$/,           // "Portland, OR"
            /^[A-Z][a-z]+,\s*[A-Z][a-z]+\s*$/,     // "London, England"
            // Country names (strong indicator)
            /\b(?:United States|USA|Canada|UK|Australia|Germany|France|India|Mexico|Brazil)\b/i,
            // Regional descriptors
            /Greater\s+[A-Z][a-z]+\s*(?:Area|Metro|Region)?/i,  // "Greater Seattle Area"
            /\b(?:Bay|Metro|Tri-State|Northeast|Southeast|Midwest|West Coast)\s+Area/i,
            // Standalone location keywords
            /^(?:Remote|Hybrid|On-site)$/i
        ];
        
        return locationPatterns.some(p => p.test(text));
    }

    /**
     * Check if text looks like a job title
     * ENHANCED: Improved patterns to better distinguish from locations
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    function looksLikeTitle(text) {
        if (!text) return false;
        
        const titlePatterns = [
            // Company indicator (strong title indicator)
            /\bat\s+[A-Z]/i,                        // "Engineer at Google"
            // Separator patterns
            /\s*\|\s*/,                             // "Title | Company"
            // Job title keywords (enhanced list)
            /\b(?:CEO|CFO|CTO|COO|VP|SVP|EVP|EVP|Director|Manager|Lead|Head|Chief|President|Founder|Partner|Principal|Owner|Senior|Junior|Associate|Analyst|Engineer|Developer|Designer|Consultant|Advisor|Specialist|Coordinator|Administrator|Executive|Officer|Representative|Sales|Marketing|Product|Operations|Finance|HR|Recruiter|Accountant|Attorney|Lawyer|Paralegal|Therapist|Counselor|Teacher|Professor|Instructor|Doctor|Nurse|Physician|Surgeon|Dentist|Pharmacist|Veterinarian|Architect|Designer|Artist|Writer|Editor|Journalist|Producer|Director|Photographer|Videographer|Chef|Bartender|Waiter|Server|Cashier|Receptionist|Secretary|Assistant|Intern|Volunteer|Intern|Trainee|Apprentice|Apprentice)\b/i,
            // Company suffix pattern
            /-\s*[A-Z]/i,                           // "Engineer - Google"
            /,\s*(?:Inc|LLC|Ltd|Corp|Co\.|Company|Group|Solutions|Services|Systems|Technologies|Tech|Consulting|Partners|Associates)\b/i,
            // Industry-specific patterns (financial services)
            /\b(?:Financial|Investment|Wealth|Portfolio|Asset|Fund|Equity|Trading|Advisory|Planning)\s+(?:Advisor|Manager|Analyst|Consultant|Associate|Specialist|Planner)/i,
            // Academic/professional credentials in context
            /\b(?:CFA|CFP|CPA|MBA|PhD|MD|JD|LLM|CMA|CIA|CISA|PMP|PMI|CISSP|AWS|Azure|GCP)\s*(?:\®|®)?\s*[A-Z]?/i
        ];
        
        return titlePatterns.some(p => p.test(text));
    }

    // ============================================================
    // END: Structure-Aware Extraction System
    // ============================================================

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
     * Send message to background with timeout
     * @param {Object} message - Message to send
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Object>} - Response or null
     */
    function sendMessageWithTimeout(message, timeout = 5000) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                resolve(null);
            }, timeout);

            chrome.runtime.sendMessage(message, (response) => {
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                    console.warn('[CS] Message error:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Initialize selector configuration from background/storage
     * ENHANCED: Now fetches optimized (success-rate sorted) selectors
     * 
     * @returns {Promise<boolean>} - True if initialized successfully
     */
    async function initializeSelectors() {
        try {
            // Try to get optimized selectors first (sorted by success rate)
            const optimizedResponse = await sendMessageWithTimeout({
                action: 'GET_OPTIMIZED_SELECTORS'
            }, 3000);

            if (optimizedResponse?.success && optimizedResponse.config) {
                selectorConfig = optimizedResponse.config;
                console.log('[SELECTOR] ✅ Loaded OPTIMIZED selector config');
                return true;
            }

            // Fall back to regular config
            const response = await sendMessageWithTimeout({
                action: 'GET_SELECTOR_CONFIG'
            }, 3000);

            if (response?.success && response.config) {
                selectorConfig = response.config;
                selectorStats = response.stats || {};
                console.log('[SELECTOR] ✅ Loaded selector config (default order)');
                return true;
            }

            console.warn('[SELECTOR] ⚠️ Using hardcoded fallback selectors');
            return false;
        } catch (error) {
            console.error('[SELECTOR] Failed to initialize:', error);
            return false;
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
     * Updated December 2024 - Based on current LinkedIn DOM structure
     */
    function getHardcodedFallback(selectorKey) {
        const fallbacks = {
            profileCard: [
                'div[data-view-name="people-search-result"]'
            ],
            nameLink: [
                'a[data-view-name="search-result-lockup-title"]'
            ],
            title: [
                // Strategy 1: Title is in div.d395caa1 without the .a7293f27 class (location has this)
                'div[data-view-name="people-search-result"] div.d395caa1:not(.a7293f27) > p',
                // Strategy 2: First div.d395caa1 > p after name (location is second)
                'div[data-view-name="people-search-result"] div.d395caa1:first-of-type > p'
            ],
            location: [
                // Strategy 1: Location's parent div has the extra class a7293f27
                'div[data-view-name="people-search-result"] div.d395caa1.a7293f27 > p',
                // Strategy 2: Second div.d395caa1 > p (title is first)
                'div[data-view-name="people-search-result"] div.d395caa1:nth-of-type(2) > p'
            ],
            connectionSource: [
                'a[data-view-name="search-result-social-proof-insight"]'
            ],
            nextButton: [
                // WORKING SELECTOR - LinkedIn's current Next button
                'button[data-testid="pagination-controls-next-button-visible"]',
                // Keep old ones as fallback
                'button[aria-label="Next"]'
            ],
            linkedInWarning: [
                '[data-test-id="security-challenge"]',
                '.challenge-dialog'
            ]
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
        
        // PHASE 8 ENHANCEMENT: Generate page fingerprint
        const fingerprint = generatePageFingerprint(document);
        
        // Capture diagnostic information
        const diagnostics = {
            selectorKey,
            timestamp: new Date().toISOString(),
            pageUrl: window.location.href,
            selectorsAttempted: selectors,
            attempts,
            domSnapshot: captureRelevantDOM(rootElement),
            options,
            // Additional context
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

                const fullName = nameAnchor.innerText.trim();
                let url = nameAnchor.href || "";
                if (url.includes('?')) url = url.split('?')[0];

                // Parse name and extract accreditations
                const { cleanName, accreditations } = parseNameWithAccreditations(fullName);

                // ============================================================
                // PHASE 8 ENHANCED: Multi-Layer Title/Location Extraction
                // ============================================================
                let title = '';
                let location = '';
                let extractionMethod = 'none';

                // Layer 1: Try structure-aware extraction FIRST
                console.log('[CS] 🔍 Attempting structure-aware extraction for card');
                const structureResult = extractByStructure(card);
                if (structureResult && (structureResult.title || structureResult.location)) {
                    title = structureResult.title;
                    location = structureResult.location;
                    extractionMethod = structureResult.method;
                    console.log('[CS] ✅ Used structure-aware extraction', { title: title?.substring(0, 30), location: location?.substring(0, 30) });
                } else {
                    console.log('[CS] ⚠️ Structure-aware extraction failed or returned empty, trying direct p-tag method');
                    
                    // DIRECT P-TAG EXTRACTION FALLBACK (for current LinkedIn DOM)
                    // Get all p tags in card, filter out name and connection indicators
                    const allPTags = Array.from(card.querySelectorAll('p'));
                    
                    // Filter out name paragraph (contains the name link)
                    const contentPTags = allPTags.filter(p => !p.querySelector('a[data-view-name="search-result-lockup-title"]'));
                    
                    // Filter out connection/mutual paragraphs and other noise
                    const dataPTags = contentPTags.filter(p => {
                        const text = p.innerText?.trim() || '';
                        return !text.includes('mutual connection') && 
                               !text.includes('other mutual') &&
                               !text.includes('• 1st') && 
                               !text.includes('• 2nd') && 
                               !text.includes('• 3rd') &&
                               !/^•\s*(1st|2nd|3rd)/i.test(text) &&
                               text.length > 3 &&
                               text.length < 200 &&
                               !text.toLowerCase().includes('connect') &&
                               !text.toLowerCase().includes('message') &&
                               !text.toLowerCase().includes('follow');
                    });
                    
                    if (dataPTags.length >= 2) {
                        title = dataPTags[0]?.innerText?.trim() || '';
                        location = dataPTags[1]?.innerText?.trim() || '';
                        extractionMethod = 'direct-p-tag';
                        console.log('[CS] ✅ Extracted via direct p-tag method:', { title: title.substring(0, 30), location: location.substring(0, 30) });
                    } else if (dataPTags.length === 1) {
                        // Only one data field found - likely title
                        title = dataPTags[0]?.innerText?.trim() || '';
                        extractionMethod = 'direct-p-tag-partial';
                        console.log('[CS] ⚠️ Only title found via direct method:', title.substring(0, 30));
                    }
                }

                // Layer 2: If structure-aware and direct p-tag failed or incomplete, try fallback selectors
                if (!title) {
                    const titleElement = querySelectorWithFallbacks(card, 'title', {
                        context: 'scrapeCurrentPage.title',
                        logSuccess: false
                    });
                    if (titleElement) {
                        title = titleElement.innerText.trim();
                        extractionMethod = extractionMethod === 'none' ? 'selector-fallback' : extractionMethod + '+selector';
                    }
                }

                if (!location) {
                    const locationElement = querySelectorWithFallbacks(card, 'location', {
                        context: 'scrapeCurrentPage.location',
                        logSuccess: false
                    });
                    if (locationElement) {
                        location = locationElement.innerText.trim();
                        extractionMethod = extractionMethod === 'none' ? 'selector-fallback' : extractionMethod + '+selector';
                    }
                }

                // Layer 3: Content pattern validation (swap if needed)
                if (title && location && looksLikeLocation(title) && looksLikeTitle(location)) {
                    console.log('[CS] ⚠️ Content patterns suggest title/location swap needed');
                    [title, location] = [location, title];
                    extractionMethod += '+content-swap';
                }

                // Log extraction method for debugging (only in verbose mode or failures)
                if (!title && !location) {
                    console.warn('[CS] ⚠️ Failed to extract title and location for:', cleanName);
                }

                // ============================================================
                // END: Multi-Layer Extraction
                // ============================================================

                // Connection source comes from input sheet (passed via message.sourceName)
                const connectionSource = defaultSource || "N/A";

                if (cleanName && url) {
                    // Row format: [Date, Name, Title, Location, Connection Source, LinkedIn URL, Accr1, Accr2, Accr3, Accr4, Accr5, Accr6]
                    rows.push([
                        today, 
                        cleanName, 
                        title, 
                        location, 
                        connectionSource, 
                        url,
                        ...accreditations
                    ]);
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
    
    /**
     * Detect pagination state: count visible pages and check if Next button exists
     * @returns {Object} { pageCount: number, hasNext: boolean, estimatedTotal: number }
     */
    function detectPaginationState() {
        // Count visible page numbers (buttons with data-testid="pagination-indicator-*")
        const pageButtons = document.querySelectorAll('button[data-testid^="pagination-indicator-"]');
        const pageNumbers = Array.from(pageButtons).map(btn => {
            const span = btn.querySelector('span');
            return span ? parseInt(span.innerText.trim()) : null;
        }).filter(num => num !== null);
        
        // Also check for current page (span with page number, not in button)
        const currentPageSpans = document.querySelectorAll('span._1387a4df._11077d88._652ff0f5._0aab64e7');
        currentPageSpans.forEach(span => {
            const num = parseInt(span.innerText.trim());
            if (num && !pageNumbers.includes(num)) {
                pageNumbers.push(num);
            }
        });
        
        const visiblePageCount = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
        
        // Check for Next button with chevron (data-testid="pagination-controls-next-button-visible")
        const nextButton = document.querySelector('button[data-testid="pagination-controls-next-button-visible"]');
        const hasNext = nextButton !== null && nextButton.offsetParent !== null;
        
        // Estimate total: if we see 10 pages and Next exists, there are at least 100+ entries
        // Each page = 10 entries, so visible pages * 10 = minimum
        // If Next exists, add 10 more (at least)
        let estimatedTotal = visiblePageCount * 10;
        if (hasNext) {
            estimatedTotal += 10; // At least one more page
        }
        
        return {
            pageCount: visiblePageCount,
            hasNext: hasNext,
            estimatedTotal: estimatedTotal,
            visiblePages: pageNumbers.sort((a, b) => a - b)
        };
    }
    
    /**
     * Wait for all entries on current page to load
     * @param {number} expectedCount - Expected number of entries (default: 10)
     * @param {number} maxWaitMs - Maximum time to wait (default: 10000ms)
     * @returns {Promise<number>} Actual count of loaded entries
     */
    async function waitForEntriesToLoad(expectedCount = 10, maxWaitMs = 10000) {
        const startTime = Date.now();
        let lastCount = 0;
        let stableCount = 0;
        
        while (Date.now() - startTime < maxWaitMs) {
            // Scroll to bottom to trigger lazy loading
            window.scrollTo(0, document.body.scrollHeight);
            await wait(500);
            
            // Count loaded entries
            const cards = document.querySelectorAll('div[data-view-name="people-search-result"]');
            const currentCount = cards.length;
            
            if (currentCount === lastCount) {
                stableCount++;
                // If count is stable for 2 checks (1 second), we're done
                if (stableCount >= 2) {
                    break;
                }
            } else {
                stableCount = 0;
            }
            
            lastCount = currentCount;
            
            // If we have at least expected count, check if more are loading
            if (currentCount >= expectedCount) {
                // Wait a bit more to see if more load
                await wait(1000);
                const finalCards = document.querySelectorAll('div[data-view-name="people-search-result"]');
                if (finalCards.length === currentCount) {
                    break; // No more loading
                }
            }
        }
        
        const finalCards = document.querySelectorAll('div[data-view-name="people-search-result"]');
        return finalCards.length;
    }
    
    function clickNextButton() {
        // PHASE 8: Try fallback selectors first
        const nextButton = querySelectorWithFallbacks(document, 'nextButton', {
            context: 'clickNextButton',
            logSuccess: false
        });
        
        if (nextButton && !nextButton.disabled) {
            console.log('[CS] Found Next button via fallback selector');
            nextButton.click();
            return true;
        }
        
        // Fallback: Try data-testid (legacy strategy)
        const nextBtn = document.querySelector('button[data-testid="pagination-controls-next-button-visible"]');
        if (nextBtn && nextBtn.offsetParent !== null) {
            console.log('[CS] Found Next via data-testid');
            nextBtn.click();
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

    // ============================================================
    // MAIN SCRAPING LOOP
    // ============================================================
    async function startScraping(providedSourceName = null) {
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
        // Use provided source from input sheet, or fallback to extracting from page
        const sourceName = providedSourceName || getConnectionSource();
        console.log(`[CS] 📎 Connection source: "${sourceName}"`);

        let pageCount = 0;
        let totalProfiles = 0;
        let estimatedTotal = 0;

        // Detect initial pagination state on first page
        const initialPagination = detectPaginationState();
        estimatedTotal = initialPagination.estimatedTotal;
        console.log(`[CS] 📊 Initial pagination: ${initialPagination.pageCount} visible pages, Next: ${initialPagination.hasNext}, Est. total: ${estimatedTotal} entries`);

        // Main loop
        while (!stopRequested && pageCount < CONFIG.MAX_PAGES) {
            pageCount++;
            
            // PHASE 8 ENHANCEMENT: Periodic selector health check (every 10 pages)
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
            
            // Update pagination state for progress estimation
            const paginationState = detectPaginationState();
            if (paginationState.hasNext && paginationState.estimatedTotal > estimatedTotal) {
                estimatedTotal = paginationState.estimatedTotal;
            }
            
            // Calculate progress percentage
            const progressPercent = estimatedTotal > 0 
                ? Math.min(100, Math.round((totalProfiles / estimatedTotal) * 100))
                : 0;
            
            const remainingEstimate = Math.max(0, estimatedTotal - totalProfiles);
            updateButtonStatus(`🔄 Page ${pageCount} | ${totalProfiles}/${estimatedTotal} (${progressPercent}%) | ~${remainingEstimate} left`, null);
            console.log(`[CS] --- Page ${pageCount} --- (Est. ${estimatedTotal} total, ${totalProfiles} found, ${remainingEstimate} remaining)`);

            // Wait for all entries on this page to load (expect 10 per page)
            console.log(`[CS] ⏳ Waiting for all entries to load on page ${pageCount}...`);
            const loadedCount = await waitForEntriesToLoad(10, 10000);
            console.log(`[CS] ✅ ${loadedCount} entries loaded on page ${pageCount}`);

            // Scroll to load any remaining lazy content
            window.scrollTo(0, document.body.scrollHeight);
            await wait(CONFIG.SCROLL_WAIT_MS);

            // Scrape this page
            const pageRows = scrapeCurrentPage(sourceName);
            totalProfiles += pageRows.length;
            
            // Warn if we got fewer entries than expected
            if (pageRows.length < 10 && paginationState.hasNext) {
                console.warn(`[CS] ⚠️ Only found ${pageRows.length} profiles on page ${pageCount} (expected ~10). Waiting longer...`);
                // Wait a bit more and try again
                await wait(2000);
                window.scrollTo(0, document.body.scrollHeight);
                await wait(1000);
                const retryRows = scrapeCurrentPage(sourceName);
                if (retryRows.length > pageRows.length) {
                    console.log(`[CS] ✅ Retry found ${retryRows.length - pageRows.length} more profiles`);
                    totalProfiles += (retryRows.length - pageRows.length);
                    // Send the additional rows
                    if (retryRows.length > pageRows.length) {
                        sendMessageSafe({
                            action: 'DATA_SCRAPED',
                            rows: retryRows.slice(pageRows.length),
                            pageNumber: pageCount
                        });
                    }
                }
            }
            
            console.log(`[CS] ✅ Found ${pageRows.length} profiles on page ${pageCount} (Total: ${totalProfiles})`);

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
                console.log('[CS] 🏁 No more pages - reached end of results');
                break;
            }

            // Random delay before next page
            const delay = randomDelay();
            console.log(`[CS] ⏳ Waiting ${(delay/1000).toFixed(1)}s before next page...`);
            updateButtonStatus(`⏳ Waiting... (${totalProfiles}/${estimatedTotal} found)`, null);
            await wait(delay);
        }

        // Cleanup
        isScrapingActive = false;
        removeStopButton();

        // Tell background to stop keep-alive
        sendMessageSafe({ action: 'STOP_KEEPALIVE' });

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
                startScraping(message.sourceName || null);
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

            case 'VALIDATE_SELECTORS': {
                validateAllSelectors().then(results => {
                    sendResponse({ success: true, results });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep channel open for async
            }

            default:
                sendResponse({ error: 'Unknown action' });
        }

        return true; // Keep channel open
    });

    // ============================================================
    // INITIALIZATION
    // ============================================================
    console.log('[CS] ✅ Savvy Pirate content script loaded');

    // PHASE 8: Initialize selector system
    initializeSelectors().then(initialized => {
        if (initialized) {
            console.log('[SELECTOR] Selector resilience system active');
        } else {
            console.warn('[SELECTOR] Using fallback selectors');
        }
    });

    // PHASE 8: Auto-validate selectors on LinkedIn pages
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

})();
