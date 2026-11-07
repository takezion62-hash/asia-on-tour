'use strict';
// Rank-based cosmetic classification. In-game rewards only; physical goods and actual
// item delivery may require residence/eligibility checks and are never asserted here.
// Both the public Sources section and auto-publishing read one verified registry.
const cosmeticRules=require('../tournament-rules.json').rules.filter(rule=>rule.series==='skin-cup');
const RULE_URL=cosmeticRules[0]?.source||'';
const CUT_OFFS=Object.freeze(Object.fromEntries(cosmeticRules.map(rule=>[rule.id,Object.freeze({
 eventId:rule.eventIds[0],seasonId:rule.seasonId,chapter:rule.chapter,season:rule.season,
 team:rule.team,maxMatches:rule.matchCaps['スキン大会'],ranks:Object.freeze(rule.cosmeticRanks),
 source:rule.source
})])));
function evaluate(row){
 const event=CUT_OFFS[row?.tournamentId];
 const decline=reason=>({eligible:false,reason});
 if(!event)return decline('公式の獲得ラインが未登録の大会');
 if(row.seasonId!==event.seasonId||row.chapter!==event.chapter||row.season!==event.season||row.verified!==true)return decline('シーズン・本人照合が不一致');
 if(!['参加確認','スキン大会'].includes(row.kind)||!Number.isSafeInteger(row.rank)||row.rank<1)return decline('確認済みの順位がない');
 const cutoff=event.ranks[row.region];
 if(!Number.isSafeInteger(cutoff))return decline('地域の獲得ラインが不明');
 if(row.rank>cutoff)return decline('報酬圏外');
 if(!Number.isSafeInteger(row.matches)||row.matches<1||row.matches>event.maxMatches||!Number.isSafeInteger(row.kills)||row.kills<0||!Number.isSafeInteger(row.vrs)||row.vrs<0||row.vrs>row.matches)return decline('成績データの矛盾');
 let url;
 try{url=new URL(row.source)}catch{return decline('大会出典が不正')}
 if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||url.pathname!=='/competitive/events/'+event.eventId+'/'||
   url.searchParams.get('region')!==row.region||url.searchParams.get('round')!==event.eventId+'_'+row.region)
   return decline('公式大会の開催枠を照合できない');
 return {eligible:true,cutoff,rule:event.source};
}
module.exports={RULE_URL,CUT_OFFS,evaluate};
