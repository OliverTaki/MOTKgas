MOTK Architecture

# MOTK Type Reference (v2025‑07‑16 – rev‑3)

> _Canonical enumerations used across MOTK Sheets._\
> \*If a field or page type isn’t listed here, it is treated as free‑form \***_text_**.

---

## 1  Field Types (`Fields.type`)

ID Renderer / Behaviour

text Single‑line or multi‑line plain text

select Dropdown; options defined in Fields.options[]

number Numeric input (integer or float)

date Date picker (YYYY‑MM‑DD)

checkbox TRUE / FALSE

url Clickable link (shows as label|url or raw URL)

thumbnails Grid preview of files in the folder; supports upload      

file_list Table list of files in the entity folder; size/date sort + filter  

versions Shows latest file inside field‑named sub‑folder     

link_shot Foreign key -> Shots.shot_id

link_asset Foreign key -> Assets.asset_id

link_task Foreign key -> Tasks.task_id

link_member Foreign key -> ProjectMembers.member_id

link_user Foreign key -> Users.user_id

---

## 2  Page Types (`Pages.pageType`)

| ID              | Target UI Component      | Typical `entity` value    |
| --------------- | ------------------------ | ------------------------- |
| `table`         | DataGrid view            | `shot` / `asset` / `task` |
| `overview`      | Recent uploads dashboard | –                         |
| `shot_detail`   | Single‑shot detail page  | –                         |
| `asset_detail`  | Single‑asset detail page | –                         |
| `task_detail`   | Task progress breakdown  | –                         |
| `schedule`      | Calendar / Gantt         | –                         |
| `chat`          | Threaded comments        | –                         |
| `forum`         | forum                    | –                         |
| `member_detail` | Crew member dossier      | –                         |

---

## 3  ProjectMember **Departments** (`ProjectMembers.department`)

_(Empty → "freelance / misc")_

```
ANIMATION
PRODUCTION
CAMERA
EDIT
PUPPET
ART
CG
LIGHTING
MUSIC
DIRECTION
CAST
STUDIO
ABOVE‑THE‑LINE
```

---

## 4  UI Traits per Field Type (upload / filter / sort)

Field Type Upload UI Filterable Sortable

text — ✓ ✓

select — ✓ ✓

number — ✓ ✓

date — ✓ ✓

checkbox — ✓ ✓

url — ✓ ✓

thumbnails ✓ ✓ ✓

file_list ✓ ✓ ✓

versions ✓ (adds version) ✖ ✖

# MOTK Storage & File‑Handling Specification (v2025‑07‑16)

## 1. Global Folder Layout

```
MOTK_<PROJECT>/
├─ <PROJECT>-ORIGINALS/   # immutable, high‑res sources
│   ├─ shots/             # auto‑generated per Shot ID
│   │   └─ shotview/      #   "        per Shot ID
│   ├─ assets/            #   "        per Asset ID
│   │   └─ assetview/     #   "        per Asset ID
│   ├─ tasks/             #   "        per Task ID (opt.)
│   ├─ misc/              #   other entity roots (opt.)
│   └─ deleted/           #   archive bucket for removed entities
└─ <PROJECT>-PROXIES/     # lightweight 1080p / 1 Mbps review media
    (flat storage – files live directly here)
```

- **Root provider per project** – user chooses **Google Drive** or **Box** at project creation.
- `originals_root_url` and `proxies_root_url` stored in `project_meta` sheet.

---

## 2. Originals Handling

| Action                                         | Behaviour                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| **Create entity (Shot/Asset/…)**               | ❶ FE writes row → ❷ API creates `<entity>/<id>/` under ORIGINALS (skip if exists) |
| **Delete entity**                              | ❶ `info.txt` generated inside target folder                                       |
| ❷ Folder moved into `deleted/` root            |                                                                                   |
| ❸ Name clash ⇒ `_01`, `_02`, … suffix appended |                                                                                   |
| **info.txt contents**                          | \`\`\`json                                                                        |
| {                                              |                                                                                   |
| "deletedAt": "ISO8601",                        |                                                                                   |
| "deletedBy": "user\@mail",                     |                                                                                   |
| "originalPath": "Shots/Sh01",                  |                                                                                   |
| "fields": { \<all columns & values> }          |                                                                                   |
| }                                              |                                                                                   |

```|
| **Restore** | Manual drag back to `Shots/` or `assets/` etc.; FE updates relative path if needed |

*Original filenames remain **unchanged** for absolute fidelity.*

