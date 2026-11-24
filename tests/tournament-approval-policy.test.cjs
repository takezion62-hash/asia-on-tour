'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {rules}=require('../tournament-rules.json');
const P=require('../scripts/tournament-approval-policy.cjs');
const {runApprovals}=require('../scripts/tournament-approval-router.cjs');
const get=id=>rules.find(r=>r.id===id);
const old={
 verified:r=>r.series==='victory-cup',
 cosmetic:r=>r.series==='skin-cup',
 cash:r=>r.series==='cash-cup'&&(r.autoApproval==='verified-team-rank'||r.cashFinalAutoApproval==='verified-duo-round2-rank'),
 performance:r=>r.series==='performance-evaluation'&&r.autoApproval==='verified-performance-vr',
 unreal:r=>r.series==='unreal-cup'&&r.autoApproval==='verified-team-rank',
 nvidia:r=>r.series==='nvidia-cup'&&r.autoApproval==='verified-solo-rank',
 duo:r=>r.autoApproval==='verified-duo-qualifier-only',
 playstation:r=>r.series==='playstation-cup'&&r.autoApproval==='verified-playstation-solo'
};
test('all official rules preserve old route selection; unknown and review-only are denied',()=>{
 for(const p of P.POLICIES)assert.deepEqual(Object.keys(P.selectRules(p.id)).sort(),rules.filter(old[p.id]).map(r=>r.id).sort(),p.id);
 assert.deepEqual(P.policyIds(get('ch7s5-reload-zero-build-duos-cash-cup')),['cash','duo']);
 assert.deepEqual(P.policyIds(get('ch7s1-solo-series-finals')),[]);
 for(const r of [{series:'cash-cup',team:'solo',autoApproval:'unknown'},{series:'unknown',team:'solo',autoApproval:'verified-team-rank'},{series:'cash-cup',team:'duo',autoApproval:'review-only',cashFinalAutoApproval:'verified-duo-round2-rank'},{series:'skin-cup',team:'unknown'}])
  assert.deepEqual(P.policyIds(r),[]);
});
function win(r,body,region='OCE',kind='参加確認'){
 const eventId=r.eventIds[0],prefix=r.windowIdPrefix??eventId;
 return {eventId,tournamentId:r.id,series:r.series,seasonId:r.seasonId,region,kind,windowId:prefix+(body?'_'+body:'')+'_'+region};
}
test('official formats cannot mix IDs, region, season, or stages',()=>{
 const cash=get('ch7s5-trios-cash-cup'),duo=get('ch7s5-reload-zero-build-duos-cash-cup'),perf=get('ch7s5-performance-evaluation-trios'),nv=get('ch7s1-nvidia-geforce-rtx-cup');
 assert.deepEqual(P.eventWindow(cash,win(cash,'Event2'),{format:'event'}),{event:2});
 assert.deepEqual(P.eventWindow(duo,win(duo,'Event3Round1'),{rounds:[1]}),{event:3,round:1});
 assert.equal(P.eventWindow(duo,win(duo,'Event3Round2'),{rounds:[1]}),null);
 assert.deepEqual(P.eventWindow(duo,win(duo,'Event3_Round1'),{rounds:[1],optionalSeparator:true}),{event:3,round:1});
 assert.equal(P.eventWindow(duo,win(duo,'Event3_Round2'),{rounds:[2]}),null);
 assert.deepEqual(P.eventWindow(perf,win(perf,'Event2Round2','EU')),{event:2,round:2});
 assert.deepEqual(P.eventWindow(nv,win(nv,''),{format:'single'}),{stage:'single'});
 for(const bad of [{eventId:'S43_FAKE'},{seasonId:'S42'},{series:'skin-cup'},{tournamentId:'wrong'},{region:'ASIA'},{region:'EU'},{kind:'予選'},{windowId:'S43_TriosCashCup_Event02_OCE'},{windowId:'S43_TriosCashCup_Event2Round1_OCE'}])
  assert.equal(P.eventWindow(cash,{...win(cash,'Event2'),...bad},{format:'event'}),null);
 const br=get('ch7s5-playstation-cup-battle-royale'),zb=get('ch7s5-playstation-cup-zero-build');
 assert.equal(P.matchesWindow(br,win(br,'Qualifier'),'参加確認'),true);
 assert.equal(P.matchesWindow(br,win(zb,'Qualifier'),'参加確認'),false);
});
test('router keeps old order, flags, snapshots, review reasons and narrow participation grant',()=>{
 const all=Object.fromEntries(P.POLICIES.map(p=>[p.flag,true]));
 const order=[],pending=[{id:'candidate'}],windows=[],cp={},data={results:[{id:'prior'}]};
 const load=p=>({evaluate(rows,w,c,snapshot){
  assert.equal(rows,pending);assert.equal(w,windows);assert.equal(c,cp);
  assert.deepEqual(snapshot.results.map(x=>x.id),['prior',...order]);
  order.push(p.id);
  return {approved:[{id:p.id,kind:'参加確認',verified:true,prize:0}],held:[{id:'same',reason:p.id}],participationIds:[p.id]};
 }});
 const result=runApprovals(pending,windows,cp,data,all,{historical:true,load});
 assert.deepEqual(order,P.POLICIES.map(p=>p.id));
 assert.deepEqual(result.approved.map(r=>r.id),order);
 assert.deepEqual([...result.verifiedParticipationIds],['verified','playstation']);
 assert.equal(result.reasons.has('same'),false);
 assert.deepEqual(data.results,[{id:'prior'}]);
 order.length=0;
 runApprovals(pending,windows,cp,data,all,{historical:false,load});
 assert.deepEqual(order,P.POLICIES.filter(p=>!p.historicalOnly).map(p=>p.id));
 assert.deepEqual(runApprovals([],[],{},data,{autoApproveCash:'true'},{load:()=>{throw Error('disabled route')}}).approved,[]);
 const cosmetic=runApprovals([],[],{},data,{autoApproveCosmetic:true},{initialReasons:new Map([['same','existing']]),load:()=>({evaluate:()=>({approved:[],held:[{id:'same',reason:'cosmetic'}]})})});
 assert.equal(cosmetic.reasons.get('same'),'existing');
});
test('real adapters deny unknown candidates without checkpoints',()=>{
 const all=Object.fromEntries(P.POLICIES.map(p=>[p.flag,true]));
 const result=runApprovals([{id:'unknown',tournamentId:'unregistered',kind:'参加確認',verified:true,prize:null}],[],{},{results:[],players:{candidates:[]},tournaments:{catalog:[]}},all,{historical:true});
 assert.deepEqual(result.approved,[]);
 assert.equal(result.verifiedParticipationIds.size,0);
});
test('Epic ID retention matches former series and team conditions',()=>{
 for(const r of rules){
  assert.equal(P.requiresCheckpointEpicIds(r.series),['unreal-cup','nvidia-cup','playstation-cup'].includes(r.series));
  assert.equal(P.retainsCandidateEpicIds(r.series,r.team),['cash-cup','performance-evaluation','unreal-cup','nvidia-cup','playstation-cup'].includes(r.series)||r.team==='duo');
 }
});

test('unrelated broad evaluators cannot overwrite a victory hold; dual round policy is specific',()=>{
 const squad=get('ch7s5-squads-victory-cup'),duo=get('ch7s5-reload-zero-build-duos-cash-cup');
 const pending=[{id:'squad',tournamentId:squad.id,kind:'予選'},{id:'r1',tournamentId:duo.id,round:'Event 3 · Round 1 / 参加確認'},
  {id:'r2',tournamentId:duo.id,round:'Event 3 · Round 2 / 参加確認'}];
 const config=Object.fromEntries(P.POLICIES.map(p=>[p.flag,true]));
 const data={results:[],tournaments:{catalog:[squad,duo]}};
 const result=runApprovals(pending,[],{},data,config,{historical:true,load:p=>({evaluate:()=>({approved:[],held:pending.map(r=>({id:r.id,reason:p.id}))})})});
 assert.equal(result.reasons.get('squad'),'verified');
 assert.equal(result.reasons.get('r1'),'duo');assert.equal(result.reasons.get('r2'),'cash');
});
