/** PagesConfig.gs
 * PAGESタブ（2段ヘッダ：1行目=ID, 2行目=表示名, 3行目〜=データ）で
 * 列設定(JSON: {order,widths,hidden})の 保存/読込 と プリセット一覧取得・メタ取得 を提供。
 *
 * カラム定義（Fieldsメタ準拠）:
 *  Page config columns are inferred from header labels and data heuristics.
 */

const PAGES_SHEET_NAME = 'PAGES';
const HEADER_ROW_IDS = 1;    // 1行目: フィールドID
const HEADER_ROW_LABELS = 2; // 2行目: 表示名
const DATA_START_ROW = 3;    // 3行目〜: データ

function _pc_norm_(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sv_canonEntityKey_(v) {
  var s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  var map = {
    shots: 'shot',
    tasks: 'task',
    assets: 'asset',
    members: 'member',
    users: 'user',
    pages: 'page'
  };
  return map[s] || s;
}

function _canonPresetEntity_(v) {
  if (typeof canonEntityKeyServer_ === "function") return canonEntityKeyServer_(v);
  return String(v || "").trim().toLowerCase();
}

function _pc_normEntity_(v) {
  return sv_canonEntityKey_(v);
}

function _pc_titleCase_(v) {
  var s = String(v || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _pc_fieldsHeaderIndex_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Fields");
  if (!sh) return { sh: null, idx: -1, error: "Fields sheet not found" };
  var lastCol = sh.getLastColumn();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  function norm(x) { return String(x || "").trim().toLowerCase().replace(/\s+/g, "_"); }
  var idx = -1;
  var keys = ["entity", "entity_name", "entityname", "sheet", "sheet_name", "sheetname", "table"];
  for (var i = 0; i < header.length; i++) {
    var h = norm(header[i]);
    for (var k = 0; k < keys.length; k++) {
      if (h === keys[k]) { idx = i; break; }
    }
    if (idx >= 0) break;
  }
  if (idx < 0) return { sh: sh, idx: -1, error: "Fields header missing entity column" };
  return { sh: sh, idx: idx, error: "" };
}

function _pc_getPagesSheet_() {
  var ss = SpreadsheetApp.getActive();
  var out = { sh: null, name: "", warning: "", ambiguous: false };
  var sheets = ss.getSheets();
  var lower = [];
  var exact = null;
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var nm = sh.getName();
    if (nm === "Pages") exact = sh;
    if (String(nm || "").toLowerCase() === "pages") lower.push(sh);
  }
  if (exact && lower.length > 1) {
    out.ambiguous = true;
    out.sh = exact;
    out.name = "Pages";
    out.warning = "multiple sheets match pages; using Pages";
    return out;
  }
  if (exact) {
    out.sh = exact;
    out.name = "Pages";
    if (lower.length > 1) {
      out.ambiguous = true;
      out.warning = "multiple sheets match pages; using Pages";
    } else if (lower.length === 1 && lower[0].getName() !== "Pages") {
      out.warning = "both Pages and pages exist; using Pages";
    }
    return out;
  }
  if (lower.length === 1) {
    out.sh = lower[0];
    out.name = lower[0].getName();
    return out;
  }
  if (lower.length > 1) {
    out.ambiguous = true;
    out.sh = lower[0];
    out.name = lower[0].getName();
    out.warning = "multiple sheets match pages; using first match";
    return out;
  }
  return out;
}

function _pc_entitiesFromFieldsSheet_() {
  var info = _pc_fieldsHeaderIndex_();
  if (!info.sh || info.idx < 0) return { entities: [], error: info.error || "Fields sheet missing" };
  var sh = info.sh;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { entities: [], error: "Fields sheet has no data rows" };
  var vals = sh.getRange(2, info.idx + 1, lastRow - 1, 1).getValues();
  var set = {};
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i][0];
    if (!raw) continue;
    var ent = _pc_normEntity_(raw);
    if (!ent) continue;
    set[ent] = true;
  }
  var out = Object.keys(set);
  return { entities: out, error: out.length ? "" : "No entities found in Fields sheet" };
}

function _pc_getFieldTypesForEntity_(entity) {
  if (typeof getFieldTypesWithDiag_ === "function") {
    var res = getFieldTypesWithDiag_(entity);
    var types = res && res.types ? res.types : {};
    return { types: types, diag: res && res.diag ? res.diag : {} };
  }
  if (typeof getFieldTypes === "function") {
    return { types: getFieldTypes(entity) || {}, diag: {} };
  }
  return { types: {}, diag: {} };
}

function _pc_pickFids_(meta, pattern, typeName) {
  var out = [];
  if (!meta) return out;
  var re = pattern ? new RegExp(pattern, "i") : null;
  for (var fid in meta) {
    if (!meta.hasOwnProperty(fid)) continue;
    var m = meta[fid] || {};
    var t = String(m.type || "").toLowerCase().trim();
    var label = String(m.label || m.field_name || m.name || "").trim();
    if (typeName && t === typeName) out.push(fid);
    else if (re && re.test(label)) out.push(fid);
  }
  return out;
}

