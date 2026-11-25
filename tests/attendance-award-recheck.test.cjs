'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../scripts/attendance-award-recheck.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const rule=read('tournament-rules.json').rules.find(r=>r.id==='ch7s5-playstation-cup-zero-build');
const row={id:'example',kind:'参加確認',round:'Qualifier / 参加確認',verified:true,prize:null,rank:80,region:'OCE',tournamentId:rule.id};
test('qualifying cutoff and positive official prizes only, never outside-cutoff or previously confirmed cash',()=>{
 assert.equal(M.route(row).kind,'qualifier');assert.equal(M.route({...row,rank:81}),null);
 assert.equal(M.route({...row,rank:0}),null);assert.equal(M.route({...row,kind:'予選',prize:0}),null);
 assert.equal(M.route({...row,round:'Final / 参加確認',rank:25}).kind,'cash');
 assert.equal(M.route({...row,round:'Final / 参加確認',rank:26}),null);
 assert.equal(M.route({...row,round:'Qualifier / 参加確認',rank:12,prize:0}),null);
});
test('only a complete, mature, exact saved prefix covering the official cutoff can correct a qualifier; cash requires all pages',()=>{
 const candidate={...row,reviewOnly:true,teamAccountIds:['a'.repeat(32)]};
 const cp={complete:true,rankingOrderValid:true,epicIdsRetained:true,pages:2,nextPage:2,totalPages:40,lastSeenRank:200,lastSuccessAt:'2026-11-24T02:00:00Z',proposals:[candidate]};
 const slot={endUtc:'2026-11-23T10:00:00Z'},now=Date.parse('2026-11-25T05:00:00Z');
 assert.ok(M.checkpointProof(cp,row,'qualifier',rule,slot,now));
 assert.equal(M.checkpointProof(cp,row,'cash',rule,slot,now),null);
 for(const bad of [{...cp,complete:false},{...cp,pages:1},{...cp,lastSeenRank:79},{...cp,retryAfter:'2026-11-26T00:00:00Z'},{...cp,lastSuccessAt:'2026-11-23T10:01:00Z'},{...cp,proposals:[{...candidate,rank:79}]},{...cp,proposals:[candidate,candidate]}])
  assert.equal(M.checkpointProof(bad,row,'qualifier',rule,slot,now),null);
});
test('production dry run checks actual saved evidence, preserves all IDs and leaves source and approval files untouched',()=>{
 const manifest='source-results/manifest.json',ledger='approval-history.json';
 const before=[manifest,ledger,M.HISTORY].map(n=>fs.existsSync(path.join(ROOT,n))?fs.readFileSync(path.join(ROOT,n),'utf8'):null);
 const context=M.loadContext(ROOT),out=M.run(ROOT,{dryRun:true});
 assert.deepEqual(out.results.map(r=>r.id),context.results.map(r=>r.id));
 const ids=new Set(out.changes.map(h=>h.id)),entries=new Map(read(ledger).entries.map(e=>[e.recordId,e]));
 for(let i=0;i<out.results.length;i++){
  const old=context.results[i],r=out.results[i];
  if(!ids.has(r.id)){assert.deepEqual(r,old);continue}
  assert.equal(old.kind,'参加確認');assert.equal(old.prize,null);
  for(const k of ['rank','points','kills','matches','vrs','player','source','teamAccountIds'])assert.deepEqual(r[k],old[k]);
  assert.ok(M.verifyPromotion(r,entries.get(r.id),{...context,results:out.results},out.history));
  assert.equal(M.verifyPromotion({...r,prize:r.prize+100},entries.get(r.id),{...context,results:out.results},out.history),false);
 }
 assert.deepEqual([manifest,ledger,M.HISTORY].map(n=>fs.existsSync(path.join(ROOT,n))?fs.readFileSync(path.join(ROOT,n),'utf8'):null),before);
});
