'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect,audit}=require('../scripts/audit-held-publication.cjs');
const {MANIFEST}=require('../scripts/generic-review-only-core.cjs');

const ids=MANIFEST.held.map(h=>h.id);
function clean(){
 return {
  manifest:structuredClone(MANIFEST),
  sourceRows:[{id:'safe-record'}],
  seasonShards:[{file:'season-data/S34.json',rows:[{id:'safe-record'}]}],
  updates:{entries:[{id:'safe-news',recordIds:['safe-record']}]},
  ledger:{entries:[{id:'safe-record',recordId:'safe-record'}]},
  reviewed:{entries:[{id:'safe-record',recordId:'safe-record'}]},
  autoReview:{proposals:[]},
  historyReview:{proposals:MANIFEST.held.map(h=>structuredClone(h.candidate))}
 };
}
test('live public results and season indexes contain zero pinned held IDs',()=>{
 const result=audit();
 assert.equal(result.held,ids.length);
 assert.ok(result.checkedSeasonShards>=1);
 assert.deepEqual(result.errors,[]);
});
test('audit dynamically reads each pinned held candidate and accepts clean records',()=>{
 assert.ok(Array.isArray(ids));
 assert.deepEqual(inspect(clean()).errors,[]);
});
test('any pinned hold appearing in source or generated season index fails the independent audit',()=>{
 for(const id of ids){
  for(const surface of ['sourceRows','seasonShards']){
   const input=clean();
   if(surface==='sourceRows')input.sourceRows.push({id,kind:'参加確認',prize:null});
   else input.seasonShards[0].rows.push({id,kind:'参加確認',prize:null});
   const result=inspect(input);
   assert.equal(result.errors.length,1);
   assert.equal(result.errors[0].id,id);
   assert.match(result.errors[0].file,/source-results|season-data/);
  }
 }
});
test('publication updates and both approval ledgers independently detect contamination',()=>{
 for(const id of ids){
  for(const surface of ['updates','ledger','reviewed']){
   const input=clean();
   if(surface==='updates')input.updates.entries.push({id:'unexpected-update',recordIds:[id]});
   else input[surface].entries.push({id:'other',recordId:id});
   const result=inspect(input);
   assert.equal(result.errors.length,1);
   assert.equal(result.errors[0].id,id);
   assert.match(result.errors[0].file,/updates\.json|approval-history\.json|history-sync-reviewed\.json/);
  }
 }
});
test('held rows must remain exactly once in pending review until proof is supplied',()=>{
 for(const id of ids){
  const missing=clean();
  missing.historyReview.proposals=missing.historyReview.proposals.filter(x=>x.id!==id);
  assert.ok(inspect(missing).errors.some(e=>e.id===id&&/確認待ち登録/.test(e.message)));
  const duplicate=clean();
  duplicate.autoReview.proposals.push(structuredClone(MANIFEST.held.find(x=>x.id===id).candidate));
  assert.ok(inspect(duplicate).errors.some(e=>e.id===id&&/確認待ち登録/.test(e.message)));
  const altered=clean();
  altered.historyReview.proposals.find(x=>x.id===id).source='https://example.com/changed';
  assert.ok(inspect(altered).errors.some(e=>e.id===id&&/出典/.test(e.message)));
 }
});
test('invalid or duplicated manual holds fail closed, while unrelated verified rows stay permitted',()=>{
 const normal=clean();
 normal.sourceRows.push({id:'a-valid-unrelated-result',verified:true,prize:200});
 normal.seasonShards[0].rows.push({id:'a-valid-unrelated-result',verified:true,prize:200});
 assert.deepEqual(inspect(normal).errors,[]);
 const synthetic={id:'auto-s99-testheld0001',source:'https://www.fortnite.com/competitive/events/S99_test/',
  candidate:{id:'auto-s99-testheld0001',reviewOnly:true,prize:null,
   source:'https://www.fortnite.com/competitive/events/S99_test/'}};
 const repeated=clean();
 repeated.manifest.held.push(structuredClone(synthetic),structuredClone(synthetic));
 assert.throws(()=>inspect(repeated),/duplicate pinned hold/);
 const malformed=clean();
 malformed.manifest.held.push({...structuredClone(synthetic),candidate:{...synthetic.candidate,prize:0}});
 assert.throws(()=>inspect(malformed),/malformed or duplicate pinned hold/);
});
