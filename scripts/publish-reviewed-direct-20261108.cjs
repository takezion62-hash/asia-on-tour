'use strict';
// Explicitly assistant-selected confirmed results from the Nov 8 user request.
// Unlike open-ended auto-approval, no candidate outside these audited IDs
// may be published by this one-time script. It always re-reads live main,
// requires original Epic-backed scan evidence and prevents repeat publication.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {linkedAccounts}=require('./osirion-sync.cjs');
const {decide:duoDecide}=require('./automatic-duo-qualifier-approval.cjs');
const {decide:finalDecide}=require('./verified-history-approval.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const selected=Object.freeze({
  "recent": [
    "auto-s43-48bd824cd8c6",
    "auto-s43-744451030661",
    "auto-s43-7a3ce261b0bc",
    "auto-s43-46147dc287dc",
    "auto-s43-080c1c790e5a",
    "auto-s43-a77a9ad99595",
    "auto-s43-2d5d5b9791a0"
  ],
  "historyDuos": [
    "auto-s36-cca52e424a4c",
    "auto-s36-15c75e75af3f",
    "auto-s36-e440dd9d0ce3",
    "auto-s36-de943950e988",
    "auto-s36-c1861cfc7bb3",
    "auto-s36-d7c14eee0bca",
    "auto-s36-c7c4fc43cbdb",
    "auto-s36-736f07a1172d",
    "auto-s36-b90753927ce6",
    "auto-s36-e12f2a7a79d3",
    "auto-s36-3d0839668f46",
    "auto-s36-929c5129a336",
    "auto-s36-441932da7755",
    "auto-s36-beb6a6555d40",
    "auto-s36-9ad2cad21bca",
    "auto-s36-2211fd07a4d2",
    "auto-s36-41d4d6b36af2",
    "auto-s36-a4acd0716936",
    "auto-s36-7f1c1753a189",
    "auto-s36-1e59a076860a",
    "auto-s36-d3519338fe9f",
    "auto-s36-a47789484b98",
    "auto-s36-4e9ce5265db4",
    "auto-s36-1d1ab4513535"
  ],
  "historyFinals": [
    "auto-s30-88bf1dd95e98",
    "auto-s31-87f40250d2cb",
    "auto-s31-fb0011060283",
    "auto-s31-8812308b6f5d",
    "auto-s31-351238459787",
    "auto-s31-aa1118c8049a",
    "auto-s31-6073e9849d33",
    "auto-s31-bc96adef0f60",
    "auto-s31-ccfd82e83061",
    "auto-s31-acbfcaaf5f0c",
    "auto-s31-9cff86f10be3",
    "auto-s30-9585403b75a4",
    "auto-s31-0eab9445deb0",
    "auto-s30-d1ad1294120b",
    "auto-s30-654ceff348ba",
    "auto-s30-dd2d0917ccc8",
    "auto-s30-879b1a61fa83",
    "auto-s31-5b988a1fc586"
  ]
});
const clone=x=>JSON.parse(JSON.stringify(x));
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const write=(x,data)=>fs.writeFileSync(path.join(root,x),JSON.stringify(data,null,2)+'\n');
const must=(ok,msg)=>{if(!ok)throw Error('ASSISTANT_DIRECT_REVIEW_INVALID '+msg)};
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const sameStats=(a,b)=>['rank','points','kills','vrs','matches','date','region','tournamentId','source'].every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]))&&
 roster(a).slice().sort().join('|')===roster(b).slice().sort().join('|');
