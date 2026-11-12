'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {buildSnapshot}=require('../scripts/build-source-results.cjs');
const {readResults,publishResults,importLegacy}=require('../scripts/source-results-store.cjs');
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
test('real 6000+ record source shards reconstruct identical IDs and payout with legacy projection',()=>{
 const {rows,manifest}=readResults(ROOT);
 assert.equal(rows.length,manifest.count);
 assert.deepEqual(rows.map(x=>x.id),manifest.recordOrder);
 const legacy=JSON.parse(fs.readFileSync(path.join(ROOT,'results.json'),'utf8'));
 assert.deepEqual(rows,legacy);
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
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
 assert.throws(()=>readResults(root),/projection differs/);
 assert.throws(()=>publishResults(root,[...sourceRows,{...sourceRows[0],id:'B2'}]),/projection differs/);
});
test('legacy compatibility rejects rewriting a previously published score',t=>{
 const root=fixture(t);
 const changed=sourceRows.map((row,i)=>i===0?{...row,prize:9999}:row);
 fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(changed,null,2)+'\\n');
 assert.throws(()=>importLegacy(root),/legacy writer altered existing record/);
});
test('explicit migration bridge updates authoritative shards from a vetted legacy writer',t=>{
 const root=fixture(t),newRow={...sourceRows[1],id:'B3'};
 const next=[...sourceRows,newRow];
 fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(next,null,2)+'\n');
 const report=importLegacy(root);
 assert.equal(report.added,1);
 assert.deepEqual(readResults(root).rows,next);
 assert.equal(report.changedShards.includes('S42'),true);
});
