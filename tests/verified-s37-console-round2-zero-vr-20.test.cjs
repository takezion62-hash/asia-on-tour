'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=require('../scripts/verified-s37-console-round2-zero-vr-20.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {sameScannedCandidate}=require('../scripts/verified-partial-page.cjs');
const pending=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const records=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const snap=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
function row(s){
 return {id:s.id,seasonId:'S37',chapter:6,season:4,
  tournamentId:'ch6s4-console-duos-victory',event:'Duos Console Victory Cash Cup',
  date:s.date,region:s.region,player:s.player,playerRaw:s.playerRaw,players:s.players,
  rank:s.rank,points:s.points,kills:s.kills,matches:s.matches,vrs:0,prize:0,
  kind:'賞金決勝',round:proof.roundName(s),verified:true,source:s.source,
  note:'完全順位表で決勝0VR、賞金$0。'+proof.RULE+proof.SOURCE_BLOB};
}
function entry(s){return {id:s.id,recordId:s.id,policy:proof.POLICY,decision:'published',
 source:s.source,rule:proof.RULE,evidence:'complete Round2 0VR proof from '+proof.SOURCE_BLOB};}
test('20 frozen all-0VR source-backed finalists from three complete Round2 windows',()=>{
 assert.equal(proof.SPECS.length,20);
 assert.deepEqual(proof.GROUPS.map(g=>g.count),[8,3,9]);
 assert.equal(new Set(proof.SPECS.map(x=>x.id)).size,20);
 for(const s of proof.SPECS){
  assert.equal(s.vrs,0);
  const x=pending.filter(y=>y.id===s.id),r=records.filter(y=>y.id===s.id);
  assert.equal(x.length+r.length,1,'Each result must be in pending xor published');
  if(x.length)assert.ok(proof.matchOriginal(x[0],s));
  else assert.ok(proof.validateRecord(r[0],ledger.find(x=>x.id===s.id)));
 }
});
test('all original/archived leaderboard pages complete and unchanged',()=>{
 assert.equal(snap.version,1);
 assert.equal(snap.source.blobSha,proof.SOURCE_BLOB);
 assert.equal(snap.windows.length,3);
 for(const g of proof.GROUPS){
  const o=snap.windows.find(x=>x.key===g.key),cp=o?.checkpoint;
  assert.ok(cp);
  assert.equal(cp.complete,true);
  assert.equal(cp.rankingOrderValid,true);
  assert.equal(cp.pages,3);
  assert.equal(cp.pages,cp.totalPages);
  assert.equal(cp.emptyAttempts,0);
  assert.ok(!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter);
  for(const s of proof.SPECS.filter(x=>x.date===g.date&&x.region===g.region)){
   const original=cp.proposals.filter(x=>x.id===s.id);
   assert.equal(original.length,1);
   assert.ok(proof.matchOriginal(original[0],s));
   const queue=pending.find(x=>x.id===s.id);
   if(queue)assert.ok(sameScannedCandidate(original[0],queue));
  }
 }
});
test('0VR, source, prize, roster and stats are immutable; no invented cash',()=>{
 for(const s of proof.SPECS){
  const x=row(s),e=entry(s);
  assert.ok(proof.validateRecord(x,e));
  for(const [key,bad] of [
   ['prize',200],['vrs',1],['points',1],['rank',s.rank+1],
   ['kills',s.kills+1],['matches',s.matches+1],['player','wrong'],
   ['playerRaw','wrong'],['players',['wrong','other']],
   ['round','Event 7 · Round 1 / 予選突破'],['kind','参加確認'],
   ['source','https://example.org'],['verified',false],['reviewOnly',true]
  ]) assert.equal(proof.validateRecord({...x,[key]:bad},e),false,s.id+'/'+key);
  assert.equal(proof.validateRecord(x,{...e,evidence:'forged'}),false);
  assert.equal(proof.validateRecord(x,{...e,rule:'invalid'}),false);
 }
});
test('exact-ID pending removal protects unrelated and already-resolved IDs',()=>{
 const ids=proof.SPECS.map(x=>x.id),q=[...ids.map(id=>({id})),{id:'unrelated'}];
 assert.deepEqual(proof.removeExact(q,ids),[{id:'unrelated'}]);
 assert.throws(()=>proof.removeExact([{id:'unrelated'}],ids),/Missing/);
 assert.throws(()=>proof.removeExact([...q,{id:ids[0]}],ids),/duplicate/);
});
