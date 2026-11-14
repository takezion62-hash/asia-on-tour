'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RULES,cashPrize,cashLimitForWindow,decide,evaluate}=require('../scripts/automatic-cash-approval.cjs');
const {applyProposals}=require('../scripts/auto-sync-core.cjs');
const rule=RULES['ch7s5-trios-cash-cup'];
const sid='S43',eventId='S43_TriosCashCup',region='OCE',windowId=eventId+'_Event1_'+region;
const ids=['a'.repeat(32),'b'.repeat(32),'c'.repeat(32)],names=['A','B','C'];
const url=w=>'https://www.fortnite.com/competitive/events/'+w.eventId+'/?region='+w.region+'&round='+w.windowId;
const window=()=>({key:'epicgames_'+eventId+'_'+region+'/'+windowId,
 fullEventId:'epicgames_'+eventId+'_'+region,eventId,windowId,region,seasonId:sid,
 tournamentId:rule.id,dateJst:'2026-11-07',startUtc:'2026-11-07T03:00:00.000Z',
 round:'Event 1 / 参加確認',kind:'参加確認',series:'cash-cup'});
const row=(rank=3,win=window(),id='auto-s43-abcdef123456')=>({
 id,date:win.dateJst,region:win.region,seasonId:sid,tournamentId:rule.id,
 event:'Trios Cash Cup Battle Royale',round:win.round,kind:win.kind,
 player:names.join(' / '),players:[...names],teamAccountIds:[...ids],
 rank,points:290,kills:7,vrs:1,matches:11,prize:null,verified:true,
 reviewOnly:true,reviewReason:'参加確認のみ',note:'未判定',source:url(win)
});
const db=()=>({tournaments:{catalog:[{id:rule.id,series:'cash-cup',team:'trio',
 seasonId:sid,name:'Trios Cash Cup Battle Royale',sourceEventIds:[eventId]}]},
 players:{candidates:names.map(name=>({name}))},
 verifiedAccounts:ids.map((epicAccountId,i)=>({player:names[i],epicAccountId,confirmed:true})),
 schedule:{sessions:[{eventId,seasonId:sid,name:'Trios Cash Cup Battle Royale',
  region:'OCE',dateJst:'2026-11-07',round:'Event 1',
  startUtc:'2026-11-07T03:00:00Z',stage:'単一ラウンド'}]},
 results:[],updates:{entries:[]}});
const checkpoint=(x,good=true)=>({complete:good,rankingOrderValid:true,proposals:[x]});

test('official prize ladder pays per individual and sets $0 beyond last paying rank',()=>{
 assert.equal(rule.autoApproval,'verified-team-rank');
 for(const [code,winners,unpaid] of [['OCE',[300,250,200,150,100],6],
 ['ME',[300,250,200,150,100],6],['NAW',[400,300,200,150,150,100],11],
 ['EU',[1000,750,500,400,300,200,200,200,200,200,100],21]]){
  assert.equal(cashPrize(rule,code,1),winners[0]);
  assert.equal(cashPrize(rule,code,unpaid),0);
 }
 assert.equal(cashPrize(rule,'unknown',20),null);
 assert.equal(cashPrize(rule,'OCE',0),null);
 assert.equal(cashLimitForWindow(window()),5);
});

test('same completed verified Epic team can publish rank #3 with per-player cash',()=>{
 const w=window(),r=row(3,w),data=db();
 const out=decide(r,w,checkpoint(r),data);
 assert.equal(out.approved,true,out.reason);
 assert.equal(out.record.prize,600);  // 3 players x $200
 assert.equal(out.record.prizePerPlayer,200);
 assert.equal(out.record.kind,'賞金決勝');
 assert.equal(out.record.round,'Event 1 / 賞金決勝');
 assert.equal(out.record.teamAccountIds,undefined);
 assert.equal(out.record.reviewOnly,undefined);
 assert.equal(applyProposals(data,[out.record],'2026-11-07T10:00:00Z'),1);
 assert.equal(data.results[0].prize,600);
 assert.equal(decide(r,w,checkpoint(r),data).approved,false);
});

test('verified cashless teams below the prize cutoff are automatically published with $0',()=>{
 for(const finish of [6,99,2000]){
  const w=window(),r=row(finish,w),out=decide(r,w,checkpoint(r),db());
  assert.equal(out.approved,true,out.reason);
  assert.equal(out.record.prize,0);
  assert.equal(out.record.prizePerPlayer,0);
  assert.match(out.record.note,/賞金圏外/);
  assert.equal(out.record.verified,true);
 }
});

