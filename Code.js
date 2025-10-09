/** =========================================
 *  Code.gs (ナンバリング整理版)
 *  - doGet に DebugPanel ページ追加
 *  - 他の処理は現状維持
 * =========================================*/


/* ===== 1. グローバルコンテキスト ===== */
var __VIEW_CTX = { scriptUrl:'', page:'', entity:'', id:'', dataJson:'[]' };
/* ===== 1. End ===== */


/* ===== 2. include (HTML 部品読込) ===== */
function include(filename) {
  var t = HtmlService.createTemplateFromFile(filename);
  for (var k in __VIEW_CTX) if (__VIEW_CTX.hasOwnProperty(k)) t[k] = __VIEW_CTX[k];
  return t.evaluate().getContent();
}
/* ===== 2. End ===== */

/* ===== 3. doGet Router（差し替え・全文） ===== */function doGet(e){var p=(e&&e.parameter&&e.parameter.page)||'Shots';var scriptUrl=ScriptApp.getService().getUrl();var dataJson="'[]'";__VIEW_CTX.page=p;__VIEW_CTX.scriptUrl=scriptUrl;__VIEW_CTX.dataJson=dataJson;var viewerTpl=HtmlService.createTemplateFromFile('viewer');viewerTpl.page=p;viewerTpl.scriptUrl=scriptUrl;viewerTpl.dataJson=dataJson;var viewerHtml=viewerTpl.evaluate().getContent();var headMatch=viewerHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);var headScripts=headMatch?(headMatch[1].match(/<script[\s\S]*?<\/script>/gi)||[]).join('\n'):'';var bodyMatch=viewerHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);var t=HtmlService.createTemplateFromFile('index');t.page=p;t.scriptUrl=scriptUrl;t.dataJson=dataJson;t.viewerHtml=(headScripts?headScripts+'\n':'')+(bodyMatch?bodyMatch[1]:viewerHtml);var out=t.evaluate().setTitle('MOTK Viewer').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);return out;}/* ===== 3. End ===== */



/* ===== 4. Data 読み取り（DataHub 優先） ===== */
function _readFromDataHubOrSheet_(sheetName){
  var dh = SpreadsheetApp.getActive().getSheetByName('DataHub');
  if (dh) {
    var vals = dh.getDataRange().getValues();
    if (vals && vals.length) {
      var header = vals[0];
      var col = header.indexOf(sheetName);
      if (col >= 0) {
        var colVals = vals.map(function(r){ return r[col]; });
        var ids     = String(colVals[1]||'').split('|');
        var names   = String(colVals[2]||'').split('|');
        var rows    = colVals.slice(3)
                        .map(function(v){ return v?String(v).split('|'):[]; })
                        .filter(function(a){ return a.length && String(a[0]||'')!==''; });
        return { ids:ids, header:names, rows:rows };
      }
    }
  }
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var rangeVals = sh ? sh.getDataRange().getValues() : [];
  if (!rangeVals || !rangeVals.length) return { ids:[], header:[], rows:[] };
  var idsRow   = rangeVals[0]||[];
  var namesRow = rangeVals[1]||[];
  var rows     = rangeVals.slice(2).filter(function(row){
    return row && row.some(function(v){ return v!=='' && v!=null; });
  }).map(function(r){ return r.map(function(v){ return v==null?'':String(v); }); });
  return { ids:idsRow, header:namesRow, rows:rows };
}
/* ===== 4. End ===== */


/* ===== 5. 型推定/補正ユーティリティ ===== */
function _inferTypes_(rows, ids){
  var types = new Array(ids.length).fill('text');
  var sample = Math.min(rows.length, 200);
  for (var c=0;c<ids.length;c++){
    for (var r=0;r<sample;r++){
      var v = rows[r][c];
      if (v==='' || v==null) continue;
      if (typeof v === 'number'){ types[c]='number'; break; }
      if (v instanceof Date){ types[c]='date'; break; }
      var s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) { types[c]='date'; break; }
      if (/^-?\d+(\.\d+)?$/.test(s))    { types[c]='number'; break; }
    }
  }
  return types;
}

