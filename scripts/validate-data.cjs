'use strict';
const path = require('node:path');
const { loadData, validateData, summarize } = require('./data-checks.cjs');
const directory = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const loaded = loadData(directory);
const result = loaded.errors.length ? { errors: loaded.errors, warnings: [] } : validateData(loaded.data);
// Skin rewards must never become cash payouts, including the current
// 'スキン大会' label and older records labeled 'コスメ大会'.
if (!loaded.errors.length && Array.isArray(loaded.data?.results)) {
  for (const row of loaded.data.results) {
    if (['スキン大会', 'コスメ大会'].includes(row?.kind) && typeof row.prize === 'number' && row.prize > 0) {
      result.errors.push({
        file: 'results.json',
        id: row.id || 'ID未設定',
        field: 'prize',
        message: 'スキン／コスメ報酬を現金賞金として登録しないでください（prizeは0）。'
      });
    }
  }
}
for (const [kind, entries] of [['エラー', result.errors], ['要確認', result.warnings]]) for (const item of entries) {
  const message = `[戦績／対象ID: ${item.id}] ${item.field}: ${item.message}`;
  console.log(`${kind} ${item.file} ${message}`);
  if (process.env.GITHUB_ACTIONS && kind === 'エラー') console.log(`::error file=${item.file}::${message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
}
if (result.errors.length) { console.error(`検証失敗：${result.errors.length}件のエラーがあります。`); process.exitCode = 1; }
else {
  const stats = summarize(loaded.data);
  console.log(`検証成功：${stats.records}戦績・${stats.players}選手・${stats.regions}地域・確認済み個人賞金 $${stats.total.toLocaleString('ja-JP')}・賞金ランキング${stats.ranking.length}名`);
  console.log('これは形式・参照・計算の検証です。実際の順位・同一人物・出典内容の正しさは、人間による確認が必要です。');
}
