# ASIA ON TOUR — コード整理台帳

2026-11-11 第1段階：現役スクリプトの仕分けと、一度きりの順位訂正処理1本の整理

## 方針

成績、個人賞金、選手の本人確認、出典、承認・更新履歴、サイト表示、自動更新を**変更せず**、過去の訂正スクリプトの誤実行を防ぐ。古い名前や長さだけでプログラムを削除しない。

## 現状の規模

整理前のツリーは264ファイルで、scripts/ に67本、tests/ に65本のCJSファイル、.github/workflows/ に13本のワークフローがあった。

**13本のActionsは今回変更しない。** 特に history-sync.yml が使う公式検証済み掲載処理や、賞金の根拠を検証するテストを残す。

## 第1段階の変更

- **削除した実行ファイル1本**：scripts/correct-20261107-3peace-job-rank.cjs
- **根拠**：当該順位訂正はすでに適用済みで、updates.json に corrected-20261107-performance-3peace-job-rank702 が存在する。現行のワークフロー、npmスクリプト、処理スクリプト、テストから、この実行ファイルへの静的参照がない。
- **保持したもの**：修正済みの順位・元の成績、賞金、出典、承認履歴、更新履歴。削除された旧ソースコードもGitのコミット履歴から復元可能。
- **追加した保守テスト**：tests/script-lifecycle.test.cjs。現役スクリプトの利用状況を Actions / package.json / scripts / tests の静的参照から分類し、今回消したファイルへの生きた参照がないことと訂正の台帳が残ることを検査する。
- **変更しないもの**：results.json、players.json、tournaments.json、updates.json、賞金・審査台帳、HTML/JS/CSS、13本のActions、既存のテスト。

## 仕分けの4分類

1. **entrypoint**：Actionsやpackage.jsonから実行される現役の入口
2. **script-dependency**：別の処理スクリプトから参照
3. **test-dependency**：テストから参照。元の処理コードを削除すると回帰テストが壊れる
4. **review-candidate**：上記の静的参照がない。これは**削除許可ではない**。動的実行・手動運用・既存の修正履歴を追加調査する

仕分けは実行時の完全な依存関係の証明ではない。候補の削除前には、過去の変更が適用済みか、現役入口の参照がないか、検証・PCスマホテストが通るか個別に確認する。

## 第2段階の変更（2026-11-11）

- **今回削除する実行ファイルは1本のみ**：scripts/fix-unreal-oce-duo-personal-payout.cjs
- **適用済みの根拠**：updates.json に fix-unreal-cup-oce-20251220-personal-50 があり、history-sync-reviewed.json の auto-s39-4d5f1e94f897 に personalAwardCorrection: { amount: 50, perPlayer: true } が記録されている
- **保護する内容**：2025-12-20 OCE $1 Million Unreal Cup 172位、まいにちフロッパー / mint、チーム賞金$100、個人各$50、原本順位表とEpic公式ルール
- **利用状況**：第1段階の AOT_SCRIPT_USAGE_AUDIT で実行入口・内部依存・テスト依存のいずれにも該当しない review-candidate と判定。今回のテストで現役Actions、package.json、scripts、testsの残留参照を禁止
- **新たな安全策**：tests/script-lifecycle.test.cjs に、実行ファイルの削除だけでなく実際の公開結果・個人賞金・更新履歴・出典付き承認履歴が維持されていることを確かめる回帰テストを追加
- **今回も変更しない**：results.json、history-sync-reviewed.json、approval-history.json、updates.json などのデータ、現役Actions、画面コード

当時の修正スクリプトを再実行せず、正しい個人賞金が保たれていることをテストで守る。未使用の静的解析だけで別のファイルを削除しない。

## 第3段階の変更（2026-11-11）

- **整理した実行ファイルは1本だけ**：scripts/repair-historical-session-dates.cjs
- **修正適用済みの証拠**：updates.json の site-fix-session-dates-and-duplicate-finals-20261106 に、14件の開催日JST統一とNAC Solo Victory Cup決勝の重複4件解消が記録されている
- **重複判定の証拠**：history-sync-reviewed.json に対象4件の already-published と、もとの手動掲載結果の existingId が残されている
- **現役参照**：前段階の AOT_SCRIPT_USAGE_AUDIT で review-candidate に分類された。現行のActions、npm scripts、ほかの処理スクリプト、テストから実行参照がないことを新規回帰テストで監視する
- **保護する内容**：対象14件のJST開催日・元の戦績IDと出典、重複除外した4件の既存結果と審査記録。データや賞金・本番画面・現在の13本のActionsは一切変更しない
- **追加した安全テスト**：tests/script-lifecycle.test.cjs に、JST修正済みの全14レコードと重複除外済み4レコード、履歴マーカーが存在し続ける検証を追加

