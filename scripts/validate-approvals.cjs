'use strict';
const {readResults}=require('./source-results-store.cjs');
const {POLICY:ORIGINAL32_POLICY,verifyPublished:validOriginal32}=require('./verified-rescanned-32-20261118.cjs');
const {POLICY:FOLLOWUP_24_POLICY,verifyPublished:validFollowup24}=require('./verified-remaining-s33-s35-s37-24-20261118.cjs');
const {POLICY:BULK_S35_S37_DUOS_POLICY,verifyPublished:validBulkS35S37Duos}=require('./verified-bulk-s35-s37-20261118.cjs');
const {POLICY:S37_FIVE_NEW_POLICY,verifyPublished:verifyS37FiveNew}=require('./verified-s37-console-five.cjs');
const {POLICY:NOV17_TRACKER_POLICY,verifyNewRow:validNov17TrackerRow,verifyS41Promotion:validNov17S41Award}=require('./verified-tracker-eight-20261117.cjs');
const {POLICY:S37_OCE_CONSOLE_ROUND1_POLICY,validatedRecord:validS37OceConsoleRound1}=require('./verified-s37-oce-console-round1-three.cjs');
const {POLICY:S37_OCE_CONSOLE_ROUND1_SECOND_POLICY,validatedRecord:validS37OceConsoleRound1Second}=require('./verified-s37-oce-console-round1-second-three.cjs');
const {POLICY:S37_NAW_EVENT6_ROUND1_POLICY,validatedRecord:validS37NawEvent6Round1}=require('./verified-s37-naw-console-event6-round1-four.cjs');
const {POLICY:S37_NAW_EVENT6_REMAINING14_POLICY,validatedRecord:validS37NawEvent6Remaining14}=require('./verified-s37-naw-event6-round1-remaining14.cjs');
const {POLICY:S37_CONSOLE_BULK23_POLICY,validateRecord:validS37ConsoleBulk23}=require('./verified-s37-console-round1-oce7-naw9-23.cjs');
const {POLICY:S30_NAC_ZB_SOLO85_POLICY,validateRecord:validS30NacZbSolo85}=require('./verified-s30-nac-zb-solo-round1-85.cjs');
const {POLICY:S37_ROUND2_ZERO20_POLICY,validateRecord:validS37Round2Zero20}=require('./verified-s37-console-round2-zero-vr-20.cjs');
const {POLICY:S39_RELOAD_ZERO5_POLICY,validateRecord:validS39ReloadZero5}=require('./verified-s39-naw-reload-round2-zero-vr-5.cjs');
const {POLICY:S41_EU_CONSOLE_ZB_R2_11_POLICY,validateRecord:validS41EUConsoleZB11}=require('./verified-s41-eu-console-zb-solo-round2-eleven.cjs');
const {POLICY:S30_NAC_ZB_R2_SEVEN_POLICY,validateRecord:validS30NacZB7}=require('./verified-s30-nac-zb-solo-round2-seven-wins.cjs');
const {POLICY:S38_S41_SAFE3_POLICY,validateRecord:validS38S41Safe3}=require('./verified-s38-s41-3-safe.cjs');
const {POLICY:S30_S37_S43_TWELVE_POLICY,validateRecord:validTwelveRecovery}=require('./verified-s30-s37-s43-twelve.cjs');
const {POLICY:DEFERRED_PAGE_SIX_POLICY,validateRecord:validDeferredSix}=require('./verified-deferred-page-six.cjs');
const {POLICY:REVIEWONLY_NONPRIZE_POLICY,verifiedNonprizeRow}=require('./verified-reviewonly-round1-20261116.cjs');
const {POLICY:GENERIC_ZERO_POLICY,MANIFEST:GENERIC_REVIEW_MANIFEST,verifyPublishedZero}=require('./generic-review-only-core.cjs');
// Checks that previously manually approved rows remain present and safe after
// later scheduled syncs or PR rebases. Does not claim to verify Epic's facts.
const fs=require('node:fs'),path=require('node:path');
const {collision,collisionKey}=require('./manual-approval-core.cjs');
const {evaluate:cosmeticEvaluate}=require('./cosmetic-rank-rules.cjs');
const {RULES}=require('./verified-history-approval.cjs');
const {verifyCashRow:verifiedJune7DuosCash, POLICY:S30_DUOS_CASH_POLICY}=require('./verified-s30-duos-cash-20240607.cjs');
const {verifyNonprizeRow:verifiedJune7Zero, POLICY:S30_ZERO_DUOS_POLICY}=require('./verified-s30-duos-nonprize-20240607.cjs');
const {verifyCashRow:verifiedJune21Duos, POLICY:S30_JUNE21_POLICY}=require('./verified-s30-me-zb-duos-20240621.cjs');
const {verifyCashRow:verifiedS29MeDuos, POLICY:S29_ME_ZB_DUOS_POLICY}=require('./verified-s29-me-zb-duos-20240506.cjs');
const {verifyCashRow:verifiedS28MeDuos, POLICY:S28_ME_ZB_DUOS_POLICY}=require('./verified-s28-me-zb-duos-20240120-20240212.cjs');
const {verifyCashRow:verified2023MeDuos, POLICY:S26_S28_ME_ZB_DUOS_2023_POLICY}=require('./verified-s26-s28-me-zb-duos-2023.cjs');
const {verifyCashRow:verifiedS25MeDuos, POLICY:S25_ME_ZB_DUOS_2023_POLICY}=require('./verified-s25-me-zb-duos-2023.cjs');
const {verifyCashRow:verified2022to2024PSCups,POLICY:S22_S25_S31_PS_20261114_POLICY}=require('./verified-ps-cups-2022-2024-nov14.cjs');
const {verifyCashRow:verifiedSevenCash, POLICY:S37_S39_S40_SEVEN_CASH_POLICY}=require('./verified-s37-s39-s40-awards7.cjs');
const {verifyCashRow:verifiedOceFiveCash, POLICY:S37_S41_OCE_FIVE_CASH_POLICY}=require('./verified-s37-s41-oce-five.cjs');
const {verifyCashRow:verifiedFourCash, POLICY:EU_UNREAL_ME_TRIOS_FOUR_POLICY}=require('./verified-eu-unreal-me-trios-four.cjs');
const {verifyCashRow:verifiedKameMeDuoCash, POLICY:KAME_ME_DUOS_TWO_POLICY}=require('./verified-kame-me-duos-two.cjs');
const {verifyCashRow:verifiedS41ConsoleZbCash, POLICY:S41_CONSOLE_ZB_FOUR_POLICY}=require('./verified-s41-console-zb-oce-reconcile.cjs');
const {verifyCashRow:verifiedBoterS31S38Nine, POLICY:B0TER_S31_S38_NINE_POLICY}=require('./verified-boter-s31-s38-nine.cjs');
const {verifyCashRow:verifiedNacZbTen, POLICY:NAC_S29_S30_ZB_VC_TEN_POLICY}=require('./verified-nac-s29-s30-zb-vc-ten.cjs');
const {verifyRow:verifiedS27S34S31Cash, POLICY:S27_S34_S31_PS_ZB_TEN_POLICY}=require('./verified-s27-s34-s31-ps-zb-ten.cjs');
const {verifyRow:verifiedMePsConsoleTen, POLICY:ME_S31_PS_S26_CONSOLE_TEN_POLICY}=require('./verified-s31-ps-s26-console-zb-ten.cjs');
const {verifiedCashRow:verifiedNov14Cash, POLICY:NOV14_PENDING_CASH_POLICY}=require('./verified-nov14-pending-cash.cjs');
const {verifyRow:verifiedNov15Nine, POLICY:NOV15_NINE_POLICY}=require('./verified-nov15-nac-ps-naw-nine.cjs');
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

