
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

  'settings': '3CL_Shell',

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

  // DebugPanel 系
  if (pageRaw === 'debugpanel' || pageRaw === 'debug' || pageRaw === 'debugpanelpage') {
    return { page: 'DebugPanelPage', entity: entRaw || 'shot' };
  }

  // Detail 系 (?p=detailShot など)
  if (/^detail[a-z0-9_-]*$/.test(pageRaw)) {
    return { page: page || 'DetailShot', entity: entRaw || 'shot' };
  }

  // 旧 style: ?page=Assets&entity=asset など
  if (pageRaw === 'assets') return { page: 'Assets', entity: entRaw || 'asset' };
  if (pageRaw === 'shots') return { page: 'Shots', entity: entRaw || 'shot' };
  if (pageRaw === 'tasks') return { page: 'Tasks', entity: entRaw || 'task' };
  if (pageRaw === 'users') return { page: 'Users', entity: entRaw || 'user' };
  if (pageRaw === 'members' || pageRaw === 'projectmembers') {
    return { page: 'Members', entity: entRaw || 'member' };
  }

  // 新 style: ?p=table&e=assets / ?p=table&e=shots など
  if (pageRaw === 'table') {
    var entKey = normEntity(entRaw || 'shot');
    return { page: 'Table', entity: entKey };
  }

  // index/list/viewer/空 → デフォルトは Shots
  if (pageRaw === '' || pageRaw === 'index' || pageRaw === 'list' || pageRaw === 'viewer') {
    return { page: 'Shots', entity: normEntity(entRaw || 'shot') };
  }

  // その他はそのまま
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

  // ★ ここだけ変更：page/entity と p/e の両方を受ける
  var rawPage = params.page || params.p || '';
  var rawEntity = params.entity || params.e || '';

  // 何もなければデフォルトは Shots
  if (!rawPage && !rawEntity) {
    rawPage = 'Shots';
    rawEntity = '';
  }

  var id = params.id || '';

  var normalized = _normalizePageAndEntity_(rawPage, rawEntity);
  var page = normalized.page;
  var entity = normalized.entity;

  var templateName = _resolveTemplateName_(page, entity, id);

  var t;
  try {
    t = HtmlService.createTemplateFromFile(templateName);
  } catch (err) {
    var msg = 'Template "' + String(templateName) + '" not found.\n\n' +
      (err && err.stack ? String(err.stack) : String(err));

    msg = msg.replace(/[<>&]/g, function (c) {
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


function _readFromDataHubOrSheet_(sheetName) {
  var dh = SpreadsheetApp.getActive().getSheetByName('DataHub');
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
          return { ids: ids, header: names, rows: rows };
        }
      }
    }
  }
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var rangeVals = sh ? sh.getDataRange().getValues() : [];
  if (!rangeVals || !rangeVals.length) return { ids: [], header: [], rows: [] };
  var idsRow = rangeVals[0] || [];
  var namesRow = rangeVals[1] || [];
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
function _parseDate_(s) {
  if (!s) return null;
  try {
    if (s instanceof Date) return s;
    var m = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(m) || /^\d{4}\/\d{2}\/\d{2}/.test(m)) return new Date(m);
    var d = new Date(m); if (!isNaN(d.getTime())) return d;
  } catch (e) { }
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

  var limitFromParams = Number(params.limit);
  var limitFromObj = entObj && Number(entObj.perPage);
  var limit = limitFromParams || limitFromObj || 100;
  if (!limit || limit < 1) limit = 100;

  var pageFromParams = Number(params.page);
  var pageFromObj = entObj && Number(entObj.page);
  var page = pageFromParams || pageFromObj || 1;
  if (!page || page < 1) page = 1;

  var offset;
  if (params.offset != null) {
    offset = Number(params.offset);
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
  if (!sh) {
    return { header: [], rows: [] };
  }

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { header: [], rows: [] };
  }

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  var dataStartRow = 3;
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
    rows: dataRows
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
        ? compiledRule.valuesLower.some(function (v) { return lower.indexOf(v) >= 0; })
        : false;
    case 'is':
      return compiledRule.valuesLower && compiledRule.valuesLower.length
        ? compiledRule.valuesLower.some(function (v) { return lower === v; })
        : false;
    case 'isnot':
      if (!compiledRule.valuesLower || !compiledRule.valuesLower.length) return str !== '';
      return compiledRule.valuesLower.every(function (v) { return lower !== v; });
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
  outer:
  for (var i = 0; i < maxLen; i++) {
    var idVal = (i < ids.length && ids[i] != null) ? String(ids[i]).trim() : '';
    var headerVal = (i < header.length && header[i] != null) ? String(header[i]).trim() : '';
    if (idVal || headerVal) {
      keep.push(i);
      continue;
    }
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (row && row[i] != null && String(row[i]).trim() !== '') {
        keep.push(i);
        continue outer;
      }
    }
  }
  if (keep.length === maxLen) {
    return { ids: ids, header: header, rows: rows };
  }
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

