'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('../scripts/ci-required-gate.cjs');
const full={scopeResult:'success',mode:'full',unitResult:'success',browserResult:'success',smokeResult:'skipped',focusedBrowserResult:'skipped'};
const data={scopeResult:'success',mode:'data',unitResult:'success',browserResult:'skipped',smokeResult:'success',focusedBrowserResult:'skipped'};

test('full mode approves only when every browser shard and unit pass',()=>{
 assert.equal(evaluate(full).ok,true);
 for(const browserResult of ['skipped','failure','cancelled',null])
   assert.equal(evaluate({...full,browserResult}).ok,false, String(browserResult));
 for(const smokeResult of ['success','failure','cancelled'])
   assert.equal(evaluate({...full,smokeResult}).ok,false, String(smokeResult));
});
test('data-only mode requires success of PC/mobile smoke AND skipped full browser',()=>{
 assert.equal(evaluate(data).ok,true);
 for(const smokeResult of ['skipped','failure','cancelled',null])
   assert.equal(evaluate({...data,smokeResult}).ok,false, String(smokeResult));
 for(const browserResult of ['success','failure','cancelled'])
   assert.equal(evaluate({...data,browserResult}).ok,false, String(browserResult));
});
test('unsafe classifier, missing unit, unknown mode, or no context never approves',()=>{
 for(const x of [full,data]){
   for(const scopeResult of ['failure','skipped','cancelled',null])
     assert.equal(evaluate({...x,scopeResult}).ok,false);
   for(const unitResult of ['failure','skipped','cancelled',null])
     assert.equal(evaluate({...x,unitResult}).ok,false);
   for(const mode of ['unknown','',null])
     assert.equal(evaluate({...x,mode}).ok,false);
 }
 assert.equal(evaluate({}).ok,false);
});

const focused={scopeResult:'success',mode:'focused',unitResult:'success',
 browserResult:'skipped',smokeResult:'skipped',focusedBrowserResult:'skipped',focusedBrowserRequired:'false'};
test('focused mode requires all critical validation plus optional relevant PC/mobile test',()=>{
 assert.equal(evaluate(focused).ok,true);
 const ui={...focused,focusedBrowserRequired:'true',focusedBrowserResult:'success'};
 assert.equal(evaluate(ui).ok,true);
 for(const result of ['failure','skipped','cancelled',null])
  assert.equal(evaluate({...ui,focusedBrowserResult:result}).ok,false,String(result));
 for(const value of [null,'', 'maybe'])
  assert.equal(evaluate({...focused,focusedBrowserRequired:value}).ok,false);
 assert.equal(evaluate({...focused,unitResult:'failure'}).ok,false);
 assert.equal(evaluate({...focused,browserResult:'success'}).ok,false);
 assert.equal(evaluate({...focused,smokeResult:'success'}).ok,false);
});
test('full or data modes reject unexpected focused browser results',()=>{
 assert.equal(evaluate({...full,focusedBrowserResult:'failure'}).ok,false);
 assert.equal(evaluate({...data,focusedBrowserResult:'success'}).ok,false);
});
