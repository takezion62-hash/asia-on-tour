'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const proof=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261123-s43-trios-event3-ten.json'),'utf8'));
const rules=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8'));
const {verifyProof,rowFor,entryFor,publish,EXPECTED}=require('../scripts/publish-s43-trios-event3-20261122.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
test('10 screenshot-locked S43 ME/OCE Event 3 trios, each unique with 30 verified profile URLs',()=>{
 assert.equal(verifyProof(proof,rules),true);
 assert.equal(proof.teams.length,10);
 assert.equal(EXPECTED.length,10);
 assert.equal(new Set(proof.teams.flatMap(t=>t.members.map(m=>m.uuid))).size,30);
 assert.deepEqual(proof.teams.map(t=>t.screenshot),[2062,2063,2064,2065,2066,2067,2068,2069,2070,2071]);
});
test('cash is from official top-five rank brackets, never from VR',()=>{
 for(const t of proof.teams){
  const row=rowFor(t),approval=entryFor(t,'2026-11-23T07:00:00.000Z');
  assert.equal(row.prize,0);
  assert.equal(row.prizePerPlayer,0);
  assert.equal(row.kind,'賞金決勝');
  assert.equal(row.round,'Event 3 / 賞金決勝');
  assert.equal(row.players.length,3);
  assert.equal(row.profiles.length,3);
  assert.equal(row.teamAccountIds.length,3);
  assert.equal(row.source,t.sourceOfficial);
  assert.equal(approval.rule,proof.ruleUrl);
  assert.equal(approval.policy,'verified-rule');
  assert.equal(row.vrs,t.vrs);
 }
 assert.equal(proof.teams.find(t=>t.region==='ME'&&t.rank===51).vrs,1);
 assert.equal(proof.teams.find(t=>t.region==='OCE'&&t.rank===549).kills,23);
});
test('refuses altered tournament, points, team, roster link or payout policy',()=>{
 for(const change of [
  doc=>{doc.teams[0].points++},
  doc=>{doc.teams[2].vrs=0},
  doc=>{doc.teams[0].members[0].uuid='a'.repeat(32)},
  doc=>{doc.teams[0].members[0].url='https://evil.example/'},
  doc=>{doc.teams[3].members[1].name='unknown'},
  doc=>{doc.teams[9].screenshot=2062},
  doc=>{doc.teams[4].rank=5},
  doc=>{doc.teams[0].sourceOfficial=doc.teams[2].sourceOfficial}
 ]){
  const altered=clone(proof);change(altered);
  assert.throws(()=>verifyProof(altered,rules),/S43_TRIOS_EVENT3/);
 }
 const altered=clone(rules);
 altered.rules.find(x=>x.id==='ch7s5-trios-cash-cup').cashPrizes.tiers.ME.at(-1).through=20;
 assert.throws(()=>verifyProof(proof,altered),/S43_TRIOS_EVENT3/);
});
test('source-backed publisher dry-run leaves all source and index files intact',()=>{
 const output=publish({dryRun:true});
 assert.equal(output.selected,10);
 assert.equal(output.prizeAdded,0);
 assert.equal(output.added.length+output.already,10);
 assert.ok(output.newPlayers<=30);
});
