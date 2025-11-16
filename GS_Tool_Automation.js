/**
 * ==================================
 * 定数とグローバル設定
 * ==================================
 */
const P = {
  shots: "sh",
  assets: "as",
  tasks: "tk",
  projectmembers: "pm",
  users: "us",
  pages: "pg",
  fields: "fi",
};
const META = "Fields";
const SHOT_FIELD_NAME = "shot"; // 連番機能の対象となるフィールド名

/**
 * ==================================
 * メインとなるトリガー関数
 * ==================================
 */

/**
 * スプレッドシートを開いた時にカスタムメニューを追加します。
 */
function AutomationMenu() {
  SpreadsheetApp.getUi()
    .createMenu("自動化ツール")
    .addItem("アルファベット連番を生成", "runAlphabetFillFromMenu")
    .addToUi();
}

/**
 * ユーザーによる編集を検知して、適切な処理を呼び出します。
 * (ABCフィルに関する自動トリガーは完全に削除しました)
 */
function onEdit(e) {
  const sh = e.range.getSheet();
  const k = sh.getName().toLowerCase();

  // Fieldsシートの編集
  if (k === META.toLowerCase()) {
    handleFieldsSheetEdit(e);
    return;
  }
  if (!P[k]) return;

  // ヘッダ行（2行目）の編集
  if (e.range.getRow() === 2) {
    handleHeaderEdit(e);
    return;
  }
  // データ行（3行目以降）の編集
  if (e.range.getRow() > 2) {
    handleDataEdit(e); // ID付与
    if (k === "shots") {
      recalcCodes(sh); // ShotCodeは編集時に常に再計算
    }
  }
}

function onChange(e) {
  if (e.changeType === "INSERT_COLUMN" || e.changeType === "REMOVE_COLUMN") {
    syncHeaders();
  }
  const sh = e.source.getActiveSheet();
  if (sh.getName().toLowerCase() === "shots") {
    Utilities.sleep(200);
    recalcCodes(sh);
  }
}

/**
 * ==================================
 * カスタムメニューから呼び出される機能
 * ==================================
 */

/**
 * メニューから呼び出されるアルファベット連番生成機能
 */
function runAlphabetFillFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sh.getActiveRange();

  if (!range) {
    ui.alert(
      "エラー",
      "連番を生成したい範囲を選択してから実行してください。",
      ui.ButtonSet.OK,
    );
    return;
  }
  if (sh.getName().toLowerCase() !== "shots") {
    ui.alert(
      "エラー",
      "この機能は「Shots」シートでのみ使用できます。",
      ui.ButtonSet.OK,
    );
    return;
  }

  const shotColumn = getColumnIndexByFieldName(sh, SHOT_FIELD_NAME);
  if (shotColumn === -1 || range.getColumn() !== shotColumn) {
    ui.alert(
      "エラー",
      `この機能は「${SHOT_FIELD_NAME}」列でのみ使用できます。\n（現在の対象列は ${sh.getRange(2, shotColumn).getValue()} 列です）`,
      ui.ButtonSet.OK,
    );
    return;
  }

  if (range.getRow() < 4) {
    ui.alert(
      "エラー",
      "4行目以降のセルを選択して実行してください。",
      ui.ButtonSet.OK,
    );
    return;
  }

  const val1 = sh.getRange(range.getRow() - 2, shotColumn).getValue();
  const val2 = sh.getRange(range.getRow() - 1, shotColumn).getValue();

  if (!val1 || !val2 || val2 !== autoNextA(val1)) {
    ui.alert(
      "エラー",
      "選択範囲の上2つのセルが「A」「B」のような連番になっていません。",
      ui.ButtonSet.OK,
    );
    return;
  }

  let cur = val2;
  const newValues = [];
  for (let i = 0; i < range.getNumRows(); i++) {
    cur = autoNextA(cur);
    newValues.push([cur]);
  }
  range.setValues(newValues);
  SpreadsheetApp.getActive().toast("連番を生成しました。");
}

/**
 * ==================================
 * 機能ごとの詳細な処理関数 (変更なし)
 * ==================================
 */
function handleFieldsSheetEdit(e) {
  const r = e.range.getRow();
  if (r < 2) return;
  const fieldsSheet = F();
  const row = fieldsSheet.getRange(r, 1, 1, 3).getValues()[0];
  if (row[1] && row[2] && !row[0]) {
    const id = newFid();
    fieldsSheet.getRange(r, 1).setValue(id);
    applyField(id, row[2], row[1]);
  } else if (row[0] && row[1] && row[2]) {
    applyField(row[0], row[2], row[1]);
  }
}
function handleHeaderEdit(e) {
  const sh = e.range.getSheet();
  const name = e.range.getValue();
  if (!name) return;
  const k = sh.getName().toLowerCase();
  const fidCell = sh.getRange(1, e.range.getColumn());
  let fid = fidCell.getValue();
  const fieldsSheet = F();
  if (!fid) {
    fid = newFid();
    fidCell.setValue(fid);
    fieldsSheet.appendRow([fid, k, name]);
  } else {
    const lastRow = fieldsSheet.getLastRow();
    if (lastRow > 1) {
      const fids = fieldsSheet
        .getRange(2, 1, lastRow - 1, 1)
        .getValues()
        .flat();
      const rowIndex = fids.indexOf(fid);
      if (rowIndex !== -1) {
        fieldsSheet.getRange(rowIndex + 2, 3).setValue(name);
      }
    }
  }
}
function handleDataEdit(e) {
  const sh = e.range.getSheet();
  const k = sh.getName().toLowerCase();
  const rows = e.range.getNumRows();
  const start = e.range.getRow();
  for (let i = 0; i < rows; i++) {
    const r = start + i;
    const idCell = sh.getRange(r, 1);
    if (!idCell.getValue()) {
      const rowData = sh
        .getRange(r, 2, 1, sh.getLastColumn() - 1)
        .getValues()[0];
      if (rowData.some((v) => v !== "")) {
        idCell.setValue(genId(sh, k));
      }
    }
  }
}

