/**
 * HTML テンプレートをインクルードして中身を返す
 * TEMPLATE_CONTEXT に入っている変数 (entity, page, id, scriptUrl など) を
 * 各テンプレートのスコープにセットします。
 */
function include(filename) {
  const t = HtmlService
              .createTemplateFromFile(filename);
  // TEMPLATE_CONTEXT のキーをすべてテンプレート変数としてセット
  Object.keys(TEMPLATE_CONTEXT).forEach(key => {
    t[key] = TEMPLATE_CONTEXT[key];
  });
  return t
          .evaluate()
          .getContent();
}


// ★★★ テンプレート間で変数を共有するためのグローバルオブジェクト ★★★
let TEMPLATE_CONTEXT = {};

const SHEET = {
  SHOTS:       'Shots',
  ASSETS:      'Assets',
  TASKS:       'Tasks',
  MEMBERS:     'ProjectMembers',
  USERS:       'Users',
  PAGES:       'Pages',
  FIELDS:      'Fields',
  PROJECTMETA: 'project_meta'
};

const ENTITY_CONF = {
  shot:   { sheet: SHEET.SHOTS,   key: 'fi_0001', ui: 'DetailShot' },
  asset:  { sheet: SHEET.ASSETS,  key: 'fi_0001', ui: 'DetailAsset' },
  task:   { sheet: SHEET.TASKS,   key: 'fi_0001', ui: 'DetailTask' },
  user:   { sheet: SHEET.USERS,   key: 'fi_0001', ui: 'DetailUser' },
  pg:     { sheet: SHEET.PAGES,   key: 'fi_0001', ui: 'DetailMember' }
};

/* ────────── 内部ユーティリティ ────────── */
function _open(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}
function _ids(s) {
  return s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
}
function _body(s) {
  return s.getRange(3, 1, s.getLastRow() - 2, s.getLastColumn()).getValues();
}

/* ────────── データ取得コア ────────── */

/**
 * 全レコード一覧を取得
 * DataHub シートがあればそちらを使い、
 * 無ければ従来のシート直読みを行う
 */
function listRows(sheetName) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hub = ss.getSheetByName('DataHub');
  if (hub) {
    const all    = hub.getDataRange().getValues();
    if (all.length > 0) {
      const headerRow = all[0];
      const col = headerRow.indexOf(sheetName);
      if (col >= 0) {
        return all.slice(1)
          .map(r => r[col] ? r[col].split('|') : [])
          .filter(r => r.length > 0);
      }
    }
  }
  // フォールバック：従来のシート直読み
  const s = _open(sheetName);
  return s ? s.getDataRange().getValues() : [];
}

/**
 * 単一レコード取得
 * DataHub にあればそちらから、無ければ従来ロジック
 */
function getEntity(ent, id) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hub = ss.getSheetByName('DataHub');
  if (hub) {
    const all    = hub.getDataRange().getValues();
    if (all.length > 0) {
      const headerRow = all[0];
      const col = headerRow.indexOf(ent);
      if (col >= 0) {
        for (let i = 1; i < all.length; i++) {
          const cell = all[i][col];
          if (cell) {
            const vals = cell.split('|');
            if (String(vals[0]) === String(id)) {
              const sh = _open(ent);
              const ids = _ids(sh);
              const obj = {};
              ids.forEach((h, idx) => {
                obj[h] = vals[idx] || '';
              });
              return obj;
            }
          }
        }
      }
    }
  }
  // フォールバック：既存ロジック
  const c = ENTITY_CONF[ent];
  if (!c) return null;
  const sh = _open(c.sheet);
  const idx = _ids(sh).indexOf(c.key);
  if (idx < 0) return null;
  const row = _body(sh).find(r => String(r[idx]) === String(id));
  if (!row) return null;
  const obj = {};
  _ids(sh).forEach((h, i) => {
    obj[h] = row[i];
  });
  return obj;
}


