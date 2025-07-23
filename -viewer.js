/* ---------- state ---------- */
var colIDs=[], header=[], originalRows=[], viewRows=[];
var fieldMeta={}, fieldTypeMap={};   // id -> type
var idMaps={};                       // {shot:{},asset:{},…}
var sortConfig=[], filterConfig={groups:[]};
var isResizing=false;
var DRIVE_PREFIX="https://drive.google.com/";

/* ---------- boot ---------- */
(function(){
  Promise.all([
    google.script.run.withSuccessHandler(function(d){originalRows=d.slice(2); header=d[1]; colIDs=d[0];}).getTable(),
    google.script.run.withSuccessHandler(function(m){idMaps=m;}).getIdMaps(),
    google.script.run.withSuccessHandler(function(f){fieldMeta=f; f.forEach(function(o){fieldTypeMap[o.id]=o.type;});}).getFieldMeta()
  ]).then(function(){
    viewRows=originalRows.slice();
    drawTable();
    bindToolbar();
  });
})();

/* ---------- UI ---------- */
function bindToolbar(){
  document.getElementById("btnSort").onclick=openSortDlg;
  document.getElementById("btnFilter").onclick=openFilterDlg;
  document.getElementById("btnReset").onclick=function(){viewRows=originalRows.slice(); drawTable();};
}

/* …（既存ドラッグ・リサイズ・lazyPreview・drawTable ロジックは
      前回までのコードをここへ移植してください。省略）… */

/* ---------- Sort Dialog (単層雛形) ---------- */
function openSortDlg(){
  var dlg=ensureDlg();
  dlg.querySelector("#dlgTitle").textContent="Sort rows";
  dlg.querySelector("#groupsWrap").innerHTML=buildSortRow();
  dlg.showModal();

  dlg.querySelector("#dlgOk").onclick=function(){
    var sel=dlg.querySelector("select"); var dir=dlg.querySelector("button.dir").dataset.dir;
    sortConfig=[{col:sel.value,dir:dir}];
    applyView(); dlg.close();
  };
}
function buildSortRow(){
  var html='<div class="sortRow">'
          +'<select>'+header.map(function(h){return'<option>'+h+'</option>';}).join("")+'</select>'
          +'<button type="button" class="dir" data-dir="asc">▲</button>'
          +'</div>';
  return html;
}

/* ---------- Filter Dialog (単フィールド雛形) ---------- */
function openFilterDlg(){
  var dlg=ensureDlg(); dlg.querySelector("#dlgTitle").textContent="Filter rows";
  dlg.querySelector("#groupsWrap").innerHTML=buildFilterRow();
  dlg.showModal();

  dlg.querySelector("#dlgOk").onclick=function(){
    var field=dlg.querySelector("select.field").value;
    var op   =dlg.querySelector("select.op").value;
    var val  =dlg.querySelector(".val").value.trim();
    filterConfig={groups:[{operator:"all",clauses:[{col:field,op:op,val:val}]}]};
    applyView(); dlg.close();
  };
}
function buildFilterRow(){
  var ops='<option>is</option><option>is not</option><option>contains</option><option>not contains</option>';
  var html='<div class="fltRow">'
          +'<select class="field">'+header.map(function(h){return"<option>"+h+"</option>";}).join("")+'</select>'
          +'<select class="op">'+ops+'</select>'
          +'<input class="val" placeholder="value">'
          +'</div>';
  return html;
}

/* ---------- dialog helper ---------- */
function ensureDlg(){
  var tpl=document.getElementById("dlgTpl");
  if(!tpl.nextElementSibling){ document.body.appendChild(tpl.content.cloneNode(true)); }
  return document.getElementById("dlgSF");
}

/* ---------- apply filter & sort ---------- */
function applyView(){
  /* filter (very simple for demo) */
  viewRows = originalRows.filter(function(r){
    if(!filterConfig.groups.length){ return true; }
    var c  = filterConfig.groups[0].clauses[0];
    var idx= header.indexOf(c.col);
    if(idx<0) return true;
    var cell= String(r[idx]).trim();
    if(c.op==="is")          return cell===c.val;
    if(c.op==="is not")      return cell!==c.val;
    if(c.op==="contains")    return cell.indexOf(c.val)>-1;
    if(c.op==="not contains")return cell.indexOf(c.val)===-1;
    return true;
  });

  /* sort (single key demo) */
  if(sortConfig.length){
    var sc = sortConfig[0], idx=header.indexOf(sc.col), dir=(sc.dir==="desc"?-1:1);
    viewRows.sort(function(a,b){ return (a[idx]>b[idx]?1:-1)*dir; });
  }

  drawTable();
}

