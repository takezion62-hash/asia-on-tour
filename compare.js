/* ASIA ON TOUR · player comparison metrics (verified archive only).
 * Every compared player uses identical season/region/mode/series filters.
 * No statistical inference from missing placements, team prize splits or VRs.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AsiaCompare=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const REGIONS=Object.freeze(['ME','EU','NAC','NAW','OCE','BR']);
  const MODES=Object.freeze(['battle-royale','zero-build','reload','reload-zero-build']);
  const FINAL_KINDS=new Set(['賞金決勝','決勝','Practice決勝','Performance決勝']);
  const MAX_PLAYERS=3;
  const METRICS=Object.freeze([
    {id:'pr',label:'AOT PR',unit:'pt',precision:1},
    {id:'cash',label:'個人獲得賞金',unit:'USD',precision:2},
    {id:'vrs',label:'掲載VR合計',unit:'VR',precision:0},
    {id:'finals',label:'確認済み決勝出場',unit:'件',precision:0},
    {id:'podiums',label:'賞金決勝TOP3',unit:'件',precision:0},
    {id:'prizeCount',label:'個人賞金獲得戦績',unit:'件',precision:0},
    {id:'regions',label:'遠征地域数',unit:'地域',precision:0},
    {id:'results',label:'確認済み掲載戦績',unit:'件',precision:0}
  ].map(Object.freeze));
  function names(row){return Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];}
  function cleanPlayers(values,available=[]){
    const known=new Set(available),seen=new Set(),out=[];
    for(const name of Array.isArray(values)?values:[]){
      if(typeof name!=='string'||!known.has(name)||seen.has(name))continue;
      seen.add(name);out.push(name);
      if(out.length===MAX_PLAYERS)break;
    }
    return out;
  }
  function sanitize(filters={},allowedSeries=[],allowedSeasons=[]){
    const safe=filters&&typeof filters==='object'?filters:{};
    return {
      season:safe.season==='all'||allowedSeasons.includes(safe.season)?safe.season:'all',
      region:REGIONS.includes(safe.region)?safe.region:'all',
      mode:MODES.includes(safe.mode)?safe.mode:'all',
      series:allowedSeries.includes(safe.series)?safe.series:'all'
    };
  }
  function stable(row){
    const id=row?.id;
    if(typeof id!=='string'||!id)return null;
    const pairs=Object.keys(row).sort().map(key=>[key,row[key]]);
    return JSON.stringify(pairs);
  }
  // Conflicting duplicate IDs are ambiguous and must be rejected rather
  // than silently awarding the record to one or both compared players.
  function uniqueVerified(records){
    const groups=new Map();
    for(const row of Array.isArray(records)?records:[]){
      if(!row||row.verified!==true||row.reported||row.partial||typeof row.id!=='string'||!row.id)continue;
      if(!groups.has(row.id))groups.set(row.id,[]);
      groups.get(row.id).push(row);
    }
    const unique=[];
    let duplicateCount=0,conflictingCount=0;
    for(const rows of groups.values()){
      if(rows.length>1)duplicateCount+=rows.length-1;
      const key=stable(rows[0]);
      if(rows.some(row=>stable(row)!==key)){conflictingCount++;continue;}
      unique.push(rows[0]);
    }
    return {rows:unique,duplicateCount,conflictingCount};
  }
  const validMoney=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
  const validVR=value=>Number.isInteger(value)&&value>=0;
  const validRank=value=>Number.isInteger(value)&&value>=1;
  function build(records,selected,filters={},helpers={}){
    const available=Array.isArray(helpers.available)?helpers.available:[];
    const players=cleanPlayers(selected,available);
    const f=sanitize(filters,helpers.series||[],helpers.seasons||[]);
    const unique=uniqueVerified(records);
    const classified=new Map();
    const resolve=row=>{
      if(!classified.has(row))classified.set(row,typeof helpers.classify==='function'?helpers.classify(row):{series:'unknown',mode:'unknown'});
      return classified.get(row)||{series:'unknown',mode:'unknown'};
    };
    const filtered=unique.rows.filter(row=>{
      const t=resolve(row);
      return REGIONS.includes(row.region)
        &&(f.season==='all'||typeof helpers.seasonOf==='function'&&helpers.seasonOf(row)===f.season)
        &&(f.region==='all'||row.region===f.region)
        &&(f.mode==='all'||t.mode===f.mode)
        &&(f.series==='all'||t.series===f.series);
    });
    const prReport=typeof helpers.prCalculate==='function'?
      helpers.prCalculate(filtered,{
        names:typeof helpers.names==='function'?helpers.names:names,
        classify:resolve,individualPrize:helpers.individualPrize
      }):null;
    const summaries=players.map(name=>{
      const own=filtered.filter(row=>names(row).includes(name));
      const destination=new Set(),byRegion=Object.fromEntries(REGIONS.map(region=>[region,{results:0,cash:0,vrs:0,knownVR:0}]));
      let cents=0,finals=0,podiums=0,wins=0,prizeCount=0,vrs=0,knownVR=0;
      for(const row of own){
        destination.add(row.region);
        const stats=byRegion[row.region];
        stats.results++;
        const amount=typeof helpers.individualPrize==='function'?helpers.individualPrize(row):0;
        if(validMoney(amount)&&amount<=row.prize+0.001){
          const money=Math.round(amount*100);
          cents+=money;stats.cash+=money;
          prizeCount++;
        }
        if(validVR(row.vrs)){vrs+=row.vrs;knownVR++;stats.vrs+=row.vrs;stats.knownVR++;}
        if(FINAL_KINDS.has(row.kind)&&validRank(row.rank))finals++;
        const rank=typeof helpers.confirmedPrizeFinalRank==='function'?
          helpers.confirmedPrizeFinalRank(row):
          (row.kind==='賞金決勝'&&validRank(row.rank)?row.rank:null);
        if(row.kind==='賞金決勝'&&validRank(rank)&&rank<=3){
          podiums++;if(rank===1)wins++;
        }
      }
      const quality={
        records:own.length,
        matchSamples:own.filter(row=>Number.isSafeInteger(row.matches)&&row.matches>0).length,
        killSamples:own.filter(row=>Number.isSafeInteger(row.kills)&&row.kills>=0).length,
        vrSamples:knownVR,
        cashCandidates:own.filter(row=>FINAL_KINDS.has(row.kind)).length,
        cashResolved:own.filter(row=>FINAL_KINDS.has(row.kind)&&
          typeof row.prize==='number'&&Number.isFinite(row.prize)&&row.prize>=0&&
          (names(row).length===1||row.prize===0||
           typeof row.prizePerPlayer==='number'&&Number.isFinite(row.prizePerPlayer)&&
           row.prizePerPlayer>0&&row.prizePerPlayer*names(row).length<=row.prize+0.001)).length
      };
      const pr=prReport?.byName?.get(name);
      return {
        name,values:{pr:pr?.score||0,cash:cents/100,vrs:knownVR?vrs:null,finals,podiums,
          prizeCount,regions:destination.size,results:own.length},
        wins,knownVR,roundsWithoutVR:own.length-knownVR,quality,
        regions:REGIONS.filter(region=>destination.has(region)),
        byRegion:Object.fromEntries(REGIONS.map(region=>[region,{
          results:byRegion[region].results,cash:byRegion[region].cash/100,
          vrs:byRegion[region].knownVR?byRegion[region].vrs:null,
          knownVR:byRegion[region].knownVR
        }])),
        prKnown:prReport!==null,
        records:own.length
      };
    });
    return {players:summaries,filters:f,metrics:METRICS,selectedRows:filtered.length,
      duplicateCount:unique.duplicateCount,conflictingDuplicateCount:unique.conflictingCount};
  }
  return Object.freeze({VERSION:1,REGIONS,MODES,METRICS,MAX_PLAYERS,cleanPlayers,sanitize,uniqueVerified,build});
});
