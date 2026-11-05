'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('Auto sync panel has a working UI and asset references',()=>{
 const html=read('index.html'),js=read('auto-sync-ui.js'),css=read('auto-sync-ui.css');
 for(const id of ['auto-sync-heading','auto-sync-status','auto-sync-refresh','auto-sync-proposals'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('auto-sync-ui.js')&&html.includes('auto-sync-ui.css'));
 assert.ok(js.includes("addEventListener('click',refresh)")&&css.includes('auto-sync-control'));
});
test('No unsafe import until connected',()=>{
 const cfg=JSON.parse(read('auto-sync-config.json'));
 const status=JSON.parse(read('auto-sync-status.json'));
 assert.equal(cfg.enabled,false);assert.equal(cfg.mode,'review');assert.deepEqual(cfg.accounts,[]);assert.deepEqual(cfg.windows,[]);
 assert.equal(status.state,'setup');
});
