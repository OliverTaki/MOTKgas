/* ===== helper: include html ===== */
function include(name){
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ===== doGet  ===== */
function doGet(){
  var t=HtmlService.createTemplateFromFile('index');
  return t.evaluate()
          .setTitle('MOTKsheets G-Viewer')
          .addMetaTag('viewport','width=device-width, initial-scale=1');
}

/* ===== Spreadsheet ID ===== */
const SHEET_ID='16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k';

/* ===== GAS APIs ===== */
function getTable(){
  var sh=SpreadsheetApp.openById(SHEET_ID).getSheetByName('SHOTS');
  return sh.getDataRange().getValues();
}
function getFieldMeta(){
  var sh=SpreadsheetApp.openById(SHEET_ID).getSheetByName('FIELD');
  return sh.getDataRange().getValues().slice(1).map(function(r){return {id:r[0],name:r[1],type:r[2]};});
}
function getIdMaps(){
  var ss=SpreadsheetApp.openById(SHEET_ID), maps={shot:{},asset:{},task:{},pm:{},user:{}};
  [['SHOT','shot'],['ASSET','asset'],['TASK','task'],['PM','pm'],['USER','user']].forEach(function(p){
    var sh=ss.getSheetByName(p[0]); if(!sh)return;
    sh.getDataRange().getValues().slice(1).forEach(function(r){maps[p[1]][r[0]]=r[1];});
  });
  return maps;
}
function saveViewConfig(urlKey,json){
  var ss=SpreadsheetApp.openById(SHEET_ID);
  var sh=ss.getSheetByName('VIEW_CFG')||ss.insertSheet('VIEW_CFG');
  var f=sh.createTextFinder(urlKey).findNext(),row=f?f.getRow():sh.getLastRow()+1;
  sh.getRange(row,1,1,4).setValues([[urlKey,Session.getActiveUser().getEmail(),json,new Date()]]);
}
