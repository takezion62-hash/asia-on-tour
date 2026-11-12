# ASIA ON TOUR — 第3段階：旧results.jsonの廃止

## 移行完了後の構成

- **唯一の更新元:** `source-results/S*.json`、`source-results/unknown.json`、`source-results/manifest.json`
- **閲覧用:** `season-data/` に事前生成されたシーズン別レコードとランキング
- **更新処理:** 自動更新・競合時の統合・管理者承認・過去大会の確認済み掲載は `readResults` / `publishResults` に統一
- **検証センター:** `source-results/manifest.json` と各シーズンから戦績ID順に再構築。元ファイルをダウンロードしない
- **テスト:** 本番実績を参照するテストは分割正本を読み、過去のJSON形式を検証する場合だけ一時ディレクトリのテスト用ファイルを使用
- **Git:** 6MB超の `results.json` は追跡から削除し、`.gitignore` で再追加を防止

## 安全確認

`npm run validate` に `node scripts/audit-legacy-results.cjs` が含まれ、旧正本の再出現、直接読み込み、古い掲載フローがあれば失敗します。以下のコマンドで変更前後の意味的な一致を検査します。

```bash
node scripts/source-results-store.cjs verify
node scripts/build-source-results.cjs --check
node scripts/build-season-data.cjs --check
node scripts/audit-legacy-results.cjs
npm run test:unit
```

manifestのID順と全シーズンのレコード内容からSHA-256を再計算し、件数・ID・未確定賞金・チーム賞金・個人配分賞金を照合します。シーズンを変更したときはそのファイルとmanifestだけを更新し、差分がないファイルを再保存しません。

## 戻す場合

削除した大容量ファイルはGitの過去のコミットで確認できますが、**過去のものをmainへ戻すだけでは正本の代わりにはなりません。** シーズン別データが引き続き権威を持ちます。復元・訂正する場合は正本のレコード内容を検証し、チーム/個人賞金・IDの整合性検査を経てコミットしてください。
