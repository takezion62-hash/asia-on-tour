'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../scripts/validate-approvals.cjs');
const result={
 id:'auto-s42-aaaaaaaaaaaa',date:'2026-09-22',region:'ME',player:'A',event:'Demo Evaluation',
 tournamentId:'demo-evaluation',round:'Event 1 · Round 1 / 参加確認',
 source:'https://www.fortnite.com/competitive/events/S42_DemoEvaluation/?region=ME&round=S42_DemoEvaluation_Event1Round1_ME',
 kind:'参加確認',prize:null,verified:true,rank:70
};
const ledger={
 version:1,entries:[{id:result.id,recordId:result.id,decision:'published',policy:'attendance-only',source:result.source}]
};
test('管理者掲載後の出場確認は履歴と一致する',()=>{
 assert.deepEqual(audit([result],ledger,{confirmedAliases:{}}),[]);
});
test('承認後に賞金・ソースが改変されたら検知する',()=>{
 assert.ok(audit([{...result,kind:'賞金決勝',prize:100}],ledger,{confirmedAliases:{}}).some(x=>x.includes('unsupported confirmed award')));
 assert.ok(audit([{...result,source:'https://other.example'}],ledger,{confirmedAliases:{}}).some(x=>x.includes('source')));
});
test('同じ選手の同じ開催枠を二重登録したら検知する',()=>{
 assert.ok(audit([result,{...result,id:'another'}],ledger,{confirmedAliases:{}}).some(x=>x.includes('Potential duplicate')));
});
test('存在しない掲載IDと承認履歴の二重記載を検知する',()=>{
 assert.ok(audit([],ledger,{confirmedAliases:{}}).length);
 assert.ok(audit([result],{version:1,entries:[...ledger.entries,...ledger.entries]},{confirmedAliases:{}}).length);
});

