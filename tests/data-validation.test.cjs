'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadData, validateData, summarize, personalCents, seasonFor } = require('../scripts/data-checks.cjs');
const loaded = loadData(path.join(__dirname, '..'));
const current = loaded.data;
const clone = () => structuredClone(current);
const soloIndex = current.results.findIndex(r => !r.players && r.verified && r.prize > 0 && r.kind === '賞金決勝');
const bad = (mutate, field, message) => {
  const data = clone(); mutate(data, data.results[soloIndex]);
  const result = validateData(data);
  assert.ok(result.errors.some(e => e.field === field && (!message || e.message.includes(message))), JSON.stringify(result.errors));
  assert.ok(result.errors.every(e => e.file && e.id && /[ぁ-んァ-ン一-龯]/.test(e.message)));
};

test('現在の3ファイルは構文・構造・参照・賞金配分の検証を通る', () => {
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(validateData(current).errors, []);
  const report = summarize(current);
  assert.equal(report.records, current.results.length);
  assert.equal(Math.round(report.total * 100), report.ranking.reduce((sum, p) => sum + Math.round(p.total * 100), 0));
});

test('JSONの構文エラーと欠落ファイルを日本語・ファイル名付きで報告する', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asia-validation-'));
  try {
    fs.writeFileSync(path.join(dir, 'results.json'), '[{"id":');
    const result = loadData(dir);
    assert.equal(result.errors.length, 3);
    assert.equal(result.errors[0].file, 'results.json');
    assert.match(result.errors[0].message, /構文エラー/);
    assert.ok(result.errors.every(e => e.id === 'ファイル全体'));
  } finally { fs.unlinkSync(path.join(dir, 'results.json')); fs.rmdirSync(dir); }
});

test('戦績・選手・大会の最上位構造が壊れても検証自体が停止しない', () => {
  for (const [key, value] of [['results', {}], ['players', []], ['tournaments', null]]) {
    const data = clone(); data[key] = value;
    assert.ok(validateData(data).errors.length);
  }
  const data = clone(); data.tournaments.catalog.push(null); data.results.push(null);
  assert.ok(validateData(data).errors.length);
  const empty = clone(); empty.results = [];
  assert.ok(validateData(empty).errors.some(e => e.field === 'results'));
});

test('戦績ID重複と必須フィールド欠落を対象ID付きで検出する', () => {
  bad(data => data.results.push({ ...data.results[soloIndex] }), 'id', '重複');
  bad((data, row) => { delete row.kills; }, 'kills', '必須');
  bad((data, row) => { row.id = ''; }, 'id');
});

test('順位・ポイント・キル・VRの負数・文字列・端数を拒否する', () => {
  for (const field of ['rank', 'points', 'kills', 'vrs']) for (const value of [-1, '100', 1.5, NaN, Infinity]) bad((data, row) => { row[field] = value; }, field);
  bad((data, row) => { row.rank = 0; }, 'rank');
});

test('不明な数値はnullとして保持し、0と区別する', () => {
  const data = clone(), row = data.results[soloIndex];
  for (const field of ['rank', 'points', 'kills', 'vrs', 'prize']) row[field] = null;
  assert.deepEqual(validateData(data).errors, []);
  row.points = 0; row.kills = 0; row.vrs = 0; row.prize = 0;
  assert.deepEqual(validateData(data).errors, []);
});

test('賞金は小数2桁以内の有限な非負数に限定する', () => {
  for (const value of [-100, '100', 0.001, NaN, Infinity]) bad((data, row) => { row.prize = value; }, 'prize');
});

test('実在しない日付・地域・URL・真偽値を拒否する', () => {
  bad((data, row) => { row.date = '2026-02-30'; }, 'date');
  bad((data, row) => { row.region = 'ASIA'; }, 'region');
  bad((data, row) => { row.source = 'javascript:alert(1)'; }, 'source');
  bad((data, row) => { row.verified = 'true'; }, 'verified');
});

test('デュオ・複数人チームは確認済み個人分だけを集計する', () => {
  const base = { ...current.results[soloIndex], players: ['first', 'second'], prize: 400, prizePerPlayer: 200 };
  assert.equal(personalCents(base), 20000);
  assert.equal(personalCents({ ...base, players: ['first', 'second', 'third', 'fourth'], prizePerPlayer: 100 }), 10000);
  for (const share of [undefined, null, 0, 300]) assert.equal(personalCents({ ...base, prizePerPlayer: share }), 0);
  assert.equal(personalCents({ ...base, verified: false }), 0);
});

