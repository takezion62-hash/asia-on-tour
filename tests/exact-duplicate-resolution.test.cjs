'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {planDuplicates}=require('../scripts/exact-duplicate-resolution.cjs');
const now=Date.parse('2026-11-24T11:00:00Z');
const event='S43_TriosCashCup',tournamentId='ch7s5-trios-cash-cup',windowId=event+'_Event3_ME',key='epicgames_'+event+'_ME/'+windowId;
const source='https://www.fortnite.com/competitive/events/'+event+'/?region=ME&round='+windowId;
const names=['A','B','C'],ids=['a'.repeat(32),'b'.repeat(32),'c'.repeat(32)];
function fixture(){
 const row={id:'auto-s43-aaaaaaaaaaaa',date:'2026-11-22',region:'ME',player:names.join(' / '),players:[...names],teamAccountIds:[...ids],
  event:'Trios Cash Cup Battle Royale',round:'Event 3 / 参加確認',kind:'参加確認',seasonId:'S43',tournamentId,
  rank:59,points:346,kills:22,vrs:1,matches:11,verified:true,reviewOnly:true,prize:null,source};
 const old={...row,id:'manual-record',round:'Event 3 / 賞金決勝',kind:'賞金決勝',prize:0,prizePerPlayer:0};
 delete old.reviewOnly;
 const cp={complete:true,rankingOrderValid:true,nextPage:10,pages:10,totalPages:10,lastSeenRank:600,lastSuccessAt:'2026-11-23T10:00:00Z',proposals:[{...row}]};
 const session={eventId:event,sourceWindowId:windowId,dateJst:row.date,region:'ME',seasonId:'S43',tournamentId,
  name:row.event,url:source,round:'Event 3',stage:'単一ラウンド',startUtc:'2026-11-22T11:00:00Z',endUtc:'2026-11-22T14:00:00Z'};
 return {results:[old],reviews:{auto:{proposals:[]},history:{proposals:[row]}},scans:{auto:{windows:{}},history:{windows:{[key]:cp}}},
  statuses:{auto:{found:0},history:{found:1}},reviewed:{version:1,entries:[]},ledger:{entries:[]},
  players:{candidates:names.map(name=>({name}))},tournaments:require('../tournaments.json'),
  verifiedAccounts:ids.map((epicAccountId,i)=>({epicAccountId,player:names[i],confirmed:true})),calendar:{'2026-11':[session]}};
}
const plan=db=>planDuplicates(db,{now});
test('exact final, complete Epic proof and official zero rank payout resolve without modifying any public record',()=>{
 const db=fixture(),snapshot=JSON.stringify(db),out=plan(db);
 assert.equal(out.resolved.length,1,JSON.stringify(out.held));assert.equal(out.held.length,0);
 assert.equal(out.resolved[0].existingId,'manual-record');
 assert.equal(out.resolved[0].evidence.prize,0);assert.equal(out.resolved[0].evidence.stats.vrs,1);
 assert.equal(out.next.reviews.history.proposals.length,0);assert.equal(out.next.statuses.history.autoResolvedDuplicates,1);
 assert.equal(out.next.reviewed.entries[0].decision,'already-published');
 assert.equal(JSON.stringify(db),snapshot);
 assert.equal(plan({...db,...out.next}).resolved.length,0);
});
test('positive rank prize must match team and individual amounts exactly',()=>{
 const db=fixture(),r=db.reviews.history.proposals[0],cp=db.scans.history.windows[key];
 r.rank=1;cp.proposals=[{...r}];Object.assign(db.results[0],{rank:1,prize:900,prizePerPlayer:300});
 assert.equal(plan(db).resolved.length,1);
 db.results[0].prize=300;assert.equal(plan(db).resolved.length,0);
});
test('any disagreement, missing Epic proof, incomplete/error checkpoint, immature observation, unknown cash, or ambiguous match is held',()=>{
 const edits=[
  d=>{d.results[0].rank++},d=>{d.results[0].kills++},d=>{d.results[0].matches--},
  d=>{d.results[0].prize=null},d=>{delete d.results[0].prizePerPlayer},d=>{d.results[0].prize=100},
  d=>{delete d.results[0].teamAccountIds},d=>{d.results[0].teamAccountIds=['d'.repeat(32),ids[1],ids[2]]},
  d=>{d.verifiedAccounts.pop()},d=>{d.results[0].kind='参加確認'},
  d=>{d.scans.history.windows[key].complete=false},d=>{d.scans.history.windows[key].lastErrorCode='HTTP429'},
  d=>{d.scans.history.windows[key].lastSuccessAt='2026-11-22T14:01:00Z'},
  d=>{d.scans.history.windows[key].proposals[0].points++},
  d=>{d.calendar['2026-11']=[]},d=>{d.results.push({...d.results[0],id:'another'})},
  d=>{d.reviewed.entries.push({id:d.reviews.history.proposals[0].id})}
 ];
 for(const edit of edits){const d=fixture();edit(d);const out=plan(d);assert.equal(out.resolved.length,0,edit.toString());assert.equal(out.next.reviews.history.proposals.length,1)}
});
test('both queues only resolve once; cross-scope conflicting candidate or checkpoint holds both',()=>{
 const d=fixture(),row=d.reviews.history.proposals[0];d.reviews.auto.proposals=[{...row,reviewReason:'different wording'}];
 const out=plan(d);assert.equal(out.resolved.length,1);assert.equal(out.next.reviews.auto.proposals.length,0);
 assert.equal(out.next.reviewed.entries.length,1);
 d.reviews.auto.proposals[0].points++;assert.equal(plan(d).resolved.length,0);
});
test('different event round never resolves even when same roster and scores',()=>{
 const d=fixture();d.results[0].source=source.replace('Event3_ME','Event2_ME');
 assert.equal(plan(d).resolved.length,0);
});
