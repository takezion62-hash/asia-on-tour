'use strict';
const host='https://fnapi.osirion.gg';
async function get(route){
 const r=await fetch(new URL(route,host),{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
 const json=await r.json().catch(()=>null);
 return {status:r.status,data:json};
}
function summary(obj,depth=0){
 if(depth>4)return typeof obj;
 if(Array.isArray(obj))return {arrayLength:obj.length,first:obj.length?summary(obj[0],depth+1):null};
 if(obj&&typeof obj==='object')return Object.fromEntries(Object.entries(obj).slice(0,18).map(([k,v])=>[k,summary(v,depth+1)]));
 if(typeof obj==='string'&&obj.length>100)return obj.slice(0,98)+'…';
 return obj;
}
async function run(){
 const spec=(await get('/openapi.json')).data;
 if(!spec?.paths?.['/v1/tournaments/leaderboard'])throw Error('leaderboard endpoint undocumented');
 const api=spec.paths['/v1/tournaments/leaderboard'].get;
 const names=['TournamentLeaderboardDataResponse'];
 for(const name of names)console.log('OSIRION_SCHEMA '+JSON.stringify({name,definition:spec.components.schemas[name]}).slice(0,10000));
 const refs=[...JSON.stringify(spec.components.schemas.TournamentLeaderboardDataResponse).matchAll(/#\/components\/schemas\/([A-Za-z0-9]+)/g)].map(x=>x[1]);
 for(const name of [...new Set(refs)])console.log('OSIRION_SUBSCHEMA '+JSON.stringify({name,definition:spec.components.schemas[name]}).slice(0,12000));
 const tournaments=await get('/v1/tournaments?region=NAW');
 console.log('OSIRION_TOUR '+JSON.stringify({status:tournaments.status,available:tournaments.data?.tournaments?.length,matches:(tournaments.data?.tournaments||[]).filter(x=>x.eventId?.includes('S42_SoloVictoryCup')).slice(0,3).map(x=>({eventId:x.eventId,regions:x.regions,windows:(x.eventWindows||[]).slice(0,4).map(w=>({id:w.eventWindowId||w.windowId||w.id,keys:Object.keys(w)}))}))}).slice(0,6000));
 for(const id of ['S42_SoloVictoryCup','epicgames_S42_SoloVictoryCup_NAW']){
   const params=new URLSearchParams({leaderboardEventId:id,leaderboardEventWindowId:'S42_SoloVictoryCup_Event3Round1_NAW',page:'0'});
   try{
     const {status,data}=await get('/v1/tournaments/leaderboard?'+params);
     console.log('OSIRION_BOARD '+JSON.stringify({eventId:id,status,shape:summary(data)}).slice(0,16500));
     if(status===200)break;
   }catch(e){console.log('OSIRION_BOARD_ERROR '+JSON.stringify({eventId:id,error:e.message}))}
 }
}
run().catch(e=>{console.error(e.stack);process.exitCode=1});
