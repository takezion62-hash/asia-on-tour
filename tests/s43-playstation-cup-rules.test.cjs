'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const {RULES,payout,stageFor,sameSession,decide,evaluate}=require('../scripts/automatic-playstation-approval.cjs');
const {validateRegistry}=require('../scripts/validate-tournament-rules.cjs');
const {applyProposals}=require('../scripts/auto-sync-core.cjs');
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8'));
const tournaments=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const REGIONS=['OCE','ASIA','ME','EU','BR','NAC','NAW'];
const BR='S43_PlayStationCup',ZB='S43_PlayStationCup_ZB',UUID='a'.repeat(32);
const catalogFor=eventId=>tournaments.catalog.find(x=>x.sourceEventIds?.includes(eventId));
const ruleFor=eventId=>RULES[catalogFor(eventId).id];
const url=w=>'https://www.fortnite.com/competitive/events/'+w.eventId+'/?region='+w.region+'&round='+w.windowId;
function win(eventId=BR,round='Qualifier',region='OCE'){
 const t=catalogFor(eventId),base=eventId+'_'+round+'_'+region;
 const start=Date.parse('2026-11-23T07:00:00Z');
 return {key:'epicgames_'+eventId+'_'+region+'/'+base,fullEventId:'epicgames_'+eventId+'_'+region,
  eventId,windowId:base,region,seasonId:'S43',tournamentId:t.id,series:'playstation-cup',
  kind:'参加確認',round:round+' / 参加確認',dateJst:'2026-11-23',
  startUtc:new Date(start).toISOString(),end:start+(round==='Final'?160:180)*60000};
}
function row(w,rank=80,id='auto-s43-abcdef123456'){
 const t=catalogFor(w.eventId);
 return {id,seasonId:'S43',tournamentId:t.id,event:t.name,
  region:w.region,date:w.dateJst,kind:'参加確認',round:w.round,player:'A',
  teamAccountIds:[UUID],rank,points:100,kills:4,vrs:0,matches:6,
  verified:true,reviewOnly:true,prize:null,source:url(w)};
}
function database(){return {tournaments,players:{candidates:[{name:'A'}]},
 verifiedAccounts:[{player:'A',epicAccountId:UUID,confirmed:true}],results:[],updates:{entries:[]}}}
const cp=r=>({complete:true,rankingOrderValid:true,epicIdsRetained:true,
 proposals:[r],lastSeenRank:100,nextPage:2,totalPages:500});
