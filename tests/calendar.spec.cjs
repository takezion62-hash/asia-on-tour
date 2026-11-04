'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { loadData, tournamentKey, seasonFor } = require('../scripts/data-checks.cjs');
const data = loadData(path.join(__dirname,'..')).data;
const rows = data.results;
const month = [...new Set(rows.map(row => row.date.slice(0,7)))].sort().at(-1);
const forMonth = rows.filter(row => row.date.startsWith(month));
const sessionKey = row => JSON.stringify([row.date,row.region,tournamentKey(row,data),row.round||'',row.kind||'']);

test('大会カレンダーは掲載日だけから生成し、開催枠を重複集計しない', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?season=all#calendar?month='+month);
  await expect(page.locator('#page-calendar')).toBeVisible();
  await expect(page.locator('.calendar-month-head h2')).toHaveText(Number(month.slice(0,4))+'年 '+Number(month.slice(5))+'月');
  const unique=new Set(forMonth.map(sessionKey)).size;
  await expect(page.locator('.calendar-month-head small')).toContainText(unique+'開催枠');
  await expect(page.locator('.calendar-month-head small')).toContainText(forMonth.length+'戦績');
  const dates=new Set(forMonth.map(row=>row.date));
  await expect(page.locator('.calendar-day-count')).toHaveCount(dates.size);
  const selected=await page.locator('.calendar-day.is-selected').getAttribute('data-calendar-day');
  await expect(page.locator('.calendar-event')).toHaveCount(new Set(forMonth.filter(row=>row.date===selected).map(sessionKey)).size);
  expect(errors).toEqual([]);
});

test('地域と予選フィルター、日付選択、大会・選手リンクと履歴戻りが使える', async ({ page }) => {
  const source=rows.find(row=>row.kind==='予選'&&row.region==='ME');
  expect(source).toBeTruthy();
  const targetMonth=source.date.slice(0,7);
  await page.goto('/?season=all#calendar?month='+targetMonth);
  await page.locator('#calendar-region').selectOption('ME');
  await page.locator('#calendar-stage').selectOption('予選');
  const matching=rows.filter(row=>row.date.startsWith(targetMonth)&&row.region==='ME'&&row.kind==='予選');
  expect(matching.length).toBeGreaterThan(0);
  await expect(page.locator('.calendar-month-head small')).toContainText(new Set(matching.map(sessionKey)).size+'開催枠');
  const date=matching[0].date;
  await page.locator('[data-calendar-day="'+date+'"]').click();
  await expect(page.locator('.calendar-day.is-selected')).toHaveAttribute('data-calendar-day',date);
  await expect(page.locator('.calendar-event')).toHaveCount(new Set(matching.filter(row=>row.date===date).map(sessionKey)).size);
  const link=page.locator('.calendar-event h3 a').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('#page-tournament')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#page-calendar')).toBeVisible();
  await expect(page.locator('#calendar-region')).toHaveValue('ME');
  await expect(page.locator('#calendar-stage')).toHaveValue('予選');
  await expect(page.locator('.calendar-day.is-selected')).toHaveAttribute('data-calendar-day',date);
  await page.reload();
  await expect(page.locator('#page-calendar')).toBeVisible();
  await expect(page.locator('#calendar-region')).toHaveValue('ME');
  await expect(page.locator('#calendar-stage')).toHaveValue('予選');
  const playerLink=page.locator('.calendar-event-players a').first();
  await expect(playerLink).toBeVisible();
  await playerLink.click();
  await expect(page.locator('#page-profile')).toBeVisible();
});

test('月送りと狭い画面の表示が正常', async ({ page }) => {
  await page.goto('/?season=all#calendar?month='+month);
  const previous=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-2,1));
  const prevMonth=previous.getUTCFullYear()+'-'+String(previous.getUTCMonth()+1).padStart(2,'0');
  await page.getByRole('button',{name:'前の月'}).click();
  await expect(page).toHaveURL(new RegExp('month='+prevMonth));
  await page.getByRole('button',{name:'次の月'}).click();
  await expect(page.locator('.calendar-month-head h2')).toHaveText(Number(month.slice(0,4))+'年 '+Number(month.slice(5))+'月');
  const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  const width=await page.evaluate(()=>document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width+2);
  await expect(page.locator('.calendar-day').first()).toBeVisible();
});

