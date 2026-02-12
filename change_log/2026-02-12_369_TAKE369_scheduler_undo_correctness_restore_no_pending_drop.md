# TAKE369 - Scheduler undo correctness restore (no pending drop)

## Summary
Restored undo correctness for rapid sequential edits.
Previous optimization (TAKE368) dropped pending commit queue before undo, which could cause:
- `1-2-3-4-UNDO` reverting to an older persisted state (e.g. `0`) instead of `3`.

TAKE369 keeps queue compaction but removes pending-drop behavior, so undo now waits for save queue drain before RPC.

## File
- `src/3CL_Scheduler.html`

## Changes
1. Removed pending queue drop from `undoLast()` preflight.
- Undo no longer discards unsaved local commits.

2. Restored full queue-drain wait condition.
- Wait condition is back to `isCommitQueueIdle_()`.
- Overlay text/timeouts updated to queue-wide wording.

3. Retry behavior adjusted for undo phase.
- Commit retry suppression now applies only during `undoPhase === 'rpc'`.
- During `undoPhase === 'waiting_queue'`, retries can continue so queue can drain correctly.

## Expected behavior
- `1-2-3-4-UNDO` should resolve to `3` (not `0`) once queue drain completes.
- Undo may wait longer than TAKE368 in heavy queues, but should be logically correct.

## Validation
1. Perform 4 rapid scheduler edits (`1-2-3-4`).
2. Press Undo immediately.
3. Confirm final state equals `3`.
4. Confirm no unexpected overlap/corruption after undo reload.
