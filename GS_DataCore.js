// BUILD_STAMP: 2025-11-14 23:55 JST
/** =========================================
 *  Code.gs (繝翫Φ繝舌Μ繝ｳ繧ｰ謨ｴ逅・沿)
 *  - doGet 縺ｫ DebugPanel 繝壹・繧ｸ霑ｽ蜉
 *  - 莉悶・蜃ｦ逅・・迴ｾ迥ｶ邯ｭ謖・
 * =========================================*/

/* ===== Section Index =====
 *  1. 繧ｰ繝ｭ繝ｼ繝舌Ν繧ｳ繝ｳ繝・く繧ｹ繝・
 *  2. include (HTML 驛ｨ蜩∬ｪｭ霎ｼ)
 *  3. doGet Router
 *  4. Data 隱ｭ縺ｿ蜿悶ｊ・・ataHub 蜆ｪ蜈茨ｼ・
 *  5. 蝙区耳螳・陬懈ｭ｣繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ
 *  6. 繝輔ぅ繝ｫ繧ｿ隧穂ｾ｡繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ
 *  7. Sheet-backed row listing & fields
 *  8. FieldTypes-based Data API
 *  9. Entity Read/Write API (header)
 * 10. Entity utils
 * 11. entity_sheet_map
 * 12. fields_resolver
 * 13. label_resolver (entity_link縺ｮ縺ｿ繝ｩ繝吶Ν蛹・
 * 14. dp_getEntityRecord
 * 15. dp_updateEntityRecord (PATCH)
 * 16. page.header
 * 17. page.utils
 * 18. page.api
 * 19. pages.header
 * 20. pages.utils
// BUILD_TS: 2025-11-14T23:55:00+09:00
 * 21. dp_updatePageRecord (Pages, v2)
 * 22. pages.read_api
 * 23. pages.write_api
 * 24. labels.bulk_api
 * 25. DebugPanel APIs (server)
 * 26. Setup & Helpers
 * =========================*/


/* ===== 1. 繧ｰ繝ｭ繝ｼ繝舌Ν繧ｳ繝ｳ繝・く繧ｹ繝・===== */
var __VIEW_CTX = { scriptUrl:'', page:'', entity:'', id:'', dataJson:'[]' };
/* ===== 1. End ===== */


/* ===== 2. include (HTML 驛ｨ蜩∬ｪｭ霎ｼ) ===== */
function include(filename) {
  var t = HtmlService.createTemplateFromFile(filename);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];
  return t.evaluate().getContent();
}
/* ===== 2. End ===== */


/* ===== 3. doGet Router ===== */

// 繝壹・繧ｸ蜷・竊・繝・Φ繝励Ξ繝ｼ繝亥錐
var PAGE_TEMPLATE_MAP = {

  '':              'Web_Shell',

  'shots':         'Web_Shell',

  'assets':        'Web_Shell',

  'tasks':         'Web_Shell',

  'members':       'Web_Shell',

  'projectmembers':'Web_Shell',

  'users':         'Web_Shell',

  'dashboard':     'Web_Shell',

  'settings':      'Web_Shell',

  'index':         'Web_Shell',

  'table':         'Web_Shell',

  'viewer':        'Web_Shell',

  'debugpanel':    'Web_DebugPanel',

  'debugpanelpage':'Web_DebugPanel',

  'debug':         'Web_DebugPanel'

};

// page / entity / id 縺九ｉ繝・Φ繝励Ξ繝ｼ繝亥錐繧呈ｱｺ螳・
function _resolveTemplateName_(page, entity, id) {

  var p = String(page || '').toLowerCase();



  if (p === 'debugpanel' || p === 'debugpanelpage' || p === 'debug') {

    return 'Web_DebugPanel';

  }



  if (/^detail[a-z0-9_-]*/.test(p)) {

    return 'Web_Detail';

  }



  if (PAGE_TEMPLATE_MAP.hasOwnProperty(p)) {

    return PAGE_TEMPLATE_MAP[p];

  }



  // 想定外の page はすべて Web_Shell にフォールバック

  return 'Web_Shell';

}



function _normalizePageAndEntity_(page, entity) {
  var pageRaw = String(page || '').trim().toLowerCase();
  var entRaw = String(entity || '').trim().toLowerCase();
  function normEntity(x) {
    if (x === 'assets' || x === 'asset') return 'asset';
    if (x === 'tasks'  || x === 'task')  return 'task';
    if (x === 'users'  || x === 'user')  return 'user';
    if (x === 'members'|| x === 'member' || x === 'projectmembers' || x === 'projectmember') return 'member';
    if (x === 'shots'  || x === 'shot' || x === 'table' || x === 'index' || x === '') return 'shot';
    return entRaw || 'shot';
  }

  if (pageRaw === 'debugpanel' || pageRaw === 'debug' || pageRaw === 'debugpanelpage') {
    return { page: 'DebugPanelPage', entity: entRaw || 'shot' };
  }
  if (/^detail[a-z]+$/.test(pageRaw)) {
    return { page: page || 'DetailShot', entity: entRaw || 'shot' };
  }
  if (pageRaw === 'assets')  return { page: 'Assets', entity: entRaw || 'asset' };
  if (pageRaw === 'shots')   return { page: 'Shots', entity: entRaw || 'shot' };
  if (pageRaw === 'tasks')   return { page: 'Tasks', entity: entRaw || 'task' };
  if (pageRaw === 'users')   return { page: 'Users', entity: entRaw || 'user' };
  if (pageRaw === 'members' || pageRaw === 'projectmembers') {
    return { page: 'Members', entity: entRaw || 'member' };
  }
  if (pageRaw === '' || pageRaw === 'table' || pageRaw === 'index' || pageRaw === 'list' || pageRaw === 'viewer') {
    return { page: 'Shots', entity: normEntity(entRaw || 'shot') };
  }
  return { page: page || 'Shots', entity: normEntity(entRaw) };
}

// 繝ｫ繝ｼ繧ｿ繝ｼ譛ｬ菴・
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || '').toLowerCase();

  // 3-0. 莠呈鋤逕ｨ dataJson 繝代Λ繝｡繝ｼ繧ｿ・域立 doGet 縺ｨ縺ｮ莠呈鋤・・
  // 譌ｧ繧ｳ繝ｼ繝峨′ dataJson 繧貞盾辣ｧ縺励※縺・※繧・ReferenceError 縺ｫ縺ｪ繧峨↑縺・ｈ縺・↓縺励※縺翫￥
  var dataJson = '[]';
  if (params.dataJson) {
    var rawParam = String(params.dataJson);
    try {
      JSON.parse(rawParam);
      dataJson = rawParam;
    } catch (err) {
      dataJson = '[]';
    }
  }

  // 3-1. 迚ｹ谿翫お繝ｳ繝峨・繧､繝ｳ繝茨ｼ・S繝舌Φ繝峨Ν / 繧ｹ繝・・繧ｿ繧ｹ・・

  // index.html 遲峨°繧峨・:
  //   <script src="<?= scriptUrl ?>?action=app-bundle"></script>
  // 縺ｫ蟇ｾ縺励※ JS 繧定ｿ斐☆
  if (action === 'app-bundle') {
    var js = [
      '/* MOTK app bundle shim */',
      'var MOTK_BUNDLE_LOADED = true;',
      ''
    ].join('\n');

    return ContentService
      .createTextOutput(js)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // 邁｡譏薙せ繝・・繧ｿ繧ｹ・亥ｿ・ｦ√↑縺代ｌ縺ｰ辟｡隕悶＠縺ｦ繧医＞・・
  if (action === 'status') {
    var payload = {
      ok: true,
      ts: Date.now(),
      service: 'MOTK',
      endpoint: 'doGet',
      version: 'codegs-doGet-v2'
    };

    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3-2. 騾壼ｸｸ縺ｮ HTML 繝壹・繧ｸ・・ndex / DebugPanel 縺ｪ縺ｩ・・

  var page   = params.page   || 'Shots';
  var entity = (params.entity || '').toLowerCase();
  var id     = params.id     || '';
  var normalized = _normalizePageAndEntity_(page, entity);
  page   = normalized.page;
  entity = normalized.entity;

  var templateName = _resolveTemplateName_(page, entity, id);

  // 繝・Φ繝励Ξ繝ｼ繝井ｽ懈・
  var t;
  try {
    t = HtmlService.createTemplateFromFile(templateName);
  } catch (err) {
    // 繝・Φ繝励Ξ繝ｼ繝亥錐隗｣豎ｺ螟ｱ謨玲凾縺ｮ邁｡譏薙お繝ｩ繝ｼ
    var msg = 'Template "' + String(templateName) + '" not found.\n\n' +
      (err && err.stack ? String(err.stack) : String(err));

    msg = msg.replace(/[<>&]/g, function(c) {
      return c === '<' ? '&lt;' :
             c === '>' ? '&gt;' :
                         '&amp;';
    });

    return HtmlService
      .createHtmlOutput(
        '<!DOCTYPE html><html><body>' +
          '<h1>Template not found</h1>' +
          '<pre>' + msg + '</pre>' +
        '</body></html>'
      )
      .setTitle('Template not found')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 繝・Φ繝励Ξ繝ｼ繝医↓貂｡縺吶さ繝ｳ繝・く繧ｹ繝茨ｼ医Ο繝ｼ繧ｫ繝ｫ縺ｮ縺ｿ縲√げ繝ｭ繝ｼ繝舌Ν髢｢謨ｰ縺ｯ菴ｿ繧上↑縺・ｼ・
  var viewCtx = {
    page: page,
    entity: entity,
    id: id,
    scriptUrl: ScriptApp.getService().getUrl()
  };

  // 蛟句挨縺ｫ逶ｴ謗･貂｡縺呻ｼ域里蟄倥ユ繝ｳ繝励Ξ莠呈鋤逕ｨ・・
  t.page      = viewCtx.page;
  t.entity    = viewCtx.entity;
  t.id        = viewCtx.id;
  t.scriptUrl = viewCtx.scriptUrl;

  // 譌ｧ繧ｳ繝ｼ繝我ｺ呈鋤: dataJson 繧偵ユ繝ｳ繝励Ξ縺ｸ貂｡縺・
  t.dataJson  = dataJson;

  // 縺ｾ縺ｨ繧√※谺ｲ縺励＞蝣ｴ蜷育畑
  t.viewCtx = viewCtx;

  // HTML 縺ｨ縺励※霑泌唆
  return t.evaluate()
    .setTitle(viewCtx.page || 'MOTK')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===== 3. End ===== */



/* ===== 4. Data 隱ｭ縺ｿ蜿悶ｊ・・ataHub 蜆ｪ蜈茨ｼ・===== */
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
        if (rows.length > 0) {
          return { ids:ids, header:names, rows:rows };
        }
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


/* ===== 5. 蝙区耳螳・陬懈ｭ｣繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ ===== */
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


/* ===== 6. 繝輔ぅ繝ｫ繧ｿ隧穂ｾ｡繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ ===== */
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
    var sawValid = false;
    for (var j=0;j<rules.length;j++){
      var g = rules[j]; if (!g || !g.id || !g.op) continue;
      var k = ids.indexOf(g.id); if (k<0) continue;
      sawValid = true;
      if (!_testRule_(row[k], g, colTypes[k])) return false;
    }
    if (!sawValid) return true;
    return true;
  }
}
/* ===== 6. End ===== */


/* ===== 7. Sheet-backed row listing & fields ===== */

/**
 * listRowsPage 逕ｨ縺ｮ繝代Λ繝｡繝ｼ繧ｿ豁｣隕丞喧
 *
 * 蜿励￠蜈･繧後ｋ蠖｢:
 *   - "shot"
 *   - { entity: "shot" }
 *   - { entity: { entity: "shot", perPage: 5, page: 1 } }
 *   - { entity: "shot", limit: 100, page: 1 }
 */
function _normalizeEntityParams_(params) {
  params = params || {};

  var entParam = (params.entity != null) ? params.entity : params.sheet;
  var entObj = (entParam && typeof entParam === 'object') ? entParam : null;

  var entRaw = '';
  if (entObj) {
    entRaw = entObj.entity || entObj.name || entObj.sheet || '';
  } else if (entParam != null) {
    entRaw = entParam;
  }

  function canonEntityKey(raw){
    var key = String(raw||'').trim().toLowerCase();
    if(!key) return '';
    if(key==='shots' || key==='shot') return 'shot';
    if(key==='assets' || key==='asset') return 'asset';
    if(key==='tasks' || key==='task') return 'task';
    if(key==='users' || key==='user') return 'user';
    if(key==='projectmembers' || key==='projectmember' || key==='members' || key==='member') return 'member';
    if(key==='pages' || key==='page') return 'page';
    return key;
  }

  entRaw = String(entRaw || '').trim();
  var entityKey = canonEntityKey(entRaw) || 'shot';

  // entity 竊・繧ｷ繝ｼ繝亥錐繝槭ャ繝・
  var sheetNameMap = {
    shot:   'Shots',
    asset:  'Assets',
    task:   'Tasks',
    member: 'ProjectMembers',
    user:   'Users',
    page:   'Pages'
  };
  var sheetName = sheetNameMap[entityKey] || 'Shots';

  // limit
  var limitFromParams = Number(params.limit);
  var limitFromObj    = entObj && Number(entObj.perPage);
  var limit           = limitFromParams || limitFromObj || 100;
  if (!limit || limit < 1) limit = 100;

  // page 竊・offset
  var pageFromParams = Number(params.page);
  var pageFromObj    = entObj && Number(entObj.page);
  var page           = pageFromParams || pageFromObj || 1;
  if (!page || page < 1) page = 1;

  var offset;
  if (params.offset != null) {
    offset = Number(params.offset);
  } else {
    offset = (page - 1) * limit;
  }
  if (isNaN(offset) || offset < 0) offset = 0;

  return {
    entity:   entityKey,
    sheet:    sheetName,
    limit:    limit,
    offset:   offset
  };
}

/**
 * 繧ｷ繝ｼ繝亥錐蛟呵｣懊°繧画怙蛻昴↓隕九▽縺九▲縺溘す繝ｼ繝医ｒ霑斐☆
 */
function _findSheetByCandidates_(candidates) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < candidates.length; i++) {
    var name = candidates[i];
    if (!name) continue;
    var sh = ss.getSheetByName(name);
    if (sh) return sh;
  }
  return null;
}

