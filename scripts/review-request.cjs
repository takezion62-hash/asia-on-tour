'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
const {validateRequest,validSha}=require('./review-request-core.cjs');
function git(...args){return cp.execFileSync('git',args,{encoding:'utf8'}).trim()}
const req=JSON.parse(fs.readFileSync('.review-request.json','utf8'));
const head=process.env.GITHUB_SHA,base=git('rev-parse','HEAD');
if(!validSha(head)||!validSha(base))throw Error('REVIEW_REQUEST missing git commits');
const parent=git('rev-parse',head+'^');
const changed=git('diff','--no-ext-diff','--no-textconv','--no-renames',
 '--name-only',base,head,'--').split('\n').filter(Boolean);
const result=validateRequest(req,{
 ref:process.env.GITHUB_REF,headSha:head,parentSha:parent,
 mainSha:base,changedFiles:changed,now:Date.now()
});
const env=process.env.GITHUB_ENV;
if(!env)throw Error('REVIEW_REQUEST GitHub Actions only');
fs.appendFileSync(env,'AOT_REQUEST_ID='+result.id+'\nAOT_REQUEST_LIMIT='+result.limit+
 '\nAOT_REQUEST_IDS='+result.ids.join(',')+'\nAOT_REQUEST_BASE='+result.baseSha+'\n');
console.log('AOT_REQUEST_AUTHORIZED '+JSON.stringify({
 id:result.id,limit:result.limit,selectedIds:result.ids.length,
 origin:process.env.GITHUB_REF,base:result.baseSha
}));