// A legacy NA Central participant in S30 must not be promoted to a finalist.
function validRuleVerifiedLegacyNacAttendance(r,entry){
 const rule=RULES['ch5s3-solo-victory-cup'];
 const window=rule?.verifiedLegacyNacExtraWindows?.find(x=>
  x.dateJst==='2024-06-18'&&
  x.windowId==='S30_SoloVictoryCashCup_Event3Round1_NAC'&&
  x.cutoff===5000&&x.allowOutOfCutoffAttendance===true);
 // Accept only the two account-ID/score-verified out-of-cutoff participants
  // for this exact June 18 NAC event. No general legacy NAC attendance bypass.
  const approvedRows=[
   {id:'auto-s30-23c77f05995a',player:'Celis やなぎさわつつ上等',
    rank:7040,points:114,kills:6,vrs:0},
   {id:'auto-s30-552fce5922b8',player:'むーこにっく',
    rank:8150,points:109,kills:17,vrs:1,matches:4}
  ];
  const exact=approvedRows.some(x=>Object.entries(x).every(([key,value])=>r?.[key]===value));
  if(!window||!exact||r.rank<=window.cutoff||
  r.date!==window.dateJst||r.region!=='NAC'||r.seasonId!=='S30'||
  r.tournamentId!=='ch5s3-solo-victory-cup'||
  r.event!=='Solo Victory Cup Battle Royale'||
  r.kind!=='参加確認'||r.prize!==0||r.reviewOnly===true||
  r.verified!==true||r.round!=='Event 3 · Round 1 / 参加確認'||
  entry?.rule!==rule.source||typeof r.note!=='string'||
  !r.note.includes('突破圏外')||!r.note.includes(window.source)||
  !r.note.includes(rule.source))return false;
 try {
  const u=new URL(r.source);
  return u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
   u.pathname==='/competitive/events/S30_SoloVictoryCashCup/'&&
   u.searchParams.size===2&&u.searchParams.get('region')==='NAC'&&
   u.searchParams.get('round')===window.windowId;
 }catch{return false}
}
// An attendance-only approval in the existing manual ledger may be upgraded
// only with a separate immutable before/after audit, full saved Epic leaderboard
// and the SAME strict tournament-specific approval logic as first publication.
function verifiedPublishedPromotion(row,entry,evidence){
 if(!evidence||!Array.isArray(evidence.results)||!Array.isArray(evidence.scanDocs)||
  !evidence.history||evidence.history.version!==1||
  !Array.isArray(evidence.history.entries)||row?.kind!=='賞金決勝'||
  row?.verified!==true||row?.reviewOnly===true||row?.prize===null)return false;
 const {checkpointsFor,officialSlot,sourceWindow,inspect}=require('./participation-promotion.cjs');
 const crypto=require('node:crypto');
 const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const matches=evidence.history.entries.filter(h=>h?.id===row.id);
 if(matches.length!==1)return false;
 const h=matches[0],before=h.beforeRow;
 if(!before||before.id!==entry.recordId||before.id!==row.id||
  before.kind!=='参加確認'||before.prize!==null||before.verified!==true||
  before.reviewOnly===true||before.source!==entry.source||
  h.before?.kind!=='参加確認'||h.before?.round!==before.round||
  h.before?.prize!==before.prize||
  h.after?.kind!==row.kind||h.after?.round!==row.round||
  h.after?.prize!==row.prize||h.after?.prizePerPlayer!==row.prizePerPlayer||
  h.beforeSha256!==fingerprint(before)||h.afterSha256!==fingerprint(row))
  return false;
 const rule=evidence.rules?.rules?.find(x=>x.id===before.tournamentId);
 if(!rule||h.proof?.ruleSha256!==fingerprint(rule))return false;
 if(h.proof?.file!=='auto-sync-scan.json'&&
    h.proof?.file!=='history-sync-scan.json')return false;
 const time=Date.parse(h.approvedAt);
 if(!Number.isFinite(time))return false;
 const identity=sourceWindow(before);
 if(!identity||h.proof.key!==identity.key)return false;
 const hits=checkpointsFor(before,evidence.scanDocs);
 const proof=hits.find(x=>x.file===h.proof.file&&x.identity.key===h.proof.key);
 if(!proof||!Number.isFinite(Date.parse(proof.cp.lastSuccessAt))||
  Date.parse(proof.cp.lastSuccessAt)<Date.parse(h.proof.lastSuccessAt))return false;
 const slot=officialSlot(before,identity,evidence.schedule);
 const priorResults=evidence.results.map(x=>x.id===row.id?before:x);
 if(priorResults.filter(x=>x.id===row.id).length!==1)return false;
 const result=inspect(before,{...evidence,results:priorResults},hits,slot,time);
 return !!result.record&&fingerprint(result.record)===h.afterSha256&&
  JSON.stringify(result.record)===JSON.stringify(row);
}
// Cash Cup attendance can also be promoted, but ONLY with a persisted,
// exact before/after audit and a fresh replay of the original rule-backed
// approval, against the saved verified leaderboard. No blanket cash inference.
function verifiedCashPromotion(row,entry,results,players){
 try{
  const history=load('cash-promotion-history.json');
  if(history?.version!==1||!Array.isArray(history.entries))return false;
  const hits=history.entries.filter(h=>h.id===row.id);
  if(hits.length!==1)return false;
  const proofs=load('data/manual-approvals/20261115-naw-trios-cash-fifth-proof.json');
  const context={results,players,tournaments:load('tournaments.json'),
   schedule:load('schedule.json'),
   scanDocs:[load('auto-sync-scan.json'),load('history-sync-scan.json')]};
  const {verifyHistoricalPromotion}=require('./promote-published-cash.cjs');
  return verifyHistoricalPromotion(row,entry,context,hits[0],proofs.proofs);
 }catch{return false}
}

