# 大会ルール共通化 第1段階（2026-11-24）

大会ルールの正本は既存の `tournament-rules.json`。新しい `scripts/tournament-rule-engine.cjs` は予選突破順位、試合数上限、コスメ対象順位、個人順位賞金、チーム順位賞金と個人配分、個人VR賞金、明示された予選・決勝の開催枠名を読み取る純粋な計算層。

## 利用手順
1. Epic公式資料の対象シーズン、イベントID、地域、モード、チーム形式、試合数、突破順位、賞金表を登録する。
2. 既存の承認方式に適合する場合は共通計算を利用する。新しい方式や未確認の公式条件は個別の承認アダプターと規則検証を追加するまで保留する。
3. 開催枠・本人ID・順位表の取得状況・重複・公式資料の照合は各アダプターで維持する。計算結果だけで掲載しない。
4. `node --test tests/tournament-rule-engine.test.cjs` と既存の承認テストを実施する。

未登録・不正な地域や規則は null、確認された賞金圏外は 0。既存の例外（NA地域の個別照合、0VRの検証済み決勝、チーム別の専用承認、開催日時チェック）は維持。PlayStationのQualifier/Finalは既存のroundWindowsから読む。公開済み戦績・賞金・AOT PR・大会ルールJSONは変更しない。共通化は新しい大会の無条件自動承認を意味しない。

## 第2段階：大会形式・承認方式の共通化

`tournament-approval-policy.cjs` が大会シリーズ・autoApproval・cashFinalAutoApprovalから既存8方式を選択する。Event番号、Event/Round、単一開催枠、明示されたwindowIdPrefixを共通照合する。PlayStationのQualifier/Finalは第1段階のnamedRoundを利用する。
`tournament-approval-router.cjs` は既存承認方式の順番・設定フラグ・過去大会限定・重複防止用結果スナップショット・保留理由・参加確認権限を維持する。Reload ZB Duosの予選と決勝は別方式のまま。review-only、未知の方式は自動承認しない。

既存方式に適合する大会は正確な公式ID・承認方式・ルールを登録し、共通経路を利用できる。固有の公式資料検証、開催日時、旧NA例外、専用報酬、本人IDと順位表の安全条件、既存バリデーターは維持する。新大会の無条件承認ではない。公開済み成績・賞金・ルール数値は変更しない。

## 第3段階：新大会登録の読み取り専用診断

- `npm run tournament:preview -- --template`：公式資料で埋める空のJSONひな型。
- `npm run tournament:preview -- --draft /tmp/new-cup.json`：catalog、rule、regions、windows を入力して診断。
- `npm run tournament:preview -- --id ch7s5-playstation-cup-battle-royale`：既存登録の診断。
- `node --test tests/tournament-registration-preview.test.cjs`：専用テスト。

missing は不足、errors は矛盾・既存バリデーターのエラー、review は追加確認。suggested は承認方式候補、routeReport は現行設定、coverage は地域別順位ライン、windowReport は開催枠形式。status は blocked / review-only / needs-verification / preview-ready。registrationPreview は構造上の追加候補JSON（既存カタログをそのまま使用する場合は catalog が null）。**すべての新大会は追加検証必須、automaticPublicationAuthorized は常に false**。

windows は tournamentId / seasonId / series / eventId / region / kind / windowId / round を公式開催枠から指定。地域・ラウンド例の形式チェックは実際の開催日時や順位表を確認したことにはならない。公式根拠本文・対象開催枠・承認アダプター・本人ID・重複を別途確認し、既存バリデーターの固有条件を弱めない。全コマンド読み取り専用。戦績・設定・ルールを自動編集しない。

## 第4段階：未登録大会の自動発見・診断連携

Osirionの既存大会一覧から、従来の未登録イベント検出条件を変えずに詳細を採取する。追加API呼び出し・順位表走査は行わない。新着／過去のステータスJSONに `unmappedDiscovery` として全検出イベントID・提供元表示名・観測地域・JST日付範囲・開催枠数・地域ごとの新しい3枠までの代表サンプル・診断不足項目を記録。BR/ZB/Mobileの別IDは分離。同じ開催枠IDの時刻矛盾を表示し、未確認ルールは推測しない。

- `npm run tournament:discover`：両スコープの最新成功スナップショットを正確なIDで統合。登録済みIDは除外。重複する新着／過去の開催枠数は合算しない。
- `npm run tournament:discover -- --event S43_ExampleCup`：観測情報と第3段階の未入力ひな型・診断不足項目・調査チェックリストをJSONで出力。表示名とイベントIDだけを候補値にする。観測地域は公式対象地域ではないので、ひな型のregions・windowsは未入力のまま。公式規則・分類・報酬は別途照合。
- 初回の成功スキャンまでは旧ステータスの件数・先頭IDのみ表示。429等の失敗で既存の成功スナップショットを消さない。最新観測時刻は手動更新のcheckedAtと独立して比較する。
- 各スコープは最新の成功観測のみであり、過去の候補全体を永続蓄積する台帳ではない。設定の追跡期間や提供元データ外の大会を網羅しない。

`automaticPublicationAuthorized` は常に false。既存カタログ・大会ルール・賞金・戦績・承認設定の自動書き換えはしない。取得元のイベントページ候補URLは公式規則の検証済み証拠とは区別する。
