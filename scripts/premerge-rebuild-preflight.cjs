'use strict';
/**
 * Pre-merge full rebuild rehearsal. The production workflow is the only
 * command-order source: interpret its exact node-only mutation/validation
 * sequence against a disposable copy, never against the checked-out repo.
 * Unlike independent --dry-run checks, earlier publishers can affect later ones.
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const ROOT=path.resolve(__dirname,'..');
const WORKFLOW='.github/workflows/build-season-data.yml';
const FIRST='            node scripts/source-results-store.cjs verify';
const LAST='            node scripts/build-candidate-triage.cjs --check';
const NEXT='            git add players.json';
const SKIP=new Set(['.git','node_modules','playwright-report','test-results','.cache']);
const RULE=/^ {12}node ((?:scripts\/[a-zA-Z0-9._/-]+\.cjs|--test tests\/[a-zA-Z0-9._/-]+\.test\.cjs)(?: [a-zA-Z0-9._/-]+)*)$/;
const allowedArgs=new Set(['verify','--dry-run','--apply','--check']);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const assert=(ok,msg)=>{if(!ok)throw Error('REBUILD_PREFLIGHT '+msg)};

function parseWorkflow(workflow){
 assert(typeof workflow==='string','workflow content unavailable');
 const start=workflow.indexOf(FIRST),end=workflow.indexOf(NEXT,start);
 assert(start>=0&&end>start,'rebuild command boundaries missing or changed');
 // The source verification command legitimately occurs twice: at the start
 // and after publishing. Only the first starts the replay block.
 const lines=workflow.slice(start,end).split('\n').filter(line=>line.trim());
 const steps=lines.map((line,index)=>{
  const match=line.match(RULE);
  assert(match,'unsupported production command '+(index+1)+': '+line.trim());
  const tokens=match[1].split(' ');
  if(tokens[0]==='--test'){
   assert(tokens.length===2,'unsafe test command');
  }else{
   assert(tokens.slice(1).every(arg=>allowedArgs.has(arg)),'unsafe rebuild argument: '+line.trim());
   assert(!tokens[0].split('/').includes('..'),'unsafe script path');
  }
  return tokens;
 });
 assert(steps.length>=50&&steps.length<=120,'unexpected rebuild command count: '+steps.length);
 assert(lines[0]===FIRST&&lines[lines.length-1]===LAST,'rebuild boundary altered');
 const position=needle=>steps.findIndex(tokens=>tokens.join(' ')===needle);
 const must=[
  'scripts/publish-reviewonly-round1-20261116.cjs --dry-run',
  'scripts/publish-reviewonly-round1-20261116.cjs',
  'scripts/publish-pending-review-20261114.cjs --dry-run',
  'scripts/publish-pending-review-20261114.cjs',
  'scripts/validate-data.cjs',
  'scripts/validate-approvals.cjs',
  'scripts/validate-updates.cjs',
  'scripts/build-season-data.cjs',
  'scripts/build-candidate-triage.cjs',
  'scripts/source-results-store.cjs verify',
  'scripts/build-source-results.cjs --check',
  'scripts/build-season-data.cjs --check',
  'scripts/build-candidate-triage.cjs --check'
 ];
 for(const item of must)assert(position(item)>=0,'critical production check missing: '+item);
 assert(position(must[0])<position(must[1])&&position(must[1])<position(must[2])&&
  position(must[2])<position(must[3]),'manual and generic publisher ordering changed');
 assert(position('scripts/validate-approvals.cjs')<
  position('scripts/build-season-data.cjs'),'publication audit must run before index build');
 assert(position('scripts/build-season-data.cjs')<
  position('scripts/build-season-data.cjs --check'),'generated index check must be last');
 return steps;
}

function copyToTemp(root=ROOT){
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'aot-rebuild-preflight-'));
 try{
  fs.cpSync(root,target,{recursive:true,filter:source=>{
   const rel=path.relative(root,source);
   if(rel&&rel.split(path.sep).some(x=>SKIP.has(x)))return false;
   if(fs.lstatSync(source).isSymbolicLink())
    throw Error('REBUILD_PREFLIGHT refuses symlink in repository: '+rel);
   return true;
  }});
  return target;
 }catch(e){fs.rmSync(target,{recursive:true,force:true});throw e}
}

function inspect(root){
 const load=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
 const src=load('source-results/manifest.json');
 const queue=load('history-sync-review.json');
 const ledger=load('approval-history.json');
 assert(Number.isSafeInteger(src.count)&&Array.isArray(queue.proposals)&&
  Array.isArray(ledger.entries),'invalid sandbox source or audit ledger');
 return {published:src.count,pending:queue.proposals.length,
  approvals:ledger.entries.length,sourceHash:hash(fs.readFileSync(path.join(root,'source-results/manifest.json')))};
}

function runSteps(root,steps,run=spawnSync){
 for(const [i,args] of steps.entries()){
  const start=performance.now();
  const label='['+(i+1)+'/'+steps.length+'] node '+args.join(' ');
  const outcome=run(process.execPath,args,{
   cwd:root,env:{...process.env,NODE_ENV:'test',AOT_REBUILD_PREFLIGHT:'1'},
   encoding:'utf8',maxBuffer:8*1024*1024,timeout:3*60*1000,
   stdio:['ignore','pipe','pipe']
  });
  const elapsed=Math.round(performance.now()-start);
  if(outcome.error||outcome.status!==0){
   const output=String(outcome.stdout||'')+'\n'+String(outcome.stderr||'');
   console.error('REBUILD_PREFLIGHT FAILED '+label+' ('+elapsed+'ms)');
   console.error(output.slice(-7000));
   throw Error('REBUILD_PREFLIGHT production step '+(i+1)+' failed: '+
    args.join(' ')+' / '+String(outcome.error||'exit '+outcome.status));
  }
  console.log('REBUILD_PREFLIGHT PASS '+label+' '+elapsed+'ms');
 }
}

function execute({root=ROOT,run=spawnSync,copy=copyToTemp}={}){
 const workflow=fs.readFileSync(path.join(root,WORKFLOW),'utf8');
 const steps=parseWorkflow(workflow);
 // Observe canonical bytes in the live checkout, then rehearse elsewhere.
 const authoritative=['source-results/manifest.json','history-sync-review.json',
  'approval-history.json','updates.json'];
 const originals=new Map(authoritative.map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]));
 const before=inspect(root);
 const start=performance.now(),temp=copy(root);
 let after;
 try{
  runSteps(temp,steps,run);
  after=inspect(temp);
  const generated=JSON.parse(fs.readFileSync(path.join(temp,'season-data/manifest.json'),'utf8'));
  const triage=JSON.parse(fs.readFileSync(path.join(temp,'candidate-triage.json'),'utf8'));
  assert(generated.total===after.published,'season manifest lost published results');
  assert(triage.total===after.pending,'triage queue diverged from review list');
  assert(after.approvals>=before.approvals,'existing approval history was dropped');
  for(const [file,sha] of originals)
   assert(hash(fs.readFileSync(path.join(root,file)))===sha,'original checkout mutated: '+file);
  const summary={status:'success',steps:steps.length,elapsedMs:Math.round(performance.now()-start),
   before,after,added:after.published-before.published,
   deltaPending:after.pending-before.pending};
  console.log('REBUILD_PREFLIGHT_RESULT '+JSON.stringify(summary));
  return summary;
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
if(require.main===module){
 try{execute()}catch(error){console.error(error.stack||error);process.exitCode=1}
}
module.exports={parseWorkflow,copyToTemp,inspect,runSteps,execute};
