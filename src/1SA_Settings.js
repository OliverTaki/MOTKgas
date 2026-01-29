// =============================================================
// 1SA_Settings.gs   (MOTK Settings / ProjectMeta editor)
// =============================================================
//
// Provides:
//  - read/update project_meta (fixed schema)
//  - create project_meta rows
//  - run hydrate originals urls
//  - DriveBuilder diff/fix entry points (optional)
//
// NOTE:
//  - Requires Spreadsheet scope (already) and Drive scope for folder ops.
//  - Uses getHostSpreadsheet_() if present; otherwise includes safe fallback.
//
// =============================================================

var PROJECT_META_SHEET_NAME = 'project_meta';
var PROJECT_META_FIELDS = ['meta_key', 'meta_value', 'meta_type', 'note', 'updated_at'];
var PROJECT_META_REQUIRED = ['meta_key', 'meta_value', 'meta_type', 'note'];

/** ---------- Public API (called from Settings page) ---------- */

function SA_settings_getAll() {
  var access = _settings_requireAccess_({ returnObject: true });
  if (!access.ok) return access;
  var ss = _settings_getHostSpreadsheet_();
  var sh = _settings_getProjectMetaSheet_(ss);
  var colMap = _settings_getProjectMetaColMap_(sh);
  var rows = _settings_readProjectMetaRows_(sh, colMap);
  return {
    ok: true,
    rows: rows
  };
}

function SA_settings_updateMetaField(rowId, field, value) {
  _settings_requireAccess_();
  var rowNum = Number(rowId);
  if (!isFinite(rowNum) || rowNum < 2) throw new Error('rowId is required');
  var key = String(field || '').trim();
  if (!key) throw new Error('field is required');
  if (key === 'updated_at') throw new Error('updated_at is read-only');
  if (PROJECT_META_REQUIRED.indexOf(key) >= 0) {
    var v = String(value != null ? value : '').trim();
    if (!v) throw new Error(key + ' is required');
  }
  var ss = _settings_getHostSpreadsheet_();
  var sh = _settings_getProjectMetaSheet_(ss);
  var colMap = _settings_getProjectMetaColMap_(sh);
  if (!colMap.hasOwnProperty(key)) throw new Error('unknown field: ' + key);

  sh.getRange(rowNum, colMap[key]).setValue(value);
  sh.getRange(rowNum, colMap.updated_at).setValue(_settings_nowIso_());

  return { ok: true, rowId: rowNum, field: key };
}

function SA_settings_updateMetaRow(rowId, rowObj) {
  _settings_requireAccess_();
  if (!rowObj || typeof rowObj !== 'object') throw new Error('rowObj must be an object');
  var rowNum = Number(rowId);
  if (!isFinite(rowNum) || rowNum < 2) throw new Error('rowId is required');

  var ss = _settings_getHostSpreadsheet_();
  var sh = _settings_getProjectMetaSheet_(ss);
  var colMap = _settings_getProjectMetaColMap_(sh);

  PROJECT_META_REQUIRED.forEach(function (k) {
    var v = String(rowObj[k] != null ? rowObj[k] : '').trim();
    if (!v) throw new Error(k + ' is required');
  });

  PROJECT_META_REQUIRED.forEach(function (k) {
    if (!colMap.hasOwnProperty(k)) throw new Error('unknown field: ' + k);
    sh.getRange(rowNum, colMap[k]).setValue(rowObj[k]);
  });
  sh.getRange(rowNum, colMap.updated_at).setValue(_settings_nowIso_());

  return { ok: true, rowId: rowNum };
}

function SA_settings_createMetaRow(rowObj) {
  _settings_requireAccess_();
  if (!rowObj || typeof rowObj !== 'object') throw new Error('rowObj must be an object');
  PROJECT_META_REQUIRED.forEach(function (k) {
    var v = String(rowObj[k] != null ? rowObj[k] : '').trim();
    if (!v) throw new Error(k + ' is required');
  });

  var ss = _settings_getHostSpreadsheet_();
  var sh = _settings_getProjectMetaSheet_(ss);
  var colMap = _settings_getProjectMetaColMap_(sh);
  var now = _settings_nowIso_();
  var row = [
    rowObj.meta_key,
    rowObj.meta_value,
    rowObj.meta_type,
    rowObj.note,
    now
  ];
  sh.getRange(sh.getLastRow() + 1, 1, 1, PROJECT_META_FIELDS.length).setValues([row]);
  return { ok: true };
}

