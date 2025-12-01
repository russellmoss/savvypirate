# Quick Test Guide - PowerShell

Since you're on Windows PowerShell, use these commands:

## Method 1: PowerShell Script (Easiest)

```powershell
# Test Janitor AI
.\test-powershell.ps1 -WebAppUrl "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec" -Action "cleanTab" -TabName "new_leads_11_30_25"

# Test BigQuery Enrichment
.\test-powershell.ps1 -WebAppUrl "https://script.google.com/macros/s/AKfycbzY_ns107DdZvO7i4lE7YugTtxmedDAIYdl3KStUsCU4L8bWWOfr8TFklnXAwFIZgjRgQ/exec" -Action "enrichTab" -TabName "new_leads_11_30_25"
```

## Method 2: PowerShell One-Liner

```powershell
# Test Janitor AI
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec" -Method POST -Body "action=cleanTab&tabName=new_leads_11_30_25" -ContentType "application/x-www-form-urlencoded" | Select-Object -ExpandProperty Content

# Test BigQuery Enrichment  
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzY_ns107DdZvO7i4lE7YugTtxmedDAIYdl3KStUsCU4L8bWWOfr8TFklnXAwFIZgjRgQ/exec" -Method POST -Body "action=enrichTab&tabName=new_leads_11_30_25" -ContentType "application/x-www-form-urlencoded" | Select-Object -ExpandProperty Content
```

## Method 3: Apps Script Editor (Still Best for Debugging)

1. Open Google Sheet → Extensions → Apps Script
2. Select `testDoPostFormData()` from function dropdown
3. Click Run (▶️)
4. View → Logs to see detailed output

This is still the fastest way to iterate and see what's happening!

