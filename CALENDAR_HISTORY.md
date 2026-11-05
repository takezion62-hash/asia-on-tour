# ASIA ON TOUR — 過去大会カレンダー

## 対象と検証日
- 2026-11-05 初回確認：**11,236開催枠／31か月**（2024-05-29〜2026-11-04）。
- 対象は ME / EU / NAC / NAW / OCE / BR の6海外地域。ASIA開催分はAOTの「海外遠征」対象ではないため表示対象外。
- Osirion公開APIの大会一覧（includeHistoricData=true）から大会の元ID、公式表示名（FortniteのdisplayData.longFormatTitle）、ラウンドID、開始・終了時刻を照合。地域・ウィンドウIDが不一致、終了未確認、日付不正、名称なしの大会は掲載しない。
- **FNCS Division 1以外の地域ロックFNCS**は除外。コミュニティスキンカップ等はFNCS文字列が含まれていても、通常のFNCSと区別する。
- 日時はUTCからJSTへ変換して掲載。公開ベータAPIの履歴が遡れる範囲内の一覧であり「フォートナイト史上すべての大会」を保証しない。開催予定変更・APIの修正等により将来の掲載件数は変動しうる。

## 表示とデータの分離
- 日付の出典として \`https://www.fortnite.com/competitive/events/<eventID>/?region=<region>&round=<windowID>\` の大会ページを掲載。
- 「過去の開催履歴」と「登録済みのASIA遠征戦績」は別物。開催履歴に選手の参加・予選突破・賞金獲得を推定・付与しない。
- すでに同じイベント／地域／日付／ラウンドで登録戦績がある場合、カレンダーで開催枠の重複表示を避ける。
- カレンダーの「表示内容」から結果・開催履歴・予定を切替できる。月選択から2024年・2025年・2026年の開催履歴へ即移動。
- \`results.json\`・\`players.json\`・\`tournaments.json\` はこのカレンダー拡張では変更していない。

## データファイルと自動更新
- \`scripts/historical-calendar.cjs\`：Osirion大会一覧から歴史的大会の開催ウィンドウを検証し、日時・名称の出典が確認できた行だけ書き出す。
- \`calendar-history.json\`：記録確認用の全量アーカイブ（ブラウザで毎回全件は読み込まない）。
- \`calendar-history-index.json\`：月ごとの開催枠件数と目次。
- \`calendar-history/YYYY-MM.json\`：選択月ごとに読み込む31分割ファイル。読み込み時間を抑える。
- \`calendar-history-status.json\`：直近の確認日時と取得件数、除外理由の統計。
- \`.github/workflows/calendar-history.yml\`：毎日 UTC 02:29（JST 11:29）に定期確認。変更がない場合は大容量の全量アーカイブを再コミットせず、ステータスを更新する。
- API障害・未収録の過去大会は推測して埋めない。ユーザー提供スクリーンショットや確認済み大会ページによる手動戦績登録は従来どおり併用可能。
