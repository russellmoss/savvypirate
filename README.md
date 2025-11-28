# Savvy Pirate 🏴‍☠️

A Chrome Extension for scraping LinkedIn search results and exporting data directly to Google Sheets. Perfect for competitive intelligence and sales pipeline monitoring.

## 🎯 What This Extension Does

**Savvy Pirate** helps you monitor your competitors' sales activities by tracking who enters their LinkedIn network. Here's how it works:

1. **Scrape Competitor Connections**: Monitor your competitors' LinkedIn connections based on targeted searches
2. **Weekly Tracking**: Run scrapes every week to capture new connections
3. **Differential Analysis**: Compare weekly results to identify new connections entering their funnel
4. **Target New Leads**: Identify prospects who just connected with your competitors so you can reach out first

### Use Case Example

You're competing with "Taylor Smith" for financial advisor leads. You want to know:
- Who is Taylor connecting with this week?
- Which new Financial Advisors just entered Taylor's network?
- Who can you target before Taylor does?

**Savvy Pirate** automates this entire process, giving you a competitive edge in identifying and reaching new prospects.

---

## ✨ Features

- 🔍 **LinkedIn Scraping**: Automatically extracts profile data from LinkedIn search results
- 📊 **Google Sheets Integration**: Real-time sync to Google Sheets (no CSV downloads needed)
- 🎯 **Smart Navigation**: Auto-advances through multiple searches with progress tracking
- 📝 **Name Parsing**: Automatically extracts accreditations from names (e.g., "James Weaver, CWS®")
- 📑 **Workbook Management**: Organize scrapes by source with automatic dated tabs
- 🔄 **Resilient Sync**: Data saved locally first, syncs when online (survives WiFi drops)
- 🗑️ **Deduplication**: Remove duplicate rows based on Name column with one click
- 🔄 **Tab Comparison**: Compare weekly scrapes to identify new connections (Phase 7)
- 🏴‍☠️ **Pirate Theme**: Dark, stylish UI with black and red color scheme

---

## 📋 Prerequisites

Before installing, make sure you have:

- **Chrome Browser** (latest version recommended)
- **Google Account** (to access Google Sheets)
- **LinkedIn Account** (to access LinkedIn search results)
- **Google Cloud Project** (for OAuth authentication - see setup below)

---

## 🚀 Installation

### Step 1: Get the Extension Files

**Option A: Clone from Repository**
```bash
git clone https://github.com/russellmoss/savvypirate.git
cd savvypirate
```

**Option B: Download ZIP**
- Download the repository as a ZIP file
- Extract to a folder on your computer

### Step 2: Set Up Google Cloud OAuth (Required)

The extension needs Google OAuth credentials to access your Google Sheets. Follow these steps:

#### 2.1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "Savvy Pirate Extension" (or any name)
4. Click "Create"
5. Wait for project creation (30 seconds)

#### 2.2: Enable Required APIs

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for and enable:
   - **Google Sheets API** (click "Enable")
   - **Google Drive API** (click "Enable")

#### 2.3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** (unless you have a Google Workspace)
3. Fill in required fields:
   - **App name**: "Savvy Pirate"
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **"Save and Continue"**
5. **Scopes**: Click **"Add or Remove Scopes"**
   - Add: `https://www.googleapis.com/auth/spreadsheets`
   - Add: `https://www.googleapis.com/auth/drive.file`
   - Click **"Update"** → **"Save and Continue"**