function main(){
 const docs={results:read('results.json'),updates:read('updates.json'),players:read('players.json'),
  tournaments:read('tournaments.json'),schedule:read('schedule.json'),reviewed:read('history-sync-reviewed.json'),
  reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
  scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')},
  statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')}};
 const now=Date.now(),stamp=new Date(now).toISOString();
 must(Array.isArray(docs.results)&&Array.isArray(docs.updates.entries)&&
   Array.isArray(docs.reviewed.entries),'data files missing');
 const {accounts}=linkedAccounts({players:docs.players,results:docs.results});
 const enriched={results:docs.results,players:docs.players,tournaments:docs.tournaments,
  schedule:docs.schedule,verifiedAccounts:accounts};
 const outcome={selected:0,approved:[],duplicate:[],held:[],missing:[]};
 const registered=new Set(docs.results.map(r=>r.id)),alreadyReviewed=new Set(docs.reviewed.entries.map(r=>r.id));
 const desired=[...selected.recent.map(id=>({id,origin:'auto',kind:'duo'})),
  ...selected.historyDuos.map(id=>({id,origin:'history',kind:'duo'})),
  ...selected.historyFinals.map(id=>({id,origin:'history',kind:'final'}))];
 must(new Set(desired.map(x=>x.id)).size===desired.length,'curated duplicate ID');
 const pending=Object.fromEntries(['auto','history'].map(o=>[o,new Map(docs.reviews[o].proposals.map(x=>[x.id,x]))]));
 const published=[],resolved=new Set(),original=docs.results.slice();
 for(const item of desired){
  outcome.selected++;
  const row=pending[item.origin].get(item.id);
  if(!row){
   if(registered.has(item.id)||alreadyReviewed.has(item.id)){
    outcome.duplicate.push({id:item.id,reason:'already recorded before this batch'});
   }else outcome.missing.push({id:item.id,reason:'not in current review queue'});
   continue;
  }
  if(registered.has(row.id)||alreadyReviewed.has(row.id)){
   // A published/previously adjudicated ID must not remain in the queue.
   resolved.add(row.id);outcome.duplicate.push({id:row.id,reason:'same ID already published/reviewed'});
   continue;
  }
  const matches=[];
  for(const [key,cp] of Object.entries(docs.scans[item.origin].windows)){
   const match=cp.proposals?.find(x=>x.id===row.id);
   if(match)matches.push({key,cp,match});
  }
  if(matches.length!==1||!sameScannedCandidate(matches[0].match,row)){
   outcome.held.push({id:row.id,reason:'checkpoint missing, repeated or altered original result'});continue;
  }
  const {key,cp}=matches[0],source=new URL(row.source),eventId=source.pathname.split('/')[3],
   windowId=source.searchParams.get('round');
  if(!windowId||!key.endsWith('/'+windowId)||!key.startsWith('epicgames_'+eventId+'_'+row.region+'/')){
   outcome.held.push({id:row.id,reason:'checkpoint/event/round mismatch'});continue;
  }
  const tournament=docs.tournaments.catalog.find(x=>x.id===row.tournamentId);
  if(!tournament){outcome.held.push({id:row.id,reason:'unregistered tournament'});continue}
  const session=docs.schedule.sessions.find(s=>s.eventId===eventId&&s.region===row.region&&s.dateJst===row.date&&
   s.round==='Event 1 · Round 1'&&s.stage==='予選');
  // Recent verified S43 OCE session was officially scheduled for 03:00–06:00 UTC.
  // Older than a year: conservative upper bound is END of the recorded JST day,
  // not a claim of the exact historic start or finish time.
  const end=item.origin==='auto'?
   (session?Date.parse(session.startUtc)+3*3600000:NaN):
   Date.parse(row.date+'T15:00:00Z');
  const win={key,eventId,windowId,region:row.region,seasonId:row.seasonId,
   tournamentId:row.tournamentId,series:tournament.series,kind:row.kind,round:row.round,
   dateJst:row.date,startUtc:session?.startUtc||null,end};
  let decision;
  try{decision=item.kind==='duo'?duoDecide(row,win,cp,enriched,now):finalDecide(row,win,cp,enriched)}
  catch(e){outcome.held.push({id:row.id,reason:'rule check error '+String(e.message).slice(0,140)});continue}
  if(!decision.approved){
   outcome.held.push({id:row.id,reason:decision.reason});continue;
  }
  const record=decision.record;
  if(record.prize!==0||record.verified!==true||record.reviewOnly===true||
   !sameStats(row,record)||!['予選','賞金決勝'].includes(record.kind)){
   outcome.held.push({id:row.id,reason:'approved record changed original data or invented cash'});continue;
  }
  const clashes=docs.results.filter(x=>collision(x,record,docs.players.confirmedAliases));
  if(clashes.length){
   if(clashes.length===1&&sameStats(clashes[0],record)&&clashes[0].prize===record.prize){
    resolved.add(row.id);outcome.duplicate.push({id:row.id,existingId:clashes[0].id,
     reason:'same result already published'});
    docs.reviewed.entries.push({id:row.id,decision:'already-published',existingId:clashes[0].id,
     reviewedAt:stamp,source:row.source,evidence:'Assistant cross-checked identical roster and Epic round and score'});
    alreadyReviewed.add(row.id);
   }else outcome.held.push({id:row.id,reason:'conflicting published performance: '+clashes.map(x=>x.id).join(',')});
   continue;
  }
  docs.results.push(record);registered.add(record.id);resolved.add(row.id);published.push(record);
  enriched.results=docs.results;
  docs.reviewed.entries.push({id:row.id,decision:'published',recordId:record.id,
   approvedBy:'ChatGPT curated review 2026-11-08',policy:'confirmed-official-round1-or-zero-vr',
   evidence:'Exact scan candidate, ranked official rule, regional round and roster check; no paid VR inferred',
   reviewedAt:stamp,officialRules:decision.rule,source:record.source});
  alreadyReviewed.add(row.id);
  outcome.approved.push({id:row.id,player:record.player,rank:record.rank,
   kind:record.kind,round:record.round,prize:record.prize});
 }
 if(resolved.size){
  for(const origin of ['auto','history']){
   docs.reviews[origin].proposals=docs.reviews[origin].proposals.filter(x=>!resolved.has(x.id));
   docs.reviews[origin].manualReviewedAt=stamp;
   docs.statuses[origin].found=docs.reviews[origin].proposals.length;
   docs.statuses[origin].manualReviewCandidates=docs.reviews[origin].proposals.length;
   docs.statuses[origin].reviewOnlyCandidates=docs.reviews[origin].proposals.filter(x=>x.reviewOnly===true).length;
   docs.statuses[origin].manuallyPublished=(Number(docs.statuses[origin].manuallyPublished)||0)+
    published.filter(p=>p.id.startsWith(origin==='auto'?'auto-s43-':'auto-s36-')||
     (origin==='history'&&p.id.startsWith('auto-s3'))).length;
   docs.statuses[origin].lastReviewedBatchAt=stamp;
   docs.statuses[origin].message='ChatGPTが個別確認した'+selected[origin==='auto'?'recent':'historyDuos'].length+
    '件の候補を再確認。掲載'+outcome.approved.filter(r=>origin==='auto'?r.id.startsWith('auto-s43-'):!r.id.startsWith('auto-s43-')).length+
    '件、重複'+outcome.duplicate.length+'件、理由付き保留'+outcome.held.length+'件。';
  }
  docs.reviewed.reviewedAt=stamp;
 }
 if(published.length){
  const id='assistant-reviewed-pending-20261108';
  must(!docs.updates.entries.some(x=>x.id===id),'update entry already exists for another batch');
  const day=new Date(now+9*3600000).toISOString().slice(0,10);
  docs.updates.entries.unshift({id,date:day,type:'records',
   title:'ChatGPTが確認待ち候補を公式出典で調査し'+published.length+'戦績を直接掲載',
   description:'2026-11-08の確認待ちを本人Epic ID・公式順位表・地域別通過ライン・既存記録と個別照合。'+
    'S36 Console DuosとS43 Reload ZB DuosのRound1予選/突破、S30/S31 0VR決勝を、'+
    '賞金$0のみ掲載。決勝賞金・未確認の資格・同名別人を推定せず。元の成績と賞金は保持。',
   recordIds:published.map(x=>x.id)});
  docs.updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 outcome.remaining={auto:docs.reviews.auto.proposals.length,history:docs.reviews.history.proposals.length};
 outcome.changed=resolved.size>0;
 console.log('ASSISTANT_DIRECT_PUBLICATION '+JSON.stringify(outcome));
 if(process.argv.includes('--dry-run')||!outcome.changed)return;
 for(const [file,val] of Object.entries({
  'results.json':docs.results,'updates.json':docs.updates,
  'auto-sync-review.json':docs.reviews.auto,'history-sync-review.json':docs.reviews.history,
  'history-sync-reviewed.json':docs.reviewed,'auto-sync-status.json':docs.statuses.auto,
  'history-sync-status.json':docs.statuses.history}))write(file,val);
}
if(require.main===module)main();
module.exports={main,selected};
