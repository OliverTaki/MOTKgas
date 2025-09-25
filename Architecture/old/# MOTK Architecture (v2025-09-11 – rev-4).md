# MOTK Architecture (v2025-09-11 – rev-4)

*Canonical enumerations and detailed architecture for MOTK Sheets/App. Covers all files, functions, sheets, and debug platform.*

---

## Table of Contents
1. [Overview](#overview)
2. [Field Types](#field-types)
3. [Page Types](#page-types)
4. [Sheet Structure](#sheet-structure)
5. [Detail Pages](#detail-pages)
6. [Debug Platform](#debug-platform)
7. [Backend Functions](#backend-functions)
8. [File Operations](#file-operations)
9. [ProxyQueue Processing](#proxyqueue-processing)
10. [Deployment Workflow](#deployment-workflow)
11. [FAQ](#faq)

---

## 1. Overview
MOTK is a Google Apps Script web app for creative production (VFX/animation). Integrates Google Spreadsheets and Drive for data/file management.

- **Files**: Code.js, DebugPlatform.js, DriveBuilder.js, AUTOMATION.js, LinkMaps.js, PagesConfig.js, FieldsAPI.js, etc.
- **Sheets**: Shots, Assets, Tasks, ProjectMembers, Users, Pages, Fields, project_meta, ProxyQueue, DataHub.
- **UI**: index.html, DetailShot.html, HealthDebug.html (GridStack.js, FontAwesome).
- **Features**: Data tables, detail cards, Drive sync, automation, debug dashboard.

---

## 2. Field Types (`Fields.type`)
| Type | Renderer/Behavior | Notes |
|------|-------------------|-------|
| text | Single/multi-line text | |
| select | Dropdown (Fields.options[]) | e.g., Priority: High,Med,Low |
| number | Numeric input | |
| date | Date picker (YYYY-MM-DD) | |
| checkbox | TRUE/FALSE | |
| url | Clickable link | |
| thumbnails | Grid preview of folder files | Upload planned |
| file_list | Table of entity folder files | Sort/filter by size/date |
| versions | Latest file in subfolder | |
| link_shot | Foreign key -> Shots.shot_id | LinkMaps.js resolved |
| link_asset | Foreign key -> Assets.asset_id | |
| link_task | Foreign key -> Tasks.task_id | |
| link_member | Foreign key -> ProjectMembers.member_id | |
| link_user | Foreign key -> Users.user_id | |

---

## 4. Sheet Structure
### 4.1 Shots
- **Columns**: 17 (fi_0001=Shot ID, fi_0002=ShotCode, fi_0501=Priority, etc.).
- **Rows**: ~12,792.
- **Sample**: `sh_0288, 501K, K, SC01,, Act05`.
- **Automation**: AUTOMATION.js for ID assignment, ShotCode recalc (Episode_Act_Sequence_Scene_Shot).

### 4.2 Assets
- **Columns**: 12 (fi_0015=Asset ID, fi_0016=AssetName, fi_0017=Type, etc.).
- **Rows**: ~998.
- **Sample**: `as_0012, Sword10, Props, review, FALSE, assets/as_0012`.

### 4.3 ProxyQueue
- **Columns**: 17 (job_id, entity, id, original_file_id, shotCode, fps, frames, status, etc.).
- **Rows**: ~1+ (dynamic).
- **Sample**: `job_id=tcRx7a5..., entity=shot, id=sh_0002, status=queued`.

---

## 6. Debug Platform
- **File**: DebugPlatform.js, HealthDebug.html.
- **Purpose**: Monitors health of all files/functions.
- **Checks**:
  - **Code.js**: `doGet` (routing), `sv_getDataTable` (data fetch).
  - **DebugPanelApi.js**: `dp_debugPing`, `dp_traceOriginals`.
  - **DriveBuilder.js**: `getOrCreateProjectRoots`, `syncEntityFoldersSafe`.
- **Output**: Table (File|Process|Status|Added|Details). Text copy for AI diagnosis.

---

## 7. Backend Functions
### 7.1 Code.js
- **doGet(e)**: Routes page/entity/id to templates (e.g., page=healthdebug -> HealthDebug.html).
- **listRows(sheetName)**: Fetches DataHub or sheet data (12,792 rows max).
- **getEntity()**: Maps row to object for detail pages.

### 7.2 DriveBuilder.js
- **getOrCreateProjectRoots()**: Creates `MOTK/{project}-ORIGINALS`, `MOTK/{project}-PROXIES`.
- **syncEntityFoldersSafe()**: Syncs folders (e.g., `01shots/sh_0001__501K`).

### 7.3 AUTOMATION.js
- **onEdit(e)**: Auto-assigns IDs, recalcs ShotCode.
- **recalcCodes()**: Generates ShotCode (e.g., Episode_Act_Sequence_Scene_Shot).

---

## 8. File Operations
- **Planned**: Upload button in Detail pages to `MOTK/{project}/Shots/{shotId}/`.
- **Status**: ProxyQueue manages job queue, but upload logic TBD.

---

## 9. ProxyQueue Processing
- **Purpose**: Manages proxy file generation (e.g., video transcoding).
- **Logic**: Reads ProxyQueue sheet, processes jobs (status=queued -> processing -> done).
- **Integration**: Links to DriveBuilder.js for folder access.

---

## 11. FAQ
- **Core_values update**: Auto-triggered on `Core=TRUE` via AUTOMATION.js.
- **DataHub scaling**: Lazy load planned for 12,792+ rows (hubGetSlice TBD).
- **Debug usage**: Copy HealthDebug text, paste to AI for diagnosis.

---