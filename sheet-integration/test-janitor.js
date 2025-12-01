// test-janitor.js
// Test runner specifically for Cleaner.js (Janitor AI)

const mocks = require('./mock-data');
const fs = require('fs');
const path = require('path');

// Inject global mocks
global.SpreadsheetApp = mocks.SpreadsheetApp;
global.Logger = mocks.Logger;
global.ContentService = mocks.ContentService;
global.UrlFetchApp = mocks.UrlFetchApp;

console.log("=== Testing Janitor AI (Cleaner.js) ===\n");

// Load Cleaner.js in isolation
const cleanerCode = fs.readFileSync(path.join(__dirname, 'Cleaner.js'), 'utf8');

// Execute in a new context to avoid conflicts
const cleanerContext = {
  SpreadsheetApp: mocks.SpreadsheetApp,
  Logger: mocks.Logger,
  ContentService: mocks.ContentService,
  UrlFetchApp: mocks.UrlFetchApp,
  console: console
};

// Create isolated execution
const cleanerWrapper = new Function(
  'SpreadsheetApp', 'Logger', 'ContentService', 'UrlFetchApp', 'console',
  cleanerCode + '\nreturn { doPost, doGet };'
);

let cleanerFunctions;
try {
  cleanerFunctions = cleanerWrapper(
    cleanerContext.SpreadsheetApp,
    cleanerContext.Logger,
    cleanerContext.ContentService,
    cleanerContext.UrlFetchApp,
    console
  );
  console.log("✅ Cleaner.js loaded successfully\n");
} catch (error) {
  console.error("❌ Error loading Cleaner.js:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}

// Test doPost with form data
console.log("--- Test 1: doPost with Form Data ---");
const mockFormDataEvent = {
  postData: {
    contents: 'action=cleanTab&tabName=new_leads_11_30_25',
    type: 'application/x-www-form-urlencoded'
  },
  parameter: {}
};

try {
  const result = cleanerFunctions.doPost(mockFormDataEvent);
  const response = result.getContent();
  console.log("✅ Response:", response.substring(0, 300));
  
  const json = JSON.parse(response);
  console.log("✅ Parsed JSON:", JSON.stringify(json, null, 2));
  
  if (json.success) {
    console.log("\n🎉 SUCCESS! doPost works with form data!");
  } else {
    console.log("\n❌ FAILED:", json.error);
  }
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
}

// Test doGet
console.log("\n--- Test 2: doGet with Query Parameters ---");
const mockGetEvent = {
  parameter: {
    action: 'cleanTab',
    tabName: 'new_leads_11_30_25'
  }
};

try {
  const result = cleanerFunctions.doGet(mockGetEvent);
  const response = result.getContent();
  console.log("✅ Response:", response.substring(0, 300));
  
  const json = JSON.parse(response);
  console.log("✅ Parsed JSON:", JSON.stringify(json, null, 2));
  
  if (json.success) {
    console.log("\n🎉 SUCCESS! doGet works!");
  } else {
    console.log("\n❌ FAILED:", json.error);
  }
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
}

console.log("\n=== Test Complete ===");

