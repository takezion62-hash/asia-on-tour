'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {planPublishedAttendance:plan}=require('../scripts/published-attendance-recheck.cjs');
function fixture(round=1){
 const eventId='S43_PerformanceEvaluationTrios',windowId='S43_PerformanceEvaluation_Event1Round'+round+'_EU',key='epicgames_'+eventId+'_EU/'+windowId;
 const names=['A','B','C'],ids=['a'.repeat(32),'b'.repeat(32),'c'.repeat(32)];
 const id='auto-s43-'+crypto.createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,ids])).digest('hex').slice(0,12);
 const row={id,date:'2026-11-06',region:'EU',tournamentId:'ch7s5-performance-evaluation-trios',seasonId:'S43',event:'Fortnite Performance Evaluation',
  player:names.join(' / '),players:names,teamAccountIds:ids,kind:'参加確認',round:'Event 1 · Round '+round+' / 参加確認',
  rank:26,points:round===1?330:100,kills:12,vrs:1,matches:round===1?8:4,verified:true,reviewOnly:true,prize:null,
  source:'https://www.fortnite.com/competitive/events/'+eventId+'/?region=EU&round='+windowId};
 const win={key,eventId,windowId,region:'EU',tournamentId:row.tournamentId,seasonId:'S43',series:'performance-evaluation',kind:row.kind,
  round:row.round,dateJst:row.date,startUtc:round===1?'2026-11-05T17:00:00Z':'2026-11-05T20:00:00Z',end:Date.parse('2026-11-06T07:00:00Z')};
 const cp={complete:false,rankingOrderValid:true,nextPage:1,pages:1,totalPages:20,lastSeenRank:27,lastSuccessAt:'2026-11-07T08:00:00Z',proposals:[row]};
 const {reviewOnly,teamAccountIds,...old}=row;
 return {data:{results:[old],players:{candidates:names.map(name=>({name}))},tournaments:require('../tournaments.json'),
 verifiedAccounts:ids.map((epicAccountId,i)=>({epicAccountId,player:names[i],confirmed:true})),
 schedule:{sessions:[{eventId,seasonId:'S43',name:row.event,region:'EU',dateJst:row.date,round:'Event 1 · Round '+round,stage:round===1?'予選':'決勝',startUtc:win.startUtc}]}},
 scans:{history:{windows:{[key]:cp}}},windows:[win],config:{autoApprovePerformance:true},ledger:{entries:[]},reviewedIds:[],now:win.end+48*3600000};
}
const cp=d=>Object.values(d.scans.history.windows)[0];
test('published qualifier is proposed with its original ID, no input writes',()=>{
 const d=fixture(),before=JSON.stringify(d),out=plan(d);
 assert.equal(out.proposed,1,JSON.stringify(out));assert.equal(out.proposals[0].id,d.data.results[0].id);
 assert.equal(out.proposals[0].after.kind,'予選');assert.equal(out.proposals[0].after.prize,0);
 assert.equal(JSON.stringify(d),before);assert.equal(out.dryRun,true);
});
test('verified final cash preserves total and personal allocation',()=>{
 const d=fixture(2),out=plan(d);
 assert.equal(out.proposed,1,JSON.stringify(out));assert.equal(out.proposals[0].after.prize,1200);
 assert.equal(out.proposals[0].after.prizePerPlayer,400);
});
test('missing identity, boundary, duplicate proofs and conflict never proposed',()=>{
 for(const edit of [
 d=>d.data.verifiedAccounts.pop(),d=>cp(d).lastSeenRank=26,d=>cp(d).lastErrorCode='429',
 d=>cp(d).proposals[0].rank++,d=>d.scans.auto=d.scans.history,d=>d.windows.push(d.windows[0]),
 d=>d.otherQueue=[{...cp(d).proposals[0],points:999}],d=>d.config={},
 d=>d.data.results.push({...d.data.results[0],id:'duplicate'})
 ]){
  const d=fixture();edit(d);assert.equal(plan(d).proposed,0,edit.toString());
 }
});
test('manual and reviewed records stay unchanged, positive cash never overwrites confirmed zero',()=>{
 for(const edit of [d=>d.ledger.entries.push({recordId:d.data.results[0].id}),
 d=>d.reviewedIds.push(d.data.results[0].id),d=>d.data.results[0].prize=0]){
  const d=fixture(2);edit(d);assert.equal(plan(d).proposed,0);
 }
});
test('already promoted record is not reconsidered; absent protection input fails closed',()=>{
 const d=fixture();d.data.results[0].kind='予選';assert.equal(plan(d).attendance,0);
 delete d.ledger;assert.throws(()=>plan(d),/Incomplete/);
});
