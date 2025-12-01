# Rapid Testing Guide for Apps Script Web App

This guide provides multiple ways to test your Apps Script Web App without running the full pipeline.

## Method 1: Apps Script Editor (Fastest)

1. Open your Google Sheet → **Extensions → Apps Script**
2. In the function dropdown, select one of these test functions:
   - `testDoPostFormData()` - Tests form data format (what Chrome extension sends)
   - `testDoPostJSON()` - Tests JSON format (backward compatibility)
   - `testDoPostWithRealTab()` - Tests with an actual tab (edit tab name first!)
   - `runAllTests()` - Runs all tests
3. Click **Run** (▶️)
4. View logs: **View → Logs** (or press `Ctrl+Enter` / `Cmd+Enter`)

**To test with a real tab:**
1. Edit `testDoPostWithRealTab()` function
2. Change `realTabName` to an actual tab name in your spreadsheet
3. Run the function

## Method 2: HTML Test Page (Browser)

1. Open `test-web-app.html` in your browser (double-click the file)
2. Paste your Web App URL
3. Select action (cleanTab or enrichTab)
4. Enter a tab name
5. Click "Test Web App"
6. See results immediately

**Benefits:**
- Visual interface
- See full request/response
- Copy cURL command for terminal testing
- Saves your Web App URL

## Method 3: Terminal (cURL)

### Quick Test Command

Replace these values:
- `YOUR_WEB_APP_URL` - Your Web App URL ending in `/exec`
- `TAB_NAME` - A tab name that exists in your spreadsheet

```bash
# Test Janitor AI (cleanTab)
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=cleanTab&tabName=TAB_NAME"

# Test BigQuery Enrichment (enrichTab)
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=enrichTab&tabName=TAB_NAME"
```

### Example with Real Values

```bash
# Morgan Cirotto's Web App - Janitor AI
curl -X POST "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=cleanTab&tabName=new_leads_11_30_25"

# Taylor Etoch's Web App - BigQuery Enrichment
curl -X POST "https://script.google.com/macros/s/AKfycbzY_ns107DdZvO7i4lE7YugTtxmedDAIYdl3KStUsCU4L8bWWOfr8TFklnXAwFIZgjRgQ/exec" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=enrichTab&tabName=new_leads_11_30_25"
```

### View Response

The response will be JSON. To format it nicely:

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=cleanTab&tabName=TAB_NAME" | jq .
```

(Requires `jq` installed: `brew install jq` on Mac, or `choco install jq` on Windows)

## Method 4: Google Sheets Custom Menu (Quick Access)

Add this function to your Apps Script to create a custom menu:

```javascript
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧪 Test Web App')
    .addItem('Test Janitor AI', 'testJanitorFromMenu')
    .addItem('Test BigQuery Enrichment', 'testEnrichmentFromMenu')
    .addToUi();
}

function testJanitorFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Test Janitor AI', 'Enter tab name:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const tabName = response.getResponseText();
    const mockEvent = {
      postData: {
        contents: `action=cleanTab&tabName=${encodeURIComponent(tabName)}`,
        type: 'application/x-www-form-urlencoded'
      },
      parameter: {}
    };
    
    try {
      const result = doPost(mockEvent);
      const json = JSON.parse(result.getContent());
      ui.alert('Result', json.success ? `✅ Success: ${json.message}` : `❌ Error: ${json.error}`, ui.ButtonSet.OK);
    } catch (error) {
      ui.alert('Error', error.toString(), ui.ButtonSet.OK);
    }
  }
}

function testEnrichmentFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Test BigQuery Enrichment', 'Enter tab name:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const tabName = response.getResponseText();
    const mockEvent = {
      postData: {
        contents: `action=enrichTab&tabName=${encodeURIComponent(tabName)}`,
        type: 'application/x-www-form-urlencoded'
      },
      parameter: {}
    };
    
    try {
      const result = doPost(mockEvent);
      const json = JSON.parse(result.getContent());
      ui.alert('Result', json.success ? `✅ Success: ${json.message}` : `❌ Error: ${json.error}`, ui.ButtonSet.OK);
    } catch (error) {
      ui.alert('Error', error.toString(), ui.ButtonSet.OK);
    }
  }
}
```

After adding this, refresh your Google Sheet and you'll see a "🧪 Test Web App" menu with quick test options.

## Troubleshooting

### "No logs available"
- Wait a few seconds and refresh
- Check **View → Logs** in Apps Script editor
- Make sure you're looking at the correct execution

### "CORS error" in browser test
- Make sure Web App is deployed with "Anyone" access
- Check that URL ends with `/exec`
- Try redeploying the Web App

### "Tab not found" error
- Make sure the tab name exactly matches (case-sensitive)
- Check that the tab exists in the spreadsheet
- Try with a simple tab name like "Sheet1" first

### Still getting JSON parse errors?
1. Check Apps Script execution logs (Method 1)
2. Look for `[WebApp]` log entries
3. Share the logs to see what data format is being received

## Recommended Workflow

1. **Start with Method 1** (Apps Script Editor) - fastest iteration
2. **Use Method 2** (HTML page) - for visual testing and debugging
3. **Use Method 3** (cURL) - for automated testing or CI/CD
4. **Add Method 4** (Custom Menu) - for quick testing from Google Sheets

## Quick Debug Checklist

- [ ] Web App URL is correct (ends with `/exec`)
- [ ] Tab name exists in spreadsheet
- [ ] Web App is deployed (not just saved)
- [ ] Web App access is set to "Anyone" or "Anyone with Google account"
- [ ] Latest code is deployed (check version number)
- [ ] Check Apps Script execution logs for `[WebApp]` entries