function _coerce_(v, t){
  if (v==null || v==='') return null;
  if (t==='number'){
    if (typeof v==='number') return v;
    var n = Number(String(v).replace(/,/g,'')); return isFinite(n) ? n : null;
  }
  if (t==='date'){
    if (v instanceof Date) return v;
    var d = _parseDate_(String(v)); return d || null;
  }
  return v;
}
function _parseDate_(s){
  if (!s) return null;
  try{
    if (s instanceof Date) return s;
    var m = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(m) || /^\d{4}\/\d{2}\/\d{2}/.test(m)) return new Date(m);
    var d = new Date(m); if (!isNaN(d.getTime())) return d;
  }catch(e){}
  return null;
}
function _sameDay_(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
/* ===== 5. End ===== */


/* ===== 6. フィルタ評価ユーティリティ ===== */
function _containsAny_(raw, valOrValues){
  var hay = String(raw==null?'':raw).toLowerCase();
  var arr = [];
  if (Array.isArray(valOrValues)) arr = valOrValues;
  else if (typeof valOrValues === 'string') arr = valOrValues.split(',').map(function(s){ return s.trim(); });
  else arr = [String(valOrValues||'')];
  if (!arr.length) return false;
  for (var i=0;i<arr.length;i++){
    var needle = String(arr[i]||'').toLowerCase();
    if (!needle) continue;
    if (hay.indexOf(needle) !== -1) return true;
  }
  return false;
}

function _testRule_(cell, f, type){
  var op = String(f.op||'').toLowerCase();
  var raw = cell;

  if (op==='isempty')     return (raw==null || String(raw)==='');
  if (op==='isnotempty')  return !(raw==null || String(raw)==='');

  if (Array.isArray(f.values) && f.values.length){
    if (type==='date'){
      if (op==='is')    return f.values.some(function(v){ var t=_coerce_(v,'date'), d=_coerce_(raw,'date'); return t && d && _sameDay_(d,t); });
      if (op==='isnot') return !f.values.some(function(v){ var t=_coerce_(v,'date'), d=_coerce_(raw,'date'); return t && d && _sameDay_(d,t); });
      return false;
    } else {
      if (op==='contains')     return _containsAny_(raw, f.values);
      if (op==='is')           return f.values.some(function(v){ return String(raw) === String(v); });
      if (op==='isnot')        return !f.values.some(function(v){ return String(raw) === String(v); });
      if (op==='notcontains')  return !_containsAny_(raw, f.values);
      return false;
    }
  }

  var val = (f.value==null)? '' : String(f.value);

  if (type==='date'){
    var d = _coerce_(raw, 'date');
    if (op==='is'){ var t = _coerce_(val, 'date'); if (!t || !d) return false; return _sameDay_(d, t); }
    if (op==='isnot'){ var t2 = _coerce_(val, 'date'); if (!t2 || !d) return false; return !_sameDay_(d, t2); }
    if (op==='after'){ var a = _coerce_(val, 'date'); if (!d || !a) return false; return d.getTime() > a.getTime(); }
    if (op==='before'){ var b = _coerce_(val, 'date'); if (!d || !b) return false; return d.getTime() < b.getTime(); }
    if (op==='range'){ var rr = String(val||'').split('..'); if (rr.length!==2) return false;
      var da = _coerce_(rr[0], 'date'), db = _coerce_(rr[1], 'date'); if (!d||!da||!db) return false;
      var minT = Math.min(da.getTime(), db.getTime()), maxT = Math.max(db.getTime(), da.getTime());
      return d.getTime() >= minT && d.getTime() <= maxT;
    }
    return true;
  }

  var sRaw = (raw==null)? '' : String(raw);
  if (op==='is')           return sRaw === val;
  if (op==='isnot')        return sRaw !== val;
  if (op==='contains')     return _containsAny_(sRaw, val);
  if (op==='notcontains')  return !_containsAny_(sRaw, val);
  return true;
}

function _evalGroup_(row, group, ids, colTypes){
  var rules = Array.isArray(group.rules)? group.rules : [];
  var mode  = String(group.mode||'all').toLowerCase();
  if (!rules.length) return true;

  if (mode==='any'){
    for (var i=0;i<rules.length;i++){
      var f = rules[i]; if (!f || !f.id || !f.op) continue;
      var idx = ids.indexOf(f.id); if (idx<0) continue;
      if (_testRule_(row[idx], f, colTypes[idx])) return true;
    }
    return false;
  } else {
    for (var j=0;j<rules.length;j++){
      var g = rules[j]; if (!g || !g.id || !g.op) continue;
      var k = ids.indexOf(g.id); if (k<0) return false;
      if (!_testRule_(row[k], g, colTypes[k])) return false;
    }
    return true;
  }
}
/* ===== 6. End ===== */


/* ===== 7. 公開 API ===== */
function listRowsPage(params){
  params = params || {};
  var sheetName    = String(params.entity || params.sheet || '').trim() || 'Shots';
  var offset       = Math.max(0, Number(params.offset || 0));
  var limit        = Math.max(1, Number(params.limit  || 100));
  var sort         = Array.isArray(params.sort) ? params.sort : [];

  var flatFilter   = Array.isArray(params.filter) ? params.filter : [];
  var flatMode     = String(params.filterMode || 'all').toLowerCase();

  var groups       = Array.isArray(params.filterGroups) ? params.filterGroups : [];
  var groupCombine = String(params.groupCombine || 'all').toLowerCase();

  var payload = _readFromDataHubOrSheet_(sheetName);
  var ids    = payload.ids;
  var header = payload.header;
  var data   = payload.rows.slice();
  var colTypes = _inferTypes_(data, ids);

  if (groups.length){
    data = data.filter(function(row){
      if (groupCombine === 'any'){
        for (var gi=0; gi<groups.length; gi++){
          if (_evalGroup_(row, groups[gi], ids, colTypes)) return true;
        }
        return false;
      } else {
        for (var gj=0; gj<groups.length; gj++){
          if (!_evalGroup_(row, groups[gj], ids, colTypes)) return false;
        }
        return true;
      }
    });
  } else if (flatFilter.length){
    if (flatMode === 'any'){
      data = data.filter(function(row){
        for (var i=0;i<flatFilter.length;i++){
          var f = flatFilter[i]; if (!f || !f.id || !f.op) continue;
          var idx = ids.indexOf(f.id); if (idx<0) continue;
          if (_testRule_(row[idx], f, colTypes[idx])) return true;
        }
        return false;
      });
    } else {
      data = data.filter(function(row){
        for (var j=0;j<flatFilter.length;j++){
          var f2 = flatFilter[j]; if (!f2 || !f2.id || !f2.op) continue;
          var idx2 = ids.indexOf(f2.id); if (idx2<0) return false;
          if (!_testRule_(row[idx2], f2, colTypes[idx2])) return false;
        }
        return true;
      });
    }
  }

  if (sort && sort.length){
    data.sort(function(a,b){
      for (var i=0;i<sort.length;i++){
        var s = sort[i]; if (!s || !s.id) continue;
        var idx = ids.indexOf(s.id); if (idx<0) continue;
        var dir = (String(s.dir||'asc').toLowerCase()==='desc') ? -1 : 1;
        var av = _coerce_(a[idx], colTypes[idx]);
        var bv = _coerce_(b[idx], colTypes[idx]);
        if (av == null && bv == null) continue;
        if (av == null) return -dir;
        if (bv == null) return  dir;
        if (colTypes[idx]==='number'){
          if (av < bv) return -dir;
          if (av > bv) return  dir;
        } else if (colTypes[idx]==='date'){
          var at = (av instanceof Date ? av.getTime() : NaN);
          var bt = (bv instanceof Date ? bv.getTime() : NaN);
          if (at < bt) return -dir;
          if (at > bt) return  dir;
        } else {
          var cmp = String(av).localeCompare(String(bv), 'ja', {numeric:true, sensitivity:'base'}); 
          if (cmp !== 0) return cmp * dir;
        }
      }
      return 0;
    });
  }

  var total = data.length;
  var pageRows = data.slice(offset, offset+limit);
  return { ids:ids, header:header, rows:pageRows, total:total };
}
/* ===== 7. End ===== */

/* ===== 70.header (Entity Read/Write API) ===== */
/**
 * 目的:
 * - DETAIL_entity.html からのレコード読込/差分書込APIを提供
 * 前提:
 * - ES5準拠
 * - システムは全権。ユーザーUIからの編集は Fields 側のeditable相当で判定
 * - ID→ラベル置換は entity_link のみ（返却は {v,id,label?,t} 形）
 */
/* ===== 70. End ===== */


/* ===== 71.utils ===== */
function _SS_(){ return SpreadsheetApp.getActive(); }
function _shByName_(name){
  var ss = _SS_(); var sh = ss && ss.getSheetByName(name);
  if(!sh) throw new Error("Sheet not found: "+name);
  return sh;
}
function _read2D_(name){
  var v = _shByName_(name).getDataRange().getValues();
  if(!v || !v.length) throw new Error("Empty sheet: "+name);
  return v;
}
function _hdrIndex_(hdr, name){
  for(var i=0;i<hdr.length;i++){ if(String(hdr[i]).trim().toLowerCase()===String(name).trim().toLowerCase()) return i; }
  return -1;
}
function _norm_(s){ return String(s||"").trim().toLowerCase().replace(/[^\w]+/g,"_"); }
function _arrToObj_(hdr, row){
  var o={}, i;
  for(i=0;i<hdr.length;i++){ o[String(hdr[i])] = row[i]; }
  return o;
}
/* ===== 71. End ===== */


/* ===== 72.entity_sheet_map ===== */
function _entityToSheet_(entity){
  var m = {
    "shot":"Shots",
    "asset":"Assets",
    "task":"Tasks",
    "member":"ProjectMembers",
    "user":"Users",
    "page":"Pages"
  };
  var key = _norm_(entity);
  if(!m[key]) throw new Error("Unknown entity: "+entity);
  return m[key];
}
function _idPrefixToEntity_(idValue){
  if(typeof idValue!=="string") return null;
  if(/^sh_\d+/.test(idValue)) return "shot";
  if(/^as_\d+/.test(idValue)) return "asset";
  if(/^ta_\d+/.test(idValue)) return "task";
  if(/^us_\d+/.test(idValue)) return "user";
  if(/^mb_\d+/.test(idValue)) return "member";
  if(/^pg_\d+/.test(idValue)) return "page";
  return null;
}
/* ===== 72. End ===== */


/* ===== 73.fields_resolver ===== */
/**
 * Fieldsシートから:
 *  - 各entityのID列・ラベル列（type=='id' | 'entity_name'）
 *  - editable相当
 * を推定。ヘッダ名はゆるく正規化して探索する。
 */
function _readFields_(){
  var values = _read2D_("Fields"); // 例外時は既存運用に従いthrow
  var hdr = values[0];
  var rows = values.slice(1);
  var H = {};
  for(var i=0;i<hdr.length;i++){ H[_norm_(hdr[i])] = i; }
  // 想定カラム候補
  var C = {
    entity: H.entity!=null?H.entity:(H.ent!=null?H.ent:null),
    type: H.type!=null?H.type:(H.kind!=null?H.kind:null),
    field_id: H.field_id!=null?H.field_id:(H.fi!=null?H.fi:null),
    column_name: H.column!=null?H.column:(H.column_name!=null?H.column_name:(H.col!=null?H.col:null)),
    editable: (H.editable!=null?H.editable:(H.can_edit!=null?H.can_edit:null))
  };
  var out = [];
  for(var r=0;r<rows.length;r++){
    var row = rows[r];
    var o = {
      entity: C.entity!=null?row[C.entity]:"",
      type:   C.type!=null?row[C.type]:"",
      field_id: C.field_id!=null?row[C.field_id]:"",
      column_name: C.column_name!=null?row[C.column_name]:"",
      editable: C.editable!=null?row[C.editable]:false
    };
    out.push(o);
  }
  return out;
}
function _idAndLabelCols_(entity, sheetHdr){
  var fields = _readFields_();
  var e = _norm_(entity);
  var idName=null, labelName=null;
  for(var i=0;i<fields.length;i++){
    if(_norm_(fields[i].entity)!==e) continue;
    var t = _norm_(fields[i].type);
    if(t==="id" && fields[i].column_name){ idName = fields[i].column_name; }
    if((t==="entity_name"||t==="name") && fields[i].column_name){ labelName = fields[i].column_name; }
  }
  // Fallback（安全側）
  if(idName==null){
    var guess = ["id", e+"_id", e+"id", "code", "key"];
    for(var g=0;g<guess.length && idName==null; g++){
      var idx = _hdrIndex_(sheetHdr, guess[g]);
      if(idx>=0) idName = sheetHdr[idx];
    }
  }
  if(labelName==null){
    var guessL = ["name", "label", "code", e, e+"_name"];
    for(var h=0;h<guessL.length && labelName==null; h++){
      var idx2 = _hdrIndex_(sheetHdr, guessL[h]);
      if(idx2>=0) labelName = sheetHdr[idx2];
    }
  }
  return { idName:idName, labelName:labelName };
}
function _isEditable_(entity, colName){
  // 他ユーザー向けの編集可否。システムは無制限だが、フラグは返す。
  var fields = _readFields_();
  var e = _norm_(entity), c = _norm_(colName);
  for(var i=0;i<fields.length;i++){
    if(_norm_(fields[i].entity)!==e) continue;
    if(_norm_(fields[i].column_name)===c){
      var v = fields[i].editable;
      // truthy判定（TRUE/true/1/Yes）
      return (String(v).toLowerCase()==="true" || String(v)==="1" || String(v).toLowerCase()==="yes");
    }
  }
  return false;
}
/* ===== 73. End ===== */


/* ===== 74.label_resolver (entity_linkのみラベル化) ===== */
function _resolveEntityLinkLabel_(idValue){
  var ent = _idPrefixToEntity_(idValue);
  if(!ent) return null;
  var sheet = _entityToSheet_(ent);
  var values = _read2D_(sheet);
  var hdr = values[0];
  var map = _idAndLabelCols_(ent, hdr);
  if(!map.idName) return null;
  var idCol = _hdrIndex_(hdr, map.idName);
  var labelCol = map.labelName ? _hdrIndex_(hdr, map.labelName) : -1;
  var i, row;
  for(i=1;i<values.length;i++){
    row = values[i];
    if(String(row[idCol])===String(idValue)){
      return (labelCol>=0)? String(row[labelCol]) : null;
    }
  }
  return null;
}
function _cellToViewToken_(colName, value){
  // entity_linkの判定：値のprefixから推定。ID→ラベルはここだけ。
  var t = "text", label=null;
  if(typeof value==="string"){
    var pref = _idPrefixToEntity_(value);
    if(pref){ t="entity_link"; label = _resolveEntityLinkLabel_(value); }
  }
  return { c: String(colName), t:t, v:value, label: label };
}
/* ===== 74. End ===== */


/* ===== 75.dp_getEntityRecord ===== */
function dp_getEntityRecord(entity, id){
  try{
    var sheet = _entityToSheet_(entity);
    var values = _read2D_(sheet);
    var hdr = values[0];
    var map = _idAndLabelCols_(entity, hdr);
    if(!map.idName) throw new Error("ID column not resolved for entity: "+entity);
    var idCol = _hdrIndex_(hdr, map.idName);
    var labelCol = map.labelName ? _hdrIndex_(hdr, map.labelName) : -1;

    var i, row, found=-1;
    for(i=1;i<values.length;i++){
      row = values[i];
      if(String(row[idCol])===String(id)){ found=i; break; }
    }
    if(found<0) return { ok:false, error:"Record not found", entity:entity, id:id };

    var rec = {};
    for(i=0;i<hdr.length;i++){
      var token = _cellToViewToken_(hdr[i], values[found][i]);
      token.editable = _isEditable_(entity, hdr[i]); // 他ユーザー向け
      rec[hdr[i]] = token;
    }
    var labelVal = (labelCol>=0)? values[found][labelCol] : null;

    return {
      ok:true,
      entity: entity,
      sheet: sheet,
      id: id,
      id_col: map.idName,
      label_col: map.labelName,
      label: labelVal,
      fields: rec
    };
  }catch(e){
    return { ok:false, error:String(e && e.message || e), entity:entity, id:id };
  }
}
/* ===== 75. End ===== */


/* ===== 76.dp_updateEntityRecord (PATCH) ===== */
function dp_updateEntityRecord(entity, id, patch){
  // 差分のみ。システムは全権だが、非editable列に対してはwarningsを返す。
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");

    var sheetName = _entityToSheet_(entity);
    var sh = _shByName_(sheetName);
    var values = sh.getDataRange().getValues();
    var hdr = values[0];
    var map = _idAndLabelCols_(entity, hdr);
    if(!map.idName) throw new Error("ID column not resolved for entity: "+entity);
    var idCol = _hdrIndex_(hdr, map.idName);

    // 対象行探索
    var rIdx=-1, i;
    for(i=1;i<values.length;i++){
      if(String(values[i][idCol])===String(id)){ rIdx=i; break; }
    }
    if(rIdx<0) return { ok:false, error:"Record not found", entity:entity, id:id };

    // 行の複製
    var row = values[rIdx].slice();
    var warnings = [];

    // PATCH適用
    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      var colIdx = _hdrIndex_(hdr, k);
      if(colIdx<0) continue; // 未知カラムは無視

      // editable判定は返却用に保持（システムは書く）
      if(!_isEditable_(entity, k)){
        warnings.push("non_editable: "+k);
      }
      row[colIdx] = patch[k];
    }

    // 書込（一括）
    sh.getRange(rIdx+1, 1, 1, hdr.length).setValues([row]);

    // 最新を返す
    var latest = dp_getEntityRecord(entity, id);
    latest.warnings = warnings;
    latest.ok = true;
    return latest;

  }catch(e){
    return { ok:false, error:String(e && e.message || e), entity:entity, id:id };
  }
}
/* ===== 76. End ===== */

