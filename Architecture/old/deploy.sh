#!/usr/bin/env bash
set -e

# 1) ソースをリモートに push
clasp push

# 2) 現在時刻を YYYYMMDD_HHMMSS 形式で取得
TS=$(date +'%Y%m%d_%H%M%S')

# 3) clasp version で「バージョン名」にタイムスタンプを付与
clasp version "$TS"

# 4) 最新バージョンでデプロイ
clasp deploy
