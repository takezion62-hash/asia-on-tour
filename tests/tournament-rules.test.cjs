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
 assert.equal(registry.rules.length,10);
 assert.equal(Object.keys(RULES).length,7);
 assert.equal(Object.keys(CUT_OFFS).length,2);
 for(const rule of registry.rules){
  if(rule.series==='victory-cup')assert.strictEqual(RULES[rule.id].source,rule.source);
  if(rule.series==='cash-cup'){
   assert.equal(RULES[rule.id],undefined);
   assert.equal(CUT_OFFS[rule.id],undefined);
   assert.equal(rule.autoApproval,'review-only');
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
 assert.match(testChange(rule=>{rule.autoApproval='auto'}),/確認専用/);
 assert.match(testChange(rule=>{rule.cashPrizes.basis='per-team'}),/個人賞金テーブルが不正/);
});
