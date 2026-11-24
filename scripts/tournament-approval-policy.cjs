'use strict';
// Registry-based routing; no permission to publish is granted by this module.
// Existing adapters must still check identity, timestamps, evidence and collisions.
const {rules}=require('../tournament-rules.json');
const REGIONS=Object.freeze(['ME','EU','NAC','NAW','OCE','BR']);
const TEAMS=Object.freeze(['solo','duo','trio','squad']);
const POLICIES=Object.freeze([
 {id:'verified',flag:'autoApproveVerified',historicalOnly:true,series:['victory-cup'],modes:[undefined,'verified-qualifier-participation','verified-duo-qualifier-only'],adapter:'./verified-history-approval.cjs'},
 {id:'cosmetic',flag:'autoApproveCosmetic',series:['skin-cup'],modes:[undefined,'verified-team-rank'],adapter:'./automatic-cosmetic-approval.cjs'},
 {id:'cash',flag:'autoApproveCash',series:['cash-cup'],modes:['verified-team-rank'],extra:'verified-duo-round2-rank',adapter:'./automatic-cash-approval.cjs'},
 {id:'performance',flag:'autoApprovePerformance',series:['performance-evaluation'],modes:['verified-performance-vr'],adapter:'./automatic-performance-approval.cjs'},
 {id:'unreal',flag:'autoApproveUnreal',series:['unreal-cup'],modes:['verified-team-rank'],adapter:'./automatic-unreal-approval.cjs'},
 {id:'nvidia',flag:'autoApproveNvidia',series:['nvidia-cup'],modes:['verified-solo-rank'],adapter:'./automatic-nvidia-approval.cjs'},
 {id:'duo',flag:'autoApproveDuoQualifier',series:['victory-cup','cash-cup'],modes:['verified-duo-qualifier-only'],adapter:'./automatic-duo-qualifier-approval.cjs'},
 {id:'playstation',flag:'autoApprovePlayStation',series:['playstation-cup'],modes:['verified-playstation-solo'],adapter:'./automatic-playstation-approval.cjs'}
].map(p=>Object.freeze({...p,series:Object.freeze(p.series),modes:Object.freeze(p.modes)})));
function supports(p,r){
 return Boolean(p&&r&&p.series.includes(r.series)&&TEAMS.includes(r.team)&&r.autoApproval!=='review-only'&&
  (p.modes.includes(r.autoApproval)||(p.extra&&r.autoApproval==='verified-duo-qualifier-only'&&r.cashFinalAutoApproval===p.extra)));
}
function policyIds(rule){return POLICIES.filter(p=>supports(p,rule)).map(p=>p.id)}
function selectRules(id,registry=rules){
 const p=POLICIES.find(x=>x.id===id);
 return Object.freeze(Object.fromEntries(registry.filter(r=>supports(p,r)).map(r=>[r.id,r])));
}
function matchesWindow(rule,win,kind){
 return Boolean(rule&&win&&win.tournamentId===rule.id&&win.seasonId===rule.seasonId&&win.series===rule.series&&
  Array.isArray(rule.eventIds)&&rule.eventIds.includes(win.eventId)&&REGIONS.includes(win.region)&&win.kind===kind&&typeof win.windowId==='string');
}
// Explicitly documented event prefix; no title guessing or NA->NAC mapping.
function eventWindow(rule,win,{kind='参加確認',format='event-round',rounds=[1,2],optionalSeparator=false}={}){
 if(!matchesWindow(rule,win,kind))return null;
 const prefix=rule.windowIdPrefix??win.eventId;
 if(typeof prefix!=='string'||!prefix)return null;
 if(format==='single')return win.windowId===prefix+'_'+win.region?{stage:'single'}:null;
 if(!win.windowId.startsWith(prefix+'_')||!win.windowId.endsWith('_'+win.region))return null;
 const body=win.windowId.slice(prefix.length+1,-win.region.length-1);
 if(format==='event'){
  const m=body.match(/^Event([1-9][0-9]*)$/);
  return m&&Number.isSafeInteger(Number(m[1]))?{event:Number(m[1])}:null;
 }
 if(format!=='event-round')return null;
 const m=body.match(optionalSeparator?/^Event([1-9][0-9]*)_?Round([12])$/:/^Event([1-9][0-9]*)Round([12])$/);
 if(!m||!rounds.includes(Number(m[2]))||!Number.isSafeInteger(Number(m[1])))return null;
 return {event:Number(m[1]),round:Number(m[2])};
}
function requiresCheckpointEpicIds(series){return ['unreal-cup','nvidia-cup','playstation-cup'].includes(series)}
function retainsCandidateEpicIds(series,team){return team==='duo'||['cash-cup','performance-evaluation'].includes(series)||requiresCheckpointEpicIds(series)}
module.exports={POLICIES,policyIds,selectRules,matchesWindow,eventWindow,requiresCheckpointEpicIds,retainsCandidateEpicIds};
