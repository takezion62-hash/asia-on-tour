'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const growth=require('../growth.js');
const row=(id,date,overrides={})=>({
 id,date,verified:true,player:'Hero',players:['Hero'],event:'Solo Victory Cup Battle Royale',
 kind:'予選',region:'ME',rank:30,kills:4,vrs:0,prize:0,seasonId:'S42',...overrides
});
const opts={
 player:'Hero',
 cash:r=>r.kind==='賞金決勝'?r.prize||0:0,
 prizeFinalRank:r=>r.kind==='賞金決勝'&&Number.isInteger(r.rank)&&r.rank>0?r.rank:null,
 season:r=>({id:r.seasonId||'unknown',label:r.seasonId==='S42'?'CH7 S4':r.seasonId==='S41'?'CH7 S3':'未確認'}),
 prScore:rows=>rows.reduce((sum,r)=>sum+(r.verified&&r.rank>0?Math.round(100/Math.sqrt(r.rank)):0),0)
};
test('growth engine exports four metrics and validates real calendar dates',()=>{
 assert.equal(growth.VERSION,1);
 assert.deepEqual(growth.METRICS.map(x=>x.id),['pr','cash','finals','podiums']);
 for(const date of ['2026-02-30','2026-13-01','2026-00-01','invalid','2026-1-2'])assert.equal(growth.validDate(date),false,date);
 for(const date of ['2024-02-29','2026-01-31','2026-11-04'])assert.equal(growth.validDate(date),true,date);
});
test('monthly graph fills missing archive months as zero-record flat-line rather than inferred activities',()=>{
 const rows=[row('a','2026-01-09',{kind:'賞金決勝',rank:2,prize:100}),
             row('b','2026-03-08',{kind:'賞金決勝',rank:3,prize:250})];
 const r=growth.periods(rows,'month',opts);
 assert.equal(r.recordCount,2);
 assert.deepEqual(r.points.map(p=>p.key),['2026-01','2026-02','2026-03']);
 assert.deepEqual(r.points.map(p=>p.records),[1,0,1]);
 assert.deepEqual(r.points.map(p=>p.period.cash),[100,0,250]);
 assert.deepEqual(r.points.map(p=>p.cumulative.cash),[100,100,350]);
 assert.deepEqual(r.points.map(p=>p.period.finals),[1,0,1]);
 assert.deepEqual(r.points.map(p=>p.cumulative.finals),[1,1,2]);
 assert.deepEqual(r.points.map(p=>p.period.podiums),[1,0,1]);
 assert.deepEqual(r.points.map(p=>p.cumulative.podiums),[1,1,2]);
 assert.deepEqual(growth.series(r,'cash','period').map(p=>p.value),[100,0,250]);
 assert.deepEqual(growth.series(r,'cash','cumulative').map(p=>p.value),[100,100,350]);
});
test('AOT PR uses prefix recomputation, with non-negative period increment and matching final snapshot',()=>{
 const rows=[row('a','2026-01-01',{rank:4}),row('b','2026-02-01',{rank:1}),row('c','2026-02-05',{rank:25})];
 const r=growth.periods(rows,'month',opts);
 assert.deepEqual(r.points.map(x=>x.cumulative.pr),[50,170]);
 assert.deepEqual(r.points.map(x=>x.period.pr),[50,120]);
 assert.equal(r.points.at(-1).cumulative.pr,opts.prScore(rows));
});
test('season graph uses explicit season identity, not event-date year or inferred season number',()=>{
 const rows=[
  row('old','2026-07-01',{seasonId:'S41',kind:'賞金決勝',rank:1,prize:10}),
  row('new','2026-09-01',{seasonId:'S42',kind:'賞金決勝',rank:2,prize:20}),
  row('unknown','2026-10-01',{seasonId:'unknown',kind:'賞金決勝',rank:2,prize:100})
 ];
 const r=growth.periods(rows,'season',opts);
 assert.deepEqual(r.points.map(x=>x.key),['S41','S42']);
 assert.deepEqual(r.points.map(x=>x.label),['CH7 S3','CH7 S4']);
 assert.equal(r.recordCount,3);
 assert.equal(r.chartedRecords,2);
 assert.equal(r.omittedRecords,1);
 assert.deepEqual(r.points.map(x=>x.cumulative.cash),[10,30]);
});
test('only exact roster matching, verified and valid IDs/dates contribute; conflicting duplicate IDs excluded',()=>{
 const rows=[
  row('valid','2026-10-01'),
  row('not-verified','2026-10-01',{verified:false,prize:1000}),
  row('other','2026-10-02',{player:'NotHero',players:['NotHero'],prize:1000}),
  row('wrong-date','2026-02-30'),
  row('dupe','2026-10-03',{rank:2}),row('dupe','2026-10-03',{rank:10}),
  {...row('valid','2026-10-01')},
  row('','2026-10-02')
 ];
 const r=growth.periods(rows,'month',opts);
 assert.equal(r.recordCount,1);
 assert.equal(r.points.length,1);
 assert.equal(r.points[0].records,1);
 assert.equal(r.points[0].cumulative.cash,0);
});
test('confirmed personal cash only and strict prize-final podiums, Practice finals count as participation',()=>{
 const rows=[
  row('team','2026-10-01',{players:['Hero','Pair'],player:'Hero / Pair',kind:'賞金決勝',prize:500,prizePerPlayer:null,rank:1}),
  row('practice','2026-10-03',{kind:'Practice決勝',rank:3,prize:0}),
  row('paid','2026-10-04',{kind:'賞金決勝',rank:2,prize:125})
 ];
 const cash=r=>r.kind!=='賞金決勝'?0:r.players.length===1?r.prize:Number.isFinite(r.prizePerPlayer)?r.prizePerPlayer:0;
 const r=growth.periods(rows,'month',{...opts,cash});
 assert.equal(r.points[0].cumulative.cash,125);
 assert.equal(r.points[0].cumulative.finals,3);
 assert.equal(r.points[0].cumulative.podiums,2);
});
test('no verified results yields clear empty chart data and no false zero-value period',()=>{
 const r=growth.periods([row('x','2026-10-04',{verified:false})],'month',opts);
 assert.equal(r.points.length,0);
 assert.equal(r.recordCount,0);
 assert.deepEqual(growth.series(r,'cash'),[]);
});