test('full leaderboard scan and rank order are mandatory for zero and winning cash',()=>{
 const w=window();
 for(const finish of [1,6]){
  const r=row(finish,w);
  assert.equal(decide(r,w,checkpoint(r,false),db()).approved,false);
  assert.equal(decide(r,w,{...checkpoint(r),rankingOrderValid:false},db()).approved,false);
  assert.equal(decide(r,w,{...checkpoint(r),proposals:[]},db()).approved,false);
 }
});

test('invalid schedule, region, mismatched source and tournament session are held',()=>{
 const w=window(),r=row(6,w);
 assert.equal(decide(r,w,checkpoint(r),{...db(),schedule:{sessions:[]}}).approved,false);
 assert.equal(decide(r,{...w,startUtc:'2026-11-07T04:00:00Z'},checkpoint(r),db()).approved,false);
 assert.equal(decide({...r,source:r.source.replace('region=OCE','region=NAW')},w,checkpoint({...r,source:r.source.replace('region=OCE','region=NAW')}),db()).approved,false);
 assert.equal(decide(r,{...w,windowId:'S43_TriosCashCup_Event4_OCE'},checkpoint(r),db()).approved,false);
 assert.equal(cashLimitForWindow({...w,region:'unsupported'}),null);
 assert.equal(cashLimitForWindow({...w,tournamentId:'unregistered-cash-cup'}),null);
});

test('three exact known Epic IDs are required even for $0 cash records',()=>{
 const w=window(),r=row(6,w);
 const modify=(p,dbFn)=>{const candidate=p(r);return decide(candidate,w,checkpoint(candidate),dbFn||db());};
 assert.equal(modify(x=>({...x,players:['A','B']})).approved,false);
 assert.equal(modify(x=>({...x,players:['A','A','C'],player:'A / A / C'})).approved,false);
 assert.equal(modify(x=>({...x,teamAccountIds:[ids[0],ids[1]]})).approved,false);
 assert.equal(modify(x=>({...x,teamAccountIds:[ids[0],ids[1],ids[1]]})).approved,false);
 const swapped=modify(x=>({...x,teamAccountIds:[ids[1],ids[0],ids[2]]}));
 assert.equal(swapped.approved,false);
 const unverified=db();unverified.verifiedAccounts[0].confirmed=false;
 assert.equal(decide(r,w,checkpoint(r),unverified).approved,false);
 assert.equal(modify(x=>({...x,matches:12})).approved,false);
});

test('batch evaluation prevents duplicate roster aliases and retains unrelated manual Cash Cups',()=>{
 const w=window(),r=row(7,w),other={...r,id:'auto-s43-fedcba654321'};
 const cp={complete:true,rankingOrderValid:true,proposals:[r,other]};
 const out=evaluate([r,other,{...r,tournamentId:'other-cash'}],[w],{[w.key]:cp},db());
 assert.equal(out.approved.length,1);
 assert.equal(out.approved[0].prize,0);
 assert.equal(out.held.length,1);
});


test('prize-free verified Cash Cup team can publish from mature continuous partial pages',()=>{
 const w={...window(),end:Date.parse('2026-11-07T06:00:00Z')};
 const unpaid=row(500,w),winner=row(3,w);
 const partial=x=>({complete:false,rankingOrderValid:true,nextPage:5,pages:5,totalPages:40,lastSeenRank:500,
  lastSuccessAt:'2026-11-08T08:00:00Z',proposals:[x]});
 const result=decide(unpaid,w,partial(unpaid),db());
 assert.equal(result.approved,true,result.reason);
 assert.equal(result.record.prize,0);
 assert.equal(result.record.prizePerPlayer,0);
 assert.equal(decide(winner,w,partial(winner),db()).approved,false,'cash must wait for complete leaderboard');
 assert.equal(decide(unpaid,w,{...partial(unpaid),rankingOrderValid:false},db()).approved,false);
 assert.equal(decide(unpaid,w,{...partial(unpaid),lastSeenRank:400},db()).approved,false);
});

