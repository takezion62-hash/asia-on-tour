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
