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
  cash: 'サイト掲載初の賞金獲得日', champion: '賞金決勝で総合優勝', podium: '賞金決勝で総合TOP3',
  skin: 'サイト掲載初のスキン報酬獲得日',
  milestone: amount => '掲載記録の累計個人賞金 $' + amount.toLocaleString('en-US') + '到達'
};
const has = (rows, id, reason) => rows.find(item => item.record.id === id).reasons.includes(reason);
const cashRecord = (id, date, amount, fields = {}, group = 'A') => record(id, date, { kind: '賞金決勝', round: 'Event 1 · Round 2 / 賞金決勝', prize: amount, ...fields }, group);
const skinRecord = (id, date, fields = {}, group = 'A') => record(id, date, { kind: 'スキン大会', round: 'スキン獲得', ...fields }, group);
const highlighted = rows => rows.filter(item => item.reasons.length > 0);

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


test('通常VR・予選通過・新地域参加・小さな自己最高更新・Practice上位だけではハイライトにしない', () => {
  const catalog = [category('A'), category('practice', { series: 'fncs', subtype: 'fncs-division-1-practice' })];
  const input = [record('first', '2026-09-01'), record('vr', '2026-09-02', { vrs: 1 }),
    record('more-vr', '2026-09-03', { vrs: 8 }), record('qualified', '2026-09-04', { rank: 10, round: '上位320名通過 / 予選' }),
    record('new-region', '2026-09-05', { region: 'OCE' }), record('slight-best', '2026-09-06', { rank: 9 }),
    record('practice', '2026-09-07', { kind: 'Practice', rank: 1, vrs: 4 }, 'practice')];
  const rows = model(catalog)(input);
  assert.equal(rows.length, input.length, 'All records remain available in 全戦績');
  assert.deepEqual(highlighted(rows), [], 'Zero highlights is a valid result');
  assert.ok(rows.every(item => item.cash === 0));
});

test('初賞金は確認済み現金の最初の日の全該当記録に付け、同日の累計は日末値を共有する', () => {
  const input = [record('before', '2026-08-31', { vrs: 3 }), cashRecord('cash-b', '2026-09-01', 0.2),
    cashRecord('cash-a', '2026-09-01', 0.1), cashRecord('next', '2026-09-02', 0.15)];
  const rows = model()(input);
  for (const id of ['cash-a', 'cash-b']) {
    assert.ok(has(rows, id, reasons.cash));
    assert.equal(rows.find(item => item.record.id === id).cumulative, 0.3);
  }
  assert.ok(!has(rows, 'before', reasons.cash));
  assert.ok(!has(rows, 'next', reasons.cash));
  assert.equal(rows.at(-1).cumulative, 0.45, 'Cumulative money uses integer cents');
});

test('賞金決勝の総合1位と2・3位を区別し、VRの有無や現金額から順位を推測しない', () => {
  const input = [cashRecord('winner', '2026-09-01', null, { rank: 1, vrs: 0 }),
    cashRecord('second', '2026-09-02', null, { rank: 2, vrs: 0 }),
    cashRecord('third', '2026-09-03', null, { rank: 3, vrs: 0 }),
    cashRecord('fourth', '2026-09-04', null, { rank: 4, vrs: 12 })];
  const rows = model()(input);
  assert.deepEqual(rows.find(item => item.record.id === 'winner').reasons, [reasons.champion]);
  for (const id of ['second', 'third']) assert.deepEqual(rows.find(item => item.record.id === id).reasons, [reasons.podium]);
  assert.deepEqual(rows.find(item => item.record.id === 'fourth').reasons, []);
  assert.ok(rows.every(item => item.cash === 0), 'A podium without a confirmed amount cannot invent cash');
});

test('順位未確認・不正な順位・未確認決勝・通常決勝や予選は賞金決勝TOP3にしない', () => {
  const input = [null, undefined, '', '1', 0, -1, 1.5, NaN, Infinity].map((rank, index) =>
    cashRecord('bad-rank-' + index, '2026-09-02', null, { rank }));
  input.push(cashRecord('unverified', '2026-09-02', null, { rank: 1, verified: false }));
  input.push(cashRecord('not-strictly-verified', '2026-09-02', null, { rank: 1, verified: 'true' }));
  input.push(record('unknown-stage', '2026-09-02', { rank: 1, kind: '未確認' }));
  input.push(record('normal-final', '2026-09-02', { rank: 1, kind: '決勝' }));
  input.push(record('qualifier', '2026-09-02', { rank: 1, vrs: 7 }));
  assert.deepEqual(highlighted(model()(input)), []);
});

