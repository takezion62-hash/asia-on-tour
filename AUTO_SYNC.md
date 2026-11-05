# ASIA ON TOUR — Osirion AUTO SYNC

## 現在の稼働状態（2026年11月5日）
- **provider: osirion / enabled: true / mode: review**。GitHub Actionsが6時間ごとに公開のOsirion APIをチェックします（UTC 00:17 / 06:17 / 12:17 / 18:17、遅延あり）。
- サイトの「更新履歴」内のAUTO SYNC管理パネルから、接続状況・照合済みの選手数・新規候補・最終確認日時を見られます。
- **通常6時間ごとのAUTO SYNCは確認候補の収集のみ**。過去大会の専用ジョブのみ、既存の公式規則で厳格に検証した一部Victory Cup戦績を承認できます。FNCS・Cash Cup・スキン大会などの新しいカテゴリはすべて確認専用で、`results.json`へ自動公開しません。
- `players.json`の確認済み別名を安全に解決する方式を使用。2026-11-05の過去大会照合では**439アカウントID・競合0件**を確認しました。これは選手の重複登録を増やすものではなく、追跡可能なEpicアカウントID件数です。実数はステータス画面で確認してください。

## Osirion APIの実証結果
- 公開API：https://fnapi.osirion.gg/
- 大会一覧：`GET /v1/tournaments`
- リーダーボード：`GET /v1/tournaments/leaderboard?leaderboardEventId=...&leaderboardEventWindowId=...&page=0`
- 実データで確認：2026年9月22日 NAW Solo Victory Cupの予選に出た掲載選手10名について、TrackerプロフィールUUIDをハイフンなしに変換したIDがAPIのaccountIdと一致。**順位・ポイント・試合数・キル・VRの5項目すべて10名一致**。大会IDは `epicgames_S42_SoloVictoryCup_NAW` のように正式な地域付きIDが必要。
- APIのテストは認証なし・無料で成功しました。ただし公開ベータの仕様や利用条件は将来変わる可能性があります。Osirionの規約：https://osirion.gg/legal/license

## 何を自動でチェックするか
- `tournaments.json` に**正式な大会ID・開催シーズン・チーム人数**が一意に登録された大会を追跡します。Victory Cupに加え、Cash Cup、FNCS Division 1（Practice含む）、Performance Evaluation、スキン大会、Icon Cup、PlayStation Cupも確認対象です。未登録IDや複数の分類に一致する大会は自動登録しません。
- 対象地域はME/EU/NAC/NAW/OCE/BR。ASIA大会と地域ロックされた未登録FNCS予選は対象外。
- 終了から4時間以上経過した、直近7日間の大会ラウンドを発見します。
- 1回の定期チェックで最大30ページ・2ウィンドウ、各ウィンドウ最大12ページ。Victory Cupとそれ以外の大会でスキャン枠を分け、巨大な順位表が別カテゴリを妨げないようにします。ページの進捗は `auto-sync-scan.json` に保存し次回に継続します。順位表APIのリクエスト制限に余裕を持たせます。
- 選手照合は既存 `results.json` のTrackerプロフィールURLを参照します。`players.json`の`confirmedAliases`に登録された旧名は同じ正式選手名に解決します。複数の正式選手に結び付くID・曖昧な別名・名鑑に存在しない未確認名義は自動候補にしません。
- 対象選手の成績が見つかると、順位・ポイント・キル・VR・試合数の情報を `auto-sync-review.json` に候補として記録し、サイトで確認できます。
- 元のプロフィールURLと掲載名を保持し、Osirionの生の全順位表をサイトへ丸ごと再配布しません。
- 新シーズンのVictory Cup・Cash Cup・FNCS Division 1・対応候補のIcon Cup等について、カタログ未登録の大会IDを検知して`auto-sync-status.json`の`unmappedEvents`と`unmappedEventIds`に記録します。サイトに未登録数を表示しますが、未検証の形式やチーム人数は自動推定・追加しません。

