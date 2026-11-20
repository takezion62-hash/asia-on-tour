'use strict';
// Source-locked owner-supplied Fortnite Tracker screenshots 1970–1979.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-s21-s25-s41-s42-ten.json'),'utf8'));
const POLICY='verified-s21-s25-s41-s42-ten-20261121';
const must=(ok,msg)=>{if(!ok)throw Error('OWNER_TEN_1970_1979 '+msg)};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function epicId(url){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
  !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
const META={
 S21:{date:'2022-07-24',region:'OCE',event:'PlayStation Cup',eventId:'S21_PlaystationCupJuly',windowId:'S21_PlaystationCupJuly_OCE_Final',tournamentId:'ch3s3-playstation-cup-july',chapter:3,season:3,mode:'battle-royale',slug:'ps',rule:'https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-3-official-rules-july-2022'},
 S25:{date:'2023-06-20',region:'BR',event:'PlayStation Cup Zero Build',eventId:'S25_PlaystationCupZBJune',windowId:'S25_PlaystationCupZBJune_Final_BR',tournamentId:'ch4s3-playstation-cup-zero-build',chapter:4,season:3,mode:'zero-build',slug:'ps-zb',rule:'https://www.fortnite.com/news/fortnite-playstation-cup-chapter-4-season-3-official-rules-june-2023'},
 S41:{date:'2026-06-09',region:'OCE',event:'Days of Play PlayStation Cup (Zero Build)',eventId:'S41_PSCupDaysOfPlay_ZB',windowId:'S41_PSCupDaysOfPlay_ZB_Final_OCE',tournamentId:'ch7s3-days-of-play-playstation-cup-zb',chapter:7,season:3,mode:'zero-build',slug:'days-zb',rule:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/days-of-play-playstation-cup-chapter-7-season-3-official-rules'},
 S42:{date:'2026-09-20',region:'EU',event:'Mobile Reload (Mini Venture) Victory Cup',eventId:'S42_MobileVictoryCup_ReloadminiV',windowId:'S42_MobileVictoryCup_Event1_Round2_EU',tournamentId:'ch7s4-mobile-reload-mini-venture-victory-cup',chapter:7,season:4,mode:'reload-zero-build',slug:'mobile',rule:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules'}
};
const GOLD=[
 [1970,'S21',62,'KENTAch','KENTAch','be7a67e6-20c7-44ac-9beb-e233eb0c6ecc',25,5,1,0,200],
 [1971,'S21',67,'おにぎりFN','おにぎりFN','bbdcb87b-5cde-4aaf-90f6-5ede2b21c804',22,3,2,0,200],
 [1972,'S21',91,'制約と誓約 これは覚悟の証','制約と誓約 これは覚悟の証','794712d9-1b0c-45fa-b04f-0349a2a8dcb2',10,6,3,0,0],
 [1973,'S21',94,'れっちりーと','れっちりーと','7e00a76c-ac8e-4e5f-8300-2233c5995784',8,6,1,0,0],
 [1974,'S21',95,'KanA','KanA','ce198d52-d8e4-4400-a8a8-44a769eeccb7',7,6,3,0,0],
 [1975,'S41',1,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',253,6,13,2,1000],
 [1976,'S25',53,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',29,6,5,0,150],
 [1977,'S42',17,'Reo','Reo','25945a39-f156-4a22-aab8-ea7808feac98',100,6,25,1,50],
 [1978,'S42',42,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',100,5,10,1,50],
 [1979,'S42',47,'れぼりゅーしょん','YOTTAれぼりゅーしゅん','34e9b17f-38a3-4b7a-a4a3-65eaab118c9a',100,6,10,1,50]
];
const makeId=(s,m,rank)=>'owner-'+s.toLowerCase()+'-'+m.region.toLowerCase()+'-'+m.slug+'-'+m.date.replace(/-/g,'')+'-r'+rank;
function validateProof(){
 const b=DOC.batch,e=DOC.expected,entries=b?.entries;
 must(DOC.version===1&&b?.id==='owner-s21-s25-s41-s42-ten-20261121'&&
  b.reviewedOn==='2026-11-21'&&entries?.length===10&&e.rows===10&&
  e.soloRows===10&&e.teamPrize===1700&&e.personalPrize===1700&&
  e.vrTotal===5&&JSON.stringify(e.newPlayers)===
  JSON.stringify(['おにぎりFN','制約と誓約 これは覚悟の証','れっちりーと']),
  'invalid proof batch');
 const catalog=read('tournaments.json').catalog,rules=read('tournament-rules.json').rules;
 const usedId=new Set(),usedRank=new Set(),accounts=new Map();
 for(let i=0;i<GOLD.length;i++){
  const [shot,s,rank,name,raw,uid,points,matches,kills,vrs,prize]=GOLD[i],m=META[s],x=entries[i];
  const source='https://fortnitetracker.com/events/epicgames_'+m.eventId+'_'+m.region+'?window='+m.windowId;
  must(x&&x.screenshot===shot&&x.id===makeId(s,m,rank)&&x.seasonId===s&&
   x.date===m.date&&x.region===m.region&&x.event===m.event&&x.eventId===m.eventId&&
   x.windowId===m.windowId&&x.tournamentId===m.tournamentId&&x.chapter===m.chapter&&
   x.season===m.season&&x.mode===m.mode&&x.rule===m.rule&&x.source===source&&
   x.round===(s==='S42'?'Event 1 · Round 2 / 賞金決勝':'Final / 賞金決勝')&&
   x.name===name&&x.rawName===raw&&x.epicUUID===uid&&epicId(x.profileUrl)===uid&&
   x.rank===rank&&x.points===points&&x.matches===matches&&x.kills===kills&&
   x.vrs===vrs&&x.prize===prize,'altered source screenshot '+shot);
  must(!usedId.has(x.id)&&!usedRank.has(m.windowId+'/'+rank),'duplicate source row '+shot);
  usedId.add(x.id);usedRank.add(m.windowId+'/'+rank);
  must(!accounts.has(uid)||accounts.get(uid)===name,'duplicate Epic account owner '+uid);
  accounts.set(uid,name);
  const t=catalog.find(z=>z.id===m.tournamentId);
  must(t&&t.name===m.event&&t.seasonId===s&&t.team==='solo'&&
   t.mode===m.mode&&t.sourceEventIds.includes(m.eventId)&&
   t.evidence?.some(y=>y.url===m.rule),'missing official event/rule '+shot);
  if(s==='S21')must(vrs===0&&((rank>=11&&rank<=90&&prize===200)||
   (rank>=91&&rank<=100&&prize===0)),'2022 OCE cash cutoff incorrect '+shot);
  if(s==='S25')must(rank>=51&&rank<=75&&prize===150&&vrs===0,'2023 BR position award '+shot);
  if(s==='S41')must(rank===1&&prize===1000&&vrs===2,'2026 OCE position award '+shot);
  if(s==='S42')must(vrs===1&&points===100&&prize===50&&matches<=6&&
   rules.some(y=>y.id===m.tournamentId&&y.prizePerVictory===50),
   '2026 EU mobile one-VR prize '+shot);
 }
 must(entries.reduce((n,x)=>n+x.prize,0)===1700&&
  entries.reduce((n,x)=>n+x.vrs,0)===5,'payout or VR sums changed');
 return true;
}
function project(x){
 const s=x.seasonId,m=META[s],pos=s==='S21'&&x.prize===0;
 const note='ユーザー提供Trackerスクリーンショット'+x.screenshot+'、'+x.date+' '+x.region+
  ' '+x.event+' '+x.round+' '+x.rank+'位、'+x.points+'pt、'+x.matches+
  '試合、'+x.kills+'キル、'+x.vrs+'VR。'+
  (pos?'OCE 2022年7月の順位賞金は90位まで。91位以下の決勝参加記録で賞金$0。':
  s==='S42'?'Epic公式の決勝1VRにつき個人賞金$50。':
  'Epic公式の順位別個人賞金$'+x.prize+'（VR数で賞金を計算しない）。')+
  '実際の賞金送金完了は未確認。順位表: '+x.source+'、公式規則: '+x.rule;
 return {id:x.id,date:x.date,region:x.region,player:x.name,players:[x.name],
  playerRaw:x.rawName,event:x.event,round:x.round,rank:x.rank,points:x.points,
  matches:x.matches,kills:x.kills,vrs:x.vrs,prize:x.prize,
  prizePerPlayer:x.prize,teamPrize:x.prize,kind:'賞金決勝',
  seasonId:s,chapter:x.chapter,season:x.season,tournamentId:x.tournamentId,
  source:x.source,profileUrl:x.profileUrl,profiles:[{name:x.name,url:x.profileUrl}],
  verified:true,note};
}
function approval(x){
 const row=project(x);return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-20T17:07:07Z',
  approvedBy:'ChatGPT / owner source screenshots 1970–1979 and Tracker Epic UUID + Epic official rules',
  source:x.source,rule:x.rule,originalHash:digest(x),recordHash:digest(row),
  evidence:'Owner Tracker screenshots 1970–1979; 2022 rank 91/94/95 zero cash, S41 OCE 1st rank prize $1000, S25 BR 53rd rank prize $150, S42 EU 1VR $50'};
}
function verifyRow(row,a){
 const x=DOC.batch.entries.find(z=>z.id===row?.id);
 return Boolean(x&&a&&a.id===row.id&&a.recordId===row.id&&a.decision==='published'&&
  a.policy===POLICY&&a.source===x.source&&a.rule===x.rule&&
  a.originalHash===digest(x)&&a.recordHash===digest(row)&&row.verified===true&&
  JSON.stringify(row)===JSON.stringify(project(x)));
}
validateProof();
module.exports={DOC,POLICY,GOLD,META,makeId,epicId,validateProof,project,approval,verifyRow};
