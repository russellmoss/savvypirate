# LinkedIn Profile Structure for Scraping

## Overview

This document describes the critical structure of LinkedIn search result profiles as they relate to scraping names, locations, job titles, and company information. Use this guide when building scraping code to ensure clean and correct data extraction.

---

## Critical Architecture Principles

### 1. **LinkedIn Uses Dynamic UI - Always Use Fallback Selectors**

LinkedIn frequently changes their DOM structure, class names, and data attributes. **Never rely on a single selector.** Always implement a fallback chain that tries multiple strategies in order of reliability.

**Example Pattern:**
```javascript
// ❌ BAD: Single selector (will break when LinkedIn updates)
const name = document.querySelector('.entity-result__title-text a').innerText;

// ✅ GOOD: Fallback chain (resilient to changes)
const nameSelectors = [
    'a[data-view-name="search-result-lockup-title"]',  // Most reliable (data attributes)
    '.entity-result__title-text a',                      // Fallback 1
    'span.entity-result__title-line a',                  // Fallback 2
    'a[href^="https://www.linkedin.com/in/"]'           // Last resort
];
```

---

## Profile Card Container Structure

### Finding Profile Cards

Profile cards are the root containers that hold all profile information. Use multiple strategies:

**Selector Priority:**
1. `div[data-view-name="people-search-result"]` - **Most reliable** (data attributes are stable)
2. `li.reusable-search__result-container` - Reusable search container
3. `.search-result__wrapper` - Generic wrapper
4. `.entity-result__item` - Entity result container
5. `li:has(a[href*="/in/"])` - Last resort (any list item with profile link)

**Critical Note:** Always query for ALL cards first, then iterate through each card to extract individual fields. Never try to extract all names/locations at once from the document root.

---

## Name Extraction

### Structure

Names appear as clickable links within profile cards. The name link contains:
- **Text content**: The person's full name (may include accreditations)
- **href attribute**: The LinkedIn profile URL

### Selectors (in priority order):

1. `a[data-view-name="search-result-lockup-title"]` - **Primary** (modern LinkedIn)
2. `.entity-result__title-text a` - Entity result title
3. `span.entity-result__title-line a` - Title line link
4. `a[href*="/in/"][href*="/?originalSubdomain"]` - Profile link pattern
5. `a[href^="https://www.linkedin.com/in/"]` - Last resort (any profile link)

### Critical Parsing Rules:

#### 1. **Name May Contain Accreditations**

Names often include accreditations separated by commas:
- `"James Weaver, CWS®"`
- `"Marcus Fair Jr, CFP®, QPFC"`
- `"Chris Hardy, CFP®, EA, AIF®, ChFC®, CLU®, NTPI Fellow"`

**Extraction Logic:**
- Split by comma
- First part = clean name (may include Jr, Sr, II, III, IV suffixes)
- Remaining parts = accreditations (CFP®, CWS®, etc.)
- Handle name suffixes (Jr, Sr, II, III, IV) - these stay with the name, not as accreditations

#### 2. **Name May Contain Parenthetical Information**

Some names include parenthetical text that should be removed:
- `"John Smith (CEO)"` → `"John Smith"`
- Use regex: `text.replace(/\s*\(.*?\)\s*/g, ' ')`

#### 3. **URL Cleaning**

LinkedIn URLs often include query parameters and tracking:
- Raw: `https://www.linkedin.com/in/jamesweaver/?originalSubdomain=us&...`
- Clean: `https://www.linkedin.com/in/jamesweaver`

**Always strip query parameters:**
```javascript
let url = nameAnchor.href || "";
if (url.includes('?')) url = url.split('?')[0];
```

---

## Job Title Extraction

### Structure

Job titles appear as subtitle text within profile cards, typically in the second `<p>` tag or a subtitle class.

### Selectors (in priority order):

