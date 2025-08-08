// =============================================================
// DriveBuilder.gs   (stand‑alone helper for MOTK)
// =============================================================
// PURPOSE
//   • Guarantee and audit the canonical Google‑Drive folder tree for a MOTK project.
//   • ORIGINALS :  <ROOT>/<PROJECT>-ORIGINALS/<##entityRoot>/<id>__<code>/<sub>
//       - entityRoot is numbered for human sort → 01shots, 02assets …
//   • PROXIES   :  <ROOT>/<PROJECT>-PROXIES  (flat storage)
//   • DataHub G 列 Core_values から ID / Code を取り込み、階層フォルダを同期
//   • ★ NEW ★  diff / audit helpers:  list IDs in DataHub vs Drive and create missing
// ---------------------------------------------------------------------------
// PUBLIC API (google.script.run friendly → plain objects)
//   getOrCreateProjectRoots(meta?)                 → { originalsId, proxiesId }
//   ensureEntityFolder(meta?, entity, id, code)    → Folder (ORIGINALS)
//   listEntityFiles({entity,id,kind,projectMeta})  → [ {id,name,mimeType,…} ]
//   listEntityFolderNames(entity, meta?)           → [ {id,name} ]
//   softDeleteEntity(meta?, entity, id)            → move to 05deleted/
//   buildAll(limit?)                               → sync folders from DataHub (paged)
//   resetSyncCursor(entity)                        → clear stored cursor for entity
//   diffEntityFolders(entity)                      → {missing:[ids], existing:[ids]}
//   fixMissingEntityFolders(entity, limit?)        → create only missing folders
// ---------------------------------------------------------------------------

/***************************  CONSTANTS  ***********************************/
const ENTITY_ROOTS = {
  shot:    '01shots',   shots:   '01shots',
  asset:   '02assets',  assets:  '02assets',
  task:    '03tasks',   tasks:   '03tasks',
  misc:    '04misc',    deleted: '05deleted'
};
const ALL_ROOT_NAMES = ['01shots','02assets','03tasks','04misc','05deleted'];
const ID_LABEL   = { shot:'Shot ID', asset:'Asset ID', task:'Task ID' };
const CODE_LABEL = { shot:'ShotCode', asset:'AssetName', task:'' };

/***************************  UTILITIES  ************************************/
function extractId_(url){
  var m = (url||'').match(/folders\/([a-zA-Z0-9_-]+)/);
  if(!m) throw new Error('DriveBuilder: Invalid folder URL → '+url);
  return m[1];
}
function getOrCreateSub_(parent,name){
  var it = parent.getFoldersByName(name);
  return it.hasNext()?it.next():parent.createFolder(name);
}
function timeLeft_(){ return 290000 - (Date.now() - SCRIPT_START_TIME); }
var SCRIPT_START_TIME = Date.now();

/***************************  ROOTS  ***************************************/
function getOrCreateProjectRoots(meta){
  meta = meta || (typeof getProjectMeta==='function'?getProjectMeta():null);
  if(!meta||!meta.originals_root_url||!meta.proxies_root_url)
    throw new Error('DriveBuilder: meta.originals_root_url / proxies_root_url are required');
  var originalsRoot = DriveApp.getFolderById(extractId_(meta.originals_root_url));
  var proxiesRoot   = DriveApp.getFolderById(extractId_(meta.proxies_root_url));
  ALL_ROOT_NAMES.forEach(function(n){ getOrCreateSub_(originalsRoot,n); });
  return { originalsId:originalsRoot.getId(), proxiesId:proxiesRoot.getId() };
}

/***************************  ENTITY FOLDER ********************************/
function ensureEntityFolder(meta,entity,id,code){
  meta = meta || (typeof getProjectMeta==='function'?getProjectMeta():null);
  var roots = getOrCreateProjectRoots(meta);
  var originalsRoot = DriveApp.getFolderById(roots.originalsId);
  var rootName = ENTITY_ROOTS[entity];
  if(!rootName) throw new Error('DriveBuilder: unknown entity → '+entity);
  var entityRoot = getOrCreateSub_(originalsRoot, rootName);

  var wantedName = code? id+'__'+code : id;
  var idFolder;
  var it = entityRoot.getFoldersByName(wantedName);
  if(it.hasNext()) idFolder = it.next();
  else {
    it = entityRoot.getFoldersByName(id);
    if(it.hasNext()){ idFolder = it.next(); if(code) idFolder.setName(wantedName); }
    else             idFolder = entityRoot.createFolder(wantedName);
  }
  if(entity==='shot')  getOrCreateSub_(idFolder,'shotview');
  if(entity==='asset') getOrCreateSub_(idFolder,'assetview');
  return idFolder;
}

/***************************  PROXIES (flat) *******************************/
function getProxiesRoot_(meta){
  meta = meta || (typeof getProjectMeta==='function'?getProjectMeta():null);
  return DriveApp.getFolderById(extractId_(meta.proxies_root_url));
}

/***************************  FILE & FOLDER LIST ***************************/
function listEntityFiles(req){
  var meta   = req.projectMeta||(typeof getProjectMeta==='function'?getProjectMeta():null);
  var kind   = req.kind||'originals', entity=req.entity||'', id=req.id||'';
  var folder;
  if(kind==='originals') folder = ensureEntityFolder(meta,entity,id);
  else if(kind==='proxies') folder = getProxiesRoot_(meta);
  else throw new Error('DriveBuilder: kind must be "originals" or "proxies"');
  return serializeFiles_(folder,kind,id);
}

