'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {
  buildSnapshot,checkContents,verifyRoundTrip,syncSnapshot
}=require('../scripts/build-source-results.cjs');
const root=path.resolve(__dirname,'..');
const fixture=[
 {id:'alpha',seasonId:'S30',prize:200,prizePerPlayer:100,verified:true,
   players:['A','B'],date:'2024-06-13',note:'Original first row'},
 {id:'beta',seasonId:'S43',prize:0,verified:true,player:'C',
   date:'2026-11-10',note:'Other season'},
 {id:'gamma',seasonId:'S30',prize:0,verified:true,player:'D',
   date:'2024-06-13',note:'Same season, originally separated'},
 {id:'delta',seasonId:'unknown',prize:50,verified:true,player:'E',
   date:'2024-05-01',note:'Do not infer from calendar date'}
];
const seasonOfRecord = r => r.seasonId || 'unknown';

function scratch(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aot-source-split-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 return dir;
}
function fixtureSource(rootDir, rows=fixture){
 fs.writeFileSync(path.join(rootDir,'results.json'),JSON.stringify(rows,null,2)+'\n');
}

test('season source split preserves cross-season original ID order, all fields, counts and cash',t=>{
 const dir=scratch(t),out=path.join(dir,'source-results');
 fixtureSource(dir);
 const state=syncSnapshot({root:dir,out,seasonSelector:seasonOfRecord});
 assert.deepEqual(state,{
   records:4,teamPrizeCents:25000,personalPrizeCents:25000,unconfirmedPrizeRecords:0,seasons:3
 });
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 assert.deepEqual(manifest.recordOrder,['alpha','beta','gamma','delta']);
 assert.equal(manifest.shards.reduce((n,z)=>n+z.count,0),4);
 assert.equal(manifest.shards.reduce((n,z)=>n+z.teamPrizeCents,0),25000);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'S30.json'))).map(r=>r.id),
   ['alpha','gamma']);
 assert.equal(manifest.shards.find(x=>x.seasonId==='unknown').count,1);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'results.json'))),fixture);
 assert.deepEqual(syncSnapshot({root:dir,out,check:true,seasonSelector:seasonOfRecord}),state);
});

test('shard corruption, missing shard and stale data are rejected rather than trusted',t=>{
 const dir=scratch(t),out=path.join(dir,'source-results');fixtureSource(dir);
 syncSnapshot({root:dir,out,seasonSelector:seasonOfRecord});
 const location=path.join(out,'S30.json');
 const good=fs.readFileSync(location,'utf8');
 fs.writeFileSync(location,good.replace('Original first row','CORRUPTED'));
 assert.throws(()=>syncSnapshot({root:dir,out,check:true,seasonSelector:seasonOfRecord}),
   /Source shard missing or stale/);
 fs.writeFileSync(location,good);
 fs.rmSync(location);
 assert.throws(()=>syncSnapshot({root:dir,out,check:true,seasonSelector:seasonOfRecord}),
   /Source shard missing or stale/);
 fs.writeFileSync(location,good);
 fs.writeFileSync(path.join(out,'S99.json'),'[]\n');
 assert.throws(()=>syncSnapshot({root:dir,out,check:true,seasonSelector:seasonOfRecord}),
   /Obsolete source shard/);
});

test('unconfirmed null prize stays null and is audited separately from confirmed $0',t=>{
 const dir=scratch(t),out=path.join(dir,'source-results');
 const records=[...fixture,{id:'null-prize',seasonId:'S43',prize:null,verified:false,player:'F'}];
 fixtureSource(dir,records);
 const result=syncSnapshot({root:dir,out,seasonSelector:seasonOfRecord});
 assert.equal(result.unconfirmedPrizeRecords,1);
 assert.equal(result.teamPrizeCents,25000);
 const shards=JSON.parse(fs.readFileSync(path.join(out,'S43.json'),'utf8'));
 assert.equal(shards.find(x=>x.id==='null-prize').prize,null);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 assert.equal(manifest.unconfirmedPrizeRecords,1);
 assert.equal(manifest.shards.find(x=>x.seasonId==='S43').unconfirmedPrizeRecords,1);
 assert.deepEqual(syncSnapshot({root:dir,out,check:true,seasonSelector:seasonOfRecord}),result);
});

test('all canonical IDs must be unique; missing IDs and invalid cash never pass',()=>{
 const asText=rows=>JSON.stringify(rows);
 assert.throws(()=>buildSnapshot([fixture[0],fixture[0]],asText(fixture)),/duplicate canonical record ID/);
 assert.throws(()=>buildSnapshot([{prize:0}],asText([{prize:0}])),/Missing or duplicate canonical record ID/);
 const bad=[{id:'bad',prize:-1}];
 assert.throws(()=>buildSnapshot(bad,asText(bad)),/Invalid prize/);
});

test('current season source independently round-trips without a root results file',t=>{
 const {readResults,seasonSelector}=require('../scripts/source-results-store.cjs');
 const rows=readResults(root).rows;
 const source=JSON.stringify(rows,null,2)+'\n';
 const before=fs.readFileSync(path.join(root,'source-results','manifest.json'),'utf8');
 const expected=buildSnapshot(rows,source,seasonSelector(rows,root));
 const out=path.join(scratch(t),'source-results');
 fs.mkdirSync(out,{recursive:true});
 for(const [name,content] of expected.files)fs.writeFileSync(path.join(out,name),content);
 const result=verifyRoundTrip(out,rows,expected);
 assert.equal(result.records,rows.length);
 assert.equal(result.teamPrizeCents,rows.reduce((sum,r)=>sum+Math.round((r.prize??0)*100),0));
 assert.equal(result.unconfirmedPrizeRecords,rows.filter(r=>r.prize==null).length);
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 assert.equal(fs.readFileSync(path.join(root,'source-results','manifest.json'),'utf8'),before);
 assert.doesNotThrow(()=>checkContents(out,expected.files));
});
