'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the production model and its existing money/classification helpers.
// No copy of the journey algorithm is maintained in this test file.
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const prefixStart = source.indexOf('    // CH7S4');
const prefixEnd = source.indexOf('    function selectedSeasonPlayers');
const modelStart = source.indexOf('// JOURNEY MODEL START');
const modelEnd = source.indexOf('// JOURNEY MODEL END');
assert.ok(prefixStart >= 0 && prefixEnd > prefixStart && modelStart >= 0 && modelEnd > modelStart,
  'The production journey model boundaries must remain available to the regression tests');

const baseTaxonomy = { series: 'victory-cup', mode: 'reload', subtype: 'reload-solo-victory-cup', team: 'solo', platform: 'cross-platform' };
function category(id, fields = {}) {
  return { id: 'fixture-' + id, name: 'Journey fixture ' + id, chapter: 7, season: 4, seasonId: 'S42',
    sourceEventIds: ['S42_JourneyFixture_' + id], ...baseTaxonomy, ...fields };
}
function record(id, date = '2026-09-01', fields = {}, group = 'A') {
  return { id, date, region: 'ME', player: 'Fixture Player', event: 'Journey fixture ' + group,
    source: 'https://fortnitetracker.com/events/epicgames_S42_JourneyFixture_' + group + '_ME',
    kind: '予選', round: 'Event 1 · Round 1 / 予選', rank: 100, points: 150, kills: 2, vrs: 0,
    prize: null, verified: true, note: 'Synthetic journey regression fixture', ...fields };
}
function fixtureAxes(catalog) {
  return Object.keys(baseTaxonomy).map(key => ({ key, options: [...new Set(catalog.map(item => item[key]))].map(id => ({ id, label: id })) }));
}
function model(catalog = [category('A')], results = [], axes = fixtureAxes(catalog)) {
  const context = vm.createContext({ URL, URLSearchParams, siteData: { results, players: { candidates: [] }, tournaments: { axes, catalog } } });
  vm.runInContext(source.slice(prefixStart, prefixEnd) + '\n' + source.slice(modelStart, modelEnd) +
    '\nglobalThis.journeyApi = { buildJourney };', context, { timeout: 5000 });
  return (...args) => Array.from(context.journeyApi.buildJourney(...args), item => ({
    record: item.record, reasons: Array.from(item.reasons), cash: item.cash, cumulative: item.cumulative
  }));
}
const reasons = {
  first: 'サイト掲載初日の記録', cash: 'サイト掲載初の賞金獲得日',
  region: region => region + 'の初掲載日', best: '同区分の最高順位更新', vr: 'VR獲得'
};
const has = (rows, id, reason) => rows.find(item => item.record.id === id).reasons.includes(reason);

test('年表は日付・ID順に並べ、同大会の予選と決勝を別記録として保持する', () => {
  const qualifying = record('qualifier', '2026-09-02');
  const final = record('final', '2026-09-02', { kind: '賞金決勝', round: 'Event 1 · Round 2 / 賞金決勝', rank: 12 });
  const early = record('earliest', '2026-09-01');
  const input = [qualifying, final, early];
  const before = structuredClone(input);
  const rows = model()(input);
  assert.deepEqual(rows.map(item => item.record.id), ['earliest', 'final', 'qualifier']);
  assert.equal(rows[0].record, early, 'Published record objects are preserved');
  assert.equal(rows[1].record.kind, '賞金決勝');
  assert.equal(rows[2].record.kind, '予選');
  assert.deepEqual(input, before, 'The source array and published result fields must not be modified');
});

test('サイト掲載初日・地域初掲載日は同日の全記録に付け、過去未掲載の挑戦を断定しない', () => {
  const input = [record('b'), record('a'), record('new-region-a', '2026-09-03', { region: 'OCE' }),
    record('new-region-b', '2026-09-03', { region: 'OCE' }), record('later', '2026-09-04', { region: 'OCE' })];
  const rows = model()(input);
  for (const id of ['a', 'b']) {
    assert.ok(has(rows, id, reasons.first));
    assert.ok(has(rows, id, reasons.region('ME')));
  }
  for (const id of ['new-region-a', 'new-region-b']) {
    assert.ok(has(rows, id, reasons.region('OCE')));
    assert.ok(!has(rows, id, reasons.first));
  }
  assert.ok(!has(rows, 'later', reasons.region('OCE')));
  assert.ok(rows.flatMap(item => item.reasons).every(reason => !reason.includes('初めての海外挑戦')));
});

