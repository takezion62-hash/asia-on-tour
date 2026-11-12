# ASIA ON TOUR — 第2段階（更新元の読み書き移行）

## 正本と互換性
- 正本: source-results/S*.json と source-results/manifest.json
- 互換用ファイル: results.json（同じID順で生成し、同一Gitコミットで更新）
- 閲覧・ランキング: scripts/build-season-data.cjs が正本から読み、season-data/ に閲覧用JSON・ランキングを生成
- ID・件数・順序・戦績本文・賞金総額（セント単位）・SHA-256・未確定賞金件数を照合
- 破損、重複ID、旧投影の不一致、欠落、意図しない削除はエラーとして公開停止

## 自動更新・手動登録
通常の自動同期、競合回避の統合、管理者手動承認、レビュー済み掲載は source-results-store.cjs の readResults / publishResults を利用する。変更のあったシーズンファイルだけ書き換え、results.json は互換性のために生成する。

旧式の単発実績掲載スクリプトについては、GitHub Actionsが正本を確認してから従来の results.json に書き、その後明示的に node scripts/source-results-store.cjs import-legacy で正本へ反映する。古いデータを無条件に正本へ取り込まない。削除・ID重複は拒否する。

## 確認コマンド

    node scripts/source-results-store.cjs verify
    node scripts/build-source-results.cjs --check
    node scripts/build-season-data.cjs --check
    node --test tests/source-results-store.test.cjs tests/source-results-split.test.cjs
    npm run validate

第3段階では、旧スクリプトと外部連携の移行後に results.json の全件出力を廃止する。現在は互換ファイルのGit差分が残るため、書き込みサイズが完全に減るわけではない。
