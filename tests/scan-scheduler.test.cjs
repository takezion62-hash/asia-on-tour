'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {selectHistoricalWindows,selectActiveWindows}=require('../scripts/osirion-sync.cjs');
const {chooseWindows}=require('../scripts/participation-sync.cjs');
const now=Date.parse('2026-11-08T09:00:00Z');
const make=(year,series,region='ME',suffix='')=>({
 key:year+'-'+series+'-'+region+suffix,dateJst:year+'-08-01',region,series,
 kind:'予選',tournamentId:'unknown-tournament',
 end:Date.parse(year+'-08-01T02:00:00Z'),windowId:'S40_Demo_Event1Round1_'+region
});
test('historical scheduler preserves year-and-series quotas while finishing a partial board',()=>{
 const input=['2024','2025','2026'].flatMap(year=>['victory-cup','cash-cup'].map(series=>make(year,series)));
 const almost=make('2025','skin-cup','EU','-almost');
 input.push(almost);
 const state={windows:{[almost.key]:{nextPage:97,totalPages:100}}};
 const chosen=selectHistoricalWindows(input,state,{maxWindowsPerRun:9,maxPagesPerWindowPerRun:10},now,[]);
 assert.ok(chosen.some(w=>w.key===almost.key));
 for(const year of ['2024','2025','2026']){
  assert.ok(chosen.some(w=>w.dateJst.startsWith(year)&&w.series==='victory-cup'));
  assert.ok(chosen.some(w=>w.dateJst.startsWith(year)&&w.series!=='victory-cup'));
 }
});
test('recent scheduler chooses finishable pages within each series, not future retries',()=>{
 const x=make('2026','victory-cup','ME','-finish');
 const y=make('2026','victory-cup','ME','-new');
 const z=make('2026','cash-cup','NAC','-other');
 const state={windows:{[x.key]:{nextPage:18,totalPages:20},[z.key]:{retryAfter:'2030-01-01T00:00:00Z'}}};
 const chosen=selectActiveWindows([x,y,z],state,{maxWindowsPerRun:2,maxPagesPerWindowPerRun:8},now);
 assert.equal(chosen[0].key,x.key);
 assert.ok(!chosen.some(w=>w.key===z.key));
});
test('participation scheduler reserves a finishable slot after fresh and historical years',()=>{
 const recent=make('2026','skin-cup','EU','-recent');recent.end=now-3600000;recent.dateJst='2026-11-08';
 const old=make('2024','victory-cup','NAW','-old');
 const older=make('2025','cash-cup','BR','-older');
 const slow=make('2026','victory-cup','ME','-slow');slow.end=now-30*86400000;
 const almost=make('2026','cash-cup','NAC','-almost');almost.end=now-40*86400000;
 const untouched=make('2026','cash-cup','NAW','-untouched');untouched.end=now-50*86400000;
 const state={windows:{[slow.key]:{nextPage:6,totalPages:100,lastScanned:'2026-10-01T00:00:00Z'},
  [almost.key]:{nextPage:98,totalPages:100,lastScanned:'2026-11-06T00:00:00Z'}}};
 const picked=chooseWindows([recent,old,older,slow,almost,untouched],state,
  {maxWindowsPerRun:5,maxPagesPerWindowPerRun:8},now,[]);
 assert.equal(picked.length,5);
 assert.ok(picked.some(x=>x.key===old.key));
 assert.ok(picked.some(x=>x.key===older.key));
 assert.ok(picked.some(x=>x.key===almost.key));
});

test('expanded historical scanning reserves at least six never-scanned windows while finishing partial boards',()=>{
 const years=['2024','2025','2026'];
 const partial=years.flatMap(year=>['victory-cup','cash-cup'].map(series=>
   make(year,series,'ME','-in-progress')));
 const finishing=make('2025','cash-cup','EU','-finishable');
 const unseen=years.flatMap(year=>['ME','EU','NAC','NAW','OCE','BR'].map(region=>
   make(year,'fncs',region,'-unseen')));
 const state={windows:{}};
 for(const w of partial)state.windows[w.key]={nextPage:15,totalPages:100};
 state.windows[finishing.key]={nextPage:98,totalPages:100};
 const chosen=selectHistoricalWindows([...partial,finishing,...unseen],state,
  {maxWindowsPerRun:16,maxPagesPerWindowPerRun:8,minUnstartedWindowsPerRun:6},
  now,[]);
 assert.equal(chosen.length,16);
 assert.equal(new Set(chosen.map(w=>w.key)).size,chosen.length);
 assert.ok(chosen.some(w=>w.key===finishing.key),'nearly completed window remains a priority');
 assert.ok(chosen.filter(w=>!state.windows[w.key]).length>=6,'new coverage should advance');
 for(const year of years){
  assert.ok(chosen.some(w=>w.dateJst.startsWith(year)&&w.series==='victory-cup'),'yearly Victory Cup coverage');
  assert.ok(chosen.some(w=>w.dateJst.startsWith(year)&&w.series!=='victory-cup'),'yearly other-series coverage');
 }
 assert.ok(new Set(chosen.map(w=>w.region)).size>=5,'spread to multiple overseas regions');
});
test('unstarted-window quota never ignores future retry deadlines or overflows the configured limit',()=>{
 const eligible=Array.from({length:12},(_,i)=>make('2025','cash-cup','NAC','-new'+i));
 const delayed=make('2025','cash-cup','EU','-retry-later');
 const state={windows:{[delayed.key]:{retryAfter:'2030-01-01T00:00:00Z'}}};
 const chosen=selectHistoricalWindows([...eligible,delayed],state,
  {maxWindowsPerRun:7,maxPagesPerWindowPerRun:5,minUnstartedWindowsPerRun:6},
  now,[]);
 assert.equal(chosen.length,7);
 assert.ok(!chosen.some(w=>w.key===delayed.key));
 assert.equal(new Set(chosen.map(w=>w.key)).size,7);
});
