/* ===== 1.header ===== */
// Debug Panel server API. External deps as optional only.
/* ===== 1. End ===== */

/* ===== 2.utils ===== */
function _isHttpUrl_(s){ return typeof s==="string" && /^https?:\/\//i.test(s); }
function _safeCall_(name, arg){
  try{ var f=this[name]; if(typeof f==="function") return {name, value:f(arg)}; }catch(_){}
  return {name:null, value:null};
}
function _safeChain_(names, arg){
  for(var i=0;i<names.length;i++){
    var r=_safeCall_(names[i], arg);
    if(r.value!=null) return r;
  }
  return {name:null, value:null};
}
/* ===== 2. End ===== */

/* ===== 3.debugPing ===== */
function dp_debugPing(){ return { ts: Date.now(), ok:true }; }
/* ===== 3. End ===== */

/* ===== 4.pageLayoutPresets ===== */
function dp_listPageLayoutPresets(req){
  // 実装未了でもエラーにしないための安定返却
  // 既に別APIがあるならクライアント側でそれを使う
  return [];
}
/* ===== 4. End ===== */

/* ===== 5.Project meta accessor ===== */
function dp_getProjectMeta(){
  try{
    if(typeof _sv_getMeta_==="function"){
      var meta=_sv_getMeta_({})||{};
      return meta;
    }
  }catch(_){}
  return {};
}
/* ===== 5. End ===== */

/* ===== 6.Originals trace ===== */
function dp_traceOriginals(req){
  // 常に安定返却: {input, steps[], finalUrl, found}
  req=req||{};
  var ent=String(req.entity||"shot").toLowerCase();
  var id =String(req.id||"").trim();
  var out={ input:{entity:ent,id:id}, steps:[], finalUrl:"", found:false };
  function step(name,ok,info){ out.steps.push({name:name, ok:!!ok, info:info||{}}); }

  // A) DriveBuilder 系（存在すれば最優先）
  var db = _safeChain_(["DB_getOriginalsUrl","DriveBuilder_getOriginalsUrl","DB_getOriginalsFolderUrl","DriveBuilder_getOriginalsFolderUrl"], [ent,id]);
  var dbUrl = "";
  if(db.value){
    if(typeof db.value==="string" && _isHttpUrl_(db.value)) dbUrl=db.value;
    else if(db.value && typeof db.value==="object" && _isHttpUrl_(db.value.url)) dbUrl=db.value.url;
  }
  step("DriveBuilder", !!dbUrl, {fn:db.name, url: dbUrl||null});

  // B) 汎用サーバAPI 群（存在するものだけ）
  var api = _safeChain_(["sv_getOriginalsUrl","getOriginalsUrl","sv_getOriginalsFolderUrl","getOriginalsFolderUrl"], {entity:ent,id:id});
  var apiUrl="";
  if(api.value){
    if(typeof api.value==="string" && _isHttpUrl_(api.value)) apiUrl=api.value;
    else if(api.value && typeof api.value==="object" && _isHttpUrl_(api.value.url)) apiUrl=api.value.url;
  }
  step("ServerAPIs", !!apiUrl, {fn:api.name, url: apiUrl||null});

  // C) ProjectMeta root の存在確認（表示用）
  var root="";
  try{
    var meta=dp_getProjectMeta()||{};
    root = meta.originals_root_url || meta.proxies_root_url || "";
  }catch(_){}
  step("ProjectMetaRoot", !!root, {root: root||null});

  // D) 最終決定（優先度: ServerAPIs > DriveBuilder > ProjectMetaRoot）
  out.finalUrl = apiUrl || dbUrl || root || "";
  out.found = !!out.finalUrl;
  return out;
}
/* ===== 6. End ===== */
