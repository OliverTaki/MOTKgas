var __VIEW_CTX = { scriptUrl: '', page: '', entity: '', id: '', dataJson: '[]' };

function include(filename) {
  var t = HtmlService.createTemplateFromFile(filename);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];
  return t.evaluate().getContent();
}

var PAGE_TEMPLATE_MAP = {
  '': '3CL_Shell',
  'shots': '3CL_Shell',
  'assets': '3CL_Shell',
  'tasks': '3CL_Shell',
  'members': '3CL_Shell',
  'projectmembers': '3CL_Shell',
  'users': '3CL_Shell',
  'dashboard': '3CL_Shell',
  'schedule': '3CL_Scheduler',
  'settings': '3CL_Settings',
  'index': '3CL_Shell',
  'table': '3CL_Shell',
  'viewer': '3CL_Shell',
  'debugpanel': '1SA_DebugPanel',
  'debugpanelpage': '1SA_DebugPanel',
  'debug': '1SA_DebugPanel'
};

function _resolveTemplateName_(page, entity, id) {
  var p = String(page || '').toLowerCase();
  if (p === 'debugpanel' || p === 'debugpanelpage' || p === 'debug') {
    return '1SA_DebugPanel';
  }
  if (/^detail[a-z0-9_-]*/.test(p)) {
    return '3CL_Detail';
  }
  if (PAGE_TEMPLATE_MAP.hasOwnProperty(p)) {
    return PAGE_TEMPLATE_MAP[p];
  }
  return '3CL_Shell';
}

function _normalizePageAndEntity_(page, entity) {
  var pageRaw = String(page || '').trim().toLowerCase();
  var entRaw = String(entity || '').trim().toLowerCase();

  function normEntity(x) {
    if (x === 'assets' || x === 'asset') return 'asset';
    if (x === 'tasks' || x === 'task') return 'task';
    if (x === 'users' || x === 'user') return 'user';
    if (x === 'members' || x === 'member' || x === 'projectmembers' || x === 'projectmember') return 'member';
    if (x === 'shots' || x === 'shot' || x === 'table' || x === 'index' || x === '') return 'shot';
    return entRaw || 'shot';
  }

  if (pageRaw === 'debugpanel' || pageRaw === 'debug' || pageRaw === 'debugpanelpage') {
    return { page: 'DebugPanelPage', entity: entRaw || 'shot' };
  }
  if (/^detail[a-z0-9_-]*$/.test(pageRaw)) {
    return { page: page || 'DetailShot', entity: entRaw || 'shot' };
  }
  if (pageRaw === 'assets') return { page: 'Assets', entity: entRaw || 'asset' };
  if (pageRaw === 'shots') return { page: 'Shots', entity: entRaw || 'shot' };
  if (pageRaw === 'tasks') return { page: 'Tasks', entity: entRaw || 'task' };
  if (pageRaw === 'users') return { page: 'Users', entity: entRaw || 'user' };
  if (pageRaw === 'members' || pageRaw === 'projectmembers') {
    return { page: 'Members', entity: entRaw || 'member' };
  }
  if (pageRaw === 'schedule') {
    return { page: 'Schedule', entity: normEntity(entRaw || 'shot') };
  }
  if (pageRaw === 'table') {
    var entKey = normEntity(entRaw || 'shot');
    return { page: 'Table', entity: entKey };
  }
  if (pageRaw === '' || pageRaw === 'index' || pageRaw === 'list' || pageRaw === 'viewer') {
    return { page: 'Shots', entity: normEntity(entRaw || 'shot') };
  }
  return { page: page || 'Shots', entity: normEntity(entRaw) };
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || '').toLowerCase();

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

  if (action === 'app-bundle') {
    var js = [
      '',
      'var MOTK_BUNDLE_LOADED = true;',
      ''
    ].join('\n');
    return ContentService
      .createTextOutput(js)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

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

  var rawPage = params.page || params.p || '';
  var rawEntity = params.entity || params.e || '';

  if (!rawPage && !rawEntity) {
    rawPage = 'Shots';
    rawEntity = '';
  }

  var id = params.id || '';
  var normalized = _normalizePageAndEntity_(rawPage, rawEntity);
  var page = normalized.page;
  var entity = normalized.entity;
  var templateName = _resolveTemplateName_(page, entity, id);

  if (String(templateName || '').toLowerCase() === '3cl_settings') {
    try {
      if (typeof SA_settings_canAccess_ !== 'function') {
        throw new Error('Settings auth helper missing');
      }
      if (!SA_settings_canAccess_()) {
        return HtmlService.createHtmlOutput('<!DOCTYPE html><html><body><h1>Access denied</h1><p>Settings is restricted to admin/manager roles.</p></body></html>')
          .setTitle('Access denied')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
    } catch (err) {
      var msgAuth = String(err && err.message ? err.message : err);
      msgAuth = msgAuth.replace(/[<>&]/g, function (c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'; });
      return HtmlService.createHtmlOutput('<!DOCTYPE html><html><body><h1>Access error</h1><pre>' + msgAuth + '</pre></body></html>')
        .setTitle('Access error')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  var t;
  try {
    t = HtmlService.createTemplateFromFile(templateName);
  } catch (err) {
    var msg = 'Template "' + String(templateName) + '" not found.\n\n' + (err && err.stack ? String(err.stack) : String(err));
    msg = msg.replace(/[<>&]/g, function (c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'; });
    return HtmlService.createHtmlOutput('<!DOCTYPE html><html><body><h1>Template not found</h1><pre>' + msg + '</pre></body></html>')
      .setTitle('Template not found')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var viewCtx = {
    page: page,
    entity: entity,
    id: id,
    scriptUrl: ScriptApp.getService().getUrl()
  };

  t.page = viewCtx.page;
  t.entity = viewCtx.entity;
  t.id = viewCtx.id;
  t.scriptUrl = viewCtx.scriptUrl;
  t.dataJson = dataJson;
  t.viewCtx = viewCtx;

  return t.evaluate()
    .setTitle(viewCtx.page || 'MOTK')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _addTiming_(ctx, key, delta) {
  if (!ctx || !key) return;
  if (!ctx.timing) ctx.timing = {};
  var v = Number(delta) || 0;
  ctx.timing[key] = (Number(ctx.timing[key]) || 0) + v;
}

function _sanitizeCellValue_(val, tag) {
  var label = tag || "cell";
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) throw new Error("Invalid Date for " + label);
    return val;
  }
  var t = typeof val;
  if (t === "string" || t === "number" || t === "boolean") return val;
  if (Array.isArray(val)) throw new Error("Array not allowed in " + label);
  if (t === "object") throw new Error("Object not allowed in " + label);
  throw new Error("Unsupported type for " + label + ": " + t);
}

function _getActiveSpreadsheetFromCtx_(ctx) {
  if (ctx && ctx.ss) return ctx.ss;
  var t0 = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ctx) {
    ctx.ss = ss;
    ctx.openSpreadsheet_calls = (ctx.openSpreadsheet_calls || 0) + 1;
    ctx.openSpreadsheet_ms = (ctx.openSpreadsheet_ms || 0) + (Date.now() - t0);
  }
  return ss;
}

function _readFromDataHubOrSheet_(sheetName, ctx) {
  if (ctx && ctx.forceEntity === true) {
    var ssForced = _getActiveSpreadsheetFromCtx_(ctx);
    var tEntityOnly = Date.now();
    var shForced = ssForced.getSheetByName(sheetName);
    var rangeValsForced = shForced ? shForced.getDataRange().getValues() : [];
    _addTiming_(ctx, 'readEntitySheet_ms', Date.now() - tEntityOnly);
    if (!rangeValsForced || !rangeValsForced.length) return { ids: [], header: [], rows: [] };
    var idsRowF = rangeValsForced[0] || [];
    var namesRowF = rangeValsForced[1] || [];
    idsRowF = (idsRowF || []).map(function (v) { return v != null ? String(v).trim() : ""; });
    namesRowF = (namesRowF || []).map(function (v) { return v != null ? String(v).trim() : ""; });
    var rowsF = rangeValsForced.slice(2).filter(function (row) {
      return row && row.some(function (v) { return v !== '' && v != null; });
    }).map(function (r) { return r.map(function (v) { return v == null ? '' : String(v); }); });
    return { ids: idsRowF, header: namesRowF, rows: rowsF };
  }
  var tHubStart = Date.now();
  var ss = _getActiveSpreadsheetFromCtx_(ctx);
  var dh = ss.getSheetByName('DataHub');
  if (dh) {
    var vals = dh.getDataRange().getValues();
    if (vals && vals.length) {
      var header = vals[0];
      var col = header.indexOf(sheetName);
      if (col >= 0) {
        var colVals = vals.map(function (r) { return r[col]; });
        var ids = String(colVals[1] || '').split('|');
        var names = String(colVals[2] || '').split('|');
        var rows = colVals.slice(3)
          .map(function (v) { return v ? String(v).split('|') : []; })
          .filter(function (a) { return a.length && String(a[0] || '') !== ''; });
        if (rows.length > 0) {
          _addTiming_(ctx, 'readDataHub_ms', Date.now() - tHubStart);
          return { ids: ids, header: names, rows: rows };
        }
      }
    }
  }
  _addTiming_(ctx, 'readDataHub_ms', Date.now() - tHubStart);
  var tEntityStart = Date.now();
  var sh = ss.getSheetByName(sheetName);
  var rangeVals = sh ? sh.getDataRange().getValues() : [];
  _addTiming_(ctx, 'readEntitySheet_ms', Date.now() - tEntityStart);
  if (!rangeVals || !rangeVals.length) return { ids: [], header: [], rows: [] };
  var idsRow = rangeVals[0] || [];
  var namesRow = rangeVals[1] || [];
  idsRow = (idsRow || []).map(function (v) { return v != null ? String(v).trim() : ""; });
  namesRow = (namesRow || []).map(function (v) { return v != null ? String(v).trim() : ""; });
  var rows = rangeVals.slice(2).filter(function (row) {
    return row && row.some(function (v) { return v !== '' && v != null; });
  }).map(function (r) { return r.map(function (v) { return v == null ? '' : String(v); }); });
  return { ids: idsRow, header: namesRow, rows: rows };
}

function _inferTypes_(rows, ids) {
  var types = new Array(ids.length).fill('text');
  var sample = Math.min(rows.length, 200);
  for (var c = 0; c < ids.length; c++) {
    for (var r = 0; r < sample; r++) {
      var v = rows[r][c];
      if (v === '' || v == null) continue;
      if (typeof v === 'number') { types[c] = 'number'; break; }
      if (v instanceof Date) { types[c] = 'date'; break; }
      var s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) { types[c] = 'date'; break; }
      if (/^-?\d+(\.\d+)?$/.test(s)) { types[c] = 'number'; break; }
    }
  }
  return types;
}

function _coerce_(v, t) {
  if (v == null || v === '') return null;
  if (t === 'number') {
    if (typeof v === 'number') return v;
    var n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : null;
  }
  if (t === 'date') {
    if (v instanceof Date) return v;
    var d = _parseDate_(String(v)); return d || null;
  }
  return v;
}
function _serialToDate_(serial) {
  var ms = Math.round(Number(serial) * 86400000);
  return new Date(Date.UTC(1899, 11, 30) + ms);
}

function _formatDateYmd_(dateObj) {
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function _parseDate_(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (!isNaN(v.getTime())) return new Date(v.getTime());
    return null;
  }
  if (typeof v === "number" && isFinite(v)) {
    return _serialToDate_(v);
  }
  if (typeof v === "string") {
    var s = v.trim();
    if (s === "") return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      var num = Number(s);
      if (isFinite(num)) return _serialToDate_(num);
    }
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      var y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
      var hh = m[4] ? Number(m[4]) : 0;
      var mm = m[5] ? Number(m[5]) : 0;
      var ss = m[6] ? Number(m[6]) : 0;
      var dt = new Date(Date.UTC(y, mo, d, hh, mm, ss));
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  return null;
}
function _sameDay_(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function _containsAny_(raw, valOrValues) {
  var hay = String(raw == null ? '' : raw).toLowerCase();
  var arr = [];
  if (Array.isArray(valOrValues)) arr = valOrValues;
  else if (typeof valOrValues === 'string') arr = valOrValues.split(',').map(function (s) { return s.trim(); });
  else arr = [String(valOrValues || '')];
  if (!arr.length) return false;
  for (var i = 0; i < arr.length; i++) {
    var needle = String(arr[i] || '').toLowerCase();
    if (!needle) continue;
    if (hay.indexOf(needle) !== -1) return true;
  }
  return false;
}

function _testRule_(cell, f, type) {
  var op = String(f.op || '').toLowerCase();
  var raw = cell;

  if (op === 'isempty') return (raw == null || String(raw) === '');
  if (op === 'isnotempty') return !(raw == null || String(raw) === '');

  if (Array.isArray(f.values) && f.values.length) {
    if (type === 'date') {
      if (op === 'is') return f.values.some(function (v) { var t = _coerce_(v, 'date'), d = _coerce_(raw, 'date'); return t && d && _sameDay_(d, t); });
      if (op === 'isnot') return !f.values.some(function (v) { var t = _coerce_(v, 'date'), d = _coerce_(raw, 'date'); return t && d && _sameDay_(d, t); });
      return false;
    } else {
      if (op === 'contains') return _containsAny_(raw, f.values);
      if (op === 'is') return f.values.some(function (v) { return String(raw) === String(v); });
      if (op === 'isnot') return !f.values.some(function (v) { return String(raw) === String(v); });
      if (op === 'notcontains') return !_containsAny_(raw, f.values);
      return false;
    }
  }

  var val = (f.value == null) ? '' : String(f.value);

  if (type === 'date') {
    var d = _coerce_(raw, 'date');
    if (op === 'is') { var t = _coerce_(val, 'date'); if (!t || !d) return false; return _sameDay_(d, t); }
    if (op === 'isnot') { var t2 = _coerce_(val, 'date'); if (!t2 || !d) return false; return !_sameDay_(d, t2); }
    if (op === 'after') { var a = _coerce_(val, 'date'); if (!d || !a) return false; return d.getTime() > a.getTime(); }
    if (op === 'before') { var b = _coerce_(val, 'date'); if (!d || !b) return false; return d.getTime() < b.getTime(); }
    if (op === 'range') {
      var rr = String(val || '').split('..'); if (rr.length !== 2) return false;
      var da = _coerce_(rr[0], 'date'), db = _coerce_(rr[1], 'date'); if (!d || !da || !db) return false;
      var minT = Math.min(da.getTime(), db.getTime()), maxT = Math.max(db.getTime(), da.getTime());
      return d.getTime() >= minT && d.getTime() <= maxT;
    }
    return true;
  }

  var sRaw = (raw == null) ? '' : String(raw);
  if (op === 'is') return sRaw === val;
  if (op === 'isnot') return sRaw !== val;
  if (op === 'contains') return _containsAny_(sRaw, val);
  if (op === 'notcontains') return !_containsAny_(sRaw, val);
  return true;
}

function _evalGroup_(row, group, ids, colTypes) {
  var rules = Array.isArray(group.rules) ? group.rules : [];
  var mode = String(group.mode || 'all').toLowerCase();
  if (!rules.length) return true;

  if (mode === 'any') {
    for (var i = 0; i < rules.length; i++) {
      var f = rules[i]; if (!f || !f.id || !f.op) continue;
      var idx = ids.indexOf(f.id); if (idx < 0) continue;
      if (_testRule_(row[idx], f, colTypes[idx])) return true;
    }
    return false;
  } else {
    var sawValid = false;
    for (var j = 0; j < rules.length; j++) {
      var g = rules[j]; if (!g || !g.id || !g.op) continue;
      var k = ids.indexOf(g.id); if (k < 0) continue;
      sawValid = true;
      if (!_testRule_(row[k], g, colTypes[k])) return false;
    }
    if (!sawValid) return true;
    return true;
  }
}

function _normalizeEntityParams_(params, options) {
  var merged = null;
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      merged = Object.assign({}, params, options);
    } else {
      merged = params;
    }
  } else {
    merged = (options && typeof options === 'object' && !Array.isArray(options)) ? Object.assign({}, options) : {};
    if (params != null) merged.entity = params;
  }

  var cfg = merged || {};
  var entParam = (cfg.entity != null) ? cfg.entity : cfg.sheet;
  var entObj = (entParam && typeof entParam === 'object') ? entParam : null;
  var entRaw = '';
  if (entObj) {
    entRaw = entObj.entity || entObj.name || entObj.sheet || '';
  } else if (entParam != null) {
    entRaw = entParam;
  }

  function canonEntityKey(raw) {
    var key = String(raw || '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'shots' || key === 'shot') return 'shot';
    if (key === 'assets' || key === 'asset') return 'asset';
    if (key === 'tasks' || key === 'task') return 'task';
    if (key === 'users' || key === 'user') return 'user';
    if (key === 'projectmembers' || key === 'projectmember' || key === 'members' || key === 'member') return 'member';
    if (key === 'pages' || key === 'page') return 'page';
    return key;
  }

  entRaw = String(entRaw || '').trim();
  var entityKey = canonEntityKey(entRaw) || 'shot';

  var sheetNameMap = {
    shot: 'Shots',
    asset: 'Assets',
    task: 'Tasks',
    member: 'ProjectMembers',
    user: 'Users',
    page: 'Pages'
  };
  var sheetName = sheetNameMap[entityKey] || 'Shots';

  var limitFromParams = Number(cfg.limit);
  var limitFromObj = entObj && Number(entObj.perPage);
  var limit = limitFromParams || limitFromObj || 100;
  if (!limit || limit < 1) limit = 100;

  var pageFromParams = Number(cfg.page);
  var pageFromObj = entObj && Number(entObj.page);
  var page = pageFromParams || pageFromObj || 1;
  if (!page || page < 1) page = 1;

  var offset;
  if (cfg.offset != null) {
    offset = Number(cfg.offset);
  } else {
    offset = (page - 1) * limit;
  }
  if (isNaN(offset) || offset < 0) offset = 0;

  return {
    entity: entityKey,
    sheet: sheetName,
    limit: limit,
    offset: offset
  };
}

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

function _readEntitySheet_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var base = String(sheetName || '').trim();
  var lc = base.toLowerCase();
  var uc = base.toUpperCase();
  var cap = lc ? (lc.charAt(0).toUpperCase() + lc.slice(1)) : base;

  var sh = _findSheetByCandidates_([base, lc, uc, cap]);
  if (!sh) return { header: [], rows: [] };

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { header: [], rows: [] };

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var dataStartRow = 3;
  if (lastRow < dataStartRow) return { header: header, rows: [] };
  var dataRowCount = lastRow - dataStartRow + 1;
  if (dataRowCount < 1) return { header: header, rows: [] };

  var dataRange = sh.getRange(dataStartRow, 1, dataRowCount, lastCol);
  var allValues = dataRange.getValues();
  var dataRows = [];
  for (var r = 0; r < allValues.length; r++) {
    var row = allValues[r];
    var empty = true;
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== '' && row[c] !== null) { empty = false; break; }
    }
    if (!empty) dataRows.push(row);
  }
  return { header: header, rows: dataRows };
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
    return rule.values.map(function (v) { return String(v || '').trim(); }).filter(Boolean);
  }
  if (rule.value != null) {
    return String(rule.value).split('||').map(function (v) { return v.trim(); }).filter(Boolean);
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
      var lowerValues = values.map(function (v) { return v.toLowerCase(); });
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
      compiledRules.push({ idx: idx, op: op, values: values, valuesLower: lowerValues, numericValue: numericTarget, range: rangeBounds });
    }
    if (compiledRules.length) {
      compiled.push({ mode: (group.mode === 'any') ? 'any' : 'all', rules: compiledRules });
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
      return compiledRule.valuesLower && compiledRule.valuesLower.length ? compiledRule.valuesLower.some(function (v) { return lower.indexOf(v) >= 0; }) : false;
    case 'is':
      return compiledRule.valuesLower && compiledRule.valuesLower.length ? compiledRule.valuesLower.some(function (v) { return lower === v; }) : false;
    case 'isnot':
      if (!compiledRule.valuesLower || !compiledRule.valuesLower.length) return str !== '';
      return compiledRule.valuesLower.every(function (v) { return lower !== v; });
    case 'isempty': return str === '';
    case 'isnotempty': return str !== '';
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
    default: return false;
  }
}

function _filterRowsByGroups_(rows, ids, header, filterGroups, combineMode) {
  var compiled = _compileFilterGroups_(filterGroups, ids, header);
  if (!compiled.length) return rows;
  var combineAny = (combineMode === 'any');
  return rows.filter(function (row) {
    var results = compiled.map(function (group) {
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
    compiled.push({ idx: idx, dir: (spec.dir === 'desc') ? 'desc' : 'asc' });
  }
  return compiled;
}

function _compareCellsForSort_(a, b) {
  if (a === b) return 0;
  var aNum = _parseNumberOrDate_(a);
  var bNum = _parseNumberOrDate_(b);
  if (aNum != null && bNum != null && aNum !== bNum) return aNum < bNum ? -1 : 1;
  var aStr = (a == null) ? '' : String(a).toLowerCase();
  var bStr = (b == null) ? '' : String(b).toLowerCase();
  if (aStr === bStr) return 0;
  return aStr < bStr ? -1 : 1;
}

function _sortRowsBySpecs_(rows, sortList, ids, header) {
  var compiled = _compileSortSpecs_(sortList, ids, header);
  if (!compiled.length) return rows;
  var copy = rows.slice();
  copy.sort(function (a, b) {
    for (var i = 0; i < compiled.length; i++) {
      var spec = compiled[i];
      var cmp = _compareCellsForSort_(a[spec.idx], b[spec.idx]);
      if (cmp !== 0) return spec.dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
  return copy;
}

function _pruneEmptyColumns_(ids, header, rows) {
  var maxLen = Math.max(ids.length, header.length);
  var keep = [];
  outer: for (var i = 0; i < maxLen; i++) {
    var idVal = (i < ids.length && ids[i] != null) ? String(ids[i]).trim() : '';
    var headerVal = (i < header.length && header[i] != null) ? String(header[i]).trim() : '';
    if (idVal || headerVal) { keep.push(i); continue; }
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (row && row[i] != null && String(row[i]).trim() !== '') { keep.push(i); continue outer; }
    }
  }
  if (keep.length === maxLen) return { ids: ids, header: header, rows: rows };
  var trimmedIds = [];
  var trimmedHeader = [];
  for (var k = 0; k < keep.length; k++) {
    var idx = keep[k];
    trimmedIds.push(idx < ids.length ? ids[idx] : '');
    trimmedHeader.push(idx < header.length ? header[idx] : '');
  }
  var trimmedRows = rows.map(function (row) {
    var out = [];
    for (var j = 0; j < keep.length; j++) {
      var idx = keep[j];
      out.push(row && idx < row.length ? row[idx] : '');
    }
    return out;
  });
  return { ids: trimmedIds, header: trimmedHeader, rows: trimmedRows };
}

function _reindexRowsToRequested_(ids, header, rows, requested) {
  var map = {};
  for (var i = 0; i < ids.length; i++) {
    var fid = ids[i];
    if (!fid) continue;
    map[fid] = i;
  }
  var newIds = [];
  var newHeader = [];
  for (var j = 0; j < requested.length; j++) {
    var rf = requested[j];
    newIds.push(rf);
    var idx = map.hasOwnProperty(rf) ? map[rf] : -1;
    var h = (idx >= 0 && idx < header.length) ? header[idx] : rf;
    newHeader.push(h);
  }
  var newRows = rows.map(function (row) {
    var out = [];
    for (var k = 0; k < requested.length; k++) {
      var fidReq = requested[k];
      var idxReq = map.hasOwnProperty(fidReq) ? map[fidReq] : -1;
      out.push(idxReq >= 0 ? row[idxReq] : "");
    }
    return out;
  });
  return { ids: newIds, header: newHeader, rows: newRows };
}

function _listRowsPageCore_(params, ctx) {
  params = params || {};
  var t0 = Date.now();
  var conf = _normalizeEntityParams_(params);
  var sheetName = conf.sheet;
  var limit = conf.limit;
  var offset = conf.offset;

  var tReadStart = Date.now();
  var data = _readFromDataHubOrSheet_(sheetName, ctx);
  var tReadDone = Date.now();
  var ids = data.ids || [];
  var header = data.header || [];
  var rows = data.rows || [];
  var workingRows = rows.slice();

  var tFilterStart = Date.now();
  var filters = Array.isArray(params.filterGroups) ? params.filterGroups : [];
  var combineMode = (params.groupCombine === 'any') ? 'any' : 'all';
  if (filters.length) workingRows = _filterRowsByGroups_(workingRows, ids, header, filters, combineMode);
  var tFilterDone = Date.now();

  var tSortStart = Date.now();
  if (Array.isArray(params.sort) && params.sort.length) workingRows = _sortRowsBySpecs_(workingRows, params.sort, ids, header);
  var tSortDone = Date.now();

  var total = workingRows.length;
  if (typeof offset !== 'number' || offset < 0) offset = 0;
  if (typeof limit !== 'number' || limit < 1) limit = total;
  var start = Math.min(offset, total);
  var end = Math.min(start + limit, total);
  var sliced = workingRows.slice(start, end);

  var tPruneStart = Date.now();
  var trimmed = _pruneEmptyColumns_(ids, header, sliced);
  ids = trimmed.ids;
  header = trimmed.header;
  sliced = trimmed.rows;
  var tPruneDone = Date.now();

  var requestedFields = Array.isArray(params && params.requestedFields) ? params.requestedFields.map(function (f) { return String(f || "").trim(); }).filter(Boolean) : [];
  if (requestedFields.length) {
    var reindexed = _reindexRowsToRequested_(ids, header, sliced, requestedFields);
    ids = reindexed.ids;
    header = reindexed.header;
    sliced = reindexed.rows;
  }
  var result = {
    ids: ids,
    header: header,
    rows: sliced,
    total: total,
    meta: {
      total: total,
      sheet: sheetName,
      offset: offset,
      limit: limit,
      sort: params.sort || null,
      filterGroups: params.filterGroups || null,
      groupCombine: params.groupCombine || null,
      fieldIdsHash: ids.join("|")
    }
  };

  var tEnd = Date.now();
  var timing = {
    total_ms: tEnd - t0,
    data_read_ms: tReadDone - tReadStart,
    filter_ms: tFilterDone - tFilterStart,
    sort_ms: tSortDone - tSortStart,
    field_select_ms: tPruneDone - tPruneStart,
    openSpreadsheet_ms: (ctx && ctx.openSpreadsheet_ms) || 0,
    readDataHub_ms: (ctx && ctx.timing && ctx.timing.readDataHub_ms) || 0,
    readEntitySheet_ms: (ctx && ctx.timing && ctx.timing.readEntitySheet_ms) || 0,
    buildRows_ms: (tEnd - tPruneStart)
  };
  result.diag = result.diag || {};
  result.diag.timing = timing;
  return result;
}

function sv_listRowsPage(entity, options) {
  if (entity && typeof entity === "object" && !Array.isArray(entity)) {
    return _sv_listRowsPageLegacyFromPayload_(entity);
  }
  var p = _normalizeEntityParams_(entity, options);
  return _listRowsPageCore_(p);
}

function _sv_listRowsPageLegacyFromPayload_(payload, ctx) {
  payload = payload || {};
  var ent = payload.sheetName || payload.entity || payload.e || payload.entityName || "";
  var norm = _normalizeEntityParams_(ent, payload);
  var p = Object.assign({}, payload, norm);
  p.entity = norm.entity;
  p.sheet = norm.sheet;
  var ctxLocal = ctx || {};
  ctxLocal.forceEntity = true;
  var res = _listRowsPageCore_(p, ctxLocal);
  if (res && typeof res === "object") {
    res.source = "legacy";
    var modeInfo = _tablePickDataMode_(payload || {});
    var inferred = (modeInfo && modeInfo.reason) ? modeInfo.reason : "";
    if (inferred === "plain-paging") inferred = "";
    res.sourceReason = res.sourceReason || inferred || "legacy-wrapper";
    res.mode = "legacy";
    res.modeReason = res.sourceReason || res.modeReason || "legacy-wrapper";
    res.dataSourceUsed = "legacy";
    res.diag = res.diag || {};
    res.diag.mode = res.mode;
    res.diag.modeReason = res.modeReason;
    res.diag.dataSourceUsed = res.dataSourceUsed;
    res.diag.listRowsFn = "_listRowsPageCore_";
  }
  return res;
}

function sv_getFieldValuesBatch_v1(payload) {
  try {
    payload = payload || {};
    var ent = payload.entity || payload.sheetName || payload.sheet || payload.entityName || payload.e || "";
    if (!ent) return { ok: false, error: "entity required", valuesById: {} };
    var ids = Array.isArray(payload.ids) ? payload.ids.map(function (x) { return String(x || "").trim(); }).filter(Boolean) : [];
    var fieldIds = Array.isArray(payload.fieldIds) ? payload.fieldIds.map(function (x) { return String(x || "").trim(); }).filter(Boolean) : [];
    if (!ids.length || !fieldIds.length) return { ok: true, valuesById: {} };
    var conf = _normalizeEntityParams_(ent, payload);
    var sheetName = _entityToSheet_(conf.entity);
    var values = _read2D_(sheetName);
    var hdr = values[0] || [];
    var idFid = schemaGetIdFid(conf.entity);
    var idCol = schemaGetColIndexByFid(hdr, idFid);
    if (idCol < 0) return { ok: false, error: "ID column not found", valuesById: {} };
    var fidIdx = {};
    for (var i = 0; i < fieldIds.length; i++) {
      var fid = fieldIds[i];
      var idx = _hdrIndex_(hdr, fid);
      if (idx >= 0) fidIdx[fid] = idx;
    }
    if (Object.keys(fidIdx).length === 0) return { ok: true, valuesById: {} };
    var want = {};
    ids.forEach(function (id) { want[id] = true; });
    var valuesById = {};
    for (var r = 2; r < values.length; r++) {
      var row = values[r] || [];
      var rowId = String(row[idCol] || "").trim();
      if (!rowId || !want[rowId]) continue;
      var out = {};
      for (var f = 0; f < fieldIds.length; f++) {
        var fid2 = fieldIds[f];
        var cidx = fidIdx[fid2];
        if (cidx == null) continue;
        out[fid2] = row[cidx];
      }
      valuesById[rowId] = out;
    }
    return { ok: true, valuesById: valuesById };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), valuesById: {} };
  }
}

var __MOTK_REQ_SS__ = null;
function _SS_() { return __MOTK_REQ_SS__ || SpreadsheetApp.getActiveSpreadsheet(); }
function _shByName_(name) {
  var ss = _SS_(); var sh = ss && ss.getSheetByName(name);
  if (!sh) throw new Error("Sheet not found: " + name);
  return sh;
}
function _read2D_(name) {
  var v = _shByName_(name).getDataRange().getValues();
  if (!v || !v.length) throw new Error("Empty sheet: " + name);
  return v;
}
function _hdrIndex_(hdr, name) {
  for (var i = 0; i < hdr.length; i++) { if (String(hdr[i]).trim().toLowerCase() === String(name).trim().toLowerCase()) return i; }
  return -1;
}
function _norm_(s) { return String(s || "").trim().toLowerCase().replace(/[^\w]+/g, "_"); }
function _normBool_(v) {
  var s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s) return false;
  if (s.charCodeAt && s.charCodeAt(0) === 0x2713) return true;
  return s === "true" || s === "1" || s === "yes" || s === "on" || s === "y" || s === "ok";
}
function _parseOptions_(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean);
  var s = String(v).trim();
  if (!s) return [];
  if (/^\s*\[/.test(s)) {
    try {
      var a = JSON.parse(s);
      if (Array.isArray(a)) return a.map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean);
    } catch (_) { }
  }
  return s.split(/[\n\r|,]+/).map(function (t) { return String(t).trim(); }).filter(Boolean);
}

function _isFid_(v) {
  var s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s || s.indexOf("fi_") !== 0) return false;
  var rest = s.slice(3);
  if (!rest) return false;
  for (var i = 0; i < rest.length; i++) {
    var ch = rest.charCodeAt(i);
    if (ch < 48 || ch > 57) return false;
  }
  return true;
}

function _fidNum_(v) {
  if (!_isFid_(v)) return null;
  var s = String(v).trim().toLowerCase();
  var rest = s.slice(3);
  var n = parseInt(rest, 10);
  return isNaN(n) ? null : n;
}

function _formatFid_(num) {
  var n = parseInt(num, 10);
  if (!isFinite(n) || n < 0) n = 0;
  return "fi_" + String(n).padStart(4, "0");
}

function _entityToSheet_(entity) {
  var m = { "shot": "Shots", "asset": "Assets", "task": "Tasks", "member": "ProjectMembers", "user": "Users", "page": "Pages" };
  var key = _norm_(entity);
  if (!m[key]) throw new Error("Unknown entity: " + entity);
  return m[key];
}
function _idPrefixToEntity_(idValue) {
  if (typeof idValue !== "string") return null;
  if (/^sh_\d+/.test(idValue)) return "shot";
  if (/^as_\d+/.test(idValue)) return "asset";
  if (/^ta_\d+/.test(idValue)) return "task";
  if (/^us_\d+/.test(idValue)) return "user";
  if (/^mb_\d+/.test(idValue)) return "member";
  if (/^pg_\d+/.test(idValue)) return "page";
  return null;
}

function _readFields_() {
  var values = _read2D_("Fields");
  var hdr = values[0];
  var rows = values.slice(1);
  var H = {};
  for (var i = 0; i < hdr.length; i++) { H[_norm_(hdr[i])] = i; }
  function h(name) { var key = _norm_(name); return H.hasOwnProperty(key) ? H[key] : null; }
  function pick_() { for (var i = 0; i < arguments.length; i++) { var idx = h(arguments[i]); if (idx != null) return idx; } return null; }
  var C = {
    field_id: pick_("field_id", "fieldid", "fid", "id"),
    entity: pick_("entity", "entity_name", "entityname", "sheet", "sheet_name", "sheetname", "table"),
    type: pick_("type", "field_type", "fieldtype", "fieldType"),
    label: pick_("label", "field_name", "fieldname", "name", "display_name", "displayname", "display", "displayName"),
    name: pick_("name", "field_name", "fieldname"),
    editable: pick_("editable", "is_editable", "iseditable", "isEditable", "can_edit", "canedit"),
    isCore: pick_("core", "is_core", "iscore", "isCore"),
    uiSection: pick_("ui_section", "uisection", "section"),
    order: pick_("order", "sort", "pos", "position", "index"),
    isLink: pick_("is_link", "islink", "link", "isLink")
  };
  C.column_name = pick_("column", "column_name", "col", "columnname");
  C.options = pick_("options", "option", "choices", "choice");
  C.required = pick_("required", "is_required", "required_flag", "req", "isrequired");

  function _detectColByPredicate_(rows, predicate) {
    if (!rows || !rows.length) return null;
    var bestIdx = null; var bestScore = 0; var sampleLen = Math.min(rows.length, 200);
    for (var c = 0; c < hdr.length; c++) {
      var score = 0;
      for (var r = 0; r < sampleLen; r++) { var v = rows[r] && rows[r][c]; if (predicate(v)) score++; }
      if (score > bestScore) { bestScore = score; bestIdx = c; }
    }
    return bestScore > 0 ? bestIdx : null;
  }
  function _looksLikeFieldId_(v) { return _isFid_(v); }
  function _looksLikeEntity_(v) {
    var raw = String(v || "").trim(); if (!raw) return false;
    var ent = _normalizeEntityParams_({ entity: raw }).entity;
    return ent === "shot" || ent === "asset" || ent === "task" || ent === "member" || ent === "user" || ent === "page";
  }
  function _looksLikeType_(v) {
    var t = String(v || "").trim().toLowerCase(); if (!t) return false;
    return (t === "id" || t === "text" || t === "date" || t === "checkbox" || t === "select" || t === "json" || t === "entity_name" || t === "entity_link" || t === "originals" || t === "file_list" || t === "thumbnails" || t === "versions" || /_link$/.test(t));
  }
  function _looksLikeBool_(v) {
    if (v === true || v === false) return true;
    var s = String(v == null ? "" : v).trim().toLowerCase();
    return s === "true" || s === "false" || s === "1" || s === "0" || s === "yes" || s === "no" || s === "on" || s === "off" || s === "ok" || s === "checked" || s === "unchecked" || s === "✓";
  }

  if (C.field_id == null) C.field_id = _detectColByPredicate_(rows, _looksLikeFieldId_);
  if (C.entity == null) C.entity = _detectColByPredicate_(rows, _looksLikeEntity_);
  if (C.type == null) C.type = _detectColByPredicate_(rows, _looksLikeType_);
  if (C.isCore == null) C.isCore = _detectColByPredicate_(rows, _looksLikeBool_);

  if (C.field_id == null) C.field_id = 0;
  if (C.entity == null) C.entity = 1;
  if (C.label == null) C.label = 2;
  if (C.type == null) C.type = 3;
  if (C.editable == null) C.editable = 4;
  if (C.isCore == null) C.isCore = 7;

  var out = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var o = {
      entity: C.entity != null ? row[C.entity] : "",
      type: C.type != null ? row[C.type] : "",
      field_id: C.field_id != null ? row[C.field_id] : "",
      column_name: C.column_name != null ? row[C.column_name] : "",
      label: C.label != null ? row[C.label] : "",
      name: C.name != null ? row[C.name] : "",
      field_name: C.name != null ? row[C.name] : "",
      options: C.options != null ? row[C.options] : "",
      editable: C.editable != null ? row[C.editable] : false,
      required: C.required != null ? row[C.required] : false,
      isCore: C.isCore != null ? row[C.isCore] : false,
      uiSection: C.uiSection != null ? row[C.uiSection] : "",
      order: C.order != null ? row[C.order] : "",
      isLink: C.isLink != null ? row[C.isLink] : false
    };
    out.push(o);
  }
  return out;
}

