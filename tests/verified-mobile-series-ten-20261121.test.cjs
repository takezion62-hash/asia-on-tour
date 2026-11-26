'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),V=require('../scripts/verified-mobile-series-ten-20261121.cjs');
const {apply}=require('../scripts/apply-mobile-series-ten-20261121.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
test('owner screenshot ten-pack rank, points, kills, matches, VR, award stay exact',()=>{
 assert.equal(V.validateProof(),true);
 const a=V.DOC.batch.entries;
 assert.deepEqual(a.map(x=>x.screenshot),[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(a.map(x=>x.stage),['nacHeat','nawMini','nawMini','nawMini','nawMini','elite','nawHeat','may','may','apr']);
 assert.deepEqual(a.map(x=>x.rank),[10,14,16,17,18,10,13,10,11,6]);
 assert.deepEqual(a.map(x=>x.points),[79,100,100,100,100,100,48,100,98,134]);
 assert.deepEqual(a.map(x=>x.matches),[6,5,6,6,6,2,6,10,10,10]);
 assert.deepEqual(a.map(x=>x.kills),[16,14,16,15,14,4,7,4,3,3]);
 assert.deepEqual(a.map(x=>x.vrs),[0,1,1,1,1,1,0,0,1,0]);
 assert.deepEqual(a.map(x=>x.prize),[150,50,50,50,50,100,100,200,200,250]);
 assert.equal(a.reduce((n,x)=>n+x.prize,0),1200);
 assert.equal(a.reduce((n,x)=>n+x.vrs,0),6);
 assert.equal(new Set(a.map(x=>x.id)).size,10);
 assert.equal(new Set(a.map(x=>x.windowId+'/'+x.rank)).size,10);
});
test('only four existing canonical players; Grape original decorated tag is pre-confirmed alias',()=>{
 const p=read('players.json');
 const nameSet=new Set(p.candidates.map(x=>x.name));
 for(const name of V.DOC.expected.knownPlayers){
  const resolved=nameSet.has(name)?[name]:Object.entries(p.confirmedAliases).filter(([owner,alts])=>nameSet.has(owner)&&alts.includes(name)).map(([owner])=>owner);
  assert.equal(resolved.length,1,'unique confirmed canonical identity '+name);
  if(name==='yotta guɿäʙöɴ-ɷ-'&&!nameSet.has(name))assert.equal(resolved[0],'gurabon');
 }
 assert.deepEqual(V.DOC.expected.newPlayers,[]);
 const grape=V.DOC.batch.entries.find(x=>x.name==='Grape');
 assert.equal(grape.rawName,'שًٍَِّ今際の際שًٍَِّ');
 assert.ok(p.confirmedAliases.Grape.includes(grape.rawName));
 assert.equal(V.epicId(grape.profileUrl),'7a19efe1-b04c-47b1-9963-a30a95276437');
 for(const x of V.DOC.batch.entries){
  assert.equal(V.epicId(x.profileUrl),x.epicUUID);
  assert.equal(x.id,V.idFor(x.stage,x.rank));
  assert.equal(x.source,'https://fortnitetracker.com/events/epicgames_'+x.eventId+'_'+x.region+'?window='+x.windowId);
 }
});
test('NAC/NAW August Heats reward only rank placements, NOT a top-four qualifier spot',()=>{
 const a=V.DOC.batch.entries.filter(x=>x.stage.includes('Heat'));
 assert.deepEqual(a.map(x=>[x.region,x.rank,x.prize,x.kills,x.vrs]),[['NAC',10,150,16,0],['NAW',13,100,7,0]]);
 for(const x of a){assert.match(V.project(x).note,/上位4名/);assert.match(V.project(x).note,/突破なし/);assert.equal(x.kind,'賞金決勝');}
});
test('NAW Mobile Series pre-June paid qualifier uses placement, actual date not ID month',()=>{
 const rows=V.DOC.batch.entries.filter(x=>x.stage==='may'||x.stage==='apr');
 assert.deepEqual(rows.map(x=>[x.date,x.windowId,x.rank,x.prize]),[
  ['2026-05-04','S40_MobileSeriesCup_MarQualifier10_NAW',10,200],
  ['2026-05-04','S40_MobileSeriesCup_MarQualifier10_NAW',11,200],
  ['2026-04-06','S40_MobileSeriesCup_MarQualifier8_NAW',6,250]
 ]);
 for(const x of rows){assert.match(V.project(x).note,/Group Stage/);assert.match(V.project(x).note,/各地域1位/);assert.equal(x.mode,'zero-build');}
});
test('Mini Venture ZB Reload $50/VR and Elite Stronghold BUILD Reload $100/VR never merge',()=>{
 const a=V.DOC.batch.entries;
 const mini=a.filter(x=>x.stage==='nawMini'),elite=a.find(x=>x.stage==='elite');
 assert.equal(mini.length,4);
 for(const x of mini){assert.equal(x.prize,x.vrs*50);assert.equal(x.mode,'reload-zero-build');assert.equal(x.tournamentId,'ch7s4-mobile-reload-mini-venture-victory-cup');}
 assert.equal(elite.vrs,1);assert.equal(elite.prize,100);assert.equal(elite.mode,'reload');
 assert.match(V.project(elite).note,/建築あり/);assert.equal(elite.tournamentId,'ch7s3-mobile-reload-elite-stronghold-victory-cup');
});
test('tampering with awards, scores, UUID, source, stage or name breaks audit',()=>{
 for(const x of V.DOC.batch.entries){
  const row=V.project(x),a=V.approval(x);
  assert.equal(V.verifyRow(row,a),true);
  for(const [key,val] of [['rank',row.rank+1],['points',row.points+1],['matches',row.matches+1],['kills',row.kills+1],['vrs',row.vrs+1],['prize',row.prize+1],['kind','予選'],['tournamentId','wrong'],['player','wrong'],['source','https://example.org/no'],['profileUrl','https://example.org/no']]){
   assert.equal(V.verifyRow({...row,[key]:val},a),false,row.id+' '+key);
  }
  assert.equal(V.verifyRow(row,{...a,originalHash:'tampered'}),false);
 }
});
test('atomic publisher dry-run: ten or zero, no writes, no old-record/payout changes',()=>{
 const files=['source-results/manifest.json','source-results/S40.json','source-results/S41.json','source-results/S42.json','players.json','approval-history.json','updates.json'];
 const checksum=p=>{let f=path.join(ROOT,p);return fs.existsSync(f)?crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'):null};
 const before=files.map(checksum);
 const out=apply({dryRun:true});
 assert.equal(out.added+out.existing,10);
 assert.ok(out.added===0||out.added===10);
 assert.equal(out.prize,out.added?1200:0);
 assert.equal(out.vr,out.added?6:0);
 assert.deepEqual(files.map(checksum),before);
 const raw=readResults(ROOT).rows,ids=new Set(V.DOC.batch.entries.map(x=>x.id));
 assert.ok([0,10].includes(raw.filter(x=>ids.has(x.id)).length));
 assert.equal(raw.length,new Set(raw.map(x=>x.id)).size);
});
