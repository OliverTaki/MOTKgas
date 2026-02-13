# TAKE358: Undo Log Diagnostics for Record and Scheduler Writes

## Summary
Added server-side undo-log diagnostics so write responses now report whether undo history logging was attempted and whether it succeeded.

## Changes
- File: `src/2SV_DataCore.js`

### 1) `sv_setRecord_v2`
- Added `undoLog` diagnostic payload to response:
  - `scope` (`record`)
  - `attempted`
  - `skipped`
  - `logged`
  - `logId`
  - `error`
- Wrapped `_undo_appendLog_` in `try/catch` so record updates are not broken by undo-log append failures.

### 2) `sv_scheduler_commit_v2`
- Added `undoLog` diagnostic payload to JSON response for `create/update/delete`.
- Wrapped scheduler undo-log append in `try/catch` and return diagnostics in response.

## Purpose
- Make root-cause investigation deterministic when `Cache` sheet appears empty after successful edits.
- Distinguish:
  - write path not hitting undo logging,
  - undo logging skipped,
  - undo logging attempted but failed.

## Validation
- `node --check src/2SV_DataCore.js` passed.
