'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {toParticipation,appendArchive,publishedEquivalent}=require('../scripts/participation-archive.cjs');
const {chooseWindows}=require('../scripts/participation-sync.cjs');
const win={key:'epicgames_S42_SoloVictoryCup_NAW/S42_SoloVictoryCup_Event3Round1_NAW',
 eventId:'S42_SoloVictoryCup',windowId:'S42_SoloVictoryCup_Event3Round1_NAW',region:'NAW',
 dateJst:'2026-09-22',kind:'予選',series:'victory-cup',tournamentId:'ch7s4-solo-victory-cup'};
const source='https://www.fortnite.com/competitive/events/S42_SoloVictoryCup/?region=NAW&round=S42_SoloVictoryCup_Event3Round1_NAW';
const row=(rank=801,member='P')=>({id:'auto-s42-'+rank,date:'2026-09-22',region:'NAW',player:member,event:'Solo Victory Cup Battle Royale',
 tournamentId:win.tournamentId,seasonId:'S42',round:'Event 3 · Round 1 / 予選',rank,points:190,kills:3,vrs:0,matches:8,kind:'予選',prize:0,verified:true,source});
test('confirmed lower-ranked qualifiers are archived as outside-cutoff, never as prize or trophy',()=>{
 const record=toParticipation(row(),win,800);
 assert.equal(record.qualification,'outside-cutoff');
 assert.equal(record.status,'通過圏外');
 assert.equal(record.prize,null);
 assert.equal(record.officialCutoff,800);
 assert.equal(record.rank,801);
 assert.equal(record.matches,8);
 assert.ok(!Object.hasOwn(record,'reviewOnly'));
});
test('without official cutoff, participation does not falsely assert qualification or elimination',()=>{
 const a=toParticipation(row(40),win,null);
 assert.equal(a.qualification,'unverified');
 assert.equal(a.status,'出場確認');
 assert.equal('officialCutoff' in a,false);
 const nonVictory={...win,kind:'参加確認',series:'cash-cup'};
 const p={...row(100),kind:'参加確認',round:'Event 3 / 参加確認',prize:null};
 assert.equal(toParticipation(p,nonVictory,10).qualification,'unverified');
});
test('invalid scores and untrusted URLs cannot enter archive',()=>{
 assert.equal(toParticipation({...row(),vrs:9},win,800),null);
 assert.equal(toParticipation({...row(),source:'https://malicious.invalid'},win,800),null);
 assert.equal(toParticipation({...row(),verified:false},win,800),null);
 assert.equal(toParticipation({...row(),matches:0},win,800),null);
});
test('monthly archive saves only tracked names, deduplicates on repeat and skips existing results',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aot-participation-'));
 try{
  const item={win,cutoff:800,proposals:[row(801,'P'),row(819,'Q')]};
  const initial=appendArchive(dir,[item],[],{checkedAt:'2026-11-05T00:00:00Z'});
  assert.equal(initial.added,2);
  assert.equal(initial.total,2);
  let month=JSON.parse(fs.readFileSync(path.join(dir,'participation/2026-09.json'),'utf8'));
  assert.equal(month.entries.length,2);
  assert.ok(month.entries.every(e=>e.prize===null&&e.status==='通過圏外'));
  const index=JSON.parse(fs.readFileSync(path.join(dir,'participation-index.json'),'utf8'));
  assert.equal(index.total,2);
  assert.equal(index.players.length,2);
  assert.deepEqual(index.players[0].months,['2026-09']);
  const again=appendArchive(dir,[item],[]);
  assert.equal(again.added,0);
  assert.equal(again.total,2);
  const registered={...row(900,'R'),id:'manually-added',round:'Event 3 · Round 1 / 予選突破'};
  const newer=appendArchive(dir,[{win,cutoff:800,proposals:[row(900,'R')]}],[registered]);
  assert.equal(newer.added,0);
  assert.equal(newer.skippedPublished,1);
  month=JSON.parse(fs.readFileSync(path.join(dir,'participation/2026-09.json'),'utf8'));
  assert.equal(month.entries.length,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('scanner gives recent, resuming, and older windows bounded fair turns',()=>{
 const now=Date.parse('2026-11-05T12:00:00Z');
 const make=(n,end)=>({key:String(n),end:Date.parse(end),series:'victory-cup'});
 const windows=[make(1,'2026-10-01'),make(2,'2026-10-02'),make(3,'2026-10-03'),make(4,'2026-11-04'),make(5,'2026-11-03'),make(6,'2026-10-04')];
 const state={windows:{'2':{nextPage:5,complete:false,lastScanned:'2026-11-04T00:00:00Z'},'3':{nextPage:40,complete:true,coverageLimited:true}}};
 const chosen=chooseWindows(windows,state,{maxWindowsPerRun:4,maxPagesPerWindowTotal:40},now);
 assert.ok(chosen.length<=4);
 assert.ok(chosen.some(w=>w.key==='4'));
 assert.ok(chosen.some(w=>w.key==='2'));
 assert.ok(chosen.some(w=>w.key==='1'));
 assert.ok(!chosen.some(w=>w.key==='3'));
});
