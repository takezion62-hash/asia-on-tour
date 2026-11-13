'use strict';
const {readResults}=require('./source-results-store.cjs');
// Checks that previously manually approved rows remain present and safe after
// later scheduled syncs or PR rebases. Does not claim to verify Epic's facts.
const fs=require('node:fs'),path=require('node:path');
const {collision}=require('./manual-approval-core.cjs');
const {evaluate:cosmeticEvaluate}=require('./cosmetic-rank-rules.cjs');
const {RULES}=require('./verified-history-approval.cjs');
const {verifyCashRow:verifiedJune7DuosCash, POLICY:S30_DUOS_CASH_POLICY}=require('./verified-s30-duos-cash-20240607.cjs');
const {verifyNonprizeRow:verifiedJune7Zero, POLICY:S30_ZERO_DUOS_POLICY}=require('./verified-s30-duos-nonprize-20240607.cjs');
const {verifyCashRow:verifiedJune21Duos, POLICY:S30_JUNE21_POLICY}=require('./verified-s30-me-zb-duos-20240621.cjs');
const {verifyCashRow:verifiedS29MeDuos, POLICY:S29_ME_ZB_DUOS_POLICY}=require('./verified-s29-me-zb-duos-20240506.cjs');
const {verifyCashRow:verifiedS28MeDuos, POLICY:S28_ME_ZB_DUOS_POLICY}=require('./verified-s28-me-zb-duos-20240120-20240212.cjs');
const {verifyCashRow:verified2023MeDuos, POLICY:S26_S28_ME_ZB_DUOS_2023_POLICY}=require('./verified-s26-s28-me-zb-duos-2023.cjs');
const {verifiedCashRow:verifiedNov14Cash, POLICY:NOV14_PENDING_CASH_POLICY}=require('./verified-nov14-pending-cash.cjs');
const root=path.resolve(__dirname,'..');
const load=name=>name==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
// New cash-final approval policy: exact official tournament, session, score and
// award calculation. Re-validate all fields on every subsequent CI run.
const FINAL_CASH_RULES={
 S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 S31:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
 S36:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules',
 S42:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules'
};
function validCashFinal(r,entry){
 if(!r||r.kind!=='賞金決勝'||r.reviewOnly===true||r.verified!==true
  ||!Number.isSafeInteger(r.rank)||r.rank<1
  ||!Number.isSafeInteger(r.vrs)||r.vrs<0||r.vrs>3
  ||!Number.isSafeInteger(r.matches)||r.matches<1||r.matches>3||r.vrs>r.matches
  ||!Number.isSafeInteger(r.kills)||r.kills<0||r.points!==r.vrs*100)return false;
 let event,window,team=false;
 if(r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&
  ((r.date==='2024-06-24'&&r.region==='OCE')||(r.date==='2024-06-25'&&r.region==='ME')||
   (r.date==='2024-07-15'&&r.region==='OCE'))){
  event='S30_SoloVictoryCashCup';window='S30_SoloVictoryCashCup_Event'+(r.date==='2024-07-15'?'5':'4')+'Round2_'+r.region;
 }else if(r.seasonId==='S30'&&r.date==='2024-07-23'&&r.region==='NAC'&&
  r.tournamentId==='ch5s3-solo-victory-cup'){
  event='S30_SoloVictoryCashCup';window='S30_SoloVictoryCashCup_Event6Round2_NAC';
 }else if(r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&
   ((r.date==='2024-07-30'&&r.region==='NAC')||(r.date==='2024-08-12'&&r.region==='OCE')||
    (r.date==='2024-08-13'&&r.region==='ME'))){
  event='S30_SoloVictoryCashCup';
  window='S30_SoloVictoryCashCup_Event'+(r.date==='2024-07-30'?'7':'9')+'Round2_'+r.region;
 }else if(r.seasonId==='S30'&&r.tournamentId==='ch5s3-zb-solo-victory'&&
  r.date==='2024-08-13'&&r.region==='ME'){
  event='S30_SoloZBVictoryCashCup';window='S30_SoloZBVictoryCashCup_Event9Round2_ME';
 }else if(r.seasonId==='S31'&&r.tournamentId==='ch5s4-solo-victory-cup'&&
  r.date==='2024-09-03'&&r.region==='NAC'){
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event1Round2_NAC';
 }else if(r.seasonId==='S31'&&r.tournamentId==='ch5s4-solo-victory-cup'&&
  r.date==='2024-09-10'&&r.region==='NAC'){
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event2Round2_NAC';
 }else if(r.seasonId==='S31'&&r.tournamentId==='ch5s4-solo-victory-cup'&&
  r.date==='2024-09-17'&&r.region==='ME'){
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event3Round2_ME';
 }else if(r.seasonId==='S31'&&r.tournamentId==='ch5s4-solo-victory-cup'&&
  r.date==='2024-09-10'&&r.region==='ME'){
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event2Round2_ME';
 }else if(r.seasonId==='S31'&&r.tournamentId==='ch5s4-solo-victory-cup'&&
  r.date==='2024-09-03'&&r.region==='ME'){
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event1Round2_ME';
 }else if(r.seasonId==='S30'&&r.tournamentId==='ch5s3-squads-victory-cup'&&
  r.date==='2024-08-12'&&r.region==='ME'){
  event='S30_SquadsVictoryCashCup';window='S30_SquadsVictoryCashCup_Event5Round2_ME';team='squad';
 }else if(r.seasonId==='S30'&&r.date==='2024-07-30'&&r.region==='ME'&&
  r.tournamentId==='ch5s3-zb-solo-victory'){
  event='S30_SoloZBVictoryCashCup';window='S30_SoloZBVictoryCashCup_Event7Round2_ME';
 }else if(r.seasonId==='S30'&&r.date==='2024-07-16'&&r.region==='ME'
  &&r.tournamentId==='ch5s3-zb-solo-victory'){
  event='S30_SoloZBVictoryCashCup';window='S30_SoloZBVictoryCashCup_Event5Round2_ME';
 }else if(r.seasonId==='S30'&&r.date==='2024-06-11'&&r.region==='ME'
  &&r.tournamentId==='ch5s3-zb-solo-victory'){
  event='S30_SoloZBVictoryCashCup';window='S30_SoloZBVictoryCashCup_Event2Round2_ME';
 }else if(r.seasonId==='S31'&&r.date==='2024-10-08'&&r.region==='NAC'
  &&r.tournamentId==='ch5s4-solo-victory-cup'){
  // Original Epic scoreboard, Chapter 5 Season 4 Event 6: $100 per Round 2 VR.
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event6Round2_NAC';
 }else if(r.seasonId==='S31'&&r.tournamentId==='ch5s4-solo-victory-cup'&&
  ((r.date==='2024-10-21'&&r.region==='OCE')||
   (r.date==='2024-10-22'&&r.region==='ME'))){
  // Exact Event 8 Epic official scoreboard: all regions receive $100 per Round 2 VR.
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event8Round2_'+r.region;
 }else if(r.seasonId==='S31'&&r.date==='2024-10-15'&&r.region==='NAC'
  &&r.tournamentId==='ch5s4-solo-victory-cup'){
  event='S31_SoloVictoryCashCup';window='S31_SoloVictoryCashCup_Event7Round2_NAC';
 }else if(r.seasonId==='S42'&&r.date==='2026-08-29'&&r.region==='OCE'&&
  r.tournamentId==='ch7s4-console-zero-build-solo-victory-cup'){
  event='S42_ConsoleVCC_SolosZB';
  window='S42_ConsoleVCC_SolosZB_Event1Round2_OCE';
 }else if(r.seasonId==='S42'&&r.date==='2026-08-25'&&r.region==='ME'&&
  r.tournamentId==='ch7s4-reload-duos-victory-cup'){
  event='S42_ReloadDuosVictoryCup';
  window='S42_ReloadDuosVictoryCup_Event1_Round2_ME';
  team=true;
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
 if(team==='squad')return Array.isArray(r.players)&&r.players.length===4&&
  new Set(r.players).size===4&&r.player===r.players.join(' / ')&&
  r.prize===r.vrs*400&&r.teamPrize===r.vrs*400&&r.prizePerPlayer===r.vrs*100;
 if(team)return Array.isArray(r.players)&&r.players.length===2&&new Set(r.players).size===2
  &&r.player===r.players.join(' / ')&&r.prize===r.vrs*200
  &&r.teamPrize===r.vrs*200&&r.prizePerPlayer===r.vrs*100;
 return (!Array.isArray(r.players)||r.players.length===1)&&r.prize===r.vrs*100
  &&r.teamPrize===undefined&&r.prizePerPlayer===undefined;
}
// These three exact review policies were introduced with the 2026-11-12
// publication batch. Keep their tournament, official rule, phase and $0/$100
// payout constraints explicit instead of silently accepting unknown policies.
function validNov12ReviewedPolicy(r,entry) {
 if (!r || r.verified !== true || r.reviewOnly === true ||
     !Number.isSafeInteger(r.rank) || r.rank < 1 ||
     !Number.isSafeInteger(r.vrs) || r.vrs < 0 ||
     !Number.isSafeInteger(r.matches) || r.matches < 1 || r.vrs > r.matches)
   return false;
 let url;
 try { url = new URL(entry.source); } catch { return false; }
 if (url.origin !== 'https://www.fortnite.com' ||
     !url.pathname.startsWith('/competitive/events/') ||
     url.searchParams.get('region') !== r.region) return false;
 const eventId = url.pathname.split('/').filter(Boolean).at(-1);
 const roundId = url.searchParams.get('round') || '';
 const rules = {
  S30_SoloVictoryCashCup:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
  S30_SoloZBVictoryCashCup:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
  S31_SoloVictoryCashCup:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
  S32_SoloVictoryCashCup:'https://www.fortnite.com/news/competitive-details-make-your-mark-in-chapter-2-remix',
  S32_TriosCashCup:'https://www.fortnite.com/news/fortnite-trios-cash-cups-chapter-2-remix-official-rules'
 };
 if (entry.rule !== rules[eventId] || !roundId.startsWith(eventId + '_') ||
     !roundId.endsWith('_' + r.region) ||
     r.seasonId !== eventId.split('_')[0]) return false;
 if (entry.policy === 'verified-qualifier')
   return ['S30_SoloVictoryCashCup','S30_SoloZBVictoryCashCup',
     'S31_SoloVictoryCashCup','S32_SoloVictoryCashCup'].includes(eventId) &&
     roundId.includes('Round1') && r.kind === '予選' && r.prize === 0 &&
     r.matches <= 10;
 if (entry.policy === 'verified-s32-final-100usd-vr')
   return eventId === 'S32_SoloVictoryCashCup' &&
     roundId.includes('Round2') && r.kind === '賞金決勝' &&
     r.matches <= 3 && r.prize === r.vrs * 100 &&
     r.points === r.vrs * 100;
 if (entry.policy === 'verified-trios-qualifier-participation-zero-cash')
   return eventId === 'S32_TriosCashCup' && roundId.includes('Round1') &&
     r.kind === '参加確認' && r.prize === 0 && r.matches <= 10 &&
     Array.isArray(r.players) && r.players.length === 3 &&
     new Set(r.players).size === 3;
 return false;
}

function validRuleVerifiedReloadAttendance(r,entry){
 const rule=RULES['ch7s4-solo-reload-victory-cup'];
 if(!rule||rule.autoApproval!=='verified-qualifier-participation'||
    rule.seasonId!=='S42'||r?.seasonId!=='S42'||
    r.tournamentId!=='ch7s4-solo-reload-victory-cup'||
    r.event!=='Solo Reload Victory Cup'||
    r.kind!=='参加確認'||r.reviewOnly===true||r.verified!==true||
    r.prize!==0||entry?.rule!==rule.source||typeof r.source!=='string'||
    typeof r.round!=='string'||!r.round.endsWith('/ 参加確認')||
    typeof r.note!=='string'||!r.note.includes('突破圏外')||
    !r.note.includes(rule.source)||!Number.isSafeInteger(r.rank)||
    r.rank<1||!Number.isSafeInteger(r.matches)||r.matches<1||
    r.matches>rule.matchCaps['予選']||!Number.isSafeInteger(r.vrs)||
    r.vrs<0||r.vrs>r.matches||!Number.isSafeInteger(r.kills)||
    r.kills<0||!Number.isSafeInteger(r.points)||r.points<0||
    Array.isArray(r.players))return false;
 const cutoff=rule.advance?.[r.region];
 if(!Number.isSafeInteger(cutoff)||r.rank<=cutoff)return false;
 try{
  const u=new URL(r.source);
  const match=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
  const eventId=match&&decodeURIComponent(match[1]);
  const win=u.searchParams.get('round');
  if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||
     u.username||u.password||u.hash||u.searchParams.size!==2||
     u.searchParams.get('region')!==r.region||
     !rule.eventIds.includes(eventId)||
     !new RegExp('^S42_ReloadSoloVictoryCup_Event[1-9][0-9]*_Round1_'+r.region+'$').test(win))
    return false;
  return /^Event [1-9][0-9]* · Round 1 \/ 参加確認$/.test(r.round);
 }catch{return false}
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
  if(entry.decision!=='published'||!['attendance-only','verified-rule','cosmetic-rank','verified-vr','official-final-vr-award','verified-qualifier','verified-s32-final-100usd-vr','verified-trios-qualifier-participation-zero-cash',S30_DUOS_CASH_POLICY,S30_ZERO_DUOS_POLICY,S30_JUNE21_POLICY,S29_ME_ZB_DUOS_POLICY,S28_ME_ZB_DUOS_POLICY,S26_S28_ME_ZB_DUOS_2023_POLICY,NOV14_PENDING_CASH_POLICY].includes(entry.policy)){
   errors.push('Unknown decision/policy: '+entry.id);continue;
  }
  if(r.source!==entry.source||r.verified!==true)errors.push('Published source or verification flag changed: '+entry.id);
  if(entry.policy==='attendance-only'&&(r.kind!=='参加確認'||r.prize!==null||r.reviewOnly===true))errors.push('Participation was changed into unsupported confirmed award: '+entry.id);
  if(entry.policy==='verified-rule'&&(r.prize!==0||r.reviewOnly===true||(!['予選','賞金決勝'].includes(r.kind)&&!validRuleVerifiedReloadAttendance(r,entry))))errors.push('Rule-approved entry has unsupported payout or category: '+entry.id);
  if(entry.policy===S30_DUOS_CASH_POLICY&&!verifiedJune7DuosCash(r,entry))errors.push('Unverified June 7 ME ZB Duos Cash Cup placement or individual payout: '+entry.id);
  if(entry.policy===S30_ZERO_DUOS_POLICY&&!verifiedJune7Zero(r,entry))errors.push('Unverified June 7 ME ZB Duos zero-prize final or roster: '+entry.id);
  if(entry.policy===S30_JUNE21_POLICY&&!verifiedJune21Duos(r,entry))errors.push('Unverified June 21 ME ZB Duos score, cash, team roster, or Tracker ID: '+entry.id);
  if(entry.policy===S29_ME_ZB_DUOS_POLICY&&!verifiedS29MeDuos(r,entry))errors.push('Unverified May 6 ME Zero Build Duos Victory Cup screenshot payout or player identity: '+entry.id);
  if(entry.policy===S28_ME_ZB_DUOS_POLICY&&!verifiedS28MeDuos(r,entry))errors.push('Unverified Jan20/Feb12 ME Zero Build Duos Victory Cup rank, cash, roster, Epic ID, or date: '+entry.id);
  if(entry.policy===S26_S28_ME_ZB_DUOS_2023_POLICY&&!verified2023MeDuos(r,entry))errors.push('Unverified Oct23/Dec16 2023 ME ZB Duos Victory Cup rank, 1VR payout, roster, Epic ID, or event window: '+entry.id);
  if(entry.policy===NOV14_PENDING_CASH_POLICY&&!verifiedNov14Cash(r,entry))errors.push('Unverified Nov14 pending cash candidate, Epic ranking, original account ID, prize tier, or award evidence: '+entry.id);
  if(entry.policy==='cosmetic-rank'&&(r.kind!=='スキン大会'||r.prize!==0||r.reviewOnly===true||!cosmeticEvaluate(r).eligible))errors.push('Cosmetic winner is outside verified official rank range: '+entry.id);
  if(entry.policy==='verified-vr'&&!(r.kind==='賞金決勝'&&r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&r.region==='ME'&&r.source?.includes('/S30_SoloVictoryCashCup/')&&r.source?.includes('S30_SoloVictoryCashCup_Event7Round2_ME')&&Number.isSafeInteger(r.vrs)&&r.vrs>=1&&r.vrs<=3&&Number.isSafeInteger(r.matches)&&r.matches>=r.vrs&&r.matches<=3&&r.points===r.vrs*100&&r.prize===r.vrs*100&&r.verified===true&&r.reviewOnly!==true))errors.push('Cash final record lacks official per-VR proof: '+entry.id);
  if(entry.policy==='official-final-vr-award'&&!validCashFinal(r,entry))errors.push('Invalid official solo/duo VR award: '+entry.id);
  if(['verified-qualifier','verified-s32-final-100usd-vr',
    'verified-trios-qualifier-participation-zero-cash'].includes(entry.policy) &&
    !validNov12ReviewedPolicy(r,entry))errors.push('Invalid Nov12 source/rule/payout: '+entry.id);
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
