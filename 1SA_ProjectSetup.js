/**
 * ファイル名からプロジェクト名を取得し、'project_meta'シートのA2セルに書き込む
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

  // A2セルに書き込む
  metaSheet.getRange('A2').setValue(projectName);
}