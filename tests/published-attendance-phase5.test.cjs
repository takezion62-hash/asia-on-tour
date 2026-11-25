'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildWindows,applyPreview}=require('../scripts/published-attendance-phase5.cjs');
const {planPublishedAttendance}=require('../scripts/published-attendance-recheck.cjs');
const eventId='S43_PerformanceEvaluationTrios',windowId='S43_PerformanceEvaluation_Event1Round1_EU';
const source='https://www.fortnite.com/competitive/events/'+eventId+'/?region=EU&round='+windowId;
const cat={id:'performance',name:'Fortnite Performance Evaluation',series:'performance-evaluation',seasonId:'S43',sourceEventIds:[eventId]};
const session={tournamentId:cat.id,name:cat.name,series:cat.series,seasonId:cat.seasonId,eventId,sourceWindowId:windowId,region:'EU',
 dateJst:'2026-11-06',startUtc:'2026-11-05T17:00:00Z',endUtc:'2026-11-05T20:00:00Z',url:source};
const result={kind:'参加確認',source,region:'EU',seasonId:'S43'};
test('archive rebuild uses real start and end, exact source, original scanner stage',()=>{
 const wins=buildWindows([result],[cat],[session]);
 assert.equal(wins.length,1);assert.equal(wins[0].round,'Event 1 · Round 1 / 参加確認');
 assert.equal(wins[0].end,Date.parse(session.endUtc));
 assert.equal(wins[0].key,'epicgames_'+eventId+'_EU/'+windowId);
});
test('missing or inconsistent calendar is not inferred',()=>{
 for(const s of [{...session,dateJst:'2026-11-05'},{...session,endUtc:null},{...session,url:source+'x'},{...session,series:'cash-cup'}])
  assert.deepEqual(buildWindows([result],[cat],[s]),[]);
 assert.deepEqual(buildWindows([result],[cat],[]),[]);
});
test('duplicate archive sessions remain ambiguous, not silently deduplicated',()=>{
 assert.equal(buildWindows([result],[cat],[session,session]).length,2);
});
test('apply rejects tampered report and preserves input on empty plan',()=>{
 const s={data:{results:[],verifiedAccounts:[],players:{},tournaments:{catalog:[]}},
 scans:{},windows:[],config:{},ledger:{entries:[]},reviewedIds:[],oldAudit:{version:1,entries:[]},now:Date.parse('2026-11-25T00:00:00Z')};
 const report=planPublishedAttendance(s),before=JSON.stringify(s);
 assert.deepEqual(applyPreview(s,report).results,[]);
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>applyPreview(s,{...report,proposed:1}),/differs/);
});
