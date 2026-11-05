'use strict';
const {test,expect}=require('@playwright/test');
const {loadData}=require('../scripts/data-checks.cjs');
const path=require('node:path');
const data=loadData(path.join(__dirname,'..')).data;
const paidScope={date:'2026-08-16',region:'NAW',round:'Day 3 · Round 2 / 賞金決勝',kind:'賞金決勝'};
const base='/\?season=all#tournament='+encodeURIComponent('ch7s3-solo-reload-victory-cup');
const href=scope=>base+'?'+new URLSearchParams(scope).toString();

test('One prize-eligible final contains both cash winners and $0 finalists',async({page})=>{
 const expected=data.results.filter(r=>r.event==='Solo Reload Victory Cup'&&
   r.date===paidScope.date&&r.region===paidScope.region&&r.round===paidScope.round&&r.kind===paidScope.kind);
 expect(expected.length).toBeGreaterThan(10);
 expect(expected.some(r=>r.prize>0)).toBe(true);
 expect(expected.some(r=>r.prize===0)).toBe(true);
 await page.goto(href(paidScope));
 await expect(page.locator('#tournament-record-sessions .tournament-session')).toHaveCount(1);
 await expect(page.locator('#tournament-record-sessions [data-tournament-record]')).toHaveCount(expected.length);
 await expect(page.locator('.tournament-selected-scope')).toContainText('賞金決勝');
});

test('Old unpaid-final URLs still open the unified prize-final session',async({page})=>{
 const legacy={...paidScope,round:'Day 3 · Round 2 / 決勝（賞金なし）',kind:'決勝'};
 await page.goto(href(legacy));
 const expected=data.results.filter(r=>r.event==='Solo Reload Victory Cup'&&
   r.date===paidScope.date&&r.region===paidScope.region&&r.round===paidScope.round);
 await expect(page.locator('#tournament-record-sessions [data-tournament-record]')).toHaveCount(expected.length);
 await expect(page.locator('#tournament-record-sessions .tournament-session')).toHaveCount(1);
});

test('Missing Tracker window ID does not split a clearly labeled same-day final',async({page})=>{
 const scope={date:'2026-10-17',region:'ME',round:'Event 4 · Round 2 / 賞金決勝',kind:'賞金決勝'};
 const expected=data.results.filter(r=>r.event==='Solo Reload Victory Cup'&&
   r.date===scope.date&&r.region===scope.region&&r.round===scope.round);
 expect(expected.length).toBeGreaterThan(5);
 await page.goto(href(scope));
 await expect(page.locator('#tournament-record-sessions [data-tournament-record]')).toHaveCount(expected.length);
 await expect(page.locator('#tournament-record-sessions .tournament-session')).toHaveCount(1);
});
