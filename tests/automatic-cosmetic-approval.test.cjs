'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cutoffForWindow,decide,evaluate}=require('../scripts/automatic-cosmetic-approval.cjs');
const {applyProposals}=require('../scripts/auto-sync-core.cjs');
const url='https://www.fortnite.com/competitive/events/';
const tournamentId='ch7s5-one-piece-zoro-cup-battle-royale';
const eventId='S43_OnePieceZoroCup';
const w={key:'epicgames_'+eventId+'_ME/'+eventId+'_ME',eventId,windowId:eventId+'_ME',
 dateJst:'2026-11-06',region:'ME',seasonId:'S43',tournamentId,series:'skin-cup',
 kind:'参加確認',round:'単一開催枠 / 参加確認'};
const source=win=>url+win.eventId+'/?region='+win.region+'&round='+win.windowId;
const row={id:'auto-s43-111111111111',date:w.dateJst,region:'ME',player:'A / B',players:['A','B'],
 tournamentId,seasonId:'S43',chapter:7,season:5,event:'One Piece: Zoro Cup Battle Royale',
 round:w.round,kind:'参加確認',rank:50,points:325,kills:14,vrs:1,matches:11,prize:null,
 verified:true,reviewOnly:true,reviewReason:'順位未検証',source:source(w)};
const data=()=>({players:{candidates:[{name:'A'},{name:'B'}]},tournaments:{catalog:[{
 id:tournamentId,seasonId:'S43',series:'skin-cup',team:'duo',
 name:row.event,sourceEventIds:[eventId]}]},results:[],updates:{entries:[]}});
const cp=(item=row,complete=true)=>({complete,proposals:[item]});

test('official One Piece Zoro BR ranks can publish cosmetic records without manual approval',()=>{
 assert.equal(cutoffForWindow(w),50);
 const outcome=decide(row,w,cp(),data());
 assert.equal(outcome.approved,true);
 assert.equal(outcome.record.rank,50);
 assert.equal(outcome.record.kind,'スキン大会');
 assert.equal(outcome.record.prize,0);
 assert.equal(outcome.record.reviewOnly,undefined);
 assert.match(outcome.record.note,/Epic公式規則/);
 const db=data();
 assert.equal(applyProposals(db,[outcome.record],'2026-11-07T01:00:00Z'),1);
 assert.equal(db.results.length,1);
});

test('rank beyond cutoff, incomplete scan, wrong window, bad identity and cap must be held',()=>{
 assert.equal(decide({...row,rank:51},w,cp({...row,rank:51}),data()).approved,false);
 assert.equal(decide(row,w,cp(row,false),data()).approved,false);
 assert.equal(decide(row,{...w,eventId:'S43_OtherCup'},cp(),data()).approved,false);
 assert.equal(decide(row,w,cp(),{...data(),players:{candidates:[{name:'A'}]}}).approved,false);
 assert.equal(decide({...row,matches:12},w,cp({...row,matches:12}),data()).approved,false);
 assert.equal(decide(row,w,cp(),{...data(),results:[{...row,kind:'参加確認'}]}).approved,false);
});

test('unknown Zero Build event never inherits the ranked BR cutoffs',()=>{
 const unknown={...w,eventId:'S43_OnePieceZoroCup_ZB',windowId:'S43_OnePieceZoroCup_ZB_ME'};
 assert.equal(cutoffForWindow(unknown),null);
 assert.equal(decide(row,unknown,cp(),data()).approved,false);
});

