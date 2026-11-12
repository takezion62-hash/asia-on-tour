'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('participation panel is separate from money-backed results and has lazy player profile hook',()=>{
 const html=read('index.html'),app=read('app.js'),ui=read('participation-ui.js');
 const { buildFileMap } = require('../scripts/serve.cjs');
 const publicRoutes = buildFileMap(root);
 for(const id of ['participation-archive','participation-month','participation-search','participation-region','participation-table','participation-status']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes('participation-ui.js')&&html.includes('participation.css'));
 assert.ok(app.includes('window.AOTParticipation?.renderProfile(info.name)'));
 assert.ok(ui.includes('getMonth(chosen)')&&ui.includes('getIndex()'));
 assert.doesNotMatch(ui,/load\(['\"]results\.json['\"]\)|AotPR\.calculate|prizePerPlayer/,'participation browsing must remain separate from prize/PR calculations');
 assert.equal(publicRoutes.get('/participation-index.json'), 'participation-index.json');
 assert.equal(publicRoutes.get('/participation/2026-10.json'), 'participation/2026-10.json');
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

test('2026-10-17 NAW qualifiers are present without duplicated or invented prizes',()=>{
 const ui=read('participation-ui.js'),archive=JSON.parse(read('participation/2026-10.json'));
 const results=JSON.parse(read('results.json'));
 const expected=[
  {name:'RyoIT',rank:341,points:298,kills:23,vrs:2,verified:true},
  {name:'ろず',rank:339,points:299,kills:14,vrs:0,verified:true},
  {name:'シルス',rank:null,points:null,kills:null,vrs:null,verified:false}
 ];
 for(const x of expected){
  const rows=results.filter(r=>r.date==='2026-10-17'&&r.region==='NAW'&&r.player===x.name&&
   r.tournamentId==='ch7s4-solo-reload-victory-cup'&&r.round==='Event 4 · Round 1 / 予選');
  assert.equal(rows.length,1,x.name+' is listed once');
  for(const k of ['rank','points','kills','vrs','verified'])assert.equal(rows[0][k],x[k],x.name+' '+k);
  assert.equal(rows[0].prize,null);
  assert.equal(rows[0].kind,'予選');
  if(!x.verified)assert.equal(rows[0].reported,true);
  assert.equal(archive.entries.filter(r=>r.date===rows[0].date&&r.region===rows[0].region&&r.player===x.name&&r.round===rows[0].round).length,0,
   x.name+' must not duplicate the archived participation');
 }
 assert.ok(ui.includes("function searchFromMainResults()"));
 assert.ok(ui.includes("search.addEventListener('input',searchFromMainResults)"));
 assert.ok(ui.includes("host.id='participation-main-search'"));
 assert.ok(ui.includes("buildTable(visible)"));
 assert.ok(ui.includes("data-participation-month-open"));
 assert.ok(!ui.includes("participation-recent-batch"));
 assert.ok(!ui.includes("participation-all-records"));
 assert.doesNotThrow(()=>new Function(ui));
});
