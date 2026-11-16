'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=require('../scripts/generic-review-only-core.cjs');
const {plan}=require('../scripts/publish-generic-review-only.cjs');
const {loadReviewDb}=require('../scripts/reviewed-publication-core.cjs');
const {audit}=require('../scripts/validate-approvals.cjs');
const manual=core.MANIFEST;
function evidence(){
 const d=loadReviewDb(root);
 d.reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8'));
 return d;
}
test('explicit approvals are bounded and refuse to infer cash for unknown formats',()=>{
 const docs=core.approvals();
 assert.equal(docs.length,11);
 assert.equal(docs.filter(a=>a.decision==='zero-round1').length,9);
 assert.equal(docs.filter(a=>a.decision==='attendance-only').length,2);
 assert.equal(manual.held.length,2);
 assert.equal(new Set(docs.map(a=>a.candidate.id)).size,docs.length);
 for(const a of docs){
  assert.equal(core.validateApproval(a),true);
  assert.equal(a.candidate.verified,true);
  assert.ok(a.candidate.teamAccountIds?.length>0);
  assert.equal(core.validateApproval({...a,candidate:{...a.candidate,rank:0}}),false,
   'invalid placement always rejected');
  assert.equal(core.validateApproval({...a,candidate:{...a.candidate,teamAccountIds:['forged']}}),false);
  assert.equal(core.validateApproval({...a,decision:'cash'}),false);
 }
 assert.equal(docs.some(a=>manual.held.some(h=>h.id===a.candidate.id)),false);
});
test('zero-cash policy is restricted to the exact approved season, region and round',()=>{
 const a=core.approvals().find(x=>x.decision==='zero-round1');
 const source=a.candidate;
 const invalid=[
  {...source,region:'EU'},
  {...source,date:'2025-02-03'},
  {...source,tournamentId:'ch6s1-other'},
  {...source,round:'Event 6 · Round 2 / 賞金決勝'},
  {...source,rank:599},
  {...source,source:source.source.replace('S33_SoloCashCup','S33_SoloCashFake')},
  {...source,prize:0},
  {...source,verified:false}
 ];
 for(const candidate of invalid)
  assert.equal(core.validateApproval({...a,candidate}),false);
 assert.equal(core.validateApproval({...a,ruleId:'nonexistent-rule'}),false);
});
test('officially approved zero-cash record is audited byte-for-byte against original snapshot',()=>{
 const a=core.approvals().find(x=>x.decision==='zero-round1');
 const r=core.convertedRow(a.candidate,a);
 const rule=core.pinnedRule(a.candidate,a.ruleId);
 const entry={id:r.id,recordId:r.id,source:r.source,policy:core.POLICY,
  decision:'published',rule:rule.url,approvedAt:'2026-11-16T03:00:00Z',
  candidateHash:core.sha(a.candidate),recordHash:core.sha(r)};
 assert.equal(core.verifyPublishedZero(r,entry,a),true);
 assert.equal(core.verifyPublishedZero({...r,prize:100},entry,a),false);
 assert.equal(core.verifyPublishedZero({...r,rank:r.rank-1},entry,a),false);
 assert.equal(core.verifyPublishedZero({...r,teamAccountIds:['forged']},entry,a),false);
 assert.equal(core.verifyPublishedZero(r,{...entry,rule:'https://example.com'},a),false);
 assert.equal(core.verifyPublishedZero(r,{...entry,recordHash:'0'.repeat(64)},a),false);
});
test('complete selected manual batch remains idempotent, cash-neutral and ledger-valid',()=>{
 const db=evidence(),before=db.results.length;
 const result=plan(db,core.approvals());
 assert.equal(result.changes.length+result.already,core.approvals().length);
 assert.equal(result.next.results.length,before+result.changes.length);
 for(const change of result.changes){
  const approval=core.approvals().find(a=>a.candidate.id===change.id);
  assert.ok(approval);
  assert.equal(change.prize,approval.decision==='zero-round1'?0:null);
 }
 assert.equal(result.changes.some(x=>x.prize>0),false);
 assert.equal(audit(result.next.results,result.next.ledger,db.players).length,0);
 const approvedIds=core.approvals().map(x=>x.candidate.id);
 assert.equal(new Set(result.next.results.filter(x=>approvedIds.includes(x.id)).map(x=>x.id)).size,11);
});
test('generic publisher runs before fallback backfill and stage-one full replay still guards it',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/build-season-data.yml'),'utf8');
 const a='node scripts/publish-generic-review-only.cjs --dry-run';
 const b='node scripts/publish-generic-review-only.cjs\n';
 const c='node scripts/publish-pending-review-20261114.cjs --dry-run';
 assert.equal(workflow.split(a).length-1,1);
 assert.equal(workflow.split(b).length-1,1);
 assert.ok(workflow.indexOf(a)<workflow.indexOf(b));
 assert.ok(workflow.indexOf(b)<workflow.indexOf(c));
 const {parseWorkflow}=require('../scripts/premerge-rebuild-preflight.cjs');
 const steps=parseWorkflow(workflow).map(tokens=>tokens.join(' '));
 assert.ok(steps.indexOf('scripts/publish-generic-review-only.cjs')<
  steps.indexOf('scripts/publish-pending-review-20261114.cjs'));
});
