'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-s25-me-zb-duos-2023.cjs');
const {audit}=require('../scripts/validate-approvals.cjs');
const proof=require('../data/manual-approvals/20230619-26-me-zb-duos-vcup-proof.json').batch;
test('S25 ME 2023 ZB Duos screenshots: exact 10 distinct teams on two event dates',()=>{
 assert.equal(proof.rule,V.RULE);
 assert.equal(proof.seasonId,V.SEASON);
 assert.equal(V.TARGETS.length,10);
 assert.equal(new Set(V.TARGETS.map(x=>x.id)).size,10);
 assert.deepEqual(V.TARGETS.map(x=>x.date).sort(),
  [...Array(5).fill('2023-06-19'),...Array(5).fill('2023-06-26')]);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.prize,0),2200);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.vrs,0),11);
 assert.deepEqual(V.TARGETS.filter(x=>x.vrs===2).map(x=>x.player),['LODSTK / RiaM']);
 const byDate=Object.groupBy(V.TARGETS,t=>t.date);
 assert.deepEqual(byDate['2023-06-26'].map(t=>t.rank),[4,12,19,20,23]);
 assert.deepEqual(byDate['2023-06-19'].map(t=>t.rank),[1,3,11,8,14]);
});
test('exact Epic UUID, date, team cash and 1/2 VR approval match every screenshot',()=>{
 for(const t of V.TARGETS){
  const item=proof.teams.find(x=>x.date===t.date&&x.rank===t.rank);
  assert.ok(item,'missing screenshot for '+t.id);
  assert.equal(item.eventNumber,t.eventNumber);
  assert.equal(item.windowId,V.WINDOW(t));
  assert.equal(item.kills,t.kills);
  assert.equal(item.vrs,t.vrs);
  assert.equal(item.matches,t.matches);
  assert.equal(item.points,t.vrs*100);
  assert.equal(item.teamPrize,t.vrs*200);
  assert.deepEqual(item.members.map(p=>V.uuid(p.url)),t.ids);
  assert.equal(item.members.map(p=>p.name).join(' / '),t.player);
  const row={
   id:t.id,date:t.date,region:'ME',seasonId:'S25',chapter:4,season:3,
   tournamentId:V.TOURNAMENT,event:'Zero Build Duos Victory Cup',
   round:V.ROUND(t),kind:'賞金決勝',source:V.TRACKER(t),
   player:t.player,players:item.members.map(p=>p.name),rank:t.rank,points:t.points,
   kills:t.kills,vrs:t.vrs,matches:t.matches,prize:t.prize,
   teamPrize:t.prize,prizePerPlayer:t.vrs*100,
   profiles:item.members.map(p=>({name:p.name,url:p.url})),
   verified:true,note:'Tracker: '+V.TRACKER(t)+' Rule: '+V.RULE
  };
  const e={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
   source:V.TRACKER(t),rule:V.RULE};
  assert.equal(V.verifyCashRow(row,e),true,'valid team must pass '+t.id);
  assert.deepEqual(audit([row],{version:1,entries:[e]},{confirmedAliases:{}}),[],
   'S25 manual approval must pass '+t.id);
  const tampered=[
   {...row,rank:t.rank+1},{...row,points:0},{...row,kills:t.kills+1},
   {...row,vrs:t.vrs+1},{...row,matches:t.matches+1},
   {...row,prize:t.prize+200},{...row,teamPrize:t.prize+200},
   {...row,prizePerPlayer:t.vrs*100+100},
   {...row,date:t.date==='2023-06-19'?'2023-06-26':'2023-06-19'},
   {...row,round:V.ROUND(t).replace('Round 2','Round 1')},
   {...row,kind:'参加確認'},{...row,verified:false},
   {...row,profiles:[{...row.profiles[0],url:row.profiles[0].url.replace(t.ids[0],'00000000-0000-0000-0000-000000000000')},row.profiles[1]]}
  ];
  for(const changed of tampered){
   assert.equal(V.verifyCashRow(changed,e),false,
    'tampering must fail '+t.id+': '+JSON.stringify(changed));
   assert.ok(audit([changed],{version:1,entries:[e]},{confirmedAliases:{}}).length>0,
    'approval audit must fail '+t.id);
  }
 }
});
