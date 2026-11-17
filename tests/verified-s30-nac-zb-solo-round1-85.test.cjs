'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=require('../scripts/verified-s30-nac-zb-solo-round1-85.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('../scripts/verified-partial-page.cjs');
const pending=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const published=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const snapshot=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
function row(s){
 const g=proof.groupOf(s);
 return {id:s.id,date:s.date,region:'NAC',player:s.player,playerRaw:s.playerRaw,
  seasonId:'S30',chapter:5,season:3,tournamentId:'ch5s3-zb-solo-victory',
  event:'ZB Solo Victory Cup',rank:s.rank,points:s.points,kills:s.kills,
  vrs:s.vrs,matches:s.matches,source:s.source,verified:true,kind:'予選',
  round:proof.expectedRound(s),prize:0,
  note:'NACはNA上位5000の予選突破、賞金$0。'+proof.RULE+g.oldBlob};
}
function entry(s){
 const g=proof.groupOf(s);
 return {id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
  rule:proof.RULE,source:s.source,
  evidence:'source-verified 85; original solo evidence Git blob '+g.oldBlob};
}
test('85 unique S30 zero-build solo NA top5000 qualifiers across nine events',()=>{
 assert.equal(proof.SPECS.length,85);
 assert.equal(proof.GROUPS.length,9);
 assert.equal(new Set(proof.SPECS.map(s=>s.id)).size,85);
 assert.deepEqual(proof.GROUPS.map(g=>g.count),[3,2,2,3,19,2,21,17,16]);
 assert.ok(proof.SPECS.every(s=>s.rank<=proof.CUTOFF));
 for(const s of proof.SPECS){
  const original=pending.filter(x=>x.id===s.id),existing=published.filter(x=>x.id===s.id);
  assert.equal(original.length+existing.length,1,s.id+' must be published XOR pending');
  if(original.length)assert.ok(proof.matchOriginal(original[0],s));
  else assert.ok(proof.validateRecord(existing[0],ledger.find(x=>x.id===s.id)));
 }
});
test('pinned source pages are verified even where Aug6 has a later HTTP429',()=>{
 assert.equal(snapshot.version,1);
 assert.equal(snapshot.windows.length,9);
 for(const g of proof.GROUPS){
  const s=snapshot.windows.find(x=>x.key===g.key);
  assert.ok(s);
  assert.equal(s.oldCommit,g.oldCommit);
  assert.equal(s.oldBlob,g.oldBlob);
  assert.equal(s.checkpoint.pages,g.oldPages);
  assert.equal(s.checkpoint.lastSeenRank,g.oldLastSeenRank);
  assert.equal(s.checkpoint.complete,false);
  assert.equal(s.checkpoint.rankingOrderValid,true);
  assert.ok(!s.checkpoint.lastError&&!s.checkpoint.retryAfter);
  assert.equal(s.checkpoint.emptyAttempts,0);
  for(const x of proof.SPECS.filter(z=>z.eventNo===g.eventNo)){
   const originals=s.checkpoint.proposals.filter(v=>v.id===x.id);
   assert.equal(originals.length,1);
   assert.ok(proof.matchOriginal(originals[0],x));
   const row=pending.find(v=>v.id===x.id);
   if(row){
    assert.ok(sameScannedCandidate(originals[0],row));
    assert.ok(verifiedPartialPage(row,{end:Date.parse(g.sessionEndUtc)},s.checkpoint));
   }
  }
 }
});
test('cash, name, score, verified status and round tampering cannot pass approval',()=>{
 for(const s of proof.SPECS){
  const e=entry(s),r=row(s);
  assert.ok(proof.validateRecord(r,e));
  for(const [key,val] of [
   ['kind','賞金決勝'],['round','Event 3 · Round 2 / 賞金決勝'],
   ['rank',s.rank+1],['prize',100],['player','wrong player'],
   ['playerRaw','wrong raw Epic'],['points',s.points+1],
   ['kills',s.kills+1],['vrs',s.vrs+1],['matches',s.matches+1],
   ['verified',false],['source','https://example.com'],['reviewOnly',true]
  ]) assert.equal(proof.validateRecord({...r,[key]:val},e),false,s.id+' / '+key);
  assert.equal(proof.validateRecord(r,{...e,evidence:'invalid blob'}),false);
  assert.equal(proof.validateRecord(r,{...e,rule:'https://example.com'}),false);
 }
});
test('original 8/6 rank 829 stays excluded from the selected 17 proofs',()=>{
 const g=proof.GROUPS.find(x=>x.eventNo===8);
 assert.equal(g.count,17);assert.equal(g.oldPages,8);
 assert.ok(proof.SPECS.filter(x=>x.eventNo===8).every(x=>x.rank<=800));
 assert.ok(pending.some(x=>x.date==='2024-08-06'&&x.rank===829)&&
  !proof.SPECS.some(x=>x.date==='2024-08-06'&&x.rank===829));
});
test('cleanup only by exact unique ID and preserves unrelated pending entries',()=>{
 const ids=proof.SPECS.map(s=>s.id);
 const rows=[...ids.map(id=>({id})),{id:'unrelated'}];
 assert.deepEqual(proof.removeExact(rows,ids),[{id:'unrelated'}]);
 assert.throws(()=>proof.removeExact([{id:'other'}],ids),/Missing/);
 assert.throws(()=>proof.removeExact([...rows,{id:ids[0]}],ids),/duplicate/);
 assert.throws(()=>proof.removeExact(rows,[ids[0],ids[0]]),/Invalid/);
});
test('same-day published Round 2 finals are not duplicate Round 1 results',()=>{
 const groupDates=new Set(proof.GROUPS.map(g=>g.date));
 const finals=published.filter(x=>groupDates.has(x.date)&&x.region==='NAC'&&
  x.event==='ZB Solo Victory Cup'&&x.round?.includes('Round 2'));
 for(const s of proof.SPECS)for(const f of finals)
  assert.equal(collision(f,row(s),{}),'',s.id+' / '+f.id);
});

test('archived source blob attribution and event cutoff are stable after rebase',()=>{
 const byEvent=new Map(proof.GROUPS.map(g=>[g.eventNo,g]));
 assert.equal(byEvent.size,9);
 for(const g of proof.GROUPS){
  assert.ok(g.oldPages>0&&g.oldLastSeenRank>=g.rankMax);
  assert.equal(g.oldCommit.length,40);
  assert.equal(g.oldBlob.length,40);
  if(g.eventNo===8){
   assert.equal(g.oldBlob,'6af9cc80993405327bf07ef8620bfaddc717d7d1');
   assert.equal(g.oldLastSeenRank,800);
   assert.equal(g.rankMax,709);
   assert.ok(g.rankMax<g.oldLastSeenRank,'only ranks supported by original pages are included');
  }else{
   assert.equal(g.oldBlob,'43d4af41369f1e3fc30baf60c84de9b8062ff47b');
  }
 }
 for(const s of proof.SPECS){
  assert.ok(byEvent.has(s.eventNo));
  assert.equal(s.date,byEvent.get(s.eventNo).date);
  assert.ok(s.rank<=byEvent.get(s.eventNo).oldLastSeenRank);
  assert.ok(s.rank<=5000);
  assert.ok(s.source.endsWith('Event'+s.eventNo+'Round1_NAC'));
 }
});
