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

## 2026-11-05 確認済みの新シーズン大会ID
- Epic公式大会ページ・既存の公式日程データから、S43の`S43_TriosCashCup`（通常BR・トリオ）、`S43_ReloadZBDuosCashCup`（Reloadゼロビルド・デュオ）、`S43_ArenaCashCup`（アリーナ・ソロ）、`S43_PerformanceEvaluationTrios`（通常BR・トリオ）を`tournaments.json`に追加。S42 `S42_ArenaCashCup`も公式規則に基づき登録しました。
- 公式資料：
  - https://www.fortnite.com/competitive/events/S43_TriosCashCup/?region=EU
  - https://www.fortnite.com/competitive/events/S43_ReloadZBDuosCashCup/?region=EU
  - https://www.fortnite.com/competitive/events/S43_ArenaCashCup/?region=EU
  - https://www.fortnite.com/competitive/events/S43_PerformanceEvaluationTrios/?region=EU
- 上記はいずれも**参加確認のみ**で、賞金や予選突破の確定登録を行いません。現在の大会カタログには42大会を登録。アリーナは現行表示軸に専用モードがないため、表示上の`mode`は保守的に未確認としています。
- 実際の過去照合ジョブ（2026-11-05 10:49 UTC）は**506開催枠を対象**にし、そのうち**250枠がVictory Cup以外**。本人照合できた確認専用候補は8件で、現金賞金は`null`、公開登録は0件でした。

## 予選突破していない選手の出場戦績を自動登録（2026-11-05）
- **正式な賞金・予選突破・称号の戦績とは別に**、本人Epic IDが既存の登録選手と厳密に一致したOsirion公開APIの大会順位表記録を「出場戦績アーカイブ」へ自動保存します。予選突破していなくても順位・ポイント・キル・VR・試合数を保存しますが、**未確認の賞金やスキン報酬は決して確定しません**。
- `scripts/participation-sync.cjs` が大会一覧・順位表を読み取り、`scripts/participation-archive.cjs` が重複防止と月別保存を担当。`participation-index.json` に件数・月・選手名の検索索引、`participation/YYYY-MM.json` に個々の出場戦績を保存します。`results.json` と `updates.json` は触りません。
- 本人と確認済みのEpic ID以外、曖昧な別名、全員分の本人照合ができないデュオ・トリオ・スクワッド、データ欠損・数値矛盾、すでに正式な戦績として登録した同一チームの結果は除外します。ローカルに保存するのは一致選手の成績のみで、公開APIの順位表全件を転載しません。
- **予選敗退の確定判断は、公式の地域別通過枠が登録済みであり、その上位順位を超えた場合のみ**「通過圏外」を表示します。それ以外は「出場確認」に統一し、順位表の参加だけをもって予選突破・賞金獲得・スキン獲得を判定しません。
- 月別の「出場戦績」を海外戦績アーカイブの下に表示。選手プロフィールにも本人の記録だけを必要な月のファイルから遅延読込します。**賞金合計・正式戦績ランキング・累計称号・特別称号などには含みません**。AOT PR v1.9には同一開催枠の二重登録を避けながら参加・順位・キルの基本点だけを反映し、突破・賞金・スキンなどのボーナスを与えません。
- GitHub Actions `.github/workflows/participation-sync.yml` を **UTC 02:53 / 08:53 / 14:53 / 20:53（日本時間 11:53 / 17:53 / 23:53 / 05:53）**に設定。初期対象は2026/08/01以降・ME/EU/NAC/NAW/OCE/BR。1実行あたり最大36順位表ページ・最大5開催枠・1開催枠あたり最大12ページ、累計40ページまでです。翌回は`participation-scan.json`を参照して続きから取得します。上限40ページを超える順位は調査未完了として扱い、全参加者の網羅を保証しません。上限値は安全に再設定可能です。
- GitHub Actionsのスキャンは通常のVictory Cup・過去の公式承認ジョブと同じ排他グループを使い、過剰な同時APIアクセスを抑えます。JSONと単体テスト成功時のみ月別データをコミットします。
- **初回実行の実測**：439アカウントIDを照合し、26順位表ページから出場戦績12件を月別ファイル（2026-08／2026-10）へ自動登録。既存正式戦績と重なる7件は重複回避。初回登録にはChampion Aphrodite FNCS Cup（2026-08-01、ME）やInoxtag Icon Cup（2026-10-26、NAW）などが含まれます。全大会の取得完了ではありません。

- AOT PRの重複照合と基本点の詳細はREADME「出場戦績アーカイブの基本AOT PR（v1.9）」を参照してください。

