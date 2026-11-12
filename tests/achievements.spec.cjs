'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {loadData,seasonFor}=require('../scripts/data-checks.cjs');
const achievements=require('../achievements.js');
const data=loadData(path.join(__dirname,'..')).data;
const records=data.results;
const roster=row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player];
const sample=records.find(row=>row.verified===true&&roster(row).length===1)||records.find(row=>row.verified===true);
const player=roster(sample)[0];


// Full-history achievements must be tested with the exact same records as the
// season-shard reader. Production no longer requests results.json on page load.
async function mockResults(page, rows) {
  const indexed=rows.map((row,index)=>({__aotOrder:index,...row}));
  const manifest={
    format:1,total:indexed.length,
    scopes:{
      all:{id:'all',label:'全期間',count:indexed.length},
      S42:{id:'S42',label:'CH7 S4',chapter:7,season:4,count:indexed.length,file:'season-data/S42.json'}
    },
    seasonOrder:['S42'],
    names:[...new Set(indexed.flatMap(row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player]).filter(Boolean))],
    previews:{}
  };
  await page.route('**/season-data/*.json',route=>{
    const file=new URL(route.request().url()).pathname.split('/').at(-1);
    const payload=file==='manifest.json'?manifest:indexed;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
}

async function openAwards(page){
  await page.locator('[data-profile-tab="analysis"]').click();
  await page.locator('[data-analysis-fold="awards"] > summary').click();
}

async function expandAchievements(page){
  const gallery=page.locator('#profile-achievements .achievement-collection');
  await gallery.locator('summary.achievement-toggle').click();
  await expect(gallery).toHaveAttribute('open','');
}


test('称号のスクリプトとスタイルをテスト用サーバーが正しく配信する',async({request})=>{
  const js=await request.get('/achievements.js');
  const css=await request.get('/achievements.css');
  expect(js.status()).toBe(200);
  expect(css.status()).toBe(200);
  expect(await js.text()).toContain('AsiaAchievements');
  expect(await css.text()).toContain('achievement-section');
});

test('既存プロフィールで獲得済みと未獲得の称号、代表称号、進捗を表示する',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?season=all#player='+encodeURIComponent(player));
  await openAwards(page);
  const gallery=page.locator('#profile-achievements');
  await expect(gallery).toBeVisible();
  const collection=gallery.locator('.achievement-collection');
  await expect(collection).not.toHaveAttribute('open','');
  await expect(gallery.locator('.evo-grid')).toBeHidden();
  await expect(gallery.locator('.achievement-toggle')).toContainText('すべての称号を見る');
  await expandAchievements(page);
  await expect(gallery.locator('.evo-grid')).toBeVisible();
  await collection.locator('summary.achievement-toggle').click();
  await expect(gallery.locator('.evo-grid')).toBeHidden();
  await expandAchievements(page);
  const independent=achievements.calculate(records,player);
  await expect(gallery.locator('[data-achievement-count]')).toHaveText(independent.evolution.earnedStages+' / '+independent.evolution.totalStages);
  await expect(gallery.locator('[data-achievement-title]')).toHaveText(independent.evolution.featured?.current?.title||'挑戦中');
  await expect(gallery.locator('[data-evolution-track]')).toHaveCount(6);
  const found=await gallery.locator('[data-evolution-track]').evaluateAll(elements=>elements.map(e=>e.dataset.evolutionTrack));
  expect(found).toEqual(independent.evolution.tracks.map(t=>t.id));
  for(const track of independent.evolution.tracks){
    const badge=gallery.locator('[data-evolution-track="'+track.id+'"]');
    await expect(badge).toHaveAttribute('data-evolution-tier',track.current?.tier||'locked');
    await expect(badge.locator('.evo-current strong')).toHaveText(track.value.toLocaleString('ja-JP'));
    await expect(badge.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow',String(track.percent));
  }
  const first=gallery.locator('[data-evolution-track="expeditions"]');
  await first.locator('summary').click();
  await expect(first.locator('.evo-level-details li')).toHaveCount(5);
  expect(errors).toEqual([]);
  const period=seasonFor(sample,data);
  if(period!=='unknown'){
    await page.locator('#season-select').selectOption(period);
    await expect(gallery.locator('[data-achievement-count]')).toHaveText(independent.evolution.earnedStages+' / '+independent.evolution.totalStages);
    await expect(gallery.locator('[data-achievement-title]')).toHaveText(independent.evolution.featured?.current?.title||'挑戦中');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test('選手名鑑の称号プレビューから本人プロフィールへ移動できる',async({page})=>{
  await page.goto('/?season=all#players');
  const card=page.locator('#all-players [data-open-profile]').filter({has:page.locator('[data-player-achievement]')}).first();
  await expect(card).toBeVisible();
  const name=await card.getAttribute('data-open-profile');
  const expected=achievements.calculate(records,name);
  await expect(card.locator('[data-player-achievement]')).toHaveAttribute('data-player-achievement',expected.evolution.featured?.id||'none');
  await card.click();
  await expect(page.locator('#profile-title')).toHaveText(name);
  await expect(page.locator('[data-achievement-title]')).toHaveText(expected.evolution.featured?.current?.title||'挑戦中');
});

test('確認されていない結果だけでは称号は獲得できず、空の状態も案内する',async({page})=>{
  const onlyOne={...sample,id:'achievements-unverified-test',verified:false,reported:true,vrs:15,prize:99999,kind:'賞金決勝',rank:1};
  await mockResults(page, [onlyOne]);
  await page.goto('/?season=all#player='+encodeURIComponent(player));
  await openAwards(page);
  await expandAchievements(page);
  await expect(page.locator('#profile-achievements [data-achievement-count]')).toHaveText('0 / '+achievements.EVOLUTION_TRACKS.length*5);
  await expect(page.locator('[data-achievement-title]')).toHaveText('挑戦中');
  await expect(page.locator('.evo-card[data-evolution-tier="locked"]')).toHaveCount(6);
  await expect(page.locator('[data-evolution-track="expeditions"] .evo-current strong')).toHaveText('0');
});

test('公開済みのスキン報酬とチームVRを正しい条件で計上する',async({page})=>{
  const skin=records.find(row=>row.verified===true&&achievements.confirmedSkin(row));
  const team=records.find(row=>row.verified===true&&Array.isArray(row.players)&&row.players.length>1&&Number.isInteger(row.vrs)&&row.vrs>0);
  expect(skin,'明示的なスキン報酬記録').toBeTruthy();
  expect(team,'確認済みチーム戦VR').toBeTruthy();
  const skinName=roster(skin)[0],teamName=roster(team)[0];
  await page.goto('/?season=all#player='+encodeURIComponent(skinName));
  await openAwards(page);
  await expandAchievements(page);
  const expected=achievements.calculate(records,skinName);
  expect(expected.metrics.skins).toBeGreaterThan(0);
  await expect(page.locator('[data-evolution-track="skins"]:not([data-evolution-tier="locked"])')).toBeVisible();
  await page.goto('/?season=all#player='+encodeURIComponent(teamName));
  await openAwards(page);
  await expandAchievements(page);
  const teamData=achievements.calculate(records,teamName);
  expect(teamData.metrics.vrs).toBeGreaterThan(0);
  await expect(page.locator('[data-evolution-track="victories"]:not([data-evolution-tier="locked"])')).toBeVisible();
  await expect(page.locator('#profile-achievements .achievement-note')).toContainText('チーム戦');
});


test('特別称号は30種類から判定し、獲得済み・未獲得・レア度・出典を閲覧できる',async({page})=>{
  const person=records.find(row=>row.verified===true&&(row.players||[row.player]).length===1)?.player||player;
  const expected=achievements.calculate(records,person,{catalog:data.tournaments.catalog}).special;
  await page.goto('/?season=all#player='+encodeURIComponent(person));
  await openAwards(page);
  await expandAchievements(page);
  const section=page.locator('#profile-special-achievements');
  await expect(section).toBeVisible();
  await expect(section.locator('[data-special-count]')).toHaveText(expected.earned+' / '+expected.total);
  await expect(section.locator('[data-special-unlocked="true"]')).toHaveCount(expected.earned);
  if(expected.earned){
    const card=section.locator('[data-special-unlocked="true"]').first();
    const id=await card.getAttribute('data-special-id');
    const badge=expected.unlocked.find(a=>a.id===id);
    await expect(card).toHaveAttribute('data-special-rarity',badge.rarity);
    await card.locator('summary').click();
    await expect(card.locator('[data-special-evidence-id]')).toHaveCount(badge.evidence.length);
  }
  if(expected.locked.length){
    await section.locator('.special-locked-details summary').click();
    await expect(section.locator('[data-special-unlocked="false"]')).toHaveCount(expected.locked.length);
    await expect(section.locator('[data-special-id="silent-earner"]')).toHaveCount(1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test('0キル現金賞金の特別称号は本人の個人賞金と明示0キルだけで付与される',async({page})=>{
  const row=records.find(r=>r.verified===true&&r.kind==='賞金決勝'
    &&(r.players||[r.player]).length===1&&typeof r.prize==='number'&&r.prize>0);
  expect(row,'実データ内にソロの確認済み現金賞金記録が存在する').toBeTruthy();
  const name=(row.players||[row.player])[0];
  const valid={...row,id:'test-special-0kill-cash',player:name,players:[name],kills:0,vrs:0,rank:21,prize:100,verified:true};
  const reported={...valid,id:'test-reported',verified:false,kills:0,prize:500};
  await mockResults(page, [valid,reported]);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expandAchievements(page);
  await expect(page.locator('[data-special-id="silent-earner"][data-special-unlocked="true"]')).toBeVisible();
  await expect(page.locator('[data-special-id="pacifist-vr"][data-special-unlocked="false"]')).toHaveCount(1);
  const cash=page.locator('[data-special-id="silent-earner"][data-special-unlocked="true"]');
  await cash.locator('summary').click();
  await expect(cash.locator('[data-special-evidence-id="test-special-0kill-cash"]')).toBeVisible();
  await expect(cash.locator('[data-special-evidence-id="test-reported"]')).toHaveCount(0);
  await expect(page.locator('#profile-achievements .achievement-note')).toContainText('チーム合計');
});


test('破壊神は人数別の高キル基準、ダブルクラウンはレアとして表示する',async({page})=>{
  const row=records.find(e=>e.verified===true&&e.kind==='賞金決勝'&&e.event.includes('Solo')
    &&typeof e.prize==='number'&&e.prize>0&&!Array.isArray(e.players));
  expect(row,'ソロの確認済み賞金決勝記録').toBeTruthy();
  const name=row.player;
  const edited={...row,id:'test-destruction-solo-65',kills:65,vrs:1,prize:100,verified:true};
  await mockResults(page, [edited]);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expandAchievements(page);
  const destruction=page.locator('[data-special-id="twenty-kills"][data-special-unlocked="true"]');
  const double=page.locator('[data-special-id="vr-and-cash"][data-special-unlocked="true"]');
  await expect(destruction).toBeVisible();
  await expect(double).toHaveAttribute('data-special-rarity','rare');
  await destruction.locator('summary').click();
  await expect(destruction.locator('[data-special-evidence-id="test-destruction-solo-65"]')).toContainText('ソロ 65K / 基準65K');
  await expect(page.locator('[data-special-id="twenty-kills"][data-special-rarity="legendary"]')).toBeVisible();
});


test('地域スペシャリストは累計戦績で進化し、次段階への進捗もプロフィールに表示する',async({page})=>{
  const counts=new Map();
  for(const e of records.filter(e=>e.verified===true)){
    for(const name of roster(e)){
      if(!name)continue;
      const key=name+'|'+e.region;
      counts.set(key,(counts.get(key)||0)+1);
    }
  }
  const target=[...counts].find(([,total])=>total>=10);
  expect(target,'10件以上の海外戦績を持つ地域別選手').toBeTruthy();
  const [name,region]=target[0].split('|');
  const badge=achievements.calculate(records,name,{catalog:data.tournaments.catalog}).special.achievements
    .find(x=>x.id==='specialist-'+region.toLowerCase());
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expandAchievements(page);
  const card=page.locator('[data-special-id="'+badge.id+'"][data-special-unlocked="true"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-special-growth-level',String(badge.growth.level));
  await expect(card).toHaveAttribute('data-special-evolution-tier',badge.growth.current.tier);
  await expect(card.locator('h4')).toHaveText(badge.title);
  await expect(card.locator('[data-special-growth] .special-evo-status strong')).toHaveText(badge.progress+' / '+badge.goal+' 件');
  await expect(card.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow',String(badge.growth.percent));
  await expect(card.locator('.special-evo-stages span')).toHaveCount(5);
  await expect(card.locator('.special-evo-next')).toContainText(badge.growth.next?'あと '+badge.growth.remaining+' 件':'最高ランク達成');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test('二刀流→三刀流→四刀流はソロからスクワッドまでの個人賞金獲得形式で進化する',async({page})=>{
  const base=records.find(e=>e.verified===true&&e.kind==='賞金決勝'
    &&typeof e.prize==='number'&&e.prize>0&&roster(e).length===1);
  expect(base,'確認済みソロ賞金の基準データ').toBeTruthy();
  const name=roster(base)[0];
  const teams=[
    {team:'solo',event:'Solo Victory Cup Battle Royale',players:[name],prize:100},
    {team:'duo',event:'Reload Duos Victory Cup',players:[name,'Pair'],prize:200},
    {team:'trio',event:'Trios Cash Cup',players:[name,'Pair','Third'],prize:300},
    {team:'squad',event:'Squads Victory Cup Battle Royale',players:[name,'Pair','Third','Fourth'],prize:400}
  ];
  const rows=teams.map((team,i)=>({...base,id:'special-formats-'+team.team,event:team.event,
    player:team.players.join(' / '),players:team.players,
    kind:'賞金決勝',prize:team.prize,prizePerPlayer:team.players.length>1?100:undefined,
    verified:true,kills:3,rank:25,vrs:0,source:base.source,date:base.date}));
  const expected=achievements.calculate(rows,name,{catalog:data.tournaments.catalog}).special.achievements
    .find(x=>x.id==='solo-and-team-cash');
  expect(expected.title).toBe('四刀流');
  expect(expected.progress).toBe(4);
  await mockResults(page, rows);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expandAchievements(page);
  const card=page.locator('[data-special-id="solo-and-team-cash"][data-special-unlocked="true"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-special-rarity','legendary');
  await expect(card.locator('h4')).toHaveText('四刀流');
  await expect(card.locator('[data-special-growth-level]')).toHaveAttribute('data-special-growth-level','3');
  await expect(card.locator('.special-evo-stages span')).toHaveCount(3);
  await expect(card.locator('.special-evo-next')).toContainText('最高ランク達成');
  await card.locator('.special-achievement-proof summary').click();
  const evidence=card.locator('[data-special-evidence-id]');
  await expect(evidence).toHaveCount(4);
  for(const format of ['ソロ','デュオ','トリオ','スクワッド'])await expect(card.locator('.special-format-proof').filter({hasText:format})).toHaveCount(1);
});

test('ソロ累計キル称号は一覧を開いて確認でき、デュオのチームキルは加算しない',async({page})=>{
  const source=records.find(row=>row.verified===true&&roster(row).length===1&&/\bsolo\b/i.test(row.event));
  expect(source,'ソロ戦績の基準').toBeTruthy();
  const name=roster(source)[0];
  const rows=[
    {...source,id:'solo-cumulative-qual',player:name,players:[name],event:'Solo Victory Cup',kind:'予選',kills:25,verified:true},
    {...source,id:'solo-cumulative-final',player:name,players:[name],event:'Solo Victory Cup',kind:'賞金決勝',kills:25,verified:true},
    {...source,id:'duo-kills-excluded',player:name+' / Partner',players:[name,'Partner'],event:'Duos Cash Cup',kills:999,verified:true}
  ];
  await mockResults(page, rows);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expect(page.locator('#profile-achievements .achievement-collection')).not.toHaveAttribute('open','');
  await expandAchievements(page);
  const card=page.locator('[data-special-id="solo-kill-mastery"][data-special-unlocked="true"]');
  await expect(card).toBeVisible();
  await expect(card.locator('h4')).toHaveText('孤高の狩人');
  await expect(card).toHaveAttribute('data-special-growth-level','2');
  await expect(card.locator('.special-evo-status strong')).toHaveText('50 / 100 K');
  await card.locator('.special-achievement-proof summary').click();
  await expect(card.locator('.special-kill-proof')).toHaveCount(2);
  await expect(card.locator('.special-achievement-proof')).toContainText('ソロ 25K');
  await expect(card.locator('.special-achievement-proof')).toContainText('根拠はキル上位3件');
});


test('12個の追加称号はPC・スマホの折りたたみプロフィールで表示・判定される',async({page})=>{
  const basis=records.find(row=>row.verified===true&&roster(row).length===1&&/solo/i.test(row.event));
  expect(basis,'ソロ本人プロフィール').toBeTruthy();
  const name=roster(basis)[0];
  const make=(id,event,region,date,rank,kills,prize,kind='賞金決勝')=>({
    ...basis,id,event,region,date,rank,kills,prize,kind,vrs:0,
    player:name,players:[name],verified:true
  });
  const rows=[
    make('badge-new-me','Solo Victory Cup Battle Royale','ME','2026-10-01',2,30,500),
    make('badge-new-eu','Solo Reload Victory Cup','EU','2026-10-01',1,12,200),
    make('badge-new-nac','Console Zero Build Solo Victory Cup','NAC','2026-10-07',1,8,100),
    make('badge-new-fncs','FNCS Division 1','ME','2026-10-08',20,4,0,'Practice決勝'),
    ...Array.from({length:9},(_,i)=>make('badge-reload-'+i,'Solo Reload Victory Cup',
      'EU','2026-09-'+String(i+1).padStart(2,'0'),70,3,0,'予選'))
  ];
  const expected=achievements.calculate(rows,name,{catalog:data.tournaments.catalog}).special;
  expect(expected.total).toBe(31);
  for(const id of ['final-kill-tyrant','final-runner-up','podium-streak','cash-windfall',
    'cash-chain','same-day-traveler','same-day-cash','reload-regular','no-vr-cash',
    'zero-build-champion','fncs-finalist','seven-day-traveler']){
    expect(expected.achievements.find(x=>x.id===id).unlocked,id).toBe(true);
  }
  await mockResults(page, rows);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  const gallery=page.locator('#profile-achievements .achievement-collection');
  await expect(gallery).not.toHaveAttribute('open','');
  await expandAchievements(page);
  await expect(page.locator('[data-special-count]')).toHaveText(expected.earned+' / 31');
  for(const id of ['final-kill-tyrant','cash-windfall','same-day-cash','seven-day-traveler',
    'zero-build-champion','reload-regular','fncs-finalist']){
    await expect(page.locator('[data-special-id="'+id+'"][data-special-unlocked="true"]')).toBeVisible();
  }
  const kills=page.locator('[data-special-id="final-kill-tyrant"][data-special-unlocked="true"]');
  await kills.locator('.special-achievement-proof summary').click();
  await expect(kills.locator('.special-kill-proof')).toContainText('ソロ決勝 30K');
  const cash=page.locator('[data-special-id="cash-windfall"][data-special-unlocked="true"]');
  await cash.locator('.special-achievement-proof summary').click();
  await expect(cash.locator('.special-cash-proof')).toContainText('個人賞金 $500');
  await expect(page.locator('#profile-achievements .achievement-note')).toContainText('同一大会の予選・決勝');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});


test('三冠の支配者はソロ・デュオ・トリオの確認済みVRでエピックとして表示する',async({page})=>{
 const source=records.find(row=>row.verified===true&&roster(row).length===1&&/solo/i.test(row.event));
 expect(source,'ソロ本人プロフィール').toBeTruthy();
 const name=roster(source)[0];
 const solo={...source,id:'triple-format-solo',event:'Solo Victory Cup Battle Royale',
   date:'2026-09-03',region:'ME',kind:'予選',player:name,players:[name],vrs:1,prize:null,verified:true};
 const duo={...solo,id:'triple-format-duo',event:'Duos Cash Cup',
   date:'2026-09-04',region:'EU',player:name+' / Pair',players:[name,'Pair'],vrs:1};
 const trio={...solo,id:'triple-format-trio',event:'Trios Cash Cup',
   date:'2026-09-05',region:'NAC',player:name+' / Pair / Third',players:[name,'Pair','Third'],vrs:2};
 const expected=achievements.calculate([solo,duo,trio],name,{catalog:data.tournaments.catalog});
 const triple=expected.special.achievements.find(badge=>badge.id==='triple-format-vr');
 expect(triple.unlocked).toBe(true);
 expect(triple.rarity).toBe('epic');
 await mockResults(page, [solo,duo,trio]);
 await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
 await expandAchievements(page);
 const card=page.locator('[data-special-id="triple-format-vr"][data-special-unlocked="true"]');
 await expect(card).toBeVisible();
 await expect(card).toHaveAttribute('data-special-rarity','epic');
 await expect(card).toContainText('三冠の支配者');
 await card.locator('.special-achievement-proof summary').click();
 const proof=card.locator('[data-special-evidence-id]');
 await expect(proof).toHaveCount(3);
 for(const label of ['ソロ','デュオ','トリオ'])await expect(card.locator('.special-format-proof', {hasText:label})).toHaveCount(1);
});

test('秘密の称号は未解放時に名前・条件を伏せ、通常8つのヒントと完全シークレット2つを区別する',async({page})=>{
  const source=records.find(row=>row.verified===true&&roster(row).length===1&&/\bsolo\b/i.test(row.event));
  expect(source).toBeTruthy();
  const name=roster(source)[0];
  const row={...source,id:'secret-locked-test',event:'Solo Victory Cup Battle Royale',
    date:'2026-10-01',player:name,players:[name],kind:'予選',rank:20,kills:0,vrs:0,prize:null,verified:true};
  await mockResults(page, [row]);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expect(page.locator('#profile-achievements .achievement-collection')).not.toHaveAttribute('open','');
  await expandAchievements(page);
  const secret=page.locator('#profile-secret-achievements');
  await expect(secret).toBeVisible();
  await expect(secret.locator('[data-secret-count]')).toHaveText('0');
  await expect(secret.locator('[data-secret-unlocked="true"]')).toHaveCount(0);
  await expect(secret.locator('[data-secret-id]')).toHaveCount(0);
  await secret.locator('.secret-locked-details>summary').click();
  await expect(secret.locator('[data-secret-locked="true"]')).toHaveCount(9);
  await expect(secret.locator('.secret-card-locked h4')).toHaveText(Array(9).fill('？？？？？？'));
  const markup=await secret.innerHTML();
  for(const title of achievements.SECRET_CATALOG.map(def=>def.title))expect(markup).not.toContain(title);
  for(const sealed of achievements.SECRET_CATALOG.filter(def=>def.sealed)){
    expect(markup).not.toContain(sealed.hint);
    expect(markup).not.toContain(sealed.description);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test('無音の王冠はソロ決勝0K・0VR・個人賞金で解放し難易度極高と出典を表示する',async({page})=>{
  const source=records.find(row=>row.verified===true&&roster(row).length===1&&/\bsolo\b/i.test(row.event));
  expect(source).toBeTruthy();
  const name=roster(source)[0];
  const row={...source,id:'silent-crown-unlocked',event:'Solo Victory Cup Battle Royale',
    date:'2026-10-01',player:name,players:[name],kind:'賞金決勝',rank:13,kills:0,vrs:0,prize:100,verified:true};
  await mockResults(page, [row]);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expandAchievements(page);
  const secret=page.locator('#profile-secret-achievements');
  await expect(secret.locator('[data-secret-count]')).toHaveText('1');
  const badge=secret.locator('[data-secret-id="silent-crown"][data-secret-unlocked="true"]');
  await expect(badge).toBeVisible();
  await expect(badge.locator('h4')).toHaveText('無音の王冠');
  await expect(badge.locator('.secret-difficulty')).toHaveText('難易度 極高');
  await expect(badge).toContainText('0K・0VR');
  await badge.locator('.secret-proof summary').click();
  await expect(badge.locator('[data-secret-evidence-id="silent-crown-unlocked"]')).toContainText('0K');
  await expect(badge.locator('[data-secret-evidence-id="silent-crown-unlocked"]')).toContainText('0VR');
  await expect(badge.locator('[data-secret-evidence-id="silent-crown-unlocked"]')).toContainText('個人賞金 $100');
});

test('11種すべての秘密称号は確認済み複合戦績で解放し、完全シークレットも初めて表示する',async({page})=>{
  const source=records.find(row=>row.verified===true&&roster(row).length===1&&/\bsolo\b/i.test(row.event));
  expect(source).toBeTruthy();
  const name=roster(source)[0];
  const make=(id,date,region,kills,vrs,rank,prize,kind='賞金決勝')=>({
    ...source,id,date,region,kills,vrs,rank,prize,kind,verified:true,
    event:'Solo Victory Cup Battle Royale',player:name,players:[name]
  });
  const rows=[
    make('secret-silent','2026-10-01','ME',0,0,12,100),
    make('secret-golden','2026-10-01','EU',1,1,12,100),
    make('secret-death','2026-10-01','NAC',35,2,1,200),
    make('secret-naw','2026-10-01','NAW',10,1,1,100),
    {...make('secret-zb','2026-10-01','ME',9,0,1,0),event:'Zero Build Solo Victory Cup'},
    make('secret-oce','2026-10-02','OCE',20,1,1,100),
    make('secret-br','2026-10-03','BR',10,0,2,100),
    make('secret-phoenix-start','2025-01-01','ME',4,0,12,100),
    make('secret-phoenix-end','2026-02-01','ME',3,0,12,100),
    make('secret-destruction','2026-10-04','ME',65,0,50,null,'予選')
  ];
  const report=achievements.calculate(rows,name,{catalog:data.tournaments.catalog});
  expect(report.secret.total).toBe(11);
  expect(report.secret.earned).toBe(11);
  expect(report.special.total).toBe(31);
  await mockResults(page, rows);
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await openAwards(page);
  await expandAchievements(page);
  const secret=page.locator('#profile-secret-achievements');
  await expect(secret.locator('[data-secret-count]')).toHaveText('11');
  await expect(secret.locator('[data-secret-unlocked="true"]')).toHaveCount(11);
  await expect(secret.locator('[data-secret-locked="true"]')).toHaveCount(0);
  for(const id of ['triple-gold','light-and-shadow','dual-world-champion']){
    await expect(secret.locator('[data-secret-id="'+id+'"]')).toBeVisible();
  }
  await expect(page.locator('[data-special-count]')).toContainText('/ 31');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
