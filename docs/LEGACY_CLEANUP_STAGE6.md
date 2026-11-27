# 長期運用 第6段階：旧資料と現行説明の整理

2026-11-27。正本を扱うコード・生成済みデータ・承認証拠は変更せず、旧資料のみ隔離する。

## 退役したルートの3ファイル

| 旧パス | 隔離先（docs/archive/legacy-data/） | 件数 | 元のGit blob |
| --- | --- | ---: | --- |
| results (1).json | results-original-snapshot.json | 183戦績 | 7b7082c0950816e1e8c3f7c60276be98e21d564a |
| results-20260922-nac-additions.json | results-20260922-nac-additions.json | 10戦績 | dcf9ff37259588721ece098a45ae9b1030f6dd21 |
| tournaments (1).json | tournaments-original-snapshot.json | 13大会 | 1e4e6fdfdb525c87d31f005abb935b0bb4ff06c8 |

元と同一のblob、内容を確認してからルートのコピーだけ除去した。正本のID索引と照合すると183件中180件、10件中10件、13大会中13件が同一IDで存在した（2026-11-27、基準コミット 9891ec2ab6cf2adecef48317d70d15b6d28913e0）。同じIDでも内容が同じとは限らない。次の旧ID3件は正本に同一IDがないため、誤って再掲載しない。欠落・重複・訂正のどれかは今回未判定。

- s42-oce-console-zb-solo-vc-final-20261017-alpacabest
- s42-oce-console-zb-solo-vc-final-20261017-demonkurage
- s42-oce-console-zb-solo-vc-final-20261017-nununununu

旧資料は未検証の過去スナップショットであり、正本でも、現在の掲載・賞金の根拠でもない。復旧や訂正の参考としてのみ保管し、現行データに自動結合しない。ファイル内容は一切変更していない。約212KBのルートファイルを移動したが、リポジトリ全体の容量削減ではない。

## 静的未参照の4スクリプト

| ファイル | 判定 |
| --- | --- |
| apply-s36-squid-seven.cjs | 7組の原始スクリーンショット証拠、名義訂正と掲載ロジックを含む。証拠の独立保全、訂正副作用の検証前は維持 |
| audit-review-round2-20261109.cjs | 読み取り専用診断・API照合。定期実行対象ではないが手動監査用に維持 |
| auto-sync.cjs | 旧フィード入口。11月11日の整理台帳でも代替確認前は維持と判断済み。現行運用では使わない |
| manual-review-current-25.cjs | 25件の過去審査に関する固定ID・根拠を含む純粋な計画モジュール。再現・監査のため維持 |

静的参照がないことだけでは手動利用・間接依存を否定できない。今回、実行スクリプトは削除しない。

## 説明文の更新

README.md、AUTO_SYNC.md、WORKFLOW_OPERATIONS.mdに現行構成と運用を明記し、日付付きの過去実装記録は保持する。正本 source-results/、生成索引 season-data/、4時間ごとの直近/過去戦績調査設定、承認経路、共通待ち行列、CIとガード付き再実行を案内する。

## 検証・復旧

`node --test tests/legacy-cleanup-stage6.test.cjs` で退役した旧パスの不在、保存ファイルのblobハッシュ・件数、現役コードの静的参照がないこと、現行説明を検査する。既存CIを維持する。復元が必要でも原本の内容を参考として扱い、正本や賞金集計へ直接戻さない。旧資料はGit履歴からも確認可能。
