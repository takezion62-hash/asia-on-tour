# 第5段階 — CI全体の所要時間・安全性監査（2026-11-15 JST）

検証対象: ASIA ON TOUR / `main`。このレポートは公開成績・現金賞金の変更を指示するものではない。GitHub Actions の実測ログ、現行ワークフロー、正本・公開用 manifest を照合した記録。

## 1. 実行時間（GitHub Actions の created_at → updated_at）

| 比較対象 | run ID | 全体 | 単体テスト | 過去大会 dry-run | 結果 |
|---|---|---:|---:|---:|---|
| 第1段階 PR #120 | [43605938900](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43605938900) | 12分51秒 | 584.10秒 / 697件 | 131.72秒 / 23本 | 成功 |
| 第2段階 PR #121 | [43607847455](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43607847455) | 6分57秒 | 291.01秒 / 697件 | 76.53秒 / 23本 | 成功 |
| 第3段階 PR #123 | [43609238178](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43609238178) | 9分31秒 | 388.74秒 / 700件 | 133.32秒 / 23本 | 成功 |
| 第4段階 PR #124 | [43612947769](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43612947769) | 7分13秒 | 377.59秒 / 707件 | 15.72秒 / 24本 | 成功 |
| 第4段階マージ後 main | [43648135251](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43648135251) | 9分15秒 | 411.27秒 / 707件 | 15.04秒 / 24本 | 成功（必須ゲート PASS） |

- 第1段階 PR とマージ後 main の全体時間は 771秒→555秒、**216秒短縮（約28%）**。ただし **PR と main はイベント・変更内容・実行負荷が異なり、速度の因果効果として断定できない**。
- 第2段階 PR の単体テストは 584.10秒→291.01秒の比較で約50%短縮。ただしジョブ競合や件数の変化で全体時間は上下するため「毎回半分」を保証しない。
- 第3段階以降、通常の機能ブランチCIは `pull_request` のみ、`main` は `push` で検証。PR #123 のコミットでは通常CIが1実行のみだった。
- 最後の通常CIは完了し、unit / PC・スマホ4分割 / 最終required gate がすべて success。

### シーズン再生成（同一ワークフロー）

| 比較対象 | run ID | 全体 | 結果 |
|---|---|---:|---|
| 改善前（リトライなし） | [43603475925](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43603475925) | 7分23秒 | 成功 |
| 改善後 | [43648135234](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43648135234) | 1分10秒 | 成功 |
| 参考：改善前の競合再試行 | [43611073193](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43611073193) | 9分43秒 | 競合を安全に再試行し成功 |

- 443秒→70秒、**373秒短縮（約84%）**。比較した2実行でデータ件数・更新内容が異なるため、再生成処理単独の純粋なベンチマークではない。
- 改善後は21件の戦績を追加し、`main` の更新との競合を起こさずに終了。
- `--dry-run` と本反映、全検証、競合時の最大5回の再試行は残している。

## 2. データ整合性・賞金の確認

2026-11-15 の確認時点での `main`（`014bb5d7d1d112dcf329e283134e112639ef3fa2`）：

| 項目 | 正本 / 公開用 | 結果 |
|---|---|---|
| 戦績数 | `source-results/manifest.json`: 7,287 / `season-data/manifest.json`: 7,287 | 一致 |
| 順序 | 正本 `recordOrder`: 7,287 ID | 正本件数と一致 |
| 正本シャード | 22 | 読み込み・チェックに成功 |
| 公開用シーズン区分 | 21 | 出力チェックに成功 |
| 公開用選手数 | 647 | 正常 |
| 個人賞金 | 正本 8,237,000 cents / 公開用 $82,370 | 一致 |

確認した安全柵：

1. `source-results-store.cjs verify` はシャードSHA-256、重複ID、順序、チーム賞金・個人賞金、正本のチェックサムを検証
2. `build-source-results.cjs --check` と `build-season-data.cjs --check` が正本と生成物の整合性を確認
3. `validate-data.cjs`、`validate-approvals.cjs`、`validate-updates.cjs`、候補索引の `--check` が成功
4. 承認履歴の索引化は元の `collision()` で検証し、索引化前の全件走査と結果・順序が一致する回帰テストを通過
5. 再生成の各スクリプトは `--dry-run` を先に実行。コミット前に差分検査を行い、`main` が進んだ場合は最新を再取得して最初から再検証（force-pushしない）
6. 必須CIゲートは単体テスト失敗、PC・スマホテスト失敗、未確認の変更判定を PASS にしない

## 3. 残る注意点

- **全体のCIはまだ変動する**。第4段階後の main 実測は9分15秒で、第2段階のPR実測6分57秒より長い。GitHubランナー、検証対象データ、ジョブ待機時間の影響があり、全体の固定的な高速化率を断定できない。
- **マージ後CIのテスト対象と、その後の生成データに時差がある**。CI [43648135251](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43648135251) は正本7,266件のスナップショットで実行。その後、再生成ジョブ [43648135234](https://github.com/takezion62-hash/asia-on-tour/actions/runs/43648135234) が正本7,287件を独立の検証一式に通した。`[skip ci]` 付き生成コミット上の **全PC・スマホE2Eはこの監査時点では別途実行されていない**。この点を全体の完全検証と混同しないこと。
- 公式大会順位や選手の同一人物性の正しさは、構造・差分テストだけでは証明できず、根拠資料との照合が引き続き必要。

## 4. 本PRの変更

- `review-timing.yml` の既存 read-only `workflow_run` 監視に **Rebuild lightweight season data** を追加。今後は通常CI・公開・再生成の所要時間が、既存の30日間保存タイミングレポートに残る（`actions: read` / `contents: read`）。
- `tests.yml` に残る「過去大会23本」という古い見出しを、登録数の変化に依存しない見出しへ更新（実際の実行本数は24）。
- `tests/ci-stage5-runtime-safety.test.cjs` を追加し、測定対象と権限、データ保護の再検証手順、dry-runの失敗伝播を回帰テストする。

**本PRは公開用JSONや自動承認ルールを変更しない。マージ前に全PR CIを合格させる。**