このスクリプトは以前の古い日付・重複データが存在することを前提にしていた一度きりの修復コードであり、現在の自動更新には再実行不要。元のソースコードはGit履歴から復旧可能。
## 次の段階（未実施）

- 実行中の複数の公式検証済み掲載スクリプトの共通化（別変更で実施）
- 確実に不要と証明されたその他の一度きりの修正ファイルの整理
- GitHub Actionsの重複実行・JSON読込速度の見直し

現時点で大規模削除はしない。手動掲載や例外賞金を単なる参加記録に変えたり、既存の確定金額を再計算したりしない。

## 第4段階の変更（2026-11-11、まとめて4本）

過去の**確認済み掲載処理だけ**をまとめて整理する。静的利用状況監査で review-candidate と判定され、現役Actions／npm／スクリプト／テストから参照がない4本に限定。

| 旧実行ファイル | 公開済み根拠 | 保護する掲載件数 |
| --- | --- | ---: |
| `manual-review-20261107-oce-qualifiers3.cjs` | `review-20261107-oce-s31-qualifier-last-three` | 3 |
| `manual-review-20261107-round1-21.cjs` | `review-20261107-round1-participation-21` | 21 |
| `manual-review-20261107-s31-aphrodite.cjs` | `review-20261107-s31-victory-aphrodite-38` | 37（38候補中） |
| `publish-last-two-nov11.cjs` | `verified-final-reviews-20261111` | 2 |

- 63件の掲載ID・公式出典・確定賞金額・審査決定・確認待ちからの除去を `tests/script-lifecycle.test.cjs` で回帰検証
- 特に Karf / huggyfv のデュオ賞金チーム$200と、Clix Cup決勝0VRの$0を固定検証
- 既存の results / players / tournaments、各承認台帳、更新履歴、ワークフロー、画面コードは一切変更しない
- 実行コードのみGit管理対象から削除。監査・復元が必要な場合はGitコミット履歴を使用
- `publish-verified-final4-persona.cjs` など、現役テスト依存または状況が曖昧なものは今回は除外

次回も自動更新・公式検証済み掲載処理を先に整理・共通化せず、一度きりの完了済みスクリプトだけを証拠付きで検討する。

## 第5段階の変更（2026-11-11、完了済み4バッチを一括整理）

「手動レビューで掲載済み」「現役の13 Actions / npm / 別スクリプト / テストから静的参照なし」「GitHubの更新台帳と承認履歴が一致」の条件を満たす4本だけを削除する。

| 削除する一度きりの旧実行ファイル | 既存の掲載マーカー | 掲載件数 |
| --- | --- | ---: |
| `manual-review-history-20261107-rule30.cjs` | `manual-history-20261107-rule-30` | 30 |
| `manual-review-history-20261107-attendance50.cjs` | `manual-history-20261107-attendance-50` | 38 |
| `manual-review-20261107-followup-33.cjs` | `verified-history-20261107-followup-33` | 30 |
| `manual-review-20261107-new-23.cjs` | `verified-review-20261107-21-history-and-2-recent` | 17 |

合計115件。各マーカーは`updates.json`に1回ずつ記録済み。115件は全て掲載承認履歴があり、現在の確認待ちに残っていないことを削除前に確認した。17件バッチで解消したOne Piece: Zoro Mobile Cupの重複2件も個別に保護する。

`tests/script-lifecycle.test.cjs`に115件の公開ID・公式出典・賞金値（未確認のnullも区別）・承認履歴・確認待ち除外の回帰テストと、Zoro Cupの重複抑止テストを追加。公開データ、賞金、選手名、大会枠、審査台帳、自動更新、画面、13本のActionsは変更しない。

対象候補が全て完了したわけではない（50件検討→38件掲載、33件検討→30件掲載、23件検討→17件掲載）。掲載されなかった候補の証拠と保留判断を削除する意図はなく、Git履歴・既存のレビュー台帳に残す。今回も既存スクリプトを再実行せず、現行の自動処理を共通化しない。

## 第6段階の変更（2026-11-11、完了済み監査4本）

