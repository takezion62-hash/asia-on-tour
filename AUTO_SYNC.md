# ASIA ON TOUR — Osirion AUTO SYNC

## 現在の稼働状態（2026年11月5日）
- **provider: osirion / enabled: true / mode: review**。GitHub Actionsが6時間ごとに公開のOsirion APIをチェックします（UTC 00:17 / 06:17 / 12:17 / 18:17、遅延あり）。
- サイトの「更新履歴」内のAUTO SYNC管理パネルから、接続状況・照合済みの選手数・新規候補・最終確認日時を見られます。
- 現状では**候補の取得だけが自動**です。順位や賞金を間違って登録しないよう、`results.json`への自動公開はコード上で禁止しています。
- 初回チェック時は417アカウントIDを追跡し、13件を保留。11月5日に`players.json`の確認済み別名を安全に解決する方式へ改善し、**422アカウントIDを追跡／8件を保留**に更新しました。これは選手の重複登録を増やすものではなく追跡対象アカウントIDの件数です。直近7日間に該当する終了済みの対象大会はなく候補0件でした。

## Osirion APIの実証結果
- 公開API：https://fnapi.osirion.gg/
- 大会一覧：`GET /v1/tournaments`
- リーダーボード：`GET /v1/tournaments/leaderboard?leaderboardEventId=...&leaderboardEventWindowId=...&page=0`
- 実データで確認：2026年9月22日 NAW Solo Victory Cupの予選に出た掲載選手10名について、TrackerプロフィールUUIDをハイフンなしに変換したIDがAPIのaccountIdと一致。**順位・ポイント・試合数・キル・VRの5項目すべて10名一致**。大会IDは `epicgames_S42_SoloVictoryCup_NAW` のように正式な地域付きIDが必要。
- APIのテストは認証なし・無料で成功しました。ただし公開ベータの仕様や利用条件は将来変わる可能性があります。Osirionの規約：https://osirion.gg/legal/license

## 何を自動でチェックするか
- `tournaments.json` に登録済みのVictory Cup系大会のみ（現時点はFNCSその他の全大会までは対応していません）。
- 対象地域はME/EU/NAC/NAW/OCE/BR。ASIA大会と地域ロックされた未登録FNCS予選は対象外。
- 終了から4時間以上経過した、直近7日間の大会ラウンドを発見します。
- 1回の定期チェックで最大30ページ・最大2ウィンドウ。ページの進捗は `auto-sync-scan.json` に保存し次回に継続します。順位表APIの毎分60回制限を超えないよう余裕を持たせます。
- 選手照合は既存 `results.json` のTrackerプロフィールURLを参照します。`players.json`の`confirmedAliases`に登録された旧名は同じ正式選手名に解決します。複数の正式選手に結び付くID・曖昧な別名・名鑑に存在しない未確認名義は自動候補にしません。
- 対象選手の成績が見つかると、順位・ポイント・キル・VR・試合数の情報を `auto-sync-review.json` に候補として記録し、サイトで確認できます。
- 元のプロフィールURLと掲載名を保持し、Osirionの生の全順位表をサイトへ丸ごと再配布しません。
- 新シーズンなどでVictory Cup系の大会IDがカタログ未登録の場合は、最近または近日のイベントから未登録IDを検知して`auto-sync-status.json`の`unmappedEvents`と`unmappedEventIds`に記録します。サイトのAUTO SYNC欄に未登録数が出ます。これは自動追加や大会同定ではなく、見逃し防止の通知です。

## 自動公開までに必要な確認
1. **予選突破条件**：出場しただけの選手を「予選突破」としないよう、大会・地域・ラウンドごとの通過条件を確認する必要があります。
2. **賞金**：Osirionの順位表だけでは現金賞金が確定しません。決勝は大会ごとのVR賞金・順位賞金規則と照合し、未確定を$0と取り違えない設計が必要です。
3. **日付・表示名・遅延**：地域ごとの大会日付、シーズン変更、API反映遅延、別名義・同名別人を追加検証する必要があります。
4. **対応大会拡張**：今はVictory Cupの既存カタログだけに対応。FNCS Div1、Cash Cup、スキン大会などは個別のラウンド条件を実装してから拡張します。

上記が確認できるまでは、`mode: "publish"` に変えると実行処理は安全のためエラーで停止します。**この段階では手動で確認した成績だけを従来どおりサイトへ登録してください**。

## 管理・実行
- GitHub Actions → `AOT safe results auto-sync` → `Run workflow` で管理者が手動チェックを実行できます。
- 定期チェックは `.github/workflows/auto-sync.yml`、取得処理は `scripts/osirion-sync.cjs`、本人照合・候補検証は `scripts/auto-sync-core.cjs`、一覧状態は `auto-sync-status.json` です。
- 公開サイトの更新ボタンはステータスの再読込のみで、公開閲覧者によるGitHubへの書き込みを許可しません。
- `scripts/auto-sync.cjs` は旧API用の未使用実験コードです。現在のGitHub ActionsはOsirionを使用します。
