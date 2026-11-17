'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../scripts/verified-deferred-page-six.cjs');
test('six exact original Epic identities are observed before a later HTTP transient',()=>{
 assert.equal(p.SPECS.length,6);
 assert.equal(new Set(p.SPECS.map(x=>x.id)).size,6);
 assert.deepEqual(p.GROUPS.map(g=>g.tag),['E6zero','C6other','T4trios']);
 const source=p.loadSnapshot();
 assert.equal(source.sourceScanBlob,'43d4af41369f1e3fc30baf60c84de9b8062ff47b');
 for(const group of p.GROUPS){
  const cp=group.checkpoint;
  assert.equal(cp.rankingOrderValid,true);
  assert.equal(cp.complete,false);
  assert.equal(cp.lastErrorCode,'OSIRION_TRANSIENT');
  assert.equal(cp.nextPage,cp.pages);
  assert.equal(cp.lastErrorPage,cp.nextPage);
  assert.ok(cp.totalPages>cp.pages);
  assert.equal(cp.emptyAttempts,0);
  for(const id of group.ids){
   const spec=p.specOf(id);
   assert.ok(spec.rank<=cp.lastSeenRank);
   const originals=cp.proposals.filter(x=>x.id===id);
   assert.equal(originals.length,1,id);
   assert.equal(p.matchOriginal(originals[0],spec),true,id);
  }
 }
});
test('two $0 NAC finals, 2 NAW duo attendance, ME Trio top198 qualifier and attendance',()=>{
 const bySeason=p.SPECS.reduce((m,s)=>(m[s.seasonId]=(m[s.seasonId]||0)+1,m),{});
 assert.deepEqual(bySeason,{S30:2,S37:2,S31:2});
 for(const spec of p.SPECS){
  const fake={...spec,verified:true};
  assert.equal(p.matchOriginal(fake,spec),true);
  assert.equal(p.matchOriginal({...fake,rank:fake.rank+1},spec),false);
  assert.equal(p.matchOriginal({...fake,playerRaw:'bad Epic'},spec),false);
  assert.equal(p.matchOriginal({...fake,vrs:fake.vrs+1},spec),false);
  const ex=p.expected(spec),g=p.GROUPS.find(x=>x.tag===spec.group);
  const {reviewOnly,...clean}=fake;
  const row={...clean,...ex,note:'後続ページ 賞金$0 '+p.RULES[spec.seasonId]+' '+
     g.sourceScanBlob+(spec.seasonId==='S31'?' 上位198':'')+
     (spec.seasonId==='S37'?' 上位250':'')};
  const e={id:spec.id,recordId:spec.id,decision:'published',policy:p.POLICY,
   rule:p.RULES[spec.seasonId],source:spec.source,
   evidence:p.SNAPSHOT_BLOB+' '+g.sourceScanBlob};
  assert.equal(p.validateRecord(row,e),true,spec.id);
  assert.equal(p.validateRecord({...row,prize:100},e),false);
  assert.equal(p.validateRecord({...row,rank:row.rank+1},e),false);
  assert.equal(p.validateRecord({...row,playerRaw:'other'},e),false);
  assert.equal(p.validateRecord({...row,round:'bad'},e),false);
 }
 assert.equal(p.expected(p.SPECS.find(x=>x.player.startsWith('3peace'))).kind,'予選');
 assert.equal(p.expected(p.SPECS.find(x=>x.player.startsWith('Stain'))).kind,'参加確認');
});
test('only six exact IDs are cleared, no general queue cleanups',()=>{
 const q=p.SPECS.map(x=>({id:x.id}));
 assert.deepEqual(p.removeExact(q,p.WHITELIST),[]);
 assert.throws(()=>p.removeExact(q,['not-a-candidate']));
 assert.throws(()=>p.removeExact(q,[q[0].id,q[0].id]));
});
