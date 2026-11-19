'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-pending-22-20261119.cjs');
const {sameScannedCandidate}=require('../scripts/verified-partial-page.cjs');
test('source evidence blob fixes exactly 22 observed original ranked results and 4 windows',()=>{
 assert.equal(V.validateProof(),true);
 assert.equal(V.EXPECTED_BLOB,'0d9e6cdd72ef81b9a923fbe75543b90b9cb640f7');
 assert.deepEqual(V.SNAP.groups.map(g=>g.targetRows.length),[5,2,13,2]);
 assert.deepEqual(V.SNAP.groups.map(g=>g.checkpoint.pages),[3,3,52,96]);
 assert.deepEqual(V.SNAP.groups.map(g=>g.checkpoint.totalPages),[3,3,100,100]);
 const all=V.allRows(),ids=all.map(x=>x.id);
 assert.equal(new Set(ids).size,22);
 assert.ok(all.every(x=>x.verified===true&&x.rank>0&&x.kills>=0&&x.matches>=1));
});
test('Epic 2025 Console Round 2: exactly seven distinct duos have no victory or cash',()=>{
 const rows=V.allRows().filter(x=>x.seasonId==='S37');
 assert.equal(rows.length,7);
 assert.equal(rows.filter(x=>x.region==='NAW').length,5);
 assert.equal(rows.filter(x=>x.region==='OCE').length,2);
 assert.ok(rows.every(x=>x.vrs===0&&x.prize===null&&x.points===0&&
  x.teamAccountIds.length===2&&new Set(x.teamAccountIds).size===2));
 for(const original of rows){
  const record=V.publish(original);
  assert.equal(record.kind,'賞金決勝');assert.equal(record.prize,0);
  assert.equal(record.teamAccountIds,undefined);
  assert.ok(record.round.includes('Round 2 / 賞金決勝'));
  assert.equal(V.verifyPublished(record,V.approval(original)),true);
 }
});
test('Epic 2024 NA top 5000 rule: 12 ZB qualifiers and 3 out-of-cutoff participations',()=>{
 const rows=V.allRows().filter(x=>x.seasonId==='S30');
 assert.equal(rows.length,15);
 assert.equal(rows.filter(x=>x.tournamentId==='ch5s3-zb-solo-victory'&&x.rank<=5000).length,12);
 assert.equal(rows.filter(x=>x.rank>5000).length,3);
 for(const original of rows){
  const record=V.publish(original),expected=original.rank<=5000;
  assert.equal(record.prize,0);assert.equal(record.kind,expected?'予選':'参加確認');
  assert.ok(record.round.endsWith(expected?'予選突破':'参加確認'));
  assert.equal(record.rank,original.rank);assert.equal(record.points,original.points);
  assert.equal(record.kills,original.kills);assert.equal(record.vrs,original.vrs);
  assert.equal(V.verifyPublished(record,V.approval(original)),true);
 }
});
test('originally observed source rows still match archived pending and source checkpoint',()=>{
 const review=read('history-sync-review.json').proposals,scan=read('history-sync-scan.json').windows,
  original=readResults(ROOT).rows;
 const published=new Map(original.map(x=>[x.id,x]));
 for(const group of V.SNAP.groups){
  const cp=scan[group.key];
  for(const row of group.targetRows){
   const result=published.get(row.id);
   if(result){assert.equal(V.verifyPublished(result,read('approval-history.json').entries.find(x=>x.id===row.id)),true);continue;}
   assert.ok(cp?.proposals.some(x=>sameScannedCandidate(x,row)),row.id);
   assert.ok(review.some(x=>sameScannedCandidate(x,row)),row.id);
  }
 }
});
test('changed score, payout, member or source cannot reuse a verified approval',()=>{
 for(const original of V.allRows()){
  const row=V.publish(original),approval=V.approval(original);
  for(const [k,v] of [['rank',row.rank+1],['points',row.points+1],['kills',row.kills+1],
    ['vrs',row.vrs+1],['prize',100],['source','https://example.org'],
    ['player',row.player+' other'],['profiles',[]]]){
    assert.equal(V.verifyPublished({...row,[k]:v},approval),false,row.id+' '+k);
  }
  assert.equal(V.verifyPublished(row,{...approval,recordSha256:'altered'}),false);
 }
});
test('dry run is immutable and all pending are either absent or fully published',()=>{
 const files=['source-results/manifest.json','history-sync-review.json','approval-history.json','history-sync-reviewed.json','updates.json'];
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
 const before=files.map(sha);
 const {publish}=require('../scripts/publish-pending-22-20261119.cjs');
 const report=publish({dryRun:true});
 assert.equal(report.selected,22);assert.ok(report.added===0||report.added===22);
 assert.equal(report.added+report.already,22);assert.equal(report.newCash,0);
 assert.equal(report.qualifiers,report.added?12:0);
 assert.equal(report.attendance,report.added?3:0);
 assert.equal(report.finalZero,report.added?7:0);
 assert.deepEqual(files.map(sha),before,'dry run wrote to canonical files');
});
