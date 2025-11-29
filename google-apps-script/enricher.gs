// ==========================================
// PHASE 19: "THE CRM DEEP SEARCH" (Token Match + Full CRM History)
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

    -- B. PREPARE SHEET DATA
    WITH sheet_data AS (
      SELECT 
        *, 
        CleanName(search_name) as clean_search_name,
        LOWER(REGEXP_REPLACE(search_url, r'^(https?://)?(www\\.)?linkedin\\.com/in/|/$|\\?.*$|/en$|/de$', '')) as sheet_linkedin_slug,
        SPLIT(CleanName(search_name), ' ')[SAFE_OFFSET(0)] as input_first,
        SPLIT(CleanName(search_name), ' ')[SAFE_OFFSET(ARRAY_LENGTH(SPLIT(CleanName(search_name), ' ')) - 1)] as input_last
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
        LOWER(REGEXP_REPLACE(SocialMedia_LinkedIn, r'^(https?://)?(www\\.)?linkedin\\.com/in/|/$|\\?.*$|/en$|/de$', '')) as db_linkedin_slug
      FROM warehouse_data
    ),

    -- E. PERFORM MATCHING
    matched_leads AS (
      SELECT 
        s.row_id,
        CASE
          WHEN s.search_url <> '' AND w.db_linkedin_slug = s.sheet_linkedin_slug THEN '1. LinkedIn Match'
          WHEN s.clean_search_name = w.clean_full_name THEN '2. Exact Name Match'
          WHEN STRPOS(w.clean_full_name, s.input_first) > 0 
               AND STRPOS(w.clean_full_name, s.input_last) > 0
               AND (STRPOS(s.search_location, w.Branch_City) > 0 OR STRPOS(s.search_location, w.Branch_State) > 0)
          THEN '3. Token Match + Location'
          WHEN STRPOS(w.clean_full_name, s.input_first) > 0 
               AND STRPOS(w.clean_full_name, s.input_last) > 0
          THEN '4. Token Match (No Loc)'
          ELSE '5. Weak Fuzzy Match'
        END as MatchType,
        
        w.* -- Select all warehouse fields
        
      FROM sheet_data s
      JOIN warehouse_clean w
        ON (
          (s.search_url <> '' AND w.db_linkedin_slug = s.sheet_linkedin_slug)
          OR 
          (
             s.search_url = '' AND 
             (
                s.clean_search_name = w.clean_full_name
                OR 
                (STRPOS(w.clean_full_name, s.input_first) > 0 AND STRPOS(w.clean_full_name, s.input_last) > 0)
             )
          )
        )
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY s.row_id 
        ORDER BY 
          CASE 
            WHEN s.search_url <> '' AND w.db_linkedin_slug = s.sheet_linkedin_slug THEN 1
            WHEN s.clean_search_name = w.clean_full_name AND (STRPOS(s.search_location, w.Branch_City) > 0) THEN 2
            WHEN STRPOS(w.clean_full_name, s.input_first) > 0 AND STRPOS(w.clean_full_name, s.input_last) > 0 AND (STRPOS(s.search_location, w.Branch_City) > 0) THEN 3
            ELSE 4 
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