/* ===== 81.page.header ===== */
/**
 * Pageタブの必須4列（Page Name, Page Type, Entity, Shared）を安全に読み書きする専用API。
 * - 既存UI/HTMLは変更不要。Code.jsのみ差し込みで動作。
 * - Sharedは "TRUE/true/1/yes/on/✓" → true、それ以外→false に正規化。
 * - save-as用ユーティリティも提供（元行の値を引き継ぎつつ上書き可）。
 */
/* ===== 81. End ===== */

/* ===== 82.page.utils ===== */
function _pg_ss_(){ return SpreadsheetApp.getActive(); }
function _pg_sh_(){ var sh=_pg_ss_().getSheetByName("Pages"); if(!sh) throw new Error("Sheet not found: Pages"); return sh; }
function _pg_readAll_(){
  var sh=_pg_sh_();
  var v=sh.getDataRange().getValues();
  if(!v||v.length<2) throw new Error("Pages header rows missing");
  return { sh:sh, hdrIds:v[0], hdrNames:v[1], rows:v.slice(2) };
}
function _pg_normBool_(v){
  var s=String(v).trim().toLowerCase();
  return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="✓";
}
function _pg_idxById_(hdrIds, idOrFi){
  var key=String(idOrFi).trim().toLowerCase();
  for(var i=0;i<hdrIds.length;i++){
    if(String(hdrIds[i]).trim().toLowerCase()===key) return i;
  }
  return -1;
}
function _pg_idxByName_(hdrNames, name){
  var key=String(name).trim().toLowerCase();
  for(var i=0;i<hdrNames.length;i++){
    if(String(hdrNames[i]).trim().toLowerCase()===key) return i;
  }
  return -1;
}
// 列名解決：FI優先 → 人間ラベル → 同義キーをラベルへ寄せて再探索
function _pg_resolveCol_(hdrIds, hdrNames, key){
  if(!key) return -1;
  // 1) すでに FI 指定（fi_XXXX）
  if(/^fi_\d{4,}$/i.test(key)){
    var idx=_pg_idxById_(hdrIds, key);
    if(idx>=0) return idx;
  }
  // 2) そのままラベル一致
  var idxN=_pg_idxByName_(hdrNames, key);
  if(idxN>=0) return idxN;
  // 3) 同義語を正規ラベルに寄せる
  var k=String(key).trim().toLowerCase();
  if(k==="page_name"||k==="name"||k==="title") k="page name";
  else if(k==="page_type"||k==="type")          k="page type";
  else if(k==="is_shared"||k==="shared?")       k="shared";
  else if(k==="config_json"||k==="config")      k="config";
  // 再探索（ラベル）
  idxN=_pg_idxByName_(hdrNames, k);
  if(idxN>=0) return idxN;
  // 4) 最後に FI としても試す（万一ラベルが fi_ に置かれている場合）
  return _pg_idxById_(hdrIds, k);
}
// Page ID 列の特定（FI優先→ラベル）
function _pg_locateIdCol_(hdrIds, hdrNames){
  var c;
  c=_pg_idxById_(hdrIds, "fi_0052"); if(c>=0) return c;          // Page ID 慣例
  c=_pg_idxByName_(hdrNames, "page id"); if(c>=0) return c;
  c=_pg_idxById_(hdrIds, "page_id"); if(c>=0) return c;
  c=_pg_idxById_(hdrIds, "id"); if(c>=0) return c;
  throw new Error("Pages: ID column not resolved");
}
/* ===== 82. End ===== */


