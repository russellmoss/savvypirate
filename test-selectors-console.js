// LinkedIn Scraper Test Script - Paste into Browser Console
// Run this on a LinkedIn search results page to test title/location extraction

(function() {
    console.log('🔍 Testing LinkedIn Profile Extraction...');
    
    // Test selectors for title and location
    const titleSelectors = [
        'div.acd09c55 > p',
        'div._3c8635b4.b537fe1d.a90e6a91.b351b4d3.febc4ac2.acd09c55.f54c229b > p',
        '.entity-result__primary-subtitle',
        '.entity-result__subtitle',
        'p:nth-of-type(2)'
    ];
    
    const locationSelectors = [
        'div.bb0216de > p',
        'div._3c8635b4.b537fe1d.a90e6a91.b351b4d3.febc4ac2.bb0216de.f54c229b > p',
        '.entity-result__secondary-subtitle',
        'p:nth-of-type(3)',
        '.search-result__location'
    ];
    
    // Helper function to try selectors in order
    function trySelectors(card, selectors) {
        for (const selector of selectors) {
            try {
                const element = card.querySelector(selector);
                if (element) {
                    return element.innerText.trim();
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        return '';
    }
    
    // Find all profile cards
    const cardSelectors = [
        'div[data-view-name="people-search-result"]',
        'li.reusable-search__result-container',
        '.search-result__wrapper',
        '.entity-result__item'
    ];
    
    let cards = [];
    for (const selector of cardSelectors) {
        cards = Array.from(document.querySelectorAll(selector));
        if (cards.length > 0) {
            console.log(`✅ Found ${cards.length} profile cards using: ${selector}`);
            break;
        }
    }
    
    if (cards.length === 0) {
        console.error('❌ No profile cards found! Make sure you are on a LinkedIn search results page.');
        return;
    }
    
    // Extract data from each card
    const results = [];
    const today = new Date().toISOString().split('T')[0];
    
    cards.forEach((card, index) => {
        try {
            // Find name link
            const nameLink = card.querySelector('a[data-view-name="search-result-lockup-title"]') ||
                           card.querySelector('.entity-result__title-text a') ||
                           card.querySelector('a[href^="https://www.linkedin.com/in/"]');
            
            if (!nameLink) {
                console.warn(`⚠️ Card ${index + 1}: No name link found`);
                return;
            }
            
            const name = nameLink.innerText.trim();
            let url = nameLink.href || '';
            if (url.includes('?')) {
                url = url.split('?')[0];
            }
            
            // Extract title
            const title = trySelectors(card, titleSelectors);
            
            // Extract location
            const location = trySelectors(card, locationSelectors);
            
            // Parse name and extract accreditations (same logic as content script)
            function parseNameWithAccreditations(fullName) {
                if (!fullName) {
                    return { cleanName: "", accreditations: [] };
                }

                let name = fullName.trim();
                
                // If no comma, assume no accreditations
                if (!name.includes(',')) {
                    // Still remove parenthetical info
                    name = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
                    return { cleanName: name, accreditations: [] };
                }

                // Split by comma
                const parts = name.split(',').map(p => p.trim());
                
                // First part is the name (may include Jr, Sr, II, III, IV, etc.)
                let cleanName = parts[0];
                
                // Check if first part ends with common suffixes that should stay with name
                const nameSuffixes = ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
                
                // If there are more parts, check if second part is a suffix
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

                // Remove parenthetical info from name
                cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, ' ').trim();

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
            
            const { cleanName, accreditations } = parseNameWithAccreditations(name);
            
            results.push({
                date: today,
                name: cleanName,
                title: title,
                location: location,
                url: url,
                accreditations: accreditations,
                originalName: name
            });
            
            console.log(`✅ Card ${index + 1}: ${cleanName} | ${title || '(no title)'} | ${location || '(no location)'}`);
            
        } catch (e) {
            console.error(`❌ Error processing card ${index + 1}:`, e);
        }
    });
    
    if (results.length === 0) {
        console.error('❌ No profiles extracted!');
        return;
    }
    
    // Format as CSV for Google Sheets
    // Header row (matches actual scraper format)
    const csvRows = [
        ['Date', 'Name', 'Title', 'Location', 'Connection Source', 'LinkedIn URL', 'Accr1', 'Accr2', 'Accr3', 'Accr4', 'Accr5', 'Accr6']
    ];
    
    // Data rows
    results.forEach(result => {
        csvRows.push([
            result.date,
            result.name,
            result.title,
            result.location,
            'Test', // Connection source placeholder
            result.url,
            ...(result.accreditations || []) // Spread accreditations into separate columns
        ]);
    });
    
    // Convert to CSV string
    const csv = csvRows.map(row => {
        // Escape quotes and wrap in quotes if contains comma or newline
        return row.map(cell => {
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        }).join(',');
    }).join('\n');
    
    // Show summary first
    console.log(`\n📊 Extracted ${results.length} profiles`);
    console.log('\n📋 Summary:');
    console.log(`   - Profiles with title: ${results.filter(r => r.title).length}`);
    console.log(`   - Profiles with location: ${results.filter(r => r.location).length}`);
    console.log(`   - Profiles missing title: ${results.filter(r => !r.title).length}`);
    console.log(`   - Profiles missing location: ${results.filter(r => !r.location).length}`);
    console.log('\n📝 First few results:');
    results.slice(0, 3).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.name}`);
        console.log(`      Title: ${r.title || '(missing)'}`);
        console.log(`      Location: ${r.location || '(missing)'}`);
        if (r.accreditations && r.accreditations.filter(a => a).length > 0) {
            console.log(`      Accreditations: ${r.accreditations.filter(a => a).join(', ')}`);
        }
    });
    
    const profilesWithAccreditations = results.filter(r => r.accreditations && r.accreditations.filter(a => a).length > 0).length;
    console.log(`   - Profiles with accreditations: ${profilesWithAccreditations}`);
    
    // Store in window for manual access
    window.linkedinTestResults = results;
    window.linkedinTestCSV = csv;
    
    // Try to copy to clipboard with fallback
    function copyToClipboard(text) {
        // Method 1: Modern Clipboard API (requires user interaction)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(() => {
                console.log('\n✅ SUCCESS! Data copied to clipboard using Clipboard API.');
                return true;
            }).catch(err => {
                console.warn('⚠️ Clipboard API failed, trying fallback method...', err);
                return false;
            });
        }
        return Promise.resolve(false);
    }
    
    function copyToClipboardFallback(text) {
        // Method 2: execCommand (older method, works in console)
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                console.log('\n✅ SUCCESS! Data copied to clipboard using fallback method.');
                return true;
            } else {
                throw new Error('execCommand failed');
            }
        } catch (err) {
            console.error('❌ All clipboard methods failed:', err);
            return false;
        }
    }
    
    // Try clipboard API first, then fallback
    copyToClipboard(csv).then(success => {
        if (!success) {
            copyToClipboardFallback(csv);
        }
        
        // Always show the data
        console.log('\n📋 CSV Data (also available in window.linkedinTestCSV):');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(csv);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n💡 If clipboard didn\'t work, you can:');
        console.log('   1. Copy the CSV data above manually');
        console.log('   2. Or type: copy(window.linkedinTestCSV)');
        console.log('   3. Or access: window.linkedinTestCSV');
        console.log('\n✅ Ready to paste into Google Sheets!');
    });
    
})();

