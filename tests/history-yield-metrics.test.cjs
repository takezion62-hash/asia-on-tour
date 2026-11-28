'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {measure,aggregate}=require('../scripts/history-yield-metrics.cjs');
const k='history-sync-scan.json',q='history-sync-review.json',s='history-sync-status.json';
const event='S42_TestCup',region='NAW',windowId=event+'_Round1_'+region,key='epicgames_'+event+'_'+region+'/'+windowId;
const row=id=>({id,verified:true,source:'https://www.fortnite.com/competitive/events/'+event+'/?region='+region+'&round='+windowId,region,seasonId:'S42',tournamentId:'test'});
const at='2026-11-28T01:00:00Z';
function fixture(){
 const before={checkedAt:'2026-11-27T01:00:00Z',windows:{[key]:{proposals:[row('cached'),row('old')]}}};
 const base={docs:{[k]:before,[q]:{proposals:[row('old')]},[s]:{},'results.json':[row('registered')]}};
 const scanned={docs:{[k]:{checkedAt:at,windows:{[key]:{proposals:['cached','old','registered','new','pending','concurrent','held'].map(row)}}},[s]:{historyYieldObservation:{measuredAt:at,windows:[{key,tournamentId:'test',region,seasonId:'S42',series:'test-cup',attempted:6,scanned:5,candidateIds:['cached','old','registered','new','new','pending','concurrent','held']}]}}}};
 const latest={docs:{[s]:{},'results.json':[row('registered'),row('concurrent')]}};
 return {scope:'history',base,scanned,latest,review:{proposals:[row('pending')]},appended:[row('new'),row('old'),{...row('outside'),source:'https://example.com'}],reviewedIds:new Set(['held'])};
}
test('only genuinely new regular-page candidates and conflict-safe publications count',()=>{
 const x=fixture(),r=measure(x),w=r.latest.windows[0],g=r.rolling.byTournament[0];
 assert.equal(w.attemptedPages,6);assert.equal(w.scannedPages,5);assert.equal(w.failedPages,1);
 assert.equal(w.newCandidates,2);assert.equal(w.newPublished,1);assert.equal(w.oldPendingPublished,1);
 assert.equal(w.published,2);assert.equal(w.newPending,1);assert.equal(r.latest.unattributedPublished,1);
 assert.equal(g.candidatesPerAttempt,.3333);assert.equal(g.candidatesPerScannedPage,.4);assert.equal(g.newPublishedPerAttempt,.1667);
 assert.equal(r.rolling.byRegion[0].key,'NAW');assert.equal(r.rolling.byTournamentRegion[0].key,'test/NAW');
 assert.equal(JSON.stringify(r).includes('candidateIds'),false);
 x.latest.docs[s].historyYield=r;assert.deepEqual(measure(x),r,'same scan replay is not counted twice');
 x.scanned.docs[k].checkedAt=x.base.docs[k].checkedAt;assert.deepEqual(measure(x),r);
 assert.equal(measure({...x,scope:'auto'}),undefined);
});
test('no page observation, malformed counters, wrong window and missing checkpoint',()=>{
 const x=fixture();delete x.scanned.docs[s].historyYieldObservation;assert.equal(measure(x),undefined);
 const y=fixture();y.scanned.docs[s].historyYieldObservation.windows[0].scanned=7;assert.throws(()=>measure(y),/Invalid/);
 const z=fixture();z.scanned.docs[s].historyYieldObservation.windows[0].candidateIds.push('not-in-checkpoint');assert.throws(()=>measure(z),/outside/);
 const a=fixture();delete a.scanned.docs[k].windows[key];assert.throws(()=>measure(a),/Missing/);
});
test('rolling history is bounded, rates use aggregate denominators and zero pages are not zero yield',()=>{
 const x=fixture();let r=measure(x);
 for(let i=1;i<=35;i++){
  const t=new Date(Date.parse(at)+i*60000).toISOString();
  x.scanned.docs[k].checkedAt=t;x.scanned.docs[s].historyYieldObservation.measuredAt=t;
  x.latest.docs[s].historyYield=r;r=measure(x);
 }
 assert.equal(r.runs.length,30);assert.equal(r.rolling.byTournament[0].attemptedPages,180);
 assert.equal(r.rolling.byTournament[0].candidatesPerAttempt,.3333);
 const empty={...r.latest.windows[0],attemptedPages:0,scannedPages:0,newCandidates:0,newPublished:0};
 assert.equal(aggregate([empty],w=>w.tournamentId)[0].candidatesPerAttempt,null);
});