test('シーズン内の最初の戦績を全履歴での初掲載・初賞金として作り直さない', () => {
  const previous = record('previous-season', '2026-06-01', { kind: '賞金決勝', prize: 100 });
  const current = record('selected-season', '2026-09-01', { kind: '賞金決勝', prize: 200 });
  const rows = model()([current], [previous, current]);
  assert.deepEqual(rows.map(item => item.record.id), ['selected-season']);
  assert.ok(!has(rows, current.id, reasons.first));
  assert.ok(!has(rows, current.id, reasons.cash));
  assert.ok(!has(rows, current.id, reasons.region('ME')));
  assert.equal(rows[0].cash, 200);
  assert.equal(rows[0].cumulative, 200, 'Selected-period cumulative excludes earlier seasons');
});

test('初賞金は確認済み現金の最初の日の全該当記録に付け、同日の累計は日末値を共有する', () => {
  const input = [record('before', '2026-08-31', { vrs: 3 }),
    record('cash-b', '2026-09-01', { kind: '賞金決勝', prize: 0.2 }),
    record('cash-a', '2026-09-01', { kind: '賞金決勝', prize: 0.1 }),
    record('next', '2026-09-02', { kind: '賞金決勝', prize: 0.15 })];
  const rows = model()(input);
  for (const id of ['cash-a', 'cash-b']) {
    assert.ok(has(rows, id, reasons.cash));
    assert.equal(rows.find(item => item.record.id === id).cumulative, 0.3);
  }
  assert.ok(!has(rows, 'before', reasons.cash));
  assert.ok(!has(rows, 'next', reasons.cash));
  assert.equal(rows.at(-1).cumulative, 0.45, 'Cumulative money uses integer cents');
});

test('デュオは確認済み個人分のみ、予選・スキン・未確認・配分不明は累計へ加算しない', () => {
  const duo = { player: 'Fixture Player / Partner', players: ['Fixture Player', 'Partner'], kind: '賞金決勝', prize: 400, prizePerPlayer: 200 };
  const input = [record('duo', '2026-09-01', duo),
    record('qualifying', '2026-09-02', { prize: 100, vrs: 9 }),
    record('skin', '2026-09-02', { kind: 'スキン大会', prize: 100 }),
    record('cosmetic', '2026-09-02', { kind: 'コスメ大会', prize: 100 }),
    record('unverified', '2026-09-02', { kind: '賞金決勝', prize: 100, verified: false }),
    record('unknown-share', '2026-09-02', { ...duo, prizePerPlayer: null }),
    record('overallocated-share', '2026-09-02', { ...duo, prizePerPlayer: 300 }),
    record('unknown-prize', '2026-09-02', { kind: '賞金決勝', prize: null })];
  const rows = model()(input);
  assert.equal(rows.find(item => item.record.id === 'duo').cash, 200);
  assert.ok(rows.filter(item => item.record.id !== 'duo').every(item => item.cash === 0));
  assert.equal(rows.at(-1).cumulative, 200);
  assert.ok(has(rows, 'qualifying', reasons.vr), 'VR can highlight a qualifying result without becoming cash');
});

test('最高順位更新は前日までの同区分と比べ、初回や同日内の架空の更新を作らない', () => {
  const input = [record('baseline', '2026-09-01', { rank: 200 }),
    record('b-better', '2026-09-02', { rank: 50 }), record('a-better', '2026-09-02', { rank: 100 }),
    record('same', '2026-09-03', { rank: 50 }), record('worse', '2026-09-04', { rank: 70 }),
    record('later-best', '2026-09-05', { rank: 20 })];
  const rows = model()(input);
  assert.ok(!has(rows, 'baseline', reasons.best));
  for (const id of ['a-better', 'b-better', 'later-best']) assert.ok(has(rows, id, reasons.best));
  for (const id of ['same', 'worse']) assert.ok(!has(rows, id, reasons.best));
  assert.deepEqual(model()([...input].reverse()).map(item => ({ id: item.record.id, reasons: item.reasons })),
    rows.map(item => ({ id: item.record.id, reasons: item.reasons })), 'Source insertion order cannot create intraday progress');
});

