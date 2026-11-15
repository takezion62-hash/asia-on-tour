'use strict';
// Focused PR tests. Inputs originate from a trusted base-revision classifier,
// and are revalidated against narrow local allowlists before execFile/spawn.
// Ordinary PR runs still execute the entire money/identity/schema validation.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const patterns={
 unit:/^tests\/[a-z0-9._-]+\.test\.cjs$/,
 browser:/^tests\/[a-z0-9._-]+\.spec\.cjs$/,
 publisher:/^scripts\/(?:apply|publish|reconcile)-[a-z0-9.-]+\.cjs$/
};
function tokens(kind,value,{root=ROOT}={}){
 if(!Object.hasOwn(patterns,kind)||typeof value!=='string')throw Error('Missing focused input');
 const items=value.trim()?value.trim().split(/\s+/):[];
 if(!items.length||items.length>(kind==='unit'?35:kind==='browser'?8:12))
  throw Error('Empty/oversized focused '+kind+' selection');
 if(new Set(items).size!==items.length)throw Error('Duplicate focused path');
 for(const item of items){
  if(!patterns[kind].test(item)||!fs.statSync(path.join(root,item),{throwIfNoEntry:false})?.isFile())
   throw Error('Unapproved or missing focused '+kind+' file: '+item);
 }
 return items;
}
function run(command,args,timeout){
 const child=spawnSync(command,args,{cwd:ROOT,stdio:'inherit',timeout,
  env:{...process.env,NODE_ENV:'test'}});
 if(child.error)throw child.error;
 if(child.status!==0)throw Error('Focused command failed: '+args[0]+' (exit '+child.status+')');
}
function main(kind=process.argv[2]){
 if(!['unit','browser','publisher'].includes(kind))throw Error('Usage: ... [unit|browser|publisher]');
 const variable={unit:'FOCUSED_UNIT_FILES',browser:'FOCUSED_BROWSER_FILES',
  publisher:'FOCUSED_PUBLISHER_FILES'}[kind];
 const items=tokens(kind,process.env[variable]);
 console.log('FOCUSED_CI '+kind+' '+items.length+' selected file(s): '+items.join(', '));
 if(kind==='unit')run(process.execPath,['--test',...items],9*60*1000);
 else if(kind==='browser'){
  const cli=path.join(ROOT,'node_modules','@playwright','test','cli.js');
  if(!fs.existsSync(cli))throw Error('Playwright CLI unavailable: npm ci missing');
  run(process.execPath,[cli,'test',...items],9*60*1000);
 }else for(const file of items)run(process.execPath,[file,'--dry-run'],2*60*1000);
}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1}
module.exports={tokens,patterns};