test('Practiceやスキン大会の分類を賞金決勝TOP3へ取り違えない', () => {
  const catalog = [category('practice', { series: 'fncs', subtype: 'fncs-division-1-practice' }),
    category('skin', { series: 'skin-cup', subtype: 'skin-cup' })];
  const input = [cashRecord('practice-as-cash', '2026-09-01', null, { rank: 1 }, 'practice'),
    record('practice-kind', '2026-09-01', { kind: 'Practice', rank: 1 }, 'practice'),
    record('skin-as-cash', '2026-09-02', { kind: '賞金決勝', rank: 2 }, 'skin'),
    skinRecord('skin-kind', '2026-09-03', { round: 'スキン大会 / 参加', rank: 1 }, 'skin')];
  assert.deepEqual(highlighted(model(catalog)(input)), []);
});

test('累計個人賞金は$1,000・$5,000・$10,000に到達した日だけを抽出する', () => {
  const input = [cashRecord('before', '2026-09-01', 999.99), cashRecord('one-thousand', '2026-09-02', 0.01),
    cashRecord('still-under-five', '2026-09-03', 3999.99), cashRecord('five-thousand', '2026-09-04', 0.01),
    cashRecord('ten-thousand', '2026-09-05', 5000), cashRecord('after', '2026-09-06', 1)];
  const rows = model()(input);
  for (const [id, amount] of [['one-thousand', 1000], ['five-thousand', 5000], ['ten-thousand', 10000]]) {
    assert.deepEqual(rows.find(item => item.record.id === id).reasons, [reasons.milestone(amount)]);
  }
  assert.deepEqual(rows.find(item => item.record.id === 'still-under-five').reasons, []);
  assert.deepEqual(rows.find(item => item.record.id === 'after').reasons, []);
  assert.equal(rows.at(-1).cumulative, 10001);
});

test('一度に複数の節目を超えても同じ戦績は1件、より大きい累計の節目にも対応する', () => {
  const input = [cashRecord('large-first', '2026-09-01', 12000, { rank: 1 }),
    cashRecord('larger', '2026-09-02', 88000), cashRecord('after', '2026-09-03', 1)];
  const rows = model()(input);
  const first = rows.find(item => item.record.id === 'large-first');
  assert.equal(rows.filter(item => item.record.id === 'large-first').length, 1);
  assert.deepEqual(new Set(first.reasons), new Set([reasons.cash, reasons.champion, reasons.milestone(1000), reasons.milestone(5000), reasons.milestone(10000)]));
  assert.deepEqual(rows.find(item => item.record.id === 'larger').reasons, [reasons.milestone(50000), reasons.milestone(100000)]);
  assert.deepEqual(rows.find(item => item.record.id === 'after').reasons, []);
  assert.ok(rows.every(item => new Set(item.reasons).size === item.reasons.length));
});

test('同日に節目を超えた場合はその日の現金獲得記録だけに付け、時刻不明の順序を作らない', () => {
  const input = [cashRecord('previous', '2026-09-01', 900), cashRecord('cash-b', '2026-09-02', 60),
    record('no-cash', '2026-09-02', { vrs: 8 }), cashRecord('cash-a', '2026-09-02', 40)];
  const rows = model()(input);
  for (const id of ['cash-a', 'cash-b']) {
    assert.ok(has(rows, id, reasons.milestone(1000)));
    assert.equal(rows.find(item => item.record.id === id).cumulative, 1000);
  }
  assert.deepEqual(rows.find(item => item.record.id === 'no-cash').reasons, []);
  assert.deepEqual(model()([...input].reverse()).map(item => ({ id: item.record.id, reasons: item.reasons })),
    rows.map(item => ({ id: item.record.id, reasons: item.reasons })), 'Input order cannot invent an intraday threshold-crossing record');
});

test('デュオは確認済み個人分のみ、予選・スキン・未確認・配分不明は累計へ加算しない', () => {
  const duo = { player: 'Fixture Player / Partner', players: ['Fixture Player', 'Partner'], kind: '賞金決勝', prize: 1200, prizePerPlayer: 600 };
  const input = [record('duo', '2026-09-01', duo),
    record('qualifying', '2026-09-02', { prize: 1000, vrs: 9 }),
    record('skin', '2026-09-02', { kind: 'スキン大会', prize: 1000 }),
    record('cosmetic', '2026-09-02', { kind: 'コスメ大会', prize: 1000 }),
    record('unverified', '2026-09-02', { kind: '賞金決勝', prize: 1000, verified: false }),
    record('unknown-share', '2026-09-02', { ...duo, prizePerPlayer: null }),
    record('overallocated-share', '2026-09-02', { ...duo, prizePerPlayer: 700 }),
    record('unknown-prize', '2026-09-02', { kind: '賞金決勝', prize: null }),
    cashRecord('individual-four-hundred', '2026-09-03', 400)];
  const rows = model()(input);
  assert.equal(rows.find(item => item.record.id === 'duo').cash, 600);
  assert.ok(!has(rows, 'duo', reasons.milestone(1000)), 'A team total cannot trigger a personal milestone');
  assert.ok(rows.filter(item => !['duo', 'individual-four-hundred'].includes(item.record.id)).every(item => item.cash === 0 && item.reasons.length === 0));
  assert.equal(rows.at(-1).cumulative, 1000);
  assert.ok(has(rows, 'individual-four-hundred', reasons.milestone(1000)));
});

