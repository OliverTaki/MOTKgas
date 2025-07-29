/**
 * @fileoverview Server-side logic with a definitive two-phase loading strategy
 * to ensure fast initial rendering and robust caching, preventing timeouts.
 */

// --- Global Constants ---
var SPREADSHEET_ID = '16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k';
var METADATA_CACHE_KEY = 'project_metadata_v33';
var CACHE_EXPIRATION_SECONDS = 300; // 5 minutes

/**
 * [FAST] Fetches only the data essential for the initial, fast render.
 * It only reads the specified sheet and does not touch any others.
 * @param {string} sheetName The name of the sheet to get data from.
 * @return {object} An object with headers and all row data for that single sheet.
 */
function getInitialPageData(sheetName) {
  try {
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (!sh) {
      return { error: 'Sheet "' + sheetName + '" not found.' };
    }

    var allData = sh.getDataRange().getValues();
    var headerData = allData.slice(0, 2);
    var rowData = allData.length > 2 ? allData.slice(2) : [];

    return {
      sheetName: sheetName,
      ids: headerData[0],
      header: headerData[1],
      total: rowData.length,
      rows: rowData,
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * [SLOWER, CACHED] Fetches heavy project metadata (field types, ID maps).
 * This is called in the background by the client after the initial render.
 * @return {object} An object containing fieldMeta and idMaps.
 */
function getProjectMetadata() {
  var cache = CacheService.getUserCache();
  var cached = cache.get(METADATA_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var metadata = {
      fieldMeta: _getFieldMeta(ss),
      idMaps: _getIdMaps(ss)
    };
    
    cache.put(METADATA_CACHE_KEY, JSON.stringify(metadata), CACHE_EXPIRATION_SECONDS);
    return metadata;
  } catch (e) {
    return { error: e.message };
  }
}

// --- Helper Functions to Read from Spreadsheet ---

function _getFieldMeta(ss) {
  var sh = ss.getSheetByName('Fields');
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1).map(function(r) { 
    return { id: r[0], name: r[1], type: r[2], options: r[3] }; 
  });
}

function _getIdMaps(ss) {
  var maps = { shot: {}, asset: {}, task: {}, pm: {}, user: {} };
  var sheetsToMap = [
    ['Shots', 'shot'], ['Assets', 'asset'], ['Tasks', 'task'],
    ['ProjectMembers', 'pm'], ['Users', 'user']
  ];

  sheetsToMap.forEach(function(pair) {
    var sheetName = pair[0], key = pair[1];
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 3) return;
    
    var range = sh.getRange(3, 1, sh.getLastRow() - 2, 2);
    var data = range.getValues();
    
    for (var i = 0; i < data.length; i++) {
        var r = data[i];
        if (r[0] && r[1]) maps[key][r[0]] = r[1];
    }
  });
  return maps;
}

// --- Web App Entry Point ---
function doGet(e) {
  // This just serves the HTML shell. The client will fetch its own data.
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('MOTKsheets G-Viewer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- Templating Helper ---
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
