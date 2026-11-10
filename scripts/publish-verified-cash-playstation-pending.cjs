'use strict';
/**
 * Official-rule review and publication for saved Solo/Duos Cash Cup,
 * PlayStation Cup and PlayStation Clix Cup candidates.
 * Re-validates each Epic account, calendar session, cached Osirion ranked
 * result, prior approvals and semantic collision using manual-approval-core.
 * All results are integrated into results.json, not a separate attendance panel.
 *
 * Rule sources:
 * https://www.fortnite.com/news/solo-cash-cups-chapter-6-season-1-official-rules
 * https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules
 * https://www.fortnite.com/news/playstation-cup-chapter-6-season-3-official-rules
 * https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-clix-cup-official-rules
 */
const fs=require('node:fs'),path=require('node:path');
const {apply}=require('./manual-approval-core.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,v)=>fs.writeFileSync(path.join(root,name),JSON.stringify(v,null,2)+'\n');
const dry=process.argv.includes('--dry-run');
const RULES=Object.freeze({
 solo:'https://www.fortnite.com/news/solo-cash-cups-chapter-6-season-1-official-rules',
 duo:'https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules',
 ps:'https://www.fortnite.com/news/playstation-cup-chapter-6-season-3-official-rules',
 clix:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-clix-cup-official-rules'
});
const types=Object.freeze({
 'ch6s1-solo-cash':{id:'solo',season:'S33',event:'S33_SoloCashCup',region:'NAW',dates:['2025-01-11','2025-01-13','2025-01-27']},
 'ch5s4-duos-cash-cup':{id:'duo',season:'S31',event:'S31_DuosCashCup',region:'ME',dates:['2024-10-10','2024-10-17']},
 'ch6s3-playstation-cup':{id:'ps',season:'S36',event:'S36_PlayStationCup',region:null,dates:['2025-07-24','2025-07-25']},
 'ch7s2-playstation-clix-cup-br':{id:'clix',season:'S40',event:'S40_PlayStationCupClix',region:null,dates:['2026-04-29','2026-04-30','2026-05-02']}
});
const db={
 results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),
 reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
 statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
 scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')},
 ledger:read('approval-history.json'),updates:read('updates.json'),calendar:{}
};
function resolve(r){
 const conf=types[r.tournamentId];
 if(!conf||r.seasonId!==conf.season||!conf.dates.includes(r.date)||
    (conf.region!==null&&r.region!==conf.region)||
    r.reviewOnly!==true||r.verified!==true||r.kind!=='参加確認'||
    r.prize!==null) return null;
 const url=new URL(r.source);
 if(url.pathname!=='/competitive/events/'+conf.event+'/'||
    url.searchParams.get('region')!==r.region)return null;
 const win=url.searchParams.get('round')||'';
 const q=/Round1_|_Qualifier_/.test(win),f=/Round2_|_Final_/.test(win);
 if((q?1:0)+(f?1:0)!==1)return null;
 if(!Number.isSafeInteger(r.rank)||r.rank<1)return null;
 let kind,round,prize=0,note='',rule=RULES[conf.id];
 if(conf.id==='solo'){
  if(!/^S33_SoloCashCup_Event[35]Round[12]_NAW$/.test(win))return null;
  if(q){
   const advanced=r.rank<=600;
   round=r.round.replace(/\/\s*参加確認$/,'/ '+(advanced?'予選突破':'予選'));
   kind='予選';
   note='Epic公式Solo Cash Cup Round1でNAW上位600名がRound2進出。'+r.rank+'位を保存済みEpic ID・順位表で確認。'+(advanced?'予選突破を確認。':'予選順位を記録し、進出としては集計しない。')+' Round1の現金賞金$0。';
  }else{
   if(r.rank<=20)return null; // Positive-cash finals require separate table verification.
   round=r.round.replace(/\/\s*参加確認$/,'/ 賞金決勝');
   kind='賞金決勝';
   note='Epic公式2025年CH6 S1 NAW Solo Cash Cup Round2の現金賞金は20位まで。決勝'+r.rank+'位を保存済みEpic ID・順位表で確認し現金$0。';
  }
 }else if(conf.id==='duo'){
  if(!/^S31_DuosCashCup_Event[67]Round1_ME$/.test(win)||!q)return null;
  if(r.rank<=50)return null; // Would require official Round2-advance categorization.
  kind='予選';
  round=r.round.replace(/\/\s*参加確認$/,'/ 予選');
  note='Epic公式CH5 S4 ME Duos Cash Cup Round1は上位50組がRound2進出。'+r.rank+'位を2名のEpic IDと順位表で確認。Round1現金賞金$0、決勝進出としては集計しない。';
 }else if(conf.id==='ps'){
  if(!/_Qualifier_(NAW|ME|OCE)$/.test(win)||!q)return null;
  const advanced=r.rank<=100;
  kind='予選';
  round='Qualifier / '+(advanced?'予選突破':'予選');
  note='Epic公式CH6 S3 PlayStation Cupは地域別上位100名が決勝進出。'+r.rank+'位・'+r.points+'点を本人Epic IDで確認。'+(advanced?'予選突破を確認。':'予選の順位を記録。')+' 現金賞金は決勝のみで予選$0。'+(r.points>=8?'8点以上のゲーム内スプレー報酬条件に該当（配布確認は別）。':'');
 }else if(conf.id==='clix'){
  if(!/_(Qualifier|Final)_(OCE|ME)$/.test(win))return null;
  if(q){
   const advanced=r.rank<=100;
   kind='予選';round='Qualifier / '+(advanced?'予選突破':'予選');
   note='Epic公式PlayStation Clix Cupの地域別上位100名が決勝に進出。予選'+r.rank+'位をEpic ID・順位表で確認。'+(advanced?'予選突破を確認。':'参加順位のみ記録し、決勝進出加点なし。')+' 予選現金賞金$0。衣装等の実際の配布は未確認。';
  }else{
   if(r.vrs!==0)return null; // Positive cash must be verified against VR payout separately.
   kind='賞金決勝';round='Final / 賞金決勝';
   note='Epic公式PlayStation Clix Cupの'+r.region+'決勝では1VRにつき$250。保存済み順位表で決勝0VR・'+r.rank+'位を確認したため現金賞金$0。';
  }
 }
 if(!kind||!round||/参加確認/.test(round)||/予選敗退/.test(round))return null;
 return {kind,round,prize,rule,note};
}
const all=[...db.reviews.history.proposals,...db.reviews.auto.proposals];
const candidates=all.map(r=>({row:r,change:resolve(r)})).filter(x=>x.change)
 .sort((a,b)=>a.row.date.localeCompare(b.row.date)||a.row.region.localeCompare(b.row.region)||a.row.rank-b.row.rank);
