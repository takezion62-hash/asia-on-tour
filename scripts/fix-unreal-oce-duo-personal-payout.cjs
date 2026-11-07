'use strict';
// Source-verified fix: $1M Unreal Cup 2025-12-20 OCE 172nd-place
// awarded $100 per duo team, hence $50 per eligible player.
// Epic official Attachment C and Fortnite Tracker "Player Earnings $50" for top 250.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const id='auto-s39-4d5f1e94f897',changeId='fix-unreal-cup-oce-20251220-personal-50';
const source='https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_OCE?page=0&window=S39_1MillionUnrealCup_OCE';
const rule='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules';
const results=read('results.json'),updates=read('updates.json'),ledger=read('history-sync-reviewed.json');
const row=results.find(r=>r.id===id);
assert(row,'Previously verified 172nd-place tournament row is missing');
assert.equal(results.filter(r=>r.id===id).length,1);
assert.deepEqual(row.players,['まいにちフロッパー','mint']);
for(const [k,v] of Object.entries({date:'2025-12-20',region:'OCE',tournamentId:'ch7s1-one-million-unreal-cup',rank:172,
 points:236,prize:100,verified:true}))assert.equal(row[k],v,'Original tournament data changed: '+k);
assert.equal(row.source,'https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=OCE&round=S39_1MillionUnrealCup_OCE');
assert(row.prizePerPlayer==null||row.prizePerPlayer===50,'Unexpected existing personal award amount');
row.prizePerPlayer=50;
row.kind='賞金獲得';
row.note='Epic公式$1 Million Unreal Cup CH7 S1 OCEの101〜250位はデュオチーム合計$100。172位（236pt、23K、1VR）を公式開催枠・本人アカウントと照合。' +
 'Fortnite Trackerの同枠では251位未満のPlayer Earningsは1人$50と明記。個人賞金はまいにちフロッパー・mint各$50として集計。' +
 '支払完了や最終資格審査は別途未確認。Epic公式: '+rule+' 個人額: '+source;
const personalCents=require('./data-checks.cjs').personalCents;
assert.equal(personalCents(row),5000,'Per-person cash sum failed');
assert.equal(row.prizePerPlayer*row.players.length,row.prize,'Team prize allocation does not balance');
if(!updates.entries.some(x=>x.id===changeId)){
 const now=new Date().toISOString();
 updates.entries.unshift({id:changeId,date:now.slice(0,10),type:'site',
  title:'Unreal Cupのデュオ賞金配分を修正',
  description:'2025/12/20 OCE172位のまいにちフロッパー / mint組はチーム$100、個人各$50。Epic公式賞金表とTrackerのPlayer Earningsを照合し、両選手の個人賞金へ各$50を反映。',
  recordIds:[]});
}
const entry=ledger.entries.find(x=>x.id===id&&x.decision==='published');
assert(entry,'Source-backed historical approval missing');
entry.personalAwardCorrection={amount:50,perPlayer:true,source,rule,verifiedAt:'2026-11-07'};
write('results.json',results);write('updates.json',updates);write('history-sync-reviewed.json',ledger);
console.log('UNREAL_PERSONAL_PAYOUT_FIXED '+JSON.stringify({id,teamPrize:row.prize,perPlayer:row.prizePerPlayer,
 names:row.players,recordCount:results.length,personalCents:personalCents(row)}));
