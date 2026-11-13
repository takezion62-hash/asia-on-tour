'use strict';
// 2024-11-16 JST ME Solo Victory Cup Event 2, Round 2.
// Positive cash is never inferred from a partial leaderboard alone:
// two independently archived Liquipedia player histories confirm one $100 VR
// each; the original Epic-ID leaderboard checkpoint verifies the exact scores.
const fs=require('node:fs');
const path=require('node:path');
const {loadReviewDb,writeReviewDb,verifyEpicReviewEvidence,upsertPublicationLog}=
 require('./reviewed-publication-core.cjs');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const {validateData}=require('./data-checks.cjs');
const ROOT=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
const assert=(x,m)=>{if(!x)throw Error('S32_ME_SOLO_CASH: '+m)};
const rule='https://www.fortnite.com/news/competitive-details-make-your-mark-in-chapter-2-remix';
const event='S32_SoloVictoryCashCup';
const win='S32_SoloVictoryCashCup_Event2Round2_ME';
const spec={date:'2024-11-16',season:'S32',region:'ME',
 tournamentId:'ch5s5-solo-victory-cup',event,window:win};
const official='https://www.fortnite.com/competitive/events/'+event+
 '/?region=ME&round='+win;
const evidence='https://liquipedia.net/fortnite/Chapter_2/Remix/Solo_Victory/Session_2/Middle_East';
const selected=[
 {id:'auto-s32-14ce2adc740a',name:'Nalu',raw:'KIT StL Nalu',
  rank:16,points:100,kills:7,vrs:1,matches:2,
  history:'https://liquipedia.net/fortnite/Nalu/Results'},
 {id:'auto-s32-834f7c4de343',name:'seljuny',raw:'alpha meah引退お疲れ様',
  rank:40,points:100,kills:3,vrs:1,matches:3,
  history:'https://liquipedia.net/fortnite/Seljuny/Results'}
];
function main(){
 const db=loadReviewDb(ROOT);
 const reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 assert(Array.isArray(db.results)&&Array.isArray(db.ledger.entries)&&
  Array.isArray(db.updates.entries)&&Array.isArray(db.reviews.history.proposals)&&
  Array.isArray(reviewed.entries),'invalid source or review index');
 const known=new Set(db.players.candidates.map(x=>x.name));
 const ids=new Set(db.results.map(x=>x.id));
 const approved=new Set(db.ledger.entries.map(x=>x.id));
 const reviewIds=new Set(reviewed.entries.map(x=>x.id));
 const catalog=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
 const statuses=[],records=[];
 for(const t of selected){
  const proposal=db.reviews.history.proposals.filter(p=>p.id===t.id);
  const existing=db.results.filter(r=>r.id===t.id);
  if(!proposal.length&&existing.length===1){
   const old=existing[0];
   assert(old.date===spec.date&&old.region===spec.region&&
    old.tournamentId===spec.tournamentId&&old.player===t.name&&
    old.rank===t.rank&&old.points===100&&old.kills===t.kills&&
    old.vrs===1&&old.prize===100&&old.source===official,
    'published row has changed: '+t.id);
   statuses.push({id:t.id,action:'already-published'});continue;
  }
  assert(proposal.length===1&&!existing.length,'missing/duplicate pending candidate '+t.id);
  const row=proposal[0];
  for(const [k,v] of Object.entries({date:spec.date,region:spec.region,
    seasonId:'S32',chapter:5,season:5,tournamentId:spec.tournamentId,
    event:'Solo Victory Cup Battle Royale',round:'Event 2 · Round 2 / 賞金決勝',
    kind:'賞金決勝',source:official,player:t.name,playerRaw:t.raw,
    rank:t.rank,points:t.points,kills:t.kills,vrs:t.vrs,matches:t.matches,
    prize:null,verified:true}))
   assert(row[k]===v,'candidate field '+k+' differs: '+t.id);
  assert(!row.reviewOnly&&known.has(t.name),'identity or publication state mismatch '+t.id);
  assert(row.points===row.vrs*100&&row.vrs<=row.matches&&
    row.vrs===1&&row.matches<=3,'invalid award evidence '+t.id);
  verifyEpicReviewEvidence(row,spec,{
   requireValid:assert,catalog,known,d:db,
   read:name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8')),
   resultIds:ids,approvedIds:approved,equalCandidate,collision
  });
  const {reviewOnly,reviewReason,teamAccountIds,...record}=row;
  record.prize=100;
  record.note='公式Epic ID・保存済みME Event2 Round2順位表で'+t.rank+
   '位・100pt・'+t.matches+'試合・'+t.kills+
   'K・1VRを照合。2024/11/15現地開催（JST 11/16）。決勝1VR=$100の公式開催ルールと、Liquipediaの'+t.name+
   '個別戦績で賞金$100を独立確認。イベントの歴史的順位一覧と個別履歴に順位差があるため掲載順位はEpic保存行を採用。支払完了は断定しない。規則: '+
   rule+' / 戦績: '+t.history+' / 大会一覧: '+evidence;
  db.results.push(record);ids.add(record.id);records.push(record);
  db.ledger.entries.push({
   id:t.id,decision:'published',recordId:t.id,
   policy:'verified-s32-final-100usd-vr',
   approvedAt:new Date().toISOString(),
   approvedBy:'ChatGPT (user-authorized GitHub integration)',
   rule,source:official,
   evidence:'Saved Epic-ID Event2 Round2 score and 1VR, independent Liquipedia $100 player record: '+t.history
  });
  approved.add(t.id);
  if(!reviewIds.has(t.id)){
   reviewed.entries.push({id:t.id,decision:'published',recordId:t.id,
    reviewedAt:new Date().toISOString(),policy:'verified-s32-final-100usd-vr',
    source:official,officialRules:rule,independentEvidence:t.history});
   reviewIds.add(t.id);
  }
  statuses.push({id:t.id,action:'published',rank:t.rank,prize:100});
 }
 if(records.length){
  const done=new Set(records.map(r=>r.id));
  db.reviews.history.proposals=db.reviews.history.proposals.filter(r=>!done.has(r.id));
  const at=new Date().toISOString();
  const st=db.statuses.history;
  st.found=db.reviews.history.proposals.length;
  st.manualReviewCandidates=st.found;
  st.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  st.manuallyPublished=(st.manuallyPublished||0)+records.length;
  st.lastReviewedBatchAt=at;
  st.latestManualReview={reviewedAt:at,reviewedCandidates:records.length,
   published:records.length,remainingPending:st.found,
   policy:'Exact Epic ID + official $100/VR rules + independent historical payouts'};
  st.message='2024年11月ME Solo Victory Cup決勝'+records.length+
   '件、1VR=$100を独立資料で確認して追加。既存成績は変更なし。';
  db.reviews.history.manualReviewedAt=at;
  reviewed.reviewedAt=at;
  db.ledger.reviewedAt=at;
  upsertPublicationLog(db.updates,{
   id:'s32-me-vcup-e2-final-positive-vr-20261113',
   date:'2026-11-13',
   title:'2024/11/16 ME Solo Victory Cup決勝：賞金確認済み2件を追加',
   description:'Nalu/seljunyのEpic ID・公式Event2 Round2・個別1VR=$100戦績を突合。既存賞金や重複成績は保持。',
   recordIds:records.map(r=>r.id)
  });
 }
 const check=validateData({results:db.results,players:db.players,tournaments:db.tournaments});
 assert(!check.errors.length,'published data failed validation: '+check.errors.slice(0,3).join('; '));
 if(!dry&&records.length){
  // No overwrite of any existing row; publishResults performs a second protection check.
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
   JSON.stringify(reviewed,null,2)+'\n');
 }
 console.log('S32_ME_SOLO_CASH '+JSON.stringify({dry,records:records.length,
  candidates:selected.length,details:statuses,pending:db.reviews.history.proposals.length}));
}
if(require.main===module)main();
module.exports={main};
