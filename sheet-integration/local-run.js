const mocks = require('./mock-data');
// Inject global mocks so your script thinks it's on Google
global.SpreadsheetApp = mocks.SpreadsheetApp;
global.Logger = mocks.Logger;

// Import your actual Google Apps Script code
// Note: CLASP converts .gs files to .js locally. 
// If your main file is 'Code.js', require it here.
require('./Code.js'); 

// EXECUTE THE FUNCTION YOU WANT TO TEST
// Change 'myFunction' to whatever function is in your script
console.log("--- Starting Agent Test ---");
try {
  // Call the function from Code.js you want to test
  if (typeof myFunction !== 'undefined') {
    myFunction(); 
  } else {
    console.log("Error: Function not found. Check function name in local-run.js");
  }
} catch (e) {
  console.error(e);
}
console.log("--- Test Complete ---");