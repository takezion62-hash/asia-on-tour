'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const evidence=require('../scripts/verified-rescanned-18-20261118.cjs');
test('Pinned 18 Epic original UUIDs, source page range and score agree',()=>{
 assert.equal(evidence.validateProof(),true);
 assert.equal(evidence.proof.verified.length,18);
 assert.equal(evidence.proof.apiPagesAttempted,12);
 assert.equal(evidence.proof.apiPageErrors,0);
 assert.equal(evidence.proof.held.length,0);
 assert.deepEqual(evidence.GROUPS.map(g=>evidence.proof.verified.filter(p=>p.windowKey===g.key).length),[14,2,2]);
 const ids=new Set(evidence.proof.verified.map(p=>p.original.id));
 assert.equal(ids.size,18);
 for(const p of evidence.proof.verified){
  assert.equal(p.observedPage,Math.floor((p.original.rank-1)/100));
  assert.equal(p.teamAccountIds.length,p.original.seasonId==='S30'?1:2);
  assert.ok(p.teamAccountIds.every(x=>/^[0-9a-f]{32}$/.test(x)));
 }
});
test('18 original Epic results, permanent approval and tamper detection',()=>{
 const rows=readResults(root).rows,ledger=read('approval-history.json').entries;
 const reviewed=read('history-sync-reviewed.json').entries;
 for(const p of evidence.proof.verified){
  const r=rows.find(x=>x.id===p.original.id),e=ledger.find(x=>x.id===p.original.id);
  assert.ok(r&&e,p.original.id);
  assert.equal(evidence.verifyPublished(r,e),true,p.original.id);
  assert.deepEqual(r,evidence.published(p,read('tournament-rules.json'),read('tournaments.json')));
  assert.equal(r.teamAccountIds,undefined);
  assert.equal(r.rank,p.original.rank);
  assert.equal(r.kills,p.original.kills);
  assert.equal(r.vrs,p.original.vrs);
  assert.equal(r.matches,p.original.matches);
  assert.equal(r.points,p.original.points);
  assert.equal(r.prize,0);
  assert.equal(reviewed.filter(x=>x.id===r.id&&x.decision==='published').length,1);
  for(const [field,wrong] of [['rank',r.rank+1],['kills',r.kills+1],
   ['vrs',r.vrs+1],['prize',200],['source','https://example.org'],
   ['player',r.player+' fake'],['matches',r.matches+1]]){
   assert.equal(evidence.verifyPublished({...r,[field]:wrong},e),false,r.id+' '+field);
  }
 }
});
test('S30 14 and S35 2 attendance plus S37 two 0VR cash-free finals; two held PlayStation',()=>{
 const rows=readResults(root).rows.filter(x=>evidence.IDS.includes(x.id));
 assert.equal(rows.length,18);
 const s30=rows.filter(x=>x.seasonId==='S30'),s35=rows.filter(x=>x.seasonId==='S35'),s37=rows.filter(x=>x.seasonId==='S37');
 assert.equal(s30.length,14);assert.equal(s35.length,2);assert.equal(s37.length,2);
 assert.ok([...s30,...s35].every(x=>x.kind==='参加確認'&&x.prize===0&&x.round.endsWith('参加確認')));
 assert.ok(s37.every(x=>x.kind==='賞金決勝'&&x.vrs===0&&x.prize===0&&x.points===0));
 const remaining=read('history-sync-review.json').proposals;
 assert.ok(remaining.length<=2);
 assert.ok(remaining.every(x=>x.seasonId==='S34'&&x.tournamentId==='ch6s2-playstation-cup'));
 assert.ok(remaining.every(x=>!evidence.IDS.includes(x.id)));
 const update=read('updates.json').entries.find(x=>x.id==='verified-original-epic-followup18-20261118');
 assert.equal(update.recordIds.length,18);
});