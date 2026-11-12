# 更新元データ分割：第1段階（lossless snapshot）

`results.json` が大きくなったため、更新元のレコードをシーズン単位で確認できる
`source-results/` を GitHub Actions 内で生成します。

## この段階で行うこと

- `results.json` **だけが現在の正本**。新規成績の登録・自動承認は既存の更新ルートを使い、まだ `source-results/` を直接編集しません。
- `source-results/S30.json` などは正本から生成された全フィールド保持のスナップショットです。
- シーズンを判定できないレコードは `source-results/unknown.json` に配置します。日付から推測して別シーズンへ移動しません。
- `source-results/manifest.json` に、元のレコード順序、件数、チーム賞金のセント合計、個人賞金のセント合計、ソース SHA-256、各ファイルの SHA-256 と内訳を記録します。
- `scripts/build-source-results.cjs` は全レコードの ID 重複を拒否し、シャードから元の並び・フィールド・賞金を完全復元できることを検査します。
- `.github/workflows/build-season-data.yml` が GitHub の内部で生成し、`--check` の合格後に `source-results/` をコミットします。利用者・ChatGPTが約6MBの元ファイルを再送信する必要はありません。

## 移行ステップ

1. 第1段階（本PR）：既存の `results.json` に触れず、分割版を生成・完全照合する
2. 第2段階（今後）：新しい戦績のみ小さな差分として提出し、GitHub Actions 内で正本を統合し、必要なシーズンを更新する
3. 第3段階（今後）：すべての読み書きコードが分割正本に対応した後、巨大な単一ファイルへの依存を解消する

`season-data/` は閲覧専用の軽量生成物、`source-results/` は将来の正本分割に向けた**現時点では読み取り専用の更新元スナップショット**です。

手動検証：
`node scripts/build-source-results.cjs --check`（生成済みの内容との一致を調べ、書き換えはしません）。
