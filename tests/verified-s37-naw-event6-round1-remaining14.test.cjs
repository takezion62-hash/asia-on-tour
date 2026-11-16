'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {POLICY,RULE,SOURCE,SPECS,CUTOFF,ARCHIVE_COMMIT,ARCHIVE_BLOB,getSpec,matchesOriginal,removeResolvedPending,expectedKind,expectedRound,validatedRecord}=
 require('../scripts/verified-s37-naw-event6-round1-remaining14.cjs');
const candidates=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const results=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
function record(spec){
 return {id:spec.id,player:spec.player,playerRaw:spec.playerRaw,players:[...spec.players],
  date:'2025-09-28',region:'NAW',seasonId:'S37',chapter:6,season:4,
  tournamentId:'ch6s4-console-duos-victory',event:'Duos Console Victory Cash Cup',
  source:SOURCE,rank:spec.rank,points:spec.points,kills:spec.kills,vrs:spec.vrs,matches:spec.matches,
  kind:expectedKind(spec),round:expectedRound(spec),prize:0,verified:true,
  note:'保存済み順位表で個別確認。全ページの取得は未完了。NAW上位250の公式規則、賞金$0。'+RULE+ARCHIVE_BLOB};
}
function entry(spec){return {id:spec.id,recordId:spec.id,decision:'published',policy:POLICY,
 rule:RULE,source:SOURCE,evidence:'mature contiguous observed leaderboard; Epic verified; source Git blob '+ARCHIVE_BLOB};}
test('exact 14 candidates, 8 qualifiers and 6 attendance-only, no duplicate IDs',()=>{
 assert.equal(SPECS.length,14);
 assert.equal(new Set(SPECS.map(x=>x.id)).size,14);
 assert.equal(SPECS.filter(x=>x.rank<=CUTOFF).length,8);
 assert.equal(SPECS.filter(x=>x.rank>CUTOFF).length,6);
 for(const spec of SPECS){
  assert.equal(getSpec(spec.id),spec);
  const existing=results.filter(x=>x.id===spec.id);
  const pending=candidates.filter(x=>x.id===spec.id);
  if(existing.length){
   assert.equal(existing.length,1);
   assert.ok(validatedRecord(existing[0],ledger.find(x=>x.id===spec.id)));
   // This test also runs on the migration PR before the main queue is repaired.
   assert.ok(pending.length===0||pending.length===1);
   if(pending.length)assert.ok(matchesOriginal(pending[0],spec),
    'stale queue entry must match the original exact proof');
  }else{
   assert.equal(pending.length,1);
   assert.ok(matchesOriginal(pending[0],spec));
  }
 }
});
test('zero Round1 cash, rank and exact duo names cannot be tampered with',()=>{
 for(const spec of SPECS){
  const r=record(spec),e=entry(spec);
  assert.equal(validatedRecord(r,e),true);
  for(const [key,bad] of [
   ['rank',spec.rank+1],['points',spec.points+1],['kills',spec.kills+1],
   ['vrs',spec.vrs+1],['matches',spec.matches+1],['prize',100],
   ['verified',false],['player','wrong player'],['playerRaw','wrong Epic display name'],
   ['players',['someone','other']],['kind',spec.rank<=250?'参加確認':'予選'],
   ['round','Event 6 · Round 2 / 賞金決勝'],['source','https://example.com'],
   ['reviewOnly',true]
  ])assert.equal(validatedRecord({...r,[key]:bad},e),false,spec.id+' / '+key);
  assert.equal(validatedRecord(r,{...e,evidence:'uncorroborated rank'}),false);
  assert.equal(validatedRecord(r,{...e,rule:'https://example.com'}),false);
 }
});
test('older Round 2 finals never collide with new Round 1 team performances',()=>{
 const finals=results.filter(x=>x.date==='2025-09-28'&&x.region==='NAW'&&
  x.round==='Event 6 · Round 2 / 賞金決勝');
 for(const spec of SPECS) for(const final of finals){
  assert.equal(collision(final,record(spec),{}),'',spec.id+' / '+final.id);
 }
});

test('immutable pristine 12-page evidence predates later transient API failures',()=>{
 const archive=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/s37-naw-event6-round1-mature-checkpoint-20261116.json'),'utf8'));
 const {verifiedPartialPage,sameScannedCandidate}=require('../scripts/verified-partial-page.cjs');
 const calendar=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions;
 const session=calendar.find(x=>x.sourceWindowId==='S37_ConsoleDuosCashCups_Event6Round1_NAW');
 const archiveEnd=Date.parse(session.endUtc),cp=archive.checkpoint;
 assert.equal(archive.version,1);
 assert.equal(archive.source.commit,ARCHIVE_COMMIT);
 assert.equal(archive.source.blobSha,ARCHIVE_BLOB);
 assert.equal(cp.nextPage,12);
 assert.equal(cp.pages,12);
 assert.equal(cp.totalPages,62);
 assert.equal(cp.complete,false);
 assert.equal(cp.rankingOrderValid,true);
 assert.equal(cp.proposals.length,18);
 assert.equal(cp.emptyAttempts,0);
 assert.ok(!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter);
 for(const spec of SPECS){
  const original=cp.proposals.filter(x=>x.id===spec.id);
  assert.equal(original.length,1);
  const active=candidates.find(x=>x.id===spec.id);
  const existing=results.find(x=>x.id===spec.id);
  if(active){
   assert.ok(matchesOriginal(active,spec));
   assert.ok(sameScannedCandidate(original[0],active));
   assert.ok(verifiedPartialPage(active,{end:archiveEnd},cp));
  }else assert.ok(existing&&validatedRecord(existing,ledger.find(x=>x.id===spec.id)));
 }
});

test('already-published IDs are removed by ID and only once, without losing other candidates',()=>{
 const ids=SPECS.map(s=>s.id);
 const originals=ids.map(id=>candidates.find(x=>x.id===id)).filter(Boolean);
 const unrelated={id:'auto-s37-unrelated',player:'unrelated'};
 const queue=[...originals,unrelated];
 const remaining=removeResolvedPending(queue,originals.map(x=>x.id));
 assert.equal(remaining.length,1);
 assert.equal(remaining[0],unrelated);
 assert.equal(queue.length,originals.length+1);
 assert.throws(()=>removeResolvedPending(queue,[...originals.map(x=>x.id),'missing']),/missing/);
 assert.throws(()=>removeResolvedPending(queue,[...originals.map(x=>x.id),originals[0]?.id]),/invalid/);
 const forged=[...queue,{...originals[0]}];
 assert.throws(()=>removeResolvedPending(forged,originals.map(x=>x.id)),/duplicate/);
});