var __SCHEMA_CACHE__ = null;
var __SCHEMA_CACHE_SIG__ = "";

function _schemaNormalizeEntity_(entity) {
  var key = String(entity || "").trim().toLowerCase();
  if (!key) return "";
  if (key === "shots") return "shot";
  if (key === "assets") return "asset";
  if (key === "tasks") return "task";
  if (key === "users") return "user";
  if (key === "projectmembers" || key === "projectmember" || key === "members") return "member";
  if (key === "pages") return "page";
  if (key === "schedules" || key === "schedule") return "sched";
  if (key === "cards") return "card";
  return key;
}

function _schemaNormalizeFieldName_(name) {
  return _norm_(name || "");
}

function _schemaBuild_() {
  var rows = _readFields_();
  var schema = { byEntity: {}, byFid: {}, diag: { duplicates: [] } };
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || {};
    var ent = _schemaNormalizeEntity_(r.entity);
    if (!ent) continue;
    var fid = String(r.field_id || "").trim();
    if (!fid) continue;
    var type = String(r.type || "").trim().toLowerCase();
    var fieldName = String(r.field_name || r.name || r.label || r.column_name || "").trim();
    var normName = _schemaNormalizeFieldName_(fieldName);
    var meta = {
      fid: fid,
      entity: ent,
      field_name: fieldName,
      field_name_norm: normName,
      label: String(r.label || r.name || fieldName || "").trim(),
      type: type,
      column_name: String(r.column_name || "").trim(),
      editable: _normBool_(r.editable),
      required: _normBool_(r.required),
      isCore: _normBool_(r.isCore),
      isLink: _normBool_(r.isLink),
      options: _parseOptions_(r.options),
      order: (r.order != null ? r.order : "")
    };
    schema.byFid[fid] = meta;
    if (!schema.byEntity[ent]) {
      schema.byEntity[ent] = { byType: {}, byName: {}, fields: [] };
    }
    var entMap = schema.byEntity[ent];
    entMap.fields.push(meta);
    if (type) {
      if (!entMap.byType[type]) entMap.byType[type] = [fid];
      else if (entMap.byType[type].indexOf(fid) < 0) entMap.byType[type].push(fid);
    }
    if (normName) {
      if (!entMap.byName[normName]) entMap.byName[normName] = fid;
      else if (entMap.byName[normName] !== fid) {
        schema.diag.duplicates.push({ entity: ent, field_name: fieldName, fid: fid, prior: entMap.byName[normName] });
      }
    }
  }
  return schema;
}

