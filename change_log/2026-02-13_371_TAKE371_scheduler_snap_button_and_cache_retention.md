# 0. Work Order (verbatim copy)
今リロードボタンがあるけどこれ要らない。
ここにsnapボタン作って下さい。
そしてSNAPは5件まで残してCACHEシートの上に保持、順番に消えていく。

# 1. Summary
Replaced the Scheduler toolbar `Reload` button with a `SNAP` button.
Implemented scheduler snapshot creation to the `Cache` sheet and retention trimming to keep only the latest 5 snapshot records (`scheduler_snapshot/snapshot`), inserted at the top of the sheet.

# 2. Files Changed
- `3CL_Scheduler.html`
  - Replaced `Reload` button with `SNAP`.
  - Added snapshot action flow with queue-idle wait before server RPC.
  - Added status/overlay handling for snapshot progress and failure.
- `2SV_DataCore.js`
  - Added `sv_scheduler_snapshot_create_v1`.
  - Added snapshot collection helper for active schedule cards.
  - Added `_undo_trimSnapshots_` to keep latest 5 snapshot rows only.

# 3. Commands Executed
- `git fetch origin`
- `node --check 2SV_DataCore.js`
- `node --check 1SA_Automation.js`
- `clasp push`
- `clasp deploy -d "TAKE371 SNAP button and snapshot retention"`
- `git add 2SV_DataCore.js 3CL_Scheduler.html change_log/2026-02-13_371_TAKE371_scheduler_snap_button_and_cache_retention.md`
- `git commit -m "TAKE371 replace reload with snap and keep latest 5 snapshots"` (pending)
- `git push origin main` (pending)

# 4. Test Evidence
- Syntax check:
  - `node --check 2SV_DataCore.js` => passed.
  - `node --check 1SA_Automation.js` => passed.
- Deploy evidence:
  - `clasp push` => `Pushed 18 files.`
  - `clasp deploy -d "TAKE371 SNAP button and snapshot retention"` =>
    `Deployed AKfycbw8nmRLBJlwkPqC8ySN86AWJ6mgA7eyDEeqoRTixDs_gZGhLcXybXAbXhlzmC1qNbrnHQ @535`
- Manual UI/DebugPanel verification:
  - Not executed in CLI; requires browser-side confirmation after deployment.

# 5. Follow-ups / Risks
- Snapshot payload size depends on card volume. A gzip+base64 fallback is used, but extremely large schedules can still exceed a single-row payload cap and return an explicit error.
- UI/DebugPanel manual verification is required in deployed environment.
