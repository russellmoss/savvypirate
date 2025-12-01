// ==========================================
// PHASE 10: "THE SMART JANITOR" (JSON Mode & Error Proof)
// ==========================================

const GEMINI_API_KEY = 'AIzaSyC8kD3Zx-pDKldQQ3eozsBvuQKUlW5uGKA'; 

// using gemini-2.0-flash
const MODEL_NAME = 'gemini-2.0-flash'; 

const AI_HEADERS = ['AI_Status', 'AI_Category', 'AI_Reasoning'];
const CLEANED_ARCHIVE_TAB = 'Janitor_Trash_Bin'; 

// === 1. GOLDEN TICKETS (Auto-Keep) ===
const GOLDEN_KEYWORDS = [
  "CFP", "CERTIFIED FINANCIAL PLANNER", 
  "CFA", "Chartered Financial Analyst",
  "ChFC", "Chartered Financial Consultant",
  "CIMA", "CPWA", "PFS", "AIF", "CEPA", "CLU",
  "Wealth", "Advisor", "Financial Planner" 
];

// === 2. KILL LIST (Auto-Reject) ===
const INSTANT_KILL_KEYWORDS = [
  "Postman", "USPS", "Crime Fighter", "Teacher", "Student", "Driver", "Trucking", 
  "Uber", "Lyft", "DoorDash", "Delivery", "Nurse", "Doctor", "Physician", 
  "Pastor", "Reverend", "Clerk", "Cashier", "Barista", "Waiter", "Server", 
  "Cleaner", "Janitor", "Custodian", "Electrician", "Plumber", "HVAC", 
  "Carpenter", "Painter", "Mechanic", "Technician", "Security Guard", 
  "Police", "Firefighter", "EMT", "Paramedic", "Soldier", "Army", "Navy"
];

// === 3. AI CONTEXT ===
const BLACKLIST_CONTEXT = `
  1. INSURANCE: State Farm, Allstate, Farmers, Liberty Mutual, Claims, Adjuster.
  2. REAL ESTATE: Realtor, Mortgage, Loan Officer, Escrow, Title, Leasing.
  3. TRADES: Construction, Pest Control, Handyman, Landscaping.
  4. NON-FINANCE: HR, Recruiter, Marketing, Software Engineer, IT, Support.
`;

// =======================
// MENU & TRIGGERS
// =======================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🧹 Janitor AI')
    .addItem('▶️ Clean Selected Rows (Force)', 'cleanSelectedRows')
    .addItem('📑 Clean Specific Tab...', 'cleanSpecificTab')
    .addItem('📅 Run on ALL Date Tabs', 'runTheJanitor')
    .addSeparator()
    .addItem('💎 Run BigQuery Enrichment', 'runBigQueryEnrichment')
    .addSeparator()
    .addItem('🔌 Test API Connection', 'testGeminiConnection')
    .addToUi();
}

function runTheJanitor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const dateTabRegex = /^\d{2}_\d{2}_\d{2}$/;
  sheets.forEach(sheet => {
    if (dateTabRegex.test(sheet.getName())) {
      processSheet(sheet, false); 
      SpreadsheetApp.flush(); 
      archiveBadLeads(sheet); 
    }
  });
}

// =======================
// ACTIONS
// =======================

function cleanSelectedRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  const selection = sheet.getActiveRange();
  
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  
  if (startRow < 2) {
    ui.alert("⚠️ Please select data rows (not the header).");
    return;
  }

  ss.toast(`Analyzing ${numRows} row(s)...`);
  
  // Ensure headers exist before processing
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let statusIdx = headers.indexOf('AI_Status');
  
  // Clear previous status if column exists
  if (statusIdx > -1) {
    sheet.getRange(startRow, statusIdx + 1, numRows, 3).clearContent();
    SpreadsheetApp.flush();
  }

  const stats = processSheet(sheet, true, startRow, numRows);
  SpreadsheetApp.flush(); 
  const movedCount = archiveBadLeads(sheet);
  
  ui.alert(`✅ Analysis Complete.\n\n👍 Kept: ${stats.kept}\n👎 Rejected: ${stats.removed}\n\n🗑️ Moved to Trash Bin: ${movedCount}`);
}

function cleanSpecificTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Clean Specific Tab', 'Enter tab name (e.g. "11_28_25"):', ui.ButtonSet.OK_CANCEL);

  if (result.getSelectedButton() == ui.Button.OK) {
    const tabName = result.getResponseText().trim();
    const sheet = ss.getSheetByName(tabName);
    if (sheet) {
      ss.toast(`Found ${tabName}. Starting fast cleanup...`);
      const stats = processSheet(sheet, false); 
      SpreadsheetApp.flush();
      const moved = archiveBadLeads(sheet);
      
      if (stats.total === 0 && moved === 0) {
        ui.alert(`⚠️ Finished but processed 0 rows.\nCheck if rows are already marked in 'AI_Status' column, or if API is failing (Run Test Connection).`);
      } else {
        ui.alert(`✅ Complete!\nProcessed: ${stats.total}\nKept: ${stats.kept}\nRemoved: ${moved}`);
      }
    } else {
      ui.alert(`❌ Tab "${tabName}" not found.`);
    }
  }
}

// =======================
// CORE LOGIC
// =======================

function processSheet(sheet, forceAll = false, startRowOverride = null, numRowsOverride = null) {
  const lastCol = sheet.getLastColumn();
  
  // 1. Setup Headers
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  const headers = headerRange.getValues()[0];
  let aiStatusColIndex = headers.indexOf('AI_Status');
  
  if (aiStatusColIndex === -1) {
    sheet.getRange(1, lastCol + 1, 1, AI_HEADERS.length).setValues([AI_HEADERS]);
    SpreadsheetApp.flush();
    aiStatusColIndex = lastCol;
  }

  // 2. DYNAMIC COLUMN FINDER
  let TITLE_IDX = headers.findIndex(h => h.match(/Title|Position/i));
  let NAME_IDX = headers.findIndex(h => h.match(/Name/i));
  if (TITLE_IDX === -1) TITLE_IDX = 2; // Default C
  if (NAME_IDX === -1) NAME_IDX = 1;   // Default B

  // 3. Define Range
  const start = startRowOverride || 2;
  const totalRows = sheet.getLastRow();
  const count = numRowsOverride || (totalRows - 1); 
  
  if (count <= 0) return { total: 0, kept: 0, removed: 0 };

  // Read data
  const dataRange = sheet.getRange(start, 1, count, sheet.getLastColumn());
  const data = dataRange.getValues();
  
  let stats = { total: 0, kept: 0, removed: 0 };
  let batch = [];
  
  // REDUCED BATCH SIZE TO PREVENT JSON CUT-OFF ERRORS
  const BATCH_SIZE = 10; 

  for (let i = 0; i < data.length; i++) {
    const currentRowStatus = (data[i].length > aiStatusColIndex) ? data[i][aiStatusColIndex] : "";
    
    if (!forceAll && currentRowStatus !== "") {
        if (String(currentRowStatus).toLowerCase().startsWith("y")) stats.kept++;
        if (String(currentRowStatus).toLowerCase().startsWith("n")) stats.removed++;
        continue; 
    }

    const rowTitle = String(data[i][TITLE_IDX]);
    const rowName = data[i][NAME_IDX];
    const rowNum = start + i;

    // Skip empty rows
    if (!rowName && !rowTitle) continue;

    // --- A. GOLDEN TICKET CHECK (Accreditations) ---
    let isAccredited = false;
    let foundAccreditation = "";
    
    const scanEnd = Math.min(12, data[i].length); 
    for(let c = 6; c < scanEnd; c++) {
      const cellVal = String(data[i][c]).toUpperCase();
      for (const golden of GOLDEN_KEYWORDS) {
        if (cellVal.includes(golden.toUpperCase())) {
          isAccredited = true;
          foundAccreditation = golden;
          break;
        }
      }
      if (isAccredited) break;
    }

    if (isAccredited) {
      sheet.getRange(rowNum, aiStatusColIndex + 1, 1, 3).setValues([["Yes", "Accredited Advisor", `Found '${foundAccreditation}'`]]);
      stats.total++;
      stats.kept++;
      continue; 
    }

    // --- B. LOCAL KILL CHECK ---
    if (!rowTitle) continue;
    const lowerTitle = rowTitle.toLowerCase();
    let instantKill = false;
    for (const badWord of INSTANT_KILL_KEYWORDS) {
      if (lowerTitle.includes(badWord.toLowerCase())) {
        sheet.getRange(rowNum, aiStatusColIndex + 1, 1, 3).setValues([["No", "Blacklisted (Local)", `Matched '${badWord}'`]]);
        stats.total++;
        stats.removed++;
        instantKill = true;
        break;
      }
    }
    if (instantKill) continue;

    // --- C. AI BATCHING ---
    batch.push({ rowIndex: rowNum, name: rowName, title: rowTitle });

    if (batch.length >= BATCH_SIZE) {
      const batchStats = analyzeBatch(sheet, batch, aiStatusColIndex + 1);
      stats.total += batchStats.total;
      stats.kept += batchStats.kept;
      stats.removed += batchStats.removed;
      batch = [];
      Utilities.sleep(500); 
    }
  }

  // Final Batch
  if (batch.length > 0) {
    const batchStats = analyzeBatch(sheet, batch, aiStatusColIndex + 1);
    stats.total += batchStats.total;
    stats.kept += batchStats.kept;
    stats.removed += batchStats.removed;
  }
  
  return stats;
}

