'use strict';
// Explicit administrator-reviewed 2024/2025 zero-cash Round 1 participation.
// Policy is pinned to nine individually saved Epic IDs/ranks; it cannot
// approve another tournament or turn preliminary participation into cash.
const data=require('../data/manual-approvals/20261116-reviewonly-10.json');
const POLICY='verified-round1-nonprize-20261116';
const TARGETS=Object.freeze(data.publish.map(x=>Object.freeze(x)));
const byId=new Map(TARGETS.map(x=>[x.id,x]));
const json=x=>JSON.stringify(x);
const fields=['id','date','region','player','playerRaw','players','round','event','rank',
 'points','kills','vrs','matches','seasonId','tournamentId','source','teamAccountIds'];
const list=row=>Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];
function validateCandidate(row,proof){
 if(!row||!proof||proof.id!==row.id||row.reviewOnly!==true||
    row.reviewReason!==data.reviewReason||row.verified!==true||
    row.kind!=='参加確認'||row.prize!==null||
    !fields.every(k=>json((k==='players'?list(row):row[k]))===json(proof[k]))||
    !Array.isArray(proof.teamAccountIds)||
    proof.teamAccountIds.length!==proof.players.length||
    proof.teamAccountIds.some(id=>!(/^[a-f0-9]{32}$/.test(id)))||
    new Set(proof.teamAccountIds).size!==proof.teamAccountIds.length||
    !Number.isSafeInteger(proof.rank)||proof.rank<=proof.cutoff||
    proof.vrs>proof.matches)return false;
 const isME=proof.tournamentId==='ch5s3-zb-duos-cash'&&
  proof.seasonId==='S30'&&proof.date==='2024-08-01'&&
  proof.region==='ME'&&proof.event==='ZB Duos Cash Cup'&&
  proof.round==='Event 7 · Round 1 / 参加確認'&&proof.cutoff===50&&
  proof.players.length===2&&proof.rule===data.officialRules.S30;
 const isNAW=proof.tournamentId==='ch6s1-solo-cash'&&
  proof.seasonId==='S33'&&proof.date==='2025-02-02'&&
  proof.region==='NAW'&&proof.event==='Solo Cash Cup'&&
  proof.round==='Event 6 · Round 1 / 参加確認'&&proof.cutoff===600&&
  proof.players.length===1&&proof.rule===data.officialRules.S33;
 if(!isME&&!isNAW)return false;
 const event=isME?'S30_DuosCashCupZB':'S33_SoloCashCup';
 const window=isME?'S30_DuosCashCupZB_Event7Round1_ME':'S33_SoloCashCup_Event6Round1_NAW';
 return proof.source==='https://www.fortnite.com/competitive/events/'+event+
  '/?region='+proof.region+'&round='+window&&
  Number.isSafeInteger(proof.points)&&proof.points>=0&&
  Number.isSafeInteger(proof.kills)&&proof.kills>=0&&
  Number.isSafeInteger(proof.vrs)&&proof.vrs>=0&&
  Number.isSafeInteger(proof.matches)&&proof.matches>=1&&proof.matches<=10;
}
function verifiedNonprizeRow(row,entry){
 const p=byId.get(row?.id);
 if(!p||!entry||entry.id!==p.id||entry.recordId!==p.id||
    entry.policy!==POLICY||entry.rule!==p.rule||entry.source!==p.source||
    row.reviewOnly===true||row.reviewReason!==undefined||
    row.verified!==true||row.kind!=='参加確認'||row.prize!==0||
    row.prizePerPlayer!==undefined||row.teamPrize!==undefined||
    !fields.every(k=>json((k==='players'?list(row):row[k]))===json(p[k]))||
    !Number.isFinite(Date.parse(entry.approvedAt))||
    typeof row.note!=='string'||!row.note.includes(p.rule)||
    !row.note.includes('上位'+p.cutoff)||
    !row.note.includes('賞金$0'))return false;
 // Reconstruct the original candidate and check exactly the same original proof.
 return validateCandidate({...row,prize:null,reviewOnly:true,
  reviewReason:data.reviewReason,kind:'参加確認'},p);
}
module.exports={POLICY,TARGETS,byId,validateCandidate,verifiedNonprizeRow};
