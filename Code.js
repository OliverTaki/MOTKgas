/** =========================================
 *  Code.gs (ナンバリング整理版)
 *  - doGet に DebugPanel ページ追加
 *  - 他の処理は現状維持
 * =========================================*/


/* ===== 1. グローバルコンテキスト ===== */
var __VIEW_CTX = { scriptUrl:'', page:'', entity:'', id:'', dataJson:'[]' };
/* ===== 1. End ===== */


/* ===== 2. include (HTML 部品読込) ===== */
function include(filename) {
  var t = HtmlService.createTemplateFromFile(filename);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];
  return t.evaluate().getContent();
}
/* ===== 2. End ===== */

/* ===== 3. doGet Router（差し替え・全文） ===== */

var __VIEW_CTX = { scriptUrl:'', page:'', entity:'', id:'', dataJson:'[]' };

function include(filename) {
  var t = HtmlService.createTemplateFromFile(filename);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];
  return t.evaluate().getContent();
}

// ページ名 → テンプレート名の明示マップ（存在ファイルのみ）
var PAGE_TEMPLATE_MAP = {
  // 一覧系
  "shots":       "index",
  "shottable":   "index",
  "index":       "index",

  // 詳細
  "detailshot":  "DETAIL_entity",
  "detailasset": "DETAIL_entity",
  "detailtask":  "DETAIL_entity",
  "detailmember": "DETAIL_entity",
  "detailuser":  "DETAIL_entity",
  "detail_entity": "DETAIL_entity",

  // デバッグ（実体は DebugPanelPage.html）
  "debugpanel":      "DebugPanelPage",
  "debugpanelpage":  "DebugPanelPage"
};

function _resolveTemplateName_(page, entity, id) {
  var p = String(page || "").toLowerCase();

  // entity + id を最優先（一覧URLからの遷移でも確実に詳細へ）
  if (entity && id) return "DETAIL_entity";

  // 明示マップ
  if (p && PAGE_TEMPLATE_MAP[p]) return PAGE_TEMPLATE_MAP[p];

  // 既定は index
  return "index";
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  __VIEW_CTX.scriptUrl = ScriptApp.getService().getUrl();
  __VIEW_CTX.page   = p.page   || 'Shots';
  __VIEW_CTX.entity = (p.entity||'').toLowerCase();
  __VIEW_CTX.id     = p.id     || '';

  var templateName = _resolveTemplateName_(__VIEW_CTX.page, __VIEW_CTX.entity, __VIEW_CTX.id);

  try {
    var t = HtmlService.createTemplateFromFile(templateName);
    for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];

    var out = t.evaluate();
    out.setTitle(templateName);
    out.addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return out;
  } catch (err) {
    var msg = HtmlService.createHtmlOutput(
      '<h1>404 Not Found</h1>'
      + '<p>Page "'+ templateName + '" not available.</p>'
    );
    msg.setTitle('404 Not Found');
    return msg;
  }
}
/* ===== 3. End ===== */



/* ===== 4. Data 読み取り（DataHub 優先） ===== */
function _readFromDataHubOrSheet_(sheetName){
  var dh = SpreadsheetApp.getActive().getSheetByName('DataHub');
  if (dh) {
    var vals = dh.getDataRange().getValues();
    if (vals && vals.length) {
      var header = vals[0];
      var col = header.indexOf(sheetName);
      if (col >= 0) {
        var colVals = vals.map(function(r){ return r[col]; });
        var ids     = String(colVals[1]||'').split('|');
        var names   = String(colVals[2]||'').split('|');
        var rows    = colVals.slice(3)
                        .map(function(v){ return v?String(v).split('|'):[]; })
                        .filter(function(a){ return a.length && String(a[0]||'')!==''; });
        return { ids:ids, header:names, rows:rows };
      }
    }
  }
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var rangeVals = sh ? sh.getDataRange().getValues() : [];
  if (!rangeVals || !rangeVals.length) return { ids:[], header:[], rows:[] };
  var idsRow   = rangeVals[0]||[];
  var namesRow = rangeVals[1]||[];
  var rows     = rangeVals.slice(2).filter(function(row){
    return row && row.some(function(v){ return v!=='' && v!=null; });
  }).map(function(r){ return r.map(function(v){ return v==null?'':String(v); }); });
  return { ids:idsRow, header:namesRow, rows:rows };
}
/* ===== 4. End ===== */


