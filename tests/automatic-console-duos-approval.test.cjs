'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {decide,evaluate,overlaps}=require('../scripts/automatic-console-duos-approval.cjs');
const {runApprovals}=require('../scripts/tournament-approval-router.cjs');
const {recheckSaved}=require('../scripts/saved-candidate-recheck.cjs');
const now=Date.parse('2026-11-24T00:00:00Z'),names=['A','B'],ids=['a'.repeat(32),'b'.repeat(32)];
function fixture(season='S35',round=2,region='NAW',rank=7,vrs=1){
 const eventId=season==='S35'?'S35_VictoryDuosCup':'S37_ConsoleDuosCashCups',tournamentId=season==='S35'?'ch6s2-console-duos-victory':'ch6s4-console-duos-victory';
 const kind=round===1?'予選':'賞金決勝',label='Event 1 · Round '+round,windowId=eventId+'_Event1Round'+round+'_'+region,key='epicgames_'+eventId+'_'+region+'/'+windowId;
 const id='auto-'+season.toLowerCase()+'-'+crypto.createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,ids])).digest('hex').slice(0,12);
 const source='https://www.fortnite.com/competitive/events/'+eventId+'/?region='+region+'&round='+windowId;
 const date=season==='S35'?'2025-05-18':'2025-08-18',startUtc=date+'T00:00:00Z',end=Date.parse(startUtc)+(round===1?120:60)*60000;
 const row={id,date,region,player:names.join(' / '),players:[...names],teamAccountIds:[...ids],event:'Duos Console Victory Cash Cup',round:label+' / '+kind,kind,tournamentId,seasonId:season,rank,vrs,points:round===1?200:vrs*100,kills:20,matches:round===1?7:3,prize:round===1?0:null,source,verified:true};
 const win={key,eventId,windowId,region,dateJst:date,seasonId:season,tournamentId,series:'victory-cup',kind,round:row.round,startUtc,end};
 const cp={complete:true,rankingOrderValid:true,totalPages:3,nextPage:3,pages:3,lastSeenRank:500,lastSuccessAt:date+'T08:00:00Z',proposals:[{...row}]};
 const data={results:[],players:{candidates:names.map(name=>({name})),confirmedAliases:{}},tournaments:require('../tournaments.json'),verifiedAccounts:ids.map((epicAccountId,i)=>({epicAccountId,player:names[i],confirmed:true})),consoleCalendarSessions:[{id:key,sourceWindowId:windowId,eventId,tournamentId,seasonId:season,name:row.event,region,dateJst:date,series:'victory-cup',mode:'battle-royale',round:label,stage:round===1?'予選':'決勝',startUtc,endUtc:new Date(end).toISOString(),url:source}]};
 return {row,win,cp,data};
}
const check=x=>decide(x.row,x.win,x.cp,x.data,now);
test('two official seasons, all six regional cutoffs, zero cash and out-of-cutoff distinction',()=>{
 for(const season of ['S35','S37'])for(const [region,cutoff] of Object.entries({EU:500,NAC:500,NAW:250,ME:250,OCE:250,BR:250}))
  for(const rank of [cutoff,cutoff+1]){
   const x=fixture(season,1,region,rank);x.cp.lastSeenRank=600;const out=check(x);
   assert.equal(out.approved,true,JSON.stringify(out));assert.equal(out.record.round.endsWith('予選突破'),rank===cutoff);
   assert.equal(out.record.prize,0);assert.equal(out.record.prizePerPlayer,0);
  }
});
test('both seasons: 0/1/2/3VR exact $100/player $200/team, no data mutation',()=>{
 for(const season of ['S35','S37'])for(const vrs of [0,1,2,3]){
  const x=fixture(season,2,'NAW',7,vrs),before=JSON.stringify(x),out=check(x);
  assert.equal(out.approved,true,JSON.stringify(out));assert.equal(out.record.prize,vrs*200);assert.equal(out.record.prizePerPlayer,vrs*100);
  assert.equal(JSON.stringify(x),before);assert.equal(out.record.teamAccountIds,undefined);
 }
});
test('historical cutoff-complete qualifier is rechecked offline; finals require fully fetched pages',()=>{
 const x=fixture('S35',1,'NAW',20);
 Object.assign(x.cp,{complete:true,totalPages:91,nextPage:3,pages:3,lastSeenRank:300});
 const out=recheckSaved({queue:{proposals:[x.row]},checkpoints:{[x.win.key]:x.cp},windows:[x.win],data:x.data,config:{autoApproveConsoleDuos:true},now});
 assert.equal(out.approved.length,1);assert.equal(out.next.length,0);
 const y=fixture();Object.assign(y.cp,{complete:false,totalPages:3,nextPage:2,pages:2,lastSeenRank:200});
 assert.equal(check(y).approved,false);
});
test('wrong Epic ID, calendar, source, score, rank, payout, hold, maturity or conflicting roster cannot publish',()=>{
 for(const edit of [
  x=>x.data.verifiedAccounts.pop(),x=>delete x.row.teamAccountIds,x=>x.row.id=x.cp.proposals[0].id='auto-s35-000000000000',
  x=>x.data.consoleCalendarSessions=[],x=>x.data.consoleCalendarSessions.push({...x.data.consoleCalendarSessions[0]}),
  x=>x.win.end++,x=>x.row.points=x.cp.proposals[0].points=99,x=>x.row.rank=x.cp.proposals[0].rank=251,
  x=>x.row.matches=x.cp.proposals[0].matches=4,x=>x.cp.lastSuccessAt=x.win.startUtc,
  x=>x.cp.lastErrorCode='429',x=>x.cp.proposals[0].kills++,x=>x.cp.rankingOrderValid=false,
  x=>x.row.prize=x.cp.proposals[0].prize=0,x=>x.row.source=x.cp.proposals[0].source='https://example.com/',
  x=>x.data.results.push({...x.row,id:'manual-mixed',player:'A',players:['A']})
 ]){
  const x=fixture();edit(x);assert.equal(check(x).approved,false,edit.toString());
 }
});
test('dedicated route owns S35/S37 only; S36 and other duo routes cannot grant a new final',()=>{
 const x=fixture('S37'),cp={[x.win.key]:x.cp};
 const out=runApprovals([x.row],[x.win],cp,x.data,{autoApproveConsoleDuos:true,autoApproveVerified:true,autoApproveDuoQualifier:true},{historical:true});
 assert.equal(out.approved.length,1);assert.equal(out.batches.consoleDuos.approved.length,1);
 assert.equal(out.batches.verified.approved.length,0);assert.equal(out.batches.duo.approved.length,0);
 assert.equal(evaluate([x.row],[x.win],{...cp,other:x.cp},x.data,now).approved.length,0);
 const bad={...x.row,tournamentId:'ch6s3-console-duos-victory',seasonId:'S36'};
 assert.equal(evaluate([bad],[x.win],cp,x.data,now).approved.length,0);
 assert.equal(overlaps({...x.row,id:'other',players:['A'],player:'A',rank:99},x.row),true);
 assert.equal(overlaps({...x.row,id:'other',round:'Event 1 · Round 1 / 予選'},x.row),false);
});
