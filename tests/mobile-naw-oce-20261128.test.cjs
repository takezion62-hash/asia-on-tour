'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-mobile-naw-oce-20261128.cjs');
test('Nov28 ten screenshot rows and separate OCE makeup final',()=>{
 const rows=V.GOLD.map(V.project);
 assert.equal(rows.length,10);assert.equal(new Set(rows.map(r=>r.id)).size,10);
 assert.equal(rows.reduce((n,r)=>n+r.prize,0),2550);
 assert.equal(rows.filter(r=>r.player==='Reo').reduce((n,r)=>n+r.prize,0),1250);
 assert.equal(rows.reduce((n,r)=>n+r.kills,0),94);
 assert.equal(rows.reduce((n,r)=>n+r.vrs,0),9);
 assert.equal(rows.reduce((n,r)=>n+r.matches,0),77);
 assert.equal(rows.filter(r=>r.region==='NAW').length,7);
 assert.equal(new Set(rows.map(r=>r.source)).size,5);
 assert.ok(rows[7].source.endsWith('_OCE_mg'));assert.ok(rows[8].source.endsWith('_OCE'));
 assert.equal(rows[1].tournamentId,'ch7s1-mobile-series-february-qualifier');
 assert.equal(rows[0].tournamentId,'ch7s1-mobile-series-monthly-qualifier');
 assert.equal(rows[4].tournamentId,'ch7s1-mobile-series-january-qualifier');
 for(const x of V.GOLD){const r=V.project(x),a=V.approval(x);assert.equal(V.uuid(r.profileUrl),V.profiles[r.player][1]);assert.ok(V.awardValid(x));assert.ok(V.verifyRow(r,a));for(const patch of [{rank:r.rank+1},{prize:r.prize+50},{kills:r.kills+1},{date:'2026-01-01'},{source:'https://example.com'}])assert.equal(V.verifyRow({...r,...patch},a),false);}
});
