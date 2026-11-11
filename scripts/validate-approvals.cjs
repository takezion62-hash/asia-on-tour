'use strict';
// Checks that previously manually approved rows remain present and safe after
// later scheduled syncs or PR rebases. Does not claim to verify Epic's facts.
const fs=require('node:fs'),path=require('node:path');
const {collision}=require('./manual-approval-core.cjs');
const {evaluate:cosmeticEvaluate}=require('./cosmetic-rank-rules.cjs');
const root=path.resolve(__dirname,'..');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
// New cash-final approval policy: exact official tournament, session, score and
// award calculation. Re-validate all fields on every subsequent CI run.
const FINAL_CASH_RULES={
 S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 S31:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
 S36:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules'
};
function validCashFinal(r,entry){
 if(!r||r.kind!=='賞金決勝'||r.reviewOnly===true||r.verified!==true
  ||!Number.isSafeInteger(r.rank)||r.rank<1
  ||!Number.isSafeInteger(r.vrs)||r.vrs<0||r.vrs>3
  ||!Number.isSafeInteger(r.matches)||r.matches<1||r.matches>3||r.vrs>r.matches
  ||!Number.isSafeInteger(r.kills)||r.kills<0||r.points!==r.vrs*100)return false;
 let event,window,team=false;
 if(r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&
  ((r.date==='2024-06-24'&&r.region==='OCE')||(r.date==='2024-06-25'&&r.region==='ME'))){
  event='S30_SoloVictoryCashCup';window='S30_SoloVictoryCashCup_Event4Round2_'+r.region;
 }else if(r.seasonId==='S30'&&r.date==='2024-06-11'&&r.region==='ME'
  &&r.tournamentId==='ch5s3-zb-solo-victory'){
  event='S30_SoloZBVictoryCashCup';window='S30_SoloZBVictoryCashCup_Event2Round2_ME';
 }else if(r.seasonId==='S31'&&r.date==='2024-10-15'&&r.region==='NAC'
  &&r.tournamentId==='ch5s4-solo-victory-cup'){
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event7Round2_NAC';
 }else if(r.seasonId==='S36'&&r.tournamentId==='ch6s3-console-duos-victory'){
  event='S36_VictoryDuosCup';team=true;
  if(r.date==='2025-06-21'&&r.region==='NAW')window='S36_VictoryDuosCup_Event2Round2_NAW';
  else if(r.date==='2025-06-28'&&r.region==='NAW')window='S36_VictoryDuosCup_Event3Round2_NAW';
  else if(r.date==='2025-06-28'&&r.region==='NAC')window='S36_VictoryDuosCup_Event3Round2_NAC';
  else return false;
 }else return false;
 if(entry.rule!==FINAL_CASH_RULES[r.seasonId])return false;
 const expected='https://www.fortnite.com/competitive/events/'+event+'/?region='+r.region+'&round='+window;
 if(r.source!==expected||!r.round.includes('Round 2 / 賞金決勝'))return false;
 if(team)return Array.isArray(r.players)&&r.players.length===2&&new Set(r.players).size===2
  &&r.player===r.players.join(' / ')&&r.prize===r.vrs*200
  &&r.teamPrize===r.vrs*200&&r.prizePerPlayer===r.vrs*100;
 return (!Array.isArray(r.players)||r.players.length===1)&&r.prize===r.vrs*100
  &&r.teamPrize===undefined&&r.prizePerPlayer===undefined;
}
function audit(results,ledger,players){
 const errors=[];
 if(ledger?.version!==1||!Array.isArray(ledger.entries))return ['approval-history.json is invalid'];
 const ids=new Set();
 for(const entry of ledger.entries){
  if(!entry||typeof entry.id!=='string'||ids.has(entry.id)){errors.push('Invalid or repeated approval history ID');continue}
  ids.add(entry.id);
  const rows=results.filter(r=>r.id===entry.recordId);
  if(rows.length!==1){errors.push('Published record missing or duplicate: '+entry.id);continue}
  const r=rows[0];
  if(entry.decision!=='published'||!['attendance-only','verified-rule','cosmetic-rank','verified-vr','official-final-vr-award'].includes(entry.policy)){
   errors.push('Unknown decision/policy: '+entry.id);continue;
  }
  if(r.source!==entry.source||r.verified!==true)errors.push('Published source or verification flag changed: '+entry.id);
  if(entry.policy==='attendance-only'&&(r.kind!=='参加確認'||r.prize!==null||r.reviewOnly===true))errors.push('Participation was changed into unsupported confirmed award: '+entry.id);
  if(entry.policy==='verified-rule'&&(r.prize!==0||r.reviewOnly===true||!['予選','賞金決勝'].includes(r.kind)))errors.push('Rule-approved entry has unsupported payout or category: '+entry.id);
  if(entry.policy==='cosmetic-rank'&&(r.kind!=='スキン大会'||r.prize!==0||r.reviewOnly===true||!cosmeticEvaluate(r).eligible))errors.push('Cosmetic winner is outside verified official rank range: '+entry.id);
  if(entry.policy==='verified-vr'&&!(r.kind==='賞金決勝'&&r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&r.region==='ME'&&r.source?.includes('/S30_SoloVictoryCashCup/')&&r.source?.includes('S30_SoloVictoryCashCup_Event7Round2_ME')&&Number.isSafeInteger(r.vrs)&&r.vrs>=1&&r.vrs<=3&&Number.isSafeInteger(r.matches)&&r.matches>=r.vrs&&r.matches<=3&&r.points===r.vrs*100&&r.prize===r.vrs*100&&r.verified===true&&r.reviewOnly!==true))errors.push('Cash final record lacks official per-VR proof: '+entry.id);
  if(entry.policy==='official-final-vr-award'&&!validCashFinal(r,entry))errors.push('Invalid official solo/duo VR award: '+entry.id);
  const collisions=results.filter(x=>x.id!==r.id).map(x=>({id:x.id,reason:collision(x,r,players?.confirmedAliases)})).filter(x=>x.reason);
  if(collisions.length)errors.push('Potential duplicate for approved '+entry.id+': '+collisions.slice(0,4).map(x=>x.id).join(', '));
 }
 return errors;
}
if(require.main===module){
 const errors=audit(load('results.json'),load('approval-history.json'),load('players.json'));
 if(errors.length){for(const e of errors)console.error('ERROR '+e);process.exitCode=1;}
 else console.log('Manual approval ledger validation OK');
}
module.exports={audit};
