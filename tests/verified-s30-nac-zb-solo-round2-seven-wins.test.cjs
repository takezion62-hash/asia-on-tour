'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=require('../scripts/verified-s30-nac-zb-solo-round2-seven-wins.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {sameScannedCandidate}=require('../scripts/verified-partial-page.cjs');
const p=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const rows=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s30-nac-zb-solo-round2-seven-verified-45-page-wins-20261117.json'),'utf8'));
function record(s){
 const g=proof.groupFor(s);
 return {id:s.id,date:s.date,region:'NAC',seasonId:'S30',chapter:5,season:3,
  tournamentId:'ch5s3-zb-solo-victory',event:'ZB Solo Victory Cup',
  source:proof.sourceFor(g),kind:'賞金決勝',round:'Event '+g.eventNum+' · Round 2 / 賞金決勝',
  player:s.player,playerRaw:s.playerRaw,rank:s.rank,points:s.points,
  kills:s.kills,vrs:s.vrs,matches:s.matches,prize:100,verified:true,
  note:'完走した45/45ページのEpic順位表 '+proof.SCAN_BLOB+' '+proof.RULE+' 賞金$100'};
}
function approval(s){
 return {id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
 source:proof.sourceFor(proof.groupFor(s)),rule:proof.RULE,
 evidence:'all 45 original ranked pages pinned Git '+proof.SCAN_BLOB};
}
test('exact 7 S30 NAC ZB Solo finals: each one Round2 VR = $100',()=>{
 assert.equal(proof.SPECS.length,7);
 assert.deepEqual(proof.GROUPS.map(g=>g.n),[2,2,3]);
 assert.equal(new Set(proof.SPECS.map(x=>x.id)).size,7);
 assert.ok(proof.SPECS.every(s=>s.vrs===1&&s.points===100));
 for(const s of proof.SPECS){
  const pending=p.filter(x=>x.id===s.id),published=rows.filter(x=>x.id===s.id);
  assert.equal(pending.length+published.length,1,s.id+' must exist once, in pending or published');
  if(pending.length)assert.ok(proof.matchesOriginal(pending[0],s));
  else assert.ok(proof.validateRecord(published[0],ledger.find(x=>x.id===s.id)));
  assert.ok(proof.validateRecord(record(s),approval(s)));
 }
});
test('full 45-page original Epic evidence is immutable, complete and correctly linked',()=>{
 assert.equal(archive.source.scanBlob,proof.SCAN_BLOB);
 assert.equal(archive.version,1);
 assert.equal(archive.windows.length,3);
 for(const g of proof.GROUPS){
  const list=archive.windows.filter(x=>x.key===g.key);
  assert.equal(list.length,1);
  const cp=list[0].checkpoint;
  assert.equal(cp.complete,true);assert.equal(cp.pages,45);
  assert.equal(cp.totalPages,45);assert.equal(cp.rankingOrderValid,true);
  assert.equal(cp.lastSeenRank,g.lastSeenRank);
  assert.equal(cp.proposals.length,g.candidateCount);
  for(const s of proof.SPECS.filter(x=>x.date===g.date)){
   const original=cp.proposals.filter(x=>x.id===s.id);
   assert.equal(original.length,1);
   assert.ok(proof.matchesOriginal(original[0],s));
   const active=p.find(x=>x.id===s.id);
   if(active)assert.ok(sameScannedCandidate(active,original[0]));
  }
 }
});
test('VR-based $100 award, Epic display name, rank or source tampering rejected',()=>{
 for(const s of proof.SPECS){
  const r=record(s),e=approval(s);
  for(const [field,bad] of [
   ['vrs',0],['prize',0],['prize',200],['rank',s.rank+1],
   ['points',s.points+1],['kills',s.kills+1],['matches',s.matches+1],
   ['player','wrong player'],['playerRaw','not the same Epic ID'],
   ['kind','予選'],['round','Event 1 · Round 1 / 予選'],
   ['source','https://example.com'],['verified',false],['reviewOnly',true]
  ])assert.equal(proof.validateRecord({...r,[field]:bad},e),false,s.id+' '+field);
  assert.equal(proof.validateRecord(r,{...e,rule:'fake rules'}),false);
  assert.equal(proof.validateRecord(r,{...e,evidence:'unverified'}),false);
 }
});
test('ID-based queue cleanup is exact and cannot affect other seasons',()=>{
 const ids=proof.SPECS.map(x=>x.id),queue=[...ids.map(id=>({id})),{id:'other'}];
 assert.deepEqual(proof.removeExact(queue,ids),[{id:'other'}]);
 assert.throws(()=>proof.removeExact(queue,[ids[0],ids[0]]),/invalid/);
 assert.throws(()=>proof.removeExact([{id:'other'}],ids),/missing/);
 assert.throws(()=>proof.removeExact([...queue,{id:ids[0]}],ids),/duplicate/);
});
test('earlier qualifier does not conflict with separate Round2 award',()=>{
 for(const s of proof.SPECS){
  const prev=rows.filter(x=>x.date===s.date&&x.region==='NAC'&&x.event==='ZB Solo Victory Cup');
  for(const x of prev){
   if(x.id===s.id)continue;
   assert.equal(collision(x,record(s),{}),'',s.id+' / '+x.id);
  }
 }
});
