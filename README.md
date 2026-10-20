# ASIA ON TOUR

ASIA勢のFortnite海外大会戦績を検索・閲覧する、GitHub Pagesの閲覧専用サイトです。一般閲覧者による戦績の追加・削除・保存・アップロード機能はありません。

## ファイル構成

- `index.html`：デザイン・画面構造
- `app.js`：JSONの読み込み、検索、シーズン、プロフィール、賞金集計
- `results.json`：戦績の配列
- `players.json`：`candidates`（名鑑）と`confirmedAliases`（確認済み別名義）
- `tournaments.json`：`axes`（5分類軸）と`catalog`（大会・シーズン・出典ID）

掲載内容はJSONを編集して更新します。3つのJSONと`app.js`は`index.html`と同じ場所へ配置してください。ローカルではHTTPサーバーを使用します。

## テストの実行

Node.js 22以上（CIは24）とnpmを用意してください。開発依存はPlaywright Testのみで、バージョンと依存関係を`package-lock.json`に固定しています。JSON検証と単体テストはNode.js標準機能のみで動作します。

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

Linuxでシステム依存が不足する場合は、`npx playwright install --with-deps chromium`を使用します。

```sh
npm run validate       # JSON構文・形式・参照と個人賞金の検証
npm run test:unit      # 不正データの拒否と画面ロジックの回帰テスト
npm run test:e2e       # ChromiumでPC・スマホの実ブラウザーテスト
npm run serve         # http://127.0.0.1:4173 で閲覧用プレビュー
```

インストールなしの確認は`node scripts/validate-data.cjs`と`node --test tests/*.test.cjs`で実行できます。別フォルダーのJSONを公開前に調べる場合は、`node scripts/validate-data.cjs <JSONを置いたフォルダー>`を使用します。

## 検証ルール

- JSON構文、配列／オブジェクト、必須フィールド、戦績ID・大会ID・名鑑名の重複
- 日付、地域、順位・ポイント・キル・VR・賞金の形式、出典・プロフィールURL
- タグの存在、ソロ／デュオ人数、出典の大会・ラウンドIDと地域・シーズンの整合性
- 別名義の対応先、複数人への同じ別名義の割り当て、別人への統合、TrackerアカウントIDの衝突
- 過大な個人配分、予選VR・コスメ報酬・未確認賞金の現金への混入
- 画面の件数・ランキング・プロフィール・地域グラフとJSONの独立集計との一致
- 検索・複合フィルター・CSV・共有URL・期間・大会タグ・読み込みエラー表示・横はみ出し・閲覧専用設計

戦績の必須フィールドは`id`・`date`・`region`・`player`・`event`・`round`・`rank`・`points`・`kills`・`vrs`・`prize`・`kind`・`source`・`verified`・`note`です。不明な数値は推測せず`null`、確認済みゼロは`0`にします。順位は1以上、他の戦績数値は0以上の整数、賞金は小数2桁以内の非負数です。フラグは文字列ではなく真偽値を使用します。

チーム戦績の`players`には重複のない掲載名を並べ、`prize`にチーム合計、`prizePerPlayer`に確認済み個人分を保存します。個人配分不明の賞金を均等割りで補完せず、予選VRやスキンを現金へ換算しません。正の賞金でも`verified: false`なら個人合計に含めません。

別名義は`confirmedAliases`の明示的な対応だけを使用します。似た表示名・チーム名・Unicodeの見た目から自動統合しません。`p1ng`と`RGN p1ng`は別選手です。ソロのリンク名には既存の`playerRaw`表記も認めます。チームのプロフィールは各掲載名または確認済み別名義との対応が必要です。

未確認の大会形式・シーズンを推測で補完しません。カタログ未登録などは「要確認」の警告、存在しない明示的な参照や矛盾した識別子はエラーです。シーズンの追加は[SEASONS.md](SEASONS.md)、大会分類は[TOURNAMENTS.md](TOURNAMENTS.md)も参照してください。

## 固定値と人間の確認

テストに「138件」「$9,000」を恒久的な正解として埋め込んでいません。件数・賞金・ランキング・期間別集計をJSONから毎回計算し、正当な追加分も含めて画面と一致することを検証します。単体テストの架空データの件数・額はテストケース専用です。

導入時には既存138戦績を保持し、個人賞金$9,000が変更前と一致することを確認しています。この数字は導入時点の記録であり、将来の上限・固定値ではありません。

エラー例：`エラー results.json [戦績／対象ID: example-id] prizePerPlayer: 個人配分の人数分がチーム賞金を超えています…`

エラーはファイル・戦績ID（または選手／大会ID）・項目・日本語の理由を表示し、終了コード1で失敗します。JSON自体が壊れてIDを読めない場合は「ファイル全体」です。GitHub Actionsではエラー注釈も付きます。「要確認」は人間が調べる項目で、構造エラーと区別します。

**自動検証は実際の大会結果の正しさを保証しません。** 出典の順位表・画像、開催日、順位、本人確認、賞金の根拠は人間が確認してください。`verified: true`という入力を、機械による事実認定とは扱いません。外部サイトへの自動照会や書き込みは行いません。

## GitHub Actions

`.github/workflows/tests.yml`がPush・Pull Request・手動実行時に、JSON検証 → 単体テスト → PC／スマホのブラウザーテストを実行します。依存パッケージはロックファイル、公式ActionsはコミットSHAに固定しています。

結果はActionsの「Data and site tests」で確認できます。`site-test-report`にHTMLレポートと、失敗時のスクリーンショット・トレースを7日間保存します。PRで成功を確認してからマージしてください。このワークフローだけで、直接Push時に別のGitHub Pages配信が自動停止するわけではありません。

```sh
npx playwright show-report
```

`node_modules`・レポート・トレースはGitへ登録しません。アプリやJSONを変更したときもテストを実行してください。
