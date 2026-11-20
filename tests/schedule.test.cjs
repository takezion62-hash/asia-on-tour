'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'schedule.json'),'utf8'));
const results=require('./production-results.cjs');
const regions=['ME','EU','NAC','NAW','OCE','BR'];
const ids=new Set(data.sessions.map(x=>x.id));
test('S43 schedule is a separate source-backed current snapshot and preserves results',()=>{
 assert.equal(data.version,1);
 assert.equal(data.seasonId,'S43');
 assert.equal(data.timezone,'Asia/Tokyo');
 assert.match(data.checkedAt,/^2026-11-0[4-9]$/);
 assert.equal(ids.size,data.sessions.length);
 assert.ok(data.sessions.length>=100);
 assert.ok(results.every(x=>!ids.has(x.id)));
 assert.ok(results.some(x=>x.date.startsWith('2024-')));
 assert.ok(results.some(x=>x.date.startsWith('2026-')));
});
test('every session is a real official URL, overseas region and non-region-locked tournament',()=>{
 for(const x of data.sessions){
  assert.equal(x.seasonId,'S43',x.id);
  assert.ok(regions.includes(x.region),x.id);
  assert.ok(!/\bfncs\b/i.test(x.name)||/FNCS\s+Division\s*1/i.test(x.name),x.id);
  assert.equal(x.url,'https://www.fortnite.com/competitive/events/'+x.eventId+'/?region='+x.region,x.id);
  assert.ok(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00Z$/.test(x.startUtc),x.id);
  const dt=new Date(x.startUtc);assert.equal(Number.isFinite(dt.getTime()),true,x.id);
  const tokyo=new Date(dt.getTime()+9*3600000).toISOString();
  assert.equal(x.dateJst,tokyo.slice(0,10),x.id);
  assert.equal(x.timeJst,tokyo.slice(11,16),x.id);
  assert.ok(['予選','決勝','単一ラウンド'].includes(x.stage),x.id);
  assert.ok(['cash-cup','victory-cup','ranked-cup','performance-evaluation','skin-cup'].includes(x.series),x.id);
  assert.equal('prize' in x,false,x.id);
  assert.equal('verified' in x,false,x.id);
  assert.equal('players' in x,false,x.id);
 }
});
test('season includes complete 6-region schedules for Trios, Squads, Reload ZB and Arenas',()=>{
 const counts={S43_TriosCashCup:3,S43_SquadsVictoryCup:4,
   S43_ReloadZBDuosCashCup:4,S43_ArenaCashCup:2};
 for(const [id,perRegion] of Object.entries(counts))
  for(const region of regions)assert.equal(data.sessions.filter(x=>x.eventId===id&&x.region===region).length,perRegion,id+'/'+region);
});
test('Performance Evaluation only includes EU/NAC sessions confirmed by official schedule',()=>{
 const rows=data.sessions.filter(x=>x.eventId==='S43_PerformanceEvaluationTrios');
 assert.equal(rows.length,16);
 assert.deepEqual([...new Set(rows.map(x=>x.region))].sort(),['EU','NAC']);
 assert.equal(rows.filter(x=>x.stage==='予選').length,8);
 assert.equal(rows.filter(x=>x.stage==='決勝').length,8);
});
test('Widowmaker Zero Build and Mobile add twelve unique overseas sessions with correct JST starts',()=>{
 const base='S43_OverwatchWidowmakerCup',zb=base+'_ZB',mobile=base+'_Mobile';
 const cases=[
  {id:zb,mode:'zero-build',utc:{OCE:'2026-11-20T07:00:00Z',ME:'2026-11-20T15:00:00Z',
   EU:'2026-11-20T18:00:00Z',BR:'2026-11-20T21:00:00Z',
   NAC:'2026-11-21T00:00:00Z',NAW:'2026-11-21T02:00:00Z'}},
  {id:mobile,mode:'reload-zero-build',utc:{OCE:'2026-11-20T06:00:00Z',ME:'2026-11-20T14:00:00Z',
   EU:'2026-11-20T17:00:00Z',BR:'2026-11-20T20:00:00Z',
   NAC:'2026-11-20T23:00:00Z',NAW:'2026-11-21T01:00:00Z'}}
 ];
 for(const x of cases){
  const rows=data.sessions.filter(s=>s.eventId===x.id);
  assert.equal(rows.length,6,x.id);
  for(const [region,stamp] of Object.entries(x.utc)){
   const matched=rows.filter(s=>s.region===region);
   assert.equal(matched.length,1,x.id+' '+region);
   const row=matched[0],date=new Date(new Date(stamp).getTime()+9*3600000).toISOString();
   assert.equal(row.startUtc,stamp);assert.equal(row.mode,x.mode);
   assert.equal(row.dateJst,date.slice(0,10));assert.equal(row.timeJst,date.slice(11,16));
   assert.equal(row.round,'Session 1');assert.equal(row.series,'skin-cup');
   assert.equal(row.stage,'単一ラウンド');assert.equal(row.rewardType,'cosmetic');
   assert.equal(row.url,'https://www.fortnite.com/competitive/events/'+x.id+'/?region='+region);
  }
 }
 for(const region of regions){
  const dates=cases.map(x=>data.sessions.find(s=>s.eventId===x.id&&s.region===region));
  assert.equal(new Date(dates[0].startUtc).getTime()-new Date(dates[1].startUtc).getTime(),3600000,
   region+' Mobile must start exactly 60 minutes before ZB');
 }
 assert.equal(new Set(data.sessions.map(s=>s.id)).size,data.sessions.length);
 assert.equal(data.sessions.filter(s=>[base,zb,mobile].includes(s.eventId)).length,18);
});

