'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildSnapshot}=require('../scripts/build-source-results.cjs');
const {readResults,publishResults,importLegacy,assertNoExplicitlyHeld}=require('../scripts/source-results-store.cjs');
const {MANIFEST}=require('../scripts/generic-review-only-core.cjs');
const ROOT=path.resolve(__dirname,'..');
const sourceRows=[
 {id:'A1',seasonId:'S30',chapter:5,season:3,player:'First',
  verified:true,kind:'賞金決勝',prize:200,source:'https://www.fortnite.com/competitive/events/S30_example/'},
 {id:'B1',seasonId:'S42',chapter:7,season:4,player:'Second',
  verified:true,kind:'予選',prize:0,source:'https://www.fortnite.com/competitive/events/S42_example/'},
 {id:'A2',seasonId:'S30',chapter:5,season:3,players:['Third','Fourth'],
  player:'Third / Fourth',verified:true,kind:'賞金決勝',prize:300,prizePerPlayer:150,
  source:'https://www.fortnite.com/competitive/events/S30_example/'}
];
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aot-shard-store-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'tournaments.json'),JSON.stringify({catalog:[
  {seasonId:'S30',chapter:5,season:3},{seasonId:'S42',chapter:7,season:4}
 ]}));
 const original=JSON.stringify(sourceRows,null,2)+'\n';
 fs.writeFileSync(path.join(root,'results.json'),original);
 const snapshot=buildSnapshot(sourceRows,original,row=>row.seasonId);
 const dir=path.join(root,'source-results');
 fs.mkdirSync(dir);
 for(const [name,content] of snapshot.files)fs.writeFileSync(path.join(dir,name),content);
 return root;
}
test('production season shards reconstruct ID order, count and payouts without legacy root JSON',()=>{
 const {rows,manifest}=readResults(ROOT);
 assert.equal(rows.length,manifest.count);
 assert.deepEqual(rows.map(x=>x.id),manifest.recordOrder);
 const content=JSON.stringify(rows,null,2)+'\n';
 assert.equal(crypto.createHash('sha256').update(content).digest('hex'),manifest.canonicalSha256);
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 assert.doesNotThrow(()=>assertNoExplicitlyHeld(rows),
  'published canonical results must not contain manual-held Epic IDs');
 assert.equal(manifest.shards.reduce((n,s)=>n+s.count,0),rows.length);
 assert.equal(manifest.shards.reduce((n,s)=>n+s.teamPrizeCents,0),manifest.teamPrizeCents);
 assert.equal(manifest.shards.reduce((n,s)=>n+s.personalPrizeCents,0),manifest.personalPrizeCents);
});
test('reads source shards in original order; publishing touches only changed season data',t=>{
 const root=fixture(t);
 assert.deepEqual(readResults(root).rows,sourceRows);
 const beforeS30=fs.readFileSync(path.join(root,'source-results','S30.json'),'utf8');
 const extra={...sourceRows[1],id:'B2',player:'New',prize:0};
 const next=[...sourceRows,extra];
 const report=publishResults(root,next);
 assert.deepEqual(report.changedShards,['S42']);
 assert.equal(report.added,1);
 assert.equal(fs.readFileSync(path.join(root,'source-results','S30.json'),'utf8'),beforeS30);
 assert.deepEqual(readResults(root).rows,next);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8')),next);
 assert.equal(publishResults(root,next).unchanged,true);
});
test('rejects corrupted shards, mismatched projections, ID collisions and accidental deletions',t=>{
 const root=fixture(t),s30=path.join(root,'source-results','S30.json');
 const baseline=fs.readFileSync(s30,'utf8');
 fs.writeFileSync(s30,baseline.replace('First','TAMPERED'));
 assert.throws(()=>readResults(root),/checksum mismatch/);
 fs.writeFileSync(s30,baseline);
 assert.throws(()=>publishResults(root,sourceRows.slice(1)),/unexpected deletion/);
 assert.throws(()=>publishResults(root,[...sourceRows,sourceRows[0]]),/duplicate next result ID/);
 const legacy=path.join(root,'results.json');
 fs.writeFileSync(legacy,JSON.stringify([...sourceRows,{...sourceRows[0],id:'UNGUARDED'}]));
 assert.throws(()=>readResults(root,{verifyProjection:true}),/projection differs/);
 assert.deepEqual(readResults(root).rows,sourceRows);
 const next=[...sourceRows,{...sourceRows[0],id:'B2'}];
 assert.equal(publishResults(root,next).added,1);
 assert.deepEqual(readResults(root).rows,next);
});
test('all canonical publish modes reject exactly pinned held IDs without touching results or prize totals',t=>{
 const root=fixture(t),manifestPath=path.join(root,'source-results','manifest.json');
 const beforeManifest=fs.readFileSync(manifestPath,'utf8');
 const before=readResults(root);
 assert.ok(Array.isArray(MANIFEST.held));
 for(const held of MANIFEST.held){
  const candidate={...sourceRows[0],id:held.id,player:held.candidate.player,prize:null};
  const proposed=[...sourceRows,candidate];
  for(const options of [{},{legacyWriter:true},{allowRemoval:true}]){
   assert.throws(()=>publishResults(root,proposed,options),
    new RegExp('SOURCE_RESULTS refused explicitly held candidate: '+held.id));
  }
  assert.throws(()=>assertNoExplicitlyHeld(proposed),/explicitly held candidate/);
 }
 assert.equal(fs.readFileSync(manifestPath,'utf8'),beforeManifest);
 assert.deepEqual(readResults(root).rows,before.rows);
 assert.equal(readResults(root).manifest.teamPrizeCents,before.manifest.teamPrizeCents);
 assert.equal(readResults(root).manifest.personalPrizeCents,before.manifest.personalPrizeCents);
});
test('canonical guard still allows safe recovery of a previously contaminated snapshot',t=>{
 const root=fixture(t);
 if(MANIFEST.held.length===0){
  assert.doesNotThrow(()=>assertNoExplicitlyHeld(sourceRows));
  return;
 }
 const held=MANIFEST.held[0];
 const originalManifest=readResults(root).manifest;
 const oldRow={...sourceRows[0],id:held.id,player:held.candidate.player,prize:null};
 const contaminated=[...sourceRows,oldRow],original=JSON.stringify(contaminated,null,2)+'\n';
 const snapshot=buildSnapshot(contaminated,original,row=>row.seasonId);
 for(const [name,content] of snapshot.files)
  fs.writeFileSync(path.join(root,'source-results',name),content);
 fs.writeFileSync(path.join(root,'results.json'),original);
 assert.equal(readResults(root).rows.length,sourceRows.length+1);
 assert.throws(()=>assertNoExplicitlyHeld(readResults(root).rows),/explicitly held candidate/);
 const report=publishResults(root,sourceRows,{allowRemoval:true});
 assert.equal(report.count,sourceRows.length);
 assert.deepEqual(readResults(root).rows,sourceRows);
 assert.equal(readResults(root).manifest.teamPrizeCents,originalManifest.teamPrizeCents);
 assert.equal(readResults(root).manifest.personalPrizeCents,originalManifest.personalPrizeCents);
});
test('legacy compatibility rejects rewriting a previously published score',t=>{
 const root=fixture(t);
 const changed=sourceRows.map((row,i)=>i===0?{...row,prize:9999}:row);
 fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(changed,null,2)+'\n');
 assert.throws(()=>importLegacy(root),/legacy writer altered existing record/);
});
test('retired production import command cannot replace sharded source',()=>{
 assert.throws(()=>importLegacy(ROOT),/retired in phase 3/);
});
test('isolated fixture bridge remains backward compatible without touching production',t=>{
 const root=fixture(t),newRow={...sourceRows[1],id:'B3'};
 const next=[...sourceRows,newRow];
 fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(next,null,2)+'\n');
 const report=importLegacy(root);
 assert.equal(report.added,1);
 assert.deepEqual(readResults(root).rows,next);
 assert.equal(report.changedShards.includes('S42'),true);
});