test('順位比較では5分類軸とラウンド区分をすべて区別する', () => {
  const catalog = [category('A'), category('series', { series: 'cash-cup' }), category('mode', { mode: 'zero-build' }),
    category('subtype', { subtype: 'fncs-division-1-practice' }), category('team', { team: 'duo' }), category('platform', { platform: 'console' })];
  const input = [record('baseline', '2026-09-01', { rank: 200 })];
  for (const axis of ['series', 'mode', 'subtype', 'team', 'platform']) {
    input.push(record(axis + '-baseline', '2026-09-02', { rank: 100 }, axis));
    input.push(record(axis + '-improved', '2026-09-03', { rank: 50 }, axis));
  }
  input.push(record('final-baseline', '2026-09-02', { rank: 10, kind: '決勝' }));
  input.push(record('cash-final-baseline', '2026-09-03', { rank: 5, kind: '賞金決勝' }));
  const rows = model(catalog)(input);
  for (const axis of ['series', 'mode', 'subtype', 'team', 'platform']) {
    assert.ok(!has(rows, axis + '-baseline', reasons.best), axis + ' must have an independent baseline');
    assert.ok(has(rows, axis + '-improved', reasons.best));
  }
  for (const id of ['final-baseline', 'cash-final-baseline']) assert.ok(!has(rows, id, reasons.best));
});

test('未確認の大会分類・順位・区分は自己最高として推測せず、表示用記録を保持する', () => {
  const unknownCatalog = [category('unknown', { mode: 'unknown' })];
  const input = [record('unclassified-first', '2026-09-01', { rank: 100 }, 'unknown'),
    record('unclassified-later', '2026-09-02', { rank: 1 }, 'unknown'),
    record('null-rank', '2026-09-03', { rank: null }, 'unknown')];
  const rows = model(unknownCatalog)(input);
  assert.equal(rows.length, input.length);
  assert.ok(rows.every(item => !item.reasons.includes(reasons.best)));
  const missingRanks = [record('missing', '2026-09-01', { rank: null, kind: null }), record('positive', '2026-09-02', { rank: 2, kind: null })];
  assert.ok(model()(missingRanks).every(item => !item.reasons.includes(reasons.best)));
});

test('大会カタログに文字列があっても選択肢にないタグは未確認として順位比較から外す', () => {
  const validAxes = fixtureAxes([category('A')]);
  for (const axis of Object.keys(baseTaxonomy)) {
    const catalog = [category('A', { [axis]: 'not-in-axis-options' })];
    const input = [record('baseline', '2026-09-01', { rank: 100 }), record('later', '2026-09-02', { rank: 1 })];
    const rows = model(catalog, [], validAxes)(input);
    assert.equal(rows.length, input.length, axis + ': the original records remain visible');
    assert.ok(rows.every(item => !item.reasons.includes(reasons.best)), axis + ': invalid taxonomy is not a comparison group');
  }
});

test('日付不明・数値未確認でも停止せず、日付不明の初日・順位更新を主張しない', () => {
  const input = [record('undated-z', null, { rank: null, points: null, kills: null, vrs: null, prize: null }),
    record('known', '2026-09-01'), record('undated-a', '', { rank: 1, vrs: 1, kind: '賞金決勝', prize: 50 })];
  const rows = model()(input);
  assert.deepEqual(rows.map(item => item.record.id), ['known', 'undated-a', 'undated-z']);
  for (const id of ['undated-a', 'undated-z']) {
    const reasonsForRecord = rows.find(item => item.record.id === id).reasons;
    assert.ok(!reasonsForRecord.includes(reasons.first));
    assert.ok(!reasonsForRecord.includes(reasons.cash));
    assert.ok(!reasonsForRecord.includes(reasons.region('ME')));
    assert.ok(!reasonsForRecord.includes(reasons.best));
  }
  assert.ok(has(rows, 'undated-a', reasons.vr));
  assert.equal(rows.at(-1).cumulative, 50);
  assert.deepEqual(model()([]), []);
});

test('実データ全選手の年表は元の戦績IDを保ち、既存の個人賞金検証値と累計が一致する', () => {
  const { loadData, personalCents, roster } = require('../scripts/data-checks.cjs');
  const { data, errors } = loadData(path.join(__dirname, '..'));
  assert.deepEqual(errors, []);
  const build = model(data.tournaments.catalog, data.results, data.tournaments.axes);
  const snapshot = JSON.stringify(data.results);
  for (const name of new Set(data.results.flatMap(roster))) {
    const events = data.results.filter(event => roster(event).includes(name));
    const rows = build(events);
    assert.deepEqual(rows.map(item => item.record.id).sort(), events.map(event => event.id).sort(), name + ': no source record can disappear');
    assert.equal(Math.round(rows.at(-1).cumulative * 100), events.reduce((sum, event) => sum + personalCents(event), 0), name + ': cumulative individual cash');
    assert.ok(rows.every(item => Number.isFinite(item.cash) && Number.isFinite(item.cumulative)), name + ': finite amounts');
  }
  assert.equal(JSON.stringify(data.results), snapshot, 'The full published dataset is immutable');
});
