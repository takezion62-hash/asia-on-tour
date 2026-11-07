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

test('nine existing source-linked official rules match tournament master and auto-approval',()=>{
 assert.deepEqual(validateRegistry(registry,tournaments),[]);
 assert.equal(registry.rules.length,9);
 assert.equal(Object.keys(RULES).length,7);
 assert.equal(Object.keys(CUT_OFFS).length,2);
 for(const rule of registry.rules){
  if(rule.series==='victory-cup')assert.strictEqual(RULES[rule.id].source,rule.source);
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