## 自動公開までに必要な確認
1. **予選突破条件**：出場しただけの選手を「予選突破」としないよう、大会・地域・ラウンドごとの通過条件を確認する必要があります。
2. **賞金**：Osirionの順位表だけでは現金賞金が確定しません。決勝は大会ごとのVR賞金・順位賞金規則と照合し、未確定を$0と取り違えない設計が必要です。
3. **日付・表示名・遅延**：地域ごとの大会日付、シーズン変更、API反映遅延、別名義・同名別人を追加検証する必要があります。
4. **対応大会拡張**：FNCS Div1・Cash Cup・スキン大会などはAPI成績の照合に対応しましたが、**予選突破・賞金・スキン獲得の自動承認は未対応**です。公式規則と大会・地域・ラウンド別条件を実証するまでは確認候補として保持します。

上記が確認できるまでは、`mode: "publish"` に変えると実行処理は安全のためエラーで停止します。**この段階では手動で確認した成績だけを従来どおりサイトへ登録してください**。

## 管理・実行
- GitHub Actions → `AOT safe results auto-sync` → `Run workflow` で管理者が手動チェックを実行できます。
- 定期チェックは `.github/workflows/auto-sync.yml`、取得処理は `scripts/osirion-sync.cjs`、本人照合・候補検証は `scripts/auto-sync-core.cjs`、一覧状態は `auto-sync-status.json` です。
- 公開サイトの更新ボタンはステータスの再読込のみで、公開閲覧者によるGitHubへの書き込みを許可しません。
- `scripts/auto-sync.cjs` は旧API用の未使用実験コードです。現在のGitHub ActionsはOsirionを使用します。

## S43 Squads Victory Cup（2026年11月5日追加）
- 公式ページおよび2026年11月1日付Epic公式規則で、S43のスクワッド・通常バトロワ・クロスプラットフォーム大会と確認。開催は11月9日から地域ごとに開始します。
- `tournaments.json` に `ch7s5-squads-victory-cup`（`S43_SquadsVictoryCup`）を登録。現時点で戦績の追加・賞金額の推定は行っていません。
- Round 1通過条件はEU上位300チーム、NAC上位200チーム、ME/NAW/OCE/BR上位120チーム。Round 2はVR1回につきチーム$200、原則4人に均等配分。ただし公式の賞金対象外居住地域や受賞資格の確認があるため、自動で賞金確定扱いにしません。
- 新しいラウンドID形式 `Event1_Round1` / `Event1_Round2` と従来形式 `Event1Round1` を両方認識します。
- スクワッドの自動候補は、4人全員のEpic IDが掲載名鑑の確認済みアカウントとして照合できる場合に限ります。1人でも未確認の場合は誤ったチーム登録を避けるため保留します。
- 追加後の自動実行で、新シーズン未登録Victory Cupイベント数は1→0に解消しました。現在の運用モードは引き続き`review`です。

