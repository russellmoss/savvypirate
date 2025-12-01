# Quick Deploy Checklist

## ✅ Pre-Deployment Checklist

- [ ] `doGet` function exists in `janitor-ai.gs` (line 652)
- [ ] `doGet` function exists in `enricher.gs` (line 617)
- [ ] Both files are saved locally

## 🚀 Deployment Steps

### For Morgan Cirotto's Workbook:

1. **Open Google Sheet** (Morgan Cirotto's workbook)
2. **Extensions → Apps Script**
3. **Open `janitor-ai.gs`** (or the file with doPost)
4. **Copy entire file** from `google-apps-script/janitor-ai.gs`
5. **Paste** into Apps Script (replace all)
6. **Save** (Ctrl+S)
7. **Deploy → Manage Deployments**
8. **Edit** (pencil icon)
9. **New Version** (IMPORTANT!)
10. **Deploy**
11. **Test**: 
    ```powershell
    Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=test" | Select-Object -ExpandProperty Content
    ```

### For Taylor Etoch's Workbook:

Repeat steps 1-10 above, but use `enricher.gs` and test with:
```powershell
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzY_ns107DdZvO7i4lE7YugTtxmedDAIYdl3KStUsCU4L8bWWOfr8TFklnXAwFIZgjRgQ/exec?action=enrichTab&tabName=test" | Select-Object -ExpandProperty Content
```

## ✅ Post-Deployment Verification

- [ ] GET request returns JSON (not "function not found")
- [ ] Response has `"success": true` or clear error message
- [ ] Chrome extension can call it (after reloading extension)

## 🔄 If Still Failing

1. Check Apps Script execution logs
2. Verify `doGet` function is visible in Apps Script editor
3. Make sure you created a **NEW VERSION** (not just saved)
4. Try the test command above

