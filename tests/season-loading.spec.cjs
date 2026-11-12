'use strict';
const {test,expect}=require('@playwright/test');
const manifest=require('../season-data/manifest.json');

test('初期表示では正本の全期間JSONを取得せず、選択シーズンだけ配信する',async({page})=>{
  const requested=[];
  const errors=[];
  page.on('request',request=>requested.push(new URL(request.url()).pathname));
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?season=S43#home');
  await expect(page.locator('#stat-results')).toHaveText(String(manifest.scopes.S43.count));
  await expect(page.locator('#stat-players')).toHaveText(String(manifest.scopes.S43.players));
  await page.locator('.nav button[data-page="results"]').click();
  await expect(page.locator('#page-results')).toBeVisible();
  expect(requested).toContain('/season-data/manifest.json');
  expect(requested).toContain('/season-data/S43.json');
  expect(requested).not.toContain('/results.json');
  expect(requested).not.toContain('/season-data/S42.json');
  expect(errors).toEqual([]);
});

test('一覧とランキングの表示だけなら過去全件を取得せず、事前集計を読む',async({page})=>{
  const requested=[];
  page.on('request',request=>requested.push(new URL(request.url()).pathname));
  await page.goto('/?season=S42#home');
  await expect(page.locator('#stat-results')).toHaveText(String(manifest.scopes.S42.count));
  await page.locator('.nav button[data-page="players"]').click();
  await expect(page.locator('#page-players')).toBeVisible();
  await expect.poll(()=>requested.includes('/season-data/ranking-S42.json')).toBe(true);
  await expect(page.locator('#player-earnings-sum')).toHaveText('$'+manifest.scopes.S42.prizeTotal.toLocaleString('ja-JP'));
  expect(requested).not.toContain('/results.json');
  expect(requested).not.toContain('/season-data/S30.json');
});

test('シーズン切り替えでは選択した戦績だけを追加ロードする',async({page})=>{
  const requested=[];
  page.on('request',request=>requested.push(new URL(request.url()).pathname));
  await page.goto('/?season=S43#home');
  await expect(page.locator('#stat-results')).toHaveText(String(manifest.scopes.S43.count));
  await page.locator('#season-select').selectOption('S42');
  await expect(page.locator('#stat-results')).toHaveText(String(manifest.scopes.S42.count));
  await expect(page.locator('#season-select')).toHaveValue('S42');
  expect(requested).toContain('/season-data/S43.json');
  expect(requested).toContain('/season-data/S42.json');
  expect(requested).not.toContain('/results.json');
  expect(requested).not.toContain('/season-data/S30.json');
});

test('全期間・詳細プロフィールは必要になった時点で全シーズンを取得する',async({page})=>{
  const requested=[];
  const errors=[];
  page.on('request',request=>requested.push(new URL(request.url()).pathname));
  page.on('pageerror',error=>errors.push(error.message));
  const row=require('../season-data/S43.json').find(row=>row.player||(row.players||[]).length);
  const person=row.players?.[0]||row.player;
  await page.goto('/?season=S43#player='+encodeURIComponent(person));
  await expect(page.locator('#profile-title')).toHaveText(person);
  await expect(page.locator('[data-profile-tab="history"]')).toBeVisible();
  expect(requested).toContain('/season-data/S42.json');
  expect(requested).toContain('/season-data/S30.json');
  expect(requested).not.toContain('/results.json');
  expect(errors).toEqual([]);
});
