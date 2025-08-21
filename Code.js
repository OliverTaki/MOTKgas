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

/**
 * listRowsPage（全件フィルタ＆多重ソート＆ページング）
 * 既存 listRows の上位互換。パラメータ無指定なら従来と同等の順序で返します。
 * リターン形式: { ids:[], header:[], rows:[], total:Number }
 */
function listRowsPage(params) {
  params = params || {};
  var sheetName = String(params.entity || params.sheet || '').trim() || 'Shots';
  var offset = Math.max(0, Number(params.offset || 0));
  var limit  = Math.max(1, Number(params.limit  || 100));
  var sort   = Array.isArray(params.sort)   ? params.sort : [];
  var filter = Array.isArray(params.filter) ? params.filter : [];

  // 1) DataHub優先で読み込み（見つからなければ従来のシート読み）
  var payload = _readFromDataHubOrSheet_(sheetName);

  var ids    = payload.ids;
  var header = payload.header;
  var data   = payload.rows.slice(); // shallow copy

  // 2) 型推定
  var colTypes = _inferTypes_(data, ids);

  // 3) フィルタ（全件）
  if (filter && filter.length) {
    data = data.filter(function(row){
      for (var i=0;i<filter.length;i++){
        var f = filter[i]; if (!f || !f.id || !f.op) continue;
        var colIdx = ids.indexOf(f.id);
        if (colIdx < 0) return false; // 不明列は落とす
        if (!_testFilter_(row[colIdx], f, colTypes[colIdx])) return false;
      }
      return true;
    });
  }

  // 4) 多重ソート（全件）
  if (sort && sort.length) {
    data.sort(function(a,b){
      for (var i=0;i<sort.length;i++){
        var s = sort[i]; if (!s || !s.id) continue;
        var idx = ids.indexOf(s.id); if (idx<0) continue;
        var dir = (String(s.dir||'asc').toLowerCase()==='desc') ? -1 : 1;
        var av = _coerce_(a[idx], colTypes[idx]);
        var bv = _coerce_(b[idx], colTypes[idx]);
        if (av == null && bv == null) continue;
        if (av == null) return -dir;
        if (bv == null) return  dir;
        if (colTypes[idx]==='number'){
          if (av < bv) return -dir;
          if (av > bv) return  dir;
        } else if (colTypes[idx]==='date'){
          var at = (av instanceof Date ? av.getTime() : NaN);
          var bt = (bv instanceof Date ? bv.getTime() : NaN);
          if (at < bt) return -dir;
          if (at > bt) return  dir;
        } else {
          var cmp = String(av).localeCompare(String(bv), 'ja', {numeric:true, sensitivity:'base'});
          if (cmp !== 0) return cmp * dir;
        }
      }
      return 0;
    });
  }

  // 5) total と ページング
  var total = data.length;
  var pageRows = data.slice(offset, offset + limit);

  return { ids: ids, header: header, rows: pageRows, total: total };
}

/* ===== Helpers (衝突を避けるため _ で始める) ===== */

// DataHub → fallback:シート
function _readFromDataHubOrSheet_(sheetName){
  var dh = SpreadsheetApp.getActive().getSheetByName('DataHub');
  if (dh) {
    var all = dh.getDataRange().getValues();
    if (all && all.length) {
      var headerRow = all[0];
      var col = headerRow.indexOf(sheetName);
      if (col >= 0) {
        var dataHubColumn = all.map(function(r){ return r[col]; });
        var fieldIds   = String(dataHubColumn[1] || '').split('|');
        var fieldNames = String(dataHubColumn[2] || '').split('|');
        var dataRows   = dataHubColumn.slice(3)
                          .map(function(r){ return r ? String(r).split('|') : []; })
                          .filter(function(r){ return r.length>0 && String(r[0]||'')!==''; });
        return { ids: fieldIds, header: fieldNames, rows: dataRows };
      }
    }
  }
  // fallback: 通常シート（先頭行=header、2行目以降=data）
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var values = sh ? sh.getDataRange().getValues() : [];
  if (!values || !values.length) return { ids:[], header:[], rows:[] };
  var idsRow    = values[0] || [];
  var namesRow  = values[1] || [];
  var rowsPart  = values.slice(2);
  return { ids: idsRow, header: namesRow, rows: rowsPart };
}

function _inferTypes_(rows, ids){
  var types = [];
  for (var c=0;c<ids.length;c++){
    var t='text';
    for (var r=0;r<Math.min(rows.length, 200); r++){
      var v = rows[r][c];
      if (v === '' || v == null) continue;
      if (typeof v === 'number'){ t='number'; break; }
      if (v instanceof Date){ t='date'; break; }
      var s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) { t='date'; break; }
      if (/^-?\d+(\.\d+)?$/.test(s)) { t='number'; break; }
    }
    types[c]=t;
  }
  return types;
}

function _coerce_(v, t){
  if (v==null || v==='') return null;
  if (t==='number'){
    if (typeof v==='number') return v;
    var n = Number(String(v).replace(/,/g,''));
    return isFinite(n) ? n : null;
  }
  if (t==='date'){
    if (v instanceof Date) return v;
    var d = _parseDate_(String(v));
    return d || null;
  }
  return v;
}

