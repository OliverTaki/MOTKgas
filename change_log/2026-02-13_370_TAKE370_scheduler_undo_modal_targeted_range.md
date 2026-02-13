# TAKE370: Scheduler Undo Modal + Targeted Range Undo

## Date
2026-02-13

## Summary
Scheduler の Undo を即時実行から履歴モーダル選択方式へ変更。
`Undo` ボタンで履歴一覧を開き、戻り先を選択して一括で戻すフローに変更した。

## Changes
- UI (`src/3CL_Scheduler.html`)
  - Undo 履歴モーダルを追加
  - `Undo` ボタンを「履歴モーダルを開く」動作に変更
  - Undo 履歴の取得 (`sv_undo_options_v2`) を追加接続
  - 選択地点まで Undo 実行 (`sv_undo_to_v2`) を追加接続
  - Undo 実行前の保存キュー待ちロジックを共通化し、モーダル Undo に適用

- Server (`src/2SV_DataCore.js`)
  - `sv_undo_options_v2(reqPayload)` を追加
    - scope/actor/admin で Undo 候補を抽出
    - scheduler は opId 単位でグルーピングして返却
  - `sv_undo_to_v2(reqPayload)` を追加
    - 指定 undoKey (または targetLogId) までのグループを一括 Undo
  - Undo の共通内部処理を追加
    - フィルタ
    - グルーピング
    - 適用・ログ反映の共通化
  - `sv_undo_last_v2` を共通処理ベースへ整理

## Expected Behavior
- Undo ボタン押下で履歴モーダルが開く
- 履歴を1つ選び `Undo To Selected` で、その地点まで一括で戻る
- Undo 実行前に保存キューが空になるまで待つ

## Notes
- 既存の `sv_undo_last_v2` は後方互換として維持
- 今回は UI/Server の Undo 導線をモーダル中心に変更
