# MOTK GAS Consolidation Notes

_Last updated: 2025-09-19_

These notes capture the current state of the project after consolidating the “25” folder into `src/`. Future changes should treat this file as the source of truth when resuming work.

## File Structure & Includes\n- `COMMON_styles.html`: copy of `25/CoreStyles.html` (table view toolbar top now uses CSS vars instead of the hard-coded 64px).\n- `viewer.html`: exact copy of `25/viewer.html`. Provides all table UI, nav offset logic, pager, etc. Any edits must consider Apps ScriptのES5制約（no `for…of`, optional chaining, etc.）。\n- `Scripts.html`: navigation controller rewritten in ES5. Highlights the active PNavi tab using `data-nav-page`/`data-nav-entity`.\n- `DETAIL_entity.html`: shared detail template (verbatim `25/DetailShot.html`, with nav-height sync script).\n  - Former `Detail{Shot|Asset|Task|Member|User}.html` wrappers were removed.\n- `DebugPanelPage.html`: restored from `25` to re-enable scrolling.\n\n## Navigation Styling
- GNavi/PNavi markup is inline in both index.html and DETAIL_entity.html; Scripts.html applies the active state.
- Table toolbar spacing relies on COMMON_styles.html; we now use CSS vars (header + pnav) instead of the hard-coded 64px.

## Known Runtime Notes
- Console warnings such as `Unrecognized feature: 'ambient-light-sensor'` are emitted by the Apps Script iframe and can be ignored; they were present in the original `25` deployment.
- API errors (`500`, `429`) observed during pagination originate on the Apps Script backend (`listRowsPage`). Root cause not yet investigated; behaviour may match original code.
- Pager text and behaviour are unchanged from `25`. Historic bug: selecting `500 per page` still displays `1-100`—left as-is (original behaviour) until requirements clarify.

## Outstanding Checks (2025-09-19)
1. **PNavi ↔ Toolbar spacing**: confirm after deploy that the restored DetailShot styles (original CSS + Bar partials) remove the 20px gap on detail screens.
2. **Detail Routing**: smoke-test each entity link now that doGet resolves via the Detail* stubs.
3. **Pagination**: sanity-check that switching to 200/500 rows fetches oversized pages (server `listRowsPage` still slices by limit).
4. **Debug Panel**: verify the Copy page text shortcut works with the restored binding and clipboard fallback.

## Deployment Practice
- Always run `clasp push -f` after changes (requirement from user). `clasp push` without `-f` often outputs “Skipping push.” even when files changed.
- `clasp open` is not available in this env (command missing). Use web UI manually if needed.

## When Adding New Work
- Keep ES5 compatibility in all client scripts (`Scripts.html`, `viewer.html`, `DETAIL_entity.html`).
- Update this `WORKLOG.md` if you touch shared templates, routing, or styling.

## 2025-09-19 Update
- Restored DetailShot/DETAIL_entity to the original 25 template (inline CSS plus BarGnavi/BarPnavi includes) so GNavi/PNavi spacing matches production.
- Code.js now routes every detail request through DetailShot; Detail*.html wrappers just include DETAIL_entity so HtmlService stops complaining about missing templates.
- Table view still depends on COMMON_styles.html (toolbar offset uses CSS variables).
- Debug panel data blocks still come back empty (FIELD_TYPES, layout presets); investigate DATAHUB.Fields and dp_listPageLayoutPresets once spreadsheet access is available.
## 2025-09-20 Update
- Detail nav offset now syncs --gnav-height alongside --header-height to remove the ~20px gap between PNavi and the toolbar. Updates in both DETAIL_entity.html (inline script) and Scripts.html ensure detail/table views share the same CSS variables.
- No structural changes to routing; if detail pages continue returning 404, verify clasp push -f completed successfully so DETAIL_entity.html exists in the Apps Script project.
- Restored FieldsAPI.html from the 25 build so Apps Script can include('FieldsAPI'); this fixes the 404 on detail routes caused by template evaluation failure.
- Reverted the table toolbar offset to the original fixed 64px so it sits flush under PNavi; dynamic vars remain for detail layouts.
- Added COMMON_renderer.html (client Fields API) derived from the 25 build and rewired detail includes accordingly so the renderer scripts load without hitting missing-template errors.
- Rebuilt DETAIL_entity.html from the 25 template, removed the inline <style> block, and wired it to COMMON_styles/COMMON_renderer with inline nav markup so detail routes load without Bar partials and avoid the old document.write syntax error.
- Added a lightweight nav-height sync script (head) that mirrors the table page logic so GNavi/PNavi heights feed into the shared CSS variables.
- Normalised detail templates and shared assets to ASCII-only comments/labels and replaced the Shotview iframe embed with an explicit preview link to avoid CSP errors.
- Restored detail layout class, entity-to-sheet routing, and Shotview iframe fallback so per-entity pages load the correct record and the preview renders again.
- Updated detail loader to map entity names (shot/asset/task/member/user) to their Sheets and added explicit ID matching with a debug snapshot so the correct record loads instead of defaulting to sh_0001.
- Detail init now reads body data attributes and query params to select the correct sheet/id, with a fallback scan + console info so links no longer default to sh_0001.
- Default detail layouts now branch per entity: shots keep the shotview sequence, while other entities get a generated table of their own fields so non-shot cards render correctly.

## 2025-09-22

### SaveAs二重生成の問題
- SaveAs 実行時に Pages シートへ **2行作成される**事象を確認。
- 原因: `gsCreatePagePreset`（新規行作成）と `gsSavePageConfig`（更新保存）が連続して呼ばれる構造。
- 結果:
  - 1行目: Page Name / Page Type / Entity / Shared などは埋まるが Config が未設定。
  - 2行目: Config は保存されるが、Page Name など必須フィールドが空欄。
- 対策方針: SaveAs → 新規行作成と必須フィールドの書込みを一度に行い、そのIDをキャッシュして以後の Save はそのIDに対してのみ実行するよう統一する。

### entity_link 置換
- Detail ページでは `_cellToViewToken_` を経由するため 100% ID→ラベル置換が成功。
- Table ページでは `listRowsPage` が生データ返却のため置換が不完全。
- 対策方針: `listRowsPage` の返却処理に `_cellToViewToken_` を通す。全ページで共通的に entity_link が正しくラベル置換されるようにする。

### UI 課題
- SaveAs ダイアログに Shared チェックボックスが存在せず、Shared 列が初期から記入されない。
- Toolbar と pNAVI の間に不要なギャップがある。
- 対策方針:
  - SaveAs UI に Shared チェックボックスを追加して値を反映。
  - COMMON_styles.html に統一 CSS を追加し、ギャップを解消する。
