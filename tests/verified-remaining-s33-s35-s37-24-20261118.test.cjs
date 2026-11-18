'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const src=require('../scripts/verified-remaining-s33-s35-s37-24-20261118.cjs');
const sourceWindow=r=>new URL(r.source).searchParams.get('round');
test('24 original Epic UUID and consecutive page evidence seals validate',()=>{
 assert.equal(src.validateProof(),true);
 assert.deepEqual(src.proof.groups.map(x=>x.rows.length),[6,6,12]);
 const originals=src.originals();
 assert.equal(new Set(originals.map(x=>x.id)).size,24);
 for(const x of originals){
  const team=Array.isArray(x.players)&&x.players.length?x.players:[x.player];
  assert.equal(x.teamAccountIds.length,team.length);
  assert.ok(x.teamAccountIds.every(id=>/^[0-9a-f]{32}$/.test(id)));
  assert.ok(src.proof.groups.some(g=>g.rows.some(o=>o.id===x.id)&&
   g.metadata.rankingOrderValid&&g.metadata.lastSeenRank>=x.rank));
 }
});
test('published 24 exactly match original rank, score, identity, payout; tampering rejected',()=>{
 const results=readResults(root).rows,ledger=read('approval-history.json').entries;
 const tournaments=read('tournaments.json'),rules=read('tournament-rules.json');
 for(const original of src.originals()){
  const row=results.find(x=>x.id===original.id),entry=ledger.find(x=>x.id===original.id);
  assert.ok(row&&entry,'missing '+original.id);
  assert.deepEqual(row,src.record(original,rules,tournaments));
  assert.equal(src.verifyPublished(row,entry),true,original.id);
  assert.equal(row.teamAccountIds,undefined);
  for(const [field,wrong] of [
   ['rank',row.rank+1],['kills',row.kills+1],['points',row.points+1],
   ['matches',row.matches+1],['vrs',row.vrs+1],['source','https://example.com'],
   ['prize',100],['player',row.player+'-FAKE']
  ])assert.equal(src.verifyPublished({...row,[field]:wrong},entry),false,original.id+'/'+field);
  assert.equal(entry.candidateSha256,src.hash(original));
  const collision=results.filter(x=>x.date===row.date&&x.region===row.region&&
   x.tournamentId===row.tournamentId&&sourceWindow(x)===sourceWindow(row)&&
   x.rank===row.rank&&x.playerRaw===row.playerRaw);
  assert.equal(collision.length,1,original.id+' duplicate source window');
 }
});
test('S35 ME cutoff 250 has one qualifier and five verified $0 attendances',()=>{
 const rows=readResults(root).rows.filter(r=>src.proof.groups[1].rows.some(x=>x.id===r.id));
 assert.equal(rows.length,6);
 assert.equal(rows.filter(x=>x.rank<=250&&x.round.endsWith('/ 予選突破')).length,1);
 assert.equal(rows.filter(x=>x.rank>250&&x.round.endsWith('/ 参加確認')).length,5);
 assert.ok(rows.every(x=>x.prize===0));
});
test('S37 NAW Event1 12 confirmed Round2 0VR teams never receive cash',()=>{
 const rows=readResults(root).rows.filter(r=>src.proof.groups[2].rows.some(x=>x.id===r.id));
 assert.equal(rows.length,12);
 assert.ok(rows.every(x=>x.vrs===0&&x.points===0&&x.prize===0&&
  x.prizePerPlayer===0&&x.teamPrize===0&&x.kind==='賞金決勝'));
});
test('S33 NAW completed six-page Round2 attendance leaves unknown cash unknown',()=>{
 const rows=readResults(root).rows.filter(r=>src.proof.groups[0].rows.some(x=>x.id===r.id));
 assert.equal(rows.length,6);
 assert.ok(rows.every(x=>x.kind==='参加確認'&&x.prize===null));
 const queue=read('history-sync-review.json').proposals;
 for(const row of rows)assert.ok(!queue.some(x=>x.id===row.id));
 // Both originally held S34 finalists now have exact source-verified Epic IDs.
 const s34=require('../scripts/verified-s34-ps-final-two-20261118.cjs');
 assert.equal(s34.validateProof(),true);
 assert.equal(queue.filter(x=>s34.IDS.includes(x.id)).length,0);
 const all=readResults(root).rows;
 assert.ok(s34.IDS.every(id=>all.some(x=>x.id===id&&x.prize===null&&x.kind==='参加確認')));
});
