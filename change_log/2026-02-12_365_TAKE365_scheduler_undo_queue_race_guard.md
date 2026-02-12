# TAKE365: Scheduler undo queue race guard

## Background
- Rapid operations followed by Undo could produce unstable results when undo started while pending save queue items still existed.
- This caused non-deterministic rollback timing and occasional overlapped card states.

## Changes
- File: `src/3CL_Scheduler.html`
  - Stopped commit queue dispatch while undo is active (`flushCommitQueue_` early return when no inflight).
  - On Undo start, dropped unsent pending commits before calling server undo.
  - Prevented post-commit queue cascade during undo (finalize does not auto-flush while undo busy).
  - Resumed queue processing explicitly after undo success/failure completion.

## Effect
- Undo now runs against a cleaner queue state.
- Reduced race between pending commits and server-side undo apply.
- Lower risk of partial/out-of-order rollback under rapid edit sequences.

## Notes
- Inflight RPC cannot be cancelled; undo still waits for inflight completion.
- This TAKE is focused on scheduler undo determinism and does not change non-scheduler flows.
