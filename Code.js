// BUILD_STAMP: 2025-11-14 23:55 JST
/** =========================================
 *  Code.gs (ナンバリング整琁E��)
 *  - doGet に DebugPanel ペ�Eジ追加
 *  - 他�E処琁E�E現状維持E
 * =========================================*/

/* ===== Section Index =====
 *  1. グローバルコンチE��スチE
 *  2. include (HTML 部品読込)
 *  3. doGet Router
 *  4. Data 読み取り�E�EataHub 優先！E
 *  5. 型推宁E補正ユーチE��リチE��
 *  6. フィルタ評価ユーチE��リチE��
 *  7. Sheet-backed row listing & fields
 *  8. FieldTypes-based Data API
 *  9. Entity Read/Write API (header)
 * 10. Entity utils
 * 11. entity_sheet_map
 * 12. fields_resolver
 * 13. label_resolver (entity_linkのみラベル匁E
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


/* ===== 1. グローバルコンチE��スチE===== */
var __VIEW_CTX = { scriptUrl:'', page:'', entity:'', id:'', dataJson:'[]' };
/* ===== 1. End ===== */


/* ===== 2. include (HTML 部品読込) ===== */
function include(filename) {
  var t = HtmlService.createTemplateFromFile(filename);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];
  return t.evaluate().getContent();
}
/* ===== 2. End ===== */


/* ===== 3. doGet Router ===== */

// ペ�Eジ吁EↁEチE��プレート名
var PAGE_TEMPLATE_MAP = {
  '':          'index',
  'shots':     'index',
  'assets':    'index',
  'tasks':     'index',
  'members':   'index',
  'users':     'index',
  'dashboard': 'index',
  'settings':  'index',
  'debugpanel':'DebugPanelPage'  // DebugPanel 専用チE��プレ
};

// page / entity / id からチE��プレート名を決宁E
function _resolveTemplateName_(page, entity, id) {
  var p = String(page || '').toLowerCase();

  if (p === 'debugpanel') {
    return 'DebugPanelPage';
  }

  if (PAGE_TEMPLATE_MAP.hasOwnProperty(p)) {
    return PAGE_TEMPLATE_MAP[p];
  }

  // 想定外�E page はすべて index にフォールバック
  return 'index';
}

