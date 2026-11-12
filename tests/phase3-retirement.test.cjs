'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {audit}=require('../scripts/audit-legacy-results.cjs');
const {readResults,publishResults}=require('../scripts/source-results-store.cjs');
test('all production consumers use sharded records and root monolith is absent',()=>{
 const root=path.resolve(__dirname,'..');
 assert.equal(fs.existsSync(path.join(root,'results.json')),false);
 const result=audit(root);
 assert.deepEqual(result.errors,[]);
 assert.equal(result.ok,true);
 assert.ok(result.rows>6000);
 assert.ok(result.shards>=17);
});
test('verification center requests season shards, never root results.json',()=>{
 const root=path.resolve(__dirname,'..');
 const content=fs.readFileSync(path.join(root,'verification.js'),'utf8');
 assert.ok(content.includes("read('source-results/manifest.json')"));
 assert.ok(content.includes('manifest.recordOrder.map('));
 assert.equal(content.includes("const required=['results.json'"),false);
});
test('public source is lossless even when legacy projection does not exist',()=>{
 const {rows,manifest}=readResults();
 assert.deepEqual(rows.map(x=>x.id),manifest.recordOrder);
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 assert.equal(manifest.shards.reduce((n,x)=>n+x.count,0),rows.length);
 assert.equal(manifest.shards.reduce((n,x)=>n+x.teamPrizeCents,0),manifest.teamPrizeCents);
 assert.equal(manifest.shards.reduce((n,x)=>n+x.personalPrizeCents,0),manifest.personalPrizeCents);
});