// S43 Reload ZB Duos Round 2: six matches, all six regions, per-player tiers.
const reloadRule=RULES['ch7s5-reload-zero-build-duos-cash-cup'];
const reloadEvent='S43_ReloadZBDuosCashCup',reloadNames=['A','B'],reloadIds=['a'.repeat(32),'b'.repeat(32)];
function reloadWin(region='OCE',event=1){
 const id=reloadEvent+'_Event'+event+'Round2_'+region;
 return {key:'epicgames_'+reloadEvent+'_'+region+'/'+id,eventId:reloadEvent,windowId:id,
  tournamentId:reloadRule.id,seasonId:'S43',region,series:'cash-cup',kind:'参加確認',
  round:'Event '+event+' · Round 2 / 参加確認',dateJst:'2026-11-13',
  startUtc:'2026-11-13T07:00:00Z',end:Date.parse('2026-11-13T09:15:00Z')};
}
function reloadRow(rank,w=reloadWin()){
 return {id:'auto-s43-abc123456789',date:w.dateJst,region:w.region,seasonId:'S43',
  tournamentId:reloadRule.id,event:'Reload ZB Duos Cash Cup Zero Build',
  round:w.round,kind:'参加確認',player:'A / B',players:reloadNames,
  teamAccountIds:reloadIds,rank,points:400,kills:10,vrs:0,matches:6,
  prize:null,reviewOnly:true,verified:true,source:url(w)};
}
function reloadDb(w=reloadWin()){
 return {players:{candidates:reloadNames.map(name=>({name}))},
  verifiedAccounts:reloadIds.map((epicAccountId,i)=>({epicAccountId,player:reloadNames[i],confirmed:true})),
  tournaments:{catalog:[{id:reloadRule.id,series:'cash-cup',team:'duo',seasonId:'S43',
   name:'Reload ZB Duos Cash Cup Zero Build',sourceEventIds:[reloadEvent]}]},
  schedule:{sessions:[{eventId:reloadEvent,seasonId:'S43',region:w.region,
   name:'Reload ZB Duos Cash Cup Zero Build',dateJst:w.dateJst,
   round:'Event 1 · Round 2',stage:'決勝',startUtc:w.startUtc}]},results:[],updates:{entries:[]}};
}
test('S43 Reload ZB Duos final cash tiers match official per-player payouts in every overseas region',()=>{
 assert.equal(reloadRule.autoApproval,'verified-duo-qualifier-only');
 assert.equal(reloadRule.cashFinalAutoApproval,'verified-duo-round2-rank');
 for(const region of ['OCE','ME','NAW','BR','EU','NAC']){
  const w=reloadWin(region),base=reloadDb(w);
  assert.equal(cashLimitForWindow(w),20);
  const amounts=['EU','NAC'].includes(region)?[600,450,300,200,150,100,100,100]:[300,250,200,150,100,0,0,0];
  for(const [i,share] of amounts.entries()){
   const r=reloadRow(i+1,w),out=decide(r,w,checkpoint(r),base);
   assert.equal(out.approved,true,region+' rank '+(i+1)+': '+out.reason);
   assert.equal(out.record.prizePerPlayer,share);
   assert.equal(out.record.prize,share*2);
   assert.equal(out.record.round,'Event 1 · Round 2 / 賞金決勝');
   assert.equal(out.record.teamAccountIds,undefined);
  }
  const out=decide(reloadRow(20,w),w,checkpoint(reloadRow(20,w)),base);
  assert.equal(out.approved,true,out.reason);
  assert.equal(out.record.prize,0);
 }
});
test('S43 Reload ZB Duos strictly rejects unfinished rankings, forged prizes, unverified IDs and Round 1',()=>{
 const w=reloadWin(),r=reloadRow(3,w),data=reloadDb(w);
 const good=checkpoint(r);
 assert.equal(decide(r,w,good,data).approved,true);
 assert.equal(decide(r,w,{...good,complete:false},data).approved,false);
 assert.equal(decide(r,w,{...good,rankingOrderValid:false},data).approved,false);
 assert.equal(decide({...r,prize:600},w,good,data).approved,false);
 assert.equal(decide({...r,teamAccountIds:[reloadIds[0],reloadIds[0]]},w,good,data).approved,false);
 assert.equal(decide(r,w,good,{...data,verifiedAccounts:[]}).approved,false);
 assert.equal(decide(r,w,good,{...data,schedule:{sessions:[]}}).approved,false);
 assert.equal(decide({...r,rank:21},w,checkpoint({...r,rank:21}),data).approved,false);
 assert.equal(decide({...r,matches:7},w,checkpoint({...r,matches:7}),data).approved,false);
 const w1={...w,windowId:reloadEvent+'_Event1Round1_OCE',round:'Event 1 · Round 1 / 参加確認'};
 assert.equal(cashLimitForWindow(w1),null);
 assert.equal(decide(reloadRow(3,w1),w1,checkpoint(reloadRow(3,w1)),data).approved,false);
 const published=decide(r,w,good,data).record;
 data.results.push(published);
 assert.equal(decide(r,w,good,data).approved,false);
});


