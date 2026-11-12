'use strict';
/**
 * Fail closed if the legacy six-megabyte root projection is reintroduced.
 * Existing fixture-only compatibility functions may still accept temporary
 * synthetic results.json files; production code and workflows must not.
 */
const fs=require('node:fs');
const path=require('node:path');
const {readResults}=require('./source-results-store.cjs');
const ROOT=path.resolve(__dirname,'..');
function audit(root=ROOT){
 const errors=[];
 if(fs.existsSync(path.join(root,'results.json')))
  errors.push('Tracked or generated root results.json must be removed from production');
 const {rows,manifest}=readResults(root);
 if(rows.length!==manifest.count||new Set(rows.map(r=>r.id)).size!==rows.length)
  errors.push('Published shard count or ID uniqueness does not match manifest');
 const scriptDir=path.join(root,'scripts');
 for(const name of fs.readdirSync(scriptDir).filter(x=>x.endsWith('.cjs'))){
  if(['source-results-store.cjs','build-source-results.cjs','audit-legacy-results.cjs'].includes(name))
   continue; // Fixture-only compatibility and the audit itself.
  const content=fs.readFileSync(path.join(scriptDir,name),'utf8');
  if(/(?:readFileSync|require)\s*\([^;\n]*['"](?:\.\.\/)?results\.json['"]/.test(content))
   errors.push('Direct legacy results reader in scripts/'+name);
  if(/import-legacy/.test(content))
   errors.push('Deprecated legacy import in scripts/'+name);
 }
 const workflows=path.join(root,'.github','workflows');
 for(const name of fs.readdirSync(workflows).filter(x=>/\.ya?ml$/.test(x))){
  const content=fs.readFileSync(path.join(workflows,name),'utf8');
  if(/^\s*git\s+add[^\n]*\bresults\.json\b/m.test(content)||
     /node\s+scripts\/source-results-store\.cjs\s+import-legacy/.test(content))
   errors.push('Legacy publication remains in .github/workflows/'+name);
 }
 const front=fs.readdirSync(root).filter(x=>/\.(?:js|html)$/.test(x));
 for(const name of front){
  const source=fs.readFileSync(path.join(root,name),'utf8');
  if(/(?:fetch|read|require)\s*\(\s*['"](?:\.\/)?results\.json['"]/.test(source))
   errors.push('Legacy browser fetch in '+name);
 }
 return {ok:errors.length===0,errors,rows:rows.length,shards:manifest.shards.length};
}
if(require.main===module){
 try{
  const result=audit();
  if(!result.ok)throw Error(result.errors.join('\n'));
  console.log('PHASE3_LEGACY_RETIRED '+JSON.stringify({records:result.rows,shards:result.shards}));
 }catch(error){console.error('PHASE3_AUDIT_FAILURE '+error.stack);process.exitCode=1}
}
module.exports={audit};