---
## 3. Proxies Handling
* Stored flat in `<PROJECT>-PROXIES/` for rapid Drive index & preview.
* Naming rule: `<id>[_take][_vNN]_proxy.<ext>` (e.g. `sh001_take01_proxy.mp4`).
* Encode guideline: `ffmpeg -i src -vf scale=-2:1080 -b:v 1M out.mp4` (≈ 1 Mbps H.264).
* DataGrid holds only `proxy_rel` (file name). URL = `proxies_root_url + '/' + proxy_rel`.

---
## 4. project_meta Sheet
| Column | Example | Purpose |
|--------|---------|---------|
| `project_id` | `prj_ab12` | short‑ID prefix system |
| `storage_provider` | `gdrive` or `box` | originals side |
| `originals_root_url` | `https://box.com/folder/…` | top of ORIGINALS tree |
| `proxies_root_url` | `https://drive.google.com/…` | top of PROXIES tree |

---
## 5. FE Behaviour Snapshot
1. **Row added →** optimistic update → `createEntityFolder()` async.
2. **Row deleted →** `uploadInfoTxt()` → `moveToDeleted()` async.
3. **Open Originals** icon builds URL: `originals_root_url + '/' + entity + '/' + id` and `window.open()`.
4. **Preview** uses `proxy_rel` + `proxies_root_url`.

---
## 6. Outstanding TODO (Future)
* Auto‑proxy generation & Drive upload worker (ffmpeg.wasm).
* Box↔Drive hybrid support (per‑subtree rooting).
* Soft‑delete toggle view in DataGrid.

```

# MOTK Editing Specification (v2025‑07‑16)

_This file isolates everything related to \***\*front‑end cell editing, conflict detection, and data synchronisation\*\***. Storage & sheet‑initialisation specs live in a separate document._

---

## 1. Terminology

| Term                  | Meaning                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Row**               | A record in Shots / Assets / Tasks etc. (uniquely keyed by `shot_id`, `asset_id`, …) |
| **Field**             | Column definition listed in `Fields` sheet.                                          |
| **originalValue**     | Cell value when the user began editing.                                              |
| **currentValue**      | Latest value in Google Sheets at the moment of save attempt.                         |
| **optimistic update** | FE assumes write will succeed and updates UI immediately.                            |
| **409 Conflict**      | API response when `originalValue ≠ currentValue`.                                    |

---

## 2. Client‑Side Flow

```
User starts editing        (DataGrid cell enters edit‑mode)
       ↓ (onEditStart) store originalValue in ref
User confirms change
       ↓ processRowUpdate(newRow)  // optimistic UI change
       ↓ call updateCell({shotId,fieldId,originalValue,newValue})
