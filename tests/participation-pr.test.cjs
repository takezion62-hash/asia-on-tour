'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const PR=require('../aot-pr.js'),bridge=require('../participation-pr.js');
const meta={id:'s42-console-zero-build',name:'Console Zero Build Solo Victory Cup',
 series:'victory-cup',subtype:'console-solo-victory-cup',team:'solo',mode:'zero-build',
 seasonId:'S42',sourceEventIds:['S42_ConsoleVCC_SolosZB']};
const duo={...meta,id:'s42-icon-duo',name:'Inoxtag Icon Cup Battle Royale',
 series:'icon-cup',subtype:'inoxtag-icon-cup',team:'duo',mode:'battle-royale',
 sourceEventIds:['S42_InoxtagIconCup']};
const official=(t,windowId)=>'https://www.fortnite.com/competitive/events/'+t.sourceEventIds[0]+
 '/?region=NAW&round='+windowId;
const row=(changes={},cat=meta)=>({
 id:'participation-0123456789abcdefabcd',date:'2026-10-25',region:'NAW',
 seasonId:'S42',tournamentId:cat.id,event:cat.name,round:'Event 8 · Round 1 / 予選',
 stage:'予選',player:'A',rank:1044,points:187,kills:16,vrs:0,matches:8,
 prize:null,status:'通過圏外',qualification:'outside-cutoff',verified:true,
 source:official(cat,'S42_ConsoleVCC_SolosZB_Event8Round1_NAW'),
 ...changes
});
const pub=(changes={},cat=meta)=>({id:'published',date:'2026-10-25',region:'NAW',
 seasonId:'S42',tournamentId:cat.id,event:cat.name,round:'Event 8 · Round 2 / 賞金決勝',
 kind:'賞金決勝',player:'A',rank:10,points:10,kills:4,vrs:0,prize:null,verified:true,
 source:'https://fortnitetracker.com/events/epicgames_S42_ConsoleVCC_SolosZB_NAW?window=S42_ConsoleVCC_SolosZB_Event8_Round2_NAW',
 ...changes});
const categories={ [meta.id]:meta,[duo.id]:duo };
const classify=x=>categories[x.tournamentId]||null;
const prepare=(published,archive,known=new Set(['A','B']))=>
 bridge.merge(published,archive,{classify,sessionKey:PR.sessionKey,knownPlayers:known});
const rank=records=>PR.calculate(records,{classify,names:r=>r.players||[r.player]});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
test('verified rank-1044 nonqualifier gets attendance, reduced placement and kills; no prize or advance points',()=>{
 const merged=prepare([],[row()]);
 assert.equal(merged.creditedRows,1);
 const one=rank(merged.records).byName.get('A');
 assert.equal(one.participationRecords,1);
 assert.equal(one.qualificationBonus,0);
 assert.equal(one.bonus,0);
 close(one.attendance,10);
 close(one.placement,100/Math.sqrt(1044)*.35);
 close(one.eliminations,24*.35);
 close(one.score,10+100/Math.sqrt(1044)*.35+24*.35);
 close(one.participationScore,one.score);
 assert.equal(one.rows[0].participationOnly,true);
});
test('confirmed attendance in a single unknown-stage Icon event is conservatively scored, without cosmetic rewards',()=>{
 const item=row({date:'2026-10-26',event:duo.name,tournamentId:duo.id,
   player:'A / B',players:['A','B'],round:'単一開催枠 / 参加確認',stage:'参加確認',
   rank:229,points:329,kills:24,vrs:1,matches:10,
   qualification:'unverified',status:'出場確認',
   source:official(duo,'S42_InoxtagIconCup_NAW')},duo);
 const merged=prepare([],[item]);
 assert.equal(merged.creditedPlayers,2);
 const players=rank(merged.records).ranked;
 assert.equal(players.length,2);
 for(const p of players){
  close(p.attendance,10*.35);
  close(p.placement,100/Math.sqrt(229)*.35*.35);
  close(p.eliminations,Math.min(25,24/2*1.5)*.35*.35);
  assert.equal(p.qualificationBonus,0);
  assert.equal(p.bonus,0);
 }
});
test('same player/tournament/date/region/session published final suppresses archive and keeps cash unchanged',()=>{
 const p=pub({prize:100,vrs:1});
 const merged=prepare([p],[row()]);
 assert.equal(merged.creditedRows,0);
 assert.equal(merged.skippedPublished,1);
 const result=rank(merged.records).byName.get('A');
 assert.equal(result.participationScore,0);
 close(result.bonus,20);
});
test('a distinct event session on the same day remains eligible even with another published event',()=>{
 const extra=row({id:'participation-11111111111111111111',
   round:'Event 9 · Round 1 / 予選',source:official(meta,'S42_ConsoleVCC_SolosZB_Event9Round1_NAW')});
 const merged=prepare([pub()],[extra]);
 assert.equal(merged.creditedRows,1);
 assert.equal(rank(merged.records).byName.get('A').participationRecords,1);
});
test('an exact published teammate suppresses only that player, preserving the other verified partner',()=>{
 const item=row({id:'participation-22222222222222222222',event:duo.name,tournamentId:duo.id,
   player:'A / B',players:['A','B'],stage:'参加確認',round:'単一開催枠 / 参加確認',
   status:'出場確認',qualification:'unverified',
   source:official(duo,'S42_InoxtagIconCup_NAW')},duo);
 const old=pub({event:duo.name,tournamentId:duo.id,source:official(duo,'S42_InoxtagIconCup_NAW'),
  round:'単一開催枠 / 参加確認',players:['A'],player:'A',prize:null},duo);
 const merged=prepare([old],[item]);
 assert.equal(merged.skippedPublished,1);
 assert.equal(merged.creditedPlayers,1);
 const report=rank(merged.records);
 assert.equal(report.byName.get('A').participationRecords,0);
 assert.equal(report.byName.get('B').participationRecords,1);
});
test('duplicate archive IDs or same player in same event never produce double PR',()=>{
 const first=row();
 const sameId={...first,id:first.id};
 const duplicate={...first,id:'participation-aaaaaaaaaaaaaaaaaaaa',rank:1045};
 const merged=prepare([],[first,sameId,duplicate]);
 assert.equal(merged.creditedRows,1);
 assert.equal(merged.skippedDuplicate,2);
 assert.equal(rank(merged.records).participationIncluded,1);
});
test('invalid dates, unconfirmed identity, fake prizes, impossible scores and mismatched Epic URLs cannot score',()=>{
 for(const change of [
  {date:'2026-13-99'}, {verified:false},{prize:1},{status:'出場確認'},
  {matches:0},{vrs:9},{source:'https://evil.example/events/S42/'},
  {source:'https://www.fortnite.com/competitive/events/S42_InoxtagIconCup/?region=NAW&round=S42_InoxtagIconCup_NAW'},
  {tournamentId:'unknown'}, {region:'NAC'},{id:'fake'},
  {player:'not confirmed'}, {seasonId:'S43'}, {stage:'賞金決勝'}
 ]){
  assert.equal(prepare([],[row(change)]).creditedRows,0,JSON.stringify(change));
 }
 assert.equal(prepare([],[row()],new Set()).creditedRows,0);
});
test('archive records alone never modify formal prize totals or verified achievement sources',()=>{
 const item=row();
 const published=[pub({prize:100,vrs:1})];
 const frozen=JSON.stringify(published);
 const merged=prepare(published,[item]);
 assert.equal(JSON.stringify(published),frozen);
 assert.equal(merged.records[0],published[0]);
});
