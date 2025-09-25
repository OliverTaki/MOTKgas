# MOTK Technical Stack (v2025-09-12 – rev-14)

*Defines the technical stack for MOTK Sheets/App. Complements MOTK_architecture.md (rev-15) and MOTK_elements.md (rev-12). Focuses on technologies, libraries, and integrations for data management, UI, file operations, and debugging. Updated for proxy naming `{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]`, `MOTK_ORIGINALS` file integrity, inline editing, and AUTOMATION.gs for non-editable fields.*

## Table of Contents
1. [Overview](#overview)
2. [Backend](#backend)
3. [Frontend](#frontend)
4. [File Management](#file-management)
5. [Debugging](#debugging)
6. [Dependencies](#dependencies)
7. [Performance Considerations](#performance-considerations)
8. [Future Considerations](#future-considerations)

## 1. Overview
MOTK is built on Google Apps Script (GAS) for backend logic, Google Spreadsheets for data storage, and Google Drive for file management, with HTML/CSS/JavaScript for the frontend. The stack supports real-time collaboration, scalable data handling (12,792+ Shots rows), and intuitive UI for creative production workflows (VFX, animation).

- **Core Technologies**:
  - Google Apps Script (GAS): Server-side logic, automation, and API integration.
  - Google Spreadsheets: Data storage for Shots, Assets, Tasks, ProjectMembers, Users, Pages, Fields, project_meta, ProxyQueue, DataHub.
  - Google Drive: File storage for `MOTK_ORIGINALS` and `MOTK_PROXIES`.
  - HTML/CSS/JavaScript: Client-side UI with GridStack for grid layouts.
- **Scale**: Handles 12,792 Shots rows, 998 Assets/Tasks rows, 60fps for 100+ grid cards.
- **Collaboration**: Async multi-user editing and file uploads.

## 2. Backend
- **Google Apps Script (GAS)**:
  - **Code.gs**: Handles routing, data access, link mapping (`entity_link` to `entity_name`), and project navigation (PNAVI). Merges `LinkMaps.gs` and `PagesConfig.gs`.
  - **DriveBuilder.gs**: Manages Google Drive folder creation (`MOTK[Project:Oliver06]`, `MOTK_ORIGINALS`, `MOTK_PROXIES`) and spreadsheet relocation on first deploy. Ensures `MOTK_ORIGINALS` files remain unchanged, with no subfolders.
  - **AUTOMATION.gs**: Generates IDs (e.g., `sh_0001`, `pm_0001`), ShotCodes (`Episode_Act_Sequence_Scene_Shot`), and non-editable fields (`id`, `entity_name`, `originals`). Updates `Core_values` for `Core=TRUE` fields.
  - **FieldsServer.gs**: Manages server-side Fields logic, including `Core_values` updates and `select` field option synchronization.
- **Data Storage**:
  - Google Spreadsheets: Stores structured data in sheets (Shots, Assets, Tasks, ProjectMembers, Users, Pages, Fields, project_meta, ProxyQueue, DataHub).
  - DataHub: Aggregates `Core=TRUE` fields with `|`-separated values for fast access.

## 3. Frontend
- **HTML/CSS/JavaScript**:
  - **overview.html**: Dashboard-style hub with recent activity, project switcher, and links to entity tables.
  - **DetailEntity.html**: Unified detail page for Shots, Assets, Tasks, ProjectMembers, Users. Supports:
    - Inline editing for `editable=TRUE` fields (`select`, `text`, `date`, `entity_link`) via pencil icon or direct click (type-dependent, TBD).
    - Grid view with GridStack for `thumbnails` (tag-filterable, e.g., "shooting", "art").
    - Table view with sortable columns and inline editing.
    - `entity_link` searchable window with checkboxes and partial-match search (e.g., "201A").
    - `versions` dropdown for history (e.g., `v001`, `v002`) in `MOTK_PROXIES`.
  - **BarNav.html**: Combines global (GNAVI) and project (PNAVI) navigation, includes shared JavaScript utilities.
  - **CSS**: Responsive design, mobile-friendly, high-contrast for accessibility.
- **Libraries**:
  - **GridStack.js**: Dynamic grid layout for `thumbnails` in DetailEntity.html, targeting 60fps for 100+ cards.
  - **jQuery**: DOM manipulation and event handling for UI interactions.
  - **Google Apps Script HTML Service**: Renders HTML templates with GAS backend integration.

## 4. File Management
- **Google Drive API**:
  - **Structure**:
    - `MOTK[Project:Oliver06]/MOTK_ORIGINALS/{entity}/{id}__{code}/{field_name}/v001`  
      (e.g., `01shots/sh_0001__501A/shotview/v001`). Originals unchanged once uploaded.
    - `MOTK[Project:Oliver06]/MOTK_PROXIES/{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]`  
      (e.g., `sh_0001_20250815-041700_fi_0013_proxy.mp4`).
  - **Operations**:
    - `DriveBuilder.gs`: Creates folder structure and moves spreadsheet on first deploy.
    - `file_list`: Supports uploads to `MOTK_ORIGINALS`, tag-based filtering, no file name changes.
    - `versions`: Originals stored in subfolders; corresponding proxy files generated and saved in `MOTK_PROXIES`, latest version displayed in UI.
  - **Proxy Generation**:
    - Client-side JS in `DetailEntity.html` generates low-res proxies (MP4 for videos, JPEG/PNG for images).
    - GAS uploads proxies to `MOTK_PROXIES` with naming `{shot_id}_{YYYYMMDD-HHMMSS}_{field_id}_proxy[.ext]`.


## 5. Debugging
- **DebugPlatform.gs**: Centralized debug APIs, merges `DebugPanelApi.gs`. Supports checks for routing, data fetch, folder creation, ID assignment, and proxy uploads.
- **HealthDebug.html**: Debug dashboard displaying table (File|Process|Status|Added|Details). Extensible via `registerDebugChecks()`.
- **Output**: Text-based logs for AI diagnosis, accessible to developers.

## 6. Dependencies
- **Google Services**:
  - Google Apps Script (v1.0)
  - Google Spreadsheets API (v4)
  - Google Drive API (v3)
- **External Libraries**:
  - GridStack.js (v10.1.2): Grid layout for `thumbnails`.
  - jQuery (v3.6.0): DOM manipulation and events.
- **Browser Compatibility**:
  - Chrome, Firefox, Safari, Edge (latest versions).
  - Mobile support for iOS/Android browsers.

## 7. Performance Considerations
- **Data Access**: Current `listRows` fetches all 12,792 Shots rows, causing delays. Planned `hubGetSlice(entity, offset, limit)` for lazy loading (1000 rows/batch).
- **UI Rendering**: GridStack targets 60fps for 100+ grid cards. Inline editing optimized for minimal DOM updates.
- **File Operations**: Async uploads to `MOTK_PROXIES` with `job_id` (UUID) for conflict-free multi-user processing.
- **Optimization**: Table page performance to be finalized later, no specific optimization methods prescribed.

## 8. Future Considerations
- **Box Integration**: Support for Box storage via `project_meta.storage_provider`.
- **Schedule Page**: Calendar/Gantt view using Tasks sheet (`start_date`, `end_date`).
- **Chat/Forum Pages**: Comments/Threads sheet, Google-based integration.
- **Enhanced Debugging**: Additional checks for large-scale datasets and multi-user scenarios.