'use strict';
// User-supplied Tracker screenshots #2062-#2071, 2026-11-22 S43 Event3.
// Idempotent one-shot publisher: all 30 profile UUIDs, screenshot scores,
// per-region official cash bracket and prior records are checked before write.
// A zero-cash rank does not imply zero victory royales.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const PROOF_PATH='data/manual-approvals/20261123-s43-trios-event3-ten.json';
const EVENT='S43_TriosCashCup',TOURNAMENT='ch7s5-trios-cash-cup',DATE='2026-11-22';
const POLICY='verified-rule',UPDATE='tracker-s43-trios-20261122-oce-me-ten';
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-trios-cash-cups-chapter-7-mini-season-official-rules';
const EXPECTED=[
 ['OCE',519,136,6,7,0,['XSET Reetϟ','かなはむだお','スイッチ勢黒猫']],
 ['OCE',549,119,5,23,0,['zfa-a200PXMPMANM','ZFA-A 200PXMPMAN','78123819']],
 ['ME',51,352,11,62,1,['Saku','顎','しいら']],
 ['ME',59,346,11,22,1,['a72wxdxczha','arim','にじいろベタ']],
 ['ME',109,317,8,22,1,['がおおおおおおおおおおおお','ふとしぃ','ポテットくらげ']],
 ['ME',110,316,11,19,0,['IPF STANDRY','ウン！ボクつよい！','IPF ねめしす']],
 ['ME',111,316,9,8,0,['Faze benjyfishyε','NBL ぐんさん PULISIC','るた']],
 ['ME',119,311,9,8,0,['kamiti-akyuma1','merefishy','ワンパンで一目惚れ']],
 ['ME',134,305,9,3,0,['やわらちゃんねる','毒りんごジャム','はむたろう']],
 ['ME',162,293,11,8,0,['ねむじすた','Shirochan on PS4','かに1128.']]
];
const fail=(condition,reason)=>{if(!condition)throw Error('S43_TRIOS_EVENT3 '+reason)};
const get=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const key=t=>t.region+':'+t.rank;
const recordId=t=>'manual-s43-trios-20261122-'+t.region.toLowerCase()+'-r'+t.rank;
const officialUrl=t=>'https://www.fortnite.com/competitive/events/'+EVENT+'/?region='+t.region+'&round='+EVENT+'_Event3_'+t.region;
const normId=s=>typeof s==='string'?s.replace(/-/g,'').toLowerCase():'';
function verifyProof(doc,rules){
 fail(doc?.version===1&&doc.checkedAt==='2026-11-23'&&doc.date===DATE&&
  doc.eventId===EVENT&&doc.tournamentId===TOURNAMENT&&doc.ruleUrl===RULE&&
  Array.isArray(doc.teams)&&doc.teams.length===EXPECTED.length,'wrong evidence batch');
 const rule=rules?.rules?.find(x=>x.id===TOURNAMENT);
 fail(rule&&rule.seasonId==='S43'&&rule.series==='cash-cup'&&rule.team==='trio'&&
   rule.source===RULE&&rule.eventIds?.includes(EVENT)&&rule.matchCaps?.['単一ラウンド']===11,
   'official S43 tournament definition changed');
 const uniqueKeys=new Set(),uniqueIds=new Set(),uniqueTeamUUIDs=new Set();
 for(let i=0;i<EXPECTED.length;i++){
  const t=doc.teams[i],e=EXPECTED[i];
  fail(t&&[t.region,t.rank,t.points,t.matches,t.kills,t.vrs].every((v,j)=>v===e[j])&&
   t.screenshot===2062+i&&t.sourceOfficial===officialUrl(t)&&
   t.trackerEventUrl==='https://fortnitetracker.com/events/epicgames_'+EVENT+'_'+t.region+'?window='+EVENT+'_Event3_'+t.region&&
   Array.isArray(t.members)&&t.members.length===3&&
   JSON.stringify(t.members.map(m=>m.name))===JSON.stringify(e[6]),
   'screenshot stats, team or event link differ: '+i);
  fail(!uniqueKeys.has(key(t)),'duplicate region/rank '+key(t));
  uniqueKeys.add(key(t));
  fail(['OCE','ME'].includes(t.region)&&t.rank>5&&t.rank>0&&t.matches>=1&&
    t.matches<=11&&t.kills>=0&&t.vrs>=0&&t.vrs<=t.matches,'invalid non-prize placement');
  const tier=rule.cashPrizes?.tiers?.[t.region];
  fail(Array.isArray(tier)&&tier.length>0&&tier[0].through===1&&tier[0].perPlayer===300&&
    tier.at(-1)?.through===5&&tier.at(-1)?.perPlayer===100,
    'official top-five prize tiers changed');
  const names=new Set();
  for(const m of t.members){
   fail(typeof m.name==='string'&&m.name.trim()===m.name&&m.name.length>0&&
     typeof m.raw==='string'&&m.raw.trim()===m.raw&&m.raw.length>0&&
     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(m.uuid)&&
     m.url===`https://fortnitetracker.com/profile/all/${encodeURIComponent(m.raw)}/events?id=${m.uuid}`,
     'unverifiable or malformed original player profile: '+m?.name);
   fail(!names.has(m.name)&&!uniqueIds.has(m.uuid),'duplicate teammate or Epic UUID');
   names.add(m.name);uniqueIds.add(m.uuid);
   uniqueTeamUUIDs.add(normId(m.uuid));
  }
 }
 fail(uniqueTeamUUIDs.size===30,'not 30 distinct source-linked UUIDs');
 return true;
}
function entryFor(t,when){
 const id=recordId(t);
 return {id,recordId:id,decision:'published',policy:POLICY,approvedAt:when,
  approvedBy:'ChatGPT / owner provided 2026-11-22 Tracker screenshots',
  source:officialUrl(t),rule:RULE,
  evidence:'Tracker screenshot #'+t.screenshot+'; three original Epic UUID profile URLs; exact Event3 rank/points/matches/eliminations/VR; official OCE/ME top5 cash bracket (rank '+t.rank+' = $0 per player).'};
}
function rowFor(t){
 const names=t.members.map(m=>m.name),raw=t.members.map(m=>m.raw);
 return {id:recordId(t),date:DATE,region:t.region,player:names.join(' / '),
  playerRaw:raw.join(' / '),event:'Trios Cash Cup Battle Royale',
  round:'Event 3 / 賞金決勝',rank:t.rank,points:t.points,kills:t.kills,
  vrs:t.vrs,prize:0,kind:'賞金決勝',matches:t.matches,seasonId:'S43',
  chapter:7,season:5,tournamentId:TOURNAMENT,source:officialUrl(t),verified:true,
  players:names,prizePerPlayer:0,teamAccountIds:t.members.map(m=>normId(m.uuid)),
  profiles:t.members.map(m=>({name:m.name,url:m.url})),
  note:'Fortnite Trackerスクリーンショット#'+t.screenshot+'と3選手のEpic UUID付き本人プロフィールを照合。'+DATE+' '+t.region+' Trios Cash Cup Event3、'+t.rank+'位・'+t.points+'pt・'+t.matches+'試合・'+t.kills+'キル・'+t.vrs+'VR。Epic公式ルールでOCE/MEの現金賞金対象は上位5組、'+t.rank+'位は圏外のため個人$0、チーム$0（VR数は賞金判定に用いない）。出典: '+t.trackerEventUrl+' 規則: '+RULE};
}
function publish({dryRun=false}={}){
 const proof=get(PROOF_PATH),rules=get('tournament-rules.json');
 verifyProof(proof,rules);
 const db={results:readResults(ROOT).rows,players:get('players.json'),
  tournaments:get('tournaments.json'),ledger:get('approval-history.json'),
  updates:get('updates.json')};
 const t=db.tournaments.catalog.find(x=>x.id===TOURNAMENT);
 fail(t?.seasonId==='S43'&&t.name==='Trios Cash Cup Battle Royale'&&
  t.team==='trio'&&t.mode==='battle-royale'&&t.sourceEventIds?.includes(EVENT),
  'registered tournament does not match screenshot');
 const known=new Set(db.players.candidates.map(x=>x.name));
 const aliasOwner=new Map(Object.entries(db.players.confirmedAliases||{})
  .flatMap(([name,aliases])=>aliases.map(alias=>[alias,name])));
 const oldIds=new Set(db.results.map(r=>r.id));
 const priorApproval=new Map(db.ledger.entries.map(e=>[e.recordId,e]));
 const fresh=[],skipped=[],addedPlayers=[];
 const now=new Date().toISOString();
 for(const item of proof.teams){
  const row=rowFor(item),entry=entryFor(item,now);
  const found=db.results.find(x=>x.id===row.id);
  const same=db.results.filter(x=>x.date===row.date&&x.region===row.region&&
   x.tournamentId===row.tournamentId&&x.source===row.source&&
   x.player===row.player);
  if(found){
   fail(JSON.stringify(found)===JSON.stringify(row)&&
    priorApproval.get(row.id)?.source===row.source&&
    priorApproval.get(row.id)?.policy===POLICY,
    'previous result/evidence differs: '+row.id);
   fail(same.length===1,'duplicate published result: '+row.id);
   skipped.push(row.id);continue;
  }
  fail(!oldIds.has(row.id)&&same.length===0&&!priorApproval.has(row.id),
    'colliding old result: '+row.id);
  for(const m of item.members){
   fail(!aliasOwner.has(m.name)||aliasOwner.get(m.name)===m.name,
    'player canonical name already owned by another alias: '+m.name);
   fail(!aliasOwner.has(m.raw)||aliasOwner.get(m.raw)===m.name,
    'Tracker identity belongs to a different player: '+m.raw);
   if(!known.has(m.name)){
    db.players.candidates.push({
     name:m.name,initials:m.name.slice(0,2).toUpperCase(),
     accent:['cyan','pink','violet'][addedPlayers.length%3],
     desc:DATE+' '+item.region+' Trios Cash Cup Battle Royale Event3、'+item.rank+
      '位・'+item.points+'pt・'+item.kills+'チームキル・'+item.vrs+
      'VR、個人現金賞金$0。Tracker表示名「'+m.raw+
      '」。本人Epic UUID付きプロフィールと提供画像で照合済み。'
    });
    known.add(m.name);addedPlayers.push(m.name);
   }
   // Use the user-confirmed original display name as a historical alias.
   // Do not claim it is a distinct competitor from the confirmed canonical name.
   if(m.raw!==m.name){
    if(!Array.isArray(db.players.confirmedAliases[m.name]))
     db.players.confirmedAliases[m.name]=[];
    if(!db.players.confirmedAliases[m.name].includes(m.raw))
     db.players.confirmedAliases[m.name].push(m.raw);
    aliasOwner.set(m.raw,m.name);
   }
  }
  db.results.push(row);db.ledger.entries.push(entry);oldIds.add(row.id);
  fresh.push(row);
 }
 if(fresh.length){
  upsertPublicationLog(db.updates,{id:UPDATE,date:'2026-11-23',
   title:'2026/11/22 S43 OCE/ME Trios Cash Cup 10組の順位・参加成績',
   description:'提供された10枚のTracker画面と30個の本人UUIDを照合。OCE/MEの公式順位賞金は上位5組まで、対象10組は全員$0。シーズン・名鑑・承認記録を安全に更新。',
   recordIds:fresh.map(x=>x.id)});
  db.updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors;
 fail(errors.length===0,'schema: '+JSON.stringify(errors.slice(0,4)));
 const approvals=approvalAudit(db.results,db.ledger,db.players);
 fail(approvals.length===0,'approval history: '+JSON.stringify(approvals.slice(0,4)));
 const logErrors=validateUpdateLog(db.results,db.updates);
 fail(logErrors.length===0,'update log: '+JSON.stringify(logErrors.slice(0,4)));
 if(fresh.length&&!dryRun){
  publishResults(ROOT,db.results);
  write('players.json',db.players);
  write('approval-history.json',db.ledger);
  write('updates.json',db.updates);
 }
 return {dryRun,selected:proof.teams.length,added:fresh.map(x=>({id:x.id,region:x.region,rank:x.rank,player:x.player,prize:x.prize})),
  already:skipped.length,newPlayers:addedPlayers.length,original:db.results.length-fresh.length,after:db.results.length,
  prizeAdded:0};
}
if(require.main===module){
 const args=process.argv.slice(2);
 fail(args.length===0||args.length===1&&args[0]==='--dry-run','only --dry-run allowed');
 console.log('S43_TRIOS_EVENT3 '+JSON.stringify(publish({dryRun:args.includes('--dry-run')})));
}
module.exports={verifyProof,rowFor,entryFor,publish,EXPECTED,POLICY,RULE};