過去の固定された監査・一度きりの直接掲載処理だけをまとめて削除する。どのファイルも、前回の静的利用状況監査で `review-candidate` に分類され、現役Actions・npm・別スクリプト・テストからの参照がない。再実行は不要で、元コードはGit履歴から復元可能。

| 廃止する旧実行ファイル | 適用済み更新マーカー | 当時の結果 |
| --- | --- | --- |
| `manual-review-20261107-final-audit.cjs` | `review-20261107-final-voided-and-duplicates` | 無効大会13件とEpic順位競合を解決、掲載0件 |
| `manual-review-20261107-unreal-na-west-voided.cjs` | `review-20261107-unreal-na-west-and-voided-oce-20` | 無効大会19件とNAW Unreal賞金1件 |
| `manual-unreal-20261107-teamcash.cjs` | `manual-unreal-20261107-team-prize` | OCE Unreal賞金1件 |
| `manual-review-history-95.cjs` | `manual-reviewed-history-95-20261106` | 77件掲載・18件重複回避 |

成果の保護：**79件の公開ID／18件の重複マッピング／32件のVOIDED除外**と、ME Solo Reload TestのEpic公式75位、NAW Unreal Cupチーム$200・個人$100、OCE Unreal Cupチーム$100・個人$50（後日修正済み）を固定検証する。

`tests/script-lifecycle.test.cjs` に回帰テストを追加。`data/manual-approvals/20261106-remaining-95.json` と既存の結果・更新・承認履歴はそのまま保持する。既存の成績・賞金・選手・大会・保留・承認台帳・13本のActions・フロントエンド・自動処理は変更しない。

**残りの見通し**：整理開始時に67本あったCJSスクリプトは今回後52本。静的未参照候補は暫定約12本だが、中には手動運用中・検証中の処理もあり、残り全部を削除する計画ではない。引き続き証拠付きで個別に選定する。

### 第5段階テストの補足修正（2026-11-11）

第5段階の回帰テストで、もともと未確定の賞金を `null` として保持している参加記録まで「賞金額は必ず数値」と誤判定していたことを確認。公開データは変更せず、テストを「非負の確定数値または未確認の `null`」に修正した。未確認賞金を根拠なく `$0` と見なさない。第6段階の既知のUnreal Cup賞金額は引き続き金額一致で監視する。

## 第7段階の変更（2026-11-11、2026-11-08〜09の一度きりの掲載処理4本）

現役のActions / npm scripts / 実行スクリプト / テストから静的参照がない、**実行済みの単発掲載スクリプト**4本だけを整理。削除対象は再利用可能な承認ロジックではなく、当日の固定候補IDを持つ実行処理。

| 一度きりの旧実行ファイル | 公開済み更新ID | 掲載件数 |
| --- | --- | ---: |
| `publish-reviewed-direct-20261108.cjs` | `assistant-reviewed-pending-20261108` | 49 |
| `publish-reviewed-pending-evening-20261108.cjs` | `assistant-reviewed-pending-20261108-evening` | 30 |
| `publish-reviewed-pending-morning-20261109.cjs` | `assistant-reviewed-pending-20261109-morning` | 20 |
| `publish-reviewed-round2-20261109.cjs` | `assistant-reviewed-pending-round2-20261109` | 70 |

合計**169件、すべて別ID**。削除前に、更新履歴の各マーカーが1件ずつ存在し、169件すべて承認済みで現在の確認待ちにはないことを照合済み。

`tests/script-lifecycle.test.cjs` に、ファイル廃止と残留参照ゼロ、169件の公開ID・出典・掲載承認・キュー除外・未確定賞金のnull許容を守る回帰テストを追加した。公開成績・個人賞金・選手・大会枠・同期設定・審査台帳・GitHub Actions・画面は一切変更しない。

これは古い掲載「処理コード」の整理であり、既存の戦績の削除ではない。原本はGitのコミット履歴から復旧可能。ライブの自動承認と公式ルール検証の共通ロジックは保持する。

## 第8段階の変更（2026-11-11、11月9日の一時処理と11月6日の旧実行ランナー）

第7段階までで処理済みの掲載・監査結果は変更せず、未使用と確認した**4つの一度きりの実行ファイル**だけを整理する。