function analyzeBatch(sheet, batchRows, colStart) {
  let batchStats = { total: 0, kept: 0, removed: 0 };
  
  const prompt = `
  Role: Expert Recruiter.
  Task: Classify these LinkedIn Profiles.
  GOAL: Find Financial Advisors / Wealth Managers.
  
  RULES:
  1. REJECT (No) Insurance-only, Trades, Medical, Education, Support.
  2. REJECT (No) nonsense titles like "Crime Fighter".
  3. KEEP (Yes) if the title is ambiguous but sounds like a professional service or owner ("Managing Director", "Principal") AND DOES NOT match the reject list.
  4. KEEP (Yes) vague titles like "Relieving Financial Anxiety" if it implies financial planning.

  ${BLACKLIST_CONTEXT}

  Input: ${JSON.stringify(batchRows.map(r => ({ id: r.rowIndex, title: r.title })))}
  
  Output JSON: [{"id": 12, "Keep": "Yes/No", "Category": "CategoryName", "Reason": "Short reason"}]
  `;

  try {
    const response = callGemini(prompt);
    
    // Robust cleaning: Find the first '[' and last ']' to ignore any markdown text
    let cleanJson = response.trim();
    const firstBracket = cleanJson.indexOf('[');
    const lastBracket = cleanJson.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
    }

    const results = JSON.parse(cleanJson);

    results.forEach(res => {
      sheet.getRange(res.id, colStart, 1, 3).setValues([[res.Keep, res.Category, res.Reason]]);
      batchStats.total++;
      const val = String(res.Keep).toLowerCase();
      if (val.startsWith("y")) batchStats.kept++;
      if (val.startsWith("n")) batchStats.removed++;
    });
  } catch (e) {
    Logger.log("Error in batch: " + e.toString());
    // Alert on failure
    SpreadsheetApp.getUi().alert("⚠️ API ERROR: " + e.toString());
  }
  return batchStats;
}

