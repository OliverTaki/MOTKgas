/* =========================================================================
     MOTK G-Viewer  (Apps Script only)
     - Dark-mode styling handled in Theme.html
     - Table UI (index.html / viewer.html) は既存のまま
     - Detail ルーティングと API を追加
     2025-07-29
   ========================================================================= */

/* ---------- エンティティ定義 -------------------------------------------- */
const ENTITY_CONF = {
  shot  : { sheet: 'Shots',          key: 'shot_id',   ui: 'ShotDetail'  },
  asset : { sheet: 'Assets',         key: 'asset_id',  ui: 'AssetDetail' },
  task  : { sheet: 'Tasks',          key: 'task_id',   ui: 'TaskDetail'  },
  member: { sheet: 'ProjectMembers', key: 'member_id', ui: 'MemberDetail'},
  user  : { sheet: 'Users',          key: 'user_id',   ui: 'UserDetail'  },
};

/* ---------- ルーター ---------------------------------------------------- */
function doGet(e) {
  const p       = e ? e.parameter : {};
  const entity  = (p.entity || '').toLowerCase();
  const id      = p.id   || '';
  const page    = p.page || 'Shots';
  const selfURL = ScriptApp.getService().getUrl();      // Web App 自身の URL

  /* --- Detail --------------------------------------------------------- */
  if (ENTITY_CONF[entity] && id) {
    const tpl = HtmlService.createTemplateFromFile(ENTITY_CONF[entity].ui);
    tpl.entity    = entity;
    tpl.id        = id;
    tpl.scriptUrl = selfURL;                           // 既存 JS 用
    return _wrap(tpl.evaluate(), `${entity}:${id}`);
  }

  /* --- Table (従来 UI) ------------------------------------------------- */
  const listTpl = HtmlService.createTemplateFromFile('index'); // 変更不要
  listTpl.page      = page;
  listTpl.scriptUrl = selfURL;

  const rows         = listRows(page);               // 2D Array
  listTpl.data       = JSON.stringify(rows);         // ← ここが index.html の <?!= data ?>

  return _wrap(listTpl.evaluate(), 'MOTK Sheets');
}

/* ---------- 共通ヘルパー ---------------------------------------------- */
function _wrap(out, title) {
  return out
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ---------- API -------------------------------------------------------- */
/**
 * シートから 1 行取得し、{header: value} オブジェクトで返す
 * @param {string} entity  shot|asset|task|member|user
 * @param {string} id      主キー値
 */
function getEntity(entity, id) {
  const conf = ENTITY_CONF[entity];
  if (!conf) return null;

  const sh = SpreadsheetApp.getActive().getSheetByName(conf.sheet);
  if (!sh) return null;

  /* ▼▼▼ ここが消えていると “data is not defined” ▼▼▼ */
  const data   = sh.getDataRange().getValues();   // ← 必須
  const header = data.shift();                    // ← 必須
  /* ▲▲▲ 必ず入れてください ▲▲▲ */

  const idx = header.indexOf(conf.key);
  if (idx === -1) return null;

  const row = data.find(r => String(r[idx]) === String(id));
  if (!row) return null;

  const obj = {};
  header.forEach((h, i) => (obj[h] = row[i]));
  return obj;
}


/**
 * 既存テーブル UI 用: シート全行を 2D 配列で返す
 * @param {string} sheetName
 * @return {Array<Array>}
 */
function listRows(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  return sh ? sh.getDataRange().getValues() : [];
}