## 調査対象を2024年からに拡張（2026年11月5日）
- 過去大会の確認期間・本人確認済み出場履歴の開始日を2024-05-29に拡大。これ以前は公開APIの履歴未確認のため対象に含めない。
- 大会カレンダーで公式のEpic IDと名称を確認できた24分類（S30/S31/S32/S33/S34/S36/S37/S39/S40/S41）をカタログに追加。新カテゴリは確認候補の収集対象であり、個々の通過・賞金を確定しない。
- 毎日の過去大会スキャンは2024・2025・2026の各年およびVictory Cup/その他の系列に枠を配分。1日最大24ページ・6ウィンドウ・1ウィンドウ最大4ページに抑えて途中進捗を保存する。
- 2024/2025年の未検証大会は自動承認しない。公式ルールを検証済みのS41/S42一部Victory Cupのみ引き続き承認し、確認済み出場履歴は賞金・PR・称号から分離する。
- 既存の `results.json` と `players.json`、賞金額・順位・各種ランキングはこの変更では一切編集していない。

## 2024年のSolo Victory公式規則による限定承認（2026年11月5日）
- Chapter 5 Season 3（S30）およびSeason 4（S31）の**ソロ通常BR/ソロZB**に限って、Epicの当時の公式規則による「予選突破」の自動照合に対応。地域別規則と順位表の両方を検証済み、本人Epic ID一致、最大7試合、順位表全ページ確認、既存記録と非重複の場合に限る。賞金$0の予選突破としてのみ記録する。決勝0VRの場合のみ$0の賞金なし決勝を登録。
- 当時の公式規則はNA一地域であり、NAC/NAWへの通過枠の換算は不可能。この二地域は自動承認から除外する。現金賞金が発生する決勝や他の大会シリーズも引き続き確認専用。
- 公式ルール：https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules および https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules


## 2024・2025年の戦績を優先して取り込む改良（2026年11月5日）
- 公開済み戦績の実測：2024年20件、2025年6件、2026年1218件。登録済みは合計1244件（2026-11-05確認時点）。
- 過去大会スキャナーを、年ごとのVictory Cup/その他シリーズに加え、**既に出典が確認された開催日・同一イベントID/ラウンドID・地域**を優先するスケジューリングへ変更。順位表の未確認選手を名前の似かよりで紐づけることはしない。
- 過去大会は1回最大32ページ・8開催枠・1開催枠最大4ページに拡大。各年への枠配分とAPI負荷上限を維持。出場戦績スキャナーも2024年・2025年の各1枠を予約して、2026年だけに偏らないようにした。
- 2025年7〜8月の「Squid Grounds Cash Cup」はEpic公式大会ページで**Duos/Battle Royale**と確認して、S36の大会カタログに追加。2025年12月「$1 Million Unreal Cup」も確認対象に追加した。ただし両大会とも賞金額・予選突破を順位表だけで自動確定せず、本人Epic IDが完全一致した場合のみ出場履歴に保存する。
- 出典：https://www.fortnite.com/competitive/events/S36_SquidGroundVictoryDuosCup/?region=NAC

## 出場履歴の重複修正（2026-11-05）
- Trackerの`?window=`とEpic公式の`?round=`を同一ラウンドIDとして比較し、既存の正式戦績と重なる出場履歴を保存前・保存後ともに除外する。異なるラウンドは混同しない。
- 月別ファイルと集計索引は次回の参加確認ジョブで自動的に修復し、正式な賞金戦績は変更しない。

## 過去決勝順位表の取得完了を優先（2026年11月5日）
- 2024〜2026年の各年を公平に調べつつ、古い年を先に選択。証拠付きの2024年決勝はページ取得を優先し、公式規則による0VR賞金なし決勝戦績の自動承認を早める。
- 1回最大40ページ・最大6開催枠・1開催枠最大20ページ。未処理の他の開催枠に最低2ページずつ枠を残すため、大きな1大会が他の地域・カテゴリを占有しない。
- 公式順位表の取得完了・Epic IDの本人照合・試合数上限・既存記録重複排除などの安全条件は維持する。

## 自動更新の継続性・速度・失敗耐性改善（2026-11-05）
- 過去大会の調査上限日を`rolling`とし、現在のJST日付（公式終了から最低4時間経過）まで自動延長。2026-11-04固定で新規大会が履歴バックフィルから漏れる問題を解消。`history-sync-status.json`には実際に評価した終了日と`dateMode`を記録する。
- 直近7日間の自動調査を1回最大2→4開催枠、30→36ページに拡張。進捗がある大会の完了を優先し、新しい大会も優先。Victory Cupと他の大会系列の公平枠を確保し、参加確認専用大会の報酬は勝手に確定しない。
- 履歴調査の優先順位は、Epicの公式規則で自動承認可能な大会と、順位表の取得が完了間近の大会を高優先にする。年・大会系列の公平枠は維持する。
- Osirion APIの一時的なタイムアウト/429/5xxを1回再試行し、それでも失敗した順位表は既存チェックポイントと候補を保持して後日再開。スキーマ不正等の永続的なエラーは再試行せずに停止。
- 処理件数増加でカンマ区切りになる戦績件数を想定したUI回帰テストへ修正。既存`results.json`/`players.json`/賞金の内容は直接編集しない。