/* ===== 83.page.api ===== */
/**
 * 読み込み：必要ならデバッグ用途で使用。UI差し替え不要。
 */
function dp_getPageRecord(id){
  try{
    var values=_pg_read2D_(); var hdr=values[0];
    // ID列は慣例： "Page ID" / "page_id" / "id" を順に探索
    var idName=null;
    var cands=["Page ID","page_id","id"];
    for(var i=0;i<cands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,cands[i])>=0) idName=cands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    var r=_pg_findById_(hdr, values, idName, id);
    if(r<0) return { ok:false, error:"Record not found", id:id };
    var rec={};
    for(var c=0;c<hdr.length;c++){ rec[hdr[c]]=values[r][c]; }

    return { ok:true, id:id, fields:rec };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), id:id };
  }
}

/**
 * 書き込み（差分PATCH）：CONFIGだけでなく、Page Name / Page Type / Entity / Shared も対象。
 * 既存の一般用保存ロジックから、entity==='page' の場合にこれを呼ぶだけで修復可能。
 */
function dp_updatePageRecord(id, patch){
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");

    var values=_pg_read2D_(); var hdr=values[0]; var sh=_pg_sh_();

    // 列名解決
    var idName=null, idCands=["Page ID","page_id","id"];
    for(var i=0;i<idCands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,idCands[i])>=0) idName=idCands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    var r=_pg_findById_(hdr, values, idName, id);
    if(r<0) return { ok:false, error:"Record not found", id:id };

    var row=values[r].slice(); // コピー
    // 正式列名
    var COL_PAGE_NAME = "Page Name";
    var COL_PAGE_TYPE = "Page Type";
    var COL_ENTITY    = "Entity";
    var COL_SHARED    = "Shared";

    // PATCH適用（任意列）+ Sharedの正規化
    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      var idx=_pg_hdrIdx_(hdr, k);
      if(idx<0) continue; // 未知列は無視
      var v = (k===COL_SHARED)? _pg_normBool_(patch[k]) : patch[k];
      row[idx]=v;
    }

    // 書込
    sh.getRange(r+1, 1, 1, hdr.length).setValues([row]);

    // 返却
    var latest={};
    for(var c=0;c<hdr.length;c++){ latest[hdr[c]]=row[c]; }
    return { ok:true, id:id, fields:latest };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), id:id };
  }
}

