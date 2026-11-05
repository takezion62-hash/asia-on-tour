'use strict';
async function get(url){
 const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
 return {status:r.status,body:await r.json().catch(()=>({parseError:true}))};
}
function recursively(list,schema,name,seen=new Set(),depth=0){
 if(!schema||depth>5||seen.has(name))return;seen.add(name);
 console.log('OSIRION_SCHEMA '+JSON.stringify({name,definition:schema}).slice(0,16000));
 const refs=[...JSON.stringify(schema).matchAll(/#\/components\/schemas\/([A-Za-z0-9]+)/g)].map(x=>x[1]);
 for(const ref of [...new Set(refs)])recursively(list,list[ref],ref,seen,depth+1);
}
async function run(){
 const spec=(await get('https://fnapi.osirion.gg/openapi.json')).body;
 recursively(spec.components.schemas,spec.components.schemas.TournamentLeaderboardEntry,'TournamentLeaderboardEntry');
 const id='epicgames_S42_SoloVictoryCup_NAW',windowId='S42_SoloVictoryCup_Event3Round1_NAW';
 for(const page of [0,1]){
  const url='https://fnapi.osirion.gg/v1/tournaments/leaderboard?'+new URLSearchParams({leaderboardEventId:id,leaderboardEventWindowId:windowId,page:String(page)});
  try{
   const {status,body}=await get(url),l=body?.leaderboard;
   console.log('OSIRION_BOARD '+JSON.stringify({id,windowId,page,status,success:body?.success,totalPages:l?.totalPages,updatedAt:l?.updatedAt,rows:l?.entries?.length,entrySample:(l?.entries||[]).slice(0,3),rank9:(l?.entries||[]).find(x=>x.rank===9),errors:!l?Object.keys(body||{}):null}).slice(0,17000));
   if(status!==200||!l?.entries?.length)break;
  }catch(e){console.log('OSIRION_BOARD_ERROR '+JSON.stringify({page,error:e.message}));}
 }
}
run().catch(e=>{console.error(e.stack);process.exitCode=1});
