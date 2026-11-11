'use strict';
// Third review continuation: include saved verified FNCS Div1 day, S42 Performance
// Round1 and Days of Play qualifier ranks in the regular results feed.
// Rank, rounds, team roster and source are checked by manual-approval-core.
// Neither award/qualification nor cash are inferred.
const fs=require('node:fs'),path=require('node:path'),{apply}=require('./manual-approval-core.cjs');
const {loadReviewDb,upsertPublicationLog,writeReviewDb}=require('./reviewed-publication-core.cjs');
const root=path.resolve(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const dry=process.argv.includes('--dry-run'),now=new Date().toISOString();
const db=loadReviewDb(root);
const allow={
 'ch7s2-fncs-division-1':{region:'ME',dates:new Set(['2026-05-06','2026-05-12']),event:'S40_FNCSDivisionalCup_Division1'},
 'ch7s4-performance-evaluation-trios':{region:'NAC',dates:new Set(['2026-10-23']),event:'S42_PerformanceEvaluationTrios'},
 'ch7s3-days-of-play-playstation-cup-br':{region:'OCE',dates:new Set(['2026-06-07']),event:'S41_PSCupDaysOfPlay'}
};
const candidates=[...db.reviews.history.proposals,...db.reviews.auto.proposals].filter(r=>{
 const a=allow[r.tournamentId];if(!a||!a.dates.has(r.date)||a.region!==r.region||
  r.kind!=='参加確認'||r.reviewOnly!==true||r.verified!==true||r.prize!==null)return false;
 const url=new URL(r.source);
 return url.hostname==='www.fortnite.com'&&url.pathname==='/competitive/events/'+a.event+'/'&&url.searchParams.get('region')===r.region;
}).sort((a,b)=>a.date.localeCompare(b.date)||a.region.localeCompare(b.region)||a.rank-b.rank);
const done=[],held=[];
for(const r of candidates){
 try{
  const mo=r.date.slice(0,7);
  if(!db.calendar[mo]){
   const c=read('calendar-history/'+mo+'.json');
   if(!Array.isArray(c.sessions))throw Error('Official schedule not found');
   db.calendar[mo]=c.sessions;
  }
  const result=apply(db,{ids:[r.id],policy:'attendance-only',confirmation:'CONFIRM',
   timestamp:now,runId:'aot-review-3-secondary-'+r.id,actor:'ChatGPT / user-authorized leaderboard review'});
  if(result.changes.length!==1)throw Error('Candidate not newly verified');
  const entry=result.changes[0].record;
  const src=new URL(r.source),win=src.searchParams.get('round');
  if(r.tournamentId==='ch7s2-fncs-division-1'){
   if(!/^S40_FNCSDivisionalCup_Division1_Week[34]Day[12]_ME$/.test(win))
    throw Error('Unexpected FNCS Div1 session');
   entry.note='S40 FNCS Division 1の'+win.match(/Week\d+Day\d+/)[0]
    +'における本人Epic ID・保存済み順位表の'+r.rank+'位、'+r.points+'pt、'+r.kills+'K、'+r.vrs+'VRを照合。'
    +'この開催枠の賞金や昇降格は別条件のため未認定。出典: '+r.source;
  }else if(r.tournamentId==='ch7s4-performance-evaluation-trios'){
   if(win!=='S42_PerformanceEvaluation_Event9Round1_NAC')throw Error('Unexpected Performance Event window');
   entry.note='S42 Performance Evaluation NAC Event9 Round1で本人Epic IDと順位表を照合。'
    +r.rank+'位、'+r.points+'pt、'+r.kills+'K、'+r.vrs+'VR（予選内VR）。'
    +'決勝進出・決勝VR・賞金とは区別し、未確認の報酬を加算しない。出典: '+r.source;
  }else{
   if(win!=='S41_PSCupDaysOfPlay_Qualifier_OCE')throw Error('Unexpected PlayStation Cup round');
   entry.note='S41 Days of Play PlayStation Cup OCE予選 '+r.rank+'位、'
     +r.points+'pt、'+r.kills+'KをEpic IDと保存済み順位表で確認。'
     +'予選突破・決勝賞金・衣装報酬は未認定。出典: '+r.source;
  }
  Object.assign(db,{results:result.next.results,reviews:result.next.reviews,
    statuses:result.next.statuses,ledger:result.next.ledger,updates:result.next.updates});
  done.push({id:r.id,player:r.player,event:r.event,rank:r.rank,region:r.region});
 }catch(e){held.push({id:r.id,player:r.player,reason:String(e.message||e)})}
}
if(done.length){
 db.updates.entries=db.updates.entries.filter(x=>!String(x.id||'').startsWith('review-publication-aot-review-3-secondary-'));
 const marker='fncs-performance-days-20261111';
 upsertPublicationLog(db.updates,{
  id:marker,date:'2026-11-11',title:'FNCS Division 1・Performance・Days of Playの海外順位を掲載',
  description:'本人Epic ID・公式開催枠と順位表の順位・キル・VR等を照合して通常結果に掲載。未確認賞金・決勝突破・衣装獲得を推定しない。',
  recordIds:done.map(x=>x.id),
  existingDescription:count=>'Epic本人ID・公式開催枠・保存済み順位を照合して通常結果に'+count+'件掲載。未確認賞金・決勝突破・衣装獲得を推定しない。'
 });
 for(const k of ['history','auto']){
  db.statuses[k].found=db.reviews[k].proposals.length;
  db.statuses[k].manualReviewCandidates=db.reviews[k].proposals.length;
  db.statuses[k].reviewOnlyCandidates=db.reviews[k].proposals.filter(x=>x.reviewOnly).length;
  db.statuses[k].lastReviewedBatchAt=now;
  db.statuses[k].message='FNCS・Performance・Days of Playの検証済み順位'+done.length
    +'件を通常一覧へ掲載。確認待ち'+db.reviews[k].proposals.length+'件。';
 }
}
if(!dry&&done.length)writeReviewDb(root,db);
const by={};for(const r of done)by[r.event]=(by[r.event]||0)+1;
console.log('AOT_SECONDARY_PUBLISH '+JSON.stringify({dry,selected:candidates.length,added:done.length,by,done,held,
 remainingHistory:db.reviews.history.proposals.length,remainingAuto:db.reviews.auto.proposals.length}));
