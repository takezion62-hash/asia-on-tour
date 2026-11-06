'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'schedule.json'),'utf8'));
const results=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
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
