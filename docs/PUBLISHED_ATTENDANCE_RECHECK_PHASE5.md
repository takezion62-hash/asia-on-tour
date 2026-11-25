# 第5段階：既掲載参加確認の再審査（プレビュー）
既存の掲載済みIDを除外する通常の自動承認経路は変更しない。別の読み取り専用プランナーで、同じID・出典・選手・順位・試合数・得点・キル・VRの保存済み証拠が一意に一致する参加確認を再審査する。第1〜4段階の承認アダプターと公式大会規則を再利用し、予選突破・賞金決勝・Performance決勝の変更候補と保留理由を出力する。APIリクエストは0件。

## 実行
`node scripts/published-attendance-recheck.cjs snapshot.json > phase5-report.json`

snapshotは管理者が信頼できる同一リビジョンの既存同期データからローカルで構築する。入力形式は次の通り。
- data: results（source-results-storeの全行）、players、tournaments、verifiedAccounts（既存同期と同じ確認済み本人ID）、schedule（既存の公式予定）。
- scans: {auto: auto-sync-scan.json, history: history-sync-scan.json}。
- windows: 既存同期が公式カレンダーから構築した開催枠（key、eventId、windowId、dateJst、series、kind、round、startUtc、end等）。新たに推定しない。
- config: 適用対象の既存承認設定（無効なルートは有効化しない）。
- ledger: approval-history.json。
- reviewedIds: 管理者の処理済み・拒否済みIDの集合を配列で渡す。
- otherQueue: 他の確認待ち候補。now: 必要に応じて審査時刻のUnixミリ秒。

レポートには現行と提案後の区分・ラウンド・賞金、元ID、出典、保留理由を含む。本人Epic IDは出力しない。重複証拠、既存重複、数値不一致、本人確認不足、手動承認履歴のある成績は保留する。既に確定した$0を正の賞金で置換しない。

## 公開条件と未対応
本PRはプレビュー専用であり、自動同期への接続、実データへの反映、既存の承認台帳の書き換えは行わない。実データ一斉調査に必要な同一リビジョンのsnapshot組み立て・本番件数確認、および別PRでの検証済み変更適用（台帳・更新履歴・シーズン分割データ・賞金集計・CI検証）は未対応。レポートのみを根拠に自動掲載しない。snapshotには本人IDが含まれるため公開コミットに追加しないこと。

`node --test tests/published-attendance-recheck.test.cjs` で専用テスト。既存のunit runnerが自動検出する。
