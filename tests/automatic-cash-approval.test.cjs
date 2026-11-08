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
