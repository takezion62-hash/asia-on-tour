'use strict';
const {POLICIES,policyIds}=require('./tournament-approval-policy.cjs');
const {rules}=require('../tournament-rules.json');
const ruleById=new Map(rules.map(r=>[r.id,r]));
// Keep award decisions unchanged; only accept a relevant adapter's hold reason.
// A dual-policy tournament uses the qualifier route for Round 1 and cash for Round 2.
function reasonRoute(row,catalog,config){
 const rule=ruleById.get(row?.tournamentId);
 if(!rule||!catalog||catalog.series!==rule.series||catalog.seasonId!==rule.seasonId)return null;
 const routes=policyIds(rule);
 if(routes.includes('consoleDuos')&&config?.autoApproveConsoleDuos===true)return 'consoleDuos';
 if(routes.includes('squads'))return 'squads';
 if(routes.includes('duo')){
  if(row.kind==='予選'||/Round 1\s*\//.test(row.round||''))return 'duo';
  if(routes.includes('cash')&&/Round 2\s*\//.test(row.round||''))return 'cash';
  if(routes.includes('verified'))return 'verified';
  return null;
 }
 return routes[0]||null;
}
// Preserve the legacy ordering, exact opt-in flags, and evolving results.
// Broad legacy evaluators keep their original input; irrelevant held reasons are ignored.
function runApprovals(pending,windows,checkpoints,data,config,{historical=false,initialReasons=[],load=p=>require(p.adapter)}={}){
 const batches={},approved=[],reasons=new Map(initialReasons),verifiedParticipationIds=new Set();
 const catalog=new Map((data.tournaments?.catalog||[]).map(t=>[t.id,t]));
 const relevant=new Map(pending.map(row=>[row.id,reasonRoute(row,catalog.get(row.tournamentId),config)]));
 const enabledRoutes=new Set();

 for(const policy of POLICIES){
  const enabled=config?.[policy.flag]===true&&(!policy.historicalOnly||historical);
  if(enabled)enabledRoutes.add(policy.id);
  // Dedicated Console Duos takes exclusive ownership when enabled; legacy
  // qualifier and pinned final paths cannot bypass its stricter checks.
  const input=policy.id!=='consoleDuos'&&config?.autoApproveConsoleDuos===true&&pending.some(r=>relevant.get(r.id)==='consoleDuos')?
   pending.filter(r=>relevant.get(r.id)!=='consoleDuos'):pending;
  const result=enabled?load(policy).evaluate(input,windows,checkpoints,
   policy.id==='verified'?data:{...data,results:[...data.results,...approved]}):{approved:[],held:[]};
  batches[policy.id]=result;
  approved.push(...result.approved);
  for(const hold of result.held){
   if(relevant.get(hold.id)===policy.id)reasons.set(hold.id,hold.reason);
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
 const approvedIds=new Set(approved.map(r=>r.id));
 for(const row of pending){
  if(approvedIds.has(row.id))continue;
  const route=relevant.get(row.id);
  if(!route)reasons.set(row.id,'対象大会・ラウンドの自動承認方式が未登録');
  else if(!enabledRoutes.has(route))reasons.set(row.id,'対象大会の自動承認設定が無効');
  else if(!reasons.has(row.id))reasons.set(row.id,'対象大会の公式承認条件を追加確認');
 }
 return {batches,approved,reasons,verifiedParticipationIds};
}
module.exports={runApprovals};
