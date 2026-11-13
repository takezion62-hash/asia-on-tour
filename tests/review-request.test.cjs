'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateRequest}=require('../scripts/review-request-core.cjs');
const base='a'.repeat(40),head='b'.repeat(40),id='r20261113-abcdef';
const now=Date.parse('2026-11-13T06:10:00.000Z');
const ctx={ref:'refs/heads/ops/review-request/'+id,mainSha:base,
 headSha:head,parentSha:base,changedFiles:['review-requests/launch.json'],now};
const req={version:1,action:'publish-verified-batch',id,confirmation:'CONFIRM',
 limit:100,baseSha:base,requestedAt:'2026-11-13T06:08:00.000Z'};
test('one authorized, single-file, single-commit request is accepted',()=>{
 assert.deepEqual(validateRequest(req,ctx),{id,limit:100,baseSha:base,ids:[]});
 assert.deepEqual(validateRequest({...req,limit:1,
  candidateIds:['auto-s30-123456789abc']},ctx).ids,['auto-s30-123456789abc']);
});
test('unknown fields, missing confirmation, injected command and oversized requests fail closed',()=>{
 for(const patch of [{confirmation:'NO'},{version:2},{action:'shell'},
  {limit:101},{limit:0},{limit:1.5},{candidateIds:['../evil']},
  {candidateIds:['auto-s30-123456789abc','auto-s30-123456789abc']},
  {candidateIds:['auto-s30-123456789abc'],limit:0},
  {id:'some-branch'},{script:'node evil'}]){
  assert.throws(()=>validateRequest({...req,...patch},ctx),/REVIEW_REQUEST/);
 }
});
test('stale main, mismatched branch, untrusted code edits and non-direct commits are rejected',()=>{
 for(const patch of [{mainSha:'c'.repeat(40)},{ref:'refs/heads/main'},
  {headSha:'0'.repeat(40)},{parentSha:'d'.repeat(40)},
  {changedFiles:['review-requests/launch.json','scripts/ci-change-scope.cjs']},
  {changedFiles:[]},{now:now+4*3600000}]){
  assert.throws(()=>validateRequest(req,{...ctx,...patch}),/REVIEW_REQUEST/);
 }
 assert.throws(()=>validateRequest({...req,requestedAt:'2025-01-01T00:00:00.000Z'},ctx),/REVIEW_REQUEST/);
});

// Regression guard for GitHub repositories that do not allow Actions tokens
// to create PRs: preserve the verified branch without hiding other failures.
test('verified-result request falls back to connected App PR only on bot permission denial',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/reviewed-candidate-publication.yml'),'utf8');
 assert.match(workflow,/GitHub Actions is not permitted to create or approve pull requests/);
 assert.match(workflow,/AOT_FAST_REQUEST app-pr-needed=\\$BRANCH/);
 assert.match(workflow,/cat "\\$PR_ERR" >&2\\s+exit 1/);
 assert.match(workflow,/gh workflow run tests\\.yml/);
 assert.match(workflow,/pull_request event must pass required CI before merging/);
});
