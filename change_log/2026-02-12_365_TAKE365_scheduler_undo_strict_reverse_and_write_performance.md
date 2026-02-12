# TAKE365 - Scheduler Undo strict reverse replay and write performance hardening

## What changed
- File: `src/2SV_DataCore.js`
- Updated scheduler undo internals to reduce timeout risk and improve deterministic rollback behavior.

### 1) Strict reverse replay remains, with faster row resolution
- `sv_undo_last_v2(scope:"scheduler")` still undoes grouped logs by latest operation first.
- `_undo_applySchedulerTargetsBatch_` now keeps an in-memory `id -> row` map per schedule sheet while applying undo steps.
- This avoids repeated full-sheet row scans per card and keeps per-step target resolution stable.

### 2) Card row write path optimized
- `_undo_scheduler_writeCardAtRow_` changed from multiple `setValue` calls per field to a single row-level `setValues` write.
- This reduces RPC/write overhead during undo batches and lowers chance of timeout under rapid edits.

### 3) Card ID matching normalization for undo targets
- Added helper key normalization for IDs (`"009"`, `9`, etc.) so undo can find the correct card row even when sheet value formatting differs.

## Why
- Reported behavior: rapid scheduler edits + undo could become slow and produce inconsistent overlap states.
- Primary risks were high write cost and unstable row targeting under multi-step undo.

## Expected result
- `1 -> 2 -> 3 -> Undo` should more reliably return to state `2`.
- Better performance for undo batches and lower timeout probability.
