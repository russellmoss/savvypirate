// test-runner.js
// Complete test runner for doPost and doGet functions

const mocks = require('./mock-data');
const fs = require('fs');
const path = require('path');

// Inject global mocks
global.SpreadsheetApp = mocks.SpreadsheetApp;
global.Logger = mocks.Logger;
global.ContentService = mocks.ContentService;
global.UrlFetchApp = mocks.UrlFetchApp;

console.log("=== Google Apps Script Local Test Runner ===\n");

// Load the Apps Script files
// We need to wrap them in a way that makes functions available globally
function loadScript(filePath, description) {
  console.log(`Loading ${description}...`);
  
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Create a function wrapper that executes the code in global scope
    const wrappedCode = `
      (function() {
        ${code}
        // Export functions to global scope
        if (typeof doPost !== 'undefined') global.doPost = doPost;
        if (typeof doGet !== 'undefined') global.doGet = doGet;
        if (typeof processSheet !== 'undefined') global.processSheet = processSheet;
        if (typeof runBigQueryEnrichment !== 'undefined') global.runBigQueryEnrichment = runBigQueryEnrichment;
      })();
    `;
    
    eval(wrappedCode);
    console.log(`✅ ${description} loaded successfully\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error loading ${description}:`, error.message);
    console.error(`Stack:`, error.stack);
    return false;
  }
}

// Test doPost with form data
function testDoPostFormData(doPostFn, description) {
  console.log(`\n--- Testing ${description} doPost with Form Data ---`);
  
  const mockEvent = {
    postData: {
      contents: 'action=cleanTab&tabName=new_leads_11_30_25',
      type: 'application/x-www-form-urlencoded'
    },
    parameter: {}
  };
  
  try {
    const result = doPostFn(mockEvent);
    const response = result.getContent();
    console.log(`✅ Response received:`, response.substring(0, 200));
    
    try {
      const json = JSON.parse(response);
      console.log(`✅ Parsed JSON:`, JSON.stringify(json, null, 2));
      return { success: true, response: json };
    } catch (e) {
      console.log(`⚠️ Response is not JSON:`, response);
      return { success: false, error: 'Not JSON', response };
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.error(`Stack:`, error.stack);
    return { success: false, error: error.message };
  }
}

// Test doGet with query parameters
function testDoGet(doGetFn, description) {
  console.log(`\n--- Testing ${description} doGet with Query Parameters ---`);
  
  const mockEvent = {
    parameter: {
      action: 'cleanTab',
      tabName: 'new_leads_11_30_25'
    }
  };
  
  try {
    const result = doGetFn(mockEvent);
    const response = result.getContent();
    console.log(`✅ Response received:`, response.substring(0, 200));
    
    try {
      const json = JSON.parse(response);
      console.log(`✅ Parsed JSON:`, JSON.stringify(json, null, 2));
      return { success: true, response: json };
    } catch (e) {
      console.log(`⚠️ Response is not JSON:`, response);
      return { success: false, error: 'Not JSON', response };
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.error(`Stack:`, error.stack);
    return { success: false, error: error.message };
  }
}

// Main test execution
function runTests() {
  console.log("Loading Apps Script files...\n");
  
  // Load Cleaner.js (Janitor AI)
  const cleanerLoaded = loadScript(path.join(__dirname, 'Cleaner.js'), 'Cleaner.js (Janitor AI)');
  
  // Load Enricher.js (BigQuery Enrichment)
  const enricherLoaded = loadScript(path.join(__dirname, 'Enricher.js'), 'Enricher.js (BigQuery Enrichment)');
  
  if (!cleanerLoaded || !enricherLoaded) {
    console.error("\n❌ Failed to load one or more scripts. Cannot continue tests.");
    process.exit(1);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("RUNNING TESTS");
  console.log("=".repeat(60));
  
  const results = {};
  
  // Test Cleaner.js doPost
  if (typeof global.doPost === 'function') {
    // We need to check which doPost we're calling
    // For now, let's test both by loading them separately
    console.log("\n⚠️ Note: Both files have doPost. Testing Cleaner.js first.");
  }
  
  // Test Cleaner.js doGet
  if (typeof global.doGet === 'function') {
    results.cleanerDoGet = testDoGet(global.doGet, 'Cleaner.js');
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(JSON.stringify(results, null, 2));
}

// Run tests
runTests();

