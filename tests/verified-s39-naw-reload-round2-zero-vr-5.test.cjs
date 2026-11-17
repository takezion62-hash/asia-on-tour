'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=require('../scripts/verified-s39-naw-reload-round2-zero-vr-5.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const pending=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const rows=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const snap=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
function row(s){return {id:s.id,date:s.date,region:'NAW',seasonId:'S39',chapter:7,season:1,
 tournamentId:'ch7s1-reload-duos-victory',event:'Reload Duos Victory Cup',
 player:s.player,playerRaw:s.playerRaw,players:[...s.players],
 rank:s.rank,points:s.points,kills:s.kills,vrs:0,matches:s.matches,source:s.source,
 kind:'賞金決勝',round:proof.originalRound(s),prize:0,verified:true,
 note:'公式順位表の0VR、賞金$0。'+proof.RULE+proof.SOURCE_BLOB};}
function entry(s){return {id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
 source:s.source,rule:proof.RULE,evidence:'S39 Reload verified 5: pinned 2/2 pages '+proof.SOURCE_BLOB};}
test('exact five 0VR NAW Reload Duos finalists across two event windows',()=>{
 assert.equal(proof.SPECS.length,5);
 assert.equal(new Set(proof.SPECS.map(x=>x.id)).size,5);
 assert.deepEqual(proof.GROUPS.map(x=>x.count),[3,2]);
 assert.ok(proof.SPECS.every(x=>x.vrs===0));
 for(const s of proof.SPECS){
  const p=pending.filter(x=>x.id===s.id),x=rows.filter(y=>y.id===s.id);
  assert.equal(p.length+x.length,1,'published xor pending '+s.id);
  if(p.length)assert.ok(proof.matchOriginal(p[0],s));
  else assert.ok(proof.validateRecord(x[0],ledger.find(y=>y.id===s.id)));
 }
});
test('immutable verified full original 2-page scoreboard snapshots',()=>{
 assert.equal(snap.version,1);
 assert.equal(snap.source.blobSha,proof.SOURCE_BLOB);
 for(const g of proof.GROUPS){
  const cp=snap.windows.find(x=>x.key===g.key)?.checkpoint;
  assert.ok(cp);
  assert.equal(cp.complete,true);assert.equal(cp.pages,2);assert.equal(cp.totalPages,2);
  assert.equal(cp.rankingOrderValid,true);assert.equal(cp.emptyAttempts,0);
  assert.ok(!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter);
  for(const s of proof.SPECS.filter(x=>x.eventNo===g.eventNo)){
   const original=cp.proposals.find(x=>x.id===s.id);
   assert.ok(proof.matchOriginal(original,s));
  }
 }
});
test('0VR, exact roster and zero prize are immutable',()=>{
 for(const s of proof.SPECS){
  const x=row(s),e=entry(s);
  assert.equal(proof.validateRecord(x,e),true);
  for(const [key,bad] of [
   ['prize',200],['vrs',1],['kind','参加確認'],
   ['round','Event 3 · Round 1 / 予選突破'],
   ['rank',s.rank+1],['kills',s.kills+1],['matches',s.matches+1],
   ['player','other'],['playerRaw','wrong'],
   ['players',['wrong','identity']],['source','https://example.com'],
   ['reviewOnly',true],['verified',false]
  ])assert.equal(proof.validateRecord({...x,[key]:bad},e),false,s.id+'/'+key);
  assert.equal(proof.validateRecord(x,{...e,evidence:'forged'}),false);
  assert.equal(proof.validateRecord(x,{...e,rule:'forged'}),false);
 }
});
test('exact duplicate queue IDs rejected, unrelated entries unchanged',()=>{
 const ids=proof.SPECS.map(x=>x.id),all=[...ids.map(id=>({id})),{id:'other'}];
 assert.deepEqual(proof.removeExact(all,ids),[{id:'other'}]);
 assert.throws(()=>proof.removeExact(all,[ids[0],ids[0]]),/Invalid/);
 assert.throws(()=>proof.removeExact([...all,{id:ids[0]}],ids),/duplicated/);
 assert.throws(()=>proof.removeExact([{id:'other'}],ids),/Missing/);
});
