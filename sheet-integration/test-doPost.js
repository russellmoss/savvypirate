// test-doPost.js
// Local test runner for doPost function

const mocks = require('./mock-data');

// Inject global mocks so the script thinks it's running on Google Apps Script
global.SpreadsheetApp = mocks.SpreadsheetApp;
global.Logger = mocks.Logger;
global.ContentService = mocks.ContentService;
global.UrlFetchApp = mocks.UrlFetchApp;

// Load the Apps Script code
// Note: clasp converts .gs files to .js when you pull
// We'll need to manually copy the doPost function or use a different approach

console.log("=== Testing doPost Function ===\n");

// Mock event object simulating a POST request with form data
const mockFormDataEvent = {
  postData: {
    contents: 'action=cleanTab&tabName=new_leads_11_30_25',
    type: 'application/x-www-form-urlencoded'
  },
  parameter: {} // Empty to simulate Apps Script not auto-parsing
};

// Mock event object simulating a POST request with JSON
const mockJsonEvent = {
  postData: {
    contents: JSON.stringify({ 
      action: 'cleanTab', 
      tabName: 'new_leads_11_30_25'
    }),
    type: 'application/json'
  }
};

// Mock event object for doGet (query parameters)
const mockGetEvent = {
  parameter: {
    action: 'cleanTab',
    tabName: 'new_leads_11_30_25'
  }
};

// Test function - this will be replaced with actual doPost from the cloned script
function testDoPost(event, testName) {
  console.log(`\n--- ${testName} ---`);
  console.log(`Event:`, JSON.stringify(event, null, 2));
  
  try {
    // This will call the actual doPost function once we load it
    if (typeof doPost === 'function') {
      const result = doPost(event);
      const response = result.getContent();
      console.log(`✅ Success! Response:`, response);
      
      // Try to parse as JSON
      try {
        const json = JSON.parse(response);
        console.log(`✅ Parsed JSON:`, JSON.stringify(json, null, 2));
        return json;
      } catch (e) {
        console.log(`⚠️ Response is not JSON:`, response);
        return response;
      }
    } else {
      console.log(`❌ doPost function not found. Make sure to load the script first.`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.error(`Stack:`, error.stack);
    return null;
  }
}

// Test function for doGet
function testDoGet(event, testName) {
  console.log(`\n--- ${testName} ---`);
  console.log(`Event:`, JSON.stringify(event, null, 2));
  
  try {
    if (typeof doGet === 'function') {
      const result = doGet(event);
      const response = result.getContent();
      console.log(`✅ Success! Response:`, response);
      
      try {
        const json = JSON.parse(response);
        console.log(`✅ Parsed JSON:`, JSON.stringify(json, null, 2));
        return json;
      } catch (e) {
        console.log(`⚠️ Response is not JSON:`, response);
        return response;
      }
    } else {
      console.log(`❌ doGet function not found. Make sure to load the script first.`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.error(`Stack:`, error.stack);
    return null;
  }
}

// Export test functions
module.exports = {
  testDoPost,
  testDoGet,
  mockFormDataEvent,
  mockJsonEvent,
  mockGetEvent
};

// If run directly, execute tests
if (require.main === module) {
  console.log("Note: This file requires the actual doPost/doGet functions to be loaded.");
  console.log("After cloning with clasp, you can:");
  console.log("1. Copy doPost/doGet functions into a separate file");
  console.log("2. Require that file here");
  console.log("3. Run: node test-doPost.js");
}

