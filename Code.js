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

/* ---------- GAS APIs ---------- */

/**
 * 指定ページのテーブルを返す  
 * @param {string=} page 例: "SHOT" / "ASSET" / … 省略時 "SHOT"
 * @return {Array<Array<any>>}
 */
function getTable(page){
  var name = page || 'SHOT';                        // デフォルト
  var ss   = SpreadsheetApp.openById(SHEET_ID);
  var sh   = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet "'+name+'" not found');
  return sh.getDataRange().getValues();
}

/**
 * FIELD タブのメタ情報 (id, name, type) を返す
 * @return {Array<{id:string,name:string,type:string}>}
 */
function getFieldMeta(){
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('FIELD');
  return sh.getDataRange().getValues().slice(1).map(function(r){
    return {id:r[0], name:r[1], type:r[2]};
  });
}

/**
 * 各エンティティの id→name マップ
 * @return {Object} {shot:{}, asset:{}, task:{}, pm:{}, user:{}}
 */
function getIdMaps(){
  var maps = {shot:{}, asset:{}, task:{}, pm:{}, user:{}};
  var ss   = SpreadsheetApp.openById(SHEET_ID);
  [
    ['SHOT','shot'],
    ['ASSET','asset'],
    ['TASK','task'],
    ['PM','pm'],
    ['USER','user']
  ].forEach(function(pair){
    var sh = ss.getSheetByName(pair[0]);
    if(!sh) return;
    sh.getDataRange().getValues().slice(1).forEach(function(r){
      maps[pair[1]][r[0]] = r[1];   // id -> name
    });
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