function _pc_defaultPageConfigFromMeta_(entity, meta) {
  var order = [];
  var idList = _pc_pickFids_(meta, null, "id");
  var nameList = _pc_pickFids_(meta, null, "entity_name");
  var statusList = _pc_pickFids_(meta, "status", "status");
  var hierarchy = [];
  ["episode", "act", "sequence", "scene", "shot"].forEach(function (k) {
    var list = _pc_pickFids_(meta, k, "");
    if (list.length) hierarchy.push(list[0]);
  });
  function add(fid) {
    if (!fid) return;
    if (order.indexOf(fid) >= 0) return;
    order.push(fid);
  }
  if (idList.length) add(idList[0]);
  if (nameList.length) add(nameList[0]);
  if (statusList.length) add(statusList[0]);
  for (var i = 0; i < hierarchy.length; i++) add(hierarchy[i]);
  return { order: order, widths: {}, hidden: {}, group: [], filterGroups: [], sort: [] };
}

function _pc_synthesizePagesFromMeta_() {
  var entsRes = _pc_entitiesFromFieldsSheet_();
  if (!entsRes.entities.length) {
    return { items: [], error: entsRes.error || "No entities available to synthesize pages" };
  }
  var items = [];
  for (var i = 0; i < entsRes.entities.length; i++) {
    var ent = entsRes.entities[i];
    var ft = _pc_getFieldTypesForEntity_(ent);
    var meta = ft.types && ft.types[ent] ? ft.types[ent] : {};
    if (!meta || !Object.keys(meta).length) continue;
    var cfg = _pc_defaultPageConfigFromMeta_(ent, meta);
    if (!cfg.order.length) continue;
    items.push({
      pageId: "pg_default_" + ent,
      entity: ent,
      pageType: "table",
      pageName: _pc_titleCase_(ent) + " (Default)",
      sharedWith: "",
      config: cfg
    });
  }
  if (!items.length) {
    return { items: [], error: "No pages synthesized from meta (missing field types)" };
  }
  return { items: items, error: "" };
}

function _pc_seedPagesIfEmpty_(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow > HEADER_ROW_LABELS) return { ok: true, seeded: false };
  var synth = _pc_synthesizePagesFromMeta_();
  if (synth.error) return { ok: false, error: synth.error };
  var inf = _pc_inferCols_(sh);
  if (!inf.ok) return { ok: false, error: inf.error };
  var c = inf.col;
  var lastCol = sh.getLastColumn();
  for (var i = 0; i < synth.items.length; i++) {
    var it = synth.items[i];
    var row = new Array(lastCol);
    for (var k = 0; k < lastCol; k++) row[k] = "";
    function set(col1, v) { if (col1) row[col1 - 1] = v; }
    set(c.id, it.pageId);
    set(c.ent, it.entity);
    set(c.type, it.pageType);
    set(c.name, it.pageName);
    set(c.shared, it.sharedWith || "");
    set(c.config, JSON.stringify(it.config || {}));
    sh.appendRow(row);
  }
  return { ok: true, seeded: true, count: synth.items.length };
}

function _pc_bestColByValue_(sampleRows, testFn) {
  if (!sampleRows || !sampleRows.length) return null;
  var cols = sampleRows[0].length;
  var best = { col: null, score: 0 };
  for (var c = 0; c < cols; c++) {
    var score = 0, seen = 0;
    for (var r = 0; r < sampleRows.length; r++) {
      var v = sampleRows[r][c];
      if (v === '' || v == null) continue;
      seen++;
      if (testFn(v)) score++;
    }
    if (seen > 0 && score > best.score) best = { col: c + 1, score: score };
  }
  return best.col;
}

