'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const registry=require('../tournament-rules.json'),tournaments=require('../tournaments.json');
const {validateRegistry}=require('../scripts/validate-tournament-rules.cjs');
const {cutoffForWindow,decide}=require('../scripts/automatic-cosmetic-approval.cjs');
const {discover}=require('../scripts/osirion-sync.cjs');
const variants=[
 ['cup-battle-royale','S43_ScottPilgrimCup','duo',11,{OCE:50,ME:50,EU:500,BR:100,NAC:350,NAW:100}],
 ['cup-zero-build','S43_ScottPilgrimCup_ZB','duo',11,{OCE:50,ME:50,EU:500,BR:100,NAC:350,NAW:100}],
 ['mobile-cup','S43_ScottPilgrimCup_Mobile','solo',8,{OCE:30,ME:30,EU:200,BR:30,NAC:150,NAW:30}]
];
function fixture(variant,region='EU'){
 const [suffix,eventId,team,matches,ranks]=variant;
 const id='ch7s5-scott-pilgrim-'+suffix,cat=tournaments.catalog.find(x=>x.id===id);
 const windowId=eventId+'_'+region,dateJst='2026-11-25';
 const now=Date.now(),end=now-8*3600000;
 const win={key:'epicgames_'+eventId+'_'+region+'/'+windowId,eventId,windowId,tournamentId:id,seasonId:'S43',series:'skin-cup',kind:'参加確認',round:'単一開催枠 / 参加確認',region,dateJst,end};
 const names=team==='solo'?['A']:['A','B'],ids=names.map((_,i)=>(i?'b':'a').repeat(32));
 const candidateId='auto-s43-'+crypto.createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,ids])).digest('hex').slice(0,12);
 const row={id:candidateId,date:dateJst,region,player:names.join(' / '),players:names,teamAccountIds:ids,seasonId:'S43',chapter:7,season:5,tournamentId:id,event:cat.name,kind:win.kind,round:win.round,rank:ranks[region],points:200,kills:5,vrs:1,matches,prize:null,verified:true,reviewOnly:true,
  source:'https://www.fortnite.com/competitive/events/'+eventId+'/?region='+region+'&round='+windowId};
 const cp={complete:true,rankingOrderValid:true,pages:6,nextPage:6,totalPages:20,lastSeenRank:ranks[region]+1,lastSuccessAt:new Date(now-3600000).toISOString(),proposals:[row]};
 const data={results:[],players:{candidates:names.map(name=>({name}))},verifiedAccounts:names.map((player,i)=>({player,epicAccountId:ids[i],confirmed:true})),tournaments};
 return {id,cat,row,win,cp,data};
}
test('Scott Pilgrim three distinct official rule entries and six overseas cutoffs',()=>{
 assert.deepEqual(validateRegistry(registry,tournaments),[]);
 for(const v of variants){
  const [suffix,eventId,team,matches,ranks]=v;
  const rule=registry.rules.find(r=>r.id==='ch7s5-scott-pilgrim-'+suffix);
  assert.deepEqual(rule.eventIds,[eventId]);assert.deepEqual(rule.cosmeticRanks,ranks);
  assert.equal(rule.team,team);assert.equal(rule.matchCaps['スキン大会'],matches);
  assert.equal(rule.cosmeticPrizes.minimumPoints,team==='solo'?5:8);
  assert.equal(rule.cosmeticPrizes.emoticon,'Scott! Emoticon');
  assert.equal(rule.autoApproval,'verified-team-rank');
  for(const region of Object.keys(ranks)){
   const {row,win,cp,data}=fixture(v,region);
   assert.equal(cutoffForWindow(win),ranks[region]);
   const result=decide(row,win,cp,data);assert.equal(result.approved,true,result.reason);
   assert.equal(result.record.kind,'スキン大会');assert.equal(result.record.prize,0);
   const beyond={...row,rank:ranks[region]+1};
   assert.equal(decide(beyond,win,{...cp,proposals:[beyond]},data).approved,false);
  }
 }
});
test('Scott Pilgrim automatic publication fails closed on swapped event, scan, account, match count, duplicate and rank boundary',()=>{
 for(const v of variants){
  const {row,win,cp,data}=fixture(v);
  assert.equal(decide(row,{...win,eventId:'S43_ScottPilgrimCup_UNKNOWN'},cp,data).approved,false);
  assert.equal(decide(row,win,{...cp,lastSeenRank:row.rank-1},data).approved,false);
  assert.equal(decide(row,win,{...cp,rankingOrderValid:false},data).approved,false);
  assert.equal(decide(row,win,{...cp,proposals:[row,row]},data).approved,false);
  assert.equal(decide(row,win,cp,{...data,verifiedAccounts:[]}).approved,false);
  const excess={...row,matches:row.matches+1};assert.equal(decide(excess,win,{...cp,proposals:[excess]},data).approved,false);
  assert.equal(decide(row,win,cp,{...data,results:[row]}).approved,false);
 }
});
test('both existing sync configurations enable Scott Pilgrim discovery and cosmetic approval',()=>{
 for(const file of ['auto-sync-config.json','history-sync-config.json']){
  const cfg=require('../'+file);assert.equal(cfg.autoApproveCosmetic,true);assert.ok(cfg.reviewSeries.includes('skin-cup'));
  const now=Date.now(),all=variants.map(v=>({eventId:'epicgames_'+v[1]+'_EU',eventWindows:[{eventWindowId:v[1]+'_EU',beginTime:new Date(now-12*3600000).toISOString(),endTime:new Date(now-8*3600000).toISOString()}]}));
  const wins=discover(all,tournaments.catalog,{...cfg,fromDate:undefined,toDate:undefined,lookbackDays:7,regions:['EU']},now);
  assert.equal(wins.length,3);
  assert.equal(new Set(wins.map(w=>w.tournamentId)).size,3);
 }
});
test('validator rejects swapped rewards, incorrect points and cash',()=>{
 for(const v of variants){
  const id='ch7s5-scott-pilgrim-'+v[0];
  for(const change of [r=>r.cosmeticRanks.EU++,r=>r.cosmeticPrizes.minimumPoints++,r=>r.cashPrizes={currency:'USD'},r=>r.sessionMinutes++]){
   const copy=JSON.parse(JSON.stringify(registry));change(copy.rules.find(r=>r.id===id));
   assert.ok(validateRegistry(copy,tournaments).some(e=>String(e).includes('Scott Pilgrim')));
  }
 }
});
