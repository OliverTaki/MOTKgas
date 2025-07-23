/* include helper ---------------------------------------------------------- */
function include(n){ return HtmlService.createHtmlOutputFromFile(n).getContent(); }

/* doGet ------------------------------------------------------------------- */
function doGet(e){
  const page=(e&&e.parameter&&e.parameter.page)||'Shots';
  const t=HtmlService.createTemplateFromFile('index'); t.page=page;
  return t.evaluate().setTitle('MOTKsheets G-Viewer')
          .addMetaTag('viewport','width=device-width,initial-scale=1');
}

/* Spreadsheet ------------------------------------------------------------- */
const SID='16PYUZyI3E1CKtkeK6jokBFq7ElaVOtWIWuLMJGxxp_k';

/* メタ（header・総行数） */
function getMeta(sheetName){
  const sh=SpreadsheetApp.openById(SID).getSheetByName(sheetName);
  const vals=sh.getRange(1,1,2,sh.getLastColumn()).getValues(); // 1:ID, 2:NAMES
  return {ids:vals[0], header:vals[1], rows:sh.getLastRow()-2};
}

/* 任意ページ取得 (offset=0 ベース) */
function getPage(sheetName, offset, limit){
  const sh=SpreadsheetApp.openById(SID).getSheetByName(sheetName);
  const start=offset+3;                              // データは 3 行目から
  const rows=Math.min(limit, sh.getLastRow()-offset-2);
  return sh.getRange(start,1,rows,sh.getLastColumn()).getValues();
}

/* FIELD 型 --------------------------------------------------------------- */
function getFieldMeta(){
  const sh=SpreadsheetApp.openById(SID).getSheetByName('Fields');
  return sh.getDataRange().getValues().slice(1).map(r=>({id:r[0],name:r[1],type:r[2]}));
}

/* ID→NAME マップ --------------------------------------------------------- */
function getIdMaps(){
  const maps={shot:{},asset:{},task:{},pm:{},user:{}};
  const ss=SpreadsheetApp.openById(SID);
  [['Shots','shot'],['Assets','asset'],['Tasks','task'],
   ['ProjectMembers','pm'],['Users','user']].forEach(([tab,key])=>{
     const sh=ss.getSheetByName(tab); if(!sh)return;
     sh.getDataRange().getValues().slice(1).forEach(r=>maps[key][r[0]]=r[1]);
  });
  return maps;
}

function getInitData(sheetName, offset, limit){
  const ss  = SpreadsheetApp.openById(SID);
  const sh  = ss.getSheetByName(sheetName);
  const ids = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const header = sh.getRange(2,1,1,sh.getLastColumn()).getValues()[0];
  const total  = sh.getLastRow() - 2;                     // ← 先に行数確定
  const num    = Math.min(limit, total - offset);         // 実際に取る行
  const rows   = sh.getRange(offset+3, 1, num, sh.getLastColumn()).getValues();

  // FIELD + ID MAP を CacheService (5 分) に載せる
  const cache = CacheService.getScriptCache();
  let fieldMeta = JSON.parse(cache.get('fieldMeta')||'null');
  let idMaps    = JSON.parse(cache.get('idMaps')||'null');
  if(!fieldMeta){
    fieldMeta = getFieldMeta();            // 既存関数を再利用
    cache.put('fieldMeta',JSON.stringify(fieldMeta),300);
  }
  if(!idMaps){
    idMaps=getIdMaps();                    // 既存関数
    cache.put('idMaps',JSON.stringify(idMaps),300);
  }
  return {ids,header,total,rows,fieldMeta,idMaps};
}