/***************************  DIFF / AUDIT *********************************/
function diffEntityFolders(entity, meta){
  meta = meta || (typeof getProjectMeta==='function'?getProjectMeta():null);
  // IDs from DataHub
  var hubIds = getCoreArray_(SpreadsheetApp.getActive().getSheetByName('DataHub'), entity, ID_LABEL[entity]);
  // IDs from Drive folder names
  var driveNames = listEntityFolderNames(entity, meta).map(function(o){ return (o.name||'').split('__')[0]; });
  var missing=[], existing=[];
  hubIds.forEach(function(id){
    if(driveNames.indexOf(id)===-1) missing.push(id);
    else existing.push(id);
  });
  return { missing:missing, existing:existing, hubTotal:hubIds.length, driveTotal:driveNames.length };
}

function fixMissingEntityFolders(entity, limit){
  var diff = diffEntityFolders(entity);
  var created=0;
  limit = limit||diff.missing.length;
  for(var i=0;i<limit && i<diff.missing.length && timeLeft_()>5000;i++){
    var id = diff.missing[i];
    var codes = getCoreArray_(SpreadsheetApp.getActive().getSheetByName('DataHub'), entity, CODE_LABEL[entity]);
    var code = codes[i]||'';
    ensureEntityFolder(null, entity, id, code);
    created++;
  }
  return 'fixMissingEntityFolders('+entity+'): '+created+' of '+diff.missing.length+' folders created';
}

/***************************  SOFT DELETE **********************************/
function softDeleteEntity(meta,entity,id){
  meta = meta || (typeof getProjectMeta==='function'?getProjectMeta():null);
  var src = ensureEntityFolder(meta,entity,id);
  var delRoot = getOrCreateSub_(DriveApp.getFolderById(extractId_(meta.originals_root_url)),'05deleted');
  src.moveTo(delRoot);
}

/***************************  BULK SYNC via DataHub *************************/
function scanDataHubPaged(entity, limit){
  var sh = SpreadsheetApp.getActive().getSheetByName('DataHub');
  if (!sh) return 0;

  var key   = 'cursor_' + entity;
  var props = PropertiesService.getScriptProperties();
  var idx   = parseInt(props.getProperty(key) || 0, 10);   // 0-based
  var ids   = getCoreArray_(sh, entity, ID_LABEL[entity]);
  var codes = CODE_LABEL[entity] ? getCoreArray_(sh, entity, CODE_LABEL[entity]) : [];

  if (idx >= ids.length){ props.deleteProperty(key); return 0; }

  limit      = limit || 500;
  var created= 0, processed = 0;

  while (idx < ids.length && processed < limit && timeLeft_() > 5000){
    var id   = ids[idx];     if (!id){ idx++; processed++; continue; }
    var code = codes[idx] || '';
    ensureEntityFolder(null, entity, id, code);
    idx++; processed++; created++;
  }
  props.setProperty(key, idx);
  if (idx >= ids.length) props.deleteProperty(key);
  return created;
}

function getCoreArray_(sh, entity, fieldLabel){
  if (!fieldLabel) return [];
  var vals = sh.getRange(2, 7, sh.getLastRow() - 1, 1).getValues();   // G 列
  for (var i = 0; i < vals.length; i++){
    var cell = vals[i][0]; if (!cell) continue;
    var p    = cell.split('|'); if (p.length < 9) continue;
    if (p[1] === entity && p[2] === fieldLabel){
      /* Core_values:  …|label|val1|val2|… → val1 から配列化 */
      return p.slice(9);
    }
  }
  return [];
}

/***************************  INTERNAL *************************************/
function serializeFiles_(folder, kind, id){
  var out = [], it = folder.getFiles();
  while (it.hasNext()){
    var f = it.next(), n = f.getName();
    if (kind === 'proxies'){
      if (id && n.indexOf(id) !== 0)  continue;       // id プレフィックス
      if (!/_proxy\./i.test(n))       continue;       // *_proxy.* だけ
    }
    out.push({
      id:           f.getId(),
      name:         n,
      mimeType:     f.getMimeType(),
      modifiedTime: f.getLastUpdated(),
      size:         f.getSize()
    });
  }
  return out;
}

/***************************  DEBUG & LIST *********************************/
function listEntityFolderNames(entity, meta){
  meta           = meta || (typeof getProjectMeta==='function' ? getProjectMeta() : null);
  var roots      = getOrCreateProjectRoots(meta);
  var originals  = DriveApp.getFolderById(roots.originalsId);
  var rootName   = ENTITY_ROOTS[entity]; if (!rootName) return [];

  var entityRoot = getOrCreateSub_(originals, rootName);
  var list       = [], it = entityRoot.getFolders();
  while (it.hasNext()){
    var f = it.next();
    list.push({ id: f.getId(), name: f.getName() });
  }
  return list;
}

function test_ListShotFolders(){
  Logger.log(listEntityFolderNames('shot'));
}

/***************************  META (fallback) *******************************/
if (typeof getProjectMeta !== 'function'){
  function getProjectMeta(){
    var sh = SpreadsheetApp.getActive().getSheetByName('project_meta');
    if (!sh) throw new Error('project_meta sheet not found');
    var data = sh.getRange(1, 1, 2, sh.getLastColumn()).getValues();
    return Object.fromEntries(data[0].map(function (k, i){
      return [k, data[1][i]];
    }));
  }
}

/** ① DataHub に載っている全 Shots / Assets / Tasks を 500 行ずつ作る */
function firstRun(){
  scanDataHubPaged('shot',  500);   // 3 行目からスタート（カーソル保存）
  scanDataHubPaged('asset', 500);   // 同上
  scanDataHubPaged('task',  500);   // 同上
}
