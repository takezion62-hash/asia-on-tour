# ASIA ON TOUR 第3弾 — 接続済みChatGPTから一括レビューを起動

GitHubへの依頼を、毎回の一時的なActionsファイル作成ではなく、ただ1つのJSONファイルで受け取る仕組み。

## 起動手順

1. 接続済みGitHubアプリが最新mainから ops/review-request/rYYYYMMDD-xxxxx 形式のブランチを作成
2. そのブランチに review-requests/launch.json だけを追加してコミット
3. 既存の reviewed-candidate-publication.yml が自動起動し、信頼済みmainのスクリプトで検証
4. 検証済み戦績だけを新しい reviewed-results/<run id>-<attempt> ブランチへ登録し、PRを自動作成
5. GitHub Actions作成PRは通常のpull_request CIが起動しないため、workflow_dispatchで必須CIを明示的に開始
6. 必須CI合格とmainの状態を再確認した上で接続済みGitHubアプリがマージし、Pages公開を確認

## launch.json の契約

```json
{
  "version": 1,
  "action": "publish-verified-batch",
  "id": "r20261113-example",
  "confirmation": "CONFIRM",
  "limit": 100,
  "baseSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "requestedAt": "2026-11-13T06:00:00.000Z",
  "candidateIds": []
}
```

上記のSHA/日時はサンプル。実際の依頼には直前のmain SHAとUTC時刻を使う。
candidateIdsを省略または空にすると未処理候補から最大limit件を検証。

## 保護条件

- 必ずユーザーの明示的な掲載依頼があること
- requestの親コミットはその時点のmainと完全一致し、変更ファイルはlaunch.json 1つのみ
- 不正なブランチ名、古い日時（3時間超）、偽装したmain SHA、無許可のJSON属性を拒否
- 依頼ブランチに含まれるコードは実行せず、信頼済みmainのみ実行
- 未確認賞金、スキン報酬、同定できない選手、重複疑惑を推定で掲載しない
- source-resultsとseason-dataの整合・賞金・重複・出典・承認履歴を検証する
- PRの変更範囲判定もmainのCI分類コードだけを実行。コードや不明差分はフルCIに戻す
- ActionsのGITHUB_TOKENによるmain直書き/自動マージは行わない。ChatGPT側で必須CI成功後にマージ
- 追加できる候補が無ければPRを作成しない

## 測定

候補の照合・重複・書込時間はreview-batch.cjsのJSONレポートに記録し、CI/Pagesは既存の計測Actionで確認。
目標は公開まで5分以内だが、CIキュー・公開待ち・追加調査の有無によって変わるため保証しない。

## PR作成権限が無い場合（2026-11-13の実運用確認）

リポジトリ設定で「Allow GitHub Actions to create and approve pull requests」が無効な場合、`gh pr create` は権限エラーになる。この場合も、検証済み `reviewed-results/<run id>-<attempt>` ブランチは作成済みなので、**公開失敗ではなく、接続済みGitHub AppによるPR作成待ち**として完了させる。

- ActionsのサマリーにブランチとPR作成URLを残す。権限以外のエラーは引き続き失敗させる
- ChatGPTの接続済みGitHub Appでそのブランチからmain宛てのPRを作り、通常のpull_request CIを発火させる
- データ/単体テストとPC・スマホの必須表示テストを確認し、最新mainとの競合を確認してからマージする
- この代替ルートではPR作成に接続済みアプリの追加操作が必要。GitHub ActionsだけでPR作成を完結するには該当リポジトリ設定を有効化する必要がある

実例: 2026-11-13に27件を照合、14件の安全な掲載をPR #77経由で実施。残り13件は根拠不足として保持。
