'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decide,evaluate}=require('../scripts/verified-history-approval.cjs');
const w={key:'epicgames_S41_ReloadReloadSoloVictoryCup_ME/S41_ReloadSoloVictoryCup_Round1_Day1_ME',eventId:'S41_ReloadReloadSoloVictoryCup',windowId:'S41_ReloadSoloVictoryCup_Round1_Day1_ME',region:'ME',dateJst:'2026-08-01',seasonId:'S41',tournamentId:'ch7s3-solo-reload-victory-cup',kind:'予選',round:'Day 1 · Round 1 / 予選'};
const catalog={id:w.tournamentId,name:'Solo Reload Victory Cup',sourceEventIds:[w.eventId],series:'victory-cup',seasonId:'S41',team:'solo'};
const source=(win)=>'https://www.fortnite.com/competitive/events/'+win.eventId+'/?region='+win.region+'&round='+win.windowId;
const row={id:'auto-s41-abc123456789',date:w.dateJst,region:w.region,tournamentId:w.tournamentId,seasonId:w.seasonId,event:catalog.name,round:w.round,kind:'予選',player:'A',rank:319,points:320,kills:5,vrs:1,matches:8,prize:0,verified:true,source:source(w)};
const data=()=>({players:{candidates:[{name:'A'}]},tournaments:{catalog:[catalog]},results:[]});
const checkpoint=(x=row,complete=true)=>({complete,proposals:[x]});
test('auto-approves a fully scanned S41 ME qualifier inside top 320',()=>{
 const result=decide(row,w,checkpoint(),data());
 assert.equal(result.approved,true);
 assert.equal(result.record.prize,0);
 assert.equal(result.record.round,'Day 1 · Round 1 / 予選突破');
});
test('stops on out-of-cutoff rank, match cap, missing account or unfinished scan',()=>{
 assert.equal(decide({...row,rank:321},w,checkpoint(),data()).approved,false);
 assert.equal(decide({...row,matches:9},w,checkpoint(),data()).approved,false);
 assert.equal(decide(row,w,checkpoint(row,false),data()).approved,false);
 assert.equal(decide({...row,player:'unknown'},w,checkpoint(),data()).approved,false);
 assert.equal(decide(row,w,checkpoint(),{...data(),results:[{...row,round:'Day 1 · Round 1 / 予選突破'}]}).approved,false);
});
test('zero-VR final is $0, positive-VR final requires manual verification',()=>{
 const f={...w,key:'epicgames_S41_ReloadReloadSoloVictoryCup_ME/S41_ReloadSoloVictoryCup_Round2_Day1_ME',windowId:'S41_ReloadSoloVictoryCup_Round2_Day1_ME',kind:'賞金決勝',round:'Day 1 · Round 2 / 賞金決勝'};
 const x={...row,kind:f.kind,round:f.round,rank:216,vrs:0,matches:3,points:0,prize:null,source:source(f)};
 const r=decide(x,f,checkpoint(x),data());
 assert.equal(r.approved,true);
 assert.equal(r.record.kind,'賞金決勝');
 assert.equal(r.record.round,f.round);
 assert.equal(r.record.prize,0);
 assert.equal(decide({...x,vrs:1},f,checkpoint({...x,vrs:1}),data()).approved,false);
});
test('source and tournament identity must match exactly',()=>{
 assert.equal(decide({...row,source:row.source.replace('region=ME','region=NAW')},w,checkpoint(),data()).approved,false);
 assert.equal(decide({...row,tournamentId:'unknown'},w,checkpoint(),data()).approved,false);
});
test('evaluate holds unfinished rounds while accepting completed ones',()=>{
 const pending={...w,key:w.key+'-pending'};
 const rowPending={...row,id:'auto-s41-unique222222',source:source(w)};
 const {approved,held}=evaluate([row,rowPending],[w,pending],{[w.key]:checkpoint(row),[pending.key]:checkpoint(rowPending,false)},data());
 assert.equal(approved.length,1);
 assert.equal(held.length,1);
});