/**
 * 謖・ｮ壹す繝ｼ繝医°繧峨・繝・ム・九ョ繝ｼ繧ｿ陦後ｒ蜿門ｾ・
 *  - 繝倥ャ繝陦・ 1陦檎岼
 *  - 繝・・繧ｿ陦・ 2陦檎岼莉･髯搾ｼ亥ｮ悟・遨ｺ陦後・繧ｹ繧ｭ繝・・・・
 */
function _readEntitySheet_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 繧ｷ繝ｼ繝亥呵｣・ "Shots", "shots", "SHOTS", "Shot"
  var base = String(sheetName || '').trim();
  var lc   = base.toLowerCase();
  var uc   = base.toUpperCase();
  var cap  = lc ? (lc.charAt(0).toUpperCase() + lc.slice(1)) : base;

  var sh = _findSheetByCandidates_([base, lc, uc, cap]);
  if (!sh) {
    return { header: [], rows: [] };
  }

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { header: [], rows: [] };
  }

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  var dataStartRow = 3; // row1: field IDs, row2: labels
  if (lastRow < dataStartRow) {
    return { header: header, rows: [] };
  }
  var dataRowCount = lastRow - dataStartRow + 1;
  if (dataRowCount < 1) {
    return { header: header, rows: [] };
  }

  var dataRange = sh.getRange(dataStartRow, 1, dataRowCount, lastCol);
  var allValues = dataRange.getValues();

  var dataRows = [];
  for (var r = 0; r < allValues.length; r++) {
    var row = allValues[r];
    var empty = true;
    for (var c = 0; c < row.length; c++) {
      var v = row[c];
      if (v !== '' && v !== null) {
        empty = false;
        break;
      }
    }
    if (!empty) {
      dataRows.push(row);
    }
  }

  return {
    header: header,
    rows:   dataRows
  };
}

function _buildColumnIndexMap_(ids, header) {
  var map = Object.create(null);
  var len = Math.max(ids.length, header.length);
  for (var i = 0; i < len; i++) {
    if (i < ids.length) {
      var fid = ids[i];
      var key = (fid == null ? '' : String(fid)).trim().toLowerCase();
      if (key && !(key in map)) map[key] = i;
    }
    if (i < header.length) {
      var label = header[i];
      var labelKey = (label == null ? '' : String(label)).trim().toLowerCase();
      if (labelKey && !(labelKey in map)) map[labelKey] = i;
    }
  }
  return map;
}

function _resolveColumnIndex_(map, fid) {
  if (!fid) return -1;
  var norm = String(fid).trim().toLowerCase();
  if (!norm) return -1;
  return (norm in map) ? map[norm] : -1;
}

function _extractRuleValues_(rule) {
  if (!rule) return [];
  if (Array.isArray(rule.values) && rule.values.length) {
    return rule.values.map(function(v){ return String(v||'').trim(); }).filter(Boolean);
  }
  if (rule.value != null) {
    return String(rule.value).split('||').map(function(v){ return v.trim(); }).filter(Boolean);
  }
  return [];
}

function _parseNumberOrDate_(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && isFinite(value)) return value;
  var num = Number(value);
  if (!isNaN(num)) return num;
  var time = Date.parse(value);
  return isNaN(time) ? null : time;
}

function _compileFilterGroups_(filterGroups, ids, header) {
  if (!Array.isArray(filterGroups) || !filterGroups.length) return [];
  var map = _buildColumnIndexMap_(ids, header);
  var compiled = [];
  for (var i = 0; i < filterGroups.length; i++) {
    var group = filterGroups[i] || {};
    var rules = Array.isArray(group.rules) ? group.rules : [];
    var compiledRules = [];
    for (var j = 0; j < rules.length; j++) {
      var rule = rules[j] || {};
      var idx = _resolveColumnIndex_(map, rule.id);
      if (idx < 0) continue;
      var op = String(rule.op || 'contains').toLowerCase();
      var values = _extractRuleValues_(rule);
      var lowerValues = values.map(function(v){ return v.toLowerCase(); });
      var numericTarget = null;
      if (op === 'after' || op === 'before') {
        numericTarget = values.length ? _parseNumberOrDate_(values[0]) : _parseNumberOrDate_(rule.value);
      }
      var rangeBounds = null;
      if (op === 'range') {
        var raw = rule.value != null ? String(rule.value) : '';
        var parts = raw.split('..');
        rangeBounds = {
          min: parts.length ? _parseNumberOrDate_(parts[0]) : null,
          max: parts.length > 1 ? _parseNumberOrDate_(parts[1]) : null
        };
      }
      compiledRules.push({
        idx: idx,
        op: op,
        values: values,
        valuesLower: lowerValues,
        numericValue: numericTarget,
        range: rangeBounds
      });
    }
    if (compiledRules.length) {
      compiled.push({
        mode: (group.mode === 'any') ? 'any' : 'all',
        rules: compiledRules
      });
    }
  }
  return compiled;
}

function _ruleMatches_(compiledRule, row) {
  var idx = compiledRule.idx;
  if (idx == null || idx < 0 || idx >= row.length) return false;
  var cell = row[idx];
  var str = (cell == null) ? '' : String(cell).trim();
  var lower = str.toLowerCase();
  switch (compiledRule.op) {
    case 'contains':
      return compiledRule.valuesLower && compiledRule.valuesLower.length
        ? compiledRule.valuesLower.some(function(v){ return lower.indexOf(v) >= 0; })
        : false;
    case 'is':
      return compiledRule.valuesLower && compiledRule.valuesLower.length
        ? compiledRule.valuesLower.some(function(v){ return lower === v; })
        : false;
    case 'isnot':
      if (!compiledRule.valuesLower || !compiledRule.valuesLower.length) return str !== '';
      return compiledRule.valuesLower.every(function(v){ return lower !== v; });
    case 'isempty':
      return str === '';
    case 'isnotempty':
      return str !== '';
    case 'after': {
      var cellNum = _parseNumberOrDate_(cell);
      var target = compiledRule.numericValue;
      return (cellNum != null && target != null) ? (cellNum > target) : false;
    }
    case 'before': {
      var cellNumB = _parseNumberOrDate_(cell);
      var targetB = compiledRule.numericValue;
      return (cellNumB != null && targetB != null) ? (cellNumB < targetB) : false;
    }
    case 'range': {
      var val = _parseNumberOrDate_(cell);
      if (val == null || !compiledRule.range) return false;
      var min = compiledRule.range.min;
      var max = compiledRule.range.max;
      if (min != null && val < min) return false;
      if (max != null && val > max) return false;
      return true;
    }
    default:
      return false;
  }
}

