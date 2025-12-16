// ==========================================
// PHASE 20: "THE FUZZY MASTER" (Targeting Column Q)
// ==========================================
//
// USAGE: This script is used for the "Morgan and Taylor update" COMPARISON workbook
// - Input columns: Name (B), Location (D), LinkedIn URL (F)
// - Output starts at: Column Q (17)
// - Matching Priority:
//   1. Slug Match (robust against https/http, trailing slashes, query params)
//   2. Exact Name Match (UPPER comparison)
// - CRM Fields:
//   - Status: From Lead.Status
//   - Disposition: From Lead.Disposition__c or Opportunity.Closed_Lost_Reason__c
//   - Closed Lost Details: From Opportunity.Closed_Lost_Details__c
//
// NOTE: For individual workbooks (Morgan, Taylor, etc.), use enricher.gs instead
// ==========================================

const BQ_PROJECT_ID = 'savvy-gtm-analytics';

// 1. DATA SOURCES
const DISCOVERY_TABLES = [
  '`savvy-gtm-analytics.LeadScoring.staging_discovery_t1`',
  '`savvy-gtm-analytics.LeadScoring.staging_discovery_t2`',
  '`savvy-gtm-analytics.LeadScoring.staging_discovery_t3`'
];

const CRM_LEAD_TABLE = '`savvy-gtm-analytics.SavvyGTMData.Lead`';
const CRM_OPP_TABLE = '`savvy-gtm-analytics.SavvyGTMData.Opportunity`';

// 2. OUTPUT HEADERS
const ENRICHMENT_HEADERS = [
  'Match Type',
  'CRM Type',             // Lead or Opportunity
  'CRM ID',               // The specific ID
  'Status',               // Status from Lead table
  'Disposition',         // Disposition (Lead) or Closed_Lost_Reason__c (Opportunity)
  'Closed Lost Details', // Closed_Lost_Details__c from Opportunity table
  'Last Activity',        // Date of last action
  'Salesforce Link',      // Clickable Link
  'CRD Number',
  'Total AUM (M)',
  'Growth Rate (5yr)',
  'Growth Rate (1yr)',
  'Assets: HNW Individuals (M)',
  'Assets: Individuals (M)',
  'Assets: Retirement Plans (M)',
  '% Clients: HNW',
  '% Clients: Individuals',
  '% Clients: Retirement',
  'Custodian: Schwab',
  'Custodian: Pershing',
  'Custodian: TD Ameritrade',
  'Custodian: Fidelity',
  '# IA Reps',
  'LinkedIn URL (Found)',
  'Brochure Keywords',
  'Custom Keywords',
  'Registration Date'
];

