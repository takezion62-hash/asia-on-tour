'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadData, validateData, summarize, personalCents, seasonFor, tournamentFor } = require('../scripts/data-checks.cjs');
const AotPR = require('../aot-pr.js');
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

test('S43 Solo Reload Test Cup ME/NAW retains all verified non-cash results and 0.25 AOT PR weight',()=>{
  const sameEvent=current.results.filter(r=>r.event==='Solo Reload Test Cup'&&r.date==='2026-11-02');
  // Score-bearing Test Cup results and participation-only confirmations must remain distinct.
  const records=sameEvent.filter(r=>r.kind==='Test Cup');
  const confirmations=sameEvent.filter(r=>r.kind==='参加確認');
  // Historical registrations grow, so keep the original six as a floor.
  assert.ok(records.length>=6);
  assert.ok(records.filter(r=>r.region==='ME').length>=2);
  assert.ok(records.filter(r=>r.region==='NAW').length>=4);
  assert.ok(confirmations.length>=2);
  assert.equal(records.length+confirmations.length,sameEvent.length);
  const t=current.tournaments.catalog.find(t=>t.id==='ch7s5-solo-reload-test-cup');
  assert.ok(t);assert.equal(t.series,'test-cup');assert.equal(t.subtype,'solo-reload-test-cup');
  assert.equal(t.mode,'reload');assert.equal(t.seasonId,'S43');
  const rk=records.find(r=>r.player==='3peace'&&r.region==='NAW');
  assert.equal(rk.rank,5);assert.equal(rk.kills,58);assert.equal(rk.vrs,2);
  const grape=records.filter(r=>r.player==='RVL ぐれーぷふぁんぼーい');
  assert.ok(grape.length>=2);assert.ok(grape.some(r=>r.region==='ME'));assert.ok(grape.some(r=>r.region==='NAW'));
  for(const row of records){
    assert.equal(row.kind,'Test Cup');assert.equal(row.verified,true);assert.equal(row.prize,0);
    assert.equal(tournamentFor(row,current)?.id,t.id);
    assert.equal(AotPR.eventMultiplier(row,t),0.25);
    assert.equal(personalCents(row),0);
  }
  for(const row of confirmations){
    // A verified non-cash Test Cup may explicitly record $0; unknown payouts remain null.
    assert.ok(row.prize===null || row.prize===0,'Participation-only record must not claim cash');
    assert.equal(personalCents(row),0);
    assert.equal(AotPR.eventMultiplier(row,t),0.25,'Verified Test Cup attendance uses conservative series weight');
  }
  const result=AotPR.calculate(records,{names:r=>[r.player],classify:r=>tournamentFor(r,current)});
  assert.equal(result.recordCount,records.length);
  assert.ok(result.ranked.length>=5);
  assert.equal(result.ranked.find(r=>r.name==='3peace').bonus,0);
  assert.ok(result.ranked.find(r=>r.name==='3peace').score>0);
});