const now=w=>w.end+6*3600000;
test('official S43 BR and Zero Build are separate PS4/PS5 solo contests',()=>{
 assert.deepEqual(validateRegistry(registry,tournaments),[]);
 assert.equal(Object.keys(RULES).length,2);
 for(const id of [BR,ZB]){
  const rule=ruleFor(id),t=catalogFor(id);
  assert.equal(rule.eventIds[0],id);
  assert.equal(t.mode,id===BR?'battle-royale':'zero-build');
  assert.equal(t.platform,'playstation');
  assert.equal(rule.autoApproval,'verified-playstation-solo');
  assert.equal(rule.sessionMinutes,180);
  assert.equal(rule.finalSessionMinutes,160);
  assert.deepEqual(rule.matchCaps,{'予選':11,'賞金決勝':6});
  assert.deepEqual(Object.keys(rule.advance).sort(),REGIONS.slice().sort());
  assert.ok(Object.values(rule.advance).every(x=>x===80));
  assert.equal(rule.cosmeticPrizes.minimumPoints,8);
  assert.match(rule.cosmeticPrizes.spray,/Froggory Stance/);
  assert.equal(stageFor(win(id))?.final,false);
  assert.equal(stageFor(win(id,'Final'))?.final,true);
  assert.equal(stageFor({...win(id),windowId:id+'_Final_OCE'}),null);
  assert.equal(stageFor({...win(id),region:'ASIA'}),null,'ASIA is not an overseas scouting region');
 }
});
test('full seven-region official payout: final ranking, not VR',()=>{
 for(const id of [BR,ZB]){
  const r=ruleFor(id);
  assert.deepEqual(Object.keys(r.cashPrizes.tiers).sort(),REGIONS.slice().sort());
  for(const region of REGIONS){
   const top=region==='EU'?4000:region==='NAC'?2500:750;
   const bottom=region==='EU'||region==='NAC'?50:25;
   assert.equal(payout(r,region,1),top,id+' '+region);
   assert.equal(payout(r,region,bottom),region==='EU'?100:50);
   assert.equal(payout(r,region,bottom+1),0);
   assert.equal(payout(r,region,0),null);
  }
  assert.equal(payout(r,'FAKE',1),null);
 }
});
test('top80 qualifier advances, rank81 is attendance only and no cash or spray-as-cash',()=>{
 for(const eventId of [BR,ZB]){
  const w=win(eventId),db=database();
  const inside=row(w,80),outside=row(w,81,'auto-s43-abcdef123457');
  for(const [r,qualified] of [[inside,true],[outside,false]]){
   const result=decide(r,w,cp(r),db,now(w));
   assert.equal(result.approved,true,result.reason);
   assert.equal(result.record.prize,0);
   assert.equal(result.participation,!qualified);
   assert.equal(result.record.kind,qualified?'予選':'参加確認');
   assert.match(result.record.note,/スプレー/);
   assert.equal(result.record.reviewOnly,undefined);
  }
  const result=evaluate([outside],[w],{[w.key]:cp(outside)},db);
  assert.deepEqual(result.participationIds,[outside.id]);
  assert.equal(applyProposals(db,result.approved,new Date(now(w)).toISOString(),
   {verifiedParticipationIds:new Set(result.participationIds)}),1);
 }
});
test('finals honor regional rank payouts even at 0VR; BR cannot become ZB',()=>{
 for(const eventId of [BR,ZB]){
  for(const region of ['OCE','EU','NAC']){
   const w=win(eventId,'Final',region),r=row(w,1);
   const out=decide(r,w,cp(r),database(),now(w));
   assert.equal(out.approved,true,out.reason);
   assert.equal(out.record.prize,region==='EU'?4000:region==='NAC'?2500:750);
   assert.equal(out.record.kind,'賞金決勝');
   assert.equal(out.record.vrs,0);
   assert.ok(!out.record.note.includes('VR1回あたり'));
   assert.equal(decide({...r,rank:55},w,cp({...r,rank:55}),database(),now(w)).record?.prize,0);
  }
 }
 const w=win(BR,'Final','OCE'),r=row(w,1),wrong=win(ZB,'Final','OCE');
 assert.equal(decide(r,wrong,cp(r),database(),now(wrong)).approved,false);
});
test('fail closed on immature/partial scoreboard, unverified player, forged source, invalid match cap, duplicate',()=>{
 const w=win(BR),r=row(w),d=database(),good=cp(r),m=x=>decide(x,w,cp(x),d,now(w));
 assert.equal(decide(r,w,{...good,complete:false},d,now(w)).approved,false);
 assert.equal(decide(r,w,{...good,epicIdsRetained:false},d,now(w)).approved,false);
 assert.equal(decide(r,w,good,d,w.end+60).approved,false);
 assert.equal(decide(r,w,good,{...d,verifiedAccounts:[]},now(w)).approved,false);
 assert.equal(m({...r,teamAccountIds:['b'.repeat(32)]}).approved,false);
 assert.equal(m({...r,source:url(w).replace('region=OCE','region=ME')}).approved,false);
 assert.equal(m({...r,matches:12}).approved,false);
 assert.equal(m({...r,reviewOnly:false}).approved,false);
 assert.equal(m({...r,rank:0}).approved,false);
 assert.equal(decide(r,w,good,{...d,results:[{...r}]},now(w)).approved,false);
 assert.equal(sameSession({...r}, {...r,source:url(w).replace('_Qualifier_','_Final_')}),false);
});
test('official payout, top80, event ID, mode, spray and caps are immutable under rules validation',()=>{
 for(const id of [BR,ZB]){
  const t=catalogFor(id);
  for(const edit of [
   x=>{x.advance.OCE=100},
   x=>{x.matchCaps['賞金決勝']=3},
   x=>{x.cashPrizes.tiers.EU[0].perPlayer=3500},
   x=>{x.cashPrizes.tiers.ASIA.pop()},
   x=>{x.autoApproval='review-only'},
   x=>{x.eventIds=['S43_FAKE']},
   x=>{x.cosmeticPrizes.minimumPoints=5},
   x=>{x.mode=t.mode==='zero-build'?'battle-royale':'zero-build'}
  ]){
   const doc=clone(registry);
   edit(doc.rules.find(x=>x.id===t.id));
   assert.ok(validateRegistry(doc,tournaments).length>0,t.id+' mutation must fail');
  }
 }
});