const published=[],held=[],applied=[];
const stamp=new Date().toISOString();
for(const {row,change} of candidates){
 try{
  const month=row.date.slice(0,7);
  if(!db.calendar[month]){
    const cal=read('calendar-history/'+month+'.json');
    if(!Array.isArray(cal.sessions))throw Error('Official session calendar missing');
    db.calendar[month]=cal.sessions;
  }
  const approved=apply(db,{ids:[row.id],policy:'attendance-only',confirmation:'CONFIRM',
    timestamp:stamp,runId:'aot-rule-20261111-'+row.id,actor:'ChatGPT / repository owner requested publication'});
  if(approved.changes.length!==1)throw Error('Expected exactly one approved candidate');
  const record=approved.changes[0].record;
  Object.assign(record,{kind:change.kind,round:change.round,prize:change.prize,
   note:change.note+' 公式規則: '+change.rule+' / 照合元: '+row.source});
  if(record.verified!==true||record.prize!==0||/予選敗退/.test(record.round))throw Error('Invalid record metadata');
  const ledgerRow=approved.next.ledger.entries.find(x=>x.id===row.id);
  if(!ledgerRow)throw Error('Approval ledger missing');
  Object.assign(ledgerRow,{policy:'verified-rule',rule:change.rule,
   evidence:'Verified Epic ID, saved ranked Osirion row, official event calendar, cutoff rule and semantic duplicate check; no unverified cash inferred'});
  approved.next.updates.entries=approved.next.updates.entries.filter(u=>
    u.id!=='review-publication-aot-rule-20261111-'+row.id);
  db.results=approved.next.results;
  db.reviews=approved.next.reviews;
  db.statuses=approved.next.statuses;
  db.ledger=approved.next.ledger;
  db.updates=approved.next.updates;
  published.push({id:row.id,player:row.player,region:row.region,event:row.event,date:row.date,
    rank:row.rank,round:change.round,prize:0});
 }catch(err){
  held.push({id:row.id,player:row.player,reason:String(err.message||err)});
 }
}
const marker='cash-playstation-reviewed-batch-20261111';
if(published.length){
 const existing=db.updates.entries.find(x=>x.id===marker);
 if(existing){
  existing.recordIds=[...new Set([...(existing.recordIds||[]),...published.map(x=>x.id)])];
  existing.description='公式順位表・Epic ID・進出条件を再照合し、通常の遠征結果へ'+existing.recordIds.length+'件掲載。賞金が確認できない結果を推定せず、予選と決勝・現金$0を区別。';
 }else{
  db.updates.entries.unshift({id:marker,date:'2026-11-11',type:'records',
   title:'Solo/Duos Cash Cup・PlayStation Cupの公式順位を掲載',
   description:'Epic IDと公式ラウンド・地域別突破条件を確認。予選突破、決勝結果、現金$0を区別し、通常の遠征結果に統合。不確かな結果表示や未確認の賞金加算は行わない。',
   recordIds:published.map(x=>x.id)});
 }
 for(const k of ['auto','history']){
  db.statuses[k].found=db.reviews[k].proposals.length;
  db.statuses[k].manualReviewCandidates=db.reviews[k].proposals.length;
  db.statuses[k].reviewOnlyCandidates=db.reviews[k].proposals.filter(x=>x.reviewOnly).length;
  db.statuses[k].lastReviewedBatchAt=stamp;
  db.statuses[k].message='公式ラウンド・賞金・進出条件を再確認して掲載。残り確認待ち'+db.reviews[k].proposals.length+'件。';
 }
}
if(!dry&&published.length){
 for(const [file,obj] of [
 ['results.json',db.results],['history-sync-review.json',db.reviews.history],
 ['auto-sync-review.json',db.reviews.auto],['history-sync-status.json',db.statuses.history],
 ['auto-sync-status.json',db.statuses.auto],['approval-history.json',db.ledger],
 ['updates.json',db.updates]])write(file,obj);
}
const eventCounts={};
for(const x of published)eventCounts[x.event]=(eventCounts[x.event]||0)+1;
console.log('AOT_RULE_PUBLICATION '+JSON.stringify({
 dry,totalCandidates:candidates.length,added:published.length,heldCount:held.length,
 held:held.slice(0,30),byEvent:eventCounts,
 remainingHistory:db.reviews.history.proposals.length,
 remainingAuto:db.reviews.auto.proposals.length,
 notable:published.filter(x=>x.round.includes('予選突破')).slice(0,20),
 examples:published.slice(0,8)
}));
