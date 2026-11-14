'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-s37-s41-oce-five.cjs');
const {audit}=require('../scripts/validate-approvals.cjs');
const proof=require('../data/manual-approvals/20261114-s37-s41-oce-five-proof.json').batch;
test('Five distinct S37/S41 OCE console cash records are locked to screenshots and $600',()=>{
 assert.equal(proof.entries.length,5);
 assert.equal(V.TARGETS.length,5);
 assert.equal(new Set(V.TARGETS.map(x=>x.id)).size,5);
 assert.equal(V.TARGETS.reduce((x,t)=>x+t.prize,0),600);
 assert.deepEqual(V.TARGETS.filter(x=>x.seasonId==='S37').map(x=>x.rank),[6]);
 assert.deepEqual(V.TARGETS.filter(x=>x.seasonId==='S41'&&x.date==='2026-06-21').map(x=>x.rank),[1,6,15]);
 assert.deepEqual(V.TARGETS.filter(x=>x.seasonId==='S41'&&x.date==='2026-06-14').map(x=>x.rank),[25]);
 assert.deepEqual(V.TARGETS.map(x=>V.price(x)),[200,100,100,100,100]);
 assert.ok(V.TARGETS.every(x=>x.vrs===1));
 assert.equal(V.TARGETS.find(x=>x.date==='2025-10-04').players.join(' / '),'Mofu / すかい');
 assert.equal(V.TARGETS.find(x=>x.rank===1).players[0],'ЯGN Pinobot ǃ');
});
test('Every screenshot cash result matches event session, roster, rank, VR, Epic UUID and cash payout',()=>{
 for(const t of V.TARGETS){
  const item=proof.entries.find(x=>x.seasonId===t.seasonId&&x.rank===t.rank&&x.region===t.region);
  assert.ok(item,'screenshot is absent: '+t.id);
  assert.equal(item.source,t.source);
  assert.equal(item.rule,t.rule);
  assert.deepEqual(item.players,t.players);
  assert.equal(item.raw.join(' / '),t.raw);
  assert.equal(item.points,t.points);
  assert.equal(item.kills,t.kills);
  assert.equal(item.matches,t.matches);
  assert.equal(item.vrs,t.vrs);
  assert.equal(item.prize,t.prize);
  assert.deepEqual(item.profiles.map(p=>V.uuid(p.url)),t.uuids);
  const row={
   id:t.id,date:t.date,region:t.region,seasonId:t.seasonId,
   chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,
   event:t.event,round:t.round,kind:'賞金決勝',
   player:t.player,playerRaw:t.raw,players:[...t.players],
   rank:t.rank,points:t.points,kills:t.kills,vrs:t.vrs,matches:t.matches,
   prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prize/t.players.length,
   profiles:item.profiles,source:t.source,verified:true,
   note:'Tracker: '+t.source+' Rule: '+t.rule
  };
  if(t.players.length===1)row.profileUrl=item.profiles[0].url;
  const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,source:t.source,rule:t.rule};
  assert.equal(V.verifyCashRow(row,entry),true,'correct source row should be valid '+t.id);
  assert.deepEqual(audit([row],{version:1,entries:[entry]},{confirmedAliases:{}}),[],
   'ledger should accept exact screenshot row '+t.id);
  const changes=[
   {...row,rank:t.rank+1},{...row,points:t.points+1},
   {...row,kills:t.kills+1},{...row,matches:t.matches+1},{...row,vrs:t.vrs+1},
   {...row,prize:t.prize+100},{...row,prizePerPlayer:t.prize/t.players.length+100},
   {...row,playerRaw:'wrong gamer tag'}, {...row,source:t.source+'#wrong'},
   {...row,verified:false},{...row,note:'missing source and official payout'},
   {...row,profiles:[{...row.profiles[0],url:row.profiles[0].url.replace(t.uuids[0],'ffffffff-ffff-ffff-ffff-ffffffffffff')},...row.profiles.slice(1)]}
  ];
  for(const changed of changes){
   assert.equal(V.verifyCashRow(changed,entry),false,'tampering cannot pass '+t.id);
   assert.ok(audit([changed],{version:1,entries:[entry]},{confirmedAliases:{}}).length>0,
    'audit must fail forged award '+t.id);
  }
 }
});
