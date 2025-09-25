/** ProxySearchLoose.gs
 * DriveBuilderは変更しない。proxies 直下〜配下を「ゆるく」再帰検索する補助API。
 * 条件: ファイル名に id を含み、かつ "_proxy." を含む（どちらも大小無視）。modifiedTime 降順で返す。
 */
function _ps_norm(s){
  return String(s||'')
    .replace(/\u3000/g,' ')              // 全角スペース→半角
    .replace(/[\u200B-\u200D\uFEFF]/g,'')// ゼロ幅除去
    .trim();
}
function _ps_extractFolderId(url){
  var m = String(url||'').match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new Error('Invalid folder URL for proxies_root_url');
  return m[1];
}
function _ps_proxiesRoot(){
  var sh = SpreadsheetApp.getActive().getSheetByName('project_meta');
  if (!sh) throw new Error('project_meta sheet not found');
  var kv = {};
  var rows = sh.getRange(1,1,2,sh.getLastColumn()).getValues();
  rows[0].forEach(function(k,i){ kv[k] = rows[1][i]; });
  return DriveApp.getFolderById(_ps_extractFolderId(kv.proxies_root_url));
}

/** 内部: 再帰でファイル収集（必要なら階層を辿る） */
function _ps_collectFiles(folder, hits, idLC){
  // ファイル
  var fit = folder.getFiles();
  while(fit.hasNext()){
    var f = fit.next();
    var nameLC = _ps_norm(f.getName()).toLowerCase();
    if (nameLC.indexOf(idLC) !== -1 && nameLC.indexOf('_proxy.') !== -1){
      hits.push({
        id:           f.getId(),
        name:         f.getName(),
        mimeType:     f.getMimeType(),
        modifiedTime: f.getLastUpdated(),
        size:         f.getSize()
      });
    }
  }
  // サブフォルダも探索（PROXIES配下をフラット運用していても安全）
  var dit = folder.getFolders();
  while(dit.hasNext()){
    var d = dit.next();
    _ps_collectFiles(d, hits, idLC);
  }
}

/** 公開: ゆるい検索（大小無視＋再帰） */
function findProxyFilesLoose(id){
  id = _ps_norm(id);
  if (!id) return [];
  var root = _ps_proxiesRoot();
  var hits = [];
  _ps_collectFiles(root, hits, id.toLowerCase());
  hits.sort(function(a,b){ return new Date(b.modifiedTime) - new Date(a.modifiedTime); });
  return hits;
}
