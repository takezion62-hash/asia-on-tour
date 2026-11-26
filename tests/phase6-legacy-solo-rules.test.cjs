'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {decide,RULES}=require('../scripts/verified-history-approval.cjs');
const {individualVrPrize}=require('../scripts/tournament-rule-engine.cjs');
const ids=['ch5s3-solo-victory-cup','ch5s3-zb-solo-victory','ch5s4-solo-victory-cup','ch5s4-zb-solo-victory'];
const now=Date.parse('2026-11-25T00:00:00Z');
function fixture(id,{region='OCE',event=1,round=2,date='2024-06-04',rank=20}={}){
 const rule=RULES[id],eventId=rule.eventIds[0],seasonId=rule.seasonId;
 const kind=round===1?'予選':'賞金決勝',windowId=eventId+'_Event'+event+'Round'+round+'_'+region;
 const win={eventId,windowId,seasonId,tournamentId:id,region,series:'victory-cup',kind,
  round:'Event '+event+' · Round '+round+' / '+kind,dateJst:date,end:Date.parse(date+'T06:00:00Z')};
 const epicAccountId='a'.repeat(32),candidateId='auto-'+seasonId.toLowerCase()+'-'+crypto.createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,[epicAccountId]])).digest('hex').slice(0,12);
 const row={id:candidateId,seasonId,tournamentId:id,event:'Test Cup',region,date,kind,round:win.round,player:'A',rank,
  points:200,kills:8,vrs:2,matches:3,prize:round===1?0:null,verified:true,
  source:'https://www.fortnite.com/competitive/events/'+eventId+'/?region='+region+'&round='+windowId};
 const cp={complete:true,rankingOrderValid:true,pages:60,nextPage:60,totalPages:60,lastSeenRank:6000,
  lastSuccessAt:new Date(win.end+5*3600000).toISOString(),proposals:[row]};
 const data={results:[],players:{candidates:[{name:'A'}]},verifiedAccounts:[{player:'A',epicAccountId,confirmed:true}],
  tournaments:{catalog:[{id,seasonId,team:'solo',series:'victory-cup',name:row.event,sourceEventIds:[eventId]}]}};
 return {row,win,cp,data};
}
test('four official 2024 solo rules award $100 per final win',()=>{
 for(const id of ids){
  const rule=RULES[id];assert.equal(individualVrPrize(rule,0),0);assert.equal(individualVrPrize(rule,3),300);
  assert.equal(rule.advance.NAC,undefined);assert.equal(rule.advance.NAW,undefined);
  const {row,win,cp,data}=fixture(id);
  const res=decide(row,win,cp,data,now);assert.equal(res.approved,true,res.reason);assert.equal(res.record.prize,200);
  assert.equal(decide(row,win,cp,{...data,verifiedAccounts:[]},now).approved,false);
  assert.equal(decide(row,win,{...cp,rankingOrderValid:false},data,now).approved,false);
  assert.equal(decide(row,win,{...cp,proposals:[row,row]},data,now).approved,false);
  const partial={...cp,complete:false,nextPage:1,pages:1,lastSeenRank:100};
  const award=decide(row,win,partial,data,now);assert.equal(award.approved,true,award.reason);
  assert.equal(award.record.prize,200);
  assert.equal(decide(row,win,{...partial,lastSeenRank:10},data,now).approved,false);
 }
});
test('S30 ZB NAC qualifiers are only exact three sourced windows, no blanket mapping',()=>{
 for(const [event,date] of [[1,'2024-06-04'],[7,'2024-07-30'],[9,'2024-08-13']]){
  const {row,win,cp,data}=fixture(ids[1],{event,date,region:'NAC',round:1,rank:5000});
  const result=decide(row,win,cp,data,now);assert.equal(result.approved,true,result.reason);
  assert.equal(result.record.prize,0);assert.match(result.record.round,/予選突破/);
  assert.equal(decide(row,win,cp,{...data,verifiedAccounts:[]},now).approved,false);
  const partial={...cp,complete:false,pages:51,nextPage:51,lastSeenRank:5100};
  assert.equal(decide(row,win,partial,data,now).approved,true);
  assert.equal(decide(row,win,{...partial,lastSeenRank:5000},data,now).approved,false);
  const outside={...row,rank:5001};assert.equal(decide(outside,win,{...cp,proposals:[outside]},data,now).approved,false);
 }
 const {row,win,cp,data}=fixture(ids[1],{event:8,date:'2024-08-06',region:'NAC',round:1,rank:1});
 assert.equal(decide(row,win,cp,data,now).approved,false);
});

test('real saved legacy queue can be previewed without provider calls or publication',()=>{
 const {preview}=require('../scripts/phase6-legacy-solo-preview.cjs');
 const report=preview();
 assert.equal(report.dryRun,true);assert.equal(report.additionalProviderRequests,0);
 assert.ok(report.checked<=report.pending);
 assert.equal(new Set(report.approved.map(x=>x.id)).size,report.approved.length);
 for(const row of report.approved)assert.ok(row.kind==='予選'?row.prize===0:row.kind==='賞金決勝'&&[0,100,200,300].includes(row.prize));
 console.log('PHASE6_LEGACY_PREVIEW '+JSON.stringify({pending:report.pending,checked:report.checked,approved:report.approved.length,additionalProviderRequests:0}));
});