function archiveBadLeads(sourceSheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let archiveSheet = ss.getSheetByName(CLEANED_ARCHIVE_TAB);
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(CLEANED_ARCHIVE_TAB);
    const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues();
    headers[0].push("Original_Tab_Source");
    archiveSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  }

  const lastRow = sourceSheet.getLastRow();
  const lastCol = sourceSheet.getLastColumn();
  const headers = sourceSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const statusIdx = headers.indexOf('AI_Status');

  if (statusIdx === -1) return 0;

  // Get all data at once
  const data = sourceSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  let rowsToMove = [];
  let rowsToDeleteIndices = [];

  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][statusIdx]).toLowerCase().trim();
    if (status.startsWith("no") || status === "false" || status.includes("blacklisted")) {
      let rowData = [...data[i]];
      rowData.push(sourceSheet.getName());
      rowsToMove.push(rowData);
      // Store the actual row number (i + 2 because data is 0-indexed and starts at row 2)
      rowsToDeleteIndices.push(i + 2);
    }
  }

  if (rowsToMove.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToMove.length, rowsToMove[0].length).setValues(rowsToMove);
    
    // Delete from bottom up to maintain indices
    rowsToDeleteIndices.sort((a, b) => b - a);
    rowsToDeleteIndices.forEach(idx => sourceSheet.deleteRow(idx));
  }
  return rowsToMove.length;
}

function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  
  // CRITICAL FIX: Force JSON response type to prevent syntax errors
  const payload = { 
    "contents": [{ "parts": [{"text": prompt}] }],
    "generationConfig": { "response_mime_type": "application/json" } 
  };

  const options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload), 'muteHttpExceptions': true };
  const response = UrlFetchApp.fetch(url, options);
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`Gemini API Error (${MODEL_NAME}): ${response.getContentText()}`);
  }
  return JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
}

// === DIAGNOSTICS ===

function testGeminiConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const prompt = "Reply with exactly the word: 'Success'";
    const response = callGemini(prompt);
    ui.alert(`✅ API Connection Working! (${MODEL_NAME}) Response: ` + response);
  } catch (e) {
    ui.alert("❌ API FAILURE: " + e.toString());
  }
}

/**
 * ============================================
 * WEB APP ENTRY POINT - For Chrome Extension
 * ============================================
 * Deploy as: Web App
 * Execute as: Me (your account)
 * Access: Anyone with Google account
 * 
 * This function handles HTTP POST requests from the Chrome extension
 * to trigger Janitor AI cleaning on a specific tab.
 */
