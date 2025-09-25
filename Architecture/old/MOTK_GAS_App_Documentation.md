
# MOTK Sheets GAS App – Technical Documentation
*(generated 2025-08-06 23:18 UTC)*

## Table of Contents
1. [Overview](#overview)
2. [Backend (Google Apps Script)](#backend-google-apps-script)
3. [Template & Navigation System](#template--navigation-system)
4. [Front‑End Core Styles & Layout](#front-end-core-styles--layout)
5. [Viewer Module](#viewer-module)
6. [Detail Pages](#detail-pages)
7. [DataHub Integration Path](#datahub-integration-path)
8. [Feature Matrix](#feature-matrix)
9. [Deployment Workflow](#deployment-workflow)

---

## Overview
The application is a Google Apps Script web‑app that serves entity tables (Shots, Assets, Tasks, Members, Users) and their detail pages.  
It uses a **template‑include chain** plus a **central router (`doGet`)**. Front‑end logic in *viewer.html* handles table rendering and interactivity.

---

## Backend (Google Apps Script)

### Routing flow
* **`doGet(e)`** in *Code.js* inspects `entity`, `id`, `page` and decides between detail vs. index pages.  
* A `TEMPLATE_CONTEXT` object is filled and passed down to templates.

### Template include helper
* `include(filename)` clones the template, spreads `TEMPLATE_CONTEXT`, evaluates, returns HTML.

### Entity mapping
* `ENTITY_CONF` links entity → sheet → primary‑key → detail UI.  
* Sheet names live in the `SHEET` enum.

### Data retrieval
* **`listRows(sheetName)`** first looks for a **DataHub column** and splits `|` pipes into rows; falls back to per‑sheet reading.  
* **`getEntity()`** maps a single row into an object for detail pages.

---

## Template & Navigation System

* **index.html** includes CoreStyles, gNav, pNav, Scripts, then viewer.  
* `BarGnavi` and `BarPnavi` build top navigation; links are runtime‑patched by `fixNav()` in *Scripts.html*.  
* Template variables: `page`, `entity`, `scriptUrl`, `dataJson`.

---

## Front‑End Core Styles & Layout
* CSS variables (`--header-height`, `--pnav-height`, `--total-header-height`) drive fixed nav layout.  
* `.floating-header-wrapper` clones table header, enabling resize & drag.

---

## Viewer Module

1. `initializeTableState()` populates `STATE`.  
2. `renderTableView()` builds toolbar, table, status bar.  
3. `renderCurrentPage()` slices rows per page.  
4. `renderTable()` creates `<table>`, hides ID column, clones header and wires resize/drag.

---

## Detail Pages
* `DetailShot.html` + GridStack for widget layouts.  
* `Scripts.html` adds path menu, layout selector, prev/next navigation.

---

## DataHub Integration Path

| Stage | Current | Needed |
|-------|---------|--------|
| Header | `listRows()` returns first 300 rows | Separate `hubGetHeader` |
| Lazy slices | None | `hubGetSlice` + append |
| Core cache | Preload 300 rows | Preload 1000 rows |

---

## Feature Matrix

| Area | Feature |
|------|---------|
| Navigation | Deployment‑safe links (`fixNav`) |
| Table | Pagination, floating header, column resize & reorder |
| Cells | Drive thumbnail previews |
| Detail | Grid layouts, layout presets |
| Backend | DataHub fallback, entity routing |

---

## Deployment Workflow

```bash
git add .
git commit -m "feat: DataHub slice API"
git push origin DataHub
clasp push -f
clasp deploy -V "DataHub slice v1"
```

---

