/** PagesConfig.gs
 * PAGESタブ（2段ヘッダ：1行目=ID, 2行目=表示名, 3行目〜=データ）で
 * 列設定(JSON: {order,widths,hidden})の 保存/読込 と プリセット一覧取得・メタ取得 を提供。
 *
 * カラム定義（Fieldsメタ準拠）:
 *  Page ID / Page Name / Page Type / Entity / Config / Edit / Created By / Created / Modified
 */

const PAGES_SHEET_NAME = 'PAGES';
const HEADER_ROW_IDS = 1;    // 1行目: フィールドID
const HEADER_ROW_LABELS = 2; // 2行目: 表示名
const DATA_START_ROW = 3;    // 3行目〜: データ

const PAGE_FIELDS = [
  { key: 'id', fieldName: 'Page ID' },
  { key: 'name', fieldName: 'Page Name' },
  { key: 'type', fieldName: 'Page Type' },
  { key: 'entity', fieldName: 'Entity' },
  { key: 'config', fieldName: 'Config' },
  { key: 'shared', fieldName: 'Edit' },
  { key: 'createdBy', fieldName: 'Created By' },
  { key: 'created', fieldName: 'Created' },
  { key: 'modified', fieldName: 'Modified' }
];

function getPageFieldSpec_() {
  return PAGE_FIELDS.map(function (f) {
    return { key: f.key, fieldName: f.fieldName, fid: schemaGetFidByFieldName('page', f.fieldName) };
  });
}

/** 一覧 */
function sv_listPages() {
  try {
    const sh = ensurePagesSheet_();
    ensurePageColumns_(sh);
    const idx = getHeaderIndexMap_(sh);
    const spec = getPageFieldSpec_();
    const specMap = {};
    spec.forEach(function (s) { specMap[s.key] = s; });
    const ci = {
      id: idx.byId[specMap.id.fid],
      name: idx.byId[specMap.name.fid],
      type: idx.byId[specMap.type.fid],
      ent: idx.byId[specMap.entity.fid],
      shared: idx.byId[specMap.shared.fid]
    };
    const lastRow = sh.getLastRow();
    if (lastRow < DATA_START_ROW) return { items: [] };

    const rng = sh.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, idx.count);
    const values = rng.getValues();
    const items = values.map(row => ({
      id:   String(row[ci.id]   || ''),
      name: String(row[ci.name] || ''),
      type: String(row[ci.type] || ''),
      entity: String(row[ci.ent] || ''),
      shared: row[ci.shared],
    })).filter(x => x.id);

    items.sort((a,b) => {
      if (a.id === 'pg_default') return -1;
      if (b.id === 'pg_default') return 1;
      return a.id.localeCompare(b.id, 'en');
    });
    return { items };
  } catch (err) {
    return { items: [], error: String(err && err.message || err) };
  }
}

function _filterPagePresets_(items, params) {
  var list = Array.isArray(items) ? items.slice() : [];
  if (!params) return list;
  var wantType = String(params.pageType || '').toLowerCase().trim();
  if (wantType) {
    list = list.filter(function (p) {
      var t = String(p.type || '').toLowerCase().trim();
      return !t || t === wantType;
    });
  }
  var wantEnt = String(params.entity || '').toLowerCase().trim();
  if (wantEnt) {
    list = list.filter(function (p) {
      var e = String(p.entity || '').toLowerCase().trim();
      return !e || e === wantEnt;
    });
  }
  return list;
}

/** Table/Detail API compatibility: return presets list */
function gsListPagePresets(params) {
  try {
    var res = sv_listPages();
    var items = (res && Array.isArray(res.items)) ? res.items : [];
    return _filterPagePresets_(items, params);
  } catch (err) {
    return [];
  }
}

/** DetailV2 fallback: layout presets list */
function sv_listPageLayoutPresets(params) {
  try {
    var res = sv_listPages();
    var items = (res && Array.isArray(res.items)) ? res.items : [];
    return _filterPagePresets_(items, params);
  } catch (err) {
    return [];
  }
}

