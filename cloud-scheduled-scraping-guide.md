# Cloud-Based Scheduled LinkedIn Scraping Guide

## Overview

This guide outlines how to migrate your Chrome extension-based LinkedIn scraper to a cloud-based solution that:
- ✅ Runs automatically once per week
- ✅ Doesn't require your computer to be on
- ✅ Maintains stealth characteristics to avoid LinkedIn detection
- ✅ Preserves LinkedIn authentication
- ✅ Maintains Google Sheets access

---

## Architecture Options

### Option 1: Cloud VM with Headless Browser (Recommended)
**Best for:** Maximum stealth, full control, consistent environment

**Components:**
- **VM Provider:** AWS EC2, Google Cloud Compute Engine, or Azure VM
- **OS:** Ubuntu 22.04 LTS (lightweight, stable)
- **Browser:** Puppeteer or Playwright with stealth plugins
- **Scheduler:** System cron job
- **Storage:** Persistent disk for session data

**Pros:**
- Full control over browser environment
- Can maintain consistent browser fingerprint
- Easy to debug and monitor
- Can use residential proxies effectively

**Cons:**
- Requires VM management
- Higher cost (~$10-30/month for small instance)
- Need to handle OS updates

---

### Option 2: Containerized Solution (Docker on Cloud Run/ECS)
**Best for:** Scalability, easier deployment, cost optimization

**Components:**
- **Platform:** Google Cloud Run, AWS ECS/Fargate, or Azure Container Instances
- **Container:** Docker with headless Chrome
- **Scheduler:** Cloud Scheduler (GCP) or EventBridge (AWS)
- **Storage:** Cloud Storage for session persistence

**Pros:**
- Pay only when running (serverless-like)
- Easy to update and deploy
- Built-in scheduling

**Cons:**
- Cold starts may affect timing
- Session persistence more complex
- Less control over environment

---

### Option 3: Hybrid: Local VM + Cloud Trigger
**Best for:** Maximum stealth with minimal cloud costs

**Components:**
- **Local:** Always-on home server/NAS (Raspberry Pi, old laptop)
- **Cloud:** Cloud Scheduler triggers webhook
- **Communication:** Webhook → Local server → Scraper

**Pros:**
- Uses your home IP (most natural)
- Very low cloud costs
- Full control

**Cons:**
- Requires always-on local device
- Internet dependency
- More complex networking

---

## Recommended Architecture: Cloud VM with Stealth Browser

### Infrastructure Setup

#### 1. VM Instance
```
Provider: Google Cloud Compute Engine (or AWS EC2)
Instance Type: e2-small or e2-medium (2 vCPU, 4GB RAM)
OS: Ubuntu 22.04 LTS
Disk: 20GB SSD (for Chrome, sessions, logs)
Region: Choose closest to your location for natural latency
```

#### 2. Networking
- **Static IP:** Reserve a static IP address (appears more legitimate)
- **Residential Proxy (Optional but Recommended):**
  - Services: Bright Data, Oxylabs, Smartproxy
  - Route traffic through residential IPs
  - Rotate IPs per session (not per request)
  - Use same IP for entire scraping session

---

## Stealth Techniques

### 1. Browser Fingerprint Management

**Goal:** Make the browser look like a real user's browser

**Implementation:**
```javascript
// Use puppeteer-extra with stealth plugin
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Customize fingerprint
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    // Set realistic viewport
    '--window-size=1920,1080',
    // Use real user agent
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'
  ]
});
```

**Key Fingerprint Elements:**
- **User Agent:** Match to real browser version
- **Viewport:** Standard desktop size (1920x1080)
- **WebGL Vendor/Renderer:** Realistic GPU info
- **Canvas Fingerprint:** Consistent across sessions
- **Fonts:** Standard system fonts
- **Timezone:** Match your actual timezone
- **Language:** Match your locale

### 2. Behavioral Patterns

