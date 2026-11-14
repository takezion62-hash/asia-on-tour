'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readResults}=require('../scripts/source-results-store.cjs');
const {TARGETS,POLICY,uuid,payout,verifyCashRow}=require('../scripts/verified-kame-me-duos-two.cjs');
const proof=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261114-kame-me-duos-two-proof.json'),'utf8'));

test('Kame screenshot proof has exact weeks, ranks, cash and account UUIDs',()=>{
 assert.equal(proof.version,1);
 assert.equal(TARGETS.length,2);
 assert.deepEqual(proof.batch.entries,TARGETS);
 const [cash,elite]=TARGETS;
 assert.deepEqual([cash.date,cash.rank,cash.points,cash.kills,cash.vrs,cash.prize,cash.prizePerPlayer],['2024-10-04',40,40,4,0,200,100]);
 assert.deepEqual([elite.date,elite.rank,elite.points,elite.kills,elite.vrs,elite.prize,elite.prizePerPlayer],['2022-10-23',38,72,8,0,400,200]);
 for(const t of TARGETS){
   assert.equal(t.region,'ME');
   assert.equal(t.matches,6);
   assert.equal(payout(t),t.prize);
   assert.equal(t.prize,2*t.prizePerPlayer);
   assert.deepEqual(t.profiles.map(p=>uuid(p.url)),t.uuids);
 }
 assert.equal(payout({...cash,rank:41}),null);
 assert.equal(payout({...elite,rank:41}),null);
 assert.equal(payout({...cash,seasonId:'S32'}),null);
});

test('approved rows reject altered personal/team cash, ranks, scores, Epic ID and event window',()=>{
 for(const t of TARGETS){
  const row={id:t.id,date:t.date,seasonId:t.seasonId,chapter:t.chapter,season:t.season,
   region:t.region,tournamentId:t.tournamentId,event:t.event,round:t.round,rank:t.rank,points:t.points,
   matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
   player:t.players.join(' / '),playerRaw:t.playerRaw,players:[...t.players],verified:true,kind:'賞金決勝',
   source:t.sourceTracker,profiles:t.profiles.map(x=>({...x})),
   teamAccountIds:t.uuids.map(x=>x.replace(/-/g,'')),
   note:'各選手$'+t.prizePerPlayer+' Tracker: '+t.sourceTracker+' Rule: '+t.rule,
   trackerStats:{verified:true,source:t.sourceTracker,avgPlace:t.avgPlace,avgTimeAliveSeconds:t.avgTimeAliveSeconds,kdRatio:t.kdRatio}};
  const entry={id:t.id,recordId:t.id,policy:POLICY,decision:'published',source:t.sourceTracker,rule:t.rule};
  assert.equal(verifyCashRow(row,entry),true,t.id);
  for(const [key,altered] of [['rank',t.rank+1],['prize',0],['prizePerPlayer',0],['kills',999],['vrs',1],['points',0],['source','https://bad.invalid/']]){
   assert.equal(verifyCashRow({...row,[key]:altered},entry),false,key+' must fail');
  }
  assert.equal(verifyCashRow({...row,teamAccountIds:[row.teamAccountIds[1],row.teamAccountIds[0]]},entry),false,'wrong member UUID must fail');
  assert.equal(verifyCashRow(row,{...entry,policy:'attendance-only'}),false,'wrong policy must fail');
 }
});

test('existing prior Kame/ZAZI Week5 is not removed or mistaken for new Week4',()=>{
 const {rows}=readResults(root);
 const prior=rows.filter(r=>r.id==='s22-me-elite-weekly-finals-20221030-kame-zazi');
 assert.equal(prior.length,1);
 assert.equal(prior[0].rank,47);
 assert.equal(prior[0].prize,0);
 for(const t of TARGETS){
  const already=rows.filter(r=>r.id===t.id);
  assert.ok(already.length<=1);
  if(already.length)assert.deepEqual([already[0].rank,already[0].prize],[t.rank,t.prize]);
 }
});
