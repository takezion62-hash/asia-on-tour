'use strict';
// Lock the 2026-11-12 adjudication evidence to guard later background scans.
// Read-only assertions: no one-time publisher executes during test runs.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const script=fs.readFileSync(path.join(root,'scripts/resolve-triaged-candidates-20261112.cjs'),'utf8');
const match=script.match(/const TARGET_IDS=new Set\((\[[^\n]+\])\);/);
test('40 exact triage IDs remain uniquely adjudicated, without deleting original scored records',()=>{
 assert.ok(match,'safe one-time target list retained');
 const ids=JSON.parse(match[1]),set=new Set(ids);
 assert.equal(ids.length,40);
 assert.equal(set.size,40);
 const reviewed=read('history-sync-reviewed.json');
 const entries=reviewed.entries.filter(x=>set.has(x.id));
 assert.equal(entries.length,40);
 assert.equal(new Set(entries.map(x=>x.id)).size,40);
 const counts=entries.reduce((map,x)=>(map[x.decision]=(map[x.decision]||0)+1,map),{});
 assert.equal(counts.published,3);
 assert.equal(counts['participation-archived'],27);
 assert.equal(counts['already-published'],10);
 const results=read('results.json'),byResult=new Map(results.map(x=>[x.id,x]));
 const rules=read('tournament-rules.json').rules;
 const rule=rules.find(x=>x.id==='ch5s4-solo-victory-cup');
 assert.equal(rule.advance.OCE,1500);
 for(const e of entries.filter(x=>x.decision==='published')){
  const row=byResult.get(e.recordId);
  assert.ok(row,'missing official qualifier '+e.id);
  assert.equal(row.date,'2024-10-07');
  assert.equal(row.region,'OCE');
  assert.equal(row.kind,'予選');
  assert.match(row.round,/予選突破/);
  assert.equal(row.prize,0);
  assert.ok(row.rank<=1500);
  assert.equal(e.rule,rule.source);
  assert.equal(e.policy,'verified-rule');
 }
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
 const update=read('updates.json').entries.find(x=>x.id==='triage-verified-20261112-cc3776675740');
 assert.ok(update&&update.recordIds.length===3);
 assert.deepEqual(new Set(update.recordIds),new Set(entries.filter(x=>x.decision==='published').map(x=>x.recordId)));
});
