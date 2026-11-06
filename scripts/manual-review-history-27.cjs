'use strict';
/**
 * Manual, audit-first publication of 27 historical leaderboard candidates.
 * No writes. The runner validates this plan and commits all changes atomically.
 * Important: incomplete *full* Osirion scans are not described as completed;
 * only the individual saved rows are verified.
 */
const GROUPS=Object.freeze({
 finals:[
 'auto-s42-9ff30369a26c','auto-s42-5a825677d2d4','auto-s42-9e7be28e6c7c',
 'auto-s42-496519595fd7','auto-s42-027d5381d576','auto-s42-54ec150bd2e3',
 'auto-s42-a41659f9b38c','auto-s42-a4c8ec722c24','auto-s42-647d09cc941a',
 'auto-s42-28b5b699eca2','auto-s42-342e7bd91c92','auto-s42-d240ccfc8b9c'
 ],
 qualifiers:[
 'auto-s42-baf1097ab0cf','auto-s42-abf16c7099f7','auto-s42-f5a99cc084dd',
 'auto-s42-cf87191bfb16','auto-s42-b7cd961ea3b4','auto-s42-cf42d6072c7a'
 ],
 attendance:[
 'auto-s43-30b7f135ab56','auto-s43-149bd548fde1','auto-s42-8836614cb29e',
 'auto-s41-7d4ad42765d6','auto-s42-022d37809401','auto-s42-2436078854f2',
 'auto-s42-0004c9469484','auto-s42-b36e390ef0ca'
 ],
 cash:['auto-s31-727a67581880']
});
const RULES=Object.freeze({
 vc:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules',
 duo:'https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules'
});
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const keyNames=r=>roster(r).slice().sort().join('\x1f');
const source=r=>{
 const m=String(r?.source||'').match(/^https:\/\/www\.fortnite\.com\/competitive\/events\/([^/]+)\/\?region=([A-Z]+)&round=([^&#]+)$/);
 return m?{eventId:m[1],region:m[2],win:m[3]}:null;
};
const win=r=>String(r?.source||'').match(/[?&](?:round|window)=([^&#]+)/)?.[1]||null;
const assert=(condition,message)=>{if(!condition)throw Error(message)};
const props=['id','date','region','player','playerRaw','players','event','round','rank','points','kills','vrs','prize','kind','matches','seasonId','chapter','season','tournamentId','source','verified','reviewOnly'];
const sameStored=(a,b)=>props.every(k=>JSON.stringify(a?.[k]??null)===JSON.stringify(b?.[k]??null));
const legalInt=(n,min)=>Number.isSafeInteger(n)&&n>=min;
const withinDay=(d1,d2)=>Number.isFinite(Date.parse(d1))&&Number.isFinite(Date.parse(d2))&&Math.abs(Date.parse(d1)-Date.parse(d2))<=86400000;
function validateCandidate(c,group,db,lookup,planned){
 const s=source(c),people=roster(c),cat=lookup.tours.get(c.tournamentId);
 assert(c.verified===true&&/^auto-s\d+-[a-z0-9]{12}$/.test(c.id||''),'unverified candidate '+c.id);
 assert(s&&s.region===c.region&&s.win.startsWith(c.seasonId+'_')&&s.win.endsWith('_'+c.region),'invalid source '+c.id);
 assert(cat&&cat.name===c.event&&cat.seasonId===c.seasonId&&cat.sourceEventIds?.includes(s.eventId),'missing exact catalog '+c.id);
 assert(people.length===({solo:1,duo:2,trio:3,squad:4})[cat.team]&&new Set(people).size===people.length&&people.every(p=>lookup.known.has(p)),'unknown Epic ID or team '+c.id);
 assert(c.player===people.join(' / '),'player presentation does not match confirmed team '+c.id);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(c.date)&&Number.isFinite(Date.parse(c.date))&&
   new Date(c.date).toISOString().slice(0,10)===c.date,'invalid date '+c.id);
 assert(['rank','matches'].every(k=>legalInt(c[k],1))&&
   ['points','kills','vrs'].every(k=>legalInt(c[k],0))&&c.vrs<=c.matches,'invalid score '+c.id);
 const cs=db.calendars[c.date.slice(0,7)]?.sessions||[];
 assert(cs.some(x=>x.dateJst===c.date&&x.region===c.region&&x.eventId===s.eventId&&
   x.sourceWindowId===s.win&&x.tournamentId===c.tournamentId&&x.seasonId===c.seasonId),'calendar does not match official event '+c.id);
 const checkpoints=Object.entries(db.scan.windows||{}).filter(([k,p])=>
   k==='epicgames_'+s.eventId+'_'+c.region+'/'+s.win&&p.proposals?.some(x=>x.id===c.id));
 assert(checkpoints.length===1,'missing or ambiguous API checkpoint '+c.id);
 const check=checkpoints[0][1],saved=check.proposals.find(x=>x.id===c.id);
 assert(sameStored(c,saved)&&check.nextPage>0,'saved API candidate content mismatch '+c.id);
 assert(!lookup.existingIds.has(c.id)&&!lookup.ledgerIds.has(c.id),'already processed candidate '+c.id);
 const same=planned.filter(r=>r.region===c.region&&r.tournamentId===c.tournamentId&&
   keyNames(r)===keyNames(c)&&withinDay(r.date,c.date)&&win(r)===s.win);
 assert(same.length===0,'same player, event window and region already exist: '+c.id+' -> '+same.map(x=>x.id).join(','));
 if(group==='finals'){
   assert(c.seasonId==='S42'&&c.tournamentId==='ch7s4-solo-victory-cup'&&
     c.kind==='賞金決勝'&&c.vrs===0&&c.points===0&&c.prize===null&&c.matches<=3&&
     /Event\s*[13]\s*·\s*Round\s*2/.test(c.round),'0VR final restrictions mismatch '+c.id);
 }else if(group==='qualifiers'){
   assert(c.seasonId==='S42'&&c.date==='2026-09-06'&&c.region==='NAW'&&
     c.tournamentId==='ch7s4-solo-victory-cup'&&c.kind==='予選'&&
     c.rank<=800&&c.prize===0&&c.matches<=8&&/Event\s*1\s*·\s*Round\s*1/.test(c.round),
     'NAW top800 qualification restrictions mismatch '+c.id);
 }else if(group==='cash'){
   assert(c.seasonId==='S31'&&c.date==='2024-09-13'&&c.region==='ME'&&
     c.tournamentId==='ch5s4-duos-cash-cup'&&cat.team==='duo'&&c.reviewOnly===true&&
     c.rank===17&&c.points===124&&c.kills===9&&c.vrs===0&&c.matches===6&&
     check.complete===true&&c.prize===null&&/Event\s*2\s*·\s*Round\s*2/.test(c.round),
     'cash prize candidate differs from complete ME final '+c.id);
   // Restrict to saved Round 1 rank < 50, in addition to confirmed Round 2 rank.
   const previous=planned.filter(x=>x.tournamentId===c.tournamentId&&x.region==='ME'&&
     x.date==='2024-09-12'&&keyNames(x)===keyNames(c)&&
     win(x)==='S31_DuosCashCup_Event2Round1_ME');
   assert(previous.length===1&&previous[0].rank<=50,'no verified precursor qualifier for cash final '+c.id);
 }else if(group==='attendance'){
   assert(c.reviewOnly===true&&c.kind==='参加確認'&&c.prize===null,'not a no-award attendance proposal '+c.id);
 }else throw Error('Unsupported group');
 return {checkpoint:check,source:s,cat};
}
function build(db,options={}){
 assert(Array.isArray(db.results)&&Array.isArray(db.reviews?.proposals)&&db.scan?.windows&&
   Array.isArray(db.players?.candidates)&&Array.isArray(db.tournaments?.catalog)&&
   Array.isArray(db.ledger?.entries)&&Array.isArray(db.updates?.entries),'invalid database');
 const manifest=new Map(Object.entries(GROUPS).flatMap(([group,ids])=>ids.map(id=>[id,group])));
 assert(manifest.size===27&&Object.values(GROUPS).reduce((a,b)=>a+b.length,0)===27,'manifest count or uniqueness error');
 const mapped=new Map(db.reviews.proposals.map(x=>[x.id,x]));
 assert(db.reviews.proposals.length>=manifest.size&&mapped.size===db.reviews.proposals.length,'pending queue changed/doubled');
 for(const id of manifest.keys())assert(mapped.has(id),'expected candidate disappeared '+id);
 const lookup={
   tours:new Map(db.tournaments.catalog.map(x=>[x.id,x])),
   known:new Set(db.players.candidates.map(x=>x.name)),
   existingIds:new Set(db.results.map(x=>x.id)),
   ledgerIds:new Set(db.ledger.entries.map(x=>x.id))
 };
 assert(lookup.existingIds.size===db.results.length,'existing records have duplicate IDs');
 const results=db.results.map(x=>({...x})),added=[],audit=[];
 for(const [id,group] of manifest){
   const c=mapped.get(id);
   const checked=validateCandidate(c,group,db,lookup,results);
   const {reviewOnly,reviewReason,...base}=c;
   const record={...base};
   let awardRule=null;
   if(group==='finals'){
     record.prize=0;awardRule=RULES.vc;
     record.note='Epic CH7 S4 Solo Victory Cup Round 2の公式ルールはVRごとに$100。保存済み本人順位表で0VR確認のため$0。順位表全ページは未回収。公式: '+awardRule;
   }else if(group==='qualifiers'){
     record.round='Event 1 · Round 1 / 予選突破';record.prize=0;awardRule=RULES.vc;
     record.note='Epic CH7 S4公式NAW上位800名が決勝進出対象。個別順位'+c.rank+'位をEpic本人IDと保存済み順位表で確認。予選は現金賞金0。順位表全ページは未回収。公式: '+awardRule;
   }else if(group==='cash'){
     record.kind='賞金決勝';record.round='Event 2 · Round 2 / 賞金決勝';
     record.prize=200;record.prizePerPlayer=100;awardRule=RULES.duo;
     record.note='Epic CH5 S4 Duos Cash Cup ME Event2 Round2：保存済み完全順位表17位/124pt/6試合/9キル/0VR。公式Attachment CでME6〜40位はチーム規定賞金$200、2人で均等配分各$100。受給資格・実際の支払は別途確認対象。公式: '+awardRule;
   }else if(group==='attendance'){
     record.kind='参加確認';record.prize=null;
     record.note=(c.note||'')+' 管理者確認でEpic本人ID・公式開催枠・保存済み順位表を再照合。決勝突破・個人賞金・スキン等の未確認報酬は一切認定しない。全体の順位表取得が未完了の場合でも個別確認分のみ掲載: '+c.source;
   }
   assert(!Object.hasOwn(record,'reviewOnly')&&!Object.hasOwn(record,'reviewReason'),'raw review metadata leaked '+id);
   assert(record.prize===0||record.prize===null||(group==='cash'&&record.prize===200&&record.prizePerPlayer===100),'unrecognized award '+id);
   results.push(record);
   added.push({group,id,record,rule:awardRule,checkpointComplete:checked.checkpoint.complete===true});
   audit.push({id,decision:'published',group,recordId:id,player:record.player,region:c.region,date:c.date,kind:record.kind,rank:c.rank,
     prize:record.prize,prizePerPlayer:record.prizePerPlayer||null,source:c.source,
     fullScanComplete:checked.checkpoint.complete===true,rule:awardRule,
     evidence:'Confirmed Epic ID, saved Osirion leaderboard row, official calendar source window and no prior same player/window/region'});
 }
 assert(added.length===27,'wrong number of new rows');
 const remaining=db.reviews.proposals.filter(x=>!manifest.has(x.id));
 const stamp=options.timestamp||new Date().toISOString();
 const review={...db.reviews,proposals:remaining,manualReviewedAt:stamp};
 const status={...db.status,found:remaining.length,manualReviewCandidates:remaining.length,
   reviewOnlyCandidates:remaining.filter(x=>x.reviewOnly===true).length,
   manualReviewProcessed:27,manualReviewResolvedAt:stamp,
   message:'過去大会確認候補27件をEpic本人ID・公式規則・保存順位表と突合して掲載。ME Duos Cash Cup17位のチーム規定賞金$200（各$100）を含む。未確認報酬なし。'};
 const ledger={...db.ledger,reviewedAt:stamp,entries:db.ledger.entries.concat(
   audit.map(x=>({id:x.id,decision:'published',recordId:x.recordId,rule:x.rule,
     evidence:x.evidence+'; fullScanComplete='+x.fullScanComplete,
     approvedAt:stamp,source:x.source}))};
 const updateId='history-reviewed-27-20261106';
 assert(!db.updates.entries.some(x=>x.id===updateId),'review update already published');
 const update={id:updateId,date:stamp.slice(0,10),type:'records',
   title:'過去大会の確認候補27戦績を追加（うちME Duos Cash Cup賞金1件）',
   description:'2026/9 NAW Solo VC決勝0VR11件＋NAC1件、NAW予選突破6件、2024/9 ME Duos Cash Cup決勝17位チーム規定賞金$200（各$100）、出場確認8件。Epic本人ID・開催枠・保存済み順位表の照合と重複防止を実施。全順位表未回収の大会は個別確認分のみ記録し、未確認スキン・参加賞は認定しない。',
   recordIds:added.map(x=>x.id)};
 const updates={...db.updates,entries:[update,...db.updates.entries]};
 const report={version:1,reviewedAt:stamp,source:'Epic official 2024/2026 competition rules + Osirion saved leaderboard + official calendars',
   processed:27,added:added.length,groups:Object.fromEntries(Object.entries(GROUPS).map(([g,ids])=>[g,ids.length])),
   additionalTeamCash:200,additionalPerPlayer:100,before:db.results.length,after:results.length,
   entries:audit};
 return {results,review,status,ledger,updates,report,added};
}
module.exports={GROUPS,RULES,source,win,sameStored,validateCandidate,build};