function _schemaGet_() {
  var sig = "";
  try { sig = _buildFieldsSchemaSig_(); } catch (_) { sig = ""; }
  if (__SCHEMA_CACHE__ && (!sig || __SCHEMA_CACHE_SIG__ === sig)) return __SCHEMA_CACHE__;
  var cacheKey = sig ? ("motk:schema:" + sig) : "motk:schema:latest";
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
      __SCHEMA_CACHE__ = JSON.parse(cached);
      __SCHEMA_CACHE_SIG__ = sig;
      return __SCHEMA_CACHE__;
    }
  } catch (_) { }
  var schema = _schemaBuild_();
  __SCHEMA_CACHE__ = schema;
  __SCHEMA_CACHE_SIG__ = sig;
  try {
    var cache2 = CacheService.getScriptCache();
    cache2.put(cacheKey, JSON.stringify(schema), 21600);
  } catch (_) { }
  return schema;
}

function schemaGetIdFid(entity) {
  var ent = _schemaNormalizeEntity_(entity);
  var schema = _schemaGet_();
  var entMap = schema.byEntity[ent];
  if (!entMap || !entMap.byType.id || !entMap.byType.id.length) {
    throw new Error("Schema missing id type for entity: " + ent);
  }
  if (entMap.byType.id.length > 1) {
    throw new Error("Schema has multiple id fields for entity: " + ent);
  }
  return entMap.byType.id[0];
}

function schemaGetEntityNameFid(entity) {
  var ent = _schemaNormalizeEntity_(entity);
  var schema = _schemaGet_();
  var entMap = schema.byEntity[ent];
  if (!entMap || !entMap.byType.entity_name || !entMap.byType.entity_name.length) {
    throw new Error("Schema missing entity_name type for entity: " + ent);
  }
  if (entMap.byType.entity_name.length > 1) {
    throw new Error("Schema has multiple entity_name fields for entity: " + ent);
  }
  return entMap.byType.entity_name[0];
}

function schemaGetFidByFieldName(entity, fieldName) {
  var ent = _schemaNormalizeEntity_(entity);
  var key = _schemaNormalizeFieldName_(fieldName);
  var schema = _schemaGet_();
  var entMap = schema.byEntity[ent];
  if (!entMap || !entMap.byName[key]) {
    throw new Error("Schema missing field_name '" + fieldName + "' for entity: " + ent);
  }
  return entMap.byName[key];
}

function schemaGetFidsByType(entity, type) {
  var ent = _schemaNormalizeEntity_(entity);
  var schema = _schemaGet_();
  var entMap = schema.byEntity[ent];
  var t = String(type || "").trim().toLowerCase();
  if (!entMap || !entMap.byType[t]) return [];
  return entMap.byType[t].slice();
}

function schemaGetFieldMetaByFid(fid) {
  var schema = _schemaGet_();
  return schema.byFid[String(fid || "").trim()] || null;
}

function schemaGetColIndexByFid(headerRow, fid) {
  if (!headerRow || !headerRow.length) return -1;
  var target = String(fid || "").trim();
  if (!target) return -1;
  for (var i = 0; i < headerRow.length; i++) {
    if (String(headerRow[i] || "").trim() === target) return i;
  }
  return -1;
}

function sv_getFieldLabels(entity) {
  try {
    var e = _normalizeEntityParams_({ entity: entity }).entity;
    var fields = _readFields_();
    var labels = {};
    for (var i = 0; i < fields.length; i++) {
      if (_norm_(fields[i].entity) !== e) continue;
      var fid = String(fields[i].field_id || '').trim();
      if (!fid) continue;
      labels[fid] = String(fields[i].label || fields[i].name || fields[i].field_name || fid);
    }
    return { ok: true, labels: labels };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), labels: {} };
  }
}

function _idAndLabelCols_(entity, sheetHdr) {
  var ent = _schemaNormalizeEntity_(entity);
  var schema = _schemaGet_();
  var idFid = schemaGetIdFid(ent);
  var nameFid = schemaGetEntityNameFid(ent);
  var idName = null;
  var labelName = null;

  var idxId = schemaGetColIndexByFid(sheetHdr, idFid);
  if (idxId >= 0) idName = sheetHdr[idxId];
  var idxLabel = schemaGetColIndexByFid(sheetHdr, nameFid);
  if (idxLabel >= 0) labelName = sheetHdr[idxLabel];

  if (!idName) {
    var idMeta = schema.byFid[idFid];
    if (idMeta && idMeta.column_name) {
      var idxByCol = _hdrIndex_(sheetHdr, idMeta.column_name);
      if (idxByCol >= 0) idName = sheetHdr[idxByCol];
    }
  }
  if (!labelName) {
    var nameMeta = schema.byFid[nameFid];
    if (nameMeta && nameMeta.column_name) {
      var idxByCol2 = _hdrIndex_(sheetHdr, nameMeta.column_name);
      if (idxByCol2 >= 0) labelName = sheetHdr[idxByCol2];
    }
  }

  if (!idName) throw new Error("ID column not resolved for entity: " + ent);
  return { idName: idName, labelName: labelName };
}

function _isEditable_(entity, colName) {
  var ent = _schemaNormalizeEntity_(entity);
  var schema = _schemaGet_();
  var raw = String(colName || "").trim();
  var meta = schema.byFid[raw];
  if (meta && meta.entity === ent) return _normBool_(meta.editable);
  var norm = _schemaNormalizeFieldName_(raw);
  var entMap = schema.byEntity[ent];
  if (!entMap) return false;
  var fid = entMap.byName[norm];
  if (fid && schema.byFid[fid]) return _normBool_(schema.byFid[fid].editable);
  for (var i = 0; i < entMap.fields.length; i++) {
    var m = entMap.fields[i];
    if (!m || !m.column_name) continue;
    if (_schemaNormalizeFieldName_(m.column_name) === norm) return _normBool_(m.editable);
  }
  return false;
}

function _resolveEntityLinkLabel_(idValue) {
  var ent = _idPrefixToEntity_(idValue);
  if (!ent) return null;
  var sheet = _entityToSheet_(ent);
  var values = _read2D_(sheet);
  var hdr = values[0];
  var map = _idAndLabelCols_(ent, hdr);
  if (!map.idName) return null;
  var idCol = _hdrIndex_(hdr, map.idName);
  var labelCol = map.labelName ? _hdrIndex_(hdr, map.labelName) : -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(idValue)) return (labelCol >= 0) ? String(values[i][labelCol]) : null;
  }
  return null;
}

function _cellToViewToken_(colName, value) {
  var t = "text", label = null;
  if (typeof value === "string") {
    var pref = _idPrefixToEntity_(value);
    if (pref) { t = "entity_link"; label = _resolveEntityLinkLabel_(value); }
  }
  return { c: String(colName), t: t, v: value, label: label };
}

function dp_getEntityRecord(entity, id) {
  try {
    var conf = _normalizeEntityParams_({ entity: entity });
    var entityKey = conf.entity;
    var sheet = _entityToSheet_(entityKey);
    var values = _read2D_(sheet);
    var hdr = values[0];
    var map = _idAndLabelCols_(entityKey, hdr);
    if (!map.idName) throw new Error("ID column not resolved for entity: " + entityKey);
    var idCol = _hdrIndex_(hdr, map.idName);
    var labelCol = map.labelName ? _hdrIndex_(hdr, map.labelName) : -1;
    var found = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(id)) { found = i; break; }
    }
    if (found < 0) return { ok: false, error: "Record not found", entity: entityKey, id: id };
    var rec = {};
    for (var i = 0; i < hdr.length; i++) {
      var token = _cellToViewToken_(hdr[i], values[found][i]);
      token.editable = _isEditable_(entityKey, hdr[i]);
      rec[hdr[i]] = token;
    }
    var labelVal = (labelCol >= 0) ? values[found][labelCol] : null;
    var typeByFieldId = {};
    try {
      var ftAll = (typeof getFieldTypes === "function") ? (getFieldTypes(entityKey) || {}) : {};
      var ftEntity = (ftAll && ftAll[entityKey]) ? ftAll[entityKey] : {};
      for (var fid in ftEntity) {
        if (!ftEntity.hasOwnProperty(fid)) continue;
        typeByFieldId[fid] = String(ftEntity[fid].type || "").trim().toLowerCase();
      }
    } catch (_) { }
    for (var f in rec) {
      if (!rec.hasOwnProperty(f)) continue;
      if (typeByFieldId[f] === "date") {
        var tok = rec[f];
        var raw = (tok && typeof tok === "object" && tok.hasOwnProperty("v")) ? tok.v : tok;
        var dt = _parseDate_(raw);
        if (tok && typeof tok === "object" && tok.hasOwnProperty("v")) {
          tok.v = dt ? _formatDateYmd_(dt) : "";
        } else {
          rec[f] = dt ? _formatDateYmd_(dt) : "";
        }
      }
    }
    return { ok: true, entity: entityKey, sheet: sheet, id: id, id_col: map.idName, label_col: map.labelName, label: labelVal, fields: rec };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), entity: entity, id: id };
  }
}

function dp_diag_dateCoercion(entity, recordId, fieldId) {
  var rec = dp_getEntityRecord(entity, recordId);
  var token = rec && rec.fields ? rec.fields[fieldId] : null;
  var val = (token && typeof token === "object" && token.hasOwnProperty("v")) ? token.v : (rec ? rec[fieldId] : null);
  return { entity: entity, recordId: recordId, fieldId: fieldId, returnedValue: val, returnedType: (val !== undefined) ? typeof val : null };
}

function _coerceValueByFieldType_(fieldType, raw) {
  if (raw === null || raw === undefined) return (String(fieldType || "").trim().toLowerCase() === "checkbox") ? false : "";
  if (raw === "") return (String(fieldType || "").trim().toLowerCase() === "checkbox") ? false : "";
  var t = String(fieldType || "").trim().toLowerCase();
  if (t === "checkbox") {
    if (raw === true || raw === false) return raw;
    var s = String(raw).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "y" || s === "on" || s === "checked") return true;
    if (s === "false" || s === "0" || s === "no" || s === "n" || s === "off" || s === "unchecked") return false;
    return Boolean(raw);
  }
  if (t === "number") {
    if (typeof raw === "number") return raw;
    var n = Number(String(raw).trim());
    return isNaN(n) ? "" : n;
  }
  if (t === "date") {
    if (raw instanceof Date) return raw;
    if (typeof raw === "number" && isFinite(raw)) {
      var ms = Math.round((raw - 25569) * 86400 * 1000);
      return new Date(ms);
    }
    var s2 = String(raw).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s2);
    if (m) {
      var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      return new Date(y, mo - 1, d);
    }
    return s2;
  }
  return raw;
}

function dp_updateEntityRecord(entity, id, patch, options) {
  try {
    if (!patch || typeof patch !== "object") throw new Error("patch must be an object");
    var conf = _normalizeEntityParams_({ entity: entity });
    var entityKey = conf.entity;
    var sheetName = conf.sheet;
    var sh = _shByName_(sheetName);
    var values = sh.getDataRange().getValues();
    if (!values || values.length < 3) throw new Error("Entity sheet has no data rows: " + sheetName);
    var hdr = values[0] || [];
    var idFid = schemaGetIdFid(entityKey);
    var idCol = schemaGetColIndexByFid(hdr, idFid);
    var rIdx = -1;
    for (var i = 2; i < values.length; i++) {
      if (String(values[i][idCol]) === String(id)) { rIdx = i; break; }
    }
    if (rIdx < 0) return { ok: false, error: "Record not found", entity: entityKey, id: id };
    var row = values[rIdx].slice();
    var fieldDefs = {};
    try {
      var ftAll = (typeof getFieldTypes === "function") ? (getFieldTypes(entityKey) || {}) : {};
      fieldDefs = (ftAll && ftAll[entityKey]) ? ftAll[entityKey] : {};
    } catch (_) { fieldDefs = {}; }
    var plainTextColIdx = {}, dateColIdx = {};
    var typeMap = null;
    try { typeMap = (typeof sv_getFieldsJsonMap === "function") ? sv_getFieldsJsonMap(entityKey) : null; } catch (err) { typeMap = null; }
    var typeByFieldId = {};
    try {
      var ftAll2 = (typeof getFieldTypes === "function") ? (getFieldTypes(entityKey) || {}) : {};
      var ftEntity2 = (ftAll2 && ftAll2[entityKey]) ? ftAll2[entityKey] : {};
      for (var tfid in ftEntity2) {
        if (!ftEntity2.hasOwnProperty(tfid)) continue;
        typeByFieldId[tfid] = String(ftEntity2[tfid].type || "").trim().toLowerCase();
      }
    } catch (_) { }
    if (typeMap) {
      for (var tfid2 in typeMap) {
        if (!typeMap.hasOwnProperty(tfid2)) continue;
        if (!typeByFieldId[tfid2]) { typeByFieldId[tfid2] = String(typeMap[tfid2].type || "").trim().toLowerCase(); }
      }
    }
    for (var k in patch) {
      if (!patch.hasOwnProperty(k)) continue;
      var fid = String(k || '').trim();
      if (!fid) continue;
      if (!_isFid_(fid)) return { ok: false, error: "Invalid field id: " + fid, entity: entityKey, id: id };
      var colIdx = _hdrIndex_(hdr, fid);
      if (colIdx < 0) return { ok: false, error: "Unknown field: " + fid, entity: entityKey, id: id };
      if (!_isEditable_(entityKey, fid)) return { ok: false, error: "Field not editable: " + fid, entity: entityKey, id: id };
      var v = patch[k];
      var ftype = "";
      try { ftype = String(fieldDefs && fieldDefs[fid] && fieldDefs[fid].type || "").trim().toLowerCase(); } catch (_) { ftype = ""; }
      var fieldType = typeByFieldId[fid] || "";
      if (fieldType === "select") {
        var optionsSrc = [];
        try {
          if (fieldDefs && fieldDefs[fid] && Array.isArray(fieldDefs[fid].options)) {
            optionsSrc = fieldDefs[fid].options;
          } else if (typeMap && typeMap[fid] && Array.isArray(typeMap[fid].options)) {
            optionsSrc = typeMap[fid].options;
          }
        } catch (_) { optionsSrc = []; }
        var opts = _parseOptions_(optionsSrc);
        var valStr = String(v == null ? "" : v).trim();
        if (opts.length && opts.indexOf(valStr) < 0) {
          return { ok: false, error: "Invalid select option", errorCode: "INVALID_SELECT_OPTION", entity: entityKey, id: id, fieldId: fid, requestedValue: valStr, allowed: opts };
        }
        v = valStr;
      }
      if (fieldType === "date") {
        var dt = _parseDate_(v);
        if (!dt) return { ok: false, error: "Invalid date", errorCode: "INVALID_DATE", entity: entityKey, id: id, fieldId: fid, value: v };
        row[colIdx] = dt;
        dateColIdx[colIdx] = 1;
      } else if (ftype === "text" || ftype === "entity_name" || ftype === "name") {
        plainTextColIdx[colIdx] = 1;
        row[colIdx] = (v == null) ? "" : String(v);
      } else {
        row[colIdx] = _coerceValueByFieldType_(fieldType, v);
      }
    }
    try {
      for (var c in plainTextColIdx) {
        if (!plainTextColIdx.hasOwnProperty(c)) continue;
        var idxNum = Number(c);
        if (isFinite(idxNum) && idxNum >= 0) sh.getRange(rIdx + 1, idxNum + 1).setNumberFormat("@");
      }
    } catch (_) { }
    sh.getRange(rIdx + 1, 1, 1, hdr.length).setValues([row]);
    try {
      for (var dc in dateColIdx) {
        if (!dateColIdx.hasOwnProperty(dc)) continue;
        var idxDate = Number(dc);
        if (isFinite(idxDate) && idxDate >= 0) sh.getRange(rIdx + 1, idxDate + 1).setNumberFormat("yyyy-mm-dd");
      }
    } catch (_) { }

    var readbackRow = [];
    try {
      readbackRow = sh.getRange(rIdx + 1, 1, 1, hdr.length).getValues()[0] || [];
    } catch (_) {
      readbackRow = [];
    }

    function _toDisplayScalar_(val) {
      if (val === null || val === undefined) return "";
      if (val instanceof Date) return isNaN(val.getTime()) ? "" : val.toISOString().slice(0, 10);
      var t = typeof val;
      if (t === "string") return val;
      if (t === "number") return Number.isFinite(val) ? val : "";
      if (t === "boolean") return val;
      try { if (t === "object") return JSON.stringify(val); } catch (_) { }
      return "";
    }
    function _valuesEqual_(a, b) {
      if (a === b) return true;
      if (a == null && b == null) return true;
      return String(a) === String(b);
    }

    var updated = {};
    var expected = {};
    var readback = {};
    var colIndices = {};
    var match = true;
    var touchedFids = Object.keys(patch || {});

    touchedFids.forEach(function (fid3) {
      var colIdx2 = _hdrIndex_(hdr, fid3);
      if (colIdx2 < 0) return;
      colIndices[fid3] = colIdx2 + 1;
      var expectedVal = _toDisplayScalar_(row[colIdx2]);
      var readbackVal = _toDisplayScalar_(readbackRow[colIdx2]);
      updated[fid3] = expectedVal;
      expected[fid3] = expectedVal;
      readback[fid3] = readbackVal;
      if (!_valuesEqual_(expectedVal, readbackVal)) match = false;
    });

    var latest = dp_getEntityRecord(entityKey, id) || {};
    latest.ok = (match !== false);
    latest.applied = (match !== false);
    latest.updated = updated;
    latest.entityKey = entityKey;
    latest.id = id;
    latest.expected = expected;
    latest.readback = readback;
    latest.match = match;
    latest.updatedAt = new Date().toISOString();
    if (!latest.diag) latest.diag = {};
    try { latest.diag.write = Object.assign({}, latest.diag.write || {}, { sheetName: sheetName, rowIndex: rIdx + 1, colIndices: colIndices }); } catch (_) { }

    if (touchedFids.length === 1) {
      var singleFid = touchedFids[0];
      latest.fieldId = singleFid;
      latest.expectedValue = expected[singleFid];
      latest.readbackValue = readback[singleFid];
    }

    if (!match) {
      latest.error = latest.error || "Readback mismatch";
      if (!latest.errorCode) latest.errorCode = "READBACK_MISMATCH";
    }
    if (latest.ok === false && !latest.errorCode && latest.error) latest.errorCode = "INLINE_EDIT_FAILED";
    return latest;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), errorCode: "INLINE_EDIT_FAILED", entity: entity, id: id };
  }
}

function _getEntityHeaderFieldIds_(entityKey) {
  try {
    var sheetName = _entityToSheet_(entityKey);
    var sh = _shByName_(sheetName);
    var lastCol = sh.getLastColumn();
    if (!lastCol) return { fieldIds: [], labelsById: {} };
    var row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    var row2 = (sh.getLastRow() >= 2) ? (sh.getRange(2, 1, 1, lastCol).getValues()[0] || []) : [];
    var fieldIds = [];
    var labelsById = {};
    for (var i = 0; i < row1.length; i++) {
      var fid = String(row1[i] || "").trim();
      if (!_isFid_(fid)) continue;
      fieldIds.push(fid);
      var label = String(row2[i] || "").trim();
      if (label) labelsById[fid] = label;
    }
    return { fieldIds: fieldIds, labelsById: labelsById };
  } catch (_) {
    return { fieldIds: [], labelsById: {} };
  }
}

function _mergeFieldTypesFromHeader_(types, entityKey, diag, fallbackById) {
  var out = types || {};
  var ent = String(entityKey || "").trim().toLowerCase();
  if (!ent) return out;
  var header = _getEntityHeaderFieldIds_(ent);
  if (!header.fieldIds.length) return out;
  if (!out[ent]) out[ent] = {};
  var missing = [];
  for (var i = 0; i < header.fieldIds.length; i++) {
    var fid = header.fieldIds[i];
    if (!out[ent][fid]) {
      missing.push(fid);
      continue;
    } else if (!out[ent][fid].label && header.labelsById[fid]) {
      out[ent][fid].label = header.labelsById[fid];
    }
  }
  if (diag && missing.length) {
    diag.missingFieldMetaByEntity = diag.missingFieldMetaByEntity || {};
    diag.missingFieldMetaByEntity[ent] = missing;
  }
  return out;
}

