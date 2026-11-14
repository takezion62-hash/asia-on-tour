'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decide,evaluate}=require('../scripts/verified-history-approval.cjs');
const {applyProposals}=require('../scripts/auto-sync-core.cjs');
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
test('zero-VR final is $0; S41 positive-VR cash is rule-backed $100 per win',()=>{
 const f={...w,key:'epicgames_S41_ReloadReloadSoloVictoryCup_ME/S41_ReloadSoloVictoryCup_Round2_Day1_ME',windowId:'S41_ReloadSoloVictoryCup_Round2_Day1_ME',kind:'賞金決勝',round:'Day 1 · Round 2 / 賞金決勝'};
 const x={...row,kind:f.kind,round:f.round,rank:216,vrs:0,matches:3,points:0,prize:null,source:source(f)};
 const r=decide(x,f,checkpoint(x),data());
 assert.equal(r.approved,true);
 assert.equal(r.record.kind,'賞金決勝');
 assert.equal(r.record.round,f.round);
 assert.equal(r.record.prize,0);
 const win={...x,vrs:1,matches:3};
 const earned=decide(win,f,checkpoint(win),data());
 assert.equal(earned.approved,true);
 assert.equal(earned.record.prize,100);
 assert.match(earned.record.note,/資格審査/);
 assert.equal(decide({...win,prize:100},f,checkpoint({...win,prize:100}),data()).approved,false);
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

test('S42 solo cash finals also derive $100 per Victory Royale with exact rules',()=>{
 const win={...w,key:'S42-auto',eventId:'S42_SoloVictoryCup',windowId:'S42_SoloVictoryCup_Event1Round2_NAW',
  seasonId:'S42',tournamentId:'ch7s4-solo-victory-cup',region:'NAW',kind:'賞金決勝',
  round:'Event 1 · Round 2 / 賞金決勝'};
 const item={id:win.tournamentId,name:'Solo Victory Cup',sourceEventIds:[win.eventId],series:'victory-cup',seasonId:'S42',team:'solo'};
 const candidate={...row,id:'auto-s42-987654321012',event:item.name,seasonId:'S42',date:win.dateJst,
  region:win.region,tournamentId:win.tournamentId,round:win.round,kind:win.kind,rank:32,
  points:0,kills:8,vrs:2,matches:3,prize:null,source:source(win)};
 const db={players:{candidates:[{name:'A'}]},tournaments:{catalog:[item]},results:[]};
 const result=decide(candidate,win,{complete:true,proposals:[candidate]},db);
 assert.equal(result.approved,true);
 assert.equal(result.record.prize,200);
});


test('mature partial leaderboard may publish a proven 0-VR final, never positive cash or qualification',()=>{
 const f={...w,end:Date.parse('2026-08-01T06:00:00Z'),windowId:'S41_ReloadSoloVictoryCup_Round2_Day1_ME',
  kind:'賞金決勝',round:'Day 1 · Round 2 / 賞金決勝'};
 const zero={...row,kind:f.kind,round:f.round,rank:216,points:0,vrs:0,matches:3,prize:null,source:source(f)};
 const cp={complete:false,rankingOrderValid:true,nextPage:4,pages:4,totalPages:30,lastSeenRank:400,
  lastSuccessAt:'2026-11-07T09:00:00Z',proposals:[zero]};
 const accepted=decide(zero,f,cp,data());
 assert.equal(accepted.approved,true,accepted.reason);
 assert.equal(accepted.record.prize,0);
 const positive={...zero,vrs:1};
 assert.equal(decide(positive,f,{...cp,proposals:[positive]},data()).approved,false);
 const prelim={...row,rank:319};
 assert.equal(decide(prelim,{...w,end:f.end},{...cp,proposals:[prelim]},data()).approved,false);
 assert.equal(decide(zero,f,{...cp,lastErrorCode:'INVALID_PAGE'},data()).approved,false);
});

test('NA-era S30/S31 NAC Round 2 0VR may be $0, but NA qualifier cutoff is NOT assigned to NAC',()=>{
 for(const [sid,id,eventId] of [
  ['S30','ch5s3-solo-victory-cup','S30_SoloVictoryCashCup'],
  ['S31','ch5s4-solo-victory-cup','S31_SoloVictoryCashCup']
 ]){
  const win={key:id+'-NAC-verified-final',eventId,seasonId:sid,tournamentId:id,
   series:'victory-cup',region:'NAC',dateJst:'2024-09-24',
   windowId:eventId+'_Event4Round2_NAC',round:'Event 4 · Round 2 / 賞金決勝',
   kind:'賞金決勝',end:Date.parse('2024-09-24T08:00:00Z')};
  const candidate={...row,id:'auto-'+sid.toLowerCase()+'-abcabcabcabc',
   date:win.dateJst,seasonId:sid,tournamentId:id,
   region:win.region,round:win.round,kind:win.kind,
   rank:7032,points:0,kills:3,vrs:0,matches:3,prize:null,
   source:source(win)};
  const local={players:{candidates:[{name:'A'}]},tournaments:{catalog:[{
   id,seasonId:sid,series:'victory-cup',team:'solo',
   sourceEventIds:[eventId]}]},results:[]};
  const checkpoint={complete:true,rankingOrderValid:true,proposals:[candidate]};
  const result=decide(candidate,win,checkpoint,local);
  assert.equal(result.approved,true,result.reason);
  assert.equal(result.record.prize,0);
  assert.equal(decide({...candidate,vrs:1},win,{...checkpoint,proposals:[{...candidate,vrs:1}]},local).approved,false);
  assert.equal(decide(candidate,win,{...checkpoint,rankingOrderValid:false},local).approved,false);
  assert.equal(decide({...candidate,points:50},win,{...checkpoint,proposals:[{...candidate,points:50}]},local).approved,false);
  const pre={...win,kind:'予選',round:'Event 4 · Round 1 / 予選',
   windowId:eventId+'_Event4Round1_NAC'};
  const entry={...candidate,kind:'予選',round:pre.round,points:200,
   vrs:1,prize:0,source:source(pre)};
  assert.equal(decide(entry,pre,{...checkpoint,proposals:[entry]},local).approved,false);
 }
});

test('S42 Console ZB Solo Round 2 pays $0 for verified 0VR and $100 for 1VR',()=>{
 const w2={key:'epicgames_S42_ConsoleVCC_SolosZB_NAW/S42_ConsoleVCC_SolosZB_Event2Round2_NAW',eventId:'S42_ConsoleVCC_SolosZB',windowId:'S42_ConsoleVCC_SolosZB_Event2Round2_NAW',dateJst:'2026-09-06',seasonId:'S42',tournamentId:'ch7s4-console-zero-build-solo-victory-cup',region:'NAW',kind:'賞金決勝',round:'Event 2 · Round 2 / 賞金決勝'};
 const cat={id:w2.tournamentId,name:'Console Zero Build Solo Victory Cup',sourceEventIds:[w2.eventId],series:'victory-cup',seasonId:'S42',team:'solo'};
 const x={id:'auto-s42-111122223333',date:w2.dateJst,region:'NAW',tournamentId:w2.tournamentId,seasonId:'S42',event:cat.name,round:w2.round,kind:'賞金決勝',player:'A',rank:55,points:0,kills:9,vrs:0,matches:3,prize:null,verified:true,source:source(w2)};
 const db={players:{candidates:[{name:'A'}]},tournaments:{catalog:[cat]},results:[]};
 const zero=decide(x,w2,{complete:true,proposals:[x]},db);
 assert.equal(zero.approved,true);assert.equal(zero.record.prize,0);
 const one={...x,vrs:1};assert.equal(decide(one,w2,{complete:true,proposals:[one]},db).record.prize,100);
 assert.equal(decide({...x,matches:4},w2,{complete:true,proposals:[{...x,matches:4}]},db).approved,false);
});

test('S32 Remix ME saved partial zero-VR final is $0, while unknown positive cash stays pending',()=>{
 const win={eventId:'S32_SoloVictoryCashCup',windowId:'S32_SoloVictoryCashCup_Event2Round2_ME',
  region:'ME',seasonId:'S32',tournamentId:'ch5s5-solo-victory-cup',
  dateJst:'2024-11-16',end:Date.parse('2024-11-16T06:00:00Z'),
  kind:'賞金決勝',round:'Event 2 · Round 2 / 賞金決勝'};
 const item={id:win.tournamentId,seasonId:'S32',team:'solo',series:'victory-cup',
  sourceEventIds:[win.eventId],name:'Solo Victory Cup Battle Royale'};
 const player={id:'auto-s32-123456789012',date:win.dateJst,region:'ME',seasonId:'S32',
  tournamentId:win.tournamentId,kind:win.kind,round:win.round,
  player:'Mofu',rank:211,points:0,kills:6,vrs:0,matches:3,prize:null,
  verified:true,source:source(win)};
 const scan={complete:false,rankingOrderValid:true,proposals:[player],nextPage:3,
  pages:3,totalPages:18,lastSeenRank:230,lastSuccessAt:'2024-11-17T00:00:00.000Z',
  emptyAttempts:0,lastErrorCode:null,lastError:null,retryAfter:null};
 const db={players:{candidates:[{name:'Mofu'}]},tournaments:{catalog:[item]},results:[]};
 const accepted=decide(player,win,scan,db);
 assert.equal(accepted.approved,true);
 assert.equal(accepted.record.prize,0);
 assert.equal(decide({...player,vrs:1},win,scan,db).approved,false);
 assert.equal(decide({...player,region:'NAC'},win,scan,db).approved,false);
});

test('only individually verified 2024 NA Central qualifier windows can use NA cutoffs',()=>{
 const scenarios=[
  ['S30','ch5s3-solo-victory-cup','S30_SoloVictoryCashCup','2024-07-23',6,5000],
  ['S32','ch5s5-solo-victory-cup','S32_SoloVictoryCashCup','2024-11-16',2,10000]
 ];
 for(const [sid,id,eventId,date,event,cutoff] of scenarios){
  const win={eventId,windowId:eventId+'_Event'+event+'Round1_NAC',region:'NAC',
   seasonId:sid,tournamentId:id,dateJst:date,kind:'予選',
   round:'Event '+event+' · Round 1 / 予選'};
  const rec={id:'auto-'+sid.toLowerCase()+'-123456789012',date,region:'NAC',
   seasonId:sid,tournamentId:id,kind:'予選',round:win.round,
   player:'A',rank:cutoff,points:140,kills:3,vrs:0,matches:7,prize:0,
   verified:true,source:source(win)};
  const data={players:{candidates:[{name:'A'}]},tournaments:{catalog:[{
   id,seasonId:sid,team:'solo',series:'victory-cup',sourceEventIds:[eventId]}]},results:[]};
  const checkpoint={complete:true,proposals:[rec]};
  const out=decide(rec,win,checkpoint,data);
  assert.equal(out.approved,true,out.reason);
  assert.equal(out.record.prize,0);
  assert.match(out.record.note,/fortnitetracker.com/);
  assert.equal(decide({...rec,rank:cutoff+1},win,{...checkpoint,proposals:[{...rec,rank:cutoff+1}]},data).approved,false);
  const otherWin={...win,windowId:eventId+'_Event'+(event+1)+'Round1_NAC'};
  const otherRec={...rec,source:source(otherWin)};
  assert.equal(decide(otherRec,otherWin,{...checkpoint,proposals:[otherRec]},data).approved,false);
 }
});

test('S42 Solo Reload verified Round 1 non-qualifiers are attendance-only, never prize or advance',()=>{
 const win={key:'epicgames_S42_ReloadReloadSoloVictoryCup_ME/S42_ReloadSoloVictoryCup_Event5_Round1_ME',
  eventId:'S42_ReloadReloadSoloVictoryCup',windowId:'S42_ReloadSoloVictoryCup_Event5_Round1_ME',
  dateJst:'2026-10-24',region:'ME',seasonId:'S42',
  tournamentId:'ch7s4-solo-reload-victory-cup',kind:'予選',round:'Event 5 · Round 1 / 予選'};
 const row0={id:'auto-s42-1029384756ab',date:win.dateJst,region:win.region,seasonId:'S42',
  tournamentId:win.tournamentId,event:'Solo Reload Victory Cup',round:win.round,
  kind:win.kind,player:'A',rank:6130,points:120,kills:4,vrs:0,matches:7,prize:0,
  verified:true,source:source(win)};
 const data={players:{candidates:[{name:'A'}]},tournaments:{catalog:[{
  id:win.tournamentId,seasonId:'S42',team:'solo',series:'victory-cup',
  name:'Solo Reload Victory Cup',sourceEventIds:[win.eventId]}]},results:[]};
 const cp={complete:true,proposals:[row0]};
 const out=decide(row0,win,cp,data);
 assert.equal(out.approved,true,out.reason);
 assert.equal(out.record.kind,'参加確認');
 assert.equal(out.record.round,'Event 5 · Round 1 / 参加確認');
 assert.equal(out.record.prize,0);
 assert.match(out.record.note,/突破圏外/);
 const checked=evaluate([row0],[win],{[win.key]:cp},data);
 assert.equal(checked.approved.length,1);
 const published={results:[],updates:{entries:[]}};
 const verifiedParticipationIds=new Set(checked.approved.filter(x=>x.kind==='参加確認'&&x.reviewOnly!==true&&x.verified===true&&x.prize===0).map(x=>x.id));
 assert.equal(applyProposals(published,checked.approved,'2026-11-14T06:00:00Z',{verifiedParticipationIds}),1);
 assert.equal(published.results[0].kind,'参加確認');
 assert.equal(published.results[0].prize,0);
 const advanced={...row0,rank:320};
 const good=decide(advanced,win,{...cp,proposals:[advanced]},data);
 assert.equal(good.approved,true,good.reason);
 assert.equal(good.record.kind,'予選');
 assert.equal(good.record.round,'Event 5 · Round 1 / 予選突破');
 assert.equal(decide({...row0,prize:100},win,{...cp,proposals:[{...row0,prize:100}]},data).approved,false);
 assert.equal(decide(row0,win,{...cp,proposals:[]},data).approved,false);
 assert.equal(decide({...row0,matches:9},win,{...cp,proposals:[{...row0,matches:9}]},data).approved,false);
 assert.equal(decide(row0,win,{...cp,complete:false},data).approved,false);
});
