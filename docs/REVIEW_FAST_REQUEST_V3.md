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
