'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {orderWindows,enrollDelta,runDelta,validateState}=require('../scripts/new-player-history-delta.cjs');
const {linkedAccounts}=require('../scripts/osirion-sync.cjs');
const A='a'.repeat(32),B='b'.repeat(32),C='c'.repeat(32);
const account=(id,player)=>({epicAccountId:id,player,confirmed:true});
const win=(id,season,date)=>({key:'epicgames_'+season+'_'+id+'_NAC/'+season+'_'+id+'_Event1Round1_NAC',
 eventId:season+'_'+id,windowId:season+'_'+id+'_Event1Round1_NAC',
 fullEventId:'epicgames_'+season+'_'+id+'_NAC',region:'NAC',dateJst:date,
 seasonId:season,tournamentId:'cup-'+season,kind:'予選',round:'Event 1 · Round 1 / 予選',series:'victory-cup'});
const s43=win('Victory','S43','2026-11-01'),s42=win('Victory','S42','2026-09-04'),s41=win('Victory','S41','2026-06-01');
const all=[s41,s42,s43];
function checkpoint(){return {windows:Object.fromEntries(all.map(w=>[w.key,
 {complete:true,nextPage:2,totalPages:2,pages:2,proposals:[],rankingOrderValid:true}]))}}
function harness(scan,accounts,fetchPage,extra={}){
 return runDelta({scan,accounts,windows:all,now:Date.parse('2026-11-18T08:00:00Z'),fetchPage,
  normalize:(row,w)=>({eventId:w.eventId,windowId:w.windowId,
   teamAccountIds:row.teamAccountIds,rank:row.rank,kills:row.kills,points:row.points,vrs:0,matches:1}),
  previewFor:w=>({eventId:w.eventId}),
  prepare:(feed,preview)=>({proposals:feed.entries.map(x=>({
   id:'candidate-'+preview.eventId+'-'+x.teamAccountIds[0],
   verified:true,tournamentId:'cup-S43',source:'https://www.fortnite.com/competitive/events/test',
   player:x.teamAccountIds[0],rank:x.rank,prize:0,kind:'予選'
  }))}),
  holdFailure:(task,error,w,page,now)=>{
   task.lastError=String(error.message);task.retryAfter=new Date(now+21600000).toISOString();
   return {retryAfter:task.retryAfter,page};
  },
  rateLimitFailure:error=>/HTTP 429/.test(error.message),
  recoverableFailure:error=>/HTTP 429|Malformed original|Unordered Epic/.test(error.message),
  ...extra});
}
test('recent two seasons win priority even when older completed cups exist',()=>{
 assert.deepEqual(orderWindows(all).map(x=>x.seasonId),['S43','S42','S41']);
});
test('first rollout records baseline accounts without fetching every previously completed event',async()=>{
 const state=checkpoint();
 let calls=0;
 const r=await harness(state,[account(A,'Old')],async()=>{calls++;return {entries:[],totalPages:1}});
 assert.equal(r.initialized,true);assert.equal(r.newAccounts,0);
 assert.equal(r.pagesScanned,0);assert.equal(calls,0);
 assert.equal(state.newPlayerBackfill.knownAccountIds.length,1);
 assert.equal(Object.keys(state.newPlayerBackfill.work).length,0);
});
test('two newly confirmed players share one bounded leaderboard recheck, preserving original complete checkpoints',async()=>{
 const state=checkpoint();
 enrollDelta(state,[account(A,'Old')],all,'2026-11-18T07:00:00Z');
 const visits=[];
 const res=await harness(state,[account(A,'Old'),account(B,'NewB'),account(C,'NewC')],
  async (w,page)=>{
   visits.push([w.key,page]);
   return {totalPages:2,entries:page===0?[
    {rank:1,teamAccountIds:[B],points:150,kills:10},
    {rank:2,teamAccountIds:[C],points:140,kills:9},
    {rank:3,teamAccountIds:[A],points:120,kills:4}
   ]:[{rank:50,teamAccountIds:[A],points:40,kills:1}]};
  },{pageBudget:2,windowBudget:2,pagesPerWindow:2});
 assert.equal(res.initialized,false);assert.equal(res.newAccounts,2);
 assert.equal(res.pagesScanned,2);
 assert.equal(res.proposalsFound,2);
 assert.equal(res.windowsCompleted,1);
 assert.equal(res.pendingWindows,2);
 assert.deepEqual(visits,[[s43.key,0],[s43.key,1]]);
 assert.equal(state.windows[s43.key].complete,true);
 assert.equal(state.windows[s43.key].nextPage,2);
 assert.equal(state.windows[s43.key].proposals.length,2);
 assert.deepEqual(state.windows[s43.key].proposals.map(x=>x.player),[B,C]);
 const follow=await harness(state,[account(A,'Old'),account(B,'NewB'),account(C,'NewC')],
  async(w,page)=>({totalPages:1,entries:[{rank:1,teamAccountIds:[B],points:10,kills:0}]}),{pageBudget:1,windowBudget:1,pagesPerWindow:1});
 assert.equal(follow.newAccounts,0);
 assert.equal(follow.pagesScanned,1);
 assert.equal(state.windows[s42.key].complete,true);
 assert.equal(follow.pendingWindows,1);
});
test('later registrants reset only the unfinished window cursor, keeping previously discovered candidates',()=>{
 const state=checkpoint();
 enrollDelta(state,[account(A,'Old')],all,'2026-11-18T07:00:00Z');
 enrollDelta(state,[account(A,'Old'),account(B,'NewB')],all,'2026-11-18T07:10:00Z');
 state.newPlayerBackfill.work[s42.key].nextPage=5;
 state.newPlayerBackfill.work[s42.key].pages=5;
 state.newPlayerBackfill.work[s42.key].lastSeenRank=500;
 const previous={id:'verified-previous'};
 state.windows[s42.key].proposals.push(previous);
 const r=enrollDelta(state,[account(A,'Old'),account(B,'NewB'),account(C,'NewC')],all,'2026-11-18T07:20:00Z');
 assert.equal(r.newAccounts.length,1);
 assert.equal(state.newPlayerBackfill.work[s42.key].nextPage,0);
 assert.deepEqual(state.newPlayerBackfill.work[s42.key].accountIds,[B,C]);
 assert.deepEqual(state.windows[s42.key].proposals,[previous]);
 assert.equal(validateState(state.newPlayerBackfill),state.newPlayerBackfill);
});
test('HTTP 429 stops all delta requests, keeps completed pages and defers the same window',async()=>{
 const state=checkpoint();
 enrollDelta(state,[account(A,'Old')],all,'2026-11-18T07:00:00Z');
 let calls=0;
 const res=await harness(state,[account(A,'Old'),account(B,'NewB')],async()=>{
  calls++;throw Error('Osirion API HTTP 429 /v1/tournaments/leaderboard');
 });
 assert.equal(calls,1);
 assert.equal(res.rateLimited,true);
 assert.equal(res.pagesScanned,0);
 assert.equal(res.heldWindows,1);
 assert.equal(res.pendingWindows,3);
 assert.equal(state.newPlayerBackfill.work[s43.key].nextPage,0);
 assert.equal(state.windows[s43.key].complete,true);
 assert.ok(state.newPlayerBackfill.work[s43.key].retryAfter);
 const blocked=await harness(state,[account(A,'Old'),account(B,'NewB')],async()=>{throw Error('should not fetch held newest cup')},{pageBudget:0});
 assert.equal(blocked.pagesScanned,0);
});
test('empty original first page never counts as completed player recheck',async()=>{
 const scan=checkpoint();
 enrollDelta(scan,[account(A,'Old')],all,'2026-11-18T07:00:00Z');
 let calls=0;
 const stats=await harness(scan,[account(A,'Old'),account(B,'New')],async()=>{
  calls++;return {totalPages:1,entries:[]};
 });
 assert.equal(calls,2,'other completed windows may be visited after malformed response');
 assert.equal(stats.windowsCompleted,0);
 assert.equal(stats.pagesScanned,0);
 assert.equal(stats.heldWindows,2);
 assert.equal(stats.pendingWindows,3);
 assert.equal(scan.windows[s43.key].complete,true);
 assert.equal(scan.newPlayerBackfill.work[s43.key].nextPage,0);
 assert.ok(scan.newPlayerBackfill.work[s43.key].retryAfter);
});
test('only explicitly verified Epic ID or matching Fortnite Tracker URL allows a no-results player to enter scan roster',()=>{
 const uuid='aabbccdd-1234-5678-90ab-cdef12345678';
 const fixed='c'.repeat(32);
 const data={results:[],players:{confirmedAliases:{},candidates:[
  {name:'Explicit',epicAccountVerified:true,epicAccountId:fixed},
  {name:'Tracker',epicAccountVerified:true,trackerProfileUrl:'https://fortnitetracker.com/profile/all/Tracker/events?id='+uuid},
  {name:'NotVerified',epicAccountId:B},
  {name:'BadHost',epicAccountVerified:true,trackerProfileUrl:'https://fake.example/profile/all/Tracker/events?id='+uuid},
  {name:'Mismatched',epicAccountVerified:true,epicAccountId:B,trackerProfileUrl:'https://fortnitetracker.com/profile/all/Mismatched/events?id='+uuid}
 ]}};
 const out=linkedAccounts(data);
 assert.deepEqual(out.accounts.map(x=>x.player).sort(),['Explicit','Tracker']);
 assert.equal(out.conflicts.length,2);
 // Identical direct ID and linked profile URL is allowed for one player.
 data.players.candidates=data.players.candidates.slice(0,1);
 data.players.candidates[0].trackerProfileUrl='https://fortnitetracker.com/profile/all/Explicit/events?id=cccccccc-cccc-cccc-cccc-cccccccccccc';
 assert.equal(linkedAccounts(data).accounts.length,1);
});