function _buildFieldTypes_(entity) {
  var diag = { missingFieldMetaByEntity: {} };
  var targetKey = '';
  if (entity != null && String(entity).trim()) {
    targetKey = _normalizeEntityParams_({ entity: entity }).entity;
  }
  var rows = _readFields_();
  var fallbackById = {};
  var types = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || {};
    var entRaw = String(r.entity || '').trim();
    if (!entRaw) continue;
    var entKey = _normalizeEntityParams_({ entity: entRaw }).entity;
    if (targetKey && entKey !== targetKey) continue;
    var fid = String(r.field_id || '').trim();
    if (!fid) continue;
    var type = String(r.type || '').trim().toLowerCase();
    if (!type) continue;
    var label = String(r.label || r.name || '').trim();
    var editable = _normBool_(r.editable);
    var required = _normBool_(r.required);
    var options = _parseOptions_(r.options);
    if (!types[entKey]) types[entKey] = {};
    types[entKey][fid] = {
      label: label,
      field_name: String(r.field_name || r.name || "").trim(),
      column_name: String(r.column_name || "").trim(),
      type: type,
      editable: editable,
      required: required,
      options: options,
      isCore: _normBool_(r.isCore),
      uiSection: String(r.uiSection || "").trim(),
      order: (r.order != null ? r.order : ""),
      isLink: _normBool_(r.isLink)
    };
    if (!fallbackById[fid]) { fallbackById[fid] = r; }
  }
  var entityList = targetKey ? [targetKey] : ["shot", "asset", "task", "member", "user", "page"];
  for (var j = 0; j < entityList.length; j++) {
    types = _mergeFieldTypesFromHeader_(types, entityList[j], diag, fallbackById);
  }
  return { types: types, diag: diag };
}

function getFieldTypes(entity) {
  try { return _buildFieldTypes_(entity).types; } catch (e) { return {}; }
}

function getFieldTypesWithDiag_(entity) {
  try { return _buildFieldTypes_(entity); } catch (e) { return { types: {}, diag: { missingFieldMetaByEntity: {} } }; }
}

function _fieldsHeaderIndex_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ssheet_("Fields") || ss.getSheetByName("Fields");
  if (!sh) throw new Error("Fields sheet not found");
  var lastCol = sh.getLastColumn();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var H = {}, HTrim = {};
  for (var i = 0; i < header.length; i++) {
    var norm = _norm_(header[i]); H[norm] = i;
    var trimmed = norm.replace(/^_+|_+$/g, ""); if (trimmed && HTrim[trimmed] == null) HTrim[trimmed] = i;
  }
  function h(name) { var key = _norm_(name); if (H.hasOwnProperty(key)) return H[key]; var trimmed = key.replace(/^_+|_+$/g, ""); return HTrim.hasOwnProperty(trimmed) ? HTrim[trimmed] : null; }
  function pick() { for (var i = 0; i < arguments.length; i++) { var idx = h(arguments[i]); if (idx != null) return idx; } return null; }
  var cols = {
    field_id: pick("field_id", "fieldid", "fid", "id"),
    entity: pick("entity", "entity_name", "entityname", "sheet", "sheet_name", "sheetname", "table"),
    type: pick("type", "field_type", "fieldtype", "fieldType"),
    label: pick("label", "field_name", "fieldname", "name", "display_name", "displayname", "display", "displayName"),
    editable: pick("editable", "is_editable", "iseditable", "isEditable", "can_edit", "canedit"),
    required: pick("required", "is_required", "isrequired"),
    isCore: pick("core", "is_core", "iscore", "isCore"),
    options: pick("options", "option", "values"),
    uiSection: pick("ui_section", "uisection", "section"),
    order: pick("order", "sort", "pos", "position", "index"),
    isLink: pick("is_link", "islink", "link", "isLink"),
    active: pick("active", "is_active", "enabled")
  };
  var headerNorm = header.map(function (x) { return _norm_(x); });
  return { sh: sh, header: header, headerNorm: headerNorm, lastCol: lastCol, cols: cols };
}

function ssheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); if (!ss) return null;
  var raw = String(name || "").trim(); if (!raw) return null;
  var direct = ss.getSheetByName(raw); if (direct) return direct;
  var cap = raw.charAt(0).toUpperCase() + raw.slice(1);
  var capSheet = ss.getSheetByName(cap); if (capSheet) return capSheet;
  var plural = cap.endsWith("s") ? cap : cap + "s";
  return ss.getSheetByName(plural);
}

function newFid_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = ssheet_("FIELDS");
    if (!sh) throw new Error("FIELDS sheet not found");
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return _formatFid_(1);
    var vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    var maxNum = 0;
    for (var i = 0; i < vals.length; i++) {
      var s = String(vals[i][0] || "").trim();
      var n = _fidNum_(s);
      if (n != null) maxNum = Math.max(maxNum, n);
    }
    var nextNum = maxNum + 1;
    return _formatFid_(nextNum);
  } finally { try { lock.releaseLock(); } catch (e) { } }
}

function applyFieldToEntityHeader_(entityKey, fid, label) {
  var sh = ssheet_(entityKey);
  if (!sh) throw new Error("Entity sheet not found: " + entityKey);
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) lastCol = 1;
  var fids = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = fids.indexOf(fid);
  if (idx >= 0) {
    var col = idx + 1;
    var curLabel = sh.getRange(2, col).getValue();
    if (!curLabel) sh.getRange(2, col).setValue(_sanitizeCellValue_(label || fid, "entityHeaderLabel"));
    return { ok: true, existed: true, col: col };
  }
  sh.insertColumnAfter(lastCol);
  var colNew = lastCol + 1;
  sh.getRange(1, colNew).setValue(_sanitizeCellValue_(fid, "entityHeaderFieldId"));
  sh.getRange(2, colNew).setValue(_sanitizeCellValue_(label || fid, "entityHeaderLabel"));
  return { ok: true, existed: false, col: colNew };
}

function _findFirstEmptyFieldsRow_(sh, cols, scanLimit) {
  var limit = Math.min(sh.getLastRow(), Number(scanLimit) || sh.getLastRow());
  if (limit < 2) return 2;
  var baseCol = (cols && cols.entity != null) ? cols.entity : cols.field_id;
  if (baseCol == null) return limit + 1;
  var count = Math.max(1, limit - 1);
  var vals = sh.getRange(2, baseCol + 1, count, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) {
    if (!String(vals[i][0] || "").trim()) return 2 + i;
  }
  return limit + 1;
}

function sv_fieldsAdd_v1(payload) {
  payload = payload || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: "lock_timeout", errorCode: "LOCK_TIMEOUT" };
  try {
    var ssId = ''; try { ssId = SpreadsheetApp.getActiveSpreadsheet().getId(); } catch (_) { ssId = ''; }
    var info = _fieldsHeaderIndex_();
    var sh = info.sh;
    var cols = info.cols;
    if (cols.field_id == null || cols.entity == null || cols.type == null || cols.label == null) {
      return { ok: false, error: "fields header missing required columns", missing: ["field_id", "entity", "type", "field_name"], header: info.headerNorm || [], fieldsSheetName: sh ? sh.getName() : '', spreadsheetId: ssId };
    }
    var ent = _normalizeEntityParams_({ entity: payload.entity || "" }).entity;
    if (!ent) return { ok: false, error: "entity required", errorCode: "INVALID_ENTITY" };
    var label = String(payload.label || "").trim();
    if (!label) return { ok: false, error: "label required", errorCode: "INVALID_LABEL" };
    var type = String(payload.type || "text").trim().toLowerCase();
    var allowed = ["text", "checkbox", "select", "date", "id", "entity_name", "json", "thumbnails", "file_list", "originals", "versions", "shot_link", "asset_link", "task_link", "member_link", "user_link"];
    if (allowed.indexOf(type) < 0) return { ok: false, error: "invalid field type", errorCode: "INVALID_TYPE" };
    var editable = _normBool_(payload.editable);
    var required = _normBool_(payload.required);
    var isCore = _normBool_(payload.isCore);
    var isLink = _normBool_(payload.isLink);
    var uiSection = String(payload.uiSection || "").trim();
    var options = [];
    if (Array.isArray(payload.options)) options = payload.options.map(function (o) { return String(o || "").trim(); }).filter(function (s) { return !!s; });
    else if (payload.options != null) return { ok: false, error: "invalid options type", errorCode: "INVALID_OPTIONS" };
    var lastCol = info.lastCol;
    if (cols.active == null) { sh.getRange(1, lastCol + 1).setValue("active"); cols.active = lastCol; lastCol += 1; }
    function _computeNextFieldIdFromColA_() {
      var lastRow = sh.getLastRow();
      if (lastRow < 2) lastRow = 2;
      var vals = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      var lastMatchedRow = -1;
      var lastMatchedValue = '';
      var maxNum = 0;
      for (var i = vals.length - 1; i >= 0; i--) {
        var raw = String(vals[i][0] || '').trim();
        if (!raw) continue;
        var n = _fidNum_(raw);
        if (n == null) continue;
        lastMatchedRow = i + 2;
        lastMatchedValue = raw;
        if (n > maxNum) maxNum = n;
        break;
      }
      var nextNum = maxNum + 1;
      var nextFid = _formatFid_(nextNum);
      return { lastMatchedRow: lastMatchedRow, lastMatchedValue: lastMatchedValue, nextFid: nextFid };
    }
    var fidDiag = _computeNextFieldIdFromColA_();
    var fid = fidDiag && fidDiag.nextFid ? String(fidDiag.nextFid) : "";
    if (!_isFid_(fid)) {
      return { ok: false, error: "Failed to generate field id", errorCode: "FIELD_ID_GENERATION_FAILED" };
    }
    var rowIndex = _findFirstEmptyFieldsRow_(sh, cols, 5000);
    var writtenCols = [];
    function setCol_(idx, value) {
      if (idx == null) return;
      var safe = _sanitizeCellValue_(value, "fieldsAdd:" + idx);
      sh.getRange(rowIndex, idx + 1).setValue(safe);
      writtenCols.push(idx);
    }
    function clearWrittenCols_() {
      for (var wc = 0; wc < writtenCols.length; wc++) { try { sh.getRange(rowIndex, writtenCols[wc] + 1).setValue(""); } catch (_) { } }
    }
    setCol_(cols.entity, ent);
    setCol_(cols.label, label);
    setCol_(cols.type, type);
    if (cols.editable != null) setCol_(cols.editable, editable ? "TRUE" : "FALSE");
    if (cols.required != null) setCol_(cols.required, required ? "TRUE" : "FALSE");
    if (cols.isCore != null) setCol_(cols.isCore, isCore ? "TRUE" : "FALSE");
    if (cols.isLink != null) setCol_(cols.isLink, isLink ? "TRUE" : "FALSE");
    if (cols.options != null) {
      var optStr = Array.isArray(options) ? options.join("|") : String(options || "");
      setCol_(cols.options, optStr);
    }
    if (cols.uiSection != null) setCol_(cols.uiSection, uiSection);
    if (cols.active != null) setCol_(cols.active, "TRUE");
    setCol_(cols.field_id, fid);
    SpreadsheetApp.flush();
    var fieldsRow = [];
    try { fieldsRow = sh.getRange(rowIndex, 1, 1, lastCol).getDisplayValues()[0] || []; } catch (_) { fieldsRow = []; }
    var verifiedFid = String(fieldsRow[cols.field_id] || "").trim();
    if (!verifiedFid || verifiedFid.toLowerCase() !== fid.toLowerCase()) {
      clearWrittenCols_();
      return { ok: false, error: "fields row verification failed", errorCode: "FIELDS_VERIFY_FAILED" };
    }
    var applyInfo = null;
    var entSheet = null;
    try {
      applyInfo = applyFieldToEntityHeader_(ent, fid, label);
      entSheet = ssheet_(ent);
      if (!entSheet) throw new Error("Entity sheet not found after apply: " + ent);
      var hRow = entSheet.getRange(1, 1, 1, entSheet.getLastColumn()).getValues()[0];
      var idx = hRow.indexOf(fid);
      if (idx < 0) {
        try { if (applyInfo && applyInfo.existed === false && applyInfo.col) entSheet.deleteColumn(applyInfo.col); } catch (_) { }
        clearWrittenCols_();
        return { ok: false, error: "entity header verification failed" };
      }
      var curLabel = entSheet.getRange(2, idx + 1).getValue();
      if (!curLabel) entSheet.getRange(2, idx + 1).setValue(label || fid);
    } catch (e) {
      try { clearWrittenCols_(); } catch (_) { }
      return { ok: false, error: "applyField failed: " + String(e && e.message || e), errorCode: "APPLY_FIELD_FAILED" };
    }
    var schemaSig = "";
    var schemaRefreshed = false;
    try {
      schemaRefreshed = !!hubRefreshSchema(ent);
      schemaSig = _buildFieldsSchemaSig_();
    } catch (e) {
      try { if (applyInfo && applyInfo.existed === false && applyInfo.col) entSheet.deleteColumn(applyInfo.col); } catch (_) { }
      try { clearWrittenCols_(); } catch (_) { }
      return { ok: false, error: "schema refresh failed: " + String(e && e.message || e), errorCode: "SCHEMA_REFRESH_FAILED" };
    }
    var fieldMeta = { field_id: fid, entity: ent, label: label, type: type, editable: editable, required: required, isCore: isCore, isLink: isLink, options: options };
    var entityFieldIds = [];
    try {
      var headerRow = entSheet.getRange(1, 1, 1, entSheet.getLastColumn()).getValues()[0] || [];
      entityFieldIds = headerRow.map(function (v) { return String(v || "").trim(); }).filter(function (x) { return _isFid_(x); });
    } catch (_) { }
    return {
      ok: true, fieldId: fid, entity: ent, schemaSig: schemaSig, schemaRefreshed: schemaRefreshed, fieldMeta: fieldMeta, didApplyField: true,
      fieldsRowIndex: rowIndex, entityHeaderCol: (applyInfo && applyInfo.col) ? applyInfo.col : null, fieldsSheetName: sh.getName(), entitySheetName: entSheet ? entSheet.getName() : '', spreadsheetId: ssId, updatedAt: new Date().toISOString(), fieldIds: entityFieldIds, errorCode: null, message: "ok"
    };
  } catch (e) {
    var sid = ''; try { sid = SpreadsheetApp.getActiveSpreadsheet().getId(); } catch (_) { sid = ''; }
    return { ok: false, error: String(e && e.message || e), errorCode: "FIELDS_ADD_ERROR", spreadsheetId: sid };
  } finally {
    try { lock.releaseLock(); } catch (_) { }
  }
}

function sv_fieldsSoftDelete_v1(payload) {
  payload = payload || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: "lock_timeout" };
  try {
    var fid = String(payload.fieldId || "").trim();
    if (!_isFid_(fid)) return { ok: false, error: "invalid field id" };
    var info = _fieldsHeaderIndex_();
    var sh = info.sh;
    var cols = info.cols;
    if (cols.field_id == null) return { ok: false, error: "fields header missing field_id" };
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: false, error: "no fields rows" };
    var colVals = sh.getRange(2, cols.field_id + 1, lastRow - 1, 1).getValues();
    var rowIndex = -1;
    for (var i = 0; i < colVals.length; i++) {
      if (String(colVals[i][0] || "").trim() === fid) { rowIndex = i + 2; break; }
    }
    if (rowIndex < 0) return { ok: false, error: "field id not found" };
    if (cols.isCore != null) {
      var coreVal = sh.getRange(rowIndex, cols.isCore + 1).getValue();
      if (_normBool_(coreVal)) return { ok: false, error: "core fields cannot be deleted" };
    }
    var lastCol = info.lastCol;
    if (cols.active == null) { sh.getRange(1, lastCol + 1).setValue("active"); cols.active = lastCol; lastCol += 1; }
    sh.getRange(rowIndex, cols.active + 1).setValue("FALSE");
    if (cols.editable != null) sh.getRange(rowIndex, cols.editable + 1).setValue("FALSE");
    var schemaSig = _buildFieldsSchemaSig_();
    return { ok: true, fieldId: fid, schemaSig: schemaSig };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally {
    try { lock.releaseLock(); } catch (_) { }
  }
}

function _buildFieldsSchemaSig_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return "";
    var fieldsSh = ss.getSheetByName("Fields");
    if (!fieldsSh) return "";
    var lastCol = fieldsSh.getLastColumn();
    var headerRow = lastCol ? fieldsSh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var header = headerRow.map(function (x) { return x != null ? String(x).trim() : ""; });
    var rows = _readFields_();
    var rowTokens = rows.map(function (r) {
      var ent = String(r.entity || "").trim().toLowerCase();
      var fid = String(r.field_id || "").trim();
      var type = String(r.type || "").trim().toLowerCase();
      var editable = _normBool_(r.editable);
      var required = _normBool_(r.required);
      var isCore = _normBool_(r.isCore);
      return [ent, fid, type, editable ? "1" : "0", required ? "1" : "0", isCore ? "1" : "0"].join("|");
    });
    var entities = ["shot", "asset", "task", "member", "user", "page"];
    var headerByEntity = {};
    for (var i = 0; i < entities.length; i++) {
      var entKey = entities[i];
      var headerInfo = _getEntityHeaderFieldIds_(entKey);
      headerByEntity[entKey] = headerInfo.fieldIds || [];
    }
    var version = "";
    try { version = ScriptApp.getService().getUrl(); } catch (_) { version = ""; }
    var payload = { fieldsHeader: header, fieldsRows: rowTokens, entityHeaders: headerByEntity, version: version };
    return _hubSha1Hex_(JSON.stringify(payload));
  } catch (_) { return ""; }
}

function dp_debugPing() {
  return { ok: true, ts: new Date().toISOString() };
}