function _filterRowsByGroups_(rows, ids, header, filterGroups, combineMode) {
  var compiled = _compileFilterGroups_(filterGroups, ids, header);
  if (!compiled.length) return rows;
  var combineAny = (combineMode === 'any');
  return rows.filter(function(row){
    var results = compiled.map(function(group){
      if (group.mode === 'any') {
        for (var i = 0; i < group.rules.length; i++) {
          if (_ruleMatches_(group.rules[i], row)) return true;
        }
        return false;
      }
      for (var j = 0; j < group.rules.length; j++) {
        if (!_ruleMatches_(group.rules[j], row)) return false;
      }
      return true;
    });
    if (!results.length) return true;
    return combineAny ? results.some(Boolean) : results.every(Boolean);
  });
}

function _compileSortSpecs_(sortList, ids, header) {
  if (!Array.isArray(sortList) || !sortList.length) return [];
  var map = _buildColumnIndexMap_(ids, header);
  var compiled = [];
  for (var i = 0; i < sortList.length; i++) {
    var spec = sortList[i] || {};
    if (!spec.id) continue;
    var idx = _resolveColumnIndex_(map, spec.id);
    if (idx < 0) continue;
    compiled.push({
      idx: idx,
      dir: (spec.dir === 'desc') ? 'desc' : 'asc'
    });
  }
  return compiled;
}

function _compareCellsForSort_(a, b) {
  if (a === b) return 0;
  var aNum = _parseNumberOrDate_(a);
  var bNum = _parseNumberOrDate_(b);
  if (aNum != null && bNum != null && aNum !== bNum) {
    return aNum < bNum ? -1 : 1;
  }
  var aStr = (a == null) ? '' : String(a).toLowerCase();
  var bStr = (b == null) ? '' : String(b).toLowerCase();
  if (aStr === bStr) return 0;
  return aStr < bStr ? -1 : 1;
}

