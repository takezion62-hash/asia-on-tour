'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { loadData, roster, personalCents } = require('../scripts/data-checks.cjs');
const data = loadData(path.join(__dirname, '..')).data;
const regionalWeights = { ME: 1.1, EU: 1.4, NAC: 1.2, NAW: 1, OCE: 1.1, BR: 1.3 };
const reload = data.tournaments.catalog.find(item => item.seasonId === 'S42' && item.subtype === 'solo-reload-victory-cup');
const unknownMode = { ...reload, id: 'aot-pr-fixture-unknown-mode', name: 'AOT PR形式未確認', mode: 'unknown', sourceEventIds: ['S42_AotPrUnknownMode'] };
const past = { ...reload, id: 'aot-pr-fixture-past', name: 'AOT PR過去シーズン', seasonId: 'S41', chapter: 7, season: 3, sourceEventIds: ['S41_AotPrPast'] };
const oneDecimal = value => value.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function record(id, fields = {}) {
  const { catalog = reload, ...overrides } = fields;
  const region = overrides.region || 'NAW';
  return {
    id, player: 'Fixture Player', date: catalog.seasonId === 'S41' ? '2026-08-01' : '2026-10-24', region,
    event: catalog.name, chapter: catalog.chapter, season: catalog.season, seasonId: catalog.seasonId,
    kind: '賞金決勝', round: 'Event 5 · Round 2 / 賞金決勝', rank: 4, points: 100, kills: 10, vrs: 1,
    prize: 0, verified: true, note: 'ブラウザーテスト用。公開JSONは変更しません。',
    source: `https://fortnitetracker.com/events/epicgames_${catalog.sourceEventIds[0]}_${region}?window=${catalog.seasonId}_AotPr_Event5_Round2_${region}`,
    ...overrides
  };
}
async function fixture(page, results) {
  const rows=results.map((row,index)=>({__aotOrder:index,...row}));
  const groups=new Map();
  for(const row of rows){
    const season=row.seasonId||'unknown';
    if(!groups.has(season))groups.set(season,[]);
    groups.get(season).push(row);
  }
  const names=[...new Set(rows.flatMap(row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player]))];
  const scopes={all:{id:'all',label:'全期間',count:rows.length,prizeTotal:0,earners:[],rankingFile:null}};
  const seasonOrder=[...groups.keys()];
  for(const [id,part] of groups){
    const sample=part[0],meta={id,label:'CH'+sample.chapter+' S'+sample.season,
      chapter:sample.chapter,season:sample.season,count:part.length,
      file:'season-data/'+id+'.json',rankingFile:null,prizeTotal:0,earners:[]};
    scopes[id]=meta;
  }
  const manifest={format:1,total:rows.length,scopes,seasonOrder,names,previews:{}};
  await page.route('**/season-data/*.json',route=>{
    const file=new URL(route.request().url()).pathname.split('/').at(-1);
    let value;
    if(file==='manifest.json')value=manifest;
    else if(file.endsWith('.json'))value=groups.get(file.slice(0,-5))||[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
  });
  for(const [file,value] of Object.entries({
    'results.json': results,
    'players.json': { candidates: [], confirmedAliases: {} },
    'tournaments.json': { ...data.tournaments, catalog: [...data.tournaments.catalog, unknownMode, past] }
  })) await page.route('**/' + file, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) }));
}
async function open(page, season = 'all') {
  await page.goto('/?season=' + season + '#players');
  await expect(page.locator('#aot-pr-status')).toContainText('戦績');
}
function playerRow(page, name) {
  return page.locator('#aot-pr-leaders .aot-pr-item').filter({ has: page.getByRole('link', { name, exact: true }) });
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('新しいPR資産を読み込み、既存の確認済み個人賞金と掲載データを維持する', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  const cssResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/aot-pr.css');
  await open(page);
  const css = await cssResponse;
  expect(css.status()).toBe(200);
  expect(css.headers()['content-type']).toContain('text/css');
  expect(await page.locator('#aot-pr-leaders .aot-pr-name').count()).toBeGreaterThan(0);
  expect(await page.locator('#aot-pr-leaders .aot-pr-name').count()).toBeLessThanOrEqual(50);
  const cash = data.results.reduce((sum, row) => sum + personalCents(row) * new Set(roster(row)).size, 0) / 100;
  await expect(page.locator('#player-earnings-sum')).toHaveText('$' + cash.toLocaleString('ja-JP'));
  await expect(page.locator('#aot-pr-section')).toContainText('公式の実力順位ではありません');
  await page.getByRole('button', { name: 'ダッシュボード', exact: true }).click();
  await expect(page.locator('#stat-results')).toHaveText(String(data.results.length));
  expect(failures).toEqual([]);
});