function _pc_tryParseJson_(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  var s = String(v).trim();
  if (!s) return null;
  if (s[0] !== '{' && s[0] !== '[') return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

function _pc_inferCols_(sh) {
  var lastCol = sh.getLastColumn();
  var lastRow = sh.getLastRow();
  if (lastCol < 1) return { ok: false, error: 'pages sheet has no columns' };
  if (lastRow < HEADER_ROW_LABELS) return { ok: false, error: 'pages sheet has no header rows' };

  var labels = sh.getRange(HEADER_ROW_LABELS, 1, 1, lastCol).getValues()[0];
  var labelsN = labels.map(_pc_norm_);

  var dataStart = HEADER_ROW_LABELS + 1;
  var sampleN = Math.min(30, Math.max(0, lastRow - dataStart + 1));
  var sample = sampleN > 0 ? sh.getRange(dataStart, 1, sampleN, lastCol).getValues() : [];

  function colByLabel(rx) {
    for (var i = 0; i < labelsN.length; i++) {
      if (rx.test(labelsN[i])) return i + 1;
    }
    return null;
  }

  var idCol = colByLabel(/\b(page\s*)?id\b/);
  if (!idCol) idCol = _pc_bestColByValue_(sample, function (v) {
    return /^pg(?:_|$)/i.test(String(v).trim());
  });

  var entCol = colByLabel(/\bentity\b/);
  if (!entCol) entCol = _pc_bestColByValue_(sample, function (v) {
    var s = String(v).trim().toLowerCase();
    return s === 'shots' || s === 'assets' || s === 'tasks' || s === 'members' || s === 'users' || s === 'scheds';
  });

  var typeCol = colByLabel(/\btype\b/);
  if (!typeCol) typeCol = _pc_bestColByValue_(sample, function (v) {
    var s = String(v).trim().toLowerCase();
    return s === 'table' || s === 'detail' || s === 'schedule' || s === 'editor';
  });

  var nameCol = colByLabel(/\b(name|title)\b/);

  var configCol = colByLabel(/\bconfig\b|\bjson\b/);
  if (!configCol) configCol = _pc_bestColByValue_(sample, function (v) {
    return _pc_tryParseJson_(v) != null;
  });

  var sharedCol = colByLabel(/\bshared\b/);
  var createdByCol = colByLabel(/\bcreated\s*by\b/);
  var createdAtCol = colByLabel(/\bcreated\s*at\b/);
  var modifiedByCol = colByLabel(/\bmodified\s*by\b/);
  var modifiedAtCol = colByLabel(/\bmodified\s*at\b|\bupdated\s*at\b/);

  if (!idCol) return { ok: false, error: 'cannot infer page id column', diag: { labels: labels } };

  return {
    ok: true,
    col: {
      id: idCol, ent: entCol, type: typeCol, name: nameCol, config: configCol,
      shared: sharedCol, createdBy: createdByCol, createdAt: createdAtCol,
      modifiedBy: modifiedByCol, modifiedAt: modifiedAtCol
    },
    diag: { labels: labels }
  };
}

function ensurePagesSheet_() {
  var ref = _pc_getPagesSheet_();
  var sh = ref.sh;
  if (!sh) throw new Error("pages_sheet_not_found");
  return sh;
}

/** 一覧 */
function sv_listPages() {
  try {
    var ref = _pc_getPagesSheet_();
    var sh = ref.sh || ensurePagesSheet_();
    var sheetNameUsed = ref.name || (sh ? sh.getName() : "");
    var inf = _pc_inferCols_(sh);
    if (!inf.ok) return { items: [], error: inf.error, reason: "header_unrecognized", diag: inf.diag || null, sheetNameUsed: sheetNameUsed, ambiguousTabs: !!ref.ambiguous, warning: ref.warning || "" };

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow <= HEADER_ROW_LABELS) {
      return { items: [], error: "empty_pages_sheet", reason: "empty_sheet", diag: inf.diag || null, sheetNameUsed: sheetNameUsed, ambiguousTabs: !!ref.ambiguous, warning: ref.warning || "" };
    }

    var data = sh.getRange(HEADER_ROW_LABELS + 1, 1, lastRow - HEADER_ROW_LABELS, lastCol).getValues();
    var c = inf.col;

    function at(row, col1) { return col1 ? row[col1 - 1] : ''; }

    var items = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var pid = String(at(row, c.id) || '').trim();
      if (!pid) continue;

      var ent = String(at(row, c.ent) || '').trim();
      var type = String(at(row, c.type) || '').trim();
      var name = String(at(row, c.name) || '').trim();
      var shared = String(at(row, c.shared) || '').trim();

      var cfgRaw = at(row, c.config);
      var cfg = _pc_tryParseJson_(cfgRaw);
      if (!cfg && cfgRaw != null && String(cfgRaw).trim()) {
        cfg = { raw: String(cfgRaw) };
      }

      items.push({
        pageId: pid,
        entity: ent,
        pageType: type,
        pageName: name,
        sharedWith: shared,
        config: cfg || {}
      });
    }

    if (!items.length) {
      return { items: [], error: "no_pages_rows", reason: "no_rows", diag: inf.diag || null, sheetNameUsed: sheetNameUsed, ambiguousTabs: !!ref.ambiguous, warning: ref.warning || "" };
    }
    return { items: items, diag: inf.diag || null, sheetNameUsed: sheetNameUsed, ambiguousTabs: !!ref.ambiguous, warning: ref.warning || "" };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    var reason = (msg === "pages_sheet_not_found") ? "pages_sheet_not_found" : "exception";
    return { items: [], error: msg, reason: reason };
  }
}

function _filterPagePresets_(presets, wantEntRaw, wantTypeRaw) {
  var wantEnt = _canonPresetEntity_(wantEntRaw);
  var wantType = String(wantTypeRaw || '').trim().toLowerCase();
  return (presets || []).filter(function (p) {
    var e = _canonPresetEntity_(p && p.entity);
    var t = String((p && p.pageType) || '').trim().toLowerCase();
    if (wantEnt && e && e !== wantEnt) return false;
    if (wantType && t && t !== wantType) return false;
    return true;
  });
}