function dp_traceOriginals(arg) {
  try {
    var payload = arg || {};
    return {
      ok: true,
      input: payload,
      steps: [],
      finalUrl: "",
      found: false,
      ts: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

function dp_loadAppData() {
  try {
    var linkMaps = typeof sv_getLinkMaps === 'function' ? sv_getLinkMaps() : { assets: {}, shots: {}, tasks: {}, users: {}, members: {} };
    var ftRes = getFieldTypesWithDiag_();
    var fieldTypes = ftRes.types || {};
    var fieldTypesDiag = ftRes.diag || {};
    var schemaSig = _buildFieldsSchemaSig_();
    var meta = typeof _sv_getMeta_ === 'function' ? _sv_getMeta_({}) : {};
    var counts = { assets: Object.keys(linkMaps.assets || {}).length, shots: Object.keys(linkMaps.shots || {}).length, tasks: Object.keys(linkMaps.tasks || {}).length, users: Object.keys(linkMaps.users || {}).length, members: Object.keys(linkMaps.members || {}).length };
    var fieldKeys = Object.keys(fieldTypes).reduce(function (acc, ent) { return acc + Object.keys(fieldTypes[ent] || {}).length; }, 0);
    return {
      linkMaps: linkMaps,
      fieldTypes: fieldTypes,
      fieldTypesDiag: fieldTypesDiag,
      schemaSig: schemaSig,
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

function hubGetSlice(entity, offset, limit, ctx) {
  var e = String(entity || "").trim().toLowerCase();
  var off = Number(offset);
  var lim = Number(limit);
  if (!e) throw new Error("hubGetSlice: entity is required");
  if (!isFinite(off) || off < 0 || Math.floor(off) !== off) throw new Error("hubGetSlice: offset must be an integer >= 0");
  if (!isFinite(lim) || lim <= 0 || Math.floor(lim) !== lim) throw new Error("hubGetSlice: limit must be an integer > 0");
  var ss = _getActiveSpreadsheetFromCtx_(ctx);
  if (!ss) throw new Error("hubGetSlice: no active spreadsheet (bound script expected)");
  var schema = _hubEnsureSchema_(ss, e);
  var hub = ss.getSheetByName("DataHub_Core");
  if (!hub) throw new Error("hubGetSlice: sheet 'DataHub_Core' not found");
  var startRow = 3 + off;
  var maxRows = hub.getMaxRows();
  if (startRow > maxRows) return [];
  var safeLimit = Math.min(lim, maxRows - startRow + 1);
  if (safeLimit <= 0) return [];
  var tReadStart = Date.now();
  var values = hub.getRange(startRow, schema.startCol, safeLimit, schema.fieldCount).getValues();
  _addTiming_(ctx, 'readDataHub_ms', Date.now() - tReadStart);
  return values;
}

function hubGetSchema(entity, ctx) {
  var e = String(entity || "").trim().toLowerCase();
  if (!e) throw new Error("hubGetSchema: entity is required");
  var ss = _getActiveSpreadsheetFromCtx_(ctx);
  if (!ss) throw new Error("hubGetSchema: no active spreadsheet (bound script expected)");
  var schema = _hubEnsureSchema_(ss, e);
  if (schema && (schema.colCount == null)) schema.colCount = schema.fieldCount;
  return schema;
}

function hubRefreshSchema(entityOpt) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("hubRefreshSchema: no active spreadsheet (bound script expected)");
  var entities = _hubEntityList_();
  if (entityOpt) {
    var one = String(entityOpt).trim().toLowerCase();
    if (entities.indexOf(one) < 0) throw new Error("hubRefreshSchema: unsupported entity: " + one);
    entities = [one];
  }
  var fieldsSh = ss.getSheetByName("Fields");
  if (!fieldsSh) throw new Error("hubRefreshSchema: sheet 'Fields' not found");
  var hub = ss.getSheetByName("DataHub_Core");
  if (!hub) throw new Error("hubRefreshSchema: sheet 'DataHub_Core' not found");
  var cache = _hubGetOrInitCache_(ss);
  var header = _hubReadHeaderRow_(hub);
  var colByFid = {};
  for (var c = 0; c < header.length; c++) {
    var fid = header[c];
    if (fid) colByFid[String(fid).trim()] = c + 1;
  }
  var expectedByEntity = _hubReadExpectedCoreFieldIds_(fieldsSh);
  var nowIso = new Date().toISOString();
  var existing = _hubReadCacheIndex_(cache);
  entities.forEach(function (e) {
    var expected = expectedByEntity[e] || [];
    if (!expected.length) {
      _hubUpsertCacheRow_(cache, existing, e, 0, 0, "", nowIso, _hubSha1Hex_(""));
      return;
    }
    var startCol = colByFid[expected[0]];
    if (!startCol) {
      throw new Error("hubRefreshSchema: header mismatch. Missing first field_id in DataHub_Core row1: " + expected[0] + " (entity=" + e + ")");
    }
    for (var i = 0; i < expected.length; i++) {
      var fid = expected[i];
      var col = colByFid[fid];
      if (!col) throw new Error("hubRefreshSchema: header mismatch. Missing field_id in DataHub_Core row1: " + fid + " (entity=" + e + ")");
      if (col !== startCol + i) {
        throw new Error("hubRefreshSchema: header mismatch. Non-contiguous or reordered field_ids for entity=" + e + ". expected fid=" + fid + " at col=" + (startCol + i) + " but found col=" + col);
      }
    }
    var csv = expected.join(",");
    var hash = _hubSha1Hex_(csv);
    _hubUpsertCacheRow_(cache, existing, e, startCol, expected.length, csv, nowIso, hash);
  });
  return true;
}

function hubRefreshAllSchemas() {
  var entities = ["shot", "asset", "task", "member", "user"];
  var results = [];
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    try {
      var r = hubRefreshSchema(e);
      results.push({ entity: e, ok: true, result: r });
    } catch (err) {
      results.push({ entity: e, ok: false, error: String(err), stack: err && err.stack ? String(err.stack) : "" });
    }
  }
  var allOk = true;
  for (var j = 0; j < results.length; j++) if (!results[j].ok) allOk = false;
  return { ok: allOk, results: results, at: new Date().toISOString() };
}

function dp_diag_hubSchemaCache_v1() {
  var ss = SpreadsheetApp.getActive();
  var core = ss.getSheetByName("DataHub_Core");
  if (!core) return { ok: false, error: "DataHub_Core sheet not found" };
  var lastCol = core.getLastColumn();
  var header = core.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var entities = ["shot", "asset", "task", "member", "user"];
  var checks = [];
  var mismatches = [];
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    try {
      var schema = hubGetSchema(e);
      var start0 = (schema.startCol || 1) - 1;
      var end0 = start0 + (schema.colCount || 0);
      var headerSlice = header.slice(start0, end0);
      var same = JSON.stringify(headerSlice) === JSON.stringify(schema.fieldIds || []);
      var item = { entity: e, ok: !!same, startCol: schema.startCol, colCount: schema.colCount, fieldIdsFromCache: schema.fieldIds || [], fieldIdsFromHeader: headerSlice };
      checks.push(item);
      if (!same) mismatches.push(item);
    } catch (err) {
      var bad = { entity: e, ok: false, error: String(err), stack: err && err.stack ? String(err.stack) : "" };
      checks.push(bad);
      mismatches.push(bad);
    }
  }
  return { ok: mismatches.length === 0, mismatches: mismatches, checks: checks, at: new Date().toISOString() };
}

function test_hubRefreshAndGet() {
  hubRefreshSchema();
  var entities = _hubEntityList_();
  entities.forEach(function (e) {
    try {
      var s = hubGetSchema(e);
      var rows = hubGetSlice(e, 0, 1);
      var r = rows.length;
      var c = r ? rows[0].length : 0;
    } catch (err) { }
  });
}

function _hubEntityList_() { return ["shot", "asset", "task", "member", "user"]; }

function _hubEnsureSchema_(ss, entity) {
  var cache = _hubGetOrInitCache_(ss);
  var schema = _hubReadSchemaFromCache_(cache, entity);
  var fieldsSh = ss.getSheetByName("Fields");
  if (!fieldsSh) throw new Error("_hubEnsureSchema_: sheet 'Fields' not found");
  var expectedByEntity = _hubReadExpectedCoreFieldIds_(fieldsSh);
  var expected = expectedByEntity[entity] || [];
  var expectedCsv = expected.join(",");
  var expectedHash = _hubSha1Hex_(expectedCsv);
  var needsRefresh = false;
  var refreshReason = "";
  if (!schema || schema.schemaHash !== expectedHash) {
    needsRefresh = true;
    refreshReason = schema ? "hash-mismatch" : "missing-cache";
  } else if (expected.length) {
    var hub = ss.getSheetByName("DataHub_Core");
    if (!hub) throw new Error("_hubEnsureSchema_: sheet 'DataHub_Core' not found");
    var header = _hubReadHeaderRow_(hub);
    var colByFid = {};
    for (var c = 0; c < header.length; c++) {
      var fid = header[c];
      if (fid) colByFid[String(fid).trim()] = c + 1;
    }
    var expectedStartCol = colByFid[expected[0]] || 0;
    var layoutOk = true;
    if (!expectedStartCol) layoutOk = false;
    if (schema.startCol !== expectedStartCol) layoutOk = false;
    if (schema.fieldCount !== expected.length) layoutOk = false;
    if (expectedStartCol) {
      var slice = header.slice(expectedStartCol - 1, expectedStartCol - 1 + expected.length);
      if (slice.length !== expected.length) layoutOk = false;
      for (var i = 0; i < expected.length && layoutOk; i++) {
        if (String(slice[i] || "").trim() !== String(expected[i] || "").trim()) layoutOk = false;
      }
    }
    if (!layoutOk) {
      needsRefresh = true;
      refreshReason = "layout-mismatch";
    }
  }
  if (needsRefresh) {
    hubRefreshSchema(entity);
    schema = _hubReadSchemaFromCache_(cache, entity);
    if (schema) {
      schema._refreshed = true;
      schema._refreshReason = refreshReason;
    }
  }
  if (!schema) throw new Error("_hubEnsureSchema_: schema not found after refresh (entity=" + entity + ")");
  if (!expected.length) {
    if (schema && (schema.colCount == null)) schema.colCount = schema.fieldCount;
    return schema;
  }
  if (schema.schemaHash !== expectedHash) {
    throw new Error("_hubEnsureSchema_: schema hash mismatch after refresh (entity=" + entity + ")");
  }
  if (schema.fieldCount !== expected.length) {
    throw new Error("_hubEnsureSchema_: fieldCount mismatch after refresh (entity=" + entity + ")");
  }
  if (schema && (schema.colCount == null)) schema.colCount = schema.fieldCount;
  return schema;
}

function _hubGetOrInitCache_(ss) {
  var sh = ss.getSheetByName("Cache") || ss.getSheetByName("DataHub_Core cache");
  if (!sh) throw new Error("Cache sheet not found. Expected sheet name: 'Cache'");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 6).setValues([["Entity", "StartCol", "FieldCount", "FieldIds", "UpdatedAt", "SchemaHash"]]);
  } else {
    var h = sh.getRange(1, 1, 1, 6).getValues()[0];
    if (String(h[0] || "").trim().toLowerCase() !== "entity") {
      sh.getRange(1, 1, 1, 6).setValues([["Entity", "StartCol", "FieldCount", "FieldIds", "UpdatedAt", "SchemaHash"]]);
    }
  }
  return sh;
}

function _hubReadCacheIndex_(cacheSh) {
  var lastRow = cacheSh.getLastRow();
  var idx = {};
  if (lastRow < 2) return idx;
  var vals = cacheSh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    var e = String(vals[i][0] || "").trim().toLowerCase();
    if (e) idx[e] = i + 2;
  }
  return idx;
}

function _hubUpsertCacheRow_(cacheSh, indexMap, entity, startCol, fieldCount, fieldIdsCsv, updatedAtIso, schemaHash) {
  var row = indexMap[entity];
  if (!row) {
    row = cacheSh.getLastRow() + 1;
    indexMap[entity] = row;
  }
  cacheSh.getRange(row, 1, 1, 6).setValues([[entity, startCol, fieldCount, fieldIdsCsv, updatedAtIso, schemaHash]]);
}

function _hubReadSchemaFromCache_(cacheSh, entity) {
  var idx = _hubReadCacheIndex_(cacheSh);
  var row = idx[entity];
  if (!row) return null;
  var v = cacheSh.getRange(row, 1, 1, 6).getValues()[0];
  var csv = String(v[3] || "");
  var fieldIds = csv ? csv.split(",").map(function (s) { return String(s).trim(); }).filter(Boolean) : [];
  return {
    entity: String(v[0] || "").trim().toLowerCase(),
    startCol: Number(v[1]) || 0,
    fieldCount: Number(v[2]) || 0,
    colCount: Number(v[2]) || 0,
    fieldIds: fieldIds,
    updatedAt: String(v[4] || ""),
    schemaHash: String(v[5] || "")
  };
}

function _hubReadHeaderRow_(hubSh) {
  var lastCol = hubSh.getLastColumn();
  if (lastCol < 1) return [];
  var row = hubSh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < row.length; i++) {
    row[i] = row[i] ? String(row[i]).trim() : "";
  }
  return row;
}

function _hubReadDisplayRow_(hubSheet) {
  var lastCol = hubSheet.getLastColumn();
  if (!lastCol) return [];
  var row2 = hubSheet.getRange(2, 1, 1, lastCol).getValues()[0] || [];
  return row2.map(function (x) { return x ? String(x).trim() : ""; });
}

function hubGetDisplayNames(entity, schemaOpt, ctx) {
  var ss = _getActiveSpreadsheetFromCtx_(ctx);
  var hub = ss.getSheetByName("DataHub_Core");
  if (!hub) throw new Error("hubGetDisplayNames: sheet 'DataHub_Core' not found");
  var schema = schemaOpt || hubGetSchema(entity, ctx);
  if (!schema || !schema.startCol || !schema.fieldCount) return [];
  var tReadStart = Date.now();
  var row2 = hub.getRange(2, schema.startCol, 1, schema.fieldCount).getValues()[0] || [];
  _addTiming_(ctx, 'readDataHub_ms', Date.now() - tReadStart);
  return row2.map(function (x) { return x ? String(x).trim() : ""; });
}

function _hubReadExpectedCoreFieldIds_(fieldsSh) {
  if (!fieldsSh) return {};
  var rows = _readFields_();
  var out = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || {};
    var entRaw = String(r.entity || "").trim();
    if (!entRaw) continue;
    var entKey = _normalizeEntityParams_({ entity: entRaw }).entity;
    var fid = String(r.field_id || "").trim();
    if (!fid) continue;
    if (!_normBool_(r.isCore)) continue;
    if (!out[entKey]) out[entKey] = [];
    out[entKey].push(fid);
  }
  return out;
}

function _hubSha1Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, s, Utilities.Charset.UTF_8);
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var v = (bytes[i] + 256) % 256;
    hex.push((v < 16 ? "0" : "") + v.toString(16));
  }
  return hex.join("");
}

function _sv_listRowsPageHub_(payload, ctx) {
  payload = payload || {};
  var t0 = Date.now();
  var tSchemaStart = t0;
  var ent = payload.sheetName || payload.entity || payload.e || payload.entityName || "";
  var p = _normalizeEntityParams_(ent, payload);
  var ss = _getActiveSpreadsheetFromCtx_(ctx);
  // FIX: p.sheetName was undefined because _normalizeEntityParams_ returns p.sheet
  var sheet = ss ? ss.getSheetByName(p.sheet) : null;
  if (!sheet) {
    var names = ss ? ss.getSheets().map(function (s) { return s.getName(); }) : [];
    throw new Error("Missing entity sheet: " + p.sheet + " (entity=" + p.entity + "). Available: " + names.join(", "));
  }
  var schema = hubGetSchema(p.entity, ctx);
  var tSchemaDone = Date.now();
  var fieldIds = Array.isArray(schema && schema.fieldIds) ? schema.fieldIds : [];
  var displayNames = hubGetDisplayNames(p.entity, schema, ctx);
  var requested = [];
  if (Array.isArray(payload.requestedFields)) requested = payload.requestedFields;
  else if (Array.isArray(payload.fieldIds)) requested = payload.fieldIds;
  else if (Array.isArray(payload.fields)) requested = payload.fields;
  requested = requested.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  var missingFieldIds = requested.filter(function (fid) { return fieldIds.indexOf(fid) < 0; });
  var tRowsStart = Date.now();
  function hasNonEmptyFilters_(fgs) {
    if (!Array.isArray(fgs)) return false;
    for (var i = 0; i < fgs.length; i++) {
      var g = fgs[i] || {};
      var rules = Array.isArray(g.rules) ? g.rules : [];
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j] || {};
        if (!r.id || !r.op) continue;
        if (r.op === "isempty" || r.op === "isnotempty") return true;
        if (Array.isArray(r.values) && r.values.length) return true;
        if (Object.prototype.hasOwnProperty.call(r, "value")) {
          if (r.value === 0 || r.value === false) return true;
          if (r.value != null && String(r.value).trim().length) return true;
        }
      }
    }
    return false;
  }
  var hasSort = Array.isArray(payload.sort) && payload.sort.some(function (s) { return s && String(s.id || '').trim(); });
  var hasFilters = hasNonEmptyFilters_(payload.filterGroups);
  if (hasSort || hasFilters) {
    var corePayload = Object.assign({}, payload, {
      entity: p.entity,
      sheet: p.sheet,
      sheetName: p.sheet,
      offset: p.offset,
      limit: p.limit,
      filterGroups: Array.isArray(payload.filterGroups) ? payload.filterGroups : [],
      groupCombine: (payload.groupCombine === 'any') ? 'any' : 'all',
      sort: Array.isArray(payload.sort) ? payload.sort : [],
      requestedFields: requested.slice()
    });
    var missingSortIds = [];
    if (hasSort && fieldIds && fieldIds.length) {
      for (var si = 0; si < corePayload.sort.length; si++) {
        var sid = String(corePayload.sort[si] && corePayload.sort[si].id || "").trim();
        if (sid && fieldIds.indexOf(sid) < 0) missingSortIds.push(sid);
      }
    }
    var coreRes = _listRowsPageCore_(corePayload, ctx) || {};
    coreRes.mode = "hub";
    coreRes.modeReason = hasSort ? "hub-sort" : "hub-filter";
    coreRes.source = "hub";
    coreRes.dataSourceUsed = coreRes.dataSourceUsed || "hub";
    coreRes.diag = coreRes.diag || {};
    coreRes.diag.mode = coreRes.mode;
    coreRes.diag.modeReason = coreRes.modeReason;
    coreRes.diag.dataSourceUsed = coreRes.dataSourceUsed;
    coreRes.diag.listRowsFn = "_sv_listRowsPageHub_:core";
    coreRes.diag.sortRequestedCount = Array.isArray(corePayload.sort) ? corePayload.sort.length : 0;
    if (missingSortIds.length) coreRes.diag.sortBlockedReason = "missing-field";
    coreRes.diag.missingSortFieldIds = missingSortIds;
    if (Array.isArray(coreRes.presentFieldIds)) coreRes.diag.presentFieldIds = coreRes.presentFieldIds;
    coreRes.diag.requestedFieldIds = requested.slice();
    if (coreRes.meta && coreRes.meta.fieldIdsHash) coreRes.diag.fieldIdsHash = coreRes.meta.fieldIdsHash;
    return coreRes;
  }
  var rows = hubGetSlice(p.entity, p.offset, p.limit, ctx);
  if (!Array.isArray(rows)) rows = [];
  var tRowsDone = Date.now();
  var tTotalStart = Date.now();
  var total = _hubGetTotalFromEntitySheet_(p.sheet, ctx);
  var tTotalDone = Date.now();
  var needsRefresh = false;
  if (total > 0) {
    if (!rows.length) {
      needsRefresh = true;
    } else {
      var map = _idAndLabelCols_(p.entity, fieldIds);
      var idName = map && map.idName ? String(map.idName) : "";
      var idIdx = idName ? fieldIds.indexOf(idName) : -1;
      if (idIdx < 0) idIdx = 0;
      var idVal = "";
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (!row || !row.length) continue;
        var rowHasAny = row.some(function (v) { return String(v || "").trim(); });
        if (!rowHasAny) continue;
        idVal = row[idIdx];
        break;
      }
      if (!String(idVal || "").trim()) needsRefresh = true;
    }
  }
  if (needsRefresh) {
    try { hubRefreshSchema(p.entity); } catch (err) { throw new Error("hubRefreshSchema failed after empty slice (entity=" + p.entity + "): " + String(err)); }
    schema = hubGetSchema(p.entity);
    fieldIds = Array.isArray(schema && schema.fieldIds) ? schema.fieldIds : [];
    displayNames = hubGetDisplayNames(p.entity, schema);
    rows = hubGetSlice(p.entity, p.offset, p.limit);
    if (!Array.isArray(rows)) rows = [];
    tRowsDone = Date.now();
    missingFieldIds = requested.filter(function (fid) { return fieldIds.indexOf(fid) < 0; });
  }
  var tFieldsStart = Date.now();
  var ftypes = getFieldTypes(p.entity);
  var byId = (ftypes && ftypes[p.entity]) ? ftypes[p.entity] : {};
  var columns = fieldIds.map(function (fid, i) {
    fid = String(fid || "");
    var m = byId[fid] || {};
    var dn = (displayNames && displayNames[i]) ? displayNames[i] : "";
    return {
      id: fid,
      fieldId: fid,
      fid: fid,
      label: (dn || m.label || fid),
      type: (m.type || "text"),
      editable: !!m.editable
    };
  });

  // When client requested a specific field order, reindex ids/rows/header/columns to that order to avoid hash mismatch.
  if (requested.length) {
    var headerFromCols = columns.map(function (c) { return c.label || c.name || c.id || c.fid || ""; });
    var reindexed = _reindexRowsToRequested_(fieldIds, headerFromCols, rows, requested);
    fieldIds = reindexed.ids;
    rows = reindexed.rows;
    headerFromCols = reindexed.header;
    var colByFid = {};
    for (var ci = 0; ci < columns.length; ci++) {
      var cc = columns[ci] || {};
      var cfid = String(cc.fid || cc.id || "").trim();
      if (cfid && !colByFid[cfid]) colByFid[cfid] = cc;
    }
    columns = fieldIds.map(function (fidReq, idx) {
      var col = colByFid[fidReq] ? Object.assign({}, colByFid[fidReq]) : { id: fidReq, fid: fidReq, label: fidReq };
      if (!col.label) col.label = headerFromCols[idx] || fidReq;
      if (!col.name) col.name = col.label;
      return col;
    });
  }

  var tFieldsDone = Date.now();
  var schemaRefreshed = !!(schema && schema._refreshed);
  var schemaRefreshReason = (schema && schema._refreshReason) ? String(schema._refreshReason) : "";
  var tEnd = Date.now();
  var timing = {
    total_ms: tEnd - t0,
    schema_ms: tSchemaDone - tSchemaStart,
    rows_ms: tRowsDone - tRowsStart,
    total_count_ms: tTotalDone - tTotalStart,
    field_select_ms: tFieldsDone - tFieldsStart,
    link_maps_ms: 0,
    payload_ms: tEnd - tFieldsDone,
    openSpreadsheet_ms: (ctx && ctx.openSpreadsheet_ms) || 0,
    readDataHub_ms: (ctx && ctx.timing && ctx.timing.readDataHub_ms) || 0,
    readEntitySheet_ms: (ctx && ctx.timing && ctx.timing.readEntitySheet_ms) || 0,
    buildRows_ms: tEnd - tFieldsStart,
    applyFilters_ms: 0,
    applySort_ms: 0,
    buildLinkMaps_ms: 0,
    cacheGet_ms: 0,
    cacheSet_ms: 0,
    stringify_ms: 0
  };
  return {
    ok: true,
    source: "hub",
    sourceReason: "plain-paging",
    entity: p.entity,
    sheetName: p.sheet, // fix return val too
    offset: p.offset,
    limit: p.limit,
    page: p.page,
    total: total,
    ids: fieldIds.slice(),
    rows: rows,
    columns: columns,
    header: columns.map(function (c) { return c.label; }),
    presentFieldIds: fieldIds.slice(),
    missingFieldIds: missingFieldIds.slice(),
    dataSourceUsed: "hub",
    diag: {
      entity: p.entity,
      sheetName: p.sheet,
      pageId: payload.pageId || '',
      requestedFieldIds: requested.slice(),
      presentFieldIds: fieldIds.slice(),
      missingFieldIds: missingFieldIds.slice(),
      missingCount: missingFieldIds.length,
      dataSourceUsed: "hub",
      schemaRefreshed: schemaRefreshed,
      schemaRefreshReason: schemaRefreshReason,
      timing: timing,
      fieldIdsHash: requested.length ? requested.join("|") : fieldIds.join("|")
    },
    schemaHash: schema && schema.schemaHash ? String(schema.schemaHash) : "",
    meta: {
      fieldIdsHash: (requested.length ? requested.join("|") : fieldIds).join("|"),
      schemaHash: schema && schema.schemaHash ? String(schema.schemaHash) : "",
      colsKey: fieldIds.join("|")
    },
    schemaUpdatedAt: schema && schema.updatedAt ? String(schema.updatedAt) : "",
    schemaRefreshed: schemaRefreshed,
    schemaRefreshReason: schemaRefreshReason
  };
}

