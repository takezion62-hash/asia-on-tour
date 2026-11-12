'use strict';
// One-off evidence-checked queue reconciliation. The workflow removes this file
// before proposing a PR; a candidate never gets a prize or rank inferred from
// incomplete outside-source data.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog,verifyEpicReviewEvidence}=require('./reviewed-publication-core.cjs');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const {verifiedPartialPage}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const root=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
const timestamp=new Date().toISOString();
const jst=new Date(Date.parse(timestamp)+9*3600*1000).toISOString().slice(0,10);
const d=loadReviewDb(root);
const before=d.results.length;
const catalog=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const known=new Set(d.players.candidates.map(x=>x.name));
const resultIds=new Set(d.results.map(x=>x.id));
const approvedIds=new Set(d.ledger.entries.map(x=>x.id));
const reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8'));
const reviewedIds=new Set(reviewed.entries.map(x=>x.id));
const knownRecords=new Set(resultIds);
const report={dry,before,selected:0,published:[],held:[],byType:{},ruleSources:[
 'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules'
]};
const stop=(ok,msg)=>{if(!ok)throw Error(msg)};
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const rule30=report.ruleSources[0],rule31=report.ruleSources[1];
// 2024 C5S3 NA (unified region in the official rules) is mapped to NAC.
// No ambiguous NAW or later-season rule mapping is permitted.
const cutoffs=new Map([
 ['S30|ch5s3-solo-victory-cup|ME',2000],
 ['S30|ch5s3-zb-solo-victory|ME',2000],
 ['S30|ch5s3-solo-victory-cup|NAC',5000],
 ['S31|ch5s4-solo-victory-cup|ME',2000]
]);
function classify(row,cat){
 if(row.kind==='参加確認'&&row.reviewOnly===true&&row.prize===null)
  return {kind:'参加確認',round:row.round,prize:null,policy:'attendance-only',
   note:'Epic本人ID・保存済み公式開催枠の順位表で'+row.rank+'位・'+row.points+'pt・'+row.kills+
   'K・'+row.vrs+'VRを確認。参加事実のみ掲載。現金賞金・予選突破・スキン獲得は未確認。'};
 const cutoff=cutoffs.get([row.seasonId,row.tournamentId,row.region].join('|'));
 if(row.kind==='予選'&&row.prize===0&&row.reviewOnly!==true&&cutoff!==undefined){
  stop(cat.team==='solo'&&row.round.includes('Round 1 / 予選')&&row.matches<=7,'予選形式・試合数の検証不足');
  stop(row.rank<=cutoff,'公式予選突破順位の対象外');
  const rule=row.seasonId==='S30'?rule30:rule31;
  return {kind:'予選',round:row.round.replace(/\/ 予選$/,'/ 予選突破'),prize:0,
   policy:'verified-rule',rule,
   note:'Epic公式規則の'+row.region+'上位'+cutoff+'名がRound 2に進出。保存済み本人Epic ID・公式順位表の'+
   row.rank+'位（'+row.points+'pt・'+row.kills+'K・'+row.vrs+'VR）を照合。予選賞金$0。規則: '+rule};
 }
 if(row.kind==='賞金決勝'&&row.seasonId==='S31'&&row.region==='NAC'&&
    row.tournamentId==='ch5s4-solo-victory-cup'&&
    row.prize===null&&row.vrs===0&&row.points===0){
  stop(cat.team==='solo'&&row.matches<=3&&row.round.includes('Round 2 / 賞金決勝'),'決勝ラウンドまたは試合数不一致');
  return {kind:'賞金決勝',round:row.round,prize:0,policy:'verified-rule',rule:rule31,
    note:'本人Epic IDと公式決勝順位表で'+row.rank+'位・0VRを確認。2024年C5S4公式規則ではRound 2のVRのみ賞金対象。0VRにつき賞金$0。規則: '+rule31};
 }
 throw Error('公式規則で掲載区分と賞金を安全に確定できない候補');
}
function prove(row){
 stop(/^auto-s\d+-[0-9a-f]{12}$/.test(row.id)&&row.verified===true,'照合IDまたは本人フラグ不正');
 stop(!knownRecords.has(row.id)&&!approvedIds.has(row.id)&&!reviewedIds.has(row.id),'既に掲載・審査済み');
 const source=new URL(row.source);
 const m=source.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
 stop(source.protocol==='https:'&&source.hostname==='www.fortnite.com'&&m,'出典ホスト・イベント形式が不正');
 const event=decodeURIComponent(m[1]),window=source.searchParams.get('round'),cat=catalog.get(row.tournamentId);
 stop(cat&&cat.seasonId===row.seasonId&&cat.sourceEventIds.includes(event),'大会マスター不一致');
 const team=Array.isArray(row.players)&&row.players.length?row.players:[row.player];
 stop(team.length==={solo:1,duo:2,trio:3,squad:4}[cat.team]&&team.every(x=>known.has(x)),'選手名鑑照合不一致');
 const month=row.date.slice(0,7);
 if(!d.calendar[month])d.calendar[month]=read('calendar-history/'+month+'.json').sessions;
 const session=d.calendar[month].find(x=>x.sourceWindowId===window&&x.region===row.region
  &&x.tournamentId===row.tournamentId&&x.dateJst===row.date&&x.seasonId===row.seasonId&&x.eventId===event);
 stop(session&&Number.isFinite(Date.parse(session.endUtc)),'公式大会カレンダー開催枠と不一致');
 const key='epicgames_'+event+'_'+row.region+'/'+window;
 const checkpoint=Object.values(d.scans).map(s=>s.windows?.[key]).find(Boolean);
 stop(checkpoint,'本人ID付き元の順位表チェックポイントがない');
 const context={requireValid:stop,catalog,known,d,read,resultIds,approvedIds,equalCandidate,collision};
 verifyEpicReviewEvidence(row,{date:row.date,region:row.region,tournamentId:row.tournamentId,season:row.seasonId,event,window},context);
 // Strictly require fully scanned OR continuous mature pages containing the
 // exact observed rank with no error/retry conditions.
 stop(checkpoint.complete===true||verifiedPartialPage(row,{end:Date.parse(session.endUtc)},checkpoint),
  '順位表の連続ページ・成熟時刻・再試行状態が未確認');
 stop(checkpoint.rankingOrderValid===true,'元の順位表が不整合');
 return cat;
}
for(const origin of ['history','auto']){
 const queue=d.reviews[origin].proposals.slice();
 for(const row of queue){
  report.selected++;
  try{
   const cat=prove(row);
   const type=classify(row,cat);
   const {reviewOnly,reviewReason,teamAccountIds,...source}=row;
   const record={...source,kind:type.kind,round:type.round,prize:type.prize,note:type.note};
   stop(!d.results.some(x=>collision(x,record,d.players.confirmedAliases||{})),'同一大会・選手の重複');
   stop(!resultIds.has(record.id),'同じ戦績IDが既存');
   d.results.push(record);
   resultIds.add(record.id);
   knownRecords.add(record.id);
   d.reviews[origin].proposals=d.reviews[origin].proposals.filter(x=>x.id!==row.id);
   d.ledger.entries.push({
    id:row.id,decision:'published',recordId:row.id,policy:type.policy,
    approvedAt:timestamp,approvedBy:'Evidence-reviewed GitHub Actions',
    rule:type.rule||null,source:row.source,
    evidence:'Original saved Epic-ID leaderboard rank/score, exact official calendar session and source URL; mature and continuous checkpoint; no inferred prize or cosmetic reward'
   });
   report.published.push({id:row.id,player:row.player,date:row.date,region:row.region,
    rank:row.rank,kills:row.kills,vrs:row.vrs,prize:record.prize,kind:record.kind,policy:type.policy});
   report.byType[type.policy]=(report.byType[type.policy]||0)+1;
  }catch(error){
   report.held.push({id:row.id,player:row.player,reason:error.message.slice(0,200)});
  }
 }
 if(queue.length!==d.reviews[origin].proposals.length){
  d.reviews[origin].manualReviewedAt=timestamp;
  d.statuses[origin].found=d.reviews[origin].proposals.length;
  d.statuses[origin].manualReviewCandidates=d.reviews[origin].proposals.length;
  d.statuses[origin].reviewOnlyCandidates=d.reviews[origin].proposals.filter(x=>x.reviewOnly).length;
 }
}
if(report.published.length){
 const errors=validateData({results:d.results,players:d.players,tournaments:d.tournaments});
 stop(errors.errors.length===0,'掲載後の形式検証に失敗: '+JSON.stringify(errors.errors.slice(0,8)));
 d.ledger.reviewedAt=timestamp;
 upsertPublicationLog(d.updates,{
  id:'pending-evidence-verified-20261113',date:jst,
  title:'確認待ち候補の本人ID・公式順位表・大会規則を再照合して'+report.published.length+'件を掲載',
  description:'保存済みEpic ID・公式開催枠・成熟した順位表に基づく掲載。Solo Victory Cup予選突破は2024年の公式通過順位で確定し、現金賞金は$0。参加のみは未確定賞金nullを維持。既存戦績の重複防止。',
  recordIds:report.published.map(x=>x.id)
 });
}
report.after=d.results.length;
console.log('AOT_REVIEW_QUEUE_RESULT '+JSON.stringify(report));
if(!dry&&report.published.length){
 writeReviewDb(root,d);
}
if(!report.published.length){
 console.error('No fully verified queue candidates; all held for further evidence');
 process.exitCode=2;
}