function _testFilter_(cell, f, type){
  var op = String(f.op||'').toLowerCase();
  var raw = cell;
  var val = (f.value==null)? '' : String(f.value);

  // 空判定は共通
  if (op==='isempty')     return (raw==null || String(raw)==='');
  if (op==='isnotempty')  return !(raw==null || String(raw)==='');

  if (type==='date'){
    var d = _coerce_(raw, 'date'); // Date|null
    var now = new Date();
    if (op==='is'){ 
      var t = _coerce_(val, 'date'); 
      if (!t || !d) return false; 
      return _sameDay_(d, t);
    }
    if (op==='isnot'){ 
      var t2 = _coerce_(val, 'date'); 
      if (!t2 || !d) return false; 
      return !_sameDay_(d, t2);
    }
    if (op==='after'){ 
      var a = _coerce_(val, 'date'); 
      if (!d || !a) return false; 
      return d.getTime() > a.getTime(); 
    }
    if (op==='before'){ 
      var b = _coerce_(val, 'date'); 
      if (!d || !b) return false; 
      return d.getTime() < b.getTime(); 
    }
    if (op==='last' || op==='next'){
      var m = String(val||'').match(/^(\d+)([dwm y])$/i);
      if (!m) return false;
      var n = Number(m[1]); var unit = m[2].toLowerCase();
      var sign = (op==='last')? -1 : +1;
      var start = new Date(now);
      var end   = new Date(now);
      if (unit==='d'){ start.setDate(now.getDate() + (sign * -n)); end.setDate(now.getDate() + (sign * n)); }
      if (unit==='w'){ start.setDate(now.getDate() + (sign * -7*n)); end.setDate(now.getDate() + (sign * 7*n)); }
      if (unit==='m'){ start.setMonth(now.getMonth() + (sign * -n)); end.setMonth(now.getMonth() + (sign * n)); }
      if (unit==='y'){ start.setFullYear(now.getFullYear() + (sign * -n)); end.setFullYear(now.getFullYear() + (sign * n)); }
      if (!d) return false;
      if (op==='last') return d.getTime() >= start.getTime() && d.getTime() <= now.getTime();
      else             return d.getTime() >= now.getTime()   && d.getTime() <= end.getTime();
    }
    if (op==='week' || op==='month' || op==='day' || op==='year'){
      if (!d) return false;
      if (op==='week'){
        var mw = String(val||''); // e.g. 2025-W33
        var m2 = mw.match(/^(\d{4})-w(\d{1,2})$/i);
        if (!m2) return false;
        var y = Number(m2[1]), w = Number(m2[2]);
        var range = _isoWeekRange_(y, w);
        return d.getTime() >= range.start.getTime() && d.getTime() < range.end.getTime();
      }
      if (op==='month'){
        var mm = String(val||''); // yyyy-mm
        var mm2 = mm.match(/^(\d{4})-(\d{2})$/);
        if (!mm2) return false;
        var y2 = Number(mm2[1]), m2m = Number(mm2[2]) - 1;
        var st = new Date(y2, m2m, 1), en = new Date(y2, m2m+1, 1);
        return d >= st && d < en;
      }
      if (op==='day'){
        var dd = _coerce_(val, 'date'); if (!dd || !d) return false;
        return _sameDay_(d, dd);
      }
      if (op==='year'){
        var yy = Number(val); if (!isFinite(yy) || !d) return false;
        return d.getFullYear() === yy;
      }
    }
    if (op==='range'){
      var rr = String(val||'').split('..');
      if (rr.length!==2) return false;
      var da = _coerce_(rr[0], 'date'); var db = _coerce_(rr[1], 'date');
      if (!d || !da || !db) return false;
      var aT = da.getTime(), bT = db.getTime(), minT = Math.min(aT,bT), maxT = Math.max(aT,bT);
      return d.getTime() >= minT && d.getTime() <= maxT;
    }
    return true; // 不明opは通す
  }

  // text/select/link
  var sRaw = (raw==null)? '' : String(raw);
  var sVal = String(val||'');
  if (op==='is')         return sRaw === sVal;
  if (op==='isnot')      return sRaw !== sVal;
  if (op==='contains')   return sRaw.toLowerCase().indexOf(sVal.toLowerCase()) !== -1;
  if (op==='notcontains')return sRaw.toLowerCase().indexOf(sVal.toLowerCase()) === -1;

  return true; // 不明opは通す
}

function _sameDay_(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// yyyy-mm-dd / yyyy/mm/dd / ISO の簡易パース
function _parseDate_(s){
  if (!s) return null;
  try{
    if (s instanceof Date) return s;
    var m = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(m) || /^\d{4}\/\d{2}\/\d{2}/.test(m)) return new Date(m);
    var d = new Date(m);
    if (!isNaN(d.getTime())) return d;
  }catch(e){}
  return null;
}

// ISO week → [start, end)
function _isoWeekRange_(year, week){
  // Thursday-base
  var simple = new Date(year, 0, 1 + (week - 1) * 7);
  var dow = simple.getDay(); // 0=Sun..6=Sat
  var ISOweekStart = new Date(simple);
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else          ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  var ISOweekEnd = new Date(ISOweekStart); ISOweekEnd.setDate(ISOweekStart.getDate() + 7);
  return { start: ISOweekStart, end: ISOweekEnd };
}