test('Overwatch Widowmaker BR has six source-backed overseas sessions and keeps ZB/Mobile separate',()=>{
 const id='S43_OverwatchWidowmakerCup';
 const rows=data.sessions.filter(x=>x.eventId===id);
 assert.equal(rows.length,6);
 const expected={OCE:['2026-11-20T07:00:00Z','2026-11-20','16:00'],
  ME:['2026-11-20T15:00:00Z','2026-11-21','00:00'],
  EU:['2026-11-20T18:00:00Z','2026-11-21','03:00'],
  BR:['2026-11-20T21:00:00Z','2026-11-21','06:00'],
  NAC:['2026-11-21T00:00:00Z','2026-11-21','09:00'],
  NAW:['2026-11-21T02:00:00Z','2026-11-21','11:00']};
 for(const [region,[utc,date,time]] of Object.entries(expected)){
  const matches=rows.filter(x=>x.region===region);
  assert.equal(matches.length,1);
  const x=matches[0];
  assert.deepEqual([x.startUtc,x.dateJst,x.timeJst],[utc,date,time]);
  assert.equal(x.series,'skin-cup');
  assert.equal(x.mode,'battle-royale');
  assert.equal(x.round,'Session 1');
  assert.equal(x.stage,'単一ラウンド');
  assert.equal(x.rewardType,'cosmetic');
  assert.equal(x.url,'https://www.fortnite.com/competitive/events/'+id+'/?region='+region);
 }
 assert.ok(!rows.some(x=>/Mobile|_ZB/.test(x.eventId)));
 assert.equal(data.sessions.filter(x=>x.id.startsWith('s43_overwatchwidowmakercup-')).length,6);
 assert.equal(new Set(data.sessions.map(x=>x.id)).size,data.sessions.length);
});

test('regional UTC starts convert to JST including overnight and cross-month timestamps',()=>{
 const get=(id,region,round)=>data.sessions.find(x=>x.eventId===id&&x.region===region&&x.round===round);
 const br=get('S43_TriosCashCup','BR','Event 1');
 assert.deepEqual([br.dateJst,br.timeJst],['2026-11-08','02:00']);
 const eu=get('S43_SquadsVictoryCup','EU','Event 1 · Round 1');
 assert.deepEqual([eu.dateJst,eu.timeJst],['2026-11-10','03:00']);
 const nac=get('S43_ReloadZBDuosCashCup','NAC','Event 1 · Round 2');
 assert.deepEqual([nac.dateJst,nac.timeJst],['2026-11-14','09:00']);
 const na=get('S43_RankedCupSolo','NAW','Event 5');
 assert.deepEqual([na.dateJst,na.timeJst],['2026-12-02','11:00']);
});
test('schedule never includes FNCS Solos Reload Qualifiers, Heats, LCQ or Finals',()=>{
 for(const x of data.sessions){
  assert.ok(!/FNCS Solos Reload|FNCSSoloReload/i.test(x.eventId+' '+x.name));
 }
});
