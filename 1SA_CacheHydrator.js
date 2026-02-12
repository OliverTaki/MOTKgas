/* ===== TAKE84 + v3 FastBoot: Cache Hydrator & BootCache Storage ===== */
/* * 役割:
 * 1. 定期実行によるキャッシュ暖機 (Originals URL, Proxy Index)
 * 2. v3 Fast Boot のための BootCache シートへの読み書き (sv_saveBootPack, sv_getBootPack)
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


/* =========================================
 * Part 2: BootCache Storage (v3 FastBoot)
 * ========================================= */

const BOOT_CACHE_SHEET_NAME = 'BootCache';
const BC_HEADERS = [
  'Key',          // A
  'Kind',         // B
  'Entity',       // C
  'PageId',       // D
  'SchemaSig',    // E
  'PageSig',      // F
  'ChunkIndex',   // G
  'ChunkCount',   // H
  'UpdatedAt',    // I
  'PayloadChunk'  // J
];

/**
 * 公開API: BootPackを取得する
 * @param {Object} request { key: "bp:..." }
 */
function sv_getBootPack_v3(request) {
  const key = request && request.key;
  if (!key) return { ok: false, reason: 'no-key' };

  try {
    const sh = _getBootCacheSheet_();
    if (!sh) return { ok: false, reason: 'no-sheet' };

    // 全データを取得してメモリ上でフィルタ（GASの行数制限内ならこれが最速）
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { ok: false, reason: 'empty' };

    // ヘッダ行を除外してキーで検索
    const rows = data.slice(1).filter(r => r[0] === key);
    if (!rows.length) return { ok: false, reason: 'miss' };

    // チャンクを結合
    rows.sort((a, b) => Number(a[6]) - Number(b[6])); 
    
    // 整合性チェック
    const count = Number(rows[0][7]);
    if (rows.length !== count) {
      return { ok: false, reason: 'broken-chunks' };
    }

    let joinedJson = '';
    for (let i = 0; i < rows.length; i++) {
      joinedJson += String(rows[i][9]); // J列
    }

    const payload = JSON.parse(joinedJson);
    return {
      ok: true,
      payload: payload,
      meta: {
        updatedAt: rows[0][8],
        schemaSig: rows[0][4],
        pageSig: rows[0][5],
        source: 'sheet-boot-cache'
      }
    };

  } catch (e) {
    console.warn('[BootCache] get failed', e);
    return { ok: false, reason: 'error', message: e.message };
  }
}

/**
 * 公開API: BootPackを保存する
 * @param {Object} params { key, kind, entity, pageId, schemaSig, pageSig, payload }
 */
function sv_saveBootPack_v3(params) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: 'lock-timeout' };

  try {
    const sh = _ensureBootCacheSheet_();
    const key = params.key;
    const json = JSON.stringify(params.payload || {});
    const now = new Date().toISOString();
    
    // 既存のエントリを削除
    _deleteRowsByKey_(sh, key);

    // チャンク分割 (40k文字)
    const chunkSize = 40000;
    const chunks = [];
    for (let i = 0; i < json.length; i += chunkSize) {
      chunks.push(json.substring(i, i + chunkSize));
    }

    const newRows = chunks.map((chunk, idx) => {
      return [
        key,
        params.kind || 'BOOTPACK',
        params.entity || '',
        params.pageId || '',
        params.schemaSig || '',
        params.pageSig || '',
        idx,
        chunks.length,
        now,
        chunk
      ];
    });

    if (newRows.length > 0) {
      sh.getRange(sh.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    
    // お掃除
    _pruneBootCache_(sh);

    return { ok: true, chunks: chunks.length };

  } catch (e) {
    console.error('[BootCache] save failed', e);
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function _getBootCacheSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BOOT_CACHE_SHEET_NAME);
}

function _ensureBootCacheSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(BOOT_CACHE_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(BOOT_CACHE_SHEET_NAME);
    sh.getRange(1, 1, 1, BC_HEADERS.length).setValues([BC_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _deleteRowsByKey_(sh, key) {
  // TextFinderでキー一致行を全削除
  const finder = sh.getRange("A:A").createTextFinder(key).matchEntireCell(true);
  const ranges = finder.findAll();
  // 逆順ループで削除
  for (let i = ranges.length - 1; i >= 0; i--) {
    const row = ranges[i].getRow();
    if (row > 1) sh.deleteRow(row);
  }
}

function _pruneBootCache_(sh) {
  const maxRows = 3000;
  const deleteCount = 500;
  const lastRow = sh.getLastRow();
  
  if (lastRow > maxRows) {
    // 追記型なので上(古いもの)から削除
    sh.deleteRows(2, deleteCount);
  }
}
