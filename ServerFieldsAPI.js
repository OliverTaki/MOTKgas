/** ServerFieldsAPI.gs — Originals URL と LinkMaps を返す軽量API **/

/** Originals フォルダURLを返す（最優先で呼ばれる） */
function sv_getOriginalsFolderUrl(arg) {
  // arg: {entity,id,fid,value,row}
  // 実装はプロジェクトのルールに合わせて調整可
  // 例: シートやDBから originals フォルダID を引き、その Drive URL を返す
  var id   = String((arg && arg.id) || "");
  var ent  = String((arg && arg.entity) || "shot").toLowerCase();

  // ★ここを実装環境に合わせて取得
  //   例: Shotの originals フォルダID を引く
  var folderId = lookupOriginalsFolderId(ent, id); // ←実装側で用意していると仮定

  if (folderId) {
    return "https://drive.google.com/drive/folders/" + folderId;
  }
  return ""; // 見つからなければ空文字（クライアント側は「not found」表示）
}

/** 既存互換の別名（どれか一つあればOK） */
function getOriginalsFolderUrl(arg){ return sv_getOriginalsFolderUrl(arg); }
function sv_getOriginalsUrl(arg){     return sv_getOriginalsFolderUrl(arg); }
function getOriginalsUrl(arg){        return sv_getOriginalsFolderUrl(arg); }

/** LinkMaps（ID→表示名）を返す。既にある場合は流用可 */
function sv_getLinkMaps() {
  // 例: キャッシュ済みのID->Nameをまとめて返す
  return {
    assets:  getIdNameMap_("Assets"),
    shots:   getIdNameMap_("Shots"),
    tasks:   getIdNameMap_("Tasks"),
    users:   getIdNameMap_("Users"),
    members: getIdNameMap_("ProjectMembers")
  };
}
function getLinkMaps(){ return sv_getLinkMaps(); }

/** —— ヘルパ（実装例）—— **/
function getIdNameMap_(sheetName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return {};
  var rng = sh.getDataRange().getValues();
  if (rng.length < 2) return {};
  var header = rng[0];
  var idCol = 0; // A列 = ID
  // 名前列を推定
  var nameCol = 1;
  for (var i=0;i<header.length;i++){
    var h = String(header[i]||"").toLowerCase();
    if (/(name|code)/.test(h)) { nameCol = i; break; }
  }
  var map = {};
  for (var r=1;r<rng.length;r++){
    var row = rng[r];
    var id  = String(row[idCol]||"").trim();
    if (!id) continue;
    var name = String(row[nameCol]||"").trim() || id;
    map[id] = name;
  }
  return map;
}

/** 環境依存の originals フォルダID を取得する */
function lookupOriginalsFolderId(entity, id) {
  // 簡易実装: ProjectMeta シートから originals_root_url を基に、再帰検索でentity/id 対応フォルダIDを探す
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var metaSh = ss.getSheetByName('project_meta');
    if (!metaSh) return "";
    
    var metaData = metaSh.getRange(1,1,2,metaSh.getLastColumn()).getValues();
    var meta = {};
    metaData[0].forEach(function(k,i){ meta[String(k).toLowerCase()] = metaData[1][i]; });
    
    var rootUrl = meta['originals_root_url'] || meta['proxies_root_url'] || "";
    if (!rootUrl) return "";
    
    var rootId = _sv_extractFolderId_(rootUrl); // 既存ヘルパ流用（_sv_extractFolderId_）
    if (!rootId) return "";
    
    var rootFolder = DriveApp.getFolderById(rootId);
    // 再帰検索: 名前がidを含むフォルダを探す
    var foundId = _recursiveSearchFolders(rootFolder, id);
    if (foundId) return foundId;
    
    // フォールバック: 直下ファイル検索（proxy系対応）
    var files = rootFolder.getFilesByName(id + '_proxy');
    if (files.hasNext()) {
      return files.next().getParents().next().getId(); // 親フォルダID
    }
  } catch (e) {
    // ログ出力（本番では console.log 相当）
    console.log('lookupOriginalsFolderId error: ' + e.message);
  }
  return ""; // 未発見時は空文字（クライアントフォールバック有効）
}

