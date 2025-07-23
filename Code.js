/* ---------- helper : include html ---------- */
function include(name){
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ---------- doGet 入口 ---------- */
function doGet(e){
  var page = (e && e.parameter && e.parameter.page) || 'SHOT';   // デフォルトタブ
  var t = HtmlService.createTemplateFromFile('index');
  t.page = page;               // テンプレ側で <?!= page ?> が使える
  return t.evaluate()
           .setTitle('MOTKsheets G-Viewer')
           .addMetaTag('viewport','width=device-width,initial-scale=1');
}

/* ---------- Spreadsheet ID ---------- */
const SHEET_ID = '16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k';

/* ---------- API: getTable ---------- */
function getTable(page){
  const name = page || 'Shots';                    // ← デフォルトを Shots
  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const sh   = ss.getSheetByName(name);
  if(!sh) throw new Error('Sheet "'+name+'" not found');
  return sh.getDataRange().getValues();
}

/* ---------- FIELD メタ ---------- */
function getFieldMeta(){
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Fields');  // ← Fields
  return sh.getDataRange().getValues().slice(1)
           .map(r => ({id:r[0], name:r[1], type:r[2]}));
}

/* ---------- ID→NAME マップ ---------- */
function getIdMaps(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const maps = {shot:{},asset:{},task:{},pm:{},user:{}};

  [
    ['Shots','shot'],
    ['Assets','asset'],
    ['Tasks','task'],
    ['ProjectMembers','pm'],
    ['Users','user']
  ].forEach(([tab, key])=>{
    const sh = ss.getSheetByName(tab);
    if(!sh) return;
    sh.getDataRange().getValues().slice(1)
      .forEach(r => { maps[key][r[0]] = r[1]; });
  });
  return maps;
}


/**
 * ビュー設定を URL キーで保存（上書き / 追加）
 * VIEW_CFG シート:  A=id(URLkey)  B=user  C=configJSON  D=updated
 */
function saveViewConfig(urlKey, json){
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName('VIEW_CFG') || ss.insertSheet('VIEW_CFG');

  var finder = sh.createTextFinder(urlKey).findNext();
  var row    = finder ? finder.getRow() : sh.getLastRow() + 1;

  sh.getRange(row, 1, 1, 4).setValues([
    [urlKey, Session.getActiveUser().getEmail(), json, new Date()]
  ]);
}

/**
 * ビュー設定を取得（無ければ空文字）
 */
function getViewConfig(urlKey){
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('VIEW_CFG');
  if(!sh) return '';
  var rng = sh.createTextFinder(urlKey).findNext();
  return rng ? rng.offset(0,2).getValue() : '';
}


function debugSheetNames(){
  const ss = SpreadsheetApp.openById('16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k');
  Logger.log(ss.getSheets().map(s => s.getName()));
}
