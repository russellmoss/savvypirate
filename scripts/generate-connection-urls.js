/**
 * Generate LinkedIn Connection Search URLs
 * 
 * Run this script on any LinkedIn profile page to:
 * 1. Extract the member ID
 * 2. Get the person's name
 * 3. Generate 10 connection search URLs for different titles
 * 4. Format as tab-separated (Name \t Title \t URL) for Google Sheets
 * 5. Auto-copy to clipboard
 */

(function() {
    'use strict';
    
    console.log('🔗 Generating LinkedIn Connection Search URLs...\n');
    
    // The 10 target titles for connection searches
    const TITLES = [
        'Financial Advisor',
        'Wealth Manager',
        'Financial Planner',
        'Investment Advisor',
        'Wealth Advisor',
        'Portfolio Manager',
        'Financial Consultant',
        'Principal',
        'Owner',
        'Partner'
    ];
    
    // Member ID pattern
    const MEMBER_ID_PATTERN = /ACo[A-Za-z0-9_-]{21,}/;
    
    // Extract member ID
    console.log('📋 Step 1: Extracting member ID...');
    let memberId = null;
    
    // Method 1: Check URLs for miniProfileUrn
    document.querySelectorAll('a[href*="miniProfileUrn"], a[href*="fsd_profile"]').forEach(link => {
        const href = decodeURIComponent(link.href);
        const patterns = [
            /miniProfileUrn=urn:li:fsd_profile:([A-Za-z0-9_-]+)/i,
            /fsd_profile:([A-Za-z0-9_-]+)/i,
            /fsd_profile%3A([A-Za-z0-9_-]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = href.match(pattern);
            if (match && match[1] && MEMBER_ID_PATTERN.test(match[1])) {
                memberId = match[1];
                console.log(`  ✅ Found member ID: ${memberId}`);
                break;
            }
        }
    });
    
    // Method 2: Check current page URL
    if (!memberId) {
        const currentUrl = decodeURIComponent(window.location.href);
        const urlPatterns = [
            /miniProfileUrn[=:]urn:li:fsd_profile:([A-Za-z0-9_-]+)/i,
            /\/in\/([A-Za-z0-9_-]{24,35})/,
            /fsd_profile[%:]?([A-Za-z0-9_-]+)/i
        ];
        
        for (const pattern of urlPatterns) {
            const match = currentUrl.match(pattern);
            if (match && match[1] && MEMBER_ID_PATTERN.test(match[1]) && match[1].length >= 24 && match[1].length <= 35) {
                memberId = match[1];
                console.log(`  ✅ Found member ID in page URL: ${memberId}`);
                break;
            }
        }
    }
    
    if (!memberId) {
        console.error('❌ Could not find member ID. Make sure you\'re on a LinkedIn profile page.');
        return null;
    }
    
    // Extract person's name
    console.log('\n📋 Step 2: Extracting person\'s name...');
    let personName = '';
    
    // Try various selectors for the name
    const nameSelectors = [
        'h1.text-heading-xlarge',
        'h1[class*="text-heading"]',
        'h1.break-words',
        'h1',
        '[data-anonymize="person-name"]',
        '.ph5 h1',
        '.pv-text-details__left-panel h1'
    ];
    
    for (const selector of nameSelectors) {
        const nameElement = document.querySelector(selector);
        if (nameElement) {
            personName = nameElement.textContent.trim();
            if (personName && personName.length > 0 && personName.length < 100) {
                console.log(`  ✅ Found name: ${personName}`);
                break;
            }
        }
    }
    
    // Fallback: Try to extract from page title
    if (!personName) {
        const pageTitle = document.title;
        const titleMatch = pageTitle.match(/^([^|]+)\s*\|/);
        if (titleMatch) {
            personName = titleMatch[1].trim();
            console.log(`  ✅ Found name from page title: ${personName}`);
        }
    }
    
    if (!personName) {
        personName = 'Unknown';
        console.warn('  ⚠️ Could not extract name, using "Unknown"');
    }
    
    // Generate URLs
    console.log('\n📋 Step 3: Generating connection search URLs...');
    const urls = [];
    
    TITLES.forEach(title => {
        // URL encode the member ID for the connectionOf parameter
        // Format: connectionOf=["MEMBER_ID"] -> URL encoded
        const connectionOfValue = encodeURIComponent(JSON.stringify([memberId]));
        const titleValue = encodeURIComponent(`"${title}"`);
        
        const url = `https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&connectionOf=${connectionOfValue}&title=${titleValue}`;
        
        urls.push({
            name: personName,
            title: title,
            url: url
        });
        
        console.log(`  ✅ Generated: ${title}`);
    });
    
    // Format for Google Sheets (tab-separated)
    console.log('\n📋 Step 4: Formatting for Google Sheets...');
    const formattedLines = urls.map(item => {
        return `${item.name}\t${item.title}\t${item.url}`;
    });
    
    const formattedText = formattedLines.join('\n');
    
    console.log('\n📋 Step 5: Copying to clipboard...');
    
    // Copy to clipboard
    navigator.clipboard.writeText(formattedText).then(() => {
        console.log('✅ Successfully copied to clipboard!');
        console.log(`\n📊 Generated ${urls.length} URLs:\n`);
        console.log('Preview (first 3):');
        urls.slice(0, 3).forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.name}\t${item.title}`);
            console.log(`     ${item.url.substring(0, 80)}...`);
        });
        console.log(`\n  ... and ${urls.length - 3} more`);
        console.log('\n💡 You can now paste this directly into Google Sheets!');
        
        // Also show the full output for verification
        console.log('\n📋 Full output (for verification):');
        console.log(formattedText);
        
    }).catch(err => {
        console.error('❌ Failed to copy to clipboard:', err);
        console.log('\n📋 Please manually copy this text:');
        console.log('\n' + '='.repeat(80));
        console.log(formattedText);
        console.log('='.repeat(80));
    });
    
    // Return the data for programmatic use
    return {
        memberId: memberId,
        personName: personName,
        urls: urls,
        formattedText: formattedText,
        copyToClipboard: function() {
            return navigator.clipboard.writeText(this.formattedText);
        }
    };
})();

