/** ServerFieldsAPI.gs — Originals URL と LinkMaps を返す軽量API **/

/** Originals フォルダURLを返す（最優先で呼ばれる） */
function sv_getOriginalsFolderUrl(arg) {
  // arg: {entity,id,fid,value,row}
  // 実装はプロジェクトのルールに合わせて調整可
  // 例: シートやDBから originals フォルダID を引き、その Drive URL を返す
  var id   = String((arg && arg.id) || "");
  var ent  = String((arg && arg.entity) || "shot").toLowerCase();

  // ★ここを実装環境に合わせて取得
  //   例: Shotの originals フォルダID を引く
  var folderId = lookupOriginalsFolderId(ent, id); // ←実装側で用意していると仮定

  if (folderId) {
    return "https://drive.google.com/drive/folders/" + folderId;
  }
  return ""; // 見つからなければ空文字（クライアント側は「not found」表示）
}

/** 既存互換の別名（どれか一つあればOK） */
function getOriginalsFolderUrl(arg){ return sv_getOriginalsFolderUrl(arg); }
function sv_getOriginalsUrl(arg){     return sv_getOriginalsFolderUrl(arg); }
function getOriginalsUrl(arg){        return sv_getOriginalsFolderUrl(arg); }

/** LinkMaps（ID→表示名）を返す。既にある場合は流用可 */
function sv_getLinkMaps() {
  // 例: キャッシュ済みのID->Nameをまとめて返す
  return {
    assets:  getIdNameMap_("Assets"),
    shots:   getIdNameMap_("Shots"),
    tasks:   getIdNameMap_("Tasks"),
    users:   getIdNameMap_("Users"),
    members: getIdNameMap_("ProjectMembers")
  };
}
function getLinkMaps(){ return sv_getLinkMaps(); }

/** —— ヘルパ（実装例）—— **/
function getIdNameMap_(sheetName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return {};
  var rng = sh.getDataRange().getValues();
  if (rng.length < 2) return {};
  var header = rng[0];
  var idCol = 0; // A列 = ID
  // 名前列を推定
  var nameCol = 1;
  for (var i=0;i<header.length;i++){
    var h = String(header[i]||"").toLowerCase();
    if (/(name|code)/.test(h)) { nameCol = i; break; }
  }
  var map = {};
  for (var r=1;r<rng.length;r++){
    var row = rng[r];
    var id  = String(row[idCol]||"").trim();
    if (!id) continue;
    var name = String(row[nameCol]||"").trim() || id;
    map[id] = name;
  }
  return map;
}

/** ダミー：環境依存の originals フォルダID を取得する */
function lookupOriginalsFolderId(entity, id) {
  // TODO: 実装に合わせる（DB/Sheet/命名規則 など）
  // 未実装のままでもクライアント側で値中のDrive ID抽出フォールバックが効く
  return "";
}
