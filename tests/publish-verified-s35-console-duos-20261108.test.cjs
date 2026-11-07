'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {process:reconcile,TARGETS}=require('../scripts/publish-verified-s35-console-duos-20261108.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const rank=36;
 const row={id:TARGETS[0],date:'2025-05-31',region:'ME',player:'Aim / TEITEI',
 playerRaw:'awetatewateweawa / TEITEI 8',players:['Aim','TEITEI'],
 event:'Duos Console Victory Cash Cup',round:'Event 3 · Round 2 / 賞金決勝',
 rank,points:0,kills:13,vrs:0,prize:null,matches:3,kind:'賞金決勝',
 seasonId:'S35',chapter:6,season:2,tournamentId:'ch6s2-console-duos-victory',
 source:'https://www.fortnite.com/competitive/events/S35_VictoryDuosCup/?region=ME&round=S35_VictoryDuosCup_Event3Round2_ME',
 verified:true,reviewReason:'未検証のシーズンまたは大会'};
 const saved=clone(row);delete saved.reviewReason;
 const original={id:'old',date:'2025-06-01',region:'ME',event:'Other',player:'Aim',players:['Aim'],
 tournamentId:'old',round:'Event 1 · Round 2 / 賞金決勝',rank:3,points:50,kills:1,vrs:1,
 matches:2,prize:100,kind:'賞金決勝'};
 return {
  results:[original],updates:{version:1,entries:[{id:'old-news',date:'2025-06-01',type:'records',
   title:'Old result',description:'Do not overwrite',recordIds:['old']}]},
  review:{version:1,status:'review',proposals:[row]},
  reviewed:{version:1,entries:[]},status:{found:1,manualReviewCandidates:1,manuallyPublished:50},
  scan:{windows:{'epicgames_S35_VictoryDuosCup_ME/S35_VictoryDuosCup_Event3Round2_ME':{
   complete:true,nextPage:3,totalPages:3,rankingOrderValid:true,proposals:[saved]
  }}},
  players:{candidates:[{name:'Aim'},{name:'TEITEI'}],confirmedAliases:{}},
  tournaments:{catalog:[{id:'ch6s2-console-duos-victory',name:'Duos Console Victory Cash Cup',team:'duo',
   seasonId:'S35',series:'victory-cup',sourceEventIds:['S35_VictoryDuosCup']}]}
 };
}
test('fully verified 0VR console duo publishes $0 and keeps old public data unchanged',()=>{
 const db=fixture(),before=JSON.stringify(db);
 const result=reconcile(db,'2026-11-07T17:00:00Z');
 assert.equal(result.report.published.length,1);
 assert.equal(result.report.published[0].rank,36);
 assert.equal(result.report.published[0].prize,0);
 assert.equal(result.docs.results.length,2);
 assert.deepEqual(result.docs.results[0],db.results[0]);
 assert.equal(result.docs.updates.entries[1].id,'old-news');
 assert.equal(result.docs.review.proposals.length,0);
 assert.equal(result.docs.reviewed.entries[0].decision,'published');
 assert.equal(result.docs.status.manuallyPublished,51);
 assert.equal(result.docs.updates.entries[0].recordIds[0],TARGETS[0]);
 assert.ok(result.docs.results[1].note.includes('VR1回あたりチーム$200'));
 assert.equal(JSON.stringify(db),before,'source fixture must not be mutated');
});
test('second run is idempotent and does not duplicate an update or the player record',()=>{
 const first=reconcile(fixture());
 const next={...fixture(),...first.docs};
 const after=reconcile(next);
 assert.equal(after.report.changed,false);
 assert.equal(after.report.published.length,0);
 assert.equal(after.docs.results.length,2);
 assert.equal(after.docs.updates.entries.length,2);
});
test('incomplete or inconsistent leaderboard, false VR, altered rank, spoofed source is rejected',()=>{
 for(const mutate of [
  db=>db.scan.windows[Object.keys(db.scan.windows)[0]].complete=false,
  db=>db.scan.windows[Object.keys(db.scan.windows)[0]].rankingOrderValid=false,
  db=>db.review.proposals[0].vrs=1,
  db=>db.review.proposals[0].rank=37,
  db=>db.review.proposals[0].source='https://evil.test',
  db=>db.review.proposals[0].players=['Aim','Unknown'],
  db=>db.review.proposals[0].prize=100,
 ]){
  const db=fixture();mutate(db);
  assert.throws(()=>reconcile(db),/HISTORIC_REVIEW_VERIFY/);
 }
});
test('already-published identical duo is reviewed, not reinserted',()=>{
 const db=fixture(),existing={...db.review.proposals[0],id:'manual-verified',prize:0};
 db.results.push(existing);
 const outcome=reconcile(db);
 assert.equal(outcome.report.published.length,0);
 assert.equal(outcome.report.duplicates.length,1);
 assert.equal(outcome.docs.results.length,2);
 assert.equal(outcome.docs.reviewed.entries[0].decision,'already-published');
 assert.equal(outcome.docs.review.proposals.length,0);
});
test('different recorded score is held and never overwritten or auto closed',()=>{
 const db=fixture(),existing={...db.review.proposals[0],id:'manual-inconsistent',rank:40,prize:0};
 db.results.push(existing);
 const o=reconcile(db);
 assert.equal(o.report.published.length,0);
 assert.equal(o.report.held.length,1);
 assert.equal(o.docs.review.proposals.length,1);
 assert.equal(o.docs.results.at(-1).rank,40);
});
test('unrelated pending candidates and corrections survive publication',()=>{
 const db=fixture();
 const candidate={id:'auto-s39-abcdef012345',kind:'参加確認',player:'Test',prize:null};
 db.review.proposals.push(candidate);
 const o=reconcile(db);
 assert.deepEqual(o.docs.review.proposals,[candidate]);
 assert.equal(o.docs.status.found,1);
 assert.equal(o.docs.status.manualReviewCandidates,1);
});