test('スキン報酬は確認済みの明示的な獲得表示の初日にだけ掲載し現金には加算しない', () => {
  const input = [skinRecord('participation', '2026-08-31', { round: 'スキン大会 / 参加', rank: 1 }),
    skinRecord('reward-b', '2026-09-01', { round: 'Round 1 / スキン獲得', prize: 1000 }),
    skinRecord('reward-a', '2026-09-01', { kind: 'コスメ大会', round: 'スキン獲得' }),
    skinRecord('later-reward', '2026-09-02')];
  const rows = model()(input);
  for (const id of ['reward-a', 'reward-b']) assert.deepEqual(rows.find(item => item.record.id === id).reasons, [reasons.skin]);
  for (const id of ['participation', 'later-reward']) assert.deepEqual(rows.find(item => item.record.id === id).reasons, []);
  assert.ok(rows.every(item => item.cash === 0 && item.cumulative === 0));
});

test('スキン参加や報酬条件の説明、対象外・未獲得・未確認は獲得と推測しない', () => {
  const input = ['スキン大会', 'スキン獲得対象外', 'スキン未獲得', 'スキン獲得未確認', 'スキン獲得条件', 'スキン獲得を争う', 'スキン獲得対象', '上位100名スキン獲得'].map((round, index) =>
    skinRecord('not-earned-' + index, '2026-09-01', { round, rank: 1 }));
  input.push(skinRecord('unverified-reward', '2026-09-01', { verified: false }));
  input.push(skinRecord('note-only-reward', '2026-09-01', { round: 'Round 1', note: 'スキン獲得対象 / スキン報酬獲得確認済み' }));
  input.push(record('wrong-kind', '2026-09-01', { round: 'スキン獲得' }));
  assert.deepEqual(highlighted(model()(input)), []);
});

test('過去シーズンの初賞金・初スキン・累計を履歴から判定し選択シーズンの先頭で作り直さない', () => {
  const previousCash = cashRecord('previous-cash', '2026-06-01', 900);
  const previousSkin = skinRecord('previous-skin', '2026-06-02');
  const currentCash = cashRecord('current-cash', '2026-09-01', 100);
  const currentSkin = skinRecord('current-skin', '2026-09-02');
  const currentLater = cashRecord('current-later', '2026-09-03', 10);
  const history = [previousCash, previousSkin, currentCash, currentSkin, currentLater];
  const rows = model()([currentCash, currentSkin, currentLater], history);
  assert.deepEqual(rows.map(item => item.record.id), ['current-cash', 'current-skin', 'current-later']);
  assert.deepEqual(rows[0].reasons, [reasons.milestone(1000)]);
  assert.ok(rows.every(item => !item.reasons.includes(reasons.cash) && !item.reasons.includes(reasons.skin)));
  assert.equal(rows.at(-1).cumulative, 110, 'Selected-period graph balances continue to exclude other seasons');
});

test('日付不明の初賞金・初スキン・到達日を主張せず、確認済み賞金決勝の順位は保持する', () => {
  const input = [cashRecord('undated-cash', '', 1000, { rank: 1 }),
    skinRecord('undated-skin', null), skinRecord('dated-skin', '2026-09-01'), cashRecord('dated', '2026-09-01', 500),
    cashRecord('later', '2026-09-02', 500), cashRecord('invalid-date', '2026-02-30', null, { rank: null }),
    record('missing-fields', null, { rank: null, points: null, kills: null, vrs: null, prize: null })];
  const rows = model()(input);
  assert.deepEqual(rows.find(item => item.record.id === 'undated-cash').reasons, [reasons.champion]);
  assert.deepEqual(rows.find(item => item.record.id === 'undated-skin').reasons, []);
  assert.deepEqual(rows.find(item => item.record.id === 'invalid-date').reasons, []);
  assert.deepEqual(rows.find(item => item.record.id === 'dated-skin').reasons, []);
  assert.ok(rows.every(item => !item.reasons.includes(reasons.cash) && !item.reasons.includes(reasons.skin) && !item.reasons.some(reason => reason.includes('累計個人賞金'))),
    'An undated earned reward makes its first day or cumulative crossing date unprovable');
  assert.equal(rows.at(-1).cumulative, 2000);
  assert.deepEqual(model()([]), []);
});

test('日付不明の通常戦績だけなら確認済み現金やスキン報酬の初日判定を妨げない', () => {
  const input = [record('undated-qualifier', null, { vrs: 4 }),
    cashRecord('dated-cash', '2026-09-01', 1000), skinRecord('dated-skin', '2026-09-02')];
  const rows = model()(input);
  assert.ok(has(rows, 'dated-cash', reasons.cash));
  assert.ok(has(rows, 'dated-cash', reasons.milestone(1000)));
  assert.ok(has(rows, 'dated-skin', reasons.skin));
  assert.deepEqual(rows.find(item => item.record.id === 'undated-qualifier').reasons, []);
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
