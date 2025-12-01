// ==========================================
// PHASE 20: "THE FUZZY MASTER" (Smart Token + URL Matching)
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
  'CRM Sentiment',        // Disposition or Closed Reason
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
  const NAME_COL_INDEX = 1;      // Column B
  const LOCATION_COL_INDEX = 3;  // Column D
  const LINKEDIN_COL_INDEX = 5;  // Column F
  const OUTPUT_START_COL = 16;   // Column P
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
  
  let validRows = [];
  values.forEach((row, i) => {
    const name = String(row[NAME_COL_INDEX] || "").trim().replace(/'/g, "\\'");
    let url = String(row[LINKEDIN_COL_INDEX] || "").trim().replace(/'/g, "\\'");
    const location = String(row[LOCATION_COL_INDEX] || "").trim().replace(/'/g, "\\'");
    
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
    ss.toast("No valid rows found.");
    return;
  }

  ss.toast(`🔍 Checking Warehouse & CRM for ${validRows.length} rows...`);

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
    -- A. CLEANUP FUNCTION
    CREATE TEMP FUNCTION CleanName(raw_name STRING) AS ((
      WITH step1 AS (SELECT UPPER(raw_name) as n),
      step2 AS (SELECT REGEXP_REPLACE(n, r'\\([^)]*\\)', '') as n FROM step1),
      step3 AS (SELECT REGEXP_REPLACE(n, r'[^A-Z ]', ' ') as n FROM step2),
      step4 AS (SELECT REGEXP_REPLACE(n, r'\\b(JR|SR|II|III|IV|LLC|INC|CPA|CFP|CFA|PHD|MBA|MD|CLU|CHFC|AIF|CEO)\\b', ' ') as n FROM step3)
      SELECT TRIM(step4.n) FROM step4
    ));
    
    -- NEW: Extract the "Slug" from LinkedIn URL (e.g. "dina-milne" from "linkedin.com/in/dina-milne-cfp")
    CREATE TEMP FUNCTION GetLinkedInSlug(url STRING) AS ((
      SELECT REGEXP_EXTRACT(url, r'linkedin\\.com/in/([^/]+)')
    ));

    -- B. PREPARE SHEET DATA
    WITH sheet_data AS (
      SELECT 
        *, 
        CleanName(search_name) as clean_search_name,
        LOWER(REGEXP_REPLACE(search_url, r'^(https?://)?(www\\.)?linkedin\\.com/in/|/$|\\?.*$|/en$|/de$', '')) as sheet_linkedin_slug,
        SPLIT(CleanName(search_name), ' ')[SAFE_OFFSET(0)] as input_first,
        SPLIT(CleanName(search_name), ' ')[SAFE_OFFSET(ARRAY_LENGTH(SPLIT(CleanName(search_name), ' ')) - 1)] as input_last,
        
        -- Extract just the slug for fuzzy matching
        GetLinkedInSlug(search_url) as input_url_slug
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
        CleanName(FullName) as clean_full_name,
        LOWER(REGEXP_REPLACE(SocialMedia_LinkedIn, r'^(https?://)?(www\\.)?linkedin\\.com/in/|/$|\\?.*$|/en$|/de$', '')) as db_linkedin_slug,
        GetLinkedInSlug(SocialMedia_LinkedIn) as db_url_slug
      FROM warehouse_data
    ),

    -- E. PERFORM MATCHING
    matched_leads AS (
      SELECT 
        s.row_id,
        CASE
          WHEN s.search_url <> '' AND w.db_linkedin_slug = s.sheet_linkedin_slug THEN '1. Exact LinkedIn Match'
          
          -- NEW: Fuzzy URL Match (Finds "dina-milne" inside "dina-milne-cfp")
          WHEN s.search_url <> '' AND (STRPOS(w.db_url_slug, s.input_url_slug) > 0 OR STRPOS(s.input_url_slug, w.db_url_slug) > 0) 
          THEN '2. Fuzzy LinkedIn Match'
          
          WHEN s.clean_search_name = w.clean_full_name THEN '3. Exact Name Match'
          
          WHEN STRPOS(w.clean_full_name, s.input_first) > 0 
               AND STRPOS(w.clean_full_name, s.input_last) > 0
               AND (STRPOS(s.search_location, w.Branch_City) > 0 OR STRPOS(s.search_location, w.Branch_State) > 0)
          THEN '4. Token Match + Location'
          
          -- Relaxed Token Match (If First/Last match, we accept it even without location, but rank lower)
          WHEN STRPOS(w.clean_full_name, s.input_first) > 0 
               AND STRPOS(w.clean_full_name, s.input_last) > 0
          THEN '5. Token Match (Name Only)'
          
          ELSE '6. Weak Fuzzy Match'
        END as MatchType,
        
        w.* FROM sheet_data s
      JOIN warehouse_clean w
        ON (
          -- 1. URL Match Logic
          (s.search_url <> '' AND (w.db_linkedin_slug = s.sheet_linkedin_slug OR STRPOS(w.db_url_slug, s.input_url_slug) > 0 OR STRPOS(s.input_url_slug, w.db_url_slug) > 0))
          OR 
          -- 2. Name Match Logic
          (
             s.search_url = '' AND 
             (
                s.clean_search_name = w.clean_full_name
                OR 
                (STRPOS(w.clean_full_name, s.input_first) > 0 AND STRPOS(w.clean_full_name, s.input_last) > 0)
             )
          )
          -- 3. SPECIAL CASE: Name Match even if URL exists but failed to match (Backup)
          OR
          (
             s.search_url <> '' AND 
             STRPOS(w.clean_full_name, s.input_first) > 0 AND STRPOS(w.clean_full_name, s.input_last) > 0
             AND (STRPOS(s.search_location, w.Branch_City) > 0 OR STRPOS(s.search_location, w.Branch_State) > 0)
          )
        )
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY s.row_id 
        ORDER BY 
          CASE 
            WHEN s.search_url <> '' AND w.db_linkedin_slug = s.sheet_linkedin_slug THEN 1
            WHEN s.search_url <> '' AND (STRPOS(w.db_url_slug, s.input_url_slug) > 0) THEN 2
            WHEN s.clean_search_name = w.clean_full_name THEN 3
            WHEN STRPOS(w.clean_full_name, s.input_first) > 0 AND STRPOS(w.clean_full_name, s.input_last) > 0 AND (STRPOS(s.search_location, w.Branch_City) > 0) THEN 4
            ELSE 5
          END ASC, 
          w.TotalAssetsInMillions DESC NULLS LAST
      ) = 1
    )

    -- F. CRM ENRICHMENT (Deep Integration)
    SELECT 
      m.row_id,
      m.MatchType,
      
      -- 1. CRM TYPE (Prioritize Opportunity)
      CASE 
        WHEN opp.Id IS NOT NULL THEN 'Opportunity'
        WHEN lead.Id IS NOT NULL THEN 'Lead'
        ELSE 'New Prospect'
      END as CRM_Type,

      -- 2. CRM ID (Salesforce ID)
      COALESCE(opp.Full_Opportunity_ID__c, lead.Full_Prospect_ID__c) as CRM_ID,

      -- 3. SENTIMENT / REASON
      COALESCE(opp.Closed_Lost_Reason__c, lead.Disposition__c) as CRM_Sentiment,

      -- 4. LAST ACTIVITY DATE
      COALESCE(CAST(opp.LastActivityDate AS STRING), CAST(lead.LastActivityDate AS STRING)) as Last_Activity,

      -- 5. LINK
      CASE 
        WHEN opp.Id IS NOT NULL THEN CONCAT('https://savvywealth.lightning.force.com/lightning/r/Opportunity/', opp.Full_Opportunity_ID__c, '/view')
        WHEN lead.Id IS NOT NULL THEN CONCAT('https://savvywealth.lightning.force.com/lightning/r/Lead/', lead.Full_Prospect_ID__c, '/view')
        ELSE ''
      END as SFDC_Link,

      -- DISCOVERY DATA
      m.RepCRD, m.TotalAssetsInMillions, m.AUMGrowthRate_5Year, m.AUMGrowthRate_1Year,
      m.AssetsInMillions_HNWIndividuals, m.AssetsInMillions_Individuals, m.AssetsInMillions_RetirementPlans,
      m.PercentClients_HNWIndividuals, m.PercentClients_Individuals, m.PercentClients_RetirementPlans,
      m.CustodianAUM_Schwab, m.CustodianAUM_Pershing, m.CustodianAUM_TDAmeritrade, m.CustodianAUM_Fidelity_NationalFinancial,
      m.Number_IAReps, m.SocialMedia_LinkedIn, m.Brochure_Keywords, m.CustomKeywords, m.RegistrationDate_Full

    FROM matched_leads m
    -- Check Opportunities First (Priority)
    LEFT JOIN ${CRM_OPP_TABLE} opp 
      ON CAST(m.RepCRD as STRING) = CAST(opp.FA_CRD__c as STRING)
    -- Check Leads Second
    LEFT JOIN ${CRM_LEAD_TABLE} lead 
      ON CAST(m.RepCRD as STRING) = CAST(lead.FA_CRD__c as STRING)
  `;

  // Execute Query
  try {
    const request = { query: query, useLegacySql: false };
    let queryResults = BigQuery.Jobs.query(request, BQ_PROJECT_ID);
    const jobId = queryResults.jobReference.jobId;

    let sleepTimeMs = 500;
    while (!queryResults.jobComplete) {
      Utilities.sleep(sleepTimeMs);
      sleepTimeMs *= 2; 
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
        outputData.push(new Array(ENRICHMENT_HEADERS.length).fill(""));
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
 * 
 * This function handles HTTP POST requests from the Chrome extension
 * to trigger BigQuery enrichment on a specific tab.
 * 
 * NOTE: The runBigQueryEnrichment() function uses getActiveSheet(),
 * so we must activate the target sheet before calling it.
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
        
        // Manually parse URL-encoded form data: "action=enrichTab&tabName=test"
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
    
    // Get the spreadsheet from the bound context
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: `Tab "${tabName}" not found in spreadsheet`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle enrichTab action
    if (action === 'enrichTab') {
      try {
        // Save the current active sheet to restore later
        const originalSheet = ss.getActiveSheet();
        
        try {
          // Activate the target sheet (required because runBigQueryEnrichment uses getActiveSheet)
          sheet.activate();
          SpreadsheetApp.flush();
          
          Logger.log(`[WebApp] Starting BigQuery enrichment on tab: ${tabName}`);
          
          // Run the enrichment function (uses getActiveSheet internally)
          // Note: runBigQueryEnrichment() doesn't return a value, but shows toast messages
          runBigQueryEnrichment();
          SpreadsheetApp.flush();
          
          // Restore the original active sheet
          originalSheet.activate();
          
          Logger.log(`[WebApp] BigQuery enrichment complete for tab: ${tabName}`);
          
          // Get row count for success message
          const lastRow = sheet.getLastRow();
          const dataRowCount = lastRow > 1 ? lastRow - 1 : 0;
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: `Enriched ${tabName} with BigQuery data (${dataRowCount} rows processed)`,
            details: {
              tabName: tabName,
              rowsProcessed: dataRowCount
            }
          })).setMimeType(ContentService.MimeType.JSON);
          
        } catch (enrichError) {
          // Restore original active sheet even on error
          try {
            originalSheet.activate();
          } catch (restoreError) {
            Logger.log('[WebApp] Error restoring original sheet: ' + restoreError.toString());
          }
          throw enrichError;
        }
        
      } catch (error) {
        Logger.log('[WebApp] BigQuery Enrichment error: ' + error.toString());
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `BigQuery Enrichment failed: ${error.message || error.toString()}`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Unknown action
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: `Unknown action: ${action}. Supported actions: 'enrichTab'`
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
      contents: 'action=enrichTab&tabName=new_leads_11_30_25',
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
        action: 'enrichTab', 
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
      contents: `action=enrichTab&tabName=${encodeURIComponent(realTabName)}`,
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
      Logger.log('✅ SUCCESS! Tab was enriched successfully');
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