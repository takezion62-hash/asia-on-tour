'use strict';
// The review rows are evidence-locked independently of changing scan queues.
// Original Epic-ID comparison is performed again at publication time.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-s30-zb-reviewed-eleven.json'),'utf8'));
const POLICY='verified-s30-zb-review-eleven-20261121';
const RULE='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const EVENT='S30_SoloZBVictoryCashCup', TOURNAMENT='ch5s3-zb-solo-victory', CUTOFF=5000;
const GOLD=Object.freeze([
  {
    "id": "auto-s30-59b4d410041c",
    "date": "2024-06-03",
    "region": "OCE",
    "player": "Hagane",
    "raw": "神里綾華KASHIRA",
    "round": "Event 1 · Round 2 / 賞金決勝",
    "kind": "賞金決勝",
    "rank": 33,
    "points": 100,
    "kills": 6,
    "vrs": 1,
    "matches": 3,
    "prize": null,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=OCE&round=S30_SoloZBVictoryCashCup_Event1Round2_OCE",
    "rulePrize": 100,
    "expectedKind": "賞金決勝",
    "expectedRound": "Event 1 · Round 2 / 賞金決勝",
    "qualification": null
  },
  {
    "id": "auto-s30-11e3e41c81e8",
    "date": "2024-07-16",
    "region": "NAC",
    "player": "vurаdd0",
    "raw": "Chateau vuraddo",
    "round": "Event 5 · Round 1 / 予選",
    "kind": "予選",
    "rank": 4639,
    "points": 100,
    "kills": 15,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 5 · Round 1 / 予選突破",
    "qualification": "advanced"
  },
  {
    "id": "auto-s30-1358b2da104b",
    "date": "2024-07-16",
    "region": "NAC",
    "player": "すかい",
    "raw": "AtlanticSkyx",
    "round": "Event 5 · Round 1 / 予選",
    "kind": "予選",
    "rank": 5356,
    "points": 95,
    "kills": 29,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 5 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-b7075ca92603",
    "date": "2024-07-16",
    "region": "NAC",
    "player": "いずべすと",
    "raw": "この心臓に花束を",
    "round": "Event 5 · Round 1 / 予選",
    "kind": "予選",
    "rank": 6033,
    "points": 91,
    "kills": 9,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 5 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-7e9095c39d3c",
    "date": "2024-07-16",
    "region": "NAC",
    "player": "らず",
    "raw": "Herbらずずずずずずずずずずず",
    "round": "Event 5 · Round 1 / 予選",
    "kind": "予選",
    "rank": 7653,
    "points": 81,
    "kills": 15,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 5 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-0c50c4d4cb6d",
    "date": "2024-07-16",
    "region": "NAC",
    "player": "きみが死ぬまで恋をしたいɞ",
    "raw": "きみが死ぬまで恋をしたいɞ",
    "round": "Event 5 · Round 1 / 予選",
    "kind": "予選",
    "rank": 9146,
    "points": 73,
    "kills": 17,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 5 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-08d7c3a10b08",
    "date": "2024-07-16",
    "region": "NAC",
    "player": "らずのっと",
    "raw": "gre y2k.",
    "round": "Event 5 · Round 1 / 予選",
    "kind": "予選",
    "rank": 9341,
    "points": 72,
    "kills": 16,
    "vrs": 0,
    "matches": 6,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 5 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-b8c50b0ea96e",
    "date": "2024-08-06",
    "region": "NAC",
    "player": "まめいし",
    "raw": "TsV 请给我一点运气",
    "round": "Event 8 · Round 1 / 予選",
    "kind": "予選",
    "rank": 6491,
    "points": 92,
    "kills": 3,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event8Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 8 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-53dc4ddf8c44",
    "date": "2024-08-06",
    "region": "NAC",
    "player": "NexF 秋鹿七緒",
    "raw": "NexF 秋鹿七緒",
    "round": "Event 8 · Round 1 / 予選",
    "kind": "予選",
    "rank": 7296,
    "points": 87,
    "kills": 9,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event8Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 8 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-8b36ae88d5a3",
    "date": "2024-08-06",
    "region": "NAC",
    "player": "mаkise",
    "raw": "mаkise",
    "round": "Event 8 · Round 1 / 予選",
    "kind": "予選",
    "rank": 8199,
    "points": 82,
    "kills": 12,
    "vrs": 0,
    "matches": 6,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event8Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 8 · Round 1 / 予選",
    "qualification": "not-advanced"
  },
  {
    "id": "auto-s30-b34b54bc7fc5",
    "date": "2024-08-06",
    "region": "NAC",
    "player": "モバイル勢のまかろん",
    "raw": "BRN 916GonLuck",
    "round": "Event 8 · Round 1 / 予選",
    "kind": "予選",
    "rank": 9586,
    "points": 75,
    "kills": 18,
    "vrs": 0,
    "matches": 7,
    "prize": 0,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event8Round1_NAC",
    "rulePrize": 0,
    "expectedKind": "予選",
    "expectedRound": "Event 8 · Round 1 / 予選",
    "qualification": "not-advanced"
  }
]);
const must=(x,why)=>{if(!x)throw Error('S30_ZB_REVIEW_ELEVEN '+why)};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function validateProof(){
 const entries=DOC.batch?.entries;
 must(DOC.version===1&&DOC.batch?.id==='source-reviewed-s30-zb-11-20261121'&&
 DOC.batch.reviewedOn==='2026-11-21'&&DOC.batch.rule===RULE&&
 entries?.length===11&&GOLD.length===11&&DOC.expected.rows===11&&
 DOC.expected.qualifiers===10&&DOC.expected.finals===1&&
 DOC.expected.personalPrize===100&&DOC.expected.qualifierAdvances===1,
 'manifest metadata changed');
 const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8')).catalog;
 const t=catalog.find(x=>x.id===TOURNAMENT);
 const rules=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8')).rules;
 const rule=rules.find(x=>x.id===TOURNAMENT);
 must(t&&t.team==='solo'&&t.mode==='zero-build'&&t.seasonId==='S30'&&
 t.sourceEventIds.includes(EVENT)&&rule?.source===RULE&&
 rule.matchCaps?.['予選']===7&&rule.matchCaps?.['賞金決勝']===3,'official catalog/rule changed');
 const seen=new Set();
 for(let i=0;i<GOLD.length;i++){
  const a=GOLD[i],item=entries[i],s=item?.source,e=item?.expected;
  must(s&&e&&!seen.has(a.id),'missing or repeated source ID '+a.id);seen.add(a.id);
  const fields=['id','date','region','player','round','kind','rank','points','kills','vrs','matches','prize','source'];
  for(const key of fields)must(s[key]===a[key],'score/identity changed '+a.id+' '+key);
  must(s.playerRaw===a.raw&&s.event==='ZB Solo Victory Cup'&&
   s.seasonId==='S30'&&s.chapter===5&&s.season===3&&
   s.tournamentId===TOURNAMENT&&s.verified===true&&
   s.reviewReason==='順位表の取得が完了していません'&&
   !s.reviewOnly&&
   e.kind===a.expectedKind&&e.round===a.expectedRound&&
   e.prize===a.rulePrize&&e.qualification===a.qualification,
   'original review evidence or decision changed '+a.id);
  const url=new URL(s.source),win=url.searchParams.get('round');
  const n=Number(a.round.match(/^Event (\d+) · Round/iu)?.[1]);
  must(url.hostname==='www.fortnite.com'&&
   url.pathname==='/competitive/events/'+EVENT+'/'&&
   url.searchParams.get('region')===a.region&&
   win===EVENT+'_Event'+n+'Round'+(a.region==='OCE'?'2':'1')+'_'+a.region&&
   s.rank>0&&s.matches>0&&s.vrs<=s.matches,'official round identity changed '+a.id);
  if(a.region==='OCE'){
   must(a.date==='2024-06-03'&&n===1&&a.rank===33&&
    a.vrs===1&&a.points===100&&a.matches<=3&&a.prize===null&&
    e.prize===100&&e.kind==='賞金決勝','Round2 1VR=$100 misclassified');
  }else{
   must(a.region==='NAC'&&['2024-07-16','2024-08-06'].includes(a.date)&&
    a.rank>=1&&a.matches<=7&&a.prize===0&&e.prize===0&&
    e.kind==='予選'&&e.qualification===(a.rank<=CUTOFF?'advanced':'not-advanced'),
    'Round1 qualifier cutoff/prize misclassified '+a.id);
  }
 }
 must(entries.reduce((n,x)=>n+x.expected.prize,0)===100 &&
 entries.filter(x=>x.expected.qualification==='advanced').length===1,'cash or qualifier totals altered');
 return true;
}
function project(item){
 const s=item.source, e=item.expected;
 const {reviewOnly:_rv,reviewReason:_rr,...raw}=s;
 const rounds=s.region==='NAC'?
 (e.qualification==='advanced'?'NAC（2024 NA）上位5,000位以内の予選突破を確認。':'NAC（2024 NA）上位5,000位圏外のため決勝進出とは扱わない。'):
 'OCEのRound 2賞金決勝。公式規則で1VRにつき個人$100。';
 const note='保存済みOsirion公式Epic-ID照合順位表で'+s.date+' '+s.region+
 ' '+s.event+' '+s.round+' '+s.rank+'位・'+s.points+'pt・'+s.matches+'試合・'+s.kills+
 'キル・'+s.vrs+'VRを確認。'+rounds+
 ' Round 1に賞金はなくRound 2のみ1VR=$100。実際の振込完了は未確認。'+
 ' 大会出典: '+s.source+' 公式規則: '+RULE;
 const row={...raw,kind:e.kind,round:e.round,prize:e.prize,note};
 if(e.kind==='賞金決勝'){row.prizePerPlayer=e.prize;row.teamPrize=e.prize}
 return row;
}
function approval(item){
 const r=project(item),s=item.source;
 return {id:s.id,recordId:s.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-21T10:19:59Z',
  approvedBy:'Owner authorized; Epic official 2024 ZB Solo rules, immutable Osirion Epic ID review checkpoint',
  source:s.source,rule:RULE,
  originalHash:hash(item),recordHash:hash(r),
  evidence:'S30 saved Osirion verified identity, official round ID, NA top5000 cutoff, OCE Round2 one VR $100'};
}
function verifyRow(r,entry){
 const e=DOC.batch.entries.find(x=>x.source.id===r?.id);
 return Boolean(e&&entry&&entry.id===r.id&&entry.recordId===r.id&&
  entry.decision==='published'&&entry.policy===POLICY&&
  entry.source===e.source.source&&entry.rule===RULE&&
  entry.originalHash===hash(e)&&entry.recordHash===hash(r)&&
  r.verified===true&&JSON.stringify(r)===JSON.stringify(project(e)));
}
validateProof();
module.exports={POLICY,RULE,EVENT,TOURNAMENT,CUTOFF,GOLD,DOC,validateProof,project,approval,verifyRow};
