// ================ MOTK G-Viewer Apps Script core ================
/* detail-layout backend 2025-08-02 */

// ★★★ 修正点1: テンプレート間で変数を共有するためのグローバルオブジェクト ★★★
let TEMPLATE_CONTEXT = {};

const SHEET = {
  SHOTS:       'Shots',
  ASSETS:      'Assets',
  TASKS:       'Tasks',
  MEMBERS:     'ProjectMembers',
  USERS:       'Users',
  PAGES:       'Pages',
  FIELDS:      'Fields',
  PROJECTMETA: 'PROJECTMETA'
};

const ENTITY_CONF = {
  shot:   { sheet: SHEET.SHOTS,   key: 'fi_0001', ui: 'DetailShot'  },
  asset:  { sheet: SHEET.ASSETS,  key: 'fi_0015', ui: 'DetailAsset' },
  task:   { sheet: SHEET.TASKS,   key: 'fi_0025', ui: 'DetailTask'  },
  member: { sheet: SHEET.MEMBERS, key: 'fi_0034', ui: 'DetailMember'},
  user:   { sheet: SHEET.USERS,   key: 'fi_0044', ui: 'DetailUser'  }
};

/* ---------- helpers ---------- */
const SS = SpreadsheetApp.getActive;
function _open(n){return SS().getSheetByName(n);}
function _body(s){return s.getRange(3,1,s.getLastRow()-2,s.getLastColumn()).getValues();}
function _ids (s){return s.getRange(1,1,1,s.getLastColumn()).getValues()[0];}

/* ---------- router ---------- */
function doGet(e){
  const p = e?.parameter||{};
  const ent=(p.entity||'').toLowerCase(), id=p.id||'', pg=p.page||'Shots';
  const base = ScriptApp.getService().getUrl();

  // ★★★ 修正点2: 全ての変数をTEMPLATE_CONTEXTに格納する ★★★
  TEMPLATE_CONTEXT = { entity: ent, id: id, page: pg, scriptUrl: base };

  let template;
  let title;
  
  if(ENTITY_CONF[ent] && id){
    template = HtmlService.createTemplateFromFile(ENTITY_CONF[ent].ui);
    title = `${ent}:${id}`;
    // 詳細ページ用のレイアウト情報をコンテキストに追加
    TEMPLATE_CONTEXT.layout = getPageLayout(ent, '_default') || '[]';
  } else {
    template = HtmlService.createTemplateFromFile('index');
    title = 'MOTK Sheets';
    // 一覧ページ用のデータもコンテキストに追加
    TEMPLATE_CONTEXT.dataJson = JSON.stringify(listRows(pg).slice(0,300));
  }
  
  // テンプレートにコンテキストの全変数を一括で割り当てる
  Object.assign(template, TEMPLATE_CONTEXT);

  const output = template.evaluate();
  TEMPLATE_CONTEXT = {}; // 処理後にコンテキストをクリア
  return _wrap(output, title);
}

function _wrap(o,t){
  return o.setTitle(t)
         .addMetaTag('viewport','width=device-width,initial-scale=1')
         .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ★★★ 修正点3: include関数をテンプレート評価に対応させる ★★★
function include(filename){
  const template = HtmlService.createTemplateFromFile(filename);
  // グローバルコンテキストから変数を引き継ぐ
  Object.assign(template, TEMPLATE_CONTEXT);
  // 評価した結果のHTMLコンテンツを返す
  return template.evaluate().getContent();
}

/* ---------- data API ---------- */
function getEntity(ent,id){
  const c=ENTITY_CONF[ent]; if(!c) return null;
  const sh=_open(c.sheet), idx=_ids(sh).indexOf(c.key); if(idx<0) return null;
  const row=_body(sh).find(r=>String(r[idx])===String(id)); if(!row) return null;
  const obj={}; _ids(sh).forEach((f,i)=>obj[f]=row[i]); return obj;
}
function listRows(n){const s=_open(n); return s?s.getDataRange().getValues():[];}

/* ---------- layout storage ---------- */
function savePageLayout(ent,name,json){
  if(!name) name='_default';
  const sh=_open(SHEET.PAGES), vals=sh.getDataRange().getValues();
  const i=vals.findIndex(r=>r[3]===ent&&r[1]===name), now=new Date();
  if(i===-1){
    sh.appendRow([Utilities.getUuid(),name,'detail',ent,json,false,
                  Session.getEffectiveUser().getEmail(),now,now]);
  }else{
    sh.getRange(i+1,5).setValue(json);
    sh.getRange(i+1,9).setValue(now);
  }
}
function getPageLayout(ent,name){
  if(!name) name='_default';
  const r=_open(SHEET.PAGES).getDataRange().getValues()
           .find(v=>v[3]===ent&&v[1]===name);
  return r?r[4]:null;
}

/* ---------- hierarchy (変更なし) ---------- */
function getHierarchyFields(){
  const sh=_open('project_meta'); if(!sh) return [];
  const hdr=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const flg=sh.getRange(2,1,1,sh.getLastColumn()).getValues()[0];
  const ids=sh.getRange(3,1,1,sh.getLastColumn()).getValues()[0];
  const map=Object.fromEntries(
    _open('Fields').getRange(2,1,1,_open('Fields').getLastColumn()).getValues()[0]
      .map((v,i)=>[_open('Fields').getRange(1,i+1).getValue(),v])
  );
  const act=[];
  hdr.forEach((h,i)=>{
    if(['Episode','Act','Sequence','Scene','Shot'].includes(h)&&flg[i])
      act.push({level:h,fieldId:ids[i],fieldName:map[ids[i]]||h});
  });
  if(!act.find(a=>a.level==='Shot'))
    act.push({level:'Shot',fieldId:'fi_0002',fieldName:map['fi_0002']||'SHOTCODE'});
  return act;
}