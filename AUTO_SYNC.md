# ASIA ON TOUR — 安全な大会成績自動更新

## 現在の状態
サイトの「更新履歴」にAUTO SYNC管理パネルを設置しました。GitHub Actionsから定期チェック（毎日UTC 00:17・06:17・12:17・18:17）と手動チェックを実行できます。
**初期状態は停止中（enabled: false）**。APIキー・本人確認済みEpic ID・大会の正確なウィンドウ設定がないので、成績の自動追加は動きません。サイトの「最新状況を確認」は公開ステータスJSONの再読込だけです。

## 管理者の有効化手順
1. 大会データAPIを確認: https://api-fortnite.com/fortnite-tournaments-api 。全リーダーボードはProプランが必要との案内があります。サイトは課金しません。
2. GitHubリポジトリ Settings → Secrets and variables → Actions に AOT_FORTNITE_API_KEY を登録。秘密情報を公開HTML・JS・JSONには絶対に入れないでください。
3. auto-sync-config.json の accounts に、既存掲載名・確認済み32文字16進Epic account ID・confirmed:true を登録。Fortnite TrackerのプロフィールURLの UUID id=... をEpic IDと同一視しないこと。
4. windows に eventId, windowId, dateJst, region, seasonId, tournamentId, round, kind, ready:true を登録。必ず結果が確定したウィンドウのみを追跡。新シーズンの大会は先に tournaments.json の分類に登録すること。
5. enabled:true、mode:review としてGitHub Actions → AOT safe results auto-sync → Run workflowを実行。新規候補は auto-sync-review.json に保存され、公開サイトで確認できます。**まだ results.json に追加しません。**
6. APIの実際のレスポンス形式、Epic IDの名寄せ、統計の正確性を検証してからのみ、管理者が mode:publish へ切り替えます。JSON検証が失敗した場合はコミットしません。

## 登録の安全ルール
- 本人確認済みEpic IDに一致しない選手は対象外。同じ表示名を自動統合しません。
- 予選VRとスキン報酬を現金として計算しません。決勝の不明賞金はnull（不明）で登録し、$0確定と区別します。
- チーム戦は全メンバーのIDが確認できた場合に限って候補を生成します。
- 既存成績は削除せず、同じ大会・ラウンド・選手の重複追加を避けます。
- 順位・キル・VR・試合数が欠けるデータはスキップします。自動追跡は遅延する可能性があります。

## 現時点で未実装
大会ウィンドウの自動発見、選手表示名からEpic IDへの安全な自動変換、現金賞金の自動確定、サイト画面上からの認証付き更新実行。APIの実レスポンス確認を終えるまで自動公開モードにはしないでください。
公開ステータスを表示するのは閲覧者にも安全ですが、書き込みは管理者権限のGitHub Actionsに限定します。

## ファイル構成
auto-sync-config.json は設定、auto-sync-status.json は公開状態、auto-sync-review.json は確認候補、scripts/auto-sync-core.cjs は重複と本人確認検証、scripts/auto-sync.cjs は実行、.github/workflows/auto-sync.yml は定期ジョブ。
