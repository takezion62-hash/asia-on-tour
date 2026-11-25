'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {decide,stageFor,overlaps,evaluate}=require('../scripts/automatic-squads-approval.cjs');
const {runApprovals}=require('../scripts/tournament-approval-router.cjs');
const now=Date.parse('2026-11-25T00:00:00Z'),eventId='S43_SquadsVictoryCup',tournamentId='ch7s5-squads-victory-cup';
const names=['A','B','C','D'],ids=['a','b','c','d'].map(x=>x.repeat(32));
function fixture(round=2,region='ME',rank=7,vrs=1){
 const kind=round===1?'予選':'賞金決勝',label='Event 2 · Round '+round,windowId=eventId+'_Event2_Round'+round+'_'+region,key='epicgames_'+eventId+'_'+region+'/'+windowId;
 const id='auto-s43-'+crypto.createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,ids])).digest('hex').slice(0,12);
 const source='https://www.fortnite.com/competitive/events/'+eventId+'/?region='+region+'&round='+windowId;
 const row={id,date:'2026-11-24',region,player:names.join(' / '),players:[...names],event:'Squads Victory Cup Battle Royale',round:label+' / '+kind,kind,tournamentId,seasonId:'S43',rank,vrs,points:round===1?200:vrs*100,kills:20,matches:round===1?8:3,prize:round===1?0:null,source,verified:true};
 const startUtc='2026-11-24T00:00:00Z',end=Date.parse(startUtc)+(round===1?120:60)*60000;
 const win={key,eventId,windowId,region,dateJst:row.date,seasonId:'S43',tournamentId,series:'victory-cup',kind,round:row.round,startUtc,end};
 const cp={complete:true,rankingOrderValid:true,totalPages:2,nextPage:2,pages:2,lastSeenRank:500,lastSuccessAt:'2026-11-24T08:00:00Z',proposals:[{...row}]};
 const data={results:[],players:{candidates:names.map(name=>({name})),confirmedAliases:{}},tournaments:require('../tournaments.json'),verifiedAccounts:ids.map((epicAccountId,i)=>({epicAccountId,player:names[i],confirmed:true})),schedule:{sessions:[{eventId,seasonId:'S43',name:row.event,region,dateJst:row.date,series:'victory-cup',mode:'battle-royale',round:label,stage:round===1?'予選':'決勝',startUtc}]}};
 return {row,win,cp,data};
}
const check=x=>decide(x.row,x.win,x.cp,x.data,now);
test('all six regional cutoff boundaries and out-of-cutoff participation remain distinct, $0',()=>{
 for(const [region,cutoff] of Object.entries({EU:300,NAC:200,NAW:120,OCE:120,ME:120,BR:120})){
  for(const rank of [cutoff,cutoff+1]){
   const x=fixture(1,region,rank);const out=check(x);
   assert.equal(out.approved,true,JSON.stringify(out));
   assert.equal(out.record.round.endsWith('予選突破'),rank===cutoff);
   assert.equal(out.record.prize,0);assert.equal(out.record.prizePerPlayer,0);
  }
 }
});
test('all four final VR counts award exactly 50/person and 200/team per VR',()=>{
 for(const vrs of [0,1,2,3]){
  const x=fixture(2,'ME',7,vrs),before=JSON.stringify(x),out=check(x);
  assert.equal(out.approved,true,JSON.stringify(out));assert.equal(out.record.prize,200*vrs);
  assert.equal(out.record.prizePerPlayer,50*vrs);assert.equal(JSON.stringify(x),before);
 }
});
test('mature qualifier and exact observed final prefixes work without full board',()=>{
 for(const round of [1,2]){
  const x=fixture(round);Object.assign(x.cp,{complete:false,nextPage:1,pages:1,totalPages:20,lastSeenRank:50});
  const out=check(x);assert.equal(out.approved,true,out.reason);
  assert.equal(out.record.prize,round===1?0:200);
  if(round===2)assert.match(out.record.note,/全ページ未取得/);
 }
 const x=fixture(1,'ME',100);Object.assign(x.cp,{complete:true,nextPage:2,pages:2,totalPages:20,lastSeenRank:130});
 assert.equal(check(x).approved,true);
});
test('wrong identity, stage, timestamp, rank, scoring, incomplete or conflicting proof never approves',()=>{
 for(const edit of [
  x=>x.data.verifiedAccounts.pop(),x=>x.row.id=x.cp.proposals[0].id='auto-s43-000000000000',
  x=>x.win.end++,x=>x.data.schedule.sessions=[],x=>x.row.points=x.cp.proposals[0].points=99,
  x=>x.row.rank=x.cp.proposals[0].rank=121,x=>x.row.matches=x.cp.proposals[0].matches=4,
  x=>x.cp.lastSuccessAt='2026-11-24T01:01:00Z',x=>x.cp.lastErrorCode='429',
  x=>x.cp.proposals[0].kills++,x=>x.cp.complete=false,x=>x.cp.rankingOrderValid=false,
  x=>x.row.prize=x.cp.proposals[0].prize=0,x=>x.data.results.push({...x.row,id:'manual-mixed',player:'A',players:['A']})
 ]){
  const x=fixture();edit(x);assert.equal(check(x).approved,false,edit.toString());
 }
});
test('mixed partial roster collision and same rank are held; separate rounds are not',()=>{
 const x=fixture(),old={...x.row,id:'manual',player:'A',players:['A'],rank:20};
 assert.equal(overlaps(old,x.row),true);assert.equal(overlaps({...old,round:'Event 2 · Round 1 / 予選'},x.row),false);
 assert.equal(overlaps({...old,player:'Other',players:['Other'],rank:x.row.rank},x.row),true);
});
test('router permits dedicated route only with explicit opt-in; generic historic stays disabled',()=>{
 const x=fixture(),cp={[x.win.key]:x.cp};
 assert.equal(runApprovals([x.row],[x.win],cp,x.data,{autoApproveVerified:true},{historical:true}).approved.length,0);
 assert.equal(runApprovals([x.row],[x.win],cp,x.data,{autoApproveSquads:true},{historical:false}).approved.length,1);
 assert.equal(evaluate([x.row],[x.win],{...cp,other:x.cp},x.data,now).approved.length,0);
});

