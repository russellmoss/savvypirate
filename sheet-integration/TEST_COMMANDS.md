# Test Commands for Deployed Web Apps

## ✅ doGet is Deployed and Working!

The error "Missing required parameters" means `doGet` is being called correctly. Now test with parameters:

## Test Commands

### Morgan Cirotto's Workbook (Janitor AI - cleanTab)

```powershell
# Test Janitor AI
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Cleaned new_leads_11_30_25: X kept, Y removed, Z archived",
  "details": { ... }
}
```

### Taylor Etoch's Workbook (BigQuery Enrichment - enrichTab)

```powershell
# Test BigQuery Enrichment
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzY_ns107DdZvO7i4lE7YugTtxmedDAIYdl3KStUsCU4L8bWWOfr8TFklnXAwFIZgjRgQ/exec?action=enrichTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content
```

## If You Get "Unknown action: cleanTab"

This means you're hitting the wrong Apps Script file. Check:

1. **Which file is in Morgan's workbook?**
   - Open Morgan's Google Sheet
   - Extensions → Apps Script
   - Check which `.gs` files you see
   - If you only see `enricher.gs`, you need to add `janitor-ai.gs`

2. **Do you have both files in the same Apps Script project?**
   - You might need to have BOTH `janitor-ai.gs` AND `enricher.gs` in the same project
   - Or have separate deployments for each

## Quick Fix: Add janitor-ai.gs to Morgan's Workbook

1. Open Morgan's Google Sheet
2. Extensions → Apps Script
3. Click **+** to add a new file
4. Name it `janitor-ai.gs`
5. Copy entire contents from `google-apps-script/janitor-ai.gs`
6. Paste into the new file
7. Save
8. Deploy → Manage Deployments → Edit → New Version → Deploy

## Verify Which Actions Are Available

Test without parameters to see what's supported:
```powershell
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec" | Select-Object -ExpandProperty Content
```

This will show: `"Missing required parameters: action and tabName are required"` or `"Unknown action: X. Supported actions: Y"`

