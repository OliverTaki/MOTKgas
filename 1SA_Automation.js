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
  if (P[k]) {
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
  try {
    _normalizeDateRangeOnEdit_(e);
  } catch (err) {
    try { Logger.log("[MOTK][onEdit][DateNormalize] %s", String(err && err.message ? err.message : err)); } catch (_) { }
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
  const row = getMetaRowByIndex_(r);
  if (!row) return;
  if (row.entity && row.name && !row.fid) {
    const id = newFid();
    fieldsSheet.getRange(r, 1).setValue(id);
    row.fid = id;
    applyField(id, row.name, row.entity, row.type, row.options);
  } else if (row.fid && row.entity && row.name) {
    applyField(row.fid, row.name, row.entity, row.type, row.options);
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

function _fieldsNormHeader_(name) {
  return String(name || "").trim().toLowerCase().replace(/[\s_\-]+/g, "");
}

function _isFieldIdToken_(v) {
  return /^fi_\d{4,}$/i.test(String(v || "").trim());
}

function _pickFieldsIndex_(header, aliases) {
  const keys = aliases.map(_fieldsNormHeader_);
  for (let i = 0; i < header.length; i++) {
    if (keys.indexOf(_fieldsNormHeader_(header[i])) !== -1) return i;
  }
  return -1;
}

function _getFieldsHeaderMap_() {
  const fSheet = F();
  if (!fSheet) return null;
  const lastCol = fSheet.getLastColumn();
  if (lastCol < 1) return null;
  const header = fSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return {
    lastCol,
    fid: _pickFieldsIndex_(header, ["field_id", "fieldid", "fid", "id"]),
    entity: _pickFieldsIndex_(header, ["entity", "entity_name", "sheet", "sheet_name"]),
    name: _pickFieldsIndex_(header, ["field_name", "fieldname", "name", "label", "display_name"]),
    type: _pickFieldsIndex_(header, ["type", "field_type", "fieldtype"]),
    options: _pickFieldsIndex_(header, ["options", "option", "values"]),
  };
}

function getMetaRowsWithType_() {
  const fSheet = F();
  const map = _getFieldsHeaderMap_();
  if (!fSheet || !map || map.fid < 0 || map.entity < 0 || map.name < 0) return [];
  const lastRow = fSheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = fSheet.getRange(2, 1, lastRow - 1, map.lastCol).getValues();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const src = rows[i];
    const fid = String(src[map.fid] || "").trim();
    const entity = String(src[map.entity] || "").trim();
    const name = String(src[map.name] || "").trim();
    if (!fid || !entity || !name) continue;
    out.push({
      row: i + 2,
      fid,
      entity,
      name,
      type: map.type >= 0 ? String(src[map.type] || "").trim().toLowerCase() : "",
      options: map.options >= 0 ? src[map.options] : "",
    });
  }
  return out;
}

function _buildTypeByFidMap_() {
  const out = {};
  const rows = getMetaRowsWithType_();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const fid = String(row.fid || "").trim();
    if (!fid) continue;
    out[fid] = String(row.type || "").trim().toLowerCase();
  }
  return out;
}

function _buildLocalDateFromYmd_(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!isFinite(yy) || !isFinite(mm) || !isFinite(dd)) return null;
  const dt = new Date(yy, mm - 1, dd);
  if (isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== yy || dt.getMonth() !== (mm - 1) || dt.getDate() !== dd) return null;
  return dt;
}

function _parseDateTextForOnEdit_(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (m) return _buildLocalDateFromYmd_(m[1], m[2], m[3]);
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T].*)?$/);
  if (m) return _buildLocalDateFromYmd_(m[1], m[2], m[3]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return _buildLocalDateFromYmd_(m[1], m[2], m[3]);
  return null;
}

