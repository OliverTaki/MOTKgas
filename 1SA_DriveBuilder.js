// =============================================================
// DriveBuilder.gs   (stand-alone helper for MOTK)
// =============================================================
// PURPOSE
//   • MOTKプロジェクト用のGoogle Driveフォルダ構造を保証・監査
//   • ORIGINALS :  <ROOT>/<PROJECT>-ORIGINALS/<##entityRoot>/<id>__<code>/<sub>
//   • PROXIES   :  <ROOT>/<PROJECT>-PROXIES
//   • DataHub G列 から ID / Code を取得してフォルダ同期
//   • diff / audit / 生成・リネーム（※ファイル列挙は FilesAPI に分離）
// ---------------------------------------------------------------------------

const ENTITY_ROOTS = {
  shot:    '01shots',   shots:   '01shots',
  asset:   '02assets',  assets:  '02assets',
  task:    '03tasks',   tasks:   '03tasks',
  misc:    '04misc',    deleted: '05deleted'
};
const ALL_ROOT_NAMES = ['01shots','02assets','03tasks','04misc','05deleted'];
const ID_LABEL   = { shot:'Shot ID', asset:'Asset ID', task:'Task ID' };
const CODE_LABEL = { shot:'ShotCode', asset:'AssetName', task:'' };

function getHostSpreadsheet_(){
  var id = PropertiesService.getScriptProperties().getProperty('HOST_SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No bound Spreadsheet. Run installHostSpreadsheet() once.');
  PropertiesService.getScriptProperties().setProperty('HOST_SS_ID', ss.getId());
  return ss;
}
function installHostSpreadsheet(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open the master Spreadsheet and run this.');
  PropertiesService.getScriptProperties().setProperty('HOST_SS_ID', ss.getId());
  Logger.log('HOST_SS_ID set to: '+ss.getId());
}

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

function getOrCreateProjectRoots(meta){
  meta = meta || getProjectMeta();
  if(!meta||!meta.originals_root_url||!meta.proxies_root_url)
    throw new Error('DriveBuilder: meta.originals_root_url / proxies_root_url are required');
  var originalsRoot = DriveApp.getFolderById(extractId_(meta.originals_root_url));
  var proxiesRoot   = DriveApp.getFolderById(extractId_(meta.proxies_root_url));
  ALL_ROOT_NAMES.forEach(function(n){ getOrCreateSub_(originalsRoot,n); });
  return { originalsId:originalsRoot.getId(), proxiesId:proxiesRoot.getId() };
}

