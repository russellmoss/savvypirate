# Google Apps Script Agentic Development Setup

This folder contains the local development environment for testing Google Apps Script code before deploying.

## Setup Complete ✅

- ✅ Directory created: `sheet-integration/`
- ✅ npm initialized
- ✅ Google Apps Script type definitions installed
- ✅ Mock data environment created
- ✅ Test runner created

## Next Steps

### 1. Clone Your Apps Script Project

You need to clone the Apps Script project. You have two options:

**Option A: Clone by Script ID** (if you know the script ID)
```powershell
cd sheet-integration
clasp clone "YOUR_SCRIPT_ID_HERE"
```

**Option B: Clone by Web App URL** (if you only have the Web App URL)
1. Open your Google Sheet
2. Extensions → Apps Script
3. File → Project Settings
4. Copy the "Script ID"
5. Run: `clasp clone "SCRIPT_ID"`

### 2. Extract doPost/doGet Functions

After cloning, you'll have `.gs` files. We need to extract the `doPost` and `doGet` functions for local testing.

Create a file `janitor-doPost.js` and copy the `doPost` function from `janitor-ai.gs`.

### 3. Run Local Tests

```powershell
node test-doPost.js
```

## File Structure

```
sheet-integration/
├── package.json              # npm config with type definitions
├── mock-data.js              # Mock Google Apps Script APIs
├── test-doPost.js            # Test runner for doPost/doGet
├── README.md                 # This file
└── [cloned files from clasp] # Your actual Apps Script code
```

## How to Use Agentically

Once set up, you can tell Cursor:

1. **"Test the doPost function with form data"**
   - Cursor will run `node test-doPost.js`
   - See if parsing works
   - Fix any issues
   - Re-test

2. **"Fix the JSON parsing error in doPost"**
   - Cursor will modify the function
   - Test locally
   - Iterate until it works
   - Then you push to Google

3. **"Add error handling to doGet"**
   - Write code
   - Test locally
   - Deploy when ready

## Benefits

- ✅ Test without deploying to Google
- ✅ Faster iteration (no deployment delay)
- ✅ See console logs immediately
- ✅ Debug with Node.js debugger
- ✅ Version control with git

## Current Issue to Fix

The `doPost` function is failing with:
```
"Unexpected token 'a', "action=cle"... is not valid JSON"
```

This suggests Apps Script is trying to auto-parse form data as JSON. We need to:
1. Test locally to reproduce the issue
2. Fix the parsing logic
3. Verify it works
4. Deploy to Google