test('2026/9/14 ME Solo Victory Cup qualifiers and hero name merge preserve historical winnings',()=>{
  const qualifiers=current.results.filter(r=>r.date==='2026-09-14'&&r.region==='ME'&&r.event==='Solo Victory Cup Battle Royale'&&r.kind==='予選');
  const expected=new Map([['ぷりなの',[51,256,8,17,0]],['ぱな',[89,244,8,31,2]],['Botえもん',[117,240,8,15,0]],['あいむらま',[123,238,6,11,1]],['らいちん',[128,238,6,4,0]],['さばべる',[180,233,8,14,0]],['rakirye',[216,229,7,11,1]],['ウン！ボクつよい！',[245,227,7,8,0]],['ゆあもにーさまの歌を聴けぇǃ',[257,226,8,5,0]],['ヒーロー',[260,225,6,10,1]],['ずーにんぐくん',[306,222,7,6,0]],['らず',[313,221,8,20,1]],['こがね',[325,221,6,9,0]],['Melon',[390,217,6,5,0]],['angelwing',[407,216,7,8,0]],['koafnr',[409,216,8,8,0]],['falcon manzuǃ',[410,216,8,8,0]],['おーくん',[455,214,7,6,0]],['RGN 俺が俺の人生の主人公だǃ',[456,214,6,1,0]],['かめてぃん',[468,213,8,33,0]],['白昼なん苦しい',[480,213,7,7,0]],['ぴよぴよ',[487,212,6,9,1]],['AXIS lameloball',[534,211,8,6,0]],['SPE ぴーぽむ',[535,211,8,4,0]],['おさる',[557,210,7,3,0]],['りむる',[601,208,8,8,1]],['DIE Peterbot 23ǃ',[621,207,8,6,1]],['nia',[633,207,6,4,0]],['Dartri',[706,204,8,4,0]],['Karf',[711,203,6,29,1]],['Jack',[742,203,8,7,0]],['Ares.Mea',[747,203,5,3,0]],['らりむ',[781,202,8,5,0]]]);
  assert.equal(qualifiers.length,33);
  for(const row of qualifiers){
    assert.deepEqual([row.rank,row.points,row.matches,row.kills,row.vrs],expected.get(row.player),row.player);
    assert.equal(row.kind,'予選');assert.equal(row.prize,null);assert.equal(row.verified,true);
    assert.equal(tournamentFor(row,current)?.id,'ch7s4-solo-victory-cup');
    assert.equal(personalCents(row),0);
  }
  const heroRows=current.results.filter(r=>r.player==='ヒーロー');
  assert.ok(heroRows.length>=5,'追加登録分も含めて過去のヒーロー5戦績を保持');
  assert.equal(new Set(heroRows.map(r=>r.id)).size,heroRows.length,'同一選手の登録IDは重複しない');
  assert.ok(heroRows.every(r=>r.playerRaw==='REBEL 英雄のヒーロー 轟'));
  assert.deepEqual(heroRows.filter(r=>r.prize>0).map(r=>r.prize).sort(),[100,100]);
  assert.ok(current.players.candidates.some(p=>p.name==='ヒーロー'));
  assert.ok(!current.players.candidates.some(p=>p.name==='REBEL 英雄のヒーロー 轟'));
  assert.ok(current.players.confirmedAliases['ヒーロー'].includes('REBEL 英雄のヒーロー 轟'));
  const angel=current.results.filter(r=>r.player==='angelwing');
  assert.ok(angel.length>=3,'過去のangelwing戦績3件を保持し、新規登録も認める');
  assert.equal(new Set(angel.map(r=>r.id)).size,angel.length,'angelwingの結果ID重複を検知する');
  assert.ok(current.players.candidates.some(c=>c.name==='angelwing'));
  assert.ok(!current.players.candidates.some(c=>c.name==='Starbucks Lоvers'));
  assert.ok(current.players.confirmedAliases.angelwing.includes('Starbucks Lоvers'));
  assert.equal(current.results.filter(r=>r.player==='Starbucks Lоvers').length,0);
});

