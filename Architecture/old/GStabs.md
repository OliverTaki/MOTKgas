## Table of Contents
1. [Entity Sheets](#entity-sheets)
2. [Fields Sheet](#fields-sheet)
3. [project_meta Sheet](#project_meta-sheet)
4. [ProxyQueue Sheet](#proxyqueue-sheet)
5. [DataHub Sheet](#datahub-sheet)
6. [FAQ](#faq)
7. [Mini Sample](#mini-sample)

# Part Ⅰ　個別タブ仕様（DataHub 以外）

## 1. エンティティ系 6 シート

**Shots / Assets / Tasks / ProjectMembers / Users / Pages**

| 行         | 役割             | セル内容のフォーマット                                            |
| --------- | -------------- | ------------------------------------------------------ |
| **1 行目**  | **Field ID 行** | 左から右へ `fi_0001, fi_0002 …` ― *当該エンティティが持つすべてのフィールド ID* |
| **2 行目**  | **ラベル行**       | 行 1 と完全同順で人間可読ラベル (`Shot ID`, `ShotCode` …)            |
| **3 行目〜** | **データ行**       | 1 行 = 1 レコード。セルはラベル順に値を配置。未入力は空文字                      |

**列数・行数（例）**

| シート            | 列数 | データ行数\* |
| -------------- | -- | ------- |
| Shots          | 17 | 12 792  |
| Assets         | 12 | 998     |
| Tasks          | 10 | 998     |
| ProjectMembers | 10 | 998     |
| Users          | 8  | 998     |
| Pages          | 9  | 997     |

\*データ行数 = 行 3 以降の総行数

---

## 2. **Fields** シート（フィールド定義）

| 行           | 内容                                                                                                            | 備考                                                                           |                         |
| ----------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| **1 行目**    | **固定ヘッダ 9 列**<br>`field_id / entity / field_name / type / editable / required / options / Core / Core_values` |                                                                              |                         |
| **2〜998 行** | **定義行**                                                                                                       | 各フィールド 1 行<br>– `Core`: `TRUE`/空<br>– `Core_values`: `Core=TRUE` の行のみ値を保持（\` | \` 区切りで「フィールド名＋各レコード値」） |

*ラベル行は存在せず、行 2 から即データ。*

---

## 3. **project\_meta** シート（プロジェクト基本情報＋階層設定）

| 行          | 列内容（例）                                                                                                                         | 役割                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **1**      | `project_id, storage_provider, originals_root_url, proxies_root_url, created_at, Episode, Act, Sequence, Scene, Shot`          | **ヘッダ行**                                                        |
| **2**      | `Project:Oliver06, gdrive, https://drive.google…, https://drive.google…, 2025-07-23T01:27:38Z, TRUE, FALSE, FALSE, TRUE, TRUE` | **値行** – プロジェクト固有情報＋階層有効フラグ                                     |
| **3**      | ` , , , , , fi_0007, fi_0006, fi_0005, fi_0004, fi_0003`                                                                       | **フィールド ID 行** – 行 2 の Episode〜Shot 列に対応する **Fields ID** を列順で記載 |
| **4 行目以降** | なし（空行）                                                                                                                         |                                                                 |

---

## 5. 相互参照のポイント

| 関係                         | 説明                                                                            |
| -------------------------- | ----------------------------------------------------------------------------- |
| **エンティティ ↔ Fields**        | 行 1 の Field ID 群は *Fields* シート内の `field_id` と 1:1 対応。`Core` はエンティティ列選択に影響しない。 |
| **project\_meta ↔ Fields** | 行 3 の ID 行で Episode〜Shot の実フィールドを特定（ラベル変更時の紐付け維持）。                            |
| **`Core_values`**          | *Fields* で `Core=TRUE` の行のみ保持。エンティティ側のデータ行を “縦持ち” でコピーし、高速参照に利用可能。            |

---

### まとめ

* **エンティティ系タブ**：必ず「Field ID 行 → ラベル行 → データ行」の 3 層。
* **Fields タブ**：ヘッダ行の直下から定義。ラベル行はなし。`Core_values` に Core フィールドの全値を `|` 連結保存。
* **project\_meta**：ヘッダ・値・ID 対応表の 3 行構成。階層フラグは TRUE/FALSE、対応する Field ID は行 3 に列順で保存。

---

# Part Ⅱ　DataHub タブ 

（行番号 1-origin／列記号 A=1, B=2…／セル値は “|” 区切り）

## 1. 列グループ

| 列        | 対応タブ                                                                                                 | 備考 |
| -------- | ---------------------------------------------------------------------------------------------------- | -- |
| **A**    | Shots                                                                                                |    |
| **B**    | Assets                                                                                               |    |
| **C**    | Tasks                                                                                                |    |
| **D**    | ProjectMembers                                                                                       |    |
| **E**    | Users                                                                                                |    |
| **F**    | Pages                                                                                                |    |
| **G**    | Fields（定義＋Core\_values キャッシュ）                                                                        |    |
| **H**    | project\_meta                                                                                        |    |
| **I 以降** | 旧 FIELDS シートの “横持ちキャッシュ列” を連結したもの<br>※ **G 列 Core\_values と値は必ず一致**（同じ数式 `BYROW(TEXTJOIN)` で生成されるため） |    |

---

## 2. 行レイアウト

| 行      | A〜E (エンティティ)              | F (Pages)  | G (Fields)                                                                                  | H (project\_meta)                     |
| ------ | ------------------------- | ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| **1**  | タブ名 (`Shots`, …)          | `Pages`    | **ヘッダ 9 列**<br>`field_id‖entity‖field_name‖type‖editable‖required‖options‖Core‖Core_values` | ヘッダ (`project_id‖storage_provider‖…`) |
| **2**  | **Field ID 行** – 全 ID を連結 | Field ID 行 | **定義行 #1**                                                                                  | **値行**                                |
| **3**  | **ラベル行**                  | ラベル行       | **定義行 #2**                                                                                  | **Field ID 行**（Episode〜Shot 対応）       |
| **4〜** | データ行                      | ページ定義行     | 定義行が続く                                                                                      | –                                     |

---

## 3. 列詳細

### 3-A. エンティティ列（A–E）

* **行 1**　タブ名固定
* **行 2**　フィールド ID 群（Core=TRUE/空 全部）
* **行 3**　ラベル行
* **行 4〜** データ行（値を `|` 連結）

### 3-B. Pages 列（F）

* **行 1**　`Pages`
* **行 2**　`fi_0052|fi_0053|fi_0054|fi_0055|fi_0056|fi_0057|fi_0058|fi_0059|fi_0060`
* **行 3**　`Page ID|Page Name|Page Type|Entity|Config|Shared|Created By|Created|Modified`
* **行 4〜** ページ毎の設定行

### 3-C. Fields 列（G）

| 列   | 意味                                                                      |    |    |               |
| --- | ----------------------------------------------------------------------- | -- | -- | ------------- |
| 1–8 | `field_id, entity, field_name, type, editable, required, options, Core` |    |    |               |
| 9   | **Core\_values** – `Core=TRUE` 行のみ：\`フィールド名                             | 値1 | 値2 | …\`（定義行と同じ行内） |

### 3-D. project\_meta 列（H）

| 行  | 役割                                 |
| -- | ---------------------------------- |
| 1  | ヘッダ                                |
| 2  | プロジェクト値 + Episode/Act/… TRUE/FALSE |
| 3  | Episode〜Shot に対応する Field ID 群      |
| 4〜 | 空行（データ追加なし）                        |

---

## 4. 整合ルール

1. **エンティティ列 行 2** の ID は **Fields `field_id`** と完全一致。
2. **Core\_values** は **Core=TRUE 行のみ必ず存在**。
3. **Core\_values 内の値数 −1**（先頭フィールド名を除く）は、対応エンティティのデータ行数と一致。
4. **project\_meta** は「ヘッダ → 値 → ID 行」の 3 行で固定。

---

## 5. 相互参照

| 関係                              | 内容                                                        |
| ------------------------------- | --------------------------------------------------------- |
| **エンティティ ↔ Fields**             | 行 1 ID 群 = Fields `field_id`（Core の真偽は列選択に影響しない）          |
| **project\_meta ↔ Fields**      | 行 3 の ID 群で Episode〜Shot 列と Fields レコードを結び付け、ラベル変更時も整合性保持 |
| **旧キャッシュ列 (I〜) ↔ Core\_values** | 同一数式で生成されているため **内容は必ず一致** し、二重更新の心配はない                   |

---

## 6. 旧キャッシュ列 (I〜) の扱いと整合チェック

DataHub **G 列 `Core_values`** は、旧 **FIELDS シート右側 (I〜ZZ)** の “横持ちキャッシュ列” をソースに

```gs
=BYROW(Fields!I1:ZZ, LAMBDA(r, TEXTJOIN("|", FALSE, r)))
```

のように **同一数式で連結** して生成されています。
そのため **G 列と I〜ZZ 列の値は常に一致**し、差分は理論上発生しません。

* **参照は G 列で統一**（I〜ZZ 列はスクリプト旧互換用に残置・読み飛ばし）。
* 整合を点検したい場合は、1 行比較程度で **`TRUE`** が返ることを確認すれば十分。

---

## 7. データ更新フロー（手入力・スクリプト共通）

| 手順    | 操作対象                            | 詳細                                                       | DataHub への反映                    | 注意点                                          |
| ----- | ------------------------------- | -------------------------------------------------------- | ------------------------------- | -------------------------------------------- |
| **1** | **エンティティ系タブ**<br>Shots/Assets/… | レコード追加・編集・削除をセルに直接入力                                     | A〜F 列が `BYROW‖TEXTJOIN` 再計算で即更新 | 行削除→`Core_values` の行数と揃わなくなる恐れ               |
| **2** | **Fields タブ**                   | 既存フィールドの `field_name/type/options/Core` 編集<br>行追加        | G 列定義行へ即反映                      | `Core` を **TRUE→FALSE**/逆にした時は自動処理に任せる（下記参照） |
| **3** | **Core\_values 列**              | **自動更新のみ**。`Core=TRUE` 行なら **行の最右セル以降** にフィールド名＋全値を連結で格納 | 同じ行のまま更新                        | **手入力禁止**（数式破損防止）                            |
| **4** | **project\_meta**               | ストレージ URL・階層フラグ (TRUE/FALSE) 更新                          | H 列が即再計算                        | 行 3 の Field ID 列は変えない                        |
| **5** | **DataHub**                     | **編集禁止ビュー**                                              | 元シートの再計算結果を反映                   | –                                            |

---

## 8. 整合チェック & エラー検出ルール

| チェック項目                        | 検証例式                                                                                  | 合格条件        | NG 例           |               |
| ----------------------------- | ------------------------------------------------------------------------------------- | ----------- | -------------- | ------------- |
| **Field ID 重複 (Fields)**      | `=COUNTUNIQUE(Fields!A2:A)=COUNTA(Fields!A2:A)`                                       | TRUE        | FALSE → ID 重複  |               |
| **エンティティ vs Core\_values 行数** | \`=ROWS(Shots!A3\:A) = (LEN(INDEX(DataHub!G2,1))-LEN(SUBSTITUTE(INDEX(DataHub!G2,1)," | ",""))-1)\` | TRUE           | FALSE → 行数不整合 |
| **project\_meta ID 紐付け**      | `=ISNUMBER(MATCH(INDEX(DataHub!H3,1,6), Fields!A:A, 0))`                              | TRUE        | FALSE → 未登録 ID |               |

---

## 9. Fields 定義行と Core\_values の完全形（実例）

```
field_id | entity | field_name | type | editable | required | options        | Core | Core_values
----------------------------------------------------------------------------------------------
fi_0001  | shot   | Shot ID    | ID   | FALSE    | TRUE     |                | TRUE | Shot ID|sh_0001|sh_0002|sh_0003|…
fi_0002  | shot   | ShotCode   | text | FALSE    | TRUE     |                | TRUE | ShotCode|201A|205B|207C|…
fi_0501  | shot   | Priority   | select | TRUE  | FALSE    | High,Med,Low   |      | 
```

* `Core_values` 先頭は **フィールドラベル**、続く要素が **エンティティ行順の値**。
* `Core` が空の行は `Core_values` を持たない。

---

## 10. FAQ 的メモ（更新済み）

| Q                                       | A                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Core を TRUE に切替えたら何をすればよい？**          | **何もしなくてよい**。`Core` を TRUE に変更すると、Google Sheets のスクリプト／数式が自動でその行の **`Core_values` 列**（G 列・I 以降の横持ち列も同様）へ最新レコード値を連結します。手動スクリプト実行や行削除は不要です。 |
| Core を FALSE に戻したのに Core\_values が残る    | 列末の `Core_values` 部分は空セルになります（数式で再計算）。残っている場合はキャッシュ列の数式が壊れているので修復。                                                                        |
| Pages タブの filterSettings を JSON で持つ理由は？ | 配列・数値範囲・AND/OR 条件などを 1 セルで保持し、DataHub 連結後もパースしやすくするため。                                                                                    |
| 旧 I〜ZZ 列は削除してよい？                        | UI/スクリプトが完全に DataHub G 列参照に移行したら削除可。ただし旧ツール互換が残る間は非表示推奨。                                                                                  |

---

## 11. ミニサンプル（Shots & Fields 抜粋）

```
A列 (Shots)
1  Shots
2  fi_0001|fi_0002|fi_0501
3  Shot ID|ShotCode|Priority
4  sh_0101|201A|High

G列 (Fields)
1  field_id|entity|field_name|type|editable|required|options|Core|Core_values
2  fi_0001|shot|Shot ID|ID|FALSE|TRUE||TRUE|Shot ID|sh_0001|sh_0002|…
3  fi_0501|shot|Priority|select|TRUE|FALSE|High,Med,Low|
```

