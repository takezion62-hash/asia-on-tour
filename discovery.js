/* ASIA ON TOUR — unified discovery + local-only player favorites.
 * Read-only search; never changes results, award values, aliases or profiles.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AOTDiscovery=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const REGIONS=Object.freeze(['ME','EU','NAC','NAW','OCE','BR']);
  const STORAGE_KEY='aot.player-favorites.v1';
  const MAX_FAVORITES=30;
  const text=x=>String(x??'').normalize('NFKC').toLocaleLowerCase('ja').trim()
    .replace(/(\d{4})[/.年](\d{1,2})[/.月](\d{1,2})日?/g,(_,y,m,d)=>y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0'));
  const terms=q=>text(q).slice(0,160).split(/\s+/).filter(Boolean).slice(0,8);
  function members(row){
    return Array.isArray(row?.players)&&row.players.length?row.players:
      typeof row?.player==='string'?[row.player]:[];
  }
  function matchNames(people,query,aliases={}){
    const q=text(query);
    if(!q)return true;
    return people.some(name=>[name,...(Array.isArray(aliases[name])?aliases[name]:[])]
      .some(x=>text(x).includes(q)));
  }
  function matchRecord(row,filters={},options={}){
    if(!row)return false;
    if(filters.date&&row.date!==filters.date)return false;
    if(filters.region&&filters.region!=='all'&&row.region!==filters.region)return false;
    const people=members(row),aliases=options.aliases||{};
    if(filters.player&&!matchNames(people,filters.player,aliases))return false;
    const q=terms(filters.q);
    if(!q.length)return true;
    const t=options.tournament||{};
    const combined=[
      row.event,t.name,t.series,t.mode,t.subtype,t.platform,t.team,
      row.date,row.region,row.round,row.kind,row.seasonId,
      ...(Array.isArray(options.labels)?options.labels:[]),
      ...people.flatMap(name=>[name,...(Array.isArray(aliases[name])?aliases[name]:[])])
    ].map(text).join(' ');
    const compactDate=String(row.date||'').replace(/-/g,'');
    return q.every(term=>combined.includes(term)||term===compactDate);
  }
  // Records passed here have already passed the exact tournament filters.
  // Only names in the canonical registry are returned, never guessed aliases.
  function matchingPlayers(rows,known,favorites=[],limit=12){
    const allowed=new Set((known||[]).map(x=>typeof x==='string'?x:x?.name).filter(Boolean));
    const counts=new Map();
    for(const row of rows||[])for(const name of new Set(members(row)))
      if(allowed.has(name))counts.set(name,(counts.get(name)||0)+1);
    const saved=new Set(favorites);
    return [...counts].map(([name,records])=>({name,records,favorite:saved.has(name)}))
      .sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.records-a.records||a.name.localeCompare(b.name,'ja'))
      .slice(0,Math.max(0,Math.min(30,Number.isSafeInteger(limit)?limit:12)));
  }
  function sanitizeFavorites(value,known){
    const allowed=new Set((known||[]).map(x=>typeof x==='string'?x:x?.name).filter(Boolean));
    const seen=new Set(),result=[];
    if(!Array.isArray(value))return result;
    for(const name of value){
      if(typeof name!=='string'||!allowed.has(name)||seen.has(name))continue;
      seen.add(name);result.push(name);
      if(result.length>=MAX_FAVORITES)break;
    }
    return result;
  }
  function readFavorites(storage,known){
    try{
      if(!storage||typeof storage.getItem!=='function')return [];
      return sanitizeFavorites(JSON.parse(storage.getItem(STORAGE_KEY)||'[]'),known);
    }catch{return []}
  }
  function saveFavorites(storage,items,known){
    const cleaned=sanitizeFavorites(items,known);
    try{
      if(!storage||typeof storage.setItem!=='function')return false;
      storage.setItem(STORAGE_KEY,JSON.stringify(cleaned));
      return true;
    }catch{return false}
  }
  function toggleFavorite(items,name,known){
    const allowed=new Set((known||[]).map(x=>typeof x==='string'?x:x?.name).filter(Boolean));
    if(!allowed.has(name))return {items:sanitizeFavorites(items,known),changed:false,limit:false};
    const current=sanitizeFavorites(items,known),index=current.indexOf(name);
    if(index>=0)return {items:current.filter(x=>x!==name),changed:true,limit:false};
    if(current.length>=MAX_FAVORITES)return {items:current,changed:false,limit:true};
    return {items:[...current,name],changed:true,limit:false};
  }
  return Object.freeze({VERSION:1,REGIONS,STORAGE_KEY,MAX_FAVORITES,text,terms,members,matchNames,
    matchRecord,matchingPlayers,sanitizeFavorites,readFavorites,saveFavorites,toggleFavorite});
});
