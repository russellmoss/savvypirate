# Fix: Add janitor-ai.gs to Morgan's Workbook

## The Problem
Morgan's workbook Apps Script only has `enricher.gs` deployed, which only supports `enrichTab` action.
You need `janitor-ai.gs` for the `cleanTab` action.

## Solution: Add janitor-ai.gs File

### Step 1: Open Apps Script
1. Open Morgan's Google Sheet: https://docs.google.com/spreadsheets/d/1ks-IMVWfgjLQlbfGwCIhHmZPjyRdz79MB2cxnimDMUw/edit
2. **Extensions → Apps Script**

### Step 2: Check Current Files
Look at the left sidebar - you should see:
- `enricher.gs` (or similar) ✅
- Missing: `janitor-ai.gs` ❌

### Step 3: Add janitor-ai.gs
1. Click **+** (Add file) button in left sidebar
2. Name it: `janitor-ai.gs`
3. Open `google-apps-script/janitor-ai.gs` from your local files
4. **Select ALL** (Ctrl+A) and **Copy**
5. **Paste** into the new `janitor-ai.gs` file in Apps Script
6. **Save** (Ctrl+S)

### Step 4: Deploy
1. **Deploy → Manage Deployments**
2. Click **Edit** (pencil icon) on your deployment
3. Click **"New Version"** (CRITICAL!)
4. Click **"Deploy"**

### Step 5: Test
```powershell
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

## Why This Happens
Each Apps Script project can have multiple `.gs` files. You need BOTH:
- `janitor-ai.gs` → handles `cleanTab` action
- `enricher.gs` → handles `enrichTab` action

Both files can be in the same project, and `doGet`/`doPost` in either file will work.

