'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const scriptDir=path.join(root,'scripts');
const ignored=new Set(['script-lifecycle.test.cjs']);
function rel(p){return path.relative(root,p).split(path.sep).join('/')}
function scanFiles(dir,pattern){
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>{
  const p=path.join(dir,x.name);
  if(x.isDirectory())return scanFiles(p,pattern);
  return x.isFile()&&pattern.test(x.name)?[p]:[];
 });
}
function audit(){
 const scripts=scanFiles(scriptDir,/\.cjs$/).sort();
 const sources=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scripts,
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const fileData=sources.map(p=>({p:rel(p),content:fs.readFileSync(p,'utf8')}));
 return scripts.map(file=>{
  const own=rel(file),basename=path.basename(file);
  const refs=fileData.filter(x=>x.p!==own&&x.content.includes(basename)).map(x=>x.p);
  const entry=refs.filter(x=>x.startsWith('.github/workflows/')||x==='package.json');
  const script=refs.filter(x=>x.startsWith('scripts/'));
  const tests=refs.filter(x=>x.startsWith('tests/'));
  const usage=entry.length?'entrypoint':script.length?'script-dependency':
   tests.length?'test-dependency':'review-candidate';
  return{path:own,usage,references:refs};
 });
}
test('現役の自動更新・安全マージ・データ検証は参照され続ける',()=>{
 const by=new Map(audit().map(x=>[x.path,x]));
 for(const name of ['osirion-sync.cjs','safe-sync-merge.cjs','validate-data.cjs']){
  const row=by.get('scripts/'+name);
  assert.ok(row,'script must exist: '+name);
  assert.equal(row.usage,'entrypoint',name+' must remain an active entrypoint');
 }
});
test('完了済みの順位訂正は実行コードだけ整理し、更新履歴を残す',()=>{
 const file='correct-20261107-3peace-job-rank.cjs';
 assert.equal(fs.existsSync(path.join(scriptDir,file)),false,'old one-shot executable must be removed');
 const sources=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const activeRefs=sources.filter(p=>fs.readFileSync(p,'utf8').includes(file)).map(rel);
 assert.deepEqual(activeRefs,[],'retired executable must not be imported or invoked');
 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 assert.ok(updates.some(x=>x.id==='corrected-20261107-performance-3peace-job-rank702'),
  'already applied rank correction must remain in the public update ledger');
});
test('全スクリプトを4種類に分類し、未参照を即時削除対象としない',()=>{
 const rows=audit(),seen=new Set(rows.map(x=>x.path));
 assert.equal(rows.length,seen.size);
 assert.ok(rows.every(x=>['entrypoint','script-dependency','test-dependency','review-candidate'].includes(x.usage)));
 const totals=Object.groupBy(rows,x=>x.usage);
 console.log('AOT_SCRIPT_USAGE_AUDIT '+JSON.stringify({
  total:rows.length,
  counts:Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,value.length])),
  reviewCandidates:rows.filter(x=>x.usage==='review-candidate').map(x=>x.path)
 }));
});