function _hubGetTotalFromEntitySheet_(sheetName, ctx) {
  try {
    var ss = _getActiveSpreadsheetFromCtx_(ctx);
    if (!ss) return 0;
    var sh = ss.getSheetByName(sheetName);
    if (!sh) {
      // Case-insensitive match
      var target = String(sheetName || "").toLowerCase();
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        var nm = String(sheets[i].getName() || "");
        if (nm.toLowerCase() === target) { sh = sheets[i]; break; }
      }
      // Simple plural/singular fallback if still missing
      if (!sh) {
        var fallback = (target === "shot") ? "shots" :
          (target === "asset") ? "assets" :
          (target === "task") ? "tasks" :
          (target === "member") ? "projectmembers" :
          (target === "user") ? "users" : "";
        if (fallback) {
          for (var j = 0; j < sheets.length; j++) {
            var nm2 = String(sheets[j].getName() || "");
            if (nm2.toLowerCase() === fallback) { sh = sheets[j]; break; }
          }
        }
      }
      if (!sh) return 0;
    }
    var tReadStart = Date.now();
    var last = sh.getLastRow();
    _addTiming_(ctx, 'readEntitySheet_ms', Date.now() - tReadStart);
    return Math.max(0, Number(last || 0) - 2);
  } catch (e) { return 0; }
}

function sv_listRowsPage_v3(payload) {
  payload = payload || {};
  var t0 = Date.now();
  var ctx = { timing: {}, openSpreadsheet_ms: 0, openSpreadsheet_calls: 0 };
  var modeInfo = _tablePickDataMode_(payload);
  var mode = (modeInfo && modeInfo.mode) ? modeInfo.mode : modeInfo;
  var modeReason = (modeInfo && modeInfo.reason) ? modeInfo.reason : "";
  if (mode === "legacy" && !modeReason) {
    modeReason = (payload.pageId || payload.pid) ? "legacy-default" : "missing-pageId";
  }
  var requestedDataSource = String((payload.requestedDataSource || payload.dataSource || payload.dataSourcePreferred || payload.dataSourceHint || "") || "");
  var entRaw = payload.sheetName || payload.entity || payload.e || payload.entityName || "";
  var norm = _normalizeEntityParams_(entRaw, payload);

  function buildListRowsDiag_(res) {
    var timing = (res && res.diag && res.diag.timing) ? res.diag.timing : (ctx && ctx.timing ? ctx.timing : {});
    var totalMs = (timing && typeof timing.total_ms === "number") ? timing.total_ms : (Date.now() - t0);
    var missing = (res && res.diag && Array.isArray(res.diag.missingFieldIds)) ? res.diag.missingFieldIds : [];
    var requestedCount = (res && res.diag && Array.isArray(res.diag.requestedFieldIds)) ? res.diag.requestedFieldIds.length : 0;
    var diag = res && res.diag ? res.diag : {};
    var dataSourceUsed = String(diag.dataSourceUsed || res.dataSourceUsed || res.source || "");
    var modeValue = String(res.mode || diag.mode || mode || "");
    if (!modeValue) {
      modeValue = (String(dataSourceUsed || "").toLowerCase() === "legacy") ? "legacy" : mode;
    }
    var modeReasonValue = String(res.modeReason || diag.modeReason || modeReason || (modeValue === "legacy" ? "legacy-default" : ""));
    return {
      requestedDataSource: requestedDataSource,
      selectedDataSource: dataSourceUsed,
      mode: modeValue || (mode === "legacy" ? "legacy" : "hub"),
      modeReason: modeReasonValue,
      requestedFieldsCount: requestedCount,
      missingFieldIds: missing,
      driveCalls: 0,
      openSpreadsheet_calls: Number(ctx && ctx.openSpreadsheet_calls) || 0,
      source: dataSourceUsed,
      server_total_ms: Number(totalMs || 0),
      timings: {
        openSpreadsheet_ms: Number(ctx && ctx.openSpreadsheet_ms) || 0,
        readDataHub_ms: Number(timing.readDataHub_ms || 0),
        readEntitySheet_ms: Number(timing.readEntitySheet_ms || 0),
        buildRows_ms: Number(timing.buildRows_ms || timing.field_select_ms || 0),
        applyFilters_ms: Number(timing.applyFilters_ms || timing.filter_ms || 0),
        applySort_ms: Number(timing.applySort_ms || timing.sort_ms || 0),
        buildLinkMaps_ms: Number(timing.buildLinkMaps_ms || 0),
        cacheGet_ms: Number(timing.cacheGet_ms || 0),
        cacheSet_ms: Number(timing.cacheSet_ms || 0),
        stringify_ms: Number(timing.stringify_ms || 0),
        total_ms: Number(totalMs || 0)
      }
    };
  }

  try {
    __MOTK_REQ_SS__ = _getActiveSpreadsheetFromCtx_(ctx);
    if (mode === "hub") {
      var hubRes = _sv_listRowsPageHub_(payload, ctx) || {};
      hubRes.entityNormalized = norm.entity;
      hubRes.diag = hubRes.diag || {};
      hubRes.diag.mode = mode;
      hubRes.diag.modeReason = modeReason;
      if (!hubRes.diag.timing) hubRes.diag.timing = {};
      if (typeof hubRes.diag.timing.total_ms !== "number") {
        hubRes.diag.timing.total_ms = Date.now() - t0;
      }
      hubRes.diag.source = hubRes.dataSourceUsed || hubRes.diag.dataSourceUsed || "";
      hubRes.diag.server_total_ms = Number(hubRes.diag.timing.total_ms || (Date.now() - t0));
      hubRes.mode = mode;
      hubRes.source = mode;
      if (!hubRes.dataSourceUsed || String(hubRes.dataSourceUsed).toLowerCase().indexOf("hub") === 0) {
        hubRes.dataSourceUsed = "DataHub";
      }
      if (hubRes.diag && hubRes.diag.missingCount > 0 && payload.allowPartialHub !== true) {
        var legacyRes = _sv_listRowsPageLegacyFromPayload_(payload, ctx) || {};
        legacyRes.entityNormalized = norm.entity;
        legacyRes.diag = legacyRes.diag || {};
        legacyRes.diag.entity = norm.entity;
        legacyRes.diag.pageId = payload.pageId || payload.pid || '';
        legacyRes.diag.requestedFieldIds = hubRes.diag.requestedFieldIds || [];
        legacyRes.diag.presentFieldIds = Array.isArray(legacyRes.ids) ? legacyRes.ids.slice() : (Array.isArray(legacyRes.columns) ? legacyRes.columns.map(function (c) { return c && (c.fid || c.fieldId || c.id); }) : []);
        legacyRes.diag.missingFieldIds = hubRes.diag.missingFieldIds || [];
        legacyRes.diag.missingCount = hubRes.diag.missingCount || 0;
        legacyRes.diag.dataSourceUsed = "legacy-fallback";
        legacyRes.diag.mode = mode;
        legacyRes.diag.modeReason = "hub-missing-fields";
        legacyRes.diag.listRowsFn = "_sv_listRowsPageLegacyFromPayload_";
        if (!legacyRes.diag.timing) legacyRes.diag.timing = {};
        if (typeof legacyRes.diag.timing.total_ms !== "number") {
          legacyRes.diag.timing.total_ms = Date.now() - t0;
        }
        legacyRes.diag.source = legacyRes.dataSourceUsed || legacyRes.diag.dataSourceUsed || "";
        legacyRes.diag.server_total_ms = Number(legacyRes.diag.timing.total_ms || (Date.now() - t0));
        legacyRes.diag.listRows = buildListRowsDiag_(legacyRes);
        legacyRes.presentFieldIds = legacyRes.diag.presentFieldIds;
        legacyRes.missingFieldIds = legacyRes.diag.missingFieldIds;
        legacyRes.dataSourceUsed = legacyRes.diag.dataSourceUsed;
        legacyRes.mode = "legacy";
        legacyRes.modeReason = legacyRes.diag.modeReason || legacyRes.modeReason || modeReason || "";
        legacyRes.dataSourceUsed = legacyRes.dataSourceUsed || legacyRes.diag.dataSourceUsed || "";
        legacyRes.source = "legacy";
        return legacyRes;
      }
      if (hubRes.diag && hubRes.diag.missingCount > 0 && payload.allowPartialHub === true) {
        hubRes.diag.dataSourceUsed = "DataHub";
        hubRes.dataSourceUsed = "DataHub";
      }
      hubRes.diag.listRowsFn = "_sv_listRowsPageHub_";
      hubRes.diag.listRows = buildListRowsDiag_(hubRes);
      hubRes.mode = mode;
      hubRes.modeReason = hubRes.diag.modeReason || modeReason || "";
      hubRes.dataSourceUsed = hubRes.dataSourceUsed || hubRes.diag.dataSourceUsed || "DataHub";
      return hubRes;
    }
    var legacy = _sv_listRowsPageLegacyFromPayload_(payload, ctx) || {};
    legacy.entityNormalized = norm.entity;
    legacy.diag = legacy.diag || {};
    legacy.diag.entity = norm.entity;
    legacy.diag.pageId = payload.pageId || payload.pid || '';
    legacy.diag.dataSourceUsed = "legacy";
    legacy.diag.mode = "legacy";
    legacy.diag.modeReason = legacy.diag.modeReason || legacy.modeReason || modeReason;
    legacy.diag.listRowsFn = "_sv_listRowsPageLegacyFromPayload_";
    if (!legacy.diag.timing) legacy.diag.timing = {};
    if (typeof legacy.diag.timing.total_ms !== "number") {
      legacy.diag.timing.total_ms = Date.now() - t0;
    }
    legacy.diag.source = legacy.dataSourceUsed || legacy.diag.dataSourceUsed || "";
    legacy.diag.server_total_ms = Number(legacy.diag.timing.total_ms || (Date.now() - t0));
    legacy.diag.listRows = buildListRowsDiag_(legacy);
    legacy.diag.presentFieldIds = Array.isArray(legacy.ids) ? legacy.ids.slice() : (Array.isArray(legacy.columns) ? legacy.columns.map(function (c) { return c && (c.fid || c.fieldId || c.id); }) : []);
    legacy.diag.missingFieldIds = [];
    legacy.diag.missingCount = 0;
    legacy.presentFieldIds = legacy.diag.presentFieldIds;
    legacy.missingFieldIds = legacy.diag.missingFieldIds;
    legacy.dataSourceUsed = legacy.diag.dataSourceUsed || "legacy";
    legacy.mode = "legacy";
    legacy.modeReason = legacy.diag.modeReason || legacy.modeReason || modeReason || "";
    legacy.source = "legacy";
    return legacy;
  } finally {
    __MOTK_REQ_SS__ = null;
  }
}

function sv_getRecord_v2(entity, id) {
  if (!entity || !id) { return { ok: true, note: "sv_getRecord_v2 present", ts: new Date().toISOString() }; }
  return dp_getEntityRecord(entity, id);
}
function sv_getRecord(entity, id) { return sv_getRecord_v2(entity, id); }
function sv_setRecord_v2(entity, id, patch, options) {
  if (!entity || !id || !patch) { return { ok: true, note: "sv_setRecord_v2 present", ts: new Date().toISOString() }; }
  try {
    if (patch && typeof patch === "object") {
      Object.keys(patch).forEach(function (k) {
        var v = patch[k];
        if (v instanceof Date) { patch[k] = isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10); }
        else if (typeof v === "string") { patch[k] = v.trim(); }
      });
    }
    var res = dp_updateEntityRecord(entity, id, patch, options);
    if (res && typeof res === "object") {
      res.ok = (res.ok === true);
      if (!res.errorCode && res.ok === false && res.error) res.errorCode = "INLINE_EDIT_FAILED";
    }
    return res;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), errorCode: "INLINE_EDIT_EXCEPTION" };
  }
}
function sv_setRecord(entity, id, patch, options) { return sv_setRecord_v2(entity, id, patch, options); }

function sv_queryTable_v3(entity, query, sort, offset, limit) {
  try {
    var opts = null;
    if (query && typeof query === "object" && !Array.isArray(query)) { opts = query; }
    else if (typeof query === "string" && query.trim()) { try { opts = JSON.parse(query); } catch (_) { opts = null; } }
    opts = opts || {};
    var ent = entity || opts.entity || opts.sheetName || opts.sheet || opts.entityName || "";
    if (!ent) { return { ok: true, note: "sv_queryTable_v3 present", ts: new Date().toISOString(), rows: [], total: 0 }; }
    var per = Number(opts.perPage || limit || 100); if (!isFinite(per) || per < 1) per = 100;
    var page = Number(opts.page || 1); if (!isFinite(page) || page < 1) page = 1;
    var off = (opts.offset != null) ? Number(opts.offset) : Number(offset || 0);
    if (!isFinite(off) || off < 0) off = (page - 1) * per;
    var pid = opts.pid || opts.pageId || "pg_default";
    var filterGroups = Array.isArray(opts.filterGroups) ? opts.filterGroups : [];
    var groupCombine = (opts.groupCombine === "any") ? "any" : "all";
    var requestedFields = Array.isArray(opts.fieldIds) ? opts.fieldIds : (Array.isArray(opts.fields) ? opts.fields : []);
    var payload = { entity: ent, sheetName: ent, pageId: pid, offset: off, limit: per, filterGroups: filterGroups, groupCombine: groupCombine, requestedFields: requestedFields };
    var res = sv_listRowsPage_v3(payload);
    if (res && typeof res === "object") { res.ok = true; res.entity = ent; res.pageId = pid; }
    return res;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), rows: [], total: 0 };
  }
}
function sv_queryTable(entity, query, sort, offset, limit) { return sv_queryTable_v3(entity, query, sort, offset, limit); }

function DB_getOriginalsFolderUrl(arg) { return sv_getOriginalsFolderUrl(arg); }
function DriveBuilder_getOriginalsFolderUrl(arg) { return sv_getOriginalsFolderUrl(arg); }
function DB_getOriginalsUrl(arg) { return sv_getOriginalsUrl(arg); }
function DriveBuilder_getOriginalsUrl(arg) { return sv_getOriginalsUrl(arg); }

function _tablePickDataMode_(payload) {
  if (!payload || typeof payload !== "object") return { mode: "legacy", reason: "invalid-payload" };
  if (payload.forceLegacy === true) return { mode: "legacy", reason: "forceLegacy" };
  if (payload.forceHub === true) return { mode: "hub", reason: "forceHub" };
  function ruleHasValue_(rule) {
    var op = String(rule && rule.op || "").toLowerCase();
    if (op === "isempty" || op === "isnotempty") return true;
    var values = Array.isArray(rule && rule.values) ? rule.values : [];
    if (values.length) return values.some(function (v) { return String(v || "").trim().length > 0; });
    if (rule && Object.prototype.hasOwnProperty.call(rule, "value")) {
      if (rule.value === 0 || rule.value === false) return true;
      if (rule.value == null) return false;
      if (typeof rule.value === "string") return rule.value.trim().length > 0;
      return true;
    }
    return false;
  }
  var hasOrder = !!(payload.orderBy && String(payload.orderBy).trim());
  var hasQuery = !!(payload.query && String(payload.query).trim());
  var hasFilters = false;
  try {
    if (Array.isArray(payload.filters)) { hasFilters = payload.filters.some(function (f) { var id = String(f && f.id || "").trim(); var op = String(f && f.op || "").trim(); if (!(id && op && _isFid_(id))) return false; return ruleHasValue_(f); }); }
    if (!hasFilters && Array.isArray(payload.filterGroups)) { hasFilters = payload.filterGroups.some(function (g) { var rules = Array.isArray(g && g.rules) ? g.rules : []; return rules.some(function (r) { var id = String(r && r.id || "").trim(); var op = String(r && r.op || "").trim(); if (!(id && op && _isFid_(id))) return false; return ruleHasValue_(r); }); }); }
  } catch (_) { hasFilters = false; }
  if (hasOrder) return { mode: "legacy", reason: "orderBy" };
  if (hasQuery) return { mode: "legacy", reason: "query" };
  if (hasFilters) return { mode: "legacy", reason: "filters" };
  return { mode: "hub", reason: "plain-paging" };
}

/* ==========================================================================
 * v3 Fast Boot: BootPack Generator (Merged into DataCore to save file count)
 * ========================================================================== */

/**
 * 指定されたページIDの BootPack を生成し、BootCacheシートに保存する
 * ※ クライアントから直接呼ばれるほか、PageConfig保存時にも呼ばれる想定
 */
function sv_updateBootPackForPage(params) {
  var pageId = params && params.pageId;
  var entity = params && params.entity;

  if (!pageId || !entity) {
    return { ok: false, reason: 'missing-params', pageId: pageId || '', entity: entity || '' };
  }
  
  // 1. PageConfigのロード (表示する列を確定)
  var cfg = sv_loadPageConfig({ pageId: pageId });
  var fieldIds = [];
  if (cfg && cfg.config && Array.isArray(cfg.config.order)) {
    fieldIds = cfg.config.order;
  }
  
  // マニフェストがない（または空）の場合はデフォルト生成を試みる
  if (!fieldIds.length) {
    var fallback = (typeof buildFallbackPageConfigForEntity_ === 'function') 
      ? buildFallbackPageConfigForEntity_(entity) 
      : null;
    if (fallback && fallback.order) fieldIds = fallback.order;
  }

  // 2. Coreデータの取得 (Hub or Sheet)
  // Fast Boot用なので、先頭50〜100件程度に絞る
  var limit = 100; 
  var payload = {
    entity: entity,
    pageId: pageId,
    limit: limit,
    offset: 0,
    requestedFields: fieldIds,
    // ソート/フィルタは "Default" の状態（未指定）でキャッシュする
    // ※ユーザーごとのソート状態などは localStorage (Tier1) が担う
  };

  // 既存の listRowsPage ロジックを再利用してデータを取得
  // ※ v3対応のため DataHubモード推奨だが、自動でLegacyフォールバックもする
  var res = sv_listRowsPage_v3(payload); 
  
  if (!res || !res.ok) {
    return { ok: false, reason: 'rows-fetch-failed', details: res };
  }

  // 3. LinkMapsの取得 (ID解決用)
  // ※ 全量ではなく、今回のCoreデータに含まれるIDに関連するものだけに絞るのが理想だが
  //    一旦は既存の sv_getLinkMaps を使って全量キャッシュする（頻度は低いので許容）
  var linkMaps = {};
  try {
    linkMaps = sv_getLinkMaps(); 
  } catch(e) {
    console.warn('BootPack: linkMaps fetch failed', e);
  }

  // 4. FieldMetaの取得
  var fieldsMeta = {};
  try {
    var allTypes = getFieldTypes(entity);
    var entTypes = allTypes[entity] || {};
    // 表示する列のメタデータだけを抽出
    fieldIds.forEach(function(fid) {
      if (entTypes[fid]) fieldsMeta[fid] = entTypes[fid];
    });
  } catch(e) {
    console.warn('BootPack: fieldsMeta fetch failed', e);
  }

  // 5. BootPack オブジェクトの組み立て
  var bootPack = {
    generatedAt: new Date().toISOString(),
    pageId: pageId,
    entity: entity,
    // G2: 列固定のためのマニフェスト
    manifest: {
      fieldIds: fieldIds,
      columns: res.columns || [], // listRowsPage_v3 が返す正規化された列定義
      hash: _hubSha1Hex_(fieldIds.join(',')) // 変更検知用ハッシュ
    },
    // G1: 枠とCoreデータ
    data: {
      total: res.total,
      rows: res.rows, // Core 100件
      ids: res.ids    // 対応するフィールドID並び
    },
    // 依存リソース
    resources: {
      linkMaps: linkMaps,
      fieldsMeta: fieldsMeta
    }
  };

  // 6. BootCacheシートへ保存 (1SA_CacheHydrator.js の関数を呼び出し)
  // Key: "bp:{entity}:{pageId}"
  var cacheKey = "bp:" + entity + ":" + pageId;
  
  // スキーマ署名やページ署名の計算（キャッシュ無効化用）
  var schemaSig = _buildFieldsSchemaSig_(); // 既存関数
  var pageSig = _hubSha1Hex_(JSON.stringify(fieldIds));

  var saveResult = sv_saveBootPack_v3({
    key: cacheKey,
    kind: 'BOOTPACK',
    entity: entity,
    pageId: pageId,
    schemaSig: schemaSig,
    pageSig: pageSig,
    payload: bootPack
  });

  return { 
    ok: saveResult.ok, 
    key: cacheKey, 
    chunks: saveResult.chunks, 
    itemCount: res.rows.length 
  };
}

