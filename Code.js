/**
 * @fileoverview A simplified and robust server-side script.
 * It uses a single function to fetch all necessary data and embed it
 * directly into the HTML to ensure pages always load correctly.
 * This approach follows the "server-prepares-all" model.
 */

// --- Global Constants ---
var SPREADSHEET_ID = '16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k';

// --- Web App Entry Point ---
function doGet(e) {
  var pageName = e.parameter.page || 'dashboard';
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var dataToEmbed;

  if (pageName.toLowerCase() === 'dashboard') {
    dataToEmbed = getDashboardDataPackage(ss);
  } else {
    dataToEmbed = getTableDataPackage(ss, pageName);
  }

  var template = HtmlService.createTemplateFromFile('index');
  template.data = JSON.stringify(dataToEmbed);
  
  // ★★★ この行で、サーバーのURLをクライアントに渡します ★★★
  template.scriptUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle('MOTKsheets G-Viewer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Fetches data for the main table view (Shots, Assets, etc.).
 */
function getTableDataPackage(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    return { 
      pageType: 'table',
      error: 'Sheet "' + sheetName + '" not found.' 
    };
  }

  var allData = sh.getDataRange().getValues();
  var headerData = allData.slice(0, 2);
  var rowData = allData.length > 2 ? allData.slice(2) : [];
  
  var fieldMeta = _getFieldMeta(ss);
  var idMaps = _getIdMaps(ss);

  return {
    pageType: 'table',
    sheetName: sheetName,
    ids: headerData[0],
    header: headerData[1],
    total: rowData.length,
    rows: rowData,
    fieldMeta: fieldMeta,
    idMaps: idMaps
  };
}

/**
 * Fetches summary data for the Dashboard view.
 */
function getDashboardDataPackage(ss) {
    var shotSheet = ss.getSheetByName('Shots');
    var assetSheet = ss.getSheetByName('Assets');
    var taskSheet = ss.getSheetByName('Tasks');

    var shotCount = shotSheet ? Math.max(0, shotSheet.getLastRow() - 2) : 0;
    var assetCount = assetSheet ? Math.max(0, assetSheet.getLastRow() - 2) : 0;
    var taskCount = taskSheet ? Math.max(0, taskSheet.getLastRow() - 2) : 0;

    return {
        pageType: 'dashboard',
        counts: {
            shots: shotCount,
            assets: assetCount,
            tasks: taskCount
        }
    };
}


// --- Helper Functions ---
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
        if (r[0] && r[1]) {
          maps[key][r[0]] = r[1];
        }
    }
  });
  return maps;
}

// --- Templating Helper ---
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
