'use strict';
// Fail closed. The workflow executes this file from the trusted previous
// commit (PR base or pre-push main), never from the proposed new code.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
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
function classify(files){
 if(!Array.isArray(files)||files.length===0)return {mode:'full',reason:'no-changes'};
 if(files.length>3000)return {mode:'full',reason:'too-many-changes'};
 let shard=false,manifest=false;
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
  return {mode:'full',reason:'code-or-unknown-change'};
 }
 // Metadata-only and generated-only changes are never a records-only PR.
 if(!shard||!manifest)return {mode:'full',reason:'incomplete-source-store-diff'};
 return {mode:'data',reason:'verified-records-paths-only'};
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
  return classify(parseNameStatus(changes));
 }catch{return {mode:'full',reason:'git-diff-failed'}}
}
if(require.main===module){
 const result=detect();
 if(process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'mode='+result.mode+'\nreason='+result.reason+'\n');
 console.log('Change-aware CI: '+result.mode+' ('+result.reason+')');
}
module.exports={classify,parseNameStatus,detect,safeSha};
