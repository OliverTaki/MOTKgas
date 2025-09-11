/* ===== 1. header ===== */
/**
 * LinkMaps（ID->表示名）と Originals 解決 API を一本化。
 *
 * sv_getLinkMaps() -> {
 *   assets:  { as_0001: "Asset A", ... },
 *   shots:   { sh_0001: "SC_010_A", ... },
 *   tasks:   { ta_0001: "Compositing", ... },
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
/* ===== 2. End ===== */


/* ===== 3. name detectors ===== */
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
  // より強い互換: TaskName / Task Name / Name / Title など
  var pri=[/^(task.?name)$/i,/^(task .*name)$/i,/^(name)$/i,/^(title)$/i];
  for(var i=0;i<pri.length;i++){ var j=LM_headerIndex_(header,pri[i]); if(j>=0) return j; }
  // 「task を含み name も含む」ようなヘッダを探す
  for(var k=0;k<header.length;k++){
    var h=String(header[k]||"").toLowerCase();
    if(h.includes("task") && h.includes("name")) return k;
  }
  return Math.max(1,1);
}
function LM_detectNameIndex_Users_(header){
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
  var idCol = 0; // fi_0001 を想定
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
  var vals = LM_tryReadSheet_("ProjectMeta");
  if(!vals || vals.length<2) return "";
  var header = vals[0]||[];
  var cKey = LM_headerIndex_(header,/^key$/i);
  var cVal = LM_headerIndex_(header,/^value$/i);
  if(cKey<0 || cVal<0) return "";

  var root = "";
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
  if(root.slice(-1)!=="/") root+="/";
  return root + (entity||"shot") + "/" + (id||"");
}

function LM_findOriginalsUrl_(entity, id, fid, value, row){
  var key = (entity||"")+":"+String(id||"");
  var c = LM_ORIG_CACHE_.get(key); if(c) return c;

  // 1) DriveBuilder 系（名前違いも網羅）
  var fnNames = [
    "DB_getOriginalsUrl",
    "DriveBuilder_getOriginalsUrl",
    "DB_getOriginalsFolderUrl",
    "DriveBuilder_getOriginalsFolderUrl"
  ];
  for(var i=0;i<fnNames.length;i++){
    try{
      var fn = this[fnNames[i]];
      if(typeof fn === "function"){
        var res = fn(entity,id);
        if(typeof res === "string"){
          // URL か ID かを判定
          var url = /^https?:\/\//i.test(res) ? res : LM_toDriveUrlFromId_(res,true);
          LM_ORIG_CACHE_.set(key,url); return url;
        }else if(res && typeof res==="object"){
          if(res.url){ LM_ORIG_CACHE_.set(key,res.url); return res.url; }
          if(res.id){ var u=LM_toDriveUrlFromId_(res.id,true); LM_ORIG_CACHE_.set(key,u); return u; }
          if(res.folderId){ var u2=LM_toDriveUrlFromId_(res.folderId,true); LM_ORIG_CACHE_.set(key,u2); return u2; }
        }
      }
    }catch(_){}
  }

  // 2) DriveRegistry（任意）
  var reg = LM_tryReadSheet_("DriveRegistry"); // [Entity, ID, Kind, Url/Id]
  if(reg && reg.length>1){
    var hd=reg[0]||[];
    var cEnt=LM_headerIndex_(hd,/^(entity)$/i);
    var cId =LM_headerIndex_(hd,/^(id)$/i);
    var cUrl=LM_headerIndex_(hd,/^(url|value|path)$/i);
    var cTyp=LM_headerIndex_(hd,/^(type|kind)$/i);
    for(var r=1;r<reg.length;r++){
      var er=String((reg[r][cEnt]||"")+"").toLowerCase();
      var ir=String(reg[r][cId]||"");
      if(er===String(entity||"").toLowerCase() && ir===String(id||"")){
        var raw = String(reg[r][cUrl]||"").trim();
        var t = cTyp>=0 ? String(reg[r][cTyp]||"").toLowerCase() : "";
        if(raw){
          var url = /^https?:\/\//i.test(raw) ? raw : LM_toDriveUrlFromId_(raw, /*isFolder*/ t!=="file");
          LM_ORIG_CACHE_.set(key,url); return url;
        }
      }
    }
  }

  // 3) ProjectMeta から推定（最後の保険）
  var guess = LM_fromProjectMetaRoot_(entity,id);
  if(guess){ LM_ORIG_CACHE_.set(key,guess); return guess; }

  return "";
}

function sv_getOriginalsFolderUrl(arg){
  arg = arg || {};
  var entity = String(arg.entity||"shot");
  var id = String(arg.id || (arg.row && (arg.row.fi_0001||arg.row.id||arg.row.ID)) || "");
  return LM_findOriginalsUrl_(entity,id,arg.fid,arg.value,arg.row) || "";
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
