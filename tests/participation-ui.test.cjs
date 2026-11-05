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
 assert.ok(ui.includes("getMonth(chosen)")&&ui.includes('prize'));
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
