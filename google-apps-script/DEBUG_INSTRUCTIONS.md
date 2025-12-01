# Debug Instructions - Apps Script Web App Logs

## The Problem
- Test function works perfectly ✅
- HTTP requests fail with JSON parsing error ❌
- No logs visible in Executions tab for HTTP requests ❌

## Critical Steps to Debug

### 1. Check Google Cloud Console Logs

Web App execution logs might not appear in the Apps Script Executions tab. Check Cloud Console instead:

1. Go to: https://console.cloud.google.com/logs
2. Select your Google Cloud project (same one as your Apps Script)
3. In the Logs Explorer, filter by:
   - Resource type: `gce_instance` or `cloud_function`
   - Or search for: `[WebApp]` or `doPost`
4. Look for logs from your failed HTTP requests

### 2. Verify Web App Deployment

**CRITICAL:** Make sure you're using the LATEST deployment:

1. In Apps Script editor: **Deploy → Manage Deployments**
2. Check the version number of your active deployment
3. If you made code changes, you MUST:
   - Click **Edit** (pencil icon) on the deployment
   - Click **New Version**
   - Click **Deploy**
   - Copy the NEW URL (it might be the same, but version number changes)

### 3. Check Web App Settings

1. **Deploy → Manage Deployments → Edit**
2. Verify:
   - **Execute as:** Me (your account)
   - **Who has access:** Anyone (or "Anyone with Google account")
3. If it's set to "Only myself", external requests will fail

### 4. Test with Updated Code

After copying the latest code with enhanced logging:

1. **Save** the script (Ctrl+S)
2. **Deploy → Manage Deployments → Edit → New Version → Deploy**
3. Run the PowerShell test again:
   ```powershell
   Invoke-WebRequest -Uri "YOUR_WEB_APP_URL" -Method POST -Body "action=cleanTab&tabName=test_tab" -ContentType "application/x-www-form-urlencoded" | Select-Object -ExpandProperty Content
   ```
4. Check Cloud Console logs (step 1) for `[WebApp]` entries

### 5. Alternative: Use doGet for Testing

If doPost continues to fail, we can temporarily use doGet with query parameters:

```javascript
function doGet(e) {
  // For testing only - convert GET to POST-like behavior
  const action = e.parameter.action;
  const tabName = e.parameter.tabName;
  
  // Call the same logic as doPost
  const mockPost = {
    postData: {
      contents: `action=${action}&tabName=${tabName}`,
      type: 'application/x-www-form-urlencoded'
    },
    parameter: e.parameter
  };
  
  return doPost(mockPost);
}
```

Then test with:
```
https://script.google.com/macros/s/YOUR_ID/exec?action=cleanTab&tabName=test_tab
```

## What to Look For in Logs

When you find the logs (Cloud Console or Executions), look for:

1. **`[WebApp] ========== doPost CALLED ==========`** - Confirms doPost was called
2. **`[WebApp] e.postData.contents`** - Shows what data was received
3. **`[WebApp] ✅ Detected form data format`** - Confirms form data was detected
4. **Any error messages** - Shows where it failed

## If Still No Logs Appear

If you still see no logs after checking Cloud Console:

1. The error might be happening BEFORE doPost is called
2. Apps Script might be trying to auto-parse JSON and failing
3. Try the doGet workaround above
4. Or we may need to switch to sending JSON instead of form data (but this might cause CORS issues)

## Next Steps

1. Check Cloud Console logs first
2. Verify deployment is latest version
3. Run test again
4. Share what you find in the logs

