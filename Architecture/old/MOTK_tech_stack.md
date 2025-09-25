# MOTK Technical Stack (v2025-09-11)

## Table of Contents
1. [Libraries](#libraries)
2. [GAS Functions](#gas-functions)
3. [APIs](#apis)
4. [Performance Considerations](#performance-considerations)

## 1. Libraries
- **GridStack.js**: Dynamic card layouts in Detail pages (shot_detail, etc.).
- **FontAwesome**: Icons for navigation and UI elements.
- **Google Apps Script HTMLService**: Renders HTML templates (index.html, DetailShot.html).
- **Trusted Types**: Secure script loading in Detail pages.

## 2. GAS Functions
- **Code.js**:
  - `doGet(e)`: Routes page/entity/id to templates.
  - `listRows(sheetName)`: Fetches DataHub or sheet data.
- **DriveBuilder.js**:
  - `getOrCreateProjectRoots()`: Creates Drive folders.
  - `syncEntityFoldersSafe()`: Syncs entity folders.
- **AUTOMATION.js**:
  - `onEdit(e)`: Auto-assigns IDs, recalcs ShotCode.
  - `recalcCodes()`: Generates ShotCode (Episode_Act_Sequence_Scene_Shot).

## 3. APIs
- **google.script.run**: Client-server communication (e.g., sv_getLinkMaps).
- **DriveApp**: File/folder operations.
- **SpreadsheetApp**: Sheet data access.

## 4. Performance Considerations
- **DataHub**: 12,792 rows (Shots)対応。lazy load (hubGetSlice)計画中。
- **GAS Limits**: 6min execution, 6MB memory. Heavy tasks (e.g., proxy generation) to Cloud Functions.
- **UI**: 60fps target for GridStack with 100+ cards.