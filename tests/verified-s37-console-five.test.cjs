'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const src=require('../scripts/verified-s37-console-five.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const roster=x=>Array.isArray(x.players)&&x.players.length?x.players:[x.player];
test('five exact screenshot results are locked to five UUID pairs, cash and unique source windows',()=>{
 assert.equal(src.validateProof(),true);
 assert.equal(src.proof.rows.length,5);
 assert.equal(src.proof.rows.reduce((a,b)=>a+b.teamPrizeUSD,0),1000);
 assert.equal(new Set(src.proof.rows.map(x=>x.id)).size,5);
 assert.equal(new Set(src.proof.rows.map(x=>x.windowId+'/'+x.rank)).size,5);
 for(const s of src.proof.rows){
  assert.equal(s.members.length,2);
  assert.equal(new Set(s.members.map(m=>src.accountId(m.url))).size,2);
  assert.equal(s.teamPrizeUSD,s.perPlayerUSD*2);
  assert.equal(s.vrs,1);
 }
});
test('published results match screen, no ambiguous duplicate team, original names and per-member cash',()=>{
 const rows=readResults(root).rows, ledger=read('approval-history.json').entries;
 const catalog=read('tournaments.json').catalog.find(x=>x.id===src.TID);
 for(const s of src.proof.rows){
  const record=rows.find(r=>r.id===s.id),entry=ledger.find(l=>l.id===s.id);
  assert.ok(record&&entry,'missing '+s.id);
  assert.deepEqual(record,src.expected(s,catalog));
  assert.equal(src.verifyPublished(record,entry),true);
  const colliding=rows.filter(r=>r.seasonId===s.seasonId&&r.date===s.date&&
   r.region===s.region&&r.tournamentId===s.tournamentId&&r.rank===s.rank&&
   (new URL(r.source).searchParams.get('round')||new URL(r.source).searchParams.get('window'))===s.windowId);
  assert.equal(colliding.length,1);
  assert.equal(record.prize,200);
  assert.equal(record.prizePerPlayer,100);
  assert.equal(record.kills,s.kills);
  assert.deepEqual(roster(record),s.members.map(m=>m.name));
  for(const [field,bad] of [['rank',s.rank+1],['kills',s.kills+1],['matches',s.matches+1],
   ['prize',400],['vrs',0],['prizePerPlayer',200],['points',0],['source','https://example.com']]){
   assert.equal(src.verifyPublished({...record,[field]:bad},entry),false,s.id+' '+field);
  }
  assert.equal(src.verifyPublished({...record,teamAccountIds:[...record.teamAccountIds].reverse()},entry),false);
 }
});
test('all five source windows are in archived official calendar with JST dates',()=>{
 for(const s of src.proof.rows){
  const sessions=read('calendar-history/'+s.date.slice(0,7)+'.json').sessions;
  assert.equal(sessions.filter(t=>t.dateJst===s.date&&t.region===s.region&&
   t.sourceWindowId===s.windowId&&t.eventId===src.EID).length,1);
 }
});
test('two novel players and stable existing aliases can all be found',()=>{
 const players=read('players.json');
 const names=new Set(players.candidates.map(x=>x.name));
 for(const n of ['rakua','kmyt','あおねこ','Mofu','Pegu','ふぃる','DynamicCart1801',
  'Botえもん','モバイル勢のまかろん'])assert.ok(names.has(n),'missing '+n);
 assert.ok(players.confirmedAliases['あおねこ'].includes('Celis あおねこ416'));
 assert.ok(players.confirmedAliases['Pegu'].includes('pegu'));
 assert.ok(players.confirmedAliases['rakua'].includes('FPG rakua 7'));
});
