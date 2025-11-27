# Savvy Pirate 🏴‍☠️

A Chrome Extension for scraping LinkedIn search results and exporting data directly to Google Sheets.

## Features

- 🔍 **LinkedIn Scraping**: Automatically extracts profile data from LinkedIn search results
- 📊 **Google Sheets Integration**: Real-time sync to Google Sheets (no CSV downloads needed)
- 🎯 **Smart Navigation**: Auto-advances through multiple searches with progress tracking
- 📝 **Name Parsing**: Automatically extracts accreditations from names (e.g., "James Weaver, CWS®")
- 📑 **Tab Management**: Load existing sheets, add tabs, and select which tab to scrape to
- 🔄 **Resilient Sync**: Data saved locally first, syncs when online (survives WiFi drops)
- 🗑️ **Deduplication**: Remove duplicate rows based on Name column with one click
- 🏴‍☠️ **Pirate Theme**: Dark, stylish UI with black and red color scheme

## Installation

### Prerequisites

- Chrome browser
- Google account
- Google Cloud project with OAuth credentials

### Setup Instructions

1. **Clone this repository:**
   ```bash
   git clone https://github.com/russellmoss/savvypirate.git
   cd savvypirate
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure OAuth credentials:**
   - See [SETUP.md](SETUP.md) for detailed instructions
   - Copy `manifest.json.example` to `manifest.json`
   - Copy `oauth-config.json.example` to `oauth-config.json`
   - Add your Google OAuth client_id to both files

4. **Load the extension:**
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `savvypirate` folder

## Usage

1. **Prepare your input sheet:**
   - Create a Google Sheet with columns:
     - Column A: Source Connection (e.g., "Taylor Smith")
     - Column B: Job Title Filter (e.g., "Financial Advisor")
     - Column C: Search URL (LinkedIn search URL)

2. **Load searches:**
   - Click the extension icon
   - Enter your Input Sheet ID and click "Load"
   - Searches will appear in the list

3. **Set up output sheet:**
   - Create a new sheet OR load an existing one
   - (Optional) Add tabs for organization
   - Select which tab to scrape to

4. **Start scraping:**
   - Select a search and click "Open"
   - Navigate to LinkedIn search results page
   - Click "Start Scraping"
   - Use the red STOP button to end early

5. **Manage data:**
   - Click "Deduplicate" to remove duplicate rows
   - Use "Sync Now" to force sync pending data
   - Export failed rows as CSV if needed

## Data Extracted

For each profile, the extension extracts:
- Date
- Name (with accreditations separated)
- Title
- Location
- Connection Source (from your input sheet)
- LinkedIn URL
- Accreditation 1-6 (up to 6 separate accreditation columns)

## Project Structure

```
savvypirate/
├── background/          # Service worker and API modules
├── content/             # Content script for LinkedIn scraping
├── popup/               # Extension popup UI
├── icons/               # Extension icons
├── manifest.json        # Extension manifest (create from .example)
└── package.json         # Dependencies
```

## Security

**Important**: Never commit your actual `manifest.json` or `oauth-config.json` files. These contain your OAuth client_id. Use the `.example` files as templates instead.

## Troubleshooting

See [SETUP.md](SETUP.md) for troubleshooting tips.

## License

This project is private/proprietary.

## Development

For development plan and architecture details, see [linkedin-scraper-plan.md](linkedin-scraper-plan.md).

