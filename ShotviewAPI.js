/** ShotviewAPI.gs — JSONセーフ返却 + フォルダ全量インデックス対応
 * - 単一: sv_listEntityProxies({id, projectMeta}) → 常に配列（0件でも []）
 * - バッチ: sv_listLatestProxyBatch({ids, projectMeta}) → 常に {id: file|null, ...}
 * - 全量: sv_indexAllProxies({projectMeta}) → { items: File[], latestByShotId: { [shotId]: File } }
 * 返り値は純JSON（プリミティブのみ）。modifiedTimeはISO文字列。
 */

// ---------- 小物 ----------
function _sv_norm_(s){
  return String(s||'').replace(/\u3000/g,' ')
    .replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
}
function _sv_extractFolderId_(url){
  if (!url) throw new Error('ShotviewAPI: proxies_root_url is empty');
  var m = String(url).match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  var m2 = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  throw new Error('ShotviewAPI: invalid folder url: '+url);
}
function _iso_(d){
  try {
    var dt = (d instanceof Date) ? d : new Date(d);
    return new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString();
  } catch(e){
    return new Date().toISOString();
  }
}
function _jsonSafe_(v){ return JSON.parse(JSON.stringify(v)); }

// ---------- meta ----------
function _sv_getMeta_(incoming){
  if (incoming && incoming.proxies_root_url) return incoming;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('ShotviewAPI: active spreadsheet not found');
  var sh = ss.getSheetByName('project_meta');
  if (!sh) throw new Error('ShotviewAPI: project_meta sheet not found');
  var data = sh.getRange(1,1,2,sh.getLastColumn()).getValues();
  var meta = {};
  data[0].forEach(function(k,i){ meta[k] = data[1][i]; });
  if (!meta.proxies_root_url) throw new Error('ShotviewAPI: proxies_root_url missing');
  return meta;
}

// ---------- 整形 ----------
function _fromDriveV2_(f){
  return {
    id:           String(f.id || ''),
    name:         String(f.title || f.name || ''),
    mimeType:     String(f.mimeType || ''),
    modifiedTime: _iso_(f.modifiedDate || f.modifiedTime || Date.now()),
    size:         Number(f.fileSize || f.size || 0)
  };
}
function _fromDriveApp_(f){
  return {
    id:           String(f.getId() || ''),
    name:         String(f.getName() || ''),
    mimeType:     String(f.getMimeType() || ''),
    modifiedTime: _iso_(f.getLastUpdated()),
    size:         Number(f.getSize() || 0)
  };
}
function _preferPrefixAndMtime_(arr, idLc){
  return arr.slice().sort(function(a,b){
    var al = String(a.name||'').toLowerCase();
    var bl = String(b.name||'').toLowerCase();
    var ap = al.indexOf(idLc + '_') === 0 ? 1 : 0;
    var bp = bl.indexOf(idLc + '_') === 0 ? 1 : 0;
    if (ap !== bp) return bp - ap; // prefix一致を優先
    return new Date(b.modifiedTime) - new Date(a.modifiedTime);
  });
}

// ---------- shotId 推定（修正ポイント） ----------
function _guessShotId_(name){
  var s = String(name||'').toLowerCase();
  // 末尾が '_' でも直後が英数字でもOKにする：数字の直後を「非数字 or 末尾」で判定
  // 例: sh_0002_2025..., sh-0003.mp4, shot_0123-proxy など
  var m = s.match(/(?:^|[^a-z0-9])(sh|shot)[_-]?(\d{3,6})(?=[^0-9]|$)/i);
  if (!m) return null;
  var num = (m[2]||'').padStart(4,'0');
  return 'sh_' + num;
}

