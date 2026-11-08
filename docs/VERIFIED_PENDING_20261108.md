# 2026-11-08 確認待ち成績の公式ルール調査・反映方針

## 調査時の状態（UTC 2026-11-08 10:38）
- `history-sync-review.json`: 60件。24件は S36 NAW Console Duos Round1 の順位確認待ち。S30/S31 NAC 0VR決勝・S42/S43イベント等は別途要確認。
- `auto-sync-review.json`: 7件。S43 OCE Reload ZB Duos Cash Cup、Event 1 Round1、7組とも元APIの本人Epic ID2名・順位・キル・ポイント・試合数を記録。
- データは更新され続けるため、ここに記載した件数を最新の公開件数と混同しない。

## 新たにEpic公式ルールから確定できたもの

### S36 Console Duos Victory Cash Cup（2025-06-14 NAW）
- [Epic公式規則（2025-06-07）](https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules)
- Round 1は最大7試合、NAW/OCE/ME/BR/ASIAは上位250組、EU/NACは上位500組がRound 2へ。Round 1現金賞金は$0。
- 確認待ちに含まれる上位250の組は「予選突破」、それ以外は「予選」として出場順位・$0を登録。決勝賞金は別途実測VR/公式規則が必要。

### S43 Reload ZB Duos Cash Cup（2026-11-08 OCE）
- [Epic公式規則（2026-11-01）](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-zero-build-reload-cash-cups-chapter-7-mini-season-official-rules)
- Round 1は最大12試合、全7地域で上位20組のみRound 2へ。現金賞金はRound 2の地域別入賞者に限る。
- OCEのbigsky / Reoは19位（予選突破）。85、141、318、333、738、779位の確認済み6組は予選参加扱い、いずれも賞金$0。
- 公式カレンダーとの時刻照合、本人2名のEpic ID照合、開催終了後に成熟した保存済み順位表、矛盾しない既存結果が必要。

## 自動承認の安全条件
- `scripts/automatic-duo-qualifier-approval.cjs` が対象イベント・シーズン・Round1・地域・公式ルールと順位境界を**完全一致**で確認。
- APIで出典が存在し本人のEpic IDが対応し、試合数・キル・VR・ポイントが非負整数、ルール上限内。
- チェックポイントの連続順位・保存済み候補の完全一致と終了4時間後の正常取得（`verified-partial-page.cjs`）または完了済みの走査を必須とする。
- 掲載するのは確認済みのRound1結果。賞金は$0、順位が通過ライン外なら「予選突破」と表示しない。Round2の現金賞金を推定しない。
- 既存の同一大会・地域・開催回・両選手の結果は重複掲載しない。
- 直近・履歴の既存自動収集で再評価。GitHub Actionsが安全統合して公開するため、実際の反映件数は実行ログ・`results.json`・残候補で確認する。

## 継続保留する内容
- S30/S31 NACの旧決勝：Epic公式は全地域のRound2 0VR=$0と明記。本人照合・順位連続性・0ptの確認ができれば0VR決勝のみ掲載。旧「NA」予選突破順位はNACへ推定転用しない。
- S39 Unreal Cup：本人Epic IDと順位表の完全スナップショット、既存戦績との照合が必要。
- S42 Performance Evaluation、2024 Duos Cash Cup、FNCS Div1、PlayStation Cup：公式進出・賞金規則または決勝/賞金実績の個別根拠が必要。
- Zoro Cup EU：既存掲載との順位・ID矛盾があるため重複疑いを自動解除しない。

結論：確認済みのゼロ賞金予選を安全に掲載する。賞金の推定・同名別人の自動名寄せ・不明な進出条件の断定はしない。
