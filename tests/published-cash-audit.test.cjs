'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const {plan,verifyHistoricalPromotion}=require('../scripts/promote-published-cash.cjs');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function context(){
 return {results:readResults(root).rows,players:read('players.json'),
  tournaments:read('tournaments.json'),schedule:read('schedule.json'),
  scanDocs:[read('auto-sync-scan.json'),read('history-sync-scan.json')],
  proofs:read('data/manual-approvals/20261115-naw-trios-cash-fifth-proof.json').proofs};
}
test('published cash promotion is accepted only with exact original ledger and replayable scan proof',()=>{
 const ctx=context();
 const desired='auto-s43-3bc1ddc1b7c7';
 const before=ctx.results.find(x=>x.id===desired);
 assert.ok(before);
 if(before.kind==='賞金決勝'){
  assert.equal(before.prize,450);
  assert.equal(before.prizePerPlayer,150);
  return;
 }
 const output=plan(ctx);
 const h=output.changes.find(x=>x.id===desired);
 assert.ok(h);
 const after=output.updated.find(x=>x.id===desired);
 const entry={id:desired,recordId:desired,source:before.source,policy:'attendance-only'};
 const evidence={...ctx,results:output.updated};
 assert.equal(verifyHistoricalPromotion(after,entry,evidence,h,ctx.proofs),true);
 assert.equal(verifyHistoricalPromotion({...after,prize:600},entry,evidence,h,ctx.proofs),false);
 assert.equal(verifyHistoricalPromotion(after,entry,evidence,{...h,beforeSha256:'0'.repeat(64)},ctx.proofs),false);
 assert.equal(verifyHistoricalPromotion(after,entry,evidence,{...h,evidence:{...h.evidence,ruleSha256:'0'.repeat(64)}},ctx.proofs),false);
 assert.equal(verifyHistoricalPromotion(after,{...entry,source:'https://example.com'},evidence,h,ctx.proofs),false);
 assert.equal(h.beforeSha256,digest(before));
 assert.equal(h.afterSha256,digest(after));
 assert.equal(after.prizePerPlayer*after.players.length,after.prize);
});