test('過大な個人配分・チーム内重複を戦績ID付きで拒否する', () => {
  bad((data, row) => { row.players = ['first', 'second']; row.prize = 400; row.prizePerPlayer = 300; delete row.profileUrl; }, 'prizePerPlayer', '超え');
  bad((data, row) => { row.players = ['first', 'first']; delete row.profileUrl; }, 'players', '重複');
});

test('予選VR・コスメ・未確認賞金を現金へ加算しない', () => {
  const base = current.results[soloIndex];
  for (const row of [{ ...base, kind: '予選', vrs: 99, prize: null }, { ...base, kind: 'コスメ大会', prize: null }, { ...base, verified: false }, { ...base, prize: 0 }]) assert.equal(personalCents(row), 0);
  bad((data, row) => { row.kind = '予選'; row.prize = 100; }, 'prize', '予選VR');
  bad((data, row) => { row.kind = 'コスメ大会'; row.prize = 100; }, 'prize', 'コスメ');
});

test('存在しないタグ・大会IDと大会／ラウンドのシーズン矛盾を検出する', () => {
  bad(data => { data.tournaments.catalog[0].mode = 'made-up-mode'; }, 'mode', '存在しない');
  bad((data, row) => { row.tournamentId = 'missing'; }, 'tournamentId');
  bad((data, row) => { row.tournamentId = data.tournaments.catalog.find(t => t.name !== row.event).id; }, 'tournamentId', '一致');
  bad((data, row) => { const url = new URL(row.source); url.searchParams.set('window', 'S999_Test_Round1_ME'); row.source = url.href; }, 'source', 'シーズン');
  bad((data, row) => { row.seasonId = 'S999'; }, 'seasonId', '一致');
  bad(data => { data.tournaments.catalog[0].season = 999; }, 'seasonId', '異なる');
});

test('確認できない形式・シーズンは未確認として警告し推測で埋めない', () => {
  const data = clone(), row = data.results[soloIndex];
  row.source = 'https://example.com/unconfirmed'; row.event = 'Unconfirmed Cup';
  assert.equal(seasonFor(row, data), 'unknown');
  const result = validateData(data);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(e => e.id === row.id && e.field === 'event'));
});

test('別名義を複数人へ割り当てたり掲載済みの別人へ統合しない', () => {
  bad(data => { data.players.confirmedAliases.p1ng = ['RGN p1ng']; }, 'confirmedAliases', '別の掲載選手');
  bad(data => { data.players.confirmedAliases.p1ng = ['same-alias']; data.players.confirmedAliases['RGN p1ng'] = ['same-alias']; }, 'confirmedAliases', '複数');
  bad(data => { data.players.confirmedAliases['No Such Player'] = ['alias']; }, 'confirmedAliases', '存在しません');
});

test('確認済み別名義を戦績の別プロフィールとして増殖させない', () => {
  bad((data, row) => { row.player = 'SKRS PXC4NDYIV'; delete row.players; delete row.profileUrl; delete row.profiles; }, 'players', '掲載名');
});

test('同じTracker IDを別の選手へ割り当てた場合は人間の確認を要求する', () => {
  bad(data => { const row = structuredClone(data.results[soloIndex]); row.id += '-another'; row.player = 'Another Exact Identity'; row.playerRaw = row.player; data.results.push(row); }, 'profiles', '同じTracker');
});

test('新しい正当な賞金記録を足すと件数・賞金・ランキングを自動再計算する', () => {
  const data = clone(), original = summarize(data), row = structuredClone(data.results[soloIndex]);
  row.id += '-new-valid-event'; row.prize = 123.45; data.results.push(row);
  assert.deepEqual(validateData(data).errors, []);
  const next = summarize(data);
  assert.equal(next.records, original.records + 1);
  assert.equal(next.total, original.total + 123.45);
  assert.equal(next.ranking.find(p => p.name === row.player).total, original.ranking.find(p => p.name === row.player).total + 123.45);
});