function _sortRowsBySpecs_(rows, sortList, ids, header) {
  var compiled = _compileSortSpecs_(sortList, ids, header);
  if (!compiled.length) return rows;
  var copy = rows.slice();
  copy.sort(function(a,b){
    for (var i = 0; i < compiled.length; i++) {
      var spec = compiled[i];
      var cmp = _compareCellsForSort_(a[spec.idx], b[spec.idx]);
      if (cmp !== 0) return spec.dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
  return copy;
}

/**
 * listRowsPage 縺ｮ繧ｳ繧｢螳溯｣・
 * 謌ｻ繧雁､: { columns: [...], rows: [...], meta: {...} }
 */
function _listRowsPageCore_(params) {
  var conf = _normalizeEntityParams_(params);
  var sheetName = conf.sheet;
  var limit     = conf.limit;
  var offset    = conf.offset;

  var data = _readFromDataHubOrSheet_(sheetName);
  var ids    = data.ids    || [];
  var header = data.header || [];
  var rows   = data.rows   || [];

  var workingRows = rows.slice();
  var filters = Array.isArray(params.filterGroups) ? params.filterGroups : [];
  var combineMode = (params.groupCombine === 'any') ? 'any' : 'all';
  if (filters.length) {
    workingRows = _filterRowsByGroups_(workingRows, ids, header, filters, combineMode);
  }
  if (Array.isArray(params.sort) && params.sort.length) {
    workingRows = _sortRowsBySpecs_(workingRows, params.sort, ids, header);
  }

  var total = workingRows.length;

  var start = offset;
  if (start < 0) start = 0;
  if (start > total) start = total;

  var end = start + limit;
  if (end > total) end = total;

  var sliced = workingRows.slice(start, end);

  var result = {
    ids:     ids,
    header:  header,
    rows:    sliced,
    meta: {
      total:  total,
      offset: start,
      limit:  limit,
      sheet:  sheetName,
      source: 'sheet'
    }
  };

  Logger.log(
    '[listRowsPage] entity=%s sheet=%s total=%s offset=%s limit=%s',
    conf.entity, sheetName, total, start, limit
  );

  return result;
}

/**
 * 繧ｵ繝ｼ繝仙・驛ｨ逕ｨ・・ontract Inspector 縺ｪ縺ｩ逶ｴ謗･蜻ｼ縺ｳ蜃ｺ縺暦ｼ・*/
function listRowsPage(params) {
  if (typeof params === 'string') {
    params = { entity: params };
  }
  return _listRowsPageCore_(params || {});
}

/**
 * RPC 繧ｨ繝ｳ繝峨・繧､繝ｳ繝茨ｼ・I 縺九ｉ縺ｯ縺薙ｌ縺悟他縺ｰ繧後ｋ諠ｳ螳夲ｼ・*/
function sv_listRowsPage(params) {
  if (typeof params === 'string') {
    params = { entity: params };
  }
  return _listRowsPageCore_(params || {});
}

/**
 * FIELDS 繧ｷ繝ｼ繝医°繧峨∵欠螳・entity 縺ｮ繝輔ぅ繝ｼ繝ｫ繝芽｡後ｒ驟榊・縺ｧ霑斐☆
 * 謌ｻ繧雁､縺ｯ縲・陦檎岼莉･髯阪・ raw 陦碁・蛻励・
 */
function getFields(entity) {
  if (!entity) {
    throw new Error('getFields: entity is required.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('FIELDS');
  if (!sh) {
    return [];
  }

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var header = values[0];

  // "Entity" 蛻励ｒ謗｢縺・
  var entityCol = -1;
  for (var c = 0; c < header.length; c++) {
    if (String(header[c]).toLowerCase() === 'entity') {
      entityCol = c;
      break;
    }
  }
  // 繝倥ャ繝縺檎┌縺・ｴ蜷医・證ｫ螳壹〒蛻・繧・Entity 縺ｨ縺ｿ縺ｪ縺・
  if (entityCol === -1) {
    entityCol = 1;
  }

  var out = [];
  var target = String(entity).toLowerCase();
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var entValue = String(row[entityCol] || '').toLowerCase();
    if (!entValue) continue;
    if (entValue === target) {
      out.push(row);
    }
  }

  return out;
}

/**
 * 繝・ヰ繝・げ逕ｨ: 繧ｷ繝ｧ繝・ヨ荳隕ｧ繧偵し繝ｼ繝仙・繝ｭ繧ｰ縺ｧ遒ｺ隱・
 */
function debug_listRowsPage_shot() {
  var res = listRowsPage('shot');
  Logger.log('SHOT meta: %s', JSON.stringify(res.meta, null, 2));
  if (res.rows && res.rows.length > 0) {
    Logger.log('First row (shot): %s', JSON.stringify(res.rows[0]));
  } else {
    Logger.log('No shot rows returned.');
  }
}

/**
 * 繝・ヰ繝・げ逕ｨ: 繧｢繧ｻ繝・ヨ荳隕ｧ繧偵し繝ｼ繝仙・繝ｭ繧ｰ縺ｧ遒ｺ隱・
 */
function debug_listRowsPage_asset() {
  var res = listRowsPage('asset');
  Logger.log('ASSET meta: %s', JSON.stringify(res.meta, null, 2));
  if (res.rows && res.rows.length > 0) {
    Logger.log('First row (asset): %s', JSON.stringify(res.rows[0]));
  } else {
    Logger.log('No asset rows returned.');
  }
}

/* ===== 7. End of Sheet-backed row listing & fields ===== */


/* ===== 8. FieldTypes-based Data API (sv_listRowsPage / getFields / listFields) =====
 *
 * 逶ｮ逧・
 * - 譌｢蟄倥・ listRowsPage(params) 繧偵◎縺ｮ縺ｾ縺ｾ蛻ｩ逕ｨ縺励▽縺､縲・
 *   Fields 繧ｷ繝ｼ繝育罰譚･縺ｮ繝｡繧ｿ諠・ｱ莉倥″ sv_listRowsPage(entity, options) 繧呈署萓帙☆繧・
 * - DebugPanel Contract Inspector 縺九ｉ蜻ｼ縺ｶ getFields / listFields 繧呈署萓帙☆繧・
 *
 * 繝昴Μ繧ｷ繝ｼ:
 * - 陦後ョ繝ｼ繧ｿ縺ｮ隱ｭ縺ｿ蜃ｺ縺励・繝輔ぅ繝ｫ繧ｿ繝ｻ繧ｽ繝ｼ繝医・繝壹・繧ｸ繝ｳ繧ｰ縺ｯ譌｢蟄・listRowsPage 縺ｫ荳譛ｬ蛹・
 *   ・医Ο繧ｸ繝・け縺ｮ莠碁㍾螳溯｣・・驥崎､・Ν繝ｼ繝励ｒ驕ｿ縺代ｋ・・
 * - 蛻励Γ繧ｿ諠・ｱ縺ｯ Fields 繧ｷ繝ｼ繝茨ｼ・etFieldTypes・峨°繧牙ｼ輔″縲：I・・ield id・峨〒邨仙粋
 *   ・・abel/name 縺ｧ縺ｯ蛻､蛻･縺励↑縺・ｼ・
 */

/**
 * 繧ｵ繝ｼ繝舌・蛛ｴ繝・・繝悶Ν API (螂醍ｴ・､懈渊逕ｨ)
 * - entity: 'shot' / 'asset' / 'task' / 'member' / 'user' / 'page'
 * - options: { limit, offset, sort, filter, filterMode, filterGroups, groupCombine, sheet? }
 *
 * 謌ｻ繧雁､:
 * {
 *   columns: [ {id,fieldId,name,label,type,editable,required,index,meta}, ... ],
 *   row0:    [... 蜈磯ｭ陦・...] 縺ｾ縺溘・ null,
 *   rows:    [[...], [...], ...],
 *   meta:    { total, sheet, offset, limit, entity }
 * }
 */

function sv_listRowsPage(entity, options) {
  if (entity && typeof entity === 'object' && (!options || typeof options !== 'object')) {
    options = entity || {};
    entity = options.entity || options.sheet || options.sheetName || options.entityPlural || '';
  }
  options = options || {};

  var entCandidate = entity || options.entity || options.sheet || options.sheetName || options.entityPlural;
  var entString = String(entCandidate || '').trim();
  if (!entString) {
    throw new Error('sv_listRowsPage: entity is required.');
  }
  entity = entString;

  // ??? listRowsPage ??????????????? ids/header ???
  var params = {
    entity: entString,
    sheet:  options.sheet || options.sheetName || entString,

    offset: options.offset,
    limit:  options.limit,

    sort:          options.sort,
    filter:        options.filter,
    filterMode:    options.filterMode,
    filterGroups:  options.filterGroups,
    groupCombine:  options.groupCombine
  };
  var base  = _listRowsPageCore_(params) || {};
  var ids   = base.ids    || [];
  var names = base.header || base.labels || [];
  var rows  = base.rows   || [];
  var total = base.total;
  if (total == null && base.meta && base.meta.total != null) {
    total = base.meta.total;
  }
  if (total == null) {
    total = rows.length;
  }

  // Fields 繧ｷ繝ｼ繝医°繧峨ヵ繧｣繝ｼ繝ｫ繝牙ｮ夂ｾｩ繧貞叙蠕暦ｼ・I 繝吶・繧ｹ・・
  var ftAll  = getFieldTypes(entity) || {}; // { [ent]: { [fid]: {label,type,editable,required} } }
  var entKey = String(entity || '').toLowerCase();
  var fieldDefs = ftAll[entKey] || {};

  var columns = [];
  var i, len = Math.max(ids.length, names.length);

  for (i = 0; i < len; i++) {
    var fidRaw = (i < ids.length)   ? ids[i]   : '';
    var nameRaw= (i < names.length) ? names[i] : '';

    var fid = fidRaw != null ? String(fidRaw).trim() : '';
    var def = fid && fieldDefs[fid] ? fieldDefs[fid] : {};

    var colName = (nameRaw != null && nameRaw !== '') ?
      String(nameRaw) :
      (def.label || fid || '');

    columns.push({
      id:       fid || null,
      fieldId:  fid || null,
      name:     colName,
      label:    colName,
      type:     def.type || 'text',
      editable: def.editable != null ? !!def.editable : true,
      required: !!def.required,
      index:    i,
      meta:     {}
    });
  }

  var row0 = rows.length ? rows[0] : null;

  return {
    columns: columns,
    row0:    row0,
    rows:    rows,
    meta: {
      total:  total,
      sheet:  (base.meta && base.meta.sheet) ? base.meta.sheet : (params.sheet || ''),
      offset: (base.meta && base.meta.offset != null) ? base.meta.offset : (params.offset || 0),
      limit:  (base.meta && base.meta.limit  != null) ? base.meta.limit  : (params.limit  || 100),
      entity: entity
    }
  };
}

/**
 * getFields(entity)
 * - DebugPanel Contract Inspector 逕ｨ縲・
 * - entity 縺梧ｸ｡縺輔ｌ縺溘ｉ縺昴・ entity 縺縺代・
 *   譛ｪ謖・ｮ壹↑繧牙・ entity 縺ｮ螳夂ｾｩ繧定ｿ斐☆縲・
 * - 蛻､蛻･縺ｯ entity 縺ｮ譁・ｭ怜・・・shot" 遲会ｼ・ FI 繝吶・繧ｹ縲・
 */
function getFields(entity) {
  // getFieldTypes 縺ｯ entity 繧堤怐逡･縺吶ｋ縺ｨ蜈ｨ繧ｨ繝ｳ繝・ぅ繝・ぅ繧定ｿ斐☆螳溯｣・
  var all = getFieldTypes(entity || null) || {};

  // entity 譛ｪ謖・ｮ壹↑繧峨◎縺ｮ縺ｾ縺ｾ霑斐☆・・ields matrix 逕ｨ・・
  if (!entity) {
    return all;
  }

  var key = String(entity || '').toLowerCase();
  return all[key] || {};
}


/**
 * listFields()
 * - 蜈ｨ entity 縺ｮ繝輔ぅ繝ｼ繝ｫ繝牙ｮ夂ｾｩ繧偵∪縺ｨ繧√※蜿門ｾ励・
 * - 霑泌唆蠖｢蠑・ { shot:{fi_0001:{...},...}, asset:{...}, ... }
 */
function listFields() {
  // getFieldTypes 縺ｫ entity 繧呈ｸ｡縺輔↑縺・ｼ医∪縺溘・遨ｺ・峨→縲∝・ entity 繧定ｿ斐☆螳溯｣・↓縺ｪ縺｣縺ｦ縺・ｋ蜑肴署縲・
  return getFieldTypes(null) || {};
}

/* ===== 8. End ===== */


/* ===== 9. Entity Read/Write API (header) ===== */
/**
 * 逶ｮ逧・
 * - DETAIL_entity.html 縺九ｉ縺ｮ繝ｬ繧ｳ繝ｼ繝芽ｪｭ霎ｼ/蟾ｮ蛻・嶌霎ｼAPI繧呈署萓・
 * 蜑肴署:
 * - ES5貅匁侠
 * - 繧ｷ繧ｹ繝・Β縺ｯ蜈ｨ讓ｩ縲ゅΘ繝ｼ繧ｶ繝ｼUI縺九ｉ縺ｮ邱ｨ髮・・ Fields 蛛ｴ縺ｮeditable逶ｸ蠖薙〒蛻､螳・
 * - ID竊偵Λ繝吶Ν鄂ｮ謠帙・ entity_link 縺ｮ縺ｿ・郁ｿ泌唆縺ｯ {v,id,label?,t} 蠖｢・・
 */
/* ===== 9. End ===== */


/* ===== 10. Entity utils ===== */
function _SS_(){ return SpreadsheetApp.getActive(); }
function _shByName_(name){
  var ss = _SS_(); var sh = ss && ss.getSheetByName(name);
  if(!sh) throw new Error("Sheet not found: "+name);
  return sh;
}
function _read2D_(name){
  var v = _shByName_(name).getDataRange().getValues();
  if(!v || !v.length) throw new Error("Empty sheet: "+name);
  return v;
}
function _hdrIndex_(hdr, name){
  for(var i=0;i<hdr.length;i++){ if(String(hdr[i]).trim().toLowerCase()===String(name).trim().toLowerCase()) return i; }
  return -1;
}
function _norm_(s){ return String(s||"").trim().toLowerCase().replace(/[^\w]+/g,"_"); }
function _arrToObj_(hdr, row){
  var o={}, i;
  for(i=0;i<hdr.length;i++){ o[String(hdr[i])] = row[i]; }
  return o;
}
/* ===== 10. End ===== */


/* ===== 11. entity_sheet_map ===== */
function _entityToSheet_(entity){
  var m = {
    "shot":"Shots",
    "asset":"Assets",
    "task":"Tasks",
    "member":"ProjectMembers",
    "user":"Users",
    "page":"Pages"
  };
  var key = _norm_(entity);
  if(!m[key]) throw new Error("Unknown entity: "+entity);
  return m[key];
}
function _idPrefixToEntity_(idValue){
  if(typeof idValue!=="string") return null;
  if(/^sh_\d+/.test(idValue)) return "shot";
  if(/^as_\d+/.test(idValue)) return "asset";
  if(/^ta_\d+/.test(idValue)) return "task";
  if(/^us_\d+/.test(idValue)) return "user";
  if(/^mb_\d+/.test(idValue)) return "member";
  if(/^pg_\d+/.test(idValue)) return "page";
  return null;
}
/* ===== 11. End ===== */


/* ===== 12. fields_resolver ===== */
/**
 * Fields繧ｷ繝ｼ繝医°繧・
 *  - 蜷・ntity縺ｮID蛻励・繝ｩ繝吶Ν蛻暦ｼ・ype=='id' | 'entity_name'・・
 *  - editable逶ｸ蠖・
 * 繧呈耳螳壹ゅ・繝・ム蜷阪・繧・ｋ縺乗ｭ｣隕丞喧縺励※謗｢邏｢縺吶ｋ縲・
 */
function _readFields_(){
  var values = _read2D_("Fields"); // 萓句､匁凾縺ｯ譌｢蟄倬°逕ｨ縺ｫ蠕薙＞throw
  var hdr = values[0];
  var rows = values.slice(1);
  var H = {};
  for(var i=0;i<hdr.length;i++){ H[_norm_(hdr[i])] = i; }
  // 諠ｳ螳壹き繝ｩ繝蛟呵｣・
  var C = {
    entity: H.entity!=null?H.entity:(H.ent!=null?H.ent:null),
    type: H.type!=null?H.type:(H.kind!=null?H.kind:null),
    field_id: H.field_id!=null?H.field_id:(H.fi!=null?H.fi:null),
    column_name: H.column!=null?H.column:(H.column_name!=null?H.column_name:(H.col!=null?H.col:null)),
    editable: (H.editable!=null?H.editable:(H.can_edit!=null?H.can_edit:null))
  };
  var out = [];
  for(var r=0;r<rows.length;r++){
    var row = rows[r];
    var o = {
      entity: C.entity!=null?row[C.entity]:"",
      type:   C.type!=null?row[C.type]:"",
      field_id: C.field_id!=null?row[C.field_id]:"",
      column_name: C.column_name!=null?row[C.column_name]:"",
      editable: C.editable!=null?row[C.editable]:false
    };
    out.push(o);
  }
  return out;
}
function _idAndLabelCols_(entity, sheetHdr){
  var fields = _readFields_();
  var e = _norm_(entity);
  var idName=null, labelName=null;
  for(var i=0;i<fields.length;i++){
    if(_norm_(fields[i].entity)!==e) continue;
    var t = _norm_(fields[i].type);
    if(t==="id" && fields[i].column_name){ idName = fields[i].column_name; }
    if((t==="entity_name"||t==="name") && fields[i].column_name){ labelName = fields[i].column_name; }
  }
  // Fallback・亥ｮ牙・蛛ｴ・・
  if(idName==null){
    var guess = ["id", e+"_id", e+"id", "code", "key"];
    for(var g=0;g<guess.length && idName==null; g++){
      var idx = _hdrIndex_(sheetHdr, guess[g]);
      if(idx>=0) idName = sheetHdr[idx];
    }
  }
  if(labelName==null){
    var guessL = ["name", "label", "code", e, e+"_name"];
    for(var h=0;h<guessL.length && labelName==null; h++){
      var idx2 = _hdrIndex_(sheetHdr, guessL[h]);
      if(idx2>=0) labelName = sheetHdr[idx2];
    }
  }
  return { idName:idName, labelName:labelName };
}
function _isEditable_(entity, colName){
  // 莉悶Θ繝ｼ繧ｶ繝ｼ蜷代￠縺ｮ邱ｨ髮・庄蜷ｦ縲ゅす繧ｹ繝・Β縺ｯ辟｡蛻ｶ髯舌□縺後√ヵ繝ｩ繧ｰ縺ｯ霑斐☆縲・
  var fields = _readFields_();
  var e = _norm_(entity), c = _norm_(colName);
  for(var i=0;i<fields.length;i++){
    if(_norm_(fields[i].entity)!==e) continue;
    if(_norm_(fields[i].column_name)===c){
      var v = fields[i].editable;
      // truthy蛻､螳夲ｼ・RUE/true/1/Yes・・
      return (String(v).toLowerCase()==="true" || String(v)==="1" || String(v).toLowerCase()==="yes");
    }
  }
  return false;
}
/* ===== 12. End ===== */


/* ===== 13. label_resolver (entity_link縺ｮ縺ｿ繝ｩ繝吶Ν蛹・ ===== */
function _resolveEntityLinkLabel_(idValue){
  var ent = _idPrefixToEntity_(idValue);
  if(!ent) return null;
  var sheet = _entityToSheet_(ent);
  var values = _read2D_(sheet);
  var hdr = values[0];
  var map = _idAndLabelCols_(ent, hdr);
  if(!map.idName) return null;
  var idCol = _hdrIndex_(hdr, map.idName);
  var labelCol = map.labelName ? _hdrIndex_(hdr, map.labelName) : -1;
  var i, row;
  for(i=1;i<values.length;i++){
    row = values[i];
    if(String(row[idCol])===String(idValue)){
      return (labelCol>=0)? String(row[labelCol]) : null;
    }
  }
  return null;
}
function _cellToViewToken_(colName, value){
  // entity_link縺ｮ蛻､螳夲ｼ壼､縺ｮprefix縺九ｉ謗ｨ螳壹・D竊偵Λ繝吶Ν縺ｯ縺薙％縺縺代・
  var t = "text", label=null;
  if(typeof value==="string"){
    var pref = _idPrefixToEntity_(value);
    if(pref){ t="entity_link"; label = _resolveEntityLinkLabel_(value); }
  }
  return { c: String(colName), t:t, v:value, label: label };
}
/* ===== 13. End ===== */


/* ===== 14. dp_getEntityRecord ===== */
function dp_getEntityRecord(entity, id){
  try{
    var sheet = _entityToSheet_(entity);
    var values = _read2D_(sheet);
    var hdr = values[0];
    var map = _idAndLabelCols_(entity, hdr);
    if(!map.idName) throw new Error("ID column not resolved for entity: "+entity);
    var idCol = _hdrIndex_(hdr, map.idName);
    var labelCol = map.labelName ? _hdrIndex_(hdr, map.labelName) : -1;

    var i, row, found=-1;
    for(i=1;i<values.length;i++){
      row = values[i];
      if(String(row[idCol])===String(id)){ found=i; break; }
    }
    if(found<0) return { ok:false, error:"Record not found", entity:entity, id:id };

    var rec = {};
    for(i=0;i<hdr.length;i++){
      var token = _cellToViewToken_(hdr[i], values[found][i]);
      token.editable = _isEditable_(entity, hdr[i]); // 莉悶Θ繝ｼ繧ｶ繝ｼ蜷代￠
      rec[hdr[i]] = token;
    }
    var labelVal = (labelCol>=0)? values[found][labelCol] : null;

    return {
      ok:true,
      entity: entity,
      sheet: sheet,
      id: id,
      id_col: map.idName,
      label_col: map.labelName,
      label: labelVal,
      fields: rec
    };
  }catch(e){
    return { ok:false, error:String(e && e.message || e), entity:entity, id:id };
  }
}
/* ===== 14. End ===== */


/* ===== 15. dp_updateEntityRecord (PATCH) ===== */
function dp_updateEntityRecord(entity, id, patch){
  // 蟾ｮ蛻・・縺ｿ縲ゅす繧ｹ繝・Β縺ｯ蜈ｨ讓ｩ縺縺後・撼editable蛻励↓蟇ｾ縺励※縺ｯwarnings繧定ｿ斐☆縲・
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");

    var sheetName = _entityToSheet_(entity);
    var sh = _shByName_(sheetName);
    var values = sh.getDataRange().getValues();
    var hdr = values[0];
    var map = _idAndLabelCols_(entity, hdr);
    if(!map.idName) throw new Error("ID column not resolved for entity: "+entity);
    var idCol = _hdrIndex_(hdr, map.idName);

    // 蟇ｾ雎｡陦梧爾邏｢
    var rIdx=-1, i;
    for(i=1;i<values.length;i++){
      if(String(values[i][idCol])===String(id)){ rIdx=i; break; }
    }
    if(rIdx<0) return { ok:false, error:"Record not found", entity:entity, id:id };

    // 陦後・隍・｣ｽ
    var row = values[rIdx].slice();
    var warnings = [];

    // PATCH驕ｩ逕ｨ
    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      var colIdx = _hdrIndex_(hdr, k);
      if(colIdx<0) continue; // 譛ｪ遏･繧ｫ繝ｩ繝縺ｯ辟｡隕・

      // editable蛻､螳壹・霑泌唆逕ｨ縺ｫ菫晄戟・医す繧ｹ繝・Β縺ｯ譖ｸ縺擾ｼ・
      if(!_isEditable_(entity, k)){
        warnings.push("non_editable: "+k);
      }
      row[colIdx] = patch[k];
    }

    // 譖ｸ霎ｼ・井ｸ諡ｬ・・
    sh.getRange(rIdx+1, 1, 1, hdr.length).setValues([row]);

    // 譛譁ｰ繧定ｿ斐☆
    var latest = dp_getEntityRecord(entity, id);
    latest.warnings = warnings;
    latest.ok = true;
    return latest;

  }catch(e){
    return { ok:false, error:String(e && e.message || e), entity:entity, id:id };
  }
}
/* ===== 15. End ===== */


/* ===== 16. page.header ===== */
/**
 * Page繧ｿ繝悶・蠢・・蛻暦ｼ・age Name, Page Type, Entity, Shared・峨ｒ螳牙・縺ｫ隱ｭ縺ｿ譖ｸ縺阪☆繧句ｰら畑API縲・
 * - 譌｢蟄篭I/HTML縺ｯ螟画峩荳崎ｦ√・ode.js縺ｮ縺ｿ蟾ｮ縺苓ｾｼ縺ｿ縺ｧ蜍穂ｽ懊・
 * - Shared縺ｯ "TRUE/true/1/yes/on/笨・ 竊・true縲√◎繧御ｻ･螟問・false 縺ｫ豁｣隕丞喧縲・
 * - save-as逕ｨ繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ繧よ署萓幢ｼ亥・陦後・蛟､繧貞ｼ輔″邯吶℃縺､縺､荳頑嶌縺榊庄・峨・
 */
/* ===== 16. End ===== */


/* ===== 17. page.utils ===== */
function _pg_ss_(){ return SpreadsheetApp.getActive(); }
function _pg_sh_(){ var sh=_pg_ss_().getSheetByName("Pages"); if(!sh) throw new Error("Sheet not found: Pages"); return sh; }
function _pg_readAll_(){
  var sh=_pg_sh_();
  var v=sh.getDataRange().getValues();
  if(!v||v.length<2) throw new Error("Pages header rows missing");
  return { sh:sh, hdrIds:v[0], hdrNames:v[1], rows:v.slice(2) };
}
function _pg_normBool_(v){
  var s=String(v).trim().toLowerCase();
  if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true;
  return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="ok";
}

function _pg_idxById_(hdrIds, idOrFi){
  var key=String(idOrFi).trim().toLowerCase();
  for(var i=0;i<hdrIds.length;i++){
    if(String(hdrIds[i]).trim().toLowerCase()===key) return i;
  }
  return -1;
}
function _pg_idxByName_(hdrNames, name){
  var key=String(name).trim().toLowerCase();
  for(var i=0;i<hdrNames.length;i++){
    if(String(hdrNames[i]).trim().toLowerCase()===key) return i;
  }
  return -1;
}
// 蛻怜錐隗｣豎ｺ・哥I蜆ｪ蜈・竊・莠ｺ髢薙Λ繝吶Ν 竊・蜷檎ｾｩ繧ｭ繝ｼ繧偵Λ繝吶Ν縺ｸ蟇・○縺ｦ蜀肴爾邏｢
function _pg_resolveCol_(hdrIds, hdrNames, key){
  if(!key) return -1;
  // 1) 縺吶〒縺ｫ FI 謖・ｮ夲ｼ・i_XXXX・・
  if(/^fi_\d{4,}$/i.test(key)){
    var idx=_pg_idxById_(hdrIds, key);
    if(idx>=0) return idx;
  }
  // 2) 縺昴・縺ｾ縺ｾ繝ｩ繝吶Ν荳閾ｴ
  var idxN=_pg_idxByName_(hdrNames, key);
  if(idxN>=0) return idxN;
  // 3) 蜷檎ｾｩ隱槭ｒ豁｣隕上Λ繝吶Ν縺ｫ蟇・○繧・
  var k=String(key).trim().toLowerCase();
  if(k==="page_name"||k==="name"||k==="title") k="page name";
  else if(k==="page_type"||k==="type")          k="page type";
  else if(k==="is_shared"||k==="shared?")       k="shared";
  else if(k==="config_json"||k==="config")      k="config";
  // 蜀肴爾邏｢・医Λ繝吶Ν・・
  idxN=_pg_idxByName_(hdrNames, k);
  if(idxN>=0) return idxN;
  // 4) 譛蠕後↓ FI 縺ｨ縺励※繧りｩｦ縺呻ｼ井ｸ・ｸ繝ｩ繝吶Ν縺・fi_ 縺ｫ鄂ｮ縺九ｌ縺ｦ縺・ｋ蝣ｴ蜷茨ｼ・
  return _pg_idxById_(hdrIds, k);
}
// Page ID 蛻励・迚ｹ螳夲ｼ・I蜆ｪ蜈遺・繝ｩ繝吶Ν・・
function _pg_locateIdCol_(hdrIds, hdrNames){
  var c;
  c=_pg_idxById_(hdrIds, "fi_0052"); if(c>=0) return c;          // Page ID 諷｣萓・
  c=_pg_idxByName_(hdrNames, "page id"); if(c>=0) return c;
  c=_pg_idxById_(hdrIds, "page_id"); if(c>=0) return c;
  c=_pg_idxById_(hdrIds, "id"); if(c>=0) return c;
  throw new Error("Pages: ID column not resolved");
}
/* ===== 17. End ===== */


/* ===== 18. page.api ===== */
/**
 * 隱ｭ縺ｿ霎ｼ縺ｿ・壼ｿ・ｦ√↑繧峨ョ繝舌ャ繧ｰ逕ｨ騾斐〒菴ｿ逕ｨ縲６I蟾ｮ縺玲崛縺井ｸ崎ｦ√・
 */
function dp_getPageRecord(id){
  try{
    var values=_pg_read2D_(); var hdr=values[0];
    // ID蛻励・諷｣萓具ｼ・"Page ID" / "page_id" / "id" 繧帝・↓謗｢邏｢
    var idName=null;
    var cands=["Page ID","page_id","id"];
    for(var i=0;i<cands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,cands[i])>=0) idName=cands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    var r=_pg_findById_(hdr, values, idName, id);
    if(r<0) return { ok:false, error:"Record not found", id:id };
    var rec={};
    for(var c=0;c<hdr.length;c++){ rec[hdr[c]]=values[r][c]; }

    return { ok:true, id:id, fields:rec };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), id:id };
  }
}

