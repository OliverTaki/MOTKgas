# TAKE357 - Scheduler Commit Undo Log Integration

- Date: 2026-02-12
- Scope: `src/2SV_DataCore.js`

## Goal
Connect scheduler card commit operations to the existing undo journal on the `Cache` sheet, so `sv_undo_last_v2` can actually revert scheduler edits.

## Changes
1. Added undo-log control flags in `sv_scheduler_commit_v2`:
- Read `payload.__skipUndoLog` to prevent recursive logging during undo replay.
- Read `payload.actor` as actor hint for journal entries.

2. Added scheduler row snapshot helpers in `sv_scheduler_commit_v2`:
- Read current card state from sheet row before destructive updates.
- Normalize slot values (`start`, `end`, `len`) for consistent inverse payloads.

3. Added scheduler undo journal writes for each action:
- `delete` -> inverse payload is `create` with pre-delete card snapshot.
- `update` -> inverse payload is `update` with pre-update card snapshot.
- `create` -> inverse payload is `delete` by newly created card id.

4. Journal format uses existing undo infrastructure:
- Scope: `scheduler`
- Inverse kind: `scheduler_commit`
- Target sheet/entity/id recorded for traceability.

## Notes
- Existing undo APIs/helpers were already present (`sv_undo_last_v2`, `_undo_appendLog_`, etc.); this TAKE wires scheduler commit into them.
- `Cache` sheet behavior remains: newest at top, trim by max rows.

## Validation
- Static syntax check: `node --check src/2SV_DataCore.js` passed.
- Confirmed references:
  - `sv_scheduler_commit_v2` now reads `__skipUndoLog`.
  - Scheduler scope undo logs are now appended.
