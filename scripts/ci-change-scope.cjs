'use strict';
// Fail closed. The workflow executes this file from the trusted previous
// commit (PR base or pre-push main), never from the proposed new code.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const focused=require('./ci-focused-scope.cjs');
const META=new Set([
 'players.json','tournaments.json','updates.json','approval-history.json',
 'auto-sync-review.json','auto-sync-status.json',
 'history-sync-review.json','history-sync-reviewed.json','history-sync-status.json',
 'candidate-triage.json'
]);
const SOURCE_SHARD=/^source-results\/(?:S[1-9]\d*|unknown)\.json$/;
const OUTPUT=/^season-data\/(?:S[1-9]\d*|unknown|ranking-(?:S[1-9]\d*|unknown|all)|manifest)\.json$/;
const REVIEW_REPORT=/^review-reports\/\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?\.md$/;
const SOURCE_MANIFEST='source-results/manifest.json';
// Pure roster-alias additions can use the same strict data CI as a source
// publication, but ONLY when the trusted base and proposed JSON prove that
// canonical players and all existing alias ownership are unchanged.
function appendOnlyPlayerAliases(beforeText,afterText){
 if(typeof beforeText!=='string'||typeof afterText!=='string'||
    beforeText.length>2*1024*1024||afterText.length>2*1024*1024)return false;
 let old,next;
 try{old=JSON.parse(beforeText);next=JSON.parse(afterText)}catch{return false}
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 if(!plain(old)||!plain(next)||
    JSON.stringify(Object.keys(old).sort())!==JSON.stringify(Object.keys(next).sort())||
    !Array.isArray(old.candidates)||!Array.isArray(next.candidates)||
    JSON.stringify(old.candidates)!==JSON.stringify(next.candidates)||
    !plain(old.confirmedAliases)||!plain(next.confirmedAliases))return false;
 // No extra top-level file payload may change.
 for(const key of Object.keys(old))
   if(key!=='confirmedAliases'&&JSON.stringify(old[key])!==JSON.stringify(next[key]))return false;
 const names=old.candidates.map(p=>p?.name);
 if(names.some(n=>typeof n!=='string'||!n)||new Set(names).size!==names.length)return false;
 const canonical=new Set(names),claimed=new Map(names.map(n=>[n,n]));
 const previous=old.confirmedAliases,current=next.confirmedAliases;
 let added=0;
 for(const [owner,aliases] of Object.entries(current)){
  if(!canonical.has(owner)||!Array.isArray(aliases))return false;
  const before=Object.prototype.hasOwnProperty.call(previous,owner)?previous[owner]:[];
  if(!Array.isArray(before)||aliases.length<before.length||
     before.some((value,i)=>aliases[i]!==value))return false;
  for(let i=0;i<aliases.length;i++){
   const alias=aliases[i];
   if(typeof alias!=='string'||!alias.trim()||alias.length>1024||
      claimed.has(alias))return false;
   claimed.set(alias,owner);
   if(i>=before.length){if(alias.length>256)return false;added++}
  }
 }
 if(Object.keys(previous).some(owner=>!Object.prototype.hasOwnProperty.call(current,owner)))return false;
 return added>0;
}
function classify(files,{workflowBefore,workflowAfter,playersBefore,playersAfter}={}){
 if(!Array.isArray(files)||files.length===0)return {mode:'full',reason:'no-changes'};
 if(files.length>3000)return {mode:'full',reason:'too-many-changes'};
 let shard=false,manifest=false,allData=true;
 const seen=new Set();
 for(const item of files){
  if(!item||!['A','M'].includes(item.status))
   return {mode:'full',reason:'unsafe-change-type'};
  const p=item.path;
  if(typeof p!=='string'||!p||p.includes('\0')||p.includes('\\')||seen.has(p))
   return {mode:'full',reason:'invalid-or-duplicate-path'};
  seen.add(p);
  if(SOURCE_SHARD.test(p)){shard=true;continue}
  if(p===SOURCE_MANIFEST){manifest=true;continue}
  if(META.has(p)||OUTPUT.test(p)||REVIEW_REPORT.test(p))continue;
  allData=false;
  // Unknown paths remain rejected by the allowlisted, trusted focused selector.
  continue;
 }
 // Canonical records + manifest: safe, strict data-only verification.
 if(allData && shard && manifest)return {mode:'data',reason:'verified-records-paths-only'};
 // A player alias append has no new result IDs or cash: compare BOTH trusted
 // base and proposed JSON, and forbid approvals, source edits or unrelated files.
 if(allData&&!shard&&!manifest&&seen.has('players.json')&&
    [...seen].every(p=>p==='players.json'||p==='candidate-triage.json'||OUTPUT.test(p))&&
    appendOnlyPlayerAliases(playersBefore,playersAfter))
   return {mode:'data',reason:'append-only-player-aliases'};
 // Data and executable code in the same PR must NEVER bypass full CI. Split
 // into validation/test PR first, then canonical data-only PR after merge.
 if(shard&&manifest&&!allData)
   return {mode:'full',reason:'mixed-data-and-code-split-pr'};
 if(shard||manifest)return {mode:'full',reason:'incomplete-source-store-or-unsafe-mixed-diff'};
 if(seen.has('players.json'))
   return {mode:'full',reason:'unsafe-or-unverified-player-metadata-diff'};
 const choice=focused.select(files);
 if(!choice)return {mode:'full',reason:'code-or-unknown-change'};
 if(files.some(x=>x.path==='.github/workflows/build-season-data.yml')&&
    !focused.appendOnlyPublisher(workflowBefore,workflowAfter,choice.publisherFiles))
  return {mode:'full',reason:'unsafe-publisher-workflow-diff'};
 return choice;
}
function parseNameStatus(buffer){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer[buffer.length-1]!==0)
  throw Error('Incomplete Git name/status output');
 const fields=buffer.toString('utf8').split('\0');
 if(fields.pop()!==''||fields.length%2!==0)
  throw Error('Malformed Git name/status output');
 const files=[];
 for(let i=0;i<fields.length;i+=2)
  files.push({status:fields[i],path:fields[i+1]});
 return files;
}
const safeSha=s=>typeof s==='string'&&/^[0-9a-f]{40}$/i.test(s)&&!/^0{40}$/.test(s);
function detect(env=process.env,git=execFileSync){
 let before,after;
 if(env.GITHUB_EVENT_NAME==='pull_request'){
  before=env.PR_BASE_SHA;after=env.PR_HEAD_SHA;
 }else if(env.GITHUB_EVENT_NAME==='push'&&env.GITHUB_REF==='refs/heads/main'){
  before=env.PUSH_BEFORE_SHA;after=env.PUSH_AFTER_SHA;
 }else if(env.GITHUB_EVENT_NAME==='workflow_dispatch'&&
  /^refs\/heads\/reviewed-results\/[0-9]+-[0-9]+$/.test(env.GITHUB_REF||'')){
  before=env.DISPATCH_BASE_SHA;after=env.GITHUB_SHA;
 }else return {mode:'full',reason:'unsupported-event-or-branch'};
 if(!safeSha(before)||!safeSha(after))
  return {mode:'full',reason:'invalid-commit-ids'};
 try{
  if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
   // A dispatcher must prove the saved base is from trusted main AND
   // an ancestor of this exact generated-results branch head.
   git('git',['merge-base','--is-ancestor',before,after]);
   git('git',['merge-base','--is-ancestor',before,'refs/remotes/origin/main']);
  }
  const changes=git('git',[
   'diff','--no-ext-diff','--no-textconv','--no-renames',
   '--name-status','-z',before,after,'--'
  ],{maxBuffer:8*1024*1024});
  const files=parseNameStatus(changes);
  let workflowBefore,workflowAfter,playersBefore,playersAfter;
  if(files.some(x=>x.path==='.github/workflows/build-season-data.yml')){
   workflowBefore=git('git',['show',before+':.github/workflows/build-season-data.yml'],
    {maxBuffer:2*1024*1024}).toString('utf8');
   workflowAfter=git('git',['show',after+':.github/workflows/build-season-data.yml'],
    {maxBuffer:2*1024*1024}).toString('utf8');
  }
  // Read identities only for a potential roster-only data PR. All other
  // changes stay on the existing fail-closed code/data classification paths.
  if(files.some(x=>x.path==='players.json')&&
     !files.some(x=>x.path.startsWith('source-results/'))){
   playersBefore=git('git',['show',before+':players.json'],
    {maxBuffer:2*1024*1024}).toString('utf8');
   playersAfter=git('git',['show',after+':players.json'],
    {maxBuffer:2*1024*1024}).toString('utf8');
  }
  return classify(files,{workflowBefore,workflowAfter,playersBefore,playersAfter});
 }catch{return {mode:'full',reason:'git-diff-failed'}}
}
if(require.main===module){
 const result=detect();
 if(process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
   'mode='+result.mode+'\nreason='+result.reason+'\n'+
   'unit_files='+(result.unitFiles||[]).join(' ')+'\n'+
   'browser_files='+(result.browserFiles||[]).join(' ')+'\n'+
   'publisher_files='+(result.publisherFiles||[]).join(' ')+'\n');
 console.log('Change-aware CI: '+result.mode+' ('+result.reason+')');
}
module.exports={classify,appendOnlyPlayerAliases,parseNameStatus,detect,safeSha};
