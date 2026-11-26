'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const V=require('../scripts/verified-mobile-series-nine-20261121.cjs');
const {apply}=require('../scripts/apply-mobile-series-nine-20261121.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
test('nine screenshot 1986–1994 cash, scores, matches, elims, rank and VR are immutable',()=>{
 assert.equal(V.validateProof(),true);
 const e=V.DOC.batch.entries;
 assert.deepEqual(e.map(x=>x.screenshot),[1986,1987,1988,1989,1990,1991,1992,1993,1994]);
 assert.deepEqual(e.map(x=>x.stage),['br','heat','feb','feb','jan','jan','mini','mini','mini']);
 assert.deepEqual(e.map(x=>x.rank),[22,10,9,12,4,12,8,26,34]);
 assert.deepEqual(e.map(x=>x.points),[100,78,69,50,97,46,200,100,100]);
 assert.deepEqual(e.map(x=>x.matches),[3,5,10,10,10,8,6,3,6]);
 assert.deepEqual(e.map(x=>x.kills),[5,9,11,2,4,3,13,9,15]);
 assert.deepEqual(e.map(x=>x.vrs),[1,0,0,0,0,1,2,1,1]);
 assert.deepEqual(e.map(x=>x.prize),[100,150,200,200,700,200,100,50,50]);
 assert.equal(e.reduce((sum,x)=>sum+x.prize,0),1750);
 assert.equal(e.reduce((sum,x)=>sum+x.vrs,0),6);
 assert.equal(new Set(e.map(x=>x.id)).size,9);
});
test('canonical prior player identities reused with exact Tracker Epic UUID',()=>{
 const p=read('players.json');
 const nameSet=new Set(p.candidates.map(x=>x.name));
 for(let i=0;i<V.GOLD.length;i++){
  const [shot,stage,rank,name,uid,points,games,kills,vrs,cash]=V.GOLD[i];
  const x=V.DOC.batch.entries[i],m=V.M[stage];
  const resolved=nameSet.has(name)?[name]:Object.entries(p.confirmedAliases).filter(([owner,alts])=>nameSet.has(owner)&&alts.includes(name)).map(([owner])=>owner);
  assert.equal(resolved.length,1,'unique confirmed canonical identity '+name);
  if(name==='yotta guɿäʙöɴ-ɷ-'&&!nameSet.has(name))assert.equal(resolved[0],'gurabon');
  assert.equal(x.name,name);assert.equal(x.rawName,name);assert.equal(x.epicUUID,uid);
  assert.equal(V.epicId(x.profileUrl),uid);
  assert.equal(x.id,V.idFor(stage,rank));
  assert.equal(x.windowId,m.windowId);assert.equal(x.tournamentId,m.tournamentId);
  assert.equal(x.source,'https://fortnitetracker.com/events/epicgames_'+
   m.eventId+'_'+m.region+'?window='+m.windowId);
 }
 assert.deepEqual(V.DOC.expected.newPlayers,[]);
});
test('S39 monthly Qualifier placement cash is not Group Stage advancement or a VR award',()=>{
 const e=V.DOC.batch.entries;
 const jan=e.filter(x=>x.stage==='jan'),feb=e.filter(x=>x.stage==='feb');
 assert.deepEqual(jan.map(x=>[x.rank,x.prize]),[[4,700],[12,200]]);
 assert.deepEqual(feb.map(x=>[x.rank,x.prize]),[[9,200],[12,200]]);
 for(const x of [...jan,...feb]){
  const r=V.project(x);
  assert.equal(r.prize,x.prize);
  assert.equal(r.kind,'賞金決勝');
  assert.match(r.note,/Group Stage/);
  assert.match(r.note,/Qualifier/);
  assert.equal(x.mode,'zero-build');
 }
 const c=read('tournaments.json').catalog;
 for(const x of [...jan,...feb])assert.equal(c.find(y=>y.id===x.tournamentId).series,'mobile-series');
});
test('EU 10th in Mobile Series Heat 3 receives $150 but is not a top-four advance',()=>{
 const [x]=V.DOC.batch.entries.filter(z=>z.stage==='heat');
 assert.equal(x.rank,10);assert.equal(x.prize,150);assert.equal(x.kills,9);
 assert.equal(x.vrs,0);
 assert.match(V.project(x).note,/上位4名/);
 assert.match(V.project(x).note,/未突破/);
 assert.match(x.round,/Heat 3/);
});
test('Chapter 7 Season 3 BR 1VR=$100 and Season 4 Mini Venture 1VR=$50',()=>{
 const e=V.DOC.batch.entries,br=e.find(x=>x.stage==='br');
 assert.equal(br.prize,100);assert.equal(br.vrs,1);
 assert.equal(br.mode,'battle-royale');
 for(const x of e.filter(y=>y.stage==='mini')){
  assert.equal(x.prize,x.vrs*50);
  assert.equal(x.mode,'reload-zero-build');
  assert.match(V.project(x).note,/Zero Build Reload/);
 }
 assert.deepEqual(e.filter(y=>y.stage==='mini').map(x=>x.vrs),[2,1,1]);
 const c=read('tournaments.json').catalog;
 assert.equal(c.find(x=>x.id===br.tournamentId).series,'victory-cup');
});
test('approval evidence hashes reject payout, VR, source, ID, player, stage, or round alteration',()=>{
 for(const x of V.DOC.batch.entries){
  const r=V.project(x),a=V.approval(x);
  assert.equal(V.verifyRow(r,a),true);
  for(const [key,value] of [
   ['rank',r.rank+1],['points',r.points+1],['matches',r.matches+1],
   ['kills',r.kills+1],['vrs',r.vrs+1],['prize',r.prize+1],
   ['player','wrong'],['kind','予選'],['round','Final / 予選'],
   ['source','https://example.org/wrong'],['profileUrl','https://example.org/wrong'],
   ['tournamentId','wrong']])
    assert.equal(V.verifyRow({...r,[key]:value},a),false,key+' '+r.id);
  assert.equal(V.verifyRow(r,{...a,originalHash:'wrong'}),false);
 }
});
test('publisher is dry-run, atomic, replay-safe and does not write authoritative files',()=>{
 const files=['source-results/manifest.json','source-results/S39.json',
  'source-results/S41.json','source-results/S42.json','players.json',
  'approval-history.json','updates.json'];
 const checksum=f=>{const p=path.join(ROOT,f);return fs.existsSync(p)?
  crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null};
 const before=files.map(checksum);
 const outcome=apply({dryRun:true});
 assert.equal(outcome.added+outcome.existing,9);
 assert.ok(outcome.added===0||outcome.added===9);
 assert.equal(outcome.prize,outcome.added?1750:0);
 assert.equal(outcome.vr,outcome.added?6:0);
 assert.deepEqual(files.map(checksum),before);
 const rows=readResults(ROOT).rows;
 const ids=new Set(V.DOC.batch.entries.map(x=>x.id));
 assert.ok([0,9].includes(rows.filter(x=>ids.has(x.id)).length));
 assert.equal(rows.length,new Set(rows.map(x=>x.id)).size);
});
