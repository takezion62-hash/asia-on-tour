'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classify}=require('../scripts/ci-change-scope.cjs');
const {select,appendOnlyPublisher,CORE}=require('../scripts/ci-focused-scope.cjs');
const {tokens}=require('../scripts/ci-focused-tests.cjs');
const changed=(...paths)=>paths.map(path=>({status:'M',path}));
const pub='scripts/apply-nov15-nac-ps-naw-nine.cjs';
const oracle='scripts/verified-nov15-nac-ps-naw-nine.cjs';
const proof='data/manual-approvals/20261115-nac-s29-ps-s36-naw-s37-nine-proof.json';
const testfile='tests/nov15-nac-ps-naw-nine.test.cjs';

test('identity/cash publisher changes run only their test and mandatory safety oracles',()=>{
 const selection=classify(changed(pub,oracle,proof,testfile,'scripts/validate-approvals.cjs'));
 assert.equal(selection.mode,'focused');
 assert.equal(selection.browserFiles.length,0);
 assert.deepEqual(selection.publisherFiles,[pub]);
 assert.ok(selection.unitFiles.includes(testfile));
 for(const file of CORE)assert.ok(selection.unitFiles.includes(file),file);
 assert.equal(selection.unitFiles.includes('tests/workflow-inventory.test.cjs'),false);
});
test('UI changes run related browser spec in BOTH device projects, not whole suite',()=>{
 const result=classify(changed('source-rules.js','tests/source-rules.spec.cjs'));
 assert.equal(result.mode,'focused');
 assert.deepEqual(result.browserFiles,['tests/source-rules.spec.cjs']);
 assert.equal(classify(changed('app.js')).mode,'full','unknown globally coupled site JS');
});
test('unknown files, orphan evidence, missing test and mixed source data fail closed',()=>{
 assert.equal(classify(changed(proof)).mode,'full');
 assert.equal(classify(changed('scripts/apply-unknown-batch-999.cjs')).mode,'full');
 assert.equal(classify(changed('scripts/ci-focused-tests.cjs')).mode,'full');
 assert.equal(classify(changed('source-results/S37.json',pub,testfile)).mode,'full');
 assert.equal(classify(changed('.github/workflows/build-season-data.yml',pub,testfile)).mode,'full',
  'deployment YAML change must prove its exact append-only diff');
});
test('publisher workflow permits exact append-only watched publisher/dry-run/apply pairs',()=>{
 const before='name: Rebuild\non:\n  push:\n';
 const after='name: Rebuild\non:\n'+
  '      - '+pub+'\n'+
  '            node '+pub+' --dry-run\n'+
  '            node '+pub+'\n'+
  '  push:\n';
 assert.equal(appendOnlyPublisher(before,after,[pub]),true);
 const files=changed(pub,oracle,proof,testfile,'.github/workflows/build-season-data.yml');
 assert.equal(classify(files,{workflowBefore:before,workflowAfter:after}).mode,'focused');
 assert.equal(appendOnlyPublisher(before,after.replace('            node '+pub+' --dry-run\n',''),[pub]),false);
 assert.equal(appendOnlyPublisher(before,after.replace('name: Rebuild','name: hacked'),[pub]),false);
 assert.equal(appendOnlyPublisher(before,after.replace('  push:','  workflow_dispatch:'),[pub]),false);
 assert.equal(appendOnlyPublisher(before,after.replace('      - '+pub,'      - scripts/ci-change-scope.cjs'),[pub]),false);
});
test('related test selection cannot inject shell commands or silently skip all tests',()=>{
 assert.deepEqual(tokens('unit',testfile),[testfile]);
 assert.throws(()=>tokens('unit',''));
 assert.throws(()=>tokens('publisher','scripts/apply-foo.cjs;exit'));
 assert.throws(()=>tokens('unit','tests/../../../etc/passwd.test.cjs'));
 assert.throws(()=>tokens('browser','tests/nonexistent.spec.cjs'));
 assert.equal(select(changed('tests/ci-required-gate.test.cjs')).mode,'focused');
 assert.equal(select(changed('tests/workflow-inventory.test.cjs')).mode,'focused');
});
