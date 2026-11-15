'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {decide}=require('../scripts/verified-history-approval.cjs');
const real=require('../calendar-history/2024-11.json');
const event='S32_SoloVictoryCashCup',tid='ch5s5-solo-victory-cup';
const cat={id:tid,name:'Solo Victory Cup Battle Royale',sourceEventIds:[event],
  team:'solo',series:'victory-cup',seasonId:'S32'};
const source=window=>'https://www.fortnite.com/competitive/events/'+event+'/?region=NAC&round='+window;
function fixture(which,date){
 const window=event+'_Event'+which+'Round2_NAC';
 const cal=real.sessions.find(s=>s.sourceWindowId===window);
 assert.ok(cal&&cal.dateJst===date&&cal.region==='NAC'&&cal.stage==='決勝');
 const win={key:cal.id,eventId:event,windowId:window,region:'NAC',dateJst:date,seasonId:'S32',
  tournamentId:tid,series:'victory-cup',kind:'賞金決勝',round:'Event '+which+' · Round 2 / 賞金決勝',
  end:Date.parse(cal.endUtc)};
 const row={id:'auto-s32-123456789012',date,region:'NAC',player:'Example',event:cat.name,
  round:win.round,kind:win.kind,source:source(window),verified:true,
  tournamentId:tid,seasonId:'S32',rank:1200,points:0,kills:5,vrs:0,matches:3,prize:null};
 const checkpoint={complete:false,rankingOrderValid:true,proposals:[row],nextPage:38,pages:38,
  totalPages:94,lastSeenRank:1900,lastSuccessAt:'2024-11-28T12:00:00Z',emptyAttempts:0,
  lastError:null,lastErrorCode:null,retryAfter:null};
 const data={tournaments:{catalog:[cat]},players:{candidates:[{name:'Example'}]},results:[]};
 return {win,row,checkpoint,data};
}
test('S32 NAC Event 3 and 4 official archived Round 2 dates allow verified 0-VR/$0 final only',()=>{
 for(const [event,date] of [[3,'2024-11-23'],[4,'2024-11-26']]){
  const {win,row,checkpoint,data}=fixture(event,date);
  const result=decide(row,win,checkpoint,data);
  assert.equal(result.approved,true,result.reason);
  assert.equal(result.record.prize,0);
  assert.equal(result.record.kind,'賞金決勝');
  assert.equal(result.record.round,win.round);
  assert.equal(decide({...row,date:'2024-11-24'},win,{...checkpoint,proposals:[{...row,date:'2024-11-24'}]},data).approved,false);
  assert.equal(decide({...row,region:'EU'},win,{...checkpoint,proposals:[{...row,region:'EU'}]},data).approved,false);
  assert.equal(decide({...row,points:100},win,{...checkpoint,proposals:[{...row,points:100}]},data).approved,false);
  assert.equal(decide({...row,vrs:1,points:100},win,{...checkpoint,proposals:[{...row,vrs:1,points:100}]},data).approved,false);
  assert.equal(decide(row,win,{...checkpoint,lastSeenRank:900},data).approved,false);
  assert.equal(decide(row,win,{...checkpoint,lastErrorCode:'RATE_LIMIT'},data).approved,false);
  assert.equal(decide({...row,round:'Event '+event+' · Round 1 / 予選'},win,{...checkpoint,proposals:[{...row,round:'Event '+event+' · Round 1 / 予選'}]},data).approved,false);
  assert.equal(decide(row,win,{...checkpoint,proposals:[]},data).approved,false);
  const qualified={...row,id:'auto-s32-123456789013',round:'Event '+event+' · Round 1 / 予選',
    kind:'予選',prize:0,vrs:0,points:160,source:source(event+'_Event'+event+'Round1_NAC')};
  const qWin={...win,windowId:event+'_Event'+event+'Round1_NAC',round:qualified.round,kind:qualified.kind};
  qualified.source=source(qWin.windowId);
  assert.equal(decide(qualified,qWin,{...checkpoint,complete:true,proposals:[qualified]},data).approved,false,
   'NAC qualifier cannot inherit a global cutoff');
 }
});