function _listRowsPageCore_(params) {
  params = params || {};

  var conf = _normalizeEntityParams_(params);
  var sheetName = conf.sheet;
  var limit = conf.limit;
  var offset = conf.offset;

  var data = _readFromDataHubOrSheet_(sheetName);
  var ids = data.ids || [];
  var header = data.header || [];
  var rows = data.rows || [];

  // work on a copy
  var workingRows = rows.slice();

  // filter
  var filters = Array.isArray(params.filterGroups) ? params.filterGroups : [];
  var combineMode = (params.groupCombine === 'any') ? 'any' : 'all';
  if (filters.length) {
    workingRows = _filterRowsByGroups_(workingRows, ids, header, filters, combineMode);
  }

  // sort
  if (Array.isArray(params.sort) && params.sort.length) {
    workingRows = _sortRowsBySpecs_(workingRows, params.sort, ids, header);
  }

  var total = workingRows.length;

  // guard offset / limit just in case
  if (typeof offset !== 'number' || offset < 0) offset = 0;
  if (typeof limit !== 'number' || limit < 1) limit = total;

  var start = offset;
  if (start > total) start = total;

  var end = start + limit;
  if (end > total) end = total;

  var sliced = workingRows.slice(start, end);

  var trimmed = _pruneEmptyColumns_(ids, header, sliced);
  ids = trimmed.ids;
  header = trimmed.header;
  sliced = trimmed.rows;

  Logger.log(
    '[listRowsPage] matrix ids=%s header=%s rows=%s sliced_len=%s',
    ids.length,
    header.length,
    sliced.length,
    sliced.length
  );

  var result = {
    ids: ids,
    header: header,
    rows: sliced,
    total: total,
    // meta は呼び出し側の sv_listRowsPage から参照される可能性があるので付けておく
    meta: {
      total: total,
      sheet: sheetName,
      offset: offset,
      limit: limit,
      sort: params.sort || null,
      filter: params.filter || null,
      filterMode: params.filterMode || null,
      filterGroups: params.filterGroups || null,
      groupCombine: params.groupCombine || null
    }
  };

  Logger.log('[listRowsPage] entity=%s sheet=%s total=%s offset=%s limit=%s',
    conf.entity, sheetName, total, start, limit);

  return result;
}

function sv_listRowsPage(entity, options) {
  Logger.log('[sv_listRowsPage] args: entity=%s options=%s',
    (typeof entity === 'object' ? JSON.stringify(entity) : entity),
    (typeof options === 'object' ? JSON.stringify(options) : options));

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

  var params = {
    entity: entString,
    sheet: options.sheet || options.sheetName || entString,

    offset: options.offset,
    limit: options.limit,

    sort: options.sort,
    filter: options.filter,
    filterMode: options.filterMode,
    filterGroups: options.filterGroups,
    groupCombine: options.groupCombine
  };

  var base = _listRowsPageCore_(params) || {};
  var ids = base.ids || [];
  var names = base.header || base.labels || [];
  var rows = base.rows || [];
  var total = base.total;

  Logger.log('[sv_listRowsPage] base result: rows=%s total=%s', rows.length, total);

  if (total == null && base.meta && base.meta.total != null) {
    total = base.meta.total;
  }
  if (total == null) {
    total = rows.length;
  }

  var canonEnt = _normalizeEntityParams_({ entity: params.entity || entity || '' }).entity;
  var ftAll = getFieldTypes(canonEnt) || {};
  var fieldDefs = ftAll[canonEnt] || {};
  var missingMeta = [];

  var columns = [];
  for (var i = 0; i < ids.length; i++) {
    var fidRaw = ids[i];
    var nameRaw = (i < names.length) ? names[i] : '';

    var fid = fidRaw != null ? String(fidRaw).trim() : '';
    var def = fid && fieldDefs[fid] ? fieldDefs[fid] : null;

    var colName = (nameRaw != null && nameRaw !== '') ?
      String(nameRaw) :
      ((def && def.label) || fid || '');

    var type = def && def.type ? String(def.type).trim().toLowerCase() : '';
    var editable = !!(def && def.editable === true);
    var required = !!(def && def.required === true);
    var options = def && def.options ? def.options : [];
    if (!Array.isArray(options)) options = _parseOptions_(options);

    if (fid && !type) missingMeta.push(fid);

    columns.push({
      id: fid || null,
      fieldId: fid || null,
      field_id: fid || null,
      name: colName,
      label: colName,
      type: type,
      editable: editable,
      required: required,
      options: options,
      index: i,
      meta: {}
    });
  }

  var row0 = rows.length ? rows[0] : null;

  return {
    columns: columns,
    row0: row0,
    rows: rows,
    meta: {
      total: total,
      sheet: (base.meta && base.meta.sheet) ? base.meta.sheet : (params.sheet || ''),
      offset: (base.meta && base.meta.offset != null) ? base.meta.offset : (params.offset || 0),
      limit: (base.meta && base.meta.limit != null) ? base.meta.limit : (params.limit || 100),
      entity: entity,
      entityKey: canonEnt,
      missingFieldsMeta: missingMeta
    }
  };
}

function _SS_() { return SpreadsheetApp.getActive(); }
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
  if (s.charCodeAt && s.charCodeAt(0) === 0x2713) return true; // checkmark
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
function _arrToObj_(hdr, row) {
  var o = {}, i;
  for (i = 0; i < hdr.length; i++) { o[String(hdr[i])] = row[i]; }
  return o;
}

