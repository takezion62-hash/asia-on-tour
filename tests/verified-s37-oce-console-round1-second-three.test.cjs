'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {POLICY,RULE,SOURCE,SPECS,CUTOFF,getSpec,matchesOriginal,expectedKind,expectedRound,validatedRecord}=require('../scripts/verified-s37-oce-console-round1-second-three.cjs');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const candidates=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const rows=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
const original=JSON.parse(fs.readFileSync(path.join(ROOT,'source-results/S37.json'),'utf8'));
function proofRow(spec){
 return {id:spec.id,player:spec.player,playerRaw:spec.playerRaw,players:[...spec.players],
  date:'2025-08-24',region:'OCE',seasonId:'S37',chapter:6,season:4,
  tournamentId:'ch6s4-console-duos-victory',event:'Duos Console Victory Cash Cup',
  source:SOURCE,rank:spec.rank,points:spec.points,kills:spec.kills,vrs:spec.vrs,matches:spec.matches,
  kind:expectedKind(spec),round:expectedRound(spec),prize:0,verified:true,
  note:'OCE上位250に基づく予選結果、賞金$0。'+RULE};
}
function entry(spec){return {id:spec.id,recordId:spec.id,decision:'published',policy:POLICY,
 rule:RULE,source:SOURCE,evidence:'original full leaderboard 26/26'};}
test('second three frozen original duo teams remain participation-only',()=>{
 assert.equal(SPECS.length,3);
 assert.equal(new Set(SPECS.map(x=>x.id)).size,3);
 assert.equal(CUTOFF,250);
 assert.equal(SPECS.filter(x=>x.rank<=250).length,0);
 assert.equal(SPECS.filter(x=>x.rank>250).length,3);
 assert.ok(RULE.includes('chapter-6-season-4-official-rules'));
 for(const spec of SPECS){
  assert.equal(getSpec(spec.id),spec);
  const existing=rows.find(x=>x.id===spec.id);
  const originalCandidate=candidates.find(x=>x.id===spec.id);
  // This test passes both before and after production publishes the batch.
  if(existing){
   assert.equal(originalCandidate,undefined);
   assert.ok(validatedRecord(existing,ledger.find(x=>x.id===spec.id)));
  }else{
   assert.ok(matchesOriginal(originalCandidate,spec),'expected exact original pending proposal');
  }
 }
});
test('both participation and breakthrough must be zero-dollar and rule-backed',()=>{
 for(const spec of SPECS){
  const record=proofRow(spec),proof=entry(spec);
  assert.equal(validatedRecord(record,proof),true);
  for(const [key,bad] of [
   ['rank',spec.rank+1],['points',spec.points+1],['kills',spec.kills+1],
   ['vrs',spec.vrs+1],['matches',spec.matches+1],['prize',100],
   ['verified',false],['kind',spec.rank<=250?'参加確認':'予選'],
   ['round','Event 2 · Round 2 / 賞金決勝'],['player','wrong identity'],
   ['playerRaw','wrong Epic display name'],['source','https://example.com'],
   ['reviewOnly',true]
  ])assert.equal(validatedRecord({...record,[key]:bad},proof),false,spec.id+' / '+key);
  assert.equal(validatedRecord(record,{...proof,rule:'https://example.com'}),false);
  assert.equal(validatedRecord(record,{...proof,evidence:'partial 2/26'}),false);
 }
});
test('existing first batch and same-day final stay distinct',()=>{
 const ids=['auto-s37-d4b35b1e7aa2','auto-s37-233e43e48432','auto-s37-27b3227250e3','s37-oce-console-duos-vc-final-20250824-rimuta-kametin'];
 const existing=original.filter(x=>ids.includes(x.id));
 assert.equal(existing.length,4);
 for(const old of existing){
  for(const spec of SPECS) assert.equal(collision(old,proofRow(spec),{}),'',old.id+' / '+spec.id);
 }
});
