# DataHub “Lazy + Cache” Architecture (GAS‑only)

> **Goal:** Display & edit up to **15 ×** the attached Shot CSV (≒ 15 k rows / entity) with smooth scrolling (< 3 s full‑scroll) **without React or external back‑end**—only Google Apps Script + HTMLService.

---

## 0. Sheet Layout

| Row   | Purpose                        | Example                                                                          |                       |
| ----- | ------------------------------ | -------------------------------------------------------------------------------- | --------------------- |
| **1** | **entity name** (e.g. `Shots`) | `Shots`                                                                          |                       |
| **2** | **`field_id`** ( \`            | \`‑concatenated )<br>➡ *If this cell is empty, the **entire column is ignored*** | `fi_0001\|fi_0002\|…` |
| **3** | `field_name` ( \`              | \`‑concatenated )                                                                | `ShotId\|ShotCode\|…` |
| 4‑∞   | real records ( \`              | \` delimited )                                                                   | `23\|SH_010\|01‑A\|…` |

*One column per entity.* Data rows start at **row 4**.

---

## 1. Back‑end — Apps Script

### 1.1 Core Principles

* **1 read / 1 write** per user action.
* **CacheService** (document scope) with sensible TTLs:

  * Header: rarely changes ⇒ cache ∞ until invalidated.
  * Core rows: `300 s`.
  * Slice: `120 s`.
* No loops inside `getRange`—always bulk reads.
* **Skip blank columns**: if `field_id === ""` in row 2 → do **not** expose that column to the client.

### 1.2 API Functions (signature)

```gs
/** header – rows 2‑3 (filters empty field_id) */
function hubGetHeader(entity) { /* returns {col, fieldIds, fieldNames} */ }

/** core – only “core” indices */
function hubGetCore(col, coreIdxArr) { /* string[] */ }

/** slice – 100‑row window */
function hubGetSlice(col, startRow, n) { /* string[] */ }

/** (opt) single‑cell update w/ 409 check */
function hubUpdateCell(col, row, fieldIdx, newVal, force) {}
```

### 1.3 Cache Strategy

```
key = `${type}:${col}:${params}`
• type = core / slice
• TTL  = 300 s  / 120 s
```

---

## 2. Front‑end — HTMLService + Clusterize.js

### 2.1 Load Flow

1. `hubGetHeader(entity)` → build column map **(skip where field\_id === "")**.
2. `hubGetCore(col, coreIdxArr)` → initial rows.
3. Initialise **Clusterize** with ≈ 50 DOM rows.
4. On `scroll` near bottom, call `hubGetSlice(col, nextRow, 100)` and append.

### 2.2 Key Snippet

```html
<div id="scrollArea">
  <table><tbody id="content"></tbody></table>
</div>
<script src="https://unpkg.com/clusterize.js"></script>
<script>
  google.script.run.withSuccessHandler(init).hubGetHeader('Shots');
  /* ...see guide for full code... */
</script>
```

* **trFromPipe()** – split once; build string, not DOM nodes.
* **rowBuffer** is internal to Clusterize.

### 2.3 Performance Targets

| Data size | TTFB (header + core) | Full scroll | API calls |
| --------- | -------------------- | ----------- | --------- |
| 1 k rows  | ≈ 220 ms             | –           | 2         |
| 15 k rows | ≈ 260 ms             | ≈ 2.4 s     | ≤ 4       |

---

## 3. Implementation Steps

1. **Sheet prep** – ensure DataHub column layout; remove or leave blank any unused columns → they will be skipped.
2. **`Code.gs`** – paste API functions.
3. **`index.html`** – paste template & Clusterize CDN.
4. `Deploy → New web app` (execute as *you*, access *anyone*).
5. Import 15 k‑row CSV sample → verify 60 fps scroll.

---

## 4. Optional Enhancements

| Feature           | How                            | Benefit              |
| ----------------- | ------------------------------ | -------------------- |
| Core‑cache row    | Copy core values to hidden row | removes one API read |
| Gzip + Base64     | `Utilities.zip` in hubGetSlice | 40 % payload cut     |
| IndexedDB offline | save last snapshot             | 0‑network reload     |

---

## 5. References

* Clusterize.js [https://nexts.github.io/Clusterize.js/](https://nexts.github.io/Clusterize.js/)
* Apps Script CacheService [https://developers.google.com/apps-script/reference/cache](https://developers.google.com/apps-script/reference/cache)

---

*Last updated: 2025‑08‑06*
