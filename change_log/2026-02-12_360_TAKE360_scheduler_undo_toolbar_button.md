# TAKE360 - Scheduler Undo button wired to sv_undo_last_v2

## Summary
- Added a visible `Undo` button to Scheduler toolbar.
- Wired button to Apps Script RPC `sv_undo_last_v2` with `scope: "scheduler"`.
- On success: reload scheduler from network to reflect the undone state.

## Changes
- File: `src/3CL_Scheduler.html`
  - Toolbar: added `#btn-undo` button.
  - State: added `undoBusy` guard to prevent double-click concurrent undo calls.
  - Actions: added `actions.undoLast()`.
  - Events: bound `btn-undo` click to `actions.undoLast`.

## Notes
- Server logic already defaults scheduler undo to force mode when scope is `scheduler`.
- UI now exposes undo directly without requiring DevTools command execution.
