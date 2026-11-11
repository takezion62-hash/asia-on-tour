'use strict';
// Chapter 7 Mini Season Squads Victory Cup, official Epic Nov 1 2026 rules.
// This is a classification of *verified saved scoreboard rows*, NOT a score
// downloader and NOT a cash/VR payout decision.
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-squads-victory-cup-chapter-7-mini-season-official-rules';
// All confirmed Round1 scores are in the official, verified-rule category.
// Advancement is encoded only by the original rank cutoff and 予選突破 round label.
const advance=Object.freeze({EU:300,NAC:200,NAW:120,BR:120,ME:120,OCE:120,ASIA:120});
function classifyS43SquadsQualifier(r,spec){
 const valid=x=>{if(!x)throw Error('S43 squads qualification: original row invalid or award not established')};
 valid(spec?.type==='squad-qual'&&spec.event==='S43_SquadsVictoryCup'&&spec.season==='S43'&&spec.rule===RULE);
 const cutoff=advance[r.region];
 valid(Number.isSafeInteger(cutoff)&&r.seasonId==='S43'&&
  r.event==='Squads Victory Cup Battle Royale'&&r.kind==='予選'&&
  Number.isSafeInteger(r.rank)&&r.rank>0&&
  typeof r.points==='number'&&Number.isSafeInteger(r.points)&&r.points>=0&&
  Number.isSafeInteger(r.kills)&&r.kills>=0&&
  Number.isSafeInteger(r.vrs)&&r.vrs>=0&&
  Number.isSafeInteger(r.matches)&&r.matches>0&&r.matches<=8&&r.vrs<=r.matches&&
  r.prize===0&&r.verified===true&&
  Array.isArray(r.players)&&r.players.length===4&&new Set(r.players).size===4&&
  typeof r.round==='string'&&/Round 1\s*\/\s*予選$/.test(r.round));
 const qualified=r.rank<=cutoff;
 const round=r.round.replace(/\/\s*予選$/,'/ '+(qualified?'予選突破':'予選'));
 return {
  policy:'verified-rule',
  kind:'予選',round,prize:0,
  note:'本人Epic ID・保存済み公式順位表と公式開催枠で'+r.rank+'位、'+r.points+'pt、'+r.kills+
    'K、'+r.vrs+'VRを照合。'+
    (qualified?'MEなど地域別の公式上位'+cutoff+'チーム以内でRound2進出。':
      '公式通過枠は上位'+cutoff+'チーム。進出対象外の予選参加・順位として記録し、通過実績には加算しない。')+
    ' Round1は現金賞金$0。決勝のVR賞金を推定しない。公式規則: '+RULE
 };
}
module.exports={classifyS43SquadsQualifier,advance,RULE};
