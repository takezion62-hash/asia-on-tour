'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {loadData,validateData,tournamentFor,personalCents}=require('../scripts/data-checks.cjs');
const AotPR=require('../aot-pr.js');
const data=loadData(path.join(__dirname,'..')).data;
const money=rows=>rows.reduce((sum,row)=>sum+Math.round((personalCents(row)||0)),0);
const prefix=round=>String(round||'').match(/(?:Event|Day|Week|Session)\s*\d+.*?(?:Round\s*[12]|Final)/i)?.[0]||String(round||'').split('/')[0].trim();

test('Prize-eligible finals share one named round independently of the player payout',()=>{
 const groups=new Map();
 for(const row of data.results){
  const series=tournamentFor(row,data)?.series;
  if(!['victory-cup','cash-cup','unreal-cup','playstation-cup'].includes(series)||
    !['決勝','賞金決勝'].includes(row.kind)||!/Round\s*2|Final|Session\s*1/i.test(row.round))continue;
  assert.equal(row.kind,'賞金決勝',row.id);
  assert.match(row.round,/\/\s*賞金決勝(?:（Event番号未確認）)?$/u,row.id);
  const key=[row.date,row.region,row.tournamentId||row.event,prefix(row.round)].join('|');
  if(!groups.has(key))groups.set(key,new Set());
  groups.get(key).add(row.kind+'|'+row.round);
 }
 for(const [key,stages] of groups)assert.equal(stages.size,1,key);
 assert.ok(groups.size>20,'Historical final sessions remain represented');
});

test('Cash totals, rank, IDs and confirmed qualifier evidence remain independent from labels',()=>{
 const rows=data.results;
 assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
 assert.ok(money(rows)>=0);
 const official=data.results.find(x=>x.id==='s42-naw-solo-vc-qual-20260906-tonightreet');
 assert.ok(official);
 assert.equal(official.round,'Event 1 · Round 1 / 予選通過');
 assert.match(official.note,/予選突破/);
 assert.ok(AotPR.qualificationEvidence(official,tournamentFor(official,data)),'Existing qualifier proof is still recognized');
});

test('Validation rejects splitting the same prize final by payout and checks trio rosters',()=>{
 const sample=data.results.find(x=>x.kind==='賞金決勝'&&x.verified===true
   &&x.prize>0&&tournamentFor(x,data)?.series==='victory-cup'
  &&/(?:Round\s*2|Final|Session\s*1)/i.test(x.round)
  &&/\/\s*賞金決勝(?:（Event番号未確認）)?$/u.test(x.round));
 assert.ok(sample,'cash-final fixture');
 for(const [patch,field] of [
   [{kind:'決勝'},'kind'],
   [{round:sample.round.replace(/\/\s*賞金決勝$/u,'/ 決勝（賞金なし）')},'round']
 ]){
  const copy=structuredClone(data);
  const row=copy.results.find(z=>z.id===sample.id);
  Object.assign(row,patch);
  assert.ok(validateData(copy).errors.some(e=>e.id===row.id&&e.field===field),
    'Validator must reject '+field);
 }
 const trio=data.results.find(x=>x.players?.length===3&&tournamentFor(x,data)?.team==='trio');
 assert.ok(trio,'verified trio fixture');
 const copy=structuredClone(data),row=copy.results.find(x=>x.id===trio.id);
 row.players=row.players.slice(0,2);row.player=row.players.join(' / ');delete row.profiles;
 assert.ok(validateData(copy).errors.some(e=>e.id===row.id&&e.field==='players'&&e.message.includes('トリオ')));
});
