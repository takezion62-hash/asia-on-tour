'use strict';
/**
 * AOT review-request gate. Treat branch files as untrusted data, never as
 * workflow code or source of prize rules.
 */
const SHA=/^[0-9a-f]{40}$/;
const IDENT=/^r[0-9]{8}-[a-z0-9][a-z0-9-]{4,43}$/;
const CANDIDATE=/^[A-Za-z0-9][A-Za-z0-9_.-]{4,99}$/;
function validSha(s){return typeof s==='string'&&SHA.test(s)&&s!=='0'.repeat(40)}
function validateRequest(req,ctx){
 if(!req||typeof req!=='object'||Array.isArray(req))throw Error('REVIEW_REQUEST object required');
 const required=['action','baseSha','confirmation','id','limit','requestedAt','version'];
 const permitted=[...required,'candidateIds'];
 for(const k of Object.keys(req))if(!permitted.includes(k))throw Error('REVIEW_REQUEST unknown field: '+k);
 for(const k of required)if(!Object.hasOwn(req,k))throw Error('REVIEW_REQUEST missing field: '+k);
 if(req.version!==1||req.action!=='publish-verified-batch'||req.confirmation!=='CONFIRM')
  throw Error('REVIEW_REQUEST invalid action, version, or authorization');
 if(typeof req.id!=='string'||!IDENT.test(req.id))throw Error('REVIEW_REQUEST invalid id');
 if(!Number.isSafeInteger(req.limit)||req.limit<1||req.limit>100)
  throw Error('REVIEW_REQUEST limit must be 1..100');
 if(!validSha(req.baseSha)||req.baseSha!==ctx.mainSha)
  throw Error('REVIEW_REQUEST stale or unexpected main SHA');
 if(ctx.ref!=='refs/heads/ops/review-request/'+req.id)
  throw Error('REVIEW_REQUEST branch/id mismatch');
 if(!validSha(ctx.headSha)||ctx.headSha===ctx.mainSha)
  throw Error('REVIEW_REQUEST invalid request commit');
 if(!Array.isArray(ctx.changedFiles)||ctx.changedFiles.length!==1||
    ctx.changedFiles[0]!=='review-requests/launch.json')
  throw Error('REVIEW_REQUEST branch must change launch.json only');
 if(ctx.parentSha!==req.baseSha)
  throw Error('REVIEW_REQUEST must be a single commit directly from main');
 const ms=Date.parse(req.requestedAt||'');
 if(typeof req.requestedAt!=='string'||!Number.isFinite(ms)||
    new Date(ms).toISOString()!==req.requestedAt||
    !Number.isFinite(ctx.now)||ctx.now-ms< -300000||ctx.now-ms>3*3600000)
  throw Error('REVIEW_REQUEST expired or future timestamp');
 const ids=req.candidateIds??[];
 if(!Array.isArray(ids)||ids.length>100||ids.length>req.limit||
    ids.some(x=>typeof x!=='string'||!CANDIDATE.test(x))||
    new Set(ids).size!==ids.length)
  throw Error('REVIEW_REQUEST invalid or duplicate candidate IDs');
 return {id:req.id,limit:req.limit,ids,baseSha:req.baseSha};
}
module.exports={validateRequest,validSha};
