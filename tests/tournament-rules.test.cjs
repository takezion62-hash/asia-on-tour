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

test('shared official tournament rules include review-only Trio Cash Cup plus approved types',()=>{
 assert.deepEqual(validateRegistry(registry,tournaments),[]);
 assert.equal(registry.rules.length,12);
 assert.equal(Object.keys(RULES).length,7);
 assert.equal(Object.keys(CUT_OFFS).length,2);
 for(const rule of registry.rules){
  if(rule.series==='victory-cup')assert.strictEqual(RULES[rule.id].source,rule.source);
  if(rule.series==='cash-cup'){
   assert.equal(RULES[rule.id],undefined);
   assert.equal(CUT_OFFS[rule.id],undefined);
   assert.equal(rule.autoApproval,'verified-team-rank');
  }
  if(rule.series==='skin-cup'){
   assert.equal(CUT_OFFS[rule.id].source,rule.source);
   assert.equal(CUT_OFFS[rule.id].maxMatches,rule.matchCaps['スキン大会']);
   assert.deepEqual(CUT_OFFS[rule.id].ranks,rule.cosmeticRanks);
  }
 }
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
 broken.rules[7].cosmeticRanks.EU=0;
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
 assert.equal(rule.autoApproval,'review-only');
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
 assert.match(validateRegistry(wrong,tournaments).join('\n'),/賞金額・個人分配/);
 const shifted=clone(registry);
 shifted.rules.find(r=>r.id===rule.id).scoring.placementPoints[0]=66;
 assert.match(validateRegistry(shifted,tournaments).join('\n'),/順位点/);
 const auto=clone(registry);
 auto.rules.find(r=>r.id===rule.id).autoApproval='verified-team-rank';
 assert.match(validateRegistry(auto,tournaments).join('\n'),/確認専用/);
});