function s38Fixture(){
 const db=fixture();
 const row={...db.review.proposals[0],
  id:'auto-s38-4744d9dc78a1',date:'2025-11-23',region:'NAW',
  player:'R1ze / Zagouの弟',players:['R1ze','Zagouの弟'],
  playerRaw:'Helix R1ze 777 / NŁT zagouの弟',
  event:'Duos Victory Cash Cup',round:'Day 3 · Round 2 / 賞金決勝',
  tournamentId:'ch6mini2-duos-victory-cash-cup',seasonId:'S38',
  chapter:6,season:5,rank:134,kills:2,vrs:0,points:0,matches:3,prize:null,
  source:'https://www.fortnite.com/competitive/events/S38_DuosVictoryCup/?region=NAW&round=S38_DuosVictoryCup_Round2_Day3_NAW'
 };
 db.review.proposals=[row];
 db.players.candidates.push({name:'R1ze'},{name:'Zagouの弟'});
 db.tournaments.catalog.push({id:row.tournamentId,name:row.event,team:'duo',seasonId:'S38',
  series:'victory-cup',sourceEventIds:['S38_DuosVictoryCup']});
 const cp=clone(row);delete cp.reviewReason;
 db.scan.windows['epicgames_S38_DuosVictoryCup_NAW/S38_DuosVictoryCup_Round2_Day3_NAW']={
  complete:true,nextPage:2,totalPages:2,rankingOrderValid:true,proposals:[cp]
 };
 return db;
}
test('S38 NAW duo November 23 complete official final 0VR is also $0 with no extra cash',()=>{
 const db=s38Fixture(),r=reconcile(db,'2026-11-07T17:00:00Z');
 assert.equal(r.report.published.length,1);
 assert.equal(r.report.published[0].rank,134);
 assert.equal(r.report.published[0].prize,0);
 assert.equal(r.docs.results.length,2);
 assert.equal(r.docs.results[1].player,'R1ze / Zagouの弟');
 assert.equal(r.docs.results[1].prize,0);
 assert.equal(r.docs.review.proposals.length,0);
 assert.equal(r.docs.updates.entries[0].id,'manual-verified-s38-duos-20261108');
 assert.deepEqual(r.docs.updates.entries[0].recordIds,['auto-s38-4744d9dc78a1']);
 assert.ok(r.docs.results[1].note.includes('各選手$100'));
});
test('S38 source, leaderboard completion, team roster and reported VR must all match',()=>{
 for(const tamper of [
  x=>x.scan.windows[Object.keys(x.scan.windows).at(-1)].complete=false,
  x=>x.review.proposals[0].source='https://fortnite.com/invalid',
  x=>x.review.proposals[0].rank=135,
  x=>x.review.proposals[0].vrs=1,
  x=>x.review.proposals[0].players=['R1ze','wrong'],
  x=>x.review.proposals[0].kind='予選'
 ]){
  const db=s38Fixture();tamper(db);
  assert.throws(()=>reconcile(db),/HISTORIC_REVIEW_VERIFY/);
 }
});
