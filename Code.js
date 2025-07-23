/* ===== helper: include html ===== */
function include(name){
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ===== doGet ===== */
function doGet(e){
  const page = (e && e.parameter && e.parameter.page) || 'Shots';
  const t = HtmlService.createTemplateFromFile('index');
  t.page = page;
  return t.evaluate()
          .setTitle('MOTKsheets G-Viewer')
          .addMetaTag('viewport','width=device-width, initial-scale=1');
}

/* ===== Spreadsheet ID ===== */
const SHEET_ID = '16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k';

/* ===== GAS APIs ===== */
function getTable(page){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const name = page || 'Shots';
  const sh = ss.getSheetByName(name) || ss.getSheets()[0];
  return sh.getDataRange().getValues();
}
function getFieldMeta(){
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Fields');
  return sh.getDataRange().getValues().slice(1)
           .map(r => ({id:r[0],name:r[1],type:r[2]}));
}
function getIdMaps(){
  const ss=SpreadsheetApp.openById(SHEET_ID);
  const maps={shot:{},asset:{},task:{},pm:{},user:{}};
  [['Shots','shot'],['Assets','asset'],['Tasks','task'],
   ['ProjectMembers','pm'],['Users','user']].forEach(([tab,key])=>{
     const sh=ss.getSheetByName(tab); if(!sh)return;
     sh.getDataRange().getValues().slice(1).forEach(r=>{maps[key][r[0]]=r[1];});
  });
  return maps;
}
function saveViewConfig(urlKey,json){
  const ss=SpreadsheetApp.openById(SHEET_ID);
  const sh=ss.getSheetByName('VIEW_CFG')||ss.insertSheet('VIEW_CFG');
  const f=sh.createTextFinder(urlKey).findNext();
  const row=f?f.getRow():sh.getLastRow()+1;
  sh.getRange(row,1,1,4)
    .setValues([[urlKey,Session.getActiveUser().getEmail(),json,new Date()]]);
}