/* ===== Scheduler (TAKE152) ===== */
function _sched_findSheetByCandidates_(ss, names) {
  for (var i = 0; i < names.length; i++) {
    var sh = ss.getSheetByName(names[i]);
    if (sh) return sh;
  }
  return null;
}

function _sched_listSheetNames_(ss) {
  var sheets = ss.getSheets();
  var names = [];
  for (var i = 0; i < sheets.length; i++) names.push(sheets[i].getName());
  return names;
}

function _sched_findSchedSheetName_(names) {
  for (var i = 0; i < names.length; i++) {
    if (/^sched_\\d+/i.test(names[i])) return names[i];
  }
  return '';
}

function _sched_pickSchedIdFromScheds_(sh, diag) {
  if (!sh) return '';
  var data = _sched_readSheet_(sh);
  var header = data.header || [];
  var rows = data.rows || [];
  if (!header.length) return '';
  var norm = header.map(_sched_norm_);
  var idx = _sched_findIdx_(norm, 'sched_id', ['sched', 'id']);
  if (idx < 0) idx = _sched_findIdx_(norm, 'id', ['id']);
  if (diag) {
    diag.resolvedIndices = diag.resolvedIndices || {};
    diag.resolvedIndices.scheds = { id: idx };
  }
  for (var i = 0; i < rows.length; i++) {
    var v = idx >= 0 ? rows[i][idx] : rows[i][0];
    var schedId = String(v || '').trim();
    if (schedId) return schedId;
  }
  return '';
}

function _sched_readSheet_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { header: [], rows: [] };
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var dataStartRow = 3;
  if (lastRow < dataStartRow) return { header: header, rows: [] };
  var dataRows = sh.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, lastCol).getValues();
  return { header: header, rows: dataRows };
}

function _sched_norm_(v) { return String(v || '').trim().toLowerCase(); }

function _sched_findIdx_(headerNorm, parts) {
  if (!parts || !parts.length) return -1;
  for (var i = 0; i < headerNorm.length; i++) {
    var h = headerNorm[i];
    var ok = true;
    for (var p = 0; p < parts.length; p++) {
      if (h.indexOf(parts[p]) === -1) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

function _sched_findIdxByFieldName_(header, headerNorm, entity, fieldName, parts) {
  var fid = schemaGetFidByFieldName(entity, fieldName);
  var idx = schemaGetColIndexByFid(header, fid);
  if (idx >= 0) return idx;
  return _sched_findIdx_(headerNorm, parts);
}

function _sched_findIdxByType_(header, headerNorm, entity, type, parts) {
  var fids = schemaGetFidsByType(entity, type);
  if (!fids.length) throw new Error("Schema missing type '" + type + "' for entity: " + entity);
  if (fids.length > 1) throw new Error("Schema has multiple '" + type + "' fields for entity: " + entity);
  var idx = schemaGetColIndexByFid(header, fids[0]);
  if (idx >= 0) return idx;
  return _sched_findIdx_(headerNorm, parts);
}

function _sched_cardKeyFromFieldName_(fieldName) {
  var key = _schemaNormalizeFieldName_(fieldName);
  if (key === 'card_number' || key === 'card_no') return 'cardId';
  if (key === 'task_link' || key === 'task_id') return 'taskId';
  if (key === 'cardmemo' || key === 'memo') return 'memo';
  if (key === 'laneval' || key === 'lane' || key === 'assignee') return 'laneId';
  if (key === 'startslot' || key === 'start_slot') return 'start';
  if (key === 'lengthmin' || key === 'length') return 'len';
  if (key === 'endslot' || key === 'end_slot') return 'end';
  if (key === 'card_view_meta' || key === 'view_meta') return 'cardMeta';
  return '';
}

function _sched_readTasks_(data, diag) {
  var header = data.header || [];
  var rows = data.rows || [];
  if (!header.length) throw new Error('Scheduler tasks: header missing');
  var norm = header.map(_sched_norm_);
  var idx = {
    id: _sched_findIdxByType_(header, norm, 'task', 'id', ['task', 'id', 'task_id', 'taskid']),
    name: _sched_findIdxByType_(header, norm, 'task', 'entity_name', ['name', 'task_name', 'taskname']),
    status: _sched_findIdxByFieldName_(header, norm, 'task', 'Status', ['status']),
    assignee: _sched_findIdxByFieldName_(header, norm, 'task', 'Assigned member', ['assignedto', 'assignee', 'memberid', 'assign']),
    planStart: _sched_findIdxByFieldName_(header, norm, 'task', 'Start Date', ['planstart', 'plan_start', 'start', 'startslot']),
    planEnd: _sched_findIdxByFieldName_(header, norm, 'task', 'End Date', ['planend', 'plan_end', 'end', 'endslot']),
    bidMin: _sched_findIdxByFieldName_(header, norm, 'task', 'Est length', ['bid', 'length', 'duration', 'min']),
    actStart: _sched_findIdx_(norm, ['actstart', 'act_start']),
    actEnd: _sched_findIdx_(norm, ['actend', 'act_end'])
  };
  if (idx.id < 0 || idx.name < 0) {
    throw new Error('Scheduler tasks: missing required fields');
  }
  if (diag) diag.resolvedIndices = diag.resolvedIndices || {};
  if (diag) diag.resolvedIndices.tasks = idx;
  var tasks = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var id = String(row[idx.id] || '').trim();
    if (!id) continue;
    tasks.push({
      taskId: id,
      taskName: idx.name >= 0 ? row[idx.name] : '',
      status: idx.status >= 0 ? row[idx.status] : '',
      assignee: idx.assignee >= 0 ? row[idx.assignee] : '',
      laneVal: idx.assignee >= 0 ? row[idx.assignee] : '',
      planStart: idx.planStart >= 0 ? row[idx.planStart] : '',
      planEnd: idx.planEnd >= 0 ? row[idx.planEnd] : '',
      bidMin: idx.bidMin >= 0 ? row[idx.bidMin] : '',
      actStart: idx.actStart >= 0 ? row[idx.actStart] : '',
      actEnd: idx.actEnd >= 0 ? row[idx.actEnd] : ''
    });
  }
  if (diag && rows.length && !tasks.length) {
    diag.emptyAfterParse = {
      dataRowCount: rows.length,
      firstRowPreview: rows[0],
      resolvedIndices: idx
    };
  }
  return tasks;
}

function _sched_valueToSlot_(val, viewSlotBase) {
  var baseSlotMin = 5;
  var baseSlotMs = baseSlotMin * 60 * 1000;
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    return Math.ceil(val.getTime() / baseSlotMs);
  }
  if (typeof val === 'number') {
    return Math.ceil(val);
  }
  var s = String(val || '').trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.ceil(Number(s));
  var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), 0, 0);
    return Math.ceil(d.getTime() / baseSlotMs);
  }
  var d2 = new Date(s);
  if (isNaN(d2)) return null;
  return Math.ceil(d2.getTime() / baseSlotMs);
}

function _sched_normalizeSlot_(slot, viewSlotBase) {
  if (!isFinite(slot)) return null;
  var s = Math.ceil(Number(slot));
  var base = Math.max(1, Number(viewSlotBase) || 1);
  return Math.ceil(s / base) * base;
}

function _sched_readCards_(data, tasksById, viewSlotBase, diag) {
  var header = data.header || [];
  var rows = data.rows || [];
  if (!header.length) throw new Error('Scheduler cards: header missing');
  var norm = header.map(_sched_norm_);
  var idx = {
    cardNo: _sched_findIdxByFieldName_(header, norm, 'card', 'card number', ['card', 'no']),
    taskId: _sched_findIdxByFieldName_(header, norm, 'card', 'Task Link', ['task', 'id']),
    memo: _sched_findIdxByFieldName_(header, norm, 'card', 'cardMemo', ['memo']),
    laneVal: _sched_findIdxByFieldName_(header, norm, 'card', 'laneVal', ['lane', 'assignee', 'member', 'artist']),
    startSlot: _sched_findIdxByFieldName_(header, norm, 'card', 'startSlot', ['start', 'slot']),
    lengthMin: _sched_findIdxByFieldName_(header, norm, 'card', 'lengthMin', ['length', 'len', 'duration', 'min']),
    endSlot: _sched_findIdxByFieldName_(header, norm, 'card', 'endSlot', ['end', 'slot']),
    cardId: _sched_findIdx_(norm, ['card', 'id'])
  };

  if (idx.taskId < 0 && diag) {
    diag.warnings = diag.warnings || [];
    diag.warnings.push('CARDS_MISSING_TASK_ID');
  }
  if (diag) diag.resolvedIndices = diag.resolvedIndices || {};
  if (diag) diag.resolvedIndices.cards = idx;
  var cards = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var cardNo = idx.cardNo >= 0 ? String(row[idx.cardNo] || '').trim() : '';
    var cardId = cardNo || (idx.cardId >= 0 ? String(row[idx.cardId] || '').trim() : '');
    if (!cardId) cardId = 'card_' + (i + 1);
    var taskId = idx.taskId >= 0 ? String(row[idx.taskId] || '').trim() : '';
    var memo = idx.memo >= 0 ? String(row[idx.memo] || '') : '';
    var laneVal = idx.laneVal >= 0 ? String(row[idx.laneVal] || '').trim() : '';
    var lengthMin = idx.lengthMin >= 0 ? Number(row[idx.lengthMin]) : null;
    if (!isFinite(lengthMin)) lengthMin = null;
    var startSlot = idx.startSlot >= 0 ? _sched_valueToSlot_(row[idx.startSlot], viewSlotBase) : null;
    var endSlot = idx.endSlot >= 0 ? _sched_valueToSlot_(row[idx.endSlot], viewSlotBase) : null;
    var task = taskId && tasksById ? tasksById[taskId] : null;
    if (!startSlot && task && task.planStart) startSlot = _sched_valueToSlot_(task.planStart, viewSlotBase);
    if (!endSlot && task && task.planEnd) endSlot = _sched_valueToSlot_(task.planEnd, viewSlotBase);
    if (!endSlot && startSlot != null && lengthMin != null) {
      var lenSlots = Math.ceil(lengthMin / 5);
      endSlot = startSlot + lenSlots;
    }
    startSlot = _sched_normalizeSlot_(startSlot, viewSlotBase);
    endSlot = _sched_normalizeSlot_(endSlot, viewSlotBase);
    if (startSlot != null && endSlot != null) {
      if (endSlot <= startSlot) endSlot = startSlot + Math.max(1, Math.ceil((lengthMin || 5) / 5));
      if (lengthMin == null) lengthMin = (endSlot - startSlot) * 5;
    }
    cards.push({
      cardId: cardId,
      cardNo: cardNo,
      taskId: taskId,
      memo: memo,
      laneVal: laneVal,
      startSlot: startSlot,
      endSlot: endSlot,
      lengthMin: lengthMin
    });
  }
  return cards;
}

function _sched_readMembers_(data, diag) {
  var header = data.header || [];
  var rows = data.rows || [];
  if (!header.length) throw new Error('Scheduler members: header missing');
  var norm = header.map(_sched_norm_);
  var idx = {
    id: _sched_findIdxByType_(header, norm, 'member', 'id', ['id']),
    name: _sched_findIdxByType_(header, norm, 'member', 'entity_name', ['name', 'role'])
  };
  if (idx.id < 0) throw new Error('Scheduler members: missing id field');
  if (idx.name < 0) idx.name = idx.id;
  if (diag) diag.resolvedIndices = diag.resolvedIndices || {};
  if (diag) diag.resolvedIndices.members = idx;
  var members = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var id = String(row[idx.id] || '').trim();
    if (!id) continue;
    var name = idx.name >= 0 ? String(row[idx.name] || '').trim() : '';
    members.push({ id: id, name: name || id });
  }
  return members;
}

function sv_sched_ping_v1() {
  var meta = { take: 157, ts: new Date().toISOString(), serviceUrl: '' };
  var diag = { scriptTimeZone: '', activeUser: '', effectiveUser: '' };
  try {
    var svc = ScriptApp.getService();
    if (svc && typeof svc.getUrl === 'function') meta.serviceUrl = svc.getUrl() || '';
    diag.scriptTimeZone = Session.getScriptTimeZone();
    diag.activeUser = Session.getActiveUser().getEmail() || '';
    diag.effectiveUser = Session.getEffectiveUser().getEmail() || '';
    return { ok: true, meta: meta, diag: diag };
  } catch (err) {
    return {
      ok: false,
      meta: meta,
      diag: diag,
      error: { message: String(err && err.message ? err.message : err) }
    };
  }
}

function sv_schedule_fetchData_v1(opts) {
  console.log('[Server] sv_schedule_fetchData_v1 (V5 Tabs) called');
  var log = [];
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('No Active Spreadsheet found. Script must be container-bound.');

    var allSheets = ss.getSheets();

    var loadSheetData = function(keyword) {
      var targetSheet = null;
      for (var i = 0; i < allSheets.length; i++) {
        if (allSheets[i].getName().toLowerCase().indexOf(String(keyword).toLowerCase()) !== -1) {
          targetSheet = allSheets[i];
          break;
        }
      }
      if (!targetSheet) {
        log.push('MISS Tab [' + keyword + ']');
        return [];
      }
      log.push('HIT Tab [' + targetSheet.getName() + ']');

      var values = targetSheet.getDataRange().getValues();
      if (!values || values.length < 2) return [];

      var headers = values[1];
      var results = [];
      for (var r = 2; r < values.length; r++) {
        var row = values[r];
        var obj = {};
        var hasVal = false;
        for (var c = 0; c < headers.length; c++) {
          if (c < row.length && headers[c]) {
            obj[String(headers[c]).trim()] = row[c];
            hasVal = true;
          }
        }
        if (hasVal) results.push(obj);
      }
      return results;
    };

    var schedsData = loadSheetData('Scheds');
    var activeSchedId = 'sched_0001';
    if (schedsData.length > 0) {
      var activeRow = schedsData.filter(function(r){ return String(r.active).toLowerCase() === 'true'; })[0];
      if (activeRow && activeRow.schedId) {
        activeSchedId = activeRow.schedId;
      } else if (schedsData[0].schedId) {
        activeSchedId = schedsData[0].schedId;
      }
    }
    log.push('TargetID: ' + activeSchedId);

    var tasks = loadSheetData('Tasks');
    var members = loadSheetData('ProjectMembers');
    var cards = loadSheetData(activeSchedId);

    return {
      ok: true,
      tasks: tasks,
      members: members,
      cards: cards,
      diag: { log: log.join(' | ') }
    };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: { code: 'LOAD_FAIL', message: e.toString() + ' | ' + log.join(';') }
    };
  }
}

function sv_schedule_listTasks_v1(opts) {
  return sv_schedule_fetchData_v1(opts);
}

function sv_schedule_publish_v1(req) {
  req = req || {};
  var cards = Array.isArray(req.cards) ? req.cards : [];
  var baseSlotMin = 5;
  var baseSlotMs = baseSlotMin * 60 * 1000;
  var viewSlotMin = Number(req.viewSlotMin) || 15;
  var viewSlotBase = Math.max(1, Math.round(viewSlotMin / baseSlotMin));

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Scheduler: active spreadsheet not found');
  var sh = _findSheetByCandidates_(['task', 'Tasks', 'TASK']);
  if (!sh) throw new Error('Scheduler: task sheet not found');

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 3 || lastCol < 1) return { ok: true, updated: 0, skipped: 0 };
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var map = _buildColumnIndexMap_(header, []);
  var idxId = _resolveColumnIndex_(map, schemaGetIdFid('task'));
  var idxStatus = _resolveColumnIndex_(map, schemaGetFidByFieldName('task', 'Status'));
  var idxAssignee = _resolveColumnIndex_(map, schemaGetFidByFieldName('task', 'Assigned member'));
  var idxPlanStart = _resolveColumnIndex_(map, schemaGetFidByFieldName('task', 'Start Date'));
  var idxPlanEnd = _resolveColumnIndex_(map, schemaGetFidByFieldName('task', 'End Date'));
  if (idxId < 0) throw new Error('Scheduler: task id field not found');

  var dataStartRow = 3;
  var dataCount = Math.max(0, lastRow - dataStartRow + 1);
  var data = sh.getRange(dataStartRow, 1, dataCount, lastCol).getValues();
  var rowIndexById = {};
  for (var i = 0; i < data.length; i++) {
    var rowId = String(data[i][idxId] || '').trim();
    if (rowId) rowIndexById[rowId] = i;
  }

  var updated = 0;
  var skipped = 0;

  for (var j = 0; j < cards.length; j++) {
    var card = cards[j] || {};
    var taskId = String(card.taskId || '').trim();
    if (!taskId || !(taskId in rowIndexById)) { skipped++; continue; }
    var rowIdx = rowIndexById[taskId];
    var row = data[rowIdx];
    var status = idxStatus >= 0 ? String(row[idxStatus] || '').trim().toLowerCase() : '';
    if (status === 'completed') { skipped++; continue; }

    var laneVal = String(card.laneVal || '').trim();
    var startSlot = Number(card.startSlot);
    var endSlot = Number(card.endSlot);
    if (!isFinite(startSlot) || !isFinite(endSlot)) { skipped++; continue; }
    startSlot = Math.floor(startSlot);
    endSlot = Math.floor(endSlot);
    if (endSlot < startSlot) endSlot = startSlot;
    endSlot = Math.ceil(endSlot / viewSlotBase) * viewSlotBase;

    var startDate = new Date(startSlot * baseSlotMs);
    var endDate = new Date(endSlot * baseSlotMs);

    if (idxAssignee >= 0) sh.getRange(rowIdx + dataStartRow, idxAssignee + 1).setValue(laneVal);
    if (idxPlanStart >= 0) sh.getRange(rowIdx + dataStartRow, idxPlanStart + 1).setValue(startDate);
    if (idxPlanEnd >= 0) sh.getRange(rowIdx + dataStartRow, idxPlanEnd + 1).setValue(endDate);
    updated++;
  }

  return { ok: true, updated: updated, skipped: skipped };
}

function _getColIdx_v2(headers, keys) {
  if (!headers || !headers.length) return -1;
  var h = headers.map(function(v){ return String(v).toLowerCase().trim(); });
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i]).toLowerCase().trim();
    var idx = h.indexOf(k);
    if (idx > -1) return idx;
  }
  return -1;
}

/**
 * STANDALONE SCHEDULER LOADER V2 (JSON Stringified)
 * Returns a JSON string to avoid serialization errors with Date objects.
 */