// Exact screenshot / tracker UUID oracle for the 2025-08-02 NAW Squid Grounds final.
// Only these seven pairs qualify under this policy; not a blanket approval.
const S36_SQUID_NAW_SEVEN={
 4:[3,16,['EXV mAximum24','94a5d597-b290-4965-a38a-ca3f3b0061d3'],['えありー','bf6b915c-60d9-4e09-a7e1-55165440e01b']],
 5:[3,12,['Reo','25945a39-f156-4a22-aab8-ea7808feac98'],['ろみぃ','765aceae-b41b-44f7-9d8b-dd28fa6f6367']],
 9:[2,5,['asvaswgernb','34db6afd-2ce0-46be-8554-a813face02df'],['p1ng','9766622e-ec65-443f-b8cf-2b860838c19d']],
 10:[3,5,['なずな','801068c3-cddd-4d65-8d56-8722a9d253e4'],['お前らグラファいってないんｗｗ','fecbcdd3-237d-4d29-bdf5-973bb2d5c596']],
 11:[3,3,['ふーくんかっこいいǃǃ','cc2a8ff9-810e-4a8f-8402-0b61b62a878b'],['goat playerfnbr','e8815502-3abd-4dc7-a5ae-013c4d7dc00c']],
 12:[3,2,['くりたる','02463a80-d495-4907-b95d-2e0bf0bfa887'],['内海ゆうま','1c2dca5c-ae09-4ffe-87ae-6176911eb7be']],
 13:[3,0,['ふぃる','b8ee0fe8-a574-4c3c-a37b-b746388064ec'],['めるんやけん','d02e4ebd-1504-4724-bbcc-81263cee3779']]
};
const S36_SQUID_SOURCE='https://fortnitetracker.com/events/epicgames_S36_SquidGroundVictoryDuosCup_NAW?window=S36_VictoryDuosCup_Event6Round2_NAW';
const S36_SQUID_RULE='https://www.fortnite.com/competitive/events/S36_SquidGroundVictoryDuosCup/?region=NAW';
function validS36Squid7(r,entry){
 const e=S36_SQUID_NAW_SEVEN[r?.rank];
 if(!e||!entry||r.date!=='2025-08-02'||r.region!=='NAW'||
    r.seasonId!=='S36'||r.chapter!==6||r.season!==3||
    r.event!=='Squid Grounds Cash Cup'||r.tournamentId!=='ch6s3-squid-grounds-cash-cup'||
    r.round!=='Event 6 · Round 2 / 賞金決勝'||r.kind!=='賞金決勝'||
    r.id!=='s36-naw-squid-grounds-20250802-final-r'+r.rank||
    r.points!==100||r.matches!==e[0]||r.kills!==e[1]||r.vrs!==1||
    r.prize!==200||r.teamPrize!==200||r.prizePerPlayer!==100||
    r.verified!==true||r.reviewOnly===true||
    r.source!==S36_SQUID_SOURCE||entry.source!==r.source||
    entry.rule!==S36_SQUID_RULE||entry.recordId!==r.id||
    !Array.isArray(r.players)||r.players.length!==2||
    !Array.isArray(r.profiles)||r.profiles.length!==2||
    !Array.isArray(r.teamAccountIds)||r.teamAccountIds.length!==2||
    r.player!==r.players.join(' / '))return false;
 return [0,1].every(i=>{
   let p=r.profiles[i],n=e[2+i][0],id=e[2+i][1];
   try{return r.players[i]===n&&p.name===n&&
      new URL(p.url).searchParams.get('id')?.toLowerCase()===id&&
      r.teamAccountIds[i]===id.replace(/-/g,'')}
   catch{return false}
 });
}

