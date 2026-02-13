# TAKE366: Scheduler undo drains save queue before undo RPC

## Issue
- `1-2-3-4-UNDO` could jump too far back because pending commits were discarded before undo.
- Undo sometimes timed out due queue/undo phase interaction.

## Root cause
- Queue dispatch was paused by `undoBusy` too early.
- A temporary workaround dropped pending commits, which broke one-step undo expectations.

## Changes
- File: `src/3CL_Scheduler.html`
  - Added `state.undoPhase` (`waiting_queue` / `rpc`).
  - During `waiting_queue`, commit queue is allowed to continue draining.
  - During `rpc`, queue dispatch is paused.
  - Removed pending-commit drop on undo start.
  - Reset undo phase on success/failure/timeout paths.

## Expected behavior
- `1-2-3-4-UNDO` now waits for saves to settle, then undoes the latest applied operation.
- No forced discard of pending user actions before undo.
