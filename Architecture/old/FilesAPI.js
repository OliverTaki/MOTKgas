// =============================================================
// FilesAPI.gs  (read-only file listing API for MOTK)
// =============================================================
// • proxies: <PROJECT>-PROXIES 直下を Drive API の検索で列挙（まず検索、0件ならDriveAppで走査）
// • originals: <PROJECT>-ORIGINALS/<root>/<id[__code]> 直下を読み取り（生成しない）
// • バッチ: listLatestProxyBatch({ids:[...]})
// • メタ: getProjectMeta() を公開（フロントが必ず取得してから使う）
// =============================================================

const FA_ENTITY_ROOTS = {
  shot: '01shots', shots: '01shots',
  asset: '02assets', assets: '02assets',
  task: '03tasks',  tasks:  '03tasks',
  misc: '04misc',   deleted:'05deleted'
};

// ---------- utils ----------
function fa_norm_(s){
  return String(s||'').replace(/\u3000/g,' ')
    .replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
}
function fa_extractFolderId_(url){
  const m = String(url||'').match(/folders\/([a-zA-Z0-9_-]+)/);
  if(!m) throw new Error('FilesAPI: Invalid folder URL → '+url);
  return m[1];
}
function fa_getMeta_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if(!ss) throw new Error('FilesAPI: Active spreadsheet not found');
  const sh = ss.getSheetByName('project_meta');
  if(!sh) throw new Error('FilesAPI: project_meta sheet not found');
  const data = sh.getRange(1,1,2,sh.getLastColumn()).getValues();
  const meta = {};
  data[0].forEach((k,i)=> meta[k] = data[1][i]);
  if(!meta.originals_root_url || !meta.proxies_root_url)
    throw new Error('FilesAPI: originals_root_url / proxies_root_url are required');
  return meta;
}
function fa_getFolderById_(id){ return DriveApp.getFolderById(id); }

function fa_resolveExistingEntityFolder_(meta, entity, id){
  const rootName = FA_ENTITY_ROOTS[entity];
  if(!rootName) return null;
  const originalsRoot = fa_getFolderById_(fa_extractFolderId_(meta.originals_root_url));

  const itRoot = originalsRoot.getFoldersByName(rootName);
  if(!itRoot.hasNext()) return null;
  const entityRoot = itRoot.next();

  // "id__code" 前方一致 → "id" 完全一致（生成はしない）
  let exact = null, candidate = null;
  const it = entityRoot.getFolders();
  while(it.hasNext()){
    const f = it.next();
    const name = String(f.getName()||'');
    if(name === id){ exact = f; break; }
    if(!candidate && name.indexOf(id+'__') === 0) candidate = f;
  }
  return exact || candidate;
}

function fa_fromDriveFile_(f, isV2){
  return {
    id:           f.id,
    name:         f.title || f.name,
    mimeType:     f.mimeType,
    modifiedTime: new Date(f.modifiedDate || f.modifiedTime),
    size:         Number(f.fileSize || f.size || 0)
  };
}

function fa_serializeFromIterator_(folder, kind, id){
  // DriveApp 走査（フォールバック）
  const out = [];
  const idLC = String(id||'').toLowerCase();
  const it = folder.getFiles();
  while(it.hasNext()){
    const f = it.next();
    const n = String(f.getName()||'');
    if(kind === 'proxies'){
      const nameLC = n.toLowerCase();
      if(id && nameLC.indexOf(idLC) === -1) continue;   // 部分一致（大小無視）
      if(!/_proxy\./i.test(nameLC)) continue;           // 「_proxy.」必須（大小無視）
    }
    out.push({
      id: f.getId(),
      name: n,
      mimeType: f.getMimeType(),
      modifiedTime: f.getLastUpdated(),
      size: f.getSize()
    });
  }
  out.sort((a,b)=> new Date(b.modifiedTime) - new Date(a.modifiedTime));
  return out;
}

