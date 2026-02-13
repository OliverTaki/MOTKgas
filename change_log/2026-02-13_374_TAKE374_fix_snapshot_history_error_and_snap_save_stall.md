# 0. Work Order (verbatim copy)
なんか無限にsavingしているし、UNDO MENUでヒストリーも読めない

# 1. Summary
Fixed two regressions introduced by snapshot-only mode:
- Undo menu history loading error (`Cannot read properties of undefined (reading 'length')`).
- Snapshot/commit contention that could keep save status in a stuck/near-infinite saving state.

Implemented fixes:
- Corrected scheduler-scope `sv_undo_options_v2` response bookkeeping so `totalGroups` never references an undefined variable.
- Added scheduler-side write serialization while snapshot capture is active: commit queue pauses during `snapBusy` and resumes after snapshot completion.
- Added snapshot attempt cooldown anchor (`lastSnapshotAttemptAtMs`) so failed/queued auto-snapshot attempts do not retrigger every edit tick.

# 2. Files Changed
- `2SV_DataCore.js`
  - Fixed `sv_undo_options_v2` (`totalGroups` calculation for scheduler snapshot-only branch).
- `3CL_Scheduler.html`
  - Paused `flushCommitQueue_()` while `snapBusy` to avoid lock contention and repeated busy retries.
  - Added `lastSnapshotAttemptAtMs` state and integrated it into auto-snapshot trigger timing.

# 3. Commands Executed
- `node --check 2SV_DataCore.js`
- `clasp push`
- `clasp deploy -d "TAKE374 fix snapshot history error and snap save stall"`
- `git add 2SV_DataCore.js 3CL_Scheduler.html change_log/2026-02-13_374_TAKE374_fix_snapshot_history_error_and_snap_save_stall.md`
- `git commit -m "TAKE374 fix snapshot options crash and snap/commit contention"`
- `git push origin main`
- Branch: `main`
- Commit: `50261a5`

# 4. Test Evidence
- Syntax check:
  - `node --check 2SV_DataCore.js` => passed.
- Deploy evidence:
  - `clasp push` => `Pushed 18 files.`
  - `clasp deploy -d "TAKE374 fix snapshot history error and snap save stall"` =>
    `Deployed AKfycby0rwL6mxFtQ5TY72U_KOLbI-wXoQ9v3df6rnbLHXXddYEPF9xz8TclIn7ZaYIRJvQJxw @538`
- Manual browser verification:
  - Not executed in CLI (required in runtime UI).

# 5. Follow-ups / Risks
- Browser-side confirmation is still required for:
  - Undo modal history loading.
  - Save status stability during/after snapshot capture.