test('2024 official solos can approve qualifiers with exact regional limits only',()=>{
 const variants=[
  ['S30','ch5s3-solo-victory-cup','S30_SoloVictoryCashCup','EU',7000],
  ['S30','ch5s3-zb-solo-victory','S30_SoloZBVictoryCashCup','ME',2000],
  ['S31','ch5s4-solo-victory-cup','S31_SoloVictoryCashCup','OCE',1500],
  ['S31','ch5s4-zb-solo-victory','S31_SoloZBVictoryCashCup','OCE',600]
 ];
 for(const [sid,id,eventId,region,cutoff] of variants){
  const win={key:sid+id+region,seasonId:sid,tournamentId:id,eventId,region,dateJst:'2024-09-20',kind:'予選',round:'Event 1 · Round 1 / 予選',windowId:eventId+'_Event1Round1_'+region};
  const item={id,seasonId:sid,team:'solo',series:'victory-cup',sourceEventIds:[eventId],name:'Test Cup'};
  const proposal={id:'auto-'+sid.toLowerCase()+'-123456789012',date:win.dateJst,region,tournamentId:id,seasonId:sid,round:win.round,kind:'予選',player:'A',rank:cutoff,points:200,kills:5,vrs:0,matches:7,prize:0,verified:true,source:source(win)};
  const db={players:{candidates:[{name:'A'}]},tournaments:{catalog:[item]},results:[]};
  const checkpoint={complete:true,proposals:[proposal]};
  assert.equal(decide(proposal,win,checkpoint,db).approved,true);
  assert.equal(decide({...proposal,rank:cutoff+1},win,checkpoint,db).approved,false);
  assert.equal(decide({...proposal,matches:8},win,checkpoint,db).approved,false);
  assert.equal(decide(proposal,win,{...checkpoint,complete:false},db).approved,false);
  assert.equal(decide({...proposal,region:'NAW'},win,checkpoint,db).approved,false);
 }
});

test('2024 S30 squads with all four verified Epic players can publish zero-VR prize-free final only',()=>{
 const tournamentId='ch5s3-squads-victory-cup',eventId='S30_SquadsVictoryCashCup',region='ME';
 const win={key:'epicgames_S30_SquadsVictoryCashCup_ME/S30_SquadsVictoryCashCup_Event3Round2_ME',
   tournamentId,eventId,region,dateJst:'2024-07-01',seasonId:'S30',series:'victory-cup',
   kind:'賞金決勝',round:'Event 3 · Round 2 / 賞金決勝',windowId:'S30_SquadsVictoryCashCup_Event3Round2_ME'};
 const names=['Aim','Razl','TEITEI','ZAZI'];
 const p={id:'auto-s30-72e2696a507f',date:'2024-07-01',region,player:names.join(' / '),players:names,
   event:'Squads Victory Cup Battle Royale',tournamentId,seasonId:'S30',round:win.round,
   rank:59,points:0,kills:13,vrs:0,matches:3,prize:null,kind:win.kind,verified:true,source:source(win)};
 const catalog={id:tournamentId,team:'squad',series:'victory-cup',seasonId:'S30',
   name:p.event,sourceEventIds:[eventId]};
 const data={players:{candidates:names.map(name=>({name}))},tournaments:{catalog:[catalog]},results:[]};
 const cp={complete:true,proposals:[p]};
 const ok=decide(p,win,cp,data);
 assert.equal(ok.approved,true);
 assert.equal(ok.record.kind,'賞金決勝');
 assert.equal(ok.record.round,win.round);
 assert.equal(ok.record.prize,0);
 assert.equal(ok.record.players.length,4);
 assert.equal(decide({...p,vrs:1},win,cp,data).approved,false);
 assert.equal(decide({...p,players:names.slice(0,3)},win,cp,data).approved,false);
 assert.equal(decide({...p,players:[names[0],names[1],names[1],names[3]]},win,cp,data).approved,false);
 assert.equal(decide(p,win,{...cp,complete:false},data).approved,false);
 assert.equal(decide(p,win,cp,{...data,results:[{...p,kind:'賞金決勝'}]}).approved,false);
});