| 廃止する旧ランナー | 公開済み更新履歴 | 掲載済み |
| --- | --- | ---: |
| `publish-reviewed-batch-late-20261109.cjs` | `assistant-verified-batch-20261109-late` | 127 |
| `verify-unreal-nac-pending-20261109.cjs` | `assistant-verified-nac-unreal-five-20261109` | 5 |
| `manual-review-current-25-run.cjs` | `reviewed-25-results-20261106` | 23（25件確認、重複2件） |
| `manual-review-history-27-run.cjs` | `history-reviewed-27-20261106` | 27 |

合計**182件の公開成績**を保護する。4つの更新マーカーはそれぞれ1件、掲載182 IDはすべて一意で、承認履歴が残り、現在の確認待ちには含まれていないと削除前に照合済み。

次の不変条件も追加テストで守る。

- 2026-11-06の25件審査で解消した重複2件の対応先が残ること
- ME Duos Cash Cup 2024-09-13の17位・チーム$200・個人各$100を保持すること
- NAC Unreal Cupの公式100ページ確認済みの5組の賞金額が未確定値に戻らないこと
- 未確認賞金は`null`のまま許容して、不適切に$0と断定しないこと

`manual-review-current-25.cjs`、`manual-review-history-27.cjs`とその単体テスト、監査結果JSONは削除しない。履歴や調査証拠は維持し、原本の一度きりの実行ソースもGitのコミット履歴から復元可能。今回も結果・賞金・承認台帳・13本のActions・自動更新・フロントエンドのデータは変更しない。

## 第9段階の変更（2026-11-11、旧単発処理の最終選別）

第8段階の後に未参照候補として残った4本を調査。**更新履歴と公開データの照合により実行完了が確認された次の2本のみ**を退役させる。

| 整理した旧処理 | 根拠となる更新ID | 掲載実績 |
| --- | --- | ---: |
| `apply-reviewed-participation.cjs` | `manual-reviewed-participation-20261106` | 8件の参加確認 |
| `publish-verified-remaining-pending.cjs` | `pending-review-batch-3-20261111` | 5件の公式確認済み大会成績 |

13件の公開ID・重複防止・公式出典・未確認賞金の適切な扱いを新しい回帰テストで守る。前者の8件は `data/manual-approvals/20261106-participation.json` の手動確認リストとも照合し、賞金$0の参加記録として維持する。後者の5件は `approval-history.json` の承認記録を維持する。

**削除を見送った候補**：`audit-review-round2-20261109.cjs` は確認待ち候補の読み取り専用診断であり、`auto-sync.cjs` は旧方式ながら手動フィード実行の入口を持つため、安全な移行・代替の確認前には廃止しない。静的未参照であっても削除対象とは限らない。

今回も `results.json`、賞金、選手名、承認台帳、自動更新、GitHub Actions、画面コードの内容は変更しない。元の処理ソースはGitのコミット履歴から復元可能。これで使い終わった旧ランナーの削除は一段落し、次は共通処理と高速化の保守を小さな単位で進める。

## 第10段階の変更（2026-11-11、大会別掲載スクリプトの段階的な共通化）

対象：`publish-verified-cash-playstation-pending.cjs`、`publish-verified-cosmetic-pending.cjs`、`publish-verified-fncs-performance-days.cjs` の3つ。これらは既に `manual-approval-core.cjs` の本人Epic ID・開催枠・保存済み順位表・重複確認を再利用しているため、既存の大会別判定を統合・変更せず、**繰り返していた入出力と掲載履歴の処理**だけを `scripts/reviewed-publication-core.cjs` に集約する。

- `loadReviewDb(root)`：結果、選手、大会、確認候補、スキャン、承認履歴、掲載履歴を全3スクリプトで同じ構造に読み込む。
- `upsertPublicationLog(updates,options)`：掲載履歴マーカーの新規作成と既存IDの重複除外を共通化。元のタイトル・日付、既存バッチ専用の説明文と掲載件数は保持する。不正なID、空バッチ、同一マーカーの二重登録は中止する。
- `writeReviewDb(root,db)`：公開結果、候補・状態、承認履歴、掲載履歴の従来と同じ7 JSONファイルだけを書き戻す。選手・大会・スキャンは読み取り専用のまま。
- `tests/reviewed-publication-core.test.cjs`：構造・読み書き7ファイル・既存履歴の維持・新規履歴・冪等性・二重マーカー停止・3つのスクリプトの利用をテストする。

**変えないもの**：各大会の予選突破順位、賞金条件、衣装報酬ライン、参加確認の扱い、`manual-approval-core` の検証、dry-run条件、掲載履歴の既存ID、成績JSON、賞金、選手・大会マスター、13本のGitHub Actions。今回の範囲は共通の入出力と履歴管理に限定し、未検証の一括書換えや自動掲載の拡大はしない。

