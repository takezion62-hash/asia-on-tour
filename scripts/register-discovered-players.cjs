'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readResults}=require('./source-results-store.cjs');
const {registrationPlan}=require('./player-discovery.cjs');
function main(root=path.resolve(__dirname,'..')){
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const write=(f,d)=>fs.writeFileSync(path.join(root,f),JSON.stringify(d,null,2)+'\n');
 const cfg=read('history-sync-config.json').playerDiscovery;
 if(cfg?.enabled!==true||cfg.autoRegister!==true)return;
 const status=read('history-sync-status.json'),ledger=status.playerDiscovery;
 if(ledger?.version!==1||!Array.isArray(ledger.candidates))return;
 const players=read('players.json'),results=readResults(root).rows;
 const plan=registrationPlan(ledger,{players,results},Date.now());
 if(!plan.additions.length)return;
 players.candidates.push(...plan.additions);
 ledger.candidates=ledger.candidates.filter(c=>!plan.additions.some(p=>p.epicAccountId===c.epicId));
 ledger.lastRegistration={checkedAt:new Date().toISOString(),registered:plan.additions.map(p=>({name:p.name,epicId:p.epicAccountId}))};
 write('players.json',players);write('history-sync-status.json',status);
 console.log('AUTO_PLAYER_DISCOVERY '+JSON.stringify(ledger.lastRegistration));
}
if(require.main===module)main();
module.exports={main};
