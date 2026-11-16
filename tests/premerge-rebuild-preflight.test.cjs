'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {parseWorkflow,runSteps,copyToTemp,inspect,retainedOrExactHeldReversal}=
 require('../scripts/premerge-rebuild-preflight.cjs');
const root=path.resolve(__dirname,'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/build-season-data.yml'),'utf8');

test('preflight always runs exact production publisher/validators in their actual order',()=>{
 const steps=parseWorkflow(workflow).map(x=>x.join(' '));
 assert.ok(steps.length>=60);
 assert.equal(steps[0],'scripts/source-results-store.cjs verify');
 assert.equal(steps.at(-1),'scripts/build-candidate-triage.cjs --check');
 const pos=x=>steps.indexOf(x);
 assert.ok(pos('scripts/publish-reviewonly-round1-20261116.cjs')<
  pos('scripts/publish-pending-review-20261114.cjs'));
 assert.ok(pos('scripts/promote-published-cash.cjs --apply')<
  pos('scripts/validate-approvals.cjs'));
 assert.ok(pos('scripts/build-season-data.cjs')<
  pos('scripts/build-season-data.cjs --check'));
});

test('known publisher-order regression fails before a PR can merge',()=>{
 const first='            node scripts/publish-reviewonly-round1-20261116.cjs\n';
 const second='            node scripts/publish-pending-review-20261114.cjs\n';
 assert.equal(workflow.split(first).length-1,1);
 assert.equal(workflow.split(second).length-1,1);
 let changed=workflow.replace(first,'##FIRST##\n').replace(second,first)
  .replace('##FIRST##\n',second);
 assert.throws(()=>parseWorkflow(changed),/ordering changed/);
});

test('unsupported shell command or missing publishing validation fails closed',()=>{
 assert.throws(()=>parseWorkflow(workflow.replace(
  '            node scripts/validate-approvals.cjs',
  '            echo bypass-audit')),/unsupported production command/);
 assert.throws(()=>parseWorkflow(workflow.replace(
  '            node scripts/validate-approvals.cjs',
  '            node scripts/validate-data.cjs')),/critical production check missing/);
 assert.throws(()=>parseWorkflow(workflow.replace(
  '            git add players.json','            git status --short')),/command boundaries missing/);
});

test('preflight stops exactly where an actual publisher fails and never runs later commands',()=>{
 const steps=parseWorkflow(workflow);
 const calls=[];
 const failed='scripts/publish-pending-review-20261114.cjs';
 const fake=(cmd,args,opts)=>{
  calls.push({cmd,args,opts});
  return {status:args[0]===failed&&args.length===1?1:0,stdout:'',stderr:'known staging collision'};
 };
 assert.throws(()=>runSteps('/tmp/safe-rebuild-sandbox',steps,fake),
  /production step \d+ failed/);
 const index=calls.findIndex(x=>x.args[0]===failed&&x.args.length===1);
 assert.ok(index>0);
 assert.equal(calls.length,index+1);
 assert.equal(calls[0].opts.cwd,'/tmp/safe-rebuild-sandbox');
});

test('disposable source copy is independent from the original files',()=>{
 const source=fs.mkdtempSync(path.join(os.tmpdir(),'aot-preflight-fixture-'));
 let clone;
 try{
  fs.mkdirSync(path.join(source,'source-results'));
  fs.writeFileSync(path.join(source,'source-results','S1.json'),'original');
  fs.mkdirSync(path.join(source,'.git'));
  fs.writeFileSync(path.join(source,'.git','config'),'ignored');
  clone=copyToTemp(source);
  assert.equal(fs.existsSync(path.join(clone,'.git')),false);
  fs.writeFileSync(path.join(clone,'source-results','S1.json'),'changed');
  assert.equal(fs.readFileSync(path.join(source,'source-results','S1.json'),'utf8'),'original');
 }finally{
  if(clone)fs.rmSync(clone,{recursive:true,force:true});
  fs.rmSync(source,{recursive:true,force:true});
 }
});

test('triage guard counts both recent and historical unresolved IDs without double counting',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aot-triage-sample-'));
 const put=(file,data)=>{
  const target=path.join(dir,file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(data)+'\n');
 };
 try{
  put('source-results/manifest.json',{count:2,recordOrder:['published','old']});
  put('history-sync-review.json',{proposals:[
   {id:'history'},{id:'dup'},{id:'published'},{id:'reviewed'}
  ]});
  put('auto-sync-review.json',{proposals:[{id:'recent'},{id:'dup'},{id:'old'}]});
  put('history-sync-reviewed.json',{entries:[{id:'reviewed'}]});
  put('approval-history.json',{entries:[{id:'one'}]});
  const info=inspect(dir);
  assert.equal(info.published,2);
  assert.equal(info.pending,3); // history, recent and duplicate ID once
  assert.equal(info.approvals,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('preflight allows only the exact original attendance record and ledger to be returned to review hold',()=>{
 const old={version:1,entries:[
  {id:'hold',recordId:'hold',source:'https://www.fortnite.com/competitive/events/X/?region=ME&round=R',
   decision:'published',policy:'attendance-only',approvedAt:'2026-11-16T05:30:00Z'},
  {id:'safe',recordId:'safe',decision:'published',policy:'verified-rule'}]};
 const next={version:1,entries:[old.entries[1]]};
 const before={recordOrder:['safe','hold']},after={recordOrder:['safe']};
 const proof={held:[{id:'hold',candidate:{id:'hold',verified:true,reviewOnly:true,
  prize:null,source:old.entries[0].source}}]};
 assert.equal(retainedOrExactHeldReversal(old,next,before,after,proof),true);
 assert.equal(retainedOrExactHeldReversal(old,old,before,before,proof),true);
 assert.equal(retainedOrExactHeldReversal(old,next,before,after,{held:[]}),false);
 assert.equal(retainedOrExactHeldReversal(old,next,before,{recordOrder:['safe','hold']},proof),false);
 assert.equal(retainedOrExactHeldReversal(old,next,{recordOrder:['safe','hold','unrelated']},after,proof),false);
 assert.equal(retainedOrExactHeldReversal(old,next,before,after,{held:[{
  id:'hold',candidate:{...proof.held[0].candidate,teamAccountIds:['forged']}}]}),false);
 assert.equal(retainedOrExactHeldReversal(old,next,before,after,{held:[{
  id:'hold',candidate:{...proof.held[0].candidate,source:'https://example.com'}}]}),false);
});
