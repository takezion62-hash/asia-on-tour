'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-mobile-eu-nac-20261126.cjs');
test('ten exact screenshot rows with preserved original UUID and award totals',()=>{
 assert.equal(V.GOLD.length,10);
 const rows=V.GOLD.map(V.project);
 assert.equal(rows.reduce((a,r)=>a+r.prize,0),4550);
 assert.equal(rows.filter(r=>r.player==='Reo').reduce((a,r)=>a+r.prize,0),3800);
 assert.equal(new Set(rows.map(r=>r.id)).size,10);
 assert.equal(rows.find(r=>r.player==='gurabon').playerRaw,V.profiles.gurabon[0]);
 assert.equal(rows.find(r=>r.player==='hazerita_FNM').rank,32);
 const final3=rows.find(r=>r.id==='owner-mobile-20261126-2078');
 assert.deepEqual([final3.date,final3.rank,final3.points,final3.matches,final3.kills,final3.vrs,final3.prize],['2026-02-20',3,294,6,11,1,200]);
 assert.match(final3.source,/S39_MobileTestCup_Final3_EU$/);
 assert.match(final3.note,/2\/26/);
 for(const x of V.GOLD){
  const r=V.project(x),a=V.approval(x);
  assert.equal(V.uuid(r.profileUrl),V.profiles[r.player][1]);
  assert.equal(V.verifyRow(r,a),true);
  for(const patch of [{rank:r.rank+1},{prize:r.prize+50},{player:'someone else'},{profileUrl:'https://example.com'},{kills:r.kills+1}]){
   assert.equal(V.verifyRow({...r,...patch},a),false);
  }
 }
});

test('same-day Touch-Only qualifying and final windows are distinct; same-window and ambiguous evidence remain collisions',()=>{
 const {collision}=require('../scripts/manual-approval-core.cjs');
 const r=V.project(V.GOLD.find(x=>x[0]===2079));
 const q={...r,id:'auto-s39-a5c82740b528',round:'単一開催枠 / 参加確認',kind:'参加確認',prize:null,rank:9,source:'https://www.fortnite.com/competitive/events/S39_MobileTestCup/?region=EU&round=S39_MobileTestCup_Round1_EU'};
 assert.equal(collision(q,r,{}),'');
 assert.equal(collision(r,q,{}),'');
 assert.ok(collision({...q,source:q.source.replace('Round1','Final')},r,{}));
 assert.ok(collision({...q,source:q.source.replace('Round1','Round2')},r,{}));
 assert.ok(collision({...q,source:q.source.replace('www.fortnite.com','example.com')},r,{}));
 const final3=V.project(V.GOLD.find(x=>x[0]===2078));
 const q3={...q,date:final3.date,source:q.source.replace('Round1','Round3')};
 assert.equal(collision(q3,final3,{}),'');
 assert.ok(collision({...q3,source:q3.source.replace('Round3','Final3')},final3,{}));
});
