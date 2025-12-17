# LinkedIn DOM Debugging Guide

## Quick Diagnostic Script

When LinkedIn changes their DOM structure and selectors break, use the diagnostic script to investigate:

### How to Use

1. Navigate to a LinkedIn People search results page (e.g., `https://www.linkedin.com/search/results/people/...`)
2. Open DevTools Console (F12)
3. Copy and paste the entire contents of `debug-linkedin-dom.js` into the console
4. Press Enter

The script will:
- ✅ Analyze the first 3 profile cards
- ✅ Show all p tags and their properties
- ✅ Test current selectors to see which ones work
- ✅ Suggest new selectors based on the current DOM structure
- ✅ Identify unique classes that distinguish title from location

### Why This Script Works Even After DOM Changes

The diagnostic script is designed to be **resilient to LinkedIn DOM changes**:

1. **Uses Stable Attributes**: Primarily uses `data-view-name` attributes which are more stable than class names
2. **Fallback Detection**: If primary selectors fail, it uses fallback methods (finding cards by LinkedIn profile links)
3. **Dynamic Analysis**: Analyzes actual DOM structure rather than relying on hard-coded assumptions
4. **Content Pattern Matching**: Identifies title/location by content patterns, not just structure

**Edge Cases**: If LinkedIn removes `data-view-name` attributes entirely or changes the HTML structure completely (e.g., removes `<p>` tags), the script will warn you but still attempt analysis with fallback methods.

### What to Look For

#### If Title/Location Extraction Fails:

1. **Check the "Final data p tags" count**
   - Should be 2 (title and location)
   - If 0: Filtering is too aggressive or structure changed
   - If >2: Need better filtering logic

2. **Check "Suggested Selectors" section**
   - Look for unique parent classes that distinguish title from location
   - The script will show which classes are unique to location vs title

3. **Check "Selector Tests" section**
   - See which current selectors still work
   - Any selector marked ❌ needs to be updated

### Common Issues and Solutions

#### Issue: No data p tags found
**Solution**: Check if LinkedIn changed the connection indicator text (e.g., "mutual connection" format changed)

#### Issue: Title and location swapped
**Solution**: The script shows "Likely title" and "Likely location" - use content pattern matching or adjust extraction order

#### Issue: Selectors return elements but wrong content
**Solution**: Check the parent classes - LinkedIn may have changed which div contains title vs location

### Sharing Results

When requesting updates, share:
1. The console output from the diagnostic script
2. What selectors are currently failing (from "Selector Tests" section)
3. What the "Suggested Selectors" section shows

This will help quickly identify the issue and provide updated selectors.

---

## Member ID Diagnostic Script

To find where LinkedIn member IDs are stored in the DOM (for building connection URLs):

### How to Use

1. Navigate to a LinkedIn profile page or search results page
2. Open DevTools Console (F12)
3. Copy and paste the entire contents of `debug-linkedin-member-id.js` into the console
4. Press Enter

The script will search for member IDs in:
- ✅ Data attributes (data-member-id, etc.)
- ✅ URL attributes (href, src)
- ✅ JSON-LD structured data in script tags
- ✅ Profile cards on search results
- ✅ Meta tags
- ✅ Hidden text content

### What You'll Get

- **All locations** where member IDs are found
- **Exact selectors** to extract them
- **Recommended extraction methods** with code examples
- **Element structure** showing where IDs are stored

### Example Output

The script will show something like:
```
Found 3 member ID location(s):

Profile Card Link: 2 location(s)
  1. Profile link in card 1
     Selector: div[data-view-name="people-search-result"]:nth-of-type(1) a[href*="/in/"]
     Member ID: ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A

Data Attribute: 1 location(s)
  1. data-member-id on <div>
     Selector: div[data-member-id*="ACoAA"]
     Member ID: ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A
```

### Using the Results

After running the diagnostic, you can use the recommended extraction methods to:
1. Extract member IDs from profile cards
2. Build connection URLs: `https://www.linkedin.com/in/[member-id]`
3. Construct connection search URLs using member IDs

The script provides ready-to-use code snippets for the most reliable extraction methods found.

---

## Extract Member ID Script

To **extract member IDs from any LinkedIn profile page**:

### How to Use

1. Navigate to any LinkedIn profile page (public or your own)
2. Open DevTools Console (F12)
3. Copy and paste the entire contents of `extract-member-id.js` into the console
4. Press Enter

The script will:
- ✅ Search for member IDs in URLs (miniProfileUrn parameters)
- ✅ Check data attributes
- ✅ Look in hidden code elements
- ✅ Extract from meta tags
- ✅ Return the primary member ID and connection URL

### Example Output

```
🔍 Extracting LinkedIn Member ID...

📋 Method 1: Checking URLs for miniProfileUrn...
  ✅ Found: ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A

📊 RESULTS
===========

✅ Found 1 unique member ID(s):
   1. ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A (PRIMARY)

🎯 PRIMARY MEMBER ID: ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A

🔗 Connection URL: https://www.linkedin.com/in/ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A
```

### Return Value

The script returns an object with:
- `memberId`: The primary member ID (string)
- `allMemberIds`: Array of all found member IDs
- `connectionUrl`: Full connection URL using the member ID
- `sources`: Array showing where the ID was found
- `extractFromUrl(url)`: Helper function to extract ID from any URL
- `buildConnectionUrl(memberId)`: Helper to build connection URL

### Usage in Code

After running the script, you can use the returned object:
```javascript
const result = /* run the script */;
console.log(result.memberId); // "ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A"
console.log(result.connectionUrl); // "https://www.linkedin.com/in/ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A"

// Extract from another URL
const id = result.extractFromUrl('https://www.linkedin.com/in/someone?miniProfileUrn=urn:li:fsd_profile:ACoAAAP1W3oBGtWtv2cjCXDi0loN6FDm2k21q2A');
```

---

## Generate Connection Search URLs Script

To **automatically generate 10 connection search URLs** for any LinkedIn profile and copy them to clipboard for Google Sheets:

### How to Use

1. Navigate to any LinkedIn profile page
2. Open DevTools Console (F12)
3. Copy and paste the entire contents of `generate-connection-urls.js` into the console
4. Press Enter
5. The URLs will be automatically copied to your clipboard!
6. Paste directly into Google Sheets (they're formatted as tab-separated values)

### What It Does

1. ✅ Extracts the member ID from the profile page
2. ✅ Gets the person's name
3. ✅ Generates 10 connection search URLs for these titles:
   - Financial Advisor
   - Wealth Manager
   - Financial Planner
   - Investment Advisor
   - Wealth Advisor
   - Portfolio Manager
   - Financial Consultant
   - Principal
   - Owner
   - Partner
4. ✅ Formats as tab-separated (Name \t Title \t URL) for Google Sheets
5. ✅ Auto-copies to clipboard

### Output Format

The script generates URLs in this format:
```
Name	Title	URL
Nicole Owens	Financial Advisor	https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&connectionOf=%5B%22ACoAADlJNTUBZxHXNmaW5eGn1sMVxqom6OLypP8%22%5D&title=%22Financial%20Advisor%22
Nicole Owens	Wealth Manager	https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&connectionOf=%5B%22ACoAADlJNTUBZxHXNmaW5eGn1sMVxqom6OLypP8%22%5D&title=%22Wealth%20Manager%22
...
```

### Example Usage

1. Visit `https://www.linkedin.com/in/nicole-owens-xyz`
2. Run the script
3. Open Google Sheets
4. Paste (Cmd+V / Ctrl+V)
5. You'll get 10 rows with connection search URLs ready to use!

The URLs are formatted to search for connections of that person with each specific title filter.

