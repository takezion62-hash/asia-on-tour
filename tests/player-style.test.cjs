'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const style=require('../player-style.js');
const tournament={id:'solo-vc',team:'solo',mode:'battle-royale',series:'victory-cup'};
const source=(region,event)=>'https://www.fortnite.com/competitive/events/S42_Demo/?region='+region+'&round=S42_Demo_Event'+event+'Round2_'+region;
const row=(id,extra={})=>({
 id,verified:true,date:'2026-10-01',region:'ME',event:'Solo Victory Cup',
 tournamentId:'solo-vc',seasonId:'S42',player:'A',players:['A'],
 kind:'賞金決勝',round:'Event 1 · Round 2 / 賞金決勝',
 kills:20,vrs:1,matches:5,rank:10,points:50,prize:0,
 source:source('ME',1),...extra
});
const opts={season:'S42',team:'solo',mode:'battle-royale',series:'victory-cup',region:'all'};
const helpers={classify:r=>r._class||tournament,seasonOf:r=>r.seasonId};
const own=(rows,name='A',filters=opts)=>style.analyze(rows,name,filters,helpers);
test('実測試合数を分母に用い、試合数不明を勝手に0扱いしない',()=>{
 const r=own([row('a'),row('b',{matches:null,kills:100,vrs:5,source:source('ME',2)})]);
 assert.equal(r.stats.kpm,4);
 assert.equal(r.stats.vrRate,0.2);
 assert.equal(r.stats.unknownMatchRecords,1);
 assert.equal(r.stats.killMatches,5);
 assert.equal(r.stats.vrMatches,5);
});
test('verifiedでない、reported、partial、reviewOnlyはスタイルに入れない',()=>{
 const r=own([row('a'),row('b',{verified:false}),row('c',{reported:true}),row('d',{partial:true}),row('e',{reviewOnly:true})]);
 assert.equal(r.stats.records,1);
});
test('ID完全重複は一回、IDに矛盾がある場合は双方除外',()=>{
 const x=row('abc'),y=row('def',{source:source('ME',2)});
 assert.equal(own([x,{...x},y]).stats.records,2);
 const r=own([x,{...x,kills:22},y]);
 assert.equal(r.stats.records,1);
 assert.deepEqual(r.conflicts,['abc']);
});
test('同一開催枠の正式成績とアーカイブは二重加算しない',()=>{
 const x=row('regular'),y=row('participation',{participationOnly:true,prEligiblePlayers:['A']});
 const a=own([x,y]);
 assert.equal(a.stats.records,0);
 assert.equal(a.overlapping.length,2);
});
test('同じ日に別Eventなら統合せず別々に集計する',()=>{
 const a=own([row('a'),row('b',{source:source('ME',2),round:'Event 2 · Round 2 / 賞金決勝'})]);
 assert.equal(a.stats.records,2);
 assert.equal(a.stats.kpm,4);
});
test('デュオのキルは個人キルに按分しない',()=>{
 const duo={...tournament,id:'duo',team:'duo'};
 const x=row('duo',{players:['A','B'],player:'A / B',kills:50,matches:10,_class:duo});
 const report=own([x],'A',{...opts,team:'duo'});
 assert.equal(report.stats.kpm,5);
 assert.equal(report.stats.kills,50);
 assert.equal(report.style.key,'unrated');
});
test('比較可能な2地域に3開催枠15試合以上ずつあれば得意地域候補を表示',()=>{
 const results=[];
 for(const region of ['ME','EU'])for(let event=1;event<=3;event++)
   results.push(row(region+event,{
     region,source:source(region,event),round:'Event '+event+' · Round 2 / 賞金決勝',
     kills:region==='ME'?20:5,vrs:region==='ME'?2:0
   }));
 const r=own(results);
 assert.equal(r.affinity.region,'ME');
 assert.equal(r.affinity.qualified,2);
 assert.equal(r.affinity.adaptation.qualifiedRegions,2);
 assert.equal(r.regions.find(x=>x.region==='EU').windows,3);
});
test('参加数だけで得意地域と判定せず、同条件の比較地域が必要',()=>{
 const r=own([row('a')]);
 assert.equal(r.affinity.region,null);
 assert.match(r.affinity.reason,/2つ以上/);
 const s=own([row('a')],'A',{...opts,series:'all'});
 assert.equal(s.affinity.region,null);
 assert.match(s.affinity.reason,/揃える/);
});
test('比較地域の差がわずかなら得意地域を未判定にする',()=>{
 const rows=[];
 for(const region of ['ME','EU'])for(let i=1;i<=3;i++)
   rows.push(row(region+i,{region,source:source(region,i),round:'Event '+i+' · Round 2 / 賞金決勝',kills:10,vrs:1}));
 const r=own(rows);
 assert.equal(r.affinity.region,null);
 assert.match(r.affinity.reason,/10点未満/);
});
test('20人以上の同条件コホートがない場合はレーダーの点数を出さない',()=>{
 const rows=[];for(let i=1;i<=5;i++)rows.push(row('a'+i,{source:source('ME',i),round:'Event '+i+' · Round 2 / 賞金決勝',matches:6}));
 const r=own(rows);
 assert.equal(r.quality.level,'qualified');
 assert.equal(r.style.key,'unrated');
 assert.equal(r.style.attack,undefined);
});
test('20人の同条件サンプルで攻撃・勝利・遠征幅の相対値を生成する',()=>{
 const rows=[];
 for(let p=0;p<20;p++)for(let i=1;i<=5;i++){
   const region=p===0&&i===5?'EU':'ME';
   rows.push(row('p'+p+'-'+i,{player:'P'+p,players:['P'+p],date:'2026-10-'+String(i).padStart(2,'0'),
     region,source:source(region,i),round:'Event '+i+' · Round 2 / 賞金決勝',
     matches:6,kills:p===0?24:6,vrs:p===0?2:0}));
 }
 const r=own(rows,'P0');
 assert.notEqual(r.style.key,'unrated');
 assert.equal(r.style.peers,20);
 assert.ok(r.style.attack>r.style.victory-15);
 assert.ok(Number.isFinite(r.style.breadth));
});
test('未掲載の月は月別推移に0キルの行として挿入しない',()=>{
 const r=own([row('a',{date:'2026-08-01'}),row('b',{date:'2026-10-01',source:source('ME',2)})]);
 assert.deepEqual(r.trend.map(p=>p.month),['2026-08','2026-10']);
});