function _entityToSheet_(entity) {
  var m = {
    "shot": "Shots",
    "asset": "Assets",
    "task": "Tasks",
    "member": "ProjectMembers",
    "user": "Users",
    "page": "Pages"
  };
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
  var C = {
    entity: H.entity != null ? H.entity : (H.ent != null ? H.ent : null),
    type: H.type != null ? H.type : (H.kind != null ? H.kind : null),
    field_id: H.field_id != null ? H.field_id : (H.fi != null ? H.fi : null),
    column_name: H.column != null ? H.column : (H.column_name != null ? H.column_name : (H.col != null ? H.col : null)),
    label: H.label != null ? H.label : (H.field_name != null ? H.field_name : (H.name != null ? H.name : null)),
    options: H.options != null ? H.options : (H.option != null ? H.option : (H.choices != null ? H.choices : (H.choice != null ? H.choice : null))),
    editable: (H.editable != null ? H.editable : (H.can_edit != null ? H.can_edit : null)),
    required: (H.required != null ? H.required : (H.req != null ? H.req : null))
  };
  var out = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var o = {
      entity: C.entity != null ? row[C.entity] : "",
      type: C.type != null ? row[C.type] : "",
      field_id: C.field_id != null ? row[C.field_id] : "",
      column_name: C.column_name != null ? row[C.column_name] : "",
      label: C.label != null ? row[C.label] : "",
      options: C.options != null ? row[C.options] : "",
      editable: C.editable != null ? row[C.editable] : false,
      required: C.required != null ? row[C.required] : false
    };
    out.push(o);
  }
  return out;
}
function _idAndLabelCols_(entity, sheetHdr) {
  var fields = _readFields_();
  var e = _norm_(entity);
  var idName = null, labelName = null;

   // DataHub/Entity sheets: row 1 is Field IDs (fi_####)
   if (idName == null) {
     var idxFiId = _hdrIndex_(sheetHdr, "fi_0001");
     if (idxFiId >= 0) idName = sheetHdr[idxFiId];
   }
   if (labelName == null) {
     var idxFiLabel = _hdrIndex_(sheetHdr, "fi_0002");
     if (idxFiLabel >= 0) labelName = sheetHdr[idxFiLabel];
   }

  for (var i = 0; i < fields.length; i++) {
    if (_norm_(fields[i].entity) !== e) continue;
    var t = _norm_(fields[i].type);
    var colKey = fields[i].column_name || fields[i].field_id;
    if (t === "id" && colKey) { idName = colKey; }
    if ((t === "entity_name" || t === "name") && colKey) { labelName = colKey; }
  }
  if (idName == null) {
    var guess = ["id", e + "_id", e + "id", "code", "key"];
    for (var g = 0; g < guess.length && idName == null; g++) {
      var idx = _hdrIndex_(sheetHdr, guess[g]);
      if (idx >= 0) idName = sheetHdr[idx];
    }
  }
  if (labelName == null) {
    var guessL = ["name", "label", "code", e, e + "_name"];
    for (var h = 0; h < guessL.length && labelName == null; h++) {
      var idx2 = _hdrIndex_(sheetHdr, guessL[h]);
      if (idx2 >= 0) labelName = sheetHdr[idx2];
    }
  }
  return { idName: idName, labelName: labelName };
}
function _isEditable_(entity, colName) {
  var fields = _readFields_();
  var e = _norm_(entity), c = _norm_(colName);
  for (var i = 0; i < fields.length; i++) {
    if (_norm_(fields[i].entity) !== e) continue;
    if (/^fi_\d{4,}$/i.test(String(colName || ""))) {
      if (_norm_(fields[i].field_id) === c) return _normBool_(fields[i].editable);
    } else {
      if (_norm_(fields[i].column_name) === c) return _normBool_(fields[i].editable);
    }
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
  var i, row;
  for (i = 1; i < values.length; i++) {
    row = values[i];
    if (String(row[idCol]) === String(idValue)) {
      return (labelCol >= 0) ? String(row[labelCol]) : null;
    }
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
    var sheet = _entityToSheet_(entity);
    var values = _read2D_(sheet);
    var hdr = values[0];
    var map = _idAndLabelCols_(entity, hdr);
    if (!map.idName) throw new Error("ID column not resolved for entity: " + entity);
    var idCol = _hdrIndex_(hdr, map.idName);
    var labelCol = map.labelName ? _hdrIndex_(hdr, map.labelName) : -1;

    var i, row, found = -1;
    for (i = 1; i < values.length; i++) {
      row = values[i];
      if (String(row[idCol]) === String(id)) { found = i; break; }
    }
    if (found < 0) return { ok: false, error: "Record not found", entity: entity, id: id };

    var rec = {};
    for (i = 0; i < hdr.length; i++) {
      var token = _cellToViewToken_(hdr[i], values[found][i]);
      token.editable = _isEditable_(entity, hdr[i]);
      rec[hdr[i]] = token;
    }
    var labelVal = (labelCol >= 0) ? values[found][labelCol] : null;

    return {
      ok: true,
      entity: entity,
      sheet: sheet,
      id: id,
      id_col: map.idName,
      label_col: map.labelName,
      label: labelVal,
      fields: rec
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), entity: entity, id: id };
  }
}

function dp_updateEntityRecord(entity, id, patch) {
  try {
    if (!patch || typeof patch !== "object") throw new Error("patch must be an object");

    var conf = _normalizeEntityParams_({ entity: entity });
    var entityKey = conf.entity;
    var sheetName = conf.sheet;
    var sh = _shByName_(sheetName);
    var values = sh.getDataRange().getValues();
    if (!values || values.length < 3) throw new Error("Entity sheet has no data rows: " + sheetName);

    var hdr = values[0] || [];
    var idCol = _hdrIndex_(hdr, "fi_0001");
    if (idCol < 0) {
      var map = _idAndLabelCols_(entityKey, hdr);
      if (!map.idName) throw new Error("ID column not resolved for entity: " + entityKey);
      idCol = _hdrIndex_(hdr, map.idName);
    }

    var rIdx = -1, i;
    for (i = 2; i < values.length; i++) { // skip label row
      if (String(values[i][idCol]) === String(id)) { rIdx = i; break; }
    }
    if (rIdx < 0) return { ok: false, error: "Record not found", entity: entityKey, id: id };

    var row = values[rIdx].slice();

    for (var k in patch) {
      if (!patch.hasOwnProperty(k)) continue;
      var fid = String(k || '').trim();
      if (!fid) continue;

      var colIdx = _hdrIndex_(hdr, fid);
      if (colIdx < 0) {
        return { ok: false, error: "Unknown field: " + fid, entity: entityKey, id: id };
      }
      if (!_isEditable_(entityKey, fid)) {
        return { ok: false, error: "Field not editable: " + fid, entity: entityKey, id: id };
      }

      row[colIdx] = patch[k];
    }

    sh.getRange(rIdx + 1, 1, 1, hdr.length).setValues([row]);

    var latest = dp_getEntityRecord(entityKey, id);
    latest.ok = true;
    return latest;

  } catch (e) {
    return { ok: false, error: String(e && e.message || e), entity: entity, id: id };
  }
}