function runBigQueryEnrichment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  // --- CONFIGURATION ---
  // CSV Structure: Date, Name, Title, Location, Connection Source, LinkedIn URL, Accreditations...
  const NAME_COL_INDEX = 1;      // Column B (Name)
  const LOCATION_COL_INDEX = 3;  // Column D (Location)
  const LINKEDIN_COL_INDEX = 5;  // Column F (LinkedIn URL)
  const OUTPUT_START_COL = 17;   // Column Q (output starts here)
  // ---------------------

  // Write Headers
  sheet.getRange(1, OUTPUT_START_COL, 1, ENRICHMENT_HEADERS.length)
       .setValues([ENRICHMENT_HEADERS])
       .setFontWeight("bold")
       .setBackground("#EFEFEF")
       .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = range.getValues();
  
  // --- ROBUST CLEANING FUNCTION ---
  // Crucial: Do NOT use decodeURIComponent - database stores encoded URLs (e.g., %C2%AE)
  const clean = (input) => {
    let s = String(input || "").trim();
    return s
      .replace(/\\/g, "\\\\")      // Escape backslashes
      .replace(/'/g, "\\'")         // Escape single quotes
      .replace(/[\r\n\t]+/g, " ");  // Remove newlines/tabs
  };

  let validRows = [];
  values.forEach((row, i) => {
    // Safety check to ensure row has enough columns
    const safeGet = (idx) => (row.length > idx ? row[idx] : "");
    
    const name = clean(safeGet(NAME_COL_INDEX));
    let url = clean(safeGet(LINKEDIN_COL_INDEX));
    const location = clean(safeGet(LOCATION_COL_INDEX));
    
    // Remove query params from URL
    if (url.includes('?')) url = url.split('?')[0]; 
    
    if (name !== "" || url !== "") {
      validRows.push({
        rowIndex: i + 2, 
        name: name,
        url: url,
        location: location
      });
    }
  });

  if (validRows.length === 0) {
    ss.toast("No valid rows found. Check column indexes.");
    return;
  }

  ss.toast(`🔍 Checking Warehouse & CRM for ${validRows.length} rows...`);

  // Build STRUCT values for BigQuery
  const inputStructs = validRows.map(r => 
    `STRUCT('${r.name}' as search_name, '${r.url}' as search_url, '${r.location}' as search_location, ${r.rowIndex} as row_id)`
  ).join(", ");

  // Discovery Fields
  const selectFields = `
    CAST(RepCRD AS STRING) as RepCRD,
    TotalAssetsInMillions,
    AUMGrowthRate_5Year,
    AUMGrowthRate_1Year,
    AssetsInMillions_HNWIndividuals,
    AssetsInMillions_Individuals,
    AssetsInMillions_RetirementPlans,
    PercentClients_HNWIndividuals,
    PercentClients_Individuals,
    PercentClients_RetirementPlans,
    CustodianAUM_Schwab,
    CustodianAUM_Pershing,
    CustodianAUM_TDAmeritrade,
    CustodianAUM_Fidelity_NationalFinancial,
    Number_IAReps,
    SocialMedia_LinkedIn, 
    Brochure_Keywords,
    CustomKeywords,
    RegistrationDate_Full,
    Branch_City,
    Branch_State
  `;

  const query = `
    -- A. SLUG EXTRACTION FUNCTION
    CREATE TEMP FUNCTION GetLinkedInSlug(url STRING) AS (
      REGEXP_EXTRACT(url, r'linkedin\\.com/in/([^/]+)')
    );

    -- B. PREPARE SHEET DATA
    WITH sheet_data AS (
      SELECT 
        *,
        GetLinkedInSlug(search_url) as input_slug,
        UPPER(TRIM(search_name)) as input_name_upper
      FROM UNNEST([${inputStructs}])
    ),
    
    -- C. WAREHOUSE DATA (Discovery)
    warehouse_data AS (
      SELECT FullName, ${selectFields} FROM ${DISCOVERY_TABLES[0]}
      UNION ALL
      SELECT FullName, ${selectFields} FROM ${DISCOVERY_TABLES[1]}
      UNION ALL
      SELECT FullName, ${selectFields} FROM ${DISCOVERY_TABLES[2]}
    ),

    -- D. CLEAN WAREHOUSE DATA
    warehouse_clean AS (
      SELECT 
        *,
        UPPER(TRIM(FullName)) as db_full_name_upper,
        GetLinkedInSlug(SocialMedia_LinkedIn) as db_slug
      FROM warehouse_data
    ),

    -- E. PERFORM MATCHING (Priority-based)
    matched_leads AS (
      SELECT 
        s.row_id,
        CASE
          -- Priority 1: Slug Match (robust against https/http, trailing slashes, query params)
          WHEN s.input_slug IS NOT NULL AND s.input_slug <> '' 
               AND w.db_slug IS NOT NULL AND w.db_slug <> ''
               AND STRPOS(w.SocialMedia_LinkedIn, s.input_slug) > 0
          THEN '1. Slug Match'
          
          -- Priority 2: Exact Name Match
          WHEN s.input_name_upper = w.db_full_name_upper
          THEN '2. Exact Name Match'
          
          ELSE 'NO MATCH'
        END as MatchType,
        w.* 
      FROM sheet_data s
      JOIN warehouse_clean w
        ON (
          -- Priority 1: Slug Match
          (s.input_slug IS NOT NULL AND s.input_slug <> '' 
           AND w.db_slug IS NOT NULL AND w.db_slug <> ''
           AND STRPOS(w.SocialMedia_LinkedIn, s.input_slug) > 0)
          OR
          -- Priority 2: Exact Name Match
          (s.input_name_upper = w.db_full_name_upper)
        )
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY s.row_id 
        ORDER BY 
          CASE 
            WHEN s.input_slug IS NOT NULL AND s.input_slug <> '' 
                 AND w.db_slug IS NOT NULL AND w.db_slug <> ''
                 AND STRPOS(w.SocialMedia_LinkedIn, s.input_slug) > 0 THEN 1
            WHEN s.input_name_upper = w.db_full_name_upper THEN 2
            ELSE 99
          END ASC, 
          w.TotalAssetsInMillions DESC NULLS LAST
      ) = 1
    )

    -- F. CRM ENRICHMENT
    SELECT 
      m.row_id,
      m.MatchType,
      CASE 
        WHEN opp.Id IS NOT NULL THEN 'Opportunity'
        WHEN lead.Id IS NOT NULL THEN 'Lead'
        ELSE 'New Prospect'
      END as CRM_Type,
      COALESCE(opp.Full_Opportunity_ID__c, lead.Full_Prospect_ID__c) as CRM_ID,
      COALESCE(CAST(lead.Status AS STRING), '') as Status,
      COALESCE(opp.Closed_Lost_Reason__c, lead.Disposition__c) as Disposition,
      COALESCE(opp.Closed_Lost_Details__c, '') as Closed_Lost_Details,
      COALESCE(CAST(opp.LastActivityDate AS STRING), CAST(lead.LastActivityDate AS STRING)) as Last_Activity,
      CASE 
        WHEN opp.Id IS NOT NULL THEN CONCAT('https://savvywealth.lightning.force.com/lightning/r/Opportunity/', opp.Full_Opportunity_ID__c, '/view')
        WHEN lead.Id IS NOT NULL THEN CONCAT('https://savvywealth.lightning.force.com/lightning/r/Lead/', lead.Full_Prospect_ID__c, '/view')
        ELSE ''
      END as SFDC_Link,
      m.RepCRD, m.TotalAssetsInMillions, m.AUMGrowthRate_5Year, m.AUMGrowthRate_1Year,
      m.AssetsInMillions_HNWIndividuals, m.AssetsInMillions_Individuals, m.AssetsInMillions_RetirementPlans,
      m.PercentClients_HNWIndividuals, m.PercentClients_Individuals, m.PercentClients_RetirementPlans,
      m.CustodianAUM_Schwab, m.CustodianAUM_Pershing, m.CustodianAUM_TDAmeritrade, m.CustodianAUM_Fidelity_NationalFinancial,
      m.Number_IAReps, m.SocialMedia_LinkedIn, m.Brochure_Keywords, m.CustomKeywords, m.RegistrationDate_Full
    FROM matched_leads m
    LEFT JOIN ${CRM_OPP_TABLE} opp 
      ON CAST(m.RepCRD as STRING) = CAST(opp.FA_CRD__c as STRING)
    LEFT JOIN ${CRM_LEAD_TABLE} lead 
      ON CAST(m.RepCRD as STRING) = CAST(lead.FA_CRD__c as STRING)
  `;

  // Execute Query with Safe Wait Loop
  try {
    const request = { query: query, useLegacySql: false };
    let queryResults = BigQuery.Jobs.query(request, BQ_PROJECT_ID);
    const jobId = queryResults.jobReference.jobId;

    // Safe Wait Loop: Start at 500ms, double up to 5000ms max, hard timeout at 120 seconds
    const startTime = Date.now();
    let sleepTimeMs = 500;
    while (!queryResults.jobComplete) {
      if (Date.now() - startTime > 120000) {
        throw new Error("BigQuery query timed out after 120 seconds.");
      }
      Utilities.sleep(sleepTimeMs);
      if (sleepTimeMs < 5000) sleepTimeMs *= 2;
      queryResults = BigQuery.Jobs.getQueryResults(BQ_PROJECT_ID, jobId);
    }

    const rows = queryResults.rows;
    if (!rows || rows.length === 0) {
      ss.toast("⚠️ Analysis complete. No matches found.");
      return;
    }

    let resultsMap = {};
    rows.forEach(r => {
      const rowId = parseInt(r.f[0].v);
      let dataRow = [];
      for(let k = 1; k < r.f.length; k++) {
        dataRow.push(r.f[k].v);
      }
      resultsMap[rowId] = dataRow;
    });

    let outputData = [];
    for (let i = 0; i < values.length; i++) {
      const currentRowNum = i + 2;
      if (resultsMap[currentRowNum]) {
        outputData.push(resultsMap[currentRowNum]);
      } else {
        // No match found - set "Match Type" to "NO MATCH"
        const noMatchRow = new Array(ENRICHMENT_HEADERS.length).fill("");
        noMatchRow[0] = "NO MATCH";
        outputData.push(noMatchRow);
      }
    }

    sheet.getRange(2, OUTPUT_START_COL, outputData.length, ENRICHMENT_HEADERS.length)
         .setValues(outputData);

    // AUTO-FIT COLUMNS
    sheet.autoResizeColumns(OUTPUT_START_COL, ENRICHMENT_HEADERS.length);

    ss.toast(`✅ Success! Enriched ${rows.length} rows with CRM Data.`);

  } catch (e) {
    Logger.log(e);
    SpreadsheetApp.getUi().alert("BigQuery Error: " + e.toString());
  }
}