test('シーズンを切り替えると対象期間の最新掲載月へ移動する', async ({ page }) => {
  const nextSeason='S43';
  const seasonRows=rows.filter(row=>seasonFor(row,data)===nextSeason);
  if(!seasonRows.length)return;
  const latest=seasonRows.map(row=>row.date.slice(0,7)).sort().at(-1);
  await page.goto('/?season=all#calendar?month=2026-09');
  await page.locator('#season-select').selectOption(nextSeason);
  await expect(page.locator('.calendar-month-head h2')).toHaveText(Number(latest.slice(0,4))+'年 '+Number(latest.slice(5))+'月');
  await expect(page).toHaveURL(new RegExp('season='+nextSeason));
  await expect(page).toHaveURL(new RegExp('month='+latest));
  expect(await page.locator('.calendar-event').count()).toBeGreaterThan(0);
});


test('S43海外開催予定を結果と別に表示し、日本時間とEpic公式リンクを確認できる',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?season=all#calendar?month=2026-11&date=2026-11-08&region=ME&series=cash-cup&mode=reload-zero-build&stage=予選');
 await expect(page.locator('#page-calendar')).toBeVisible();
 await expect(page.locator('#calendar-series')).toHaveValue('cash-cup');
 await expect(page.locator('#calendar-mode')).toHaveValue('reload-zero-build');
 await expect(page.locator('#calendar-stage')).toHaveValue('予選');
 await expect(page.locator('.calendar-day.is-selected')).toHaveAttribute('data-calendar-day','2026-11-08');
 await expect(page.locator('.calendar-upcoming-event')).toHaveCount(1);
 const event=page.locator('.calendar-upcoming-event');
 await expect(event).toContainText('Reload ZB Duos Cash Cup');
 await expect(event).toContainText('日本時間 20:00');
 await expect(event).toContainText('日程のみ登録');
 await expect(event.locator('a')).toHaveAttribute('href',/fortnite\.com\/competitive\/events\/S43_ReloadZBDuosCashCup/);
 await expect(page.locator('.calendar-month-head small')).toContainText('予定');
 await expect(page.locator('.calendar-day-upcoming-count').first()).toBeVisible();
 await expect(page.locator('.calendar-note')).toContainText('FNCS Division 1以外のFNCS');
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});

test('開催予定のみ・掲載結果のみの表示を切り替えても既存の結果は保持される',async({page})=>{
 await page.goto('/?season=all#calendar?month=2026-11&date=2026-11-10');
 await expect(page.locator('.calendar-upcoming-event').first()).toBeVisible();
 await page.locator('#calendar-scope').selectOption('scheduled');
 await expect(page.locator('#calendar-scope')).toHaveValue('scheduled');
 expect(await page.locator('.calendar-upcoming-event').count()).toBeGreaterThan(0);
 await expect(page.locator('.calendar-event')).toHaveCount(0);
 await expect(page).toHaveURL(/scope=scheduled/);
 await page.locator('#calendar-scope').selectOption('results');
 await expect(page.locator('.calendar-upcoming-event')).toHaveCount(0);
 await expect(page).toHaveURL(/scope=results/);
 await page.locator('#calendar-scope').selectOption('all');
 await expect(page.locator('.calendar-upcoming-event').first()).toBeVisible();
});

test('予定には非Division1 FNCSやASIA開催を混ぜず、S42閲覧中もS43の公式予定が見える',async({page})=>{
 await page.goto('/?season=S42#calendar?month=2026-11&date=2026-11-07');
 await expect(page.locator('#season-select')).toHaveValue('S42');
 const all=page.locator('.calendar-upcoming-event');
 expect(await all.count()).toBeGreaterThan(0);
 expect(await all.allTextContents()).not.toContain('FNCS Solos Reload Qualifiers');
 for(const el of await all.allTextContents()){
   expect(el).not.toMatch(/FNCS Solos Reload|FNCS Solos Reload Finals|FNCS Solos Reload Qualifiers/);
 }
 await page.locator('#calendar-region').selectOption('OCE');
 await expect(page.locator('#calendar-region')).toHaveValue('OCE');
 const scheduled=page.locator('.calendar-upcoming-event');
 for(const txt of await scheduled.allTextContents())expect(txt).toContain('OCE');
 await expect(page.locator('.calendar-note')).toContainText('JST');
});
