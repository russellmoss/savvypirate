# Verify Deployment Checklist

## ✅ Code is Correct
- `janitor-ai.gs` has `doGet` function (line 652) ✅
- `janitor-ai.gs` has `doPost` function (line 388) ✅
- `cleanTab` action handler exists (line 569) ✅

## 🔍 Verify Deployment

### Step 1: Check Files in Apps Script
1. Open Morgan's Google Sheet
2. **Extensions → Apps Script**
3. Look at left sidebar - you should see:
   - `janitor-ai.gs` ✅
   - `enricher.gs` (or similar) ✅

### Step 2: Verify doGet Function Exists
1. In Apps Script editor, open `janitor-ai.gs`
2. Press **Ctrl+F** and search for: `function doGet`
3. You should find it around line 652
4. If NOT found, the file wasn't copied correctly

### Step 3: Check Deployment Version
1. **Deploy → Manage Deployments**
2. Look at the deployment - what version number is it?
3. If it says "Version 1", you need to create "Version 2"
4. Click **Edit** → **New Version** → **Deploy**

### Step 4: Test with Correct URL
Make sure you're testing the URL that matches the deployment:
```powershell
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content
```

## Common Issues

### Issue 1: "Unknown action: cleanTab"
**Cause:** `janitor-ai.gs` not in Apps Script project, or wrong file deployed
**Fix:** 
- Verify `janitor-ai.gs` exists in Apps Script editor
- Check that `doGet` function is in the file
- Create new deployment version

### Issue 2: "Script function not found: doGet"
**Cause:** `doGet` function doesn't exist or wasn't saved
**Fix:**
- Search for `function doGet` in Apps Script editor
- If not found, copy the entire `janitor-ai.gs` file again
- Save and create new deployment version

### Issue 3: Still getting JSON parsing error
**Cause:** Old deployment still active, or testing wrong URL
**Fix:**
- Make sure you created a **NEW VERSION** (not just saved)
- Verify the deployment URL matches what you're testing
- Use GET requests (already updated in Chrome extension)

## Quick Test Commands

### Test 1: Check if doGet exists
```powershell
# Should return JSON (not "function not found")
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec" | Select-Object -ExpandProperty Content
```
Expected: `{"success":false,"error":"Missing required parameters..."}`

### Test 2: Test cleanTab action
```powershell
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content
```
Expected: `{"success":true,"message":"Cleaned..."}` or `{"success":false,"error":"Tab not found"}`

### Test 3: Test enrichTab action (should work if enricher.gs is deployed)
```powershell
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=enrichTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content
```

