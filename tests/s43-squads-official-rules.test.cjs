'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'tournament-rules.json'),'utf8'));
const tournaments=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));
const {validateRegistry}=require('../scripts/validate-tournament-rules.cjs');
const {decide,RULES}=require('../scripts/verified-history-approval.cjs');
const rule=registry.rules.find(r=>r.id==='ch7s5-squads-victory-cup');
const clone=x=>JSON.parse(JSON.stringify(x));
test('S43 Squads official regional qualifier cutoffs and match caps',()=>{
 assert.ok(rule);
 assert.deepEqual(rule.eventIds,['S43_SquadsVictoryCup']);
 assert.equal(rule.team,'squad');
 assert.equal(rule.seasonId,'S43');
 assert.deepEqual(rule.matchCaps,{'予選':8,'賞金決勝':3});
 assert.deepEqual(rule.advance,{EU:300,NAC:200,NAW:120,OCE:120,ME:120,BR:120,ASIA:120});
 assert.deepEqual(validateRegistry(registry,tournaments),[]);
});
test('S43 Squads has 100 points/win, $50/person and $200/squad in 3-match final',()=>{
 assert.equal(rule.finalWinPoints,100);
 assert.equal(rule.prizePerVictory,50);
 assert.equal(rule.teamPrizePerVictory,200);
 for(const vrs of [0,1,2,3]){
  assert.equal(vrs*rule.finalWinPoints,vrs*100);
  assert.equal(vrs*rule.prizePerVictory,vrs*50);
  assert.equal(vrs*rule.teamPrizePerVictory,vrs*200);
 }
 assert.equal(RULES[rule.id].source,rule.source);
 assert.equal(rule.autoApproval,undefined);
});
test('Generic historical approval may not mis-credit $50 for an entire four-player squad',()=>{
 const out=decide({kind:'賞金決勝',tournamentId:rule.id,vrs:1,prize:null},{},{complete:true},{});
 assert.equal(out.approved,false);
 assert.match(out.reason,/専用検証フロー/);
 const qualifying=require('../scripts/squads-qualifier-rules.cjs');
 assert.deepEqual({...qualifying.advance},rule.advance);
});
test('Official S43 Squads scope/cutoffs/points/prizes are immutable under validation',()=>{
 const changes=[
  r=>{r.advance.NAC=300},
  r=>{r.advance.ME=200},
  r=>{r.advance.ASIA=121},
  r=>{r.prizePerVictory=200},
  r=>{r.teamPrizePerVictory=50},
  r=>{r.finalWinPoints=99},
  r=>{r.matchCaps['予選']=7},
  r=>{r.matchCaps['賞金決勝']=4},
  r=>{r.eventIds=['S43_SoloVictoryCup']},
  r=>{r.autoApproval='verified-qualifier-participation'}
 ];
 for(const change of changes){
  const doc=clone(registry);
  const copy=doc.rules.find(x=>x.id===rule.id);
  change(copy);
  assert.notDeepEqual(validateRegistry(doc,tournaments),[],JSON.stringify(copy));
 }
});

test('SOURCES script remains valid Javascript and distinguishes squad/team cash',()=>{
 const ui=fs.readFileSync(path.join(root,'source-rules.js'),'utf8');
 assert.doesNotThrow(()=>new Function(ui),'SOURCES JS must parse before expensive browser suites');
 assert.match(ui,/teamPrizePerVictory/);
 assert.match(ui,/squadsNote/);
});