function sv_scheduler_load_v2() {
  console.log('[Server] sv_scheduler_load_v2 called');
  var log = [];

  try {
    var ss = SpreadsheetApp.getActive();
    if (!ss) {
      try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
    }

    if (!ss) {
      return JSON.stringify({ ok: false, error: { message: 'No Active Spreadsheet' } });
    }

    var getAllSheets = ss.getSheets();
    var loadSheet = function(keyword) {
      var sheet = null;
      for (var i = 0; i < getAllSheets.length; i++) {
        if (getAllSheets[i].getName().indexOf(keyword) > -1) {
          sheet = getAllSheets[i];
          break;
        }
      }
      if (!sheet) {
        log.push('MISS: ' + keyword);
        return [];
      }
      log.push('HIT: ' + sheet.getName());

      var vals = sheet.getDataRange().getValues();
      if (!vals || vals.length < 2) return [];

      var headers = vals[1];
      var out = [];
      for (var r = 2; r < vals.length; r++) {
        var row = vals[r];
        var obj = {};
        var hasData = false;
        for (var c = 0; c < headers.length; c++) {
          if (c < row.length && headers[c]) {
            obj[String(headers[c]).trim()] = row[c];
            hasData = true;
          }
        }
        if (hasData) out.push(obj);
      }
      return out;
    };

    var config = { originDate: '', slotMin: 30, workHours: 8 };

    var activeID = 'sched_0001';
    var schedName = 'Schedule';
    var viewMeta = {};
    var allScheds = [];
    var schedsSheet = ss.getSheetByName('Scheds');
    if (schedsSheet) {
      log.push('HIT: Scheds');
      var sData = schedsSheet.getDataRange().getValues();
      var sHeaders = sData[1] || [];
      var sSysHeaders = sData[0] || [];
      var cActive = schemaGetColIndexByFid(sSysHeaders, schemaGetFidByFieldName('sched', 'active'));
      if (cActive < 0) cActive = _getColIdx_v2(sHeaders, ['active']);
      var cId = schemaGetColIndexByFid(sSysHeaders, schemaGetFidByFieldName('sched', 'schedId'));
      if (cId < 0) cId = _getColIdx_v2(sHeaders, ['schedId', 'id']);
      var cOrigin = schemaGetColIndexByFid(sSysHeaders, schemaGetFidByFieldName('sched', 'originDate'));
      if (cOrigin < 0) cOrigin = _getColIdx_v2(sHeaders, ['originDate']);
      var cSlot = schemaGetColIndexByFid(sSysHeaders, schemaGetFidByFieldName('sched', 'slotMin'));
      if (cSlot < 0) cSlot = _getColIdx_v2(sHeaders, ['slotMin']);
      var cWork = schemaGetColIndexByFid(sSysHeaders, schemaGetFidByFieldName('sched', 'workHours'));
      if (cWork < 0) cWork = _getColIdx_v2(sHeaders, ['workHours']);
      var cName = schemaGetColIndexByFid(sSysHeaders, schemaGetFidByFieldName('sched', 'schedName'));
      if (cName < 0) cName = _getColIdx_v2(sHeaders, ['schedName']);
      var cViewMeta = schemaGetColIndexByFid(sSysHeaders, schemaGetFidByFieldName('sched', 'view_meta'));
      if (cViewMeta < 0) cViewMeta = _getColIdx_v2(sHeaders, ['view_meta']);

      for (var i = 2; i < sData.length; i++) {
        var row = sData[i];
        var sid = (cId > -1) ? row[cId] : '';
        var sname = (cName > -1) ? row[cName] : (sid || schedName);
        if (sid) allScheds.push({ id: sid, name: sname || sid });
        if (cActive > -1 && String(row[cActive]).toLowerCase() === 'true') {
          if (cId > -1 && row[cId]) activeID = row[cId];
          if (cOrigin > -1) config.originDate = row[cOrigin];
          if (cSlot > -1) config.slotMin = Number(row[cSlot]) || config.slotMin;
          if (cWork > -1) config.workHours = Number(row[cWork]) || config.workHours;
          if (cName > -1) schedName = row[cName] || schedName;
          if (cViewMeta > -1 && row[cViewMeta]) {
            try { viewMeta = JSON.parse(row[cViewMeta]); } catch (e) {}
          }
        }
      }

      if (!activeID && sData.length > 2 && cId > -1) {
        activeID = sData[2][cId] || activeID;
      }
    } else {
      log.push('MISS: Scheds');
    }

    var tasks = loadSheet('Tasks');
    var members = loadSheet('ProjectMembers');

    var cards = [];
    var schedSheet = ss.getSheetByName(activeID);
    if (schedSheet) {
      log.push('HIT: ' + activeID);
      var cData = schedSheet.getDataRange().getValues();
      if (cData && cData.length >= 2) {
        var cIds = cData[0] || [];
        var cHeaders = cData[1] || [];
        var cardMetaFid = schemaGetFidByFieldName('card', 'card_view_meta');
        var cCardMeta = schemaGetColIndexByFid(cIds, cardMetaFid);
        if (cCardMeta < 0) cCardMeta = cHeaders.indexOf('card_view_meta');

        var colKeyMap = [];
        for (var ci = 0; ci < cIds.length; ci++) {
          var fid = String(cIds[ci] || '').trim();
          if (!fid) continue;
          var meta = schemaGetFieldMetaByFid(fid);
          if (!meta || _schemaNormalizeEntity_(meta.entity) !== 'card') continue;
          var key = _sched_cardKeyFromFieldName_(meta.field_name || meta.column_name || meta.label || '');
          if (key) colKeyMap[ci] = key;
        }

        for (var r = 2; r < cData.length; r++) {
          var rowData = cData[r];
          var obj = {};
          var hasRow = false;
          for (var c = 0; c < cHeaders.length; c++) {
            if (c < rowData.length && cHeaders[c]) {
              var rawKey = String(cHeaders[c]).trim();
              obj[rawKey] = rowData[c];
              var key = colKeyMap[c] || _sched_cardKeyFromFieldName_(rawKey);
              if (key) obj[key] = rowData[c];
              hasRow = true;
            }
          }
          if (hasRow) {
            if (cCardMeta > -1 && rowData[cCardMeta]) {
              try { obj.cardMeta = JSON.parse(rowData[cCardMeta]); } catch (e) {}
            }
            cards.push(obj);
          }
        }
      }
    } else {
      log.push('MISS: ' + activeID);
    }

    var payload = {
      ok: true,
      config: config,
      tasks: tasks,
      members: members,
      cards: cards,
      schedConfig: {
        activeSchedId: activeID,
        schedName: schedName,
        allScheds: allScheds,
        view_meta: viewMeta
      },
      scriptUrl: ScriptApp.getService().getUrl(),
      diag: { log: log.join(' | ') }
    };

    return JSON.stringify(payload);
  } catch (e) {
    return JSON.stringify({ ok: false, error: { message: e.toString() + ' ' + log.join(',') } });
  }
}

function sv_scheduler_save_meta_v2(jsonPayload) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return JSON.stringify({ ok: false, error: 'Busy' });

  try {
    var req = JSON.parse(jsonPayload);
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName('Scheds');
    if (!sh) return JSON.stringify({ ok: false, error: 'No Scheds sheet' });

    var data = sh.getDataRange().getValues();
    var headers = data[1] || [];
    var sysHeaders = data[0] || [];
    var cId = schemaGetColIndexByFid(sysHeaders, schemaGetFidByFieldName('sched', 'schedId'));
    if (cId < 0) cId = headers.indexOf('schedId');
    if (cId < 0) cId = headers.indexOf('ID');

    var cTarget = headers.indexOf(req.type);
    if (cTarget < 0 && req.type === 'view_meta') {
      var fidView = schemaGetFidByFieldName('sched', 'view_meta');
      cTarget = schemaGetColIndexByFid(sysHeaders, fidView);
      if (cTarget < 0) cTarget = headers.indexOf('view_meta');
    }
    if (cTarget < 0) return JSON.stringify({ ok: false, error: 'Column not found: ' + req.type });

    var targetRow = -1;
    for (var i = 2; i < data.length; i++) {
      if (String(data[i][cId]) === String(req.schedId)) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow > 0) {
      sh.getRange(targetRow, cTarget + 1).setValue(JSON.stringify(req.value));
      return JSON.stringify({ ok: true });
    }
    return JSON.stringify({ ok: false, error: 'Sched ID not found' });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function sv_scheduler_switch_active(targetId) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName('Scheds');
    if (!sh) return JSON.stringify({ ok: false, error: 'No Scheds sheet' });
    var data = sh.getDataRange().getValues();
    var headers = data[1] || [];
    var sysHeaders = data[0] || [];
    var cAct = schemaGetColIndexByFid(sysHeaders, schemaGetFidByFieldName('sched', 'active'));
    if (cAct < 0) cAct = _getColIdx_v2(headers, ['active']);
    var cId = schemaGetColIndexByFid(sysHeaders, schemaGetFidByFieldName('sched', 'schedId'));
    if (cId < 0) cId = _getColIdx_v2(headers, ['schedId', 'id']);
    if (cAct < 0 || cId < 0) return JSON.stringify({ ok: false, error: 'Missing columns' });
    for (var i = 2; i < data.length; i++) {
      var isTarget = String(data[i][cId]) === String(targetId);
      sh.getRange(i + 1, cAct + 1).setValue(isTarget);
    }
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e.toString() });
  }
}

function sv_detail_load(pageId) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName('Pages') || ss.getSheetByName('PAGES');
    if (!sh) return { ok: false, error: 'No Pages sheet' };
    var data = sh.getDataRange().getValues();
    if (!data || data.length < 2) return { ok: false, error: 'No data' };
    var headers = data[1] || data[0] || [];
    var sysHeaders = data[0] || [];
    var cId = schemaGetColIndexByFid(sysHeaders, schemaGetFidByFieldName('page', 'Page ID'));
    if (cId < 0) cId = _getColIdx_v2(headers, ['page id', 'pageid', 'id']);
    var cLayout = _getColIdx_v2(headers, ['layout']);
    var cFields = _getColIdx_v2(headers, ['fields']);
    var cConfig = schemaGetColIndexByFid(sysHeaders, schemaGetFidByFieldName('page', 'Config'));
    if (cConfig < 0) cConfig = _getColIdx_v2(headers, ['config']);
    if (cId < 0) return { ok: false, error: 'Missing page id column' };
    for (var i = 2; i < data.length; i++) {
      if (String(data[i][cId]) === String(pageId)) {
        return {
          ok: true,
          pageId: pageId,
          layout: (cLayout > -1) ? data[i][cLayout] : '',
          fields: (cFields > -1) ? data[i][cFields] : '',
          config: (cConfig > -1) ? data[i][cConfig] : ''
        };
      }
    }
    return { ok: false, error: 'Page not found' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function gsLoadPageConfig(params) {
  try {
    var pageId = (params && params.pageId) || '';
    if (!pageId) return {};

    function parseMaybeJson_(val) {
      if (val == null) return null;
      if (Array.isArray(val)) return val;
      if (typeof val === 'object') return val;
      var s = String(val || '').trim();
      if (!s) return null;
      try { return JSON.parse(s); } catch (e) { return null; }
    }

    var detail = sv_detail_load(pageId);
    var layout = null;
    if (detail && detail.layout) layout = parseMaybeJson_(detail.layout);
    if (!layout && detail && detail.config) {
      var cfg = parseMaybeJson_(detail.config);
      if (cfg && cfg.layout) layout = cfg.layout;
    }
    if (layout && Array.isArray(layout) && layout.length) {
      return { layout: layout, config: { layout: layout } };
    }

    var cfg2 = sv_loadPageConfig(params);
    if (cfg2 && Array.isArray(cfg2)) return cfg2;
    if (cfg2 && cfg2.layout && Array.isArray(cfg2.layout)) return { layout: cfg2.layout, config: cfg2 };
    if (cfg2 && cfg2.config && cfg2.config.layout) return cfg2;
    return cfg2 || {};
  } catch (e) {
    return {};
  }
}

function sv_scheduler_rename_sched(jsonPayload) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return JSON.stringify({ ok: false, error: 'Busy' });

  try {
    var req = JSON.parse(jsonPayload);
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName('Scheds');
    if (!sh) return JSON.stringify({ ok: false, error: 'No Scheds sheet' });

    var data = sh.getDataRange().getValues();
    var headers = data[1] || [];
    var cId = -1;
    var cName = -1;
    var fidName = schemaGetFidByFieldName('sched', 'schedName');
    for (var j = 0; j < headers.length; j++) {
      var v = String(headers[j]).toLowerCase().trim();
      if (v === 'schedid' || v === 'id') cId = j;
      if (v === String(fidName).toLowerCase() || v === 'schedname') cName = j;
    }
    if (cId < 0 || cName < 0) return JSON.stringify({ ok: false, error: 'Missing columns' });

    for (var i = 2; i < data.length; i++) {
      if (String(data[i][cId]) === String(req.schedId)) {
        sh.getRange(i + 1, cName + 1).setValue(req.name);
        return JSON.stringify({ ok: true });
      }
    }
    return JSON.stringify({ ok: false, error: 'ID not found' });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * DEBUG PING
 * Simple connectivity test.
 */
function sv_scheduler_debug_ping() {
  return 'PONG: Server is reachable. Time: ' + new Date().toISOString();
}

/**
 * STANDALONE SCHEDULER: COMMIT CHANGE (Auto-Save)
 * Updates/Creates/Deletes a card in the active schedule sheet.
 * payload: { action: 'update'|'create'|'delete', card: { id, lane, start, end... } }
 */
function sv_scheduler_commit_v2(payloadJson) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(3000)) return JSON.stringify({ ok: false, error: { message: 'Server busy, try again.' } });

    var payload = JSON.parse(payloadJson);
    var action = payload.action;
    var cardData = payload.card;

    var ss = SpreadsheetApp.getActive();
    var schedsSheet = ss.getSheetByName('Scheds');
    var activeID = 'sched_0001';
    if (schedsSheet) {
      var sData = schedsSheet.getDataRange().getValues();
      var sHeaders = sData[1] || [];
      var sSysHeaders = sData[0] || [];
      var getSchedCol = function(keys) {
        for (var ki = 0; ki < keys.length; ki++) {
          var idx = sHeaders.indexOf(keys[ki]);
          if (idx > -1) return idx;
          idx = sSysHeaders.indexOf(keys[ki]);
          if (idx > -1) return idx;
        }
        return -1;
      };
      var fidSchedId = schemaGetFidByFieldName('sched', 'schedId');
      var fidActive = schemaGetFidByFieldName('sched', 'active');
      var sId = getSchedCol(['schedId', 'ID', fidSchedId]);
      var sAct = getSchedCol(['active', fidActive]);
      for (var i = 2; i < sData.length; i++) {
        if (sAct > -1 && String(sData[i][sAct]).toLowerCase() === 'true') {
          if (sId > -1 && sData[i][sId]) activeID = sData[i][sId];
          break;
        }
      }
    }

    var sheet = ss.getSheetByName(activeID);
    if (!sheet) return JSON.stringify({ ok: false, error: { message: 'Schedule sheet not found: ' + activeID } });

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
    var sysHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = {};
    headers.forEach(function(h, i) {
      if (h) colMap[String(h).trim().toLowerCase()] = i + 1;
    });
    sysHeaders.forEach(function(h, i) {
      if (h) colMap[String(h).trim().toLowerCase()] = i + 1;
    });

    var getCol = function(keys) {
      for (var i = 0; i < keys.length; i++) {
        var key = String(keys[i]).trim().toLowerCase();
        if (colMap.hasOwnProperty(key)) return colMap[key];
      }
      return -1;
    };

    var fidCardNo = schemaGetFidByFieldName('card', 'card number');
    var fidTaskLink = schemaGetFidByFieldName('card', 'Task Link');
    var fidLaneVal = schemaGetFidByFieldName('card', 'laneVal');
    var fidStartSlot = schemaGetFidByFieldName('card', 'startSlot');
    var fidLengthMin = schemaGetFidByFieldName('card', 'lengthMin');
    var fidEndSlot = schemaGetFidByFieldName('card', 'endSlot');
    var fidMemo = schemaGetFidByFieldName('card', 'cardMemo');

    var C_ID = getCol([fidCardNo, 'card no', 'card number', 'card']);
    var C_TASK = getCol([fidTaskLink, 'task id', 'task link']);
    var C_LANE = getCol([fidLaneVal, 'lane', 'assignee', 'laneval']);
    var C_START = getCol([fidStartSlot, 'start slot', 'startslot', 'start']);
    var C_LEN = getCol([fidLengthMin, 'length', 'lengthmin', 'duration']);
    var C_END = getCol([fidEndSlot, 'end slot', 'endslot', 'end']);
    var C_MEMO = getCol([fidMemo, 'memo', 'cardmemo']);

    var diag = {
      activeID: activeID,
      action: action,
      cardId: cardData && cardData.id,
      cols: { id: C_ID, task: C_TASK, lane: C_LANE, start: C_START, end: C_END, len: C_LEN, memo: C_MEMO }
    };

    Logger.log('[sv_scheduler_commit_v2] ' + JSON.stringify(diag));
    if (C_ID < 0) return JSON.stringify({ ok: false, error: { message: 'Invalid Sheet Structure (No ID col)' }, diag: diag });

    var targetRow = -1;
    var lastRow = sheet.getLastRow();
    var idList = [];
    if (C_ID > 0 && lastRow > 2) {
      idList = sheet.getRange(3, C_ID, lastRow - 2, 1).getValues();
    }

    if (action !== 'create') {
      var targetIdRaw = String(cardData.id).trim();
      var targetIdNum = Number(targetIdRaw);
      var hasNum = targetIdRaw !== '' && isFinite(targetIdNum);
      for (var k = 0; k < idList.length; k++) {
        var cellRaw = String(idList[k][0]).trim();
        if (!cellRaw) continue;
        if (cellRaw === targetIdRaw) {
          targetRow = k + 3;
          break;
        }
        if (hasNum) {
          var cellNum = Number(cellRaw);
          if (isFinite(cellNum) && cellNum === targetIdNum) {
            targetRow = k + 3;
            break;
          }
        }
      }
    }

    if (action === 'delete') {
      if (targetRow > 0) {
        sheet.deleteRow(targetRow);
        diag.targetRow = targetRow;
        return JSON.stringify({ ok: true, action: 'delete', diag: diag });
      }
      return JSON.stringify({ ok: false, error: { message: 'Card not found for deletion' }, diag: diag });
    }

    if (action === 'update') {
      if (targetRow === -1) {
        return JSON.stringify({ ok: false, error: { message: 'Card ID not found: ' + cardData.id }, diag: diag });
      }
      if (C_LANE > 0) sheet.getRange(targetRow, C_LANE).setValue(cardData.lane);
      if (C_START > 0) sheet.getRange(targetRow, C_START).setValue(cardData.start);
      if (C_END > 0) sheet.getRange(targetRow, C_END).setValue(cardData.end);
      if (C_LEN > 0) sheet.getRange(targetRow, C_LEN).setValue(cardData.len || (cardData.end - cardData.start));
      if (C_MEMO > 0 && cardData.memo !== undefined) sheet.getRange(targetRow, C_MEMO).setValue(cardData.memo);
      diag.targetRow = targetRow;
      return JSON.stringify({ ok: true, action: 'update', id: cardData.id, diag: diag });
    }

    if (action === 'create') {
      var newId = cardData.id || ('c_' + new Date().getTime());
      var insertRow = lastRow + 1;
      if (C_ID > 0) sheet.getRange(insertRow, C_ID).setValue(newId);
      if (C_TASK > 0) sheet.getRange(insertRow, C_TASK).setValue(cardData.taskId);
      if (C_LANE > 0) sheet.getRange(insertRow, C_LANE).setValue(cardData.lane);
      if (C_START > 0) sheet.getRange(insertRow, C_START).setValue(cardData.start);
      if (C_END > 0) sheet.getRange(insertRow, C_END).setValue(cardData.end);
      if (C_LEN > 0) sheet.getRange(insertRow, C_LEN).setValue(cardData.len);
      if (C_MEMO > 0) sheet.getRange(insertRow, C_MEMO).setValue(cardData.memo || '');
      diag.targetRow = insertRow;
      return JSON.stringify({ ok: true, action: 'create', id: newId, diag: diag });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: { message: e.toString() } });
  } finally {
    lock.releaseLock();
  }
}

/**
 * AUTO POPULATE (Make cards for unmapped tasks)
 * Placeholder endpoint for future server-side batch logic if needed.
 */
function sv_scheduler_auto_populate_v2() {
  return JSON.stringify({ ok: true, message: 'Use client-side logic to iterate commits.' });
}