/**
 * Run hydrate (existing SA_hydrateOriginalsUrls is assumed).
 * entity: 'shot'|'asset'|'task' or empty for all (depends on your hydrate impl).
 */
function SA_settings_runHydrate(entity) {
  _settings_requireAccess_();
  if (typeof SA_hydrateOriginalsUrls !== 'function') {
    throw new Error('SA_hydrateOriginalsUrls() not found');
  }

  var e = String(entity || '').trim();
  var started = new Date().toISOString();
  var res;
  try {
    if (!e) res = SA_hydrateOriginalsUrls();
    else res = SA_hydrateOriginalsUrls(e);
  } catch (err) {
    throw new Error('Hydrate failed: ' + err);
  }
  return { ok: true, startedAt: started, result: res };
}

/** DriveBuilder helpers (optional) */
function SA_settings_driveDiff(entity) {
  _settings_requireAccess_();
  if (typeof diffEntityFolders !== 'function') throw new Error('diffEntityFolders() not found (DriveBuilder.gs)');
  var e = _settings_normalizeEntityKey_(entity);
  return { ok: true, entity: e, diff: diffEntityFolders(e) };
}

function SA_settings_driveFixMissing(entity, limit) {
  _settings_requireAccess_();
  if (typeof fixMissingEntityFolders !== 'function') throw new Error('fixMissingEntityFolders() not found (DriveBuilder.gs)');
  var e = _settings_normalizeEntityKey_(entity);
  var lim = limit === undefined || limit === null || limit === '' ? undefined : Number(limit);
  if (lim !== undefined && (!isFinite(lim) || lim < 1)) throw new Error('limit must be a positive number');
  var out = lim === undefined ? fixMissingEntityFolders(e) : fixMissingEntityFolders(e, lim);
  return { ok: true, entity: e, result: out };
}

function SA_settings_canAccess_() {
  var ss = _settings_getHostSpreadsheet_();
  var info = _settings_getAccessInfo_(ss);
  return !!info.allowed;
}

/** ---------- Internal (auth) ---------- */

function _settings_requireAccess_(opts) {
  var ss = _settings_getHostSpreadsheet_();
  var info = _settings_getAccessInfo_(ss);
  if (!info.allowed) {
    var errObj = {
      ok: false,
      reason: 'role_denied',
      email: info.email || null
    };
    if (opts && opts.returnObject) return errObj;
    throw new Error(JSON.stringify(errObj));
  }
  return { ok: true, email: info.email || null };
}

function _settings_getAccessInfo_(ss) {
  var email = _settings_resolveRequesterIdentity_();
  Logger.log('[SettingsAuth] resolved_email=%s', email || '(empty)');
  if (!email) return { allowed: false, email: '' };
  var perm = _settings_getUserPermissionByEmail_(ss, email);
  var perms = String(perm || '').trim().toLowerCase();
  Logger.log('[SettingsAuth] users_hit=%s permission=%s', perms ? 'yes' : 'no', perms || '(empty)');
  var allowed = (perms === 'admin' || perms === 'manager');
  return { allowed: allowed, email: email, permissions: perms };
}

function _settings_resolveRequesterIdentity_() {
  try {
    if (Session.getActiveUser && Session.getActiveUser().getEmail) {
      return String(Session.getActiveUser().getEmail() || '').trim();
    }
  } catch (_) { }
  try {
    if (Session.getEffectiveUser && Session.getEffectiveUser().getEmail) {
      return String(Session.getEffectiveUser().getEmail() || '').trim();
    }
  } catch (_) { }
  return '';
}

