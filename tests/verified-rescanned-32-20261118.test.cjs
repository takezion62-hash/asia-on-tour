'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const source=require('../scripts/verified-rescanned-32-20261118.cjs');
test('32 original Epic account ID + rank + score evidence blob is immutable',()=>{
 assert.equal(source.validateProof(),true);
 assert.equal(source.proof.verified.length,32);
 assert.equal(source.proof.apiPagesAttempted,19);
 assert.equal(source.proof.apiPageErrors,0);
 assert.equal(source.proof.held.length,0);
 assert.deepEqual(source.GROUPS.map(g=>source.proof.verified.filter(p=>p.windowKey===g.key).length),[4,14,14]);
 const ids=new Set(source.proof.verified.map(p=>p.original.id));
 assert.equal(ids.size,32);
 for(const p of source.proof.verified){
  const r=p.original;
  assert.equal(p.observedPage,Math.floor((r.rank-1)/100));
  assert.ok(p.teamAccountIds.every(x=>/^[0-9a-f]{32}$/.test(x)));
  assert.ok(p.teamAccountIds.length===1||p.teamAccountIds.length===2);
 }
});
test('All 32 published rounds preserve exact source IDs, cash, kills, matches, and proof replay',()=>{
 const rows=readResults(root).rows;
 const ledger=read('approval-history.json').entries;
 const published=read('history-sync-reviewed.json').entries;
 for(const p of source.proof.verified){
  const r=rows.find(x=>x.id===p.original.id),e=ledger.find(x=>x.id===p.original.id);
  assert.ok(r&&e,p.original.id);
  assert.equal(source.verifyPublished(r,e),true,p.original.id);
  assert.deepEqual(r,source.published(p,read('tournament-rules.json'),read('tournaments.json')));
  assert.equal(r.teamAccountIds,undefined);
  assert.equal(r.rank,p.original.rank);
  assert.equal(r.kills,p.original.kills);
  assert.equal(r.points,p.original.points);
  assert.equal(r.matches,p.original.matches);
  assert.equal(r.vrs,p.original.vrs);
  assert.equal(r.prize,0);
  assert.equal(published.filter(x=>x.id===r.id&&x.decision==='published').length,1);
  for(const [field,wrong] of [['rank',r.rank+1],['kills',r.kills+1],
   ['vrs',r.vrs+1],['prize',100],['source','https://example.org'],
   ['player',r.player+' FAKE'],['matches',r.matches+1]]){
   assert.equal(source.verifyPublished({...r,[field]:wrong},e),false,r.id+':'+field);
  }
 }
});
test('S37 NAW top250 only: four Round2 qualifiers, ten $0 attendances; S30 NAC only attendance',()=>{
 const rows=readResults(root).rows.filter(x=>source.IDS.includes(x.id));
 assert.equal(rows.length,32);
 const s37=rows.filter(x=>x.seasonId==='S37');
 assert.equal(s37.length,14);
 assert.equal(s37.filter(x=>x.kind==='予選'&&x.round.endsWith('予選突破')).length,4);
 assert.equal(s37.filter(x=>x.kind==='参加確認'&&x.round.endsWith('参加確認')).length,10);
 assert.ok(s37.every(x=>x.prize===0&&(x.rank<=250?x.kind==='予選':x.kind==='参加確認')));
 const s30=rows.filter(x=>x.seasonId==='S30');
 assert.equal(s30.length,18);
 assert.ok(s30.every(x=>x.kind==='参加確認'&&x.prize===0&&!x.round.includes('予選突破')));
 const remaining=read('history-sync-review.json').proposals;
 assert.ok(remaining.length<=20);
 assert.ok(remaining.every(x=>!source.IDS.includes(x.id)));
 assert.ok(remaining.filter(x=>x.tournamentId==='ch6s2-playstation-cup').length<=2);
});