test('ALLと全6地域を切り替え、地域倍率・キーボード操作・長い名前の表示を確認する', async ({ page }) => {
  const longName = 'とても長い選手名_確認済みの掲載名をそのまま表示するためのプロフィール名ǃǃ';
  const rows = Object.keys(regionalWeights).map(region => record('region-' + region, { region, player: region === 'NAW' ? longName : region + ' Player' }));
  await fixture(page, rows);
  await open(page);
  await expect(page.locator('#aot-pr-leaders .aot-pr-name')).toHaveCount(6);
  for (const [region, multiplier] of Object.entries(regionalWeights)) {
    const control = page.locator('[data-aot-pr-region="' + region + '"]');
    await control.press('Enter');
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#aot-pr-leaders .aot-pr-name')).toHaveCount(1);
    // Rank 4, 10 Reload kills: (10 + 100/sqrt(4) + 10*0.7) * region.
    await expect(page.locator('#aot-pr-leaders .aot-pr-score')).toHaveText(oneDecimal(67 * multiplier) + 'AOT PR');
    await noOverflow(page);
  }
  await page.locator('[data-aot-pr-region="all"]').click();
  await expect(page.locator('#aot-pr-leaders .aot-pr-name')).toHaveCount(6);
  await playerRow(page, longName).getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
  await expect(page.locator('#profile-title')).toHaveText(longName);
  await noOverflow(page);
  await page.locator('#profile-back').click();
  await expect(page.locator('[data-aot-pr-region="all"]')).toHaveAttribute('aria-pressed', 'true');
});

