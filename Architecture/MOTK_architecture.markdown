# MOTK Architecture (v2025-09-12 – rev-15)

*Canonical architecture for MOTK Sheets/App. Integrates specs from detail_page_specification_20250801.md, GStabs.md, and MOTK_GAS_App_Documentation.md. Focuses on vision, structure, functionality, and user experience with clear, text-based maps. Technical details in MOTK_tech_stack.md, element tables in MOTK_elements.md. Updated for `member` entity, `ProjectMembers` tab, `project_meta` without `field_id`, proxy naming with `{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]`, `MOTK_ORIGINALS` file integrity, and inline editing.*

## Table of Contents
1. [Vision](#vision)
2. [System Overview](#system-overview)
3. [Site Map](#site-map)
4. [Drive Map](#drive-map)
5. [Sheet Structure](#sheet-structure)
6. [DataHub Integration](#datahub-integration)
7. [Detail Pages](#detail-pages)
8. [Page Experience and Usage](#page-experience-and-usage)
9. [Debug Platform](#debug-platform)
10. [ProxyQueue Processing](#proxyqueue-processing)
11. [Automation](#automation)
12. [File Operations](#file-operations)
13. [Future Features](#future-features)
14. [FAQ](#faq)

## 1. Vision
MOTK is a collaborative platform for creative production (VFX, animation), integrating Google Spreadsheets and Drive (Box support planned) for data and file management.

- **Purpose**: Enable 10-50+ team members to track shots, assets, tasks, and members with intuitive UI, automation, and debugging. Support multi-location, bottleneck-free workflows.
- **Key Features**:
  - **Data Lists**: Filterable/sortable tables for Shots (12,792 rows), Assets (998 rows), Tasks, etc., with inline editing.
  - **Detail Pages**: Grid/table views with hierarchy navigation, Drive folder links, and inline editing.
  - **File Management**: Originals/proxies in Drive, multi-user uploads, automated folder sync, `MOTK_ORIGINALS` files unchanged.
  - **Automation**: Auto ID assignment, ShotCode generation, real-time sheet updates via `AUTOMATION.gs`.
  - **Debugging**: Health dashboard ("All OK = App Healthy").
  - **Cross-Project Dashboard**: User-specific overview of all projects.
- **User Experience**:
  - Real-time collaboration across locations.
  - Scalable to 12,792+ rows.
  - Simple URLs (e.g., `?d=shot&id=sh_0001&v=g`).
  - Drive folder access via links/popups.
- **Target Users**: Animators, editors, producers.

## 2. System Overview
- **Data**: Spreadsheets (Shots, Assets, Tasks, ProjectMembers, Users, Pages, Fields, project_meta, ProxyQueue, DataHub).
- **Files**: `MOTK[Project:Oliver06]/MOTK_ORIGINALS`, `MOTK_PROXIES`.
- **UI**: HTML templates (overview.html, DetailEntity.html, HealthDebug.html).
- **Backend**: GAS scripts (Code.gs, DriveBuilder.gs, AUTOMATION.gs, FieldsServer.gs).
- **Scale**: 12,792 Shots rows, 998 Assets/Tasks rows, 60fps for 100+ grid cards.
- **Collaboration**: Async multi-user editing/uploads.

## 3. Site Map
Page navigation:
- Cross-Project Dashboard (?p=dashboard)
  - Overview (?p=overview)
    - Table (?p=table&e={shot|asset|task|member|user})
    - DetailEntity.html (?d={shot|asset|task|member|user}&id={id}&v={g|table})
    - HealthDebug.html (?p=healthdebug)
    - Schedule (?p=schedule, planned)
    - Chat/Forum (?p={chat|forum}, planned)
- **Cross-Project Dashboard**: User-specific view of all projects (e.g., Project:Oliver06).
- **Overview**: Links to pages, recent updates (e.g., new Shots, uploads).
- **Navigation**:
  - **GNAVI**: Global nav (Dashboard, Overview, HealthDebug).
  - **PNAVI**: Project-specific buttons (Pages sheet).
- **URL**: Shortened (e.g., `?d=shot&id=sh_0001&v=g`).

## 4. Drive Map
Folder structure:
- MOTK[Project:Oliver06]
  - MOTK[Project:Oliver06] (Google Spreadsheet)
  - MOTK_ORIGINALS
    - 01shots
      - sh_0001__501A
      - sh_0288__501K
    - 02assets
      - as_0012__Sword10
    - 03tasks
      - tk_0017__Lighting
    - 04misc
    - 05deleted
  - MOTK_PROXIES
    - sh_0001_20250815-041700_fi_0013_proxy.mp4
    - as_0012_20250815-041700_fi_0023_proxy.png
    - tk_0017_20250815-041700_fi_0032_proxy.jpg
- **Project Root**: `MOTK[Project:Oliver06]`.
- **Spreadsheet**: `MOTK[Project:Oliver06]` (Google Spreadsheet) moved to project root on first deploy.
- **Originals**: `MOTK_ORIGINALS/{entity}/{id}__{code}` (e.g., `01shots/sh_0001__501A`). Files unchanged, no subfolders.
- **Proxies**: `MOTK_PROXIES/{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]` (e.g., `sh_0001_20250815-041700_fi_0013_proxy.mp4`).
- **Folder Creation**: On first deploy, `DriveBuilder.gs` creates `MOTK[Project:Oliver06]`, `MOTK_ORIGINALS`, `MOTK_PROXIES`, and moves spreadsheet.
- **Storage**: GDrive default, Box planned.

## 5. Sheet Structure
### 5.1 Entity Sheets
- **Format**:
  - Row 1: Field IDs (`fi_0001`, `fi_0002`, ...).
  - Row 2: Labels (`Shot ID`, `ShotCode`, ...).
  - Row 3+: Data rows.
- **Details**:
  - **Shots**: 17 cols (fi_0001=Shot ID, fi_0002=ShotCode, fi_0066=Due Date), ~12,792 rows. Sample: `sh_0001, 201A, A, SC01,, Act02,, not_started, 2025-08-01`.
  - **Assets**: 12 cols (fi_0015=Asset ID, fi_0016=Asset Name), ~998 rows. Sample: `as_0001, Body Geo, Characters, not_started`.
  - **Tasks**: 10 cols (fi_0025=Task ID, fi_0026=Task Name), ~998 rows. Sample: `tk_0001, Layout, in_progress`.
  - **ProjectMembers**: 10 cols (fi_0034=Member ID, fi_0035=Role), ~998 rows. Sample: `pm_0001, Lead Animator, ANIMATION`.
  - **Users**: 8 cols (fi_0044=User ID, fi_0045=User Name), ~998 rows. Sample: `us_0001, John Smith`.
  - **Pages**: 9 cols (fi_0052=Page ID, fi_0056=Config JSON), ~997 rows. Sample: `pg_default, Default, table, shot`.

### 5.2 Fields Sheet
- **Columns**: `field_id`, `entity`, `field_name`, `type`, `editable`, `required`, `options`, `Core`, `Core_values`.
- **Rows**: ~998.
- **Core Behavior**: `Core=TRUE` triggers auto-update of `Core_values` (e.g., `ShotCode|201A|301B|401C`).
- **Sample**: `fi_0001, shot, Shot ID, id, FALSE, TRUE,, TRUE, Shot ID`.

### 5.3 project_meta Sheet
- **Columns**: `project_id`, `storage_provider`, `originals_root_url`, `proxies_root_url`, `created_at`, `Episode`, `Act`, `Sequence`, `Scene`, `Shot`.
- **Sample**: `Project:Oliver06, gdrive, https://drive.google.com/drive/folders/..., https://drive.google.com/drive/folders/..., 2025-07-23T01:27:38.635Z, FALSE, TRUE, FALSE, TRUE, TRUE`.
- **Behavior**: Configures project settings, hides columns (e.g., `Episode`) if FALSE.

### 5.4 ProxyQueue Sheet
- **Columns**: 10 (job_id, entity, id, original_file_id, shotCode, fps, frames, status, created, modified).
- **Sample**: `job_id=tcRx7a5..., entity=shot, id=sh_0001, status=queued`.

### 5.5 DataHub Sheet
- **Columns**: `Shots`, `Assets`, `Tasks`, `ProjectMembers`, `Users`, `Pages`, `Fields`, `project_meta`.
- **Rows**: ~12,795.
- **Purpose**: Aggregates `Core=TRUE` fields with `|`-separated values for fast access.

## 6. DataHub Integration
- **Current**: `listRows` fetches all 12,792 Shots rows, causing delays.
- **Planned**: `hubGetSlice(entity, offset, limit)` for lazy loading (1000 rows/batch).
- **Cache**: Store folder IDs in `project_meta`.

## 7. Detail Pages
- **File**: DetailEntity.html (unifies Shots, Assets, Tasks, ProjectMembers, Users).
- **Status**: In development.
- **URL**: `?d={shot|asset|task|member|user}&id={id}&v={g|table}` (e.g., `?d=shot&id=sh_0001&v=g`).
- **UI**:
  - **Toolbar**: 
    - Entity name (e.g., `ShotCode: 201A`, `Role: Lead Animator`).
    - Prev/next buttons for sequential navigation within entity.
    - Hierarchy dropdown (e.g., Shots: Episode>Act>Sequence>Scene>Shot).
    - View toggle (Grid/Table).
  - **Grid View**: 
    - Cards with `field_name:value` pairs (e.g., `Status: not_started`, `Due Date: 2025-08-01`).
    - `thumbnails` as GridStack cards, tag-filterable (e.g., "shooting", "art").
    - `versions` shows latest (e.g., `v001`), clickable to view older versions.  
      - **Originals**: stored in subfolders within `MOTK_ORIGINALS` (e.g., `01shots/sh_0001__501A/shotview/v001`).  
      - **Proxies**: corresponding proxy files saved in `MOTK_PROXIES` using naming `{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]`.
  - **Table View**: 
    - Sortable table with all fields.
    - Inline editing for `editable=TRUE` fields (e.g., `select`, `text`, `date`, `entity_link`), via pencil icon or direct click (TBD, type-dependent).
    - Non-editable fields (e.g., `id`, `entity_name`, `originals`) grayed out, managed by `AUTOMATION.gs`.
  - **Folder Link**: 
    - Drive folder (e.g., `MOTK[Project:Oliver06]/MOTK_ORIGINALS/01shots/sh_0001__501A`) in popup.
    - `file_list` shows tagged files, supports uploads, no file name changes.
  - **Data Display**:
    - `entity_name` prioritized (e.g., `ShotCode` over `Shot ID`).
    - `Config` JSON from Pages sheet controls layout (e.g., hidden fields, column order).
    - `entity_link` fields open searchable window with checkboxes, partial-match search (e.g., "201A").
- **Navigation**:
  - GNAVI: Global nav (Dashboard, Overview, HealthDebug).
  - PNAVI: Project buttons (Pages sheet).
  - Quick links to related entities via `entity_link` (e.g., click `Asset Link` to view `as_0001`).
- **Behavior**:
  - Real-time updates via `Code.gs` for sheet-to-UI sync.
  - `entity_link` validated by `Code.gs` to prevent broken links.
  - `versions` managed across Originals and Proxies as described above.


## 8. Page Experience and Usage
- **Overview Page**:
  - **Purpose**: Centralized hub for project navigation and updates.
  - **UI**: 
    - Dashboard-style layout with recent activity (e.g., new Shots, uploads).
    - Quick links to entity tables (Shots, Assets, Tasks, ProjectMembers, Users).
    - Project switcher for multi-project users.
  - **Usage**: 
    - Producers check recent updates (e.g., `sh_0001` moved to `review`).
    - Animators access their Tasks table directly.
    - Clean, uncluttered design with bold entity links.
- **Table Pages**:
  - **Purpose**: Filter/sort large datasets (e.g., 12,792 Shots).
  - **UI**: 
    - Sortable columns (e.g., `Status`, `Due Date`).
    - Filters for `select` fields (e.g., `Status: in_progress`).
    - Inline editing for `editable=TRUE` fields (e.g., `select`, `text`, `date`, `entity_link`), via pencil icon or direct click (TBD, type-dependent).
  - **Usage**: 
    - Editors filter Shots by `Scene` or `Status`.
    - Quick export to CSV for reporting.
    - Responsive for mobile and desktop, optimized for speed (method TBD, finalized later).
- **Detail Pages**:
  - **Purpose**: Deep dive into single entity (e.g., `sh_0001`).
  - **UI**: 
    - Grid view for visual tasks (e.g., `thumbnails` for Shots/Assets).
    - Table view for data-heavy tasks (e.g., `ProjectMembers` roles).
    - Inline editing for `editable=TRUE` fields, via pencil icon or direct click (TBD, type-dependent).
    - Searchable `entity_link` window with checkboxes, partial-match search (e.g., "201A").
    - `versions` dropdown to view history (e.g., `v001`, `v002`) in `MOTK_PROXIES`.
  - **Usage**: 
    - Animators upload files to `file_list`, tag them (e.g., "art"), no file name changes.
    - Producers review `Status` and update `Due Date` inline.
    - Intuitive prev/next navigation for quick checks.
- **User Experience Goals**:
  - **Simplicity**: Minimal clicks to access data (e.g., 2 clicks to `sh_0001` details).
  - **Speed**: 60fps for grid cards, lazy-loaded tables for 12,792+ rows (optimization TBD).
  - **Collaboration**: Real-time updates across users, no refresh needed.
  - **Accessibility**: Clear labels, mobile-friendly, high-contrast UI.
  - **Editing**: Intuitive inline editing (pencil icon or direct click, type-dependent).

## 9. Debug Platform
- **Purpose**: Monitor health of all components.
- **UI**: HealthDebug.html (table: File|Process|Status|Added|Details).
- **Checks**:
  - Routing, data fetch, folder creation, ID assignment, proxy uploads.
- **Extensibility**: New checks via `registerDebugChecks()`.
- **Output**: Text for AI diagnosis.

## 10. ProxyQueue Processing
- **Purpose**: Generate proxies (videos: MP4, images: JPEG/PNG) locally, upload to `MOTK_PROXIES`.
- **Naming**: `{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]` (e.g., `sh_0001_20250815-041700_fi_0013_proxy.mp4`, `tk_0017_20250815-041700_fi_0032_proxy.jpg`).
- **Flow**:
  1. User selects file in DetailEntity.html.
  2. Client-side JS generates proxy (low-res video/image).
  3. GAS uploads to `MOTK_PROXIES`.
  4. ProxyQueue updates: `status=queued -> done`.
- **Multi-User**: Async processing, `job_id` (UUID) for conflict-free queuing.
- **Debug Checks**:
  - Job queue count (`status=queued`).
  - Upload test (`sh_0001`).

## 11. Automation
- **ID Assignment**: Auto-generates IDs (e.g., `sh_0001`, `pm_0001`) via `AUTOMATION.gs`.
- **ShotCode Generation**: Builds `Episode_Act_Sequence_Scene_Shot` via `AUTOMATION.gs`.
- **Fields Update**: `Core=TRUE` fields auto-update `Core_values` via `AUTOMATION.gs`.
- **Non-Editable Fields**: `id`, `entity_name`, `originals` managed by `AUTOMATION.gs`, no user edits.
- **Drive Sync**: Creates `MOTK[Project:Oliver06]`, `MOTK_ORIGINALS`, `MOTK_PROXIES` and moves spreadsheet on first deploy via `DriveBuilder.gs`.

## 12. File Operations
- **Originals**: `MOTK[Project:Oliver06]/MOTK_ORIGINALS/{entity}/{id}__{code}` (e.g., `01shots/sh_0001__501A`). Files unchanged, no subfolders.
- **Proxies**: `MOTK[Project:Oliver06]/MOTK_PROXIES/{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]`.
- **Links**: Folder links in DetailEntity.html (popup).
- **Box Support**: Planned via `project_meta.storage_provider`.

## 13. Future Features
- **Cross-Project Switching**: Manage multiple projects via `project_meta`.
- **Schedule Page**: Calendar/Gantt view (Tasks sheet: `start_date`, `end_date`).
- **Chat/Forum Pages**: Comments/Threads sheet, Google-based.
- **Box Integration**: Originals storage in Box.

## 14. FAQ
- **Core_values update**: Auto-triggered on `Core=TRUE` via `AUTOMATION.gs`.
- **DataHub scaling**: Lazy load for 12,792+ rows planned.
- **Debug usage**: Copy HealthDebug text for AI diagnosis.