function _pg_ss_() { return SpreadsheetApp.getActive(); }
function _pg_sh_() { var sh = _pg_ss_().getSheetByName("Pages"); if (!sh) throw new Error("Sheet not found: Pages"); return sh; }
function _pg_readAll_() {
  var sh = _pg_sh_();
  var v = sh.getDataRange().getValues();
  if (!v || v.length < 2) throw new Error("Pages header rows missing");
  return { sh: sh, hdrIds: v[0], hdrNames: v[1], rows: v.slice(2) };
}
function _pg_normBool_(v) {
  var s = String(v).trim().toLowerCase();
  if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true;
  return s === "true" || s === "1" || s === "yes" || s === "on" || s === "y" || s === "ok";
}

function _pg_idxById_(hdrIds, idOrFi) {
  var key = String(idOrFi).trim().toLowerCase();
  for (var i = 0; i < hdrIds.length; i++) {
    if (String(hdrIds[i]).trim().toLowerCase() === key) return i;
  }
  return -1;
}
function _pg_idxByName_(hdrNames, name) {
  var key = String(name).trim().toLowerCase();
  for (var i = 0; i < hdrNames.length; i++) {
    if (String(hdrNames[i]).trim().toLowerCase() === key) return i;
  }
  return -1;
}
function _pg_resolveCol_(hdrIds, hdrNames, key) {
  if (!key) return -1;
  if (/^fi_\d{4,}$/i.test(key)) {
    var idx = _pg_idxById_(hdrIds, key);
    if (idx >= 0) return idx;
  }
  var idxN = _pg_idxByName_(hdrNames, key);
  if (idxN >= 0) return idxN;
  var k = String(key).trim().toLowerCase();
  if (k === "page_name" || k === "name" || k === "title") k = "page name";
  else if (k === "page_type" || k === "type") k = "page type";
  else if (k === "is_shared" || k === "shared?") k = "shared";
  else if (k === "config_json" || k === "config") k = "config";
  idxN = _pg_idxByName_(hdrNames, k);
  if (idxN >= 0) return idxN;
  return _pg_idxById_(hdrIds, k);
}
function _pg_locateIdCol_(hdrIds, hdrNames) {
  var c;
  c = _pg_idxById_(hdrIds, "fi_0052"); if (c >= 0) return c;
  c = _pg_idxByName_(hdrNames, "page id"); if (c >= 0) return c;
  c = _pg_idxById_(hdrIds, "page_id"); if (c >= 0) return c;
  c = _pg_idxById_(hdrIds, "id"); if (c >= 0) return c;
  throw new Error("Pages: ID column not resolved");
}

function dp_getPageRecord(id) {
  try {
    var values = _pg_read2D_(); var hdr = values[0];
    var idName = null;
    var cands = ["Page ID", "page_id", "id"];
    for (var i = 0; i < cands.length && !idName; i++) { if (_pg_hdrIdx_(hdr, cands[i]) >= 0) idName = cands[i]; }
    if (!idName) throw new Error("Pages: ID column not resolved");

    var r = _pg_findById_(hdr, values, idName, id);
    if (r < 0) return { ok: false, error: "Record not found", id: id };
    var rec = {};
    for (var c = 0; c < hdr.length; c++) { rec[hdr[c]] = values[r][c]; }

    return { ok: true, id: id, fields: rec };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), id: id };
  }
}

function dp_updatePageRecord(id, patch) {
  try {
    if (!patch || typeof patch !== "object") throw new Error("patch must be an object");

    var values = _pg_read2D_(); var hdr = values[0]; var sh = _pg_sh_();

    var idName = null, idCands = ["Page ID", "page_id", "id"];
    for (var i = 0; i < idCands.length && !idName; i++) { if (_pg_hdrIdx_(hdr, idCands[i]) >= 0) idName = idCands[i]; }
    if (!idName) throw new Error("Pages: ID column not resolved");

    var r = _pg_findById_(hdr, values, idName, id);
    if (r < 0) return { ok: false, error: "Record not found", id: id };

    var row = values[r].slice();
    var COL_PAGE_NAME = "Page Name";
    var COL_PAGE_TYPE = "Page Type";
    var COL_ENTITY = "Entity";
    var COL_SHARED = "Shared";

    for (var k in patch) {
      if (!patch.hasOwnProperty(k)) continue;
      var idx = _pg_hdrIdx_(hdr, k);
      if (idx < 0) continue;
      var v = (k === COL_SHARED) ? _pg_normBool_(patch[k]) : patch[k];
      row[idx] = v;
    }

    sh.getRange(r + 1, 1, 1, hdr.length).setValues([row]);

    var latest = {};
    for (var c = 0; c < hdr.length; c++) { latest[hdr[c]] = row[c]; }
    return { ok: true, id: id, fields: latest };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), id: id };
  }
}

