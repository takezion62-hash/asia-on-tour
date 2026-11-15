'use strict';
// User-supplied 7 screenshots + 14 exact Fortnite Tracker Epic account IDs.
// S36 / 2025-08-02 / NAW / Squid Grounds Cash Cup Event 6 Round 2.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(x,null,2)+'\n');
const must=(v,s)=>{if(!v)throw Error('S36_SQUID7: '+s)};
const POLICY='verified-s36-squid-naw-seven';
const BATCH='tracker-20261115-s36-naw-squid-grounds-seven';
const EVENT='Squid Grounds Cash Cup',TOURNAMENT='ch6s3-squid-grounds-cash-cup';
const SOURCE='https://fortnitetracker.com/events/epicgames_S36_SquidGroundVictoryDuosCup_NAW?window=S36_VictoryDuosCup_Event6Round2_NAW';
const RULE='https://www.fortnite.com/competitive/events/S36_SquidGroundVictoryDuosCup/?region=NAW';
const PROOF=[
 // [rank, matches, team kills, [canonical, Tracker display, Epic ID], ...]
 [4,3,16,['EXV mAximum24','EXV mAximum24','94a5d597-b290-4965-a38a-ca3f3b0061d3'],['えありー','Airy','bf6b915c-60d9-4e09-a7e1-55165440e01b']],
 [5,3,12,['Reo','Reo','25945a39-f156-4a22-aab8-ea7808feac98'],['ろみぃ','INNMU Reo','765aceae-b41b-44f7-9d8b-dd28fa6f6367']],
 [9,2,5,['asvaswgernb','asvaswgernb','34db6afd-2ce0-46be-8554-a813face02df'],['p1ng','p1ng','9766622e-ec65-443f-b8cf-2b860838c19d']],
 [10,3,5,['なずな','TsV なずねぎ','801068c3-cddd-4d65-8d56-8722a9d253e4'],['お前らグラファいってないんｗｗ','お前らグラファいってないんｗｗ','fecbcdd3-237d-4d29-bdf5-973bb2d5c596']],
 [11,3,3,['ふーくんかっこいいǃǃ','ふーくんかっこいいǃǃ','cc2a8ff9-810e-4a8f-8402-0b61b62a878b'],['goat playerfnbr','goat playerfnbr','e8815502-3abd-4dc7-a5ae-013c4d7dc00c']],
 [12,3,2,['くりたる','FTW kulitalu 10ǃ','02463a80-d495-4907-b95d-2e0bf0bfa887'],['内海ゆうま','内海ゆうま','1c2dca5c-ae09-4ffe-87ae-6176911eb7be']],
 [13,3,0,['ふぃる','ポルターガイストǃ','b8ee0fe8-a574-4c3c-a37b-b746388064ec'],['めるんやけん','がちのシャーク','d02e4ebd-1504-4724-bbcc-81263cee3779']]
];
const uuid=url=>{try{return new URL(url).searchParams.get('id')?.toLowerCase()||''}catch{return ''}};
const rawUrl=p=>'https://fortnitetracker.com/profile/all/'+encodeURIComponent(p[1])+'/events?id='+p[2];
const normalizedUrl=p=>'https://fortnitetracker.com/profile/all/'+encodeURIComponent(p[0])+'/events?id='+p[2];
const idOf=rank=>'s36-naw-squid-grounds-20250802-final-r'+rank;
function main(){
 const args=process.argv.slice(2),dry=args.length===1&&args[0]==='--dry-run';
 must(args.length===0||dry,'only --dry-run or apply');
 const results=readResults(ROOT).rows, players=read('players.json'),
       tournaments=read('tournaments.json'),ledger=read('approval-history.json'),
       updates=read('updates.json');
 must(Array.isArray(players.candidates)&&players.confirmedAliases&&
       Array.isArray(ledger.entries)&&Array.isArray(updates.entries),'invalid source docs');
 const cat=tournaments.catalog.find(t=>t.id===TOURNAMENT);
 must(cat&&cat.seasonId==='S36'&&cat.chapter===6&&cat.season===3&&
       cat.team==='duo'&&cat.name===EVENT&&
       cat.sourceEventIds.includes('S36_SquidGroundVictoryDuosCup'),'wrong tournament');
 const originalCount=results.length,originalCash=results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 const known=new Set(players.candidates.map(p=>p.name));
 must(known.size===players.candidates.length,'duplicate candidate');
 const old='この心臓に花束を',fresh='いずべすと';
 must(!known.has(fresh)||!known.has(old),'old/new canonical names are both present');
 let renamed=0;
 if(known.has(old)){
   const p=players.candidates.find(p=>p.name===old);
   p.name=fresh; p.initials='いず'; known.delete(old);known.add(fresh);
   const prior=players.confirmedAliases[old]||[];
   delete players.confirmedAliases[old];
   const next=players.confirmedAliases[fresh]||[];
   players.confirmedAliases[fresh]=[...new Set([...next,...prior,old])];
 }
 must(known.has(fresh)&&(players.confirmedAliases[fresh]||[]).includes(old),
      'old alias must be preserved under new canonical name');
 for(const r of results){
   const original=r.player;
   if(Array.isArray(r.players)&&r.players.includes(old))
     r.players=r.players.map(n=>n===old?fresh:n);
   if(typeof r.player==='string')
     r.player=r.player.split(' / ').map(n=>n===old?fresh:n).join(' / ');
   if(Array.isArray(r.profiles))for(const p of r.profiles)
     if(p.name===old)p.name=fresh;
   if(original!==r.player)renamed++;
 }
 const owner=new Map([...known].map(n=>[n,n]));
 for(const [name,aliases] of Object.entries(players.confirmedAliases)){
   must(known.has(name)&&Array.isArray(aliases),'alias canonical missing: '+name);
   for(const alias of aliases){
     must(!owner.has(alias)||owner.get(alias)===name,'alias collision '+alias);
     owner.set(alias,name);
   }
 }
 const newPlayers=[],newAliases=[],added=[],already=[];
 for(const [rank,matches,kills,p1,p2] of PROOF){
   must(p1[2]!==p2[2]&&matches>=1&&matches<=3,'invalid team');
   for(const p of [p1,p2]){
     const name=p[0],raw=p[1];
     if(!known.has(name)){
       must(!owner.has(name),'canonical collision '+name);
       players.candidates.push({name,initials:name.slice(0,2),accent:'cyan',
         desc:'2025/8/2 NAW Squid Grounds Cash Cup デュオ決勝'+rank+
          '位・チーム'+kills+'K・1VR・個人賞金$100。ユーザー提供画像とTracker本人Epic IDで照合。'});
       known.add(name);owner.set(name,name);newPlayers.push(name);
     }
     must(owner.get(name)===name,'not the same canonical account: '+name);
     if(raw!==name&&!owner.has(raw)){
       if(!players.confirmedAliases[name])players.confirmedAliases[name]=[];
       players.confirmedAliases[name].push(raw);
       owner.set(raw,name);
       newAliases.push({name,alias:raw});
     }
     must(owner.get(raw)===name,'raw nickname mapped to different account: '+raw);
     const url=rawUrl(p);
     must(uuid(url)===p[2],'bad UUID '+name);
     for(const existing of results){
       const links=Array.isArray(existing.profiles)?existing.profiles:
         (existing.profileUrl?[{name:existing.player,url:existing.profileUrl}]:[]);
       for(const previous of links)
         if(uuid(previous.url)===p[2])
           must(owner.get(previous.name)===name,
             'Epic UUID attached to another canonical: '+p[2]+' / '+previous.name+' vs '+name);
     }
   }
   const id=idOf(rank), rosterNames=[p1[0],p2[0]],oldEntry=results.find(r=>r.id===id);
   const preexisting=results.filter(r=>r.date==='2025-08-02'&&r.region==='NAW'&&
     r.tournamentId===TOURNAMENT&&r.round.includes('Round 2')&&
     (r.rank===rank||rosterNames.every(n=>(r.players||[r.player]).includes(n))));
   if(oldEntry){
     must(preexisting.length===1&&oldEntry===preexisting[0]&&oldEntry.prize===200&&
       oldEntry.kills===kills&&oldEntry.vrs===1&&
       JSON.stringify(oldEntry.players)===JSON.stringify(rosterNames),
       'existing result differs: '+id);
     already.push(id);continue;
   }
   must(preexisting.length===0,'duplicate historic team for '+id);
   must(!ledger.entries.some(e=>e.recordId===id),'orphan approval '+id);
   const row={id,date:'2025-08-02',region:'NAW',
     player:rosterNames.join(' / '),players:rosterNames,
     playerRaw:p1[1]+' / '+p2[1],event:EVENT,
     round:'Event 6 · Round 2 / 賞金決勝',kind:'賞金決勝',
     rank,points:100,matches,kills,vrs:1,prize:200,teamPrize:200,
     prizePerPlayer:100,seasonId:'S36',chapter:6,season:3,
     tournamentId:TOURNAMENT,source:SOURCE,
     profiles:[{name:p1[0],url:rawUrl(p1)},{name:p2[0],url:rawUrl(p2)}],
     teamAccountIds:[p1[2].replace(/-/g,''),p2[2].replace(/-/g,'')],
     verified:true,note:'2026/11/15提供のFortnite Tracker画像7枚で'+rank+
       '位・100pt・'+matches+'試合・チーム'+kills+'K・1VRを確認。'+
       'Tracker個別プロフィール2件でEpic IDを照合。'+
       '大会公式ページは1VRにつきチーム$200（各$100）と明記。'+
       '支払完了は未確認。'+RULE};
   results.push(row);
   ledger.entries.push({id,recordId:id,decision:'published',policy:POLICY,
     approvedAt:new Date().toISOString(),
     approvedBy:'ChatGPT / 2026-11-15 user screenshots and linked Epic UUIDs',
     source:SOURCE,rule:RULE,
     evidence:'User screenshot '+rank+'th + 2 exact UUIDs; NAW Event6 Round2, 1VR=$200 duo'});
   added.push(row);
 }
 must(PROOF.length===7&&PROOF.reduce((n,p)=>n+p[2],0)===43,'proof sum changed');
 must(new Set(results.map(r=>r.id)).size===results.length,'duplicate record IDs');
 must(results.length===originalCount+added.length,'record loss');
 const nextCash=results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 must(nextCash-originalCash===added.length*20000,'incorrect total cash delta');
 if(added.length){
   must(!updates.entries.some(e=>e.id===BATCH),'duplicate announcement');
   updates.entries.unshift({id:BATCH,date:'2026-11-15',type:'records',
     title:'2025/8/2 NAW Squid Grounds Cash Cup決勝：7デュオ14選手',
     description:'画像7枚・14個のEpic IDを照合。4・5・9〜13位の7組、計43K・7VR、チーム賞金$1,400（各選手$100）。名義「この心臓に花束を」は「いずべすと」に更新。',
     recordIds:added.map(r=>r.id)});
 }
 const report=validateData({results,players,tournaments});
 must(!report.errors.length,'data validation '+JSON.stringify(report.errors.slice(0,6)));
 const approvals=audit(results,ledger,players);
 must(!approvals.length,'approvals '+JSON.stringify(approvals.slice(0,6)));
 const history=validateUpdateLog(results,updates);
 must(!history.length,'update log '+JSON.stringify(history.slice(0,6)));
 if(!dry){
   if(added.length||renamed)publishResults(ROOT,results);
   if(added.length||renamed||newPlayers.length||newAliases.length){
     write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
   }
 }
 console.log('S36_SQUID7 '+JSON.stringify({dry,added:added.length,already:already.length,
  renamedHistoricalRecords:renamed,newPlayers,newAliases,
  cashDelta:(nextCash-originalCash)/100,totalRecords:results.length}));
}
if(require.main===module)main();
module.exports={PROOF,POLICY,BATCH,SOURCE,RULE};