1. `.entity-result__primary-subtitle` - **Primary** (most common)
2. `.entity-result__subtitle` - Generic subtitle
3. `.search-result__subtitle` - Search result subtitle
4. `p:nth-of-type(2)` - Second paragraph tag (common pattern)
5. `.subline` - Generic subtitle class

### Critical Notes:

- **Job title is NOT always the company name** - it's the person's role/title
- Job title may be empty for some profiles
- Job title may contain multiple lines (use `.innerText` not `.textContent` to preserve line breaks if needed)
- Always trim whitespace: `.trim()`

### Company Information

**Important:** The company name is typically **embedded within the job title text**, not in a separate field. Common patterns:
- `"Financial Advisor at ABC Company"`
- `"Senior Manager | XYZ Corp"`
- `"VP of Sales - Company Name"`

You may need to parse the job title string to extract company separately if required.

---

## Location Extraction

### Structure

Location appears as secondary subtitle text, typically in the third `<p>` tag or a secondary subtitle class.

### Selectors (in priority order):

1. `.entity-result__secondary-subtitle` - **Primary** (most common)
2. `.search-result__metadata` - Search result metadata
3. `p:nth-of-type(3)` - Third paragraph tag (common pattern)
4. `.search-result__location` - Location-specific class

### Critical Notes:

- Location format varies: `"New York, NY"`, `"San Francisco Bay Area"`, `"United States"`
- Location may be empty for some profiles
- Location is NOT always in a separate field - sometimes it's combined with other metadata
- Always trim whitespace: `.trim()`

---

## Complete Extraction Flow

### Step-by-Step Process:

1. **Find all profile cards** using fallback selectors
2. **For each card:**
   - Extract name link (with fallbacks)
   - Parse name to separate clean name from accreditations
   - Clean LinkedIn URL (remove query params)
   - Extract job title (with fallbacks)
   - Extract location (with fallbacks)
   - Validate: Must have at least name and URL to save

### Validation Rules:

- **Required fields:** Name AND LinkedIn URL (both must exist)
- **Optional fields:** Title, Location (can be empty strings)
- **Skip profiles** where name or URL is missing

---

## Data Structure Output

### Expected Row Format:

```
[Date, Name, Title, Location, Connection Source, LinkedIn URL, Accr1, Accr2, Accr3, Accr4, Accr5, Accr6]
```

### Column Details:

- **Date**: ISO format (YYYY-MM-DD)
- **Name**: Clean name without accreditations (e.g., "James Weaver")
- **Title**: Job title (e.g., "Financial Advisor at ABC Company")
- **Location**: Geographic location (e.g., "New York, NY")
- **Connection Source**: Source person/competitor name (from input sheet)
- **LinkedIn URL**: Clean URL without query params
- **Accr1-6**: Up to 6 accreditations (e.g., "CWS®", "CFP®", "EA")

---

## Critical Edge Cases

### 1. **Missing Fields**

- Some profiles may not have a job title → Use empty string `""`
- Some profiles may not have a location → Use empty string `""`
- **Never skip a profile** just because title/location is missing (if name and URL exist)

### 2. **LinkedIn Security Checkpoints**

Before scraping, check for security warnings:
- `[data-test-id="security-challenge"]`
- `.challenge-dialog`
- Text containing "unusual activity" or "verification required"

**If detected:** Stop scraping immediately and notify user.

### 3. **Lazy Loading**