```

- `processRowUpdate` always returns the optimistic `newRow` to MUI.
- Local state (`rows`) is updated before network round‑trip.

### 2.1 Conflict Dialog

If REST returns **409**, FE shows modal with three buttons:

- **Overwrite** – resends request with `force=true` (skips value check).
- **Edit again** – re‑opens cell editor, pre‑filled with `currentValue`.
- **Keep server value** – rolls back cell to `currentValue` (no further writes). Labels are English‑only per UX guideline.

---

## 3. Server‑Side (updateCell) Logic

```ts
function updateCell({ shotId, fieldId, originalValue, newValue, force }) {
  // 1. locate row & column via MATCH(shotId) / header find(fieldId)
  const currentValue = getCellA1(rowIdx, colIdx);

  if (!force && currentValue !== originalValue) {
    return 409; // Conflict: send currentValue back
  }

  setCell(rowIdx, colIdx, newValue);
  return 200; // success
}
```

_One read + one write keeps API quota low._

---

## 4. Error Handling Table

| Scenario            | API Code                                             | FE Reaction |
| ------------------- | ---------------------------------------------------- | ----------- |
| Network error / 5xx | retry (exponential up to 3) then Toast "Save failed" |             |
| 401 / expired token | redirect to /login with toast                        |             |
| 409 Conflict        | show dialog (see §2.1)                               |             |

---

## 5. Performance Notes

- No automatic `refetch()` after save → UI stays light.
- Manual reload button calls `useSheetsData.refetch()` when user explicitly wants fresh data.
- DataGrid configured with `rowBuffer={10}` and virtualisation enabled.

---

## 6. Hooks & Components

- **useSheetsData()** – fetch + cache rows; exposes `refetch()`.
- **ShotTable.tsx** – wraps MUI DataGrid with `processRowUpdate` & dialog.
- **ConflictDialog.tsx** – pure presentational; receives `{serverValue, myValue, onAction}` props.

---

## 7. Future Enhancements (out of scope for MVP)

1. **Real‑time WebSocket push** to update stale cells automatically.
2. **Field‑level locking** to avoid conflicts instead of resolving after the fact.
3. **Batch edits** – group multiple cell writes into single `batchUpdate()`.

---

_End of Editing Specification._

# MOTK Template‑Generation Specification (v2025‑07‑16 – rev‑3)

_Defines exactly what **initSheets()** must create when a new project is started. All sheet names, column order, data types, required sample rows and cross‑references are fixed here._

---

## 0  Tabs to Generate (MVP)

|  Order | Sheet Name          | Purpose                                   |
| ------ | ------------------- | ----------------------------------------- |
|  ①     | **Shots**           | Per‑shot production data                  |
|  ②     | **Assets**          | Characters / Puppets / Props              |
|  ③     | **Tasks**           | Task breakdown & scheduling               |
|  ④     | **ProjectMembers**  | Crew assignment (links Google User)       |
|  ⑤     | **Users**           | Google accounts & permissions             |
|  ⑥     | **Pages**           | Saved page configurations                 |
|  ⑦     | **Fields**          | Column metadata (entity‑agnostic)         |
|  ⑧     | **project_meta**    | Project‑level config (storage roots etc.) |
|  ⑨     | **Logs** (optional) | Append‑only change history                |

---

## 1  Column Schemas & Sample Rows

(All columns are listed in final form—no change‑deltas or placeholders.)

### 1.1  `Shots` (Tab ①)

|  Col | Column ID      | Type       |  Req. | Sample Value        | Notes                        |
| ---- | -------------- | ---------- | ----- | ------------------- | ---------------------------- |
|  A   | `shot_id`      | id         | ✔    | `sh_demo_01`        | prefix `sh_`                 |
|  B   | `shot_name`    | text       | ✔    | `101A`              |                              |
|  C   | `scene`        | text       | ✖    | `SC01`              |                              |
|  D   | `episode`      | text       | ✖    | `EP01`              |                              |
|  E   | `status`       | select     | ✔    | `Todo`              | options in Fields            |
|  F   | `priority`     | number     | ✖    | `2`                 | 1‑3                          |
|  G   | `due_date`     | date       | ✖    | `2025‑08‑31`        |                              |
|  H   | `timecode_fps` | text       | ✖    | `00:00:12:00@24`    | `HH:MM:SS:FF@fps`            |
|  I   | `folder_label` | text       | ✖    | `ORIG Sh01`         | display label                |
|  J   | `folder_url`   | url        | ✖    | auto                | link to ORIGINALS/Shots/<id> |
|  K   | `thumbnails`   | thumbnails | ✖    | —                   | grid view                    |
|  L   | `file_list`    | file_list  | ✖    | —                   | table view                   |
|  M   | `versions`     | versions   | ✔    | link to `ShotView/` | shows latest only            |
|  N   | `notes`        | text       | ✖    | `sample row`        |                              |

### 1.2  `Assets` (Tab ②)

|  Col | Column ID           | Type       |  Req. | Sample Value         | Notes        |
| ---- | ------------------- | ---------- | ----- | -------------------- | ------------ |
|  A   | `asset_id`          | id         | ✔    | `as_demo_01`         | prefix `as_` |
|  B   | `name`              | text       | ✔    | `Hero Puppet`        |              |
|  C   | `asset_type`        | select     | ✔    | `puppet`             |              |
|  D   | `status`            | select     | ✖    | `Build`              |              |
|  E   | `overlap_sensitive` | checkbox   | ✖    | `TRUE`               |              |
|  F   | `folder_label`      | text       | ✖    | `ORIG As01`          |              |
|  G   | `folder_url`        | url        | ✖    | auto                 |              |
|  H   | `thumbnails`        | thumbnails | ✖    | —                    |              |
|  I   | `file_list`         | file_list  | ✖    | —                    |              |
|  J   | `versions`          | versions   | ✔    | link to `AssetView/` |              |
|  K   | `notes`             | text       | ✖    | `sample asset`       |              |

### 1.3  `Tasks` (Tab ③)

|  Col | Column ID      | Type        |  Req. | Sample Value  | Notes        |
| ---- | -------------- | ----------- | ----- | ------------- | ------------ |
|  A   | `task_id`      | id          | ✔    | `tk_demo_01`  | prefix `tk_` |
|  B   | `name`         | text        | ✔    | `Layout pass` |              |
|  C   | `status`       | select      | ✔    | `Todo`        |              |
|  D   | `assignee_id`  | link_member | ✖    | `pm_demo_01`  |              |
|  E   | `start_date`   | date        | ✖    | `2025‑08‑15`  |              |
|  F   | `end_date`     | date        | ✖    | `2025‑08‑20`  |              |
|  G   | `shot_id`      | link_shot   | ✖    | `sh_demo_01`  |              |
|  H   | `folder_label` | text        | ✖    | `ORIG Tk01`   |              |
|  I   | `folder_url`   | url         | ✖    | auto          |              |
|  J   | `notes`        | text        | ✖    |               |              |

### 1.4  `ProjectMembers` (Tab ④)

|  Col | Column ID    | Type      |  Req. | Sample Value | Notes             |
| ---- | ------------ | --------- | ----- | ------------ | ----------------- |
|  A   | `member_id`  | id        | ✔    | `pm_demo_01` | prefix `pm_`      |
|  B   | `user_id`    | link_user | ✖    | `u_demo_01`  |                   |
|  C   | `role`       | text      | ✖    | `Animator`   | free text         |
|  D   | `department` | select    | ✖    | `ANIMATION`  | options in Fields |
|  E   | `notes`      | text      | ✖    |              |                   |

### 1.5  `Users` (Tab ⑤)

|  Col | Column ID      | Type   | Req. | Sample Value       | Notes          |
| ---- | -------------- | ------ | ---- | ------------------ | -------------- |
|  A   | `user_id`      | id     | ✔   | `u_demo_01`        | prefix `u_`    |
|  B   | `email`        | text   | ✔   | `john@example.com` | Google account |
|  C   | `display_name` | text   | ✖   | `John Smith`       |                |
|  D   | `permission`   | select | ✖   | `edit`             | enum in Fields |

### 1.6  `Pages` (Tab ⑥)

|  Col | Column ID         | Type      |  Req. | Sample Value                        | Notes                                  |
| ---- | ----------------- | --------- | ----- | ----------------------------------- | -------------------------------------- |
|  A   | `page_id`         | id        | ✔    | `pg_default`                        |                                        |
|  B   | `name`            | text      | ✔    | `All Shots`                         |                                        |
|  C   | `pageType`        | select    | ✔    | `table`                             | table / overview / detail / schedule … |
|  D   | `entity`          | select    | ✖    | `shot`                              | which table for table‑pages            |
|  E   | `fieldWidths`     | json      | ✖    | `[120,80,…]`                        |                                        |
|  F   | `fieldOrder`      | json      | ✖    | `["title","status",…]`              |                                        |
|  G   | `visibleFieldIds` | json      | ✖    | `["title","status"]`                |                                        |
|  H   | `filter`          | json      | ✖    | `{…}`                               | table filter model                     |
|  I   | `sort`            | json      | ✖    | `[{"field":"episode","dir":"asc"}]` |                                        |
|  J   | `shared`          | checkbox  | ✔    | `TRUE`                              | shared vs personal                     |
|  K   | `author_user_id`  | link_user | ✔    | `u_demo_01`                         |                                        |
|  L   | `notes`           | text      | ✖    |                                     |                                        |

### 1.7  `Fields` (Tab ⑦) – (excerpt)

| Column ID    | Purpose                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `field_id`   | primary key                                                                        |
| `entity`     | shot / asset / task / page / member                                                |
| `field_name` | UI label                                                                           |
| `type`       | text / select / number / date / checkbox / url / thumbnails / file_list / versions |
| `editable`   | TRUE/FALSE                                                                         |
| `required`   | TRUE/FALSE                                                                         |
| `options`    | enum list for select/department etc.                                               |

(`Fields` full seed data lives in separate **Type Reference** document.)

### 1.8  `project_meta` (Tab ⑧)

| Key                  | Value Sample                 | Notes             |
| -------------------- | ---------------------------- | ----------------- |
| `originals_root_url` | `https://box.com/folder/ABC` | orig storage root |
| `proxies_root_url`   | `https://drive.google.com/…` | proxies root      |
| `storage_provider`   | `box` / `gdrive`             |                   |
| `createdAt`          | `2025‑07‑16T10:00:00Z`       |                   |

### 1.9  `Logs` (Tab ⑨) – optional

| Col | ID          | Type     | Notes    |
| --- | ----------- | -------- | -------- |
| A   | `log_id`    | id       | uuid     |
| B   | `timestamp` | datetime | ISO‑8601 |
