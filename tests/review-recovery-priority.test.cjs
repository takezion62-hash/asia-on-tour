'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sourceWindow,recoveryShortlist,REVIEW_REASON}=
 require('../scripts/review-recovery-priority.cjs');
const {selectHistoricalWindows}=require('../scripts/osirion-sync.cjs');
const now=Date.parse('2026-11-16T03:30:00Z');
const EVENT='S30_SoloZBVictoryCashCup',REGION='NAC';
function fixture(tag,{date='2024-06-04',region=REGION,kind='賞金決勝',round='Event1Round2'}={}){
 const seasonId='S30',windowId=EVENT+'_'+round+'_'+region;
 const key='epicgames_'+EVENT+'_'+region+'/'+windowId;
 const window={key,windowId,seasonId,region,dateJst:date,
  tournamentId:'test-recovery-victory',series:'victory-cup',
  kind,end:Date.parse(date+'T12:00:00Z')};
 const row={id:tag,seasonId,region,date,kind,verified:true,reviewReason:REVIEW_REASON,
  source:'https://www.fortnite.com/competitive/events/'+EVENT+'/?region='+region+'&round='+windowId,
  rank:60,points:115,kills:11,vrs:1,matches:3,prize:null,player:'A',playerRaw:'A'};
 return {window,row};
}
function checkpoint(rows,{nextPage=30,totalPages=42,error=false,retryAfter=null}={}){
 return {nextPage,pages:nextPage,totalPages,complete:false,rankingOrderValid:true,
  lastSeenRank:nextPage*100,proposals:rows.map(({reviewReason,...r})=>r),
  ...(error?{lastErrorCode:'OSIRION_TRANSIENT'}:{}),
  ...(retryAfter?{retryAfter}:{})};
}
test('only exact official Epic round and source ID can prioritize a review',()=>{
 const {window,row}=fixture('candidate');
 assert.equal(sourceWindow(row),window.key);
 const state={windows:{[window.key]:checkpoint([row])}};
 const plan=recoveryShortlist([window],state,[row],[],{now,perWindowCap:12});
 assert.equal(plan.length,1);
 assert.equal(plan[0].candidateCount,1);
 for(const changed of [
  {...row,rank:61},{...row,points:116},
  {...row,source:'https://attacker.example/competitive/events/'+EVENT+'/?region=NAC&round='+window.windowId},
  {...row,source:row.source+'&extra=1'},
  {...row,reviewReason:'確認専用大会は自動承認不可'},
  {...row,verified:false},{...row,id:'different'}]){
  assert.equal(recoveryShortlist([window],state,[changed],[],{now}).length,0,
   'changed/forged proof cannot influence scan order');
 }
 assert.equal(recoveryShortlist([window],state,[row],[{id:row.id}],{now}).length,0,
  'published record is never re-queued for scanning');
});
test('finishable boards and unconfirmed finals with multiple IDs receive more scan priority',()=>{
 const a=fixture('near',{round:'Event1Round2'});
 const b=fixture('far',{round:'Event2Round2'});
 const c=fixture('far2',{round:'Event2Round2'});
 const d=fixture('unknown',{round:'Event3Round1',kind:'予選'});
 const state={windows:{
  [a.window.key]:checkpoint([a.row],{nextPage:33,totalPages:40}),
  [b.window.key]:checkpoint([b.row,c.row],{nextPage:15,totalPages:60}),
  [d.window.key]:checkpoint([d.row],{nextPage:7,totalPages:60})
 }};
 const plan=recoveryShortlist([d.window,b.window,a.window],state,
  [d.row,b.row,c.row,a.row],[],{now,perWindowCap:12});
 assert.equal(plan.length,3);
 assert.equal(plan[0].windowKey,a.window.key,'seven pages left beats long scans');
 assert.equal(plan[0].finishable,true);
 assert.equal(plan[1].windowKey,b.window.key,'two unconfirmed award candidates beat a low-impact round');
 assert.equal(plan[1].cashCandidates,2);
 assert.equal(plan[1].candidateCount,2);
 assert.equal(plan[2].cashCandidates,0);
});
test('deferred, corrupt and unstarted checkpoints cannot consume candidate recovery slots',()=>{
 const a=fixture('a',{round:'Event1Round2'});
 const good=checkpoint([a.row],{nextPage:30,totalPages:42});
 const invalids=[
  {...good,retryAfter:'2026-11-17T00:00:00Z'},
  {...good,lastErrorCode:'OSIRION_TRANSIENT'},
  {...good,rankingOrderValid:false},
  {...good,nextPage:0},
  {...good,totalPages:30},
  {...good,lastSeenRank:3},
  {...good,proposals:[]},
  {...good,complete:true}
 ];
 for(const bad of invalids)
  assert.deepEqual(recoveryShortlist([a.window],{windows:{[a.window.key]:bad}},
   [a.row],[],{now}),[]);
});
test('bounded candidate recovery preserves historical year slots, retry and unstarted quota',()=>{
 const base=['2024','2025','2026'].flatMap(y=>['victory-cup','cash-cup'].map(series=>({
  key:y+series,dateJst:y+'-06-01',region:'ME',series,
  end:Date.parse(y+'-06-01'),kind:'参加確認',tournamentId:'unknown'})));
 const recovered=[fixture('one',{round:'Event1Round2'}),fixture('two',{round:'Event2Round2'})];
 const candidates=[...base,...recovered.map(x=>x.window)];
 const state={windows:Object.fromEntries(recovered.map(x=>[x.window.key,checkpoint([x.row],{nextPage:35,totalPages:42})]))};
 const chosen=selectHistoricalWindows(candidates,state,{
  maxWindowsPerRun:8,minUnstartedWindowsPerRun:2,
  maxPagesPerWindowPerRun:12,
  reviewRecovery:{enabled:true,maxWindows:4}
 },now,[],recovered.map(x=>x.row));
 assert.equal(chosen.length,8);
 assert.ok(chosen.some(w=>w.key===recovered[0].window.key));
 assert.ok(chosen.some(w=>w.key===recovered[1].window.key));
 const unstarted=chosen.filter(w=>!state.windows[w.key]?.nextPage);
 assert.ok(unstarted.length>=2);
 assert.ok(chosen.some(w=>w.dateJst.startsWith('2025')));
 assert.ok(chosen.some(w=>w.dateJst.startsWith('2026')));
 const off=selectHistoricalWindows(candidates,state,{
  maxWindowsPerRun:8,minUnstartedWindowsPerRun:2,
  reviewRecovery:{enabled:false,maxWindows:4}
 },now,[],recovered.map(x=>x.row));
 assert.equal(off.length,8);
});
test('recovery schedule remains stable under shuffled candidates and can never confirm cash',()=>{
 const a=fixture('z',{round:'Event1Round2'}),b=fixture('x',{round:'Event2Round2'});
 const state={windows:{
  [a.window.key]:checkpoint([a.row],{nextPage:23,totalPages:38}),
  [b.window.key]:checkpoint([b.row],{nextPage:23,totalPages:38})
 }};
 const first=recoveryShortlist([a.window,b.window],state,[b.row,a.row],[],{now});
 const second=recoveryShortlist([b.window,a.window],state,[a.row,b.row],[],{now});
 assert.deepEqual(first.map(x=>x.windowKey),second.map(x=>x.windowKey));
 assert.equal(a.row.prize,null);
 assert.equal(b.row.prize,null);
 assert.equal(REVIEW_REASON,'順位表の取得が完了していません');
});