6. **Test users**: Click **"+ ADD USERS"**
   - Enter **YOUR Google account email** (the one you'll use)
   - Click **"Add"** → **"Save and Continue"**
   - Click **"Back to Dashboard"**

> ⚠️ **CRITICAL**: You MUST add yourself as a test user, or authentication will fail!

#### 2.4: Create OAuth Client ID

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, complete OAuth consent screen setup first
4. Select **"Web application"** as application type
5. **Name**: "Savvy Pirate Extension"
6. **Authorized redirect URIs**: Leave empty for now (we'll add this after getting Extension ID)
7. Click **"Create"**
8. **Copy the Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)
   - ⚠️ **Save this** - you'll need it in the next step

#### 2.5: Get Your Extension ID

1. Open Chrome and go to `chrome://extensions`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Navigate to and select the `savvypirate` folder
5. **Copy the Extension ID** (long string like: `abcdefghijklmnopqrstuvwxyz123456`)
   - This appears under the extension name

#### 2.6: Add Redirect URI to OAuth Client

1. Go back to Google Cloud Console → **"Credentials"**
2. Click on your OAuth Client ID to edit
3. Under **"Authorized redirect URIs"**, click **"+ ADD URI"**
4. Enter: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - Replace `YOUR_EXTENSION_ID` with the ID you copied
   - Example: `https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/`
5. Click **"Save"**

#### 2.7: Configure Extension with Client ID

1. In the `savvypirate` folder, find `manifest.json.example`
2. Copy it to `manifest.json`:
   ```bash
   cp manifest.json.example manifest.json
   ```
3. Open `manifest.json` in a text editor
4. Find this line:
   ```json
   "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
   ```
5. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
6. Save the file

### Step 3: Load Extension in Chrome

1. Go to `chrome://extensions`
2. Make sure **"Developer mode"** is enabled
3. If extension is already loaded, click the **refresh icon** (🔄) on the extension card
4. The extension should now appear in your Chrome toolbar

### Step 4: Authenticate with Google

1. Click the **Savvy Pirate** extension icon in your Chrome toolbar
2. The popup will open
3. The extension will automatically prompt you to authenticate
4. Click **"Allow"** when Google asks for permissions
5. Sign in with your Google account
6. Grant access to Google Sheets

✅ **Installation Complete!** You're ready to start scraping.

---

## 📖 How to Use Savvy Pirate

### Overview: The Complete Workflow

1. **Create Input Sheet** → Define your competitor searches
2. **Load Searches** → Import searches into the extension
3. **Set Up Workbooks** → Create workbooks for each competitor
4. **Scrape Data** → Run weekly scrapes
5. **Deduplicate** → Remove duplicate entries
6. **Compare Tabs** → Find new connections from this week

---

### Step 1: Create Your Input Sheet 📥

Create a Google Sheet that defines which competitor connections you want to monitor.

#### Input Sheet Structure

Your Input Sheet must have these columns (in this exact order):

| Column A | Column B | Column C |
|----------|----------|----------|
| **Source Connection** | **Target Job Title** | **LinkedIn Search URL** |

#### Column Details

- **Column A - Source Connection**: The name of the competitor/source person
  - Example: `Taylor Smith`
  - This is the person whose connections you're monitoring

- **Column B - Target Job Title**: The job title you're targeting in the search
  - Example: `Financial Advisor`
  - This filters the connections by job title

- **Column C - LinkedIn Search URL**: The full LinkedIn search URL
  - Example: `https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&connectionOf=%5B%22ACoAAB9mlJwB_wR0Dm7lUJT3mIyIVI4OSrZGCnI%22%5D&title=%22Financial%20Advisor%22`
  - This is the LinkedIn search results page URL

#### How to Get the LinkedIn Search URL

1. Go to LinkedIn.com
2. Click the search bar at the top
3. Select **"People"** from the dropdown
4. Use LinkedIn's filters:
   - **Connections of**: Select your competitor (e.g., "Taylor Smith")
   - **Title**: Enter the job title (e.g., "Financial Advisor")
5. Click **"Show results"**
6. **Copy the entire URL** from your browser's address bar
7. Paste it into Column C of your Input Sheet

#### Example Input Sheet

| Source Connection | Target Job Title | LinkedIn Search URL |
|-------------------|------------------|---------------------|
| Taylor Smith | Financial Advisor | https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&connectionOf=%5B%22ACoAAB9mlJwB_wR0Dm7lUJT3mIyIVI4OSrZGCnI%22%5D&title=%22Financial%20Advisor%22 |
| John Davis | Wealth Manager | https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&connectionOf=%5B%22ACoAAB9mlJwB_xyz123%22%5D&title=%22Wealth%20Manager%22 |
| Sarah Johnson | Financial Planner | https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&connectionOf=%5B%22ACoAAB9mlJwB_abc456%22%5D&title=%22Financial%20Planner%22 |

#### Get Your Input Sheet ID

1. Open your Input Sheet in Google Sheets
2. Look at the URL in your browser:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_IS_THE_ID]/edit
   ```
3. Copy the ID (the long string between `/d/` and `/edit`)
4. You'll need this ID in the next step

---

### Step 2: Load Searches into Extension

1. Click the **Savvy Pirate** extension icon
2. In the **"📥 Input Sheet"** section:
   - Paste your Input Sheet ID
   - Click **"Load"**
3. The extension will read your Input Sheet and display all searches in a list
4. Each search shows:
   - Source Connection name
   - Target Job Title
   - Checkmark when completed

---

### Step 3: Set Up Workbook Manager 📚

The **Workbook Manager** organizes your scrapes by competitor. Each competitor gets their own workbook, and each week gets its own tab.

#### Create a Workbook for Each Competitor

1. In the extension popup, find the **"📚 Workbook Manager"** section
2. Click the **"➕"** button (Add Workbook)
3. Enter:
   - **Google Sheet ID or URL**: 
     - Option A: Create a new sheet, copy the Sheet ID from the URL
     - Option B: Use an existing sheet's ID
   - **Friendly name**: The competitor's name (e.g., "Taylor Smith")
4. Click **"Save"**
5. The workbook appears in the dropdown

#### Activate a Workbook

1. Select the workbook from the **"Saved Workbooks"** dropdown
2. Check the box: **"✓ Use this workbook as active sheet"**
3. The workbook is now active and ready for scraping

> 💡 **Tip**: Create separate workbooks for each competitor you're monitoring. This keeps data organized.

---

### Step 4: Start Scraping 🚀

#### 4.1: Open a Search

1. In the **"📥 Input Sheet"** section, find the search you want to scrape
2. Click **"Open"** next to the search
3. A new LinkedIn tab opens with the search results page
4. Wait for the page to fully load

#### 4.2: Start the Scrape

1. Make sure you're on the LinkedIn search results page
2. Click the **Savvy Pirate** extension icon again
3. Click **"🚀 Start Scraping"**
4. The extension will:
   - Scroll through all results automatically
   - Extract profile data from each result
   - Save data locally first (survives WiFi drops)
   - Sync to Google Sheets in the background

#### 4.3: Monitor Progress

- Watch the **progress bar** at the bottom of the popup
- Check the **status text** for current activity
- The extension shows: "Scraping page X of Y"

#### 4.4: Automatic Tab Creation

When you start scraping:
- The extension automatically creates a tab with today's date
- Format: `MM_DD_YY` (e.g., `11_27_25` for November 27, 2025)
- All scraped data goes to this dated tab
- Next week's scrape creates a new tab (e.g., `12_04_25`)

#### 4.5: Complete the Scrape

- The extension automatically:
  - Checks off the search in the list when complete
  - Shows completion message
  - Syncs all data to Google Sheets
- You can click **"🛑 Stop"** at any time to end early

#### 4.6: Move to Next Search

1. After a scrape completes, click **"Open"** on the next search
2. Repeat the scraping process
3. Continue until all searches are complete

---

### Step 5: Deduplicate Data 🗑️

After scraping, you may have duplicate entries. Remove them:

1. Make sure your workbook is selected and active
2. In the extension popup, scroll to the bottom
3. Click **"🧹 Deduplicate"** link
4. The extension will:
   - Scan the active tab for duplicate names
   - Remove duplicates (keeps the first occurrence)
   - Show you how many duplicates were removed

> 💡 **Tip**: Run deduplication after each competitor's scrape to keep data clean.

---

### Step 6: Compare Weekly Tabs 🔄 (Find New Connections)

This is where you identify who just entered your competitor's funnel this week.

#### 6.1: Open Compare Tabs Section

1. In the extension popup, find **"🔄 Compare Tabs"** section
2. Click to expand it

#### 6.2: Select Tabs to Compare

1. **Baseline Tab (older)**: Select last week's tab (e.g., `11_20_25`)
2. **Compare Tab (newer)**: Select this week's tab (e.g., `11_27_25`)
3. **Output Tab Name**: Enter a name like `new_connections` or `new_leads`

#### 6.3: Choose Comparison Method

- **Name (Column B)**: Compares by person's name (default)
- **LinkedIn URL (Column F)**: Compares by LinkedIn profile URL

> 💡 **Tip**: Use "Name" for most cases. Use "LinkedIn URL" if names might have variations.

#### 6.4: Run Comparison

1. Click **"🔄 Compare"**
2. The extension will:
   - Read both tabs
   - Find entries in the newer tab that aren't in the older tab
   - Create a new tab with only the new connections
   - Show you statistics

#### 6.5: Review Results

The results box shows:
- **Tab 1 Rows**: Number of rows in the baseline (older) tab
- **Tab 2 Rows**: Number of rows in the compare (newer) tab
- **New Entries**: Number of new connections found (highlighted in red)
- **Output Tab**: Name of the new tab created

#### 6.6: Analyze New Connections

1. Open your Google Sheet
2. Find the new tab (e.g., `new_connections`)
3. Review the new connections
4. These are people who just entered your competitor's funnel this week
5. **Target them** before your competitor does!

---

## 📊 Data Extracted

For each LinkedIn profile, the extension extracts:

| Column | Data |
|--------|------|
| **A - Date** | Date of the scrape |
| **B - Name** | Full name (with accreditations separated) |
| **C - Title** | Job title |
| **D - Location** | Geographic location |
| **E - Connection Source** | Source Connection from your Input Sheet |
| **F - LinkedIn URL** | Direct link to the profile |
| **G-L - Accreditation 1-6** | Up to 6 separate accreditation columns (e.g., CWS®, CFP®, etc.) |

### Example Extracted Data

| Date | Name | Title | Location | Connection Source | LinkedIn URL | Accreditation 1 |
|------|------|-------|----------|-------------------|--------------|-----------------|
| 11/27/25 | James Weaver | Financial Advisor | New York, NY | Taylor Smith | linkedin.com/in/jamesweaver | CWS® |
| 11/27/25 | Sarah Johnson | Wealth Manager | Los Angeles, CA | Taylor Smith | linkedin.com/in/sarahjohnson | CFP® |

---

## 🔄 Weekly Workflow Example

Here's a typical weekly workflow:

### Monday Morning: Initial Setup
1. ✅ Create Input Sheet with competitor searches
2. ✅ Load searches into extension
3. ✅ Create workbooks for each competitor
4. ✅ Activate first competitor's workbook

### Monday: First Scrape
1. ✅ Open first search
2. ✅ Start scraping
3. ✅ Let it complete (creates `11_27_25` tab)
4. ✅ Move to next search
5. ✅ Repeat for all searches
6. ✅ Deduplicate data

### Next Monday: Weekly Comparison
1. ✅ Run new scrapes (creates `12_04_25` tab)
2. ✅ Deduplicate new data
3. ✅ Open Compare Tabs section
4. ✅ Compare `11_27_25` (last week) vs `12_04_25` (this week)
5. ✅ Output: `new_connections_week_2`
6. ✅ Review new connections
7. ✅ Target new prospects!

---

## 🛠️ Advanced Features

### Sync Queue

The extension uses a local-first sync queue:
- Data is saved locally immediately
- Syncs to Google Sheets in the background
- Survives WiFi drops and browser crashes
- View queue status in the **"📊 Sync Queue"** section

### Smart Navigation

- Automatically advances through multiple searches
- Tracks progress across all searches
- Shows completion status for each search

### Tab Management

- **Add Tabs**: Manually create new tabs in workbooks
- **Select Tabs**: Choose which tab to scrape to
- **Auto-Dated Tabs**: Automatically creates dated tabs for weekly scrapes

---

## 🐛 Troubleshooting

### Authentication Issues

**Problem**: "Access denied" or "403 Forbidden"
- **Solution**: Make sure you added yourself as a test user in Google Cloud Console OAuth consent screen

**Problem**: "Invalid client ID"
- **Solution**: Verify your Client ID in `manifest.json` matches your Google Cloud Console

### Scraping Issues

**Problem**: Extension doesn't scrape
- **Solution**: Make sure you're on a LinkedIn search results page (`linkedin.com/search/results/people/`)

**Problem**: Data not appearing in Google Sheets
- **Solution**: Check the Sync Queue section - data may be pending sync

### Tab Comparison Issues

**Problem**: "No spreadsheet selected"
- **Solution**: Make sure a workbook is selected and activated in Workbook Manager

**Problem**: "Tab already exists"
- **Solution**: Choose a different output tab name

---

## 📁 Project Structure

```
savvypirate/
├── background/          # Service worker and API modules
│   ├── service_worker.js
│   ├── auth.js
│   ├── sheets_api.js
│   └── sync_queue.js
├── content/             # Content script for LinkedIn scraping
│   └── content.js
├── popup/               # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── icons/               # Extension icons
├── manifest.json        # Extension configuration
└── README.md           # This file
```

---

## 🔒 Security & Privacy

### Data Privacy

- All data is stored in **YOUR Google Sheets** (your Google account)
- The extension developer cannot access your data
- Each user's data is completely isolated
- Tokens are stored securely in Chrome's identity storage

### OAuth Security

- Never share your `manifest.json` file (contains Client ID)
- Use `.example` files as templates
- Keep your Google Cloud Project credentials secure

---

## 📝 Notes

- **Rate Limits**: LinkedIn may rate limit if you scrape too aggressively. Use reasonable delays between scrapes.
- **Data Accuracy**: Scraped data depends on what's visible on LinkedIn. Some profiles may have limited information.
- **Weekly Scrapes**: Run scrapes at consistent times each week for best comparison results.

---

## 🆘 Support

For issues or questions:
- Check the [Troubleshooting](#-troubleshooting) section above
- Review [SETUP.md](SETUP.md) for detailed setup instructions
- Check browser console for error messages (F12 → Console tab)

---

## 📄 License

This project is private/proprietary.

---

## 🚢 Development

For development plan and architecture details, see [linkedin-scraper-plan.md](linkedin-scraper-plan.md).

---

**Happy Hunting! 🏴‍☠️**

*Remember: Use this tool responsibly and in compliance with LinkedIn's Terms of Service.*