**Human-like Actions:**
- **Random Delays:** 2-5 seconds between actions (not fixed)
- **Mouse Movements:** Simulate mouse movement before clicks
- **Scrolling:** Gradual, variable-speed scrolling
- **Typing Speed:** 50-150ms per character (human-like)
- **Page Dwell Time:** 3-8 seconds per page before action
- **Session Duration:** 15-30 minutes per scraping session

**Timing Patterns:**
```javascript
// Random delay with human-like distribution
const humanDelay = () => {
  const base = 2000; // 2 seconds base
  const random = Math.random() * 3000; // 0-3 seconds random
  return base + random;
};

// Gradual scroll (not instant)
const gradualScroll = async (page, pixels) => {
  const steps = 10;
  const stepSize = pixels / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((step) => {
      window.scrollBy(0, step);
    }, stepSize);
    await page.waitForTimeout(100 + Math.random() * 50);
  }
};
```

### 3. Session Management

**LinkedIn Authentication:**
- **Cookie Persistence:** Save cookies after login, reuse across runs
- **Session Refresh:** Re-authenticate every 2-3 weeks (natural pattern)
- **Login Behavior:** 
  - Use real credentials (stored securely)
  - Complete 2FA if required
  - Mimic normal login times (morning hours)

**Cookie Storage:**
```javascript
// Save cookies after successful login
const cookies = await page.cookies();
fs.writeFileSync('linkedin-cookies.json', JSON.stringify(cookies, null, 2));

// Load cookies before scraping
const cookies = JSON.parse(fs.readFileSync('linkedin-cookies.json'));
await page.setCookie(...cookies);
```

### 4. Request Patterns

**Rate Limiting:**
- **Profiles per Hour:** 20-30 profiles (conservative)
- **Searches per Session:** 5-10 searches max
- **Break Between Sessions:** 2-4 hours minimum
- **Daily Limit:** 100-150 profiles per day

**Request Headers:**
```javascript
// Set realistic headers
await page.setExtraHTTPHeaders({
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0'
});
```

---

## Authentication & Access

### LinkedIn Authentication

#### Option A: Cookie-Based (Recommended)
1. **Initial Setup:**
   - Manually log in once on the VM
   - Export cookies to secure file
   - Store in encrypted format

2. **Session Refresh:**
   - Check cookie validity before each run
   - Re-authenticate if cookies expired
   - Use stored credentials (encrypted)

3. **2FA Handling:**
   - Use app-based 2FA (Google Authenticator)
   - Store backup codes securely
   - Automated 2FA input if possible

#### Option B: OAuth Token (Advanced)
- Use LinkedIn OAuth API
- Refresh tokens automatically
- More complex but more reliable

### Google Sheets Access

#### Service Account (Recommended)
1. **Create Service Account:**
   - Google Cloud Console → IAM & Admin → Service Accounts
   - Create new service account
   - Grant "Editor" role to target spreadsheets
   - Download JSON key file

2. **Share Spreadsheets:**
   - Share each target spreadsheet with service account email
   - Grant "Editor" permission

3. **Authentication:**
```javascript
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const serviceAccountAuth = new JWT({
  email: serviceAccountEmail,
  key: serviceAccountPrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
await doc.loadInfo();
```

#### OAuth 2.0 (Alternative)
- Use OAuth flow with refresh tokens
- More complex but allows personal account access
- Better for accessing multiple accounts

---

## Implementation Steps

### Phase 1: Environment Setup

1. **Create VM Instance**
   ```bash
   # Google Cloud
   gcloud compute instances create linkedin-scraper \
     --zone=us-central1-a \
     --machine-type=e2-small \
     --image-family=ubuntu-2204-lts \
     --image-project=ubuntu-os-cloud \
     --boot-disk-size=20GB \
     --boot-disk-type=pd-ssd
   ```

