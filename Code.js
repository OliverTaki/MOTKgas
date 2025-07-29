/**
 * @fileoverview This file contains the server-side logic for the web app.
 * It handles HTTP GET requests, serves the main HTML page, and provides
 * functions to fetch data from the Google Sheet.
 */

// --- Global Constants ---
const SPREADSHEET_ID = '16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k'; // Use the actual ID of your spreadsheet

/**
 * Serves an HTML file as a template.
 * This function is a utility to include HTML content from other files.
 * @param {string} filename - The name of the HTML file to include.
 * @returns {string} The content of the HTML file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Handles HTTP GET requests to the web app.
 * It creates the main UI from the 'index.html' template.
 * @param {GoogleAppsScript.Events.DoGet} e - The event parameter.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} The HTML output for the browser.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');
  // Pass the initial page parameter to the template if it exists
  template.page = e.parameter.page || 'Shots'; 
  
  return template.evaluate()
    .setTitle('MOTKsheets G-Viewer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Fetches all necessary initial data for the client-side application.
 * This includes headers, row data, field metadata, and ID-to-name maps.
 * It uses CacheService to improve performance by caching repeated requests.
 * @param {string} sheetName - The name of the sheet to get data from.
 * @param {number} offset - The starting row offset for pagination.
 * @param {number} limit - The number of rows to retrieve.
 * @returns {object} An object containing all the initial data for the grid.
 */
function getInitData(sheetName, offset, limit) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  
  if (!sh) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }

  const headerData = sh.getRange(1, 1, 2, sh.getLastColumn()).getValues();
  const ids = headerData[0];
  const header = headerData[1];
  const total = sh.getLastRow() - 2; // Subtract header rows
  
  const numRowsToFetch = Math.max(0, Math.min(limit, total - offset));
  let rows = [];
  if (numRowsToFetch > 0) {
      rows = sh.getRange(offset + 3, 1, numRowsToFetch, sh.getLastColumn()).getValues();
  }

  // Use CacheService for metadata to speed up initialization
  const cache = CacheService.getScriptCache();
  
  let fieldMeta = JSON.parse(cache.get('fieldMeta') || 'null');
  if (!fieldMeta) {
    fieldMeta = getFieldMeta();
    cache.put('fieldMeta', JSON.stringify(fieldMeta), 300); // Cache for 5 minutes
  }
  
  let idMaps = JSON.parse(cache.get('idMaps') || 'null');
  if (!idMaps) {
    idMaps = getIdMaps();
    cache.put('idMaps', JSON.stringify(idMaps), 300); // Cache for 5 minutes
  }

  return { ids, header, total, rows, fieldMeta, idMaps };
}

/**
 * Fetches a specific page of data from a sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {number} offset - The starting row offset.
 * @param {number} limit - The number of rows to retrieve.
 * @returns {Array<Array<any>>} A 2D array of the requested row data.
 */
function getPage(sheetName, offset, limit) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sh) return [];
  
  const startRow = offset + 3; // Data starts from row 3
  const numRows = Math.min(limit, sh.getLastRow() - startRow + 1);
  if (numRows <= 0) return [];

  return sh.getRange(startRow, 1, numRows, sh.getLastColumn()).getValues();
}

/**
 * Retrieves metadata for all fields from the 'Fields' sheet.
 * @returns {Array<object>} An array of field metadata objects.
 */
function getFieldMeta() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Fields');
  if (!sh) return [];
  // Assumes data starts at row 2, with row 1 being headers
  return sh.getDataRange().getValues().slice(1).map(r => ({ id: r[0], name: r[1], type: r[2], options: r[3] }));
}

/**
 * Creates maps to resolve IDs to names for linked data.
 * @returns {object} An object containing maps for different entity types.
 */
function getIdMaps() {
  const maps = { shot: {}, asset: {}, task: {}, pm: {}, user: {} };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetsToMap = [
    ['Shots', 'shot'],
    ['Assets', 'asset'],
    ['Tasks', 'task'],
    ['ProjectMembers', 'pm'],
    ['Users', 'user']
  ];

  sheetsToMap.forEach(([sheetName, key]) => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    // Assumes ID is in column 1 and Name is in column 2
    sh.getDataRange().getValues().slice(2).forEach(r => {
      if (r[0] && r[1]) { // Ensure ID and Name exist
        maps[key][r[0]] = r[1];
      }
    });
  });
  return maps;
}
