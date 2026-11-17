'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decide,roundInfo,sameRound,evaluate,RULES}=require('../scripts/automatic-duo-qualifier-approval.cjs');
const S43='S43_ReloadZBDuosCashCup',S36='S36_VictoryDuosCup';
const names=['A','B'],ids=['a'.repeat(32),'b'.repeat(32)];
const now=Date.parse('2026-11-08T14:00:00Z');
const win=(season='S43',region='OCE')=>{
 const eventId=season==='S43'?S43:S36,windowId=eventId+'_Event1Round1_'+region;
 return {key:'epicgames_'+eventId+'_'+region+'/'+windowId,eventId,windowId,
  tournamentId:season==='S43'?'ch7s5-reload-zero-build-duos-cash-cup':'ch6s3-console-duos-victory',
  seasonId:season,region,series:season==='S43'?'cash-cup':'victory-cup',
  kind:season==='S43'?'参加確認':'予選',round:season==='S43'?'Event 1 · Round 1 / 参加確認':'Event 1 · Round 1 / 予選',
  dateJst:season==='S43'?'2026-11-08':'2025-06-14',
  startUtc:season==='S43'?'2026-11-08T03:00:00Z':'2025-06-14T03:00:00Z',
  end:season==='S43'?Date.parse('2026-11-08T05:30:00Z'):Date.parse('2025-06-14T05:00:00Z')};
};
const row=(w=win(),rank=19,id='auto-'+w.seasonId.toLowerCase()+'-123456abcdef')=>({
 id,date:w.dateJst,region:w.region,seasonId:w.seasonId,tournamentId:w.tournamentId,
 event:w.seasonId==='S43'?'Reload ZB Duos Cash Cup Zero Build':'Duos Console Victory Cash Cup',
 round:w.round,kind:w.kind,player:'A / B',players:[...names],rank,points:500,
 kills:30,vrs:1,matches:w.seasonId==='S43'?10:7,prize:w.series==='cash-cup'?null:0,
 verified:true,...(w.series==='cash-cup'?{reviewOnly:true,teamAccountIds:[...ids]}:{}),
 source:'https://www.fortnite.com/competitive/events/'+w.eventId+'/?region='+w.region+'&round='+w.windowId
});
const db=w=>({tournaments:{catalog:[{id:w.tournamentId,name:w.seasonId==='S43'?'Reload ZB Duos Cash Cup Zero Build':'Duos Console Victory Cash Cup',series:w.series,
 seasonId:w.seasonId,team:'duo',sourceEventIds:[w.eventId]}]},players:{candidates:names.map(name=>({name}))},
 verifiedAccounts:ids.map((epicAccountId,i)=>({player:names[i],epicAccountId,confirmed:true})),
 schedule:{sessions:[{eventId:w.eventId,region:w.region,seasonId:w.seasonId,dateJst:w.dateJst,
  round:'Event 1 · Round 1',stage:'予選',startUtc:w.startUtc}]},results:[]});
const cp=(r,complete=false)=>({complete,rankingOrderValid:true,nextPage:2,pages:2,
 totalPages:40,lastSeenRank:2000,lastSuccessAt:'2026-11-08T10:00:00Z',proposals:[r]});
test('S43 verified 19th OCE duo is promoted as Round 1 qualified $0',()=>{
 const w=win(),r=row(w,19),out=decide(r,w,cp(r),db(w),now);
 assert.equal(roundInfo(w).cutoff,20);assert.equal(out.approved,true,out.reason);
 assert.equal(out.qualified,true);assert.equal(out.record.prize,0);
 assert.equal(out.record.kind,'予選');assert.match(out.record.round,/予選突破$/);
 assert.equal(out.record.teamAccountIds,undefined);assert.equal(out.record.reviewOnly,undefined);
});
test('S43 participants outside top 20 retain verified rank as $0 without qualification',()=>{
 const w=win(),r=row(w,333),out=decide(r,w,cp(r),db(w),now);
 assert.equal(out.approved,true,out.reason);assert.equal(out.qualified,false);
 assert.equal(out.record.prize,0);assert.match(out.record.round,/\/ 予選$/);
 assert.doesNotMatch(out.record.note,/決勝進出条件を満たした/);
});
test('S36 NAW official top 250 qualifies; #251 is NOT labelled qualified',()=>{
 const w=win('S36','NAW'),a=row(w,250),b=row(w,251,'auto-s36-abcdef123456');
 assert.equal(RULES[w.tournamentId].matchCaps['予選'],7);
 assert.equal(roundInfo(w).cutoff,250);
 let out=decide(a,w,cp(a),db(w),now);
 assert.equal(out.approved,true,out.reason);assert.equal(out.qualified,true);
 out=decide(b,w,cp(b),db(w),now);
 assert.equal(out.approved,true,out.reason);assert.equal(out.qualified,false);
 assert.match(out.record.round,/\/ 予選$/);
});
test('identity/URL/schedule/score and rank checkpoints are fail closed',()=>{
 const w=win(),r=row(w,19),good=cp(r),d=db(w);
 assert.equal(decide(r,w,{...good,rankingOrderValid:false},d,now).approved,false);
 assert.equal(decide(r,w,{...good,lastSeenRank:10},d,now).approved,false);
 assert.equal(decide(r,w,{...good,retryAfter:'2030-01-01T00:00:00Z'},d,now).approved,false);
 assert.equal(decide(r,w,{...good,lastSuccessAt:'2026-11-08T06:00:00Z'},d,now).approved,false);
 assert.equal(decide(r,{...w,windowId:w.windowId.replace('Round1','Round2')},good,d,now).approved,false);
 assert.equal(decide({...r,source:r.source.replace('region=OCE','region=EU')},w,
  cp({...r,source:r.source.replace('region=OCE','region=EU')}),d,now).approved,false);
 assert.equal(decide({...r,teamAccountIds:[ids[0],ids[0]]},w,
  cp({...r,teamAccountIds:[ids[0],ids[0]]}),d,now).approved,false);
 assert.equal(decide(r,w,good,{...d,schedule:{sessions:[]}},now).approved,false);
 assert.equal(decide(r,w,good,{...d,results:[{...r,kind:'予選',round:'Event 1 · Round 1 / 予選突破'}]},now).approved,false);
 assert.equal(sameRound({...r,kind:'予選'},r),true);
});
test('only known verified checkpoint rows are accepted, never unrelated events',()=>{
 const w=win(),r=row(w,19),unmatched=row(w,30,'auto-s43-000000000000');
 const out=evaluate([r,unmatched],[w],{[w.key]:cp(r)},db(w));
 // evaluate uses current clock: the real fixture remains historical, otherwise validate directly
 assert.equal(out.approved.length+out.held.length,2);
 assert.equal(out.held.length>=1,true);
 assert.equal(decide(r,w,{...cp(r),proposals:[unmatched]},db(w),now).approved,false);
});

