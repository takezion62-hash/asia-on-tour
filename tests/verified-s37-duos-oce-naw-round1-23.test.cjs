'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=require('../scripts/verified-s37-duos-oce-naw-round1-23.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('../scripts/verified-partial-page.cjs');
const history=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const results=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const saved=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s37-oce-event7-naw-event9-round1-23-checkpoints-20261117.json'),'utf8'));
function fakeRecord(spec){
 const g=proof.groupFor(spec);
 return {id:spec.id,seasonId:'S37',chapter:6,season:4,
  tournamentId:'ch6s4-console-duos-victory',event:'Duos Console Victory Cash Cup',
  date:spec.date,region:spec.region,source:proof.sourceFor(g),
  player:spec.player,playerRaw:spec.playerRaw,players:spec.players,
  rank:spec.rank,points:spec.points,kills:spec.kills,vrs:spec.vrs,matches:spec.matches,
  verified:true,kind:proof.expectedKind(spec),round:proof.expectedRound(spec),prize:0,
  note:'Epic取得済み順位表 '+(g.mode==='complete'?'21/21':'2/52')+
  ' 順位上位250 賞金$0 '+proof.RULE+' '+proof.SCAN_BLOB};
}
function fakeEntry(spec){
 return {id:spec.id,recordId:spec.id,decision:'published',policy:proof.POLICY,
  rule:proof.RULE,source:proof.sourceFor(proof.groupFor(spec)),
  evidence:'verified contiguous original pages; saved scan '+proof.SCAN_BLOB};
}
test('23 independent S37 duo results: OCE 13, NAW 10, advancement 14, attendance 9',()=>{
 assert.equal(proof.SPECS.length,23);
 assert.equal(new Set(proof.SPECS.map(x=>x.id)).size,23);
 assert.equal(proof.SPECS.filter(x=>x.region==='OCE').length,13);
 assert.equal(proof.SPECS.filter(x=>x.region==='NAW').length,10);
 assert.equal(proof.SPECS.filter(x=>x.rank<=250).length,14);
 assert.equal(proof.SPECS.filter(x=>x.rank>250).length,9);
 for(const spec of proof.SPECS){
  const active=history.filter(x=>x.id===spec.id),published=results.filter(x=>x.id===spec.id);
  assert.equal(active.length+published.length,1,'candidate must be pending OR published exactly once: '+spec.id);
  if(active.length)assert.ok(proof.matchesOriginal(active[0],spec));
  if(published.length)assert.ok(proof.validatedRecord(published[0],ledger.find(x=>x.id===spec.id)));
  assert.ok(proof.validatedRecord(fakeRecord(spec),fakeEntry(spec)));
 }
});
test('archived official Epic leaderboard and exact names remain anchored and mature',()=>{
 assert.equal(saved.version,1);
 assert.equal(saved.provenance.scanBlob,proof.SCAN_BLOB);
 assert.equal(saved.provenance.commit,proof.SCAN_COMMIT);
 assert.equal(saved.checkpoints.length,2);
 const sessions=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-10.json'),'utf8')).sessions;
 for(const g of proof.GROUPS){
  const list=saved.checkpoints.filter(x=>x.key===g.key);
  assert.equal(list.length,1);
  const cp=list[0].checkpoint;
  assert.equal(cp.pages,g.pages);
  assert.equal(cp.totalPages,g.totalPages);
  assert.equal(cp.rankingOrderValid,true);
  assert.equal(cp.complete,g.mode==='complete');
  assert.equal(cp.lastErrorCode,undefined);
  assert.equal(cp.emptyAttempts,0);
  const session=sessions.find(x=>x.sourceWindowId===g.win&&x.dateJst===g.date);
  assert.ok(session);
  for(const spec of proof.SPECS.filter(x=>x.region===g.region)){
   const rows=cp.proposals.filter(x=>x.id===spec.id);
   assert.equal(rows.length,1);
   const actual=history.find(x=>x.id===spec.id);
   if(actual){
    assert.ok(sameScannedCandidate(rows[0],actual));
    assert.ok(proof.matchesOriginal(actual,spec));
    if(g.mode==='partial')assert.ok(verifiedPartialPage(actual,{end:Date.parse(session.endUtc)},cp));
   }else assert.ok(results.some(x=>x.id===spec.id));
  }
 }
});
test('pinned rank, round, roster, Epic raw name, cash and evidence cannot be altered',()=>{
 for(const spec of proof.SPECS){
  const record=fakeRecord(spec),entry=fakeEntry(spec);
  for(const [key,bad] of [
   ['rank',spec.rank+1],['points',spec.points+1],['kills',spec.kills+1],
   ['vrs',spec.vrs+1],['matches',spec.matches+1],['prize',100],
   ['player','wrong identity'],['playerRaw','wrong Epic name'],['players',['wrong','pair']],
   ['verified',false],['kind',spec.rank<=250?'参加確認':'予選'],
   ['round','Event 7 · Round 2 / 賞金決勝'],['source','https://example.com'],
   ['reviewOnly',true]
  ])assert.equal(proof.validatedRecord({...record,[key]:bad},entry),false,spec.id+' '+key);
  assert.equal(proof.validatedRecord(record,{...entry,evidence:'no original source'}),false);
  assert.equal(proof.validatedRecord(record,{...entry,source:'https://example.com'}),false);
 }
});
test('ID cleanup is deterministic, once-only and never broadens to unrelated rows',()=>{
 const ids=proof.SPECS.map(x=>x.id);
 const fake=ids.map(id=>({id})),other={id:'other-nonselected'};
 assert.deepEqual(proof.removeResolvedPending([...fake,other],ids),[other]);
 assert.throws(()=>proof.removeResolvedPending([other],ids),/missing|duplicat/);
 assert.throws(()=>proof.removeResolvedPending([...fake,{...fake[0]}],ids),/missing|duplicat/);
 assert.throws(()=>proof.removeResolvedPending([...fake,other],[ids[0],ids[0]]),/invalid/);
});
test('old Round 2 finals never collide with separately recorded Round 1 standings',()=>{
 const finals=results.filter(x=>x.seasonId==='S37'&&x.kind==='賞金決勝'&&
  proof.GROUPS.some(g=>g.region===x.region&&g.date===x.date));
 for(const spec of proof.SPECS)for(const f of finals){
  assert.equal(collision(f,fakeRecord(spec),{}),'',spec.id+' vs '+f.id);
 }
});
