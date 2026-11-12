'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {classifyS43SquadsQualifier,advance,RULE}=require('../scripts/squads-qualifier-rules.cjs');
const make=(rank,region='ME')=>({
 id:'auto-s43-demo12345678',date:'2026-11-10',region,
 seasonId:'S43',tournamentId:'ch7s5-squads-victory-cup',
 event:'Squads Victory Cup Battle Royale',
 kind:'予選',round:'Event 1 · Round 1 / 予選',prize:0,verified:true,
 player:'A / B / C / D',players:['A','B','C','D'],
 rank,points:300,kills:56,vrs:2,matches:8
});
const spec={type:'squad-qual',season:'S43',event:'S43_SquadsVictoryCup',rule:RULE};
test('Epic公式2026 S43 Squad各地域の通過枠を一切推定せず保持',()=>{
 assert.deepEqual({...advance},{EU:300,NAC:200,NAW:120,BR:120,ME:120,OCE:120,ASIA:120});
 assert.equal(RULE,'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-squads-victory-cup-chapter-7-mini-season-official-rules');
});
test('ME予選1〜120位は予選突破・賞金0、121位以降は通過扱いにしない',()=>{
 for(const rank of [1,24,42,65,102,120]){
  const original=make(rank),result=classifyS43SquadsQualifier(original,spec);
  assert.equal(result.kind,'予選');assert.equal(result.prize,0);
  assert.equal(result.policy,'verified-rule');
  assert.match(result.round,/\/ 予選突破$/);
  assert.match(result.note,/上位120チーム以内/);
  assert.equal(original.round,'Event 1 · Round 1 / 予選','classification must not mutate candidate');
 }
 for(const rank of [121,169,282,318,395,478,619,1500]){
  const result=classifyS43SquadsQualifier(make(rank),spec);
  assert.equal(result.kind,'予選');
  assert.equal(result.policy,'verified-rule');
  assert.equal(result.round,'Event 1 · Round 1 / 予選');
  assert.equal(result.prize,0);
  assert.match(result.note,/進出対象外/);
  assert.doesNotMatch(result.round,/予選突破/);
 }
});
test('地域別上位300・200・120の差も崩さない',()=>{
 assert.equal(classifyS43SquadsQualifier(make(290,'EU'),spec).policy,'verified-rule');
 assert.equal(classifyS43SquadsQualifier(make(201,'NAC'),spec).policy,'verified-rule');
 assert.equal(classifyS43SquadsQualifier(make(200,'NAC'),spec).policy,'verified-rule');
 assert.equal(classifyS43SquadsQualifier(make(121,'OCE'),spec).policy,'verified-rule');
});
test('未検証のEpic IDや賞金・不正チーム人数・超過試合を拒否',()=>{
 const cases=[
  {...make(24),verified:false},{...make(24),prize:null},{...make(24),prize:200},
  {...make(24),matches:9},{...make(24),players:['A','B','C']},
  {...make(24),players:['A','B','C','A']},{...make(24),kind:'賞金決勝'},
  {...make(24),round:'Event 1 · Round 2 / 賞金決勝'},
  {...make(24),rank:0},{...make(24),points:-1},{...make(24),vrs:9},
  {...make(24),seasonId:'S42'}
 ];
 for(const row of cases)assert.throws(()=>classifyS43SquadsQualifier(row,spec),/original row invalid/);
 assert.throws(()=>classifyS43SquadsQualifier(make(24),{...spec,event:'S42_ReloadDuosVictoryCup'}),/original row invalid/);
});
test('既存の公式順位表・Epic本人ID・重複検証が適用される掲載フローにだけ接続',()=>{
 const root=path.resolve(__dirname,'..');
 const script=fs.readFileSync(path.join(root,'scripts/publish-verified-nov11-round2.cjs'),'utf8');
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/history-sync.yml'),'utf8');
 assert.match(script,/classifyS43SquadsQualifier\(r,spec\)/);
 assert.match(script,/verifyEpicReviewEvidence\(r,spec,/);
 assert.match(script,/collision,equalCandidate/);
 assert.match(script,/'2026-11-10','ME','S43_SquadsVictoryCup','Event1_Round1'/);
 assert.match(script,/getEvidence\(r,spec\)/);
 assert.match(workflow,/node scripts\/publish-verified-nov11-round2\.cjs --dry-run/);
 assert.match(workflow,/node scripts\/publish-verified-nov11-round2\.cjs\s*$/m);
 assert.match(workflow,/npm run validate/);
 assert.match(workflow,/git push origin HEAD:main/);
});
test('10チームの旧候補は確認待ちか掲載済みの一方だけに存在し金額推測なし',()=>{
 const root=path.resolve(__dirname,'..');
 const rows=require('./production-results.cjs');
 const reviews=JSON.parse(fs.readFileSync(path.join(root,'auto-sync-review.json'),'utf8')).proposals;
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'approval-history.json'),'utf8')).entries;
 const ids=[
  ['auto-s43-d3538338b8fe',24],['auto-s43-5fcc6d8b3931',42],
  ['auto-s43-be9116cc1ad0',65],['auto-s43-a6df3a5700b1',102],
  ['auto-s43-8c0050328153',169],['auto-s43-ff744a52959d',282],
  ['auto-s43-1ad2c6310dbb',318],['auto-s43-99c85ee55f83',395],
  ['auto-s43-e00af0523abb',478],['auto-s43-6d7877cf1fdf',619]
 ];
 for(const [id,rank] of ids){
  const matches=rows.filter(r=>r.id===id),pending=reviews.filter(r=>r.id===id);
  assert.equal(matches.length+pending.length,1,'candidate must be pending or uniquely published: '+id);
  if(matches.length){
   const row=matches[0];
   assert.equal(row.rank,rank);
   assert.equal(row.kind,'予選');
   assert.equal(row.prize,0);
   assert.equal(row.verified,true);
   assert.equal(row.players.length,4);
   assert.equal(row.round.includes('予選突破'),rank<=120);
   assert.ok(ledger.some(x=>x.id===id&&x.decision==='published'),'approval ledger must remain: '+id);
  }
 }
});