test('queue reviewReason is not evidence; only that field may vary from immutable scan row',()=>{
 const w=win(),original=row(w,19),queued={...original,reviewReason:'公式の順位条件を登録していない大会'};
 const state=cp(original),info=decide(queued,w,state,db(w),now);
 assert.equal(info.approved,true,info.reason);
 assert.equal(info.qualified,true);
 const tampered={...queued,points:501};
 assert.equal(decide(tampered,w,state,db(w),now).approved,false);
});

const newDuoCup=(season,region)=>{
 const isReload=season==='S42';
 const eventId=isReload?'S42_ReloadDuosVictoryCup':'S37_ConsoleDuosCashCups';
 const tournamentId=isReload?'ch7s4-reload-duos-victory-cup':'ch6s4-console-duos-victory';
 const w={...win('S36',region),seasonId:season,eventId,tournamentId,
   dateJst:isReload?'2026-10-24':'2025-09-28',
   startUtc:isReload?'2026-10-24T03:00:00Z':'2025-09-28T03:00:00Z',
   end:Date.parse(isReload?'2026-10-24T05:00:00Z':'2025-09-28T05:00:00Z'),
   windowId:eventId+'_Event1'+(isReload?'_':'')+'Round1_'+region};
 w.key='epicgames_'+eventId+'_'+region+'/'+w.windowId;
 const name=isReload?'Reload Duos Victory Cup':'Duos Console Victory Cash Cup';
 const candidate={...row(w,1),event:name,matches:isReload?10:7,teamAccountIds:[...ids]};
 const d=db(w);d.tournaments.catalog[0].name=name;
 return {w,candidate,d};
};
test('S37 Console Duos Round1 can record verified EU/NAC 500th or 501st as $0 only',()=>{
 const {w,candidate,d}=newDuoCup('S37','NAC');
 assert.equal(roundInfo(w).cutoff,500);
 const included={...candidate,rank:500},outside={...candidate,rank:501};
 let out=decide(included,w,cp(included,true),d,now);
 assert.equal(out.approved,true,out.reason);
 assert.equal(out.qualified,true);assert.equal(out.record.prize,0);
 assert.equal(out.record.teamAccountIds,undefined);
 assert.match(out.record.round,/予選突破$/);
 out=decide(outside,w,cp(outside,true),d,now);
 assert.equal(out.approved,true,out.reason);
 assert.equal(out.qualified,false);assert.equal(out.record.prize,0);
 assert.match(out.record.round,/\/ 予選$/);
});
test('S42 Reload Duos Round1 supports _EventN_Round1 and EU300 / ME120 thresholds',()=>{
 for(const [region,cutoff] of [['EU',300],['ME',120]]){
  const {w,candidate,d}=newDuoCup('S42',region);
  assert.equal(roundInfo(w).cutoff,cutoff);
  const at={...candidate,rank:cutoff},after={...candidate,rank:cutoff+1};
  const accept=decide(at,w,cp(at,true),d,now);
  assert.equal(accept.approved,true,accept.reason);
  assert.equal(accept.qualified,true);
  assert.equal(accept.record.prize,0);
  const outside=decide(after,w,cp(after,true),d,now);
  assert.equal(outside.approved,true,outside.reason);
  assert.equal(outside.qualified,false);
  assert.equal(outside.record.prize,0);
 }
});
test('S37 and S42 duo approvals reject missing/mismatched UUID, partial roster and Round2',()=>{
 for(const season of ['S37','S42']){
  const {w,candidate,d}=newDuoCup(season,'NAW');
  assert.equal(decide({...candidate,teamAccountIds:undefined},w,
    cp({...candidate,teamAccountIds:undefined},true),d,now).approved,false);
  assert.equal(decide({...candidate,teamAccountIds:[ids[1],ids[0]]},w,
    cp({...candidate,teamAccountIds:[ids[1],ids[0]]},true),d,now).approved,false);
  assert.equal(decide({...candidate,players:['A']},w,
    cp({...candidate,players:['A']},true),d,now).approved,false);
  assert.equal(decide({...candidate,matches:99},w,
    cp({...candidate,matches:99},true),d,now).approved,false);
  const badWin={...w,kind:'賞金決勝',round:w.round.replace('予選','賞金決勝'),
    windowId:w.windowId.replace('Round1','Round2')};
  assert.equal(decide(candidate,badWin,cp(candidate,true),d,now).approved,false);
  assert.equal(decide(candidate,w,{...cp(candidate,true),rankingOrderValid:false},d,now).approved,false);
 }
});
