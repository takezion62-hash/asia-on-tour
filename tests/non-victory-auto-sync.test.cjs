'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {discover,parseReviewStage,selectActiveWindows,discoverUnmapped}=require('../scripts/osirion-sync.cjs');
const {prepare,applyProposals}=require('../scripts/auto-sync-core.cjs');
const stamp='2026-10-05T12:00:00Z';
const time=Date.parse('2026-11-05T00:00:00Z');
const evt=(id,region,window)=>({eventId:'epicgames_'+id+'_'+region,eventWindows:[{eventWindowId:window,beginTime:stamp,endTime:'2026-10-05T14:00:00Z'}]});
const cat=(id,team,series,subtype)=>({id:id.toLowerCase(),name:id,sourceEventIds:[id],team,series,subtype,seasonId:'S42',chapter:7,season:4});
const cash=cat('S42_ReloadCashCup_DuosZB','duo','cash-cup','reload-zb-duos-cash-cup');
const fncs=cat('S42_FNCSDivisionalCup_Division1','duo','fncs','fncs-division-1-practice');
const cosmetic=cat('S42_MegaManCup','duo','skin-cup','mega-man-cup');
const evalCup=cat('S42_PerformanceEvaluation','duo','performance-evaluation','performance-evaluation');
const icon=cat('S42_MadisonBeerIconCup','duo','icon-cup','madison-beer-icon-cup');
const victory=cat('S42_SoloVictoryCup','solo','victory-cup','solo-victory-cup');
const otherFncs=cat('S42_FNCSReloadQualifiers','solo','fncs','fncs-reload-qualifiers');
const events=[
 evt('S42_ReloadCashCup_DuosZB','ME','S42_ReloadCashCup_DuosZB_Event4Round1_ME'),
 evt('S42_FNCSDivisionalCup_Division1','ME','S42_FNCSDivisionalCup_Division1_Event2_ME'),
 evt('S42_MegaManCup','ME','S42_MegaManCup_ME'),
 evt('S42_PerformanceEvaluation','EU','S42_PerformanceEvaluation_Event3Round1_EU'),
 evt('S42_MadisonBeerIconCup','NAW','S42_MadisonBeerIconCup_NAW'),
 evt('S42_FNCSReloadQualifiers','NAW','S42_FNCSReloadQualifiers_Event1Round1_NAW'),
 evt('S42_SoloVictoryCup','ME','S42_SoloVictoryCup_Event3Round1_ME')
];
const enabled=['victory-cup','cash-cup','fncs','skin-cup','performance-evaluation','icon-cup'];
const params={fromDate:'2026-10-01',toDate:'2026-10-31',minLagMinutes:240,reviewSeries:enabled};
const catalog=[cash,fncs,cosmetic,evalCup,icon,otherFncs,victory];

test('only unambiguously catalogued allowed events enter multi-series review; region-locked FNCS excluded',()=>{
 const rows=discover(events,catalog,params,time);
 assert.equal(rows.length,6);
 assert.equal(rows.filter(r=>r.series==='victory-cup').length,1);
 assert.ok(!rows.some(r=>r.eventId.includes('FNCSReload')));
 for(const row of rows.filter(r=>r.series!=='victory-cup')){
  assert.equal(row.kind,'参加確認');
  assert.ok(row.round.endsWith('/ 参加確認'));
 }
 const onlyVictory=discover(events,catalog,{...params,reviewSeries:['victory-cup']},time);
 assert.equal(onlyVictory.length,1);
 const ambiguous=discover(events,[...catalog,{...cash,id:'dupe'}],params,time);
 assert.ok(!ambiguous.some(r=>r.eventId===cash.sourceEventIds[0]));
});

test('skin cups with no numbered round remain neutral, while FNCS Div1 is never declared qualified',()=>{
 assert.equal(parseReviewStage('S42_MegaManCup_ME').round,'単一開催枠 / 参加確認');
 const rows=discover(events,catalog,params,time);
 const f=rows.find(r=>r.series==='fncs');
 assert.equal(f.round,'Event 2 / 参加確認');
 const s=rows.find(r=>r.series==='cash-cup');
 assert.equal(s.round,'Event 4 · Round 1 / 参加確認');
});

test('verified Epic roster matches produce proposals but can never publish non-Victory records',()=>{
 const row=discover(events,catalog,params,time).find(r=>r.series==='cash-cup');
 const a='a'.repeat(32),b='b'.repeat(32);
 const data={players:{candidates:[{name:'A'},{name:'B'}]},results:[],tournaments:{catalog},updates:{entries:[]}};
 const config={version:1,accounts:[{epicAccountId:a,player:'A',confirmed:true},{epicAccountId:b,player:'B',confirmed:true}],windows:[{eventId:row.eventId,windowId:row.windowId,dateJst:row.dateJst,region:row.region,seasonId:row.seasonId,tournamentId:row.tournamentId,round:row.round,kind:row.kind}]};
 const entry={eventId:row.eventId,windowId:row.windowId,rank:12,points:251,kills:15,vrs:0,matches:8,teamAccountIds:[a,b],cashVerified:true,prize:999};
 const out=prepare({entries:[entry]},config,data);
 assert.equal(out.proposals.length,1);
 assert.equal(out.proposals[0].kind,'参加確認');
 assert.equal(out.proposals[0].prize,null);
 assert.equal(out.proposals[0].reviewOnly,true);
 assert.match(out.proposals[0].reviewReason,/未確認/);
 assert.throws(()=>applyProposals(data,out.proposals,'2026-11-05T00:00:00Z'),/公開登録できません/);
 assert.equal(data.results.length,0);
 assert.equal(prepare({entries:[{...entry,teamAccountIds:[a]}]},config,data).proposals.length,0);
});

test('large historical workloads reserve space for Victory and non-Victory series',()=>{
 const pending=[...discover(events,catalog,params,time)];
 const checkpoint={windows:{}};
 const chosen=selectActiveWindows(pending,checkpoint,{maxWindowsPerRun:2});
 assert.equal(chosen.length,2);
 assert.ok(chosen.some(r=>r.series==='victory-cup'));
 assert.ok(chosen.some(r=>r.series!=='victory-cup'));
 checkpoint.windows[chosen[0].key]={complete:true};
 assert.ok(!selectActiveWindows(pending,checkpoint,{maxWindowsPerRun:2}).some(r=>r.key===chosen[0].key));
});

test('new Cash Cup IDs are surfaced for mapping, not invented or silently published',()=>{
 const missing=[evt('S43_TriosCashCup','ME','S43_TriosCashCup_Event1Round1_ME')];
 missing[0].eventWindows[0].beginTime='2026-11-08T17:00:00Z';
 missing[0].eventWindows[0].endTime='2026-11-08T20:00:00Z';
 const now=Date.parse('2026-11-05T00:00:00Z');
 assert.deepEqual(discoverUnmapped(missing,catalog,{reviewSeries:['cash-cup'],lookbackDays:7},now),['S43_TriosCashCup']);
 assert.deepEqual(discoverUnmapped(missing,catalog,{reviewSeries:['victory-cup'],lookbackDays:7},now),[]);
});
