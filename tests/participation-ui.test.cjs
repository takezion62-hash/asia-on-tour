'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('participation panel is separate from money-backed results and has lazy player profile hook',()=>{
 const html=read('index.html'),app=read('app.js'),ui=read('participation-ui.js'),serve=read('scripts/serve.cjs');
 for(const id of ['participation-archive','participation-month','participation-search','participation-region','participation-table','participation-status']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes('participation-ui.js')&&html.includes('participation.css'));
 assert.ok(app.includes('window.AOTParticipation?.renderProfile(info.name)'));
 assert.ok(ui.includes('getMonth(chosen)')&&ui.includes('getIndex()'));
 assert.doesNotMatch(ui,/load\(['\"]results\.json['\"]\)|AotPR\.calculate|prizePerPlayer/,'participation browsing must remain separate from prize/PR calculations');
 assert.ok(serve.includes("'participation-index.json'")&&serve.includes("'/participation/'"));
 assert.doesNotThrow(()=>new Function(ui));
 assert.doesNotThrow(()=>new Function(app));
});
test('the participation index is a distinct valid schema and cannot masquerade as published results',()=>{
 const index=JSON.parse(read('participation-index.json'));
 assert.equal(index.version,1);
 assert.ok(Array.isArray(index.months));
 assert.ok(Array.isArray(index.players));
 assert.ok(Number.isSafeInteger(index.total)&&index.total>=0);
 const status=JSON.parse(read('participation-status.json'));
 assert.equal(status.version,1);
 const config=JSON.parse(read('participation-config.json'));
 assert.equal(config.enabled,true);
 assert.ok(config.maxPagesPerRun<=40);
 assert.ok(config.maxPagesPerWindowTotal<=100);
});

test('the Oct 17 NAW Reload trio is visible from the main results search without claiming qualification',()=>{
 const ui=read('participation-ui.js');
 const archive=JSON.parse(read('participation/2026-10.json'));
 const results=JSON.parse(read('results.json'));
 const expected=[
  {name:'RyoIT',rank:341,points:298,kills:23,vrs:2,matches:7},
  {name:'ろず',rank:339,points:299,kills:14,vrs:0,matches:8},
  {name:'シルス',rank:342,points:298,kills:20,vrs:2,matches:7}
 ];
 for(const e of expected){
  const matches=archive.entries.filter(r=>r.date==='2026-10-17'&&r.region==='NAW'&&r.player===e.name&&
    r.tournamentId==='ch7s4-solo-reload-victory-cup'&&r.round==='Event 4 · Round 1 / 予選');
  assert.equal(matches.length,1,e.name+' should be archived exactly once');
  const row=matches[0];
  for(const key of ['rank','points','kills','vrs','matches'])assert.equal(row[key],e[key],e.name+' '+key);
  assert.equal(row.qualification,'outside-cutoff');
  assert.equal(row.officialCutoff,320);
  assert.equal(row.prize,null);
  assert.equal(results.filter(r=>r.date===row.date&&r.region===row.region&&
   r.tournamentId===row.tournamentId&&r.player===row.player&&r.rank===row.rank).length,0,
   e.name+' must not be double-counted as a prize-backed result');
 }
 assert.ok(ui.includes("function searchFromMainResults()"));
 assert.ok(ui.includes("search.addEventListener('input',searchFromMainResults)"));
 assert.ok(ui.includes("host.id='participation-main-search'"));
 assert.ok(ui.includes("buildTable(sortRows(rows))"));
 assert.ok(ui.includes("data-participation-search"));
 assert.ok(ui.includes("[r.date,r.event,r.player"),'month archive must support exact event dates');
 assert.ok(!ui.includes(' · NAC Unreal Cup · 最終順位は確認中'),
  'current event label must not be hardcoded to an unrelated tournament');
 assert.doesNotThrow(()=>new Function(ui));
});