次の段階では、これを経由できる別の大会別掲載スクリプトも、個別のテストで同等性を確認しながら少数ずつ移行する。

## 第11段階の変更（2026-11-11、大会別掲載12本の共通エンジン接続）

大会別の公開スクリプト12本のうち、先に移行したCash/PlayStation・衣装大会・FNCS/Performance系3本に続き、過去大会の予選・決勝・Console Duos・11月の追加審査を扱う**残り9本**も `scripts/reviewed-publication-core.cjs` の共通ファイルアダプタへ接続した。9本の重複したファイル読み込み・書き戻し処理を削り、同じJSONフォーマット（インデント2・末尾改行）を維持する。

今回の中心改善は、`publish-verified-nov11-round2.cjs` / `publish-verified-nov11-round3.cjs` が持っていた**同一の公式イベント・本人Epic ID・保存順位表・開催枠・重複照合関数**を `verifyEpicReviewEvidence` として完全共通化したこと。元々同一の実装だけを移動し、各大会の `classify` と公式ルール・突破閾値・チーム現金賞金・未確認報酬の扱いは変更しない。

さらに `publish-extra-verified-nov11.cjs` の再掲載履歴更新に、既存共通エンジンの `upsertPublicationLog` を利用。元のマーカー、同じタイトルと説明文の人数連動更新、レコードIDの一意性と冪等性を維持するため、共通ヘルパーに任意の `existingTitle` 関数を追加した。

`tests/tournament-publication-unification.test.cjs` を追加し、12本すべての利用、JSON入出力互換性、公式URL偽装・順位改変・チーム同一性・カレンダー不一致・重複の拒否、更新マーカーの冪等性を検証する。

**変更しない**：`manual-approval-core.cjs` と各公式賞金表・突破ライン・衣装賞品規則、結果・賞金・選手・大会・審査台帳JSON、GitHub Actions、画面表示。利用中の大会別分類ロジックは保持し、安全性の判定まで一律に混ぜない。将来は新規大会を追加する際に、この共通エンジンと既存の大会別規則を組み合わせて新しい一時スクリプトを増やさない構造を目指す。

## 第12段階の変更（2026-11-11、GitHub Actionsの重複テストと不要なAPI再実行を削減）

**普段の自動チェックは `.github/workflows/tests.yml` に一本化。** このワークフローはpush・PR・手動実行でJSON検証、単体テスト、全PC・スマホE2Eを並列分割で走らせ、従来の必須チェック名と失敗時に止まる集約ジョブを保持する。ドキュメントだけのpushでは不要なフルテストを省く一方、PRチェックは継続する。

従来の専用6ワークフロー（カレンダー、称号、ルール、Unreal、安全なマージ、スキャン再試行）は、**push/PRで重複実行する設定を外し、手動の `workflow_dispatch` だけに変更**。各診断ジョブと既存テスト内容は削除しない。重要な単体テストとブラウザ試験はフルCIの対象に残る。外部Osirion APIプローブはフルCIに重複しないため、引き続き該当コード変更時にも動く。

定期自動更新4系統（直近結果・過去結果・参加アーカイブ・過去カレンダー）のpush用 `paths` から、テストファイルのみを削除。**実際の処理コード・設定・公式ルールを変更した際の起動、元のcron、手動実行、ロック `cancel-in-progress:false` は維持**。テストコードだけを直した時にAPIの順位表を取り直したりJSON公開処理を再実行したりしない。

管理者が確認した成績をPRに出す `reviewed-candidate-publication.yml` は、従来の「先に検証と特定unit」＋「`npm test` で検証・全unitを再実行」を廃止し、**`npm run validate` → `npm run test:unit` → Chromium準備 → `npm run test:e2e` を各1回**実行する構造に変更。プレビュー専用・明示CONFIRM・PR経由の人間承認は維持する。

`tests/actions-dedup.test.cjs` を追加し、6本の専用Actionsの手動保持、フルCIの安全性、4つのスケジュール、重複実行防止、PR承認フローを固定検証する。

**注意：** 以前の専用Actionsのチェック名をブランチ保護の必須チェックに登録している場合は、`Data and site tests` の集約チェックへ変更する必要がある。現状の自動結果更新やサイト本体のコード、成績・賞金・レビュー記録は変更しない。実際のActions実行時間とランナー使用量の削減幅は今後の実行履歴で確認する。

