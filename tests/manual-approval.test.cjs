'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {apply,collision,parseIds}=require('../scripts/manual-approval-core.cjs');
const id='auto-s42-aaaaaaaaaaaa',otherId='auto-s42-bbbbbbbbbbbb';
const makeRow=(extra={})=>({
  id,date:'2026-09-22',region:'ME',player:'A',playerRaw:'A',
  event:'Demo Evaluation',tournamentId:'demo-evaluation',seasonId:'S42',
  chapter:7,season:4,round:'Event 1 · Round 1 / 参加確認',
  rank:60,points:180,kills:6,vrs:0,matches:6,prize:null,kind:'参加確認',
  source:'https://www.fortnite.com/competitive/events/S42_DemoEvaluation/?region=ME&round=S42_DemoEvaluation_Event1Round1_ME',
  verified:true,reviewOnly:true,note:'本人確認済み',...extra
});
const fixture=(rows=[makeRow()])=>{
  const scan={windows:{}},sessions=[];
  for(const r of rows){
    const u=new URL(r.source),win=u.searchParams.get('round');
    const key='epicgames_S42_DemoEvaluation_ME/'+win;
    if(!scan.windows[key])scan.windows[key]={nextPage:3,complete:true,proposals:[]};
    scan.windows[key].proposals.push({...r});
    if(!sessions.some(x=>x.sourceWindowId===win))sessions.push({sourceWindowId:win,eventId:'S42_DemoEvaluation',
      seasonId:'S42',dateJst:r.date,region:r.region,tournamentId:r.tournamentId});
  }
  return {
    results:[],players:{candidates:[{name:'A'},{name:'B'}],confirmedAliases:{}},
    tournaments:{catalog:[{id:'demo-evaluation',name:'Demo Evaluation',seasonId:'S42',team:'solo',
      sourceEventIds:['S42_DemoEvaluation'],series:'performance-evaluation'}]},
    reviews:{auto:{version:1,proposals:[]},history:{version:1,proposals:rows}},
    scans:{auto:{windows:{}},history:scan},
    statuses:{auto:{found:0},history:{found:rows.length}},
    ledger:{version:1,entries:[]},updates:{entries:[]},
    calendar:{'2026-09':sessions}
  };
};
const input=(ids=[id],policy='attendance-only')=>({ids,policy,confirmation:'CONFIRM',timestamp:'2026-11-06T05:00:00.000Z',runId:'unit-1'});
test('ID入力は20件上限・重複拒否・パスのような文字列を拒否する',()=>{
 assert.deepEqual(parseIds(id),[id]);
 assert.deepEqual(parseIds(id+' , '+otherId),[id,otherId]);
 assert.throws(()=>parseIds([id,id]),/二重/);
 assert.throws(()=>parseIds('../secrets'),/形式/);
 assert.throws(()=>parseIds([]),/1〜20/);
});
test('出場確認だけを公開候補化し、既存戦績・賞金・順位は保持',()=>{
 const db=fixture(),before=JSON.stringify(db),r=apply(db,input());
 assert.equal(r.changes.length,1);
 assert.equal(r.next.results.length,1);
 assert.equal(r.next.results[0].kind,'参加確認');
 assert.equal(r.next.results[0].prize,null);
 assert.equal(r.next.results[0].reviewOnly,undefined);
 assert.equal(r.next.results[0].rank,60);
 assert.equal(r.next.reviews.history.proposals.length,0);
 assert.equal(r.next.statuses.history.found,0);
 assert.equal(r.next.ledger.entries[0].policy,'attendance-only');
 assert.equal(r.next.updates.entries[0].recordIds[0],id);
 assert.equal(JSON.stringify(db),before,'planner must not mutate original data');
});
test('同じ候補IDの再掲載は拒否し、処理済み候補のみなら無変更',()=>{
 const db=fixture();
 db.results=[{...makeRow(),kind:'参加確認',reviewOnly:undefined}];
 assert.throws(()=>apply(db,input()),/既存戦績と衝突/);
 db.reviews.history.proposals=[];
 const plan=apply(db,input());
 assert.equal(plan.changes.length,0);
 assert.equal(plan.skipped.length,1);
});
test('既存の同日・同大会・同一選手・同じラウンドは別IDでも拒否',()=>{
 const db=fixture();
 db.results=[{...makeRow({id:otherId}),reviewOnly:undefined}];
 assert.throws(()=>apply(db,input()),/重複・開催枠/);
});
test('同じ開催日でもEvent番号が違えば別戦績',()=>{
 const a=makeRow({id:'previous',round:'Event 2 · Round 1 / 参加確認',
  source:'https://www.fortnite.com/competitive/events/S42_DemoEvaluation/?region=ME&round=S42_DemoEvaluation_Event2Round1_ME'});
 assert.equal(collision(a,makeRow(),{}),'');
});
test('開催枠が識別できない既存レコードは推測で統合しない',()=>{
 const a=makeRow({id:'legacy',round:'出場確認',source:'https://fortnitetracker.com/events/unknown'});
 assert.match(collision(a,makeRow(),{}),/ラウンド識別不足/);
});
test('候補とスキャンの順位が違えば中断',()=>{
 const db=fixture();
 db.scans.history.windows[Object.keys(db.scans.history.windows)[0]].proposals[0].rank=61;
 assert.throws(()=>apply(db,input()),/内容が異なる/);
});
test('大会カタログや開催日時・地域を確認できなければ中断',()=>{
 const db=fixture();
 db.calendar['2026-09'][0].dateJst='2026-09-23';
 assert.throws(()=>apply(db,input()),/カレンダー/);
});
test('未確認賞金・予選突破・スキン報酬を承認だけで確定できない',()=>{
 const winner=fixture([makeRow({prize:100})]);
 assert.throws(()=>apply(winner,input()),/出場確認専用/);
 const unknown=fixture([makeRow({kind:'賞金決勝'})]);
 assert.throws(()=>apply(unknown,input()),/出場確認専用/);
 const unknownRule=fixture();
 assert.throws(()=>apply(unknownRule,input([id],'verified-rule')),/公式規則による承認条件/);
});
test('確認チェックなし・不明な候補・処理済みIDは停止',()=>{
 assert.throws(()=>apply(fixture(),{...input(),confirmation:'NO'}),/CONFIRM/);
 assert.throws(()=>apply(fixture(),input(['auto-s42-cccccccccccc'])),/存在しない/);
 const db=fixture();db.ledger.entries.push({id,decision:'published'});
 assert.throws(()=>apply(db,input()),/処理済み/);
});
