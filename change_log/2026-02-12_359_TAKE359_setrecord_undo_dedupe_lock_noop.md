# TAKE359 - sv_setRecord_v2 duplicate undo-log suppression

## Summary
- Added server-side serialization and no-diff suppression in `sv_setRecord_v2`.
- Prevents duplicate undo rows when the same inline edit is submitted twice in a short window.

## Changes
- File: `src/2SV_DataCore.js`
- Function: `sv_setRecord_v2`
  - Added `LockService.getScriptLock()` around read-before + update + undo append.
  - Added no-diff detection (`before` vs `patch`) and returns `noop` when values are unchanged.
  - Writes only changed keys (delta patch), not the full incoming patch.
  - Undo log now records only changed keys for record updates.
  - Fixed patch normalization path to avoid mutating the input object unexpectedly.

## Why
- User observed one SHOT edit producing two undo rows with identical before/after payloads.
- This indicates duplicated near-simultaneous update requests were both accepted/logged.

## Expected behavior
- Single inline edit should produce one undo row.
- Repeated identical write with no value change returns `noop` and should not append undo log.