/* ────────── ページレイアウト保存 ────────── */
function savePageLayout(ent, name, json) {
  if (!name) name = '_default';
  const sh   = _open(SHEET.PAGES);
  const vals = sh.getDataRange().getValues();
  const i    = vals.findIndex(r => r[3] === ent && r[1] === name);
  const now  = new Date();
  if (i === -1) {
    sh.appendRow([
      Utilities.getUuid(),
      name,
      'detail',
      ent,
      json,
      false,
      Session.getEffectiveUser().getEmail(),
      now,
      now
    ]);
  } else {
    sh.getRange(i + 1, 5).setValue(json);
    sh.getRange(i + 1, 6).setValue(false);
    sh.getRange(i + 1, 8).setValue(now);
  }
}
function getPageLayout(ent, name) {
  if (!name) name = '_default';
  const sh   = _open(SHEET.PAGES);
  const vals = sh.getDataRange().getValues();
  const row  = vals.find(r => r[3] === ent && r[1] === name);
  return row ? row[4] : null;
}

/* ────────── ルーティング ────────── */
function doGet(e) {
  const p    = e?.parameter || {};
  const ent  = (p.entity || '').toLowerCase();
  const id   = p.id || '';
  const pg   = p.page || 'Shots';
  const scriptId = ScriptApp.getScriptId();
  const base = `https://script.google.com/macros/s/${scriptId}/exec`;

  TEMPLATE_CONTEXT = { entity: ent, id: id, page: pg, scriptUrl: base };

  let template, title;
  if (ENTITY_CONF[ent] && id) {
    template = HtmlService.createTemplateFromFile(ENTITY_CONF[ent].ui);
    title    = `${ent}:${id}`;
    TEMPLATE_CONTEXT.layout = getPageLayout(ent, '_default') || '[]';
  } else {
    template = HtmlService.createTemplateFromFile('index');
    title    = 'MOTK Sheets';
    // 初期ロード用データ（CoreFields=TRUE のみ含む）
    const rows = listRows(pg).slice(0, 300);
    TEMPLATE_CONTEXT.dataJson   = JSON.stringify(rows);
    // 本物のヘッダー行（シート本体の1行目）を渡す
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(pg);
    const headers = sh ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    TEMPLATE_CONTEXT.headerJson = JSON.stringify(headers);
  }

  Object.assign(template, TEMPLATE_CONTEXT);
  const output = template.evaluate();
  output.setTitle(title);
  return output;
}

/* ================ ここから既存ロジック（ID発行、再計算、トリガーなど）を変更せず保持 ================ */
function onOpen(e)            { /* 既存 onOpen のまま */ }
function onEdit(e)            { /* 既存 onEdit のまま */ }
function onChange(e)          { /* 既存 onChange のまま */ }
function runAlphabetFillFromMenu() { /* 既存 runAlphabetFill のまま */ }
function applyField()         { /* 既存 applyField のまま */ }
function syncHeaders()        { /* 既存 syncHeaders のまま */ }
function genId()              { /* 既存 genId のまま */ }
function recalcCodes()        { /* 既存 recalcCodes のまま */ }
function nextA()              { /* 既存 nextA のまま */ }
// …その他ユーティリティもすべてそのまま保持…

/* ================ 新規追加：CoreFields = FALSE の非コアフィールドを取得 ================ */
/**
 * DataHub の Fields 列から CoreFields=FALSE の定義だけを返す
 * → クライアント側の遅延ロード用
 */
function getNonCoreFields() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hub = ss.getSheetByName('DataHub');
  if (!hub) {
    return [];
  }
  const all    = hub.getDataRange().getValues();
  const header = all[0];
  const fCol   = header.indexOf('Fields');
  const cCol   = header.indexOf('CoreFields');
  if (fCol < 0 || cCol < 0) {
    return [];
  }
  return all
    .slice(1)
    .filter(row => String(row[cCol]).toLowerCase() === 'false')
    .map(row => {
      const cell = row[fCol];
      return cell ? cell.split('|') : [];
    });
}
