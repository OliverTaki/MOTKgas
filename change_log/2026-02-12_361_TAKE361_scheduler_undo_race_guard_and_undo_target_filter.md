# TAKE361 - Scheduler Undo race guard and undo-target filtering

## Summary
- Stabilized Scheduler undo against save/undo races.
- Prevented "undo of undo" rows from being selected as next undo target.
- Added stronger client-side blocking during undo to avoid mixed operations.

## Changes
- File: `src/3CL_Scheduler.html`
  - Added commit queue stats helpers:
    - `getCommitQueueStats_()`
    - `isCommitQueueIdle_()`
  - Added blocking overlay helper:
    - `setBlockingOverlay_(visible, text)`
  - Updated `actions.undoLast()` flow:
    - Waits until commit queue is idle (timeout guarded).
    - Shows blocking overlay while waiting/executing.
    - Runs undo RPC only after queue idle.
    - Keeps UI blocked until forced network reload finishes.
  - Updated `actions.commit()` to reject new commits during undo (`state.undoBusy`).
  - Added keydown guard while undo is busy (prevents delete/escape/enter side effects).
  - Added spinner text node id `#loadingSpinnerText` for runtime status updates.

- File: `src/2SV_DataCore.js`
  - Updated `sv_undo_last_v2()` target selection:
    - Excludes rows where `action` is `undo` / `undo_group`.
    - Keeps undo stack moving backward on user operations only.
  - Updated scheduler grouped-undo selection to also skip `undo` rows.

## Intent
- Fix cases where rapid commits + undo created inconsistent state (partial rollback / overlap artifacts).
- Ensure expected behavior: `1 -> 2 -> 3 -> Undo` returns to state `2`.
