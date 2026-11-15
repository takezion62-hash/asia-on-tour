'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const {TARGETS,POLICY,validateCandidate,verifiedNonprizeRow}=
 require('../scripts/verified-reviewonly-round1-20261116.cjs');
const evidence=read('data/manual-approvals/20261116-reviewonly-10.json');
function makePublished(original,proof){
 const {reviewOnly,reviewReason,...row}=original;
 return {...row,prize:0,
  note:'Round 1は決勝進出上位'+proof.cutoff+'の圏外。賞金$0。公式規則: '+proof.rule};
}
const ledger=(p)=>({id:p.id,recordId:p.id,policy:POLICY,rule:p.rule,source:p.source,approvedAt:'2026-11-16T00:00:00.000Z'});
test('nine named zero-cash candidates are exactly checked against frozen Epic ID, round and cutoff',()=>{
 assert.equal(TARGETS.length,9);
 assert.equal(new Set(TARGETS.map(p=>p.id)).size,9);
 assert.equal(TARGETS.filter(p=>p.cutoff===50).length,4);
 assert.equal(TARGETS.filter(p=>p.cutoff===600).length,5);
 const pending=read('history-sync-review.json').proposals;
 const published=readResults(root).rows;
 for(const p of TARGETS){
  assert.ok(p.rank>p.cutoff);
  const original=pending.filter(x=>x.id===p.id),now=published.filter(x=>x.id===p.id);
  assert.equal(original.length+now.length,1,'exactly one source '+p.id);
  if(original.length){
   assert.equal(validateCandidate(original[0],p),true,p.id);
   const r=makePublished(original[0],p),e=ledger(p);
   assert.equal(verifiedNonprizeRow(r,e),true,p.id);
   assert.equal(verifiedNonprizeRow({...r,prize:100},e),false,'cash must fail '+p.id);
   assert.equal(verifiedNonprizeRow({...r,rank:r.rank+1},e),false,'altered rank fails '+p.id);
   assert.equal(verifiedNonprizeRow({...r,teamAccountIds:['a']},e),false,'altered Epic ID fails '+p.id);
   assert.equal(verifiedNonprizeRow({...r,note:'no source'},e),false,'missing rule evidence fails '+p.id);
  }else{
   const saved=read('approval-history.json').entries.filter(x=>x.id===p.id);
   assert.equal(saved.length,1);
   assert.equal(verifiedNonprizeRow(now[0],saved[0]),true,p.id);
  }
 }
});
test('2026-03-08 ME FNCS Division 1 existing 17th award stays a single $200 team result',()=>{
 const p=evidence.existing,rows=readResults(root).rows;
 const same=rows.filter(x=>x.id===p.existingId);
 assert.equal(same.length,1);
 const r=same[0];
 assert.equal(r.rank,17);
 assert.equal(r.points,132);
 assert.equal(r.kills,9);
 assert.equal(r.matches,6);
 assert.equal(r.vrs,0);
 assert.equal(r.prize,200);
 assert.equal(r.prizePerPlayer,100);
 assert.deepEqual(r.players,['meah','RiaM']);
 assert.equal(rows.filter(x=>x.id===p.candidateId).length,0);
});

test('safe manual approval executes before broad pending-review backfill in season rebuild',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/build-season-data.yml'),'utf8');
 const first='            node scripts/publish-reviewonly-round1-20261116.cjs --dry-run';
 const apply='            node scripts/publish-reviewonly-round1-20261116.cjs\n';
 const broad='            node scripts/publish-pending-review-20261114.cjs --dry-run';
 assert.equal(workflow.split(first).length-1,1,'no duplicate manual dry-run');
 assert.equal(workflow.split(apply).length-1,1,'exactly one manual publication');
 assert.ok(workflow.indexOf(first)<workflow.indexOf(apply));
 assert.ok(workflow.indexOf(apply)<workflow.indexOf(broad),
  'broad auto-backfill must not preempt nine manually checked prizes');
});
