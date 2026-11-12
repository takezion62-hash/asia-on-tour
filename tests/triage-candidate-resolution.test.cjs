'use strict';
// Lock the 2026-11-12 adjudication evidence to guard later background scans.
// Read-only assertions: no one-time publisher executes during test runs.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const script=fs.readFileSync(path.join(root,'scripts/resolve-triaged-candidates-20261112.cjs'),'utf8');
const match=script.match(/const TARGET_IDS=new Set\((\[[^\n]+\])\);/);
test('61 exact triage IDs remain uniquely adjudicated, without deleting original scored records',()=>{
 assert.ok(match,'safe one-time target list retained');
 const ids=JSON.parse(match[1]),set=new Set(ids);
 assert.equal(ids.length,61);
 assert.equal(set.size,61);
 const reviewed=read('history-sync-reviewed.json');
 const entries=reviewed.entries.filter(x=>set.has(x.id));
 assert.equal(entries.length,61);
 assert.equal(new Set(entries.map(x=>x.id)).size,61);
 const counts=entries.reduce((map,x)=>(map[x.decision]=(map[x.decision]||0)+1,map),{});
 assert.equal(counts.published,20);
 assert.equal(counts['participation-archived'],31);
 assert.equal(counts['already-published'],10);
 const results=read('results.json'),byResult=new Map(results.map(x=>[x.id,x]));
 const rules=read('tournament-rules.json').rules;
 const rule31=rules.find(x=>x.id==='ch5s4-solo-victory-cup');
 const rule30=rules.find(x=>x.id==='ch5s3-zb-solo-victory');
 assert.equal(rule31.advance.OCE,1500);
 assert.equal(rule31.advance.ME,2000);
 assert.equal(rule30.advance.ME,2000);
 let qualifierCount=0,cashCount=0;
 for(const e of entries.filter(x=>x.decision==='published')){
  const row=byResult.get(e.recordId);
  assert.ok(row,'missing official result '+e.id);
  if(e.policy==='official-final-vr-award'){
   cashCount++;
   assert.equal(row.date,'2024-10-08');
   assert.equal(row.region,'NAC');
   assert.equal(row.tournamentId,rule31.id);
   assert.equal(row.kind,'賞金決勝');
   assert.equal(row.points,100);
   assert.equal(row.vrs,1);
   assert.equal(row.prize,100);
   assert.match(row.source,/S31_SoloVictoryCashCup_Event6Round2_NAC$/);
   assert.equal(e.rule,rule31.source);
  }else{
   qualifierCount++;
   assert.equal(e.policy,'verified-rule');
   assert.ok(
    (row.date==='2024-10-07'&&row.region==='OCE'&&row.tournamentId===rule31.id)||
    (row.date==='2024-10-08'&&row.region==='ME'&&row.tournamentId===rule31.id)||
    (row.date==='2024-10-14'&&row.region==='OCE'&&row.tournamentId===rule31.id)||
    (row.date==='2024-06-11'&&row.region==='ME'&&row.tournamentId===rule30.id),
    'only rule-backed 2024 ME/OCE qualifiers are approved');
   assert.equal(row.kind,'予選');
   assert.match(row.round,/予選突破/);
   assert.equal(row.prize,0);
   const rule=row.tournamentId===rule31.id?rule31:rule30;
   assert.ok(row.rank<=rule.advance[row.region]);
   assert.equal(e.rule,rule.source);
  }
 }
 assert.equal(qualifierCount,18);
 assert.equal(cashCount,2);
 for(const e of entries.filter(x=>x.decision==='already-published')){
  const row=byResult.get(e.existingId);
  assert.ok(row,'existing cosmetic was incorrectly removed '+e.id);
  assert.equal(row.kind,'スキン大会');
  assert.equal(row.prize,0);
  assert.equal(row.date,'2026-10-18');
 }
 const months=new Map();
 for(const e of entries.filter(x=>x.decision==='participation-archived')){
  // Locate the archive by reading its official record, never by a guessed award.
  let row=null;
  for(const file of fs.readdirSync(path.join(root,'participation'))){
   if(!/^\d{4}-\d{2}\.json$/.test(file))continue;
   if(!months.has(file))months.set(file,read('participation/'+file));
   row=months.get(file).entries.find(x=>x.id===e.recordId);
   if(row)break;
  }
  assert.ok(row,'verified attendance disappeared '+e.id);
  assert.equal(row.prize,null,'attendance must not contribute cash');
  assert.equal(row.verified,true);
  assert.ok(['unverified','outside-cutoff'].includes(row.qualification));
 }
 for(const file of ['auto-sync-review.json','history-sync-review.json']){
  const pending=read(file).proposals;
  assert.ok(!pending.some(x=>set.has(x.id)),'resolved ID returned to pending queue: '+file);
 }
 const updates=read('updates.json').entries.filter(x=>x.id.startsWith('triage-verified-20261112-'));
 assert.equal(updates.length,3);
 const allIds=updates.flatMap(x=>x.recordIds);
 assert.equal(allIds.length,20);
 assert.equal(new Set(allIds).size,20);
 assert.deepEqual(new Set(allIds),new Set(entries.filter(x=>x.decision==='published').map(x=>x.recordId)));
});
