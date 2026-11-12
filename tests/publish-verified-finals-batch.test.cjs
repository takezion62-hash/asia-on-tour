'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {reconcile,GROUPS}=require('../scripts/publish-verified-finals-batch.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function example(group=GROUPS[2]){
 const duo=group.members===2,names=duo?['Saku','れっどうぃんぐ']:['p1ng'];
 const row={id:'auto-s36-abcdef123456',date:group.date,region:group.region,
  player:names.join(' / '),...(duo?{players:names}:{}),
  playerRaw:names.join(' / '),event:duo?'Duos Console Victory Cash Cup':'ZB Solo Victory Cup',
  round:duo?'Event 2 · Round 2 / 賞金決勝':'Event 2 · Round 2 / 賞金決勝',
  rank:13,points:100,kills:9,vrs:1,prize:null,kind:'賞金決勝',matches:3,
  seasonId:group.season,chapter:duo?6:5,season:3,tournamentId:group.tournament,
  source:'https://www.fortnite.com/competitive/events/'+group.event+'/?region='+group.region+'&round='+group.window,
  verified:true,note:'source',reviewReason:'needs official payout'};
 return {results:[],review:{proposals:[row]},reviewed:{entries:[]},approval:{entries:[]},updates:{entries:[]},
  status:{manualReviewCandidates:1,manuallyPublished:0},
  players:{candidates:names.map(name=>({name})),confirmedAliases:{}},
  tournaments:{catalog:[{id:group.tournament,seasonId:group.season,team:duo?'duo':'solo',
   name:row.event,sourceEventIds:[group.event]}]},
  scan:{windows:{['epicgames_'+group.event+'_'+group.region+'/'+group.window]:{
   proposals:[clone(row)],nextPage:3,totalPages:3,lastSeenRank:300,complete:true,rankingOrderValid:true}}}};
}
test('verified duo 1VR awards team $200 and each player $100',()=>{
 const db=example(),before=JSON.stringify(db),r=reconcile(db);
 assert.equal(r.report.published.length,1);
 assert.equal(r.docs.results[0].prize,200);
 assert.equal(r.docs.results[0].teamPrize,200);
 assert.equal(r.docs.results[0].prizePerPlayer,100);
 assert.equal(r.docs.review.proposals.length,0);
 assert.equal(r.docs.approval.entries.length,1);
 assert.equal(JSON.stringify(db),before);
});
test('verified solo VR payout is $100 and no team allocation',()=>{
 const db=example(GROUPS[0]),r=reconcile(db);
 assert.equal(r.docs.results[0].prize,100);
 assert.equal(r.docs.results[0].prizePerPlayer,undefined);
});
test('0 VR final awards $0, and publication can be retried without duplication',()=>{
 const db=example();db.review.proposals[0].vrs=0;db.review.proposals[0].points=0;
 db.scan.windows[Object.keys(db.scan.windows)[0]].proposals[0].vrs=0;
 db.scan.windows[Object.keys(db.scan.windows)[0]].proposals[0].points=0;
 const a=reconcile(db),b=reconcile({...db,...a.docs});
 assert.equal(a.docs.results[0].prize,0);
 assert.equal(a.docs.results[0].prizePerPlayer,0);
 assert.equal(b.report.changed,false);
 assert.equal(b.docs.results.length,1);
 assert.equal(b.docs.updates.entries.length,1);
});
test('rejects missing Epic identity, changed VR, bad source, and incomplete duos final',()=>{
 for(const tamper of [
  d=>d.review.proposals[0].vrs=2,
  d=>d.review.proposals[0].source='https://evil.example/forged?round='+GROUPS[2].window,
  d=>d.players.candidates.splice(1,1),
  d=>d.scan.windows[Object.keys(d.scan.windows)[0]].complete=false,
  d=>d.scan.windows[Object.keys(d.scan.windows)[0]].rankingOrderValid=false
 ]){
  const d=example();tamper(d);
  assert.throws(()=>reconcile(d),/VERIFIED_CASH_FINAL_BATCH/);
 }
});
test('holds colliding altered score and preserves pending review',()=>{
 const d=example();
 d.results.push({...d.review.proposals[0],id:'existing-record',rank:14});
 const x=reconcile(d);
 assert.equal(x.report.held.length,1);assert.equal(x.report.published.length,0);
 assert.equal(x.docs.review.proposals.length,1);assert.equal(x.docs.results.length,1);
});
test('production checkpoint audit confirms exact pending IDs with no conflicts',()=>{
 const fs=require('node:fs'),path=require('node:path'),ROOT=path.resolve(__dirname,'..');
 const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
 const d={results:require('./production-results.cjs'),review:read('history-sync-review.json'),
  reviewed:read('history-sync-reviewed.json'),approval:read('approval-history.json'),
  updates:read('updates.json'),status:read('history-sync-status.json'),
  scan:read('history-sync-scan.json'),players:read('players.json'),tournaments:read('tournaments.json')};
 const res=reconcile(d);
 assert.ok(res.report.selected>=0&&res.report.selected<=29);
 assert.deepEqual(res.report.held,[]);
 assert.equal(res.docs.results.length,d.results.length+res.report.published.length);
 assert.equal(res.docs.review.proposals.length,d.review.proposals.length-res.report.published.length-res.report.duplicates.length);
});