/**
 * save-as：元ページを複製し、IDと上書きパッチを適用。Sharedは元の値を継承（patchで上書き可）。
 * 既存のsave-asフローから置き換え可能。UI側にチェックボックスが無い場合も、ここで論理値を尊重。
 */
function dp_saveAsPage(srcId, newId, patch){
  try{
    var get=dp_getPageRecord(srcId);
    if(!get || !get.ok) return { ok:false, error:"Source not found: "+srcId };

    var values=_pg_read2D_(); var hdr=values[0]; var sh=_pg_sh_();

    // 列名解決
    var idName=null, idCands=["Page ID","page_id","id"];
    for(var i=0;i<idCands.length&&!idName;i++){ if(_pg_hdrIdx_(hdr,idCands[i])>=0) idName=idCands[i]; }
    if(!idName) throw new Error("Pages: ID column not resolved");

    // newIdが既存ならエラー
    var exists=_pg_findById_(hdr, values, idName, newId);
    if(exists>=0) return { ok:false, error:"Already exists: "+newId };

    // 新規行作成：元行を継承
    var srcIdx=_pg_findById_(hdr, values, idName, srcId);
    if(srcIdx<0) return { ok:false, error:"Source not found: "+srcId };
    var base=values[srcIdx].slice();

    // ID差し替え
    var idCol=_pg_hdrIdx_(hdr, idName);
    base[idCol]=newId;

    // パッチ適用（Sharedは正規化）
    var COL_SHARED="Shared";
    if(patch && typeof patch==="object"){
      for(var k in patch){
        if(!patch.hasOwnProperty(k)) continue;
        var idx=_pg_hdrIdx_(hdr, k);
        if(idx<0) continue;
        base[idx]=(k===COL_SHARED)? _pg_normBool_(patch[k]) : patch[k];
      }
    }

    // 追記
    sh.appendRow(base);

    // 返却
    var rec={}; for(var c=0;c<hdr.length;c++){ rec[hdr[c]]=base[c]; }
    return { ok:true, id:newId, fields:rec };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), srcId:srcId, newId:newId };
  }
}
/* ===== 83. End ===== */


/* ===== 84.pages.header ===== */
/**
 * Pages sheet writer with synonym mapping:
 * - Writes Page Name / Page Type / Entity / Shared in addition to CONFIG.
 * - Accepts synonyms: page_name|name|title -> "Page Name"; page_type|type -> "Page Type";
 *   entity -> "Entity"; shared|is_shared -> "Shared" (bool normalized).
 * - Optional: if patch.__select === true, set CURRENT_PAGE_VIEW_ID script property to the page id.
 */
/* ===== 84. End ===== */


/* ===== 85.pages.utils ===== */
function PG_ss(){ return SpreadsheetApp.getActive(); }
function PG_sh(){
  var sh = PG_ss().getSheetByName("Pages");
  if(!sh) throw new Error("Sheet not found: Pages");
  return sh;
}
function PG_vals(){ 
  var v = PG_sh().getDataRange().getValues();
  if(!v || !v.length) throw new Error("Empty sheet: Pages");
  return v;
}
function PG_hdrIdx(hdr, name){
  var n = String(name).trim().toLowerCase();
  for (var i=0;i<hdr.length;i++){
    if (String(hdr[i]).trim().toLowerCase() === n) return i;
  }
  return -1;
}
function PG_findById(hdr, rows, idColName, idValue){
  var idCol = PG_hdrIdx(hdr, idColName);
  if (idCol < 0) throw new Error("Pages: ID column missing: "+idColName);
  for (var r=1;r<rows.length;r++){
    if (String(rows[r][idCol]) === String(idValue)) return r; // header=0
  }
  return -1;
}
function PG_bool(v){
  var s = String(v).trim().toLowerCase();
  return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="✓";
}
function PG_idColName(hdr){
  var cands = ["Page ID","page_id","id"];
  for (var i=0;i<cands.length;i++){
    if (PG_hdrIdx(hdr, cands[i]) >= 0) return cands[i];
  }
  throw new Error("Pages: ID column not resolved");
}
function PG_mapKeyToCol(hdr, key){
  // canonical names
  var CAN = {
    "page name":"Page Name",
    "page type":"Page Type",
    "entity":"Entity",
    "shared":"Shared",
    "config":"CONFIG" // if present
  };
  // synonyms
  var k = String(key).trim().toLowerCase();
  if (k==="page_name"||k==="name"||k==="title") k = "page name";
  else if (k==="page_type"||k==="type")          k = "page type";
  else if (k==="is_shared")                      k = "shared";
  // map to sheet header if exists
  var canon = CAN[k] || key;
  var idx = PG_hdrIdx(hdr, canon);
  if (idx >= 0) return { name: canon, idx: idx };
  // fallback: try original key
  idx = PG_hdrIdx(hdr, key);
  if (idx >= 0) return { name: key, idx: idx };
  return null; // unknown column -> ignore
}
function PG_setSelectedView_(pageId){
  PropertiesService.getScriptProperties().setProperty("CURRENT_PAGE_VIEW_ID", String(pageId));
}
/* ===== 85. End ===== */


