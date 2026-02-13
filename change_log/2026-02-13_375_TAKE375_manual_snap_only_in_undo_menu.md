# 0. Work Order (verbatim copy)
もう複雑なので、自動スナップ以外はUNDO MENUで取れるだけでいいです。
これは毎回命名します。

# 1. Summary
Simplified snapshot UX per request:
- Auto-snapshot remains enabled.
- Manual snapshot capture is now available only from the Undo menu.
- Manual snapshot always requires a name input.

Additional stability adjustment included in the same patch set:
- Snapshot deadlock fix: commit queue now pauses only during snapshot RPC phase, not while waiting for queue drain.

# 2. Files Changed
- `3CL_Scheduler.html`
  - Added `Take SNAP` button in Undo modal toolbar.
  - Changed toolbar `SNAP` button behavior to open Undo modal (manual capture entrypoint moved to modal).
  - Added manual snapshot action from Undo modal with mandatory naming prompt.
  - Snapshot RPC payload now sends name only for manual captures.
  - Added button state management for the new Undo modal `Take SNAP` button.
  - Added `snapPhase` state and queue/rpc phase split for snapshot locking behavior.

# 3. Commands Executed
- `node --check 2SV_DataCore.js`
- `clasp push`
- `clasp deploy -d "TAKE375 manual snapshot only in undo menu"`
- `git add 3CL_Scheduler.html change_log/2026-02-13_375_TAKE375_manual_snap_only_in_undo_menu.md`
- `git commit -m "TAKE375 move manual snapshot capture to undo menu"` (pending)
- `git push origin main` (pending)

# 4. Test Evidence
- Syntax check:
  - `node --check 2SV_DataCore.js` => passed.
- Deploy evidence:
  - `clasp push` => `Pushed 18 files.`
  - `clasp deploy -d "TAKE375 manual snapshot only in undo menu"` =>
    `Deployed AKfycbyowTyVjXo-zOAwvdh1P8K1A4VQl3RaK1GaQPaMW-Es3SrEkV4y659yO8vi90kkTbUE8Q @539`
- Manual browser verification:
  - Not executed in CLI (required in runtime UI).

# 5. Follow-ups / Risks
- Browser-side validation required for:
  - manual snapshot only via Undo menu,
  - mandatory naming behavior,
  - repeated snapshot capture without save deadlock.
