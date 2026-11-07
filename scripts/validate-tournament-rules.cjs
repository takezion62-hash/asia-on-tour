'use strict';
const fs=require('node:fs'),path=require('node:path');
const REGIONS=new Set(['ME','EU','NAC','NAW','OCE','BR']);
const UNREAL_REGIONS=['EU','NAC','NAW','BR','ME','ASIA','OCE'];
const TEAMS=new Set(['solo','duo','trio','squad']);
const URL_HOSTS=new Set(['fortnite.com','www.fortnite.com']);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validateRegistry(doc,tournaments){
 const errors=[];
 const fail=(id,message)=>errors.push(id+': '+message);
 if(!object(doc)||doc.version!==1||!Array.isArray(doc.rules))return ['rules document: version:1 と rules 配列が必要です'];
 if(!Array.isArray(tournaments?.catalog))return ['tournaments catalog unavailable'];
 const catalog=new Map(tournaments.catalog.map(x=>[x.id,x])),known=new Set();
 for(const rule of doc.rules){
  const id=String(rule?.id||'missing');
  if(known.has(id))fail(id,'大会IDが重複');known.add(id);
  const t=catalog.get(id);
  if(!t){fail(id,'登録済み大会カタログにありません');continue}
  if(rule.seasonId!==t.seasonId||rule.team!==t.team||rule.series!==t.series)fail(id,'シーズン/チーム/シリーズが一致しません');
  if(!['victory-cup','skin-cup','cash-cup','performance-evaluation','unreal-cup'].includes(rule.series))fail(id,'対応していないルールシリーズです');
  if(!Array.isArray(rule.eventIds)||!rule.eventIds.length||new Set(rule.eventIds).size!==rule.eventIds.length||
      rule.eventIds.some(x=>typeof x!=='string'||!t.sourceEventIds.includes(x)))fail(id,'EpicイベントIDがカタログと不一致');
  if(!TEAMS.has(rule.team))fail(id,'チーム形式が不正');
  let url;
  try{url=new URL(rule.source)}catch{}
  if(!url||url.protocol!=='https:'||!URL_HOSTS.has(url.hostname)||url.username||url.password||url.hash)fail(id,'Epic公式規則URLが不正');
  if(!object(rule.matchCaps)||!Object.keys(rule.matchCaps).length||
     Object.entries(rule.matchCaps).some(([name,value])=>!['予選','賞金決勝','スキン大会','単一ラウンド','Performance決勝'].includes(name)||!positive(value)||value>40))fail(id,'公式試合数上限が不正');
  if(rule.series==='victory-cup'){
   if(!positive(rule.matchCaps?.['予選'])||!positive(rule.matchCaps?.['賞金決勝']))fail(id,'Victory Cupの予選/決勝試合数上限が不足');
   if(!object(rule.advance)||!Object.keys(rule.advance).length||
      Object.entries(rule.advance).some(([region,value])=>!REGIONS.has(region)||!positive(value)))fail(id,'地域別予選通過順位が不正');
   if(rule.cosmeticRanks!==undefined)fail(id,'Victory Cupにスキン順位は登録不可');
   if(rule.prizePerVictory!==undefined&&(!positive(rule.prizePerVictory)||rule.prizePerVictory>10000))fail(id,'VR賞金単価が不正');
  }else if(rule.series==='performance-evaluation'){
   if(rule.autoApproval!=='verified-performance-vr'||rule.seasonId!=='S43'||
     rule.team!=='trio'||rule.eventIds?.length!==1||
     rule.eventIds[0]!=='S43_PerformanceEvaluationTrios'||
     rule.windowIdPrefix!=='S43_PerformanceEvaluation')
     fail(id,'S43トリオの検証済み大会IDと承認方式のみ許可');
   if(!positive(rule.matchCaps?.['予選'])||!positive(rule.matchCaps?.['Performance決勝'])||
     rule.matchCaps['Performance決勝']!==4||rule.matchCaps['予選']>8)
     fail(id,'予選・Performance決勝の試合上限が不正');
   if(!object(rule.advance)||Object.keys(rule.advance).sort().join(',')!=='EU,NAC'||
     rule.advance.EU!==26||rule.advance.NAC!==26)
     fail(id,'S43 EU/NAC予選突破は上位26チーム');
   if(!positive(rule.prizePerVictory)||rule.prizePerVictory!==400||
     rule.finalWinPoints!==100||rule.powerRankingTop!==5000)
     fail(id,'S43決勝VR単価・ポイント・参加条件が不正');
   if(rule.cashPrizes!==undefined||rule.cosmeticRanks!==undefined)
     fail(id,'Performance Evaluationに他大会の賞金条件を混在させない');
  }else if(rule.series==='cash-cup'){
   // Cash Cup rules may be displayed, but are not eligible for automatic payout
   // publication until team identity, session completion and eligibility checks exist.
   if(!['review-only','verified-team-rank'].includes(rule.autoApproval))fail(id,'Cash Cupの承認方式が不正');
   if(rule.autoApproval==='verified-team-rank'&&(
      !Number.isSafeInteger(rule.matchCaps?.['単一ラウンド'])||rule.matchCaps['単一ラウンド']<1||
      !Array.isArray(rule.eventIds)||rule.eventIds.length!==1||
      rule.cashPrizes?.basis!=='per-player'||rule.cashPrizes?.currency!=='USD'||
      !Object.keys(rule.cashPrizes?.tiers||{}).length
   ))fail(id,'自動承認には正確なイベントIDと個人賞金・試合数の条件が必要');
   if(!positive(rule.matchCaps?.['単一ラウンド']))fail(id,'Cash Cupの試合数上限が必要');
   if(rule.advance!==undefined||rule.cosmeticRanks!==undefined||rule.prizePerVictory!==undefined)fail(id,'Cash Cupに他大会の報酬条件が混在しています');
   if(!object(rule.rankedEligibility)||
      Object.entries(rule.rankedEligibility).some(([event,value])=>!['1','2','3'].includes(event)||!['Diamond','Champion'].includes(value)))
      fail(id,'参加ランク条件が不正');
   if(!object(rule.cashPrizes)||rule.cashPrizes.basis!=='per-player'||rule.cashPrizes.currency!=='USD'||
      !object(rule.cashPrizes.tiers)||Object.keys(rule.cashPrizes.tiers).length===0)
      fail(id,'個人賞金テーブルが不正');
   else for(const [region,tiers] of Object.entries(rule.cashPrizes.tiers)){
     if(!REGIONS.has(region)||!Array.isArray(tiers)||!tiers.length){fail(id,region+'の地域・賞金表が不正');continue}
     let previousRank=0,previousPrize=Infinity;
     for(const tier of tiers){
       if(!object(tier)||!positive(tier.through)||tier.through<=previousRank||
          !positive(tier.perPlayer)||tier.perPlayer>previousPrize||tier.perPlayer>100000){
          fail(id,region+'の順位・個人賞金に矛盾');break;
       }
       previousRank=tier.through;previousPrize=tier.perPlayer;
     }
     if(tiers[0]?.through!==1)fail(id,region+'の1位賞金が未登録');
   }
  }else if(rule.series==='unreal-cup'){
   if(rule.id!=='ch7s1-one-million-unreal-cup'||rule.seasonId!=='S39'||
     rule.team!=='duo'||JSON.stringify(rule.eventIds)!=='["S39_1MillionUnrealCup"]'||
     rule.autoApproval!=='review-only')fail(id,'S39 Unreal Cupは公式ルール登録済み・確認専用');
   if(Object.keys(rule.matchCaps||{}).join(',')!=='単一ラウンド'||
     rule.matchCaps?.['単一ラウンド']!==10||rule.sessionMinutes!==180)
     fail(id,'Unreal Cupは1セッション約3時間・最大10試合');
   if(rule.rankedEligibility?.mode!=='battle-royale'||rule.rankedEligibility?.rank!=='Unreal'||
     rule.participation?.minimumAge!==13||rule.participation?.minimumAccountLevel!==350||
     rule.participation?.twoFactorAuthentication!==true)
     fail(id,'Unreal Cup参加条件（BR Unreal/13歳/350レベル/2FA）が不正');
   const points=[65,56,52,48,44,40,38,36,34,32,30,28,26,24,22,20,18,16,14,12,10,8,6,4,2];
   if(JSON.stringify(rule.scoring?.placementPoints)!==JSON.stringify(points)||
     rule.scoring?.eliminationPoints!==1||
     JSON.stringify(rule.scoring?.tiebreakers)!==JSON.stringify(['total-points','victory-royales','average-eliminations','average-placement','survival-seconds']))
     fail(id,'順位点・キル点・同点時順位の公式規則に矛盾');
   if(JSON.stringify(rule.sessionDates)!=='["2025-12-20","2026-01-10"]')
     fail(id,'大会開催回の登録が不正');
   const a=rule.cashPrizes;
   if(a?.basis!=='per-team'||a.currency!=='USD'||a.teamSize!==2||
     a.individualShare!=='equal'||!object(a.tiers)||
     Object.keys(a.tiers).sort().join(',')!==UNREAL_REGIONS.slice().sort().join(','))
     fail(id,'全7地域のデュオチーム賞金表が必要');
   else {
    const last={EU:2000,NAC:1200,NAW:500,BR:500,ME:250,ASIA:250,OCE:250};
    const first={EU:20000,NAC:16000,NAW:8000,BR:8000,ME:5000,ASIA:5000,OCE:5000};
    for(const region of UNREAL_REGIONS){
     const tiers=a.tiers[region];
     if(!Array.isArray(tiers)||!tiers.length||tiers[0]?.through!==1||
       tiers[0]?.perTeam!==first[region]||
       tiers.at(-1)?.through!==last[region]||tiers.at(-1)?.perTeam!==100){
       fail(id,region+'公式賞金の1位額・最低賞金順位が不一致');continue;
     }
     let prevRank=0,prevTeam=Infinity;
     for(const tier of tiers){
      if(!object(tier)||Object.keys(tier).sort().join(',')!=='perTeam,through'||
       !positive(tier.through)||tier.through<=prevRank||
       !positive(tier.perTeam)||tier.perTeam>prevTeam||tier.perTeam%2!==0){
       fail(id,region+'の順位別チーム賞金額・個人分配が不正');break;
      }
      prevRank=tier.through;prevTeam=tier.perTeam;
     }
    }
   }
   if(rule.advance!==undefined||rule.prizePerVictory!==undefined||rule.cosmeticRanks!==undefined)
     fail(id,'Unreal Cupに予選通過・VR単価・スキン賞を混在させない');
  }else if(rule.series==='skin-cup'){
   if(!positive(rule.matchCaps?.['スキン大会']))fail(id,'スキン大会の試合数上限が必要');
   if(!positive(rule.chapter)||!positive(rule.season)||rule.chapter!==t.chapter||rule.season!==t.season)fail(id,'チャプター/シーズン不一致');
   if(!object(rule.cosmeticRanks)||!Object.keys(rule.cosmeticRanks).length||
      Object.entries(rule.cosmeticRanks).some(([region,value])=>!REGIONS.has(region)||!positive(value)))fail(id,'スキン獲得順位が不正');
   if(rule.prizePerVictory!==undefined||rule.advance!==undefined)fail(id,'スキン大会に現金賞金や予選通過を混在させないでください');
  }
 }
 return errors;
}
function main(){
 const root=path.resolve(__dirname,'..');
 const doc=JSON.parse(fs.readFileSync(path.join(root,'tournament-rules.json'),'utf8'));
 const tournaments=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));
 const errors=validateRegistry(doc,tournaments);
 if(errors.length){console.error('大会ルール検証失敗:\n'+errors.join('\n'));process.exitCode=1;return}
 console.log('大会ルールマスター検証成功: '+doc.rules.length+'大会 / '+tournaments.catalog.length+'登録大会');
}
if(require.main===module)main();
module.exports={validateRegistry};