function doPost(e) {
  // CRITICAL: Try to log immediately - use both Logger and try to return early if there's an issue
  try {
    // Force immediate logging to see if we even get here
    Logger.log('[WebApp] ========== doPost CALLED ==========');
    Logger.log('[WebApp] Timestamp: ' + new Date().toISOString());
    
    // Check if e is null/undefined
    if (!e) {
      Logger.log('[WebApp] ERROR: e is null or undefined');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request object is null or undefined'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log('[WebApp] e type: ' + typeof e);
    Logger.log('[WebApp] e keys: ' + Object.keys(e || {}).join(', '));
    
    // FIRST: Check if e itself is an error or if there's an error property
    if (e && typeof e === 'object' && e.error) {
      Logger.log('[WebApp] ⚠️ Request object contains error property: ' + JSON.stringify(e.error));
    }
    
    // Check if e.postData.contents is already an error object
    if (e && e.postData && e.postData.contents && typeof e.postData.contents === 'object' && e.postData.contents.error) {
      Logger.log('[WebApp] ⚠️ postData.contents is an error object: ' + JSON.stringify(e.postData.contents));
      // Try to extract the actual content from the error
      const errorMsg = e.postData.contents.error || e.postData.contents.message || JSON.stringify(e.postData.contents);
      Logger.log('[WebApp] Error message: ' + errorMsg);
    }
  
  } catch (earlyError) {
    // If we can't even log, something is very wrong
    Logger.log('[WebApp] CRITICAL: Error in early logging: ' + earlyError.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Early error in doPost: ' + earlyError.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    Logger.log(`[WebApp] ========== NEW REQUEST ==========`);
    Logger.log(`[WebApp] Request type: ${typeof e}`);
    Logger.log(`[WebApp] Has e.parameter: ${!!e.parameter}`);
    Logger.log(`[WebApp] Has e.postData: ${!!e.postData}`);
    Logger.log(`[WebApp] e keys: ${Object.keys(e).join(', ')}`);
    
    // CRITICAL: Check if Apps Script already tried to parse as JSON and failed
    // Sometimes Apps Script will try to parse the body as JSON before doPost is called
    // If that fails, the error might be in e.postData or e itself
    
    // Log all available data for debugging
    if (e.parameter) {
      Logger.log(`[WebApp] e.parameter type: ${typeof e.parameter}`);
      Logger.log(`[WebApp] e.parameter keys: ${Object.keys(e.parameter).join(', ')}`);
      Logger.log(`[WebApp] e.parameter values: ${JSON.stringify(e.parameter)}`);
    } else {
      Logger.log(`[WebApp] e.parameter is null/undefined`);
    }
    
    if (e.postData) {
      Logger.log(`[WebApp] e.postData.type: ${e.postData.type || 'undefined'}`);
      Logger.log(`[WebApp] e.postData.name: ${e.postData.name || 'undefined'}`);
      if (e.postData.contents) {
        Logger.log(`[WebApp] e.postData.contents type: ${typeof e.postData.contents}`);
        Logger.log(`[WebApp] e.postData.contents length: ${e.postData.contents.length}`);
        Logger.log(`[WebApp] e.postData.contents (first 200 chars): ${e.postData.contents.substring(0, 200)}`);
      } else {
        Logger.log(`[WebApp] e.postData.contents is null/undefined`);
      }
    } else {
      Logger.log(`[WebApp] e.postData is null/undefined`);
    }
    
    // Parse the incoming request - support both JSON and form data
    let action = null;
    let tabName = null;
    
    // Strategy 1: Try e.parameter first (Apps Script auto-parses form data here)
    if (e.parameter && typeof e.parameter === 'object' && Object.keys(e.parameter).length > 0) {
      action = e.parameter.action || null;
      tabName = e.parameter.tabName || null;
      if (action && tabName) {
        Logger.log(`[WebApp] ✅ Strategy 1 SUCCESS: Parsed from e.parameter: action="${action}", tabName="${tabName}"`);
      } else {
        Logger.log(`[WebApp] ⚠️ Strategy 1: e.parameter exists but missing action or tabName`);
      }
    } else {
      Logger.log(`[WebApp] ⚠️ Strategy 1: e.parameter is empty or not an object`);
    }
    
    // Strategy 2: If e.parameter didn't work, manually parse form data from postData.contents
    if ((!action || !tabName) && e.postData && e.postData.contents) {
      const contents = e.postData.contents.trim();
      Logger.log(`[WebApp] Strategy 2: Attempting to parse postData.contents (length: ${contents.length})`);
      
      // ALWAYS check for form data FIRST (contains = or &)
      if (contents.includes('=') || contents.includes('&')) {
        Logger.log(`[WebApp] ✅ Detected form data format (contains = or &)`);
        Logger.log(`[WebApp] Form data string: "${contents}"`);
        
        // Manually parse URL-encoded form data: "action=cleanTab&tabName=test"
        const params = {};
        const pairs = contents.split('&');
        Logger.log(`[WebApp] Split into ${pairs.length} pairs`);
        
        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i].split('=');
          if (pair.length === 2) {
            const key = decodeURIComponent(pair[0].trim());
            const value = decodeURIComponent(pair[1].trim());
            params[key] = value;
            Logger.log(`[WebApp]   Parsed pair: "${key}" = "${value}"`);
          } else {
            Logger.log(`[WebApp]   ⚠️ Skipping invalid pair: "${pairs[i]}"`);
          }
        }
        
        Logger.log(`[WebApp] Manually parsed form data: ${JSON.stringify(params)}`);
        action = params.action || action;
        tabName = params.tabName || tabName;
        
        if (action && tabName) {
          Logger.log(`[WebApp] ✅ Strategy 2 SUCCESS: Parsed from manual form data: action="${action}", tabName="${tabName}"`);
        } else {
          Logger.log(`[WebApp] ⚠️ Strategy 2: Parsed form data but missing action or tabName`);
        }
      } else if (contents.startsWith('{')) {
        // Only parse if it looks like JSON (starts with {) AND doesn't contain form data markers
        Logger.log(`[WebApp] Content starts with {, checking if it's JSON...`);
        if (!contents.includes('=') && !contents.includes('&')) {
          try {
            Logger.log(`[WebApp] Attempting JSON parse. Contents start: "${contents.substring(0, 50)}"`);
            const params = JSON.parse(contents);
            action = params.action || action;
            tabName = params.tabName || tabName;
            Logger.log(`[WebApp] ✅ Strategy 2 SUCCESS: Parsed from JSON: action="${action}", tabName="${tabName}"`);
          } catch (parseError) {
            Logger.log(`[WebApp] ❌ JSON parse failed: ${parseError.toString()}`);
            Logger.log(`[WebApp] This is expected if content is not valid JSON`);
            // Don't throw - just log and continue
          }
        } else {
          Logger.log(`[WebApp] Content starts with { but contains = or &, treating as form data`);
        }
      } else {
        Logger.log(`[WebApp] ⚠️ postData.contents does not look like JSON or form data`);
        Logger.log(`[WebApp] First 50 chars: "${contents.substring(0, 50)}"`);
      }
    } else {
      Logger.log(`[WebApp] ⚠️ Strategy 2: No postData.contents available`);
    }
    
    Logger.log(`[WebApp] ========== PARSING COMPLETE ==========`);
    Logger.log(`[WebApp] Final values: action="${action}", tabName="${tabName}"`);
    
    // Validate required parameters
    if (!action || !tabName) {
      Logger.log('[WebApp] Missing parameters. Available parameters:', Object.keys(e.parameter || {}));
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required parameters: action and tabName are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle cleanTab action
    if (action === 'cleanTab') {
      // Get the spreadsheet from the bound context
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(tabName);
      
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `Tab "${tabName}" not found in spreadsheet`
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      try {
        // Run the cleaning process (forceAll = false means skip already processed rows)
        Logger.log(`[WebApp] Starting Janitor AI on tab: ${tabName}`);
        const stats = processSheet(sheet, false);
        SpreadsheetApp.flush();
        
        // Archive bad leads (moves rows marked as "No" to trash bin)
        const movedCount = archiveBadLeads(sheet);
        SpreadsheetApp.flush();
        
        Logger.log(`[WebApp] Janitor AI complete: ${stats.kept} kept, ${stats.removed} removed, ${movedCount} archived`);
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: `Cleaned ${tabName}: ${stats.kept} kept, ${stats.removed} removed, ${movedCount} archived`,
          details: {
            total: stats.total,
            kept: stats.kept,
            removed: stats.removed,
            archived: movedCount
          }
        })).setMimeType(ContentService.MimeType.JSON);
        
      } catch (error) {
        Logger.log('[WebApp] Janitor AI error: ' + error.toString());
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `Janitor AI failed: ${error.message || error.toString()}`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Unknown action
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Unknown action: ${action}. Supported actions: 'cleanTab'`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Enhanced error logging to help debug
    try {
      Logger.log('[WebApp] ========== ERROR CAUGHT ==========');
      Logger.log('[WebApp] Error type: ' + typeof error);
      Logger.log('[WebApp] Error name: ' + (error.name || 'undefined'));
      Logger.log('[WebApp] Error message: ' + (error.message || error.toString()));
      Logger.log('[WebApp] Error stack: ' + (error.stack || 'no stack'));
      
      // Check if this is a JSON parse error
      if (error.message && error.message.includes('JSON')) {
        Logger.log('[WebApp] ⚠️ This appears to be a JSON parsing error');
        Logger.log('[WebApp] This suggests Apps Script tried to parse form data as JSON');
        Logger.log('[WebApp] Check the request Content-Type header');
      }
      
      Logger.log('[WebApp] =================================');
    } catch (logError) {
      // If we can't even log, return a simple error
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Request processing failed: ${error.message || error.toString()}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * WORKAROUND: Use doGet for testing/debugging
 * Apps Script Web Apps sometimes have issues with doPost and form data
 * This allows testing via GET with query parameters
 */
function doGet(e) {
  try {
    Logger.log('[WebApp] doGet called with parameters: ' + JSON.stringify(e.parameter));
    
    const action = e.parameter.action;
    const tabName = e.parameter.tabName;
    
    if (!action || !tabName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required parameters: action and tabName are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Create a mock POST event to reuse doPost logic
    const mockPostEvent = {
      postData: {
        contents: `action=${encodeURIComponent(action)}&tabName=${encodeURIComponent(tabName)}`,
        type: 'application/x-www-form-urlencoded'
      },
      parameter: e.parameter
    };
    
    // Call doPost with the mock event
    return doPost(mockPostEvent);
    
  } catch (error) {
    Logger.log('[WebApp] doGet error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `doGet failed: ${error.message || error.toString()}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ============================================
 * TESTING FUNCTIONS - Rapid Iteration Testing
 * ============================================
 */

/**
 * Test doPost with form data (simulates Chrome extension)
 * Run this in Apps Script editor to test locally
 */
function testDoPostFormData() {
  Logger.log('🧪 Testing doPost with form data (Chrome extension format)...');
  
  const mockFormDataEvent = {
    postData: {
      contents: 'action=cleanTab&tabName=new_leads_11_30_25',
      type: 'application/x-www-form-urlencoded'
    },
    parameter: {} // Empty to simulate Apps Script not auto-parsing
  };
  
  try {
    const result = doPost(mockFormDataEvent);
    const response = result.getContent();
    Logger.log('✅ Test result: ' + response);
    
    // Try to parse as JSON to see the structure
    try {
      const json = JSON.parse(response);
      Logger.log('✅ Parsed response: ' + JSON.stringify(json, null, 2));
    } catch (e) {
      Logger.log('⚠️ Response is not JSON: ' + response);
    }
  } catch (error) {
    Logger.log('❌ Test error: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Test doPost with JSON (backward compatibility)
 */
function testDoPostJSON() {
  Logger.log('🧪 Testing doPost with JSON format...');
  
  const mockJsonEvent = {
    postData: {
      contents: JSON.stringify({ 
        action: 'cleanTab', 
        tabName: 'new_leads_11_30_25'
      }),
      type: 'application/json'
    }
  };
  
  try {
    const result = doPost(mockJsonEvent);
    const response = result.getContent();
    Logger.log('✅ Test result: ' + response);
  } catch (error) {
    Logger.log('❌ Test error: ' + error.toString());
  }
}

/**
 * Test with actual tab name from your spreadsheet
 * Replace 'YOUR_TAB_NAME' with an actual tab that exists
 */
function testDoPostWithRealTab() {
  const realTabName = 'new_leads_11_30_25'; // CHANGE THIS to a real tab name
  
  Logger.log(`🧪 Testing doPost with real tab: ${realTabName}...`);
  
  const mockFormDataEvent = {
    postData: {
      contents: `action=cleanTab&tabName=${encodeURIComponent(realTabName)}`,
      type: 'application/x-www-form-urlencoded'
    },
    parameter: {}
  };
  
  try {
    const result = doPost(mockFormDataEvent);
    const response = result.getContent();
    Logger.log('✅ Test result: ' + response);
    
    const json = JSON.parse(response);
    if (json.success) {
      Logger.log('✅ SUCCESS! Tab was cleaned successfully');
      Logger.log('Details: ' + JSON.stringify(json.details, null, 2));
    } else {
      Logger.log('❌ FAILED: ' + json.error);
    }
  } catch (error) {
    Logger.log('❌ Test error: ' + error.toString());
  }
}

/**
 * Quick test - runs all test scenarios
 */
function runAllTests() {
  Logger.log('🚀 Running all tests...\n');
  
  testDoPostFormData();
  Logger.log('\n---\n');
  
  testDoPostJSON();
  Logger.log('\n---\n');
  
  // Uncomment to test with real tab:
  // testDoPostWithRealTab();
}