function dp_saveAsPage(srcId, newId, patch) {
  try {
    var get = dp_getPageRecord(srcId);
    if (!get || !get.ok) return { ok: false, error: "Source not found: " + srcId };

    var values = _pg_read2D_(); var hdr = values[0]; var sh = _pg_sh_();

    var idName = null, idCands = ["Page ID", "page_id", "id"];
    for (var i = 0; i < idCands.length && !idName; i++) { if (_pg_hdrIdx_(hdr, idCands[i]) >= 0) idName = idCands[i]; }
    if (!idName) throw new Error("Pages: ID column not resolved");

    var exists = _pg_findById_(hdr, values, idName, newId);
    if (exists >= 0) return { ok: false, error: "Already exists: " + newId };

    var srcIdx = _pg_findById_(hdr, values, idName, srcId);
    if (srcIdx < 0) return { ok: false, error: "Source not found: " + srcId };
    var base = values[srcIdx].slice();

    var idCol = _pg_hdrIdx_(hdr, idName);
    base[idCol] = newId;

    var COL_SHARED = "Shared";
    if (patch && typeof patch === "object") {
      for (var k in patch) {
        if (!patch.hasOwnProperty(k)) continue;
        var idx = _pg_hdrIdx_(hdr, k);
        if (idx < 0) continue;
        base[idx] = (k === COL_SHARED) ? _pg_normBool_(patch[k]) : patch[k];
      }
    }

    sh.appendRow(base);

    var rec = {}; for (var c = 0; c < hdr.length; c++) { rec[hdr[c]] = base[c]; }
    return { ok: true, id: newId, fields: rec };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), srcId: srcId, newId: newId };
  }
}

function PG_ss() { return SpreadsheetApp.getActive(); }
function PG_sh() {
  var sh = PG_ss().getSheetByName("Pages");
  if (!sh) throw new Error("Sheet not found: Pages");
  return sh;
}
function PG_vals() {
  var v = PG_sh().getDataRange().getValues();
  if (!v || !v.length) throw new Error("Empty sheet: Pages");
  return v;
}
function PG_hdrIdx(hdr, name) {
  var n = String(name).trim().toLowerCase();
  for (var i = 0; i < hdr.length; i++) {
    if (String(hdr[i]).trim().toLowerCase() === n) return i;
  }
  return -1;
}
function PG_findById(hdr, rows, idColName, idValue) {
  var idCol = PG_hdrIdx(hdr, idColName);
  if (idCol < 0) throw new Error("Pages: ID column missing: " + idColName);
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][idCol]) === String(idValue)) return r;
  }
  return -1;
}
function PG_bool(v) {
  var s = String(v).trim().toLowerCase();
  if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true;
  return s === "true" || s === "1" || s === "yes" || s === "on" || s === "y" || s === "ok";
}
function PG_idColName(hdr) {
  var cands = ["Page ID", "page_id", "id"];
  for (var i = 0; i < cands.length; i++) {
    if (PG_hdrIdx(hdr, cands[i]) >= 0) return cands[i];
  }
  throw new Error("Pages: ID column not resolved");
}
function PG_mapKeyToCol(hdr, key) {
  var CAN = {
    "page name": "Page Name",
    "page type": "Page Type",
    "entity": "Entity",
    "shared": "Shared",
    "config": "CONFIG"
  };
  var k = String(key).trim().toLowerCase();
  if (k === "page_name" || k === "name" || k === "title") k = "page name";
  else if (k === "page_type" || k === "type") k = "page type";
  else if (k === "is_shared") k = "shared";
  var canon = CAN[k] || key;
  var idx = PG_hdrIdx(hdr, canon);
  if (idx >= 0) return { name: canon, idx: idx };
  idx = PG_hdrIdx(hdr, key);
  if (idx >= 0) return { name: key, idx: idx };
  return null;
}
function PG_setSelectedView_(pageId) {
  PropertiesService.getScriptProperties().setProperty("CURRENT_PAGE_VIEW_ID", String(pageId));
}

function dp_updatePageRecord(id, patch) {
  try {
    if (!patch || typeof patch !== "object") throw new Error("patch must be an object");
    var all = _pg_readAll_(), sh = all.sh, hdrIds = all.hdrIds, hdrNames = all.hdrNames, rows = all.rows;
    var idCol = _pg_locateIdCol_(hdrIds, hdrNames);

    var r = -1;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][idCol]) === String(id)) { r = i; break; }
    }
    if (r < 0) return { ok: false, error: "Record not found", id: id };

    var row = rows[r].slice();
    var wrote = [];

    for (var k in patch) {
      if (!patch.hasOwnProperty(k)) continue;
      if (k === "__select") continue;
      var colIdx = _pg_resolveCol_(hdrIds, hdrNames, k);
      if (colIdx < 0) continue;
      var val = (String(hdrNames[colIdx]).trim().toLowerCase() === "shared") ? _pg_normBool_(patch[k]) : patch[k];
      row[colIdx] = val;
      wrote.push(hdrIds[colIdx] || hdrNames[colIdx] || k);
    }

    if (wrote.length) {
      sh.getRange(2 + 1 + r, 1, 1, hdrIds.length).setValues([row]);
    }

    if (patch.__select === true) {
      PropertiesService.getScriptProperties().setProperty("CURRENT_PAGE_VIEW_ID", String(id));
    }

    var latest = {};
    for (var c = 0; c < hdrIds.length; c++) { latest[hdrIds[c] || hdrNames[c] || ("c" + c)] = row[c]; }
    return { ok: true, id: id, wrote: wrote, selected: (patch.__select === true), fields: latest };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), id: id };
  }
}

