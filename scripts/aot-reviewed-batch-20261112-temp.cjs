'use strict';
// Temporary, reviewed, one-shot batch. GitHub runner removes this file after use.
const fs=require('node:fs'),path=require('node:path');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {appendArchive,toParticipation,publishedEquivalent}=require('./participation-archive.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const assert=(v,m)=>{if(!v)throw Error('20261112-REVIEW '+m)};
const ids=new Set(('auto-s31-8fe9cea087bf auto-s31-5f4f59c082d7 auto-s30-38edc2a4468e auto-s30-622ff6c2a448 auto-s30-5c100d6d95dc auto-s30-64b28e27dafc auto-s30-399aecb49618 auto-s30-1662db26699a auto-s30-a5c983fd5b90 auto-s30-34e8e847274a auto-s30-c8b9b18b2b58 auto-s36-8ed10eb27786 auto-s42-b57ae47b3a23 auto-s31-8e50853183b3 auto-s31-c3e1baa00d50 auto-s31-46721304168e auto-s31-8effe69ec336 auto-s31-be3f7178669c auto-s31-9ee5af459903 auto-s31-4df46aeebbaf').split(' '));
const d={results:read('results.json'),review:read('history-sync-review.json'),
 scanned:read('history-sync-scan.json'),recentScan:read('auto-sync-scan.json'),
 reviewed:read('history-sync-reviewed.json'),ledger:read('approval-history.json'),status:read('history-sync-status.json'),
 players:read('players.json'),tournaments:read('tournaments.json'),updates:read('updates.json')};
const inQueue=d.review.proposals.filter(p=>ids.has(p.id));
assert(inQueue.length===ids.size,'batch changed; expected 20 exact candidates, found '+inQueue.length);
assert(new Set(inQueue.map(r=>r.id)).size===ids.size,'queue duplicate');
const existing=new Set(d.results.map(x=>x.id));
const handled=new Set(d.reviewed.entries.map(x=>x.id));
const approved=new Set(d.ledger.entries.map(x=>x.id));
const known=new Set(d.players.candidates.map(x=>x.name));
const catalog=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const aliases=d.players.confirmedAliases||{};
const people=x=>Array.isArray(x.players)&&x.players.length?x.players:[x.player];
const official={
  S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
  S31:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules'
};
function cutoff(p){
  if(p.seasonId==='S30'&&p.tournamentId==='ch5s3-zb-solo-victory'&&p.region==='ME'&&p.date==='2024-06-11')return 2000;
  if(p.seasonId==='S30'&&p.tournamentId==='ch5s3-solo-victory-cup'&&p.region==='NAC'&&['2024-06-18','2024-07-23'].includes(p.date))return 5000;
  if(p.seasonId==='S31'&&p.tournamentId==='ch5s4-solo-victory-cup'&&p.region==='NAC'&&['2024-09-17','2024-10-15'].includes(p.date))return 10000;
  if(p.seasonId==='S31'&&p.tournamentId==='ch5s4-solo-victory-cup'&&p.region==='OCE'&&p.date==='2024-10-21')return 1500;
  return null;
}
const calendar=new Map(),published=[],attend=[];
for(const p of inQueue){
  assert(p.verified===true&&!existing.has(p.id)&&!handled.has(p.id)&&!approved.has(p.id),'already-registered or unverified '+p.id);
  assert(Number.isSafeInteger(p.rank)&&p.rank>0&&['points','kills','vrs','matches'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0)&&p.matches>0&&p.vrs<=p.matches,'score '+p.id);
  const source=new URL(p.source),event=decodeURIComponent(source.pathname.split('/')[3]),win=source.searchParams.get('round');
  assert(source.hostname==='www.fortnite.com'&&source.protocol==='https:'&&source.pathname==='/competitive/events/'+event+'/'&&source.searchParams.get('region')===p.region&&win?.startsWith(p.seasonId+'_')&&win.endsWith('_'+p.region),'source '+p.id);
  const c=catalog.get(p.tournamentId),team=people(p);
  assert(c&&c.name===p.event&&c.seasonId===p.seasonId&&c.sourceEventIds.includes(event)&&
    team.length==={solo:1,duo:2,trio:3,squad:4}[c.team]&&team.join(' / ')===p.player&&new Set(team).size===team.length&&team.every(n=>known.has(n)),'player identity '+p.id);
  const month=p.date.slice(0,7);
  if(!calendar.has(month))calendar.set(month,read('calendar-history/'+month+'.json').sessions);
  const sessions=calendar.get(month).filter(s=>s.dateJst===p.date&&s.region===p.region&&s.eventId===event&&s.sourceWindowId===win&&s.tournamentId===p.tournamentId&&s.seasonId===p.seasonId&&s.url===p.source);
  assert(sessions.length===1,'official session '+p.id);
  const key='epicgames_'+event+'_'+p.region+'/'+win;
  const states=[d.scanned.windows[key],d.recentScan.windows[key]].filter(Boolean);
  assert(states.some(cp=>cp.rankingOrderValid===true&&cp.nextPage>0&&cp.nextPage===cp.pages&&cp.lastSeenRank>=p.rank&&
    cp.proposals?.filter(r=>r.id===p.id&&sameScannedCandidate(r,p)).length===1&&
    (cp.complete===true||verifiedPartialPage(p,{end:Date.parse(sessions[0].endUtc)},cp))),'mature source scoreboard '+p.id);
  assert(!d.results.some(x=>collision(x,p,aliases)),'overlap existing record '+p.id);
  const rule=official[p.seasonId];
  if(p.kind==='予選'){
    const limit=cutoff(p);
    assert(rule&&c.series==='victory-cup'&&limit&&p.rank<=limit&&p.prize===0&&p.matches<=7,'not verified qualifier '+p.id);
    const {reviewReason,reviewOnly,teamAccountIds,...r}=p;
    r.round=r.round.replace(/\/\s*予選$/,'/ 予選突破');r.prize=0;
    r.note='Epic ID・公式開催枠・成熟した保存順位表で'+p.region+' '+p.rank+'位を照合。2024年公式規則の地域別上位'+limit+'名の予選突破に該当。予選賞金$0。決勝賞金・支払は未確認。規則: '+rule;
    published.push({row:p,record:r,policy:'verified-rule',rule});
  }else if(p.id==='auto-s31-8fe9cea087bf'){
    assert(p.kind==='賞金決勝'&&p.seasonId==='S31'&&p.region==='NAC'&&p.rank===257&&p.points===100&&p.vrs===1&&p.kills===2&&p.matches===3&&p.prize===null&&c.team==='solo','cash award proof '+p.id);
    const {reviewReason,reviewOnly,teamAccountIds,...r}=p;
    r.prize=100;r.note='本人Epic ID・成熟済み元順位表でNAC Event6 Round2の257位・1VR=100pt・2Kを確認。Epic公式規則で決勝1VRにつき$100の賞金。受賞資格と支払完了は未確認。規則: '+rule;
    published.push({row:p,record:r,policy:'official-final-vr-award',rule});
  }else{
    assert(p.reviewOnly===true&&p.kind==='参加確認'&&p.prize===null&&
      ((p.seasonId==='S36'&&p.tournamentId==='ch6s3-playstation-cup'&&p.region==='NAC'&&p.date==='2025-07-25')||
       (p.seasonId==='S42'&&p.tournamentId==='ch7s4-fncs-division-1-practice'&&p.region==='NAW'&&p.date==='2026-09-15')),'not allowed attendance '+p.id);
    const scope={dateJst:p.date,region:p.region,tournamentId:p.tournamentId,eventId:event,windowId:win,kind:p.kind,round:p.round,series:c.series};
    const r=toParticipation(p,scope);
    assert(r&&!publishedEquivalent(r,d.results),'unsafe participation '+p.id);
    attend.push({row:p,record:r,scope});
  }
}
assert(published.length===18&&published.filter(x=>x.policy==='verified-rule').length===17&&attend.length===2,'unexpected batch types');
const stamp=new Date().toISOString(),date=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
for(const x of published){
  d.results.push(x.record);
  d.reviewed.entries.push({id:x.row.id,decision:'published',recordId:x.record.id,reviewedAt:stamp,source:x.row.source,policy:x.policy,rule:x.rule});
  d.ledger.entries.push({id:x.row.id,recordId:x.record.id,decision:'published',policy:x.policy,source:x.row.source,approvedAt:stamp,approvedBy:'ChatGPT / user-authorized evidence review',rule:x.rule,evidence:'Exact Epic ID, official event, mature continuous saved scoreboard and official 2024 published award or qualification rule'});
}
for(const x of attend)d.reviewed.entries.push({id:x.row.id,decision:'participation-archived',recordId:x.record.id,reviewedAt:stamp,source:x.row.source,note:'Verified Epic identity/event/score; no award or advancement inferred'});
assert(new Set(d.reviewed.entries.map(x=>x.id)).size===d.reviewed.entries.length,'reviewed ledger duplicates');
assert(new Set(d.ledger.entries.map(x=>x.id)).size===d.ledger.entries.length,'approval ledger duplicates');
const participation=appendArchive(root,attend.map(x=>({win:x.scope,proposals:[x.row],cutoff:null})),d.results,{checkedAt:stamp});
assert(participation.rejected===0,'participation import rejected');
for(const x of attend){
  const month=x.row.date.slice(0,7),a=read('participation/'+month+'.json');
  assert(a.entries.some(p=>p.id===x.record.id),'participation was not saved '+x.row.id);
}
const status=d.status;d.review.proposals=d.review.proposals.filter(x=>!ids.has(x.id));d.review.manualReviewedAt=stamp;
status.found=d.review.proposals.length;status.manualReviewCandidates=status.found;status.reviewOnlyCandidates=d.review.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+published.length;status.lastReviewedBatchAt=stamp;
status.latestManualReview={reviewedAt:stamp,reviewedCandidates:20,published:18,participationArchived:2,remainingPending:status.found,policy:'Epic original scoreboard + 2024 official cutoff and $100/VR; no presumed payout'};
status.message='証拠照合した予選突破17件・決勝賞金1件を正式掲載、参加確認2件を別枠登録。確認待ち'+status.found+'件。';
const pStatus=read('participation-status.json'),index=read('participation-index.json');
pStatus.total=index.total;pStatus.lastManualReviewAt=stamp;
pStatus.manualReviewPublished=(pStatus.manualReviewPublished||0)+participation.added;
pStatus.message='本人Epic ID・成熟した公式順位表による出場確認'+participation.added+'件を掲載。賞金や予選突破は推定しない。';
d.updates.entries.unshift({id:'reviewed-batch20-20261112',date,type:'records',title:'公式照合：予選突破17件・決勝賞金1件',description:'2024年ME/NAC/OCEの地域別予選通過条件と成熟した保存順位表を照合し$0の予選突破17件を追加。2024-10-08 NACのちゃるは1VR=$100と確認。出場のみ2件は参加確認アーカイブ。受賞資格・支払完了は未確認。',recordIds:published.map(x=>x.record.id)});
d.reviewed.reviewedAt=stamp;d.ledger.reviewedAt=stamp;
for(const [f,data] of [['results.json',d.results],['history-sync-review.json',d.review],['history-sync-reviewed.json',d.reviewed],
  ['approval-history.json',d.ledger],['history-sync-status.json',status],['updates.json',d.updates],['participation-status.json',pStatus]])write(f,data);
console.log('AOT_VERIFIED_BATCH '+JSON.stringify({published:published.length,qualifiers:17,cash:1,attendance:participation.added,remaining:d.review.proposals.length,results:d.results.length}));
