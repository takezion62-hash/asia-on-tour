'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-s37-naw-ps-zero-console-three-20261120.cjs');
const {apply}=require('../scripts/apply-s37-naw-ps-zero-console-three-20261120.cjs');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
test('screenshots 1950–1959 match ten exact NAW final scores and zero/VR rewards',()=>{
 assert.equal(V.validateProof(),true);
 const all=V.DOC.batch.entries;
 assert.equal(all.length,10);
 assert.deepEqual(all.map(x=>x.rank),[48,67,68,74,81,84,96,4,8,9]);
 assert.deepEqual(all.map(x=>x.points),[92,56,56,41,22,15,0,100,100,100]);
 assert.deepEqual(all.map(x=>x.matches),[6,4,6,6,6,5,6,3,3,3]);
 assert.deepEqual(all.map(x=>x.kills),[1,4,3,4,0,2,0,7,6,5]);
 assert.deepEqual(all.map(x=>x.vrs),[0,0,0,0,0,0,0,1,1,1]);
 assert.deepEqual(all.map(x=>x.prize),[0,0,0,0,0,0,0,200,200,200]);
 assert.deepEqual(all.map(x=>x.screenshot),[1950,1951,1952,1953,1954,1955,1956,1957,1958,1959]);
 assert.equal(all.reduce((n,x)=>n+x.prize,0),600);
});
test('PlayStation cash final participation is preserved despite rank 41+ zero winnings',()=>{
 for(const x of V.DOC.batch.entries.slice(0,7)){
  const row=V.project(x);
  assert.equal(row.kind,'賞金決勝');
  assert.equal(row.prize,0);
  assert.equal(row.prizePerPlayer,0);
  assert.equal(row.vrs,0);
  assert.equal(row.teamPrize,0);
  assert.equal(row.round,'Final / 賞金決勝');
  assert.equal(row.region,'NAW');
  assert.equal(row.event,'PlayStation Cup');
  assert.match(row.note,/決勝出場は確認/);
  assert.equal(row.players.length,1);
  assert.equal(row.profileUrl,x.profileUrls[0]);
  assert.ok(x.rank>40);
 }
});
test('three console teams get team $200 and player $100 for one Victory Royale each',()=>{
 for(const x of V.DOC.batch.entries.slice(7)){
  const r=V.project(x);
  assert.equal(r.players.length,2);
  assert.equal(r.prize,200);
  assert.equal(r.teamPrize,200);
  assert.equal(r.prizePerPlayer,100);
  assert.equal(r.vrs,1);
  assert.equal(r.matches,3);
  assert.equal(r.round,'Event 2 · Round 2 / 賞金決勝');
  assert.equal(r.tournamentId,'ch6s4-console-duos-victory');
  assert.equal(r.source,x.source);
 }
});
test('NAW Shipski partner remains identified only by leaderboard (no invented Epic ID)',()=>{
 const row=V.project(V.DOC.batch.entries[8]), p=read('players.json');
 assert.deepEqual(row.players,['Shipski','モバイル勢のまかろん']);
 assert.deepEqual(row.externalTeammates,['Shipski']);
 assert.deepEqual(row.profiles.map(x=>x.name),['モバイル勢のまかろん']);
 assert.equal(V.DOC.batch.entries[8].profileUrls[0],null);
 assert.ok(!p.candidates.some(x=>x.name==='Shipski'));
 assert.match(row.note,/Shipskiはユーザー確認のNAW相方/);
});
test('all supplied original UUIDs, canonical aliases and profile provenance remain correct',()=>{
 for(let i=0;i<V.EXPECTED.length;i++){
  const tuple=V.EXPECTED[i],x=V.DOC.batch.entries[i];
  assert.deepEqual(x.profileUrls.map(V.epicId),tuple[4]);
  assert.deepEqual(x.playerNames,tuple[2]);
  assert.deepEqual(x.rawNames,tuple[3]);
  assert.equal(x.rule,i<7?V.PS_RULE:V.DUOS_RULE);
 }
 const p=read('players.json');
 assert.ok(p.confirmedAliases['えありー'].includes('Airy'));
 assert.ok(p.confirmedAliases['ちゃる'].includes('charufn'));
 assert.ok(p.confirmedAliases.kuro.includes('dyd チー牛ウン子漏らし'));
 // The longer DYD raw ID was given with a *different* Epic UUID as ちゃんおに.
 // Matching a partial nickname must not silently merge with the existing kuro.
 const e=V.DOC.batch.entries[3];
 assert.equal(e.playerNames[0],'ちゃんおに');
 assert.equal(e.rawNames[0],'DYD チー牛ウン子漏らし滅ǃǃ');
 assert.equal(V.epicId(e.profileUrls[0]),'b57bfd8c-3233-4276-afef-571eaf768f1a');
});
test('approval snapshots reject any modification to payouts, ranks, team, Epic URLs or round',()=>{
 for(const x of V.DOC.batch.entries){
  const r=V.project(x),a=V.approval(x);
  assert.equal(V.verifyRow(r,a),true);
  for(const [field,value] of [['rank',x.rank+1],['prize',x.prize+100],
   ['prizePerPlayer',200],['teamPrize',x.teamPrize===0?100:0],['vrs',x.vrs+1],
   ['kills',x.kills+1],['matches',x.matches+1],['points',x.points+1],
   ['players',['偽名']],['profiles',[]],['kind','参加確認'],['round','Round 1'],
   ['source','https://example.com']]){
    assert.equal(V.verifyRow({...r,[field]:value},a),false,x.id+' '+field);
  }
  assert.equal(V.verifyRow(r,{...a,recordHash:'fake'}),false);
 }
});
test('publisher is dry-run replay safe and never mutates existing season, rankings or identity files',()=>{
 const originals=['source-results/manifest.json','source-results/S37.json',
   'players.json','approval-history.json','updates.json'];
 const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
 const before=originals.map(sha);
 const run=apply({dryRun:true});
 assert.equal(run.added+run.alreadyPresent,10);
 assert.ok(run.added===10||run.added===0);
 assert.equal(run.prize,run.added?600:0);
 assert.equal(run.VRs,run.added?3:0);
 assert.deepEqual(run.newPlayers,run.added?['ちゃんおに',
  '躯中の細胞に火を熾すように','あぶやちぇ','Rio_ando09','開業ニキわら']:[]);
 assert.deepEqual(run.newAliases,run.added?[{name:'ちゃんおに',raw:'DYD チー牛ウン子漏らし滅ǃǃ'}]:[]);
 assert.deepEqual(originals.map(sha),before);
 const rows=readResults(ROOT).rows,ids=new Set(V.DOC.batch.entries.map(x=>x.id));
 const present=rows.filter(x=>ids.has(x.id));
 assert.ok(present.length===0||present.length===10);
});
