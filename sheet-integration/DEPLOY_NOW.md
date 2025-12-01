# 🚨 CRITICAL: Deploy doGet Function NOW

## The Problem
- `doGet` function exists in your code ✅
- But it's **NOT deployed** to Apps Script ❌
- That's why you get "Script function not found: doGet"

## Quick Fix - Deploy in 3 Steps

### Step 1: Copy Updated Code to Apps Script

1. Open your Google Sheet
2. **Extensions → Apps Script**
3. Open `janitor-ai.gs` (or whatever file has doPost)
4. **Select ALL** (Ctrl+A)
5. **Copy** the entire `janitor-ai.gs` file from `google-apps-script/janitor-ai.gs`
6. **Paste** into Apps Script (replace everything)
7. Do the same for `enricher.gs`

### Step 2: Save
- **Ctrl+S** or click Save

### Step 3: Deploy (CRITICAL!)
1. **Deploy → Manage Deployments**
2. Click **Edit** (pencil icon) on your existing deployment
3. Click **"New Version"** (this is REQUIRED - just saving isn't enough!)
4. Click **"Deploy"**
5. Copy the deployment URL (should be the same)

## Verify Deployment

After deploying, test immediately:

```powershell
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=new_leads_11_30_25" | Select-Object -ExpandProperty Content
```

You should get JSON response, not "Script function not found".

## Why This Will Work

- ✅ Local tests prove `doGet` works perfectly
- ✅ Parsing logic is correct
- ✅ GET requests avoid Apps Script's auto-JSON parsing issue
- ✅ Just needs to be deployed!

