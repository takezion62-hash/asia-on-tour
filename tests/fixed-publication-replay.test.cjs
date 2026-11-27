'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SPECS,allowed,blobHash,noOp,replay,snapshot}=require('../scripts/fixed-publication-replay.cjs');
const {parseWorkflow}=require('../scripts/premerge-rebuild-preflight.cjs');
const {FIXED,inventory}=require('../scripts/publication-inventory.cjs');
const root=path.resolve(__dirname,'..');
const script='scripts/apply-mobile-eu-nac-20261126.cjs',spec=SPECS[script];
const output=spec.label+' '+JSON.stringify({dry:true,added:0,already:10,existing:[],prize:0,rows:[]});
function trial({stdout=output,prove=()=>true,force=false,verify=false,read=p=>fs.readFileSync(path.join(root,p)),capture=()=> 'same',status=0,target=script}={}){
 const calls=[];
 const result=replay(target,{read,prove,force,verify,capture,log:()=>{},run:(_cmd,args)=>{
  calls.push(args);return {status,stdout};
 }});
 return {calls,result};
}
test('validated, exact completed fixed batch skips only its second invocation',()=>{
 const {calls,result}=trial();
 assert.deepEqual(calls,[[script,'--dry-run']]);
 assert.equal(result.skippedApply,true);
 assert.equal(result.validatedDryRun,true);
});
test('changed source, incomplete evidence, forced replay and invalid summaries retain original apply',()=>{
 for(const options of [{read:()=>Buffer.from('changed')},{prove:()=>false},{prove:()=>{throw Error('missing proof')}},
  {force:true},{stdout:'not a report'},{stdout:output+'\n'+output},
  {stdout:output.replace('"added":0','"added":1')},{stdout:output.replace('"already":10','"already":9')},
  {stdout:output.replace('"dry":true','"dry":false')},{stdout:output.replace('"existing":[]','"existing":["other"]')}]) {
  const {calls,result}=trial(options);
  assert.deepEqual(calls,[[script,'--dry-run'],[script,'--apply']]);
  assert.equal(result.skippedApply,false);
 }
 assert.throws(()=>trial({status:1}),/failed/);
 assert.throws(()=>trial({target:'scripts/unknown.cjs'}),/unknown script/);
});
test('isolated rehearsal compares original apply with the no-op state and fails on any change',()=>{
 const {calls,result}=trial({verify:true});
 assert.deepEqual(calls,[[script,'--dry-run'],[script,'--apply']]);
 assert.equal(result.verifiedEquivalent,true);
 assert.equal(result.skippedApply,false);
 let n=0;
 assert.throws(()=>trial({verify:true,capture:()=>String(n++)}),/equivalence failed/);
});
test('all reviewed scripts have exact source pins and preserve original preflight order',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/build-season-data.yml'),'utf8');
 const steps=parseWorkflow(workflow);
 assert.deepEqual(Object.keys(SPECS).sort(),FIXED.map(x=>x.script).sort());
 for(const [p,s] of Object.entries(SPECS)){
  assert.equal(blobHash(fs.readFileSync(path.join(root,p))),s.blob,p);
  assert.equal(steps.filter(x=>x[0]==='scripts/fixed-publication-replay.cjs'&&x[1]===p).length,1);
  assert.equal(steps.filter(x=>x[0]===p).length,0);
  assert.ok(steps.findIndex(x=>x[1]===p)<steps.findIndex(x=>x[0]==='scripts/validate-approvals.cjs'));
 }
 assert.ok(!allowed('scripts/../scripts/apply-mobile-eu-nac-20261126.cjs'));
 assert.throws(()=>parseWorkflow(workflow.replace('scripts/fixed-publication-replay.cjs '+script,
  'scripts/fixed-publication-replay.cjs scripts/unknown.cjs')),/unsafe fixed replay target/);
 assert.equal(inventory({'build-season-data.yml':workflow}).filter(x=>allowed(x.script)).length,10);
});
test('snapshot detects changed bytes, additions and removals',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'aot-fixed-replay-'));
 try{
  fs.writeFileSync(path.join(tmp,'a.json'),'{}');
  const before=snapshot(tmp);
  fs.writeFileSync(path.join(tmp,'a.json'),'[]');
  assert.notEqual(snapshot(tmp),before);
  fs.writeFileSync(path.join(tmp,'a.json'),'{}');
  assert.equal(snapshot(tmp),before);
  fs.writeFileSync(path.join(tmp,'b.json'),'{}');
  assert.notEqual(snapshot(tmp),before);
  fs.unlinkSync(path.join(tmp,'b.json'));
  assert.equal(snapshot(tmp),before);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
