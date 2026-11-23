'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decide:guard,SPECS,RULE,WINDOW}=require('../scripts/verified-s37-20250825-zero-final.cjs');
const {decide:publicDecide}=require('../scripts/verified-history-approval.cjs');
const EVENT='S37_ConsoleDuosCashCups';
function fixture(s=SPECS[0]){
 const row={...s,id:s.id,date:'2025-08-25',region:'NAW',event:'Duos Console Victory Cash Cup',
  chapter:6,season:4,seasonId:'S37',tournamentId:'ch6s4-console-duos-victory',
  round:'Event 2 · Round 2 / 賞金決勝',kind:'賞金決勝',
  points:0,vrs:0,prize:null,verified:true,note:'scan record'};
 const win={eventId:EVENT,windowId:WINDOW,dateJst:row.date,region:row.region,
  tournamentId:row.tournamentId,seasonId:row.seasonId,kind:row.kind,round:row.round,
  end:Date.parse('2025-08-25T00:00:00.000Z')};
 const cp={complete:false,rankingOrderValid:true,pages:2,nextPage:2,totalPages:3,
  lastSeenRank:200,emptyAttempts:0,lastSuccessAt:'2026-11-20T00:00:00.000Z',proposals:[row]};
 const data={players:{candidates:row.players.map(name=>({name}))},
  tournaments:{catalog:[{id:row.tournamentId,name:row.event,team:'duo',
   series:'victory-cup',seasonId:'S37',sourceEventIds:[EVENT]}]},results:[]};
 const rule={id:row.tournamentId,seasonId:'S37',prizePerVictory:100,teamPrizePerVictory:200,
  matchCaps:{'賞金決勝':3},eventIds:[EVENT],source:RULE};
 return {row,win,cp,data,rule};
}
test('exact 10 frozen NAW 2025-08-25 Event2 Round2 finalists can be $0 only',()=>{
 assert.equal(SPECS.length,10);
 assert.equal(new Set(SPECS.map(s=>s.id)).size,10);
 for(const s of SPECS){
  const f=fixture(s),out=guard(f.row,f.win,f.cp,f.data,f.rule);
  assert.equal(out.approved,true,s.id+' '+out.reason);
  assert.equal(out.record.prize,0);
  assert.equal(out.record.vrs,0);
  assert.equal(out.record.kind,'賞金決勝');
  assert.equal(out.record.teamAccountIds,undefined);
  assert.equal(out.record.reviewReason,undefined);
 }
});
test('public verified rule entrypoint allows only the frozen 0VR finals, not arbitrary duo rounds',()=>{
 const f=fixture();
 assert.equal(publicDecide(f.row,f.win,f.cp,f.data).approved,true);
 assert.equal(publicDecide({...f.row,id:'auto-s37-000000000000'},f.win,f.cp,f.data).approved,false);
});
test('no positive VR, mismatched teams, prizes, stages or missing continuous pages',()=>{
 const f=fixture();
 for(const altered of [
  {vrs:1},{prize:100},{points:1},{kills:f.row.kills+1},
  {matches:4},{rank:f.row.rank+1},{player:'different'},
  {teamAccountIds:['a'.repeat(32),'b'.repeat(32)]},{players:['wrong','other']},
  {kind:'予選'},{reviewOnly:true},{verified:false},{date:'2025-08-26'},
  {source:'https://example.com/'}
 ]){
  const tampered={...f.row,...altered};
  assert.equal(guard(tampered,f.win,f.cp,f.data,f.rule).approved,false,JSON.stringify(altered));
 }
 for(const modified of [
  {rankingOrderValid:false},{emptyAttempts:1},{lastErrorCode:'network'},
  {lastSeenRank:10},{nextPage:1},{pages:1,totalPages:3},
  {lastSuccessAt:'2025-08-25T01:00:00.000Z'},{proposals:[]}
 ]){
  assert.equal(guard(f.row,f.win,{...f.cp,...modified},f.data,f.rule).approved,false,JSON.stringify(modified));
 }
 assert.equal(guard(f.row,{...f.win,windowId:EVENT+'_Event2Round1_NAW'},f.cp,f.data,f.rule).approved,false);
 assert.equal(guard(f.row,f.win,f.cp,f.data,{...f.rule,prizePerVictory:200}).approved,false);
 assert.equal(guard(f.row,f.win,f.cp,{...f.data,results:[{...f.row,prize:0}]},f.rule).approved,false);
});
