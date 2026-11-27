'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-mobile-naw-20261127.cjs');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,x)=>fs.writeFileSync(path.join(root,f),JSON.stringify(x,null,2)+'\n');
const must=(ok,msg)=>{if(!ok)throw Error('MOBILE_NAW_NOV27 '+msg)};
function run(dry){
 const rows=readResults(root).rows,players=read('players.json'),tournaments=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(p=>p.name)),aliases=new Map([...known].map(n=>[n,n]));
 for(const [n,alts] of Object.entries(players.confirmedAliases))for(const a of alts){must(!aliases.has(a)||aliases.get(a)===n,'alias conflict '+a);aliases.set(a,n)}
 const sum=x=>x.reduce((a,r)=>a+Math.round((r.prize||0)*100),0);
 const personal=x=>x.reduce((a,r)=>a+personalCents(r)*roster(r).length,0);
 const before={count:rows.length,cash:sum(rows),personal:personal(rows)},added=[],already=[],existing=[];
 must(V.GOLD.length===10&&V.GOLD.reduce((a,x)=>a+x[13],0)===2250,'batch total mismatch');
 const owners=new Map(),targetIds=new Set(Object.values(V.profiles).map(x=>x[1]));
 function capture(url,name){
  const id=V.uuid(url);if(!targetIds.has(id))return;
  const owner=aliases.get(name)||name;must(!owners.has(id)||owners.get(id)===owner,'UUID owner conflict '+id);owners.set(id,owner);
 }
 for(const r of rows){for(const p of r.profiles||[])capture(p.url,p.name);if(r.profileUrl&&roster(r).length===1)capture(r.profileUrl,roster(r)[0]);}
 for(const p of players.candidates)if(p.trackerProfileUrl)capture(p.trackerProfileUrl,p.name);
 for(const [name,[raw,uid]] of Object.entries(V.profiles)){
  must(!owners.has(uid)||owners.get(uid)===name,'distinct existing UUID owner '+name);
  must(!aliases.has(name)||aliases.get(name)===name,'distinct alias owner '+name);
  if(!known.has(name)){
   throw Error('missing existing canonical player '+name);
  }
  must(aliases.get(raw)===name,'raw name not confirmed '+raw);
  owners.set(uid,name);
 }
 const seen=new Set();
 for(const x of V.GOLD){
  const r=V.project(x),a=V.approval(x),u=new URL(r.source),window=u.searchParams.get('window'),eventId='S'+x[2]+'_'+x[4];
  must(!seen.has(r.id)&&V.verifyRow(r,a),'locked proof mismatch');seen.add(r.id);
  const t=tournaments.catalog.find(t=>t.id===r.tournamentId);
  must(t&&t.team==='solo'&&t.platform==='mobile'&&t.name===r.event&&t.seasonId===r.seasonId&&t.sourceEventIds.includes(eventId)&&t.mode===(x[2]===42?'reload-zero-build':'zero-build'),'catalog conflict '+r.id);
  const sessions=read('calendar-history/'+r.date.slice(0,7)+'.json').sessions.filter(s=>s.sourceWindowId===window&&s.eventId===eventId&&s.region===r.region&&s.dateJst===r.date&&s.seasonId===r.seasonId);
  must(sessions.length===1,'session not unique '+r.id);
  must(V.awardValid(x),'official prize mismatch '+r.id);
  const overlaps=rows.filter(z=>z.id===r.id||(z.date===r.date&&z.region===r.region&&
   (z.source?.includes(window)||(z.tournamentId===r.tournamentId&&z.round===r.round))&&
   (z.rank===r.rank||roster(z).some(n=>(aliases.get(n)||n)===r.player)||
    (z.profiles||[]).some(p=>V.uuid(p.url)===V.uuid(r.profileUrl))||V.uuid(z.profileUrl)===V.uuid(r.profileUrl))));
  must(overlaps.length<=1,'overlapping rows '+r.id);
  if(overlaps.length){
   const prior=overlaps[0];
   if(prior.id===r.id){const entries=ledger.entries.filter(e=>e.recordId===r.id);must(entries.length===1&&V.verifyRow(prior,entries[0]),'published proof changed '+r.id);already.push(r.id);}
   else{
    must(prior.verified===true&&prior.kind===r.kind&&prior.source.includes(window)&&roster(prior).length===1&&roster(prior)[0]===r.player&&
     ['rank','points','matches','kills','vrs','prize'].every(k=>prior[k]===r[k])&&
     [prior.profileUrl,...(prior.profiles||[]).map(p=>p.url)].some(url=>V.uuid(url)===V.uuid(r.profileUrl)),
     'existing different result requires manual review '+prior.id);
    existing.push(prior.id);
   }
   continue;
  }
  must(!ledger.entries.some(e=>e.recordId===r.id),'orphan approval '+r.id);
  rows.push(r);ledger.entries.push(a);added.push(r);
 }
 const delta=sum(added);
 must(rows.length===before.count+added.length&&sum(rows)===before.cash+delta&&personal(rows)===before.personal+delta,'prior count or awards changed');
 if(added.length)upsertPublicationLog(updates,{id:'owner-mobile-naw-20261127',date:'2026-11-27',title:'NAW Mobile Series / Mini Venture 10戦績・$2,250',description:'提供画像10件。Reo7件$2,050、あくりあ1件$50、hazerita_FNM1件$50、Grape1件$100。Heats順位賞金と進出を区別し、公式開催枠・本人Epic IDを照合。',existingDescription:()=> '提供画像10件。Reo7件$2,050、あくりあ1件$50、hazerita_FNM1件$50、Grape1件$100。Heats順位賞金と進出を区別し、公式開催枠・本人Epic IDを照合。',recordIds:added.map(r=>r.id)});
 const errors=[...validateData({results:rows,players,tournaments}).errors,...audit(rows,ledger,players),...validateUpdateLog(rows,updates)];
 must(!errors.length,'validation '+JSON.stringify(errors.slice(0,10)));
 if(!dry&&added.length){publishResults(root,rows);write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);}
 console.log('MOBILE_NAW_NOV27 '+JSON.stringify({dry,added:added.length,already:already.length,existing,prize:delta/100,rows:added.map(r=>({id:r.id,player:r.player,rank:r.rank,prize:r.prize}))}));
}
if(require.main===module){const arg=process.argv[2];must(process.argv.length===3&&['--dry-run','--apply'].includes(arg),'usage');run(arg==='--dry-run');}
module.exports={run};
