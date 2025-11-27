# Setup Instructions

## Initial Configuration

Before using this extension, you need to configure your Google OAuth credentials.

### Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Select "Chrome Extension"
6. You'll need your Extension ID (get it after loading the extension in Chrome)

### Step 2: Configure the Extension

1. **Copy the example files:**
   ```bash
   cp manifest.json.example manifest.json
   cp oauth-config.json.example oauth-config.json
   ```

2. **Get your Extension ID:**
   - Load the extension in Chrome (`chrome://extensions`)
   - Enable "Developer mode"
   - Click "Load unpacked" and select this folder
   - Copy the Extension ID

3. **Add Extension ID to Google Cloud:**
   - Go back to Google Cloud Console
   - Paste your Extension ID into the OAuth credentials setup
   - Copy the Client ID that Google generates

4. **Update manifest.json:**
   - Open `manifest.json`
   - Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID

5. **Update oauth-config.json (optional):**
   - Open `oauth-config.json`
   - Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
   - Replace `your-project-id` with your Google Cloud project ID

### Step 3: Add Test User (CRITICAL)

1. Go to "OAuth consent screen" in Google Cloud Console
2. Scroll down to "Test users" section
3. Click "+ ADD USERS"
4. Enter YOUR Google Account email address
5. Click "Save"

**⚠️ IMPORTANT:** If you skip this step, ALL API calls will fail with "403 Forbidden" even with valid tokens!

### Step 4: Reload Extension

- Go to `chrome://extensions`
- Click the refresh icon on the extension
- The extension should now be ready to use

## File Security

The following files contain sensitive information and are ignored by git:
- `oauth-config.json` - Contains your OAuth credentials
- `manifest.json` - Contains your OAuth client_id (optional - can be committed for Chrome extensions)

**Never commit these files to a public repository!**

Use the `.example` files as templates instead.

