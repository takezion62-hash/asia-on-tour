# ASIA ON TOUR — 部分取得済み順位表の自動承認（2026-11-08）

## 解決する滞留
2026-11-08 18:39 JST時点の確認候補：
- 過去大会63件のうち53件が「順位表未完了」、9件が「確認専用大会」、1件が「完全なスナップショット不足」。
- 53件の内訳は0VRのVictory Cup賞金決勝29件、ルール未登録等の予選24件。
- 直近6件はS43 NAW Trios Cash Cupの賞金圏外2件と、S43 NAC Zoro Zero Buildスキン順位4件で、全件が取得途中。候補数はスキャン時点の値で、現在の掲載状況を保証しない。

## 部分ページを承認に使ってよい絶対条件
`scripts/verified-partial-page.cjs` で、次を**すべて**満たす場合だけ対象にする：
1. 確認済み本人を含む**同一候補の正確な保存スナップショット**がチェックポイントにある
2. 順位表の連続性チェックに成功、`pages === nextPage >= 1`、全ページ未完了、順位の末尾まで候補順位が含まれる
3. 不正ページ・空ページ・APIエラー・再試行待機がない
4. 大会終了後4時間以上経過してから正常取得したページである
5. 公式ルール・地域・シーズン・開始時刻・本人名/チーム構成・Epic ID・記録重複は**各大会承認モジュールで従来どおり検証**する

## 部分ページで自動掲載できるもの
| 大会 | 自動掲載の範囲 | 引き続き全体確認が必要なもの |
| --- | --- | --- |
| 公式規則登録済み Victory Cup | 0VRの決勝＝$0（登録済み公式ルールの地域のみ） | 予選突破、VR賞金、未登録地域 |
| 登録済みS43 Trios Cash Cup | 正式賞金圏外の順位＝$0。3名の確定Epic ID＋公式開催時刻が必須 | 賞金圏の順位・現金額 |
| 公式スキン順位のあるCup | 本人確認済み候補が正式な獲得順位以内の場合 | 公式の順位条件未登録、圏外、本人確認のない候補 |
| S43 EU/NAC Performance Evaluation | Round 2 の実測0VR・0pt＝$0 | 上位26位の予選突破・現金賞金が生じる決勝 |

S39 Unreal Cupの賞金階段・分配額は従来どおり完全な順位表とチームEpic IDを要求する。曖昧な同名別人、未登録の大会、地域・シーズンに未登録の賞金規則、矛盾する結果を自動承認しない。

## 確認待ちの管理
`auto-sync-ui.js` の直近/過去のダッシュボードに保留理由を多い順に表示。未取得を見える化し、公式ルール登録や名寄せが必要な候補を区別する。

## 検証
- `node --test tests/verified-partial-page.test.cjs tests/verified-history-approval.test.cjs tests/automatic-cash-approval.test.cjs tests/automatic-cosmetic-approval.test.cjs tests/automatic-performance-approval.test.cjs`
- 両スキャンActionsの実行対象とテスト一覧に新しい安全ゲートを追加。
- `npm run validate`、`npm run test:unit`、PC/スマホPlaywrightテストをPRで確認してからmainへ反映。

この改修は既存のJSONや承認済み賞金を再計算しない。今後の定期スキャンで安全条件を満たした候補だけが自動掲載される。確認待ちがすべて消えるものではない。
