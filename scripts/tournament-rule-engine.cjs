'use strict';
// Pure rule arithmetic. This module does NOT grant publication permission.
// Adapters must still validate official event IDs, region, dates, identity,
// checkpoints, duplicates and opt-in policy before using a result.
const TEAM_SIZES=Object.freeze({solo:1,duo:2,trio:3,squad:4});
const positive=n=>Number.isSafeInteger(n)&&n>0;
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
function own(object,key){
 return object&&typeof object==='object'&&Object.hasOwn(object,key)?object[key]:undefined;
}
function positiveField(object,key){
 const value=own(object,key);
 return positive(value)?value:null;
}
const advancementCutoff=(rule,region)=>positiveField(rule?.advance,region);
const matchCap=(rule,stage)=>positiveField(rule?.matchCaps,stage);
const cosmeticCutoff=(rule,region)=>positiveField(rule?.cosmeticRanks,region);
function qualifies(rule,region,rank){
 const cutoff=advancementCutoff(rule,region);
 return cutoff===null||!positive(rank)?null:rank<=cutoff;
}
function validMatchCount(rule,stage,matches){
 const cap=matchCap(rule,stage);
 return cap!==null&&positive(matches)&&matches<=cap;
}
// Do not interpret an absent or malformed payout table as a zero-dollar award.
function rankTable(rule,region,basis){
 const cash=rule?.cashPrizes;
 if(!cash||cash.basis!==basis||cash.currency!=='USD')return null;
 const tiers=own(cash.tiers,region);
 const amountKey=basis==='per-player'?'perPlayer':basis==='per-team'?'perTeam':null;
 if(!amountKey||!Array.isArray(tiers)||!tiers.length)return null;
 let last=0;
 for(const tier of tiers){
  if(!positive(tier?.through)||tier.through<=last||!nonnegative(tier[amountKey]))return null;
  last=tier.through;
 }
 return {tiers,amountKey,last};
}
function rankPrize(rule,region,rank,basis){
 if(!positive(rank))return null;
 const table=rankTable(rule,region,basis);
 if(!table)return null;
 const tier=table.tiers.find(t=>rank<=t.through);
 return tier?tier[table.amountKey]:0;
}
function payingRank(rule,region,basis='per-player'){
 return rankTable(rule,region,basis)?.last??null;
}
function individualRankPrize(rule,region,rank){
 return rankPrize(rule,region,rank,'per-player');
}
function teamRankPrize(rule,region,rank){
 const team=rankPrize(rule,region,rank,'per-team'),size=own(TEAM_SIZES,rule?.team);
 if(team===null||!positive(size)||rule.cashPrizes.teamSize!==size)return null;
 const cents=team*100;
 if(!Number.isSafeInteger(cents)||cents%size!==0)return null;
 return {team,perPlayer:cents/size/100};
}
// Legacy verified Victory Cup adapters can explicitly authorize zero VR as
// known zero cash even where the positive per-VR amount is not documented.
function individualVrPrize(rule,vrs,{allowUnknownZero=false}={}){
 if(!nonnegative(vrs))return null;
 if(!positive(rule?.prizePerVictory))return allowUnknownZero&&vrs===0?0:null;
 const amount=vrs*rule.prizePerVictory;
 return nonnegative(amount)?amount:null;
}
// Generic two-round labels must be explicitly documented. The adapter still
// checks its own series, season, mode, and approval opt-in.
function namedRound(rule,win){
 const rounds=rule?.roundWindows;
 if(!rounds||!Array.isArray(rule.eventIds)||!rule.eventIds.includes(win?.eventId)||
    win?.seasonId!==rule.seasonId||win?.tournamentId!==rule.id||
    win?.series!==rule.series||typeof win.region!=='string')return null;
 const q=rounds.qualifier,f=rounds.final;
 if(typeof q!=='string'||typeof f!=='string'||q===f||
    !/^[A-Za-z0-9]+$/.test(q)||!/^[A-Za-z0-9]+$/.test(f))return null;
 for(const [label,stage] of [[q,'予選'],[f,'賞金決勝']]){
  if(win.windowId===win.eventId+'_'+label+'_'+win.region&&
     win.round===label+' / 参加確認')return {label,stage};
 }
 return null;
}
module.exports={advancementCutoff,matchCap,cosmeticCutoff,qualifies,validMatchCount,
 individualRankPrize,teamRankPrize,payingRank,individualVrPrize,namedRound};
