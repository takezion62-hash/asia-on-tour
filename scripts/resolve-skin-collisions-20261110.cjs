'use strict';
// Idempotent source-backed reconciliation of the five remaining S42 OCE
// cosmetic Cup review candidates. Never create a second result for a single
// previously-published team or infer the receipt of a cosmetic reward.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {getLeaderboard,normalizeRow,linkedAccounts}=require('./osirion-sync.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
const assert=(x,m)=>{if(!x)throw Error('SKIN_COLLISION_20261110: '+m)};
const keep=new Set([
 'auto-s42-a24e5836dc3e','auto-s42-56de183f4301',
 'auto-s42-f00b45faa40f','auto-s42-30f247fe9002','auto-s42-0c28f52906c0'
]);
const eventUrl={
 S42_ChampionTealKnightFNCSCup:'https://fortnitetracker.com/events/epicgames_S42_ChampionTealKnightFNCSCup_OCE',
 S42_InoxtagIconCup:'https://fortnitetracker.com/events/epicgames_S42_InoxtagIconCup_OCE'
};
const fingerprint=(x,y)=>['player','date','region','event','points','kills','vrs'].every(k=>x[k]===y[k])&&
 JSON.stringify(x.players||[])===JSON.stringify(y.players||[]);
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
const canonicalMembers=r=>Array.isArray(r.players)?r.players:[r.player];
async function main(){
 const db={review:read('history-sync-review.json'),results:read('results.json'),
  reviewed:read('history-sync-reviewed.json'),status:read('history-sync-status.json'),
  players:read('players.json'),scan:read('history-sync-scan.json'),updates:read('updates.json')};
 const pending=db.review.proposals.filter(x=>keep.has(x.id));
 const publishedIds=new Set(db.reviewed.entries.map(x=>x.id));
 const linked=linkedAccounts({results:db.results,players:db.players}).accounts;
 const linkedById=new Map(linked.map(x=>[x.epicAccountId,x.player]));
 const verified=[],held=[],now=new Date().toISOString();
 const liveCache=new Map(),liveErrors=new Map();
 for(const p of pending){
  try{
   assert(p.date.startsWith('2026-10-')&&p.region==='OCE'&&p.kind==='参加確認'&&p.prize===null&&p.verified===true,'candidate unexpected');
   const u=new URL(p.source),eventId=decodeURIComponent(u.pathname.split('/')[3]),wid=u.searchParams.get('round');
   assert(eventUrl[eventId]&&wid===eventId+'_OCE','unsupported skin event/window');
   const key='epicgames_'+eventId+'_OCE/'+wid,cp=db.scan.windows[key];
   assert(cp&&cp.rankingOrderValid===true&&cp.proposals.some(x=>sameScannedCandidate(x,p)),'missing authentic saved score checkpoint');
   const existing=db.results.filter(r=>collision(r,p,db.players.confirmedAliases));
   assert(existing.length===1,'different/multiple published results for player/window');
   const r=existing[0];
   assert(r.kind==='スキン大会'&&r.prize===0&&r.source===eventUrl[eventId]&&fingerprint(p,r),'not an identical already-published cosmetic event');
   assert(Math.abs(p.rank-r.rank)<=1,'rank discrepancy exceeds tie margin');
   assert(!r.matches||r.matches===p.matches,'match count disagreement');
   let rank=p.rank,reason='same checkpoint rank and all official scores';
   if(r.rank!==p.rank){
    // Reconcile a tie/order change by fetching the official current first page.
    if(!liveCache.has(eventId)&&!liveErrors.has(eventId)){
     try{
      const win={key,fullEventId:'epicgames_'+eventId+'_OCE',eventId,windowId:wid,region:'OCE'};
      const page=await getLeaderboard(win,0);
      assert(page?.entries?.length>=20,'live leaderboard first page incomplete');
      liveCache.set(eventId,{page,win});
     }catch(e){liveErrors.set(eventId,String(e.message||e))}
    }
    assert(!liveErrors.has(eventId),'live rank verification unavailable '+liveErrors.get(eventId));
    const {page,win}=liveCache.get(eventId);
    const possibilities=page.entries.filter(e=>{
     if(Math.abs(e.rank-p.rank)>2)return false;
     const n=normalizeRow(e,win);
     return !!n&&n.points===p.points&&n.kills===p.kills&&n.vrs===p.vrs&&n.matches===p.matches;
    });
    assert(possibilities.length===1,'live row ambiguous or absent: '+p.id);
    const e=possibilities[0],n=normalizeRow(e,win);
    const idMatch=n.teamAccountIds.length===canonicalMembers(p).length&&
      n.teamAccountIds.every((id,i)=>linkedById.get(id)===canonicalMembers(p)[i]);
    const names=String(p.playerRaw||'').split(' / ');
    const nameMatch=names.length===e.players.length&&names.every((n,i)=>norm(n)===norm(e.players[i].username));
    assert(idMatch||nameMatch,'live leaderboard does not match Epic roster or exact historical username: '+p.id);
    rank=e.rank;reason='live Epic leaderboards verified rank '+rank+' (tracker '+r.rank+' / saved '+p.rank+')';
   }
   verified.push({id:p.id,existingId:r.id,player:p.player,oldRank:r.rank,verifiedRank:rank,reason,existing:r});
  }catch(e){held.push({id:p.id,player:p.player,reason:String(e.message||e).slice(0,300)})}
 }
 const report={considered:pending.length,verified:verified.length,held:held.length,
  rankCorrections:verified.filter(x=>x.oldRank!==x.verifiedRank).map(x=>({player:x.player,from:x.oldRank,to:x.verifiedRank})),
  verifiedRows:verified.map(x=>({id:x.id,player:x.player,existingId:x.existingId})),heldRows:held};
 console.log('AOT_SKIN_COLLISION_AUDIT '+JSON.stringify(report));
 if(process.argv.includes('--dry-run')||!verified.length)return;
 for(const x of verified){
  assert(!publishedIds.has(x.id),'existing review ledger id already processed');
  if(x.oldRank!==x.verifiedRank){
   x.existing.rank=x.verifiedRank;
   x.existing.note=(x.existing.note||'')+' / Epic公式順位表で順位を再照合。'+x.reason+'。衣装報酬は未認定。';
  }
  db.reviewed.entries.push({id:x.id,decision:'already-published',
   reviewedAt:now,existingId:x.existingId,policy:'exact-epic-skin-score-and-live-rank',
   source:'https://www.fortnite.com/competitive/events/'+
       (x.player.includes(' / ')?'S42_InoxtagIconCup':'S42_ChampionTealKnightFNCSCup')+
       '/?region=OCE',
   evidence:'Matched official score checkpoint to original tracker result; '+x.reason});
  publishedIds.add(x.id);
 }
 const resolved=new Set(verified.map(x=>x.id));
 db.review.proposals=db.review.proposals.filter(x=>!resolved.has(x.id));
 db.review.manualReviewedAt=now;db.status.found=db.review.proposals.length;
 db.status.manualReviewCandidates=db.review.proposals.length;
 db.status.reviewOnlyCandidates=db.review.proposals.filter(x=>x.reviewOnly).length;
 db.status.lastReviewedBatchAt=now;
 db.status.message='確認済みスキン大会の同一成績'+verified.length+'件を再照合して重複整理。確認待ち'+db.review.proposals.length+'件。衣装報酬は未推定。';
 db.reviewed.reviewedAt=now;
 const corrected=verified.filter(x=>x.oldRank!==x.verifiedRank);
 if(corrected.length){
  const id='reconciled-skin-cup-rank-20261110';
  assert(!db.updates.entries.some(x=>x.id===id),'duplicate correction history id');
  db.updates.entries.unshift({id,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
   type:'site',title:'スキン大会の順位をEpic公式に照合',
   description:'同一プレイヤー・チームの重複候補を取り除き、Epic公式順位表の最新版と順位が食い違う成績のみ修正。衣装報酬・賞金は未認定。',
   recordIds:[]});
 }
 for(const [f,v] of Object.entries({
  'results.json':db.results,'history-sync-review.json':db.review,
  'history-sync-status.json':db.status,'history-sync-reviewed.json':db.reviewed,
  'updates.json':db.updates}))write(f,v);
 console.log('AOT_SKIN_COLLISION_PUBLISHED '+JSON.stringify(report));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
