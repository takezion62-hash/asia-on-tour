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
