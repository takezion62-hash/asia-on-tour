'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {checkpointIndex,checkpointFor,collisionIndex,groupCandidates}=require('../scripts/review-batch-index.cjs');
const {reviewBatch}=require('../scripts/review-batch-core.cjs');
const {collision,collisionKey,equalCandidate}=require('../scripts/manual-approval-core.cjs');
const at='2026-11-13T03:00:00.000Z';
const base=(id,player,rank,extra={})=>({
 id,date:'2026-09-22',region:'ME',player,playerRaw:player,
 event:'Demo Evaluation',tournamentId:'demo-evaluation',seasonId:'S42',
 chapter:7,season:4,round:'Event 1 · Round 1 / 参加確認',
 rank,points:180-rank,kills:6,vrs:0,matches:6,prize:null,
 kind:'参加確認',reviewOnly:true,verified:true,
 source:'https://www.fortnite.com/competitive/events/S42_DemoEvaluation/?region=ME&round=S42_DemoEvaluation_Event1Round1_ME',
 ...extra
});
const qid='auto-s41-cccccccccccc';
const qualifier={
 id:qid,date:'2026-08-01',region:'ME',player:'A',playerRaw:'A',
 event:'Solo Reload Victory Cup',tournamentId:'ch7s3-solo-reload-victory-cup',
 seasonId:'S41',chapter:7,season:3,
 round:'Day 1 · Round 1 / 予選',kind:'予選',
 rank:319,points:320,kills:5,vrs:1,matches:8,prize:0,verified:true,
 source:'https://www.fortnite.com/competitive/events/S41_ReloadReloadSoloVictoryCup/?region=ME&round=S41_ReloadSoloVictoryCup_Round1_Day1_ME'
};
function fixture(){
 const a=base('auto-s42-aaaaaaaaaaaa','A',60);
 const b=base('auto-s42-bbbbbbbbbbbb','B',61);
 const duplicate=base('auto-s42-dddddddddddd','D',70);
 const conflicting=base('auto-s42-eeeeeeeeeeee','E',75);
 const existing=base('existing-d','D',70,{reviewOnly:undefined});
 const prior=base('existing-e','E',74,{reviewOnly:undefined});
 const rowA={...a},rowB={...b},rowD={...duplicate},rowE={...conflicting};
 const k='epicgames_S42_DemoEvaluation_ME/S42_DemoEvaluation_Event1Round1_ME';
 const k2='epicgames_S41_ReloadReloadSoloVictoryCup_ME/S41_ReloadSoloVictoryCup_Round1_Day1_ME';
 const cp=(proposals,props={})=>({complete:false,rankingOrderValid:true,
  pages:4,nextPage:4,totalPages:20,lastSeenRank:400,
  lastSuccessAt:at,emptyAttempts:0,proposals:proposals.map(x=>structuredClone(x)),...props});
 return {
  results:[existing,prior],
  players:{candidates:['A','B','D','E'].map(name=>({name})),confirmedAliases:{}},
  tournaments:{catalog:[
   {id:'demo-evaluation',name:'Demo Evaluation',seasonId:'S42',
    team:'solo',series:'performance-evaluation',sourceEventIds:['S42_DemoEvaluation']},
   {id:'ch7s3-solo-reload-victory-cup',name:'Solo Reload Victory Cup',seasonId:'S41',
    team:'solo',series:'victory-cup',sourceEventIds:['S41_ReloadReloadSoloVictoryCup']}
  ]},
  reviews:{auto:{version:1,proposals:[a,b]},history:{version:1,proposals:[qualifier,duplicate,conflicting]}},
  scans:{auto:{windows:{[k]:cp([rowA,rowB,rowD,rowE])}},
   history:{windows:{[k2]:cp([qualifier]),[k]:cp([rowA,rowB,rowD,rowE])}}},
  calendar:{
   '2026-09':[{eventId:'S42_DemoEvaluation',sourceWindowId:'S42_DemoEvaluation_Event1Round1_ME',
    dateJst:'2026-09-22',region:'ME',tournamentId:'demo-evaluation',seasonId:'S42',
    endUtc:'2026-09-22T11:00:00.000Z'}],
   '2026-08':[{eventId:'S41_ReloadReloadSoloVictoryCup',
    sourceWindowId:'S41_ReloadSoloVictoryCup_Round1_Day1_ME',
    dateJst:'2026-08-01',region:'ME',tournamentId:qualifier.tournamentId,
    seasonId:'S41',endUtc:'2026-08-01T11:00:00.000Z'}]
  },
  statuses:{auto:{found:2},history:{found:3}},
  ledger:{version:1,entries:[]},updates:{version:1,entries:[]},
  reviewed:{version:1,entries:[]}
 };
}
test('Epic checkpoint index retains exact rank/identity and rejects cross-window collision',()=>{
 const db=fixture(),index=checkpointIndex(db.scans),row=db.reviews.auto.proposals[0];
 const proof=checkpointFor(row,index,equalCandidate);
 assert.ok(proof);assert.equal(proof.key.includes('S42_DemoEvaluation'),true);
 assert.throws(()=>checkpointFor({...row,kills:999},index,equalCandidate),/異なる/);
 assert.equal(groupCandidates([...db.reviews.auto.proposals,...db.reviews.history.proposals]).length,2);
});
test('collision shortlist exactly preserves old collision policy including confirmed aliases',()=>{
 const row=base('previous','A',11,{reviewOnly:undefined});
 const rows=[row,base('other','B',12,{reviewOnly:undefined}),
  base('otherdate','A',13,{date:'2026-09-23',reviewOnly:undefined})];
 const aliases={A:['former-A']};
 const ix=collisionIndex(rows,collisionKey,collision,aliases);
 const current=base('candidate','former-A',11,{reviewOnly:undefined});
 assert.equal(ix.match(current).previous.id,'previous');
 assert.equal(ix.match(base('different','C',25)),null);
 const more=base('new','C',55);ix.add(more);
 assert.equal(ix.match(base('n2','C',50)).previous.id,'new');
});
test('one pass groups candidates, publishes safe attendance + partial official qualifier, and resolves exact duplicate',()=>{
 const db=fixture(),before=JSON.stringify(db);
 const p=reviewBatch(db,{runId:'batch-1',timestamp:at});
 assert.equal(p.selected,5);assert.equal(p.windowGroups,2);
 assert.deepEqual(p.published.map(x=>x.id).sort(),
  ['auto-s42-aaaaaaaaaaaa','auto-s42-bbbbbbbbbbbb',qid].sort());
 assert.equal(p.duplicates.length,1);
 assert.equal(p.duplicates[0].existingId,'existing-d');
 assert.equal(p.held.length,1);
 assert.match(p.held[0].reason,/数値差異/);
 assert.equal(p.next.results.length,5);
 assert.equal(p.next.results.find(x=>x.id===qid).round.includes('予選突破'),true);
 assert.equal(p.next.results.find(x=>x.id===qid).prize,0);
 assert.equal(p.next.results.find(x=>x.id==='auto-s42-aaaaaaaaaaaa').prize,null);
 assert.equal(p.next.results.find(x=>x.id==='existing-d').rank,70);
 assert.equal(p.next.reviews.history.proposals.map(x=>x.id).includes('auto-s42-eeeeeeeeeeee'),true);
 assert.equal(p.next.reviewed.entries.filter(x=>x.decision==='already-published').length,1);
 assert.equal(JSON.stringify(db),before,'pure planner must not mutate input');
});
test('unknown cash, immature leaderboard, tampering and bad regional cutoff fail closed',()=>{
 const db=fixture();
 db.reviews.history.proposals.push(base('auto-s42-ffffffffffff','A',30,{
   kind:'賞金決勝',reviewOnly:undefined,prize:100,round:'Event 1 · Round 2 / 賞金決勝'
 }));
 let p=reviewBatch(db,{runId:'safety1'});
 assert.ok(p.held.some(x=>x.id==='auto-s42-ffffffffffff'));
 assert.equal(p.published.some(x=>x.id==='auto-s42-ffffffffffff'),false);
 const tampered=fixture();
 tampered.scans.history.windows['epicgames_S41_ReloadReloadSoloVictoryCup_ME/S41_ReloadSoloVictoryCup_Round1_Day1_ME'].proposals[0].rank=100;
 p=reviewBatch(tampered,{runId:'safety2'});
 assert.ok(p.held.some(x=>x.id===qid));
 const immature=fixture();
 const w=immature.scans.history.windows['epicgames_S41_ReloadReloadSoloVictoryCup_ME/S41_ReloadSoloVictoryCup_Round1_Day1_ME'];
 w.lastSuccessAt='2026-08-01T12:00:00.000Z';
 p=reviewBatch(immature,{runId:'safety3'});
 assert.ok(p.held.some(x=>x.id===qid));
});
test('bounded selection, different statuses and exact reviewed IDs are enforced',()=>{
 const db=fixture();
 assert.throws(()=>reviewBatch(db,{limit:101}),/limit/);
 assert.throws(()=>reviewBatch(db,{ids:['missing']}),/no longer pending/);
 assert.throws(()=>reviewBatch(db,{ids:['auto-s42-aaaaaaaaaaaa','auto-s42-aaaaaaaaaaaa']}),/invalid selected/);
 const p=reviewBatch(db,{ids:['auto-s42-aaaaaaaaaaaa'],limit:1,runId:'once'});
 assert.equal(p.selected,1);assert.equal(p.published.length,1);
 assert.equal(p.next.reviews.auto.proposals.length,1);
});
