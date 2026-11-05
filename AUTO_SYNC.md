# ASIA ON TOUR — 大会成績の自動確認（Osirion）

## 現在の運用状態（2026-11-05）
- データソースは非公式の [Osirion Fortnite Public API](https://fnapi.osirion.gg/) を利用。現在の公開エンドポイントは API キーなしで読み取り可能ですが、ベータ版で変更・停止の可能性があります。
- `auto-sync-config.json` は `enabled: true`, `provider: "osirion"`, `mode: "review"`。1日4回（GitHub Actions の UTC 00:17/06:17/12:17/18:17）自動確認します。
- **検出した成績は `auto-sync-review.json` に保存するだけで、`results.json` には自動追加しません。** 公開サイトの「最新状況を確認」も画面の更新のみで、ジョブの実行や書き込みはしません。
- 2026年9月22日 NAW Solo Victory Cup予選の既存10件で、API accountId と Trackerプロフィール UUID、順位・ポイント・試合数・キル・VRが一致したことをパイロット検証済み。これは他大会も常に一致するという保証ではありません。

## 自動チェックの対象
- `results.json` に登録された Fortnite Tracker の `?id=<UUID>` と照合でき、同じIDが複数選手名を指さない掲載済み選手のみを対象にします。2026年11月5日現在、本人名の競合があるIDは除外しています。
- `tournaments.json` で明示的に登録されたシリーズのうち、**Victory Cup / Cash Cup / Performance Evaluation** を対象にします。2026年11月の新シーズン S43 では Squads Victory Cup、Trios Cash Cup、Reload ZB Duos Cash Cup、Performance Evaluation Triosを追跡対象に追加しました。
- 地域は ME/EU/NAC/NAW/OCE/BR の6地域。ASIA大会は外鯖成績対象外です。リージョンロックされた FNCS予選、Heats、LCQ、Finalsや未承認イベントを名前の類似だけで対象に追加しません。
- 大会の開催ウィンドウが**終了して4時間以上**経ち、かつ直近7日間に終了した場合に照合を開始します。順位表が空の場合は「完了」扱いせず、再チェックします。
- 1回のジョブでウィンドウ最大2件・順位表最大30ページを検査し、続きは `auto-sync-scan.json` から再開。APIの公開レート制限に配慮します。

## 登録の安全ルール
1. ソロは選手本人のEpic accountIdが一致しなければ候補にしません。デュオ・トリオ・スクワッドは全員のIDが確認できた場合のみ候補化します。未登録のチームメイトがいる場合は保留します。
2. 大会名・シーズン・開催地域・大会ウィンドウ・ラウンドを既存カタログと照合。既存 `results.json` の大会・日付・ラウンド・選手組み合わせと重複する成績は除外します。
3. 順位・ポイント・キル・VR・試合数の整数値が欠ける場合は候補から外します。賞金決勝でも API が賞金額を明示確認できなければ `prize: null` とし、現金賞金は推定しません。
4. 予選・スキン大会に賞金を自動付与しません。新しい候補の手動確認後にのみ、別の更新手順で元データへ反映します。
5. 公開サイトや JSON にAPIキーを置かず、GitHub Actionsの権限だけで定期ジョブを実行。外部APIの生の全リーダーボードは保存・再配布しません。

## 管理方法
- GitHub → Actions → **AOT safe results auto-sync** → **Run workflow** で管理者が手動チェックできます。通常は自動で動きます。
- サイト「更新履歴」→「AUTO SYNC」で最終チェック日時、追跡選手、対象ウィンドウ、確認待ち候補、照合保留ID、検査ページ数を閲覧できます。
- 候補ファイル [auto-sync-review.json](auto-sync-review.json) を人が確認し、掲載する場合は通常のデータ登録・重複検証・テスト手順を用います。
- 設定の `mode: "publish"` は安全検証が完了するまで**実行時エラーとして拒否**します。値を変更するだけでは自動掲載は有効になりません。
- 対象大会がまだ終了していないと `trackedWindows: 0` と表示されることがあります。取得失敗を表すものではありません。エラーが起きた場合は Actions のログを確認してください。

## 次の段階
- 現在は安全な「自動収集→確認待ち」が完成した段階です。実績の完全自動公開には、APIの恒常的な正確性、賞金／大会種別、試合数、チーム名寄せ、重複判定、公開時の監査履歴と差し戻しを継続検証する必要があります。
- 静的な GitHub Pages 上から編集・GitHub書き込みを行うには認証付きの管理者バックエンドが必要です。公開ブラウザに GitHub トークンを埋め込まないでください。
- [Osirion API規約](https://www.osirion.gg/legal/license)・[APIドキュメント](https://fnapi.osirion.gg/)の最新情報、規約変更、レート制限を運用時に確認してください。

## 関連ファイル
- `.github/workflows/auto-sync.yml`: 定期・手動ジョブ
- `scripts/osirion-sync.cjs`: 大会発見、順位表照合、確認候補生成
- `scripts/auto-sync-core.cjs`: 安全な名寄せと重複判定
- `auto-sync-config.json`: 読み取り設定
- `auto-sync-status.json`、`auto-sync-review.json`、`auto-sync-scan.json`: 公開状態、確認候補、処理進捗
- `auto-sync-ui.js`: 公開サイトの確認画面