function _settings_getUserPermissionByEmail_(ss, email) {
  var sh = ss.getSheetByName('Users');
  if (!sh) return '';
  var header = _settings_getHeaders_(sh);
  var fidEmail = schemaGetFidByFieldName('user', 'Email');
  var fidPerm = schemaGetFidByFieldName('user', 'permission');
  var colEmail = _settings_findColumn_(header, [fidEmail, /email/i]);
  var colPerm = _settings_findColumn_(header, [fidPerm, /permission/i, /permissions/i, /role/i]);
  if (colEmail < 0) throw new Error('Users sheet missing email column');
  if (colPerm < 0) throw new Error('Users sheet missing permission column');
  var lastRow = sh.getLastRow();
  if (lastRow < 3) return '';
  var width = Math.max(colEmail, colPerm) + 1;
  var rows = sh.getRange(3, 1, lastRow - 2, width).getValues();
  var emailLc = String(email || '').trim().toLowerCase();
  for (var r = 0; r < rows.length; r++) {
    var rowEmail = String(rows[r][colEmail] || '').trim().toLowerCase();
    if (rowEmail && rowEmail === emailLc) return String(rows[r][colPerm] || '').trim();
  }
  return '';
}

function _settings_getUserEmail_() {
  return _settings_resolveRequesterIdentity_();
}

/** ---------- Internal (project_meta read/write) ---------- */

function _settings_getHostSpreadsheet_() {
  if (typeof getHostSpreadsheet_ === 'function') return getHostSpreadsheet_();
  var id = PropertiesService.getScriptProperties().getProperty('HOST_SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No bound Spreadsheet. Run installHostSpreadsheet() once.');
  PropertiesService.getScriptProperties().setProperty('HOST_SS_ID', ss.getId());
  return ss;
}

function _settings_getProjectMetaSheet_(ss) {
  var sh = ss.getSheetByName(PROJECT_META_SHEET_NAME);
  if (!sh) throw new Error('project_meta sheet not found');
  return sh;
}

function _settings_getProjectMetaColMap_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error('project_meta header missing');
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var map = {};
  PROJECT_META_FIELDS.forEach(function (k) {
    var idx = header.findIndex(function (h) { return String(h || '').trim() === k; });
    if (idx < 0) throw new Error('project_meta missing column: ' + k);
    map[k] = idx + 1;
  });
  return map;
}

function _settings_readProjectMetaRows_(sh, colMap) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sh.getLastColumn();
  var rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var rowNum = i + 2;
    var row = rows[i];
    var key = String(row[colMap.meta_key - 1] || '').trim();
    if (!key) continue;
    out.push({
      row: rowNum,
      meta_key: row[colMap.meta_key - 1],
      meta_value: row[colMap.meta_value - 1],
      meta_type: row[colMap.meta_type - 1],
      note: row[colMap.note - 1],
      updated_at: row[colMap.updated_at - 1]
    });
  }
  return out;
}

function _settings_getHeaders_(sh) {
  var lastCol = sh.getLastColumn();
  if (!lastCol) return { row1: [], row2: [] };
  var row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var row2 = sh.getLastRow() >= 2 ? (sh.getRange(2, 1, 1, lastCol).getValues()[0] || []) : [];
  return { row1: row1, row2: row2 };
}

function _settings_findColumn_(header, patterns) {
  var row1 = header.row1 || [];
  var row2 = header.row2 || [];
  for (var i = 0; i < row1.length; i++) {
    var h1 = String(row1[i] || '').trim();
    if (_settings_matchAny_(h1, patterns)) return i;
  }
  for (var j = 0; j < row2.length; j++) {
    var h2 = String(row2[j] || '').trim();
    if (_settings_matchAny_(h2, patterns)) return j;
  }
  return -1;
}

function _settings_matchAny_(value, patterns) {
  var v = String(value || '').trim();
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (p instanceof RegExp) {
      if (p.test(v)) return true;
    } else if (String(p || '').toLowerCase() === v.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function _settings_nowIso_() {
  return new Date().toISOString();
}

function _settings_normalizeEntityKey_(entity) {
  var e = String(entity || '').trim().toLowerCase();
  if (!e) throw new Error('entity is required');
  if (e === 'shots') e = 'shot';
  if (e === 'assets') e = 'asset';
  if (e === 'tasks') e = 'task';
  if (e !== 'shot' && e !== 'asset' && e !== 'task') throw new Error('invalid entity: ' + entity);
  return e;
}
