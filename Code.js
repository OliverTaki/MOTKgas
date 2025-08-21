/** =========================================
 *  Code.js
 *  - include(): HTMLサブテンプレ取り込み
 *  - doGet(e): Webアプリ入口（index / Detail）
 *  - listRows(sheetName): 互換API（DataHub最優先）
 *  - listRowsPage({entity,offset,limit}): サーバページング（非空行 total・5分キャッシュ）
 *  - dh_healthCheck(entity): DataHub健全性チェック
 * =========================================*/

var __VIEW_CTX = {
  scriptUrl: '',
  page:      '',
  entity:    '',
  id:        '',
  dataJson:  '[]'
};

function include(filename) {
  var t = HtmlService.createTemplateFromFile(filename);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];
  return t.evaluate().getContent();
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'app-bundle') {
    return ContentService.createTextOutput('// ok')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  __VIEW_CTX.scriptUrl = ScriptApp.getService().getUrl();
  __VIEW_CTX.page   = p.page   || 'Shots';
  __VIEW_CTX.entity = (p.entity||'').toLowerCase();
  __VIEW_CTX.id     = p.id     || '';

  var templateName, title;
  if (__VIEW_CTX.entity && __VIEW_CTX.id) {
    // ディテールはクライアント側でAPI呼ぶため埋め込みデータは空でOK
    templateName = 'DetailShot';
    title = __VIEW_CTX.entity + ':' + __VIEW_CTX.id;
    __VIEW_CTX.dataJson = '[]';
  } else {
    templateName = 'index';
    title = 'MOTK Sheets';
    // ★ 初期HTML生成を軽量化：サーバで全量を埋め込まない
    __VIEW_CTX.dataJson = '[]';
  }

  var t = HtmlService.createTemplateFromFile(templateName);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];

  var out = t.evaluate();
  out.setTitle(title);
  out.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return out;
}

/* =========================
 *  DataHub ユーティリティ
 * =========================*/

function _norm_(s){
  return String(s||'')
    .replace(/\u3000/g,' ')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .trim().toLowerCase()
    .replace(/[\s_]/g,'')
    .replace(/s$/, '');
}

function _hubFindEntityCol_(hubSheet, entityLabel){
  var lastCol = hubSheet.getLastColumn();
  if (lastCol < 1) return -1;
  var headerRow = hubSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var target = _norm_(entityLabel);
  for (var c=0; c<headerRow.length; c++){
    if (_norm_(headerRow[c]) === target) return c+1;
  }
  return -1;
}

/** ===== DataHub 読み取り（全量・互換） ===== */
function _hubReadBlockAll_(hubSheet, col){
  var lastRow = hubSheet.getLastRow();
  if (lastRow < 3) return [[],[]];
  var fiStr = String(hubSheet.getRange(2, col).getValue() || '');
  var hnStr = String(hubSheet.getRange(3, col).getValue() || '');
  if (!fiStr || !hnStr) return [[],[]];

  var ids = fiStr.split('|').map(function(s){ return String(s||'').trim(); });
  var names = hnStr.split('|').map(function(s){ return String(s||'').trim(); });

  var out = [ids, names];
  if (lastRow >= 4){
    var vals = hubSheet.getRange(4, col, lastRow-3, 1).getValues();
    for (var r=0; r<vals.length; r++){
      var line = String(vals[r][0]||'');
      if (line==='') continue;
      var a = line.split('|');
      if (a.length < ids.length) a = a.concat(new Array(ids.length - a.length).fill(''));
      else if (a.length > ids.length) a = a.slice(0, ids.length);
      out.push(a);
    }
  }
  return out;
}

/** ===== DataHub 読み取り（ページング・非空 total・5分キャッシュ） ===== */
function _hubReadBlockPage_(hubSheet, col, offset, limit){
  var lastRow = hubSheet.getLastRow();
  if (lastRow < 3) return {ids:[], header:[], rows:[], total:0};

  var fiStr = String(hubSheet.getRange(2, col).getValue() || '');
  var hnStr = String(hubSheet.getRange(3, col).getValue() || '');
  if (!fiStr || !hnStr) return {ids:[], header:[], rows:[], total:0};

  var ids   = fiStr.split('|').map(function(s){ return String(s||'').trim(); });
  var names = hnStr.split('|').map(function(s){ return String(s||'').trim(); });

  var baseRow = 4;
  var n = Math.max(0, lastRow - (baseRow - 1));
  if (n === 0) return { ids:ids, header:names, rows:[], total:0 };

  var cache = CacheService.getScriptCache();
  var key = 'dh_total:' + SpreadsheetApp.getActive().getId() + ':' + col;
  var cached = cache.get(key);
  var total;

  if (cached != null) {
    total = parseInt(cached, 10) || 0;
  } else {
    var allVals = hubSheet.getRange(baseRow, col, n, 1).getValues();
    total = 0;
    for (var i=0; i<allVals.length; i++){
      if (String(allVals[i][0]||'').trim()!=='') total++;
    }
    cache.put(key, String(total), 300); // 5分キャッシュ
  }

  // ページ範囲抽出（非空のみカウント）
  var vals = hubSheet.getRange(baseRow, col, n, 1).getValues();
  var rows = [];
  var seen = 0;
  for (var r=0; r<vals.length; r++){
    var line = String(vals[r][0]||'').trim();
    if (line==='') continue;
    if (seen >= offset && rows.length < limit){
      var a = line.split('|');
      if (a.length < ids.length) a = a.concat(new Array(ids.length - a.length).fill(''));
      else if (a.length > ids.length) a = a.slice(0, ids.length);
      rows.push(a);
    }
    seen++;
    if (rows.length>=limit) break;
  }

  return { ids: ids, header: names, rows: rows, total: total };
}