/* ===== 5. 型推定/補正ユーティリティ ===== */
function _inferTypes_(rows, ids){
  var types = new Array(ids.length).fill('text');
  var sample = Math.min(rows.length, 200);
  for (var c=0;c<ids.length;c++){
    for (var r=0;r<sample;r++){
      var v = rows[r][c];
      if (v==='' || v==null) continue;
      if (typeof v === 'number'){ types[c]='number'; break; }
      if (v instanceof Date){ types[c]='date'; break; }
      var s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) { types[c]='date'; break; }
      if (/^-?\d+(\.\d+)?$/.test(s))    { types[c]='number'; break; }
    }
  }
  return types;
}

function _coerce_(v, t){
  if (v==null || v==='') return null;
  if (t==='number'){
    if (typeof v==='number') return v;
    var n = Number(String(v).replace(/,/g,'')); return isFinite(n) ? n : null;
  }
  if (t==='date'){
    if (v instanceof Date) return v;
    var d = _parseDate_(String(v)); return d || null;
  }
  return v;
}
function _parseDate_(s){
  if (!s) return null;
  try{
    if (s instanceof Date) return s;
    var m = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(m) || /^\d{4}\/\d{2}\/\d{2}/.test(m)) return new Date(m);
    var d = new Date(m); if (!isNaN(d.getTime())) return d;
  }catch(e){}
  return null;
}
function _sameDay_(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
/* ===== 5. End ===== */


/* ===== 6. フィルタ評価ユーティリティ ===== */
function _containsAny_(raw, valOrValues){
  var hay = String(raw==null?'':raw).toLowerCase();
  var arr = [];
  if (Array.isArray(valOrValues)) arr = valOrValues;
  else if (typeof valOrValues === 'string') arr = valOrValues.split(',').map(function(s){ return s.trim(); });
  else arr = [String(valOrValues||'')];
  if (!arr.length) return false;
  for (var i=0;i<arr.length;i++){
    var needle = String(arr[i]||'').toLowerCase();
    if (!needle) continue;
    if (hay.indexOf(needle) !== -1) return true;
  }
  return false;
}

function _testRule_(cell, f, type){
  var op = String(f.op||'').toLowerCase();
  var raw = cell;

  if (op==='isempty')     return (raw==null || String(raw)==='');
  if (op==='isnotempty')  return !(raw==null || String(raw)==='');

  if (Array.isArray(f.values) && f.values.length){
    if (type==='date'){
      if (op==='is')    return f.values.some(function(v){ var t=_coerce_(v,'date'), d=_coerce_(raw,'date'); return t && d && _sameDay_(d,t); });
      if (op==='isnot') return !f.values.some(function(v){ var t=_coerce_(v,'date'), d=_coerce_(raw,'date'); return t && d && _sameDay_(d,t); });
      return false;
    } else {
      if (op==='contains')     return _containsAny_(raw, f.values);
      if (op==='is')           return f.values.some(function(v){ return String(raw) === String(v); });
      if (op==='isnot')        return !f.values.some(function(v){ return String(raw) === String(v); });
      if (op==='notcontains')  return !_containsAny_(raw, f.values);
      return false;
    }
  }

  var val = (f.value==null)? '' : String(f.value);

  if (type==='date'){
    var d = _coerce_(raw, 'date');
    if (op==='is'){ var t = _coerce_(val, 'date'); if (!t || !d) return false; return _sameDay_(d, t); }
    if (op==='isnot'){ var t2 = _coerce_(val, 'date'); if (!t2 || !d) return false; return !_sameDay_(d, t2); }
    if (op==='after'){ var a = _coerce_(val, 'date'); if (!d || !a) return false; return d.getTime() > a.getTime(); }
    if (op==='before'){ var b = _coerce_(val, 'date'); if (!d || !b) return false; return d.getTime() < b.getTime(); }
    if (op==='range'){ var rr = String(val||'').split('..'); if (rr.length!==2) return false;
      var da = _coerce_(rr[0], 'date'), db = _coerce_(rr[1], 'date'); if (!d||!da||!db) return false;
      var minT = Math.min(da.getTime(), db.getTime()), maxT = Math.max(db.getTime(), da.getTime());
      return d.getTime() >= minT && d.getTime() <= maxT;
    }
    return true;
  }

  var sRaw = (raw==null)? '' : String(raw);
  if (op==='is')           return sRaw === val;
  if (op==='isnot')        return sRaw !== val;
  if (op==='contains')     return _containsAny_(sRaw, val);
  if (op==='notcontains')  return !_containsAny_(sRaw, val);
  return true;
}

function _evalGroup_(row, group, ids, colTypes){
  var rules = Array.isArray(group.rules)? group.rules : [];
  var mode  = String(group.mode||'all').toLowerCase();
  if (!rules.length) return true;

  if (mode==='any'){
    for (var i=0;i<rules.length;i++){
      var f = rules[i]; if (!f || !f.id || !f.op) continue;
      var idx = ids.indexOf(f.id); if (idx<0) continue;
      if (_testRule_(row[idx], f, colTypes[idx])) return true;
    }
    return false;
  } else {
    for (var j=0;j<rules.length;j++){
      var g = rules[j]; if (!g || !g.id || !g.op) continue;
      var k = ids.indexOf(g.id); if (k<0) return false;
      if (!_testRule_(row[k], g, colTypes[k])) return false;
    }
    return true;
  }
}
/* ===== 6. End ===== */


/* ===== 7. 公開 API ===== */
function listRowsPage(params){
  params = params || {};
  var sheetName    = String(params.entity || params.sheet || '').trim() || 'Shots';
  var offset       = Math.max(0, Number(params.offset || 0));
  var limit        = Math.max(1, Number(params.limit  || 100));
  var sort         = Array.isArray(params.sort) ? params.sort : [];

  var flatFilter   = Array.isArray(params.filter) ? params.filter : [];
  var flatMode     = String(params.filterMode || 'all').toLowerCase();

  var groups       = Array.isArray(params.filterGroups) ? params.filterGroups : [];
  var groupCombine = String(params.groupCombine || 'all').toLowerCase();

  var payload = _readFromDataHubOrSheet_(sheetName);
  var ids    = payload.ids;
  var header = payload.header;
  var data   = payload.rows.slice();
  var colTypes = _inferTypes_(data, ids);

  if (groups.length){
    data = data.filter(function(row){
      if (groupCombine === 'any'){
        for (var gi=0; gi<groups.length; gi++){
          if (_evalGroup_(row, groups[gi], ids, colTypes)) return true;
        }
        return false;
      } else {
        for (var gj=0; gj<groups.length; gj++){
          if (!_evalGroup_(row, groups[gj], ids, colTypes)) return false;
        }
        return true;
      }
    });
  } else if (flatFilter.length){
    if (flatMode === 'any'){
      data = data.filter(function(row){
        for (var i=0;i<flatFilter.length;i++){
          var f = flatFilter[i]; if (!f || !f.id || !f.op) continue;
          var idx = ids.indexOf(f.id); if (idx<0) continue;
          if (_testRule_(row[idx], f, colTypes[idx])) return true;
        }
        return false;
      });
    } else {
      data = data.filter(function(row){
        for (var j=0;j<flatFilter.length;j++){
          var f2 = flatFilter[j]; if (!f2 || !f2.id || !f2.op) continue;
          var idx2 = ids.indexOf(f2.id); if (idx2<0) return false;
          if (!_testRule_(row[idx2], f2, colTypes[idx2])) return false;
        }
        return true;
      });
    }
  }

  if (sort && sort.length){
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

  var total = data.length;
  var pageRows = data.slice(offset, offset+limit);
  return { ids:ids, header:header, rows:pageRows, total:total };
}
/* ===== 7. End ===== */