test('ranked Zoro Mobile cup has its own smaller regional cutoff and match limit',()=>{
 const id='ch7s5-one-piece-zoro-mobile-cup',evt='S43_OnePieceZoroCup_Mobile';
 const win={...w,key:'epicgames_'+evt+'_OCE/'+evt+'_OCE',eventId:evt,
  windowId:evt+'_OCE',dateJst:'2026-11-06',region:'OCE',tournamentId:id};
 const item={...row,id:'auto-s43-222222222222',date:win.dateJst,region:'OCE',player:'A',
  players:undefined,tournamentId:id,event:'One Piece: Zoro Mobile Cup',rank:30,matches:8,vrs:0,
  source:source(win)};
 const db=data();db.tournaments.catalog=[{id,seasonId:'S43',series:'skin-cup',
  team:'solo',name:item.event,sourceEventIds:[evt]}];
 assert.equal(cutoffForWindow(win),30);
 assert.equal(decide(item,win,cp(item),db).approved,true);
 assert.equal(decide({...item,rank:31},win,cp({...item,rank:31}),db).approved,false);
 assert.equal(decide({...item,matches:9},win,cp({...item,matches:9}),db).approved,false);
});

test('batch approvals never duplicate the same roster, including duplicate API rows',()=>{
 const out=evaluate([row,{...row,id:'auto-s43-333333333333'}],[w],{[w.key]:{
  complete:true,proposals:[row,{...row,id:'auto-s43-333333333333'}]}},data());
 assert.equal(out.approved.length,1);
 assert.equal(out.held.length,1);
});


test('official skin reward rank can publish from a mature continuous verified partial snapshot',()=>{
 const win={...w,end:Date.parse('2026-11-06T05:00:00Z')};
 const partial={complete:false,rankingOrderValid:true,nextPage:2,pages:2,totalPages:100,lastSeenRank:200,
  lastSuccessAt:'2026-11-07T07:00:00Z',proposals:[row]};
 assert.equal(decide(row,win,partial,data()).approved,true);
 assert.equal(decide(row,win,{...partial,lastSeenRank:49},data()).approved,false);
 assert.equal(decide(row,win,{...partial,retryAfter:'2030-01-01T00:00:00Z'},data()).approved,false);
 assert.equal(decide({...row,rank:51},win,{...partial,proposals:[{...row,rank:51}]},data()).approved,false);
});


test('One Piece Buggy BR is auto-approved only for registered cosmetics with exact Epic window and verified roster',()=>{
 const id='ch7s5-one-piece-buggy-cup-battle-royale',evt='S43_OnePieceBuggyCup';
 const cutoffs={OCE:50,ME:50,EU:525,NAC:375,BR:100,NAW:100};
 const dates={OCE:'2026-11-13',ME:'2026-11-14',EU:'2026-11-14',
  NAC:'2026-11-14',BR:'2026-11-14',NAW:'2026-11-14'};
 for(const [region,rank] of Object.entries(cutoffs)){
  const window={...w,key:'epicgames_'+evt+'_'+region+'/'+evt+'_'+region,
   eventId:evt,windowId:evt+'_'+region,seasonId:'S43',tournamentId:id,region,
   dateJst:dates[region],series:'skin-cup',kind:'参加確認',round:'単一開催枠 / 参加確認'};
  const candidate={...row,id:'auto-s43-buggy-'+region.toLowerCase(),date:window.dateJst,
   region,tournamentId:id,event:'One Piece: Buggy Cup Battle Royale',
   rank,matches:11,source:source(window)};
  const db=data();db.tournaments.catalog=[{id,seasonId:'S43',series:'skin-cup',
   team:'duo',name:candidate.event,sourceEventIds:[evt]}];
  assert.equal(cutoffForWindow(window),rank);
  const result=decide(candidate,window,cp(candidate),db);
  assert.equal(result.approved,true,region+' rank '+rank);
  assert.equal(result.record.kind,'スキン大会');
  assert.equal(result.record.prize,0);
  assert.equal(result.record.rank,rank);
  assert.equal(decide({...candidate,rank:rank+1},window,cp({...candidate,rank:rank+1}),db).approved,false);
  assert.equal(decide({...candidate,matches:12},window,cp({...candidate,matches:12}),db).approved,false);
  assert.equal(decide(candidate,{...window,eventId:evt+'_ZB'},cp(candidate),db).approved,false);
  assert.equal(decide(candidate,window,cp(candidate,false),db).approved,false);
  assert.equal(decide(candidate,window,cp(candidate),{...db,results:[candidate]}).approved,false);
 }
});
