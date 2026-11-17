'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),p=require('../scripts/verified-s30-nac-zb-solo-round2-seven.cjs');
test('seven immutable complete 2024 NAC ZB Solo cash finalists: only $100 per 1VR',()=>{
 assert.equal(p.SPECS.length,7);assert.equal(new Set(p.SPECS.map(x=>x.id)).size,7);
 assert.deepEqual(p.GROUPS.map(x=>x.eventNo),[1,5,7]);
 for(const g of p.GROUPS)assert.equal(g.seenPages,45);
 for(const x of p.SPECS){
  assert.equal(x.vrs,1);assert.equal(x.points,100);assert.equal(p.amount(x),100);
  assert.ok(x.rank>0&&x.rank<=100);assert.match(x.source,/SoloZBVictoryCashCup/);
  const orig={...x,region:'NAC',seasonId:'S30',chapter:5,season:3,tournamentId:'ch5s3-zb-solo-victory',event:'ZB Solo Victory Cup',round:'Event '+x.eventNo+' · Round 2 / 賞金決勝',kind:'賞金決勝',prize:null,verified:true};
  assert.equal(p.matchOriginal(orig,x),true);
  assert.equal(p.matchOriginal({...orig,vrs:0},x),false);
  assert.equal(p.matchOriginal({...orig,playerRaw:'other'},x),false);
  const row={...orig,prize:100,teamPrize:100,prizePerPlayer:100,note:'45/45 賞金$100 '+p.RULE+' '+p.SCAN_BLOB};
  const approval={id:x.id,recordId:x.id,decision:'published',policy:p.POLICY,source:x.source,rule:p.RULE,evidence:p.SCAN_BLOB};
  assert.equal(p.validateRecord(row,approval),true);
  assert.equal(p.validateRecord({...row,prize:200},approval),false);
  assert.equal(p.validateRecord({...row,rank:row.rank+1},approval),false);
  assert.equal(p.validateRecord({...row,note:'missing source'},approval),false);
 }
});
test('exact pending cleanup is idempotence-safe',()=>{
 const q=p.SPECS.map(x=>({id:x.id}));
 assert.deepEqual(p.removeExact(q,p.SPECS.map(x=>x.id)),[]);
 assert.throws(()=>p.removeExact(q,['nonexistent']));
 assert.throws(()=>p.removeExact(q,[q[0].id,q[0].id]));
});
