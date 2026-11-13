'use strict';
/**
 * Ephemeral indexes for an inspected review run.
 * Never persist an index or change the source of truth. All collision decisions
 * are delegated to the existing collision() policy after narrow lookup.
 */
function checkpointIndex(scans){
 const map=new Map();
 for(const scan of Object.values(scans||{})){
  for(const [key,cp] of Object.entries(scan?.windows||{})){
   if(!Array.isArray(cp?.proposals))continue;
   for(const row of cp.proposals){
    if(typeof row?.id!=='string'||!row.id)continue;
    if(!map.has(row.id))map.set(row.id,[]);
    map.get(row.id).push({key,checkpoint:cp,row});
   }
  }
 }
 return map;
}
function checkpointFor(row,index,equal){
 let found=null;
 for(const entry of index.get(row.id)||[]){
  if(!equal(entry.row,row))throw Error('API保存記録と候補の内容が異なる: '+row.id);
  if(found&&found.key!==entry.key)throw Error('複数の異なるAPI開催枠に同じ候補IDが存在: '+row.id);
  found={key:entry.key,checkpoint:entry.checkpoint};
 }
 return found;
}
function collisionIndex(rows,key,collision,aliases){
 if(typeof key!=='function'||typeof collision!=='function'||!Array.isArray(rows))
  throw Error('REVIEW_INDEX invalid inputs');
 const buckets=new Map();
 function add(row){
  const signature=key(row,aliases);
  if(!buckets.has(signature))buckets.set(signature,[]);
  buckets.get(signature).push(row);
 }
 for(const row of rows)add(row);
 function match(row){
  for(const previous of buckets.get(key(row,aliases))||[]){
   const reason=collision(previous,row,aliases);
   if(reason)return {previous,reason};
  }
  return null;
 }
 return {match,add,bucketsCount:()=>buckets.size};
}
function eventWindow(row){
 try{
  const u=new URL(row.source);
  const m=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
  const round=u.searchParams.get('round');
  if(!m||!round||u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||
     u.username||u.password||u.hash||u.searchParams.get('region')!==row.region)return null;
  const event=decodeURIComponent(m[1]);
  return {event,round,key:'epicgames_'+event+'_'+row.region+'/'+round};
 }catch{return null}
}
function groupCandidates(rows){
 const groups=new Map();
 for(const row of rows){
  const win=eventWindow(row);
  const key=win?.key||'unverified/'+String(row.id);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 }
 return [...groups].map(([key,items])=>({key,items}));
}
module.exports={checkpointIndex,checkpointFor,collisionIndex,eventWindow,groupCandidates};