/**
 * 譖ｸ縺崎ｾｼ縺ｿ・亥ｷｮ蛻・ATCH・会ｼ咾ONFIG縺縺代〒縺ｪ縺上￣age Name / Page Type / Entity / Shared 繧ょｯｾ雎｡縲・
 * 譌｢蟄倥・荳闊ｬ逕ｨ菫晏ｭ倥Ο繧ｸ繝・け縺九ｉ縲‘ntity==='page' 縺ｮ蝣ｴ蜷医↓縺薙ｌ繧貞他縺ｶ縺縺代〒菫ｮ蠕ｩ蜿ｯ閭ｽ縲・
 */
function dp_updatePageRecord(id, patch){
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");

    var values=_pg_read2D_(); var hdr=values[0]; var sh=_pg_sh_();

    // 蛻怜錐隗｣豎ｺ
    var idName=null, idCands=["Page ID","page_id","id"];
    for(var i=0;i<idCands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,idCands[i])>=0) idName=idCands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    var r=_pg_findById_(hdr, values, idName, id);
    if(r<0) return { ok:false, error:"Record not found", id:id };

    var row=values[r].slice(); // 繧ｳ繝斐・
    // 豁｣蠑丞・蜷・
    var COL_PAGE_NAME = "Page Name";
    var COL_PAGE_TYPE = "Page Type";
    var COL_ENTITY    = "Entity";
    var COL_SHARED    = "Shared";

    // PATCH驕ｩ逕ｨ・井ｻｻ諢丞・・・ Shared縺ｮ豁｣隕丞喧
    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      var idx=_pg_hdrIdx_(hdr, k);
      if(idx<0) continue; // 譛ｪ遏･蛻励・辟｡隕・
      var v = (k===COL_SHARED)? _pg_normBool_(patch[k]) : patch[k];
      row[idx]=v;
    }

    // 譖ｸ霎ｼ
    sh.getRange(r+1, 1, 1, hdr.length).setValues([row]);

    // 霑泌唆
    var latest={};
    for(var c=0;c<hdr.length;c++){ latest[hdr[c]]=row[c]; }
    return { ok:true, id:id, fields:latest };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), id:id };
  }
}

