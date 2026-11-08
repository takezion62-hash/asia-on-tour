# ASIA ON TOUR — GitHub Actions 運用ガイド

2026年11月7日：一度限りの修正用ワークフロー19本を実行メニューから整理。定期更新・公式規則による安全な承認・既存テストは変更せず維持する。

## 日常運用はこの順で判断

| 目的 | 使用するワークフロー | 安全条件 |
| --- | --- | --- |
| 最新大会を自動調査 | `auto-sync.yml` | 定期実行。未確認は候補に保持し、公式規則で承認可能な分のみ自動掲載。既存成績との競合は保留。 |
| 過去大会を自動調査 | `history-sync.yml` | 定期実行。調査途中ページと再試行期限を保持。既存の戦績・賞金を安全マージで保護。 |
| Epic ID 確認済み参加アーカイブ | `participation-sync.yml` | 定期実行。参加確認と賞金獲得を混同しない。 |
| 過去の大会日程 | `calendar-history.yml` | 定期実行。日程の存在を選手の出場・賞金獲得に読み替えない。 |
| 調査候補を管理者が掲載申請 | `reviewed-candidate-publication.yml` | `candidate_ids` と根拠を確認 → `confirmation=CONFIRM` → **まず `preview_only=true`** で差分を検証 → `false` でPR作成。mainへ直接反映しない。 |
| 既存成績・賞金・名寄せの訂正 | **専用ワークフローを再利用しない** | 出典、元の戦績ID、変更前後、本人同一性、賞金の根拠を明記した変更PRで扱う。全体テスト合格後に確認してマージ。 |
| データ・UIの回帰テスト | `tests.yml` | JSON整合性＋単体テスト、PC・スマホE2Eを**並列実行**。どちらも成功した場合のみ既存名「JSON検証・単体テスト・PCスマホ回帰テスト」の最終ジョブが成功。 |
| 自動更新のマージ・再試行安全性 | `safe-sync-merge-tests.yml` / `scan-coverage-tests.yml` | 対象コードに絞った速い安全性テスト。 |
| 専門的なUI・規則回帰 | `calendar.yml` / `special-achievements.yml` / `tournament-rules-check.yml` / `unreal-auto-check.yml` | 全体テストとは別の早期検出のため保持。 |
| API形式の手動点検 | `osirion-probe.yml` | 読み取りのみ。結果を公開しない。 |

### 全体テストの高速化（2026年11月8日）

- `.github/workflows/tests.yml` は `unit`（`npm run validate` → `npm run test:unit`）と `browser`（`npm run test:e2e`、PC・スマホ両プロジェクト）を別ランナーで同時実行する。両ジョブは依存させない。
- 既存の必須チェック名 **「JSON検証・単体テスト・PCスマホ回帰テスト」** は `test` ジョブのまま維持する。`needs: [unit, browser]` と `if: always()` で失敗・スキップの場合も判定を実行し、**両方が `success` の場合だけ**パスする。既存のブランチ保護の必須チェックを削除・置換しない。
- Playwright の `workers: 2`、CIリトライ1回、PC/スマホ全件実行、失敗時の trace/screenshot と artifact 保存、ユニット全件実行は変更しない。成功判定のためのテスト省略、`continue-on-error`、失敗の無視は禁止。
- 変更はまずPRで検証し、両ジョブと最終ゲート成功・旧実行との時間比較を確認してからマージ。速度向上の目安は約7〜8分だが、GitHubランナーの混雑とデータ増加に左右される。
- `tests/workflow-inventory.test.cjs` は両テストの存在・並列性・必須チェックのfail-closed動作・Playwright安全設定を回帰検査する。CI全体が失敗した場合は最終ゲートを成功扱いにしない。

### 調査に失敗・途中停止したとき

1. AUTO SYNC 管理画面で「未着手」「調査途中」「再試行待機」「期限到来」と対象地域・年を確認する。
2. 通常は次の定期実行でチェックポイントから再開する。失敗したページだけを強引に「完了」にしない。
3. 明らかなAPI形式変更・ID不一致・同一人物の競合・未確定賞金は**自動的に修復・確定しない**。根拠を調べてからコード変更PRまたは承認PRで対応する。
4. mainへの手動の直接pushや、既存成績全体を置き換えるスクリプトの再実行は禁止。安全マージと既存CIを使う。
5. `tests.yml`、同期ジョブ、GitHub Pages は別々の実行結果。Pages成功だけで成績検証完了とは判断しない。

### 訂正PRの最低確認項目

- どの戦績ID・選手ID・大会・地域・ラウンドに対する訂正か
- 修正前後の順位・ポイント・キル・VR・個人/チーム賞金と証拠URL
- `results.json` と `updates.json`、必要なら `players.json` / `tournaments.json` の参照整合性
- 同じ選手・開催枠で別のIDによる重複登録がないか
- `npm run validate`、`npm run test:unit`、`npm run test:e2e`（または `npm test`）の成功
- 既存の承認履歴・確認候補・賞金を誤って削除・再生成していないか

## 廃止した一度きりのアクション（19本）

下記は当時の検証済みバッチを実行するための専用入口であり、今後の標準作業には使用しない。**YAMLだけを削除**し、当時のスクリプト・登録データ・Gitのコミット履歴は保持する。

- `.github/workflows/correct-20261107-3peace-job-rank.yml`
- `.github/workflows/fix-unreal-oce-duo-personal-payout.yml`
- `.github/workflows/manual-history-approval.yml`
- `.github/workflows/manual-review-20261107-dry-check.yml`
- `.github/workflows/manual-review-20261107-final-audit.yml`
- `.github/workflows/manual-review-20261107-followup-33.yml`
- `.github/workflows/manual-review-20261107-new-23.yml`
- `.github/workflows/manual-review-20261107-oce-qualifiers3.yml`
- `.github/workflows/manual-review-20261107-round1-21.yml`
- `.github/workflows/manual-review-20261107-s31-aphrodite.yml`
- `.github/workflows/manual-review-20261107-unreal-na-west-voided.yml`
- `.github/workflows/manual-review-current-25.yml`
- `.github/workflows/manual-review-history-20261107.yml`
- `.github/workflows/manual-review-history-95.yml`
- `.github/workflows/manual-review-history-attendance50.yml`
- `.github/workflows/manual-unreal-20261107-teamcash.yml`
- `.github/workflows/publish-reviewed-current-25.yml`
- `.github/workflows/publish-reviewed-history-27.yml`
- `.github/workflows/repair-session-dates.yml`

これらの専用処理は、掲載済みの戦績に対する再実行や誤った上書きを防ぐために運用から外した。確認済み候補の追加は汎用の `reviewed-candidate-publication.yml`、訂正・例外的な賞金処理は根拠付きPRへ移す。PRが検証前ならmainのデータは変更しない。

## 復旧

誤ってワークフローを廃止した場合でも、Git履歴に元のYAMLが残る。復帰が必要なときは、変更目的と安全性を再検証した専用PRで復旧し、削除前の日時固定スクリプトをそのまま手動実行しない。
