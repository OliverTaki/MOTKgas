# Module and Object Intent

This section explains intent, not just file names.

## Standalone (`1SA_*`)

### `1SA_Automation.js`
Intent:
- spreadsheet trigger layer
- onEdit/onChange automation hub
- low-level spreadsheet-side maintenance behaviors

Important current role:
- date normalization on edit
- reciprocal link sync entry point on edit
- historical ID/header helpers still live here

Risk:
- contains legacy code and legacy-language comments
- should be refactored carefully, not blindly rewritten

### `1SA_CacheHydrator.js`
Intent:
- scheduled cache warming and trigger management
- reduce runtime misses for Originals / proxy index paths

### `1SA_DebugPanel.html`
Intent:
- operator diagnostics page
- not product UI, but essential for field verification

What it covers:
- runtime availability
- viewer state
- schema/meta health
- originals resolver
- contract presence
- console/report export

### `1SA_DriveBuilder.js`
Intent:
- enforce/audit Drive folder structure
- originals/proxies scaffolding and diff/fix helpers

### `1SA_ProjectSetup.js`
Intent:
- sync spreadsheet/project naming into `project_meta`
- minimal setup helper, not daily workflow core

### `1SA_Settings.js`
Intent:
- server API behind Settings page
- `project_meta` CRUD
- maintenance actions (hydrate, drive diff/fix, recalculation entry points)

## Server (`2SV_*`)

### `2SV_DataCore.js`
Intent:
- main server entrypoint and routing backbone
- template resolution, request normalization, shared server APIs

Key responsibilities:
- route `p=schedule` to `3CL_Scheduler`
- route `p=schedview` to `3CL_SchedView`
- route settings/debug pages
- normalize `page/entity`
- expose server-side helpers used across views

This is the central server integration file.

### `2SV_PageConfigs.js`
Intent:
- saved page presets/layout metadata
- table page configuration read/write
- entity/page configuration inference from sheet headers/meta

### `2SV_ServerFields.js`
Intent:
- lightweight field/link resolver APIs
- Originals URL resolution
- Link map generation

Use case:
- keep FE from doing expensive or ambiguous resolver logic for basic linked field rendering

## Client (`3CL_*`)

### `3CL_CommonRenderer.html`
Intent:
- shared field renderer and schema resolver for client pages
- type-driven rendering/editing helpers

It is the cross-page field behavior substrate.

### `3CL_CommonStyles.html`
Intent:
- shared shell/table/detail styling and theme variables
- explicit theme override support via `data-theme`

### `3CL_Router.html`
Intent:
- client-side URL construction and navigation semantics
- normalize routing expectations across pages

Important behavior:
- schedule links are built toward `schedview`
- detail/entity URLs are generated consistently

### `3CL_Shell.html`
Intent:
- primary shell for root/table/dashboard-style app surfaces
- early console capture
- theme bootstrap
- common outer frame

### `3CL_Table.html`
Intent:
- paged entity table viewer/editor
- server search, filters, sorting, saved pages, inline edits

### `3CL_Detail.html`
Intent:
- detail page for entity records
- supports edit/view mode, card management, save menu, navigation

### `3CL_Settings.html`
Intent:
- operator-facing settings UI
- edit `project_meta`
- trigger maintenance operations
- configure theme (`project_meta.ui_theme`)

### `3CL_Scheduler.html`
Intent:
- edit-mode schedule construction tool
- slot-based, card-centric, specialist UI

Core domain objects inside this page:
- `state.cards`
  - live editable card collection
- `commitQueue`
  - pending outbound save operations
- `commitInflight`
  - operation currently being written
- `undoBusy` / `snapBusy` / `publishBusy`
  - mutually important execution guards
- `viewMeta`
  - edit-mode view/lane/settings persistence
- `cardViewMeta`
  - published taskless view data bridge; must not be rewritten casually
- `tasklessOrderByCardId`
  - ordering helper for taskless handling
- `multiSelection`
  - active multi-card edit selection state

Functional areas:
- card editing
- queue-driven save
- snapshot history
- publish
- auto card creation
- settings for lane/view/card display/colors

### `3CL_SchedView.html`
Intent:
- view-oriented schedule page for broader consumption
- lighter than Scheduler edit mode
- date/order/lane-centric rather than slot-centric in published interpretation

Core expectations:
- reads published task state from `Tasks`
- reads taskless published state from `sched.card_view_meta`
- should remain lightweight and crew-friendly

### Domain data objects

#### `view_meta` (`sched.fi_0093`)
Intent:
- persist view/lane/settings configuration
- edit and view pages can both use this concept, but semantics differ by mode

#### `card_view_meta` (`sched.fi_0094`)
Intent:
- published, date-based, taskless-card view snapshot
- bridge for rendering taskless cards in SchedView

Rules:
- publish-time write only
- do not treat as live edit scratchpad
- do not store slot values in the view contract

#### `task Order` (`task.fi_0095`)
Intent:
- canonical published order key for view-mode rendering
- should align Task and Taskless ordering at publish boundary

#### `project_meta`
Intent:
- global configuration plane
- formulas, theme, pNav config, schedule constants, and environment settings live here

This is the configuration spine of the project.
