# Test doGet Workaround

Since `doPost` is having issues with form data, I've added a `doGet` function that works with query parameters.

## Test with Browser or PowerShell

### PowerShell:
```powershell
# Test Janitor AI
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content

# Test BigQuery Enrichment
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzY_ns107DdZvO7i4lE7YugTtxmedDAIYdl3KStUsCU4L8bWWOfr8TFklnXAwFIZgjRgQ/exec?action=enrichTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content
```

### Browser:
Just paste this URL in your browser:
```
https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=new_leads_11_30_25
```

## Why This Works

- `doGet` uses query parameters (URL parameters) instead of POST body
- Apps Script handles GET requests more reliably
- `doGet` internally calls `doPost` with a mock event, so all the same logic runs
- No form data parsing issues

## Next Steps

1. Test `doGet` - it should work immediately
2. If `doGet` works, we can either:
   - Use `doGet` permanently (simpler, but less RESTful)
   - Fix `doPost` by switching to JSON format (might have CORS issues)
   - Investigate why Apps Script is auto-parsing form data as JSON

