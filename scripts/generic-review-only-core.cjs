'use strict';
// Data-driven manual review policy. No generic payout inference:
// every zero-cash rule is a separately code-reviewed, exact event+window.
const crypto=require('node:crypto');
const MANIFEST=require('../data/manual-approvals/review-only-generic-v1.json');
const POLICY='verified-review-only-zero-round1-v1';
const REVIEW_REASON='確認専用大会は自動承認不可';
const RULES=Object.freeze({
 's33-2025-naw-solo-cash-event6-round1':Object.freeze({
  date:'2025-02-02',region:'NAW',seasonId:'S33',
  tournamentId:'ch6s1-solo-cash',event:'Solo Cash Cup',
  sourceEventId:'S33_SoloCashCup',
  windowId:'S33_SoloCashCup_Event6Round1_NAW',
  cutoff:600,maxMatches:10,
  url:'https://www.fortnite.com/news/solo-cash-cups-chapter-6-season-1-official-rules'
 })
});
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const safeInt=x=>Number.isSafeInteger(x)&&x>=0;
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const excluded=new Set(['reviewOnly','reviewReason','prize','note']);
function stripped(x){
 return Object.keys(x||{}).filter(k=>!excluded.has(k)).sort()
  .map(k=>[k,x[k]]);
}
function sameStoredEvidence(a,b){
 return JSON.stringify(stripped(a))===JSON.stringify(stripped(b));
}
function pinnedRule(snapshot,ruleId){
 const rule=RULES[ruleId];
 if(!rule||!snapshot||snapshot.seasonId!==rule.seasonId||
  snapshot.tournamentId!==rule.tournamentId||
  snapshot.date!==rule.date||snapshot.region!==rule.region||
  snapshot.event!==rule.event||snapshot.kind!=='参加確認'||
  snapshot.round!=='Event 6 · Round 1 / 参加確認'||
  !safeInt(snapshot.rank)||snapshot.rank<=rule.cutoff||
  !safeInt(snapshot.matches)||snapshot.matches<1||
  snapshot.matches>rule.maxMatches||roster(snapshot).length!==1)return null;
 const url='https://www.fortnite.com/competitive/events/'+rule.sourceEventId+
  '/?region='+rule.region+'&round='+rule.windowId;
 if(snapshot.source!==url)return null;
 return rule;
}
function validateApproval(approval){
 if(!approval||typeof approval!=='object'||Array.isArray(approval)||
  !approval.candidate||!/^auto-s\d+-[a-z0-9]{12}$/.test(approval.candidate.id||''))return false;
 const r=approval.candidate;
 if(r.verified!==true||r.reviewOnly!==true||r.reviewReason!==REVIEW_REASON||
  r.kind!=='参加確認'||r.prize!==null||
  !safeInt(r.rank)||r.rank===0||!safeInt(r.points)||!safeInt(r.kills)||
  !safeInt(r.vrs)||!safeInt(r.matches)||r.matches<1||r.vrs>r.matches||
  !Array.isArray(r.teamAccountIds)||r.teamAccountIds.length!==roster(r).length||
  r.teamAccountIds.some(id=>typeof id!=='string'||!/^[0-9a-f]{32}$/.test(id))||
  new Set(r.teamAccountIds).size!==r.teamAccountIds.length)return false;
 if(approval.decision==='attendance-only')
  return !Object.hasOwn(approval,'ruleId');
 if(approval.decision==='zero-round1')
  return typeof approval.ruleId==='string'&&Boolean(pinnedRule(r,approval.ruleId));
 return false;
}
function zeroNote(r,rule){
 return '管理者による本人Epic ID・公式開催枠・保存順位表の確認。'+
  r.event+' Round 1 '+r.rank+'位は決勝進出上位'+rule.cutoff+
  '位の圏外。公式Round 1は現金賞金なし（賞金$0）。'+
  '突破・決勝成績・その他賞品を追加認定しない。公式規則: '+
  rule.url+' 出典: '+r.source;
}
function convertedRow(original,approval){
 const {reviewOnly,reviewReason,...row}=original;
 if(approval.decision==='zero-round1'){
  const rule=pinnedRule(original,approval.ruleId);
  if(!rule)throw Error('GENERIC_REVIEW no independently pinned zero-cash rule');
  return {...row,kind:'参加確認',prize:0,note:zeroNote(original,rule)};
 }
 return {...row,kind:'参加確認',prize:null,
  note:'管理者がEpic ID・公式開催枠・保存順位表の参加実績を照合。'+
   '賞金・予選突破・賞品の確認は未完了。出典: '+original.source};
}
function verifyPublishedZero(row,entry,approval){
 if(!validateApproval(approval)||approval.decision!=='zero-round1'||!row||!entry)return false;
 const r=approval.candidate,rule=pinnedRule(r,approval.ruleId);
 if(!rule||entry.policy!==POLICY||entry.decision!=='published'||
  entry.id!==r.id||entry.recordId!==r.id||row.id!==r.id||
  entry.source!==r.source||entry.rule!==rule.url||
  !Number.isFinite(Date.parse(entry.approvedAt))||
  entry.candidateHash!==sha(r)||entry.recordHash!==sha(row)||
  row.verified!==true||row.kind!=='参加確認'||row.prize!==0||
  row.reviewOnly!==undefined||row.reviewReason!==undefined||
  row.prizePerPlayer!==undefined||row.teamPrize!==undefined||
  !sameStoredEvidence(r,row)||row.note!==zeroNote(r,rule))return false;
 return true;
}
// The manual review hold takes precedence over broad legacy publishers.
// These IDs must remain pending until the missing original Epic UUID is verified.
const isExplicitlyHeld=id=>MANIFEST.held.some(h=>h.id===id);
function approvals(){
 if(MANIFEST.version!==1||!Array.isArray(MANIFEST.approvals)||
    MANIFEST.approvals.length>100)throw Error('GENERIC_REVIEW invalid manual manifest');
 const ids=new Set();
 for(const a of MANIFEST.approvals){
  if(!validateApproval(a)||ids.has(a.candidate.id))
   throw Error('GENERIC_REVIEW rejected unverified or duplicate manual decision');
  ids.add(a.candidate.id);
 }
 return MANIFEST.approvals;
}
module.exports={POLICY,RULES,MANIFEST,sha,approvals,pinnedRule,validateApproval,
 sameStoredEvidence,convertedRow,zeroNote,verifyPublishedZero,isExplicitlyHeld};
