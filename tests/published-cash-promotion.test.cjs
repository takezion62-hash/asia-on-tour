'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const {plan,matchPublished,sourceWindow,independentlyVerified}=require('../scripts/promote-published-cash.cjs');
const TARGET='auto-s43-3bc1ddc1b7c7';
const proof=read('data/manual-approvals/20261115-naw-trios-cash-fifth-proof.json').proofs[0];
const rules=read('tournament-rules.json').rules;
const rule=rules.find(r=>r.id===proof.tournamentId);
const scan=read('auto-sync-scan.json');
const key='epicgames_S43_TriosCashCup_NAW/S43_TriosCashCup_Event2_NAW';
function inputs(){
 return {results:readResults(root).rows,players:read('players.json'),
  tournaments:read('tournaments.json'),schedule:read('schedule.json'),
  scanDocs:[scan,read('history-sync-scan.json')],proofs:[proof]};
}
test('NAW fifth place has exact, named, separate tournament and Epic-ID proof',()=>{
 const candidate=scan.windows[key].proposals.find(r=>r.id===TARGET);
 assert.ok(candidate);
 assert.equal(candidate.rank,5);
 assert.equal(candidate.points,441);
 assert.equal(candidate.kills,90);
 assert.equal(candidate.vrs,2);
 assert.equal(candidate.matches,9);
 assert.equal(candidate.teamAccountIds.length,3);
 assert.equal(proof.perPlayerUSD,150);
 assert.deepEqual(candidate.players,['ちからV2','kumo','Mofu']);
 const record=readResults(root).rows.find(r=>r.id===TARGET);
 assert.ok(record);
 if(record.kind==='参加確認'){
  assert.ok(matchPublished(record,candidate));
  const win=sourceWindow(record,rule,read('schedule.json'));
  assert.ok(win);
  assert.equal(win.key,key);
  assert.equal(scan.windows[key].complete,false);
  assert.equal(independentlyVerified(proof,record,candidate,win,scan.windows[key],rule),true);
  assert.equal(independentlyVerified({...proof,perPlayerUSD:300},record,candidate,win,scan.windows[key],rule),false);
  assert.equal(independentlyVerified({...proof,kills:91},record,candidate,win,scan.windows[key],rule),false);
  assert.equal(independentlyVerified({...proof,teamAccountIds:['bad']},record,candidate,win,scan.windows[key],rule),false);
 }else{
  assert.equal(record.kind,'賞金決勝');
  assert.equal(record.prize,450);
  assert.equal(record.prizePerPlayer,150);
 }
});
test('promotion keeps the same public ID and awards USD150 to each of three players once',()=>{
 const p=inputs(),before=p.results.find(r=>r.id===TARGET);
 const output=plan(p);
 const after=output.updated.find(r=>r.id===TARGET);
 assert.equal(output.updated.length,p.results.length);
 assert.equal(new Set(output.updated.map(r=>r.id)).size,p.results.length);
 assert.equal(after.id,before.id);
 assert.equal(after.rank,5);
 assert.equal(after.points,441);
 assert.equal(after.kills,90);
 assert.equal(after.vrs,2);
 assert.equal(after.matches,9);
 if(before.kind==='参加確認'){
  assert.equal(after.kind,'賞金決勝');
  assert.equal(after.prize,450);
  assert.equal(after.prizePerPlayer,150);
  assert.equal(output.changes[0].id,TARGET);
  // The proof cannot be weakened by amending amounts or the roster.
  const wrong=plan({...p,proofs:[{...proof,points:440}]});
  assert.equal(wrong.updated.find(r=>r.id===TARGET).prize,null);
 }else{
  assert.equal(before.kind,'賞金決勝');
  assert.equal(before.prize,450);
  assert.equal(after.prize,450);
  assert.ok(!output.changes.some(x=>x.id===TARGET));
 }
});
