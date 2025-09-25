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
function isEntityToken(s){ return /\b(?:as|sh|ta|us|mb)[-_][0-9A-Za-z\-]+\b/.test(String(s||"")); }

function baseUrl(){
  return (global.scriptUrl || global.SCRIPT_URL || (location.origin + location.pathname));
}
function currentPage(){
  var p=new URLSearchParams(location.search);
  return p.get("page") || "DetailShot";
}
function buildEntityUrl(ent,id){
  var qs=new URLSearchParams(location.search);
  qs.set("page", currentPage());
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