// ---------- 検索（フォルダ限定） ----------
function _listViaDriveV2_inFolder_(folderId, id){
  try{
    var q = [
      "trashed = false",
      "'" + folderId + "' in parents",
      "(title contains '_proxy.' or title contains '_ver_proxy.')",
      "title contains '" + _sv_norm_(id).replace(/'/g,"\\'") + "'"
    ].join(" and ");
    var opt = {
      q: q, maxResults: 200, orderBy: "modifiedDate desc",
      supportsAllDrives: true, includeItemsFromAllDrives: true
    };
    var res = Drive.Files.list(opt); // Advanced Drive v2
    var items = (res && res.items) ? res.items : [];
    return items.map(_fromDriveV2_);
  } catch(e){ return []; }
}
function _listViaDriveApp_inFolder_(folderId, id){
  var out = [], idLc = String(id||'').toLowerCase(); if (!idLc) return out;
  try{
    var folder = DriveApp.getFolderById(folderId);
    var it = folder.getFiles();
    while (it.hasNext()){
      var f = it.next(), n = String(f.getName()||''), nl = n.toLowerCase();
      if (nl.indexOf(idLc) === -1) continue;
      if (!(nl.indexOf('_proxy.') !== -1 || nl.indexOf('_ver_proxy.') !== -1)) continue;
      out.push(_fromDriveApp_(f));
    }
  } catch(e){}
  return _preferPrefixAndMtime_(out, idLc);
}

// ---------- 検索（全ドライブ） ----------
function _listGlobalViaDriveV2_(id){
  try{
    var q = [
      "trashed = false",
      "(title contains '_proxy.' or title contains '_ver_proxy.')",
      "title contains '" + _sv_norm_(id).replace(/'/g,"\\'") + "'"
    ].join(" and ");
    var opt = {
      q: q, maxResults: 200, orderBy: "modifiedDate desc",
      supportsAllDrives: true, includeItemsFromAllDrives: true
    };
    var res = Drive.Files.list(opt);
    var items = (res && res.items) ? res.items : [];
    var arr = items.map(_fromDriveV2_);
    var idLc = String(id||'').toLowerCase();
    return _preferPrefixAndMtime_(arr, idLc);
  } catch(e){ return []; }
}
function _searchWholeDrive_(id){
  var out = [], idLc = String(id||'').toLowerCase(); if (!idLc) return out;
  try{
    var q = "title contains '" + _sv_norm_(id).replace(/'/g,"\\'") + "' and trashed = false";
    var it = DriveApp.searchFiles(q);
    while (it.hasNext()){
      var f = it.next(), n = String(f.getName()||''), nl = n.toLowerCase();
      if (!(nl.indexOf('_proxy.') !== -1 || nl.indexOf('_ver_proxy.') !== -1)) continue;
      out.push(_fromDriveApp_(f));
      if (out.length >= 400) break;
    }
  } catch(e){}
  return _preferPrefixAndMtime_(out, idLc);
}

// ---------- 全量インデックス（フォルダ直下） ----------
function _listAllInFolder_driveV2_(folderId){
  var arr = [];
  try{
    var q = [
      "trashed = false",
      "'" + folderId + "' in parents",
      "(title contains '_proxy.' or title contains '_ver_proxy.')"
    ].join(" and ");
    var pageToken = null;
    do {
      var opt = {
        q: q, maxResults: 1000, orderBy: "modifiedDate desc",
        pageToken: pageToken,
        supportsAllDrives: true, includeItemsFromAllDrives: true
      };
      var res = Drive.Files.list(opt);
      var items = (res && res.items) ? res.items : [];
      for (var i=0;i<items.length;i++) arr.push(_fromDriveV2_(items[i]));
      pageToken = res && res.nextPageToken ? res.nextPageToken : null;
    } while(pageToken);
  } catch(e){}
  return arr;
}
function _listAllInFolder_driveApp_(folderId){
  var arr = [];
  try{
    var folder = DriveApp.getFolderById(folderId);
    var it = folder.getFiles();
    while (it.hasNext()){
      var f = it.next();
      var n = String(f.getName()||'').toLowerCase();
      if (n.indexOf('_proxy.') === -1 && n.indexOf('_ver_proxy.') === -1) continue;
      arr.push(_fromDriveApp_(f));
    }
  } catch(e){}
  arr.sort(function(a,b){ return new Date(b.modifiedTime) - new Date(a.modifiedTime); });
  return arr;
}

// ---------- 公開API：単一 ----------
function sv_listEntityProxies(req){
  try{
    var r = req || {};
    var id = _sv_norm_(r.id || '');
    if (!id) return _jsonSafe_([]);
    var meta = _sv_getMeta_(r.projectMeta);
    var folderId = _sv_extractFolderId_(meta.proxies_root_url);

    var result = _listViaDriveV2_inFolder_(folderId, id);
    if (!result.length) result = _listViaDriveApp_inFolder_(folderId, id);
    if (!result.length) result = _listGlobalViaDriveV2_(id);
    if (!result.length) result = _searchWholeDrive_(id);

    return _jsonSafe_(Array.isArray(result) ? result : []);
  } catch(e){
    return _jsonSafe_([]);
  }
}

// ---------- 公開API：バッチ（既存互換） ----------
function sv_listLatestProxyBatch(req){
  var out = {};
  try{
    var ids = (req && Array.isArray(req.ids)) ? req.ids : [];
    var meta = _sv_getMeta_(req && req.projectMeta);
    var folderId = _sv_extractFolderId_(meta.proxies_root_url);

    for (var i=0; i<ids.length; i++){
      var raw = ids[i];
      var id = _sv_norm_(raw);
      var hits = [];
      if (id){
        hits = _listViaDriveV2_inFolder_(folderId, id);
        if (!hits.length) hits = _listViaDriveApp_inFolder_(folderId, id);
        if (!hits.length) hits = _listGlobalViaDriveV2_(id);
        if (!hits.length) hits = _searchWholeDrive_(id);
      }
      out[raw] = hits.length ? hits[0] : null;
      if ((i % 20) === 19) Utilities.sleep(30);
    }
  } catch(e){
    // 続行
  } finally {
    if (req && Array.isArray(req.ids)) {
      req.ids.forEach(function(k){
        if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = null;
      });
    }
    return _jsonSafe_(out);
  }
}

// ---------- 公開API：全量インデックス ----------
function sv_indexAllProxies(req){
  try{
    var meta = _sv_getMeta_(req && req.projectMeta);
    var folderId = _sv_extractFolderId_(meta.proxies_root_url);

    var items = _listAllInFolder_driveV2_(folderId);
    if (!items.length) items = _listAllInFolder_driveApp_(folderId);

    var latestByShotId = {};
    for (var i=0; i<items.length; i++){
      var f = items[i];
      var sid = _guessShotId_(f.name);
      if (!sid) continue;
      if (!latestByShotId[sid]) latestByShotId[sid] = f; // itemsはmodified desc
    }

    return _jsonSafe_({ items: items, latestByShotId: latestByShotId });
  } catch(e){
    return _jsonSafe_({ items: [], latestByShotId: {} });
  }
}
