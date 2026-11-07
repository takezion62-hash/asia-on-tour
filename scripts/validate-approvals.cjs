'use strict';
// Checks that previously manually approved rows remain present and safe after
// later scheduled syncs or PR rebases. Does not claim to verify Epic's facts.
const fs=require('node:fs'),path=require('node:path');
const {collision}=require('./manual-approval-core.cjs');
const {evaluate:cosmeticEvaluate}=require('./cosmetic-rank-rules.cjs');
const root=path.resolve(__dirname,'..');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
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
  if(entry.decision!=='published'||!['attendance-only','verified-rule','cosmetic-rank','verified-vr'].includes(entry.policy)){
   errors.push('Unknown decision/policy: '+entry.id);continue;
  }
  if(r.source!==entry.source||r.verified!==true)errors.push('Published source or verification flag changed: '+entry.id);
  if(entry.policy==='attendance-only'&&(r.kind!=='参加確認'||r.prize!==null||r.reviewOnly===true))errors.push('Participation was changed into unsupported confirmed award: '+entry.id);
  if(entry.policy==='verified-rule'&&(r.prize!==0||r.reviewOnly===true||!['予選','賞金決勝'].includes(r.kind)))errors.push('Rule-approved entry has unsupported payout or category: '+entry.id);
  if(entry.policy==='cosmetic-rank'&&(r.kind!=='スキン大会'||r.prize!==0||r.reviewOnly===true||!cosmeticEvaluate(r).eligible))errors.push('Cosmetic winner is outside verified official rank range: '+entry.id);
  if(entry.policy==='verified-vr'&&!(r.kind==='賞金決勝'&&r.seasonId==='S30'&&r.tournamentId==='ch5s3-solo-victory-cup'&&r.region==='ME'&&r.source?.includes('/S30_SoloVictoryCashCup/')&&r.source?.includes('S30_SoloVictoryCashCup_Event7Round2_ME')&&Number.isSafeInteger(r.vrs)&&r.vrs>=1&&r.vrs<=3&&Number.isSafeInteger(r.matches)&&r.matches>=r.vrs&&r.matches<=3&&r.points===r.vrs*100&&r.prize===r.vrs*100&&r.verified===true&&r.reviewOnly!==true))errors.push('Cash final record lacks official per-VR proof: '+entry.id);
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
