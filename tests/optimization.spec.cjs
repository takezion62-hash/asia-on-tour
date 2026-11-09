'use strict';
const {test,expect}=require('@playwright/test');

test('archive pagination reuses sorted search results until filters actually change',async({page})=>{
 await page.goto('/?season=all#results');
 const count=page.locator('#result-count');
 await expect(page.locator('#result-pagination-top [data-archive-page="2"]')).toBeVisible();
 await expect(count).toContainText('件');
 const total=Number((await count.textContent()).replace(/[^0-9]/g,''));
 expect(total).toBeGreaterThan(300);
 await page.evaluate(()=>{
   const original=Array.prototype.sort;
   window.__archivePerf={bigSorts:0};
   Array.prototype.sort=function(...args){
     if(this.length>=300)window.__archivePerf.bigSorts++;
     return original.apply(this,args);
   };
 });
 for(let n=2;n<=4;n++){
   await page.locator('#result-pagination-top [data-archive-page="'+n+'"]').click();
   await expect(page.locator('#result-pagination-top [aria-current="page"]')).toHaveText(String(n));
 }
 const afterPaging=await page.evaluate(()=>window.__archivePerf.bigSorts);
 expect(afterPaging,'changing only the 50-row page must never resort all published rows').toBe(0);
 await page.locator('#sort-results').selectOption('oldest');
 await expect(page.locator('#result-pagination-top [aria-current="page"]')).toHaveText('1');
 const afterFilter=await page.evaluate(()=>window.__archivePerf.bigSorts);
 expect(afterFilter,'changing a sort filter must recalculate the ordered archive').toBeGreaterThan(0);
 await page.locator('#result-pagination-top [data-archive-page="2"]').click();
 const afterSecondPage=await page.evaluate(()=>window.__archivePerf.bigSorts);
 expect(afterSecondPage).toBe(afterFilter);
});