## 過去大会の自動照合（HISTORY BACKFILL、2026年11月5日）
- 通常の6時間ごとのAUTO SYNCとは完全に別のGitHub Actions `.github/workflows/history-sync.yml` と `history-sync-*.json` を使用。Osirionの公開大会一覧で `includeHistoricData=true` を指定して終了済みの過去大会を調べます。
- 初回検証は2026/9/22 NAW Solo Victory Cup（S42）Event 3 Round 1。8ページを走査し、登録済み選手のEpic IDで新規59件（158〜792位）を抽出。Epic公式規則のNAW上位800位通過を照合し、2026年11月5日に**59件を予選突破・賞金$0として`results.json`へ追加**。既存の1047件は保持し、計1106件になりました。
- `history-sync-config.json` の照合対象は**2026/8/1〜11/4、ME/EU/NAC/NAW/OCE/BR**。毎日UTC 03:41（日本時間12:41）を目安にGitHub Actionsが調査します。1回最大24ページ・6ラウンド、各ラウンド最大8ページ。Victory Cupと新しい確認専用カテゴリの両方に調査枠を割り当てます。途中経過は `history-sync-scan.json` に保存します。GitHub Actionsによる遅延・失敗はありえます。
- サイトの「更新履歴」→「過去大会の戦績調査」から、照合進捗・確認候補数を表示。登録済みの候補IDは次回照合で確認待ち一覧から除外します。
- **条件を厳密に確認できた過去大会だけ自動承認**。`history-sync-config.json`の`autoApproveVerified: true`と`scripts/verified-history-approval.cjs`の限定ルールを使用。S41（Chapter 7 Season 3）Solo Reload Victory Cup、S42（Chapter 7 Season 4）Solo Battle Royale Victory Cupのみが初期の自動承認対象です。
- 予選は公式地域別通過順位以内、公式ルールの試合数上限以内、Epic IDが名鑑の本人と一意に照合でき、順位表の取得が完了した場合に限って、賞金$0の「予選突破」として登録します。決勝は**0VRのときのみ**公式のVR単位賞金規則から$0と確定し「決勝（賞金なし）」で登録します。1VR以上の賞金は自動推定・公開せず、出典や資格を確認してください。
- 取得途中、開催日の不一致、未対応の大会、公式ルールとAPIの試合数矛盾、曖昧な選手ID、既存記録と重複などは必ず確認待ち/除外に残します。S41 Solo Reload予選の最大8試合と一致しない9試合報告は自動登録していません。
- 通常6時間ごとのAUTO SYNCは引き続き確認のみ。自動承認は過去大会専用のGitHub Actionsで実行し、`results.json`と`updates.json`は全検証テスト成功後にコミットします。
- 2026年シーズンS41/S42のVictory Cupで公式規則が確認できたソロ通常BR・ソロReload・コンソールソロZB・ReloadデュオのRound 1は、地域別通過枠を使って対象者を絞ります。通過圏を超えた順位表ページでは追加取得を停止し、候補の誤掲載と無駄なリクエストを抑えます。未知のシーズン・大会は条件を推測しません。
- `results.json` が1MBを超えるとGitHub Contents APIの通常取得に制限があるため、管理者はBlob取得またはGit checkoutで最新版を扱います。サイトのJSONファイル自体はUTF-8として有効で、1,106件の重複なしを確認しています。
- APIに残っていない過去大会は自動検出できないため、Fortnite Trackerスクリーンショット・公式順位表など従来の手入力を併用してください。2024年の大会などは確認対象日付を広げる前にAPIの履歴対応を試験します。

## Victory Cup以外の安全な自動照合（2026年11月5日）
- 通常・過去の両ジョブで `reviewSeries` を設定し、Victory Cup / Cash Cup / FNCS Division 1 / Performance Evaluation / スキン大会 / Icon Cup / PlayStation Cupの**確認候補**を収集します。
- 全系列でME/EU/NAC/NAW/OCE/BRの対象地域、開催ウィンドウ、確定済みEpic ID、全員分が揃ったチーム人数、取得済み成績を検証。曖昧な同名選手、未登録の大会ID、地域ロックFNCS、途中の順位表欠損は除外します。
- **Victory Cup以外はすべて `kind: 参加確認`, `prize: null`, `reviewOnly: true`**。自動予選突破・上位入賞・賞金・スキン報酬認定はしません。候補を誤って結果に流す操作は`applyProposals`でも拒否します。
- FNCSは、`FNCSDivisionalCup_Division1`の正式IDと`fncs-division-1`（またはPractice）分類の両方が一致する場合だけ対象。FNCS Reload Qualifiersなど地域ロック大会は対象にしません。名称にFNCSを含むコミュニティスキンカップは別カテゴリとして扱います。
- スキン・Icon Cupの単一ウィンドウでは「単一開催枠 / 参加確認」を使います。予選・決勝と勝手に認定しません。本人の成績が見つからない場合やAPIに全チームIDがない場合は何も登録しません。
- 勝利条件や賞金配分は大会により違います。FNCS 2026の公式ルール：https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-2026-official-rules ／S42 Reload Zero Build Cash Cup公式規則：https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-zero-build-reload-cash-cups-chapter-7-season-4-official-rules
- S43など新シーズンの大会は、ソースID・人数が確認できていない限り候補発見通知のみ。誤ったカタログ自動生成は行いません。
- `tests/non-victory-auto-sync.test.cjs`で対象判定、地域ロック除外、賞金未確定・公開禁止、チームの完全一致、カテゴリ間のスキャン配分を回帰テストしています。
