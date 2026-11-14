'use strict';
// Idempotent and fail-closed publisher for two independently validated historical ME duo finals.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-kame-me-duos-two.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const write=(n,obj)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(obj,null,2)+'\n');
const check=(ok,msg)=>{if(!ok)throw Error('KAME_ME_DUOS_TWO: '+msg)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
check(args.length===0||(args.length===1&&dry),'only --dry-run is supported');
const proof=read('data/manual-approvals/20261114-kame-me-duos-two-proof.json');
check(proof.version===1&&proof.batch?.id==='tracker-20261114-kame-me-duos-two'&&Array.isArray(proof.batch.entries)&&proof.batch.entries.length===2,'invalid independent screenshot proof');
const results=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
check(Array.isArray(players.candidates)&&players.confirmedAliases&&Array.isArray(ledger.entries)&&Array.isArray(updates.entries),'invalid supporting data');
const oldIds=new Set(results.map(x=>x.id)),oldCount=results.length;
const sumCash=arr=>arr.reduce((sum,x)=>sum+Math.round((x.prize||0)*100),0);
const sumPersonal=arr=>arr.reduce((sum,x)=>sum+personalCents(x)*roster(x).length,0);
const oldCash=sumCash(results),oldPersonal=sumPersonal(results);
const known=new Set(players.candidates.map(x=>x.name));
const identities=new Map([...known].map(x=>[x,x]));
for(const [name,aliases] of Object.entries(players.confirmedAliases)){
 check(known.has(name)&&Array.isArray(aliases),'broken existing alias '+name);
 for(const alias of aliases){check(!identities.has(alias)||identities.get(alias)===name,'ambiguous original alias '+alias);identities.set(alias,name);}
}
const first=V.TARGETS[0], second=V.TARGETS[1];
check(first.seasonId==='S31'&&second.seasonId==='S22'&&first.rank===40&&second.rank===38,'unexpected target configuration');
check(known.has('Kame')&&known.has('ZAZI')&&known.has('KAME')&&'Kame'!=='KAME','original Kame identity must remain separate from KAME');
check(!identities.has('Ryle')||identities.get('Ryle')==='Ryle','Ryle is already another player alias');
let newPlayer=false,newAlias=false;
if(!known.has('Ryle')){
 players.candidates.push({name:'Ryle',initials:'RY',accent:'cyan',
  desc:'2024/10/04 ME Duos Cash Cup Event5 Round2：Kameと40位・40pt・4チームキル・0VR、チーム$200（各$100）。Tracker表示名「Ryle ay лол 7」、Epic ID 9b426796-99ef-41c9-9349-e15c60890634で本人確認。'});
 known.add('Ryle');identities.set('Ryle','Ryle');newPlayer=true;
}
const alias='Ryle ay лол 7';
check(!identities.has(alias)||identities.get(alias)==='Ryle','Tracker alias already owned by another player');
if(identities.get(alias)!=='Ryle'){
 (players.confirmedAliases.Ryle??=[]).push(alias);identities.set(alias,'Ryle');newAlias=true;
}
const added=[],existing=[];
for(const t of V.TARGETS){
 const evidence=proof.batch.entries.find(x=>x.id===t.id);
 check(evidence&&JSON.stringify(evidence)===JSON.stringify(t),'screenshot proof or fixed rank data mismatch '+t.id);
 check(t.players.length===2&&t.uuids.length===2&&t.profiles.length===2&&t.uuids.every((id,i)=>V.uuid(t.profiles[i].url)===id),'missing/invalid original account identities '+t.id);
 check(t.profiles.every(p=>known.has(p.name)&&identities.get(p.name)===p.name),'unknown or aliased canonical team player '+t.id);
 check(V.payout(t)===t.prize&&t.prizePerPlayer*2===t.prize&&t.matches===6&&t.vrs===0,'prize formula or scoreboard mismatch '+t.id);
 const catalog=tournaments.catalog.find(c=>c.id===t.tournamentId);
 check(catalog&&catalog.seasonId===t.seasonId&&catalog.chapter===t.chapter&&catalog.season===t.season&&catalog.team==='duo'&&catalog.name===t.event&&catalog.sourceEventIds.includes(t.eventId),'tournament catalog mismatch '+t.id);
 check(t.sourceTracker==='https://fortnitetracker.com/events/epicgames_'+t.eventId+'_ME?window='+t.windowId,'incorrect window ID '+t.id);
 for(let i=0;i<2;i++){
  for(const r of results)for(const p of r.profiles||[]){
   if(V.uuid(p.url)===t.uuids[i])check(identities.get(p.name)===t.players[i]||p.name===t.players[i],'Epic ID assigned to a different player '+p.name+' vs '+t.players[i]);
  }
 }
 const old=results.find(x=>x.id===t.id),entries=ledger.entries.filter(x=>x.recordId===t.id);
 if(old){
  check(entries.length===1&&V.verifyCashRow(old,entries[0]),'existing row or approval diverges '+t.id);
  existing.push(t.id);continue;
 }
 check(entries.length===0,'orphan approval entry '+t.id);
 const eventRows=results.filter(x=>x.date===t.date&&x.region===t.region&&x.tournamentId===t.tournamentId&&x.round===t.round);
 check(!eventRows.some(x=>x.rank===t.rank),'existing same-rank competitor '+t.id);
 check(!eventRows.some(x=>Array.isArray(x.players)&&[...x.players].sort().join('|')===[...t.players].sort().join('|')),'duplicate team competitor '+t.id);
 const note='ユーザー提供Fortnite Tracker画像「'+t.screenshot+'」と両選手のEpic IDを照合。'+t.date+' ME '+t.event+' '+t.round+'：'+t.rank+'位・'+t.points+'pt・'+t.matches+'試合・'+t.kills+'チームキル・'+t.vrs+'VR。Epic公式賞金規則：チーム$'+t.prize+'、各選手$'+t.prizePerPlayer+'。順位賞金であり実際の入金は未確認。Tracker: '+t.sourceTracker+' Rule: '+t.rule;
 const row={id:t.id,date:t.date,region:t.region,player:t.players.join(' / '),players:[...t.players],profiles:t.profiles.map(p=>({...p})),teamAccountIds:t.uuids.map(x=>x.replace(/-/g,'')),teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,playerRaw:t.playerRaw,event:t.event,round:t.round,rank:t.rank,points:t.points,kills:t.kills,vrs:t.vrs,prize:t.prize,kind:'賞金決勝',matches:t.matches,seasonId:t.seasonId,chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,source:t.sourceTracker,verified:true,note,trackerStats:{verified:true,source:t.sourceTracker,avgPlace:t.avgPlace,avgTimeAliveSeconds:t.avgTimeAliveSeconds,kdRatio:t.kdRatio}};
 const approval={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,approvedAt:new Date().toISOString(),approvedBy:'ChatGPT / user-provided 2026-11-14 screenshots and Epic official rules',source:t.sourceTracker,rule:t.rule,evidence:'User screenshot '+t.screenshot+'; two exact Epic UUIDs, official date/window and Middle East rank payout'};
 check(V.verifyCashRow(row,approval),'independent row validation failed '+t.id);
 results.push(row);ledger.entries.push(approval);added.push(row);
}
check(oldIds.size===oldCount&&results.length===oldCount+added.length,'unexpected count or duplicate original IDs');
check(sumCash(results)===oldCash+added.reduce((n,r)=>n+r.prize*100,0)&&sumPersonal(results)===oldPersonal+added.reduce((n,r)=>n+r.prize*100,0),'cash / personal cash total drift');
if(added.length){
 check(!updates.entries.some(x=>x.id===proof.batch.id),'duplicate update history');
 updates.entries.unshift({id:proof.batch.id,date:'2026-11-14',type:'records',title:'Kame：2022 ME Elite Cupと2024 ME Duos Cash Cup決勝2件を追加',
 description:'本人とRyle/ZAZIのEpicアカウントID、Fortnite Trackerの順位・キル・VR・賞金画像、Epic公式地域別賞金表で確認。2022/10/23 38位$400、2024/10/4 40位$200（どちらもチーム賞金・各選手半額）。既存の2022/10/30 Week5記録を保持。合計チーム賞金+$600。実際の受領は未確認。',
 recordIds:added.map(x=>x.id)});
}
const errors=validateData({results,players,tournaments});
check(errors.errors.length===0,'data validation: '+JSON.stringify(errors.errors.slice(0,4)));
const approvals=audit(results,ledger,players);
check(approvals.length===0,'approval ledger: '+JSON.stringify(approvals.slice(0,4)));
const histories=validateUpdateLog(results,updates);
check(histories.length===0,'update log: '+JSON.stringify(histories.slice(0,4)));
if(!dry){
 if(added.length)publishResults(ROOT,results);
 if(added.length||newPlayer||newAlias){write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);}
}
console.log('KAME_ME_DUOS_TWO '+JSON.stringify({mode:dry?'dry-run':'apply',added:added.map(x=>({id:x.id,rank:x.rank,prize:x.prize,players:x.players})),existing:existing.length,newPlayer,newAlias,addedCash:added.reduce((n,x)=>n+x.prize,0),afterCount:results.length}));
