'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {recheckSaved,identityProof}=require('../scripts/saved-candidate-recheck.cjs');
const now=Date.parse('2026-11-24T11:00:00Z'),eventId='S43_TriosCashCup',windowId=eventId+'_Event3_ME',key='epicgames_'+eventId+'_ME/'+windowId;
const names=['A','B','C'],ids=['a'.repeat(32),'b'.repeat(32),'c'.repeat(32)];
function fixture(){
 const id='auto-s43-'+crypto.createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,ids])).digest('hex').slice(0,12);
 const source='https://www.fortnite.com/competitive/events/'+eventId+'/?region=ME&round='+windowId;
 const row={id,date:'2026-11-22',region:'ME',tournamentId:'ch7s5-trios-cash-cup',seasonId:'S43',event:'Trios Cash Cup Battle Royale',player:names.join(' / '),players:[...names],teamAccountIds:[...ids],kind:'参加確認',round:'Event 3 / 参加確認',rank:59,points:346,kills:22,vrs:1,matches:11,verified:true,reviewOnly:true,prize:null,source};
 const win={key,eventId,windowId,region:'ME',tournamentId:row.tournamentId,seasonId:'S43',series:'cash-cup',kind:row.kind,round:row.round,dateJst:row.date,startUtc:'2026-11-22T11:00:00Z',end:Date.parse('2026-11-22T14:00:00Z')};
 const cp={complete:true,rankingOrderValid:true,totalPages:10,nextPage:10,pages:10,lastSeenRank:100,lastSuccessAt:'2026-11-23T10:00:00Z',proposals:[{...row}]};
 return {queue:{proposals:[row]},checkpoints:{[key]:cp},windows:[win],data:{results:[],players:{candidates:names.map(name=>({name}))},tournaments:require('../tournaments.json'),verifiedAccounts:ids.map((epicAccountId,i)=>({epicAccountId,player:names[i],confirmed:true})),schedule:{sessions:[{eventId,seasonId:'S43',name:row.event,region:'ME',dateJst:row.date,round:'Event 3',stage:'単一ラウンド',startUtc:win.startUtc}]}},config:{autoApproveCash:true},now};
}
test('offline complete saved cash row uses existing exact adapter and preserves inputs',()=>{
 const db=fixture(),before=JSON.stringify(db),out=recheckSaved(db);
 assert.equal(out.checked,1);assert.equal(out.approved.length,1,JSON.stringify(out));
 assert.equal(out.approved[0].prize,0);assert.equal(out.next.length,0);
 assert.equal(JSON.stringify(db),before);
});
test('positive official cash, not null-to-zero guessing',()=>{
 const db=fixture();db.queue.proposals[0].rank=1;db.checkpoints[key].proposals[0].rank=1;
 const out=recheckSaved(db);assert.equal(out.approved[0].prize,900);assert.equal(out.approved[0].prizePerPlayer,300);
});
test('reject missing exact proof, wrong ID, incomplete, immature, retry, competing scope and reviewed ID',()=>{
 for(const edit of [
  d=>d.windows=[],d=>d.checkpoints[key].complete=false,d=>d.checkpoints[key].lastSuccessAt='2026-11-22T14:10:00Z',
  d=>d.checkpoints[key].lastErrorCode='429',d=>d.checkpoints[key].proposals[0].rank++,
  d=>d.data.verifiedAccounts.pop(),d=>d.otherQueue=[{...d.queue.proposals[0],points:999}],
  d=>d.reviewedIds=[d.queue.proposals[0].id],d=>{d.queue.proposals[0].id=d.checkpoints[key].proposals[0].id='auto-s43-000000000000'}
 ]){
  const d=fixture();edit(d);const out=recheckSaved(d);assert.equal(out.approved.length,0,edit.toString());assert.equal(out.next.length,1);
 }
});
test('legacy identity hash can be reconstructed only from unique exact verified IDs',()=>{
 const d=fixture(),row={...d.queue.proposals[0]};delete row.teamAccountIds;
 assert.equal(identityProof(row,d.windows[0],d.data.verifiedAccounts,'trio'),true);
 assert.equal(identityProof(row,d.windows[0],[...d.data.verifiedAccounts,{player:'A',epicAccountId:'d'.repeat(32),confirmed:true}],'trio'),false);
});
test('a disabled route holds and refreshes only the reason, never publishes',()=>{
 const d=fixture();d.config={};
 const out=recheckSaved(d);assert.equal(out.approved.length,0);assert.equal(out.reasonUpdates,1);
 assert.equal(out.next[0].reviewReason,'対象大会の自動承認設定が無効');
});

test('offline NVIDIA recheck uses exact mature positive cash prefix, not a full-scan fiction',()=>{
 const session=require('../calendar-history/2025-12.json').sessions.find(s=>s.eventId==='S39_NvidiaCup'&&s.region==='NAW');
 const eventId=session.eventId,windowId=session.sourceWindowId,key='epicgames_'+eventId+'_NAW/'+windowId;
 const epicAccountId='a'.repeat(32),player='NVIDIA confirmed solo';
 const id='auto-s39-'+crypto.createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,[epicAccountId]])).digest('hex').slice(0,12);
 const row={id,date:session.dateJst,region:'NAW',tournamentId:session.tournamentId,seasonId:'S39',event:session.name,
  player,teamAccountIds:[epicAccountId],kind:'参加確認',round:'単一開催枠 / 参加確認',rank:21,points:345,kills:7,vrs:0,matches:9,
  verified:true,reviewOnly:true,prize:null,source:session.url};
 const win={key,eventId,windowId,region:'NAW',dateJst:row.date,tournamentId:row.tournamentId,seasonId:'S39',series:'nvidia-cup',
  kind:row.kind,round:row.round,startUtc:session.startUtc,end:Date.parse(session.endUtc)};
 const cp={complete:false,rankingOrderValid:true,epicIdsRetained:true,totalPages:100,nextPage:1,pages:1,lastSeenRank:100,
  lastSuccessAt:new Date(win.end+5*3600000).toISOString(),proposals:[{...row}]};
 const db={queue:{proposals:[row]},checkpoints:{[key]:cp},windows:[win],data:{results:[],players:{candidates:[{name:player}]},
  tournaments:require('../tournaments.json'),verifiedAccounts:[{epicAccountId,player,confirmed:true}]},
  config:{autoApproveNvidia:true},now:win.end+48*3600000};
 const before=JSON.stringify(db),out=recheckSaved(db);
 assert.equal(out.approved.length,1,JSON.stringify(out));assert.equal(out.approved[0].prize,150);
 assert.equal(out.next.length,0);assert.equal(JSON.stringify(db),before);
 assert.equal(recheckSaved({...db,config:{}}).approved.length,0);
 assert.equal(recheckSaved({...db,checkpoints:{[key]:{...cp,lastSeenRank:40}}}).approved.length,0);
 assert.equal(recheckSaved({...db,reviewedIds:[id]}).approved.length,0);
});
