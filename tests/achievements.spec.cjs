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