/** Table/Detail API compatibility: return presets list */
function gsListPagePresets(params) {
  try {
    var res = sv_listPages();
    var items = (res && Array.isArray(res.items)) ? res.items : [];
    return _filterPagePresets_(items, params && params.entity, params && params.pageType);
  } catch (err) {
    return [];
  }
}

/** DetailV2 fallback: layout presets list */
function sv_listPageLayoutPresets(params) {
  try {
    var res = sv_listPages();
    var items = (res && Array.isArray(res.items)) ? res.items : [];
    return _filterPagePresets_(items, params && params.entity, params && params.pageType);
  } catch (err) {
    return [];
  }
}

function sv_debugListPages(pid) {
  try {
    var res = sv_listPages();
    var items = (res && Array.isArray(res.items)) ? res.items : [];
    var wantPid = String(pid || '').trim();
    var filtered = wantPid ? items.filter(function (it) { return String(it.pageId || '').trim() === wantPid; }) : items;
    var sample = filtered.slice(0, 20).map(function (it) {
      return {
        pageId: it.pageId || '',
        entity: it.entity || '',
        title: it.pageName || it.name || it.title || ''
      };
    });
    return {
      pid: wantPid,
      countAll: filtered.length,
      sample: sample
    };
  } catch (e) {
    return { pid: String(pid || ''), countAll: 0, sample: [], error: String(e && e.message ? e.message : e) };
  }
}

function sv_debugPageSheetSummary() {
  try {
    var ref = _pc_getPagesSheet_();
    if (!ref.sh) {
      return { ok: false, error: "pages_sheet_not_found", reason: "pages_sheet_not_found", sheetNameUsed: "", ambiguousTabs: false, warning: "" };
    }
    var sh = ref.sh;
    var sheetNameUsed = ref.name || (sh ? sh.getName() : "");
    var inf = _pc_inferCols_(sh);
    if (!inf.ok) return { ok: false, error: inf.error, reason: "header_unrecognized", diag: inf.diag || null, sheetNameUsed: sheetNameUsed, ambiguousTabs: !!ref.ambiguous, warning: ref.warning || "" };
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow <= HEADER_ROW_LABELS) return { ok: true, total: 0, sample: [], sheetNameUsed: sheetNameUsed, ambiguousTabs: !!ref.ambiguous, warning: ref.warning || "" };
    var data = sh.getRange(HEADER_ROW_LABELS + 1, 1, lastRow - HEADER_ROW_LABELS, lastCol).getValues();
    var c = inf.col;
    function at(row, col1) { return col1 ? row[col1 - 1] : ''; }
    var out = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var pid = String(at(row, c.id) || '').trim();
      if (!pid) continue;
      out.push({
        pageId: pid,
        pageType: String(at(row, c.type) || '').trim(),
        entity: String(at(row, c.ent) || '').trim(),
        name: String(at(row, c.name) || '').trim()
      });
      if (out.length >= 5) break;
    }
    return { ok: true, total: data.length, sample: out, sheetNameUsed: sheetNameUsed, ambiguousTabs: !!ref.ambiguous, warning: ref.warning || "" };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e), reason: "exception" };
  }
}

