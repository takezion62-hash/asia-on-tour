'use strict';
// Narrow, repeatable review round: original Epic-ID scores and an official session
// are mandatory. Unconfirmed rewards remain null, not zero.
const path=require('node:path'),crypto=require('node:crypto');
const {createPublicationFiles}=require('./reviewed-publication-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {read,write}=createPublicationFiles(path.resolve(__dirname,'..'));
const dry=process.argv.includes('--dry-run'),now=new Date().toISOString();
const RULE42='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules';
const RULE30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const RULE31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const data={
 results:read('results.json'),
 reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
 scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')},
 statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
 reviewed:read('history-sync-reviewed.json'),ledger:read('approval-history.json'),
 updates:read('updates.json'),players:read('players.json'),tournaments:read('tournaments.json')
};
const calendar={},catalog=new Map(data.tournaments.catalog.map(x=>[x.id,x]));
const known=new Set(data.players.candidates.map(x=>x.name)),aliases=data.players.confirmedAliases||{};
const recorded=new Set(data.results.map(x=>x.id));
const processed=new Set(data.reviewed.entries.map(x=>x.id));
const approved=new Set(data.ledger.entries.map(x=>x.id));
const selected=[...data.reviews.auto.proposals.map(r=>({r,origin:'auto'})),...data.reviews.history.proposals.map(r=>({r,origin:'history'}))];
const added=[],held=[],scopeCounts={auto:0,history:0};
const cutoffRules={
 'ch7s4-console-zero-build-solo-victory-cup':{season:'S42',event:'S42_ConsoleVCC_SolosZB',regions:{EU:2000,NAC:2000,OCE:1000,ME:1000,NAW:1000,BR:1000},cap:8,rule:RULE42},
 'ch7s4-solo-reload-victory-cup':{season:'S42',event:'S42_ReloadReloadSoloVictoryCup',regions:{EU:1600,NAC:800,OCE:320,ME:320,NAW:320,BR:320},cap:8,rule:RULE42},
 'ch5s4-solo-victory-cup':{season:'S31',event:'S31_SoloVictoryCashCup',regions:{ME:2000,OCE:1500,BR:2500,EU:15000},cap:7,rule:RULE31},
 'ch5s3-solo-victory-cup':{season:'S30',event:'S30_SoloVictoryCashCup',regions:{NAC:5000,OCE:2000,ME:2000,EU:7000,BR:2000},cap:7,rule:RULE30}
};
function requireValid(ok,msg){if(!ok)throw Error(msg)}
function classify(r){
 if(r.kind==='参加確認'&&r.reviewOnly===true&&r.prize===null&&r.matches<=20){
  return {policy:'attendance-only',kind:'参加確認',round:r.round,prize:null,fullRequired:false,
    rule:null,note:'本人Epic IDと公式開催日・地域・出典の保存済み順位表で参加・順位・得点・キル・VRを確認。現金賞金・進出・スキン獲得は未確認。出典: '+r.source};
 }
 const q=cutoffRules[r.tournamentId];
 if(r.kind==='予選'&&q&&q.season===r.seasonId&&q.regions[r.region]&&r.prize===0
     &&r.round.includes('Round 1 / 予選')&&r.matches<=q.cap){
  const passed=r.rank<=q.regions[r.region];
  return {policy:'verified-rule',kind:'予選',
    round:r.round.replace(/\/\s*予選$/,'/ '+(passed?'予選突破':'予選')),prize:0,
    fullRequired:false,rule:q.rule,
    note:'Epic公式順位表と本人IDで予選'+r.rank+'位、'+r.points+'pt、'+r.kills+'K、'+r.vrs+'VRを確認。'
      +(passed?'公式上位'+q.regions[r.region]+'名以内で予選突破。':'進出上限は'+q.regions[r.region]+'位、突破実績には加算しない。')
      +'予選現金賞金$0。規則: '+q.rule};
 }
 if(r.kind==='賞金決勝'&&r.prize===null&&r.matches>=1&&r.matches<=3&&r.round.includes('Round 2 / 賞金決勝')){
  let rule=null;
  if(r.seasonId==='S42'&&[
   'ch7s4-console-zero-build-solo-victory-cup',
   'ch7s4-solo-reload-victory-cup',
   'ch7s4-reload-duos-victory-cup'
  ].includes(r.tournamentId))rule=RULE42;
  if(rule&&r.vrs===0&&r.points===0)
   return {policy:'verified-rule',kind:'賞金決勝',round:r.round,prize:0,fullRequired:true,rule,
     note:'Epic本人ID・開催枠・全ページ取得済み決勝順位表で'+r.rank+'位、'+r.kills+'K、0VRを確認。公式規則は決勝のVR獲得時のみ現金賞金が発生するため$0。支払・本人資格審査とは区別。規則: '+rule};
  if(r.seasonId==='S30'&&r.tournamentId==='ch5s3-zb-solo-victory'&&r.region==='ME'
     &&r.date==='2024-07-30'&&r.vrs===1&&r.points===100)
   return {policy:'official-final-vr-award',kind:'賞金決勝',round:r.round,prize:100,fullRequired:true,rule:RULE30,
     note:'2024年ME Zero Build Solo Victory Cash Cup決勝で公式順位表の1VRと100ptを確認。Epic公式の決勝1VR=$100に基づく個人賞金。支払済みの主張ではない。規則: '+RULE30};
 }
 return null;
}
function verify(r,origin,choice){
 requireValid(r&&r.verified===true&&/^auto-s\d+-[a-z0-9]{12}$/.test(r.id||''),'unverified Epic candidate');
 requireValid(!recorded.has(r.id)&&!processed.has(r.id)&&!approved.has(r.id),'already published/reviewed ID');
 const cat=catalog.get(r.tournamentId);
 requireValid(cat&&cat.name===r.event&&cat.seasonId===r.seasonId&&cat.series,'catalog mismatch');
 const members=Array.isArray(r.players)&&r.players.length?r.players:[r.player];
 const expected={solo:1,duo:2,trio:3,squad:4}[cat.team];
 requireValid(members.length===expected&&new Set(members).size===expected
   &&members.every(x=>known.has(x))&&members.join(' / ')===r.player,'unverified Epic roster');
 requireValid(Number.isSafeInteger(r.rank)&&r.rank>0
   &&Number.isSafeInteger(r.points)&&r.points>=0
   &&Number.isSafeInteger(r.kills)&&r.kills>=0
   &&Number.isSafeInteger(r.vrs)&&r.vrs>=0
   &&Number.isSafeInteger(r.matches)&&r.matches>=1&&r.vrs<=r.matches,'invalid ranking stats');
 const u=new URL(r.source),event=decodeURIComponent(u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/)?.[1]||'');
 const window=u.searchParams.get('round'),region=u.searchParams.get('region');
 requireValid(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&!u.username&&!u.password&&!u.hash
   &&region===r.region&&window?.startsWith(r.seasonId+'_')&&window.endsWith('_'+r.region)
   &&cat.sourceEventIds.includes(event),'untrusted event source');
 const month=r.date.slice(0,7);
 if(!calendar[month])calendar[month]=read('calendar-history/'+month+'.json').sessions;
 const session=calendar[month].find(s=>s.sourceWindowId===window&&s.region===r.region&&s.dateJst===r.date
   &&s.eventId===event&&s.seasonId===r.seasonId&&s.tournamentId===r.tournamentId);
 requireValid(session&&session.url===r.source&&Number.isFinite(Date.parse(session.endUtc)), 'event calendar mismatch');
 if(choice.policy==='verified-qualifier')
  requireValid(event===cutoffRules[r.tournamentId].event,'qualifier exact event mismatch');
 if(choice.policy==='verified-zero-vr-final')
  requireValid(event==='S42_ConsoleVCC_SolosZB'||event==='S42_ReloadReloadSoloVictoryCup'
    ||event==='S42_ReloadDuosVictoryCup','unlisted final event ID');
 if(choice.policy==='official-solo-vr-final')
  requireValid(event==='S30_SoloZBVictoryCashCup','2024 cash event mismatch');
 const key='epicgames_'+event+'_'+r.region+'/'+window;
 const cp=data.scans[origin].windows[key];
 requireValid(cp&&cp.rankingOrderValid===true&&cp.nextPage>=1&&cp.pages===cp.nextPage
   &&Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=r.rank
   &&cp.proposals.filter(x=>x.id===r.id&&sameScannedCandidate(x,r)).length===1,'original Epic scoreboard mismatch');
 const fully=cp.complete===true&&cp.nextPage>=cp.totalPages;
 const partial=verifiedPartialPage(r,{end:Date.parse(session.endUtc)},cp);
 requireValid(choice.fullRequired?fully:(fully||partial),'leaderboard incomplete or stale');
 requireValid(!data.results.some(x=>collision(x,r,aliases)),'possible duplicate record - hold');
}
for(const {r,origin} of selected){
 const choice=classify(r);
 if(!choice)continue;
 scopeCounts[origin]++;
 try{
  verify(r,origin,choice);
  const {reviewReason,reviewOnly,teamAccountIds,...record}=r;
  record.kind=choice.kind;record.round=choice.round;record.prize=choice.prize;record.note=choice.note;
  requireValid(record.verified===true&&!record.round.includes('予選敗退'),'unsafe output record');
  data.results.push(record);recorded.add(record.id);processed.add(record.id);approved.add(record.id);
  data.reviews[origin].proposals=data.reviews[origin].proposals.filter(x=>x.id!==r.id);
  data.ledger.entries.push({id:r.id,decision:'published',recordId:r.id,policy:choice.policy,
   approvedAt:now,approvedBy:'ChatGPT / owner-authorized verified review',source:r.source,rule:choice.rule,
   evidence:'Exact Epic account and team roster, canonical official event/calendar, ranked checkpoint with continuous mature rows or complete scan; duplicate check'});
  data.reviewed.entries.push({id:r.id,decision:'published',recordId:r.id,reviewedAt:now,source:r.source,policy:choice.policy,rule:choice.rule});
  added.push({id:r.id,origin,player:r.player,event:r.event,date:r.date,region:r.region,rank:r.rank,
   kind:record.kind,round:record.round,prize:record.prize,kills:record.kills,vr:record.vrs});
 }catch(e){held.push({id:r.id,origin,player:r.player,reason:String(e.message||e)})}
}
if(added.length){
 const recordIds=added.map(x=>x.id);
 const digest=crypto.createHash('sha256').update(recordIds.slice().sort().join('|')).digest('hex').slice(0,12);
 const date=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
 const id='verified-review-round5-'+digest;
 requireValid(!data.updates.entries.some(x=>x.id===id),'audit marker collision');
 data.updates.entries.unshift({id,date,type:'records',
  title:'公式順位表再検証：予選・決勝・参加実績'+added.length+'件を掲載',
  description:'Epic本人ID・大会枠・成熟した保存済み順位表の完全照合。2026 S42予選/決勝0VR、2024公式突破条件、現金賞金未確定の参加記録を分離。未確認の賞金やスキン獲得は推定していない。',
  recordIds});
 data.ledger.reviewedAt=now;data.reviewed.reviewedAt=now;
 for(const origin of ['auto','history']){
  const n=added.filter(x=>x.origin===origin).length;
  if(!n)continue;
  const status=data.statuses[origin],review=data.reviews[origin];
  review.manualReviewedAt=now;status.found=review.proposals.length;
  status.manualReviewCandidates=review.proposals.length;
  status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
  status.manuallyPublished=(status.manuallyPublished||0)+n;
  status.lastReviewedBatchAt=now;
  status.message='公式Epic ID・順位・開催枠を検証し'+n+'件を掲載。残り'+review.proposals.length+'件。未確認賞金を推定しない。';
 }
}
const summary={dry,selected:selected.length,eligibleScope:scopeCounts,added:added.length,
 byOrigin:{auto:added.filter(x=>x.origin==='auto').length,history:added.filter(x=>x.origin==='history').length},
 byKind:added.reduce((o,x)=>(o[x.kind]=(o[x.kind]||0)+1,o),{}),
 confirmedCash:added.filter(x=>x.prize>0),held:held.slice(0,60),heldCount:held.length,
 remainingAuto:data.reviews.auto.proposals.length,remainingHistory:data.reviews.history.proposals.length};
console.log('AOT_VERIFIED_REVIEW_ROUND5 '+JSON.stringify(summary));
if(!dry&&added.length){
 for(const [name,value] of [
  ['results.json',data.results],['updates.json',data.updates],
  ['auto-sync-review.json',data.reviews.auto],['history-sync-review.json',data.reviews.history],
  ['auto-sync-status.json',data.statuses.auto],['history-sync-status.json',data.statuses.history],
  ['approval-history.json',data.ledger],['history-sync-reviewed.json',data.reviewed]
 ])write(name,value);
}
