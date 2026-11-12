'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sourceWindow,buildTriage}=require('../scripts/candidate-triage-core.cjs');
const uuid='a'.repeat(12);
const row=(id='auto-s42-'+uuid,extra={})=>({
 id,date:'2026-10-18',region:'ME',player:'Player A',
 event:'Victory Cup',tournamentId:'vc-s42',
 seasonId:'S42',kind:'賞金決勝',round:'Event 1 · Round 2 / 賞金決勝',
 rank:50,points:100,kills:3,vrs:0,matches:3,prize:null,verified:true,
 source:'https://www.fortnite.com/competitive/events/S42_VictoryCup/?region=ME&round=S42_VictoryCup_Event1Round2_ME',
 ...extra
});
const key='epicgames_S42_VictoryCup_ME/S42_VictoryCup_Event1Round2_ME';
const cp=(r,extra={})=>({
 proposals:[r],rankingOrderValid:true,complete:true,nextPage:3,pages:3,
 totalPages:3,lastSeenRank:150,lastSuccessAt:'2026-10-18T08:00:00Z',...extra
});
function fixture(rows=[row()],opts={}){
 const scans={};
 for(const r of rows)scans[sourceWindow(r)||key]=cp(r);
 return {
 autoReview:{proposals:[],checkedAt:'2026-11-12T01:00:00Z'},
 historyReview:{proposals:rows,checkedAt:'2026-11-12T02:00:00Z'},
 autoScan:{windows:{}},historyScan:{windows:scans},
 results:[],historyReviewed:{entries:[]},
 players:{confirmedAliases:{}},...opts
 };
}
test('exact saved official checkpoint is a manual rules review, never an award',()=>{
 const original=row();
 const result=buildTriage(fixture([original]));
 assert.equal(result.total,1);
 assert.equal(result.queue[0].status,'rules-review');
 assert.equal(result.queue[0].evidence.exactCheckpoint,true);
 assert.equal(result.queue[0].evidence.scanComplete,true);
 assert.equal(result.queue[0].prize,null);
 assert.equal(result.queue[0].rewardState,'cash-unconfirmed');
 assert.equal(result.byRegion[0].name,'ME');
 assert.equal(result.byYear[0].name,'2026');
 assert.equal(result.byTournament[0].count,1);
 assert.ok(result.policy.includes('read-only'));
});
test('partially scanned evidence stays pending even if a rank has been observed',()=>{
 const candidate=row();
 const input=fixture([candidate],{historyScan:{windows:{[key]:cp(candidate,{
  complete:false,nextPage:2,pages:2,totalPages:8,lastSeenRank:78
 })}}});
 const result=buildTriage(input);
 assert.equal(result.queue[0].status,'partial-scan');
 assert.equal(result.queue[0].evidence.observedPartial,true);
 assert.equal(result.queue[0].evidence.scanComplete,false);
});
test('changed score, mismatched source and missing proof must not be marked verified',()=>{
 const original=row();
 const altered=row(original.id,{kills:99});
 for(const params of [
  {historyReview:{proposals:[altered],checkedAt:'2026-11-12T02:00:00Z'}},
  {historyReview:{proposals:[row(original.id,{source:'https://example.com/spoof'})]}},
  {historyScan:{windows:{}}}
 ]){
  const report=buildTriage(fixture([original],params));
  assert.equal(report.queue[0].status,'evidence-conflict');
 }
});
test('a real prior row blocks a likely duplicate without dropping the distinct candidate',()=>{
 const candidate=row('auto-s42-'+'b'.repeat(12));
 const old={...candidate,id:'old-existing',prize:0};
 const report=buildTriage(fixture([candidate],{results:[old]}));
 assert.equal(report.queue.length,1);
 assert.equal(report.queue[0].status,'duplicate-risk');
 assert.equal(report.queue[0].evidence.possibleExistingId,'old-existing');
});
test('already published and adjudicated are removed from actionable queue',()=>{
 const one=row('auto-s42-'+'c'.repeat(12));
 const two=row('auto-s42-'+'d'.repeat(12),{date:'2025-09-01',region:'EU',source:'https://www.fortnite.com/competitive/events/S42_VictoryCup/?region=EU&round=S42_VictoryCup_Event1Round2_EU'});
 const report=buildTriage(fixture([one,two],{
  results:[{...one,id:one.id}],
  historyReviewed:{entries:[{id:two.id,decision:'already-published'}]}
 }));
 assert.equal(report.total,0);
 assert.equal(report.alreadyResolved,2);
});
test('recent/history overlap is deduplicated and conflicting records are held',()=>{
 const candidate=row();
 const input=fixture([candidate]);
 input.autoReview.proposals=[candidate];
 let report=buildTriage(input);
 assert.equal(report.total,1);
 assert.equal(report.queue[0].origin,'history+recent');
 input.autoReview.proposals=[{...candidate,points:50}];
 report=buildTriage(input);
 assert.equal(report.total,1);
 assert.equal(report.queue[0].status,'evidence-conflict');
});
test('unverified source is never accepted as official Epic evidence',()=>{
 const candidate=row();
 for(const source of [
  'http://www.fortnite.com/competitive/events/S42_VictoryCup/?region=ME&round=S42_VictoryCup_Event1Round2_ME',
  'https://www.fortnite.com.evil.test/competitive/events/S42_VictoryCup/?region=ME&round=S42_VictoryCup_Event1Round2_ME',
  'https://www.fortnite.com/competitive/events/S42_VictoryCup/?region=EU&round=S42_VictoryCup_Event1Round2_ME',
  'not a URL'
 ])assert.equal(sourceWindow({...candidate,source}),null);
 assert.equal(sourceWindow(candidate),key);
});