test('S43 Arena solo auto-approval uses official six-region payouts for both events with exact verified Epic ID',()=>{
 const r=RULES['ch7s5-arenas-cash-cup'],eid='S43_ArenaCashCup';
 assert.equal(r.autoApproval,'verified-team-rank');
 const scheduleByRegion={
  OCE:['2026-11-10','2026-11-10T07:00:00Z'],
  ME:['2026-11-11','2026-11-10T15:00:00Z'],
  EU:['2026-11-11','2026-11-10T18:00:00Z'],
  BR:['2026-11-11','2026-11-10T21:00:00Z'],
  NAC:['2026-11-11','2026-11-11T00:00:00Z'],
  NAW:['2026-11-11','2026-11-11T02:00:00Z']
 };
 const dataFor=(win)=>({
  tournaments:{catalog:[{id:r.id,series:'cash-cup',team:'solo',seasonId:'S43',
   name:'Arenas Cash Cup',sourceEventIds:[eid]}]},
  players:{candidates:[{name:'A'}]},
  verifiedAccounts:[{epicAccountId:'a'.repeat(32),player:'A',confirmed:true}],
  schedule:{sessions:[{eventId:eid,seasonId:'S43',name:'Arenas Cash Cup',
   region:win.region,dateJst:win.dateJst,round:'Event '+Number(win.windowId.match(/Event([0-9]+)/)[1]),
   startUtc:win.startUtc,stage:'単一ラウンド'}]},
  results:[]
 });
 for(const [region,[dateJst,startUtc]] of Object.entries(scheduleByRegion)){
  const ladders=r.cashPrizes.tiers[region];
  for(const eventNo of [1,2]){
   const now=eventNo===1?startUtc:new Date(Date.parse(startUtc)+14*86400000).toISOString();
   const day=eventNo===1?dateJst:new Date(Date.parse(dateJst+'T00:00:00Z')+14*86400000).toISOString().slice(0,10);
   const windowId=eid+'_Event'+eventNo+'_'+region;
   const win={eventId:eid,windowId,seasonId:'S43',tournamentId:r.id,region,
     dateJst:day,startUtc:now,series:'cash-cup',kind:'参加確認',
     round:'Event '+eventNo+' / 参加確認'};
   const make=(rank,recordId='auto-s43-123456abcdef')=>({
    id:recordId,seasonId:'S43',date:day,region,tournamentId:r.id,
    event:'Arenas Cash Cup',round:win.round,kind:'参加確認',
    player:'A',teamAccountIds:['a'.repeat(32)],
    rank,points:280,kills:20,vrs:2,matches:12,prize:null,verified:true,
    reviewOnly:true,reviewReason:'未検証',
    source:'https://www.fortnite.com/competitive/events/'+eid+'/?region='+region+'&round='+windowId
   });
   assert.equal(cashLimitForWindow(win),ladders.at(-1).through,region+' Event '+eventNo);
   const sample=[1,ladders.at(-1).through,ladders.at(-1).through+1];
   for(const rank of sample){
    const item=make(rank),out=decide(item,win,checkpoint(item),dataFor(win));
    assert.equal(out.approved,true,region+' Event '+eventNo+' '+rank+': '+out.reason);
    assert.equal(out.record.kind,'賞金決勝');
    assert.equal(out.record.prize,cashPrize(r,region,rank));
    assert.equal(out.record.prizePerPlayer,cashPrize(r,region,rank));
    assert.equal(out.record.teamAccountIds,undefined);
    assert.equal(out.record.verified,true);
   }
   const item=make(1);
   const broken=[
    [{...item,matches:13},win,checkpoint({...item,matches:13}),dataFor(win)],
    [{...item,teamAccountIds:[]},win,checkpoint({...item,teamAccountIds:[]}),dataFor(win)],
    [{...item,teamAccountIds:['b'.repeat(32)]},win,checkpoint({...item,teamAccountIds:['b'.repeat(32)]}),dataFor(win)],
    [item,{...win,eventId:'S42_ArenaCashCup'},checkpoint(item),dataFor(win)],
    [item,{...win,startUtc:'2026-01-01T00:00:00Z'},checkpoint(item),dataFor(win)],
    [item,win,checkpoint(item,false),dataFor(win)],
    [item,win,checkpoint(item),{...dataFor(win),results:[item]}]
   ];
   for(const [cand,w,cp,db] of broken){
    assert.equal(decide(cand,w,cp,db).approved,false,'must hold ambiguous '+region+' event '+eventNo);
   }
  }
 }
});