/* =========================
 *  Sheet 直読み（互換 & ページ）
 * =========================*/

function _sheetRead2HeaderAll_(sheet){
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [[],[]];
  var vals = sheet.getRange(1,1,lastRow,lastCol).getValues();
  var ids = vals[0].map(function(s){ return String(s||'').trim(); });
  var names = vals[1].map(function(s){ return String(s||'').trim(); });
  var out = [ids, names];
  for (var r=2; r<vals.length; r++){
    var row = vals[r];
    var nonEmpty = row.some(function(v){ return v!=='' && v!=null; });
    if (!nonEmpty) continue;
    out.push(row.map(function(v){ return v==null?'':String(v); }));
  }
  return out;
}

/** Sheet 版ページング：total は非空行のみ */
function _sheetRead2HeaderPage_(sheet, offset, limit){
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return {ids:[], header:[], rows:[], total:0};

  var ids   = sheet.getRange(1,1,1,lastCol).getValues()[0].map(function(s){ return String(s||'').trim(); });
  var names = sheet.getRange(2,1,1,lastCol).getValues()[0].map(function(s){ return String(s||'').trim(); });

  var baseRow = 3;
  if (lastRow < baseRow) return { ids:ids, header:names, rows:[], total:0 };

  var dataVals = sheet.getRange(baseRow,1,lastRow-baseRow+1,lastCol).getValues();

  var total = 0;
  for (var i=0;i<dataVals.length;i++){
    var row = dataVals[i];
    var nonEmpty = row.some(function(v){ return v!=='' && v!=null; });
    if (nonEmpty) total++;
  }

  var rows = [];
  var seen = 0;
  for (var r=0; r<dataVals.length; r++){
    var row = dataVals[r];
    var nonEmpty = row.some(function(v){ return v!=='' && v!=null; });
    if (!nonEmpty) continue;
    if (seen >= offset && rows.length < limit){
      rows.push(row.map(function(v){ return v==null?'':String(v); }));
    }
    seen++;
    if (rows.length>=limit) break;
  }

  return { ids:ids, header:names, rows:rows, total:total };
}

/* =========================
 *  公開API
 * =========================*/

function listRows(sheetName){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var entityLabel = String(sheetName||'');

  var hub = ss.getSheetByName('DataHub');
  if (hub){
    var col = _hubFindEntityCol_(hub, entityLabel);
    if (col > 0){
      try{ return _hubReadBlockAll_(hub, col); }catch(e){}
    }
  }
  var candidates = _normSheetCandidates_(entityLabel);
  for (var i=0;i<candidates.length;i++){
    var sh = ss.getSheetByName(candidates[i]);
    if (sh) return _sheetRead2HeaderAll_(sh);
  }
  return [[],[]];
}

function _normSheetCandidates_(label){
  var base = String(label||'');
  var s = _norm_(base);
  var caps = function(x){ return x.charAt(0).toUpperCase()+x.slice(1); };
  var sg = s; var pl = s + 's';
  return [ base, caps(s), s.toUpperCase(), s, caps(pl), pl.toUpperCase(), pl ]
    .filter(function(v, i, a){ return v && a.indexOf(v)===i; });
}

function listRowsPage(arg){
  var entity = (arg && arg.entity) ? String(arg.entity) : '';
  var offset = Math.max(0, (arg && arg.offset)|0);
  var limit  = Math.max(1, (arg && arg.limit)|0) || 100;

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var hub = ss.getSheetByName('DataHub');
  if (hub){
    var col = _hubFindEntityCol_(hub, entity);
    if (col > 0){
      try{ return _hubReadBlockPage_(hub, col, offset, limit); }catch(e){}
    }
  }
  var candidates = _normSheetCandidates_(entity);
  for (var i=0;i<candidates.length;i++){
    var sh = ss.getSheetByName(candidates[i]);
    if (sh) return _sheetRead2HeaderPage_(sh, offset, limit);
  }
  return {ids:[], header:[], rows:[], total:0};
}

function dh_healthCheck(entityLabel){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var res = { entity:String(entityLabel||''), hubSheet:false, columnFound:false, col:-1, idsLen:0, rowsLen:0, error:'' };
  try{
    var hub = ss.getSheetByName('DataHub');
    res.hubSheet = !!hub;
    if (!hub) return res;
    var col = _hubFindEntityCol_(hub, entityLabel);
    res.columnFound = col>0; res.col = col;
    if (!res.columnFound) return res;
    var lastRow = hub.getLastRow();
    var fiStr = String(hub.getRange(2, col).getValue()||'');
    var hnStr = String(hub.getRange(3, col).getValue()||'');
    if (!fiStr || !hnStr){ res.error='empty header'; return res; }
    var ids = fiStr.split('|'); res.idsLen = ids.length;

    var baseRow = 4;
    var n = Math.max(0, lastRow - (baseRow - 1));
    var rowsLen = 0;
    if (n>0){
      var all = hub.getRange(baseRow, col, n, 1).getValues();
      for (var i=0;i<all.length;i++){ if (String(all[i][0]||'').trim()!=='') rowsLen++; }
    }
    res.rowsLen = rowsLen;
    return res;
  }catch(e){
    res.error = String(e&&e.message||e);
    return res;
  }
}
