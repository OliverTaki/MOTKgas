/* =========================================================================
     MOTK G-Viewer  (Apps Script only)           2025-07-29   v0.2
     * Table UI (index.html / viewer.html) は既存のまま残す
     * Detail ルーティングと API だけ追加
     * scriptUrl / data をテンプレートへ渡す
   ========================================================================= */

/* ---------- エンティティ定義 -------------------------------------------- */
const ENTITY_CONF = {
  shot  : { sheet: 'Shots',          key: 'fi_0001',   ui: 'DetailShot'  },
  asset : { sheet: 'Assets',         key: 'fi_0015',  ui: 'DetailAsset' },
  task  : { sheet: 'Tasks',          key: 'fi_0025',   ui: 'DetailTask'  },
  member: { sheet: 'ProjectMembers', key: 'fi_0034', ui: 'DetailMember'},
  user  : { sheet: 'Users',          key: 'fi_0044',   ui: 'DetailUser'  },
};

/* ---------- ルーター ---------------------------------------------------- */
function doGet(e) {
  const p       = e ? e.parameter : {};
  const entity  = (p.entity || '').toLowerCase();
  const id      = p.id   || '';
  const page    = p.page || 'Shots';          // 既存 Table のデフォルト
  const selfURL = ScriptApp.getService().getUrl();

  /* --- Detail --------------------------------------------------------- */
  if (ENTITY_CONF[entity] && id) {
    const tpl = HtmlService.createTemplateFromFile(ENTITY_CONF[entity].ui);
    tpl.entity    = entity;
    tpl.id        = id;
    tpl.scriptUrl = selfURL;
    return _wrap(tpl.evaluate(), `${entity}:${id}`);
  }

  /* --- Table (既存 UI) ------------------------------------------------- */
  const listTpl = HtmlService.createTemplateFromFile('index');
  listTpl.page       = page;
  listTpl.scriptUrl  = selfURL;

  /* rows を JSON 文字列化して渡す */
  const ROW_LIMIT      = 300;
  const rowsAll        = listRows(page);
  const rows          = rowsAll.slice(0, ROW_LIMIT); // ★ ここだけ
  listTpl.dataJson     = JSON.stringify(rows);    // ★ ここだけ

  return _wrap(listTpl.evaluate(), 'MOTK Sheets');
}

/* ---------- 共通ヘルパー ---------------------------------------------- */
function _wrap(out, title) {
  return out
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// テンプレートとして評価してから HTML を返す
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ---------- API -------------------------------------------------------- */
function getEntity(entity, id) {
  const conf = ENTITY_CONF[entity];
  if (!conf) return null;

  const sh     = SpreadsheetApp.getActive().getSheetByName(conf.sheet);
  const data   = sh.getDataRange().getValues();   // 1行目:ID, 2行目:ラベル
  const header = data.shift();
  const idx    = header.indexOf(conf.key);
  if (idx === -1) return null;

  const row = data.find(r => String(r[idx]) === String(id));
  if (!row) return null;

  const obj = {};
  header.forEach((h, i) => (obj[h] = row[i]));
  return obj;
}

/* 既存 Table UI 用：シート全行を 2D 配列で返す */
function listRows(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  return sh ? sh.getDataRange().getValues() : [];
}