## 第13段階の変更（2026-11-11、画面表示とデータ読み込みの体感最適化）

成績の正確性や表示内容を変えず、ブラウザの初回レンダリングと大規模データの表示処理を改善する。約5MBの `results.json` は全文を保持し、賞金・本人ID・出典・順位・イベント分類・報酬計算の仕組みは変更しない。

1. **プレイヤー名鑑の段階描画**：従来は全選手カードと生涯実績プレビューを1回でHTML生成していた。最初は60件だけ描画し、「さらに60名表示」で残りを60件ずつ追記する。検索と並び順は全選手に対して実行し、初回表示に必要な実績計算・DOM生成量を抑える。検索/並び替え/シーズン変更時は60件へ戻る。選手プロフィールはディープリンクを含め引き続き直接開ける。
2. **カレンダーの月別インデックス**：公開結果は閲覧中に不変なので、選択シーズンごとに有効な日付・月の索引をWeakMapに保持。日付変更やカレンダー再描画時に全シーズン全戦績を走査せず、対象の月の記録だけを分類する。初期月・最終掲載日の取得も同じ索引を使い、巨大な日付配列のソートを避ける。外部の開催予定と過去大会月別JSONの遅延取得は現行どおり。
3. **更新履歴の遅延描画**：ホームには新着4件と最新更新3件だけ表示。全履歴カードやリンクのDOM生成を、更新履歴ページへの移動時まで延期する。更新履歴数・「さらに表示」・登録日の証拠は変わらない。
4. **回帰テスト**：`tests/optimization.spec.cjs` に名鑑60→120件と全選手検索・ソート切替、ホームの履歴遅延描画、カレンダー月内の日付操作を追加し、PC・スマホ両方で実行する。

表示用のキャッシュと段階描画だけを変更し、`results.json` 等の原本データや自動取得/承認/掲載のGitHub Actionsは触らない。実際のLCP等のミリ秒測定は実端末や継続的な性能観測が必要で、速度改善率の数値はここでは断定しない。

## 2026-11-11 ME Squads Victory Cup 確認候補の本人・順位・通過条件検証

管理者からの「確認候補を調べて掲載」依頼で、2026年11月10日JSTのS43 ME Event1 Round1を追加調査。Epic公式2026年11月1日公開規則は**EU 300、NAC 200、ME/OCE/BR/NAW/ASIA 120チーム**がRound2通過。Round1の現金賞金は$0、Round2のVR賞金は別開催枠でのみ確定する。
規則: https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-squads-victory-cup-chapter-7-mini-season-official-rules

`auto-sync-review.json` にある同日の10チームはEpic ID確認済み4人編成・公式順位・PTS・キル・VR・試合数を保持。元の `auto-sync-scan.json` にはRound1の公式ウィンドウの順位順検証済みチェックポイント（`rankingOrderValid=true`、最終照合順位1500）が残っている。ただし全32ページ中15ページのため「全順位表の取得完了」とはみなさない。

既存の `publish-verified-nov11-round2.cjs` にこの公式Round1を対象追加。本人ID、正確な順位とスコア、公式開催日・地域、保存済みウィンドウ、既存成績衝突を従来の共通 `verifyEpicReviewEvidence` で再検証し、結果のわかった個別10チームだけを判定する。
- 24/42/65/102位：上位120に入った4チームを「予選突破」と表示。
- 169/282/318/395/478/619位：Round1参加・順位として記録し、進出や賞金を認定しない。**予選と同じ開催枠にまとめるため `kind=予選` を保ち、突破バッジを付けない。**
- 10チームともRound1個人・チーム現金賞金は$0。Round2でのVRや支払いは未確認のため合算しない。
- 既存の `history-sync.yml` がこのスクリプトをdry-run→本番で走らせ、バリデーション後に安全にmainへコミットする。個別に巨大な `results.json` をAPIで上書きしない。

`scripts/squads-qualifier-rules.cjs` とテストを追加して、通過境界と不正候補の拒否、10件の二重掲載防止を維持。過去116件の確認待ち候補のうち、裏付けのない過去大会の賞金や未完了順位表は引き続き保留する。前回の画面最適化に伴って破綻していた旧VM単体テストの「全名鑑を同時描画」の固定前提もテスト環境だけで修正する。実ブラウザの60件ずつ表示は維持する。