function PG_vals() {
  var sh = SpreadsheetApp.getActive().getSheetByName("Pages");
  if (!sh) throw new Error("Sheet not found: Pages");
  var v = sh.getDataRange().getValues();
  if (!v || v.length < 2) throw new Error("Pages header rows missing");
  return v;
}
function PG_hdrIdx(hdr, name) {
  var n = String(name).trim().toLowerCase();
  for (var i = 0; i < hdr.length; i++) { if (String(hdr[i]).trim().toLowerCase() === n) return i; }
  return -1;
}
function PG_idColName(hdr) {
  var cands = ["fi_0052", "Page ID", "page_id", "id"];
  for (var i = 0; i < cands.length; i++) { var idx = PG_hdrIdx(hdr, cands[i]); if (idx >= 0) return hdr[idx]; }
  throw new Error("Pages: ID column not resolved");
}
function PG_bool(v) {
  var s = String(v).trim().toLowerCase();
  if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true;
  return s === "true" || s === "1" || s === "yes" || s === "on" || s === "y" || s === "ok";
}

function gsListPagePresets(params) {
  params = params || {};
  var wantEntity = String(params.entity || '').toLowerCase();
  var wantType = String(params.pageType || '').toLowerCase();
  var vals = PG_vals(), idsRow = vals[0], namesRow = vals[1], rows = vals.slice(2);
  var idName = PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var nmIdx = PG_hdrIdx(namesRow, "page name");
  var tpIdx = PG_hdrIdx(namesRow, "page type");
  var enIdx = PG_hdrIdx(namesRow, "entity");
  var shIdx = PG_hdrIdx(namesRow, "shared");

  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = r[idIdx]; if (!id) continue;
    var ent = (enIdx >= 0 ? String(r[enIdx] || '').toLowerCase() : '');
    var typ = (tpIdx >= 0 ? String(r[tpIdx] || '').toLowerCase() : '');
    if (wantEntity && ent && ent !== wantEntity) continue;
    if (wantType && typ && typ !== wantType) continue;
    out.push({
      id: id,
      name: nmIdx >= 0 ? r[nmIdx] : '',
      pageType: typ || '',
      entity: ent || '',
      shared: shIdx >= 0 ? !!PG_bool(r[shIdx]) : false
    });
  }
  return out;
}

function gsLoadPageConfig(params) {
  var pid = params && params.pageId; if (!pid) return {};
  var vals = PG_vals(), idsRow = vals[0], namesRow = vals[1], rows = vals.slice(2);
  var idName = PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var cfIdx = PG_hdrIdx(namesRow, "config");
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[idIdx]) === String(pid)) {
      var raw = (cfIdx >= 0 ? r[cfIdx] : '');

      if (raw && typeof raw === "string") { try { return JSON.parse(raw); } catch (e) { return {}; } }
      return {};
    }
  }
  return {};
}

function gsLoadPageConfigsBulk(ids) {
  ids = Array.isArray(ids) ? ids.map(String) : [];
  var map = {}, vals = PG_vals(), idsRow = vals[0], namesRow = vals[1], rows = vals.slice(2);
  var idName = PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var cfIdx = PG_hdrIdx(namesRow, "config");
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], pid = String(r[idIdx] || '');

    if (ids.indexOf(pid) < 0) continue;
    var raw = (cfIdx >= 0 ? r[cfIdx] : '');

    if (raw && typeof raw === "string") { try { map[pid] = JSON.parse(raw); } catch (e) { map[pid] = {}; } }
    else map[pid] = {};
  }
  return map;
}

function _pg_all_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Pages');
  if (!sh) throw new Error('Sheet not found: Pages');
  var v = sh.getDataRange().getValues();
  if (!v || v.length < 2) throw new Error('Pages header rows missing');
  return { sh: sh, fi: v[0], names: v[1], rows: v.slice(2) };
}
function _pg_idxBy(a, key) { key = String(key).trim().toLowerCase(); for (var i = 0; i < a.length; i++) { if (String(a[i]).trim().toLowerCase() === key) return i; } return -1; }
function _pg_bool(v) { var s = String(v).trim().toLowerCase(); if (s && s.charCodeAt && s.charCodeAt(0) === 0x2713) return true; return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'y' || s === 'ok'; }

