'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcile,W}=require('../scripts/publish-verified-qualifier-batch.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const spec=W[0];
 const row={id:'auto-s30-012345abcdef',date:spec.date,region:spec.region,player:'TakoBeL',
  playerRaw:'LYNX TakoBeL',event:'Solo Victory Cup Battle Royale',
  round:'Event 1 · Round 1 / 予選',rank:288,points:134,kills:17,vrs:0,prize:0,
  kind:'予選',matches:7,seasonId:'S30',chapter:5,season:3,tournamentId:spec.tournament,
  source:'https://www.fortnite.com/competitive/events/'+spec.event+'/?region='+spec.region+'&round='+spec.window,
  verified:true,note:'source verified',reviewReason:'incomplete leaderboard'};
 return {results:[],review:{proposals:[row]},reviewed:{entries:[]},approval:{entries:[]},
  updates:{entries:[]},status:{found:1,manuallyPublished:0},
  scan:{windows:{['epicgames_'+spec.event+'_'+spec.region+'/'+spec.window]:{
   nextPage:4,totalPages:100,complete:false,lastSeenRank:400,rankingOrderValid:true,
   proposals:[clone(row)]}}},
  players:{candidates:[{name:'TakoBeL'}],confirmedAliases:{}},
  tournaments:{catalog:[{id:spec.tournament,name:row.event,seasonId:'S30',team:'solo',sourceEventIds:[spec.event]}]}};
}
test('saved ranked page within official cutoff is published as ordinary qualifier with $0',()=>{
 const db=fixture(),before=JSON.stringify(db),out=reconcile(db);
 assert.equal(out.report.published.length,1);
 assert.equal(out.report.published[0].rank,288);
 assert.equal(out.docs.results.length,1);
 assert.equal(out.docs.results[0].round,'Event 1 · Round 1 / 予選突破');
 assert.equal(out.docs.results[0].kind,'予選');
 assert.equal(out.docs.results[0].prize,0);
 assert.equal(out.docs.review.proposals.length,0);
 assert.equal(out.docs.approval.entries[0].decision,'published');
 assert.equal(out.docs.updates.entries[0].recordIds[0],'auto-s30-012345abcdef');
 assert.equal(JSON.stringify(db),before,'reconcile is pure');
});
test('no repeat publication or duplicate update after first application',()=>{
 const db=fixture(),first=reconcile(db),second=reconcile({...db,...first.docs});
 assert.equal(second.report.changed,false);
 assert.equal(second.docs.results.length,1);
 assert.equal(second.docs.updates.entries.length,1);
});
test('rejects altered scores, ranks, unsigned source, incomplete page and unknown identity',()=>{
 for(const bad of [
  d=>d.review.proposals[0].rank=289,
  d=>d.scan.windows[Object.keys(d.scan.windows)[0]].rankingOrderValid=false,
  d=>d.scan.windows[Object.keys(d.scan.windows)[0]].lastSeenRank=200,
  d=>d.players.candidates=[],
  d=>d.review.proposals[0].prize=100,
 ]){
  const db=fixture();bad(db);assert.throws(()=>reconcile(db),/VERIFIED_QUALIFIER_BATCH/);
 }
});
test('out-of-cutoff ranking is safely held for review, not treated as a malformed or winning score',()=>{
 const db=fixture(),row=db.review.proposals[0],id=row.id;
 row.rank=2001;
 const checkpoint=db.scan.windows[Object.keys(db.scan.windows)[0]];
 checkpoint.proposals[0].rank=2001;
 const out=reconcile(db);
 assert.equal(out.report.selected,0);
 assert.equal(out.report.published.length,0);
 assert.equal(out.docs.review.proposals.length,1);
 assert.equal(out.docs.review.proposals[0].id,id);
 assert.equal(out.docs.results.length,0);
});
test('forged source is kept pending and never published',()=>{
 const db=fixture();db.review.proposals[0].source='https://evil.example/forged';
 const o=reconcile(db);assert.equal(o.report.published.length,0);
 assert.equal(o.docs.review.proposals.length,1);
});
test('holds conflicting original result instead of rewriting it',()=>{
 const db=fixture();
 db.results.push({...db.review.proposals[0],id:'manual-existing',rank:289,round:'Event 1 · Round 1 / 予選突破'});
 const x=reconcile(db);
 assert.equal(x.report.published.length,0);
 assert.equal(x.report.held.length,1);
 assert.equal(x.docs.review.proposals.length,1);
 assert.equal(x.docs.results.length,1);
});
test('keeps unrelated historical pending candidates intact',()=>{
 const db=fixture(),extra={id:'auto-s42-a1b2c3d4e5f6',region:'EU',rank:3};
 db.review.proposals.push(extra);
 const out=reconcile(db);
 assert.deepEqual(out.docs.review.proposals,[extra]);
});

