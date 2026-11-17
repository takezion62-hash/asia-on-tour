'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),p=require('../scripts/verified-s38-s41-3-safe.cjs');
test('exact three mature Epic results: no cash and only EU top2000 qualification',()=>{
 assert.equal(p.SPECS.length,3);
 assert.equal(new Set(p.SPECS.map(x=>x.id)).size,3);
 for(const s of p.SPECS){
  const original={...s,verified:true};
  assert.equal(p.matchOriginal(original,s),true);
  assert.equal(p.matchOriginal({...original,rank:original.rank+1},s),false);
  assert.equal(p.matchOriginal({...original,playerRaw:'not this player'},s),false);
  assert.equal(p.matchOriginal({...original,vrs:original.vrs+1},s),false);
  const r={...original,prize:0,round:p.outRound(s),
    note:'賞金$0 evidence '+p.RULES[s.seasonId]+' '+p.SCAN_BLOB};
  if(s.seasonId==='S38'){
   assert.equal(s.vrs,0);assert.equal(s.players.length,4);
   r.teamPrize=0;r.prizePerPlayer=0;
  }else{
   assert.ok(s.rank<=2000);assert.equal(s.kind,'予選');
  }
  const e={id:s.id,recordId:s.id,decision:'published',policy:p.POLICY,
   rule:p.RULES[s.seasonId],source:s.source,evidence:p.SCAN_BLOB};
  assert.equal(p.validateRecord(r,e),true);
  assert.equal(p.validateRecord({...r,prize:100},e),false);
  assert.equal(p.validateRecord({...r,rank:r.rank+1},e),false);
  assert.equal(p.validateRecord({...r,playerRaw:'someone else'},e),false);
  assert.equal(p.validateRecord({...r,round:'Wrong round'},e),false);
  if(s.seasonId==='S38')assert.equal(p.validateRecord({...r,teamPrize:100},e),false);
 }
});
test('exact pending cleanup rejects duplicate or non-existing IDs',()=>{
 const arr=p.SPECS.map(x=>({id:x.id}));
 assert.deepEqual(p.removeExact(arr,p.SPECS.map(x=>x.id)),[]);
 assert.throws(()=>p.removeExact(arr,['invalid-id']));
 assert.throws(()=>p.removeExact(arr,[arr[0].id,arr[0].id]));
});
