'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-eu-unreal-me-trios-four.cjs');
const {audit}=require('../scripts/validate-approvals.cjs');
const doc=require('../data/manual-approvals/20261114-eu-unreal-me-trios-four-proof.json');
test('Four screenshot-backed results: two new plus two existing corrections, $1100 total',()=>{
 assert.equal(doc.batch.entries.length,4);
 assert.equal(V.TARGETS.length,4);
 assert.equal(new Set(V.TARGETS.map(t=>t.id)).size,4);
 assert.equal(V.TARGETS.filter(t=>t.operation==='add').length,2);
 assert.equal(V.TARGETS.filter(t=>t.operation==='correct').length,2);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.prize,0),1100);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.prizePerPlayer*t.players.length,0),1100);
 assert.deepEqual(V.TARGETS.map(t=>V.payout(t)),[200,300,300,300]);
 assert.deepEqual(V.TARGETS.map(t=>t.rank),[919,16,24,10]);
 assert.deepEqual(V.TARGETS.map(t=>t.vrs),[2,0,0,3]);
 assert.equal(V.TARGETS.find(t=>t.rank===919).players.join('/'),'ZAZI/Tossy');
 assert.equal(V.TARGETS.filter(t=>t.date==='2024-11-08').length,2);
});
test('Separate immutable oracle agrees with screenshots, Epic UUIDs and position-based tier',()=>{
 for(const t of V.TARGETS){
  const item=doc.batch.entries.find(x=>x.id===t.id);
  assert.ok(item);
  assert.equal(item.operation,t.operation);
  for(const k of ['date','seasonId','chapter','season','region','tournamentId','event','round','rank','points','matches','kills','vrs','prize','prizePerPlayer','sourceOfficial','sourceTracker','rule'])
   assert.deepEqual(item[k],t[k],t.id+':'+k);
  assert.deepEqual(item.players,t.players);
  assert.deepEqual(item.profiles.map(p=>V.uuid(p.url)),t.uuids);
  const row={id:t.id,date:t.date,seasonId:t.seasonId,chapter:t.chapter,season:t.season,
   region:t.region,tournamentId:t.tournamentId,event:t.event,round:t.round,
   kind:'賞金決勝',player:t.player,playerRaw:t.rawStored,players:[...t.players],
   rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,
   prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
   profiles:t.profiles.map(p=>({...p})),teamAccountIds:t.uuids.map(x=>x.replace(/-/g,'')),
   source:t.sourceOfficial,verified:true,
   note:'Screenshot '+item.screenshot+' Tracker: '+t.sourceTracker+' Rule: '+t.rule+' 各選手$'+t.prizePerPlayer};
  const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
   source:t.sourceTracker,rule:t.rule};
  assert.equal(V.verifyCashRow(row,entry),true,t.id);
  assert.deepEqual(audit([row],{version:1,entries:[entry]},{confirmedAliases:{}}),[],t.id);
  const changes=[
   {...row,rank:row.rank+1},{...row,points:row.points+1},
   {...row,matches:row.matches+1},{...row,kills:row.kills+1},
   {...row,vrs:row.vrs+1},{...row,prize:row.prize+100},
   {...row,teamPrize:row.teamPrize+100},{...row,prizePerPlayer:row.prizePerPlayer+100},
   {...row,playerRaw:'wrong previous name'},{...row,player:'wrong canonical'},
   {...row,source:row.source+'#fake'},{...row,note:'forgot source evidence'},
   {...row,kind:'参加確認'},{...row,verified:false},
   {...row,teamAccountIds:[('0'.repeat(32)),...row.teamAccountIds.slice(1)]},
   {...row,profiles:[{...row.profiles[0],url:row.profiles[0].url.replace(t.uuids[0],'ffffffff-ffff-ffff-ffff-ffffffffffff')},...row.profiles.slice(1)]}
  ];
  for(const modified of changes){
   assert.equal(V.verifyCashRow(modified,entry),false,t.id+' must reject tampering');
   assert.ok(audit([modified],{version:1,entries:[entry]},{confirmedAliases:{}}).length>0,t.id+' audit');
  }
 }
});