test('Champion Focus FNCS Cup is a skin competition, not an FNCS main event', () => {
  const record = current.results.find(row => row.event === 'Champion Focus FNCS Cup');
  assert.ok(record, 'Champion Focus result must remain registered');
  assert.equal(record.kind, 'スキン大会');
  const tournament = tournamentFor(record, current);
  assert.ok(tournament, 'Champion Focus catalog record must resolve');
  assert.equal(tournament.series, 'skin-cup');
  assert.equal(tournament.subtype, 'champion-focus-fncs-cup');
  assert.equal(AotPR.eventMultiplier(record, tournament), 0.5);
  assert.equal(personalCents(record), 0);
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

test('異なる戦績IDでも同じ大会・ラウンド・選手の二重登録を拒否する', () => {
  bad((data,row) => {
    const duplicate=structuredClone(row);
    duplicate.id += '-second-copy';
    data.results.push(duplicate);
  }, 'id', '同じ大会');
});

test('Event番号のない手動戦績と公式Event番号付き戦績を重複判定し賞金を二重計上しない', () => {
  for (const [name,rank] of [['あくりあ',23],['Yanagi',20]]) {
    const matches=current.results.filter(row => row.player===name && row.date==='2026-09-22' &&
      row.region==='NAW' && row.rank===rank && row.kind==='賞金決勝');
    assert.equal(matches.length,1,name+' must have one qualifying cash result');
    const row=matches[0];
    assert.equal(row.prize,100);
    assert.equal(row.round,'Event 3 · Round 2 / 賞金決勝');
    assert.equal(row.matches,3);
    assert.ok(row.profileUrl,'original user-provided Tracker identity must remain');
  }
  const data=clone();
  const original=data.results.find(row => row.id==='s42-naw-solo-vc-final-20260922-akuria');
  assert.ok(original);
  const dupe=structuredClone(original);
  dupe.id+='-without-event-number';
  dupe.round='Round 2 / 賞金決勝（Event番号未確認）';
  dupe.source='https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW';
  delete dupe.matches;
  data.results.push(dupe);
  const result=validateData(data);
  assert.ok(result.errors.some(e => e.id===dupe.id && e.field==='id' &&
    e.message.includes('同一成績の重複疑い')),JSON.stringify(result.errors));
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

test('予選VR・スキン大会・未確認賞金を現金へ加算しない', () => {
  const base = current.results[soloIndex];
  for (const row of [{ ...base, kind: '予選', vrs: 99, prize: null }, { ...base, kind: 'スキン大会', prize: 100 }, { ...base, kind: 'コスメ大会', prize: 100 }, { ...base, verified: false }, { ...base, prize: 0 }]) assert.equal(personalCents(row), 0);
  bad((data, row) => { row.kind = '予選'; row.prize = 100; }, 'prize', '予選VR');
  bad((data, row) => { row.kind = 'スキン大会'; row.prize = 100; }, 'prize', 'スキン大会');
  bad((data, row) => { row.kind = 'Test Cup'; row.prize = 100; }, 'prize', 'Test Cup');
  bad((data, row) => { row.kind = 'コスメ大会'; row.prize = 0; }, 'kind', 'スキン大会');
});

test('Merged Override and dual-tag cosmetic Icon Cup metadata remains valid',()=>{
  for(const t of current.tournaments.catalog.filter(t=>t.name.startsWith('Override Series:')))assert.equal(t.series,'skin-cup');
  for(const name of ['Inoxtag Icon Cup Battle Royale','Madison Beer Icon Cup Reload','PlayStation NickEh30 Icon Cup']){const t=current.tournaments.catalog.find(t=>t.name===name);assert.ok(t);assert.equal(t.series,'icon-cup');assert.deepEqual(t.additionalSeries,['skin-cup']);}
  const nick=current.tournaments.catalog.find(t=>t.name==='PlayStation NickEh30 Icon Cup');
  const qualifying=current.results.find(e=>e.event===nick.name&&e.kind==='予選');
  const final=current.results.find(e=>e.event===nick.name&&e.kind==='決勝');
  assert.ok(qualifying&&final);
  assert.equal(AotPR.eventMultiplier(qualifying,nick),0.50);
  assert.equal(AotPR.eventMultiplier(final,nick),1.20);
  assert.equal(personalCents(qualifying),0);
  assert.equal(personalCents(final),0);
  bad(data=>{data.tournaments.catalog[0].additionalSeries=['not-real'];},'additionalSeries','登録済み');
  bad(data=>{data.tournaments.catalog[0].additionalSeries=[data.tournaments.catalog[0].series];},'additionalSeries','重複');
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
  // No official mapping exists in this synthetic case, so no canonical metadata is asserted.
  delete row.tournamentId; delete row.seasonId; delete row.chapter; delete row.season;
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
  row.id += '-new-valid-event'; row.date = '2026-10-28'; row.prize = 123.45; data.results.push(row);
  assert.deepEqual(validateData(data).errors, []);
  const next = summarize(data);
  assert.equal(next.records, original.records + 1);
  assert.equal(next.total, original.total + 123.45);
  assert.equal(next.ranking.find(p => p.name === row.player).total, original.ranking.find(p => p.name === row.player).total + 123.45);
});

test('2026/9/14 ME Solo Victory Cup Event 2 final 10 additional records and historical winner prize',()=>{
  const finals=current.results.filter(r=>r.date==='2026-09-14'&&r.region==='ME'&&r.event==='Solo Victory Cup Battle Royale'&&r.kind==='賞金決勝');
  assert.ok(finals.length>=11,'初期11戦績を保持しながら後から決勝参加者が増えることを許容');
  assert.equal(new Set(finals.map(r=>r.id)).size,finals.length,'同じ決勝戦績を重複登録しない');
  const expected=new Map([['ヒーロー',[230,3,3]],['rakirye',[289,3,2]],['らいちん',[297,3,2]],['らりむ',[311,3,2]],['AXIS lameloball',[341,3,2]],['Dartri',[354,3,2]],['こがね',[404,2,1]],['Ares.Mea',[409,3,1]],['ぷりなの',[412,3,1]],['nia',[424,3,1]]]);
  for(const [name,[rank,matches,kills]] of expected){
    const record=finals.find(r=>r.player===name);
    assert.ok(record,'missing finalist '+name);
    assert.deepEqual([record.rank,record.matches,record.kills,record.points,record.vrs,record.prize,record.verified],[rank,matches,kills,0,0,0,true],name);
    assert.equal(record.kind,'賞金決勝');
    assert.equal(record.round,'Event 2 · Round 2 / 賞金決勝');
    assert.equal(tournamentFor(record,current)?.id,'ch7s4-solo-victory-cup');
    const qual=current.results.find(r=>r.date==='2026-09-14'&&r.region==='ME'&&r.event==='Solo Victory Cup Battle Royale'&&r.kind==='予選'&&r.player===name);
    assert.ok(qual,'missing qualifier '+name);
    assert.equal(record.profileUrl,qual.profileUrl);
  }
  const kametin=finals.find(r=>r.player==='かめてぃん');
  assert.ok(kametin);
  assert.equal(kametin.prize,100);
});
