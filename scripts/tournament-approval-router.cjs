'use strict';
const {POLICIES}=require('./tournament-approval-policy.cjs');
// Preserve the legacy ordering, exact opt-in flags, and evolving results.
// Broad legacy evaluators see all pending rows to preserve held reasons.
function runApprovals(pending,windows,checkpoints,data,config,{historical=false,initialReasons=[],load=p=>require(p.adapter)}={}){
 const batches={},approved=[],reasons=new Map(initialReasons),verifiedParticipationIds=new Set();
 for(const policy of POLICIES){
  const enabled=config?.[policy.flag]===true&&(!policy.historicalOnly||historical);
  const result=enabled?load(policy).evaluate(pending,windows,checkpoints,
   policy.id==='verified'?data:{...data,results:[...data.results,...approved]}):{approved:[],held:[]};
  batches[policy.id]=result;
  approved.push(...result.approved);
  for(const hold of result.held){
   if(policy.id==='cosmetic'&&reasons.has(hold.id))continue;
   reasons.set(hold.id,hold.reason);
  }
  if(policy.id==='verified'){
   for(const row of result.approved)if(row.kind==='参加確認'&&row.reviewOnly!==true&&row.verified===true&&row.prize===0)
    verifiedParticipationIds.add(row.id);
  }
  if(policy.id==='playstation'){
   const grant=new Set(result.participationIds||[]);
   for(const row of result.approved)if(grant.has(row.id)&&row.kind==='参加確認'&&row.verified===true&&row.prize===0&&row.reviewOnly!==true)
    verifiedParticipationIds.add(row.id);
  }
 }
 return {batches,approved,reasons,verifiedParticipationIds};
}
module.exports={runApprovals};
