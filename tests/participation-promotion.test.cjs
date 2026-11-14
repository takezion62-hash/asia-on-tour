'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {plan,emptyState,emptyHistory,sameEvidence}=require('../scripts/participation-promotion.cjs');
const rules=require('../tournament-rules.json');
const tournaments=require('../tournaments.json');
const schedule=require('../schedule.json');
const NOW=Date.parse('2026-11-14T09:00:00.000Z');
const windowId='S43_ReloadZBDuosCashCup_Event1Round2_EU';
const key='epicgames_S43_ReloadZBDuosCashCup_EU/'+windowId;
const ids=['0d77cc7e6bda47d48183890d973ec508','25945a39f1564a22aab8ea7808feac98'];
const source='https://www.fortnite.com/competitive/events/S43_ReloadZBDuosCashCup/?region=EU&round='+windowId;
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const raw={id:'auto-s43-83ec104c8e6f',date:'2026-11-14',region:'EU',
  player:'bigsky / Reo',playerRaw:'tzd Ackermanǃ / IGNUM Reo',
  event:'Reload ZB Duos Cash Cup Zero Build',
  round:'Event 1 · Round 2 / 参加確認',kind:'参加確認',
  rank:10,points:174,kills:20,vrs:0,prize:null,matches:6,
  seasonId:'S43',chapter:7,season:5,
  tournamentId:'ch7s5-reload-zero-build-duos-cash-cup',source,verified:true,
  note:'参加データのみ自動照合。通過・賞金・スキン報酬の確定情報なし。',
  reviewOnly:true,reviewReason:'API順位表の本人IDのみ照合',players:['bigsky','Reo'],
  teamAccountIds:ids};
 const publicRow=clone(raw);
 delete publicRow.reviewOnly;
 delete publicRow.reviewReason;
 publicRow.note='管理者が公式順位表と本人を再確認。賞金はまだ未設定。';
 const checkpoint={complete:true,rankingOrderValid:true,nextPage:1,pages:1,
  totalPages:1,lastSeenRank:19,lastSuccessAt:'2026-11-14T05:03:54.426Z',
  proposals:[raw]};
 const context={results:[publicRow],rules,players:{candidates:[
  {name:'bigsky'},{name:'Reo'}]},tournaments,schedule,
  verifiedAccounts:ids.map((id,i)=>({epicAccountId:id,player:['bigsky','Reo'][i],confirmed:true})),
  scanDocs:[{name:'auto-sync-scan.json',data:{windows:{[key]:checkpoint}}}]};
 return {context,raw,publicRow,checkpoint};
}
test('S43 EU 10th place upgrades the SAME published ID to official $0 final',()=>{
 const {context,publicRow}=fixture();
 publicRow.profiles=[{name:'Reo',url:'https://fortnitetracker.com/profile/all/Reo/events?id=25945a39-f156-4a22-aab8-ea7808feac98'}];
 const res=plan(context,emptyState(),emptyHistory(),{now:NOW,batchSize:5});
 assert.deepEqual(res.summary.changedRules,['ch7s5-reload-zero-build-duos-cash-cup']);
 assert.equal(res.summary.promoted,1);
 assert.equal(res.results.length,1);
 const final=res.results[0];
 assert.equal(final.id,publicRow.id);
 assert.equal(final.rank,10);
 assert.equal(final.kills,20);
 assert.equal(final.vrs,0);
 assert.equal(final.kind,'賞金決勝');
 assert.equal(final.round,'Event 1 · Round 2 / 賞金決勝');
 assert.equal(final.prize,0);
 assert.equal(final.prizePerPlayer,0);
 assert.deepEqual(final.profiles,publicRow.profiles);
 assert.deepEqual(final.teamAccountIds,publicRow.teamAccountIds);
 assert.match(final.note,/公式順位表10位/);
 assert.equal(res.history.entries[0].id,publicRow.id);
 assert.equal(res.history.entries[0].before.prize,null);
 assert.equal(res.history.entries[0].after.prize,0);
 // Re-running against updated canonical rows cannot duplicate an already upgraded record.
 const again=plan({...context,results:res.results},res.state,res.history,{now:NOW,batchSize:5});
 assert.equal(again.summary.promoted,0);
 assert.equal(again.results.length,1);
});
test('mutated published score, wrong Epic ID, and unconfirmed roster are held',()=>{
 for(const [name,mutate] of [
  ['changed score',x=>{x.context.results[0].rank=9}],
  ['published reviewOnly',x=>{x.context.results[0].reviewOnly=true}],
  ['changed Epic ID',x=>{x.context.results[0].teamAccountIds[0]='a'.repeat(32)}],
  ['unknown account',x=>{x.context.verifiedAccounts=[]}],
  ['non unique roster',x=>{x.context.results[0].players=['Reo','Reo']}]
 ]){
  const x=fixture();mutate(x);
  const result=plan(x.context,emptyState(),emptyHistory(),{now:NOW});
  assert.equal(result.summary.promoted,0,name);
  assert.equal(result.summary.held,1,name);
  assert.equal(result.results[0].kind,'参加確認',name);
 }
});
test('incomplete official checkpoint or a missing official schedule never awards cash',()=>{
 for(const mutator of [x=>{x.checkpoint.complete=false},
  x=>{x.checkpoint.rankingOrderValid=false},
  x=>{x.context.schedule={sessions:[]}},
  x=>{x.checkpoint.lastSuccessAt='2026-11-13T19:00:00.000Z'},
  x=>{x.checkpoint.proposals=[]}]){
  const x=fixture();mutator(x);
  const result=plan(x.context,emptyState(),emptyHistory(),{now:NOW});
  assert.equal(result.summary.promoted,0);
  assert.equal(result.summary.held,1);
 }
});
test('a second record for the same duo/final blocks in-place promotion',()=>{
 const x=fixture();
 x.context.results.push({...x.publicRow,id:'other-row',
  round:'Event 1 · Round 2 / 賞金決勝',kind:'賞金決勝',prize:0});
 const result=plan(x.context,emptyState(),emptyHistory(),{now:NOW});
 assert.equal(result.summary.promoted,0);
 assert.equal(result.summary.held,1);
 assert.equal(result.results.length,2);
});
test('evaluation is cached by candidate-specific rule and checkpoint; changed evidence retries',()=>{
 const x=fixture();
 x.checkpoint.complete=false;
 const once=plan(x.context,emptyState(),emptyHistory(),{now:NOW});
 assert.equal(once.summary.held,1);
 const twice=plan(x.context,once.state,once.history,{now:NOW});
 assert.equal(twice.summary.processed,0);
 x.checkpoint.complete=true;
 const again=plan(x.context,once.state,once.history,{now:NOW});
 assert.equal(again.summary.promoted,1);
});
test('time-dependent holds retry when proof is mature, but only after a safety window',()=>{
 const x=fixture();
 const early=plan(x.context,emptyState(),emptyHistory(),{
  now:Date.parse('2026-11-13T23:00:00Z')});
 assert.equal(early.summary.promoted,0);
 assert.equal(early.summary.held,1);
 const later=plan(x.context,early.state,early.history,{now:NOW});
 assert.equal(later.summary.promoted,1);
});
test('batch size caps the work; unrelated seven thousand results need no re-verification',()=>{
 const x=fixture();
 const second=clone(x.publicRow),cp=clone(x.checkpoint.proposals[0]);
 second.id='auto-s43-45cdef000001';second.player='C / D';second.players=['C','D'];
 second.playerRaw='C / D';second.rank=11;second.teamAccountIds=['c'.repeat(32),'d'.repeat(32)];
 cp.id=second.id;cp.player=second.player;cp.players=second.players;
 cp.playerRaw=second.playerRaw;cp.rank=11;cp.teamAccountIds=second.teamAccountIds;
 x.context.results.push(second);
 x.context.players.candidates.push({name:'C'},{name:'D'});
 x.context.verifiedAccounts.push({epicAccountId:'c'.repeat(32),player:'C',confirmed:true},
  {epicAccountId:'d'.repeat(32),player:'D',confirmed:true});
 x.checkpoint.proposals.push(cp);
 x.context.results.push({id:'unrelated',kind:'賞金決勝',verified:true,prize:0,seasonId:'S42'});
 const one=plan(x.context,emptyState(),emptyHistory(),{now:NOW,batchSize:1});
 assert.equal(one.summary.eligible,2);
 assert.equal(one.summary.processed,1);
 assert.equal(one.summary.promoted,1);
 assert.equal(one.summary.remaining,1);
 const two=plan({...x.context,results:one.results},one.state,one.history,{now:NOW,batchSize:1});
 assert.equal(two.summary.promoted,1);
 assert.equal(two.results.length,3);
 assert.equal(two.results.find(r=>r.id==='unrelated').kind,'賞金決勝');
});
test('unrelated rule updates do not invalidate an unchanged candidate-specific proof',()=>{
 const x=fixture();x.checkpoint.complete=false;
 const first=plan(x.context,emptyState(),emptyHistory(),{now:NOW});
 x.context.rules=clone(x.context.rules);
 x.context.rules.rules.find(r=>r.id!=='ch7s5-reload-zero-build-duos-cash-cup').unrelatedTestField='irrelevant rule revision';
 const second=plan(x.context,first.state,first.history,{now:NOW});
 assert.equal(second.summary.processed,0);
});
test('stable score comparison permits a new admin note but not changed points',()=>{
 const x=fixture();
 assert.equal(sameEvidence(x.publicRow,x.raw),true);
 x.publicRow.points++;
 assert.equal(sameEvidence(x.publicRow,x.raw),false);
});