test('partial squad final never accepts mismatched points, missing ID or blocked pages',()=>{
 for(const vrs of [0,1,2,3]){
  const x=fixture(2,'ME',7,vrs);Object.assign(x.cp,{complete:false,nextPage:1,pages:1,totalPages:5,lastSeenRank:50});
  assert.equal(check(x).record.prize,200*vrs);assert.equal(check(x).record.prizePerPlayer,50*vrs);
  x.row.points=x.cp.proposals[0].points=99;assert.equal(check(x).approved,false);
 }
 const x=fixture();Object.assign(x.cp,{complete:false,nextPage:1,pages:1,totalPages:5,lastSeenRank:50});
 x.data.verifiedAccounts.pop();assert.equal(check(x).approved,false);
});

test('partial squad final supports legacy omitted IDs only with exact unique deterministic identity proof',()=>{
 const make=()=>{const x=fixture();Object.assign(x.cp,{complete:false,nextPage:1,pages:1,totalPages:5,lastSeenRank:50});return x;};
 const legacy=make();assert.equal(legacy.row.teamAccountIds,undefined);
 const result=check(legacy);assert.equal(result.approved,true,result.reason);assert.equal(result.record.prize,200);
 const explicit=make();explicit.row.teamAccountIds=[...ids];explicit.cp.proposals=[{...explicit.row}];
 assert.equal(check(explicit).approved,true);
 const wrong=make();wrong.row.teamAccountIds=[ids[1],ids[0],ids[2],ids[3]];wrong.cp.proposals=[{...wrong.row}];
 assert.equal(check(wrong).approved,false);
 const ambiguous=make();ambiguous.data.verifiedAccounts.push({player:names[0],epicAccountId:'e'.repeat(32),confirmed:true});
 assert.equal(check(ambiguous).approved,false);
 const forged=make();forged.row.id=forged.cp.proposals[0].id='auto-s43-000000000000';
 assert.equal(check(forged).approved,false);
});

test('saved S43 Squads qualified prefix supports exact legacy identity; no new out-of-cutoff approval',()=>{
 const x=fixture(1,'ME',120);Object.assign(x.cp,{complete:false,nextPage:2,pages:2,totalPages:20,lastSeenRank:121});
 const re=require('../scripts/saved-candidate-recheck.cjs').recheckSaved,input={queue:{proposals:[x.row]},checkpoints:{[x.win.key]:x.cp},windows:[x.win],data:x.data,config:{autoApproveSquads:true},now};
 const out=re(input);assert.equal(out.approved.length,1,JSON.stringify(out));assert.match(out.approved[0].round,/予選突破$/);assert.equal(out.approved[0].prize,0);
 assert.equal(re({...input,checkpoints:{[x.win.key]:{...x.cp,lastSeenRank:120}}}).approved.length,0);
 assert.equal(re({...input,checkpoints:{[x.win.key]:{...x.cp,complete:true}}}).approved.length,1);
 const outside=fixture(1,'ME',121);Object.assign(outside.cp,{complete:false,nextPage:2,pages:2,totalPages:20,lastSeenRank:150});
 assert.equal(re({...input,queue:{proposals:[outside.row]},checkpoints:{[outside.win.key]:outside.cp}}).approved.length,0);
});