/**
 * save-as・壼・繝壹・繧ｸ繧定､・｣ｽ縺励！D縺ｨ荳頑嶌縺阪ヱ繝・メ繧帝←逕ｨ縲４hared縺ｯ蜈・・蛟､繧堤ｶ呎価・・atch縺ｧ荳頑嶌縺榊庄・峨・
 * 譌｢蟄倥・save-as繝輔Ο繝ｼ縺九ｉ鄂ｮ縺肴鋤縺亥庄閭ｽ縲６I蛛ｴ縺ｫ繝√ぉ繝・け繝懊ャ繧ｯ繧ｹ縺檎┌縺・ｴ蜷医ｂ縲√％縺薙〒隲也炊蛟､繧貞ｰ企㍾縲・
 */
function dp_saveAsPage(srcId, newId, patch){
  try{
    var get=dp_getPageRecord(srcId);
    if(!get || !get.ok) return { ok:false, error:"Source not found: "+srcId };

    var values=_pg_read2D_(); var hdr=values[0]; var sh=_pg_sh_();

    // 蛻怜錐隗｣豎ｺ
    var idName=null, idCands=["Page ID","page_id","id"];
    for(var i=0;i<idCands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,idCands[i])>=0) idName=idCands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    // newId縺梧里蟄倥↑繧峨お繝ｩ繝ｼ
    var exists=_pg_findById_(hdr, values, idName, newId);
    if(exists>=0) return { ok:false, error:"Already exists: "+newId };

    // 譁ｰ隕剰｡御ｽ懈・・壼・陦後ｒ邯呎価
    var srcIdx=_pg_findById_(hdr, values, idName, srcId);
    if(srcIdx<0) return { ok:false, error:"Source not found: "+srcId };
    var base=values[srcIdx].slice();

    // ID蟾ｮ縺玲崛縺・
    var idCol=_pg_hdrIdx_(hdr, idName);
    base[idCol]=newId;

    // 繝代ャ繝・←逕ｨ・・hared縺ｯ豁｣隕丞喧・・
    var COL_SHARED="Shared";
    if(patch && typeof patch==="object"){
      for(var k in patch){
        if(!patch.hasOwnProperty(k)) continue;
        var idx=_pg_hdrIdx_(hdr, k);
        if(idx<0) continue;
        base[idx]=(k===COL_SHARED)? _pg_normBool_(patch[k]) : patch[k];
      }
    }

    // 霑ｽ險・
    sh.appendRow(base);

    // 霑泌唆
    var rec={}; for(var c=0;c<hdr.length;c++){ rec[hdr[c]]=base[c]; }
    return { ok:true, id:newId, fields:rec };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), srcId:srcId, newId:newId };
  }
}
/* ===== 18. End ===== */


/* ===== 19. pages.header ===== */
/**
 * Pages sheet writer with synonym mapping:
 * - Writes Page Name / Page Type / Entity / Shared in addition to CONFIG.
 * - Accepts synonyms: page_name|name|title -> "Page Name"; page_type|type -> "Page Type";
 *   entity -> "Entity"; shared|is_shared -> "Shared" (bool normalized).
 * - Optional: if patch.__select === true, set CURRENT_PAGE_VIEW_ID script property to the page id.
 */
/* ===== 19. End ===== */


/* ===== 20. pages.utils ===== */
function PG_ss(){ return SpreadsheetApp.getActive(); }
function PG_sh(){
  var sh = PG_ss().getSheetByName("Pages");
  if(!sh) throw new Error("Sheet not found: Pages");
  return sh;
}
function PG_vals(){ 
  var v = PG_sh().getDataRange().getValues();
  if(!v || !v.length) throw new Error("Empty sheet: Pages");
  return v;
}
function PG_hdrIdx(hdr, name){
  var n = String(name).trim().toLowerCase();
  for (var i=0;i<hdr.length;i++){
    if (String(hdr[i]).trim().toLowerCase() === n) return i;
  }
  return -1;
}
function PG_findById(hdr, rows, idColName, idValue){
  var idCol = PG_hdrIdx(hdr, idColName);
  if (idCol < 0) throw new Error("Pages: ID column missing: "+idColName);
  for (var r=1;r<rows.length;r++){
    if (String(rows[r][idCol]) === String(idValue)) return r; // header=0
  }
  return -1;
}
function PG_bool(v){
  var s = String(v).trim().toLowerCase();
  if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true;
  return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="ok";
}
function PG_idColName(hdr){
  var cands = ["Page ID","page_id","id"];
  for (var i=0;i<cands.length;i++){
    if (PG_hdrIdx(hdr, cands[i]) >= 0) return cands[i];
  }
  throw new Error("Pages: ID column not resolved");
}
function PG_mapKeyToCol(hdr, key){
  // canonical names
  var CAN = {
    "page name":"Page Name",
    "page type":"Page Type",
    "entity":"Entity",
    "shared":"Shared",
    "config":"CONFIG" // if present
  };
  // synonyms
  var k = String(key).trim().toLowerCase();
  if (k==="page_name"||k==="name"||k==="title") k = "page name";
  else if (k==="page_type"||k==="type")          k = "page type";
  else if (k==="is_shared")                      k = "shared";
  // map to sheet header if exists
  var canon = CAN[k] || key;
  var idx = PG_hdrIdx(hdr, canon);
  if (idx >= 0) return { name: canon, idx: idx };
  // fallback: try original key
  idx = PG_hdrIdx(hdr, key);
  if (idx >= 0) return { name: key, idx: idx };
  return null; // unknown column -> ignore
}
function PG_setSelectedView_(pageId){
  PropertiesService.getScriptProperties().setProperty("CURRENT_PAGE_VIEW_ID", String(pageId));
}
/* ===== 20. End ===== */


/* ===== 21. dp_updatePageRecord (Pages, v2) ===== */
function dp_updatePageRecord(id, patch){
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");
    var all=_pg_readAll_(), sh=all.sh, hdrIds=all.hdrIds, hdrNames=all.hdrNames, rows=all.rows;
    var idCol=_pg_locateIdCol_(hdrIds, hdrNames);

    // 蟇ｾ雎｡陦梧爾邏｢
    var r=-1;
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][idCol])===String(id)){ r=i; break; }
    }
    if(r<0) return { ok:false, error:"Record not found", id:id };

    var row=rows[r].slice();
    var wrote=[];

    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      if(k==="__select") continue; // 蛻ｶ蠕｡繝輔Λ繧ｰ縺ｯ髯､螟・
      var colIdx=_pg_resolveCol_(hdrIds, hdrNames, k);
      if(colIdx<0) continue; // 荳肴・蛻励・辟｡隕・
      var val=(String(hdrNames[colIdx]).trim().toLowerCase()==="shared")?_pg_normBool_(patch[k]):patch[k];
      row[colIdx]=val;
      wrote.push(hdrIds[colIdx] || hdrNames[colIdx] || k);
    }

    if(wrote.length){
      // 繝倥ャ繝2陦後ｒ霍ｨ縺・□螳溘そ繝ｫ菴咲ｽｮ縺ｫ譖ｸ縺肴綾縺・
      sh.getRange(2+1+r, 1, 1, hdrIds.length).setValues([row]); // 0:ids,1:names, 陦後・2+index
    }

    // 驕ｸ謚槫・譖ｿ・亥叉譎ゑｼ・
    if(patch.__select===true){
      PropertiesService.getScriptProperties().setProperty("CURRENT_PAGE_VIEW_ID", String(id));
    }

    // 譛譁ｰ霑泌唆
    var latest={};
    for(var c=0;c<hdrIds.length;c++){ latest[hdrIds[c]||hdrNames[c]||("c"+c)] = row[c]; }
    return { ok:true, id:id, wrote:wrote, selected:(patch.__select===true), fields:latest };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), id:id };
  }
}
/* ===== 21. End ===== */


