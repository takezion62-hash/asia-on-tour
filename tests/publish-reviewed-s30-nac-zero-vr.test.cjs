'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {processReview,KEY,WINDOW,RULE,ID}=require('../scripts/publish-reviewed-s30-nac-zero-vr.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const example=(n=0)=>({
 id:'auto-s30-'+String(n+1).padStart(12,'0'),date:'2024-08-13',
 region:'NAC',player:'Player'+n,playerRaw:'Player'+n,
 event:'Solo Victory Cup Battle Royale',
 round:'Event 9 · Round 2 / 賞金決勝',rank:n+1,points:0,kills:2+n,
 vrs:0,matches:3,prize:null,kind:'賞金決勝',chapter:5,season:3,seasonId:'S30',
 tournamentId:ID,verified:true,
 source:'https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=NAC&round='+WINDOW,
 reviewReason:'順位表の取得が完了していません'
});
function fixture(count=1){
 const rows=Array.from({length:count},(_,n)=>example(n));
 const before=clone(rows).map(x=>{delete x.reviewReason;return x});
 return {
  results:[{id:'existing',date:'2024-01-01',region:'EU',tournamentId:'other',player:'A',
   event:'Other',round:'Event 1 · Round 2 / 賞金決勝',rank:1,points:100,kills:10,
   vrs:2,matches:3,prize:200,kind:'賞金決勝'}],
  updates:{version:1,entries:[{id:'existing-note',date:'2024-01-01',type:'records',
   title:'Existing score',description:'Never overwrite',
   recordIds:['existing']}]},
  review:{version:1,status:'review',proposals:rows},
  reviewed:{version:1,entries:[]},
  status:{found:count,manualReviewCandidates:count,manuallyPublished:59},
  scan:{version:1,windows:{[KEY]:{complete:true,pages:48,totalPages:48,
   nextPage:48,rankingOrderValid:true,proposals:before}}},
  players:{candidates:rows.map(x=>({name:x.player})),confirmedAliases:{}},
  tournaments:{catalog:[{id:ID,name:'Solo Victory Cup Battle Royale',team:'solo',
   series:'victory-cup',seasonId:'S30',sourceEventIds:['S30_SoloVictoryCashCup']}]},
  rules:{version:1,rules:[{id:ID,series:'victory-cup',team:'solo',seasonId:'S30',
   eventIds:['S30_SoloVictoryCashCup'],matchCaps:{'賞金決勝':3,'予選':7},source:RULE}]}
 };
}
const now='2026-11-07T16:34:00Z';
test('complete official 2024 NAC 48-page final safely publishes zero-VR and $0 records',()=>{
 const db=fixture(3),unchanged=JSON.stringify(db);
 const o=processReview(db,now);
 assert.equal(o.report.considered,3);
 assert.equal(o.report.published.length,3);
 assert.equal(o.docs.results.length,4);
 assert.deepEqual(o.docs.results[0],db.results[0]);
 assert.equal(o.docs.results[1].prize,0);
 assert.equal(o.docs.results[1].rank,1);
 assert.equal(o.docs.results[1].points,0);
 assert.equal(o.docs.results[1].kills,2);
 assert.ok(o.docs.results[1].note.includes('全48ページ'));
 assert.ok(o.docs.results[1].note.includes(RULE));
 assert.equal(o.docs.review.proposals.length,0);
 assert.equal(o.docs.reviewed.entries.length,3);
 assert.equal(o.docs.status.manuallyPublished,62);
 assert.equal(o.docs.updates.entries.length,2);
 assert.deepEqual(o.docs.updates.entries[0].recordIds,exampleIds(3));
 assert.equal(JSON.stringify(db),unchanged);
});
function exampleIds(n){return Array.from({length:n},(_,i)=>example(i).id)}
test('idempotency: repeated publication never duplicates records, update entries or reviewed IDs',()=>{
 const db=fixture(2);
 const first=processReview(db,now);
 const second=processReview({...db,...first.docs},now);
 assert.equal(second.report.changed,false);
 assert.equal(second.report.published.length,0);
 assert.equal(second.docs.results.length,3);
 assert.equal(second.docs.updates.entries.length,2);
 assert.equal(second.docs.reviewed.entries.length,2);
});
test('incomplete pages, reversed leaderboard and unverified source rules fail closed',()=>{
 for(const mutate of [
  db=>db.scan.windows[KEY].complete=false,
  db=>db.scan.windows[KEY].nextPage=47,
  db=>db.scan.windows[KEY].pages=47,
  db=>db.scan.windows[KEY].rankingOrderValid=false,
  db=>db.rules.rules[0].source='https://example.com/fake-cash-rule',
  db=>db.tournaments.catalog[0].team='duo'
 ]){
  const db=fixture();mutate(db);
  assert.throws(()=>processReview(db,now),/S30_NAC_VERIFIED_REVIEW/);
 }
});
test('uncertain identity, changed stats, unconfirmed prize or forged URL stay in review',()=>{
 for(const mutate of [
  db=>db.review.proposals[0].verified=false,
  db=>db.review.proposals[0].vrs=1,
  db=>db.review.proposals[0].prize=100,
  db=>db.review.proposals[0].kills=1000,
  db=>db.review.proposals[0].source='https://example.com/forged',
  db=>db.players.candidates=[],
  db=>db.review.proposals[0].matches=4
 ]){
  const db=fixture();mutate(db);
  const o=processReview(db,now);
  assert.equal(o.report.published.length,0);
  assert.equal(o.report.held.length,1);
  assert.equal(o.docs.review.proposals.length,1);
  assert.deepEqual(o.docs.results,db.results);
 }
});
test('same existing player/window and all identical stats resolves duplicate with no new cash record',()=>{
 const db=fixture();const row=clone(db.review.proposals[0]);
 row.id='manual-existing',row.prize=0;db.results.push(row);
 const o=processReview(db,now);
 assert.equal(o.report.published.length,0);
 assert.equal(o.report.duplicates.length,1);
 assert.equal(o.docs.results.length,2);
 assert.equal(o.docs.review.proposals.length,0);
 assert.equal(o.docs.reviewed.entries[0].existingId,'manual-existing');
});
test('conflicting rank or kills for same player/window is held rather than overwrite',()=>{
 const db=fixture();const row=clone(db.review.proposals[0]);
 row.id='manual-other',row.rank=11,row.prize=100;db.results.push(row);
 const o=processReview(db,now);
 assert.equal(o.report.published.length,0);
 assert.equal(o.report.held.length,1);
 assert.equal(o.docs.review.proposals.length,1);
 assert.equal(o.docs.results.at(-1).rank,11);
 assert.equal(o.docs.results.at(-1).prize,100);
});
test('stale reason about date/region is not proof of mismatch when exact original Epic session agrees',()=>{
 const db=fixture();db.review.proposals[0].reviewReason='開催日・地域・ラウンド不一致';
 const o=processReview(db,now);
 assert.equal(o.report.published.length,1,'exact saved original window overrides stale human-readable reason');
});
test('unrelated pending series, existing statistics and unresolved user reviews are untouched',()=>{
 const db=fixture();
 db.review.proposals.push({...example(40),id:'auto-s39-abcdef012345',event:'Unreal Cup',
  tournamentId:'unreal-cup',kind:'参加確認',prize:null});
 const o=processReview(db,now);
 assert.equal(o.docs.review.proposals.length,1);
 assert.equal(o.docs.review.proposals[0].id,'auto-s39-abcdef012345');
 assert.equal(o.docs.results[0].prize,200);
 assert.equal(o.docs.status.found,1);
});
