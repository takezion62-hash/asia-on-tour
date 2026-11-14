'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-s27-s34-s31-ps-zb-ten.cjs');
const root=path.resolve(__dirname,'..');
const proof=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261114-s27-s34-s31-ps-zb-ten-proof.json'),'utf8'));
const players=JSON.parse(fs.readFileSync(path.join(root,'players.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));
test('ten original screenshots lock exact date/region/rank, points, kills and eligible prize',()=>{
 assert.deepEqual(proof.batch.targets,V.TARGETS);
 assert.equal(V.TARGETS.length,10);
 assert.deepEqual(V.TARGETS.map(x=>[x.date,x.region,x.rank,x.points,x.matches,x.kills,x.vrs,x.prize]),[
 ['2023-12-01','NAC',38,100,3,17,1,200],
 ['2023-11-28','NAC',74,100,3,6,1,200],
 ['2025-05-01','NAW',16,162,6,6,0,500],
 ['2025-05-01','NAW',21,144,6,7,0,500],
 ['2025-05-01','NAW',64,53,6,4,0,0],
 ['2024-09-02','ME',15,123,6,3,0,200],
 ['2024-09-02','ME',52,38,6,6,0,200],
 ['2024-09-02','ME',71,22,5,2,0,200],
 ['2024-09-02','ME',72,21,4,1,0,200],
 ['2024-09-02','ME',79,12,3,1,0,200]]);
 assert.equal(V.TARGETS.reduce((n,x)=>n+x.prize,0),2400);
 assert.equal(V.TARGETS.filter(x=>x.prize===0).length,1);
 assert.equal(V.TARGETS.reduce((n,x)=>n+x.profiles.length,0),12);
 assert.equal(new Set(V.TARGETS.map(x=>x.id)).size,10);
 for(const row of V.TARGETS){
  assert.equal(V.payout(row),row.prize);
  assert.equal(row.prize,row.prizePerPlayer*row.players.length);
  assert.equal(row.profiles.length,row.players.length);
  assert.ok(catalog.catalog.some(x=>x.id===row.tournamentId&&x.sourceEventIds.includes(row.eventId)));
  assert.equal(row.sourceTracker,'https://fortnitetracker.com/events/epicgames_'+row.eventId+'_'+row.region+'?window='+row.windowId);
  for(const [i,p] of row.profiles.entries()){assert.equal(V.uuid(p.url),p.id);assert.equal(p.name,row.players[i]);}
 }
 assert.equal(V.payout({...V.TARGETS[0],vrs:0}),null);
 assert.equal(V.payout({...V.TARGETS[2],rank:64}),0);
 assert.equal(V.payout({...V.TARGETS[4],rank:21}),500);
 assert.equal(V.payout({...V.TARGETS[8],rank:101}),null);
});
test('original Epic UUIDs, placement money, cash-free row and approval policy cannot be silently altered',()=>{
 for(const t of V.TARGETS){
  const row={id:t.id,date:t.date,region:t.region,seasonId:t.seasonId,chapter:t.chapter,season:t.season,
   tournamentId:t.tournamentId,event:t.event,round:t.round,rank:t.rank,points:t.points,
   matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,teamPrize:t.prize,
   prizePerPlayer:t.prizePerPlayer,player:t.players.join(' / '),playerRaw:t.playerRaw,
   players:[...t.players],profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
   teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),source:t.sourceTracker,
   verified:true,kind:'賞金決勝',
   note:'各選手$'+t.prizePerPlayer+' '+t.sourceTracker+' '+t.rule};
  const e={id:t.id,recordId:t.id,policy:V.POLICY,decision:'published',source:t.sourceTracker,rule:t.rule};
  assert.equal(V.verifyRow(row,e),true,t.id);
  for(const [k,v] of [['rank',t.rank+1],['points',999],['kills',999],
    ['prize',t.prize+100],['prizePerPlayer',-1],['source','https://wrong.invalid/']])
    assert.equal(V.verifyRow({...row,[k]:v},e),false,t.id+': '+k);
  assert.equal(V.verifyRow({...row,profiles:[{name:t.profiles[0].name,url:'https://fortnitetracker.com/profile/all/changed/events?id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]},e),false);
  assert.equal(V.verifyRow(row,{...e,policy:'attendance-only'}),false);
 }
});
test('retains existing identities, other final records, and original lower-v alias',()=>{
 const names=new Set(players.candidates.map(p=>p.name));
 for(const n of ['ゆったり','りんたろう','p1ng','RGN p1ng','プロGON','Asuka','ちからV2','れっどうぃんぐ'])assert.ok(names.has(n));
 assert.ok(players.confirmedAliases['ちからV2'].includes('ちからv2'));
 assert.equal(V.TARGETS[8].players[0],'ちからV2');
 assert.equal(V.TARGETS[4].players[0],'れっどうぃんぐ');
 assert.notEqual(V.TARGETS[3].players[0],'RGN p1ng');
 const rows=readResults(root).rows;
 assert.ok(rows.some(x=>x.id==='s30-nac-zb-solo-vc-final-20240625-rintaro'));
 assert.ok(rows.some(x=>x.id==='s29-nac-zb-duos-vc-final-20240425-favsie-rintaro'));
 for(const t of V.TARGETS){
  const current=rows.filter(x=>x.id===t.id);
  assert.ok(current.length<=1);
  if(current.length)assert.deepEqual([current[0].rank,current[0].prize],[t.rank,t.prize]);
 }
});