/** 読込 */
function sv_loadPageConfig(params) {
  try {
    const pageId = (params && params.pageId) || '';
    if (!pageId) return {};
    const sh = ensurePagesSheet_();
    ensurePageColumns_(sh);
    const idx = getHeaderIndexMap_(sh);
    const spec = getPageFieldSpec_();
    const specMap = {};
    spec.forEach(function (s) { specMap[s.key] = s; });
    const cId   = idx.byId[specMap.id.fid];
    const cConf = idx.byId[specMap.config.fid];

    const lastRow = sh.getLastRow();
    if (lastRow < DATA_START_ROW) return {};

    const ids  = sh.getRange(DATA_START_ROW, cId+1,   lastRow - DATA_START_ROW + 1, 1).getValues();
    const cfgs = sh.getRange(DATA_START_ROW, cConf+1, lastRow - DATA_START_ROW + 1, 1).getValues();

    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === pageId) {
        const raw = cfgs[i][0];
        if (!raw) return {};
        try { const obj = JSON.parse(raw); return (obj && typeof obj === 'object') ? obj : {}; }
        catch (e) { return {}; }
      }
    }
    return {};
  } catch (err) {
    return { error: String(err && err.message || err) };
  }
}

/** メタ取得（Name/Shared 等の初期値） */
function sv_getPageMeta(params){
  try{
    const pageId = (params && params.pageId) || '';
    if (!pageId) return {};
    const sh  = ensurePagesSheet_();
    ensurePageColumns_(sh);
    const idx = getHeaderIndexMap_(sh);
    const spec = getPageFieldSpec_();
    const specMap = {};
    spec.forEach(function (s) { specMap[s.key] = s; });
    const cId   = idx.byId[specMap.id.fid];
    const cName = idx.byId[specMap.name.fid];
    const cType = idx.byId[specMap.type.fid];
    const cEnt  = idx.byId[specMap.entity.fid];
    const cSh   = idx.byId[specMap.shared.fid];
    const cCB   = idx.byId[specMap.createdBy.fid];
    const cCr   = idx.byId[specMap.created.fid];
    const cMd   = idx.byId[specMap.modified.fid];

    const lastRow = sh.getLastRow();
    if (lastRow < DATA_START_ROW) return {};

    const rng = sh.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, idx.count);
    const vals = rng.getValues();
    for (let i=0;i<vals.length;i++){
      const row = vals[i];
      if (String(row[cId]) === pageId){
        return {
          id: pageId,
          name: String(row[cName]||''),
          type: String(row[cType]||''),
          entity: String(row[cEnt]||''),
          shared: row[cSh],
          createdBy: String(row[cCB]||''),
          created: String(row[cCr]||''),
          modified: String(row[cMd]||''),
        };
      }
    }
    return {};
  } catch(err){
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
function sv_savePageConfig(params) {
  try {
    let pageId = (params && params.pageId) || '';
    const cfgObj = (params && params.config) || {};
    const isNew = !pageId || pageId === 'pg_new';
    const sh  = ensurePagesSheet_();
    ensurePageColumns_(sh);
    const idx = getHeaderIndexMap_(sh);
    const spec = getPageFieldSpec_();
    const specMap = {};
    spec.forEach(function (s) { specMap[s.key] = s; });
    const cId   = idx.byId[specMap.id.fid];
    const cName = idx.byId[specMap.name.fid];
    const cType = idx.byId[specMap.type.fid];
    const cEnt  = idx.byId[specMap.entity.fid];
    const cConf = idx.byId[specMap.config.fid];
    const cSh   = idx.byId[specMap.shared.fid];
    const cCB   = idx.byId[specMap.createdBy.fid];
    const cCr   = idx.byId[specMap.created.fid];
    const cMd   = idx.byId[specMap.modified.fid];

    const json = JSON.stringify(cfgObj);
    const now  = new Date().toISOString();

    if (!isNew) {
      // 既存上書き
      const lastRow = sh.getLastRow();
      if (lastRow >= DATA_START_ROW) {
        const ids = sh.getRange(DATA_START_ROW, cId+1, lastRow - DATA_START_ROW + 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          const r = DATA_START_ROW + i;
          if (String(ids[i][0]) === pageId) {
            const rng = sh.getRange(r, 1, 1, idx.count);
            const row = rng.getValues()[0];
            row[cConf] = json;
            row[cMd]   = now;
            if (params.pageName != null) row[cName] = params.pageName;
            if (params.pageType != null) row[cType] = params.pageType;
            if (params.entity   != null) row[cEnt]  = params.entity;
            if (params.shared   != null) row[cSh]   = params.shared;
            rng.setValues([row]);
            return { ok:true, updated:true, pageId };
          }
        }
      }
      // 指定IDが無かった場合は新規扱いで下に続行
    }

    // 新規：ID自動採番
    pageId = allocNewPageId_(sh); // pg_0001, pg_0002, ...
    const row = new Array(idx.count).fill('');
    row[cId]   = pageId;
    if (params.pageName != null) row[cName] = params.pageName;
    if (params.pageType != null) row[cType] = params.pageType;
    if (params.entity   != null) row[cEnt]  = params.entity;
    if (params.shared   != null) row[cSh]   = params.shared;

    function safeUserEmail(){
      try{
        return (Session.getActiveUser && Session.getActiveUser().getEmail)
          ? Session.getActiveUser().getEmail()
          : '';
      }catch(_){
        return '';
      }
    }

    row[cCB]  = params.createdBy != null ? params.createdBy : safeUserEmail();
    row[cCr]  = now;
    row[cMd]  = now;
    row[cConf]= json;

    sh.getRange(sh.getLastRow()+1, 1, 1, row.length).setValues([row]);
    return { ok:true, inserted:true, pageId };

  } catch (err) {
    return { ok:false, error: String(err && err.message || err) };
  }
}

/* ---------------- 内部ユーティリティ ---------------- */

function ensurePagesSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(PAGES_SHEET_NAME);
  const spec = getPageFieldSpec_();
  const fids = spec.map(s => s.fid);
  const labels = spec.map(s => s.fieldName);
  if (!sh) {
    sh = ss.insertSheet(PAGES_SHEET_NAME);
    sh.getRange(HEADER_ROW_IDS,    1, 1, fids.length).setValues([fids]);
    sh.getRange(HEADER_ROW_LABELS, 1, 1, labels.length).setValues([labels]);
    return sh;
  }
  if (sh.getLastRow() < HEADER_ROW_LABELS) {
    sh.getRange(HEADER_ROW_IDS,    1, 1, fids.length).setValues([fids]);
    sh.getRange(HEADER_ROW_LABELS, 1, 1, labels.length).setValues([labels]);
  }
  return sh;
}

