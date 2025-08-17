/** PagesConfig.gs
 * PAGESタブ（2段ヘッダ：1行目=ID, 2行目=表示名, 3行目〜=データ）で
 * 列設定(JSON: {order,widths,hidden})の 保存/読込 と プリセット一覧取得・メタ取得 を提供。
 *
 * カラム定義（確定）:
 *  fi_0052: Page ID (pg_0001 / pg_default ...)
 *  fi_0053: Page Name
 *  fi_0054: Page Type
 *  fi_0055: Entity
 *  fi_0056: Config (JSON)
 *  fi_0057: Shared
 *  fi_0058: Created By
 *  fi_0059: Created (ISO)
 *  fi_0060: Modified (ISO)
 */

const PAGES_SHEET_NAME = 'PAGES';
const HEADER_ROW_IDS = 1;    // 1行目: フィールドID(fi_0052..fi_0060)
const HEADER_ROW_LABELS = 2; // 2行目: 表示名
const DATA_START_ROW = 3;    // 3行目〜: データ

const PAGE_IDS   = ['fi_0052','fi_0053','fi_0054','fi_0055','fi_0056','fi_0057','fi_0058','fi_0059','fi_0060'];
const PAGE_LABEL = ['Page ID','Page Name','Page Type','Entity','Config','Shared','Created By','Created','Modified'];

/** 一覧 */
function sv_listPages() {
  try {
    const sh = ensurePagesSheet_();
    ensurePageColumns_(sh);
    const idx = getHeaderIndexMap_(sh);
    const ci = {
      id: idx.byId['fi_0052'],
      name: idx.byId['fi_0053'],
      type: idx.byId['fi_0054'],
      ent: idx.byId['fi_0055'],
      shared: idx.byId['fi_0057'],
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

/** 読込 */
function sv_loadPageConfig(params) {
  try {
    const pageId = (params && params.pageId) || '';
    if (!pageId) return {};
    const sh = ensurePagesSheet_();
    ensurePageColumns_(sh);
    const idx = getHeaderIndexMap_(sh);
    const cId   = idx.byId['fi_0052'];
    const cConf = idx.byId['fi_0056'];

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
    const cId   = idx.byId['fi_0052'];
    const cName = idx.byId['fi_0053'];
    const cType = idx.byId['fi_0054'];
    const cEnt  = idx.byId['fi_0055'];
    const cSh   = idx.byId['fi_0057'];
    const cCB   = idx.byId['fi_0058'];
    const cCr   = idx.byId['fi_0059'];
    const cMd   = idx.byId['fi_0060'];

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
    const cId   = idx.byId['fi_0052'];
    const cName = idx.byId['fi_0053'];
    const cType = idx.byId['fi_0054'];
    const cEnt  = idx.byId['fi_0055'];
    const cConf = idx.byId['fi_0056'];
    const cSh   = idx.byId['fi_0057'];
    const cCB   = idx.byId['fi_0058'];
    const cCr   = idx.byId['fi_0059'];
    const cMd   = idx.byId['fi_0060'];

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

    row[cCB]  = params.createdBy != null ? params.createdBy
              : (Session.getActiveUser && Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '');
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
  if (!sh) {
    sh = ss.insertSheet(PAGES_SHEET_NAME);
    sh.getRange(HEADER_ROW_IDS,    1, 1, PAGE_IDS.length).setValues([PAGE_IDS]);
    sh.getRange(HEADER_ROW_LABELS, 1, 1, PAGE_LABEL.length).setValues([PAGE_LABEL]);
    return sh;
  }
  if (sh.getLastRow() < HEADER_ROW_LABELS) {
    sh.getRange(HEADER_ROW_IDS,    1, 1, PAGE_IDS.length).setValues([PAGE_IDS]);
    sh.getRange(HEADER_ROW_LABELS, 1, 1, PAGE_LABEL.length).setValues([PAGE_LABEL]);
  }
  return sh;
}

/** 必須ID列がなければ末尾に追加（既存順は不変） */
function ensurePageColumns_(sh){
  const lastCol = Math.max(1, sh.getLastColumn());
  const ids = sh.getRange(HEADER_ROW_IDS, 1, 1, lastCol).getValues()[0].map(String);
  const missing = PAGE_IDS.filter(id => ids.indexOf(id) === -1);
  if (!missing.length) return;
  const startCol = lastCol + 1;
  const labels = missing.map(id => PAGE_LABEL[PAGE_IDS.indexOf(id)] || id);
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
  const cId = idx.byId['fi_0052'];
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
