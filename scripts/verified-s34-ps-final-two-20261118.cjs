'use strict';
// Independently refetched S34 ME PlayStation Finals original Epic UUID evidence.
// Attendance only. Prize stays null; this is NOT evidence of a cash award.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const FILE='data/manual-approvals/20261118-s34-me-ps-final-two-recheck.json';
const bytes=fs.readFileSync(path.join(ROOT,FILE));
const BLOB=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const EXPECTED_BLOB='e31a83cdf028c780f0713d9b33a971146d1e51b4';
const proof=JSON.parse(bytes.toString('utf8'));
const POLICY='verified-s34-me-playstation-final-attendance-two-20261118';
const IDS=['auto-s34-74d1f337746f','auto-s34-04720ffe5218'];
const REFS=[{id:IDS[0],player:'モバイル勢のまかろん',rank:56,points:63,kills:6,vrs:0,matches:6},
 {id:IDS[1],player:'くりたる',rank:64,points:47,kills:2,vrs:0,matches:6}];
const URL='https://www.fortnite.com/competitive/events/S34_PlaystationCup/?region=ME&round=S34_PlaystationCupFinal_ME';
const W='S34_PlaystationCupFinal_ME';
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const must=(v,m)=>{if(!v)throw Error('S34_PS_TWO '+m)};
function validateProof(){
 must(BLOB===EXPECTED_BLOB,'pinned original API Git blob altered');
 must(proof?.version===1&&proof.checkedOn==='2026-11-18'&&
  Array.isArray(proof.checkedIds)&&JSON.stringify(proof.checkedIds)===JSON.stringify(IDS)&&
  proof.providerTotalPages===1&&proof.pageErrors===0&&
  Array.isArray(proof.verified)&&proof.verified.length===2&&
  Array.isArray(proof.held)&&proof.held.length===0&&
  proof.event?.eventId==='S34_PlaystationCup'&&
  proof.event?.region==='ME'&&proof.event?.windowId===W&&
  proof.event?.dateJst==='2025-05-01','original Epic research incomplete');
 const seen=new Set();
 for(const p of proof.verified){
  const r=p.original,s=REFS.find(x=>x.id===r?.id);
  must(s&&!seen.has(r.id)&&r.player===s.player&&r.rank===s.rank&&
   r.points===s.points&&r.kills===s.kills&&r.vrs===s.vrs&&r.matches===s.matches&&
   r.date==='2025-05-01'&&r.region==='ME'&&r.seasonId==='S34'&&
   r.tournamentId==='ch6s2-playstation-cup'&&
   r.event==='PlayStation Cup'&&r.source===URL&&
   r.round==='単一開催枠 / 参加確認'&&r.kind==='参加確認'&&
   r.prize===null&&r.verified===true&&r.reviewOnly===true&&
   p.observedPage===0&&p.windowKey===proof.event.key&&
   Array.isArray(p.teamAccountIds)&&p.teamAccountIds.length===1&&
   /^[0-9a-f]{32}$/.test(p.teamAccountIds[0]),
   'person rank score or original Epic UUID differs '+r?.id);
  seen.add(r.id);
 }
 must(seen.size===2,'exact two verified players required');
 return true;
}
function published(p,tournaments){
 const r=p.original;
 const c=tournaments.catalog.find(x=>x.id==='ch6s2-playstation-cup');
 must(c&&c.name==='PlayStation Cup'&&c.seasonId==='S34'&&
  c.team==='solo'&&c.sourceEventIds.includes('S34_PlaystationCup'),
  'historical tournament catalog changed');
 const {reviewReason,reviewOnly,teamAccountIds,note,...base}=r;
 return {...base,kind:'参加確認',prize:null,
  note:'2026/11/18 Epic公式S34 PlayStation Cup ME Finalsの元順位表を再取得。'+
   '本人Epic UUID・'+r.rank+'位・'+r.points+'pt・'+r.kills+'K・'+
   r.vrs+'VR・'+r.matches+'試合を独立照合。決勝出場のみ掲載。'+
   '現金賞金・賞品獲得は未確定のまま扱い、賞金ランキングには加算しない。出典: '+URL};
}
function entryFor(p,r,at){
 return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,
  approvedAt:at,approvedBy:'ChatGPT / owner authorized Epic source recheck',
  source:URL,candidateSha256:hash(p.original),
  epicUuidSha256:hash(p.teamAccountIds),recordSha256:hash(r),
  evidence:'Pinned independently fetched original Epic Finals score blob '+EXPECTED_BLOB+
   '; exact Epic UUID identity, original rank and score; no cash award inferred'};
}
function verifyPublished(r,e){
 try{
  const p=proof.verified.find(x=>x.original.id===r?.id);
  if(!p||e?.id!==r.id||e.recordId!==r.id||e.decision!=='published'||
   e.policy!==POLICY||e.source!==URL||r.source!==URL||
   e.candidateSha256!==hash(p.original)||
   e.epicUuidSha256!==hash(p.teamAccountIds)||
   e.recordSha256!==hash(r)||r.teamAccountIds!==undefined)return false;
  return JSON.stringify(published(p,read('tournaments.json')))===JSON.stringify(r);
 }catch{return false}
}
validateProof();
module.exports={FILE,POLICY,URL,IDS,REFS,proof,hash,validateProof,published,entryFor,verifyPublished};