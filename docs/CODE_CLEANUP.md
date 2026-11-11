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

`tests/script-lifecycle.test.cjs`に115件の公開ID・公式出典・確認済みの賞金値・承認履歴・確認待ち除外の回帰テストと、Zoro Cupの重複抑止テストを追加。公開データ、賞金、選手名、大会枠、審査台帳、自動更新、画面、13本のActionsは変更しない。

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