LinkedIn uses lazy loading for search results. Always:
- Scroll to bottom of page to trigger loading
- Wait for entries to stabilize (count doesn't change for 1-2 seconds)
- Re-check after delays to catch late-loading content

### 4. **Pagination**

- Each page typically has 10 results
- Use `button[aria-label="Next"]` or `button[data-testid="pagination-controls-next-button-visible"]` to navigate
- Always wait for page to fully load before scraping

---

## Best Practices for Robust Scraping

### 1. **Always Use Fallback Chains**

Never rely on a single selector. Implement a function that tries selectors in order:

```javascript
function querySelectorWithFallbacks(rootElement, selectorKey, selectors) {
    for (const selector of selectors) {
        try {
            const result = rootElement.querySelector(selector);
            if (result) {
                return result; // Success!
            }
        } catch (error) {
            // Invalid selector, try next
            continue;
        }
    }
    return null; // All failed
}
```

### 2. **Log Selector Failures**

Track which selectors work and which fail. This helps identify when LinkedIn changes their UI:
- Log successful selector for each field
- Log failures with diagnostic information
- Store statistics for future reference

### 3. **Handle Empty Results Gracefully**

- If no profile cards found → Return empty array (don't crash)
- If name/location missing → Use empty string (don't use null/undefined)
- Always validate before adding to results array

### 4. **Clean Data Immediately**

- Trim whitespace on all text fields
- Remove query parameters from URLs
- Parse accreditations from names
- Normalize empty values to empty strings (not null/undefined)

### 5. **Error Handling**

Wrap each card extraction in try-catch:
```javascript
cards.forEach((card) => {
    try {
        // Extract data...
    } catch (e) {
        console.warn('Parse error for card:', e);
        // Skip this card, continue with next
    }
});
```

---

## Example Extraction Code Pattern

```javascript
function scrapeCurrentPage(defaultSource) {
    const rows = [];
    
    // 1. Find all profile cards (with fallbacks)
    const cards = findProfileCards(); // Uses fallback selectors
    
    if (cards.length === 0) {
        return rows; // No cards found
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 2. Extract from each card
    cards.forEach((card) => {
        try {
            // Name (with fallbacks)
            const nameAnchor = querySelectorWithFallbacks(card, nameSelectors);
            if (!nameAnchor) return; // Skip if no name
            
            const fullName = nameAnchor.innerText.trim();
            let url = nameAnchor.href || "";
            if (url.includes('?')) url = url.split('?')[0];
            
            // Parse name and accreditations
            const { cleanName, accreditations } = parseNameWithAccreditations(fullName);
            
            // Title (with fallbacks)
            const titleElement = querySelectorWithFallbacks(card, titleSelectors);
            const title = titleElement ? titleElement.innerText.trim() : "";
            
            // Location (with fallbacks)
            const locationElement = querySelectorWithFallbacks(card, locationSelectors);
            const location = locationElement ? locationElement.innerText.trim() : "";
            
            // Connection source
            const connectionSource = defaultSource || "N/A";
            
            // Validate and add
            if (cleanName && url) {
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
            console.warn('Parse error:', e);
            // Continue with next card
        }
    });
    
    return rows;
}
```

---

## Summary: Critical Things to Remember

1. ✅ **Always use fallback selectors** - LinkedIn changes UI frequently
2. ✅ **Parse names carefully** - Accreditations and suffixes need special handling
3. ✅ **Clean URLs** - Remove query parameters
4. ✅ **Handle missing fields** - Use empty strings, don't skip profiles
5. ✅ **Validate before saving** - Must have name AND URL
6. ✅ **Check for security warnings** - Stop if LinkedIn checkpoint detected
7. ✅ **Wait for lazy loading** - Scroll and wait for content to load
8. ✅ **Log failures** - Track which selectors work/fail for debugging
9. ✅ **Extract from card context** - Always search within each card, not document root
10. ✅ **Error handling** - Wrap each card extraction in try-catch

---

## Selector Reliability Hierarchy

**Most Reliable → Least Reliable:**

1. **Data attributes** (`data-view-name`, `data-test-id`) - Most stable
2. **Semantic class names** (`.entity-result__*`) - LinkedIn's internal classes
3. **Generic class names** (`.search-result__*`) - May change
4. **Tag + position** (`p:nth-of-type(2)`) - Fragile, but sometimes only option
5. **Href patterns** (`a[href*="/in/"]`) - Last resort

**Always prioritize data attributes when available.**

