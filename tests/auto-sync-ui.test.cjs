'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('Auto sync panel has a working UI and asset references',()=>{
 const html=read('index.html'),js=read('auto-sync-ui.js'),css=read('auto-sync-ui.css');
 for(const id of ['auto-sync-heading','auto-sync-status','auto-sync-refresh','auto-sync-proposals'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('auto-sync-ui.js')&&html.includes('auto-sync-ui.css'));
 assert.ok(js.includes("addEventListener('click',refresh)")&&css.includes('auto-sync-control'));
 assert.doesNotThrow(()=>new Function(js),'auto-sync UI must remain valid browser JavaScript');
});
test('Live AUTO SYNC remains in review-only mode and the browser cannot publish results',()=>{
 const cfg=JSON.parse(read('auto-sync-config.json'));
 const status=JSON.parse(read('auto-sync-status.json'));
 const ui=read('auto-sync-ui.js');
 assert.equal(cfg.enabled,true);
 assert.equal(cfg.provider,'osirion');
 assert.equal(cfg.mode,'review');
 assert.deepEqual(cfg.accounts,[]);
 assert.deepEqual(cfg.windows,[]);
 assert.equal(status.mode,'review');
 assert.ok(['setup','checked'].includes(status.state));
 assert.ok(ui.includes("new URL('auto-sync-review.json',base)"));
 assert.ok(!/fetch\([^;]*method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(ui));
});

test('both panels display incomplete coverage and overdue retry counts',()=>{
 const js=read('auto-sync-ui.js');
 assert.ok(js.includes('appendCoverage(area,s.coverage)'));
 assert.ok(js.includes('appendCoverage(historyArea,status.coverage)'));
 assert.ok(js.includes('再試行期限到来'));
});
