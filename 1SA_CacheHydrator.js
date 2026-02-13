/* ===== TAKE84: Cache Hydrator ===== */
/* * Role:
 * 1. Scheduled cache warming (Originals URL, Proxy Index)
 */

/* =========================================
 * Part 1: Scheduled Hydration (Originals/Proxy)
 * ========================================= */

function SA_installCacheHydratorTriggers() {
  SA_uninstallCacheHydratorTriggers();
  var trigger = ScriptApp.newTrigger('SA_runCacheHydrationDaily')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
  return { ok: true, triggerId: trigger.getUniqueId() };
}

function SA_uninstallCacheHydratorTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'SA_runCacheHydrationDaily') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return { ok: true, removed: removed };
}

function SA_removeLegacyHydratorTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = [];
  var targets = [
    'SA_runCacheHydrationDaily',
    'SA_hydrateProxyIndexLatest',
    'SA_hydrateOriginalsUrls'
  ];
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (targets.indexOf(fn) >= 0) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed.push(fn);
    }
  }
  try { Logger.log('[MOTK][Hydrator] removed triggers=%s', JSON.stringify(removed)); } catch (_) { }
  return { ok: true, removed: removed };
}

function SA_runCacheHydrationDaily() {
  var t0 = Date.now();
  var originals = SA_hydrateOriginalsUrls();
  var proxyIndex = SA_hydrateProxyIndexLatest();
  var out = {
    ok: true,
    ms: Date.now() - t0,
    originals: originals,
    proxyIndex: proxyIndex
  };
  try { Logger.log('[MOTK][Hydrator] %s', JSON.stringify(out)); } catch (_) { }
  return out;
}

function SA_hydrateOriginalsUrls() {
  var results = [];
  var entities = [
    { entity: 'shot', sheet: 'Shots', idPrefix: 'sh' },
    { entity: 'asset', sheet: 'Assets', idPrefix: 'as' },
    { entity: 'task', sheet: 'Tasks', idPrefix: 'tk' }
  ];
  for (var i = 0; i < entities.length; i++) {
    results.push(_hydrateOriginalsForEntity_(entities[i]));
  }
  return { ok: true, results: results };
}

function _hydrateOriginalsForEntity_(cfg) {
  var t0 = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(cfg.sheet);
  if (!sh) return { ok: false, entity: cfg.entity, reason: 'missing-sheet' };

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 3 || lastCol < 1) return { ok: true, entity: cfg.entity, reason: 'empty-sheet', updated: 0 };

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var labelRow = sh.getRange(2, 1, 1, lastCol).getValues()[0] || [];

  var idCol = _findIdColIndex_(header, labelRow, cfg.entity);
  if (idCol < 0) return { ok: false, entity: cfg.entity, reason: 'missing-id-col' };

  var origCol = _findOriginalsColIndex_(header, labelRow, cfg.entity);
  if (origCol < 0) return { ok: false, entity: cfg.entity, reason: 'missing-originals-col' };

  var rootFolderId = _getOriginalsRootFolderId_();
  if (!rootFolderId) return { ok: false, entity: cfg.entity, reason: 'missing-root-folder' };

  var rootFolder = DriveApp.getFolderById(rootFolderId);
  var entityRoot = _resolveEntityRootFolder_(rootFolder, cfg.entity);
  var map = _buildFolderMap_(entityRoot, cfg.entity, cfg.idPrefix);

  var rowCount = lastRow - 2;
  var ids = sh.getRange(3, idCol + 1, rowCount, 1).getValues();
  var originals = sh.getRange(3, origCol + 1, rowCount, 1).getValues();

  var updated = 0;
  var unchanged = 0;
  var missing = 0;
  var invalidCleared = 0;
  var validCache = {};

  for (var r = 0; r < rowCount; r++) {
    var rid = String(ids[r][0] || '').trim();
    if (!rid) continue;

    var cur = String(originals[r][0] || '').trim();
    if (cur) {
      var curId = _extractFolderIdFromUrl_(cur);
      var isValid = curId ? _isFolderIdValid_(curId, validCache) : false;
      if (!isValid) {
        originals[r][0] = '';
        invalidCleared++;
      } else {
        unchanged++;
      }
      continue;
    }

    var url = map[rid] || '';
    if (url) {
      var mapId = _extractFolderIdFromUrl_(url);
      if (mapId) _isFolderIdValid_(mapId, validCache);
      originals[r][0] = url;
      updated++;
    } else {
      missing++;
    }
  }

  if (updated > 0 || invalidCleared > 0) {
    sh.getRange(3, origCol + 1, rowCount, 1).setValues(originals);
  }

  var summary = {
    ok: true,
    entity: cfg.entity,
    sheet: cfg.sheet,
    updated: updated,
    unchanged: unchanged,
    missing: missing,
    invalidCleared: invalidCleared,
    ms: Date.now() - t0
  };
  try { Logger.log('[MOTK][Originals][Hydrate] %s', JSON.stringify(summary)); } catch (_) { }
  return summary;
}

function _buildFolderMap_(rootFolder, entityKey, idPrefix) {
  var map = {};
  var it = rootFolder.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var name = String(f.getName() || '');
    var id = _extractEntityIdFromName_(name, entityKey, idPrefix);
    if (!id) continue;
    if (!map[id]) map[id] = 'https://drive.google.com/drive/folders/' + f.getId();
  }
  return map;
}

