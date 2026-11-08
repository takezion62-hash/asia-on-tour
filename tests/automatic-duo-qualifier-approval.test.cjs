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
