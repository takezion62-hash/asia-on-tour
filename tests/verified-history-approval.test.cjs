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
 assert.equal(r.record.kind,'決勝');
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
