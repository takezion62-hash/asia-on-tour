'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-pending-20261128.cjs');
test('29 exact candidates, seven potential qualifiers and no invented cash',()=>{
 assert.equal(V.ITEMS.length,29);assert.equal(new Set(V.ITEMS.map(x=>x.row.id)).size,29);
 assert.equal(V.ITEMS.filter(x=>x.decision==='advance').length,7);
 assert.equal(V.ITEMS.filter(x=>x.decision==='duplicate').length,2);
 for(const item of V.ITEMS.filter(x=>x.decision!=='duplicate')){const r=V.project(item),a=V.approval(item,'2026-11-28T09:16:04Z');assert.equal(r.prize,0);assert.equal(r.rank,item.row.rank);assert.ok(V.verifyPublished(r,a));assert.equal(V.verifyPublished({...r,rank:r.rank+1},a),false);assert.equal(V.verifyPublished({...r,prize:1},a),false);assert.equal(r.kind==='予選',item.decision==='advance');}
});
