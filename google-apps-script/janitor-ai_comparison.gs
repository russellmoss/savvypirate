// ==========================================
// PHASE 10: "THE SMART JANITOR" (Accreditation Aware) - COMPARISON VERSION
// ==========================================
//
// USAGE: This script is used for the "Morgan and Taylor update" COMPARISON workbook
// - Input columns: Date (A), Source (B), Name (C), Title (D), Location (E), 
//   Connection Source (F), LinkedIn URL (G), Accreditation 1-6 (H-M)
// - AI columns output: N, O, P (14, 15, 16)
//
// NOTE: For individual workbooks (Morgan, Taylor, etc.), use janitor-ai.gs instead
// ==========================================

const GEMINI_API_KEY = 'AIzaSyC8kD3Zx-pDKldQQ3eozsBvuQKUlW5uGKA'; 

// "gemini-1.5-flash" is fastest/best for paid tier processing.
// "gemini-1.5-pro" is smarter but slower. 
const MODEL_NAME = 'gemini-2.0-flash'; 

const AI_HEADERS = ['AI_Status', 'AI_Category', 'AI_Reasoning'];
const CLEANED_ARCHIVE_TAB = 'Janitor_Trash_Bin'; 

// === 1. GOLDEN TICKETS (Auto-Keep) ===
// If any of these appear in columns H-M (Accreditation 1-6), we KEEP them instantly. No AI needed.
const GOLDEN_KEYWORDS = [
  "CFP", "CERTIFIED FINANCIAL PLANNER", 
  "CFA", "Chartered Financial Analyst",
  "ChFC", "Chartered Financial Consultant",
  "CIMA", "CPWA", "PFS", "AIF", "CEPA", "CLU",
  "Wealth", "Advisor", "Financial Planner" // Keywords in accreditation cols usually mean legit
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

// === 3. AI CONTEXT (For the vague stuff left over) ===
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
      try {
        processSheet(sheet, false); 
        SpreadsheetApp.flush(); 
        archiveBadLeads(sheet);
      } catch (error) {
        Logger.log(`Error processing sheet ${sheet.getName()}: ${error.toString()}`);
        ss.toast(`Error processing ${sheet.getName()}: ${error.message}`);
      }
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
  
  // Clear previous status
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const statusIdx = headers.indexOf('AI_Status');
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
        ui.alert(`⚠️ Finished but processed 0 rows.\nCheck if rows are already marked in 'AI_Status' column.`);
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
  // 1. Setup Headers - AI columns should ALWAYS be at columns N, O, P (14, 15, 16)
  const AI_COL_START = 14; // Column N (1-based indexing)
  const headerRow = 1;
  
  // Read current headers to check what's in columns N, O, P
  let lastCol = sheet.getLastColumn();
  const maxColToRead = Math.max(lastCol, AI_COL_START + AI_HEADERS.length - 1);
  let headerRange = sheet.getRange(headerRow, 1, 1, maxColToRead);
  let headers = headerRange.getValues()[0];
  let aiStatusColIndex = headers.indexOf('AI_Status');
  
  // Check if AI_Status is in the correct position (column N, index 13 in 0-based)
  const expectedIndex = AI_COL_START - 1; // 13 (0-based) = Column N (14 in 1-based)
  
  if (aiStatusColIndex !== expectedIndex) {
    // Either doesn't exist or is in wrong position - create/overwrite at correct position
    Logger.log(`[Janitor] Creating AI columns at columns N, O, P (${AI_COL_START}-${AI_COL_START + AI_HEADERS.length - 1})`);
    Logger.log(`[Janitor] Headers to create: ${AI_HEADERS.join(', ')}`);
    
    // Create/overwrite the header row at the fixed position
    const newHeaderRange = sheet.getRange(headerRow, AI_COL_START, 1, AI_HEADERS.length);
    newHeaderRange.setValues([AI_HEADERS]);
    newHeaderRange.setFontWeight("bold");
    newHeaderRange.setBackground("#E8F0FE");
    SpreadsheetApp.flush();
    
    // Verify the columns were written
    const verifyRange = sheet.getRange(headerRow, AI_COL_START, 1, AI_HEADERS.length);
    const verifyValues = verifyRange.getValues()[0];
    Logger.log(`[Janitor] Verified headers written: ${verifyValues.join(', ')}`);
    
    // Re-read headers to confirm
    lastCol = sheet.getLastColumn();
    const allHeadersRange = sheet.getRange(headerRow, 1, 1, Math.max(lastCol, AI_COL_START + AI_HEADERS.length - 1));
    headers = allHeadersRange.getValues()[0];
    aiStatusColIndex = headers.indexOf('AI_Status');
    
    // Verify it's in the correct position
    if (aiStatusColIndex !== expectedIndex) {
      const errorMsg = `Failed to create AI_Status at column N. Found at index ${aiStatusColIndex}, expected ${expectedIndex}`;
      Logger.log(`[Janitor] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    Logger.log(`[Janitor] ✅ AI_Status column created at column N (index ${aiStatusColIndex}, column ${aiStatusColIndex + 1})`);
  } else {
    Logger.log(`[Janitor] AI_Status column already exists at column N (index ${aiStatusColIndex}, column ${aiStatusColIndex + 1})`);
  }
  
  // Ensure we have the correct last column after header setup
  const finalLastCol = sheet.getLastColumn();

  // 2. DYNAMIC COLUMN FINDER (for comparison workbook structure)
  // Columns: A=Date, B=Source, C=Name, D=Title, E=Location, F=Connection Source, G=LinkedIn URL, H-M=Accreditations
  let TITLE_IDX = headers.findIndex(h => h.match(/Title|Position/i));
  let NAME_IDX = headers.findIndex(h => h.match(/Name/i));
  if (TITLE_IDX === -1) TITLE_IDX = 3; // Default D (Column D for comparison workbook)
  if (NAME_IDX === -1) NAME_IDX = 2;   // Default C (Column C for comparison workbook)
  
  // 2.5. Check for CRD Number column (from BigQuery enrichment - optional)
  // CRD Number indicates a registered RIA - automatically keep these people
  const CRD_COL_INDEX = headers.findIndex(h => h === 'CRD Number');

  // 3. Define Range
  const start = startRowOverride || 2;
  const totalRows = sheet.getLastRow();
  const count = numRowsOverride || (totalRows - 1);
  
  // Log for debugging
  Logger.log(`processSheet: totalRows=${totalRows}, count=${count}, aiStatusColIndex=${aiStatusColIndex}`);

  // Even if count is 0, we've already created the columns above, so just return
  if (count <= 0) {
    Logger.log('No rows to process, but columns should be created');
    return { total: 0, kept: 0, removed: 0 };
  }

  // Read data (include Accreditations H-M, cols 7-12, and any enrichment columns)
  // Make sure we read all columns including AI_Status columns
  const dataRange = sheet.getRange(start, 1, count, finalLastCol);
  const data = dataRange.getValues();
  
  let stats = { total: 0, kept: 0, removed: 0 };
  let batch = [];
  const BATCH_SIZE = 25; // Increased batch size for Paid Tier speed

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

    // --- A. CRD NUMBER CHECK (Highest Priority - Auto-Keep if CRD exists) ---
    // If BigQuery enrichment found a CRD number, this person is a registered RIA
    // Skip all other checks and automatically keep them
    if (CRD_COL_INDEX !== -1 && data[i].length > CRD_COL_INDEX) {
      const crdValue = String(data[i][CRD_COL_INDEX] || "").trim();
      if (crdValue !== "" && crdValue !== "null" && crdValue !== "undefined" && crdValue !== "NO MATCH") {
        // Has CRD number - automatically keep, no AI needed
        sheet.getRange(rowNum, aiStatusColIndex + 1, 1, 3).setValues([["Yes", "Registered RIA (CRD)", `CRD: ${crdValue}`]]);
        stats.total++;
        stats.kept++;
        continue; // Skip to next row
      }
    }

    // --- B. GOLDEN TICKET CHECK (Accreditations) ---
    // Scan columns H(7) through M(12) for Accreditations (Accreditation 1-6)
    let isAccredited = false;
    let foundAccreditation = "";
    
    // Check Columns 7 through 12 (H-M for Accreditation 1-6)
    const scanEnd = Math.min(13, data[i].length); 
    for(let c = 7; c < scanEnd; c++) {
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

    // IF ACCREDITED: Keep instantly (Skip AI)
    if (isAccredited) {
      sheet.getRange(rowNum, aiStatusColIndex + 1, 1, 3).setValues([["Yes", "Accredited Advisor", `Found '${foundAccreditation}'`]]);
      stats.total++;
      stats.kept++;
      continue; // Skip to next row
    }

    // --- C. LOCAL KILL CHECK ---
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

    // --- D. AI BATCHING (Only for the ambiguous ones) ---
    batch.push({ rowIndex: rowNum, name: rowName, title: rowTitle });

    if (batch.length >= BATCH_SIZE) {
      SpreadsheetApp.getActiveSpreadsheet().toast(`AI Checking batch... (Row ${rowNum})`);
      
      const batchStats = analyzeBatch(sheet, batch, aiStatusColIndex + 1);
      stats.total += batchStats.total;
      stats.kept += batchStats.kept;
      stats.removed += batchStats.removed;
      batch = [];
      
      SpreadsheetApp.flush();
      // Paid Tier Speed: Lower sleep time (e.g. 500ms)
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
    const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
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

  const data = sourceSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  let rowsToMove = [];
  let rowsToDeleteIndices = [];

  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][statusIdx]).toLowerCase().trim();
    if (status.startsWith("no") || status === "false" || status.includes("blacklisted")) {
      let rowData = [...data[i]];
      rowData.push(sourceSheet.getName());
      rowsToMove.push(rowData);
      rowsToDeleteIndices.push(i + 2);
    }
  }

  if (rowsToMove.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToMove.length, rowsToMove[0].length).setValues(rowsToMove);
    rowsToDeleteIndices.sort((a, b) => b - a);
    rowsToDeleteIndices.forEach(idx => sourceSheet.deleteRow(idx));
  }
  return rowsToMove.length;
}

function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = { "contents": [{ "parts": [{"text": prompt}] }] };
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

function debugFirstRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  let TITLE_IDX = headers.findIndex(h => h.match(/Title|Position/i));
  let NAME_IDX = headers.findIndex(h => h.match(/Name/i));
  let AI_STATUS_IDX = headers.indexOf('AI_Status');
  let CRD_IDX = headers.indexOf('CRD Number');
  
  // Data sample
  const data = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  ui.alert(
    `🧐 DEBUG COLUMNS:\n` +
    `Found "Title" at Index: ${TITLE_IDX} (Value: "${data[TITLE_IDX] || 'EMPTY'}")\n` +
    `Found "Name" at Index: ${NAME_IDX} (Value: "${data[NAME_IDX] || 'EMPTY'}")\n` +
    `Found "AI_Status" at Index: ${AI_STATUS_IDX} (Column: ${AI_STATUS_IDX !== -1 ? AI_STATUS_IDX + 1 : 'NOT FOUND'})\n` +
    `Found "CRD Number" at Index: ${CRD_IDX} (Column: ${CRD_IDX !== -1 ? CRD_IDX + 1 : 'NOT FOUND'})\n` +
    `Total Columns: ${sheet.getLastColumn()}\n` +
    `----------------\n` +
    `If Index is -1, verify your header row (Row 1) has these columns.`
  );
}

/**
 * Test function to verify AI columns are created correctly
 * Run this from the Apps Script editor to test column creation
 */
function testAIColumnCreation() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  
  // Force create columns by calling processSheet logic
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let aiStatusColIndex = headers.indexOf('AI_Status');
  
  if (aiStatusColIndex === -1) {
    const newLastCol = sheet.getLastColumn();
    const startCol = newLastCol + 1;
    
    sheet.getRange(1, startCol, 1, AI_HEADERS.length).setValues([AI_HEADERS]);
    sheet.getRange(1, startCol, 1, AI_HEADERS.length).setFontWeight("bold");
    sheet.getRange(1, startCol, 1, AI_HEADERS.length).setBackground("#E8F0FE");
    SpreadsheetApp.flush();
    
    // Verify
    const verifyHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const verifyIndex = verifyHeaders.indexOf('AI_Status');
    
    if (verifyIndex !== -1) {
      ui.alert(`✅ SUCCESS! AI columns created at column ${verifyIndex + 1}\n\nColumns: ${AI_HEADERS.join(', ')}`);
    } else {
      ui.alert(`❌ FAILED! Columns not found after creation.\n\nLast column: ${sheet.getLastColumn()}\nHeaders: ${verifyHeaders.slice(-10).join(', ')}`);
    }
  } else {
    ui.alert(`✅ AI columns already exist at column ${aiStatusColIndex + 1}\n\nColumns: ${AI_HEADERS.join(', ')}`);
  }
}