/** 必要なら originals 側の entity/id フォルダを生成・改名して整える */
function ensureEntityFolder(meta,entity,id,code){
  meta = meta || getProjectMeta();
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

/** 差分確認（DataHub vs Drive） */
function diffEntityFolders(entity, meta){
  meta = meta || getProjectMeta();
  var ss  = getHostSpreadsheet_();
  var hubIds = getCoreArray_(ss.getSheetByName('DataHub'), entity, ID_LABEL[entity]);
  var driveNames = listEntityFolderNames(entity, meta).map(function(o){ return (o.name||'').split('__')[0]; });
  var missing=[], existing=[];
  hubIds.forEach(function(id){
    if(driveNames.indexOf(id)===-1) missing.push(id);
    else existing.push(id);
  });
  return { missing:missing, existing:existing, hubTotal:hubIds.length, driveTotal:driveNames.length };
}

/** 不足フォルダの生成 */
function fixMissingEntityFolders(entity, limit){
  var diff = diffEntityFolders(entity);
  var ss  = getHostSpreadsheet_();
  var codes = getCoreArray_(ss.getSheetByName('DataHub'), entity, CODE_LABEL[entity]);
  var ids   = getCoreArray_(ss.getSheetByName('DataHub'), entity, ID_LABEL[entity]);

  var created=0;
  limit = limit||diff.missing.length;
  for(var i=0;i<limit && i<diff.missing.length && timeLeft_()>5000;i++){
    var id = diff.missing[i];
    var idx = ids.indexOf(id);
    var code = idx>-1 ? (codes[idx]||'') : '';
    ensureEntityFolder(null, entity, id, code);
    created++;
  }
  return 'fixMissingEntityFolders('+entity+'): '+created+' of '+diff.missing.length+' folders created';
}

/** ソフト削除 */
function softDeleteEntity(meta,entity,id){
  meta = meta || getProjectMeta();
  var src = ensureEntityFolder(meta,entity,id);
  var delRoot = getOrCreateSub_(DriveApp.getFolderById(extractId_(meta.originals_root_url)),'05deleted');
  src.moveTo(delRoot);
}

/** DataHub 取り出し（G列 Core_values） */
function getCoreArray_(sh, entity, fieldLabel){
  if (!fieldLabel) return [];
  var vals = sh.getRange(2, 7, sh.getLastRow() - 1, 1).getValues(); // G列
  for (var i = 0; i < vals.length; i++){
    var cell = vals[i][0]; if (!cell) continue;
    var p    = cell.split('|'); if (p.length < 9) continue;
    if (p[1] === entity && p[2] === fieldLabel){
      return p.slice(9);
    }
  }
  return [];
}

/** entity 直下のフォルダ名一覧（監査用） */
function listEntityFolderNames(entity, meta){
  meta           = meta || getProjectMeta();
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

/** プロジェクト meta */
function getProjectMeta(){
  var ss = getHostSpreadsheet_();
  var sh = ss.getSheetByName('project_meta');
  if (!sh) throw new Error('project_meta sheet not found');
  var data = sh.getRange(1, 1, 2, sh.getLastColumn()).getValues();
  return Object.fromEntries(data[0].map(function (k, i){
    return [k, data[1][i]];
  }));
}

/** 一括同期（生成系のみ） */
function syncEntityFoldersSafe(entity, limit) {
  var ss = getHostSpreadsheet_();
  var ids   = getCoreArray_(ss.getSheetByName('DataHub'), entity, ID_LABEL[entity]);
  var codes = CODE_LABEL[entity] ? getCoreArray_(ss.getSheetByName('DataHub'), entity, CODE_LABEL[entity]) : [];

  var roots = getOrCreateProjectRoots(getProjectMeta());
  var originalsRoot = DriveApp.getFolderById(roots.originalsId);
  var rootName = ENTITY_ROOTS[entity];
  if (!rootName) throw new Error("Unknown entity: " + entity);
  var entityRoot = getOrCreateSub_(originalsRoot, rootName);

  var existing = {};
  var it = entityRoot.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var nameParts = (f.getName() || '').split('__');
    var folderIdPart = nameParts[0];
    var folderCodePart = nameParts.length > 1 ? nameParts[1] : '';
    existing[folderIdPart] = { folder: f, code: folderCodePart };
  }

  var created = 0, renamed = 0;
  limit = limit || ids.length;

  for (var i = 0; i < ids.length && created < limit && timeLeft_() > 5000; i++) {
    var id = ids[i];
    if (!id) continue;
    if (existing[id]) continue;
    var code = codes[i] || '';
    var wantedName = code ? id + '__' + code : id;
    var idFolder = entityRoot.createFolder(wantedName);
    if (entity === 'shot')  getOrCreateSub_(idFolder, 'shotview');
    if (entity === 'asset') getOrCreateSub_(idFolder, 'assetview');
    existing[id] = { folder: idFolder, code: code };
    created++;
  }

  for (var j = 0; j < ids.length && timeLeft_() > 5000; j++) {
    var idCheck = ids[j];
    if (!idCheck || !existing[idCheck]) continue;
    var newCode = codes[j] || '';
    var oldCode = existing[idCheck].code || '';
    if (newCode && newCode !== oldCode) {
      var newName = idCheck + '__' + newCode;
      existing[idCheck].folder.setName(newName);
      renamed++;
    }
  }

  return { created: created, renamed: renamed };
}

function syncAllEntitiesSafe(limitPerEntity) {
  var results = [];
  results.push(syncEntityFoldersSafe('shot',  limitPerEntity));
  results.push(syncEntityFoldersSafe('asset', limitPerEntity));
  results.push(syncEntityFoldersSafe('task',  limitPerEntity));
  return results;
}
