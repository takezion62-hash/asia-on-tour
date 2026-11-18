'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const v=require('../scripts/verified-ps-finals-ten-20261118.cjs');
const doc=read('data/manual-approvals/20261118-ps-four-finals-ten.json');
test('ten immutable owner screenshots each retain exact original player ID, score, session and official prize',()=>{
 assert.equal(v.validateProof(),true);
 assert.equal(doc.batch.entries.length,10);
 assert.equal(new Set(doc.batch.entries.map(x=>x.id)).size,10);
 assert.equal(doc.batch.entries.reduce((n,x)=>n+x.prize,0),1150);
 const coverage=new Map();
 for(const x of doc.batch.entries){
  const key=x.date+' '+x.region+' '+x.tournamentId;
  coverage.set(key,(coverage.get(key)||0)+1);
  assert.equal(v.prizeFor(x),x.prize,'official prize tier '+x.id);
  assert.ok(v.uuid(x.profileUrl));
  assert.ok(x.source.includes('epicgames_'+x.eventId+'_'+x.region));
  assert.ok(x.source.includes(x.windowId));
  assert.ok(x.matches>=x.vrs&&x.matches<=6);
 }
 assert.deepEqual([...coverage.entries()].sort(),[
  ['2024-06-29 OCE ch5s3-playstation-cup-br',1],
  ['2024-06-30 OCE ch5s3-playstation-cup-zb',4],
  ['2024-12-08 ME ch6s1-playstation-cup',2],
  ['2025-09-04 OCE ch6s4-playstation-cup',3]
 ]);
});
test('S30 OCE, S33 ME, S37 OCE official rank-price brackets never infer cash from a win alone',()=>{
 const base=doc.batch.entries[0];
 assert.equal(v.prizeFor({...base,seasonId:'S37',rank:10,region:'OCE'}),200);
 assert.equal(v.prizeFor({...base,seasonId:'S37',rank:40,region:'OCE'}),200);
 assert.equal(v.prizeFor({...base,seasonId:'S37',rank:41,region:'OCE'}),0);
 assert.equal(v.prizeFor({...base,seasonId:'S33',rank:36,region:'ME'}),250);
 assert.equal(v.prizeFor({...base,seasonId:'S33',rank:93,region:'ME'}),0);
 assert.equal(v.prizeFor({...base,seasonId:'S30',rank:6,region:'OCE'}),300);
 assert.equal(v.prizeFor({...base,seasonId:'S30',rank:25,region:'OCE'}),100);
 assert.equal(v.prizeFor({...base,seasonId:'S30',rank:83,region:'OCE'}),100);
 assert.equal(v.prizeFor({...base,seasonId:'S30',rank:101,region:'OCE'}),0);
 assert.equal(v.prizeFor({...base,seasonId:'S33',rank:10,region:'OCE'}),null);
});
test('published row and ledger are locked against score, cash, profile, date, tournament and URL changes',()=>{
 for(const x of doc.batch.entries){
  const row=v.project(x),entry=v.approval(x);
  assert.equal(v.verifyRow(row,entry),true,x.id);
  assert.deepEqual(row.profiles,[{name:x.player,url:x.profileUrl}]);
  assert.equal(row.prizePerPlayer,x.prize);
  assert.equal(row.kind,'賞金決勝');
  for(const [field,value] of [['rank',row.rank+1],['kills',row.kills+1],
    ['points',row.points+1],['vrs',row.vrs+1],['matches',row.matches+1],
    ['prize',row.prize+100],['profileUrl','https://example.org/profile'],
    ['date','2020-01-01'],['tournamentId','other'],['source','https://example.org'],
    ['player','Another player']]){
   assert.equal(v.verifyRow({...row,[field]:value},entry),false,x.id+' '+field);
  }
  assert.equal(v.verifyRow(row,{...entry,rule:'https://wrong.example'}),false);
  assert.equal(v.verifyRow(row,{...entry,recordHash:'tampered'}),false);
 }
});
test('2024 OCE PlayStation tomato reuses same verified Epic identity as 2026 OCE result',()=>{
 const current=read('players.json');
 assert.ok(current.candidates.some(x=>x.name==='とまと'));
 const newTomato=doc.batch.entries.find(x=>x.id==='ps-s30-oce-s30ocezb-final-20240630-r25');
 assert.ok(newTomato);
 assert.equal(newTomato.player,'とまと');
 assert.equal(newTomato.playerRaw,'とまと');
 assert.equal(v.uuid(newTomato.profileUrl),'6e8019af-c259-4664-b5e1-7273c365d316');
 const rows=readResults(root).rows;
 const existing=rows.find(x=>x.id==='s42-oce-console-zb-solo-vc-final-20260912-tomato');
 assert.ok(existing,'source evidence for existing 2026 OCE player is required');
 assert.equal(existing.player,'とまと');
 assert.equal(v.uuid(existing.profileUrl),v.uuid(newTomato.profileUrl));
 const historical=rows.find(x=>x.id==='s26-me-zb-duos-vc-final-20231009-banao-tomato');
 assert.ok(historical,'preserve earlier 2023 ME team result');
 const olderId=v.uuid(historical.profiles.find(x=>x.name==='とまと')?.url);
 assert.ok(olderId);
 assert.notEqual(olderId,v.uuid(newTomato.profileUrl),'2023 profile has a different Epic account; do not silently rewrite it');
 assert.ok(current.confirmedAliases['とまと'].includes('HELIX BRN とまと'));
 assert.equal(v.project(newTomato).player,'とまと');
});
test('all ten records are published exactly once after deployment, or none before rollout',()=>{
 const results=readResults(root).rows,ledger=read('approval-history.json').entries;
 const targets=doc.batch.entries.map(x=>x.id),present=results.filter(x=>targets.includes(x.id));
 assert.ok([0,10].includes(present.length),'must publish the full frozen batch together');
 if(present.length){
  for(const row of present){
   const entry=ledger.find(x=>x.id===row.id);
   assert.ok(entry&&v.verifyRow(row,entry),row.id);
   assert.equal(ledger.filter(x=>x.id===row.id).length,1);
  }
 }
});
test('Four new event catalog identities are different, keeping BR and Zero Build separate',()=>{
 const catalog=read('tournaments.json').catalog;
 for(const [key,s] of Object.entries(v.SESSIONS)){
  const match=catalog.filter(x=>x.id===s.tournamentId);
  assert.equal(match.length,1,key);
  assert.equal(match[0].mode,s.mode);
  assert.equal(match[0].seasonId,s.seasonId);
  assert.deepEqual(match[0].sourceEventIds,[s.eventId]);
 }
});

test('full snapshot dry-run proves publishability without touching any source shard, identity or previous prize',()=>{
 const crypto=require('node:crypto');
 const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
 const sensitive=['source-results/manifest.json','players.json','approval-history.json','updates.json'];
 const before=sensitive.map(sha);
 const {apply}=require('../scripts/apply-ps-finals-ten-20261118.cjs');
 const summary=apply({dryRun:true});
 assert.equal(summary.added+summary.alreadyPublished,10);
 assert.equal(summary.newPlayers.length,summary.added===0?0:3);
 assert.equal(summary.addedPrize,summary.added===0?0:1150);
 assert.deepEqual(sensitive.map(sha),before,
  'dry run must not write over published scores, prizes or player identities');
});