/**
 * ==================================
 * ヘルパー関数群（コアロジック）(変更なし)
 * ==================================
 */

// --- 汎用 & ID発行関連 ---
const pad = (n, l) => ("000000" + n).slice(-l);
const free = (a) => {
  a.sort((x, y) => x - y);
  let i = 1;
  for (const v of a) {
    if (v === i) i++;
    else if (v > i) break;
  }
  return i;
};
function genId(sh, k) {
  const lastRow = sh.getLastRow();
  if (lastRow < 3) return `${P[k]}_${pad(1, 4)}`;
  const range = sh.getRange(3, 1, lastRow - 2, 1);
  if (range.isBlank()) return `${P[k]}_${pad(1, 4)}`;
  const nums = range
    .getValues()
    .flat()
    .filter(String)
    .map((x) => +x.split("_")[1]);
  const n = free(nums);
  return `${P[k]}_${pad(n, Math.max(4, String(n).length))}`;
}

// ---【安定版】Fields連携関連 ---
const F = () => SpreadsheetApp.getActive().getSheetByName(META);
function getMetaRows() {
  const fSheet = F();
  const lastRow = fSheet.getLastRow();
  if (lastRow < 2) return [];
  return fSheet
    .getRange(2, 1, lastRow - 1, 3)
    .getValues()
    .filter((r) => r[0] && r[1] && r[2]);
}
const newFid = () =>
  `${P.fields}_${pad(free(getMetaRows().map((r) => +String(r[0]).split("_")[1] || 0)), 4)}`;
function entSheet(ent) {
  const s1 = ent.charAt(0).toUpperCase() + ent.slice(1);
  const s2 = s1.endsWith("s") ? s1 : s1 + "s";
  return (
    SpreadsheetApp.getActive().getSheetByName(s1) ||
    SpreadsheetApp.getActive().getSheetByName(s2)
  );
}
function applyField(fid, name, ent) {
  const sh = entSheet(ent);
  if (!sh) return;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let col = headers.indexOf(fid) + 1;
  if (col === 0) {
    col = sh.getLastColumn() + 1;
    sh.insertColumns(col);
  }
  sh.getRange(1, col).setValue(fid);
  sh.getRange(2, col).setValue(name);
}
function syncHeaders() {
  getMetaRows().forEach(([f, e, n]) => applyField(f, n, e));
}

// ---【維持】Shot Code関連 (Field ID基準) ---
const mkCode = (v) => {
  const n = [v[4], v[3], v[2], v[1]]
    .map((x) => String(x || "").replace(/\D/g, ""))
    .filter(Boolean);
  if (!n.length) return "";
  return String(+n.shift()) + n.map((x) => pad(x, 2)).join("") + (v[0] || "");
};
function recalcCodes(sh) {
  const lastRow = sh.getLastRow();
  const dataRowCount = lastRow - 2;
  if (dataRowCount <= 0) return;
  const nameToFid = {};
  getMetaRows().forEach(([fid, entity, name]) => {
    nameToFid[name.toLowerCase().trim()] = fid;
  });
  const componentFids = {
    Shot: nameToFid["shot"],
    Scene: nameToFid["scene"],
    Sequence: nameToFid["sequence"],
    Act: nameToFid["act"],
    Episode: nameToFid["episode"],
    ShotCode: nameToFid["shotcode"],
  };
  if (!componentFids.ShotCode) return;
  const fidHeader = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const colIndex = {
    Shot: fidHeader.indexOf(componentFids.Shot),
    Scene: fidHeader.indexOf(componentFids.Scene),
    Sequence: fidHeader.indexOf(componentFids.Sequence),
    Act: fidHeader.indexOf(componentFids.Act),
    Episode: fidHeader.indexOf(componentFids.Episode),
    ShotCode: fidHeader.indexOf(componentFids.ShotCode),
  };
  if (colIndex.ShotCode === -1) return;
  const allData = sh
    .getRange(3, 1, dataRowCount, sh.getLastColumn())
    .getValues();
  const newCodes = allData.map((rowData) => {
    const v = [
      colIndex.Shot !== -1 ? rowData[colIndex.Shot] : "",
      colIndex.Scene !== -1 ? rowData[colIndex.Scene] : "",
      colIndex.Sequence !== -1 ? rowData[colIndex.Sequence] : "",
      colIndex.Act !== -1 ? rowData[colIndex.Act] : "",
      colIndex.Episode !== -1 ? rowData[colIndex.Episode] : "",
    ];
    return [mkCode(v)];
  });
  sh.getRange(3, colIndex.ShotCode + 1, dataRowCount, 1).setValues(newCodes);
}

// --- アルファベットフィル関連 ---
const autoNextA = (p) =>
  !p
    ? "A"
    : p === "Z"
      ? "Za"
      : /Zz+$/.test(p)
        ? p + "a"
        : p.length === 1
          ? String.fromCharCode(p.charCodeAt(0) + 1)
          : p.slice(0, -1) + String.fromCharCode(p.slice(-1).charCodeAt(0) + 1);
function getColumnIndexByFieldName(sheet, fieldName) {
  const nameToFid = {};
  getMetaRows().forEach(([fid, entity, name]) => {
    nameToFid[name.toLowerCase().trim()] = fid;
  });
  const targetFid = nameToFid[fieldName.toLowerCase().trim()];
  if (!targetFid) return -1;
  const fidHeader = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  return fidHeader.indexOf(targetFid) + 1;
}