test('production saved candidate IDs and official scoreboard checkpoints pass dry-run before merge',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
 const real={results:read('results.json'),review:read('history-sync-review.json'),
  reviewed:read('history-sync-reviewed.json'),approval:read('approval-history.json'),
  updates:read('updates.json'),status:read('history-sync-status.json'),
  scan:read('history-sync-scan.json'),players:read('players.json'),tournaments:read('tournaments.json')};
 const out=reconcile(real);
 assert.ok(out.report.selected>=0&&out.report.selected<=72,'expected 33 new plus up to 39 earlier exact qualifiers, or zero if published');
 assert.deepEqual(out.report.held,[],'conflicting qualification must remain blocked');
 assert.equal(out.report.published.length+out.report.duplicates.length,out.report.selected);
 assert.equal(out.docs.results.length,real.results.length+out.report.published.length);
 assert.equal(out.docs.review.proposals.length,real.review.proposals.length-out.report.selected);
});

test('S30 NAC 2024 API region uses NA top-5000 official cutoff',()=>{
 const specs=W.filter(x=>x.region==='NAC'&&x.season==='S30');
 assert.equal(specs.length,2);
 assert.ok(specs.every(x=>x.cutoff===5000&&x.rules.includes('chapter-5-season-3-official-rules')));
});

test('2024-06-11 ME ZB candidate cohort is published once or remains queued, never guessed cash',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const get=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const results=get('results.json'),pending=get('history-sync-review.json').proposals;
 const ledger=get('approval-history.json').entries;
 const spec=W.find(x=>x.date==='2024-06-11'&&x.region==='ME'&&x.event==='S30_SoloZBVictoryCashCup');
 assert.ok(spec,'source-verified 2024 ZB event must remain in explicit whitelist');
 assert.equal(spec.cutoff,2000);
 const ids=[
 ['auto-s30-c3e6b3460a14',205],['auto-s30-28542af5c346',218],
 ['auto-s30-b35b33031fb4',234],['auto-s30-823056acb155',238],
 ['auto-s30-97f47640f696',254],['auto-s30-a516c81689ae',269],
 ['auto-s30-434c55eb25e7',306],['auto-s30-09eba57dd245',307],
 ['auto-s30-d0777e90bffc',331],['auto-s30-1971724d0c73',342],
 ['auto-s30-e20d994cd1df',343],['auto-s30-f073601c26f7',362],
 ['auto-s30-300dcb3a3b9a',384],['auto-s30-20a216186635',396],
 ['auto-s30-08225b0b4e81',407],['auto-s30-6fdd6e9d7117',435],
 ['auto-s30-0e83b59221ba',465],['auto-s30-c158dd34bf7d',474]
 ];
 const expected='https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event2Round1_ME';
 for(const [id,rank] of ids){
  const published=results.filter(x=>x.id===id),waiting=pending.filter(x=>x.id===id);
  assert.equal(published.length+waiting.length,1,'2024 verified result lost or duplicated: '+id);
  const row=published[0]||waiting[0];
  assert.equal(row.rank,rank);
  assert.equal(row.event,'ZB Solo Victory Cup');
  assert.equal(row.source,expected);
  assert.equal(row.verified,true);
  assert.equal(row.kind,'予選');
  assert.equal(row.prize,0);
  assert.ok(row.kills>=0&&row.vrs>=0&&row.matches>0);
  if(published.length){
   assert.match(row.round,/\/ 予選突破$/);
   assert.ok(ledger.some(x=>x.id===id&&x.decision==='published'&&x.policy==='verified-rule'),
    'published Epic account must retain approval history: '+id);
  }
 }
});

