'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const {validateRegistry}=require('../scripts/validate-tournament-rules.cjs');
const {RULES,payout,nvidiaWindow,decide,evaluate,sameSession}=require('../scripts/automatic-nvidia-approval.cjs');
const {applyProposals}=require('../scripts/auto-sync-core.cjs');
const id='ch7s1-nvidia-geforce-rtx-cup',rule=RULES[id];
const archive=read('calendar-history/2025-12.json').sessions.filter(x=>x.eventId==='S39_NvidiaCup');
function fixture(region='NAW',rank=33,points=345){
 const a=archive.find(x=>x.region===region);
 if(!a)throw Error('official session archive missing: '+region);
 const win={key:a.id,fullEventId:'epicgames_S39_NvidiaCup_'+region,eventId:'S39_NvidiaCup',
  windowId:a.sourceWindowId,region,dateJst:a.dateJst,startUtc:a.startUtc,
  end:Date.parse(a.endUtc),seasonId:'S39',tournamentId:id,series:'nvidia-cup',
  kind:'参加確認',round:'単一開催枠 / 参加確認'};
 const row={id:'auto-s39-abcdef123456',event:'NVIDIA GeForce RTX Cup',
  date:win.dateJst,region,seasonId:'S39',chapter:7,season:1,
  tournamentId:id,player:'DemoPlayer',players:['DemoPlayer'],
  teamAccountIds:['a'.repeat(32)],rank,points,matches:10,kills:7,vrs:1,
  prize:null,verified:true,reviewOnly:true,reviewReason:'official cash check',
  kind:'参加確認',round:win.round,
  source:'https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region='+region+'&round='+win.windowId};
 const cp={complete:true,rankingOrderValid:true,pages:2,nextPage:2,totalPages:2,
  proposals:[{...row,reviewReason:undefined}],lastSuccessAt:new Date(win.end+5*3600000).toISOString()};
 // The history triage layer adds reviewReason after saving the otherwise unchanged row.
 delete cp.proposals[0].reviewReason;
 const data={results:[],players:{candidates:[{name:'DemoPlayer'}]},
  tournaments:read('tournaments.json'),verifiedAccounts:[{player:'DemoPlayer',epicAccountId:'a'.repeat(32),confirmed:true}],
  updates:{version:1,entries:[]}};
 return {win,row,cp,data,now:win.end+6*3600000};
}
test('all seven regional payout ladders and ranking boundaries use official USD per-player cash',()=>{
 assert.ok(rule);assert.equal(rule.autoApproval,'verified-team-rank');
 assert.equal(Object.keys(rule.cashPrizes.tiers).length,7);
 for(const [region,winner,last] of [['EU',4000,100],['NAC',2500,75],
  ['NAW',1000,40],['OCE',1000,40],['BR',1000,40],['ME',1000,40],['ASIA',1000,40]]){
  assert.equal(payout(rule,region,1),winner);
  assert.equal(payout(rule,region,last),100,region+' cash last rank');
  assert.equal(payout(rule,region,last+1),0,region+' out-of-money');
  assert.equal(payout(rule,region,0),null);
 }
 assert.deepEqual([payout(rule,'EU',10),payout(rule,'EU',11),payout(rule,'EU',21),
  payout(rule,'EU',31),payout(rule,'EU',51),payout(rule,'EU',76)],[600,500,400,300,200,100]);
 assert.deepEqual([payout(rule,'NAC',10),payout(rule,'NAC',11),payout(rule,'NAC',21),payout(rule,'NAC',31),payout(rule,'NAC',51)],[300,250,200,150,100]);
 assert.equal(payout(rule,'NAW',10),200);
 assert.equal(payout(rule,'NAW',11),150);
 assert.equal(payout(rule,'NAW',25),150);
 assert.equal(payout(rule,'NAW',26),100);
 assert.equal(payout(rule,'NAW',41),0);
});
test('the official rules registry enforces real Gold / 350 / 14-in-180, GPU, cosmetic and no invented scoring',()=>{
 const doc=read('tournament-rules.json'),cat=read('tournaments.json');
 assert.deepEqual(validateRegistry(doc,cat),[]);
 assert.equal(rule.participation.minPriorEpicTournaments,14);
 assert.equal(rule.participation.priorTournamentWindowDays,180);
 assert.equal(rule.participation.minimumAccountLevel,350);
 assert.equal(rule.rankedEligibility.minimumRank,'Gold');
 assert.equal(rule.scoring.source,'in-game');
 assert.equal(rule.scoring.placementPoints,null);
 assert.equal(rule.scoring.eliminationPoints,null);
 assert.equal(rule.hardwarePrizes.approxRetailValueUSD,999.99);
 assert.equal(rule.hardwarePrizes.cashEquivalent,false);
 assert.equal(rule.cosmeticReward.minimumPoints,8);
 assert.equal(rule.cosmeticReward.cashEquivalent,false);
 for(const change of [
  x=>{x.cashPrizes.tiers.NAC[2].perPlayer=1200},
  x=>{x.hardwarePrizes.topRanks.EU=3},
  x=>{x.cosmeticReward.minimumPoints=10},
  x=>{x.participation.minPriorEpicTournaments=13},
  x=>{x.scoring.eliminationPoints=1}
 ]){
  const modified=JSON.parse(JSON.stringify(doc)),item=modified.rules.find(x=>x.id===id);
  change(item);
  assert.ok(validateRegistry(modified,cat).some(msg=>msg.includes(id)),'rule tampering must fail');
 }
});
test('complete original NAW leaderboard with confirmed Epic account publishes cash rank, and zero cash rank',()=>{
 const {win,row,cp,data,now}=fixture();
 assert.equal(nvidiaWindow(win),rule);
 const a=decide(row,win,cp,data,now);
 assert.equal(a.approved,true,a.reason);
 assert.equal(a.record.prize,100);assert.equal(a.record.prizePerPlayer,100);
 assert.equal(a.record.kind,'賞金決勝');
 assert.equal(a.record.round,'Session 1 / 賞金決勝');
 assert.equal(a.record.teamAccountIds,undefined);
 assert.equal(a.record.reviewOnly,undefined);
 assert.match(a.record.note,/Rust Bucket/);
 assert.ok(!a.record.note.includes('$999.99'),'GPU retail price cannot become cash');
 assert.equal(applyProposals(data,[a.record],'2026-11-19T09:00:00Z'),1);
 assert.equal(data.results[0].prize,100);
 const d=fixture('NAW',41,7);
 const result=decide(d.row,d.win,d.cp,d.data,d.now);
 assert.equal(result.approved,true,result.reason);
 assert.equal(result.record.prize,0);
 assert.equal(result.record.prizePerPlayer,0);
 assert.match(result.record.note,/8pt条件は未達/);
});
test('EU/NAC special rewards and other-region hardware eligibility are informational only',()=>{
 for(const [region,rank,cash,gpu] of [['EU',4,1500,true],['EU',5,1250,false],
  ['NAC',3,1250,true],['NAC',4,1000,false],
  ['NAW',1,1000,true],['NAW',2,750,false],
  ['OCE',1,1000,true],['BR',2,750,false]]){
  const x=fixture(region,rank,8),o=decide(x.row,x.win,x.cp,x.data,x.now);
  assert.equal(o.approved,true,region+' '+rank+': '+o.reason);
  assert.equal(o.record.prize,cash);
  assert.equal(o.record.note.includes('GPU賞対象順位'),gpu);
  assert.equal(o.record.note.includes('Rust Bucket対象条件'),true);
 }
});
test('never auto-publish without complete ranked Epic pages, exact ID/session, valid score and no duplicate',()=>{
 const base=fixture();
 const rejected=[
  {cp:{...base.cp,complete:false}},
  {cp:{...base.cp,rankingOrderValid:false}},
  {cp:{...base.cp,pages:1,nextPage:1}},
  {cp:{...base.cp,lastSuccessAt:new Date(base.win.end-1000).toISOString()}},
  {data:{...base.data,verifiedAccounts:[]}},
  {data:{...base.data,results:[{...base.row,kind:'賞金決勝'}]}},
  {row:{...base.row,teamAccountIds:['b'.repeat(32)]}},
  {row:{...base.row,rank:0}},
  {row:{...base.row,matches:11}},
  {row:{...base.row,vrs:11}},
  {row:{...base.row,verified:false}},
  {row:{...base.row,prize:0}},
  {row:{...base.row,source:'https://example.org'}},
  {win:{...base.win,windowId:'S39_NvidiaCup_EU'}},
  {win:{...base.win,startUtc:'2025-12-20T00:00:00Z'}},
  {now:base.win.end+1}
 ];
 for(let i=0;i<rejected.length;i++){
  const item={...base,...rejected[i]};
  const out=decide(item.row,item.win,item.cp,item.data,item.now);
  assert.equal(out.approved,false,'dangerous case '+i+' should stay held');
 }
 const w={...base.win,region:'ASIA',windowId:'S39_NvidiaCup_ASIA'};
 assert.equal(nvidiaWindow(w),null,'external-region database never invents an ASIA export');
});
test('batch repeats cannot create duplicate same-session award',()=>{
 const first=fixture(),second={...first.row,id:'auto-s39-123456abcdef'};
 const cp={...first.cp,proposals:[first.row,second]};
 const result=evaluate([first.row,second],[first.win],{[first.win.key]:cp},first.data);
 assert.equal(result.approved.length,1);
 assert.equal(result.held.length,1);
 assert.equal(result.approved[0].prize,100);
 assert.equal(sameSession(first.row,second),true);
});
test('NVIDIA series is discovered and the rules page renders cash, GPU and cosmetic separately',()=>{
 const history=read('history-sync-config.json'),recent=read('auto-sync-config.json');
 assert.equal(history.autoApproveNvidia,true);
 assert.ok(history.reviewSeries.includes('nvidia-cup'));
 assert.equal(recent.autoApproveNvidia,true);
 assert.ok(recent.reviewSeries.includes('nvidia-cup'));
 const sync=fs.readFileSync(path.join(ROOT,'scripts/osirion-sync.cjs'),'utf8');
 const ui=fs.readFileSync(path.join(ROOT,'source-rules.js'),'utf8');
 assert.ok(sync.includes('evaluateNvidia('));
 assert.ok(sync.includes('nvidiaWindow(w)'));
 assert.ok(ui.includes('function nvidiaMarkup(rule)'));
 assert.ok(ui.includes('nvidiaMarkup(rule):rule?.series'));
 assert.ok(ui.includes("'ASIA'"));
});
