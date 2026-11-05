'use strict';
const fs=require('node:fs'),path=require('node:path');
const all=JSON.parse(fs.readFileSync(path.join(__dirname,'../results.json'),'utf8'));
const expected=all.filter(x=>x.date==='2026-09-22'&&x.region==='NAW'&&x.event==='Solo Victory Cup Battle Royale'&&x.round.includes('Event 3')&&x.round.includes('Round 1'));
const source='https://fnapi.osirion.gg/v1/tournaments/leaderboard';
async function getPage(page){
 const params=new URLSearchParams({leaderboardEventId:'epicgames_S42_SoloVictoryCup_NAW',leaderboardEventWindowId:'S42_SoloVictoryCup_Event3Round1_NAW',page:String(page)});
 const r=await fetch(source+'?'+params,{signal:AbortSignal.timeout(25000)});
 const j=await r.json();if(!r.ok||!j?.success||!Array.isArray(j.leaderboard?.entries))throw Error('Bad response '+r.status);
 return j.leaderboard.entries;
}
function normId(url){return url?.match(/[?&]id=([0-9a-f-]{36})/i)?.[1]?.replace(/-/g,'').toLowerCase()}
async function run(){
 const entries=[...(await getPage(0)),...(await getPage(1))];
 let passed=0;
 const audit=[];
 for(const x of expected){
  const id=normId(x.profileUrl);
  const e=entries.find(y=>y.players?.some(p=>p.accountId===id));
  const stats=(e?.sessionHistory||[]).map(h=>h.trackedStats||{});
  const observed=e?{rank:e.rank,points:e.pointsEarned,matches:stats.reduce((a,s)=>a+(s.MATCH_PLAYED_STAT||0),0),kills:stats.reduce((a,s)=>a+(s.TEAM_ELIMS_STAT_INDEX||0),0),vrs:stats.reduce((a,s)=>a+(s.VICTORY_ROYALE_STAT||0),0)}:null;
  const desired={rank:x.rank,points:x.points,matches:x.matches,kills:x.kills,vrs:x.vrs};
  const ok=observed&&Object.keys(desired).every(k=>observed[k]===desired[k]);
  if(ok)passed++;
  audit.push({name:x.player,idMatch:!!e,ok,observed,desired});
 }
 console.log('OSIRION_COMPARE '+JSON.stringify({expectedRecords:expected.length,matchedExact:passed,entriesScanned:entries.length,records:audit}).slice(0,16000));
 if(passed!==expected.length)process.exitCode=1;
}
run().catch(e=>{console.error(e.stack);process.exitCode=1});
