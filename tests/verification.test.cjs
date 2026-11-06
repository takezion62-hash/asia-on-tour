'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const audit=require('../verification-core.js');
const record=(id,extra={})=>({
 id,date:'2026-10-01',region:'ME',event:'Solo Victory Cup',
 tournamentId:'solo-vc',player:'選手A',players:['選手A'],
 round:'Event 1 / Round 2',kind:'決勝',source:'https://www.fortnite.com/competitive/events/S42_SoloVictoryCupBR/?region=ME&round=S42_Event1Round2_ME',
 rank:10,points:50,kills:3,vrs:0,prize:0,verified:true,...extra
});
test('データが正常なら警告を作成しない',()=>{
 assert.deepEqual(audit.inspect([record('1')]),[]);
 assert.equal(audit.roundType(record('q',{kind:'予選'})),'qualifier');
 assert.equal(audit.roundType(record('f',{kind:'賞金決勝'})),'final');
});
test('同じIDは完全一致と内容衝突を区別する',()=>{
 const a=record('same');
 const issues=audit.inspect([a,{...a}]);
 assert.equal(issues.filter(x=>x.category==='duplicate').length,1);
 assert.equal(issues[0].title,'同一IDの完全重複');
 const bad=audit.inspect([a,{...a,points:15}]);
 assert.ok(bad.some(x=>x.title==='同一IDの内容が衝突'&&x.severity==='error'));
});
test('異なるラウンドを勝手に同一戦績とは判断しない',()=>{
 const a=record('first',{kind:'予選',round:'Event 1 / Round 1',source:'https://www.fortnite.com/competitive/events/S42_SoloVictoryCupBR/?region=ME&round=S42_Event1Round1_ME'});
 const b=record('second');
 assert.equal(audit.inspect([a,b]).length,0);
 const c=record('third',{round:'Event 2 / Round 2',source:'https://www.fortnite.com/competitive/events/S42_SoloVictoryCupBR/?region=ME&round=S42_Event2Round2_ME'});
 assert.equal(audit.inspect([b,c]).length,0);
});
test('同一開催枠の複数戦績と決勝区分の分裂を検出するが統合しない',()=>{
 const a=record('first');
 const b=record('second',{kind:'賞金決勝',player:'選手B',players:['選手B'],prize:100});
 const issues=audit.inspect([a,b]);
 assert.ok(issues.some(x=>x.category==='split'));
 assert.ok(!issues.some(x=>x.category==='duplicate'));
 const samePlayer=record('third',{rank:8});
 assert.ok(audit.inspect([a,samePlayer]).some(x=>x.category==='duplicate'));
});
test('スキン大会の現金と不正数値は検査し、未確認値nullは許容',()=>{
 const cosmetic=record('skin',{kind:'スキン大会',prize:100});
 assert.ok(audit.inspect([cosmetic]).some(x=>x.category==='format'&&x.severity==='error'));
 assert.equal(audit.inspect([record('unknown',{rank:null,points:null,kills:null,vrs:null,prize:null})]).length,0);
});
test('候補の再出現をまとめ、既存掲載IDと区別する',()=>{
 const one={id:'x',date:'2026-10-02',region:'NAW',player:'選手A'};
 const a=audit.proposals({proposals:[one]},{proposals:[one,{id:'y',date:'2026-10-01',region:'ME',player:'選手B'}]},[record('x')]);
 assert.equal(a.length,2);
 assert.equal(a.find(x=>x.id==='x').alreadyPublished,true);
 assert.equal(a.find(x=>x.id==='y').alreadyPublished,false);
});
test('月地域の掲載件数は調査完了を意味せず候補と独立集計する',()=>{
 const q=[{date:'2026-10-01',region:'ME',alreadyPublished:false}];
 const rows=audit.coverage([record('a'),record('b',{region:'EU'})],q);
 assert.deepEqual(rows.find(x=>x.region==='ME'),{month:'2026-10',region:'ME',published:1,pending:1});
 assert.deepEqual(audit.unregistered([{unmappedEventIds:['X','Y']},{unmappedEventIds:['X','Z']}]),['X','Y','Z']);
});