/* ===== 86.dp_updatePageRecord ===== */
function dp_updatePageRecord(id, patch){
  try{
    if(!patch || typeof patch!=="object") throw new Error("patch must be an object");
    var all=_pg_readAll_(), sh=all.sh, hdrIds=all.hdrIds, hdrNames=all.hdrNames, rows=all.rows;
    var idCol=_pg_locateIdCol_(hdrIds, hdrNames);

    // 対象行探索
    var r=-1;
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][idCol])===String(id)){ r=i; break; }
    }
    if(r<0) return { ok:false, error:"Record not found", id:id };

    var row=rows[r].slice();
    var wrote=[];

    for(var k in patch){
      if(!patch.hasOwnProperty(k)) continue;
      if(k==="__select") continue; // 制御フラグは除外
      var colIdx=_pg_resolveCol_(hdrIds, hdrNames, k);
      if(colIdx<0) continue; // 不明列は無視
      var val=(String(hdrNames[colIdx]).trim().toLowerCase()==="shared")?_pg_normBool_(patch[k]):patch[k];
      row[colIdx]=val;
      wrote.push(hdrIds[colIdx] || hdrNames[colIdx] || k);
    }

    if(wrote.length){
      // ヘッダ2行を跨いだ実セル位置に書き戻す
      sh.getRange(2+1+r, 1, 1, hdrIds.length).setValues([row]); // 0:ids,1:names, 行は2+index
    }

    // 選択切替（即時）
    if(patch.__select===true){
      PropertiesService.getScriptProperties().setProperty("CURRENT_PAGE_VIEW_ID", String(id));
    }

    // 最新返却
    var latest={};
    for(var c=0;c<hdrIds.length;c++){ latest[hdrIds[c]||hdrNames[c]||("c"+c)] = row[c]; }
    return { ok:true, id:id, wrote:wrote, selected:(patch.__select===true), fields:latest };
  }catch(e){
    return { ok:false, error:String(e&&e.message||e), id:id };
  }
}
/* ===== 86. End ===== */

/* ===== 87.pages.read_api ===== */
function PG_vals(){ 
  var sh=SpreadsheetApp.getActive().getSheetByName("Pages");
  if(!sh) throw new Error("Sheet not found: Pages");
  var v=sh.getDataRange().getValues();
  if(!v||v.length<2) throw new Error("Pages header rows missing");
  return v;
}
function PG_hdrIdx(hdr, name){
  var n=String(name).trim().toLowerCase();
  for(var i=0;i<hdr.length;i++){ if(String(hdr[i]).trim().toLowerCase()===n) return i; }
  return -1;
}
function PG_idColName(hdr){
  var cands=["fi_0052","Page ID","page_id","id"];
  for (var i=0;i<cands.length;i++){ var idx=PG_hdrIdx(hdr,cands[i]); if(idx>=0) return hdr[idx]; }
  throw new Error("Pages: ID column not resolved");
}
function PG_bool(v){ var s=String(v).trim().toLowerCase(); return s==="true"||s==="1"||s==="yes"||s==="on"||s==="y"||s==="✓"; }

function gsListPagePresets(params){
  params=params||{};
  var wantEntity  = String(params.entity||'').toLowerCase();
  var wantType    = String(params.pageType||'').toLowerCase();
  var vals=PG_vals(), idsRow=vals[0], namesRow=vals[1], rows=vals.slice(2);
  var idName=PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var nmIdx = PG_hdrIdx(namesRow, "page name");
  var tpIdx = PG_hdrIdx(namesRow, "page type");
  var enIdx = PG_hdrIdx(namesRow, "entity");
  var shIdx = PG_hdrIdx(namesRow, "shared");

  var out=[];
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    var id = r[idIdx]; if(!id) continue;
    var ent=(enIdx>=0? String(r[enIdx]||'').toLowerCase(): '');
    var typ=(tpIdx>=0? String(r[tpIdx]||'').toLowerCase(): '');
    if(wantEntity && ent && ent!==wantEntity) continue;
    if(wantType   && typ && typ!==wantType)   continue;
    out.push({
      id: id,
      name: nmIdx>=0? r[nmIdx]:'',
      pageType: typ || '',
      entity: ent || '',
      shared: shIdx>=0? !!PG_bool(r[shIdx]): false
    });
  }
  return out;
}

function gsLoadPageConfig(params){
  var pid=params&&params.pageId; if(!pid) return {};
  var vals=PG_vals(), idsRow=vals[0], namesRow=vals[1], rows=vals.slice(2);
  var idName=PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var cfIdx = PG_hdrIdx(namesRow, "config");
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    if(String(r[idIdx])===String(pid)){
      var raw=(cfIdx>=0? r[cfIdx]:'');
      if(raw&&typeof raw==="string"){ try{ return JSON.parse(raw);}catch(e){ return {}; } }
      return {};
    }
  }
  return {};
}

function gsLoadPageConfigsBulk(ids){
  ids=Array.isArray(ids)? ids.map(String): [];
  var map={}, vals=PG_vals(), idsRow=vals[0], namesRow=vals[1], rows=vals.slice(2);
  var idName=PG_idColName(idsRow);
  var idIdx = PG_hdrIdx(idsRow, idName);
  var cfIdx = PG_hdrIdx(namesRow, "config");
  for(var i=0;i<rows.length;i++){
    var r=rows[i], pid=String(r[idIdx]||'');
    if(ids.indexOf(pid)<0) continue;
    var raw=(cfIdx>=0? r[cfIdx]:'');
    if(raw&&typeof raw==="string"){ try{ map[pid]=JSON.parse(raw);}catch(e){ map[pid]={}; } }
    else map[pid]={};
  }
  return map;
}
/* ===== 87. End ===== */


