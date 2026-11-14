'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const registry=JSON.parse(fs.readFileSync(path.join(base,'tournament-rules.json'),'utf8'));
const tournaments=JSON.parse(fs.readFileSync(path.join(base,'tournaments.json'),'utf8'));
const {validateRegistry}=require('../scripts/validate-tournament-rules.cjs');
const {RULES}=require('../scripts/verified-history-approval.cjs');
const {CUT_OFFS}=require('../scripts/cosmetic-rank-rules.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));

test('shared official tournament rules include review-only Solo Series Finals and approved types',()=>{
 assert.deepEqual(validateRegistry(registry,tournaments),[]);
 assert.equal(registry.rules.length,23);
 assert.equal(Object.keys(RULES).length,11);
 assert.equal(Object.keys(CUT_OFFS).length,10);
 for(const rule of registry.rules){
  if(rule.series==='victory-cup')assert.strictEqual(RULES[rule.id].source,rule.source);
  if(rule.series==='cash-cup'){
   assert.equal(RULES[rule.id],undefined);
   assert.equal(CUT_OFFS[rule.id],undefined);
   assert.ok(['verified-team-rank','review-only','verified-duo-qualifier-only'].includes(rule.autoApproval));
  }
  if(rule.series==='skin-cup'){
   assert.equal(CUT_OFFS[rule.id].source,rule.source);
   assert.equal(CUT_OFFS[rule.id].maxMatches,rule.matchCaps['スキン大会']);
   assert.deepEqual(CUT_OFFS[rule.id].ranks,rule.cosmeticRanks);
  }
 }
});

test('S43 One Piece Zoro Zero Build is separate from BR and Mobile with verified cosmetics',()=>{
 const rule=registry.rules.find(r=>r.id==='ch7s5-one-piece-zoro-cup-zero-build');
 assert.ok(rule);
 assert.equal(rule.series,'skin-cup');
 assert.equal(rule.team,'duo');
 assert.deepEqual(rule.eventIds,['S43_OnePieceZoroCup_ZB']);
 assert.equal(rule.matchCaps['スキン大会'],11);
 assert.deepEqual(rule.cosmeticRanks,{OCE:50,ME:50,EU:525,BR:100,NAC:375,NAW:100});
 assert.equal(CUT_OFFS[rule.id].eventId,'S43_OnePieceZoroCup_ZB');
 const {evaluate}=require('../scripts/cosmetic-rank-rules.cjs');
 const row={tournamentId:rule.id,seasonId:'S43',chapter:7,season:5,verified:true,
   kind:'スキン大会',region:'EU',rank:375,matches:11,kills:61,vrs:2,
   source:'https://www.fortnite.com/competitive/events/S43_OnePieceZoroCup_ZB/?region=EU&round=S43_OnePieceZoroCup_ZB_EU'};
 assert.equal(evaluate(row).eligible,true);
 assert.equal(evaluate({...row,rank:526}).eligible,false);
 assert.equal(evaluate({...row,source:'https://www.fortnite.com/competitive/events/S43_OnePieceZoroCup/?region=EU&round=S43_OnePieceZoroCup_EU'}).eligible,false);
});


test('unknown tournaments, tampered source URLs and mismatched event IDs cannot be registered',()=>{
 const unknown=clone(registry);unknown.rules[0].id='non-existent';
 assert.match(validateRegistry(unknown,tournaments).join('\n'),/カタログ/);
 const spoofed=clone(registry);spoofed.rules[0].source='https://example.com/official-rules';
 assert.match(validateRegistry(spoofed,tournaments).join('\n'),/URL/);
 const wrongEvent=clone(registry);wrongEvent.rules[0].eventIds=['S99_FakeCup'];
 assert.match(validateRegistry(wrongEvent,tournaments).join('\n'),/イベントID/);
 const duplicated=clone(registry);duplicated.rules.push(clone(duplicated.rules[0]));
 assert.match(validateRegistry(duplicated,tournaments).join('\n'),/重複/);
});
test('missing or invented region cutoffs and non-integer cash values fail validation',()=>{
 const broken=clone(registry);
 broken.rules[0].advance.NAC=12.3;
 broken.rules[5].prizePerVictory=101.5;
 broken.rules.find(x=>x.series==='skin-cup').cosmeticRanks.EU=0;
 const problems=validateRegistry(broken,tournaments).join('\n');
 assert.match(problems,/予選通過順位/);
 assert.match(problems,/VR賞金単価/);
 assert.match(problems,/スキン獲得順位/);
});
test('rules remain read-only official evidence; unrelated series stay unmapped',()=>{
 const ids=new Set(registry.rules.map(rule=>rule.id));
 const unknown=tournaments.catalog.find(t=>!ids.has(t.id));
 assert.ok(unknown);
 assert.equal(RULES[unknown.id],undefined);
 assert.equal(CUT_OFFS[unknown.id],undefined);
});

test('S43 Trio Cash Cup uses individually verified six-region per-player payouts',()=>{
 const rule=registry.rules.find(r=>r.id==='ch7s5-trios-cash-cup');
 assert.ok(rule);
 assert.deepEqual(rule.eventIds,['S43_TriosCashCup']);
 assert.equal(rule.team,'trio');
 assert.equal(rule.matchCaps['単一ラウンド'],11);
 assert.deepEqual(rule.rankedEligibility,{'1':'Diamond','2':'Champion','3':'Champion'});
 assert.equal(rule.cashPrizes.basis,'per-player');
 assert.equal(rule.cashPrizes.currency,'USD');
 assert.deepEqual(Object.keys(rule.cashPrizes.tiers).sort(),['OCE','ME','EU','BR','NAC','NAW'].sort());
 assert.deepEqual(rule.cashPrizes.tiers.NAW,[
  {through:1,perPlayer:400},{through:2,perPlayer:300},{through:3,perPlayer:200},
  {through:5,perPlayer:150},{through:10,perPlayer:100}
 ]);
 assert.deepEqual(rule.cashPrizes.tiers.EU.map(t=>t.perPlayer),[1000,750,500,400,300,200,100]);
 assert.deepEqual(rule.cashPrizes.tiers.NAC.map(t=>t.through),[1,2,3,4,5,10,15]);
 assert.deepEqual(rule.cashPrizes.tiers.BR.map(t=>t.through),[1,2,3,5,10]);
 assert.deepEqual(rule.cashPrizes.tiers.OCE,rule.cashPrizes.tiers.ME);
});
test('Cash Cup payment registry rejects region spoofing, duplicate rank cutoffs and auto approval',()=>{
 const rule=registry.rules.find(r=>r.id==='ch7s5-trios-cash-cup');
 const index=registry.rules.indexOf(rule);
 const testChange=modify=>{const d=clone(registry);modify(d.rules[index]);return validateRegistry(d,tournaments).join('\\n')};
 assert.match(testChange(rule=>{rule.cashPrizes.tiers.NAC[2].through=2}),/順位・個人賞金に矛盾/);
 assert.match(testChange(rule=>{rule.cashPrizes.tiers.EU[0].perPlayer=-10}),/順位・個人賞金に矛盾/);
 assert.match(testChange(rule=>{rule.cashPrizes.tiers.FAKE=rule.cashPrizes.tiers.EU}),/地域・賞金表が不正/);
 assert.match(testChange(rule=>{rule.autoApproval='auto'}),/承認方式/);
 assert.match(testChange(rule=>{rule.cashPrizes.basis='per-team'}),/個人賞金テーブルが不正/);
});

test('S43 Trios Performance Evaluation is EU/NAC top26 and per-player $400 per VR',()=>{
 const rule=registry.rules.find(r=>r.id==='ch7s5-performance-evaluation-trios');
 assert.ok(rule);
 assert.equal(rule.autoApproval,'verified-performance-vr');
 assert.deepEqual(rule.eventIds,['S43_PerformanceEvaluationTrios']);
 assert.equal(rule.windowIdPrefix,'S43_PerformanceEvaluation');
 assert.deepEqual(rule.advance,{EU:26,NAC:26});
 assert.equal(rule.team,'trio');
 assert.equal(rule.prizePerVictory,400);
 assert.equal(rule.finalWinPoints,100);
 assert.equal(rule.matchCaps['Performance決勝'],4);
 assert.equal(rule.matchCaps['予選'],8);
 const bad=clone(registry);bad.rules[bad.rules.findIndex(x=>x.id===rule.id)].advance.NAC=33;
 assert.match(validateRegistry(bad,tournaments).join('\n'),/上位26/);
 const prize=clone(registry);prize.rules[prize.rules.findIndex(x=>x.id===rule.id)].prizePerVictory=1200;
 assert.match(validateRegistry(prize,tournaments).join('\n'),/VR単価/);
});

test('S39 $1M Unreal Cup official seven-region duo team prizes and scoring',()=>{
 const rule=registry.rules.find(r=>r.id==='ch7s1-one-million-unreal-cup');
 assert.ok(rule);
 assert.equal(rule.seasonId,'S39');
 assert.deepEqual(rule.eventIds,['S39_1MillionUnrealCup']);
 assert.equal(rule.autoApproval,'verified-team-rank');
 assert.equal(rule.series,'unreal-cup');
 assert.equal(rule.matchCaps['単一ラウンド'],10);
 assert.equal(rule.sessionMinutes,180);
 assert.deepEqual(rule.rankedEligibility,{mode:'battle-royale',rank:'Unreal'});
 assert.equal(rule.participation.minimumAccountLevel,350);
 assert.equal(rule.scoring.eliminationPoints,1);
 assert.equal(rule.scoring.placementPoints.length,25);
 assert.deepEqual(rule.scoring.placementPoints.slice(0,6),[65,56,52,48,44,40]);
 assert.equal(rule.scoring.placementPoints.at(-1),2);
 const award=rule.cashPrizes;
 assert.equal(award.basis,'per-team');
 assert.equal(award.teamSize,2);
 assert.equal(award.individualShare,'equal');
 assert.deepEqual(Object.keys(award.tiers).sort(),['EU','NAC','NAW','BR','ME','ASIA','OCE'].sort());
 assert.deepEqual(Object.fromEntries(Object.entries(award.tiers).map(([k,tiers])=>[k,tiers.at(-1).through])),
   {EU:2000,NAC:1200,NAW:500,BR:500,ME:250,ASIA:250,OCE:250});
 const payout=(region,rank)=>{
  const found=award.tiers[region].find(tier=>rank<=tier.through);
  return found?{team:found.perTeam,perPlayer:found.perTeam/award.teamSize}:null;
 };
 assert.deepEqual(payout('OCE',172),{team:100,perPlayer:50});
 assert.deepEqual(payout('EU',1800),{team:100,perPlayer:50});
 assert.deepEqual(payout('EU',500),{team:200,perPlayer:100});
 assert.deepEqual(payout('NAC',1000),{team:100,perPlayer:50});
 assert.deepEqual(payout('ME',75),{team:200,perPlayer:100});
 assert.equal(payout('NAW',501),null);
 assert.equal(payout('OCE',251),null);
 assert.equal(RULES[rule.id],undefined,'No unsafe Victory Cup auto cash approval');
 const wrong=clone(registry);
 wrong.rules.find(r=>r.id===rule.id).cashPrizes.tiers.OCE.at(-1).perTeam=101;
 assert.match(validateRegistry(wrong,tournaments).join('\n'),/公式賞金の1位額・最低賞金順位|賞金額・個人分配/);
 const shifted=clone(registry);
 shifted.rules.find(r=>r.id===rule.id).scoring.placementPoints[0]=66;
 assert.match(validateRegistry(shifted,tournaments).join('\n'),/順位点/);
 const auto=clone(registry);
 auto.rules.find(r=>r.id===rule.id).autoApproval='review-only';
 assert.match(validateRegistry(auto,tournaments).join('\n'),/自動承認/);
});

test('S39 NAW Solo Series Finals has verified tier thresholds and stays review-only',()=>{
 const rule=registry.rules.find(r=>r.id==='ch7s1-solo-series-finals');
 assert.ok(rule);
 assert.equal(rule.seasonId,'S39');
 assert.deepEqual(rule.eventIds,['S39_SoloSeriesCupFinal']);
 assert.equal(rule.team,'solo');
 assert.equal(rule.series,'cash-cup');
 assert.equal(rule.autoApproval,'review-only');
 assert.equal(rule.matchCaps['単一ラウンド'],12);
 assert.deepEqual(Object.keys(rule.cashPrizes.tiers),['NAW']);
 assert.deepEqual(rule.cashPrizes.tiers.NAW,[
  {through:1,perPlayer:4000},{through:2,perPlayer:2000},
  {through:3,perPlayer:1000},{through:5,perPlayer:750},
  {through:10,perPlayer:500},{through:25,perPlayer:400},
  {through:50,perPlayer:300},{through:75,perPlayer:200}
 ]);
 const payout=rank=>rule.cashPrizes.tiers.NAW.find(t=>rank<=t.through)?.perPlayer??0;
 assert.equal(payout(39),300);
 assert.equal(payout(59),200);
 assert.equal(payout(62),200);
 assert.equal(payout(76),0);
 assert.equal(RULES[rule.id],undefined,'Unconfirmed historical prize rows stay review-only');
 assert.equal(CUT_OFFS[rule.id],undefined);
});

test('official S36 console and S43 Reload duo Round1/2 scopes are strictly registered',()=>{
 const consoleCup=registry.rules.find(r=>r.id==='ch6s3-console-duos-victory');
 const reload=registry.rules.find(r=>r.id==='ch7s5-reload-zero-build-duos-cash-cup');
 assert.equal(consoleCup.autoApproval,'verified-duo-qualifier-only');
 assert.equal(consoleCup.advance.NAW,250);assert.equal(consoleCup.advance.NAC,500);
 assert.equal(reload.advance.OCE,20);assert.equal(reload.autoApproval,'verified-duo-qualifier-only');
 assert.equal(reload.matchCaps['単一ラウンド'],12);
 assert.equal(reload.matchCaps['賞金決勝'],6);
 assert.equal(reload.cashFinalAutoApproval,'verified-duo-round2-rank');
 assert.equal(reload.cashPrizes.basis,'per-player');
 assert.deepEqual(reload.cashPrizes.tiers.OCE.map(x=>x.perPlayer),[300,250,200,150,100]);
 assert.deepEqual(reload.cashPrizes.tiers.EU.map(x=>x.perPlayer),[600,450,300,200,150,100]);
 for(const mutation of [
  doc=>doc.rules.find(r=>r.id===reload.id).advance.OCE=25,
  doc=>doc.rules.find(r=>r.id===reload.id).cashPrizes={basis:'per-player',currency:'USD'},
  doc=>doc.rules.find(r=>r.id===reload.id).cashPrizes.tiers.NAC[0].perPlayer=601,
  doc=>doc.rules.find(r=>r.id===reload.id).matchCaps['賞金決勝']=12,
  doc=>doc.rules.find(r=>r.id===consoleCup.id).advance.NAW=500,
  doc=>doc.rules.find(r=>r.id===consoleCup.id).prizePerVictory=100
 ]){
  const fake=clone(registry);mutation(fake);
  assert.ok(validateRegistry(fake,tournaments).length>0,'unauthorized qualifiers/payouts must fail');
 }
});

test('S42 Console Zero Build Solo Victory Cup has exact official thresholds and VR award',()=>{
 const x=registry.rules.find(r=>r.id==='ch7s4-console-zero-build-solo-victory-cup');
 assert.ok(x);assert.equal(x.seasonId,'S42');assert.equal(x.series,'victory-cup');
 assert.deepEqual(x.eventIds,['S42_ConsoleVCC_SolosZB']);
 assert.deepEqual(x.advance,{EU:2000,NAC:2000,OCE:1000,ME:1000,BR:1000,NAW:1000});
 assert.equal(x.matchCaps['予選'],8);assert.equal(x.matchCaps['賞金決勝'],3);
 assert.equal(x.prizePerVictory,100);assert.strictEqual(RULES[x.id].source,x.source);
});

test('S42 Lady Liberty Battle Royale NAW official costume cutoffs',()=>{
 const rule=registry.rules.find(r=>r.id==='ch7s4-lady-liberty-cup-battle-royale');
 assert.ok(rule);
 assert.equal(rule.seasonId,'S42');
 assert.equal(rule.series,'skin-cup');
 assert.equal(rule.team,'solo');
 assert.deepEqual(rule.eventIds,['S42_PurgeCup']);
 assert.equal(rule.matchCaps['スキン大会'],11);
 assert.deepEqual(rule.cosmeticRanks,{OCE:100,ME:100,EU:1000,BR:200,NAC:700,NAW:200});
 const {evaluate}=require('../scripts/cosmetic-rank-rules.cjs');
 const row={tournamentId:rule.id,seasonId:'S42',chapter:7,season:4,verified:true,kind:'スキン大会',
  region:'NAW',rank:170,matches:10,kills:10,vrs:0,
  source:'https://www.fortnite.com/competitive/events/S42_PurgeCup/?region=NAW&round=S42_PurgeCup_NAW'};
 assert.equal(evaluate(row).eligible,true);
 assert.equal(evaluate({...row,rank:201}).eligible,false);
 assert.equal(evaluate({...row,source:'https://www.fortnite.com/competitive/events/S42_PurgeCup/?region=ME&round=S42_PurgeCup_ME'}).eligible,false);
});

test('S32 Remix Solo Victory applies only verified ME rules, not historical NA aliases',()=>{
 const rule=RULES['ch5s5-solo-victory-cup'];
 assert.ok(rule);
 assert.equal(rule.seasonId,'S32');
 assert.deepEqual(rule.eventIds,['S32_SoloVictoryCashCup']);
 assert.equal(rule.prizePerVictory,100);
 assert.equal(rule.advance.ME,2000);
 assert.equal(rule.advance.NAC,undefined);
 assert.equal(rule.matchCaps['賞金決勝'],3);
 assert.ok(rule.source.includes('fortnite.com/news/competitive-details-make-your-mark-in-chapter-2-remix'));
});

test('S42 Solo Reload official advancement rules explicitly retain attendance without falsely qualifying',()=>{
 const x=registry.rules.find(rule=>rule.id==='ch7s4-solo-reload-victory-cup');
 assert.ok(x);
 assert.deepEqual(x.eventIds,['S42_ReloadSoloVictoryCup','S42_ReloadReloadSoloVictoryCup']);
 assert.equal(x.autoApproval,'verified-qualifier-participation');
 assert.equal(x.matchCaps['予選'],8);
 assert.equal(x.matchCaps['賞金決勝'],3);
 assert.equal(x.prizePerVictory,100);
 assert.deepEqual(x.advance,{EU:1600,NAC:800,NAW:320,BR:320,ME:320,OCE:320});
 assert.strictEqual(RULES[x.id].source,x.source);
 for(const mutation of [
  d=>d.rules.find(y=>y.id===x.id).advance.ME=800,
  d=>d.rules.find(y=>y.id===x.id).prizePerVictory=200,
  d=>d.rules.find(y=>y.id===x.id).eventIds.pop(),
  d=>d.rules.find(y=>y.id==='ch5s3-solo-victory-cup').autoApproval='verified-qualifier-participation'
 ]){
  const doc=clone(registry);mutation(doc);
  assert.ok(validateRegistry(doc,tournaments).length>0);
 }
});


test('S43 Buggy BR regional cosmetic cutoffs exactly match official Attachment C, isolated from ZB and Mobile',()=>{
 const id='ch7s5-one-piece-buggy-cup-battle-royale';
 const r=registry.rules.find(x=>x.id===id);
 const t=tournaments.catalog.find(x=>x.id===id);
 assert.ok(r&&t);
 assert.equal(t.name,'One Piece: Buggy Cup Battle Royale');
 assert.equal(t.mode,'battle-royale');
 assert.equal(t.team,'duo');
 assert.equal(r.series,'skin-cup');
 assert.equal(r.autoApproval,'verified-team-rank');
 assert.deepEqual(r.eventIds,['S43_OnePieceBuggyCup']);
 assert.equal(CUT_OFFS[id].eventId,'S43_OnePieceBuggyCup');
 assert.equal(r.matchCaps['スキン大会'],11);
 assert.deepEqual(r.cosmeticRanks,{OCE:50,ME:50,EU:525,BR:100,NAC:375,NAW:100});
 assert.equal(r.source,'https://www.fortnite.com/competitive/rules-guidelines/rules-library/one-piece-buggy-cup-chapter-7-mini-season-official-rules');
 for(const [region,cutoff] of Object.entries(r.cosmeticRanks)){
  const {evaluate}=require('../scripts/cosmetic-rank-rules.cjs');
  const row={id:'auto-s43-buggytest',tournamentId:id,seasonId:'S43',chapter:7,season:5,
   verified:true,kind:'参加確認',region,rank:cutoff,matches:11,vrs:0,kills:10,
   source:'https://www.fortnite.com/competitive/events/S43_OnePieceBuggyCup/?region='+region+'&round=S43_OnePieceBuggyCup_'+region};
  assert.equal(evaluate(row).eligible,true,region+' top '+cutoff);
  assert.equal(evaluate({...row,rank:cutoff+1}).eligible,false,region+' rank outside cutoff');
  assert.equal(evaluate({...row,matches:12}).eligible,false,region+' max matches');
  assert.equal(evaluate({...row,source:row.source.replace('S43_OnePieceBuggyCup/','S43_OnePieceBuggyCup_ZB/')}).eligible,false,
   region+' wrong ZB session');
  assert.equal(evaluate({...row,source:row.source.replace('OnePieceBuggyCup','OnePieceZoroCup')}).eligible,false,
   region+' wrong event');
 }
});
