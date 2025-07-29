/* === MOTK Detail-Pages — Apps Script back-end  ============================= */
/*  シート構成（タブ名と主キー列）
      Shots            | A: shot_id          |
      Assets           | A: asset_id         |
      Tasks            | A: task_id          |
      ProjectMembers   | A: member_id        |
      Users            | A: user_id          |
   ※主キー列はシート 1 行目にラベルがある前提
*/

/* ---------- ルーティング -------------------------------------------------- */
function doGet(e) {
  const entity  = (e.parameter.entity || '').toLowerCase();
  const id      = e.parameter.id || '';
  const uiFiles = {
    'shot'  : 'ShotDetail',
    'asset' : 'AssetDetail',
    'task'  : 'TaskDetail',
    'member': 'MemberDetail',
    'user'  : 'UserDetail',
  };

  if (!uiFiles[entity] || !id) {
    return HtmlService.createHtmlOutput('Invalid URL');
  }

  const tmpl = HtmlService.createTemplateFromFile(uiFiles[entity]);
  tmpl.entity = entity;
  tmpl.id     = id;
  return tmpl
    .evaluate()
    .setTitle(`${entity.toUpperCase()} ${id}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- 共通 API ------------------------------------------------------ */
/**
 * 呼び出し例: google.script.run.getEntity('shot', 'SH0001')
 * @param {string} entity  shots|assets|tasks|member|user
 * @param {string} id     主キー値
 * @return {Object|null}  行をオブジェクト化（ヘッダー→値）して返却
 */
function getEntity(entity, id) {
  const config = {
    'shot'  : {sheet: 'Shots',          key: 'shot_id'},
    'asset' : {sheet: 'Assets',         key: 'asset_id'},
    'task'  : {sheet: 'Tasks',          key: 'task_id'},
    'member': {sheet: 'ProjectMembers', key: 'member_id'},
    'user'  : {sheet: 'Users',          key: 'user_id'},
  };
  const {sheet, key} = config[entity] || {};
  if (!sheet) return null;

  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName(sheet);
  const data = sh.getDataRange().getValues();        // 2D array
  const header = data.shift();                       // 1 行目 = 見出し
  const idx = header.indexOf(key);
  if (idx === -1) return null;

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][idx]) === id) {
      const obj = {};
      header.forEach((h, c) => (obj[h] = data[i][c]));
      return obj;
    }
  }
  return null; // not found
}

/* ---------- include() で HTML から呼ぶサブページ ------------------------- */
function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}