2. **Install Dependencies**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install Chrome dependencies
   sudo apt install -y \
     ca-certificates \
     fonts-liberation \
     libappindicator3-1 \
     libasound2 \
     libatk-bridge2.0-0 \
     libatk1.0-0 \
     libc6 \
     libcairo2 \
     libcups2 \
     libdbus-1-3 \
     libexpat1 \
     libfontconfig1 \
     libgbm1 \
     libgcc1 \
     libglib2.0-0 \
     libgtk-3-0 \
     libnspr4 \
     libnss3 \
     libpango-1.0-0 \
     libpangocairo-1.0-0 \
     libstdc++6 \
     libx11-6 \
     libx11-xcb1 \
     libxcb1 \
     libxcomposite1 \
     libxcursor1 \
     libxdamage1 \
     libxext6 \
     libxfixes3 \
     libxi6 \
     libxrandr2 \
     libxrender1 \
     libxss1 \
     libxtst6 \
     lsb-release \
     wget \
     xdg-utils
   ```

3. **Install Chrome**
   ```bash
   wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
   sudo apt install ./google-chrome-stable_current_amd64.deb
   ```

### Phase 2: Scraper Migration

1. **Port Chrome Extension Logic**
   - Extract scraping logic from `content/content.js`
   - Convert to Puppeteer/Playwright
   - Maintain selector fallback system
   - Keep same data structure

2. **Create Node.js Application**
   ```javascript
   // scraper.js structure
   const puppeteer = require('puppeteer-extra');
   const StealthPlugin = require('puppeteer-extra-plugin-stealth');
   const { GoogleSpreadsheet } = require('google-spreadsheet');
   
   // Initialize
   puppeteer.use(StealthPlugin());
   
   // Main scraping function
   async function runWeeklyScrape() {
     // 1. Load LinkedIn cookies
     // 2. Navigate to search
     // 3. Scrape profiles (with stealth behavior)
     // 4. Write to Google Sheets
     // 5. Handle errors gracefully
   }
   ```

3. **Maintain Stealth Features**
   - Keep all delays and randomizations
   - Maintain scroll behavior
   - Preserve selector fallback logic
   - Add LinkedIn warning detection

### Phase 3: Scheduling

1. **Create Cron Job**
   ```bash
   # Edit crontab
   crontab -e
   
   # Run every Monday at 9 AM (adjust timezone)
   0 9 * * 1 cd /home/user/scraper && /usr/bin/node scraper.js >> /var/log/scraper.log 2>&1
   ```

2. **Add Health Checks**
   - Email notifications on completion/failure
   - Log rotation
   - Error alerting

3. **Monitoring**
   ```bash
   # Check logs
   tail -f /var/log/scraper.log
   
   # Check if process is running
   ps aux | grep node
   ```

### Phase 4: Security

1. **Encrypt Credentials**
   ```javascript
   // Use environment variables or encrypted config
   const credentials = {
     linkedin: {
       email: process.env.LINKEDIN_EMAIL,
       password: process.env.LINKEDIN_PASSWORD
     },
     google: {
       serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
     }
   };
   ```

2. **Secure Storage**
   - Store cookies in encrypted file
   - Use VM metadata for secrets (GCP Secret Manager)
   - Restrict file permissions (chmod 600)

3. **Network Security**
   - Use VPC/firewall rules
   - Restrict SSH access
   - Use key-based authentication only

---

## Cost Estimation

### Monthly Costs (Approximate)

**VM Instance (e2-small):**
- Compute: ~$10-15/month (24/7 running)
- Storage: ~$2/month (20GB SSD)
- Network: ~$1-5/month (depending on egress)

**Residential Proxy (Optional):**
- Bright Data: ~$500/month (unlimited)
- Smartproxy: ~$75/month (10GB)
- Oxylabs: ~$300/month (50GB)

**Total (without proxy):** ~$15-25/month
**Total (with proxy):** ~$90-525/month

**Cost Optimization:**
- Use preemptible/spot instances (60-80% cheaper, but can be terminated)
- Schedule VM to start/stop automatically (only pay when running)
- Use smaller instance if scraping is quick (< 1 hour)

---

## Risk Mitigation

### LinkedIn Detection Risks

1. **IP Reputation**
   - **Risk:** Cloud IPs flagged as datacenter IPs
   - **Mitigation:** Use residential proxies or static IP with good reputation

2. **Browser Fingerprint**
   - **Risk:** Headless browser detected
   - **Mitigation:** Use stealth plugins, realistic fingerprints

3. **Behavior Patterns**
   - **Risk:** Too fast, too consistent
   - **Mitigation:** Random delays, human-like actions, realistic timing

4. **Account Activity**
   - **Risk:** Unusual login patterns
   - **Mitigation:** Consistent login times, normal session duration

### Operational Risks

1. **Session Expiration**
   - **Risk:** Cookies expire, scraping fails
   - **Mitigation:** Check cookie validity, auto re-authenticate

2. **LinkedIn UI Changes**
   - **Risk:** Selectors break
   - **Mitigation:** Maintain fallback selector system, monitor logs

3. **VM Downtime**
   - **Risk:** VM crashes, scraping doesn't run
   - **Mitigation:** Health checks, auto-restart, monitoring alerts

---

## Monitoring & Alerts

### Logging
```javascript
// Comprehensive logging
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};
```

### Health Checks
- **Pre-scrape:** Verify cookies valid, Google Sheets accessible
- **During scrape:** Monitor for LinkedIn warnings, errors
- **Post-scrape:** Verify data written, send completion notification

### Alerting
- **Email:** Send on completion, failure, or warnings
- **Slack/Discord:** Webhook notifications
- **Monitoring:** Uptime monitoring (UptimeRobot, Pingdom)

---

## Migration Checklist

### Pre-Migration
- [ ] Choose cloud provider and region
- [ ] Set up VM instance
- [ ] Install Node.js and dependencies
- [ ] Set up Google Service Account
- [ ] Share spreadsheets with service account
- [ ] Test Google Sheets API access

### Migration
- [ ] Port scraping logic from Chrome extension
- [ ] Implement stealth browser setup
- [ ] Add cookie persistence
- [ ] Test LinkedIn authentication
- [ ] Test scraping on small dataset
- [ ] Verify Google Sheets writes

### Deployment
- [ ] Set up cron job
- [ ] Configure logging
- [ ] Set up monitoring/alerting
- [ ] Test full weekly run
- [ ] Document credentials and access

### Post-Migration
- [ ] Monitor first few runs closely
- [ ] Adjust timing/delays if needed
- [ ] Verify stealth characteristics working
- [ ] Set up backup/restore procedures

---

## Alternative: Simplified Approach

If full migration is too complex, consider:

### Hybrid Solution
1. **Keep Chrome Extension:** Use for manual runs when needed
2. **Add Cloud Trigger:** Use Cloud Scheduler to send webhook
3. **Local Automation:** Use Task Scheduler (Windows) or cron (Mac/Linux) to:
   - Open Chrome with extension
   - Trigger auto-run
   - Close when complete

**Pros:** Minimal changes, uses existing extension
**Cons:** Still requires computer to be on (or always-on device)

---

## Next Steps

1. **Proof of Concept:** Set up test VM, port basic scraping logic
2. **Stealth Testing:** Run test scrapes, monitor for warnings
3. **Gradual Migration:** Start with one source, expand gradually
4. **Production Deployment:** Full weekly schedule, monitoring in place

---

## Resources

- **Puppeteer Stealth Plugin:** https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth
- **Google Sheets API:** https://developers.google.com/sheets/api
- **Residential Proxy Providers:** Bright Data, Oxylabs, Smartproxy
- **Cloud Provider Docs:** GCP, AWS, Azure documentation

---

## Questions to Consider

1. **How many profiles per week?** (affects instance size and timing)
2. **How many sources/searches?** (affects session duration)
3. **Budget for proxies?** (affects stealth level)
4. **Tolerance for downtime?** (affects redundancy needs)
5. **Technical expertise?** (affects implementation complexity)

---

*This guide provides a framework for cloud-based scheduled scraping. Implementation details will vary based on your specific requirements and chosen architecture.*

