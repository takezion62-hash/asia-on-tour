'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RULES,evaluationStage,qualifierCutoff,decide,evaluate}=require('../scripts/automatic-performance-approval.cjs');
const {applyProposals}=require('../scripts/auto-sync-core.cjs');
const rule=RULES['ch7s5-performance-evaluation-trios'];
const names=['A','B','C'],ids=['a'.repeat(32),'b'.repeat(32),'c'.repeat(32)];
const id='S43_PerformanceEvaluationTrios';
const makeWin=(round=1,region='EU')=>({
  key:'epicgames_'+id+'_'+region+'/S43_PerformanceEvaluation_Event1Round'+round+'_'+region,
  eventId:id,windowId:'S43_PerformanceEvaluation_Event1Round'+round+'_'+region,
  tournamentId:rule.id,seasonId:'S43',series:'performance-evaluation',
  region,dateJst:'2026-11-06',
  startUtc:region==='EU'?(round===1?'2026-11-05T17:00:00.000Z':'2026-11-05T20:00:00.000Z'):
    (round===1?'2026-11-06T00:00:00.000Z':'2026-11-06T03:00:00.000Z'),
  round:'Event 1 · Round '+round+' / 参加確認',kind:'参加確認'
});
const getRow=(win,rank=10,vrs=0)=>({
  id:'auto-s43-abcdef123456',date:win.dateJst,region:win.region,
  seasonId:'S43',tournamentId:rule.id,event:'Fortnite Performance Evaluation',
  round:win.round,kind:'参加確認',rank,points:win.windowId.includes('Round2')?vrs*100:330,
  kills:12,vrs,matches:win.windowId.includes('Round2')?4:8,
  player:names.join(' / '),players:[...names],teamAccountIds:[...ids],prize:null,
  verified:true,reviewOnly:true,reviewReason:'API review only',
  source:'https://www.fortnite.com/competitive/events/'+id+'/?region='+win.region+'&round='+win.windowId
});
const data=win=>({
  players:{candidates:names.map(name=>({name}))},
  tournaments:{catalog:[{id:rule.id,team:'trio',series:'performance-evaluation',
    seasonId:'S43',sourceEventIds:[id],name:'Fortnite Performance Evaluation'}]},
  schedule:{sessions:[{eventId:id,name:'Fortnite Performance Evaluation',seasonId:'S43',
    region:win.region,dateJst:win.dateJst,
    round:win.round.replace(' / 参加確認',''),
    stage:win.windowId.includes('Round1')?'予選':'決勝',
    startUtc:win.startUtc.replace('.000Z','Z')}]},
  verifiedAccounts:ids.map((epicAccountId,i)=>({epicAccountId,player:names[i],confirmed:true})),
  results:[],updates:{entries:[]}
});
const cp=(row,complete=true)=>({complete,rankingOrderValid:true,proposals:[row]});
test('only S43 EU NAC evaluation windows map to their correct round and cutoff',()=>{
  assert.equal(rule.advance.EU,26);assert.equal(rule.advance.NAC,26);
  assert.equal(rule.prizePerVictory,400);assert.equal(rule.finalWinPoints,100);
  assert.equal(qualifierCutoff(makeWin(1,'EU')),26);
  assert.equal(qualifierCutoff(makeWin(1,'NAC')),26);
  assert.equal(qualifierCutoff(makeWin(2,'EU')),null);
  assert.equal(evaluationStage({...makeWin(),windowId:'S42_PerformanceEvaluation_Event1Round1_EU'}),null);
  assert.equal(evaluationStage({...makeWin(),region:'ME'}),null);
});
test('top26 verified EU/NAC trios qualify without cash; 27th does not',()=>{
  for(const region of ['EU','NAC']){
    const win=makeWin(1,region),row=getRow(win,26),db=data(win);
    const out=decide(row,win,cp(row),db);
    assert.equal(out.approved,true,out.reason);
    assert.equal(out.record.kind,'予選');
    assert.equal(out.record.prize,0);
    assert.match(out.record.round,/\/ 予選突破$/);
    assert.equal(out.record.teamAccountIds,undefined);
    assert.equal(applyProposals(db,[out.record],'2026-11-07T12:00:00Z'),1);
    assert.equal(decide(row,win,cp(row),db).approved,false);
    const loser=getRow(win,27);
    assert.equal(decide(loser,win,cp(loser),data(win)).approved,false);
  }
});
test('Round2 maps VR to each team member $400; no VR becomes $0',()=>{
  for(const vr of [0,1,2,4]){
    const win=makeWin(2,'NAC'),row=getRow(win,1,vr),res=decide(row,win,cp(row),data(win));
    assert.equal(res.approved,true,res.reason);
    assert.equal(res.record.kind,'Performance決勝');
    assert.equal(res.record.prizePerPlayer,vr*400);
    assert.equal(res.record.prize,vr*1200);
    assert.equal(res.record.teamAccountIds,undefined);
  }
});
test('inconsistent final points, unchecked identities or incomplete leaderboard cannot publish',()=>{
  const win=makeWin(2),row=getRow(win,3,2),db=data(win);
  assert.equal(decide({...row,points:100},win,cp({...row,points:100}),db).approved,false);
  assert.equal(decide(row,win,cp(row,false),db).approved,false);
  assert.equal(decide(row,win,{...cp(row),rankingOrderValid:false},db).approved,false);
  assert.equal(decide(row,win,{...cp(row),proposals:[]},db).approved,false);
  assert.equal(decide({...row,teamAccountIds:ids.slice(0,2)},win,cp({...row,teamAccountIds:ids.slice(0,2)}),db).approved,false);
  const changed={...row,teamAccountIds:[ids[1],ids[0],ids[2]]};
  assert.equal(decide(changed,win,cp(changed),db).approved,false);
  const unknown=data(win);unknown.verifiedAccounts[0].confirmed=false;
  assert.equal(decide(row,win,cp(row),unknown).approved,false);
  const tooMany={...row,matches:5};
  assert.equal(decide(tooMany,win,cp(tooMany),db).approved,false);
});
test('season, region, start time, event ID, round URL must match schedule exactly',()=>{
  const win=makeWin(1),row=getRow(win),db=data(win);
  assert.equal(decide(row,{...win,startUtc:'2026-11-05T17:01:00.000Z'},cp(row),db).approved,false);
  assert.equal(decide(row,win,cp(row),{...db,schedule:{sessions:[]}}).approved,false);
  const wrong={...row,source:row.source.replace('region=EU','region=NAC')};
  assert.equal(decide(wrong,win,cp(wrong),db).approved,false);
  assert.equal(decide(row,{...win,windowId:'S43_PerformanceEvaluation_Event2Round1_EU'},cp(row),db).approved,false);
});
test('batch evaluation is deduplicated and leaves different seasons review-only',()=>{
  const win=makeWin(2),row=getRow(win,2,1),duplicate={...row,id:'auto-s43-fedcba654321'};
  const checkpoint={...cp(row),proposals:[row,duplicate]};
  const result=evaluate([row,duplicate,{...row,tournamentId:'ch7s4-performance-evaluation'}],
    [win],{[win.key]:checkpoint},data(win));
  assert.equal(result.approved.length,1);
  assert.equal(result.approved[0].prizePerPlayer,400);
  assert.equal(result.held.length,1);
});