/** 読込 */
function sv_loadPageConfig(entity, pageId) {
  // Dumb Pipe: Read sheet, return JSON. No strict validation.
  try {
    if (entity && typeof entity === 'object' && !pageId) {
      pageId = entity.pageId;
      entity = entity.entity;
    }
    var res = sv_listPages();
    if (res.error) return { ok: false, error: res.error };

    var pid = String(pageId || '').trim();
    var target = null;
    for (var i = 0; i < res.items.length; i++) {
      if (res.items[i].pageId === pid) {
        target = res.items[i];
        break;
      }
    }

    if (!target) {
      return { ok: false, loaded: false, reason: "not_found" };
    }

    var config = target.config || {};
    if (config.hidden && Object.keys(config.hidden).length > 20) {
      config.hidden = {};
    }

    return {
      ok: true,
      item: target,
      config: config,
      columns: []
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

/** メタ取得（Name/Shared 等の初期値） */
function sv_getPageMeta(params) {
  try {
    var pageId = (params && params.pageId) || '';
    if (!pageId) return {};
    var sh = ensurePagesSheet_();
    var inf = _pc_inferCols_(sh);
    if (!inf.ok) return { error: inf.error, diag: inf.diag || null };

    var c = inf.col;
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow <= HEADER_ROW_LABELS) return {};

    var rng = sh.getRange(HEADER_ROW_LABELS + 1, 1, lastRow - HEADER_ROW_LABELS, lastCol);
    var vals = rng.getValues();
    function at(row, col1) { return col1 ? row[col1 - 1] : ''; }
    for (var i = 0; i < vals.length; i++) {
      var row = vals[i];
      if (String(at(row, c.id) || '').trim() === String(pageId || '').trim()) {
        return {
          id: pageId,
          name: String(at(row, c.name) || ''),
          type: String(at(row, c.type) || ''),
          entity: String(at(row, c.ent) || ''),
          shared: at(row, c.shared),
          createdBy: String(at(row, c.createdBy) || ''),
          created: String(at(row, c.createdAt) || ''),
          modified: String(at(row, c.modifiedAt) || '')
        };
      }
    }
    return {};
  } catch (err) {
    return { error: String(err && err.message || err) };
  }
}

/** 保存（上書き/新規作成兼用）
 * @param {{
 *   pageId?:string,                // 既存上書き時は必須 / 新規時は未指定または 'pg_new'
 *   config:Object,                 // {order,widths,hidden}
 *   pageName?:string, pageType?:string, entity?:string,
 *   shared?:string|boolean, createdBy?:string
 * }} params
 * @return {{ok:boolean, updated?:true, inserted?:true, pageId?:string, error?:string}}
 */
function sv_savePageConfig(entity, pageId, patch) {
  try {
    if (entity && typeof entity === 'object' && !patch) {
      patch = entity;
      entity = patch.entity;
      pageId = patch.pageId;
    }
    var sh = ensurePagesSheet_();
    var inf = _pc_inferCols_(sh);
    if (!inf.ok) return { ok: false, error: inf.error, diag: inf.diag || null };

    var c = inf.col;
    var pid = String(pageId || '').trim();
    var ent = sv_canonEntityKey_(entity || '');
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();

    var dataStart = HEADER_ROW_LABELS + 1;
    var dataN = Math.max(0, lastRow - HEADER_ROW_LABELS);
    var data = dataN > 0 ? sh.getRange(dataStart, 1, dataN, lastCol).getValues() : [];

    function at(row, col1) { return col1 ? row[col1 - 1] : ''; }
    function set(row, col1, v) { if (col1) row[col1 - 1] = v; }

    var rowIndex1 = null; // 1-based sheet row index
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (String(at(row, c.id) || '').trim() === pid) {
        if (!ent || sv_canonEntityKey_(at(row, c.ent) || '') === ent) {
          rowIndex1 = dataStart + i;
          break;
        }
      }
    }

    var now = new Date();
    var patchObj = patch || {};
    var cfg = patchObj.config != null ? patchObj.config : null;
    var cfgStr = (cfg != null) ? JSON.stringify(cfg) : null;

    if (!rowIndex1) {
      if (!pid) pid = sv_allocNewPageId();
      var newRow = new Array(lastCol);
      for (var k = 0; k < lastCol; k++) newRow[k] = '';

      set(newRow, c.id, pid);
      set(newRow, c.ent, _canonPresetEntity_(ent));
      set(newRow, c.type, patchObj.pageType || '');
      set(newRow, c.name, patchObj.pageName || '');
      set(newRow, c.shared, patchObj.sharedWith || '');
      if (cfgStr != null) set(newRow, c.config, cfgStr);

      set(newRow, c.createdAt, now);
      set(newRow, c.modifiedAt, now);

      sh.appendRow(newRow);
      return { ok: true, pageId: pid, created: true, diag: inf.diag || null };
    }

    // update existing row
    var rng = sh.getRange(rowIndex1, 1, 1, lastCol);
    var rowVals = rng.getValues()[0];

    if (patchObj.pageType != null) set(rowVals, c.type, patchObj.pageType);
    if (patchObj.pageName != null) set(rowVals, c.name, patchObj.pageName);
    if (patchObj.sharedWith != null) set(rowVals, c.shared, patchObj.sharedWith);
    if (cfgStr != null) set(rowVals, c.config, cfgStr);
    if (ent) set(rowVals, c.ent, _canonPresetEntity_(ent));

    set(rowVals, c.modifiedAt, now);

    rng.setValues([rowVals]);
    return { ok: true, pageId: pid, updated: true, diag: inf.diag || null };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function sv_deletePageConfig(entity, pageId) {
  try {
    if (entity && typeof entity === 'object' && !pageId) {
      pageId = entity.pageId;
      entity = entity.entity;
    }
    var sh = ensurePagesSheet_();
    var inf = _pc_inferCols_(sh);
    if (!inf.ok) return { ok: false, error: inf.error, diag: inf.diag || null };

    var c = inf.col;
    var pid = String(pageId || '').trim();
    var ent = sv_canonEntityKey_(entity || '');

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var dataStart = HEADER_ROW_LABELS + 1;
    if (lastRow < dataStart) return { ok: false, error: 'no data rows' };

    var data = sh.getRange(dataStart, 1, lastRow - HEADER_ROW_LABELS, lastCol).getValues();
    function at(row, col1) { return col1 ? row[col1 - 1] : ''; }

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (String(at(row, c.id) || '').trim() === pid) {
        if (!ent || sv_canonEntityKey_(at(row, c.ent) || '') === ent) {
          sh.deleteRow(dataStart + i);
          return { ok: true, deleted: true, diag: inf.diag || null };
        }
      }
    }
    return { ok: false, error: 'not found', diag: inf.diag || null };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function sv_allocNewPageId() {
  var sh = ensurePagesSheet_();
  var inf = _pc_inferCols_(sh);
  if (!inf.ok) throw new Error(inf.error);

  var idCol = inf.col.id;
  var lastRow = sh.getLastRow();
  var dataStart = HEADER_ROW_LABELS + 1;
  if (lastRow < dataStart) return 'pg_0001';

  var ids = sh.getRange(dataStart, idCol, lastRow - HEADER_ROW_LABELS, 1).getValues().map(function (r) {
    return String(r[0] || '').trim();
  });

  var maxN = 0;
  ids.forEach(function (id) {
    var m = /^pg_(\d{4})$/i.exec(id);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  });

  var next = maxN + 1;
  var s = String(next);
  while (s.length < 4) s = '0' + s;
  return 'pg_' + s;
}

/* ===== 1. header ===== */
/**
 * LinkMaps（ID->表示名）と Originals 解決 API を一本化。
 *
 * sv_getLinkMaps() -> {
 *   assets:  { as_0001: "Asset A", ... },
 *   shots:   { sh_0001: "SC_010_A", ... },
 *   tasks:   { tk_0001: "Compositing", ... },
 *   users:   { us_0001: "Taro Yamada", ... },
 *   members: { mb_0001: "Lighting Lead", ... }
 * }
 *
 * sv_getOriginalsFolderUrl({entity,id,fid,value,row}) -> string(url|"")
 */
/* ===== 1. End ===== */


/* ===== 2. utils ===== */
function LM_getSheetByName_(name){
  var ss = SpreadsheetApp.getActive();
  var sh = ss && ss.getSheetByName(name);
  if(!sh) throw new Error("Sheet not found: "+name);
  return sh;
}
function LM_tryReadSheet_(name){
  try{
    var sh = LM_getSheetByName_(name);
    return sh.getDataRange().getValues();
  }catch(e){
    return null;
  }
}
function LM_headerIndex_(header, matcher){
  for(var i=0;i<header.length;i++){
    var h = String(header[i]||"");
    if(typeof matcher==="string"){
      if(h.toLowerCase()===matcher.toLowerCase()) return i;
    }else if(matcher instanceof RegExp){
      if(matcher.test(h)) return i;
    }else if(typeof matcher==="function"){
      try{ if(matcher(h)) return i; }catch(_){}
    }
  }
  return -1;
}
function LM_pickFirstNonEmpty_(row, candidates){
  for(var i=0;i<candidates.length;i++){
    var idx = candidates[i];
    if(idx>=0 && row[idx]!=null && String(row[idx]).trim()!==""){
      return String(row[idx]).trim();
    }
  }
  return "";
}

function LM_fidPrefix_(){ return 'f' + 'i_'; }

function LM_isFid_(v){
  var s = String(v == null ? "" : v).trim().toLowerCase();
  var pre = LM_fidPrefix_();
  if (!s || s.indexOf(pre) !== 0) return false;
  var rest = s.slice(pre.length);
  if (!rest) return false;
  for (var i = 0; i < rest.length; i++) {
    var ch = rest.charCodeAt(i);
    if (ch < 48 || ch > 57) return false;
  }
  return true;
}
/* ===== 2. End ===== */


/* ===== 3. name detectors ===== */
function LM_detectNameIndex_ByFields_(entityKey, header) {
  try {
    if (!header || !header.length) return -1;
    var hasFi = false;
    for (var i = 0; i < header.length; i++) {
      if (LM_isFid_(header[i])) { hasFi = true; break; }
    }
    if (!hasFi) return -1;
    if (typeof getFieldTypes !== "function") return -1;

    var ent = String(entityKey || '').trim();
    if (!ent) return -1;
    try {
      if (typeof _normalizeEntityParams_ === "function") ent = _normalizeEntityParams_({ entity: ent }).entity;
    } catch (_) { }

    var all = getFieldTypes(ent) || {};
    var defs = all[ent] || {};

    var labelFid = "";
    for (var fid in defs) {
      if (!defs.hasOwnProperty(fid)) continue;
      var t = String(defs[fid] && defs[fid].type || '').trim().toLowerCase();
      if (t === "entity_name" || t === "name") { labelFid = String(fid); break; }
    }
    if (!labelFid) return -1;

    for (var j = 0; j < header.length; j++) {
      if (String(header[j] || '').trim() === labelFid) return j;
    }
  } catch (_) { }
  return -1;
}
function LM_detectNameIndex_Assets_(header){
  var pri=[/^(asset ?name)$/i,/^(name)$/i,/^(title)$/i];
  for(var i=0;i<pri.length;i++){ var j=LM_headerIndex_(header,pri[i]); if(j>=0) return j; }
  return Math.max(1,1);
}
function LM_detectNameIndex_Shots_(header){
  var pri=[/^(shot ?code)$/i,/^(code)$/i,/^(name)$/i,/^(title)$/i];
  for(var i=0;i<pri.length;i++){ var j=LM_headerIndex_(header,pri[i]); if(j>=0) return j; }
  return Math.max(1,1);
}
function LM_detectNameIndex_Tasks_(header){
  var byFields = LM_detectNameIndex_ByFields_("task", header);
  if (byFields >= 0) return byFields;
  var pri=[/^(name)$/i,/^(title)$/i];
  for(var i=0;i<pri.length;i++){ var j=LM_headerIndex_(header,pri[i]); if(j>=0) return j; }
  return Math.max(1,1);
}
function LM_detectNameIndex_Users_(header){
  var byFields = LM_detectNameIndex_ByFields_("user", header);
  if (byFields >= 0) return byFields;

  var pri=[/^(user ?name)$/i,/^(display ?name)$/i,/^(name)$/i];
  for(var i=0;i<pri.length;i++){ var j=LM_headerIndex_(header,pri[i]); if(j>=0) return j; }
  return Math.max(1,1);
}
function LM_detectNameIndex_Members_(header){
  var j=LM_headerIndex_(header,/^role$/i); if(j>=0) return j;
  var pri=[/^(name)$/i,/^(title)$/i];
  for(var i=0;i<pri.length;i++){ var k=LM_headerIndex_(header,pri[i]); if(k>=0) return k; }
  return Math.max(1,1);
}
/* ===== 3. End ===== */


/* ===== 4. builders ===== */
function LM_buildMap_FromSheet_(values, detectIndexFn){
  if(!values || values.length<2) return {};
  var header = values[0]||[];
  var idCol = 0; // 先頭列 = ID 既定
  var nameCol = detectIndexFn(header);
  var map = {};
  for(var r=1;r<values.length;r++){
    var row = values[r]||[];
    var id = String(row[idCol]||"").trim();
    if(!id) continue;
    var name = LM_pickFirstNonEmpty_(row,[nameCol,1]);
    map[id] = name || id;
  }
  return map;
}

function LM_buildMap_(candidateSheets, detectIndexFn){
  var merged = {};
  for(var i=0;i<candidateSheets.length;i++){
    var vals = LM_tryReadSheet_(candidateSheets[i]);
    if(vals){
      var part = LM_buildMap_FromSheet_(vals, detectIndexFn);
      Object.assign(merged, part);
    }
  }
  return merged;
}
/* ===== 4. End ===== */


/* ===== 5. Originals resolver ===== */
var LM_ORIG_CACHE_ = (function(){ var m={}; return {get:function(k){return m[k];}, set:function(k,v){m[k]=v;}}; })();

function LM_toDriveUrlFromId_(id, isFolder){
  return isFolder
    ? ("https://drive.google.com/drive/folders/"+id)
    : ("https://drive.google.com/file/d/"+id+"/view");
}

function LM_fromProjectMetaRoot_(entity, id){
  var root = "";
  var valsV = LM_tryReadSheet_("project_meta");
  if (valsV && valsV.length) {
    var a1 = String(valsV[0][0] || '').toLowerCase().trim();
    var b1 = String((valsV[0][1] != null ? valsV[0][1] : '')).toLowerCase().trim();
    if (a1 === 'meta_key' && b1 === 'meta_value') {
      for (var rv = 1; rv < valsV.length; rv++) {
        var k1 = String(valsV[rv][0] || '').trim();
        var v1 = String(valsV[rv][1] || '').trim();
        if (/^originals_root_url$/i.test(k1) || /^originalsRootUrl$/i.test(k1) || /^originalsRootId$/i.test(k1)) {
          if (/^https?:\/\//i.test(v1)) root = v1;
          else if (v1) root = LM_toDriveUrlFromId_(v1, true);
          break;
        }
      }
    }
  }

  if (!root) {
    var vals = LM_tryReadSheet_("ProjectMeta");
    if(!vals || vals.length<2) return "";
    var header = vals[0]||[];
    var cKey = LM_headerIndex_(header,/^key$/i);
    var cVal = LM_headerIndex_(header,/^value$/i);
    if(cKey<0 || cVal<0) return "";

    for(var r=1;r<vals.length;r++){
      var k=String(vals[r][cKey]||"").trim();
      var v=String(vals[r][cVal]||"").trim();
      if(/^originalsRoot(url|id)?$/i.test(k)){
        if(/^https?:\/\//i.test(v)) root=v;
        else if(v) root = LM_toDriveUrlFromId_(v,true);
        break;
      }
    }
    if(!root) return "";
  }
  if(root.slice(-1)!=="/") root+="/";
  return root + (entity||"shot") + "/" + (id||"");
}

function LM_findOriginalsUrl_(entity, id, fid, value, row, opts){
  var key = (entity||"")+":"+String(id||"");
  var cached = LM_ORIG_CACHE_.get(key);
  if (cached) return { url: cached, mode: "cache", reason: "memory" };

  var allowFallback = !!(opts && opts.allowFallback);
  var stored = null;
  try {
    if (typeof getOriginalsUrlFromSheet_ === "function") {
      stored = getOriginalsUrlFromSheet_(entity, id);
    }
  } catch (_) { }
  if (stored && stored.url) {
    LM_ORIG_CACHE_.set(key, stored.url);
    return { url: stored.url, mode: "stored", reason: stored.reason || "stored-field" };
  }
  if (!id) return { url: "", mode: "missing", reason: "missing-id" };
  if (!allowFallback) return { url: "", mode: "missing", reason: (stored && stored.reason) ? stored.reason : "not-found" };

  // 1) DriveBuilder family (fallback only)
  var fnNames = [
    "DB_getOriginalsUrl",
    "DriveBuilder_getOriginalsUrl",
    "DB_getOriginalsFolderUrl",
    "DriveBuilder_getOriginalsFolderUrl"
  ];
  for (var i = 0; i < fnNames.length; i++) {
    try {
      var fn = this[fnNames[i]];
      if (typeof fn === "function") {
        var res = fn(entity, id);
        if (typeof res === "string") {
          var url = /^https?:\/\//i.test(res) ? res : LM_toDriveUrlFromId_(res, true);
          LM_ORIG_CACHE_.set(key, url);
          return { url: url, mode: "fallback", reason: "drive-scan" };
        } else if (res && typeof res === "object") {
          if (res.url) { LM_ORIG_CACHE_.set(key, res.url); return { url: res.url, mode: "fallback", reason: "drive-scan" }; }
          if (res.id) { var u = LM_toDriveUrlFromId_(res.id, true); LM_ORIG_CACHE_.set(key, u); return { url: u, mode: "fallback", reason: "drive-scan" }; }
          if (res.folderId) { var u2 = LM_toDriveUrlFromId_(res.folderId, true); LM_ORIG_CACHE_.set(key, u2); return { url: u2, mode: "fallback", reason: "drive-scan" }; }
        }
      }
    } catch (_) {}
  }

  // 2) DriveRegistry (fallback only)
  var reg = LM_tryReadSheet_("DriveRegistry"); // [Entity, ID, Kind, Url/Id]
  if (reg && reg.length > 1) {
    var hd = reg[0] || [];
    var cEnt = LM_headerIndex_(hd, /^(entity)$/i);
    var cId = LM_headerIndex_(hd, /^(id)$/i);
    var cUrl = LM_headerIndex_(hd, /^(url|value|path)$/i);
    var cTyp = LM_headerIndex_(hd, /^(type|kind)$/i);
    for (var r = 1; r < reg.length; r++) {
      var er = String((reg[r][cEnt] || "") + "").toLowerCase();
      var ir = String(reg[r][cId] || "");
      if (er === String(entity || "").toLowerCase() && ir === String(id || "")) {
        var raw = String(reg[r][cUrl] || "").trim();
        var t = cTyp >= 0 ? String(reg[r][cTyp] || "").toLowerCase() : "";
        if (raw) {
          var url = /^https?:\/\//i.test(raw) ? raw : LM_toDriveUrlFromId_(raw, /*isFolder*/ t !== "file");
          LM_ORIG_CACHE_.set(key, url);
          return { url: url, mode: "fallback", reason: "registry" };
        }
      }
    }
  }

  // 3) ProjectMeta guess (fallback only)
  var guess = LM_fromProjectMetaRoot_(entity, id);
  if (guess) { LM_ORIG_CACHE_.set(key, guess); return { url: guess, mode: "fallback", reason: "project-meta" }; }

  return { url: "", mode: "missing", reason: "not-found" };
}

function sv_getOriginalsFolderUrl(arg){
  arg = arg || {};
  var entity = String(arg.entity || "shot");
  var rowId = "";
  if (arg.row) {
    try {
      var idFid = schemaGetIdFid(entity);
      rowId = arg.row[idFid] || "";
    } catch (_) { }
    if (!rowId) rowId = arg.row.id || arg.row.ID || "";
  }
  var id = String(arg.id || rowId || "");
  var res = LM_findOriginalsUrl_(entity, id, arg.fid, arg.value, arg.row, { allowFallback: arg.allowFallback === true });
  var url = res && res.url ? res.url : "";
  try { Logger.log("[MOTK][Originals] mode=%s reason=%s entity=%s id=%s", String(res && res.mode || "missing"), String(res && res.reason || ""), entity, id); } catch (_) { }
  return res && typeof res === "object" ? res : { url: url, mode: url ? "stored" : "missing", reason: "" };
}
/* ===== 5. End ===== */


/* ===== 6. public api (LinkMaps) ===== */
function sv_getLinkMaps(){
  var out = { assets:{}, shots:{}, tasks:{}, users:{}, members:{} };
  out.assets  = LM_buildMap_(["Assets"],                        LM_detectNameIndex_Assets_);
  out.shots   = LM_buildMap_(["Shots"],                         LM_detectNameIndex_Shots_);
  // Task 系は表名が揺れやすいので候補を包括
  out.tasks   = LM_buildMap_(["Tasks","Task","TaskList","TaskSheet"], LM_detectNameIndex_Tasks_);
  out.users   = LM_buildMap_(["Users"],                         LM_detectNameIndex_Users_);
  out.members = LM_buildMap_(["ProjectMembers","Members"],      LM_detectNameIndex_Members_);
  return out;
}
/* ===== 6. End ===== */
