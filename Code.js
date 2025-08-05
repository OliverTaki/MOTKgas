/**
 * HTML テンプレートをインクルードして中身を返す
 */
function include(filename) {
  const t = HtmlService.createTemplateFromFile(filename);
  Object.keys(TEMPLATE_CONTEXT).forEach(key => { t[key] = TEMPLATE_CONTEXT[key]; });
  return t.evaluate().getContent();
}

let TEMPLATE_CONTEXT = {};

const SHEET = {
  SHOTS: 'Shots', ASSETS: 'Assets', TASKS: 'Tasks',
  MEMBERS: 'ProjectMembers', USERS: 'Users', PAGES: 'Pages',
  FIELDS: 'Fields', PROJECTMETA: 'project_meta'
};

const ENTITY_CONF = {
  shot:   { sheet: SHEET.SHOTS,   key: 'fi_0001', ui: 'DetailShot' },
  asset:  { sheet: SHEET.ASSETS,  key: 'fi_0015', ui: 'DetailAsset' },
  task:   { sheet: SHEET.TASKS,   key: 'fi_0025', ui: 'DetailTask' },
  user:   { sheet: SHEET.USERS,   key: 'fi_0044', ui: 'DetailUser' },
  member: { sheet: SHEET.MEMBERS, key: 'fi_0034', ui: 'DetailMember' },
  page:   { sheet: SHEET.PAGES,   key: 'fi_0052', ui: 'DetailMember' }
};

/* ────────── データ取得コア ────────── */
function listRows(entityName) {
  const hub = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DataHub');
  if (!hub) return [];
  const headers = hub.getRange(1, 1, 1, hub.getLastColumn()).getValues()[0];
  const colIndex = headers.indexOf(entityName);
  if (colIndex === -1) return [];
  const colData = hub.getRange(4, colIndex + 1, hub.getLastRow() - 3, 1).getValues();
  return colData
    .map(row => (row[0] ? String(row[0]).split('|') : []))
    .filter(arr => arr.length > 0 && arr[0] !== '');
}

function getEntity(ent, id) {
  const c = ENTITY_CONF[ent];
  if (!c) return null;
  const hub = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DataHub');
  if (!hub) return null;
  const headers = hub.getRange(1, 1, 1, hub.getLastColumn()).getValues()[0];
  const entColIdx = headers.indexOf(c.sheet);
  if (entColIdx === -1) return null;
  const fieldIds = String(hub.getRange(2, entColIdx + 1).getValue()).split('|');
  const dataRows = hub.getRange(4, entColIdx + 1, hub.getLastRow() - 3, 1).getValues();
  const targetRowStr = dataRows.find(row => row[0] && String(row[0].split('|')[0]).trim() === String(id).trim());
  if (!targetRowStr || !targetRowStr[0]) return null;
  const vals = String(targetRowStr[0]).split('|');
  const obj = {};
  fieldIds.forEach((fieldId, idx) => {
    obj[fieldId.trim()] = vals[idx] ? vals[idx].trim() : '';
  });
  return obj;
}

/* ────────── ページレイアウト保存 ────────── */
function savePageLayout(ent, name, json) { /* ... 既存ロジックのまま ... */ }
function getPageLayout(ent, name) { /* ... 既存ロジックのまま ... */ }

/* ────────── ルーティング (doGetを修正) ────────── */
function doGet(e) {
  const p = e?.parameter || {};
  const ent = (p.entity || '').toLowerCase();
  const id = p.id || '';
  const pg = p.page || 'Shots';
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // 正しいURL取得方法に戻す
  const base = ScriptApp.getService().getUrl();
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

  TEMPLATE_CONTEXT = { entity: ent, id: id, page: pg, scriptUrl: base };

  let template, title;
  
  if (ENTITY_CONF[ent] && id) {
    template = HtmlService.createTemplateFromFile(ENTITY_CONF[ent].ui);
    title = `${ent}:${id}`;
    TEMPLATE_CONTEXT.layout = getPageLayout(ent, '_default') || '[]';
    TEMPLATE_CONTEXT.data = JSON.stringify(getEntity(ent, id));
  } else {
    template = HtmlService.createTemplateFromFile('index');
    title = 'MOTK Sheets';

    const hub = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DataHub');
    if (hub) {
      const hubHeaders = hub.getRange(1, 1, 1, hub.getLastColumn()).getValues()[0];
      const pageColIdx = hubHeaders.indexOf(pg);
      const fieldsColIdx = hubHeaders.indexOf('Fields');

      const pageToEntityMap = Object.fromEntries(
        Object.entries(ENTITY_CONF).map(([key, val]) => [val.sheet, key])
      );
      const entityForFields = pageToEntityMap[pg];

      if (pageColIdx > -1) {
        const headerIds = hub.getRange(2, pageColIdx + 1).getValue().split('|').map(h => h.trim());
        const headerNames = hub.getRange(3, pageColIdx + 1).getValue().split('|').map(h => h.trim());
        TEMPLATE_CONTEXT.headerIdsJson = JSON.stringify(headerIds);
        TEMPLATE_CONTEXT.headerNamesJson = JSON.stringify(headerNames);

        const coreData = {};
        if (fieldsColIdx > -1 && entityForFields) {
          const fieldsData = hub.getRange(2, fieldsColIdx + 1, hub.getLastRow() - 1, 1).getValues();
          fieldsData.forEach(row => {
            if (!row[0]) return;
            const fieldDef = row[0].split('|');
            const isCore = String(fieldDef[7]).trim().toLowerCase() === 'true';
            const fieldEntity = String(fieldDef[1]).trim();
            
            if (isCore && fieldEntity === entityForFields) {
              const fieldId = fieldDef[0].trim();
              const coreValues = fieldDef.slice(8).join('|');
              coreData[fieldId] = coreValues;
            }
          });
        }
        TEMPLATE_CONTEXT.coreDataJson = JSON.stringify(coreData);
      } else {
        TEMPLATE_CONTEXT.headerIdsJson = "[]";
        TEMPLATE_CONTEXT.headerNamesJson = "[]";
        TEMPLATE_CONTEXT.coreDataJson = "{}";
      }
    }
  }

  Object.keys(TEMPLATE_CONTEXT).forEach(key => {
    template[key] = TEMPLATE_CONTEXT[key];
  });
  
  const output = template.evaluate();
  output.setTitle(title);
  return output;
}

/* ================ 既存ロジック ================ */
function onOpen(e){}
function onEdit(e){}
function onChange(e){}
function runAlphabetFillFromMenu(){}
function applyField(){}
function syncHeaders(){}
function genId(){}
function recalcCodes(){}
function nextA(){}