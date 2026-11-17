'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=require('../scripts/verified-s37-console-duos-round2-20-zerovr.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {sameScannedCandidate}=require('../scripts/verified-partial-page.cjs');
const history=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const rows=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s37-console-duos-round2-20-zerovr-checkpoints-20261117.json'),'utf8'));
function published(s){
 const g=proof.groupFor(s);
 return {id:s.id,date:s.date,region:s.region,seasonId:'S37',chapter:6,season:4,
  tournamentId:'ch6s4-console-duos-victory',event:'Duos Console Victory Cash Cup',
  round:'Event '+g.eventNo+' · Round 2 / 賞金決勝',kind:'賞金決勝',
  source:proof.sourceFor(g),player:s.player,playerRaw:s.playerRaw,players:s.players,
  rank:s.rank,points:s.points,kills:s.kills,vrs:0,matches:s.matches,prize:0,verified:true,
  note:'証拠Git blob '+proof.SCAN_BLOB+'。0VRなので賞金$0。'+proof.RULE};
}
function entry(s){return {id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
 source:proof.sourceFor(proof.groupFor(s)),rule:proof.RULE,
 evidence:'0VR from complete original Epic Round2, pinned Git blob '+proof.SCAN_BLOB};}
test('20 complete-scoreboard S37 duo finals with 0VR and cash 0, no duplicates',()=>{
 assert.equal(proof.SPECS.length,20);
 assert.deepEqual(proof.GROUPS.map(g=>g.count),[8,3,9]);
 assert.equal(new Set(proof.SPECS.map(x=>x.id)).size,20);
 assert.ok(proof.SPECS.every(x=>x.vrs===0));
 for(const s of proof.SPECS){
  const pending=history.filter(x=>x.id===s.id),existing=rows.filter(x=>x.id===s.id);
  assert.equal(pending.length+existing.length,1,s.id+' must be exactly once pending or published');
  if(pending.length)assert.ok(proof.matchesOriginal(pending[0],s));
  else assert.ok(proof.validateRecord(existing[0],ledger.find(x=>x.id===s.id)));
  assert.ok(proof.validateRecord(published(s),entry(s)));
 }
});
test('complete archived Epic scoreboard rows match source candidates exactly',()=>{
 assert.equal(archive.version,1);
 assert.equal(archive.source.scanBlob,proof.SCAN_BLOB);
 assert.equal(archive.source.commit,proof.SOURCE_COMMIT);
 assert.equal(archive.windows.length,3);
 for(const g of proof.GROUPS){
  const match=archive.windows.filter(x=>x.key===g.key);
  assert.equal(match.length,1);
  const cp=match[0].checkpoint;
  assert.equal(cp.complete,true);
  assert.equal(cp.rankingOrderValid,true);
  assert.equal(cp.pages,g.pages);
  assert.equal(cp.totalPages,g.pages);
  assert.equal(cp.lastSeenRank,g.lastSeenRank);
  assert.equal(cp.emptyAttempts,0);
  assert.ok(!cp.lastErrorCode&&!cp.retryAfter);
  for(const s of proof.SPECS.filter(x=>x.date===g.date&&x.region===g.region)){
   const prior=cp.proposals.filter(x=>x.id===s.id);
   assert.equal(prior.length,1);
   assert.ok(proof.matchesOriginal(prior[0],s));
   const active=history.find(x=>x.id===s.id);
   if(active)assert.ok(sameScannedCandidate(prior[0],active));
  }
 }
});
test('a changed VR, prize, tournament, rank or Epic raw identity fails audit',()=>{
 for(const s of proof.SPECS){
  const r=published(s),e=entry(s);
  for(const [field,bad] of [
   ['vrs',1],['prize',200],['kind','予選'],['rank',s.rank+1],
   ['points',s.points+1],['kills',s.kills+1],['matches',s.matches+1],
   ['player','wrong user'],['playerRaw','wrong Epic ID'],
   ['players',['wrong','roster']],['source','https://example.com'],
   ['verified',false],['reviewOnly',true],['round','Event 1 · Round 1 / 予選']
  ])assert.equal(proof.validateRecord({...r,[field]:bad},e),false,s.id+' '+field);
  assert.equal(proof.validateRecord(r,{...e,evidence:'unverified'}),false);
  assert.equal(proof.validateRecord(r,{...e,rule:'https://example.com'}),false);
 }
});
test('already-published cash finals and first-round qualifiers remain separate stages',()=>{
 for(const s of proof.SPECS){
  const fake=published(s);
  const sameDay=rows.filter(x=>x.date===s.date&&x.region===s.region&&x.seasonId==='S37');
  for(const old of sameDay){
   if(old.id===s.id)continue;
   assert.equal(collision(old,fake,{}),'',s.id+' / '+old.id);
  }
 }
});
test('ID-based queue cleanup never removes unrelated or duplicate candidates',()=>{
 const ids=proof.SPECS.map(x=>x.id),queue=[...ids.map(id=>({id})),{id:'unrelated'}];
 assert.deepEqual(proof.removeExact(queue,ids),[{id:'unrelated'}]);
 assert.throws(()=>proof.removeExact(queue,[ids[0],ids[0]]),/invalid/);
 assert.throws(()=>proof.removeExact([{id:'unrelated'}],ids),/missing/);
 assert.throws(()=>proof.removeExact([...queue,{id:ids[0]}],ids),/duplicat/);
});
