'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-ps-cups-2022-2024-nov14.cjs');
const {audit}=require('../scripts/validate-approvals.cjs');
const p=require('../data/manual-approvals/20261114-s22-s25-s31-ps-zb-10-proof.json').batch;
test('2022 OCE PlayStation, 2023 ME Zero Build Duos, 2024 NAC SypherPK: exactly 10 distinct rankings and $2350',()=>{
 assert.equal(p.entries.length,10);
 assert.equal(V.TARGETS.length,10);
 assert.equal(new Set(V.TARGETS.map(x=>x.id)).size,10);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.prize,0),2350);
 assert.deepEqual(V.TARGETS.filter(t=>t.seasonId==='S22').map(t=>t.rank),[9,24,55,58,61,72,73]);
 assert.deepEqual(V.TARGETS.filter(t=>t.seasonId==='S31').map(t=>t.rank),[69,89]);
 assert.deepEqual(V.TARGETS.filter(t=>t.seasonId==='S25').map(t=>t.rank),[17]);
 assert.equal(V.TARGETS.find(t=>t.seasonId==='S22'&&t.rank===9).prize,450);
 assert.equal(V.TARGETS.find(t=>t.seasonId==='S31'&&t.rank===69).prize,300);
 assert.equal(V.TARGETS.find(t=>t.seasonId==='S31'&&t.rank===89).prize,200);
});
test('Every locked screenshot team/solo has its exact official source and Epic UUIDs',()=>{
 for(const t of V.TARGETS){
  const x=p.entries.find(e=>e.date===t.date&&e.region===t.region&&e.rank===t.rank);
  assert.ok(x,t.id);
  assert.equal(x.prize,V.expectedPrice(t),t.id);
  assert.equal(x.points,t.points);
  assert.equal(x.kills,t.kills);
  assert.equal(x.matches,t.matches);
  assert.equal(x.vrs,t.vrs);
  assert.equal(x.source,t.source);
  assert.equal(x.rule,t.rule);
  assert.deepEqual(x.profiles.map(p=>V.uuid(p.url)),t.uuids);
  const dual=Array.isArray(t.players);
  const row={
   id:t.id,date:t.date,region:t.region,player:t.player,
   event:t.event,round:t.round,rank:t.rank,points:t.points,
   matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,kind:'賞金決勝',
   seasonId:t.seasonId,chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,
   source:t.source,profiles:x.profiles,verified:true,
   teamPrize:t.prize,prizePerPlayer:dual?t.prize/2:t.prize,
   note:'Tracker: '+t.source+' Rule: '+t.rule
  };
  if(dual)row.players=[...t.players];
  else row.profileUrl=x.profiles[0].url;
  const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,source:t.source,rule:t.rule};
  assert.equal(V.verifyCashRow(row,entry),true,'valid screenshot must pass '+t.id);
  assert.deepEqual(audit([row],{version:1,entries:[entry]},{confirmedAliases:{}}),[],
   'audit approves only screenshot-matching official award '+t.id);
  const invalid=[
   {...row,rank:t.rank+1},{...row,points:t.points+1},
   {...row,kills:t.kills+1},{...row,matches:t.matches+1},
   {...row,vrs:t.vrs+1},{...row,prize:t.prize+100},
   {...row,round:'Qualifiers'},{...row,verified:false},
   {...row,profiles:[{...x.profiles[0],url:x.profiles[0].url.replace(t.uuids[0],'ffffffff-ffff-ffff-ffff-ffffffffffff')},...x.profiles.slice(1)]},
   {...row,source:row.source.replace('OCE','ME').replace('NAC','ME')},
   {...row,note:'unverified'}
  ];
  for(const changed of invalid){
   assert.equal(V.verifyCashRow(changed,entry),false,'cash/identity change must fail '+t.id);
   assert.ok(audit([changed],{version:1,entries:[entry]},{confirmedAliases:{}}).length>0,
    'ledger must reject fabricated result '+t.id);
  }
 }
});