/* ===== 88.pages.write_api ===== */
function _pg_all_(){
  var sh=SpreadsheetApp.getActive().getSheetByName('Pages');
  if(!sh) throw new Error('Sheet not found: Pages');
  var v=sh.getDataRange().getValues();
  if(!v||v.length<2) throw new Error('Pages header rows missing');
  return { sh:sh, fi:v[0], names:v[1], rows:v.slice(2) };
}
function _pg_idxBy(a,key){ key=String(key).trim().toLowerCase(); for(var i=0;i<a.length;i++){ if(String(a[i]).trim().toLowerCase()===key) return i; } return -1; }
function _pg_bool(v){ var s=String(v).trim().toLowerCase(); return s==='true'||s==='1'||s==='yes'||s==='on'||s==='y'||s==='✓'; }

function _pg_findIdx(fi,names, fiKey, labelKey, altLabels){
  // FI優先→ラベル→同義語
  var idx = _pg_idxBy(fi, fiKey);
  if(idx>=0) return idx;
  idx = _pg_idxBy(names, labelKey);
  if(idx>=0) return idx;
  for(var i=0;i<(altLabels||[]).length;i++){
    idx = _pg_idxBy(names, altLabels[i]);
    if(idx>=0) return idx;
  }
  return -1;
}

function gsCreatePagePreset(params){
  params=params||{};
  var ent   = String(params.entity||'').trim();
  var name  = String(params.name||'').trim() || '(no name)';
  var shared= !!params.shared;
  var ptype = String(params.pageType||'table').trim() || 'table';
  var cfgIn = params.config; 
  var cfgStr=(typeof cfgIn==='string')? cfgIn : (cfgIn? JSON.stringify(cfgIn): '');

  // 単発ロック + 直前重複防止
  var lock=LockService.getScriptLock();
  try{ lock.tryLock(3000); }catch(e){}
  var sp=PropertiesService.getScriptProperties();
  var lastId=sp.getProperty('LAST_CREATED_PAGE_ID');
  var lastAt=Number(sp.getProperty('LAST_CREATED_PAGE_AT')||0);
  if(lastId && (Date.now()-lastAt)<4000){
    if(lock) try{ lock.releaseLock(); }catch(e){}
    return { ok:true, id:lastId, dedup:true };
  }

  var a=_pg_all_(), sh=a.sh, fi=a.fi, names=a.names, rows=a.rows;

  // 必須4列は「FIが無くてもラベルで可」、CONFIG/Shared は無くてもエラーにしない
  var cID=_pg_findIdx(fi,names,'fi_0052','page id',['id','page_id']);
  var cNM=_pg_findIdx(fi,names,'fi_0053','page name',['name','title']);
  var cTP=_pg_findIdx(fi,names,'fi_0054','page type',['type']);
  var cEN=_pg_findIdx(fi,names,'fi_0055','entity',['sheet','table']);
  var cCF=_pg_findIdx(fi,names,'fi_0056','config',['CONFIG','Config']);
  var cSH=_pg_findIdx(fi,names,'fi_0057','shared',['is_shared','shared?']);

  if(cID<0 || cNM<0 || cTP<0 || cEN<0){
    if(lock) try{ lock.releaseLock(); }catch(e){}
    return { ok:false, error:'Pages header missing (need Page ID / Page Name / Page Type / Entity)' };
  }

  // newId 採番（既存の pg_#### から最大+1）
  var maxN=0;
  for(var i=0;i<rows.length;i++){
    var m=String(rows[i][cID]||'').match(/^pg_(\d{1,})$/i);
    if(m){ var n=+m[1]; if(n>maxN) maxN=n; }
  }
  var newId='pg_'+('0000'+(maxN+1)).slice(-4);

  // 新規行ベース
  var outRow=new Array(fi.length).fill('');
  outRow[cID]=newId; outRow[cNM]=name; outRow[cTP]=ptype; outRow[cEN]=ent;
  if(cSH>=0) outRow[cSH]=shared?true:false;
  if(cCF>=0 && cfgStr) outRow[cCF]=cfgStr;

  // 監査（ラベル列優先で自動検出）
  var createdByIdx=_pg_idxBy(names,'created by'); if(createdByIdx<0) createdByIdx=_pg_idxBy(names,'createdby');
  var createdAtIdx=_pg_idxBy(names,'created');    if(createdAtIdx<0) createdAtIdx=_pg_idxBy(names,'created at');
  try{
    if(createdByIdx>=0){
      var by=Session.getActiveUser() && Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '';
      outRow[createdByIdx]=by||'system';
    }
    if(createdAtIdx>=0){ outRow[createdAtIdx]=new Date(); }
  }catch(e){}

  sh.appendRow(outRow);

  sp.setProperty('LAST_CREATED_PAGE_ID', newId);
  sp.setProperty('LAST_CREATED_PAGE_AT', String(Date.now()));
  sp.setProperty('CURRENT_PAGE_VIEW_ID', String(newId));
  if(lock) try{ lock.releaseLock(); }catch(e){}

  var ret={};
  for(var z=0; z<fi.length; z++){ ret[fi[z]||names[z]||('c'+z)] = outRow[z]; }
  return { ok:true, id:newId, name:name, pageType:ptype, entity:ent, shared:!!(cSH>=0 && outRow[cSH]), fields:ret };
}




/* ===== 89.labels.bulk_api (テーブル用の一括ラベル解決) ===== */
function dp_resolveLabelsBulk(ids){
  ids = Array.isArray(ids)? ids.filter(function(s){return !!s;}) : [];
  var out = {};
  for (var i=0;i<ids.length;i++){
    var id = String(ids[i]);
    var lbl = _resolveEntityLinkLabel_(id);
    if (lbl!=null) out[id]=lbl;
  }
  return out;
}
/* ===== 89. End ===== */

/* ===== 98.DebugPanel APIs (server) ===== */
/** ping */
function dp_debugPing(){
  return { ts: Date.now(), ok: true };
}

/** optional: page layout presets */
function dp_listPageLayoutPresets(req){
  // 実装未了でもエラーにしない安定返却
  return [];
}

/** project meta accessor */
function dp_getProjectMeta(){
  try{
    if (typeof _sv_getMeta_ === "function") {
      var meta = _sv_getMeta_({}) || {};
      return meta;
    }
  } catch(e){}
  return {};
}