/* ===== 22. pages.read_api ===== */
function PG_vals(){ 
  var sh=SpreadsheetApp.getActive().getSheetByName("Pages");
  if(!sh) throw new Error("Sheet not found: Pages");
  var v=sh.getDataRange().getValues();
  if(!v||v.length<2) throw new Error("Pages header rows missing");
  return v;
}
function PG_hdrIdx(hdr, name){
  var n=String(name).trim().toLowerCase();
  for(var i=0;i<hdr.length;i++){ if(String(hdr[i]).trim().toLowerCase()===n) return i; }
  return -1;
}
function PG_idColName(hdr){
  var cands=["fi_0052","Page ID","page_id","id"];
  for (var i=0;i<cands.length;i++){ var idx=PG_hdrIdx(hdr,cands[i]); if(idx>=0) return hdr[idx]; }
  throw new Error("Pages: ID column not resolved");
}
function PG_bool(v){
  var s = String(v).trim().toLowerCase();
  if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true;
  return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="ok";
}

function gsListPagePresets(params){
  params=params||{};
  var wantEntity  = String(params.entity||'').toLowerCase();
  var wantType    = String(params.pageType||'').toLowerCase();
  var vals=PG_vals(), idsRow=vals[0], namesRow=vals[1], rows=vals.slice(2);
  var idName=PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var nmIdx = PG_hdrIdx(namesRow, "page name");
  var tpIdx = PG_hdrIdx(namesRow, "page type");
  var enIdx = PG_hdrIdx(namesRow, "entity");
  var shIdx = PG_hdrIdx(namesRow, "shared");

  var out=[];
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    var id = r[idIdx]; if(!id) continue;
    var ent=(enIdx>=0? String(r[enIdx]||'').toLowerCase(): '');
    var typ=(tpIdx>=0? String(r[tpIdx]||'').toLowerCase(): '');
    if(wantEntity && ent && ent!==wantEntity) continue;
    if(wantType   && typ && typ!==wantType)   continue;
    out.push({
      id: id,
      name: nmIdx>=0? r[nmIdx]:'',
      pageType: typ || '',
      entity: ent || '',
      shared: shIdx>=0? !!PG_bool(r[shIdx]): false
    });
  }
  return out;
}

function gsLoadPageConfig(params){
  var pid=params&&params.pageId; if(!pid) return {};
  var vals=PG_vals(), idsRow=vals[0], namesRow=vals[1], rows=vals.slice(2);
  var idName=PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var cfIdx = PG_hdrIdx(namesRow, "config");
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    if(String(r[idIdx])===String(pid)){
      var raw=(cfIdx>=0? r[cfIdx]:'');

      if(raw&&typeof raw==="string"){ try{ return JSON.parse(raw);}catch(e){ return {}; } }
      return {};
    }
  }
  return {};
}

function gsLoadPageConfigsBulk(ids){
  ids=Array.isArray(ids)? ids.map(String): [];
  var map={}, vals=PG_vals(), idsRow=vals[0], namesRow=vals[1], rows=vals.slice(2);
  var idName=PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var cfIdx = PG_hdrIdx(namesRow, "config");
  for(var i=0;i<rows.length;i++){
    var r=rows[i], pid=String(r[idIdx]||'');

    if(ids.indexOf(pid)<0) continue;
    var raw=(cfIdx>=0? r[cfIdx]:'');

    if(raw&&typeof raw==="string"){ try{ map[pid]=JSON.parse(raw);}catch(e){ map[pid]={}; } }
    else map[pid]={};
  }
  return map;
}
/* ===== 22. End ===== */


/* ===== 23. pages.write_api ===== */
function _pg_all_(){
  var sh=SpreadsheetApp.getActive().getSheetByName('Pages');
  if(!sh) throw new Error('Sheet not found: Pages');
  var v=sh.getDataRange().getValues();
  if(!v||v.length<2) throw new Error('Pages header rows missing');
  return { sh:sh, fi:v[0], names:v[1], rows:v.slice(2) };
}
function _pg_idxBy(a,key){ key=String(key).trim().toLowerCase(); for(var i=0;i<a.length;i++){ if(String(a[i]).trim().toLowerCase()===key) return i; } return -1; }
function _pg_bool(v){ var s=String(v).trim().toLowerCase(); if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true; return s==='true'||s==='1'||s==='yes'||s==='on'||s==='y'||s==='ok'; }

function _pg_findIdx(fi,names, fiKey, labelKey, altLabels){
  // FI蜆ｪ蜈遺・繝ｩ繝吶Ν竊貞酔鄒ｩ隱・
  var idx = _pg_idxBy(fi, fiKey);
  if(idx>=0) return idx;
  idx = _pg_idxBy(names, labelKey);
  if(idx>=0) return idx;
  for(var i=0;i<(altLabels||[]).length;i++){
    idx = _pg_idxBy(names, altLabels[i]);
    if(idx>=0) return idx;
  }
  return -1;
}

function gsCreatePagePreset(params){
  params=params||{};
  var ent   = String(params.entity||'').trim();
  var name  = String(params.name||'').trim() || '(no name)';
  var shared= !!params.shared;
  var ptype = String(params.pageType||'table').trim() || 'table';
  var cfgIn = params.config; 
  var cfgStr=(typeof cfgIn==='string')? cfgIn : (cfgIn? JSON.stringify(cfgIn): '');

  // 蜊倡匱繝ｭ繝・け + 逶ｴ蜑埼㍾隍・亟豁｢
  var lock=LockService.getScriptLock();
  try{ lock.tryLock(3000); }catch(e){}
  var sp=PropertiesService.getScriptProperties();
  var lastId=sp.getProperty('LAST_CREATED_PAGE_ID');
  var lastAt=Number(sp.getProperty('LAST_CREATED_PAGE_AT')||0);
  if(lastId && (Date.now()-lastAt)<4000){
    if(lock) try{ lock.releaseLock(); }catch(e){}
    return { ok:true, id:lastId, dedup:true };
  }

  var a=_pg_all_(), sh=a.sh, fi=a.fi, names=a.names, rows=a.rows;

  // 蠢・・蛻励・縲熊I縺檎┌縺上※繧ゅΛ繝吶Ν縺ｧ蜿ｯ縲阪，ONFIG/Shared 縺ｯ辟｡縺上※繧ゅお繝ｩ繝ｼ縺ｫ縺励↑縺・
  var cID=_pg_findIdx(fi,names,'fi_0052','page id',['id','page_id']);
  var cNM=_pg_findIdx(fi,names,'fi_0053','page name',['name','title']);
  var cTP=_pg_findIdx(fi,names,'fi_0054','page type',['type']);
  var cEN=_pg_findIdx(fi,names,'fi_0055','entity',['sheet','table']);
  var cCF=_pg_findIdx(fi,names,'fi_0056','config',['CONFIG','Config']);
  var cSH=_pg_findIdx(fi,names,'fi_0057','shared',['is_shared','shared?']);

  if(cID<0 || cNM<0 || cTP<0 || cEN<0){
    if(lock) try{ lock.releaseLock(); }catch(e){}
    return { ok:false, error:'Pages header missing (need Page ID / Page Name / Page Type / Entity)' };
  }

  // newId 謗｡逡ｪ・域里蟄倥・ pg_#### 縺九ｉ譛螟ｧ+1・・
  var maxN=0;
  for(var i=0;i<rows.length;i++){
    var m=String(rows[i][cID]||'').match(/^pg_(\d{1,})$/i);
    if(m){ var n=+m[1]; if(n>maxN) maxN=n; }
  }
  var newId='pg_'+('0000'+(maxN+1)).slice(-4);

  // 譁ｰ隕剰｡後・繝ｼ繧ｹ
  var outRow=new Array(fi.length).fill('');
  outRow[cID]=newId; outRow[cNM]=name; outRow[cTP]=ptype; outRow[cEN]=ent;
  if(cSH>=0) outRow[cSH]=shared?true:false;
  if(cCF>=0 && cfgStr) outRow[cCF]=cfgStr;

  // 逶｣譟ｻ・医Λ繝吶Ν蛻怜━蜈医〒閾ｪ蜍墓､懷・・・
  var createdByIdx=_pg_idxBy(names,'created by'); if(createdByIdx<0) createdByIdx=_pg_idxBy(names,'createdby');
  var createdAtIdx=_pg_idxBy(names,'created');    if(createdAtIdx<0) createdAtIdx=_pg_idxBy(names,'created at');
  try{
    if(createdByIdx>=0){
      var by=Session.getActiveUser() && Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '';
      outRow[createdByIdx]=by||'system';
    }
    if(createdAtIdx>=0){ outRow[createdAtIdx]=new Date(); }
  }catch(e){}

  sh.appendRow(outRow);

  sp.setProperty('LAST_CREATED_PAGE_ID', newId);
  sp.setProperty('LAST_CREATED_PAGE_AT', String(Date.now()));
  sp.setProperty('CURRENT_PAGE_VIEW_ID', String(newId));
  if(lock) try{ lock.releaseLock(); }catch(e){}

  var ret={};
  for(var z=0; z<fi.length; z++){ ret[fi[z]||names[z]||('c'+z)] = outRow[z]; }
  return { ok:true, id:newId, name:name, pageType:ptype, entity:ent, shared:!!(cSH>=0 && outRow[cSH]), fields:ret };
}
/* ===== 23. End ===== */


/* ===== 24. labels.bulk_api (繝・・繝悶Ν逕ｨ縺ｮ荳諡ｬ繝ｩ繝吶Ν隗｣豎ｺ) ===== */
function dp_resolveLabelsBulk(ids){
  ids = Array.isArray(ids)? ids.filter(function(s){return !!s;}) : [];
  var out = {};
  for (var i=0;i<ids.length;i++){
    var id = String(ids[i]);
    var lbl = _resolveEntityLinkLabel_(id);
    if (lbl!=null) out[id]=lbl;
  }
  return out;
}
/* ===== 24. End ===== */


/* ===== 25. DebugPanel APIs (server) ===== */
/** ping */
function dp_debugPing(){
  return { ts: Date.now(), ok: true };
}

