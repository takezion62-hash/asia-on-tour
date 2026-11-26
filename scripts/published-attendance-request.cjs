'use strict';
// A request carries only explicit permission to replay trusted main evidence.
// No supplied candidate data, code, prize, command or output path is accepted.
const fs=require('node:fs'),cp=require('node:child_process');
const {validSha}=require('./review-request-core.cjs');
const REQUEST_FILE='review-requests/attendance-recheck.json';
const PREFIX='refs/heads/ops/attendance-recheck/';
const ID=/^r[0-9]{8}-[a-z0-9][a-z0-9-]{4,43}$/;
function validateAttendanceRequest(req,ctx){
 const reject=reason=>{throw Error('ATTENDANCE_REQUEST '+reason)};
 const keys=['version','action','id','confirmation','baseSha','requestedAt'];
 if(!req||typeof req!=='object'||Array.isArray(req)||Object.keys(req).length!==keys.length||
    keys.some(k=>!Object.hasOwn(req,k)))reject('exact request fields required');
 if(req.version!==1||req.action!=='prepare-attendance-corrections'||req.confirmation!=='CONFIRM')
  reject('invalid action, version, or confirmation');
 if(typeof req.id!=='string'||!ID.test(req.id)||ctx.ref!==PREFIX+req.id)reject('branch/id mismatch');
 if(!validSha(req.baseSha)||req.baseSha!==ctx.mainSha||!validSha(ctx.headSha)||ctx.headSha===ctx.mainSha)
  reject('stale main or invalid commit');
 if(!Array.isArray(ctx.parents)||ctx.parents.length!==1||ctx.parents[0]!==req.baseSha)
  reject('single direct commit from current main required');
 if(!Array.isArray(ctx.changedFiles)||ctx.changedFiles.length!==1||ctx.changedFiles[0]!==REQUEST_FILE||
    ctx.fileMode!=='100644')reject('only regular request JSON may change');
 const stamp=Date.parse(req.requestedAt||'');
 if(typeof req.requestedAt!=='string'||!Number.isFinite(stamp)||new Date(stamp).toISOString()!==req.requestedAt||
    !Number.isFinite(ctx.now)||ctx.now-stamp< -300000||ctx.now-stamp>3*3600000)
  reject('expired or future request');
 return {id:req.id,baseSha:req.baseSha};
}
function main(){
 const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
 const head=process.env.GITHUB_SHA,base=git('rev-parse','HEAD');
 if(!validSha(head)||!validSha(base))throw Error('ATTENDANCE_REQUEST invalid git SHA');
 const parents=git('rev-list','--parents','-n','1',head).split(/\s+/).slice(1);
 const changedFiles=git('diff','--no-ext-diff','--no-textconv','--no-renames','--name-only',base,head,'--').split('\n').filter(Boolean);
 const fileMode=git('ls-tree',head,'--',REQUEST_FILE).split(/\s+/)[0];
 const result=validateAttendanceRequest(JSON.parse(fs.readFileSync('.attendance-request.json','utf8')),{
  ref:process.env.GITHUB_REF,headSha:head,mainSha:base,parents,changedFiles,fileMode,now:Date.now()
 });
 if(!process.env.GITHUB_ENV)throw Error('ATTENDANCE_REQUEST GitHub Actions only');
 fs.appendFileSync(process.env.GITHUB_ENV,'AOT_ATTENDANCE_REQUEST_ID='+result.id+'\nAOT_ATTENDANCE_REQUEST_BASE='+result.baseSha+'\n');
 console.log('AOT_ATTENDANCE_REQUEST_AUTHORIZED '+JSON.stringify(result));
}
if(require.main===module)main();
module.exports={validateAttendanceRequest,REQUEST_FILE,PREFIX};