function _extractEntityIdFromName_(name, entityKey, idPrefix) {
  var s = String(name || '');
  var prefix = String(idPrefix || '').toLowerCase();
  if (!prefix) return '';
  var re = new RegExp('(?:^|[^a-z0-9])(' + prefix + ')[_-]?(\\d{3,6})(?=[^0-9]|$)', 'i');
  var m = s.match(re);
  if (!m) return '';
  var num = String(m[2] || '').padStart(4, '0');
  return prefix + '_' + num;
}

function _resolveEntityRootFolder_(rootFolder, entityKey) {
  var hints = {
    shot: ['shot', 'shots', '01shots'],
    asset: ['asset', 'assets', '02assets'],
    task: ['task', 'tasks', '03tasks']
  };
  var list = hints[String(entityKey || '').toLowerCase()] || [];
  if (!list.length) return rootFolder;
  var it = rootFolder.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var name = String(f.getName() || '').toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (name.indexOf(list[i]) >= 0) return f;
    }
  }
  return rootFolder;
}

function _findOriginalsColIndex_(header, labelRow, entityKey) {
  var fidKey = schemaGetFidByFieldName(entityKey, 'Originals URL');
  var idx = schemaGetColIndexByFid(header, fidKey);
  if (idx >= 0) return idx;
  for (var j = 0; j < labelRow.length; j++) {
    var label = String(labelRow[j] || '').toLowerCase();
    if (label.indexOf('originals') >= 0) return j;
  }
  return -1;
}

function _findIdColIndex_(header, labelRow, entityKey) {
  for (var i = 0; i < labelRow.length; i++) {
    var label = String(labelRow[i] || '').toLowerCase();
    if (label === 'id' || /\bid\b/.test(label)) return i;
  }
  var fid = schemaGetIdFid(entityKey);
  var idx = schemaGetColIndexByFid(header, fid);
  if (idx >= 0) return idx;
  return -1;
}

function _getOriginalsRootFolderId_() {
  var rootUrl = _getProjectMetaValue_('originals_root_url')
    || _getProjectMetaValue_('originalsRootUrl')
    || _getProjectMetaValue_('originalsRootId')
    || _getProjectMetaValue_('proxies_root_url')
    || '';
  return _extractFolderIdFromUrl_(rootUrl);
}

function _getProjectMetaValue_(key) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function readFromSheet_(sh, wantKey) {
    if (!sh) return '';
    var data = sh.getDataRange().getValues();
    if (!data || !data.length) return '';
    var a1 = String(data[0][0] || '').toLowerCase().trim();
    var b1 = String((data[0][1] != null ? data[0][1] : '')).toLowerCase().trim();
    if (a1 === 'meta_key' && b1 === 'meta_value') {
      for (var r = 1; r < data.length; r++) {
        var mk = String(data[r][0] || '').trim();
        if (mk === wantKey) return String(data[r][1] || '').trim();
      }
      return '';
    }
    if (data.length < 2) return '';
    var header = data[0] || [];
    var keyCol = -1;
    var valCol = -1;
    for (var i = 0; i < header.length; i++) {
      var h = String(header[i] || '').toLowerCase();
      if (h === 'key') keyCol = i;
      if (h === 'value') valCol = i;
    }
    if (keyCol >= 0 && valCol >= 0) {
      for (var r2 = 1; r2 < data.length; r2++) {
        var k2 = String(data[r2][keyCol] || '').trim();
        if (k2 === wantKey) return String(data[r2][valCol] || '').trim();
      }
      return '';
    }
    var keys = data[0] || [];
    var vals = data[1] || [];
    for (var c = 0; c < keys.length; c++) {
      var kk = String(keys[c] || '').trim().toLowerCase();
      if (kk === String(wantKey || '').toLowerCase()) return String(vals[c] || '').trim();
    }
    return '';
  }

  var val = readFromSheet_(ss.getSheetByName('project_meta'), key);
  if (val) return val;
  return readFromSheet_(ss.getSheetByName('ProjectMeta'), key);
}

function _extractFolderIdFromUrl_(val) {
  var s = String(val || '').trim();
  if (!s) return '';
  var m = s.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  var m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return m2[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s;
  return '';
}

function _isFolderIdValid_(folderId, cache) {
  if (!folderId) return false;
  if (cache && Object.prototype.hasOwnProperty.call(cache, folderId)) return cache[folderId];
  var ok = false;
  try {
    var f = DriveApp.getFolderById(folderId);
    ok = !!(f && f.getName());
  } catch (_) { ok = false; }
  if (cache) cache[folderId] = ok;
  return ok;
}

function SA_hydrateProxyIndexLatest() {
  var t0 = Date.now();
  var base = sv_indexAllProxies({ bypassCache: true }) || {};
  var count = 0;
  try {
    if (base.latestByShotId) count = Object.keys(base.latestByShotId).length;
    else if (Array.isArray(base.items)) count = base.items.length;
  } catch (_) { }
  var out = {
    ok: true,
    ms: Date.now() - t0,
    mode: (base.diag && base.diag.mode) || (base.diag && base.diag.hit) || "drive_scan",
    count: count
  };
  try { Logger.log('[MOTK][ProxyIndex][Warm] %s', JSON.stringify(out)); } catch (_) { }
  return out;
}