function _sameLocalYmd_(a, b) {
  return !!(a instanceof Date) && !!(b instanceof Date) &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function _normalizeDateRangeOnEdit_(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (!sh) return;
  const sheetName = String(sh.getName() || "").toLowerCase();
  if (sheetName === META.toLowerCase()) return;

  const r0 = e.range.getRow();
  const c0 = e.range.getColumn();
  const nr = e.range.getNumRows();
  const nc = e.range.getNumColumns();
  const r1 = r0 + nr - 1;
  if (r1 < 3) return;

  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  const headerFids = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];

  const touched = [];
  for (let c = c0; c <= c0 + nc - 1; c++) {
    if (c < 1 || c > headerFids.length) continue;
    const fid = String(headerFids[c - 1] || "").trim();
    if (_isFieldIdToken_(fid)) touched.push({ col: c, fid: fid });
  }
  if (!touched.length) return;

  const typeByFid = _buildTypeByFidMap_();
  const dateCols = touched
    .filter((x) => String(typeByFid[x.fid] || "").toLowerCase() === "date")
    .map((x) => x.col);
  if (!dateCols.length) return;

  const dataStart = Math.max(3, r0);
  const dataRows = r1 - dataStart + 1;
  if (dataRows <= 0) return;

  dateCols.forEach((col) => {
    const rg = sh.getRange(dataStart, col, dataRows, 1);
    const vals = rg.getValues();
    let changed = false;
    for (let i = 0; i < vals.length; i++) {
      const raw = vals[i][0];
      if (raw === null || raw === undefined || raw === "") continue;
      let dt = null;
      if (raw instanceof Date) {
        if (!isNaN(raw.getTime())) dt = _buildLocalDateFromYmd_(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
      } else if (typeof raw === "string") {
        dt = _parseDateTextForOnEdit_(raw);
      } else if (typeof raw === "number" && isFinite(raw)) {
        const serialDate = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(raw) * 86400000));
        if (!isNaN(serialDate.getTime())) dt = _buildLocalDateFromYmd_(serialDate.getUTCFullYear(), serialDate.getUTCMonth() + 1, serialDate.getUTCDate());
      }
      if (!dt) continue;
      if (_sameLocalYmd_(raw, dt)) continue;
      vals[i][0] = dt;
      changed = true;
    }
    if (changed) {
      rg.setValues(vals);
      rg.setNumberFormat("yyyy/mm/dd");
    }
  });
}

function getMetaRowByIndex_(rowIndex) {
  const rows = getMetaRowsWithType_();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].row === rowIndex) return rows[i];
  }
  const fSheet = F();
  const map = _getFieldsHeaderMap_();
  if (!fSheet || !map || rowIndex < 2) return null;
  const src = fSheet.getRange(rowIndex, 1, 1, map.lastCol).getValues()[0];
  return {
    row: rowIndex,
    fid: map.fid >= 0 ? String(src[map.fid] || "").trim() : "",
    entity: map.entity >= 0 ? String(src[map.entity] || "").trim() : "",
    name: map.name >= 0 ? String(src[map.name] || "").trim() : "",
    type: map.type >= 0 ? String(src[map.type] || "").trim().toLowerCase() : "",
    options: map.options >= 0 ? src[map.options] : "",
  };
}

const newFid = () =>
  `${P.fields}_${pad(free(getMetaRows().map((r) => +String(r[0]).split("_")[1] || 0)), 4)}`;
