/**
 * ファイル名からプロジェクト名を取得し、'project_meta'シートへ project_id を同期する
 */
function syncProjectNameToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = ss.getSheetByName('project_meta');

  if (!metaSheet) {
    return; // シートがなければ何もしない
  }

  const fullFileName = ss.getName();
  // ファイル名の [] に囲まれた部分を抜き出す正規表現
  const match = fullFileName.match(/\[([^\]]+)\]/);

  let projectName;
  if (match && match[1]) {
    // match[1] に [] の中の文字列だけが格納される
    projectName = match[1];
  } else {
    // 見つからなければファイル名をそのまま使う
    projectName = fullFileName;
  }

  const a1 = String(metaSheet.getRange(1, 1).getValue() || '').toLowerCase().trim();
  const b1 = String(metaSheet.getRange(1, 2).getValue() || '').toLowerCase().trim();

  if (a1 === 'meta_key' && b1 === 'meta_value') {
    const lastRow = Math.max(metaSheet.getLastRow(), 1);
    let foundRow = -1;
    if (lastRow >= 2) {
      const rows = metaSheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (let i = 0; i < rows.length; i++) {
        const key = String(rows[i][0] || '').trim();
        if (key === 'project_id') {
          foundRow = i + 2;
          break;
        }
      }
    }
    if (foundRow > 0) {
      metaSheet.getRange(foundRow, 2).setValue(projectName);
    } else {
      metaSheet.appendRow(['project_id', projectName, 'text', '', '']);
    }
    return;
  }

  // Fallback: old 2-row layout (A2)
  metaSheet.getRange('A2').setValue(projectName);
}