// ---------- Drive API v2 検索（推奨） ----------
/**
 * スクリプトエディタの「サービス」→ Drive API を ON（v2）。
 * GCP の API ライブラリでも Drive API を有効化してください。
 */
function fa_listProxiesWithQuery_(proxiesFolderId, id){
  const idStr = fa_norm_(id||'');
  if(!idStr) return [];

  const q = [
    "trashed = false",
    "'" + proxiesFolderId + "' in parents",
    "title contains '" + idStr.replace(/'/g,"\\'") + "'",
    "title contains '_proxy.'"
  ].join(" and ");

  const opt = {
    q,
    maxResults: 200,
    orderBy: "modifiedDate desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  };

  const res = Drive.Files.list(opt); // Advanced Drive v2
  const files = (res && res.items) ? res.items.map(f => fa_fromDriveFile_(f, true)) : [];
  return files;
}

// 単一ID → 最新1件を返す（内部利用）
function fa_latestProxyForId_(proxiesId, id){
  let hits = [];
  try { hits = fa_listProxiesWithQuery_(proxiesId, id); } catch(e) {}
  if(!hits.length){
    const folder = fa_getFolderById_(proxiesId);
    hits = fa_serializeFromIterator_(folder, 'proxies', id);
  }
  return hits.length ? hits[0] : null;
}

// ---------- 公開 API（メタ取得） ----------
function getProjectMeta(){
  return fa_getMeta_();
}

// ---------- 公開 API（従来の単体列挙） ----------
function listEntityFiles(req){
  const r = req||{};
  const kind   = r.kind||'originals';
  const entity = r.entity||'';
  const id     = fa_norm_(r.id||'');
  const meta   = r.projectMeta||fa_getMeta_();

  if(kind === 'proxies'){
    const proxiesId = fa_extractFolderId_(meta.proxies_root_url);
    // 従来互換：一覧（降順）
    let hits = [];
    try { hits = fa_listProxiesWithQuery_(proxiesId, id); } catch(e) {}
    if(!hits.length){
      const folder = fa_getFolderById_(proxiesId);
      hits = fa_serializeFromIterator_(folder, 'proxies', id);
    }
    return hits;
  }

  if(kind === 'originals'){
    if(!entity || !id) return [];
    const folder = fa_resolveExistingEntityFolder_(meta, entity, id);
    if(!folder) return [];
    return fa_serializeFromIterator_(folder, 'originals', id);
  }

  throw new Error('FilesAPI: kind must be "proxies" or "originals"');
}

// ---------- 公開 API（★バッチ：ページ単位で1回だけ呼ぶ） ----------
/**
 * 入力: { ids: ["sh_0001","sh_0002", ...], projectMeta?: {...} }
 * 出力: { "sh_0001": {id,name,mimeType,modifiedTime,size} | null, ... }  （各IDの最新1件）
 */
function listLatestProxyBatch(req){
  const ids = (req && Array.isArray(req.ids)) ? req.ids : [];
  const meta = (req && req.projectMeta) ? req.projectMeta : fa_getMeta_();
  const proxiesId = fa_extractFolderId_(meta.proxies_root_url);

  const out = {};
  for (var i=0; i<ids.length; i++){
    const id = fa_norm_(ids[i]);
    if(!id){ out[ids[i]] = null; continue; }
    out[ids[i]] = fa_latestProxyForId_(proxiesId, id);
    if ((i % 20) === 19) Utilities.sleep(50); // 20件ごとに50ms
  }
  return out;
}

// （デバッグ用）
function _debug_list_sh0002(){
  Logger.log(JSON.stringify(listEntityFiles({ kind:'proxies', entity:'shot', id:'sh_0002' })));
}
function _debug_batch_sample(){
  Logger.log(JSON.stringify(listLatestProxyBatch({ ids:['sh_0001','sh_0002','sh_0003'] })));
}