// ルーター本佁E
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || '').toLowerCase();

  // 3-0. 互換用 dataJson パラメータ�E�旧 doGet との互換�E�E
  // 旧コードが dataJson を参照してぁE��めEReferenceError にならなぁE��ぁE��しておく
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

  // 3-1. 特殊エンド�Eイント！ESバンドル / スチE�Eタス�E�E

  // index.html 等から�E:
  //   <script src="<?= scriptUrl ?>?action=app-bundle"></script>
  // に対して JS を返す
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

  // 簡易スチE�Eタス�E�忁E��なければ無視してよい�E�E
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

  // 3-2. 通常の HTML ペ�Eジ�E�Endex / DebugPanel など�E�E

  var page   = params.page   || 'Shots';
  var entity = (params.entity || '').toLowerCase();
  var id     = params.id     || '';

  var templateName = _resolveTemplateName_(page, entity, id);

  // チE��プレート作�E
  var t;
  try {
    t = HtmlService.createTemplateFromFile(templateName);
  } catch (err) {
    // チE��プレート名解決失敗時の簡易エラー
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

  // チE��プレートに渡すコンチE��スト（ローカルのみ、グローバル関数は使わなぁE��E
  var viewCtx = {
    page: page,
    entity: entity,
    id: id,
    scriptUrl: ScriptApp.getService().getUrl()
  };

  // 個別に直接渡す（既存テンプレ互換用�E�E
  t.page      = viewCtx.page;
  t.entity    = viewCtx.entity;
  t.id        = viewCtx.id;
  t.scriptUrl = viewCtx.scriptUrl;

  // 旧コード互換: dataJson をテンプレへ渡ぁE
  t.dataJson  = dataJson;

  // まとめて欲しい場合用
  t.viewCtx = viewCtx;

  // HTML として返却
  return t.evaluate()
    .setTitle(viewCtx.page || 'MOTK')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===== 3. End ===== */



/* ===== 4. Data 読み取り�E�EataHub 優先！E===== */
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


/* ===== 5. 型推宁E補正ユーチE��リチE�� ===== */
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


/* ===== 6. フィルタ評価ユーチE��リチE�� ===== */
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
 * listRowsPage 用のパラメータ正規化
 *
 * 受け入れる形:
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

  entRaw = String(entRaw || '').trim();
  var entLc = entRaw.toLowerCase();
  var entityKey = entLc || 'shot';

  // entity ↁEシート名マッチE
  var sheetNameMap = {
    shot:   'Shots',
    asset:  'Assets',
    task:   'Tasks',
    member: 'Members',
    user:   'Users',
    page:   'Pages'
  };
  var sheetName = sheetNameMap[entityKey] || entRaw || 'Shots';

  // limit
  var limitFromParams = Number(params.limit);
  var limitFromObj    = entObj && Number(entObj.perPage);
  var limit           = limitFromParams || limitFromObj || 100;
  if (!limit || limit < 1) limit = 100;

  // page ↁEoffset
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
 * シート名候補から最初に見つかったシートを返す
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
 * 持E��シートから�EチE���E�データ行を取征E
 *  - ヘッダ衁E 1行目
 *  - チE�Eタ衁E 2行目以降（完�E空行�EスキチE�E�E�E
 */
function _readEntitySheet_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // シート候裁E "Shots", "shots", "SHOTS", "Shot"
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

/**
 * listRowsPage のコア実裁E
 * 戻り値: { columns: [...], rows: [...], meta: {...} }
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

  var total = rows.length;

  var start = offset;
  if (start < 0) start = 0;
  if (start > total) start = total;

  var end = start + limit;
  if (end > total) end = total;

  var sliced = rows.slice(start, end);

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
 * サーバ�E部用�E�Eontract Inspector など直接呼び出し！E*/
function listRowsPage(params) {
  if (typeof params === 'string') {
    params = { entity: params };
  }
  return _listRowsPageCore_(params || {});
}

/**
 * RPC エンド�Eイント！EI からはこれが呼ばれる想定！E*/
function sv_listRowsPage(params) {
  if (typeof params === 'string') {
    params = { entity: params };
  }
  return _listRowsPageCore_(params || {});
}

/**
 * FIELDS シートから、指宁Eentity のフィールド行を配�Eで返す
 * 戻り値は、E行目以降�E raw 行�E列、E
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

  // "Entity" 列を探ぁE
  var entityCol = -1;
  for (var c = 0; c < header.length; c++) {
    if (String(header[c]).toLowerCase() === 'entity') {
      entityCol = c;
      break;
    }
  }
  // ヘッダが無ぁE��合�E暫定で刁EめEEntity とみなぁE
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
 * チE��チE��用: ショチE��一覧をサーバ�Eログで確誁E
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
 * チE��チE��用: アセチE��一覧をサーバ�Eログで確誁E
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
 * 目皁E
 * - 既存�E listRowsPage(params) をそのまま利用しつつ、E
 *   Fields シート由来のメタ惁E��付き sv_listRowsPage(entity, options) を提供すめE
 * - DebugPanel Contract Inspector から呼ぶ getFields / listFields を提供すめE
 *
 * ポリシー:
 * - 行データの読み出し�Eフィルタ・ソート�Eペ�Eジングは既孁ElistRowsPage に一本匁E
 *   �E�ロジチE��の二重実裁E�E重褁E��ープを避ける�E�E
 * - 列メタ惁E��は Fields シート！EetFieldTypes�E�から引き、FI�E�Eield id�E�で結合
 *   �E�Eabel/name では判別しなぁE��E
 */

/**
 * サーバ�E側チE�Eブル API (契紁E��査用)
 * - entity: 'shot' / 'asset' / 'task' / 'member' / 'user' / 'page'
 * - options: { limit, offset, sort, filter, filterMode, filterGroups, groupCombine, sheet? }
 *
 * 戻り値:
 * {
 *   columns: [ {id,fieldId,name,label,type,editable,required,index,meta}, ... ],
 *   row0:    [... 先頭衁E...] また�E null,
 *   rows:    [[...], [...], ...],
 *   meta:    { total, sheet, offset, limit, entity }
 * }
 */
function sv_listRowsPage(entity, options) {
  options = options || {};
  if (!entity) {
    throw new Error('sv_listRowsPage: entity is required.');
  }

  // 既存�E listRowsPage をそのまま利用して、行データと ids/header を取征E
  var params = {
    entity: entity,
    sheet:  options.sheet || '',

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

  // Fields シートからフィールド定義を取得！EI ベ�Eス�E�E
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
 * - DebugPanel Contract Inspector 用、E
 * - entity が渡されたらそ�E entity だけ、E
 *   未持E��なら�E entity の定義を返す、E
 * - 判別は entity の斁E���E�E�Eshot" 等！E FI ベ�Eス、E
 */
function getFields(entity) {
  // getFieldTypes は entity を省略すると全エンチE��チE��を返す実裁E
  var all = getFieldTypes(entity || null) || {};

  // entity 未持E��ならそのまま返す�E�Eields matrix 用�E�E
  if (!entity) {
    return all;
  }

  var key = String(entity || '').toLowerCase();
  return all[key] || {};
}


/**
 * listFields()
 * - 全 entity のフィールド定義をまとめて取得、E
 * - 返却形弁E { shot:{fi_0001:{...},...}, asset:{...}, ... }
 */
function listFields() {
  // getFieldTypes に entity を渡さなぁE��また�E空�E�と、�E entity を返す実裁E��なってぁE��前提、E
  return getFieldTypes(null) || {};
}

/* ===== 8. End ===== */


/* ===== 9. Entity Read/Write API (header) ===== */
/**
 * 目皁E
 * - DETAIL_entity.html からのレコード読込/差刁E��込APIを提侁E
 * 前提:
 * - ES5準拠
 * - シスチE��は全権。ユーザーUIからの編雁E�E Fields 側のeditable相当で判宁E
 * - ID→ラベル置換�E entity_link のみ�E�返却は {v,id,label?,t} 形�E�E
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
 * FieldsシートかめE
 *  - 吁EntityのID列�Eラベル列！Eype=='id' | 'entity_name'�E�E
 *  - editable相彁E
 * を推定。�EチE��名�EめE��く正規化して探索する、E
 */
function _readFields_(){
  var values = _read2D_("Fields"); // 例外時は既存運用に従いthrow
  var hdr = values[0];
  var rows = values.slice(1);
  var H = {};
  for(var i=0;i<hdr.length;i++){ H[_norm_(hdr[i])] = i; }
  // 想定カラム候裁E
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
  // Fallback�E�安�E側�E�E
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
  // 他ユーザー向けの編雁E��否。シスチE��は無制限だが、フラグは返す、E
  var fields = _readFields_();
  var e = _norm_(entity), c = _norm_(colName);
  for(var i=0;i<fields.length;i++){
    if(_norm_(fields[i].entity)!==e) continue;
    if(_norm_(fields[i].column_name)===c){
      var v = fields[i].editable;
      // truthy判定！ERUE/true/1/Yes�E�E
      return (String(v).toLowerCase()==="true" || String(v)==="1" || String(v).toLowerCase()==="yes");
    }
  }
  return false;
}
/* ===== 12. End ===== */


/* ===== 13. label_resolver (entity_linkのみラベル匁E ===== */
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
  // entity_linkの判定：値のprefixから推定、ED→ラベルはここだけ、E
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
      token.editable = _isEditable_(entity, hdr[i]); // 他ユーザー向け
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
  // 差刁E�Eみ。シスチE��は全権だが、E��editable列に対してはwarningsを返す、E
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");

    var sheetName = _entityToSheet_(entity);
    var sh = _shByName_(sheetName);
    var values = sh.getDataRange().getValues();
    var hdr = values[0];
    var map = _idAndLabelCols_(entity, hdr);
    if(!map.idName) throw new Error("ID column not resolved for entity: "+entity);
    var idCol = _hdrIndex_(hdr, map.idName);

    // 対象行探索
    var rIdx=-1, i;
    for(i=1;i<values.length;i++){
      if(String(values[i][idCol])===String(id)){ rIdx=i; break; }
    }
    if(rIdx<0) return { ok:false, error:"Record not found", entity:entity, id:id };

    // 行�E褁E��
    var row = values[rIdx].slice();
    var warnings = [];

    // PATCH適用
    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      var colIdx = _hdrIndex_(hdr, k);
      if(colIdx<0) continue; // 未知カラムは無要E

      // editable判定�E返却用に保持�E�シスチE��は書く！E
      if(!_isEditable_(entity, k)){
        warnings.push("non_editable: "+k);
      }
      row[colIdx] = patch[k];
    }

    // 書込�E�一括�E�E
    sh.getRange(rIdx+1, 1, 1, hdr.length).setValues([row]);

    // 最新を返す
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
 * Pageタブ�E忁E��E列！Eage Name, Page Type, Entity, Shared�E�を安�Eに読み書きする専用API、E
 * - 既存UI/HTMLは変更不要、Eode.jsのみ差し込みで動作、E
 * - Sharedは "TRUE/true/1/yes/on/✁E ↁEtrue、それ以外�Efalse に正規化、E
 * - save-as用ユーチE��リチE��も提供（�E行�E値を引き継ぎつつ上書き可�E�、E
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
  return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="✁E;
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
// 列名解決�E�FI優允EↁE人間ラベル ↁE同義キーをラベルへ寁E��て再探索
function _pg_resolveCol_(hdrIds, hdrNames, key){
  if(!key) return -1;
  // 1) すでに FI 持E��！Ei_XXXX�E�E
  if(/^fi_\d{4,}$/i.test(key)){
    var idx=_pg_idxById_(hdrIds, key);
    if(idx>=0) return idx;
  }
  // 2) そ�Eままラベル一致
  var idxN=_pg_idxByName_(hdrNames, key);
  if(idxN>=0) return idxN;
  // 3) 同義語を正規ラベルに寁E��めE
  var k=String(key).trim().toLowerCase();
  if(k==="page_name"||k==="name"||k==="title") k="page name";
  else if(k==="page_type"||k==="type")          k="page type";
  else if(k==="is_shared"||k==="shared?")       k="shared";
  else if(k==="config_json"||k==="config")      k="config";
  // 再探索�E�ラベル�E�E
  idxN=_pg_idxByName_(hdrNames, k);
  if(idxN>=0) return idxN;
  // 4) 最後に FI としても試す（丁E��ラベルぁEfi_ に置かれてぁE��場合！E
  return _pg_idxById_(hdrIds, k);
}
// Page ID 列�E特定！EI優先�Eラベル�E�E
function _pg_locateIdCol_(hdrIds, hdrNames){
  var c;
  c=_pg_idxById_(hdrIds, "fi_0052"); if(c>=0) return c;          // Page ID 慣侁E
  c=_pg_idxByName_(hdrNames, "page id"); if(c>=0) return c;
  c=_pg_idxById_(hdrIds, "page_id"); if(c>=0) return c;
  c=_pg_idxById_(hdrIds, "id"); if(c>=0) return c;
  throw new Error("Pages: ID column not resolved");
}
/* ===== 17. End ===== */


/* ===== 18. page.api ===== */
/**
 * 読み込み�E�忁E��ならデバッグ用途で使用。UI差し替え不要、E
 */
function dp_getPageRecord(id){
  try{
    var values=_pg_read2D_(); var hdr=values[0];
    // ID列�E慣例！E"Page ID" / "page_id" / "id" を頁E��探索
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
 * 書き込み�E�差刁EATCH�E�：CONFIGだけでなく、Page Name / Page Type / Entity / Shared も対象、E
 * 既存�E一般用保存ロジチE��から、entity==='page' の場合にこれを呼ぶだけで修復可能、E
 */
function dp_updatePageRecord(id, patch){
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");

    var values=_pg_read2D_(); var hdr=values[0]; var sh=_pg_sh_();

    // 列名解決
    var idName=null, idCands=["Page ID","page_id","id"];
    for(var i=0;i<idCands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,idCands[i])>=0) idName=idCands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    var r=_pg_findById_(hdr, values, idName, id);
    if(r<0) return { ok:false, error:"Record not found", id:id };

    var row=values[r].slice(); // コピ�E
    // 正式�E吁E
    var COL_PAGE_NAME = "Page Name";
    var COL_PAGE_TYPE = "Page Type";
    var COL_ENTITY    = "Entity";
    var COL_SHARED    = "Shared";

    // PATCH適用�E�任意�E�E�E Sharedの正規化
    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      var idx=_pg_hdrIdx_(hdr, k);
      if(idx<0) continue; // 未知列�E無要E
      var v = (k===COL_SHARED)? _pg_normBool_(patch[k]) : patch[k];
      row[idx]=v;
    }

    // 書込
    sh.getRange(r+1, 1, 1, hdr.length).setValues([row]);

    // 返却
    var latest={};
    for(var c=0;c<hdr.length;c++){ latest[hdr[c]]=row[c]; }
    return { ok:true, id:id, fields:latest };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), id:id };
  }
}

