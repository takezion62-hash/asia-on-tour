'use strict';
// Promote identity-verified participation rows into the normal overseas results.
// Cash, cosmetics and advancement remain unconfirmed unless there is an
// explicit, versioned, region-specific rule. Idempotent by source window+roster.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const save=(f,obj)=>fs.writeFileSync(path.join(root,f),JSON.stringify(obj,null,2)+'\n');
const outcomes={
 'ch7s5-squads-victory-cup':{cutoff:{EU:300,NAC:200,NAW:120,ME:120,OCE:120,BR:120},source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-squads-victory-cup-chapter-7-mini-season-official-rules'},
 'ch7s4-console-zero-build-solo-victory-cup':{cutoff:{EU:2000,NAC:2000,NAW:1000,ME:1000,OCE:1000,BR:1000},source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules'},
 'ch5s3-solo-victory-cup':{cutoff:{EU:7000,BR:2000,ME:2000,OCE:2000},source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'},
 'ch5s3-zb-solo-victory':{cutoff:{EU:7000,BR:2000,ME:2000,OCE:2000},source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'},
 'ch5s4-solo-victory-cup':{cutoff:{EU:15000,BR:2500,ME:2000,OCE:1500},source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules'},
 'ch6s3-console-duos-victory':{cutoff:{EU:500,NAC:500,NAW:250,ME:250,OCE:250,BR:250},source:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules'}
};
const seasons={S30:[5,3],S31:[5,4],S36:[6,3],S39:[7,1],S40:[7,2],S42:[7,4],S43:[7,5]};
const members=x=>x.players?.length?x.players:[x.player];
const windowId=x=>{try{return new URL(x.source).searchParams.get('round')||x.round}catch{return x.round}};
const signature=x=>[x.date,x.region,x.tournamentId,windowId(x),members(x).slice().sort().join('|')].join('::');
const placement=x=>[x.date,x.region,x.tournamentId,windowId(x),x.rank,x.points,x.kills,x.vrs].join('::');
function promote(){
 const records=read('results.json'),index=read('participation-index.json');
 const catalog=new Map(read('tournaments.json').catalog.map(t=>[t.id,t]));
 const aliasOwners=new Map(Object.entries(read('players.json').confirmedAliases||{}).flatMap(([name,aliases])=>aliases.map(a=>[a,name])));
 const canonName=n=>aliasOwners.get(n)||n;
 const byKey=new Set(records.map(signature)),byStats=new Map(records.map(r=>[placement(r),r]));
 const byId=new Set(records.map(r=>r.id));
 const appended=[],skipped=[];
 for(const m of index.months){
  const file='participation/'+m.month+'.json',doc=read(file);
  if(doc.month!==m.month||doc.entries.length!==m.count)throw Error('archive index mismatch '+m.month);
  for(const x of doc.entries){
   if(!x.verified)throw Error('unverified archive row '+x.id);
   if(!Number.isSafeInteger(x.rank)||x.rank<1||!Number.isSafeInteger(x.kills)||x.kills<0||
      !Number.isSafeInteger(x.points)||x.points<0||!Number.isSafeInteger(x.matches)||x.matches<1||
      !Number.isSafeInteger(x.vrs)||x.vrs<0||x.vrs>x.matches)throw Error('invalid score '+x.id);
   const k=signature(x),old=byStats.get(placement(x));
   if(byKey.has(k)||old&&members(old).some(n=>members(x).includes(n))){
    skipped.push(x.id);continue;
   }
   if(byId.has(x.id))throw Error('different result with duplicate id '+x.id);
   const rule=outcomes[x.tournamentId],limit=rule?.cutoff?.[x.region]??x.officialCutoff??null;
   // In 2024 North America was NA, not NAC. Never infer a 2024 NAC cutoff.
   const round1=x.stage==='予選'||(/Round\s*1/i.test(x.round)&&x.stage!=='賞金決勝');
   const round2=x.stage==='賞金決勝'||/Round\s*2/i.test(x.round);
   const qualifies=round1&&Number.isSafeInteger(limit)?x.rank<=limit:null;
   const kind=round2?'賞金決勝':round1?'予選':'参加確認';
   const prize=round1?0:round2&&x.vrs===0?0:null;
   const detail=qualifies===true
     ?'公式上位'+limit+'位以内。'+x.rank+'位で予選突破を確認。'
     :qualifies===false
     ?'公式上位'+limit+'位以内の突破条件に対し'+x.rank+'位で予選敗退。'
     :x.qualification==='outside-cutoff'
     ?'出典照合済みの予選通過圏外。'
     :'予選突破・スキン獲得資格は未確定。';
   const note='Epic IDと公式大会ウィンドウの保存済み順位表で順位・キル・VRを照合。'+detail+
     (round1?'Round 1現金賞金$0。':round2&&x.vrs===0?'決勝0VRのため現金賞金$0。':'現金賞金・コスメ報酬を推定しない。')+
     ' 大会規則: '+(rule?.source||x.source);
   const verifiedCatalog=catalog.get(x.tournamentId);
   if(!verifiedCatalog||verifiedCatalog.seasonId!==x.seasonId||verifiedCatalog.name!==x.event)throw Error('catalog mismatch '+x.id);
   const {chapter,season}=verifiedCatalog;
   const canonicalPlayers=members(x).map(canonName);
   if(new Set(canonicalPlayers).size!==canonicalPlayers.length)throw Error('duplicate aliases '+x.id);
   const canonicalRound=round2?String(x.round).replace(/\/\s*(?:参加確認|決勝|賞金決勝|予選)$/u,'/ 賞金決勝'):x.round;
   const r={id:x.id,date:x.date,region:x.region,player:canonicalPlayers.join(' / '),
     ...(canonicalPlayers.length>1?{players:canonicalPlayers}:{}),
     event:x.event,round:canonicalRound,rank:x.rank,points:x.points,kills:x.kills,
     vrs:x.vrs,matches:x.matches,prize,kind,seasonId:x.seasonId,
     ...(chapter?{chapter,season}:{}),tournamentId:x.tournamentId,
     source:x.source,verified:true,
     qualification:qualifies===true?'qualified':qualifies===false?'outside-cutoff':x.qualification||'unverified',
     note};
   records.push(r);appended.push(r);byKey.add(k);byId.add(x.id);
   byStats.set(placement(x),r);
  }
 }
 if(appended.length<1)throw Error('no new canonical results');
 if(records.length!==new Set(records.map(r=>r.id)).size)throw Error('duplicate result ids');
 save('results.json',records);
 const updates=read('updates.json');
 const updateId='archive-promoted-to-results-20261110';
 if(!updates.entries.some(e=>e.id===updateId)){
  updates.entries.unshift({id:updateId,date:'2026-11-10',type:'records',
   title:'予選突破・敗退を照合し、出場記録を遠征結果へ統合',
   description:'保存済みEpic IDと大会順位表・公式地域別通過条件を再照合。公式通過条件のない大会は未判定。賞金・スキンを推定せず、出場戦績を通常の遠征結果へ統合。',
   recordIds:appended.map(r=>r.id)});
  save('updates.json',updates);
 }
 const summary={added:appended.length,duplicates:skipped.length,
   qualified:appended.filter(r=>r.qualification==='qualified').length,
   eliminated:appended.filter(r=>r.qualification==='outside-cutoff').length,
   unverified:appended.filter(r=>r.qualification==='unverified').length,
   examples:appended.filter(r=>r.date==='2026-11-10'&&r.region==='NAW').map(r=>({player:r.player,rank:r.rank,qualification:r.qualification}))};
 fs.writeFileSync(path.join(root,'participation-promotion-report.json'),JSON.stringify(summary,null,2)+'\n');
 console.log('PROMOTION_SUMMARY',JSON.stringify(summary));
 return summary;
}
if(require.main===module)promote();
module.exports={promote,outcomes,signature};