/** 必須ID列がなければ末尾に追加（既存順は不変） */
function ensurePageColumns_(sh){
  const lastCol = Math.max(1, sh.getLastColumn());
  const ids = sh.getRange(HEADER_ROW_IDS, 1, 1, lastCol).getValues()[0].map(String);
  const spec = getPageFieldSpec_();
  const want = spec.map(s => s.fid);
  const missing = want.filter(id => ids.indexOf(id) === -1);
  if (!missing.length) return;
  const startCol = lastCol + 1;
  const labels = missing.map(function (id) {
    var hit = spec.find(function (s) { return s.fid === id; });
    return (hit && hit.fieldName) ? hit.fieldName : id;
  });
  sh.getRange(HEADER_ROW_IDS,    startCol, 1, missing.length).setValues([missing]);
  sh.getRange(HEADER_ROW_LABELS, startCol, 1, missing.length).setValues([labels]);
}

/** 1行目ID→index マップ */
function getHeaderIndexMap_(sh){
  const lastCol = Math.max(1, sh.getLastColumn());
  const ids = sh.getRange(HEADER_ROW_IDS, 1, 1, lastCol).getValues()[0].map(String);
  const byId = {};
  ids.forEach((id, i) => { if (id) byId[id] = i; });
  return { byId, count: ids.length };
}

/** 新規ID（pg_0001 形式）を採番 */
function allocNewPageId_(sh){
  const idx = getHeaderIndexMap_(sh);
  const spec = getPageFieldSpec_();
  const cId = idx.byId[spec.find(s => s.key === 'id').fid];
  const lastRow = sh.getLastRow();
  let maxN = 0;
  if (lastRow >= DATA_START_ROW){
    const ids = sh.getRange(DATA_START_ROW, cId+1, lastRow - DATA_START_ROW + 1, 1).getValues();
    ids.forEach(v=>{
      const s = String(v[0]||'');
      const m = s.match(/^pg_(\d{4,})$/);
      if (m){ const n = parseInt(m[1],10); if (!isNaN(n)) maxN = Math.max(maxN, n); }
    });
  }
  const next = maxN + 1;
  const pad = String(next).padStart(4,'0');
  return `pg_${pad}`;
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

function LM_isFid_(v){
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

  // Legacy compatibility: TaskName / Task Name / Name / Title.
  var pri=[/^(task.?name)$/i,/^(task .*name)$/i,/^(name)$/i,/^(title)$/i];
  for(var i=0;i<pri.length;i++){ var j=LM_headerIndex_(header,pri[i]); if(j>=0) return j; }
  // Find a header that contains both "task" and "name".
  for(var k=0;k<header.length;k++){
    var h=String(header[k]||"").toLowerCase();
    if(h.includes("task") && h.includes("name")) return k;
  }
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
  var pri=[/^(member ?name)$/i,/^(name)$/i,/^(title)$/i];
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