function audit(results,ledger,players,{promotionEvidence}={}){
 let loadedPromotionEvidence=promotionEvidence;
 let loaded=false;
 const evidence=()=>{
  if(!loaded){
   loaded=true;
   if(loadedPromotionEvidence===undefined){
    try{
     const file='participation-promotion-history.json';
     const history=load(file);
     const scanDocs=['auto-sync-scan.json','history-sync-scan.json']
      .filter(name=>fs.existsSync(path.join(root,name)))
      .map(name=>({name,data:load(name)}));
     const {linkedAccounts}=require('./osirion-sync.cjs');
     loadedPromotionEvidence={history,scanDocs,results,players,
      tournaments:load('tournaments.json'),schedule:load('schedule.json'),
      rules:load('tournament-rules.json'),
      verifiedAccounts:linkedAccounts({results,players}).accounts};
    }catch{loadedPromotionEvidence=null}
   }
  }
  return loadedPromotionEvidence;
 };

 const errors=[];
 if(ledger?.version!==1||!Array.isArray(ledger.entries))return ['approval-history.json is invalid'];
 // Index the current snapshot once; all historical approval rules below stay
 // unchanged. collisionKey is a *necessary* (not sufficient) condition for
 // collision(), so every candidate still gets the original full check.
 // Keep the source order to preserve the first four diagnostic IDs.
 const rowsById=new Map(),overlapByKey=new Map();
 const aliases=players?.confirmedAliases;
 for(const row of results){
  const idMatches=rowsById.get(row.id)||[];
  idMatches.push(row);
  rowsById.set(row.id,idMatches);
  const key=collisionKey(row,aliases);
  const overlaps=overlapByKey.get(key)||[];
  overlaps.push(row);
  overlapByKey.set(key,overlaps);
 }
 const ids=new Set();
 for(const entry of ledger.entries){
  if(!entry||typeof entry.id!=='string'||ids.has(entry.id)){errors.push('Invalid or repeated approval history ID');continue}
  ids.add(entry.id);
  const rows=rowsById.get(entry.recordId)||[];
  if(rows.length!==1){errors.push('Published record missing or duplicate: '+entry.id);continue}
  const r=rows[0];
  if(entry.decision!=='published'||!['attendance-only','verified-rule','cosmetic-rank','verified-vr','official-final-vr-award','verified-qualifier','verified-s32-final-100usd-vr','verified-trios-qualifier-participation-zero-cash',S30_DUOS_CASH_POLICY,S30_ZERO_DUOS_POLICY,S30_JUNE21_POLICY,S29_ME_ZB_DUOS_POLICY,S28_ME_ZB_DUOS_POLICY,S26_S28_ME_ZB_DUOS_2023_POLICY,S25_ME_ZB_DUOS_2023_POLICY,S22_S25_S31_PS_20261114_POLICY,S37_S39_S40_SEVEN_CASH_POLICY,S37_S41_OCE_FIVE_CASH_POLICY,EU_UNREAL_ME_TRIOS_FOUR_POLICY,KAME_ME_DUOS_TWO_POLICY,S41_CONSOLE_ZB_FOUR_POLICY,B0TER_S31_S38_NINE_POLICY,NAC_S29_S30_ZB_VC_TEN_POLICY,S27_S34_S31_PS_ZB_TEN_POLICY,ME_S31_PS_S26_CONSOLE_TEN_POLICY,NOV14_PENDING_CASH_POLICY,NOV15_NINE_POLICY,'verified-s36-squid-naw-seven',REVIEWONLY_NONPRIZE_POLICY,GENERIC_ZERO_POLICY,S37_OCE_CONSOLE_ROUND1_POLICY,S37_OCE_CONSOLE_ROUND1_SECOND_POLICY,S37_NAW_EVENT6_ROUND1_POLICY,S37_NAW_EVENT6_REMAINING14_POLICY,S37_CONSOLE_BULK23_POLICY,S30_NAC_ZB_SOLO85_POLICY,S37_ROUND2_ZERO20_POLICY,S39_RELOAD_ZERO5_POLICY,S41_EU_CONSOLE_ZB_R2_11_POLICY,S30_NAC_ZB_R2_SEVEN_POLICY,S38_S41_SAFE3_POLICY,S30_S37_S43_TWELVE_POLICY,DEFERRED_PAGE_SIX_POLICY,NOV17_TRACKER_POLICY,S37_FIVE_NEW_POLICY,BULK_S35_S37_DUOS_POLICY,FOLLOWUP_24_POLICY,ORIGINAL32_POLICY].includes(entry.policy)){
   errors.push('Unknown decision/policy: '+entry.id);continue;
  }
  if(r.source!==entry.source||r.verified!==true)errors.push('Published source or verification flag changed: '+entry.id);
  if(entry.policy===S37_OCE_CONSOLE_ROUND1_POLICY&&!validS37OceConsoleRound1(r,entry))
    errors.push('S37 OCE Console Duos Round1 original rank, team, payout or top-250 rule changed: '+entry.id);
  if(entry.policy===S37_OCE_CONSOLE_ROUND1_SECOND_POLICY&&!validS37OceConsoleRound1Second(r,entry))
    errors.push('S37 OCE Console Duos Round1 second batch rank, team or zero payout changed: '+entry.id);
  if(entry.policy===S37_NAW_EVENT6_ROUND1_POLICY&&!validS37NawEvent6Round1(r,entry))
    errors.push('S37 NAW Console Event6 Round1 four-team identity, qualifier rank or zero payout changed: '+entry.id);
  if(entry.policy===S37_NAW_EVENT6_REMAINING14_POLICY&&!validS37NawEvent6Remaining14(r,entry))
    errors.push('S37 NAW Event6 Round1 14-team rank, identity or zero payout changed: '+entry.id);
  if(entry.policy===S37_CONSOLE_BULK23_POLICY&&!validS37ConsoleBulk23(r,entry))
    errors.push('S37 Console Round1 OCE7 NAW9 23-row rank, duo, source or zero cash changed: '+entry.id);
  if(entry.policy===S30_NAC_ZB_SOLO85_POLICY&&!validS30NacZbSolo85(r,entry))
    errors.push('S30 NAC Zero Build Solo Round1 identity, rank, prize or historical rule changed: '+entry.id);
  if(entry.policy===S37_ROUND2_ZERO20_POLICY&&!validS37Round2Zero20(r,entry))
    errors.push('S37 Console Duos Round2 no-VR confirmed final, award, duo identity or source changed: '+entry.id);
  if(entry.policy===S39_RELOAD_ZERO5_POLICY&&!validS39ReloadZero5(r,entry))
    errors.push('S39 NAW Reload Duos Round2 zero-VR finalist original score or award changed: '+entry.id);
  if(entry.policy===S41_EU_CONSOLE_ZB_R2_11_POLICY&&!validS41EUConsoleZB11(r,entry))
    errors.push('S41 EU Console ZB Solo Round2 original Epic name, rank, VR or $100 per VR payout changed: '+entry.id);
  if(entry.policy===DEFERRED_PAGE_SIX_POLICY&&!validDeferredSix(r,entry))
    errors.push('Six deferred-page source identities, stage, zero cash or later-page proof changed: '+entry.id);
  if(entry.policy===S30_S37_S43_TWELVE_POLICY&&!validTwelveRecovery(r,entry))
    errors.push('12 recovered S30/S37/S43 original Epic scores, qualifying stage, or verified prizes altered: '+entry.id);
  if(entry.policy===S38_S41_SAFE3_POLICY&&!validS38S41Safe3(r,entry))
    errors.push('S38 Squad zeroVR or S41 EU Console Solo Round1 source/prize changed: '+entry.id);
  if(entry.policy===S30_NAC_ZB_R2_SEVEN_POLICY&&!validS30NacZB7(r,entry))
    errors.push('S30 NAC ZB Solo 45-page original 1VR $100 winner evidence or identity changed: '+entry.id);
  if(entry.policy===ORIGINAL32_POLICY&&!validOriginal32(r,entry))
    errors.push('Original 32 Epic account UUID/scoreboard page, official Round1 cash and qualification proof changed: '+entry.id);
  if(entry.policy===FOLLOWUP_24_POLICY&&!validFollowup24(r,entry))
    errors.push('Followup 24 source-locked Epic UUID, original rank, qualification or 0VR cash proof changed: '+entry.id);
  if(entry.policy===BULK_S35_S37_DUOS_POLICY&&!validBulkS35S37Duos(r,entry))
    errors.push('S35/S37 2025 Epic duo UUID rank, zero VR or official cash conditions changed: '+entry.id);
  if(entry.policy===S37_FIVE_NEW_POLICY&&!verifyS37FiveNew(r,entry))
    errors.push('Five S37 NAW/OCE screenshot-locked Epic IDs, kills, VR or team cash changed: '+entry.id);
  if(entry.policy===NOV17_TRACKER_POLICY&&!validNov17TrackerRow(r,entry))
    errors.push('Nov17 user screenshot pair/score/official cash proof invalid: '+entry.id);
  if(entry.policy===GENERIC_ZERO_POLICY){
    const match=GENERIC_REVIEW_MANIFEST.approvals?.filter(a=>a.candidate?.id===entry.id)||[];
    if(match.length!==1||!verifyPublishedZero(r,entry,match[0]))
      errors.push('Generic review-only zero-cash official-rule or snapshot proof invalid: '+entry.id);
  }
  if(entry.policy===REVIEWONLY_NONPRIZE_POLICY&&!verifiedNonprizeRow(r,entry))
    errors.push('Invalid manually reviewed cash-free Round1 ranking, source, Epic UUID or payout: '+entry.id);
  if(entry.policy==='attendance-only'&&(r.kind!=='参加確認'||r.prize!==null||r.reviewOnly===true)&&
     !verifiedPublishedPromotion(r,entry,evidence())&&
     !verifiedCashPromotion(r,entry,results,players)&&
     !validNov17S41Award(r,entry))
    errors.push('Participation was changed into unsupported confirmed award: '+entry.id);
  // The June 18, 2024 NAC Round 1 cutoff was top 5,000.
  // A player outside the cutoff can never be retroactively relabeled a
  // qualifier or cash finalist, even if the ledger policy is verified-rule.
  if(entry.policy==='verified-rule'&&r.id==='auto-s30-552fce5922b8'&&
   r.date==='2024-06-18'&&r.region==='NAC'&&
   r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&
   r.source?.includes('S30_SoloVictoryCashCup_Event3Round1_NAC')&&
   Number.isSafeInteger(r.rank)&&r.rank>5000&&r.kind!=='参加確認')
   errors.push('2024 NAC out-of-cutoff attendance was promoted to qualifier or finalist: '+entry.id);
  if(entry.policy==='verified-rule'&&(r.prize!==0||r.reviewOnly===true||(!['予選','賞金決勝'].includes(r.kind)&&
    !validRuleVerifiedReloadAttendance(r,entry)&&
    !validRuleVerifiedLegacyNacAttendance(r,entry))))errors.push('Rule-approved entry has unsupported payout or category: '+entry.id);
  if(entry.policy===S30_DUOS_CASH_POLICY&&!verifiedJune7DuosCash(r,entry))errors.push('Unverified June 7 ME ZB Duos Cash Cup placement or individual payout: '+entry.id);
  if(entry.policy===S30_ZERO_DUOS_POLICY&&!verifiedJune7Zero(r,entry))errors.push('Unverified June 7 ME ZB Duos zero-prize final or roster: '+entry.id);
  if(entry.policy===S30_JUNE21_POLICY&&!verifiedJune21Duos(r,entry))errors.push('Unverified June 21 ME ZB Duos score, cash, team roster, or Tracker ID: '+entry.id);
  if(entry.policy===S29_ME_ZB_DUOS_POLICY&&!verifiedS29MeDuos(r,entry))errors.push('Unverified May 6 ME Zero Build Duos Victory Cup screenshot payout or player identity: '+entry.id);
  if(entry.policy===S28_ME_ZB_DUOS_POLICY&&!verifiedS28MeDuos(r,entry))errors.push('Unverified Jan20/Feb12 ME Zero Build Duos Victory Cup rank, cash, roster, Epic ID, or date: '+entry.id);
  if(entry.policy===S26_S28_ME_ZB_DUOS_2023_POLICY&&!verified2023MeDuos(r,entry))errors.push('Unverified Oct23/Dec16 2023 ME ZB Duos Victory Cup rank, 1VR payout, roster, Epic ID, or event window: '+entry.id);
  if(entry.policy===S25_ME_ZB_DUOS_2023_POLICY&&!verifiedS25MeDuos(r,entry))errors.push('Unverified June 19/26 2023 ME ZB Duos Victory Cup rank, exact 1/2 VR cash, roster, Epic ID or session: '+entry.id);
  if(entry.policy===S22_S25_S31_PS_20261114_POLICY&&!verified2022to2024PSCups(r,entry))errors.push('Unverified September 2022/2024 PlayStation Cup or June 2023 ZB Duos placement, cash bracket, Epic ID or tournament window: '+entry.id);
  if(entry.policy===S37_S39_S40_SEVEN_CASH_POLICY&&!verifiedSevenCash(r,entry))errors.push('Unverified S37 console duos, S39 Unreal Cup or S40 Solo VC exact screenshot/VR/cash/Epic identity: '+entry.id);
  if(entry.policy===S37_S41_OCE_FIVE_CASH_POLICY&&!verifiedOceFiveCash(r,entry))errors.push('Unverified OCE 2025 S37 console duo or 2026 S41 zero-build solo cash score/VR/Epic ID: '+entry.id);
  if(entry.policy===EU_UNREAL_ME_TRIOS_FOUR_POLICY&&!verifiedFourCash(r,entry))errors.push('Incorrect EU Unreal 919 prize or ME S31/S32 trios placement/cash/identity after correction: '+entry.id);
  if(entry.policy===KAME_ME_DUOS_TWO_POLICY&&!verifiedKameMeDuoCash(r,entry))errors.push('Incorrect 2022/2024 Kame duo Week 4/Event 5 rank, cash, Epic identities or screenshot evidence: '+entry.id);
  if(entry.policy===S41_CONSOLE_ZB_FOUR_POLICY&&!verifiedS41ConsoleZbCash(r,entry))errors.push('Incorrect screenshot-verified S41 Console ZB event, original Epic UUID, VR cash or rank: '+entry.id);
  if(entry.policy===B0TER_S31_S38_NINE_POLICY&&!verifiedBoterS31S38Nine(r,entry))errors.push('Incorrect verified Boter FNCS, ME Duos Cash, or NAW Squads 2024/2025 cash score/identity: '+entry.id);
  if(entry.policy===NAC_S29_S30_ZB_VC_TEN_POLICY&&!verifiedNacZbTen(r,entry))errors.push('Incorrect 2024 NAC S29/S30 ZB Solo/Duos Victory Cup screenshot result or Epic UUID: '+entry.id);
  if(entry.policy===S27_S34_S31_PS_ZB_TEN_POLICY&&!verifiedS27S34S31Cash(r,entry))errors.push('Incorrect 2023 NAC ZB Duos, 2025 NAW PlayStation or 2024 ME SypherPK screenshot result or UUID: '+entry.id);
  if(entry.policy===ME_S31_PS_S26_CONSOLE_TEN_POLICY&&!verifiedMePsConsoleTen(r,entry))errors.push('Incorrect 2023 ME Console Champions or 2024 ME SypherPK screenshot result, prize or Epic UUID: '+entry.id);
  if(entry.policy===NOV14_PENDING_CASH_POLICY&&!verifiedNov14Cash(r,entry))errors.push('Unverified Nov14 pending cash candidate, Epic ranking, original account ID, prize tier, or award evidence: '+entry.id);
   if(entry.policy===NOV15_NINE_POLICY&&!verifiedNov15Nine(r,entry))errors.push('Unverified Nov15 S29 NAC ZB / S36 PlayStation / S37 NAW Console original Epic UUID, placement, score or cash: '+entry.id);
  if(entry.policy==='verified-s36-squid-naw-seven'&&!validS36Squid7(r,entry))errors.push('Unverified S36 NAW Squid Grounds duo Epic UUID, rank, kills or cash: '+entry.id);
  if(entry.policy==='cosmetic-rank'&&(r.kind!=='スキン大会'||r.prize!==0||r.reviewOnly===true||!cosmeticEvaluate(r).eligible))errors.push('Cosmetic winner is outside verified official rank range: '+entry.id);
  if(entry.policy==='verified-vr'&&!(r.kind==='賞金決勝'&&r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&r.region==='ME'&&r.source?.includes('/S30_SoloVictoryCashCup/')&&r.source?.includes('S30_SoloVictoryCashCup_Event7Round2_ME')&&Number.isSafeInteger(r.vrs)&&r.vrs>=1&&r.vrs<=3&&Number.isSafeInteger(r.matches)&&r.matches>=r.vrs&&r.matches<=3&&r.points===r.vrs*100&&r.prize===r.vrs*100&&r.verified===true&&r.reviewOnly!==true))errors.push('Cash final record lacks official per-VR proof: '+entry.id);
  if(entry.policy==='official-final-vr-award'&&!validCashFinal(r,entry))errors.push('Invalid official solo/duo VR award: '+entry.id);
  if(['verified-qualifier','verified-s32-final-100usd-vr',
    'verified-trios-qualifier-participation-zero-cash'].includes(entry.policy) &&
    !validNov12ReviewedPolicy(r,entry))errors.push('Invalid Nov12 source/rule/payout: '+entry.id);
  const collisions=(overlapByKey.get(collisionKey(r,aliases))||[]).filter(x=>x.id!==r.id).map(x=>({id:x.id,reason:collision(x,r,aliases)})).filter(x=>x.reason);
  if(collisions.length)errors.push('Potential duplicate for approved '+entry.id+': '+collisions.slice(0,4).map(x=>x.id).join(', '));
 }
 return errors;
}
if(require.main===module){
 const errors=audit(load('results.json'),load('approval-history.json'),load('players.json'));
 if(errors.length){for(const e of errors)console.error('ERROR '+e);process.exitCode=1;}
 else console.log('Manual approval ledger validation OK');
}
module.exports={audit,verifiedPublishedPromotion};
