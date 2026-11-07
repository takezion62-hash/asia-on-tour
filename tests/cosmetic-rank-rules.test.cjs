'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {evaluate,CUT_OFFS,RULE_URL}=require('../scripts/cosmetic-rank-rules.cjs');
const make=(region='ME',tournamentId='ch7s5-one-piece-zoro-cup-battle-royale',rank=50)=>{
 const id=CUT_OFFS[tournamentId].eventId;
 return {tournamentId,region,rank,seasonId:'S43',chapter:7,season:5,
  kind:'参加確認',verified:true,matches:8,kills:8,vrs:1,
  source:'https://www.fortnite.com/competitive/events/'+id+'/?region='+region+'&round='+id+'_'+region};
};
test('ゾロBRの地域別獲得ラインは上位50などの公式順位を使う',()=>{
 for(const region of ['OCE','ME','EU','BR','NAC','NAW']){
  const cutoff=CUT_OFFS['ch7s5-one-piece-zoro-cup-battle-royale'].ranks[region];
  assert.equal(evaluate(make(region,undefined,cutoff)).eligible,true);
  assert.equal(evaluate(make(region,undefined,cutoff+1)).eligible,false);
 }
});
test('ゾロモバイルはEU200、ME30、他地域も公式順位ラインを厳守',()=>{
 const mobile='ch7s5-one-piece-zoro-mobile-cup';
 for(const [region,cutoff] of Object.entries(CUT_OFFS[mobile].ranks)){
  assert.equal(evaluate(make(region,mobile,cutoff)).eligible,true);
  assert.equal(evaluate(make(region,mobile,cutoff+1)).eligible,false);
 }
});
test('別イベント・未確認順位・本人未確認の報酬を確定しない',()=>{
 const r=make();
 assert.equal(evaluate({...r,verified:false}).eligible,false);
 assert.equal(evaluate({...r,rank:null}).eligible,false);
 assert.equal(evaluate({...r,source:r.source.replace('region=ME','region=EU')}).eligible,false);
 assert.equal(evaluate({...r,tournamentId:'unknown'}).eligible,false);
 assert.equal(evaluate({...r,matches:0}).eligible,false);
 assert.match(RULE_URL,/fortnite\.com/);
});
