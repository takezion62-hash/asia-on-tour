'use strict';
const {test,expect}=require('@playwright/test');

test('archive pagination reuses sorted search results until filters actually change',async({page})=>{
 await page.goto('/?season=all#results');
 const count=page.locator('#result-count');
 await expect(page.locator('#result-pagination-top [data-archive-page="2"][aria-label="2ページへ"]')).toBeVisible();
 await expect(count).toContainText('件');
 const total=Number((await count.textContent()).replace(/[^0-9]/g,''));
 expect(total).toBeGreaterThan(300);
 await page.evaluate(()=>{
   const original=Array.prototype.sort;
   window.__archivePerf={bigSorts:0};
   Array.prototype.sort=function(...args){
     // Ignore other async UI modules sorting their own large arrays.
     if(this.length>=300&&(new Error().stack||'').includes('renderResults'))
       window.__archivePerf.bigSorts++;
     return original.apply(this,args);
   };
 });
 for(let n=2;n<=4;n++){
   await page.locator('#result-pagination-top [data-archive-page="'+n+'"][aria-label="'+n+'ページへ"]').click();
   await expect(page.locator('#result-pagination-top [aria-current="page"]')).toHaveText(String(n));
 }
 const afterPaging=await page.evaluate(()=>window.__archivePerf.bigSorts);
 expect(afterPaging,'changing only the 50-row page must never resort all published rows').toBe(0);
 await page.locator('#sort-results').selectOption('oldest');
 await expect(page.locator('#result-pagination-top [aria-current="page"]')).toHaveText('1');
 const afterFilter=await page.evaluate(()=>window.__archivePerf.bigSorts);
 expect(afterFilter,'changing a sort filter must recalculate the ordered archive').toBeGreaterThan(0);
 await page.locator('#result-pagination-top [data-archive-page="2"][aria-label="2ページへ"]').click();
 const afterSecondPage=await page.evaluate(()=>window.__archivePerf.bigSorts);
 expect(afterSecondPage).toBe(afterFilter);
});

test('player directory renders 60 cards per batch without losing search or sorting',async({page})=>{
 await page.goto('/?season=all#players');
 const cards=page.locator('#all-players .player');
 await expect(cards).toHaveCount(60);
 await expect(page.locator('#player-list-status')).toContainText('60名を表示');
 const more=page.locator('#player-more');
 await expect(more).toBeVisible();
 await more.click();
 await expect(cards).toHaveCount(120);
 const late=await cards.nth(119).getAttribute('data-open-profile');
 expect(late).toBeTruthy();
 await page.locator('#search-players').fill(late);
 await expect(cards.first()).toHaveAttribute('data-open-profile',late);
 await page.locator('#search-players').fill('');
 await expect(cards).toHaveCount(60);
 await page.locator('#player-sort').selectOption('name');
 await expect(cards).toHaveCount(60);
 await expect(more).toBeVisible();
});
test('home defers full update-feed DOM until the updates page is visited',async({page})=>{
 await page.goto('/?season=all#home');
 await expect(page.locator('#home-new-registrations [data-registration-id]').first()).toBeVisible();
 await expect(page.locator('#home-update-preview .update-preview-line')).toHaveCount(3);
 expect(await page.locator('#updates-feed [data-update-id]').count()).toBe(0);
 await page.getByRole('button',{name:'更新履歴',exact:true}).click();
 await expect(page.locator('#page-updates')).toBeVisible();
 await expect(page.locator('#updates-feed [data-update-id]').first()).toBeVisible();
});
test('calendar month paging still displays the correct day buttons with per-month result caching',async({page})=>{
 await page.goto('/?season=all#calendar?month=2026-10');
 await expect(page.locator('#page-calendar')).toBeVisible();
 const dates=page.locator('[data-calendar-day]');
 await expect(dates).toHaveCount(31);
 const chosen=page.locator('[data-calendar-day="2026-10-24"]');
 await chosen.click();
 await expect(chosen).toHaveAttribute('aria-pressed','true');
 // Month switching must not expose other months' result-day buttons.
 const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../app.js'),'utf8');
 expect(source).toContain('calendarMonthRowsCache');
 expect(source).toContain('calendarIndexedRows().byMonth.get(filters.month)');
});
