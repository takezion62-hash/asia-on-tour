'use strict';
/**
 * Intercept production season-shard reads with isolated browser-test records.
 * No real published result JSON is changed. Default ranking JSON is disabled
 * for fixtures so filters are exercised against the injected records.
 */
const achievements=require('../achievements.js');
const roster=row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player];
const regions=['ME','EU','NAC','NAW','OCE','BR'];
function summary(rows,id){
  const byName=new Map();
  for(const row of rows){
    const cash=achievements.individualCash(row);
    if(!cash)continue;
    for(const name of new Set(roster(row))){
      const p=byName.get(name)||{name,total:0,events:0};
      p.total+=cash;p.events++;byName.set(name,p);
    }
  }
  const earners=[...byName.values()].sort((a,b)=>b.total-a.total||b.events-a.events||a.name.localeCompare(b.name,'ja'));
  const regionCounts=Object.fromEntries(regions.map(r=>[r,rows.filter(row=>row.region===r).length]));
  const metadata=rows.find(row=>Number.isInteger(row.chapter)&&Number.isInteger(row.season));
  return {
    id,label:id==='all'?'全期間':metadata?'CH'+metadata.chapter+' S'+metadata.season:id,
    chapter:metadata?.chapter??null,season:metadata?.season??null,
    count:rows.length,players:new Set(rows.flatMap(roster)).size,
    regions:regions.filter(r=>regionCounts[r]>0).length,top10:rows.filter(row=>row.rank<=10).length,
    regionCounts,prizeTotal:earners.reduce((n,p)=>n+p.total,0),earners:earners.slice(0,5),
    file:id==='all'?null:'season-data/'+id+'.json',rankingFile:null
  };
}
async function mockSeasonResults(page,records){
  // Repeated identical source rows preserve their identity exactly.
  // A unique fixture-only ordinal would otherwise turn an exact duplicate into
  // conflicting evidence and cause the ranking validator to discard both rows.
  const identities=new Map();
  const ordered=records.map((row,index)=>{
    const signature=JSON.stringify(row),prior=identities.get(row.id);
    const order=prior&&prior.signature===signature?prior.order:index;
    if(!prior)identities.set(row.id,{signature,order});
    return {__aotOrder:order,...row};
  });
  const groups=new Map();
  for(const row of ordered){
    const id=/^S\d+$/.test(row.seasonId||'')?row.seasonId:'unknown';
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(row);
  }
  const order=[...groups.keys()].sort((a,b)=>b.localeCompare(a,'en'));
  const scopes={all:summary(ordered,'all')};
  for(const id of order)scopes[id]=summary(groups.get(id),id);
  const manifest={format:1,total:ordered.length,scopes,seasonOrder:order,
    names:[...new Set(ordered.flatMap(roster).filter(Boolean))],previews:{}};
  await page.route('**/season-data/*.json',route=>{
    const filename=new URL(route.request().url()).pathname.split('/').at(-1);
    const payload=filename==='manifest.json'?manifest:groups.get(filename.replace(/\.json$/,''))||[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
}
module.exports={mockSeasonResults};
