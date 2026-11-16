'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {POLICY,RULE,SOURCE,SPECS,CUTOFF,getSpec,matchesOriginal,expectedKind,expectedRound,validatedRecord}=
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
  note:'保存済み順位表で個別確認。全ページの取得は未完了。NAW上位250の公式規則、賞金$0。'+RULE};
}
function entry(spec){return {id:spec.id,recordId:spec.id,decision:'published',policy:POLICY,
 rule:RULE,source:SOURCE,evidence:'mature contiguous observed leaderboard; Epic verified'};}
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
   assert.equal(existing.length,1);assert.equal(pending.length,0);
   assert.ok(validatedRecord(existing[0],ledger.find(x=>x.id===spec.id)));
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