/** 内部ヘルパー: フォルダ再帰検索（名前.indexOf(id) > -1 or exact matchでヒット） */
function _recursiveSearchFolders(folder, id) {
  try {
    var folders = folder.getFolders();
    while (folders.hasNext()) {
      var subFolder = folders.next();
      var name = subFolder.getName().toLowerCase();
      if (name === id.toLowerCase() || name.indexOf(id.toLowerCase()) !== -1) {
        return subFolder.getId();
      }
      // 再帰
      var subResult = _recursiveSearchFolders(subFolder, id);
      if (subResult) return subResult;
    }
  } catch (e) {
    console.log('Recursive search error: ' + e.message);
  }
  return null;
}
/* —— ヘルパ（実装例）—— **/


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


/* ===== 1.header ===== */
// FieldsAPI.js
// 共通のフィールド描画・編集ユーティリティ
(function(global){
  "use strict";
  if (!global) return; // GASサーバー環境では即終了
  var FieldsAPI = {};

/* ===== 1. End ===== */


/* ===== 2.config ===== */
// 既知のリンク系フィールドIDやラベル判定
var KNOWN_LINK_FIELD_IDS = new Set([
  // 必要に応じて拡張。例: 'fi_0201','fi_0202'
]);

// エンティティ推定に用いる既知のフィールドID（viewer互換）
var KNOWN_ENTITY_FIELD_IDS = {
  fi_0028:'member',
  fi_0031:'shot',
  fi_0037:'user',
  fi_0058:'user',
  fi_0061:'asset', fi_0062:'task',
  fi_0063:'shot',  fi_0064:'task',
  fi_0065:'asset'
};

// “Originals URL” として扱うフィールド
var ORIGINALS_FIDS = new Set(["fi_0010","fi_0020","fi_0032"]);
/* ===== 2. End ===== */


/* ===== 3.utils ===== */
function $(sel, root){ return (root||document).querySelector(sel); }
function splitTokens(s){ return String(s||'').split(/[,\s;|、，／/・\[\]\(\){}<>「」『』【】]+/).filter(Boolean); }
function escapeHTML(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function isHttpUrl(s){ return /^https?:\/\//i.test(String(s||"")); }
function nowTs36(){ return Date.now().toString(36); }
/* ===== 3. End ===== */


/* ===== 4.link-maps ===== */
// LINK_MAPS は viewer/Detail で共有される前提。なければ空で用意。
function getLinkMaps(){
  global.LINK_MAPS = global.LINK_MAPS || {assets:{}, shots:{}, tasks:{}, users:{}, members:{}};
  return global.LINK_MAPS;
}
function hasAnyMaps(){
  var M=getLinkMaps();
  return Object.keys(M.assets).length||Object.keys(M.shots).length||Object.keys(M.tasks).length||Object.keys(M.users).length||Object.keys(M.members).length;
}
function ensureLinkMapsOnce(){
  if(ensureLinkMapsOnce._done) return;
  ensureLinkMapsOnce._done = true;
  try{
    if(global.google && google.script && google.script.run && typeof google.script.run.sv_getLinkMaps==="function"){
      google.script.run.withSuccessHandler(function(maps){
        if(maps && typeof maps==="object"){
          var M=getLinkMaps();
          ["assets","shots","tasks","users","members"].forEach(function(k){
            M[k]=Object.assign(M[k]||{}, maps[k]||{});
          });
        }
      }).withFailureHandler(function(){}).sv_getLinkMaps();
    }
  }catch(_){}
}
/* ===== 4. End ===== */


/* ===== 5.url-normalizers ===== */
// Drive フォルダURLの正規化（任意文字列からフォルダURLを推定）
function driveFolderUrlFromAny(x){
  var t = String(x||"").trim();
  if(!t) return "";
  var m1 = t.match(/^https?:\/\/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]{10,})(?:[/?#].*)?$/i);
  if(m1) return "https://drive.google.com/drive/folders/"+m1[1];
  var m2 = t.match(/^https?:\/\/drive\.google\.com\/(?:open|folderview)\?id=([A-Za-z0-9_-]{10,})/i);
  if(m2) return "https://drive.google.com/drive/folders/"+m2[1];
  var m3 = t.match(/([A-Za-z0-9_-]{20,})/);
  if(m3) return "https://drive.google.com/drive/folders/"+m3[1];
  return "";
}
function toDriveFilePreviewById(id){ return id ? ("https://drive.google.com/file/d/"+id+"/preview") : ""; }
function toDriveFilePreview(url){
  var s=String(url||"").trim();
  var m=s.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^\/]+)\/(view|preview)/i);
  return m ? ("https://drive.google.com/file/d/"+m[1]+"/preview") : "";
}
/* ===== 5. End ===== */


/* ===== 6.entity-links ===== */
function entityOfToken(pid){
  if(/^as_\d+/i.test(pid)) return "asset";
  if(/^sh_\d+/i.test(pid)) return "shot";
  if(/^ta_\d+/i.test(pid)) return "task";
  if(/^us_/i.test(pid))    return "user";
  if(/^mb_/i.test(pid))    return "projectmember";
  return "";
}

function detailPageNameForEntity(ent){
  var key = String(ent||'').trim().toLowerCase();
  if(key === 'asset' || key === 'assets') return 'DetailAsset';
  if(key === 'task' || key === 'tasks') return 'DetailTask';
  if(key === 'user' || key === 'users') return 'DetailUser';
  if(key === 'member' || key === 'members' || key === 'projectmember' || key === 'projectmembers') return 'DetailMember';
  return 'DetailShot';
}
function isEntityToken(s){ return /\b(?:as|sh|ta|us|mb)[-_][0-9A-Za-z\-]+\b/.test(String(s||"")); }

function baseUrl(){
  return (global.scriptUrl || global.SCRIPT_URL || (location.origin + location.pathname));
}
function currentPage(){
  var p=new URLSearchParams(location.search);
  var explicit = p.get("page");
  if(explicit) return explicit;
  if(window.STATE && window.STATE.pageKey) return window.STATE.pageKey;
  return "DetailShot";
}
function buildEntityUrl(ent,id){
  var qs=new URLSearchParams(location.search);
  var pageName = ent ? detailPageNameForEntity(ent) : currentPage();
  qs.set('page', pageName || currentPage());
  qs.set("entity", ent||"shot");
  qs.set("id", id||"");
  // ts を足すと毎回URLが変わりHistory汚染するので、外部から必要時だけ付与
  return baseUrl()+"?"+qs.toString();
}

function labelFromMaps(pid){
  var M=getLinkMaps();
  return M.assets[pid]||M.shots[pid]||M.tasks[pid]||M.users[pid]||M.members[pid]||pid;
}
function renderEntityLink(pid, opts){
  var ent = entityOfToken(pid) || (KNOWN_ENTITY_FIELD_IDS[pid]||"item");
  var a=document.createElement("a");
  a.href  = buildEntityUrl(ent, pid);
  a.textContent = (opts&&opts.label)||labelFromMaps(pid);
  a.title = pid;
  a.className = "chip";
  a.target = "_self";
  return a;
}
/* ===== 6. End ===== */


/* ===== 7.link-field-detection ===== */
function isLinkField(label, fid){
  var L = String(label||'').toLowerCase();
  if(/url|link|drive|folder|file|original|proxy|thumbnail|thumb/.test(L)) return true;
  if(fid && KNOWN_LINK_FIELD_IDS.has(String(fid).toLowerCase())) return true;
  return false;
}
function looksLikeIdColumn(headerText, id){
  if(/(^|[^a-z])id([^a-z]|$)/i.test(String(headerText||''))) return true;
  return /^fi_0001$/i.test(String(id||'')); // 主キー
}
/* ===== 7. End ===== */


/* ===== 8.render-cell ===== */
// 統一レンダラ：表示専用DOMを返す
//   args = { fid, val, row, labels, linkMapsReady:boolean }
function renderCellByField(args){
  var fid = String(args.fid||"");
  var val = (args.val==null ? "" : String(args.val)).trim();
  var labels = args.labels||{};
  var headerText = labels[fid] || fid;
  var ctn = document.createElement("div");

  // 主キーは素通し
  if (fid.toLowerCase()==="fi_0001"){
    ctn.textContent = val; return ctn;
  }

  // Originals URL はフォルダURLとして別タブ
  if (ORIGINALS_FIDS.has(fid.toLowerCase())){
    var url = driveFolderUrlFromAny(val);
    if(url){
      var a=document.createElement("a");
      a.href=url; a.target="_blank"; a.rel="noopener";
      a.className="chip";
      a.textContent = val || (args.row && (args.row["fi_0002"]||"Open")) || "Open";
      ctn.appendChild(a);
    }else{
      ctn.textContent = val || "";
    }
    return ctn;
  }

  // 1) エンティティIDトークンを厳格にリンク化
  if (isEntityToken(val)){
    var tokens = val.match(/\b(?:as|sh|ta|us|mb)[-_][0-9A-Za-z\-]+\b/g) || [];
    if(tokens.length){
      var frag=document.createDocumentFragment();
      tokens.forEach(function(pid, i){
        frag.appendChild( renderEntityLink(pid) );
        if(i<tokens.length-1) frag.appendChild(document.createTextNode(', '));
      });
      ctn.appendChild(frag);
      return ctn;
    }
  }

  // 2) ラベル/FIDからリンク系と分かる場合は、トークン分割して外部 or エンティティ化
  if (KNOWN_ENTITY_FIELD_IDS[fid] || isLinkField(headerText, fid)){
    var parts = splitTokens(val);
    if(!parts.length){ ctn.textContent=""; return ctn; }
    var frag=document.createDocumentFragment();
    parts.forEach(function(tok, i){
      if(isHttpUrl(tok)){
        var ax=document.createElement('a'); ax.href=tok; ax.textContent=tok; ax.target='_blank'; ax.rel='noopener';
        frag.appendChild(ax);
      }else if(isEntityToken(tok)){
        frag.appendChild( renderEntityLink(tok) );
      }else{
        // DriveっぽいIDは file ではなく folder に無理変換しない。素通し。
        frag.appendChild(document.createTextNode(tok));
      }
      if(i<parts.length-1) frag.appendChild(document.createTextNode(', '));
    });
    ctn.appendChild(frag);
    return ctn;
  }

  // 3) プレーンURLはそのまま外部リンク
  if(isHttpUrl(val)){
    var a=document.createElement('a'); a.href=val; a.textContent=val; a.target='_blank'; a.rel='noopener';
    ctn.appendChild(a); return ctn;
  }

  // 4) それ以外はテキスト
  ctn.textContent = val;
  return ctn;
}
/* ===== 8. End ===== */


/* ===== 9.editors ===== */
// インラインエディタ（基本形: テキスト）
// options = { selector: '.table td .v' など, onCommit(fid, newValue, context), getContext(node)->{fid,row,labels} }
function attachCellEditor(container, options){
  options = options||{};
  var selector = options.selector || '.table td .v, .kv-row .v, .fields-grid .v';

  container.addEventListener('click', function(ev){
    var v = ev.target.closest(selector);
    if(!v) return;

    // 既に編集中ならスキップ
    if(v.getAttribute('data-editing')==='1') return;

    // 編集可否は data-editable="true" で判定（ページ側で制御）
    if(v.getAttribute('data-editable')!=='true') return;

    var ctx = (typeof options.getContext==="function") ? options.getContext(v) : {};
    var fid = ctx.fid || v.getAttribute('data-fid') || '';
    if(!fid) return;

    var raw = v.getAttribute('data-raw') || v.textContent || '';
    raw = raw.trim();

    // 入力UI
    v.setAttribute('data-editing','1');
    var input = document.createElement('input');
    input.type='text';
    input.value=raw;
    input.className='input';
    input.style.width='100%';
    input.style.boxSizing='border-box';

    // 決定
    function commit(val){
      v.removeAttribute('data-editing');
      v.setAttribute('data-raw', val);
      v.innerHTML='';
      var rendered = renderCellByField({fid:fid, val:val, row:ctx.row||{}, labels:ctx.labels||{}});
      v.appendChild(rendered);
      if(typeof options.onCommit==="function"){
        options.onCommit(fid, val, ctx);
      }
    }

    // 破棄
    function cancel(){
      v.removeAttribute('data-editing');
      v.innerHTML='';
      var rendered = renderCellByField({fid:fid, val:raw, row:ctx.row||{}, labels:ctx.labels||{}});
      v.appendChild(rendered);
    }

    v.innerHTML='';
    v.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('keydown', function(e){
      if(e.key==='Enter'){ e.preventDefault(); commit(input.value); }
      if(e.key==='Escape'){ e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', function(){ commit(input.value); });
  }, {capture:true});
}
/* ===== 9. End ===== */


/* ===== 10.export ===== */
FieldsAPI.renderCellByField = renderCellByField;
FieldsAPI.attachCellEditor   = attachCellEditor;
FieldsAPI.driveFolderUrlFromAny = driveFolderUrlFromAny;
FieldsAPI.renderEntityLink   = renderEntityLink;
FieldsAPI.ensureLinkMapsOnce = ensureLinkMapsOnce;
FieldsAPI.hasAnyMaps         = hasAnyMaps;

if (typeof module!=="undefined" && module.exports){
  module.exports = FieldsAPI;
}else if(global){ // global が存在する場合のみ
  global.FieldsAPI = FieldsAPI;
}
})(typeof window !== "undefined" ? window : this);
/* ===== 10. End ===== */

/** ProxySearchLoose.gs
 * DriveBuilderは変更しない。proxies 直下〜配下を「ゆるく」再帰検索する補助API。
 * 条件: ファイル名に id を含み、かつ "_proxy." を含む（どちらも大小無視）。modifiedTime 降順で返す。
 */
function _ps_norm(s){
  return String(s||'')
    .replace(/\u3000/g,' ')              // 全角スペース→半角
    .replace(/[\u200B-\u200D\uFEFF]/g,'')// ゼロ幅除去
    .trim();
}
function _ps_extractFolderId(url){
  var m = String(url||'').match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new Error('Invalid folder URL for proxies_root_url');
  return m[1];
}
function _ps_proxiesRoot(){
  var sh = SpreadsheetApp.getActive().getSheetByName('project_meta');
  if (!sh) throw new Error('project_meta sheet not found');
  var kv = {};
  var rows = sh.getRange(1,1,2,sh.getLastColumn()).getValues();
  rows[0].forEach(function(k,i){ kv[k] = rows[1][i]; });
  return DriveApp.getFolderById(_ps_extractFolderId(kv.proxies_root_url));
}

/** 内部: 再帰でファイル収集（必要なら階層を辿る） */
function _ps_collectFiles(folder, hits, idLC){
  // ファイル
  var fit = folder.getFiles();
  while(fit.hasNext()){
    var f = fit.next();
    var nameLC = _ps_norm(f.getName()).toLowerCase();
    if (nameLC.indexOf(idLC) !== -1 && nameLC.indexOf('_proxy.') !== -1){
      hits.push({
        id:           f.getId(),
        name:         f.getName(),
        mimeType:     f.getMimeType(),
        modifiedTime: f.getLastUpdated(),
        size:         f.getSize()
      });
    }
  }
  // サブフォルダも探索（PROXIES配下をフラット運用していても安全）
  var dit = folder.getFolders();
  while(dit.hasNext()){
    var d = dit.next();
    _ps_collectFiles(d, hits, idLC);
  }
}

/** 公開: ゆるい検索（大小無視＋再帰） */
function findProxyFilesLoose(id){
  id = _ps_norm(id);
  if (!id) return [];
  var root = _ps_proxiesRoot();
  var hits = [];
  _ps_collectFiles(root, hits, id.toLowerCase());
  hits.sort(function(a,b){ return new Date(b.modifiedTime) - new Date(a.modifiedTime); });
  return hits;
}

/* ===== 21.fieldtype-normalize ===== */
(function(G){
  "use strict";
  var ROOT = (typeof G!=="undefined") ? G : (typeof globalThis!=="undefined"? globalThis : this);

  function normalizeFieldType(rawType){
    var t = String(rawType||"").toLowerCase().trim();
    var m = t.match(/^(shot|asset|task|member|user)_link$/);
    if (m) return { type:"link", target:m[1], meta:{ normalized:true } };
    if (t === "entity_link") return { type:"link", target:null, meta:{ legacy:true } };
    return { type:t, target:null, meta:{} };
  }

  function inferLinkTargetByIdPrefix(val){
    var p = String(val||"").slice(0,3).toLowerCase();
    if (p==="sh_") return "shot";
    if (p==="as_") return "asset";
    if (p==="tk_") return "task";
    if (p==="pm_") return "member";
    if (p==="us_") return "user";
    return null;
  }

  function buildColumnSpec(fieldsRow, sampleValues){
    var norm = normalizeFieldType(fieldsRow.type);
    var target = norm.target;
    if (!target && norm.type==="link" && Array.isArray(sampleValues)){
      for (var i=0;i<sampleValues.length;i++){
        var inf = inferLinkTargetByIdPrefix(sampleValues[i]);
        if (inf){ target = inf; break; }
      }
    }
    var col = {
      id: String(fieldsRow.field_id),
      name: String(fieldsRow.field_name||""),
      type: norm.type,
      target: target || undefined,
      meta: norm.meta
    };
    if (col.type==="link" && !col.target) col.meta.target_inferred = false;
    return col;
  }

  ROOT.__FieldsType__ = ROOT.__FieldsType__ || {};
  ROOT.__FieldsType__.normalizeFieldType = normalizeFieldType;
  ROOT.__FieldsType__.buildColumnSpec    = buildColumnSpec;
})(typeof globalThis!=="undefined"? globalThis : this);
/* ===== 21. End ===== */

/* ===== 31.api-surface-delegates ===== */
(function(G){
  "use strict";
  var ROOT = (typeof G!=="undefined") ? G : (typeof globalThis!=="undefined"? globalThis : this);

  function choose(list){
    for (var i=0;i<list.length;i++){
      var fn = ROOT[list[i]];
      if (typeof fn === "function") return fn.bind(ROOT);
    }
    return null;
  }

  var getFieldsImpl     = choose(["sv_getFields","getFields","listFields","DB_getFields"]);
  var listRowsPageImpl  = choose(["sv_listRowsPage","listRowsPage","DB_listRowsPage"]);
  var getProjectMetaImpl= choose(["getProjectMeta","sv_getProjectMeta","DB_getProjectMeta"]);

  ROOT.getFields = function(){
    if (!getFieldsImpl) throw new Error("getFields() not available");
    return getFieldsImpl();
  };

  ROOT.listRowsPage = function(req){
    if (!listRowsPageImpl) throw new Error("listRowsPage(req) not available");
    var out = listRowsPageImpl(req||{});
    try{
      if (out && Array.isArray(out.columns)){
        out.columns = out.columns.map(function(c){
          var row = { field_id:(c.field_id||c.id), field_name:(c.field_name||c.name), type:c.type };
          var spec = (ROOT.__FieldsType__ && ROOT.__FieldsType__.buildColumnSpec)
            ? ROOT.__FieldsType__.buildColumnSpec(row, [])
            : { id:String(row.field_id), name:String(row.field_name||""), type:String(row.type||"") };
          var merged = Object.assign({}, c, { id:spec.id, name:spec.name, type:spec.type });
          if (spec.target) merged.target = spec.target;
          if (spec.meta)   merged.meta   = Object.assign({}, c.meta||{}, spec.meta);
          return merged;
        });
      }
    }catch(_){}
    return out;
  };

  ROOT.getProjectMeta = function(){
    if (!getProjectMetaImpl) throw new Error("getProjectMeta() not available");
    return getProjectMetaImpl();
  };
})(typeof globalThis!=="undefined"? globalThis : this);
/* ===== 31. End ===== */

