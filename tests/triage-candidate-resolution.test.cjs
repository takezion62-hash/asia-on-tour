'use strict';
// Regression guard for the 2026-11-12 source-backed 31-row publication.
// These tests inspect published data; they never run the one-time publisher.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const script=fs.readFileSync(path.join(root,'scripts/resolve-triaged-candidates-20261112.cjs'),'utf8');
const match=script.match(/const TARGET_IDS=new Set\((\[[^\n]+\])\);/);
const RULE31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const RULE30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';

test('all 31 newly reviewed historical candidates are source-backed, published or archived, and never duplicated',()=>{
 assert.ok(match,'one-time immutable target IDs retained');
 const ids=JSON.parse(match[1]);
 assert.equal(ids.length,112,'known candidate manifest should be explicit');
 assert.equal(new Set(ids).size,ids.length,'duplicate candidate IDs');
 const latest=new Set(ids.slice(-31));
 assert.equal(latest.size,31,'the newest frozen review must contain exactly 31 IDs');
 const reviewed=read('history-sync-reviewed.json');
 const entries=reviewed.entries.filter(e=>latest.has(e.id));
 assert.equal(entries.length,31,'every queued candidate must have a final disposition');
 assert.equal(new Set(entries.map(e=>e.id)).size,31);
 const counts=entries.reduce((a,e)=>(a[e.decision]=(a[e.decision]||0)+1,a),{});
 assert.equal(counts.published,21);
 assert.equal(counts['participation-archived'],10);
 assert.equal(counts['already-published']||0,0);
 const results=read('results.json'),byId=new Map(results.map(row=>[row.id,row]));
 assert.equal(byId.size,results.length,'existing result IDs must stay unique');
 const rules=read('tournament-rules.json').rules;
 const rule31=rules.find(r=>r.id==='ch5s4-solo-victory-cup');
 const rule30=rules.find(r=>r.id==='ch5s3-zb-solo-victory');
 assert.equal(rule31.advance.ME,2000);
 assert.equal(rule30.advance.ME,2000);
 let qualifiers=0,finals=0;
 for(const e of entries.filter(e=>e.decision==='published')){
  const row=byId.get(e.recordId);
  assert.ok(row,'verified result disappeared '+e.id);
  assert.equal(row.id,e.id);
  assert.equal(row.verified,true);
  assert.equal(row.source,e.source,'approved source must remain immutable');
  if(e.policy==='official-final-vr-award'){
   finals++;
   assert.equal(row.tournamentId,rule31.id);
   assert.equal(row.kind,'賞金決勝');
   assert.equal(row.vrs,1);
   assert.equal(row.points,100);
   assert.equal(row.prize,100);
   assert.ok(
    row.date==='2024-10-21'&&row.region==='OCE'||
    row.date==='2024-10-22'&&row.region==='ME',
    'only validated S31 Event8 finals can pay cash');
   assert.equal(row.source,
    'https://www.fortnite.com/competitive/events/S31_SoloVictoryCashCup/?region='+row.region+
    '&round=S31_SoloVictoryCashCup_Event8Round2_'+row.region);
   assert.equal(e.rule,RULE31);
  }else{
   qualifiers++;
   assert.equal(e.policy,'verified-rule');
   assert.equal(row.kind,'予選');
   assert.equal(row.prize,0);
   assert.match(row.round,/予選突破/);
   assert.ok(
    row.date==='2024-06-11'&&row.region==='ME'&&row.tournamentId===rule30.id||
    row.date==='2024-10-22'&&row.region==='ME'&&row.tournamentId===rule31.id,
    'only 2024 ME official qualification events are accepted');
   const rule=row.tournamentId===rule31.id?rule31:rule30;
   assert.ok(row.rank>0&&row.rank<=rule.advance[row.region]);
   assert.equal(e.rule,rule.source);
  }
 }
 assert.equal(qualifiers,16);
 assert.equal(finals,5);
 const months=new Map();
 for(const e of entries.filter(e=>e.decision==='participation-archived')){
  let found=null;
  for(const name of fs.readdirSync(path.join(root,'participation'))){
   if(!/^\d{4}-\d{2}\.json$/.test(name))continue;
   if(!months.has(name))months.set(name,read('participation/'+name));
   found=months.get(name).entries.find(x=>x.id===e.recordId);
   if(found)break;
  }
  assert.ok(found,'attendance archive missing '+e.id);
  assert.equal(found.verified,true);
  assert.equal(found.prize,null,'attendance never grants cash');
  assert.ok(['unverified','outside-cutoff'].includes(found.qualification));
 }
 for(const file of ['history-sync-review.json','auto-sync-review.json']){
  assert.ok(!read(file).proposals.some(c=>latest.has(c.id)),
   'already adjudicated ID returned to pending queue: '+file);
 }
 const recorded=read('updates.json').entries
  .filter(x=>String(x.id).startsWith('triage-verified-20261112-'))
  .flatMap(x=>x.recordIds||[]);
 assert.equal(new Set(recorded).size,recorded.length,
  'news feed must not duplicate reviewed records');
 for(const e of entries.filter(e=>e.decision==='published'))
  assert.ok(recorded.includes(e.recordId),'new reviewed result absent from publication log '+e.id);
 // latestManualReview is a moving pointer: a subsequent review (even just one
 // candidate) replaces it. The immutable 31-row ledger assertions above
 // prove the historical batch; don't mistake a newer pointer for lost data.
 const status=read('history-sync-status.json');
 const latestReview=status.latestManualReview;
 assert.ok(latestReview && Number.isSafeInteger(latestReview.reviewedCandidates));
 assert.ok(latestReview.reviewedCandidates >= 0);
 assert.ok(Number.isSafeInteger(latestReview.published) && latestReview.published >= 0);
 assert.ok(Number.isSafeInteger(latestReview.participationArchived) && latestReview.participationArchived >= 0);
 assert.ok(Number.isSafeInteger(latestReview.remainingPending) && latestReview.remainingPending >= 0);
 assert.ok(latestReview.published + latestReview.participationArchived <= latestReview.reviewedCandidates,
   'latest independent review cannot dispose more than it reviewed');
});
