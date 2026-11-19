'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RULES,payout,nvidiaWindow,sameSession,decide,evaluate}=require('../scripts/automatic-nvidia-approval.cjs');
const {prepare}=require('../scripts/auto-sync-core.cjs');
const {validateRegistry}=require('../scripts/validate-tournament-rules.cjs');
const registry=require('../tournament-rules.json'),catalog=require('../tournaments.json');
const archive=require('../calendar-history/2025-12.json').sessions;
const rule=RULES['ch7s1-nvidia-geforce-rtx-cup'];
const session=archive.find(s=>s.eventId==='S39_NvidiaCup'&&s.region==='NAW');
assert(session,'NAW official event session missing');
const account='a'.repeat(32);
const win={
 key:'epicgames_S39_NvidiaCup_NAW/S39_NvidiaCup_NAW',
 fullEventId:'epicgames_S39_NvidiaCup_NAW',eventId:'S39_NvidiaCup',
 windowId:'S39_NvidiaCup_NAW',tournamentId:rule.id,seasonId:'S39',
 series:'nvidia-cup',region:'NAW',dateJst:session.dateJst,
 kind:'参加確認',round:'単一開催枠 / 参加確認',
 startUtc:session.startUtc,end:Date.parse(session.endUtc)
};
const data=()=>({
 tournaments:{catalog:[{id:rule.id,name:'NVIDIA GeForce RTX Cup',
  seasonId:'S39',series:'nvidia-cup',team:'solo',chapter:7,season:1,
  sourceEventIds:['S39_NvidiaCup']}]},
 players:{candidates:[{name:'確認済みソロ選手'}]},
 verifiedAccounts:[{player:'確認済みソロ選手',epicAccountId:account,confirmed:true}],
 results:[]
});
function candidate(rank=33){
 const d=data();
 const result=prepare({entries:[{eventId:win.eventId,windowId:win.windowId,
  teamAccountIds:[account],rank,points:345,kills:7,vrs:0,matches:9,rawName:'verified-solo'}]},
 {version:1,accounts:d.verifiedAccounts,windows:[{eventId:win.eventId,windowId:win.windowId,
  dateJst:win.dateJst,region:win.region,seasonId:win.seasonId,
  tournamentId:win.tournamentId,kind:win.kind,round:win.round}]},d);
 assert.equal(result.proposals.length,1);
 const row=result.proposals[0];
 const cp={nextPage:2,totalPages:2,complete:true,rankingOrderValid:true,
  epicIdsRetained:true,proposals:[row]};
 return {d,row,cp};
}
test('official NVIDIA rank table pays six regions and full NAW cutoff',()=>{
 assert.equal(rule.autoApproval,'verified-solo-rank');
 assert.equal(payout(rule,'NAW',33),100);
 assert.equal(payout(rule,'NAW',40),100);
 assert.equal(payout(rule,'NAW',41),0);
 assert.equal(payout(rule,'EU',1),4000);
 assert.equal(payout(rule,'EU',100),100);
 assert.equal(payout(rule,'EU',101),0);
 assert.equal(payout(rule,'NAC',75),100);
 assert.equal(payout(rule,'NAC',76),0);
 assert.equal(payout(rule,'ASIA',25),150);
 assert.equal(payout(rule,'NAC',0),null);
 assert.equal(nvidiaWindow(win).id,rule.id);
 assert.equal(nvidiaWindow({...win,region:'ASIA'}),null);
 assert.equal(nvidiaWindow({...win,windowId:'S39_Fake_NAW'}),null);
 assert.equal(validateRegistry(registry,catalog).length,0);
});
test('full verified NAW leaderboard publishes official individual payout',()=>{
 const {d,row,cp}=candidate();
 assert.equal(row.reviewOnly,true);
 assert.deepEqual(row.teamAccountIds,[account]);
 const decision=decide(row,win,cp,d);
 assert.equal(decision.approved,true,decision.reason);
 assert.equal(decision.record.prize,100);
 assert.equal(decision.record.kind,'賞金決勝');
 assert.equal(decision.record.reviewOnly,undefined);
 assert.equal(decision.record.teamAccountIds,undefined);
 assert.match(decision.record.note,/支払完了は未確認/);
 assert.deepEqual(evaluate([row],[win],{[win.key]:cp},d).approved.map(x=>x.id),[row.id]);
});
test('non-prize ranked solo player is safely published as cash $0',()=>{
 const {d,row,cp}=candidate(41);
 const decision=decide(row,win,cp,d);
 assert.equal(decision.approved,true,decision.reason);
 assert.equal(decision.record.prize,0);
 assert.match(decision.record.note,/現金\$0/);
});
test('partial, changed, or missing Epic-ID snapshots never publish',()=>{
 const {d,row,cp}=candidate();
 for(const invalid of [
  {...cp,complete:false},{...cp,rankingOrderValid:false},{...cp,epicIdsRetained:false},
  {...cp,nextPage:1},{...cp,proposals:[]},{...cp,proposals:[{...row,points:9}]}
 ])assert.equal(decide(row,win,invalid,d).approved,false);
});
test('wrong identity, session, source and previously published ranks stay held',()=>{
 const {d,row,cp}=candidate();
 for(const [r,w,c,extra] of [
  [{...row,teamAccountIds:['b'.repeat(32)]},win,cp,d],
  [row,{...win,dateJst:'2025-12-21'},cp,d],
  [row,{...win,startUtc:'2025-12-20T00:00:00.000Z'},cp,d],
  [{...row,source:'https://example.com/hacked'},win,cp,d],
  [row,win,cp,{...d,verifiedAccounts:[]}],
  [row,win,cp,{...d,results:[{...row,kind:'賞金決勝',prize:100,reviewOnly:undefined}]}],
  [row,win,cp,{...d,results:[{...row,id:'old-result',player:'別選手',rank:row.rank,reviewOnly:undefined,prize:100}]}]
 ])assert.equal(decide(r,w,c,extra).approved,false);
 assert.equal(sameSession({tournamentId:rule.id,date:win.dateJst,region:'NAW',player:'A',rank:4},
 {tournamentId:rule.id,date:win.dateJst,region:'NAW',player:'A',rank:9}),true);
});
test('modified official payout or hardware cutoffs fail rule registry validation',()=>{
 const modified=structuredClone(registry);
 const target=modified.rules.find(r=>r.id===rule.id);
 target.cashPrizes.tiers.NAW[0].perPlayer=9999;
 target.hardwarePrizes.rankCutoffs.EU=1;
 const errors=validateRegistry(modified,catalog).join('\n');
 assert.match(errors,/賞金表/);
 assert.match(errors,/RTX 5080/);
});
