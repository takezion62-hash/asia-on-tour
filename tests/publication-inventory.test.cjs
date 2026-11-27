'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FIXED,RECURRING,inventory,context,classifyFixed,build}=require('../scripts/publication-inventory.cjs');
const expected=[{id:'one',prize:100},{id:'two',prize:0}];
const approvals=expected.map(r=>({recordId:r.id,decision:'published',prize:r.prize}));
const update={id:'batch',recordIds:['one','two']};
const spec={expected,marker:'batch',count:2,verify:(r,a)=>a.decision==='published'&&r.id===a.recordId&&r.prize===a.prize&&expected.some(x=>x.id===r.id&&x.prize===r.prize)};
const ctx=({rows=expected,entries=approvals,updates=[update],pending=[]}={})=>context({rows,ledger:{entries},updates:{entries:updates},players:{},reviews:[{proposals:pending},{proposals:[]}]});
test('only complete exact evidence is applied; incomplete evidence fails closed',()=>{
 assert.equal(classifyFixed(spec,ctx()).status,'applied');
 assert.equal(classifyFixed(spec,ctx({rows:[],entries:[],updates:[]})).status,'not-applied');
 for(const c of [
  ctx({rows:[expected[0]]}),ctx({entries:[approvals[0]]}),ctx({updates:[]}),
  ctx({rows:[...expected,expected[0]]}),ctx({entries:[...approvals,approvals[0]]}),
  ctx({updates:[update,update]}),ctx({updates:[{...update,recordIds:['one','one']}]}),
  ctx({rows:[{...expected[0],prize:200},expected[1]]}),
  ctx({pending:[{id:'one'}]})
 ])assert.equal(classifyFixed(spec,c).status,'review-required');
});
test('all direct publication commands in selected workflows are grouped; unknown scripts retained',()=>{
 const rows=inventory({'history-sync.yml':'  node scripts/apply-new.cjs --dry-run\n  node scripts/apply-new.cjs --apply\n  node scripts/validate-data.cjs\n','auto-sync.yml':'node scripts/apply-new.cjs --apply'});
 assert.deepEqual(rows,[{script:'scripts/apply-new.cjs',invocations:[{workflow:'history-sync.yml',mode:'dry-run'},{workflow:'history-sync.yml',mode:'other'},{workflow:'auto-sync.yml',mode:'other'}]}]);
});
test('production inventory is diagnostic, with explicit recurring and unknown categories',()=>{
 const report=build();
 assert.equal(report.readOnly,true);assert.equal(report.skipEnabled,false);
 assert.equal(report.total,report.scripts.length);
 assert.equal(Object.values(report.counts).reduce((a,b)=>a+b,0),report.total);
 assert.equal(new Set(report.scripts.map(x=>x.script)).size,report.total);
 assert.ok(report.scripts.every(x=>x.maySkip===false&&/^[a-f0-9]{64}$/.test(x.sourceSha256)));
 for(const f of FIXED){
  const row=report.scripts.find(x=>x.script===f.script);
  assert.ok(row,'missing fixed batch '+f.script);
  assert.ok(['applied','not-applied','review-required'].includes(row.status));
  assert.notEqual(row.status,'recurring');
 }
 for(const row of report.scripts.filter(x=>RECURRING[x.script]))assert.equal(row.status,'recurring');
 assert.ok(report.scripts.some(x=>x.status==='review-required'));
 console.log('AOT_PUBLICATION_INVENTORY '+JSON.stringify({total:report.total,counts:report.counts,proofs:report.scripts.filter(x=>x.proof).map(x=>({script:x.script,status:x.status,evidence:x.evidence,reason:x.reason}))}));
});
