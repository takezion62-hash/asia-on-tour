'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const proof=require('../scripts/verified-s37-console-round1-oce7-naw9-23.cjs');
const p=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const results=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
const {sameScannedCandidate,verifiedPartialPage}=require('../scripts/verified-partial-page.cjs');
function output(spec){
 return {id:spec.id,date:spec.date,region:spec.region,player:spec.player,
  playerRaw:spec.playerRaw,players:[...spec.players],seasonId:'S37',chapter:6,
  season:4,tournamentId:'ch6s4-console-duos-victory',
  event:'Duos Console Victory Cash Cup',source:spec.source,rank:spec.rank,
  points:spec.points,kills:spec.kills,vrs:spec.vrs,matches:spec.matches,
  verified:true,kind:proof.expectedKind(spec),round:proof.expectedRound(spec),prize:0,
  note:'Epic順位表から確認。上位250。予選賞金$0。公式規則: '+proof.RULE+' Git blob '+proof.SOURCE_BLOB};
}
function approval(spec){
 return {id:spec.id,recordId:spec.id,policy:proof.POLICY,decision:'published',
  rule:proof.RULE,source:spec.source,
  evidence:'source-verified 23; original Git blob '+proof.SOURCE_BLOB};
}
test('23 immutable source-verified rows: exactly 13 OCE and 10 NAW',()=>{
 assert.equal(proof.SPECS.length,23);
 assert.equal(new Set(proof.SPECS.map(x=>x.id)).size,23);
 assert.equal(proof.SPECS.filter(x=>x.region==='OCE').length,13);
 assert.equal(proof.SPECS.filter(x=>x.region==='NAW').length,10);
 assert.equal(proof.SPECS.filter(x=>x.rank<=250).length,14);
 assert.equal(proof.SPECS.filter(x=>x.rank>250).length,9);
 for(const s of proof.SPECS){
  const already=results.filter(x=>x.id===s.id);
  const pending=p.filter(x=>x.id===s.id);
  assert.equal(already.length+pending.length,1,'each original must be in exactly one state: '+s.id);
  if(already.length)assert.ok(proof.validateRecord(already[0],ledger.find(x=>x.id===s.id)));
  else assert.ok(proof.matchOriginal(pending[0],s));
 }
});
test('original Git checkpoint is independently pinned, mature, complete or clean partial',()=>{
 assert.equal(archive.version,1);
 assert.equal(archive.source.blobSha,proof.SOURCE_BLOB);
 assert.equal(archive.source.commit,proof.SOURCE_COMMIT);
 assert.equal(archive.windows.length,2);
 for(const g of proof.GROUPS){
  const original=archive.windows.find(x=>x.key===g.key);
  assert.ok(original);
  assert.equal(original.checkpoint.rankingOrderValid,true);
  assert.equal(original.checkpoint.complete,g.complete);
  assert.equal(original.checkpoint.emptyAttempts,0);
  assert.equal(original.checkpoint.proposals.length,g.count);
  assert.ok(!original.checkpoint.lastError&&!original.checkpoint.retryAfter);
  for(const s of proof.SPECS.filter(x=>proof.findGroup(x).key===g.key)){
   const candidate=original.checkpoint.proposals.find(x=>x.id===s.id);
   assert.ok(proof.matchOriginal(candidate,s));
   const state=p.find(x=>x.id===s.id);
   if(state){
    assert.equal(sameScannedCandidate(candidate,state),true);
    if(!g.complete)assert.ok(verifiedPartialPage(state,{end:Date.parse(g.sessionEndUtc)},original.checkpoint));
   }
  }
 }
});
test('no rank, roster, cash, stage or evidence mutation passes approval audit',()=>{
 for(const s of proof.SPECS){
  const row=output(s),e=approval(s);
  assert.ok(proof.validateRecord(row,e));
  for(const [key,value] of [
   ['prize',200],['kind',s.rank<=250?'参加確認':'予選'],['rank',s.rank+1],
   ['kills',s.kills+1],['vrs',s.vrs+1],['points',s.points+1],
   ['matches',s.matches+1],['player','other'],['playerRaw','other raw'],
   ['players',['wrong','identity']],['round','Event 2 · Round 2 / 賞金決勝'],
   ['source','https://example.org'],['reviewOnly',true],['verified',false]
  ]) assert.equal(proof.validateRecord({...row,[key]:value},e),false,s.id+'/'+key);
  assert.equal(proof.validateRecord(row,{...e,evidence:'no source hash'}),false);
  assert.equal(proof.validateRecord(row,{...e,rule:'https://example.org'}),false);
 }
});
test('exact ID based cleanup keeps all unrelated candidates and rejects re-application',()=>{
 const ids=proof.SPECS.map(x=>x.id);
 const all=[...ids.map(id=>({id})),{id:'unrelated'}];
 const filtered=proof.removeResolved(all,ids);
 assert.deepEqual(filtered,[{id:'unrelated'}]);
 assert.equal(all.length,24);
 assert.throws(()=>proof.removeResolved(filtered,ids),/absent/);
 assert.throws(()=>proof.removeResolved([...all,{id:ids[0]}],ids),/repeated/);
 assert.throws(()=>proof.removeResolved(all,[ids[0],ids[0]]),/Invalid/);
});
test('Round 1 score never collides with a different Round 2 final',()=>{
 const finals=results.filter(x=>proof.GROUPS.some(g=>x.date===g.date&&x.region===g.region)&&
  x.round?.includes('Round 2')&&x.tournamentId==='ch6s4-console-duos-victory');
 for(const s of proof.SPECS)for(const final of finals)
  assert.equal(collision(final,output(s),{}),'',s.id+' '+final.id);
});
