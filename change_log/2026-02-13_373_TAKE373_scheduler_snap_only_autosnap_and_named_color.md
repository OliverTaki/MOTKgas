# 0. Work Order (verbatim copy)
OK色々わかった。
明示的にSNAPしたところはちゃんと戻れるけどそれ以外は戻れないに等しい。
であればもうSNAPのみにする。
しかしブラウザでこのスケジューラーのページを開いている時は10分かそれ以上経ったら次の変更をスナップとるとかにするか？
あとこの制度にすることで、SNAP中さわれないのどうにかできないかな？あと名前変えたスナップだけ色変えるとかもしておいてほしい。

名前変えるのはUNDOメニューで”できる”だけでいい。SNAP＝名前入力ではない

# 1. Summary
Switched Scheduler restore flow to SNAP-only operation in the undo menu, added automatic snapshot trigger policy, removed snapshot UI blocking during capture, and added visual highlighting for named snapshots.

Main behavior changes:
- Undo menu (Scheduler scope) now lists and restores snapshots only.
- If 10 minutes (or more) have passed while the page is open, the next edit triggers an automatic background SNAP.
- Snapshot capture no longer uses the full blocking overlay, so editing can continue while snapshot waits/runs.
- Named snapshots are now visually highlighted in the list.

# 2. Files Changed
- `2SV_DataCore.js`
  - Scheduler-scope undo options now return snapshot items only.
  - Snapshot items are sorted by timestamp descending.
  - Snapshot create response now includes server timestamp (`ts`) for client auto-snap timer sync.
- `3CL_Scheduler.html`
  - Undo modal title/button wording updated to snapshot-centric wording.
  - Added styles for snapshot rows and named snapshot highlight.
  - Added auto-snapshot state/timer tracking (`10min` threshold).
  - Added local persistence for last snapshot timestamp.
  - Added `maybeAutoSnapshotByEdit_()` and wired it to commit path.
  - Snapshot capture changed to non-blocking mode (no full overlay lock).
  - Scheduler undo action now restores snapshot only (non-snapshot selected rows are not restorable from this menu).

# 3. Commands Executed
- `node --check 2SV_DataCore.js`
- `clasp push`
- `clasp deploy -d "TAKE373 scheduler snap-only autosnap named highlight"`
- `git add 2SV_DataCore.js 3CL_Scheduler.html change_log/2026-02-13_373_TAKE373_scheduler_snap_only_autosnap_and_named_color.md`
- `git commit -m "TAKE373 switch scheduler restore to snap-only and add autosnap"`
- `git push origin main`
- Branch: `main`
- Commit: `2a8f9fd`

# 4. Test Evidence
- Syntax check:
  - `node --check 2SV_DataCore.js` => passed.
- Deploy evidence:
  - `clasp push` => `Pushed 18 files.`
  - `clasp deploy -d "TAKE373 scheduler snap-only autosnap named highlight"` =>
    `Deployed AKfycbx4SXvzPfY45ixidmY_JZns4u3ygmPOzS2FIEXEk_-VUQr8trflA374y2POlTrYL47_JQ @537`
- Manual browser verification:
  - Not executed in CLI. Required for UI behavior confirmation.

# 5. Follow-ups / Risks
- Auto SNAP triggers at first edit after threshold; if save queue stays busy continuously, auto SNAP can defer/skip with status notification.
- Manual browser-side validation is required for:
  - non-blocking SNAP capture interaction,
  - auto SNAP trigger timing,
  - named snapshot color highlighting.
