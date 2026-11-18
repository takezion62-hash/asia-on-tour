'use strict';
// Publish only two original-source verified S34 PlayStation ME finalists as
// attendance with unknown cash (null), never inventing an award.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const seal=require('./verified-s34-ps-final-two-20261118.cjs');
const must=(x,m)=>{if(!x)throw Error('PUBLISH_S34_TWO '+m)};
const dry=process.argv.includes('--dry-run');
seal.validateProof();
const data={results:readResults(root).rows,players:read('players.json'),tournaments:read('tournaments.json')};
const review=read('history-sync-review.json'),reviewed=read('history-sync-reviewed.json');
const status=read('history-sync-status.json'),ledger=read('approval-history.json'),updates=read('updates.json');
const originalCount=data.results.length,oldCash=data.results.reduce((sum,x)=>sum+(x.prize||0),0);
must(originalCount>=8612&&review.proposals?.length===2&&
 Array.isArray(reviewed.entries)&&Array.isArray(ledger.entries)&&Array.isArray(updates.entries),
 'baseline must have exactly the two remaining verified S34 candidates');
const existing=new Set(data.results.map(x=>x.id)),reviewedIds=new Set(reviewed.entries.map(x=>x.id)),ledgerIds=new Set(ledger.entries.map(x=>x.id));
must(existing.size===data.results.length&&reviewedIds.size===reviewed.entries.length&&
 ledgerIds.size===ledger.entries.length,'existing ID duplicates');
const accounts=new Map(linkedAccounts(data).accounts.map(a=>[a.epicAccountId,a.player]));
const sessions=read('calendar-history/2025-05.json').sessions;
const stamp='2026-11-18T04:57:00.000Z',added=[];
for(const p of seal.proof.verified){
 const o=p.original,curr=review.proposals.find(x=>x.id===o.id);
 must(curr&&JSON.stringify(curr)===JSON.stringify(o),'original pending candidate changed '+o.id);
 must(!existing.has(o.id)&&!reviewedIds.has(o.id)&&!ledgerIds.has(o.id),
  'candidate already published/reviewed '+o.id);
 must(accounts.get(p.teamAccountIds[0])===o.player,'linked verified Epic UUID no longer identifies original player '+o.id);
 must(sessions.filter(s=>s.sourceWindowId==='S34_PlaystationCupFinal_ME'&&
  s.region==='ME'&&s.dateJst===o.date&&s.tournamentId===o.tournamentId).length===1,
  'source calendar not unique '+o.id);
 const next=seal.published(p,data.tournaments);
 const collision=data.results.some(r=>r.date===next.date&&r.region===next.region&&
  r.tournamentId===next.tournamentId&&r.player===next.player&&
  new URL(r.source).searchParams.get('round')==='S34_PlaystationCupFinal_ME');
 must(!collision,'duplicate Epic Finals player '+o.id);
 const entry=seal.entryFor(p,next,stamp);
 must(seal.verifyPublished(next,entry),'independent audit failed '+o.id);
 data.results.push(next);existing.add(o.id);
 ledger.entries.push(entry);ledgerIds.add(o.id);
 reviewed.entries.push({id:o.id,decision:'published',recordId:o.id,reviewedAt:stamp,
  source:o.source,policy:seal.POLICY});
 reviewedIds.add(o.id);added.push(next);
}
must(added.length===2&&data.results.length===originalCount+2&&
 added.every(x=>x.prize===null&&x.kind==='参加確認')&&
 new Set(data.results.map(x=>x.id)).size===data.results.length&&
 data.results.reduce((sum,x)=>sum+(x.prize||0),0)===oldCash,
 'unverified cash or changed previously published results');
review.proposals=review.proposals.filter(x=>!seal.IDS.includes(x.id));
must(review.proposals.length===0,'unexpected pending candidates');
review.manualReviewedAt=stamp;reviewed.reviewedAt=stamp;
status.found=0;status.manualReviewCandidates=0;
status.manualReviewProcessed=(status.manualReviewProcessed||0)+2;
status.lastReviewedBatchAt=stamp;
status.message='Epic元順位表の本人UUIDとスコアを直接再照合してS34 ME PlayStation Cup決勝参加2件を掲載。'+
 '現金賞金は未確認のためnullを維持し、賞金ランキングへの加算なし。現存確認待ち0件。';
const uid='verified-s34-me-playstation-two-20261118';
must(!updates.entries.some(x=>x.id===uid),'already published update');
updates.entries.unshift({id:uid,date:'2026-11-18',type:'records',
 title:'S34 ME PlayStation Cup Finalsの参加2件を本人Epic ID再照合で掲載',
 description:'2025/5/1 ME PlayStation Cup Finalsのモバイル勢のまかろん56位（63pt,6K,0VR,6試合）、くりたる64位（47pt,2K,0VR,6試合）のEpic公式順位表を独立取得。本人の元Epic UUIDとスコアを完全一致確認。両者を決勝参加確認として掲載。現金賞金は未確認のためnullのまま保持し、既存賞金は不変。',
 recordIds:added.map(x=>x.id)});
const errors=validateData(data).errors;
must(errors.length===0,'data errors '+JSON.stringify(errors.slice(0,5)));
must(validateUpdateLog(data.results,updates).length===0,'update log failed');
if(!dry){
 publishResults(root,data.results);
 for(const [p,o] of [
 ['history-sync-review.json',review],['history-sync-reviewed.json',reviewed],
 ['history-sync-status.json',status],['approval-history.json',ledger],
 ['updates.json',updates]])write(p,o);
}
console.log('PUBLISH_S34_TWO '+JSON.stringify({dry,baseline:originalCount,
 final:data.results.length,added:added.length,unconfirmedPrize:2,
 newAward:0,remaining:review.proposals.length,ids:added.map(x=>x.id)}));