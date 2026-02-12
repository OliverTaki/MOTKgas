# TAKE368 - Scheduler Undo wait reduction and queue race hardening

## Summary
Reduced `Undo` latency and race risk in Scheduler by changing undo preflight behavior:
- Keep `Undo` deterministic against persisted state.
- Prevent long waits caused by large pending commit queues.
- Avoid retry storms while undo is in progress.

## Files
- `src/3CL_Scheduler.html`

## Changes
1. Added pending-queue drop before undo RPC.
- New helper: `dropPendingCommitQueueForUndo_()`.
- `undoLast()` now:
  - compacts pending queue (existing behavior), then
  - drops remaining pending queue entries before starting undo wait.

2. Changed undo wait target.
- `undoLast()` now waits only for current `commitInflight` to finish.
- No longer waits for full pending queue drain.
- Timeout message changed to in-flight specific text.

3. Disabled commit retry loop during undo.
- In `flushCommitQueue_()` retry path, when `state.undoBusy` is true:
  - skip retry enqueue,
  - finalize immediately,
  - continue undo flow.

## Expected behavior after TAKE368
- Undo starts much faster when many pending saves exist.
- Reduced chance of undo/save interleaving corruption.
- If user made unsent local edits right before undo, those pending edits are intentionally discarded, then undo applies to persisted latest state.

## Validation guide
1. Do rapid consecutive card moves.
2. Immediately press `Undo` once.
3. Confirm:
- overlay shows short `Waiting in-flight save...` phase,
- no multi-minute wait,
- state reloaded after undo and no random overlap from stale queued writes.
