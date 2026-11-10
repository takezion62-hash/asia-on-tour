'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('verified attendance is no longer a separate visual archive',()=>{
 const html=read('index.html'),app=read('app.js'),ui=read('participation-ui.js'),serve=read('scripts/serve.cjs');
 assert.ok(!html.includes('id="participation-archive"'));
 assert.ok(html.includes('id="result-table"'));
 assert.ok(html.includes('value="参加確認"'));
 assert.ok(ui.includes('const initialize=()=>{loadForPR()}'));
 assert.ok(ui.includes('renderProfile:()=>{}'));
 assert.ok(app.includes('window.AOTParticipation?.renderProfile(info.name)'));
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
 assert.ok(ui.includes('const initialize=()=>{loadForPR()}'));
 assert.ok(!read('index.html').includes('id="participation-archive"'));
 assert.ok(!read('index.html').includes('id="participation-recent-batch"'));
 assert.doesNotThrow(()=>new Function(ui));
});