/**
 * ============================================
 * WEB APP ENTRY POINT - For Chrome Extension
 * ============================================
 * Deploy as: Web App
 * Execute as: Me (your account)
 * Access: Anyone with Google account
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const { action, tabName } = params;
    
    if (!action || !tabName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required parameters: action and tabName are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: `Tab "${tabName}" not found in spreadsheet`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'enrichTab') {
      const originalSheet = ss.getActiveSheet();
      try {
        sheet.activate();
        SpreadsheetApp.flush();
        runBigQueryEnrichment();
        SpreadsheetApp.flush();
        originalSheet.activate();
        
        const lastRow = sheet.getLastRow();
        const dataRowCount = lastRow > 1 ? lastRow - 1 : 0;
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: `Enriched ${tabName} with BigQuery data (${dataRowCount} rows processed)`
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (enrichError) {
        try {
          originalSheet.activate();
        } catch (restoreError) {
          Logger.log('[WebApp] Error restoring original sheet: ' + restoreError.toString());
        }
        Logger.log('[WebApp] BigQuery Enrichment error: ' + enrichError.toString());
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `BigQuery Enrichment failed: ${enrichError.message || enrichError.toString()}`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Unknown action: ${action}. Supported actions: 'enrichTab'`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('[WebApp] doPost error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Request processing failed: ${error.message || error.toString()}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