test('予選・決勝を別に加点し、参加は1枠、プロフィール内訳と戻るを維持する', async ({ page }) => {
  const qualifier = record('qual', {
    player: 'Journey Player', kind: '予選', round: 'Event 5 · Round 1 / 予選', rank: 4, kills: 20,
    source: `https://fortnitetracker.com/events/epicgames_${reload.sourceEventIds[0]}_NAW?window=S42_AotPr_Event5_Round1_NAW`
  });
  await fixture(page, [qualifier, record('final', { player: 'Journey Player', rank: 1, kills: 10 })]);
  await open(page);
  await page.locator('[data-aot-pr-region="NAW"]').click();
  const row = playerRow(page, 'Journey Player');
  await expect(row.locator('.aot-pr-score')).toHaveText('139.4AOT PR');
  await expect(row).toContainText('参加 1枠');
  await row.getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
  await expect(page.locator('.aot-pr-profile')).toHaveCount(1);
  await expect(page.locator('.aot-pr-profile h2')).toContainText('139.4');
  await expect(page.locator('.aot-pr-overview')).toContainText('10.0');
  await expect(page.locator('.aot-pr-overview')).toContainText('117.5');
  await expect(page.locator('.aot-pr-overview')).toContainText('11.9');
  await page.locator('.aot-pr-breakdown summary').click();
  await expect(page.locator('.aot-pr-breakdown li')).toHaveCount(2);
  await expect(page.locator('.aot-pr-breakdown')).toContainText('予選');
  await expect(page.locator('.aot-pr-breakdown')).toContainText('賞金決勝');
  await expect(page.locator('.aot-pr-breakdown a')).toHaveCount(2);
  await page.locator('#profile-back').click();
  await expect(page.locator('[data-aot-pr-region="NAW"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(playerRow(page, 'Journey Player').locator('.aot-pr-score')).toHaveText('139.4AOT PR');
  await noOverflow(page);
});

test('未確認順位・キル・形式を区別し、未確認分類と同名別人を推測で加点・統合しない', async ({ page }) => {
  await fixture(page, [
    record('missing', { player: 'Missing Player', rank: null, kills: null }),
    record('unknown-mode', { catalog: unknownMode, player: 'Unknown Mode Player', rank: 4, kills: 100 }),
    record('unclassified', { event: '分類未確認の大会', player: 'Unclassified Player', rank: 1, kills: 100 }),
    record('ping', { player: 'p1ng' }), record('rgn-ping', { player: 'RGN p1ng' }),
    record('unverified', { player: 'Unverified Player', verified: false })
  ]);
  await open(page);
  await expect(page.locator('#aot-pr-leaders .aot-pr-name')).toHaveCount(4);
  await expect(playerRow(page, 'p1ng').locator('.aot-pr-score')).toHaveText('67.0AOT PR');
  await expect(playerRow(page, 'RGN p1ng').locator('.aot-pr-score')).toHaveText('67.0AOT PR');
  await expect(playerRow(page, 'Missing Player').locator('.aot-pr-score')).toHaveText('10.0AOT PR');
  await expect(playerRow(page, 'Unknown Mode Player').locator('.aot-pr-score')).toHaveText('60.0AOT PR');
  await playerRow(page, 'Missing Player').getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
  await page.locator('.aot-pr-breakdown summary').click();
  await expect(page.locator('.aot-pr-breakdown')).toContainText('順位未確認');
  await expect(page.locator('.aot-pr-breakdown')).toContainText('キル未確認');
  await page.locator('#profile-back').click();
  await playerRow(page, 'Unknown Mode Player').getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
  await page.locator('.aot-pr-breakdown summary').click();
  await expect(page.locator('.aot-pr-breakdown')).toContainText('形式未確認');
  await expect(page.locator('.aot-pr-breakdown')).toContainText('キル加点保留');
});

test('共通シーズン変更をランキングと直接プロフィールに反映し、セクションを重複挿入しない', async ({ page }) => {
  await fixture(page, [record('current', { player: 'Season Player' }), record('past', { catalog: past, player: 'Season Player', kills: 0 })]);
  await open(page);
  await expect(playerRow(page, 'Season Player').locator('.aot-pr-score')).toHaveText('127.0AOT PR');
  await page.locator('#season-select').selectOption('S42');
  await expect(playerRow(page, 'Season Player').locator('.aot-pr-score')).toHaveText('67.0AOT PR');
  await page.locator('#season-select').selectOption('S41');
  await expect(playerRow(page, 'Season Player').locator('.aot-pr-score')).toHaveText('60.0AOT PR');
  await playerRow(page, 'Season Player').getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
  await expect(page.locator('.aot-pr-profile h2')).toContainText('60.0');
  await page.locator('#season-select').selectOption('S42');
  await expect(page.locator('.aot-pr-profile')).toHaveCount(1);
  await expect(page.locator('.aot-pr-profile h2')).toContainText('67.0');
  await page.reload();
  await expect(page.locator('#profile-title')).toHaveText('Season Player');
  await expect(page.locator('.aot-pr-profile')).toHaveCount(1);
  await expect(page.locator('.aot-pr-profile h2')).toContainText('67.0');
  await noOverflow(page);
});


test('賞金獲得ボーナスを地域倍率付きで加点し、プロフィール内訳に表示する', async ({ page }) => {
  const paid = record('paid', { player: 'Paid Victory Player', region: 'EU', prize: 200, vrs: 2 });
  const unpaid = record('unpaid', { player: 'Unpaid Player', region: 'EU', prize: 0, vrs: 2 });
  await fixture(page, [paid, unpaid]);
  await open(page);
  await expect(playerRow(page,'Paid Victory Player').locator('.aot-pr-score')).toHaveText('149.8AOT PR');
  await expect(playerRow(page,'Unpaid Player').locator('.aot-pr-score')).toHaveText('93.8AOT PR');
  await expect(playerRow(page,'Paid Victory Player')).toContainText('賞金ボーナス 56.0');
  await playerRow(page,'Paid Victory Player').getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
  await expect(page.locator('.aot-pr-profile')).toContainText('賞金ボーナス');
  await expect(page.locator('.aot-pr-overview')).toContainText('56.0');
  await page.locator('.aot-pr-breakdown summary').click();
  await expect(page.locator('.aot-pr-breakdown')).toContainText('2VR');
  await noOverflow(page);
});

test('全戦績が加点保留でも空状態と直接プロフィールの未集計表示が安全に動く', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  const name = 'Classification Pending Player';
  await fixture(page, [record('classification-pending', { event: '分類が未確認の大会', player: name, rank: 1, kills: 100 })]);
  await open(page);
  await expect(page.locator('#aot-pr-leaders')).toHaveText('この条件で加点できる確認済み戦績はありません');
  await expect(page.locator('#aot-pr-leaders .aot-pr-score')).toHaveCount(0);
  await expect(page.locator('#aot-pr-status')).toContainText('0名 / 0戦績');
  await page.goto('/?season=all#player=' + encodeURIComponent(name));
  await expect(page.locator('#profile-title')).toHaveText(name);
  await expect(page.locator('.aot-pr-profile')).toHaveCount(1);
  await expect(page.locator('.aot-pr-profile h2')).toHaveText('AOT PR · 未集計');
  await expect(page.locator('.aot-pr-profile')).toContainText('大会分類などが未確認の記録は加点を保留');
  await expect(page.locator('.aot-pr-overview')).toHaveCount(0);
  await expect(page.locator('.aot-pr-breakdown')).toHaveCount(0);
  await noOverflow(page);
  expect(failures).toEqual([]);
});

test('予選突破を明記した選手だけ10ptを賞金とは別枠で付与し、プロフィールにも表示する',async({page})=>{
  const qualifier=record('qualifier-awarded',{player:'Qualification Player',kind:'予選',
    round:'Event 5 · Round 1 / 予選突破',rank:319,kills:3,vrs:0,prize:0,
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'});
  const final=record('qualifier-final',{player:'Qualification Player',kind:'賞金決勝',prize:0,vrs:0});
  const rankOnly=record('rank-no-advance',{player:'Just Participated',kind:'予選',round:'Event 5 · Round 1 / 予選',
    rank:321,prize:0,source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'});
  await fixture(page,[qualifier,final,rankOnly]);
  await open(page);
  const awarded=playerRow(page,'Qualification Player');
  const ordinary=playerRow(page,'Just Participated');
  await expect(awarded).toContainText('予選突破 10.0');
  await expect(ordinary).toContainText('予選突破 0.0');
  await awarded.getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
  await expect(page.locator('.aot-pr-overview')).toContainText('予選突破ボーナス');
  await expect(page.locator('.aot-pr-overview')).toContainText('10.0');
  await page.locator('.aot-pr-breakdown summary').click();
  await expect(page.locator('.aot-pr-breakdown')).toContainText('予選突破ボーナス 10.0');
  await expect(page.locator('.aot-pr-overview')).toContainText('賞金ボーナス');
});


test('official victory cup Round 1 advancement receives a bonus without a special round label',async({page})=>{
 const source='https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event4_Round1_NAW';
 const passed=record('rule-320',{player:'Rule-Confirmed Player',kind:'予選',round:'Event 4 · Round 1 / 予選',
   rank:320,kills:8,prize:0,source});
 const notPassed=record('rule-321',{player:'Not-Advanced Player',kind:'予選',round:'Event 4 · Round 1 / 予選',
   rank:321,kills:15,prize:0,source});
 await fixture(page,[passed,notPassed]);
 await open(page);
 await expect(playerRow(page,'Rule-Confirmed Player')).toContainText('予選突破 10.0');
 await expect(playerRow(page,'Not-Advanced Player')).toContainText('予選突破 0.0');
 await playerRow(page,'Rule-Confirmed Player').getByRole('link').click();
   await page.locator('[data-profile-tab="season"]').click();
 await page.locator('.aot-pr-breakdown summary').click();
 await expect(page.locator('.aot-pr-breakdown')).toContainText('公式通過枠');
});