test('2024-07-30 ME ZB event7 and 2024-08-06 event8 cohorts remain pending or source-verified published',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const get=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const results=get('results.json'),pending=get('history-sync-review.json').proposals;
 const approvals=get('approval-history.json').entries;
 const groups=[
  {date:'2024-07-30',event:'Event7Round1',rows:[
   ['auto-s30-5a39e0df5e77',28],['auto-s30-7c2853bff732',34],
   ['auto-s30-a10e83679675',40],['auto-s30-56dcc55ccb2a',158],
   ['auto-s30-9ebb39b49e01',162]]},
  {date:'2024-08-06',event:'Event8Round1',rows:[
   ['auto-s30-14be63fe4632',22],['auto-s30-d7919b6b8e05',117],
   ['auto-s30-d336d683438d',145]]}
 ];
 for(const group of groups){
  const spec=W.find(x=>x.date===group.date&&x.region==='ME'&&x.event==='S30_SoloZBVictoryCashCup'&&x.window.includes(group.event));
  assert.ok(spec,'official S30 ZB event must stay explicitly allowed: '+group.event);
  assert.equal(spec.cutoff,2000);
  const original='https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round='+spec.window;
  for(const [id,rank] of group.rows){
   const published=results.filter(x=>x.id===id),waiting=pending.filter(x=>x.id===id);
   assert.equal(published.length+waiting.length,1,'historical result lost or duplicated: '+id);
   const row=published[0]||waiting[0];
   assert.equal(row.rank,rank);
   assert.equal(row.source,original);
   assert.equal(row.event,'ZB Solo Victory Cup');
   assert.equal(row.kind,'予選');
   assert.equal(row.verified,true);
   assert.equal(row.prize,0);
   if(published.length){
    assert.match(row.round,/\/ 予選突破$/);
    assert.ok(approvals.some(a=>a.id===id&&a.decision==='published'&&a.policy==='verified-rule'),
     'publication approval lost: '+id);
   }
  }
 }
});

test('2024-08-13 ME BR and ZB event9 cohorts remain verified and cannot be published twice',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const results=load('results.json'),pending=load('history-sync-review.json').proposals,
  ledger=load('approval-history.json').entries,updates=load('updates.json').entries;
 const cohorts=[
  {event:'S30_SoloVictoryCashCup',tournament:'ch5s3-solo-victory-cup',
   label:'Solo Victory Cup Battle Royale',rows:[
   ['auto-s30-95d92d1688e1',6],['auto-s30-9229fd929d93',8],
   ['auto-s30-1c030eb3de1f',13],['auto-s30-6752e326acea',26],
   ['auto-s30-6b70ccceacf7',60],['auto-s30-f6d8848a4938',107],
   ['auto-s30-75bfcdee3391',127],['auto-s30-2a87fd7c7799',131],
   ['auto-s30-d37b6eac87ac',142],['auto-s30-a95fa7406297',145],
   ['auto-s30-210ef010ceae',166],['auto-s30-0dd8be4e33cd',170],
   ['auto-s30-8088fbefa12e',171],['auto-s30-db95b2fa7627',176],
   ['auto-s30-cfe9390bd6e1',198]]},
  {event:'S30_SoloZBVictoryCashCup',tournament:'ch5s3-zb-solo-victory',
   label:'ZB Solo Victory Cup',rows:[
   ['auto-s30-4daf3eef65e1',25],['auto-s30-30232ee3d4f4',50],
   ['auto-s30-14f7e45dc096',71],['auto-s30-4c00e0a7c510',92],
   ['auto-s30-731199bc3038',109],['auto-s30-ccc847d6beda',113],
   ['auto-s30-982640d34bc6',138],['auto-s30-5631deb13cc7',169]]}
 ];
 assert.equal(cohorts.reduce((sum,x)=>sum+x.rows.length,0),23);
 for(const group of cohorts){
  const spec=W.find(x=>x.date==='2024-08-13'&&x.region==='ME'&&x.event===group.event);
  assert.ok(spec,'specific event9 session should remain whitelisted');
  assert.equal(spec.tournament,group.tournament);
  assert.equal(spec.cutoff,2000);
  assert.equal(spec.rules,'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules');
  const source='https://www.fortnite.com/competitive/events/'+spec.event+'/?region=ME&round='+spec.window;
  for(const [id,rank] of group.rows){
   const shown=results.filter(x=>x.id===id),waiting=pending.filter(x=>x.id===id);
   // This protects raw identifiers across later rescans, including when a
   // source remains unavailable. The publisher itself checks original
   // scan checkpoint and record collision before moving anything.
   assert.equal(shown.length+waiting.length,1,'published once or still waiting: '+id);
   const row=shown[0]||waiting[0];
   assert.equal(row.source,source);
   assert.equal(row.rank,rank);
   assert.equal(row.event,group.label);
   assert.equal(row.verified,true);
   assert.equal(row.kind,'予選');
   assert.equal(row.prize,0);
   assert.ok(row.kills>=0&&row.vrs>=0&&row.matches>0);
   if(shown.length){
    assert.match(row.round,/\/ 予選突破$/);
    assert.ok(ledger.some(x=>x.id===id&&x.recordId===id&&x.decision==='published'&&x.policy==='verified-rule'));
    assert.ok(updates.some(x=>Array.isArray(x.recordIds)&&x.recordIds.includes(id)),
     'every published row should be traceable to an update');
   }
  }
 }
});
