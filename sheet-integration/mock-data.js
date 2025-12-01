// mock-data.js
// This creates a fake version of Google Apps Script APIs for local testing

module.exports = {
  SpreadsheetApp: {
    flush: () => {
      console.log('[MOCK] SpreadsheetApp.flush() called');
    },
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => {
        const mockSheet = {
          name: name,
          data: [],
          getName: () => name,
          getLastRow: () => mockSheet.data.length > 0 ? mockSheet.data.length + 1 : 1,
          getLastColumn: () => {
            if (mockSheet.data.length === 0) return 1;
            return Math.max(...mockSheet.data.map(r => r ? r.length : 0), 1);
          },
          getRange: (row, col, numRows = 1, numCols = 1) => ({
            getValue: () => {
              if (row <= mockSheet.data.length && col <= mockSheet.data[row - 1]?.length) {
                return mockSheet.data[row - 1][col - 1];
              }
              return "";
            },
            setValue: (val) => {
              console.log(`[MOCK] setValue(${row}, ${col}): ${val}`);
              if (!mockSheet.data[row - 1]) mockSheet.data[row - 1] = [];
              mockSheet.data[row - 1][col - 1] = val;
            },
            getValues: () => {
              const values = [];
              for (let r = 0; r < numRows; r++) {
                const row = [];
                for (let c = 0; c < numCols; c++) {
                  const val = mockSheet.data[row + r - 1]?.[col + c - 1] || "";
                  row.push(val);
                }
                values.push(row);
              }
              return values;
            },
            setValues: (values) => {
              console.log(`[MOCK] setValues(${row}, ${col}, ${numRows}x${numCols}):`, values);
              values.forEach((rowData, r) => {
                if (!mockSheet.data[row + r - 1]) mockSheet.data[row + r - 1] = [];
                rowData.forEach((val, c) => {
                  mockSheet.data[row + r - 1][col + c - 1] = val;
                });
              });
            }
          }),
          appendRow: (rowArray) => {
            console.log(`[MOCK] appendRow to "${name}":`, rowArray);
            mockSheet.data.push([...rowArray]);
            return mockSheet.data.length;
          },
          getDataRange: () => ({
            getValues: () => mockSheet.data,
            getNumRows: () => mockSheet.data.length,
            getNumColumns: () => Math.max(...mockSheet.data.map(r => r.length), 0)
          }),
          activate: () => {
            console.log(`[MOCK] Activated sheet: ${name}`);
          },
          deleteRow: (row) => {
            console.log(`[MOCK] deleteRow(${row}) from "${name}"`);
            mockSheet.data.splice(row - 1, 1);
          },
          insertRow: (row) => {
            console.log(`[MOCK] insertRow(${row}) in "${name}"`);
            mockSheet.data.splice(row - 1, 0, []);
          }
        };
        return mockSheet;
      },
      getActiveSheet: () => ({
        getName: () => "ActiveSheet",
        activate: () => console.log("[MOCK] Activated active sheet")
      }),
      getSheets: () => [
        { getName: () => "Sheet1" },
        { getName: () => "new_leads_11_30_25" }
      ]
    })
  },
  
  Logger: {
    log: (msg) => console.log(`[LOG]: ${msg}`)
  },
  
  ContentService: {
    createTextOutput: (text) => ({
      getContent: () => text,
      setMimeType: (mimeType) => ({
        getContent: () => text,
        getMimeType: () => mimeType
      })
    }),
    MimeType: {
      JSON: "application/json",
      TEXT: "text/plain"
    }
  },
  
  UrlFetchApp: {
    fetch: (url, options) => {
      console.log(`[MOCK] UrlFetchApp.fetch(${url})`);
      return {
        getContentText: () => JSON.stringify({ success: true, message: "Mock response" }),
        getResponseCode: () => 200
      };
    }
  }
};