function entSheet(ent) {
  const key = String(ent || "").trim().toLowerCase().replace(/[^\w]+/g, "_");
  if (key === "member" || key === "members" || key === "projectmember" || key === "projectmembers" || key === "project_members" || key === "memder" || key === "memders") {
    return SpreadsheetApp.getActive().getSheetByName("ProjectMembers");
  }
  const s1 = ent.charAt(0).toUpperCase() + ent.slice(1);
  const s2 = s1.endsWith("s") ? s1 : s1 + "s";
  return (
    SpreadsheetApp.getActive().getSheetByName(s1) ||
    SpreadsheetApp.getActive().getSheetByName(s2)
  );
}
function applyField(fid, name, ent, fieldType, optionsRaw) {
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
  try {
    if (typeof applyFieldColumnFormat_ === "function") {
      applyFieldColumnFormat_(ent, fid, fieldType, optionsRaw);
    }
  } catch (err) {
    try { Logger.log("[MOTK][FieldFormat] apply failed fid=%s entity=%s err=%s", fid, ent, String(err && err.message ? err.message : err)); } catch (_) { }
  }
}
function syncHeaders() {
  getMetaRowsWithType_().forEach((row) => applyField(row.fid, row.name, row.entity, row.type, row.options));
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

/* ===== TAKE81: Manual backfill jobs (Originals URLs / Proxy index) ===== */
function job_backfillOriginalsUrls_v1(entity, maxUpdates) {
  var ent = String(entity || "shot").toLowerCase();
  var sheetName = (typeof resolveEntitySheetName_ === "function")
    ? resolveEntitySheetName_(ent)
    : ({ shot: "Shots", asset: "Assets", task: "Tasks", member: "ProjectMembers", user: "Users" }[ent] || ent);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { ok: false, reason: "missing-sheet", sheetName: sheetName };

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 3 || lastCol < 1) return { ok: true, reason: "empty-sheet", updated: 0, scanned: 0 };

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var idFid = schemaGetIdFid(ent);
  var idCol = schemaGetColIndexByFid(header, idFid);
  if (idCol < 0) {
    for (var i = 0; i < header.length; i++) {
      var h = String(header[i] || "").toLowerCase();
      if (h === "id" || /\\bid\\b/.test(h)) { idCol = i; break; }
    }
  }
  if (idCol < 0) return { ok: false, reason: "missing-id-col", sheetName: sheetName };

  var origCols = [];
  var origFid = schemaGetFidByFieldName(ent, "Originals URL");
  var origIdx = schemaGetColIndexByFid(header, origFid);
  if (origIdx >= 0) origCols.push(origIdx);
  if (!origCols.length) {
    for (var j = 0; j < header.length; j++) {
      var label = String(header[j] || "").toLowerCase();
      if (label.indexOf("originals") >= 0) origCols.push(j);
    }
  }
  if (!origCols.length) return { ok: false, reason: "missing-originals-col", sheetName: sheetName };

  var rowCount = lastRow - 2;
  var ids = sh.getRange(3, idCol + 1, rowCount, 1).getValues();
  var targetCol = origCols[0];
  var originals = sh.getRange(3, targetCol + 1, rowCount, 1).getValues();

  var limit = (typeof maxUpdates === "number" && maxUpdates > 0) ? Math.floor(maxUpdates) : 0;
  var updated = 0;
  var scanned = 0;
  var notFound = 0;

  for (var r = 0; r < rowCount; r++) {
    var rid = String(ids[r][0] || "").trim();
    if (!rid) continue;
    var cur = String(originals[r][0] || "").trim();
    if (cur) continue;
    scanned++;
    if (limit && updated >= limit) break;
    try {
      var folderId = lookupOriginalsFolderId(ent, rid);
      if (folderId) {
        originals[r][0] = "https://drive.google.com/drive/folders/" + folderId;
        updated++;
      } else {
        notFound++;
      }
    } catch (_) {
      notFound++;
    }
  }

  if (updated > 0) {
    sh.getRange(3, targetCol + 1, rowCount, 1).setValues(originals);
  }

  var summary = {
    ok: true,
    sheetName: sheetName,
    updated: updated,
    scanned: scanned,
    notFound: notFound,
    limit: limit || null
  };
  try { Logger.log("[MOTK][Originals][Backfill] %s", JSON.stringify(summary)); } catch (_) { }
  return summary;
}

function job_refreshProxyIndexCache_v1(entity) {
  var res = sv_refreshProxyIndexCache_v1({ entity: entity });
  try { Logger.log("[MOTK][ProxyIndex][Refresh] %s", JSON.stringify(res && res.diag ? res.diag : res)); } catch (_) { }
  return res;
}
