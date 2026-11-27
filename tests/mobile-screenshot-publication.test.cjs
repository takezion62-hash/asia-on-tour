'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {BATCHES,applyBatch,cli}=require('../scripts/mobile-screenshot-publication.cjs');
const {sourcePinsMatch}=require('../scripts/fixed-publication-replay.cjs');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));
// Use the original proof data in isolated memory, with the canonical names
// as they existed at initial publication. No production data writes.
function fixture(batch){
 const spec=BATCHES[batch],V=require('../scripts/'+spec.proof),entries=V.DOC.batch.entries;
 const names=[...new Set(entries.map(x=>x.name))];
 const aliases={};
 for(const x of entries)if(x.rawName!==x.name){
  aliases[x.name]??=[];
  if(!aliases[x.name].includes(x.rawName))aliases[x.name].push(x.rawName);
 }
 const data={'results.json':[],'players.json':{candidates:names.map(name=>({name,initials:'T',desc:'fixture',accent:'cyan'})),confirmedAliases:aliases},
  'tournaments.json':structuredClone(catalog),'approval-history.json':{version:1,entries:[]},
  'updates.json':{version:1,entries:[]}};
 const writes=[];
 const files={read:p=>structuredClone(data[p]),write:(p,v)=>{writes.push(p);data[p]=structuredClone(v)}};
 return {V,spec,entries,data,writes,files};
}
for(const batch of Object.keys(BATCHES)){
 test(batch+' initial publication, dry-run and idempotent replay preserve original proofs',()=>{
  const f=fixture(batch),before=structuredClone(f.data);
  const dry=applyBatch(batch,{dryRun:true},f.files);
  assert.equal(dry.added,f.spec.count);
  assert.equal(dry.prize,f.spec.cents/100);
  assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
  const done=applyBatch(batch,{},f.files);
  assert.equal(done.added,f.spec.count);
  assert.deepEqual(f.data['results.json'],f.entries.map(f.V.project));
  assert.deepEqual(f.data['approval-history.json'].entries,f.entries.map(f.V.approval));
  assert.deepEqual(f.data['players.json'],before['players.json']);
  assert.deepEqual(f.data['updates.json'].entries,[{...f.spec.log,type:'records',recordIds:done.ids}]);
  assert.deepEqual(f.writes,['results.json','approval-history.json','updates.json']);
  const saved=structuredClone(f.data);f.writes.length=0;
  const repeated=applyBatch(batch,{},f.files);
  assert.equal(repeated.added,0);assert.equal(repeated.existing,f.spec.count);
  assert.deepEqual(f.data,saved);assert.deepEqual(f.writes,[]);
  f.data['results.json'][0].prize++;
  assert.throws(()=>applyBatch(batch,{},f.files),/altered published result/);
  assert.deepEqual(f.writes,[]);
 });
}
test('partial batch, conflicting account alias and unknown command fail without writes',()=>{
 const batch='mobile-series-nine-20261121',f=fixture(batch);
 f.data['results.json'].push(f.V.project(f.entries[0]));
 f.data['approval-history.json'].entries.push(f.V.approval(f.entries[0]));
 assert.throws(()=>applyBatch(batch,{},f.files),/incomplete 9-row/);
 assert.deepEqual(f.writes,[]);
 const g=fixture(batch),[a,b]=g.data['players.json'].candidates;
 g.data['players.json'].confirmedAliases[a.name]=[b.name];
 assert.throws(()=>applyBatch(batch,{},g.files),/ambiguous alias/);
 assert.deepEqual(g.writes,[]);
 assert.throws(()=>cli('unknown',[]),/Unknown mobile screenshot batch/);
 assert.throws(()=>cli(batch,['--apply']),/Usage/);
});
test('replay pin detects change to the shared write path even if wrappers are unchanged',()=>{
 const read=p=>fs.readFileSync(path.join(root,p));
 for(const batch of Object.keys(BATCHES)){
  const p='scripts/apply-'+batch+'.cjs';
  assert.equal(sourcePinsMatch(p,read),true);
  assert.equal(sourcePinsMatch(p,q=>q==='scripts/mobile-screenshot-publication.cjs'?Buffer.from('changed'):read(q)),false);
 }
});