function _pg_findIdx(fi, names, fiKey, labelKey, altLabels) {
  var idx = _pg_idxBy(fi, fiKey);
  if (idx >= 0) return idx;
  idx = _pg_idxBy(names, labelKey);
  if (idx >= 0) return idx;
  for (var i = 0; i < (altLabels || []).length; i++) {
    idx = _pg_idxBy(names, altLabels[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function gsCreatePagePreset(params) {
  params = params || {};
  var ent = String(params.entity || '').trim();
  var name = String(params.name || '').trim() || '(no name)';
  var shared = !!params.shared;
  var ptype = String(params.pageType || 'table').trim() || 'table';
  var cfgIn = params.config;
  var cfgStr = (typeof cfgIn === 'string') ? cfgIn : (cfgIn ? JSON.stringify(cfgIn) : '');

  var lock = LockService.getScriptLock();
  try { lock.tryLock(3000); } catch (e) { }
  var sp = PropertiesService.getScriptProperties();
  var lastId = sp.getProperty('LAST_CREATED_PAGE_ID');
  var lastAt = Number(sp.getProperty('LAST_CREATED_PAGE_AT') || 0);
  if (lastId && (Date.now() - lastAt) < 4000) {
    if (lock) try { lock.releaseLock(); } catch (e) { }
    return { ok: true, id: lastId, dedup: true };
  }

  var a = _pg_all_(), sh = a.sh, fi = a.fi, names = a.names, rows = a.rows;

  var cID = _pg_findIdx(fi, names, 'fi_0052', 'page id', ['id', 'page_id']);
  var cNM = _pg_findIdx(fi, names, 'fi_0053', 'page name', ['name', 'title']);
  var cTP = _pg_findIdx(fi, names, 'fi_0054', 'page type', ['type']);
  var cEN = _pg_findIdx(fi, names, 'fi_0055', 'entity', ['sheet', 'table']);
  var cCF = _pg_findIdx(fi, names, 'fi_0056', 'config', ['CONFIG', 'Config']);
  var cSH = _pg_findIdx(fi, names, 'fi_0057', 'shared', ['is_shared', 'shared?']);

  if (cID < 0 || cNM < 0 || cTP < 0 || cEN < 0) {
    if (lock) try { lock.releaseLock(); } catch (e) { }
    return { ok: false, error: 'Pages header missing (need Page ID / Page Name / Page Type / Entity)' };
  }

  var maxN = 0;
  for (var i = 0; i < rows.length; i++) {
    var m = String(rows[i][cID] || '').match(/^pg_(\d{1,})$/i);
    if (m) { var n = +m[1]; if (n > maxN) maxN = n; }
  }
  var newId = 'pg_' + ('0000' + (maxN + 1)).slice(-4);

  var outRow = new Array(fi.length).fill('');
  outRow[cID] = newId; outRow[cNM] = name; outRow[cTP] = ptype; outRow[cEN] = ent;
  if (cSH >= 0) outRow[cSH] = shared ? true : false;
  if (cCF >= 0 && cfgStr) outRow[cCF] = cfgStr;

  var createdByIdx = _pg_idxBy(names, 'created by'); if (createdByIdx < 0) createdByIdx = _pg_idxBy(names, 'createdby');
  var createdAtIdx = _pg_idxBy(names, 'created'); if (createdAtIdx < 0) createdAtIdx = _pg_idxBy(names, 'created at');
  try {
    if (createdByIdx >= 0) {
      var by = Session.getActiveUser() && Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '';
      outRow[createdByIdx] = by || 'system';
    }
    if (createdAtIdx >= 0) { outRow[createdAtIdx] = new Date(); }
  } catch (e) { }

  sh.appendRow(outRow);

  sp.setProperty('LAST_CREATED_PAGE_ID', newId);
  sp.setProperty('LAST_CREATED_PAGE_AT', String(Date.now()));
  sp.setProperty('CURRENT_PAGE_VIEW_ID', String(newId));
  if (lock) try { lock.releaseLock(); } catch (e) { }

  var ret = {};
  for (var z = 0; z < fi.length; z++) { ret[fi[z] || names[z] || ('c' + z)] = outRow[z]; }
  return { ok: true, id: newId, name: name, pageType: ptype, entity: ent, shared: !!(cSH >= 0 && outRow[cSH]), fields: ret };
}

function dp_resolveLabelsBulk(ids) {
  ids = Array.isArray(ids) ? ids.filter(function (s) { return !!s; }) : [];
  var out = {};
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i]);
    var lbl = _resolveEntityLinkLabel_(id);
    if (lbl != null) out[id] = lbl;
  }
  return out;
}

function dp_debugPing() {
  return { ts: Date.now(), ok: true };
}

function dp_listPageLayoutPresets(req) {
  return [];
}

function dp_getProjectMeta() {
  try {
    if (typeof _sv_getMeta_ === "function") {
      var meta = _sv_getMeta_({}) || {};
      return meta;
    }
  } catch (e) { }
  return {};
}

function dp_traceOriginals(req) {
  req = req || {};
  var ent = String(req.entity || "shot").toLowerCase();
  var id = String(req.id || "").trim();
  var out = { input: { entity: ent, id: id }, steps: [], finalUrl: "", found: false };

  function step(name, ok, info) { out.steps.push({ name: name, ok: !!ok, info: info || {} }); }
  function _isHttpUrl_(s) { return typeof s === "string" && /^https?:\/\/?/i.test(s); }
  function _safeCall_(name, arg) {
    try {
      var fn = Function('return ' + name + ';')();
      if (typeof fn === "function") {
        var val = fn(arg);
        step(name, val != null, { fn: name, url: _isHttpUrl_(val) ? val : null });
        return { name: name, value: val };
      } else {
        step(name, false, { fn: name, exists: false });
        return { name: name, value: null };
      }
    } catch (e) {
      step(name, false, { fn: name, error: e.message });
      return { name: name, value: null };
    }
  }
  function _safeChain_(names, arg) {
    for (var i = 0; i < names.length; i++) {
      var r = _safeCall_(names[i], arg);
      if (r.value != null) return r;
    }
    return { name: null, value: null };
  }

  var dbNames = ["DB_getOriginalsUrl", "DriveBuilder_getOriginalsUrl", "DB_getOriginalsFolderUrl", "DriveBuilder_getOriginalsFolderUrl"];
  var db = _safeChain_(dbNames, [ent, id]);
  var dbUrl = "";
  if (db.value) {
    if (typeof db.value === "string" && _isHttpUrl_(db.value)) dbUrl = db.value;
    else if (db.value && typeof db.value === "object" && _isHttpUrl_(db.value.url)) dbUrl = db.value.url;
  }

  var apiNames = ["sv_getOriginalsUrl", "getOriginalsUrl", "sv_getOriginalsFolderUrl", "getOriginalsFolderUrl"];
  var api = _safeChain_(apiNames, { entity: ent, id: id });
  var apiUrl = "";
  if (api.value) {
    if (typeof api.value === "string" && _isHttpUrl_(api.value)) apiUrl = api.value;
    else if (api.value && typeof api.value === "object" && _isHttpUrl_(api.value.url)) apiUrl = api.value.url;
  }

  var root = "";
  try {
    var meta = dp_getProjectMeta() || {};
    root = meta.originals_root_url || meta.proxies_root_url || "";
  } catch (_) { }
  step("ProjectMetaRoot", !!root, { root: root || null });

  out.finalUrl = apiUrl || dbUrl || root || "";
  out.found = !!out.finalUrl;
  return out;
}

var VIEWER_STATE_PROP_PREFIX = 'MOTK_VIEWER_STATE_V1';

function dp_storeViewerState(snapshot) {
  try {
    var snap = _sanitizeViewerSnapshot(snapshot || {});
    try {
      console.log('dp_storeViewerState snapshot', JSON.stringify(snap));
    } catch (_) { }
    var payload = {
      snapshot: snap,
      storedAt: Date.now(),
      user: _currentUserEmail() || 'unknown'
    };
    _persistViewerStatePayload(payload);
    return { ok: true, storedAt: payload.storedAt };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function dp_fetchViewerState() {
  try {
    var payload = _loadViewerStatePayload();
    if (payload && payload.snapshot) {
      return {
        ok: true,
        found: true,
        storedAt: payload.storedAt || null,
        user: payload.user || '',
        snapshot: payload.snapshot
      };
    }
    return { ok: true, found: false };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function _currentUserEmail() {
  var email = '';
  try {
    var act = Session.getActiveUser();
    if (act && typeof act.getEmail === 'function') email = act.getEmail() || '';
  } catch (_) { }
  if (!email) {
    try {
      var eff = Session.getEffectiveUser();
      if (eff && typeof eff.getEmail === 'function') email = eff.getEmail() || '';
    } catch (_) { }
  }
  return email || '';
}

function _viewerStateStorageKey() {
  return VIEWER_STATE_PROP_PREFIX + '::' + (_currentUserEmail() || 'anonymous');
}

function _persistViewerStatePayload(payload) {
  var key = _viewerStateStorageKey();
  var serialized = '';
  try { serialized = JSON.stringify(payload || {}); } catch (_) { serialized = ''; }
  if (!serialized) return;
  try {
    CacheService.getUserCache().put(key, serialized, 60 * 60);
  } catch (_) { }
  try {
    PropertiesService.getUserProperties().setProperty(key, serialized);
  } catch (_) { }
}

function _loadViewerStatePayload() {
  var key = _viewerStateStorageKey();
  var raw = null;
  try {
    raw = CacheService.getUserCache().get(key);
  } catch (_) { }
  if (!raw) {
    try {
      raw = PropertiesService.getUserProperties().getProperty(key);
    } catch (_) { }
  }
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) { }
  return null;
}

function _sanitizeViewerSnapshot(snapshot) {
  var allowed = ['sheetName', 'pageId', 'page', 'perPage', 'rowsLength', 'total', 'dataSource', 'origin', 'entityParam', 'pageParam', 'pidParam', 'statusText', 'rowsStart', 'rowsEnd', 'sampleIds'];
  var out = {};
  for (var i = 0; i < allowed.length; i++) {
    var key = allowed[i];
    if (snapshot.hasOwnProperty(key)) {
      out[key] = snapshot[key];
    }
  }
  out.capturedAt = snapshot.capturedAt || new Date().toISOString();
  return out;
}

function loadAppData() {
  var props = PropertiesService.getScriptProperties();
  var loadedKey = 'data_loaded';
  if (props.getProperty(loadedKey)) {
    console.log('Data already simulated. Skipping.');
    return;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var metaSh = ss.getSheetByName('project_meta');
    if (metaSh) {
      var metaData = metaSh.getRange(1, 1, 2, metaSh.getLastColumn()).getValues();
      var meta = {};
      metaData[0].forEach(function (k, i) { meta[String(k).toLowerCase()] = metaData[1][i]; });
      console.log('GSS meta read: originals_root_url=' + (meta.originals_root_url || 'unset'));
    }
  } catch (e) {
    console.error('GSS read error: ' + e.message);
  }

  props.setProperty(loadedKey, 'true');
  console.log('Read-only load complete: No GSS changes. Use dp_loadAppData for debug verification.');
}

function getFieldTypes(entity) {
  try {
    var targetKey = '';
    if (entity != null && String(entity).trim()) {
      targetKey = _normalizeEntityParams_({ entity: entity }).entity;
    }

    var rows = _readFields_();
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
      var label = String(r.label || '').trim();
      var editable = _normBool_(r.editable);
      var required = _normBool_(r.required);
      var options = _parseOptions_(r.options);

      if (!types[entKey]) types[entKey] = {};
      types[entKey][fid] = {
        label: label,
        type: type,
        editable: editable,
        required: required,
        options: options
      };
    }

    return types;
  } catch (e) {
    console.error('getFieldTypes error: ' + e.message);
    return {};
  }
}

function dp_loadAppData() {
  try {
    var linkMaps = typeof sv_getLinkMaps === 'function' ? sv_getLinkMaps() : { assets: {}, shots: {}, tasks: {}, users: {}, members: {} };
    var fieldTypes = getFieldTypes();
    var meta = typeof _sv_getMeta_ === 'function' ? _sv_getMeta_({}) : {};

    var counts = { assets: Object.keys(linkMaps.assets || {}).length, shots: Object.keys(linkMaps.shots || {}).length, tasks: Object.keys(linkMaps.tasks || {}).length, users: Object.keys(linkMaps.users || {}).length, members: Object.keys(linkMaps.members || {}).length };
    var fieldKeys = Object.keys(fieldTypes).reduce(function (acc, ent) { return acc + Object.keys(fieldTypes[ent] || {}).length; }, 0);

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
