'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../scripts/verified-s30-s37-s43-twelve.cjs');
test('snapshot SHA1, original source group IDs and complete 12-row whitelist are immutable',()=>{
 const snap=p.loadSnapshot();
 assert.equal(snap.groups.length,6);assert.equal(snap.specs.length,12);
 assert.equal(new Set(p.SPECS.map(x=>x.id)).size,12);
 assert.deepEqual(snap.groups.map(x=>x.tag),['E6R2','E8R2','E8R1','E9R2','C6R1','S43R1']);
 for(const g of snap.groups){
  assert.equal(g.checkpoint.rankingOrderValid,true);
  assert.equal(g.checkpoint.nextPage,g.checkpoint.pages);
  assert.ok(g.checkpoint.totalPages>g.checkpoint.pages);
  assert.equal(g.checkpoint.lastErrorCode||null,null);
  assert.equal(g.checkpoint.lastError||null,null);
  assert.ok(g.checkpoint.lastSeenRank>=Math.max(...g.ids.map(id=>p.getSpec(id).rank)));
  for(const id of g.ids){
   const orig=g.checkpoint.proposals.filter(x=>x.id===id);
   assert.equal(orig.length,1);
   assert.equal(p.matchesOriginal(orig[0],p.getSpec(id)),true);
  }
 }
 assert.equal(snap.groups.at(-1).checkpoint.pages,2);
 assert.equal(snap.groups.at(-1).checkpoint.totalPages,43);
 assert.equal(snap.groups.at(-1).checkpoint.complete,true);
});
test('seven $100 winners, one NAC qualifier, 3 NAW nonqualifier duos, 1 NAW squad qualifier',()=>{
 assert.equal(p.SPECS.filter(x=>x.mode==='cash').length,7);
 assert.equal(p.SPECS.filter(x=>x.mode==='participation').length,3);
 assert.equal(p.SPECS.filter(x=>x.mode==='qualifier').length,2);
 assert.equal(p.SPECS.reduce((sum,s)=>sum+p.expected(s).prize,0),700);
 for(const s of p.SPECS){
  const fake={...s,verified:true};
  assert.equal(p.matchesOriginal(fake,s),true);
  assert.equal(p.matchesOriginal({...fake,rank:s.rank+1},s),false);
  assert.equal(p.matchesOriginal({...fake,playerRaw:'other'},s),false);
  assert.equal(p.matchesOriginal({...fake,vrs:s.vrs+1},s),false);
  const t=p.expected(s),g=p.GROUPS.find(x=>x.tag===s.group);
  const r={...fake,kind:t.kind,round:t.round,prize:t.prize,
   note:'賞金$'+t.prize+' '+p.RULES[s.seasonId]+' '+g.sourceBlob+
    (s.mode==='qualifier'?' 上位'+g.cutoff:'')+(s.seasonId==='S37'?' 上位250':'')};
  if(s.mode==='cash'){assert.equal(s.vrs,1);r.teamPrize=100;r.prizePerPlayer=100;}
  if(s.seasonId==='S43'){assert.ok(s.rank<=120);r.teamPrize=0;r.prizePerPlayer=0;}
  if(s.seasonId==='S37')assert.ok(s.rank>250);
  const e={id:s.id,recordId:s.id,policy:p.POLICY,decision:'published',
    source:s.source,rule:p.RULES[s.seasonId],evidence:p.SNAPSHOT_BLOB+' '+g.sourceBlob};
  assert.equal(p.validateRecord(r,e),true,s.id);
  assert.equal(p.validateRecord({...r,rank:r.rank+1},e),false);
  assert.equal(p.validateRecord({...r,prize:r.prize+100},e),false);
  assert.equal(p.validateRecord({...r,playerRaw:'wrong'},e),false);
  assert.equal(p.validateRecord({...r,round:'wrong'},e),false);
 }
});
test('exact IDs cleanup refuses duplicates and unknown IDs',()=>{
 const q=p.SPECS.map(s=>({id:s.id}));
 assert.deepEqual(p.removeExact(q,p.ids),[]);
 assert.throws(()=>p.removeExact(q,['unverified-id']));
 assert.throws(()=>p.removeExact(q,[q[0].id,q[0].id]));
});