test('S30 Event4 OCE or ME cash is exactly one hundred dollars per verified final VR',()=>{
 for(const [date,region] of [['2024-06-24','OCE'],['2024-06-25','ME']]){
  const window='S30_SoloVictoryCashCup_Event4Round2_'+region, id='auto-s30-bbaccddeeff0';
  const row={...result,id,date,region,tournamentId:'ch5s3-solo-victory-cup',event:'Solo Victory Cup Battle Royale',
   seasonId:'S30',kind:'賞金決勝',round:'Event 4 · Round 2 / 賞金決勝',vrs:1,points:100,
   source:'https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region='+region+'&round='+window,
   matches:3,kills:6,rank:33,prize:100,verified:true};
  const history={version:1,entries:[{id,decision:'published',recordId:id,policy:'official-final-vr-award',
   source:row.source,rule:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'}]};
  assert.deepEqual(audit([row],history,{confirmedAliases:{}}),[]);
  assert.ok(audit([{...row,prize:200}],history,{confirmedAliases:{}}).length>0);
  assert.ok(audit([{...row,points:0}],history,{confirmedAliases:{}}).length>0);
 }
});

test('2024-07-15 OCE Event5 final per-VR cash remains strictly $100 and exact window',()=>{
 const id='auto-s30-abbcdeffff00',row={...result,id,date:'2024-07-15',region:'OCE',
  tournamentId:'ch5s3-solo-victory-cup',event:'Solo Victory Cup Battle Royale',seasonId:'S30',
  round:'Event 5 · Round 2 / 賞金決勝',kind:'賞金決勝',rank:35,points:100,
  kills:7,vrs:1,matches:3,prize:100,verified:true,
  source:'https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=OCE&round=S30_SoloVictoryCashCup_Event5Round2_OCE'};
 const history={version:1,entries:[{id,decision:'published',recordId:id,policy:'official-final-vr-award',
  source:row.source,rule:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'}]};
 assert.deepEqual(audit([row],history,{confirmedAliases:{}}),[]);
 assert.ok(audit([{...row,prize:0}],history,{confirmedAliases:{}}).length>0);
});

test('2024 July ME ZB Solo Victory final pays $100 only for one exact Epic VR',()=>{
 const id='auto-s30-aabbccddeeff';
 const r={...result,id,date:'2024-07-16',region:'ME',
  seasonId:'S30',tournamentId:'ch5s3-zb-solo-victory',event:'ZB Solo Victory Cup',
  kind:'賞金決勝',round:'Event 5 · Round 2 / 賞金決勝',rank:24,
  points:100,kills:11,vrs:1,matches:3,verified:true,prize:100,
  source:'https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event5Round2_ME'};
 const ledger={version:1,entries:[{id,decision:'published',recordId:id,policy:'official-final-vr-award',source:r.source,
  rule:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'}]};
 assert.deepEqual(audit([r],ledger,{confirmedAliases:{}}),[]);
 assert.ok(audit([{...r,prize:0}],ledger,{confirmedAliases:{}}).length>0);
});

test('2026 Aug ME Reload Duos Victory Cup confirms one VR equals $200 team, $100 each',()=>{
 const id='auto-s42-bbcceeffaabb',source='https://www.fortnite.com/competitive/events/S42_ReloadDuosVictoryCup/?region=ME&round=S42_ReloadDuosVictoryCup_Event1_Round2_ME';
 const r={...result,id,date:'2026-08-25',region:'ME',seasonId:'S42',
  tournamentId:'ch7s4-reload-duos-victory-cup',event:'Reload Duos Victory Cup',
  player:'Karf / huggyfv',players:['Karf','huggyfv'],
  kind:'賞金決勝',round:'Event 1 · Round 2 / 賞金決勝',
  rank:14,points:100,kills:8,vrs:1,matches:3,verified:true,prize:200,
  teamPrize:200,prizePerPlayer:100,source};
 const ledger={version:1,entries:[{id,decision:'published',recordId:id,policy:'official-final-vr-award',
  source,rule:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules'}]};
 assert.deepEqual(audit([r],ledger,{confirmedAliases:{}}),[]);
 assert.ok(audit([{...r,prize:100}],ledger,{confirmedAliases:{}}).length>0);
 assert.ok(audit([{...r,prizePerPlayer:200}],ledger,{confirmedAliases:{}}).length>0);
});

test('2026-08-29 OCE Console Zero Build Solo Victory cash pays $100 per original final VR',()=>{
 const id='auto-s42-eebbcceeaaff';
 const source='https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=OCE&round=S42_ConsoleVCC_SolosZB_Event1Round2_OCE';
 const row={...result,id,date:'2026-08-29',region:'OCE',seasonId:'S42',
  tournamentId:'ch7s4-console-zero-build-solo-victory-cup',
  event:'Console Zero Build Solo Victory Cup',kind:'賞金決勝',
  round:'Event 1 · Round 2 / 賞金決勝',rank:16,points:100,kills:9,
  vrs:1,matches:3,prize:100,verified:true,source};
 const history={version:1,entries:[{id,decision:'published',recordId:id,
  policy:'official-final-vr-award',source,
  rule:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules'}]};
 assert.deepEqual(audit([row],history,{confirmedAliases:{}}),[]);
 assert.ok(audit([{...row,prize:200}],history,{confirmedAliases:{}}).length>0);
 assert.ok(audit([{...row,points:0}],history,{confirmedAliases:{}}).length>0);
});


test('2024-07-23 NAC Event6 Round2 awards exact $100 for each Epic-verified VR',()=>{
 const source='https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=NAC&round=S30_SoloVictoryCashCup_Event6Round2_NAC';
 const row={...result,id:'auto-s30-fae0bb000001',date:'2024-07-23',region:'NAC',seasonId:'S30',
  tournamentId:'ch5s3-solo-victory-cup',event:'Solo Victory Cup Battle Royale',
  round:'Event 6 · Round 2 / 賞金決勝',kind:'賞金決勝',rank:62,
  points:100,kills:6,vrs:1,matches:2,prize:100,verified:true,source};
 const history={version:1,entries:[{id:row.id,recordId:row.id,decision:'published',policy:'official-final-vr-award',
  rule:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',source}]};
 assert.deepEqual(audit([row],history,{confirmedAliases:{}}),[]);
 assert.ok(audit([{...row,prize:0}],history,{confirmedAliases:{}}).length>0);
 assert.ok(audit([{...row,points:0}],history,{confirmedAliases:{}}).length>0);
 assert.ok(audit([{...row,source:source.replace('Event6Round2','Event7Round2')}],history,{confirmedAliases:{}}).length>0);
});

test('S31 2024 Event8 OCE/ME cash is $100 only for an exact original Round2 Victory Royale',()=>{
 for(const [date,region] of [['2024-10-21','OCE'],['2024-10-22','ME']]){
  const window='S31_SoloVictoryCashCup_Event8Round2_'+region;
  const id='auto-s31-aabbccddeeff';
  const source='https://www.fortnite.com/competitive/events/S31_SoloVictoryCashCup/?region='+region+'&round='+window;
  const r={...result,id,date,region,tournamentId:'ch5s4-solo-victory-cup',seasonId:'S31',
   event:'Solo Victory Cup Battle Royale',kind:'賞金決勝',
   round:'Event 8 · Round 2 / 賞金決勝',rank:34,points:100,kills:3,
   vrs:1,matches:3,prize:100,source,verified:true};
  const history={version:1,entries:[{id,decision:'published',recordId:id,
   policy:'official-final-vr-award',source,
   rule:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules'}]};
  assert.deepEqual(audit([r],history,{confirmedAliases:{}}),[]);
  for(const edited of [{...r,prize:200},{...r,points:0},{...r,source:source.replace('Event8Round2','Event7Round2')},{...r,region:'NAC'}]){
   assert.ok(audit([edited],history,{confirmedAliases:{}}).length>0);
  }
 }
});

test('2024-06-07 ME ZB Duos cash: only exact scoreboard results have verified individual payouts',()=>{
 const C=require('../scripts/verified-s30-duos-cash-20240607.cjs');
 assert.equal(C.TARGETS.length,10);
 assert.equal(C.TARGETS.reduce((sum,x)=>sum+x.prize,0),2400);
 for(const t of C.TARGETS){
  const names=t.player.split(' / ');
  const profiles=names.map((name,i)=>({name,url:
   'https://fortnitetracker.com/profile/all/'+encodeURIComponent(name)+
   '/events?id='+(i===0?'01234567':'89abcdef')+'-0000-4000-8000-123456789012'}));
  const row={id:t.id,date:C.DATE,region:C.REGION,seasonId:'S30',
   chapter:5,season:3,tournamentId:C.TOURNAMENT,event:'ZB Duos Cash Cup',
   round:C.ROUND,kind:'賞金決勝',player:t.player,players:names,
   rank:t.rank,points:t.points,kills:t.kills,vrs:t.vrs,matches:t.matches,
   prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prize/2,
   source:C.SOURCE,verified:true,profiles,note:C.TRACKER+' '+C.RULE};
  const entry={id:t.id,recordId:t.id,decision:'published',policy:C.POLICY,
   source:C.SOURCE,rule:C.RULE};
  const ledger={version:1,entries:[entry]};
  assert.deepEqual(audit([row],ledger,{confirmedAliases:{}}),[],
   'verified screenshot row must pass '+t.rank);
  const modifications=[
   {...row,prize:t.prize+200},{...row,prizePerPlayer:t.prize},
   {...row,teamPrize:t.prize+200},{...row,rank:t.rank+1},
   {...row,points:t.points+1},{...row,vrs:t.vrs+1},
   {...row,matches:t.matches+1},{...row,player:names[1]+' / '+names[0]},
   {...row,kind:'参加確認'},{...row,round:'Event 1 · Round 1 / 賞金決勝'},
   {...row,source:C.SOURCE.replace('ME','NAW')},
   {...row,profiles:[{...profiles[0],url:'not a url'},profiles[1]]}
  ];
  for(const changed of modifications)
   assert.ok(audit([changed],ledger,{confirmedAliases:{}}).length>0,
    'tampered '+t.rank+' should be rejected: '+JSON.stringify(changed));
  assert.ok(audit([row],{version:1,entries:[{...entry,policy:'attendance-only'}]},
   {confirmedAliases:{}}).length>0,'old attendance-only policy must not accept cash');
 }
});

test('S42 Reload out-of-cutoff attendance is guarded while cash-final policy is expanded',()=>{
 const rule=require('../scripts/verified-history-approval.cjs').RULES['ch7s4-solo-reload-victory-cup'];
 const id='auto-s42-123456abcdef',source='https://www.fortnite.com/competitive/events/S42_ReloadReloadSoloVictoryCup/?region=ME&round=S42_ReloadSoloVictoryCup_Event5_Round1_ME';
 const r={id,date:'2026-10-24',region:'ME',seasonId:'S42',
  tournamentId:'ch7s4-solo-reload-victory-cup',event:'Solo Reload Victory Cup',
  round:'Event 5 · Round 1 / 参加確認',kind:'参加確認',rank:6130,
  points:88,kills:3,vrs:0,matches:5,prize:0,verified:true,source,
  player:'A',note:'突破圏外 '+rule.source};
 const entry={id,recordId:id,decision:'published',policy:'verified-rule',source,rule:rule.source};
 assert.deepEqual(audit([r],{version:1,entries:[entry]},{confirmedAliases:{}}),[]);
 assert.ok(audit([{...r,rank:320}],{version:1,entries:[entry]},{confirmedAliases:{}}).length>0);
 assert.ok(audit([{...r,prize:100}],{version:1,entries:[entry]},{confirmedAliases:{}}).length>0);
});
