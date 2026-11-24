'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../scripts/tournament-rule-engine.cjs');
const {rules}=require('../tournament-rules.json');
const byId=id=>rules.find(r=>r.id===id);
test('every registered cutoff and match cap is read without guessing missing fields',()=>{
 for(const r of rules){
  for(const [region,cutoff] of Object.entries(r.advance||{})){
   assert.equal(E.advancementCutoff(r,region),cutoff,r.id);
   assert.equal(E.qualifies(r,region,cutoff),true);
   assert.equal(E.qualifies(r,region,cutoff+1),false);
  }
  for(const [stage,cap] of Object.entries(r.matchCaps||{})){
   assert.equal(E.matchCap(r,stage),cap,r.id);
   assert.equal(E.validMatchCount(r,stage,cap),true);
   assert.equal(E.validMatchCount(r,stage,cap+1),false);
  }
  for(const [region,cutoff] of Object.entries(r.cosmeticRanks||{}))assert.equal(E.cosmeticCutoff(r,region),cutoff);
  assert.equal(E.qualifies(r,'UNKNOWN',1),null);
  assert.equal(E.matchCap(r,'UNKNOWN'),null);
 }
});
test('each official USD rank ladder preserves every payout boundary and unpaid rank',()=>{
 for(const r of rules.filter(r=>r.cashPrizes)){
  const cash=r.cashPrizes;
  for(const [region,tiers] of Object.entries(cash.tiers)){
   let previous=0;
   const get=rank=>cash.basis==='per-team'?E.teamRankPrize(r,region,rank)?.team:E.individualRankPrize(r,region,rank);
   for(const tier of tiers){
    const expected=cash.basis==='per-team'?tier.perTeam:tier.perPlayer;
    assert.equal(get(previous+1),expected,r.id+' '+region);
    assert.equal(get(tier.through),expected);
    if(cash.basis==='per-team')assert.equal(E.teamRankPrize(r,region,tier.through).perPlayer,expected/cash.teamSize);
    previous=tier.through;
   }
   assert.equal(get(previous+1),0);
   assert.equal(E.payingRank(r,region,cash.basis),previous);
  }
 }
});
test('VR cash does not infer amounts or convert cosmetics into dollars',()=>{
 for(const r of rules.filter(r=>r.prizePerVictory)){
  assert.equal(E.individualVrPrize(r,0),0);
  assert.equal(E.individualVrPrize(r,2),2*r.prizePerVictory);
 }
 assert.equal(E.individualVrPrize({},1),null);
 assert.equal(E.individualVrPrize({},0),null);
 assert.equal(E.individualVrPrize({},0,{allowUnknownZero:true}),0);
 assert.equal(E.individualVrPrize({prizePerVictory:100},-1),null);
});
test('invalid ranks, missing regions, wrong currency, malformed tiers and wrong basis fail closed',()=>{
 const r=byId('ch7s5-trios-cash-cup'),copy=()=>JSON.parse(JSON.stringify(r));
 assert.equal(E.individualRankPrize(r,'OCE',0),null);
 assert.equal(E.individualRankPrize(r,'UNKNOWN',1),null);
 assert.equal(E.teamRankPrize(r,'OCE',1),null);
 for(const mutate of [
  x=>x.cashPrizes.currency='JPY',
  x=>x.cashPrizes.tiers.OCE=[],
  x=>x.cashPrizes.tiers.OCE[0].perPlayer=-1,
  x=>x.cashPrizes.tiers.OCE[1].through=x.cashPrizes.tiers.OCE[0].through,
  x=>delete x.cashPrizes.tiers.OCE[0].perPlayer
 ]){
  const x=copy();mutate(x);assert.equal(E.individualRankPrize(x,'OCE',100),null);
 }
 const team=JSON.parse(JSON.stringify(byId('ch7s1-one-million-unreal-cup')));
 team.cashPrizes.teamSize=3;assert.equal(E.teamRankPrize(team,'OCE',1),null);
 assert.equal(E.advancementCutoff({advance:{EU:0}},'EU'),null);
 assert.equal(E.validMatchCount({},'予選',1),false);
});
test('named qualifier/final cannot mix modes, seasons or windows',()=>{
 for(const r of rules.filter(r=>r.series==='playstation-cup')){
  const eventId=r.eventIds[0],w={eventId,seasonId:r.seasonId,tournamentId:r.id,series:r.series,region:'OCE'};
  for(const [label,stage] of [['Qualifier','予選'],['Final','賞金決勝']]){
   const win={...w,windowId:eventId+'_'+label+'_OCE',round:label+' / 参加確認'};
   assert.deepEqual(E.namedRound(r,win),{label,stage});
   assert.equal(E.namedRound(r,{...win,seasonId:'S42'}),null);
   assert.equal(E.namedRound(r,{...win,region:'EU'}),null);
   assert.equal(E.namedRound(r,{...win,eventId:'S43_FAKE'}),null);
   assert.equal(E.namedRound(r,{...win,round:'wrong'}),null);
  }
 }
});
