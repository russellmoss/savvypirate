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

                const fullName = nameAnchor.innerText.trim();
                let url = nameAnchor.href || "";
                if (url.includes('?')) url = url.split('?')[0];

                // Parse name and extract accreditations
                const { cleanName, accreditations } = parseNameWithAccreditations(fullName);

                // Title & Location from <p> tags
                const pTags = card.querySelectorAll('p');
                const title = pTags.length >= 2 ? pTags[1].innerText.trim() : "";
                const location = pTags.length >= 3 ? pTags[2].innerText.trim() : "";

                // Connection source: Always use the provided source from input sheet
                // (No longer trying to extract from page or inline sources)
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
        // Strategy 1: Find Next button with data-testid (most reliable)
        const nextBtn = document.querySelector('button[data-testid="pagination-controls-next-button-visible"]');
        if (nextBtn && nextBtn.offsetParent !== null) {
            console.log('[CS] Found Next via data-testid');
            nextBtn.click();
            return true;
        }
        
        // Strategy 2: Find visible "Next" text
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

        // Strategy 3: Aria label
        const ariaBtn = document.querySelector('button[aria-label="Next"]');
        if (ariaBtn && !ariaBtn.disabled) {
            console.log('[CS] Found Next via aria-label');
            ariaBtn.click();
            return true;
        }

        // Strategy 4: Pagination class
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

            default:
                sendResponse({ error: 'Unknown action' });
        }

        return true; // Keep channel open
    });

    // ============================================================
    // INITIALIZATION
    // ============================================================
    console.log('[CS] ✅ Savvy Pirate content script loaded');

})();
