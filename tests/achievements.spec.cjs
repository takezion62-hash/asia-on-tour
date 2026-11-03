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
  const gallery=page.locator('#profile-achievements');
  await expect(gallery).toBeVisible();
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
  await page.route('**/results.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([onlyOne])}));
  await page.goto('/?season=all#player='+encodeURIComponent(player));
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
  const expected=achievements.calculate(records,skinName);
  expect(expected.metrics.skins).toBeGreaterThan(0);
  await expect(page.locator('[data-evolution-track="skins"]:not([data-evolution-tier="locked"])')).toBeVisible();
  await page.goto('/?season=all#player='+encodeURIComponent(teamName));
  const teamData=achievements.calculate(records,teamName);
  expect(teamData.metrics.vrs).toBeGreaterThan(0);
  await expect(page.locator('[data-evolution-track="victories"]:not([data-evolution-tier="locked"])')).toBeVisible();
  await expect(page.locator('#profile-achievements .achievement-note')).toContainText('チーム戦');
});


test('特別称号は17種類から判定し、獲得済み・未獲得・レア度・出典を閲覧できる',async({page})=>{
  const person=records.find(row=>row.verified===true&&(row.players||[row.player]).length===1)?.player||player;
  const expected=achievements.calculate(records,person).special;
  await page.goto('/?season=all#player='+encodeURIComponent(person));
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
  await page.route('**/results.json',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify([valid,reported])
  }));
  await page.goto('/?season=all#player='+encodeURIComponent(name));
  await expect(page.locator('[data-special-id="silent-earner"][data-special-unlocked="true"]')).toBeVisible();
  await expect(page.locator('[data-special-id="pacifist-vr"][data-special-unlocked="false"]')).toHaveCount(1);
  const cash=page.locator('[data-special-id="silent-earner"][data-special-unlocked="true"]');
  await cash.locator('summary').click();
  await expect(cash.locator('[data-special-evidence-id="test-special-0kill-cash"]')).toBeVisible();
  await expect(cash.locator('[data-special-evidence-id="test-reported"]')).toHaveCount(0);
  await expect(page.locator('#profile-achievements .achievement-note')).toContainText('チーム合計');
});
