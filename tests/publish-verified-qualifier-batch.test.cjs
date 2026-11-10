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
  d=>d.review.proposals[0].rank=2001,
  d=>d.review.proposals[0].source='https://evil.example/forged',
  d=>d.scan.windows[Object.keys(d.scan.windows)[0]].rankingOrderValid=false,
  d=>d.scan.windows[Object.keys(d.scan.windows)[0]].lastSeenRank=200,
  d=>d.players.candidates=[],
  d=>d.review.proposals[0].prize=100,
 ]){
  const db=fixture();bad(db);assert.throws(()=>reconcile(db),/VERIFIED_QUALIFIER_BATCH/);
 }
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
