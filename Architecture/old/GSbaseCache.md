✅ Google Sheetsベース キャッシュ設計：完全プラン（2025年最新版）
🧭 設計の中心方針（明確に決定されたこと）
すべてのデータはGoogle Sheetsで管理される

各エンティティシート（例：Shots, Assets, Tasks...）の各行は、「行単位（ROW管理）」でキャッシュされる

各行のA列に、その行全体のfield_id:valueペアをカンマ区切りで列挙したテキストを格納する

フィールド数や行数が増減しても、このROWキャッシュ形式ひとつで統一された運用ができる

テーブル表示時は、このA列の値のみを参照することで表示ショット数によって処理スピードを調整できる

ディテールページを開く際にも、無駄なデータ読み出しが発生しない

この形式により、読み取り処理が極端にシンプルになり、あらゆるエンティティで再利用可能な仕組みとなる

加えて、**主要な「コアFIELDS」**については、FIELDSシート上に別途保持・集計される

将来的には ProjectMeta や Fields の情報を使ったスキーマ処理も導入予定だが、現時点では保留中とし、まずはエンティティシート側の実装に集中する

✅ 各エンティティシートのROWキャッシュ仕様
◾ A列キャッシュ構文：
text
Copy
Edit
fi_0001:Shot01, fi_0002:Cut002, fi_0003:Ready, fi_0004:Scene1, ...
すべての field_id をヘッダー（1行目）から取得

A列以外の各セルの 計算結果（数式を含む）または値 を取得

結果はカンマ区切りの1セル文字列

UI上のデータ表示はこのA列の値だけで成立

◾ A列セル関数（Google Sheets純正関数）：
excel
Copy
Edit
=TEXTJOIN(", ", TRUE, ARRAYFORMULA($1:$1 & ":" & B2:Z2))
$1:$1：1行目（field_id）

B2:Z2：この行の値（A列除く）

範囲は必要に応じて拡張（Z列 → AA列など）

数値・文字列・計算結果すべて対応

空白は無視される（TRUE引数）

✅ FIELDSシートの設計方針
◾ 列構成
列	内容
A列	field_id（固定。主キー）
B〜G列	entity, field_name, type, editable, required, options
H列	Core フィールドかどうかのチェックボックス
I列以降	HJSON形式などに使うメタ情報の集計列群（将来的に拡張される）

◾ 判定方針
1行目（ROW1）の文字列によって各列の意味を判定する

field_id, field_name, type などの文字列が定義名となる

Coreチェックは TRUE/FALSE のチェックボックス

◾ 運用方針
現時点では FIELDSシートはまだ参照しない

今後、FEまたはGASで動的スキーマ構築や型情報が必要になったときに本格運用

今は定義を保持しておくだけ

✅ コアFIELDS（あなたが定義したもの）
これらは FIELDS シート上の Core チェックボックスが TRUE のもの。

pgsql
Copy
Edit
fi_0001	shots	ShotId	ID	FALSE	TRUE		
fi_0002	shot	ShotCode	text	FALSE	TRUE		
fi_0003	shot	Shot	text	TRUE	TRUE		
fi_0004	shot	Scene	text	TRUE	FALSE		
fi_0005	shot	Sequence	text	TRUE	FALSE		
fi_0006	shot	Act	text	TRUE	FALSE		
fi_0007	shot	Episode	text	TRUE	FALSE		
fi_0008	shot	Status	select	TRUE	TRUE	not_started,in_progress,review,approved,completed
fi_0015	asset	Asset ID	ID	FALSE	TRUE		
fi_0016	asset	Asset Name	text	TRUE	TRUE		
fi_0017	asset	Asset Type	select	TRUE	TRUE	Characters,Puppets,Props
✅ なぜこの方式が優れているか
項目	効果・理由
シンプル	どの行も1列だけ見ればすべてのデータが得られる
拡張性	列や行が増えても同じ構文・同じ読取方法で処理できる
スピード制御	テーブル表示で行数を制限すれば即座に処理量が下がる
再利用性	全エンティティで同じスキームを使える
安定性	各行が独立してデータを持つため壊れにくく、同期も安全
遅延対応可能	必要に応じて詳細データや重い情報だけ後読み可能（拡張時）

✅ 今後の拡張項目（まだ着手しないが設計上想定）
FIELDS シートの Core チェックを使ってFEの列構成を動的制御

ProjectMeta によるプロジェクトスキーマ制御

HJSONやTypeScript用メタ情報の自動生成

GASでの updateRowCache() や getCoreFields() の導入