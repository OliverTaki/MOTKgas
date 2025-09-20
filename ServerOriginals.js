/** ServerOriginals.gs
 * Originals 解決 API（DebugPanelPage.html から呼ばれる）
 * - dp_debugPing
 * - dp_getProjectMeta
 * - dp_traceOriginals
 * - dp_resolveOriginals
 *
 * 期待パス（例: shot/sh_0001）
 *   ROOT/
 *     01shots/
 *       sh_0001__ 201A   ← ここに着地
 *
 * エンティティ→直下フォルダ
 *   shot  -> 01shots
 *   asset -> 02assets
 *   task  -> 03tasks
 *   member,user,その他 -> 04misc
 * さらに 05deleted は将来の削除置き場として予約
 */

/** 動作確認用 */
function dp_debugPing(){
  return { ok: true, ts: Date.now() };
}

/** プロジェクトメタの取得（Script Properties） */
function dp_getProjectMeta(){
  const p = PropertiesService.getScriptProperties();
  return {
    originals_root_url: p.getProperty('ORIGINALS_ROOT_URL') || '',
    proxies_root_url:   p.getProperty('PROXIES_ROOT_URL')   || ''
  };
}

/** Originals を段階的にトレース（root -> entityフォルダ -> leaf） */
function dp_traceOriginals(ctx){
  const steps = [];
  try{
    const meta = dp_getProjectMeta();

    if(!meta.originals_root_url){
      steps.push({name:'ProjectMetaRoot', ok:false, info:{reason:'ORIGINALS_ROOT_URL not set'}});
      return {found:false, steps, finalUrl:''};
    }

    // Step: ProjectMetaRoot
    steps.push({name:'ProjectMetaRoot', ok:true, info:{root:meta.originals_root_url}});
    const rootId = _extractDriveId_(meta.originals_root_url);
    if(!rootId){
      steps.push({name:'ProjectMetaRoot', ok:false, info:{reason:'cannot extract drive id'}});
      return {found:false, steps, finalUrl:''};
    }

    // entity / id
    const ent = String(ctx && ctx.entity || '').toLowerCase();
    const id  = String(ctx && ctx.id      || '').trim();

    // 規約フォルダ名
    const entFolderName = _entityRootFolderName_(ent);
    const entFolder = _findChildFolderByNameExact_(rootId, entFolderName);
    steps.push({name:'DriveBuilder', ok: !!entFolder, info:{folder: entFolderName}});

    if(!entFolder){
      return {found:false, steps, finalUrl:''};
    }

    // leaf 名規約（shot は "sh_XXXX__ 201A" 形式を優先）
    var expectedLeafName = id || '';
    if(ent === 'shot' && id) expectedLeafName = id + '__ 201A';

    // 1) 完全一致を最優先
    let leaf = expectedLeafName ? _findChildFolderByNameExact_(entFolder.getId(), expectedLeafName) : null;

    // 2) 見つからなければフォールバック検索（接頭辞・ゆらぎ）
    //    - "sh_0001__" で始まる
    //    - 大文字/小文字/連続スペースのゆらぎ対応
    //    - 最短名（＝最も素直な候補）を採用
    let searched = false;
    if(!leaf && id){
      searched = true;
      const candidates = _findChildFoldersByPrefix_(entFolder.getId(), id + '__');
      // ソート: 完全一致に近いほど上位（長さ昇順 → アルファベット昇順）
      candidates.sort(function(a,b){
        const la = a.getName().length, lb = b.getName().length;
        if(la !== lb) return la - lb;
        const na = a.getName().toLowerCase(), nb = b.getName().toLowerCase();
        if(na < nb) return -1; if(na > nb) return 1; return 0;
      });
      leaf = candidates.length ? candidates[0] : null;
    }

    steps.push({
      name:'ServerAPIs',
      ok: !!leaf,
      info: {
        tryExact: !!expectedLeafName,
        searched,
        expected: expectedLeafName || null,
        hint: id ? (id + '__') : null
      }
    });

    if(!leaf){
      return {found:false, steps, finalUrl:''};
    }

    const finalUrl = 'https://drive.google.com/drive/folders/' + leaf.getId();
    return {found:true, steps, finalUrl};

  }catch(e){
    steps.push({name:'Error', ok:false, info:{message:String(e)}});
    return {found:false, steps, finalUrl:''};
  }
}

/** URLだけ欲しい場合の薄いラッパー */
function dp_resolveOriginals(ctx){
  const r = dp_traceOriginals(ctx);
  return r && r.found ? r.finalUrl : '';
}

/* ============ helpers ============ */

/** エンティティ→直下フォルダ名 */
function _entityRootFolderName_(ent){
  switch(ent){
    case 'shot':  return '01shots';
    case 'asset': return '02assets';
    case 'task':  return '03tasks';
    case 'member':
    case 'user':
    default:      return '04misc';
  }
}

/** Google Drive フォルダURL等から ID を抽出 */
function _extractDriveId_(url){
  if(!url) return '';
  const m = String(url).match(/\/folders\/([A-Za-z0-9_-]+)/);
  if(m && m[1]) return m[1];
  const m2 = String(url).match(/[?&]id=([A-Za-z0-9_-]+)/);
  if(m2 && m2[1]) return m2[1];
  return '';
}

/** 完全一致で子フォルダ 1 件を取得（見つからなければ null） */
function _findChildFolderByNameExact_(parentId, name){
  try{
    const parent = DriveApp.getFolderById(parentId);
    const it = parent.getFoldersByName(name);
    return it.hasNext()? it.next() : null;
  }catch(_){ return null; }
}

/** 接頭辞で子フォルダを列挙（大文字小文字・連続空白ゆらぎを吸収） */
function _findChildFoldersByPrefix_(parentId, rawPrefix){
  const res = [];
  try{
    const parent = DriveApp.getFolderById(parentId);
    const normPrefix = _normalizeName_(rawPrefix);

    const it = parent.getFolders();
    while(it.hasNext()){
      const f = it.next();
      const nm = f.getName();
      if(_normalizeName_(nm).indexOf(normPrefix) === 0){
        res.push(f);
      }
    }
  }catch(_){}
  return res;
}

/** 名前の正規化（大小無視・全角半角スペース→半角1個・前後trim） */
function _normalizeName_(s){
  if(!s) return '';
  // 全角スペースを半角へ、連続スペースを1個へ、trim、lower
  return String(s)
    .replace(/\u3000/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}
