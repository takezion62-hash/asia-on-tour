/* ASIA ON TOUR · player growth chart data (read-only, verified archive only).
 * Missing archive months mean "no published entries", NOT no competition.
 * Current AOT PR formula is reapplied retroactively at each period boundary.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AsiaGrowth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FINAL_KINDS=new Set(['賞金決勝','Practice決勝','Performance決勝','決勝']);
  const METRICS=Object.freeze([
    Object.freeze({id:'pr',label:'AOT PR',unit:'pt',decimals:1}),
    Object.freeze({id:'cash',label:'個人獲得賞金',unit:'USD',decimals:2}),
    Object.freeze({id:'finals',label:'決勝出場',unit:'件',decimals:0}),
    Object.freeze({id:'podiums',label:'決勝TOP3',unit:'件',decimals:0})
  ]);
  function validDate(date){
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
    const ms=Date.parse(date+'T00:00:00Z');
    return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===date;
  }
  function roster(row){
    return Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];
  }
  function uniqueVerified(records,name){
    if(typeof name!=='string'||!name.trim())return [];
    const groups=new Map();
    for(const row of Array.isArray(records)?records:[]){
      if(!row||row.verified!==true||typeof row.id!=='string'||!row.id||!roster(row).includes(name))continue;
      if(!groups.has(row.id))groups.set(row.id,[]);
      groups.get(row.id).push(row);
    }
    return [...groups.values()].filter(group=>group.every(row=>JSON.stringify(row)===JSON.stringify(group[0])))
      .map(group=>group[0]).filter(row=>validDate(row.date))
      .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  }
  function safeCash(row,options){
    const n=typeof options.cash==='function'?options.cash(row):0;
    return Number.isFinite(n)&&n>0?Math.round(n*100):0;
  }
  function safeFinal(row){
    return FINAL_KINDS.has(row.kind)&&Number.isInteger(row.rank)&&row.rank>0;
  }
  function podium(row,options){
    // Exactly the confirmed cash-final TOP3 definition used in the site's
    // existing rankings; Practice and unconfirmed finals cannot sneak in.
    if(typeof options.prizeFinalRank==='function'){
      const rank=options.prizeFinalRank(row);
      return Number.isInteger(rank)&&rank>=1&&rank<=3;
    }
    return row.kind==='賞金決勝'&&Number.isInteger(row.rank)&&row.rank>=1&&row.rank<=3;
  }
  function seasonOf(row,options){
    const s=typeof options.season==='function'?options.season(row):null;
    if(!s||typeof s.id!=='string'||s.id==='unknown'||!/^S\d+$/.test(s.id))return null;
    return {key:s.id,label:typeof s.label==='string'&&s.label?s.label:s.id};
  }
  function periods(records,grouping,options={}){
    const verified=uniqueVerified(records,options.player);
    const buckets=new Map();
    for(const row of verified){
      const data=grouping==='season'?seasonOf(row,options):{
        key:row.date.slice(0,7),label:row.date.slice(0,4)+'/'+Number(row.date.slice(5,7))
      };
      if(!data)continue;
      if(!buckets.has(data.key))buckets.set(data.key,{...data,firstDate:row.date,lastDate:row.date,rows:[]});
      const bucket=buckets.get(data.key);
      bucket.rows.push(row);
      if(row.date<bucket.firstDate)bucket.firstDate=row.date;
      if(row.date>bucket.lastDate)bucket.lastDate=row.date;
    }
    if(grouping!=='season'&&buckets.size){
      const keys=[...buckets.keys()].sort(),first=keys[0],last=keys.at(-1);
      const from=Number(first.slice(0,4))*12+Number(first.slice(5,7))-1;
      const until=Number(last.slice(0,4))*12+Number(last.slice(5,7))-1;
      // Safety guard for malformed/excessively long archives.
      if(until-from<=120)for(let month=from;month<=until;month++){
        const year=Math.floor(month/12),m=month%12+1;
        const key=year+'-'+String(m).padStart(2,'0');
        if(!buckets.has(key))buckets.set(key,{key,label:year+'/'+m,
          firstDate:key+'-01',lastDate:key+'-01',rows:[]});
      }
    }
    const groups=[...buckets.values()].sort((a,b)=>a.firstDate.localeCompare(b.firstDate)||a.key.localeCompare(b.key));
    let cents=0,finals=0,podiums=0,previousPR=0;
    const prefix=[];
    const points=groups.map(group=>{
      const cashCents=group.rows.reduce((sum,row)=>sum+safeCash(row,options),0);
      const countedFinals=group.rows.filter(safeFinal).length;
      const top3=group.rows.filter(row=>podium(row,options)).length;
      cents+=cashCents;finals+=countedFinals;podiums+=top3;
      prefix.push(...group.rows);
      const raw=typeof options.prScore==='function'?options.prScore(prefix.slice()):0;
      const cumulativePR=Number.isFinite(raw)&&raw>=0?raw:previousPR;
      const periodPR=Math.max(0,cumulativePR-previousPR);
      previousPR=cumulativePR;
      return {
        key:group.key,label:group.label,
        firstDate:group.firstDate,lastDate:group.lastDate,
        records:group.rows.length,
        period:{pr:periodPR,cash:cashCents/100,finals:countedFinals,podiums:top3},
        cumulative:{pr:cumulativePR,cash:cents/100,finals,podiums}
      };
    });
    return {grouping:grouping==='season'?'season':'month',
      points,recordCount:verified.length,chartedRecords:groups.reduce((sum,g)=>sum+g.rows.length,0),
      omittedRecords:verified.length-groups.reduce((sum,g)=>sum+g.rows.length,0)};
  }
  function series(report,metric='pr',view='cumulative'){
    const field=METRICS.some(x=>x.id===metric)?metric:'pr';
    const mode=view==='period'?'period':'cumulative';
    return report.points.map(point=>({...point,value:point[mode][field]}));
  }
  return Object.freeze({VERSION:1,METRICS,validDate,uniqueVerified,periods,series});
});
