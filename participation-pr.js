/* ASIA ON TOUR — verified participation / PR bridge.
 * Keeps results.json, prize totals and achievements wholly separate.
 * Conservative rule: a published performance suppresses archived participation
 * for that player/tournament/date/region/session; never score both.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AotParticipationPR=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const REGIONS=new Set(['ME','EU','NAC','NAW','OCE','BR']);
  const TEAM={solo:1,duo:2,trio:3,squad:4};
  const members=row=>Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];
  const numeric=value=>Number.isSafeInteger(value)&&value>=0;
  const dateOk=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)===value;
  const sessionKey=(record,key)=>key(record)||'unspecified';
  const sameSession=(a,b)=>a===b||a==='unspecified'||b==='unspecified';
  function allowed(row,category) {
    if(!row||row.verified!==true||row.reviewOnly===true||!['出場確認','通過圏外'].includes(row.status)||
      !['unverified','outside-cutoff'].includes(row.qualification)||row.prize!==null||
      (row.status==='通過圏外')!==(row.qualification==='outside-cutoff')||
      !dateOk(row.date)||!REGIONS.has(row.region)||typeof row.id!=='string'||!/^participation-[a-f0-9]{20}$/.test(row.id)||
      !numeric(row.rank)||row.rank===0||!numeric(row.points)||!numeric(row.kills)||!numeric(row.vrs)||
      !numeric(row.matches)||row.matches===0||row.vrs>row.matches||
      typeof row.event!=='string'||!row.event||typeof row.round!=='string'||!row.round||
      !['予選','参加確認'].includes(row.stage)||typeof row.tournamentId!=='string'||
      !category||category.id!==row.tournamentId||category.seasonId!==row.seasonId||
      category.name!==row.event||!TEAM[category.team])return false;
    const people=members(row);
    if(people.length!==TEAM[category.team]||new Set(people).size!==people.length||
      people.some(name=>typeof name!=='string'||!name.trim())||
      row.player!==people.join(' / '))return false;
    try{
      const url=new URL(row.source);
      if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
        url.username||url.password||url.pathname.split('/').filter(Boolean).slice(0,3).join('/')!=='competitive/events/'+
          encodeURIComponent(category.sourceEventIds.find(x=>row.source.includes('/'+encodeURIComponent(x)+'/'))||'__none__')||
        !category.sourceEventIds.some(x=>url.pathname==='/competitive/events/'+encodeURIComponent(x)+'/')||
        url.searchParams.get('region')!==row.region)return false;
      const round=url.searchParams.get('round');
      if(typeof round!=='string'||!round.startsWith(row.seasonId+'_')||!round.endsWith('_'+row.region))return false;
    }catch{return false}
    return true;
  }
  function merge(published,archive,options={}){
    if(typeof options.classify!=='function'||typeof options.sessionKey!=='function')throw TypeError('classify and sessionKey required');
    const base=Array.isArray(published)?published:[];
    const source=Array.isArray(archive)?archive:[];
    const hasSession=record=>sessionKey(record,options.sessionKey);
    const publishedByPlayer=new Map();
    for(const row of base){
      if(!row||!row.date||!REGIONS.has(row.region))continue;
      const category=options.classify(row);
      if(!category||typeof category.id!=='string'||category.id.startsWith('unconfirmed-'))continue;
      for(const name of members(row)){
        if(typeof name!=='string')continue;
        const key=JSON.stringify([name,category.id,row.date,row.region]);
        if(!publishedByPlayer.has(key))publishedByPlayer.set(key,[]);
        publishedByPlayer.get(key).push(hasSession(row));
      }
    }
    const result=base.slice(),seenIds=new Set(),assigned=new Map();
    let creditedRows=0,creditedPlayers=0,skippedPublished=0,skippedDuplicate=0,skippedInvalid=0;
    // Sorting keeps deduplication deterministic even when monthly HTTP fetch order changes.
    const sorted=source.slice().sort((a,b)=>String(a?.date||'').localeCompare(String(b?.date||''))||
      String(a?.source||'').localeCompare(String(b?.source||''))||
      String(a?.id||'').localeCompare(String(b?.id||'')));
    for(const row of sorted){
      if(!row||seenIds.has(row.id)){skippedDuplicate++;continue}
      seenIds.add(row.id);
      const category=options.classify(row);
      if(!allowed(row,category)){skippedInvalid++;continue}
      const slot=hasSession(row),eligible=[];
      for(const name of members(row)){
        const key=JSON.stringify([name,category.id,row.date,row.region]);
        if((publishedByPlayer.get(key)||[]).some(existing=>sameSession(slot,existing))){skippedPublished++;continue}
        if(!assigned.has(key))assigned.set(key,[]);
        const stored=assigned.get(key);
        if(stored.some(existing=>sameSession(slot,existing))){skippedDuplicate++;continue}
        stored.push(slot);eligible.push(name);
      }
      if(!eligible.length)continue;
      // No entitlement to qualifier/finals/skin/cash bonuses from participation:
      // plain '参加確認' uses the conservative qualifying-stage coefficient.
      result.push({...row,kind:row.stage==='予選'?'予選':'参加確認',
        participationOnly:true,prEligiblePlayers:eligible,prize:null,
        qualification:'unverified',verified:true});
      creditedRows++;creditedPlayers+=eligible.length;
    }
    return {records:result,creditedRows,creditedPlayers,skippedPublished,skippedDuplicate,skippedInvalid};
  }
  return Object.freeze({merge});
});