/**
 * save-as�E��Eペ�Eジを褁E��し、IDと上書きパチE��を適用。Sharedは允E�E値を継承�E�Eatchで上書き可�E�、E
 * 既存�Esave-asフローから置き換え可能。UI側にチェチE��ボックスが無ぁE��合も、ここで論理値を尊重、E
 */
function dp_saveAsPage(srcId, newId, patch){
  try{
    var get=dp_getPageRecord(srcId);
    if(!get || !get.ok) return { ok:false, error:"Source not found: "+srcId };

    var values=_pg_read2D_(); var hdr=values[0]; var sh=_pg_sh_();

    // 列名解決
    var idName=null, idCands=["Page ID","page_id","id"];
    for(var i=0;i<idCands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,idCands[i])>=0) idName=idCands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    // newIdが既存ならエラー
    var exists=_pg_findById_(hdr, values, idName, newId);
    if(exists>=0) return { ok:false, error:"Already exists: "+newId };

    // 新規行作�E�E��E行を継承
    var srcIdx=_pg_findById_(hdr, values, idName, srcId);
    if(srcIdx<0) return { ok:false, error:"Source not found: "+srcId };
    var base=values[srcIdx].slice();

    // ID差し替ぁE
    var idCol=_pg_hdrIdx_(hdr, idName);
    base[idCol]=newId;

    // パッチE��用�E�Eharedは正規化�E�E
    var COL_SHARED="Shared";
    if(patch && typeof patch==="object"){
      for(var k in patch){
        if(!patch.hasOwnProperty(k)) continue;
        var idx=_pg_hdrIdx_(hdr, k);
        if(idx<0) continue;
        base[idx]=(k===COL_SHARED)? _pg_normBool_(patch[k]) : patch[k];
      }
    }

    // 追訁E
    sh.appendRow(base);

    // 返却
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
  return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="✁E;
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

    // 対象行探索
    var r=-1;
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][idCol])===String(id)){ r=i; break; }
    }
    if(r<0) return { ok:false, error:"Record not found", id:id };

    var row=rows[r].slice();
    var wrote=[];

    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      if(k==="__select") continue; // 制御フラグは除夁E
      var colIdx=_pg_resolveCol_(hdrIds, hdrNames, k);
      if(colIdx<0) continue; // 不�E列�E無要E
      var val=(String(hdrNames[colIdx]).trim().toLowerCase()==="shared")?_pg_normBool_(patch[k]):patch[k];
      row[colIdx]=val;
      wrote.push(hdrIds[colIdx] || hdrNames[colIdx] || k);
    }

    if(wrote.length){
      // ヘッダ2行を跨ぁE��実セル位置に書き戻ぁE
      sh.getRange(2+1+r, 1, 1, hdrIds.length).setValues([row]); // 0:ids,1:names, 行�E2+index
    }

    // 選択�E替�E�即時！E
    if(patch.__select===true){
      PropertiesService.getScriptProperties().setProperty("CURRENT_PAGE_VIEW_ID", String(id));
    }

    // 最新返却
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
function PG_bool(v){ var s=String(v).trim().toLowerCase(); return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="✁E; }

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
function _pg_bool(v){ var s=String(v).trim().toLowerCase(); return s==='true'||s==='1'||s==='yes'||s==='on'||s==='y'||s==='✁E; }

function _pg_findIdx(fi,names, fiKey, labelKey, altLabels){
  // FI優先�Eラベル→同義誁E
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

  // 単発ロチE�� + 直前重褁E��止
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

  // 忁E��E列�E「FIが無くてもラベルで可」、CONFIG/Shared は無くてもエラーにしなぁE
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

  // newId 採番�E�既存�E pg_#### から最大+1�E�E
  var maxN=0;
  for(var i=0;i<rows.length;i++){
    var m=String(rows[i][cID]||'').match(/^pg_(\d{1,})$/i);
    if(m){ var n=+m[1]; if(n>maxN) maxN=n; }
  }
  var newId='pg_'+('0000'+(maxN+1)).slice(-4);

  // 新規行�Eース
  var outRow=new Array(fi.length).fill('');
  outRow[cID]=newId; outRow[cNM]=name; outRow[cTP]=ptype; outRow[cEN]=ent;
  if(cSH>=0) outRow[cSH]=shared?true:false;
  if(cCF>=0 && cfgStr) outRow[cCF]=cfgStr;

  // 監査�E�ラベル列優先で自動検�E�E�E
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


/* ===== 24. labels.bulk_api (チE�Eブル用の一括ラベル解決) ===== */
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
  // 実裁E��亁E��もエラーにしなぁE��定返却
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
      var fn = Function('return ' + name + ';')();  // 動的参�E (GAS互換)
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
  
  // GSS読取�Eみ�E�書き込みなし）でメタ確誁E
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
function getFieldTypes(entity) {  // entityフィルタ追加で効玁E��
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

/** Debug: Load app data (LINK_MAPS + FieldTypes) for panel verification - アプリ読み込みフローチE��ト！Eead-only�E�E*/
function dp_loadAppData() {
  try {
    // アプリ関数シミュレート！Ev_getLinkMaps/getFieldTypes呼出、GSS読取�Eみ�E�E
    var linkMaps = typeof sv_getLinkMaps === 'function' ? sv_getLinkMaps() : { assets:{}, shots:{}, tasks:{}, users:{}, members:{} };
    var fieldTypes = getFieldTypes();
    var meta = typeof _sv_getMeta_ === 'function' ? _sv_getMeta_({}) : {};
    
    // カウンチEキー抽出
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
