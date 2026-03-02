# Project Timeline and Open Milestones

## What this project is

MOTK is a Google Apps Script + Google Sheets production management app with:
- entity tables (`Shots`, `Assets`, `Tasks`, `ProjectMembers`, `Users`)
- detail pages
- scheduler edit mode (`3CL_Scheduler.html`)
- separate view mode (`3CL_SchedView.html`)
- settings/debug tooling

## Major evolution already completed

### Phase A: repo truth stabilization
- Local physical source lives in `src/`.
- `.clasp.json` remains fixed with `rootDir: ./src`.
- Git worktree is bound to `src/`, so remote Git tracks MOTK files at repo root without a tracked `src/` directory.
- This was hard-won and must not drift.

### Phase B: scheduler edit stabilization
- Multi-select behavior was stabilized.
- Checkbox-based multi-selection replaced modifier-key-only workflows.
- Delete flow gained confirmation.
- Camera movement got a visible card accent/badge treatment.
- Taskless cards remain first-class in edit mode.

### Phase C: undo/snapshot redesign
- The original incremental undo model was too fragile under queued saves.
- Snapshot-oriented behavior was introduced instead of relying on replaying action history.
- Snapshot/restore UI exists in Scheduler.

### Phase D: publish boundary clarified
- `Publish` writes business-facing schedule state into `Tasks`.
- `SchedView` reads published state rather than live edit state.
- Taskless view data is stored in `sched.card_view_meta` and was later constrained to publish-time writes only.

### Phase E: SchedView extraction
- Separate `3CL_SchedView.html` now exists.
- It is distinct from edit mode and accessed via `p=schedview`.
- It has its own settings, zoom, lane visibility, and task display controls.

### Phase F: task calculation / estimation work
- Task-derived estimation fields (`shooting_frames`, `Est length`, `Overrun Ratio`) were moved toward formula-driven behavior.
- Project meta is used as parameter source for formulas.
- User intent is that formula logic be centralized and not duplicated across FE and server when avoidable.

### Phase G: docs hardening
- User guide was revised through `MOTK_User_Guide 4.html`.
- AI-only development rules were added in `DEVELOPER_CODING_RULES.md`.

## Current delivered state

1. Scheduler edit mode exists and is usable.
2. SchedView exists as a separate page.
3. Publish exists and shows summary feedback.
4. Settings page controls theme and several maintenance operations.
5. Debug panel is substantial and documented.
6. Taskless cards are represented in published view state via `sched.card_view_meta`.

## Known active product rules

1. Edit Mode changes must not automatically rewrite published taskless view state.
2. Taskless published data should be date-based and order-based, not slot-based.
3. Publish is the moment when `Tasks.fi_0095` and published taskless order become canonical for view mode.
4. Taskless cards in view mode are not live reflections of edit state.

## Open milestones (highest confidence)

### M1. Save/publish performance hardening
Status: open

Needed:
- compress/coalesce save queue for repeated card updates
- eliminate no-op writes
- batch server writes where safe
- instrument end-to-end timings

Reason:
- user still perceives save/publish latency as a serious risk area
- this is one of the highest-value remaining engineering tasks

### M2. Observability / traceability
Status: open

Needed:
- FE to SV trace IDs for save/publish paths
- structured logs with timing stages
- clearer diagnostics for queue backlog and failure origin

Reason:
- difficult bugs have historically been caused by sequence ambiguity

### M3. Reciprocal link automation verification/completion
Status: partially implemented, not yet fully trusted

Intended automation pairs:
- `Task.fi_0031 (Shot Link)` <-> `Shot.fi_0062 (Task Link)`
- `Task.fi_0065 (Asset Link)` <-> `Asset.fi_0064 (Task Link)`
- `Shot.fi_0061 (Asset Link)` <-> `Asset.fi_0063 (Shot Link)`

The user wants all relevant link pairs synced at GS/onEdit level rather than split across FE and GS.

### M4. SchedView settings parity / dedicated inspector evolution
Status: partially delivered, still evolving

Current direction:
- keep SchedView lightweight
- but still expose the practical settings people need
- possible future separation of inspector specialization for SchedView

### M5. View-only schedule workflow refinement
Status: conceptually open

Current understanding:
- SchedView is the crew-facing view
- Scheduler edit mode is specialist tooling
- pNav `Schedule` should go to SchedView, not edit mode
- this is already mostly true but should remain defended

## Milestones explicitly not to regress

1. Repo truth model
2. Publish-only taskless view snapshot writes
3. Separate SchedView page
4. Meaningful Publish boundary
5. Immediate-save ergonomics in edit workflows
