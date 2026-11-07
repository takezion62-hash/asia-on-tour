'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RULES,payout,unrealWindow,sameSession,decide,evaluate}=require('../scripts/automatic-unreal-approval.cjs');
const {selectHistoricalWindows}=require('../scripts/osirion-sync.cjs');
const {prepare}=require('../scripts/auto-sync-core.cjs');
const archive=require('../calendar-history/2025-12.json');
const rule=RULES['ch7s1-one-million-unreal-cup'],full='epicgames_S39_1MillionUnrealCup_OCE',winId='S39_1MillionUnrealCup_OCE';
const session=archive.sessions.find(s=>s.region==='OCE'&&s.eventId==='S39_1MillionUnrealCup');
assert(session,'Official OCE session fixture missing');
const idA='a'.repeat(32),idB='b'.repeat(32);
const win={
 key:full+'/'+winId,fullEventId:full,eventId:'S39_1MillionUnrealCup',windowId:winId,
 tournamentId:rule.id,seasonId:'S39',series:'unreal-cup',region:'OCE',
 dateJst:session.dateJst,kind:'参加確認',round:'単一開催枠 / 参加確認',
 startUtc:session.startUtc,end:Date.parse(session.endUtc)
};
const data=()=>({
 tournaments:{catalog:[{id:rule.id,series:'unreal-cup',seasonId:'S39',team:'duo',
   name:'$1 Million Unreal Cup',chapter:7,season:1,sourceEventIds:['S39_1MillionUnrealCup']}]},
 players:{candidates:[{name:'まいにちフロッパー'},{name:'mint'}]},
 results:[],verifiedAccounts:[
  {player:'まいにちフロッパー',epicAccountId:idA,confirmed:true},
  {player:'mint',epicAccountId:idB,confirmed:true}
 ]
});
function candidate(rank=172){
 const d=data(),p=prepare({entries:[{eventId:win.eventId,windowId:win.windowId,
 teamAccountIds:[idA,idB],rank,points:236,kills:23,vrs:1,matches:10,rawName:'flopper / mint'}]},
 {version:1,accounts:d.verifiedAccounts,windows:[{eventId:win.eventId,windowId:win.windowId,
 dateJst:win.dateJst,region:win.region,seasonId:win.seasonId,tournamentId:win.tournamentId,
 kind:win.kind,round:win.round}]},d);
 assert.equal(p.proposals.length,1);
 const row=p.proposals[0];
 const cp={nextPage:2,totalPages:2,complete:true,rankingOrderValid:true,
  epicIdsRetained:true,proposals:[row],lastSeenRank:999};
 return {d,row,cp};
}
test('exact official prize tiers: OCE 172nd is $100 team/$50 each; beyond 250 is $0',()=>{
 assert.equal(rule.autoApproval,'verified-team-rank');
 assert.deepEqual(payout(rule,'OCE',172),{team:100,perPlayer:50});
 assert.deepEqual(payout(rule,'OCE',1),{team:5000,perPlayer:2500});
 assert.deepEqual(payout(rule,'EU',1500),{team:100,perPlayer:50});
 assert.deepEqual(payout(rule,'EU',2001),{team:0,perPlayer:0});
 assert.deepEqual(payout(rule,'NAC',1201),{team:0,perPlayer:0});
 assert.deepEqual(payout(rule,'ME',90),{team:200,perPlayer:100});
 assert.equal(payout(rule,'OCE',0),null);
 assert.equal(unrealWindow(win).id,rule.id);
 assert.equal(unrealWindow({...win,region:'ASIA'}),null);
 assert.equal(unrealWindow({...win,windowId:'S39_FakeUnrealCup_OCE'}),null);
});
test('verified full Epic leaderboard and both exact IDs publish cash with individual shares',()=>{
 const {d,row,cp}=candidate();
 assert.equal(row.reviewOnly,true);
 assert.deepEqual(row.teamAccountIds,[idA,idB]);
 const approved=decide(row,win,cp,d);
 assert.equal(approved.approved,true);
 const record=approved.record;
 assert.equal(record.prize,100);
 assert.equal(record.prizePerPlayer,50);
 assert.equal(record.kind,'賞金決勝');
 assert.equal(record.round,'Session 1 / 賞金決勝');
 assert.equal(record.reviewOnly,undefined);
 assert.equal(record.teamAccountIds,undefined);
 assert.equal(record.verified,true);
 assert.deepEqual(record.players,['まいにちフロッパー','mint']);
 assert.equal(require('../scripts/data-checks.cjs').personalCents(record),5000);
});
test('fully checked non-prize teams publish zero cash instead of being silently excluded',()=>{
 const {d,row,cp}=candidate(251);
 const x=decide(row,win,cp,d);
 assert.equal(x.approved,true);
 assert.equal(x.record.prize,0);
 assert.equal(x.record.prizePerPlayer,0);
 assert.match(x.record.note,/賞金圏外/);
});
test('partial/incomplete/replayed checkpoints never award cash or zero money',()=>{
 const {d,row,cp}=candidate();
 const invalid=[
 {...cp,complete:false},
 {...cp,nextPage:1},
 {...cp,rankingOrderValid:false},
 {...cp,epicIdsRetained:false},
 {...cp,proposals:[]},
 {...cp,proposals:[{...row,kills:99}]}
 ];
 for(const bad of invalid)assert.equal(decide(row,win,bad,d).approved,false);
});
test('wrong duo identity, fabricated points, incorrect session, date or event all remain held',()=>{
 const {d,row,cp}=candidate();
 const cases=[
 [{...row,teamAccountIds:[idA,idA]},win,cp,d],
 [{...row,teamAccountIds:[idA,'c'.repeat(32)]},win,cp,d],
 [{...row,matches:11},win,{...cp,proposals:[{...row,matches:11}]},d],
 [row,{...win,startUtc:'2025-12-20T09:00:00Z'},cp,d],
 [row,{...win,windowId:'S39_1MillionUnrealCup_OCE_FAKE'},cp,d],
 [row,{...win,kind:'賞金決勝'},cp,d],
 [row,win,cp,{...d,verifiedAccounts:[d.verifiedAccounts[0]]}],
 [row,win,cp,{...d,results:[{...row,id:'manual-row',round:'その他の表記',kind:'賞金獲得'}]}]
 ];
 for(const [r,w,c,db] of cases)assert.equal(decide(r,w,c,db).approved,false);
});
test('duplicate roster order and existing manual records suppress second prize',()=>{
 const {d,row,cp}=candidate();
 assert.equal(sameSession(row,{...row,players:[...row.players].reverse(),player:'mint / まいにちフロッパー'}),true);
 d.results.push({...row,id:'manually-confirmed-prize',kind:'賞金獲得',round:'以前の表記',prize:100,prizePerPlayer:50});
 assert.equal(decide(row,win,cp,d).approved,false);
});
test('batch approvals never double publish the same cash award',()=>{
 const {d,row,cp}=candidate();
 const duplicate={...row,id:'auto-s39-abc123abc123'};
 const found=evaluate([row,duplicate],[win],{[win.key]:{...cp,proposals:[row,duplicate]}},d);
 assert.equal(found.approved.length,1);
 assert.equal(found.held.length,1);
});
test('historical checkpoint from the old review-only era becomes rescan-eligible',()=>{
 const old={version:1,windows:{[win.key]:{complete:true,proposals:[],nextPage:3,totalPages:3}}};
 const chosen=selectHistoricalWindows([win],old,{maxWindowsPerRun:4},Date.now(),[]);
 assert.equal(chosen.length,1);
 assert.equal(chosen[0].key,win.key);
 const fresh={version:1,windows:{[win.key]:{complete:true,epicIdsRetained:true,proposals:[],nextPage:3,totalPages:3}}};
 assert.equal(selectHistoricalWindows([win],fresh,{maxWindowsPerRun:4},Date.now(),[]).length,0);
});

test('very large Unreal regional standings can exceed 100 pages without broadening other cups',async()=>{
 const {getLeaderboard}=require('../scripts/osirion-sync.cjs');
 const original=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({
   success:true,leaderboard:{
     leaderboardEventId:win.fullEventId,leaderboardEventWindowId:win.windowId,
     entries:[],totalPages:175
   }
 })});
 try{
  const response=await getLeaderboard(win,0);
  assert.equal(response.totalPages,175);
  await assert.rejects(()=>getLeaderboard({...win,series:'cash-cup'},0),/順位表のID\/形式が不正/);
 }finally{globalThis.fetch=original}
});