/** optional: page layout presets */
function dp_listPageLayoutPresets(req){
  // 螳溯｣・悴莠・〒繧ゅお繝ｩ繝ｼ縺ｫ縺励↑縺・ｮ牙ｮ夊ｿ泌唆
  return [];
}

/** project meta accessor */
function dp_getProjectMeta(){
  try{
    if (typeof _sv_getMeta_ === "function") {
      var meta = _sv_getMeta_({}) || {};
      return meta;
    }
  } catch(e){}
  return {};
}

/** originals trace */
function dp_traceOriginals(req){
  req = req || {};
  var ent = String(req.entity || "shot").toLowerCase();
  var id  = String(req.id || "").trim();
  var out = { input:{entity:ent,id:id}, steps:[], finalUrl:"", found:false };

  function step(name, ok, info){ out.steps.push({ name:name, ok:!!ok, info: info||{} }); }
  function _isHttpUrl_(s){ return typeof s === "string" && /^https?:\/\//i.test(s); }
  function _safeCall_(name, arg){
    try{ 
      var fn = Function('return ' + name + ';')();  // 蜍慕噪蜿ら・ (GAS莠呈鋤)
      if (typeof fn === "function") { 
        var val = fn(arg); 
        step(name, val != null, { fn: name, url: _isHttpUrl_(val) ? val : null }); 
        return {name:name, value:val}; 
      } else {
        step(name, false, { fn: name, exists: false });
        return {name:name, value:null};
      }
    }catch(e){
      step(name, false, { fn: name, error: e.message });
      return {name:name, value:null};
    }
  }
  function _safeChain_(names, arg){
    for (var i=0;i<names.length;i++){
      var r = _safeCall_(names[i], arg);
      if (r.value != null) return r;
    }
    return {name:null, value:null};
  }

  // A) DriveBuilder
  var dbNames = ["DB_getOriginalsUrl","DriveBuilder_getOriginalsUrl","DB_getOriginalsFolderUrl","DriveBuilder_getOriginalsFolderUrl"];
  var db   = _safeChain_(dbNames, [ent,id]);
  var dbUrl= "";
  if (db.value) {
    if (typeof db.value === "string" && _isHttpUrl_(db.value)) dbUrl = db.value;
    else if (db.value && typeof db.value === "object" && _isHttpUrl_(db.value.url)) dbUrl = db.value.url;
  }

  // B) generic server APIs
  var apiNames = ["sv_getOriginalsUrl","getOriginalsUrl","sv_getOriginalsFolderUrl","getOriginalsFolderUrl"];
  var api   = _safeChain_(apiNames, {entity:ent,id:id});
  var apiUrl= "";
  if (api.value) {
    if (typeof api.value === "string" && _isHttpUrl_(api.value)) apiUrl = api.value;
    else if (api.value && typeof api.value === "object" && _isHttpUrl_(api.value.url)) apiUrl = api.value.url;
  }

  // C) project meta root
  var root = "";
  try{
    var meta = dp_getProjectMeta() || {};
    root = meta.originals_root_url || meta.proxies_root_url || "";
  }catch(_){}
  step("ProjectMetaRoot", !!root, { root: root || null });

  // D) final
  out.finalUrl = apiUrl || dbUrl || root || "";
  out.found    = !!out.finalUrl;
  return out;
}

var VIEWER_STATE_PROP_PREFIX='MOTK_VIEWER_STATE_V1';

function dp_storeViewerState(snapshot){
  try{
    var snap=_sanitizeViewerSnapshot(snapshot||{});
    try{
      console.log('dp_storeViewerState snapshot', JSON.stringify(snap));
    }catch(_){}
    var payload={
      snapshot:snap,
      storedAt:Date.now(),
      user:_currentUserEmail()||'unknown'
    };
    _persistViewerStatePayload(payload);
    return { ok:true, storedAt:payload.storedAt };
  }catch(e){
    return { ok:false, error:e && e.message ? e.message : String(e) };
  }
}

function dp_fetchViewerState(){
  try{
    var payload=_loadViewerStatePayload();
    if(payload && payload.snapshot){
      return {
        ok:true,
        found:true,
        storedAt:payload.storedAt||null,
        user:payload.user||'',
        snapshot:payload.snapshot
      };
    }
    return { ok:true, found:false };
  }catch(e){
    return { ok:false, error:e && e.message ? e.message : String(e) };
  }
}

function _currentUserEmail(){
  var email='';
  try{
    var act=Session.getActiveUser();
    if(act && typeof act.getEmail==='function') email=act.getEmail()||'';
  }catch(_){}
  if(!email){
    try{
      var eff=Session.getEffectiveUser();
      if(eff && typeof eff.getEmail==='function') email=eff.getEmail()||'';
    }catch(_){}
  }
  return email||'';
}

function _viewerStateStorageKey(){
  return VIEWER_STATE_PROP_PREFIX+'::'+(_currentUserEmail()||'anonymous');
}

function _persistViewerStatePayload(payload){
  var key=_viewerStateStorageKey();
  var serialized='';
  try{ serialized=JSON.stringify(payload||{}); }catch(_){ serialized=''; }
  if(!serialized) return;
  try{
    CacheService.getUserCache().put(key, serialized, 60*60);
  }catch(_){}
  try{
    PropertiesService.getUserProperties().setProperty(key, serialized);
  }catch(_){}
}

function _loadViewerStatePayload(){
  var key=_viewerStateStorageKey();
  var raw=null;
  try{
    raw=CacheService.getUserCache().get(key);
  }catch(_){}
  if(!raw){
    try{
      raw=PropertiesService.getUserProperties().getProperty(key);
    }catch(_){}
  }
  if(!raw) return null;
  try{
    var parsed=JSON.parse(raw);
    if(parsed && typeof parsed==='object') return parsed;
  }catch(_){}
  return null;
}

function _sanitizeViewerSnapshot(snapshot){
  var allowed=['sheetName','pageId','page','perPage','rowsLength','total','dataSource','origin','entityParam','pageParam','pidParam','statusText','rowsStart','rowsEnd','sampleIds'];
  var out={};
  for(var i=0;i<allowed.length;i++){
    var key=allowed[i];
    if(snapshot.hasOwnProperty(key)){
      out[key]=snapshot[key];
    }
  }
  out.capturedAt=snapshot.capturedAt||new Date().toISOString();
  return out;
}
/* ===== 25. End ===== */


/* ===== 26. Setup & Helpers ===== */

/** Read-only data loader: Simulate app data load without GSS changes */
function loadAppData() {
  var props = PropertiesService.getScriptProperties();
  var loadedKey = 'data_loaded';
  if (props.getProperty(loadedKey)) {
    console.log('Data already simulated. Skipping.');
    return;
  }
  
  // GSS隱ｭ蜿悶・縺ｿ・域嶌縺崎ｾｼ縺ｿ縺ｪ縺暦ｼ峨〒繝｡繧ｿ遒ｺ隱・
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var metaSh = ss.getSheetByName('project_meta');
    if (metaSh) {
      var metaData = metaSh.getRange(1, 1, 2, metaSh.getLastColumn()).getValues();
      var meta = {};
      metaData[0].forEach(function(k, i) { meta[String(k).toLowerCase()] = metaData[1][i]; });
      console.log('GSS meta read: originals_root_url=' + (meta.originals_root_url || 'unset'));
    }
  } catch (e) {
    console.error('GSS read error: ' + e.message);
  }
  
  props.setProperty(loadedKey, 'true');
  console.log('Read-only load complete: No GSS changes. Use dp_loadAppData for debug verification.');
}

/** Load FIELD_TYPES from Fields sheet (entity-specific, read-only) */
function getFieldTypes(entity) {  // entity繝輔ぅ繝ｫ繧ｿ霑ｽ蜉縺ｧ蜉ｹ邇・喧
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName('Fields');
    if (!sh || sh.getLastRow() < 2) return {};
    
    var data = sh.getDataRange().getValues();
    var types = {};
    var targetEntity = (entity || '').toLowerCase().trim();
    for (var r = 1; r < data.length; r++) {
      var fid = String(data[r][0] || '').trim();
      var ent = String(data[r][1] || '').toLowerCase().trim();
      if (fid && (!targetEntity || ent === targetEntity)) {
        if (!types[ent]) types[ent] = {};
        types[ent][fid] = { 
          label: String(data[r][2] || '').trim(), 
          type: String(data[r][3] || 'text').trim(),
          editable: !!(data[r][4] || false), 
          required: !!(data[r][5] || false) 
        };
      }
    }
    return types;
  } catch (e) {
    console.error('getFieldTypes error: ' + e.message);
    return {};
  }
}

/** Debug: Load app data (LINK_MAPS + FieldTypes) for panel verification - 繧｢繝励Μ隱ｭ縺ｿ霎ｼ縺ｿ繝輔Ο繝ｼ繝・せ繝茨ｼ・ead-only・・*/
function dp_loadAppData() {
  try {
    // 繧｢繝励Μ髢｢謨ｰ繧ｷ繝溘Η繝ｬ繝ｼ繝茨ｼ・v_getLinkMaps/getFieldTypes蜻ｼ蜃ｺ縲；SS隱ｭ蜿悶・縺ｿ・・
    var linkMaps = typeof sv_getLinkMaps === 'function' ? sv_getLinkMaps() : { assets:{}, shots:{}, tasks:{}, users:{}, members:{} };
    var fieldTypes = getFieldTypes();
    var meta = typeof _sv_getMeta_ === 'function' ? _sv_getMeta_({}) : {};
    
    // 繧ｫ繧ｦ繝ｳ繝・繧ｭ繝ｼ謚ｽ蜃ｺ
    var counts = { assets: Object.keys(linkMaps.assets || {}).length, shots: Object.keys(linkMaps.shots || {}).length, tasks: Object.keys(linkMaps.tasks || {}).length, users: Object.keys(linkMaps.users || {}).length, members: Object.keys(linkMaps.members || {}).length };
    var fieldKeys = Object.keys(fieldTypes).reduce(function(acc, ent){ return acc + Object.keys(fieldTypes[ent] || {}).length; }, 0);
    
    return {
      linkMaps: linkMaps,
      fieldTypes: fieldTypes,
      meta: meta,
      counts: counts,
      fieldKeysTotal: fieldKeys,
      ts: Date.now(),
      message: 'App data loaded successfully (read-only, no GSS changes).'
    };
  } catch (e) {
    console.error('dp_loadAppData error: ' + e.message);
    return { error: e.message, ts: Date.now() };
  }
}

/* ===== 26. End ===== */

