'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=require('../scripts/verified-s41-eu-console-zb-solo-round2-eleven.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {sameScannedCandidate}=require('../scripts/verified-partial-page.cjs');
const current=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const rows=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s41-eu-console-zb-solo-round2-11-checkpoint-20261117.json'),'utf8'));
function record(s){
 const prize=proof.amount(s);
 return {id:s.id,date:s.date,region:'EU',seasonId:'S41',chapter:7,season:3,
  tournamentId:'ch7s3-console-zb-solo-victory',event:'Console Solo Victory Cup (ZB)',
  kind:'賞金決勝',round:'Event 1 · Round 2 / 賞金決勝',source:proof.SOURCE,
  player:s.player,playerRaw:s.playerRaw,rank:s.rank,points:s.points,kills:s.kills,
  vrs:s.vrs,matches:s.matches,verified:true,prize,
  note:'Epic20/20ページと本人照合 '+proof.RULE+' '+proof.SCAN_BLOB+' 賞金$'+prize};
}
function approval(s){return {id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
 source:proof.SOURCE,rule:proof.RULE,evidence:'20-page complete Epic source, '+proof.SCAN_BLOB};}
test('11 exact EU S41 final results, 1 VR winner with $100, 10 non-winners $0',()=>{
 assert.equal(proof.SPECS.length,11);
 assert.equal(new Set(proof.SPECS.map(s=>s.id)).size,11);
 assert.equal(proof.SPECS.filter(x=>x.vrs===1).length,1);
 assert.equal(proof.SPECS.filter(x=>x.vrs===0).length,10);
 assert.equal(proof.SPECS.reduce((sum,s)=>sum+proof.amount(s),0),100);
 const single=proof.SPECS.find(x=>x.vrs===1);
 assert.equal(single.player,'なずな');assert.equal(single.rank,18);
 for(const s of proof.SPECS){
  const p=current.filter(x=>x.id===s.id),r=rows.filter(x=>x.id===s.id);
  assert.equal(p.length+r.length,1,'must be pending xor published exactly once: '+s.id);
  if(p.length)assert.ok(proof.matchesOriginal(p[0],s));
  else assert.ok(proof.validateRecord(r[0],ledger.find(x=>x.id===s.id)));
  assert.ok(proof.validateRecord(record(s),approval(s)));
 }
});
test('all 20/20 complete original Epic pages retain 11 verified identities',()=>{
 assert.equal(archive.version,1);
 assert.equal(archive.source.scanBlob,proof.SCAN_BLOB);
 const cp=archive.checkpoint;
 assert.equal(cp.complete,true);
 assert.equal(cp.pages,20);assert.equal(cp.totalPages,20);
 assert.equal(cp.lastSeenRank,1943);
 assert.equal(cp.rankingOrderValid,true);
 assert.equal(cp.emptyAttempts,0);
 assert.ok(!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter);
 assert.equal(cp.proposals.length,11);
 for(const s of proof.SPECS){
  const original=cp.proposals.filter(x=>x.id===s.id);
  assert.equal(original.length,1);
  assert.ok(proof.matchesOriginal(original[0],s));
  const p=current.find(x=>x.id===s.id);
  if(p)assert.ok(sameScannedCandidate(p,original[0]));
 }
});
test('payout only VR-based, rank, raw Epic name, source and all stats tamper-resistant',()=>{
 for(const s of proof.SPECS){
  const r=record(s),e=approval(s);
  for(const [key,bad] of [
   ['rank',s.rank+1],['points',s.points+1],['kills',s.kills+1],
   ['vrs',s.vrs+1],['matches',s.matches+1],['prize',s.vrs*100+100],
   ['player','wrong player'],['playerRaw','not same Epic ID'],
   ['source','https://example.com'],['round','Event 1 · Round 1 / 予選'],
   ['kind','予選'],['verified',false],['reviewOnly',true]
  ])assert.equal(proof.validateRecord({...r,[key]:bad},e),false,s.id+' '+key);
  assert.equal(proof.validateRecord(r,{...e,evidence:'not verified'}),false);
  assert.equal(proof.validateRecord(r,{...e,rule:'https://example.com'}),false);
 }
});
test('full-run cleanup removes exactly 11, no accidental unrelated or held rows',()=>{
 const ids=proof.SPECS.map(x=>x.id),queue=[...ids.map(id=>({id})),{id:'unrelated'}];
 assert.deepEqual(proof.removeExact(queue,ids),[{id:'unrelated'}]);
 assert.throws(()=>proof.removeExact([{id:'other'}],ids),/missing/);
 assert.throws(()=>proof.removeExact([...queue,{id:ids[0]}],ids),/duplicate/);
 assert.throws(()=>proof.removeExact(queue,[ids[0],ids[0]]),/invalid/);
});
test('separate event or stage must never collide with a new Round2 final',()=>{
 for(const s of proof.SPECS){
  const fake=record(s);
  for(const other of rows.filter(r=>r.date===s.date&&r.region==='EU')){
   if(other.id===s.id)continue;
   assert.equal(collision(other,fake,{}),'',s.id+' / '+other.id);
  }
 }
});
