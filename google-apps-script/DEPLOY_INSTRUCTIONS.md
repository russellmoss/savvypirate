# Deployment Instructions

## Critical: You MUST Create a New Deployment Version

After making code changes, Apps Script requires you to create a **NEW VERSION** of your deployment.

## Step-by-Step Deployment

1. **Save your script** (Ctrl+S or Cmd+S)

2. **Deploy → Manage Deployments**

3. **Click the pencil icon (Edit)** on your existing deployment

4. **Click "New Version"** 
   - This is CRITICAL - just saving isn't enough!
   - The version number should increment (e.g., Version 1 → Version 2)

5. **Click "Deploy"**

6. **Copy the deployment URL** (it should be the same, but now points to the new version)

## Verify Deployment

After deploying, test immediately:

### Test doGet (should work after deployment):
```
https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec?action=cleanTab&tabName=new_leads_11_30_25
```

### Test doPost (may still have issues):
```powershell
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzPbB8Ikl5RLsB5nuca5MEhs5Ny_G2WirtCB6oz_x3Y8qQIJFaZMU0EKWIY5dF5zW6aQA/exec" -Method POST -Body "action=cleanTab&tabName=new_leads_11_30_25" -ContentType "application/x-www-form-urlencoded" | Select-Object -ExpandProperty Content
```

## Common Mistakes

❌ **Just saving the script** - This doesn't update the deployed version
❌ **Editing deployment without creating new version** - Changes won't be active
✅ **Creating new version** - This is the ONLY way to update a deployed Web App

## If doGet Still Doesn't Work

1. Check that `doGet` function exists in your script
2. Verify you created a NEW version (not just edited)
3. Check the deployment is set to execute as "Me"
4. Check access is set to "Anyone" or "Anyone with Google account"

