'use strict';
// 2026-11-19 immutable source-observed pending batch: full-board S37 finals and
// consecutive-but-incomplete S30 solo Round 1 only. Never infer missing pages.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),FILE='data/manual-approvals/20261119-verified-pending-22.json';
const bytes=fs.readFileSync(path.join(ROOT,FILE));
const actualBlob=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const EXPECTED_BLOB='0d9e6cdd72ef81b9a923fbe75543b90b9cb640f7';
const SNAP=JSON.parse(bytes.toString('utf8'));
const POLICY='verified-pending-22-20261119';
const RULES=Object.freeze({
 S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'
});
const CONFIG=Object.freeze([
 {season:'S37',region:'NAW',event:'S37_ConsoleDuosCashCups',window:'S37_ConsoleDuosCashCups_Event4Round2_NAW',tournament:'ch6s4-console-duos-victory',date:'2025-09-15',team:2,qty:5,pages:3,total:3,complete:true},
 {season:'S37',region:'OCE',event:'S37_ConsoleDuosCashCups',window:'S37_ConsoleDuosCashCups_Event5Round2_OCE',tournament:'ch6s4-console-duos-victory',date:'2025-09-20',team:2,qty:2,pages:3,total:3,complete:true},
 {season:'S30',region:'NAC',event:'S30_SoloZBVictoryCashCup',window:'S30_SoloZBVictoryCashCup_Event8Round1_NAC',tournament:'ch5s3-zb-solo-victory',date:'2024-08-06',team:1,qty:13,pages:52,total:100,complete:false},
 {season:'S30',region:'NAC',event:'S30_SoloVictoryCashCup',window:'S30_SoloVictoryCashCup_Event5Round1_NAC',tournament:'ch5s3-solo-victory-cup',date:'2024-07-16',team:1,qty:2,pages:96,total:100,complete:false}
]);
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const must=(ok,why)=>{if(!ok)throw Error('PENDING22_PROOF '+why)};
const hash=obj=>crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const asKey=c=>'epicgames_'+c.event+'_'+c.region+'/'+c.window;
const allRows=()=>SNAP.groups.flatMap(g=>g.targetRows);
function validateProof(){
 must(actualBlob===EXPECTED_BLOB,'frozen original source blob differs');
 must(SNAP.version===1&&SNAP.reviewedOn==='2026-11-19'&&
  SNAP.expected?.count===22&&SNAP.expected.finalZero===7&&SNAP.expected.qualifying===12&&
  SNAP.expected.attendance===3&&SNAP.expected.teamCash===0&&SNAP.expected.individualCash===0&&
  Array.isArray(SNAP.groups)&&SNAP.groups.length===4,'proof metadata changed');
 const ids=new Set(),rosters=new Set();let n=0,qualifiers=0,attend=0,finalZero=0;
 for(let i=0;i<CONFIG.length;i++){
  const c=CONFIG[i],g=SNAP.groups[i],m=g?.checkpoint;
  must(g&&g.key===asKey(c)&&Array.isArray(g.targetRows)&&g.targetRows.length===c.qty,
   'wrong checkpoint group '+i);
  must(m&&m.pages===c.pages&&m.nextPage===c.pages&&m.totalPages===c.total&&
   m.complete===c.complete&&m.rankingOrderValid===true&&m.emptyAttempts===0&&
   Number.isFinite(Date.parse(m.lastSuccessAt||''))&&
   (c.complete?m.pages===m.totalPages:m.pages<m.totalPages),'observed contiguous pages changed '+g.key);
  if(c.complete)must(!m.lastError&&!m.lastErrorCode&&!m.retryAfter,'complete final board shows error');
  for(const x of g.targetRows){
   must(x&&x.verified===true&&x.date===c.date&&x.region===c.region&&
    x.tournamentId===c.tournament&&x.seasonId===c.season&&
    x.event===(c.season==='S37'?'Duos Console Victory Cash Cup':c.event.includes('ZB')?'ZB Solo Victory Cup':'Solo Victory Cup Battle Royale')&&
    x.source==='https://www.fortnite.com/competitive/events/'+c.event+'/?region='+c.region+'&round='+c.window&&
    x.rank>=1&&x.rank<=m.lastSeenRank&&x.matches>=1&&x.matches<=(c.season==='S37'?3:7)&&
    Number.isSafeInteger(x.points)&&x.points>=0&&Number.isSafeInteger(x.kills)&&x.kills>=0&&
    Number.isSafeInteger(x.vrs)&&x.vrs>=0&&x.vrs<=x.matches,'source row invalid '+x?.id);
   must(!ids.has(x.id)&&/^auto-s(30|37)-[0-9a-f]{12}$/.test(x.id),'duplicate or invalid id');
   ids.add(x.id);n++;
   if(c.season==='S37'){
    must(Array.isArray(x.players)&&x.players.length===2&&x.player===x.players.join(' / ')&&
     Array.isArray(x.teamAccountIds)&&x.teamAccountIds.length===2&&
     x.teamAccountIds.every(id=>/^[0-9a-f]{32}$/.test(id))&&
     new Set(x.teamAccountIds).size===2&&x.vrs===0&&x.points===0&&x.prize===null&&x.kind==='賞金決勝'&&
     x.round.endsWith('Round 2 / 賞金決勝'),'not a 0VR duo final '+x.id);
    finalZero++;
   }else{
    must(!x.players&&!x.teamAccountIds&&x.prize===0&&x.kind==='予選'&&
     x.round.includes('Round 1')&&x.rank<=m.lastSeenRank,'not a proven solo round1 '+x.id);
    if(x.rank<=5000)qualifiers++;else attend++;
   }
   const roster=[c.window,x.rank,...(x.players||[x.player])].join('|');
   must(!rosters.has(roster),'duplicate window rank/roster '+x.id);rosters.add(roster);
  }
 }
 must(n===22&&finalZero===7&&qualifiers===12&&attend===3,'proof count changed');return true;
}
function configFor(row){return CONFIG.find(c=>row.date===c.date&&row.region===c.region&&row.tournamentId===c.tournament);}
function publish(row){
 const cfg=configFor(row);must(cfg,'unknown source record '+row.id);
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 const isFinal=cfg.season==='S37',passed=!isFinal&&row.rank<=5000;
 const state=isFinal?'賞金決勝':passed?'予選突破':'参加確認';
 const kind=isFinal?'賞金決勝':passed?'予選':'参加確認';
 const round='Event '+(cfg.window.includes('Event4')?'4':cfg.window.includes('Event8')?'8':'5')+
  ' · Round '+(isFinal?'2':'1')+' / '+state;
 const detail=isFinal?'元の全3ページ順位表でデュオ2人のEpic UUID・順位・試合・0VRを確認。Round2の公式ルールは1VR=チーム$200/各$100につき、0VRなら現金$0。':
  '元の連続取得済み'+SNAP.groups[CONFIG.indexOf(cfg)].checkpoint.pages+'ページのうち、'+row.rank+'位を観測。順位表全ページは未取得で、順位・ポイント・キル・試合数は保存済み本人紐付けの観測値。公式NA上位5000位'+(passed?'につき予選突破圏内。':'の圏外のため参加確認。')+'Round1賞金は$0。';
 return {...base,kind,round,prize:0,note:row.date+' '+cfg.region+' '+row.event+' '+detail+
  ' 根拠: '+row.source+' 公式規則: '+RULES[cfg.season]+' 証拠Git blob: '+EXPECTED_BLOB};
}
function approval(row){
 const cfg=configFor(row),record=publish(row);
 return {id:row.id,recordId:row.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-19T08:11:29Z',approvedBy:'ChatGPT / owner-authorized original source audit',
  source:row.source,rule:RULES[cfg.season],candidateSha256:hash(row),recordSha256:hash(record),
  evidence:'Frozen Epic-linked checkpoint '+EXPECTED_BLOB+'; observed original page and verified official VR payout or NA top5000 rule'};
}
function verifyPublished(record,entry){
 try{
  if(!record||!entry||entry.id!==record.id||entry.recordId!==record.id||entry.decision!=='published'||
   entry.policy!==POLICY||entry.source!==record.source)return false;
  const source=allRows().find(x=>x.id===record.id),cfg=source&&configFor(source);
  return !!(source&&cfg&&entry.rule===RULES[cfg.season]&&entry.candidateSha256===hash(source)&&
   entry.recordSha256===hash(record)&&record.verified===true&&record.teamAccountIds===undefined&&
   JSON.stringify(record)===JSON.stringify(publish(source)));
 }catch{return false}
}
validateProof();
module.exports={FILE,EXPECTED_BLOB,POLICY,RULES,CONFIG,SNAP,allRows,hash,validateProof,publish,approval,verifyPublished};
