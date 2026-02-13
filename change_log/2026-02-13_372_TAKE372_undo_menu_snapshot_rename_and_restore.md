# 0. Work Order (verbatim copy)
今ってSNAP取った変更だけが戻れる？
スナップ取ったところがUNDOのメニューでわかりやすくしてほしいし、名前変えれるようにしてほしい。
名前変えて残されたスナップは消えないようにしてほしい

名前変えるのはUNDOメニューで”できる”だけでいい。SNAP＝名前入力ではない

# 1. Summary
Extended Scheduler undo modal to support snapshot-first operations:
- Snapshot entries are now visible as dedicated items in the Undo menu.
- Selected snapshot can be restored directly from the same menu.
- Snapshot renaming is available only from the Undo menu (no name prompt during SNAP capture).
- Named snapshots are excluded from rolling cleanup; rolling cleanup keeps the latest 5 unnamed snapshots.

# 2. Files Changed
- `2SV_DataCore.js`
  - Added snapshot metadata note helpers for naming.
  - Added snapshot-aware retention trim to preserve named snapshots.
  - Added snapshot list item assembly for undo options (`kind: snapshot`).
  - Added snapshot rename endpoint: `sv_scheduler_snapshot_rename_v1`.
  - Added snapshot restore endpoint: `sv_scheduler_snapshot_restore_v1`.
  - Added snapshot decode/apply helpers for restoring full schedule state.
- `3CL_Scheduler.html`
  - Added `Rename SNAP` button in Undo modal toolbar.
  - Undo list now renders snapshot items distinctly (name/retention type).
  - Apply button behavior switches by selection:
    - undo group => `Undo To Selected`
    - snapshot => `Restore Selected SNAP`
  - Added client actions for snapshot rename and snapshot restore.

# 3. Commands Executed
- `node --check 2SV_DataCore.js`
- `clasp push`
- `clasp deploy -d "TAKE372 undo menu snapshot restore rename"`
- `git add 2SV_DataCore.js 3CL_Scheduler.html change_log/2026-02-13_372_TAKE372_undo_menu_snapshot_rename_and_restore.md`
- `git commit -m "TAKE372 add snapshot restore and rename in undo modal"`
- `git push origin main`
- Branch: `main`
- Commit: `8211272`

# 4. Test Evidence
- Syntax check:
  - `node --check 2SV_DataCore.js` => passed.
- Deploy evidence:
  - `clasp push` => `Pushed 18 files.`
  - `clasp deploy -d "TAKE372 undo menu snapshot restore rename"` =>
    `Deployed AKfycbxqgl-EMWTXNroDvTrwZ5iqtkXUy69QQ9iwg6EHF6qYG2wDuKQ1R6XB4KHxhELR7iB4dg @536`
- Manual UI verification:
  - Not executed in CLI. Browser-side test required for:
    - snapshot row visibility in undo modal,
    - restore selected snapshot,
    - rename selected snapshot and retention behavior for named snapshots.

# 5. Follow-ups / Risks
- Snapshot restore rewrites scheduler card rows to the snapshot state, so active editing should be avoided during restore.
- Final behavior confirmation requires browser-side manual test in deployed build.
