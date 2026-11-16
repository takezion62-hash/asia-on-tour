'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {readResults}=require('../scripts/source-results-store.cjs');
const {collision}=require('../scripts/manual-approval-core.cjs');
const {POLICY,RULE,SOURCE,SPECS,CUTOFF,matchesOriginal,verifiedFinal,expectedKind,expectedRound,validatedRecord}=require('../scripts/verified-s37-naw-console-event6-round1-four.cjs');
const pending=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-review.json'),'utf8')).proposals;
const rows=readResults(ROOT).rows;
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'approval-history.json'),'utf8')).entries;
function row(spec){return {id:spec.id,player:spec.player,playerRaw:spec.playerRaw,players:[...spec.players],
 date:'2025-09-28',region:'NAW',seasonId:'S37',chapter:6,season:4,
 tournamentId:'ch6s4-console-duos-victory',event:'Duos Console Victory Cash Cup',source:SOURCE,
 rank:spec.rank,points:spec.points,kills:spec.kills,vrs:spec.vrs,matches:spec.matches,
 kind:expectedKind(),round:expectedRound(),prize:0,verified:true,
 note:'NAW上位250、予選賞金$0、既存の賞金決勝 '+spec.finalId+'。'+RULE};}
function entry(spec){return {id:spec.id,recordId:spec.id,decision:'published',policy:POLICY,
 rule:RULE,source:SOURCE,evidence:'Original saved Epic leaderboard and existing verified final '+spec.finalId};}
test('exact four selected NAW qualifiers and separately published finals remain verified',()=>{
 assert.equal(SPECS.length,4);
 assert.equal(new Set(SPECS.map(x=>x.id)).size,4);
 assert.equal(CUTOFF,250);
 for(const spec of SPECS){
  assert.ok(spec.rank<=CUTOFF&&spec.rank>0);
  assert.ok(verifiedFinal(spec,rows),'verified final missing: '+spec.id);
  assert.ok(rows.some(x=>x.id===spec.finalId&&x.prize===spec.finalPrize));
  const found=rows.filter(x=>x.id===spec.id);
  if(found.length){
   assert.equal(found.length,1);
   assert.equal(pending.some(x=>x.id===spec.id),false);
   assert.ok(validatedRecord(found[0],ledger.find(x=>x.id===spec.id)));
  }else assert.ok(matchesOriginal(pending.find(x=>x.id===spec.id),spec));
  const final=rows.find(x=>x.id===spec.finalId);
  assert.equal(collision(final,row(spec),{}),'','round 1 must not collide with round 2');
 }
});
test('partial leaderboard cannot invent cash, teams or a Round 2 payout',()=>{
 for(const spec of SPECS){
  const proof=entry(spec),published=row(spec);
  assert.ok(validatedRecord(published,proof));
  for(const [key,bad] of [
   ['rank',spec.rank+1],['points',spec.points+1],['kills',spec.kills+1],
   ['vrs',spec.vrs+1],['matches',spec.matches+1],['prize',100],
   ['player','wrong identity'],['playerRaw','wrong Epic display name'],
   ['round','Event 6 · Round 2 / 賞金決勝'],['kind','賞金決勝'],
   ['source','https://example.com'],['verified',false],['reviewOnly',true]
  ])assert.equal(validatedRecord({...published,[key]:bad},proof),false,spec.id+' / '+key);
  assert.equal(validatedRecord(published,{...proof,evidence:'missing finalist'}),false);
  assert.equal(validatedRecord(published,{...proof,rule:'https://example.com'}),false);
  assert.equal(verifiedFinal(spec,rows.filter(x=>x.id!==spec.finalId)),false);
  const altered=rows.map(x=>x.id===spec.finalId?{...x,prize:x.prize+100}:x);
  assert.equal(verifiedFinal(spec,altered),false);
 }
});
