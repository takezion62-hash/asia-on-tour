'use strict';
// One-off user-confirmed rename; safe to replay after every data refresh.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const {CHANGES,forward,renameRow,renamePlayers}=require('./confirmed-player-renames-20261126.cjs');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function run({dryRun=true}={}){
 const original=readResults(root).rows,oldPlayers=read('players.json'),players=renamePlayers(oldPlayers);
 const results=original.map(r=>renameRow(r)),tournaments=read('tournaments.json'),updates=read('updates.json');
 const before=linkedAccounts({results:original,players:oldPlayers});
 const after=linkedAccounts({results,players});
 const identity=a=>a.accounts.map(x=>[x.epicAccountId,forward.get(x.player)||x.player]).sort((x,y)=>x[0].localeCompare(y[0]));
 if(!same(identity(before),identity(after)))throw Error('RENAME verified Epic account mapping changed');
 const changed=results.filter((r,i)=>!same(r,original[i]));
 const changedPlayers=!same(players,oldPlayers);
 const errors=validateData({results,players,tournaments}).errors;
 if(errors.length)throw Error('RENAME data validation '+JSON.stringify(errors.slice(0,10)));
 const batch='player-renames-20261126-gurabon-lucci-eruyache';
 if(changedPlayers||changed.length){
  if(!updates.entries.some(e=>e.id===batch))updates.entries.unshift({id:batch,date:'2026-11-26',type:'site',
   title:'選手3名の掲載名義を更新',description:'yotta guɿäʙöɴ-ɷ- → gurabon、 おらんげ → Lucci、 ぜろむの弟 → えるやちぇ。旧名義を確認済み別名義として維持。',recordIds:[]});
 }
 const history=validateUpdateLog(results,updates);
 if(history.length)throw Error('RENAME update log '+JSON.stringify(history.slice(0,10)));
 // Never edit archived proof, raw nicknames, account IDs, prizes, or record IDs.
 // Independent approval audit follows in the production rebuild, in the same checkout.
 if(!dryRun&&(changedPlayers||changed.length)){
  if(changed.length)publishResults(root,results);
  write('players.json',players);write('updates.json',updates);
 }
 const counts=Object.fromEntries(CHANGES.map(([old,fresh])=>[fresh,original.filter(r=>(r.players||[r.player]).includes(old)).length]));
 console.log('PLAYER_RENAMES '+JSON.stringify({dryRun,changed:changed.length,counts,total:results.length,changedPlayers}));
 return {changed:changed.length,counts};
}
if(require.main===module){
 const arg=process.argv[2];if(!['--dry-run','--apply'].includes(arg)||process.argv.length!==3)throw Error('Usage: --dry-run or --apply');
 run({dryRun:arg==='--dry-run'});
}
module.exports={run};
