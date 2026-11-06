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
 await expect(event).toContainText('開催日程のみ確認');
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
 await expect(page.locator('.calendar-note')).toContainText('公式大会ID・開始日時');
});



test('カレンダーの大会名から2026/09/06 ME決勝だけを表示し、他の日・地域・ラウンドを混ぜない',async({page})=>{
  const source=rows.find(row=>row.date==='2026-09-06'&&row.region==='ME'
    &&row.event==='Console Zero Build Solo Victory Cup'&&row.kind==='賞金決勝');
  expect(source,'9/6 ME Console Zero Build Solo VC final is registered').toBeTruthy();
  const tournamentId=tournamentKey(source,data);
  const expected=rows.filter(row=>tournamentKey(row,data)===tournamentId
    &&row.date===source.date&&row.region===source.region
    &&(row.round||'ラウンド未確認')===(source.round||'ラウンド未確認')
    &&(row.kind||'区分未確認')===(source.kind||'区分未確認'));
  expect(expected.length).toBeGreaterThan(0);
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('/?season=all#calendar?month=2026-09&date=2026-09-06');
  const link=page.locator('.calendar-event h3 a[data-open-tournament][data-tournament-date="2026-09-06"][data-tournament-region="ME"]')
    .filter({hasText:source.event}).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href',/\?date=2026-09-06&region=ME&round=/);
  await link.click();
  await expect(page.locator('#page-tournament')).toBeVisible();
  await expect(page.locator('.tournament-selected-scope')).toContainText('2026/09/06');
  await expect(page.locator('.tournament-selected-scope')).toContainText('ME');
  await expect(page.locator('.tournament-selected-scope')).toContainText(source.round);
  await expect(page.locator('.tournament-selected-scope')).toContainText(source.kind);
  const displayed=await page.locator('[data-tournament-record]').evaluateAll(els=>els.map(el=>el.getAttribute('data-tournament-record')));
  expect(displayed.slice().sort()).toEqual(expected.map(row=>row.id).sort());
  await expect(page.locator('[data-tournament-session]')).not.toHaveCount(0);
  const sections=page.locator('[data-tournament-session]');
  for(let i=0;i<await sections.count();i++){
    const section=sections.nth(i);
    await expect(section.locator('time')).toHaveAttribute('datetime','2026-09-06');
    await expect(section).toContainText('ME');
  }
  await expect(page.locator('.tournament-detail-summary')).toContainText(expected.length+'件');
  await expect(page.locator('.tournament-show-all')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('大会開催枠の共有URLを開き直しても限定表示を維持し、大会全体へ切り替え・戻る操作が動く',async({page})=>{
  const source=rows.find(row=>row.date==='2026-09-06'&&row.region==='ME'
    &&row.event==='Console Zero Build Solo Victory Cup'&&row.kind==='賞金決勝');
  expect(source).toBeTruthy();
  const id=tournamentKey(source,data);
  const expectedCount=rows.filter(row=>tournamentKey(row,data)===id&&row.date===source.date
    &&row.region===source.region&&(row.round||'ラウンド未確認')===(source.round||'ラウンド未確認')
    &&row.kind===source.kind).length;
  await page.goto('/?season=all#calendar?month=2026-09&date=2026-09-06');
  const link=page.locator('.calendar-event h3 a[data-tournament-region="ME"]')
    .filter({hasText:source.event}).first();
  await link.click();
  const scopedURL=page.url();
  await expect(page.locator('[data-tournament-record]')).toHaveCount(expectedCount);
  await page.reload();
  await expect(page.locator('.tournament-selected-scope')).toBeVisible();
  await expect(page.locator('[data-tournament-record]')).toHaveCount(expectedCount);
  await page.locator('.tournament-show-all').click();
  await expect(page).not.toHaveURL(scopedURL);
  await expect(page.locator('.tournament-selected-scope')).toHaveCount(0);
  const fullCount=rows.filter(row=>tournamentKey(row,data)===id).length;
  await expect(page.locator('[data-tournament-record]')).toHaveCount(fullCount);
  expect(fullCount).toBeGreaterThan(expectedCount);
  await page.goBack();
  await expect(page.locator('.tournament-selected-scope')).toBeVisible();
  await expect(page.locator('[data-tournament-record]')).toHaveCount(expectedCount);
  await page.goBack();
  await expect(page.locator('#page-calendar')).toBeVisible();
  await expect(page.locator('.calendar-day.is-selected')).toHaveAttribute('data-calendar-day','2026-09-06');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});

test('存在しない限定開催枠は他の戦績に勝手に置換せず、古い大会URLは従来どおり全件表示',async({page})=>{
  const source=rows.find(row=>row.date==='2026-09-06'&&row.region==='ME'
    &&row.event==='Console Zero Build Solo Victory Cup'&&row.kind==='賞金決勝');
  expect(source).toBeTruthy();
  const id=tournamentKey(source,data);
  const base='/'+ '?season=all#tournament='+encodeURIComponent(id);
  const absent=base+'?'+new URLSearchParams({date:'2026-09-07',region:'ME',round:source.round,kind:'賞金決勝'}).toString();
  await page.goto(absent);
  await expect(page.locator('#page-tournament')).toBeVisible();
  await expect(page.locator('#tournament-detail-content')).toContainText('この開催枠の掲載結果はまだありません');
  await expect(page.locator('[data-tournament-record]')).toHaveCount(0);
  await page.locator('.tournament-show-all').click();
  await expect(page.locator('.tournament-selected-scope')).toHaveCount(0);
  await page.goto(base);
  await expect(page.locator('[data-tournament-record]')).toHaveCount(rows.filter(r=>tournamentKey(r,data)===id).length);
});



test('大会全体のページで開催日を選び、同じ日付の掲載結果・集計だけを表示できる',async({page})=>{
  const id='ch7s4-solo-victory-cup';
  const allRows=rows.filter(row=>tournamentKey(row,data)===id);
  const dates=[...new Set(allRows.map(row=>row.date))].sort();
  const target='2026-09-06';
  const expected=allRows.filter(row=>row.date===target);
  expect(allRows.length).toBeGreaterThan(expected.length);
  expect(expected.length).toBeGreaterThan(0);
  await page.goto('/?season=all#tournament='+id);
  const datePanel=page.locator('.tournament-date-navigator');
  await expect(datePanel).toBeVisible();
  await expect(datePanel).toContainText('開催日から探す');
  await expect(datePanel.locator('#tournament-date-filter')).toHaveValue('all');
  await expect(datePanel.locator('select option')).toHaveCount(dates.length+1);
  await expect(page.locator('[data-tournament-record]')).toHaveCount(allRows.length);
  await page.locator('#tournament-date-filter').selectOption(target);
  await expect(page).toHaveURL(new RegExp('#tournament='+id+'\\?date='+target+'$'));
  await expect(page.locator('#tournament-date-filter')).toHaveValue(target);
  await expect(page.locator('.tournament-date-current')).toContainText(target.replace(/-/g,'/'));
  await expect(page.locator('.tournament-date-current')).toContainText('この日の全地域・全ラウンド');
  await expect(page.locator('[data-tournament-record]')).toHaveCount(expected.length);
  const rendered=await page.locator('[data-tournament-record]').evaluateAll(els=>els.map(el=>el.getAttribute('data-tournament-record')));
  expect(rendered.slice().sort()).toEqual(expected.map(row=>row.id).sort());
  const displayedDates=await page.locator('.tournament-session-heading time').evaluateAll(els=>els.map(el=>el.dateTime));
  expect(displayedDates.length).toBeGreaterThan(0);
  expect(displayedDates.every(date=>date===target)).toBe(true);
  await expect(page.locator('.tournament-detail-summary')).toContainText(expected.length+'件');
  await expect(page.locator('.tournament-detail-toolbar a[title="このURLをコピーして共有できます"]'))
    .toHaveAttribute('href',new RegExp('\\?date='+target+'$'));
});

test('日付の前後移動・全日程復帰・予選決勝フィルター・履歴戻りが動く',async({page})=>{
  const id='ch7s4-solo-victory-cup',target='2026-09-06';
  const allRows=rows.filter(row=>tournamentKey(row,data)===id);
  const dates=[...new Set(allRows.map(row=>row.date))].sort();
  expect(dates).toContain(target);
  const earlier=dates[dates.indexOf(target)-1],later=dates[dates.indexOf(target)+1];
  expect(earlier).toBeTruthy();
  expect(later).toBeTruthy();
  await page.goto('/?season=all#tournament='+id+'?date='+target);
  await expect(page.locator('.tournament-date-navigator')).toBeVisible();
  await expect(page.locator('#tournament-date-filter')).toHaveValue(target);
  await page.locator('[data-tournament-phase="final"]').click();
  const finals=allRows.filter(row=>row.date===target&&['賞金決勝','Practice決勝','Performance決勝','決勝'].includes(row.kind));
  await expect(page.locator('[data-tournament-record]')).toHaveCount(finals.length);
  await page.locator('[data-tournament-date-nav="'+earlier+'"]').click();
  await expect(page.locator('#tournament-date-filter')).toHaveValue(earlier);
  await expect(page.locator('[data-tournament-record]')).toHaveCount(allRows.filter(row=>row.date===earlier).length);
  await page.locator('[data-tournament-date-nav="'+target+'"]').click();
  await expect(page.locator('#tournament-date-filter')).toHaveValue(target);
  await page.locator('#tournament-date-filter').selectOption('all');
  await expect(page.locator('#tournament-date-filter')).toHaveValue('all');
  await expect(page.locator('[data-tournament-record]')).toHaveCount(allRows.length);
  await expect(page).toHaveURL(new RegExp('#tournament='+id+'$'));
  await page.goBack();
  await expect(page.locator('#tournament-date-filter')).toHaveValue(target);
  await expect(page.locator('[data-tournament-record]')).toHaveCount(allRows.filter(row=>row.date===target).length);
  await page.reload();
  await expect(page.locator('#tournament-date-filter')).toHaveValue(target);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});

test('カレンダーで選んだ開催枠でも日付選択ができ、日付だけの表示に切替可能',async({page})=>{
  const source=rows.find(row=>row.date==='2026-09-06'&&row.region==='ME'
    &&row.event==='Console Zero Build Solo Victory Cup'&&row.kind==='賞金決勝');
  expect(source).toBeTruthy();
  await page.goto('/?season=all#calendar?month=2026-09&date=2026-09-06');
  await page.locator('.calendar-event h3 a[data-tournament-region="ME"]').filter({hasText:source.event}).first().click();
  await expect(page.locator('.tournament-selected-scope')).toBeVisible();
  await expect(page.locator('#tournament-date-filter')).toHaveValue('2026-09-06');
  await page.locator('#tournament-date-filter').selectOption('all');
  await expect(page.locator('.tournament-selected-scope')).toHaveCount(0);
  await expect(page.locator('#tournament-date-filter')).toHaveValue('all');
  await page.goBack();
  await expect(page.locator('.tournament-selected-scope')).toBeVisible();
  await expect(page.locator('#tournament-date-filter')).toHaveValue('2026-09-06');
});

test('存在しない日付の共有リンクでも他日の結果を混ぜず、日付指定を解除できる',async({page})=>{
  const id='ch7s4-solo-victory-cup',date='2026-12-31';
  await page.goto('/?season=all#tournament='+id+'?date='+date);
  await expect(page.locator('#tournament-date-filter')).toHaveValue(date);
  await expect(page.locator('[data-tournament-record]')).toHaveCount(0);
  await expect(page.locator('.tournament-date-current')).toContainText('2026/12/31');
  await page.locator('#tournament-date-filter').selectOption('all');
  await expect(page.locator('[data-tournament-record]').first()).toBeVisible();
  await expect(page.locator('#tournament-date-filter')).toHaveValue('all');
});

test('同日同大会の報酬・参加確認は1開催枠、別ラウンドだけを残す',async({page})=>{
 const problems=[
  {month:'2025-12',date:'2025-12-21',region:'NAW',name:'$1 Million Unreal Cup',count:1,records:38},
  {month:'2026-08',date:'2026-08-01',region:'ME',name:'Champion Aphrodite FNCS Cup Battle Royale',count:1,records:15},
  {month:'2026-09',date:'2026-09-22',region:'ME',name:'Solo Victory Cup Battle Royale',count:2,records:152}
 ];
 for(const item of problems){
  await page.goto('/?season=all#calendar?month='+item.month+'&date='+item.date+'&region='+item.region+'&scope=results');
  await expect(page.locator('#page-calendar')).toBeVisible();
  const cards=page.locator('.calendar-event').filter({hasText:item.name});
  await expect(cards).toHaveCount(item.count);
  const text=await cards.allTextContents();
  if(item.count===1)expect(text.join('')).toContain('掲載済み：'+item.records+'戦績');
  else{
   expect(text.some(x=>x.includes('Round 1'))).toBe(true);
   expect(text.some(x=>x.includes('Round 2'))).toBe(true);
  }
  const path=cards.first().locator('h3 a');
  await expect(path).toHaveAttribute('href',/date=/);
  await path.click();
  await expect(page.locator('#page-tournament')).toBeVisible();
  await expect(page.locator('.tournament-selected-scope')).toContainText(item.region);
  await expect(page.locator('.tournament-selected-scope')).toContainText(item.date.replace(/-/g,'/'));
 }
});
test('大会詳細は未確認Event番号の決勝と確認済み決勝を同枠にまとめる',async({page})=>{
 await page.goto('/?season=all#tournament=ch7s4-solo-victory-cup?date=2026-09-22');
 await expect(page.locator('#page-tournament')).toBeVisible();
 const all=page.locator('.tournament-session').filter({has:page.locator('.tournament-session-heading [data-region="ME"]')});
 // Page may render multiple regions; ME must have only Round 1 and Round 2 for the date.
 const labels=await all.allTextContents();
 expect(labels.filter(s=>s.includes('Event 3')&&s.includes('Round 2')).length).toBe(1);
 expect(labels.join('')).toContain('mell');
});
test('API履歴の同時刻・同大会・同地域の別IDは重複表示しない',async({page})=>{
 await page.goto('/?season=all#calendar?month=2026-09&date=2026-09-05&region=OCE&scope=scheduled');
 await expect(page.locator('#page-calendar')).toBeVisible();
 await expect(page.locator('.calendar-upcoming-event').first()).toBeVisible();
 const cards=page.locator('.calendar-upcoming-event').filter({hasText:'Solo Victory Cup Battle Royale'});
 await expect(cards).toHaveCount(2);
 const txt=await cards.allTextContents();
 expect(txt.some(x=>x.includes('Round 1'))).toBe(true);
 expect(txt.some(x=>x.includes('Round 2'))).toBe(true);
});

test('手動追加した参加者がスキン・FNCS決勝の既存開催枠と合流する',async({page})=>{
 const pairs=[
  {date:'2026-09-25',region:'NAW',name:'Madison Beer Icon Cup',expected:8},
  {date:'2026-03-29',region:'ME',name:'FNCS Division 1',expected:2},
  {date:'2026-08-01',region:'ME',name:'Champion Aphrodite FNCS Cup',expected:17}
 ];
 for(const event of pairs){
  await page.goto('/?season=all#calendar?month='+event.date.slice(0,7)+'&date='+event.date+'&region='+event.region+'&scope=results');
  await expect(page.locator('#page-calendar')).toBeVisible();
  const card=page.locator('.calendar-event').filter({hasText:event.name});
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('掲載済み：'+event.expected+'戦績');
  await card.locator('h3 a').click();
  await expect(page.locator('#page-tournament')).toBeVisible();
  await expect(page.locator('.tournament-result')).toHaveCount(event.expected);
 }
});
