'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {mergeSnapshots,logicalKey,mergeCheckpoint}=require('../scripts/safe-sync-merge.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const ROW=id=>({
 id,date:'2026-11-07',region:'NAC',tournamentId:'s43-solo-vc',seasonId:'S43',
 player:'Hero',event:'Solo Victory Cup Battle Royale',
 round:'Event 3 · Round 2 / 賞金決勝',kind:'賞金決勝',rank:42,
 points:50,kills:3,vrs:0,matches:3,prize:0,verified:true,
 source:'https://www.fortnite.com/competitive/events/S43_SoloVictoryCup/?region=NAC&round=S43_SoloVictoryCup_Event3Round2_NAC'
});
const LOG=(id,ids)=>({
 id,date:'2026-11-07',type:'records',title:'公式規則で自動承認：過去大会'+ids.length+'戦績',
 description:'only source-backed winners',recordIds:ids
});
const PREFIXES=['history','auto'];
function docSet(scope){
 const p=scope==='history'?'history-sync':'auto-sync';
 return {
  'results.json':[ROW('already')],
  'updates.json':{version:1,entries:[LOG('old-log',['already'])]},
  [p+'-status.json']:{version:1,checkedAt:'2026-11-07T10:00:00Z',found:0,manualReviewCandidates:0,manuallyPublished:50},
  [p+'-review.json']:{version:1,status:'review',proposals:[]},
  [p+'-scan.json']:{version:1,checkedAt:'2026-11-07T10:00:00Z',windows:{
    'e/w':{nextPage:1,pages:1,complete:false,proposals:[ROW('cached')]}
  }}
 };
}
const SNAP=(scope,docs)=>({version:1,scope,docs,sources:{'rules':'immutable','players':'immutable'}});
function scenario(scope='history'){
 const p=scope==='history'?'history-sync':'auto-sync';
 const base=SNAP(scope,docSet(scope)),scanned=clone(base),latest=clone(base);
 const row=ROW('new-scanned');row.date='2026-11-08';row.rank=18;
 scanned.docs['results.json'].push(row);
 scanned.docs['updates.json'].entries.unshift(LOG('new-log',['new-scanned']));
 scanned.docs[p+'-scan.json'].checkedAt='2026-11-07T11:00:00Z';
 scanned.docs[p+'-scan.json'].windows['e/w']={
  nextPage:2,pages:2,complete:true,proposals:[ROW('cached'),row]
 };
 scanned.docs[p+'-review.json'].proposals=[{
  id:'held-only',player:'HeldHero',reviewReason:'unverified payout',verified:true,prize:null
 }];
 scanned.docs[p+'-status.json'].checkedAt='2026-11-07T11:00:00Z';
 const fresh=ROW('manual-added');fresh.date='2026-11-09';fresh.player='New Hero';
 latest.docs['results.json'].push(fresh);
 latest.docs['updates.json'].entries.unshift(LOG('manual-log',['manual-added']));
 latest.docs[p+'-scan.json'].windows['new/event']={
  nextPage:3,pages:3,complete:true,proposals:[]
 };
 latest.docs[p+'-review.json'].proposals=[{
  id:'another-hold',player:'AnotherHero',reviewReason:'cash uncertain',verified:true,prize:null
 }];
 latest.docs[p+'-status.json'].checkedAt='2026-11-07T10:30:00Z';
 latest.docs[p+'-status.json'].manuallyPublished=51;
 return {scope,p,base,scanned,latest,row,fresh};
}
test('history/recent: replay scan additions without overwriting new manual results/updates/review/scan',()=>{
 for(const scope of PREFIXES){
  const x=scenario(scope);
  const {docs,report}=mergeSnapshots(scope,x.base,x.scanned,x.latest);
  assert.equal(report.appended,1);
  assert.equal(report.keptPending,2);
  assert.equal(docs['results.json'].length,3);
  assert.deepEqual(docs['results.json'][0],ROW('already'));
  assert.deepEqual(docs['results.json'][1],x.fresh);
  assert.deepEqual(docs['results.json'][2],x.row);
  assert.equal(docs['updates.json'].entries.length,3);
  assert.equal(docs['updates.json'].entries[1].id,'manual-log');
  assert.ok(docs['updates.json'].entries.some(e=>e.id==='new-log'));
  assert.deepEqual(docs[x.p+'-review.json'].proposals.map(e=>e.id),['another-hold','held-only']);
  assert.equal(docs[x.p+'-scan.json'].windows['e/w'].nextPage,2);
  assert.equal(docs[x.p+'-scan.json'].windows['new/event'].nextPage,3);
  assert.equal(docs[x.p+'-status.json'].manuallyPublished,51);
  assert.equal(docs[x.p+'-status.json'].found,2);
 }
});
test('race/retry idempotency: same scanned delta already safely merged is never written twice',()=>{
 const x=scenario();let a=mergeSnapshots(x.scope,x.base,x.scanned,x.latest);
 const next=SNAP(x.scope,{...x.latest.docs,...a.docs});
 const again=mergeSnapshots(x.scope,x.base,x.scanned,next);
 assert.equal(again.report.appended,0);
 assert.equal(again.report.alreadyPublished,1);
 assert.deepEqual(again.docs['results.json'],a.docs['results.json']);
 assert.deepEqual(again.docs['updates.json'],a.docs['updates.json']);
});
test('same source record added by another bot (different ID) is skipped rather than duplicated',()=>{
 const x=scenario();const concurrent=clone(x.row);concurrent.id='manual-equal';
 x.latest.docs['results.json'].push(concurrent);
 x.latest.docs['updates.json'].entries.unshift(LOG('equal-log',['manual-equal']));
 const out=mergeSnapshots(x.scope,x.base,x.scanned,x.latest);
 assert.equal(out.report.appended,0);
 assert.equal(out.report.alreadyPublished,1);
 assert.equal(out.docs['results.json'].filter(r=>r.date===x.row.date&&r.player===x.row.player).length,1);
 assert.ok(out.docs['updates.json'].entries.every(r=>r.id!=='new-log'));
});
test('same player+window with different verified score is held for review without changing public rank/cash',()=>{
 const x=scenario();const published={...x.row,id:'manual-conflict',rank:17,prize:100};
 x.latest.docs['results.json'].push(published);
 x.latest.docs['updates.json'].entries.unshift(LOG('conflict-log',['manual-conflict']));
 const out=mergeSnapshots(x.scope,x.base,x.scanned,x.latest);
 assert.equal(out.report.appended,0);
 assert.equal(out.report.reviewConflicts,1);
 assert.equal(out.docs['results.json'].find(r=>r.id==='manual-conflict').rank,17);
 assert.equal(out.docs['results.json'].find(r=>r.id==='manual-conflict').prize,100);
 const review=out.docs[x.p+'-review.json'].proposals.find(p=>p.id==='new-scanned');
 assert.ok(review);
 assert.match(review.reviewReason,/競合/);
});
test('manual reviewed ID suppresses stale scanner approval and reopened pending candidate',()=>{
 const x=scenario();
 const out=mergeSnapshots(x.scope,x.base,x.scanned,x.latest,{
  version:1,entries:[{id:'new-scanned',decision:'already-published'},{id:'held-only',decision:'published'}]
 });
 assert.equal(out.report.appended,0);
 assert.equal(out.docs[x.p+'-review.json'].proposals.length,1);
 assert.equal(out.docs[x.p+'-review.json'].proposals[0].id,'another-hold');
});
test('scanner must not mutate or delete baseline public rows or update announcements',()=>{
 const x=scenario();
 x.scanned.docs['results.json'][0].rank=99;
 assert.throws(()=>mergeSnapshots(x.scope,x.base,x.scanned,x.latest),/changed\/deleted existing results/);
 const y=scenario();
 y.scanned.docs['updates.json'].entries[0].title='rewritten cash announcement';
 assert.throws(()=>mergeSnapshots(y.scope,y.base,y.scanned,y.latest),/changed\/deleted existing entries/);
});
test('fail closed if player identity or approval rule source changed on remote during scan',()=>{
 const x=scenario();x.latest.sources['rules']='changed';
 assert.throws(()=>mergeSnapshots(x.scope,x.base,x.scanned,x.latest),/fresh scan required/);
});
test('concurrent checkpoint reset wins over stale scanned progression',()=>{
 const base={nextPage:6,pages:6,complete:false,proposals:[ROW('x')]};
 const scanned={...base,nextPage:7,pages:7,proposals:[ROW('x'),ROW('y')]};
 const latest={nextPage:0,pages:0,complete:false,proposals:[],epicIdsRetained:true};
 const final=mergeCheckpoint(base,scanned,latest,[],'epic/round');
 assert.deepEqual(final,latest);
});
test('new approved rows cannot contain review-only, unverifiable or missing prizes',()=>{
 for(const invalid of [
  {verified:false},{reviewOnly:true},{kind:'参加確認'},{prize:undefined}
 ]){
  const x=scenario();Object.assign(x.scanned.docs['results.json'][1],invalid);
  assert.throws(()=>mergeSnapshots(x.scope,x.base,x.scanned,x.latest),/unverified publication/);
 }
});
test('roster and regional window identity never mistake distinct finals for the same row',()=>{
 const one=ROW('a');
 assert.equal(logicalKey(one),logicalKey({...one,id:'b'}));
 assert.notEqual(logicalKey(one),logicalKey({...one,region:'EU'}));
 assert.notEqual(logicalKey(one),logicalKey({...one,round:'Event 4 · Round 2 / 賞金決勝',source:'https://foo.test'}));
});
