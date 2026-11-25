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
  if(!['victory-cup','skin-cup','cash-cup','playstation-cup','performance-evaluation','unreal-cup','nvidia-cup'].includes(rule.series))fail(id,'対応していないルールシリーズです');
  if(!Array.isArray(rule.eventIds)||!rule.eventIds.length||new Set(rule.eventIds).size!==rule.eventIds.length||
      rule.eventIds.some(x=>typeof x!=='string'||!t.sourceEventIds.includes(x)))fail(id,'EpicイベントIDがカタログと不一致');
  if(!TEAMS.has(rule.team))fail(id,'チーム形式が不正');
  let url;
  try{url=new URL(rule.source)}catch{}
  if(!url||url.protocol!=='https:'||!URL_HOSTS.has(url.hostname)||url.username||url.password||url.hash)fail(id,'Epic公式規則URLが不正');
  if(!object(rule.matchCaps)||!Object.keys(rule.matchCaps).length||
     Object.entries(rule.matchCaps).some(([name,value])=>!['予選','賞金決勝','スキン大会','単一ラウンド','Performance決勝'].includes(name)||!positive(value)||value>40))fail(id,'公式試合数上限が不正');
  // Unify old NA with NAC only for individually verified event/window IDs.
  // Any other NA or NAC conversion remains forbidden by default.
  if(rule.verifiedLegacyNacWindow!==undefined){
   const approved={
    'ch5s3-solo-victory-cup':{
     dateJst:'2024-07-23',windowId:'S30_SoloVictoryCashCup_Event6Round1_NAC',
     cutoff:5000,source:'https://fortnitetracker.com/events/epicgames_S30_SoloVictoryCashCup_NAC?page=1&window=S30_SoloVictoryCashCup_Event6Round1_NAC'},
    'ch5s5-solo-victory-cup':{
     dateJst:'2024-11-16',windowId:'S32_SoloVictoryCashCup_Event2Round1_NAC',
     cutoff:10000,source:'https://fortnitetracker.com/events/epicgames_S32_SoloVictoryCashCup_NAC?page=9&window=S32_SoloVictoryCashCup_Event2Round1_NAC'}
   }[id];
   if(!approved||!object(rule.verifiedLegacyNacWindow)||
     Object.keys(rule.verifiedLegacyNacWindow).sort().join(',')!=='cutoff,dateJst,source,windowId'||
     Object.keys(approved).some(k=>rule.verifiedLegacyNacWindow[k]!==approved[k]))
     fail(id,'2024年NA Centralの個別検証済み開催枠以外の地域対応は不可');
  }
  // Individually documented 2024 NAC qualifier windows only. Keep the
  // S30 5,000 cutoff separate from S32 10,000; no blanket NA->NAC mapping.
  if(rule.verifiedLegacyNacExtraWindows!==undefined){
   const expected={
    'ch5s3-solo-victory-cup':[
     {dateJst:'2024-06-18',windowId:'S30_SoloVictoryCashCup_Event3Round1_NAC',
      cutoff:5000,source:'https://fortnitetracker.com/events/epicgames_S30_SoloVictoryCashCup_NAC?window=S30_SoloVictoryCashCup_Event3Round1_NAC',
      allowOutOfCutoffAttendance:true},
     {dateJst:'2024-06-25',windowId:'S30_SoloVictoryCashCup_Event4Round1_NAC',
      cutoff:5000,source:'https://fortnitetracker.com/events/epicgames_S30_SoloVictoryCashCup_NAC?window=S30_SoloVictoryCashCup_Event4Round1_NAC'}
    ],
    'ch5s3-zb-solo-victory':[
  {
    "dateJst": "2024-06-04",
    "windowId": "S30_SoloZBVictoryCashCup_Event1Round1_NAC",
    "cutoff": 5000,
    "source": "https://fortnitetracker.com/events/epicgames_S30_SoloZBVictoryCashCup_NAC?page=1&window=S30_SoloZBVictoryCashCup_Event1Round1_NAC"
  },
  {
    "dateJst": "2024-07-30",
    "windowId": "S30_SoloZBVictoryCashCup_Event7Round1_NAC",
    "cutoff": 5000,
    "source": "https://fortnitetracker.com/events/epicgames_S30_SoloZBVictoryCashCup_NAC?window=S30_SoloZBVictoryCashCup_Event7Round1_NAC"
  },
  {
    "dateJst": "2024-08-13",
    "windowId": "S30_SoloZBVictoryCashCup_Event9Round1_NAC",
    "cutoff": 5000,
    "source": "https://fortnitetracker.com/events/epicgames_s30_solozbvictorycashcup_nac?window=S30_SoloZBVictoryCashCup_Event9Round1_NAC"
  }
],
    'ch5s5-solo-victory-cup':[
     {dateJst:'2024-11-26',windowId:'S32_SoloVictoryCashCup_Event4Round1_NAC',
      cutoff:10000,source:'https://fortnitetracker.com/events/epicgames_S32_SoloVictoryCashCup_NAC?window=S32_SoloVictoryCashCup_Event4Round1_NAC'}
    ]
   }[id];
   if(!expected||JSON.stringify(rule.verifiedLegacyNacExtraWindows)!==JSON.stringify(expected))
    fail(id,'2024 NA Central追加開催枠は個別に照合した日付・ラウンド・通過条件のみ許可');
  }
  if(rule.series==='victory-cup'){
   if(!positive(rule.matchCaps?.['予選'])||!positive(rule.matchCaps?.['賞金決勝']))fail(id,'Victory Cupの予選/決勝試合数上限が不足');
   if(!object(rule.advance)||!Object.keys(rule.advance).length||
      Object.entries(rule.advance).some(([region,value])=>(!REGIONS.has(region)&&!(id==='ch7s5-squads-victory-cup'&&region==='ASIA'))||!positive(value)))fail(id,'地域別予選通過順位が不正');
   // S43 Squads Battle Royale: one final win = 100pt, $50 per player,
   // or $200 across four members. Never silently change another event.
   if(id==='ch7s5-squads-victory-cup'&&(
     rule.seasonId!=='S43'||rule.team!=='squad'||
     JSON.stringify(rule.eventIds)!=='["S43_SquadsVictoryCup"]'||
     rule.matchCaps['予選']!==8||rule.matchCaps['賞金決勝']!==3||
     JSON.stringify(Object.keys(rule.advance).sort())!==JSON.stringify(['ASIA','BR','EU','ME','NAC','NAW','OCE'])||
     rule.advance.EU!==300||rule.advance.NAC!==200||
     ['ASIA','BR','ME','NAW','OCE'].some(region=>rule.advance[region]!==120)||
     rule.prizePerVictory!==50||rule.teamPrizePerVictory!==200||
     rule.finalWinPoints!==100||rule.autoApproval!==undefined
   ))fail(id,'S43 Squads予選通過・決勝VR100pt・個人$50/チーム$200の公式条件が不一致');
   if(['ch5s3-solo-victory-cup','ch5s3-zb-solo-victory','ch5s4-solo-victory-cup','ch5s4-zb-solo-victory'].includes(id)&&
    (rule.team!=='solo'||rule.prizePerVictory!==100||rule.matchCaps['予選']!==7||rule.matchCaps['賞金決勝']!==3||
     rule.advance.NAC!==undefined||rule.advance.NAW!==undefined))
    fail(id,'2024 Solo BR/ZB公式決勝1VR=$100・試合上限・旧NA地域対応が不一致');
   if(rule.cosmeticRanks!==undefined)fail(id,'Victory Cupにスキン順位は登録不可');
   if(rule.prizePerVictory!==undefined&&(!positive(rule.prizePerVictory)||rule.prizePerVictory>10000))fail(id,'VR賞金単価が不正');
   if(rule.autoApproval==='verified-qualifier-participation'){
     // The only nonqualifier attendance rule: verified S42 Solo Reload.
     if(id!=='ch7s4-solo-reload-victory-cup'||rule.seasonId!=='S42'||
       rule.team!=='solo'||rule.matchCaps['予選']!==8||
       rule.matchCaps['賞金決勝']!==3||rule.prizePerVictory!==100||
       JSON.stringify(rule.eventIds)!=='["S42_ReloadSoloVictoryCup","S42_ReloadReloadSoloVictoryCup"]'||
       JSON.stringify(rule.advance)!=='{"EU":1600,"NAC":800,"NAW":320,"BR":320,"ME":320,"OCE":320}')
       fail(id,'S42 Solo Reloadの公式予選参加・通過枠以外は承認不可');
   } else if(rule.autoApproval==='verified-duo-qualifier-only'){
     // Only explicitly pinned historical/current Duos Round1 rules can
     // publish $0 attendance / qualification; Round2 cash stays separate.
     const duoTemplates={
       'ch6s3-console-duos-victory':{
         season:'S36',eventId:'S36_VictoryDuosCup',round1:7,round2:3,
         EU:500,NAC:500,minor:250,source:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules',
         individual:null,teamCash:null,requireIds:false
       },
       'ch6s4-console-duos-victory':{
         season:'S37',eventId:'S37_ConsoleDuosCashCups',round1:7,round2:3,
         EU:500,NAC:500,minor:250,source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules',
         individual:100,teamCash:200,requireIds:true
       },
       'ch7s4-reload-duos-victory-cup':{
         season:'S42',eventId:'S42_ReloadDuosVictoryCup',round1:10,round2:3,
         EU:300,NAC:300,minor:120,source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules',
         individual:100,teamCash:200,requireIds:true
       }
     };
     const expected=duoTemplates[id],minors=['NAW','BR','OCE','ME'];
     if(!expected||rule.seasonId!==expected.season||rule.team!=='duo'||
       JSON.stringify(rule.eventIds)!==JSON.stringify([expected.eventId])||
       rule.matchCaps['予選']!==expected.round1||
       rule.matchCaps['賞金決勝']!==expected.round2||
       Object.keys(rule.advance||{}).sort().join(',')!=='BR,EU,ME,NAC,NAW,OCE'||
       rule.advance?.EU!==expected.EU||rule.advance?.NAC!==expected.NAC||
       minors.some(r=>rule.advance?.[r]!==expected.minor)||
       rule.source!==expected.source||
       (expected.individual===null?rule.prizePerVictory!==undefined:
         rule.prizePerVictory!==expected.individual)||
       (expected.teamCash===null?rule.teamPrizePerVictory!==undefined:
         rule.teamPrizePerVictory!==expected.teamCash)||
       (expected.requireIds?rule.requireVerifiedRoster!==true:
         rule.requireVerifiedRoster!==undefined))
       fail(id,'デュオ予選の大会ID・開催形式・本人ID・地域別通過順位・決勝賞金単価が公式規則と不一致');
   } else if(rule.autoApproval!==undefined)fail(id,'Victory Cupの未対応自動承認方式');
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
  }else if(rule.series==='playstation-cup'){
   // November 20, 2026 official Epic rule: independent BR and ZB solo,
   // two rounds, per-person rank cash. Never infer dollars from victory royales.
   const source='https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-cup-chapter-7-mini-season-official-rules';
   const zb=id==='ch7s5-playstation-cup-zero-build';
   const br=id==='ch7s5-playstation-cup-battle-royale';
   const event=zb?'S43_PlayStationCup_ZB':'S43_PlayStationCup';
   const mode=zb?'zero-build':'battle-royale';
   const regions=['OCE','ASIA','ME','EU','BR','NAC','NAW'];
   if((!br&&!zb)||rule.seasonId!=='S43'||t.chapter!==7||t.season!==5||
      rule.chapter!==7||rule.season!==5||rule.team!=='solo'||t.team!=='solo'||
      rule.mode!==mode||t.mode!==mode||rule.platform!=='playstation'||t.platform!=='playstation'||
      JSON.stringify(rule.eventIds)!==JSON.stringify([event])||
      rule.source!==source||rule.autoApproval!=='verified-playstation-solo'||
      JSON.stringify(rule.matchCaps)!==JSON.stringify({'予選':11,'賞金決勝':6})||
      rule.sessionMinutes!==180||rule.finalSessionMinutes!==160||
      JSON.stringify(rule.roundWindows)!==JSON.stringify({qualifier:'Qualifier',final:'Final'})||
      JSON.stringify(Object.keys(rule.advance||{}).sort())!==JSON.stringify(regions.slice().sort())||
      regions.some(region=>rule.advance?.[region]!==80))
      fail(id,'S43 PlayStationの別モード・予選80位・PS4/PS5限定・開催構成が不一致');
   if(JSON.stringify(rule.scoring)!==JSON.stringify({method:'in-game',tiebreakers:[
      'total-points','victory-royales','average-eliminations','average-placement','survival-seconds'
   ]})||JSON.stringify(rule.cosmeticPrizes)!==JSON.stringify({
      minimumPoints:8,spray:'Froggory Stance Spray'
   })||rule.prizePerVictory!==undefined||rule.cosmeticRanks!==undefined)
      fail(id,'PlayStationのゲーム内配点・同点順位・8ptスプレーと現金賞金の分離が不正');
   const shared=[[1,750],[2,500],[3,450],[4,400],[5,350],[6,300],[7,250],[8,200],[9,150],[10,100],[25,50]];
   const eu=[[1,4000],[2,2000],[3,1500],[4,1000],[5,800],[6,600],[7,500],[8,400],[9,350],[10,300],[20,250],[30,150],[50,100]];
   const nac=[[1,2500],[2,1500],[3,1000],[4,800],[5,600],[6,500],[7,400],[8,300],[9,250],[10,200],[20,150],[30,100],[50,50]];
   const cash=rule.cashPrizes;
   if(cash?.basis!=='per-player'||cash?.currency!=='USD'||
      JSON.stringify(Object.keys(cash?.tiers||{}).sort())!==JSON.stringify(regions.slice().sort()))
      fail(id,'PlayStation決勝の全7地域個人賞金表が不足');
   else for(const region of regions){
      const expected=(region==='EU'?eu:region==='NAC'?nac:shared)
        .map(([through,perPlayer])=>({through,perPlayer}));
      if(JSON.stringify(cash.tiers[region])!==JSON.stringify(expected))
       fail(id,region+' PlayStationの公式順位別個人賞金表に差異');
   }
   if(rule.rankedEligibility!==undefined||rule.teamPrizePerVictory!==undefined)
     fail(id,'別大会のランク条件・チーム賞金を流用しない');
  }else if(rule.series==='cash-cup'){
   if(rule.autoApproval==='verified-duo-qualifier-only'){
     // Strictly no Round 2 cash inference: only official Round 1 results, $0.
     if(id!=='ch7s5-reload-zero-build-duos-cash-cup'||rule.seasonId!=='S43'||
       rule.team!=='duo'||JSON.stringify(rule.eventIds)!=='["S43_ReloadZBDuosCashCup"]'||
       rule.matchCaps['単一ラウンド']!==12||
       rule.matchCaps['賞金決勝']!==6||
       Object.keys(rule.matchCaps).sort().join(',')!=='単一ラウンド,賞金決勝'||
       Object.keys(rule.advance||{}).sort().join(',')!=='BR,EU,ME,NAC,NAW,OCE'||
       Object.values(rule.advance||{}).some(x=>x!==20)||
       rule.rankedEligibility?.mode!=='reload'||rule.rankedEligibility?.minimumRank!=='Platinum'||
       rule.cashFinalAutoApproval!=='verified-duo-round2-rank'||
       rule.prizePerVictory!==undefined||rule.cosmeticRanks!==undefined)
       fail(id,'S43 Reload ZB Duosの公式Round1上位20・12試合／Round2最大6試合の条件が不正');
     const short=[300,250,200,150,100].map((perPlayer,i)=>({through:i+1,perPlayer}));
     const long=[{through:1,perPlayer:600},{through:2,perPlayer:450},
       {through:3,perPlayer:300},{through:4,perPlayer:200},
       {through:5,perPlayer:150},{through:8,perPlayer:100}];
     if(rule.cashPrizes?.basis!=='per-player'||rule.cashPrizes?.currency!=='USD'||
       Object.keys(rule.cashPrizes?.tiers||{}).sort().join(',')!=='BR,EU,ME,NAC,NAW,OCE'||
       ['OCE','ME','NAW','BR'].some(region=>JSON.stringify(rule.cashPrizes.tiers[region])!==JSON.stringify(short))||
       ['EU','NAC'].some(region=>JSON.stringify(rule.cashPrizes.tiers[region])!==JSON.stringify(long)))
       fail(id,'S43 Reload ZB Duosの公式地域別Round2個人賞金表に矛盾');
   } else {
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
   // Arenas Solo is distinct from the three Trios BR ranked events.
   const arenaRank=id==='ch7s5-arenas-cash-cup'&&rule.seasonId==='S43'&&
      rule.team==='solo'&&JSON.stringify(rule.eventIds)==='["S43_ArenaCashCup"]'&&
      JSON.stringify(rule.rankedEligibility)==='{"mode":"arenas-boxfights","minimumRank":"Platinum"}'&&
      rule.sessionMinutes===120&&
      Object.keys(rule.matchCaps||{}).join(',')==='単一ラウンド'&&
      rule.matchCaps['単一ラウンド']===12;
   if(id==='ch7s5-arenas-cash-cup'){
     if(!arenaRank||rule.autoApproval!=='verified-team-rank')
       fail(id,'S43 Arenas Solo・Platinum以上・12試合／2時間の公式条件が不正');
     const short=[300,200,100].map((perPlayer,i)=>({through:i+1,perPlayer}));
     const medium=[500,300,200,150,100].map((perPlayer,i)=>({through:i+1,perPlayer}));
     const eu=[{through:1,perPlayer:1000},{through:2,perPlayer:750},
       {through:3,perPlayer:500},{through:4,perPlayer:300},
       {through:6,perPlayer:200},{through:10,perPlayer:100}];
     const nac=[{through:1,perPlayer:750},{through:2,perPlayer:500},
       {through:3,perPlayer:400},{through:4,perPlayer:300},
       {through:5,perPlayer:200},{through:7,perPlayer:100}];
     if(rule.cashPrizes?.basis!=='per-player'||rule.cashPrizes?.currency!=='USD'||
        Object.keys(rule.cashPrizes?.tiers||{}).sort().join(',')!=='BR,EU,ME,NAC,NAW,OCE'||
        ['OCE','ME'].some(region=>JSON.stringify(rule.cashPrizes.tiers[region])!==JSON.stringify(short))||
        ['NAW','BR'].some(region=>JSON.stringify(rule.cashPrizes.tiers[region])!==JSON.stringify(medium))||
        JSON.stringify(rule.cashPrizes.tiers.EU)!==JSON.stringify(eu)||
        JSON.stringify(rule.cashPrizes.tiers.NAC)!==JSON.stringify(nac))
       fail(id,'S43 Arenas Cash Cup公式個人賞金表が不一致');
   }else if(!object(rule.rankedEligibility)||
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
   }
  }else if(rule.series==='nvidia-cup'){
   if(id!=='ch7s1-nvidia-geforce-rtx-cup'||rule.seasonId!=='S39'||
     rule.team!=='solo'||JSON.stringify(rule.eventIds)!=='["S39_NvidiaCup"]'||
     rule.autoApproval!=='verified-solo-rank')fail(id,'RTX Cupは本人・順位・開催枠一致時のみ自動承認');
   if(Object.keys(rule.matchCaps||{}).join(',')!=='単一ラウンド'||
     rule.matchCaps['単一ラウンド']!==10||rule.sessionMinutes!==180||
     JSON.stringify(rule.sessionDates)!=='["2025-12-21"]')
     fail(id,'RTX Cupの開催日・3時間・最大10試合が不一致');
   if(JSON.stringify(rule.rankedEligibility)!==JSON.stringify({
      modes:['battle-royale','zero-build','reload'],minimumRank:'Gold'
     })||JSON.stringify(rule.participation)!==JSON.stringify({
      minimumAge:13,minimumAccountLevel:350,twoFactorAuthentication:true,
      minimumDistinctEpicTournaments:14,lookbackDays:180
     }))fail(id,'RTX Cupの公式参加条件が不一致');
   if(rule.scoring?.method!=='in-game'||JSON.stringify(rule.scoring?.tiebreakers)!==
     JSON.stringify(['total-points','victory-royales','average-eliminations','average-placement','survival-seconds']))
     fail(id,'公式ポイント配点はゲーム内規定・同点処理順が不一致');
   const shared=[[1,1000],[2,750],[3,600],[4,500],[5,450],[6,400],[7,350],[8,300],[9,250],[10,200],[25,150],[40,100]];
   const eu=[[1,4000],[2,3000],[3,2000],[4,1500],[5,1250],[6,1000],[7,900],[8,800],[9,700],[10,600],[20,500],[30,400],[50,300],[75,200],[100,100]];
   const nac=[[1,2500],[2,1500],[3,1250],[4,1000],[5,750],[6,500],[7,450],[8,400],[9,350],[10,300],[20,250],[30,200],[50,150],[75,100]];
   const cash=rule.cashPrizes;
   if(cash?.basis!=='per-player'||cash.currency!=='USD'||
     Object.keys(cash.tiers||{}).sort().join(',')!==UNREAL_REGIONS.slice().sort().join(','))
     fail(id,'RTX Cupは7地域の個人賞金表が必要');
   else for(const region of UNREAL_REGIONS){
     const expected=(region==='EU'?eu:region==='NAC'?nac:shared).map(([through,perPlayer])=>({through,perPlayer}));
     if(JSON.stringify(cash.tiers[region])!==JSON.stringify(expected))
       fail(id,region+'のRTX Cup公式賞金表に差異');
   }
   if(rule.hardwarePrizes?.item!=='NVIDIA GEFORCE RTX 5080'||
     JSON.stringify(rule.hardwarePrizes?.rankCutoffs)!==JSON.stringify({
       OCE:1,ASIA:1,ME:1,EU:4,BR:1,NAC:3,NAW:1
     })||rule.hardwarePrizes.approximateRetailValueUSD!==999.99||
     rule.cosmeticPrizes?.item!=='Rust Bucket Back Bling'||
     rule.cosmeticPrizes?.minimumPoints!==8)
     fail(id,'RTX 5080対象順位と8ptコスメ条件に差異');
   if(rule.advance!==undefined||rule.prizePerVictory!==undefined||rule.cosmeticRanks!==undefined)
     fail(id,'RTX Cupの別大会ルールを混在させない');
  }else if(rule.series==='unreal-cup'){
   if(rule.id!=='ch7s1-one-million-unreal-cup'||rule.seasonId!=='S39'||
     rule.team!=='duo'||JSON.stringify(rule.eventIds)!=='["S39_1MillionUnrealCup"]'||
     rule.autoApproval!=='verified-team-rank')fail(id,'S39 Unreal Cupは順位別賞金の自動承認が必要');
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
   // Independently lock the other two Widowmaker modes to Attachment C.
   // A Mobile score must never inherit the Zero Build / BR duo rewards.
   if(id==='ch7s5-overwatch-widowmaker-cup-zero-build'||
      id==='ch7s5-overwatch-widowmaker-mobile-cup'){
    const mobile=id.endsWith('-mobile-cup');
    const official='https://www.fortnite.com/competitive/rules-guidelines/rules-library/overwatch-widowmaker-cup-chapter-7-mini-season-official-rules';
    const ranks=mobile?{OCE:30,ME:30,EU:200,BR:30,NAC:150,NAW:30}
      :{OCE:50,ME:50,EU:500,BR:100,NAC:350,NAW:100};
    const eventId=mobile?'S43_OverwatchWidowmakerCup_Mobile':'S43_OverwatchWidowmakerCup_ZB';
    const cosmetics=['Widowmaker Outfit',"Widowmaker's Fang Pickaxe","Widow's Kiss Back Bling"];
    if(rule.source!==official||rule.team!==(mobile?'solo':'duo')||
       t.mode!==(mobile?'reload-zero-build':'zero-build')||
       t.platform!==(mobile?'mobile':'cross-platform')||
       rule.sessionMinutes!==(mobile?75:180)||
       JSON.stringify(rule.eventIds)!==JSON.stringify([eventId])||
       rule.matchCaps?.['スキン大会']!==(mobile?8:11)||
       JSON.stringify(rule.cosmeticRanks)!==JSON.stringify(ranks)||
       JSON.stringify(rule.cosmeticPrizes?.rankRewards)!==JSON.stringify(cosmetics)||
       rule.cosmeticPrizes?.minimumPoints!==(mobile?5:8)||
       rule.cosmeticPrizes?.spray!=="Widowmaker's Mark Spray"||
       rule.autoApproval!=='verified-team-rank')
       fail(id,'公式Widowmaker ZB/Mobileの別部門・地域別順位・コスメ報酬が不正');
   }
   // Official 2026-11-19 Epic Battle Royale BRANCH of the Widowmaker event.
   // Separate Zero Build & touch-only Mobile event IDs must never share its cutoffs.
   if(id==='ch7s5-overwatch-widowmaker-cup-battle-royale'){
    const official='https://www.fortnite.com/competitive/rules-guidelines/rules-library/overwatch-widowmaker-cup-chapter-7-mini-season-official-rules';
    const cutoffs={OCE:50,ME:50,EU:500,BR:100,NAC:350,NAW:100};
    const items=['Widowmaker Outfit',"Widowmaker's Fang Pickaxe","Widow's Kiss Back Bling"];
    if(rule.source!==official||rule.team!=='duo'||rule.sessionMinutes!==180||
       JSON.stringify(rule.eventIds)!=='["S43_OverwatchWidowmakerCup"]'||
       rule.matchCaps?.['スキン大会']!==11||
       JSON.stringify(rule.cosmeticRanks)!==JSON.stringify(cutoffs)||
       JSON.stringify(rule.cosmeticPrizes?.rankRewards)!==JSON.stringify(items)||
       rule.cosmeticPrizes?.minimumPoints!==8||
       rule.cosmeticPrizes?.spray!=="Widowmaker's Mark Spray"||
       rule.autoApproval!=='verified-team-rank')
      fail(id,'公式Widowmaker BRの地域別順位・報酬・別イベントIDが不正');
   }
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