/** originals trace */
function dp_traceOriginals(req){
  req = req || {};
  var ent = String(req.entity || "shot").toLowerCase();
  var id  = String(req.id || "").trim();
  var out = { input:{entity:ent,id:id}, steps:[], finalUrl:"", found:false };

  function step(name, ok, info){ out.steps.push({ name:name, ok:!!ok, info: info||{} }); }
  function _isHttpUrl_(s){ return typeof s === "string" && /^https?:\/\//i.test(s); }
  function _safeCall_(name, arg){
    try{ 
      var fn = Function('return ' + name + ';')();  // 動的参照 (GAS互換)
      if (typeof fn === "function") { 
        var val = fn(arg); 
        step(name, val != null, { fn: name, url: _isHttpUrl_(val) ? val : null }); 
        return {name:name, value:val}; 
      } else {
        step(name, false, { fn: name, exists: false });
        return {name:name, value:null};
      }
    }catch(e){
      step(name, false, { fn: name, error: e.message });
      return {name:name, value:null};
    }
  }
  function _safeChain_(names, arg){
    for (var i=0;i<names.length;i++){
      var r = _safeCall_(names[i], arg);
      if (r.value != null) return r;
    }
    return {name:null, value:null};
  }

  // A) DriveBuilder
  var dbNames = ["DB_getOriginalsUrl","DriveBuilder_getOriginalsUrl","DB_getOriginalsFolderUrl","DriveBuilder_getOriginalsFolderUrl"];
  var db   = _safeChain_(dbNames, [ent,id]);
  var dbUrl= "";
  if (db.value) {
    if (typeof db.value === "string" && _isHttpUrl_(db.value)) dbUrl = db.value;
    else if (db.value && typeof db.value === "object" && _isHttpUrl_(db.value.url)) dbUrl = db.value.url;
  }

  // B) generic server APIs
  var apiNames = ["sv_getOriginalsUrl","getOriginalsUrl","sv_getOriginalsFolderUrl","getOriginalsFolderUrl"];
  var api   = _safeChain_(apiNames, {entity:ent,id:id});
  var apiUrl= "";
  if (api.value) {
    if (typeof api.value === "string" && _isHttpUrl_(api.value)) apiUrl = api.value;
    else if (api.value && typeof api.value === "object" && _isHttpUrl_(api.value.url)) apiUrl = api.value.url;
  }

  // C) project meta root
  var root = "";
  try{
    var meta = dp_getProjectMeta() || {};
    root = meta.originals_root_url || meta.proxies_root_url || "";
  }catch(_){}
  step("ProjectMetaRoot", !!root, { root: root || null });

  // D) final
  out.finalUrl = apiUrl || dbUrl || root || "";
  out.found    = !!out.finalUrl;
  return out;
}
/* ===== 98. End ===== */

/* ===== 99. Setup & Helpers ===== */

/** Read-only data loader: Simulate app data load without GSS changes */
function loadAppData() {
  var props = PropertiesService.getScriptProperties();
  var loadedKey = 'data_loaded';
  if (props.getProperty(loadedKey)) {
    console.log('Data already simulated. Skipping.');
    return;
  }
  
  // GSS読取のみ（書き込みなし）でメタ確認
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var metaSh = ss.getSheetByName('project_meta');
    if (metaSh) {
      var metaData = metaSh.getRange(1, 1, 2, metaSh.getLastColumn()).getValues();
      var meta = {};
      metaData[0].forEach(function(k, i) { meta[String(k).toLowerCase()] = metaData[1][i]; });
      console.log('GSS meta read: originals_root_url=' + (meta.originals_root_url || 'unset'));
    }
  } catch (e) {
    console.error('GSS read error: ' + e.message);
  }
  
  props.setProperty(loadedKey, 'true');
  console.log('Read-only load complete: No GSS changes. Use dp_loadAppData for debug verification.');
}

/** Load FIELD_TYPES from Fields sheet (entity-specific, read-only) */
function getFieldTypes(entity) {  // entityフィルタ追加で効率化
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName('Fields');
    if (!sh || sh.getLastRow() < 2) return {};
    
    var data = sh.getDataRange().getValues();
    var types = {};
    var targetEntity = (entity || '').toLowerCase().trim();
    for (var r = 1; r < data.length; r++) {
      var fid = String(data[r][0] || '').trim();
      var ent = String(data[r][1] || '').toLowerCase().trim();
      if (fid && (!targetEntity || ent === targetEntity)) {
        if (!types[ent]) types[ent] = {};
        types[ent][fid] = { 
          label: String(data[r][2] || '').trim(), 
          type: String(data[r][3] || 'text').trim(),
          editable: !!(data[r][4] || false), 
          required: !!(data[r][5] || false) 
        };
      }
    }
    return types;
  } catch (e) {
    console.error('getFieldTypes error: ' + e.message);
    return {};
  }
}

/** Debug: Load app data (LINK_MAPS + FieldTypes) for panel verification - アプリ読み込みフローテスト（read-only） */
function dp_loadAppData() {
  try {
    // アプリ関数シミュレート（sv_getLinkMaps/getFieldTypes呼出、GSS読取のみ）
    var linkMaps = typeof sv_getLinkMaps === 'function' ? sv_getLinkMaps() : { assets:{}, shots:{}, tasks:{}, users:{}, members:{} };
    var fieldTypes = getFieldTypes();
    var meta = typeof _sv_getMeta_ === 'function' ? _sv_getMeta_({}) : {};
    
    // カウント/キー抽出
    var counts = { assets: Object.keys(linkMaps.assets || {}).length, shots: Object.keys(linkMaps.shots || {}).length, tasks: Object.keys(linkMaps.tasks || {}).length, users: Object.keys(linkMaps.users || {}).length, members: Object.keys(linkMaps.members || {}).length };
    var fieldKeys = Object.keys(fieldTypes).reduce((acc, ent) => acc + Object.keys(fieldTypes[ent] || {}).length, 0);
    
    return {
      linkMaps: linkMaps,
      fieldTypes: fieldTypes,
      meta: meta,
      counts: counts,
      fieldKeysTotal: fieldKeys,
      ts: Date.now(),
      message: 'App data loaded successfully (read-only, no GSS changes).'
    };
  } catch (e) {
    console.error('dp_loadAppData error: ' + e.message);
    return { error: e.message, ts: Date.now() };
  }
}

/* ===== 99. End ===== */
