/**
 * HTML テンプレートをインクルードして中身を返す
 */
function include(filename) {
  const t = HtmlService.createTemplateFromFile(filename);
  Object.keys(TEMPLATE_CONTEXT).forEach(key => {
    t[key] = TEMPLATE_CONTEXT[key];
  });
  return t.evaluate().getContent();
}

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
  asset:  { sheet: SHEET.ASSETS,  key: 'fi_0015', ui: 'DetailAsset' },
  task:   { sheet: SHEET.TASKS,   key: 'fi_0025', ui: 'DetailTask' },
  user:   { sheet: SHEET.USERS,   key: 'fi_0044', ui: 'DetailUser' },
  member: { sheet: SHEET.MEMBERS, key: 'fi_0034', ui: 'DetailMember' },
  page:   { sheet: SHEET.PAGES,   key: 'fi_0052', ui: 'DetailMember' }
};

/* ────────── 内部ユーティリティ ────────── */
function _open(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

/* ────────── データ取得コア (★listRowsを修正) ────────── */
/**
 * 全レコード一覧を取得する関数
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
        // ★修正：DataHubからのみヘッダーとデータを取得し、正しく構成する
        const dataHubColumn = all.map(r => r[col]);
        
        // DataHubの2行目からfield_idを取得
        const fieldIds = String(dataHubColumn[1] || '').split('|');
        // DataHubの3行目からfield_nameを取得
        const fieldNames = String(dataHubColumn[2] || '').split('|');
        // DataHubの4行目以降からレコードデータを取得
        const dataRows = dataHubColumn.slice(3)
                                      .map(r => r ? r.split('|') : [])
                                      .filter(r => r.length > 0 && r[0] !== '');
        
        // clientが期待する [ [field_id], [field_name], [data...], [data...] ] の形式で返す
        return [fieldIds, fieldNames, ...dataRows];
      }
    }
  }
  // フォールバック：従来のシート直読み
  const s = _open(sheetName);
  return s ? s.getDataRange().getValues() : [];
}

/**
 * 単一レコード取得の元の関数
 */
function getEntity(ent, id) {
    const c = ENTITY_CONF[ent];
    if (!c) return null;
    const sh = _open(c.sheet);
    if(!sh) return null;

    const allData = sh.getDataRange().getValues();
    const headers = allData[0];
    const keyIndex = headers.indexOf(c.key);
    if(keyIndex === -1) return null;

    const rowData = allData.find(r => String(r[keyIndex]) === String(id));
    if(!rowData) return null;

    const obj = {};
    headers.forEach((h, i) => {
        obj[h] = rowData[i];
    });
    return obj;
}

/* ────────── ページレイアウト保存 ────────── */
function savePageLayout(ent, name, json) { /* ... 既存ロジックのまま ... */ }
function getPageLayout(ent, name) { /* ... 既存ロジックのまま ... */ }

/* ────────── ルーティング ────────── */
function doGet(e) {
  const p    = e?.parameter || {};
  const ent  = (p.entity || '').toLowerCase();
  const id   = p.id || '';
  const pg   = p.page || 'Shots';
  const base = ScriptApp.getService().getUrl();

  TEMPLATE_CONTEXT = { entity: ent, id: id, page: pg, scriptUrl: base };

  let template, title;
  if (ENTITY_CONF[ent] && id) {
    template = HtmlService.createTemplateFromFile(ENTITY_CONF[ent].ui);
    title    = `${ent}:${id}`;
    TEMPLATE_CONTEXT.layout = getPageLayout(ent, '_default') || '[]';
    TEMPLATE_CONTEXT.data = JSON.stringify(getEntity(ent, id));
  } else {
    template = HtmlService.createTemplateFromFile('index');
    title    = 'MOTK Sheets';
    
    // listRowsがヘッダーを含む正しい形式のデータを返す
    const rows = listRows(pg).slice(0, 302); // ヘッダー2行 + データ300行
    TEMPLATE_CONTEXT.dataJson   = JSON.stringify(rows);
    
    // headerJsonは念のため残しておくが、dataJsonから生成されるものが優先される
    TEMPLATE_CONTEXT.headerJson = JSON.stringify(rows.length > 1 ? rows[1] : []);
  }

  Object.assign(template, TEMPLATE_CONTEXT);
  const output = template.evaluate();
  output.setTitle(title);
  return output;
}