'use strict';
// Six immutable, source-locked, mature scoreboard prefixes; no inferred cash.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const POLICY='verified-s30-s37-s43-twelve-20261117';
const SNAPSHOT_PATH='data/manual-approvals/s30-s37-s43-twelve-mature-checkpoints-20261117.json';
const SNAPSHOT_BLOB='842b03a3b5f589f0345991663c45ade9eb215d55';
const ids=Object.freeze([
 'auto-s30-98604567f817','auto-s30-bcdd26ba55d0','auto-s30-cf20e298bf17',
 'auto-s30-0bc9080a1ae0','auto-s30-4144692b17ff','auto-s30-c02df30c9cba',
 'auto-s30-92ad181b2a33','auto-s30-1f16b12c4b18',
 'auto-s37-c890fce1b50d','auto-s37-b1753da953d7','auto-s37-188c92111225',
 'auto-s43-aa67e196a6d7'
]);
function loadSnapshot(root=path.resolve(__dirname,'..')){
 const bytes=fs.readFileSync(path.join(root,SNAPSHOT_PATH));
 const sha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(sha!==SNAPSHOT_BLOB)throw Error('TWELVE_EVIDENCE immutable source blob changed');
 const data=JSON.parse(bytes.toString('utf8'));
 if(data.version!==1||data.repo!=='takezion62-hash/asia-on-tour'||
   data.groups?.length!==6||data.specs?.length!==12||
   JSON.stringify(data.specs.map(s=>s.id))!==JSON.stringify(ids)||
   new Set(data.groups.map(g=>g.tag)).size!==6)
  throw Error('TWELVE_EVIDENCE source schema/whitelist incorrect');
 return data;
}
const source=loadSnapshot(),SPECS=Object.freeze(source.specs),GROUPS=Object.freeze(source.groups);
const RULES=Object.freeze(source.rules);
const getSpec=id=>SPECS.find(s=>s.id===id);
const expected=(s)=>s.mode==='cash'?
 {kind:'賞金決勝',round:s.round,prize:100*s.vrs}:
 s.seasonId==='S37'?{kind:'参加確認',round:'Event 6 · Round 1 / 参加確認',prize:0}:
 {kind:'予選',round:s.round.replace('/ 予選','/ 予選突破'),prize:0};
const members=x=>Array.isArray(x?.players)&&x.players.length?x.players:[x?.player];
const fields=['id','date','region','player','playerRaw','event','round','rank','points',
 'kills','vrs','matches','prize','kind','seasonId','chapter','season','tournamentId','source'];
function matchesOriginal(row,s){
 return !!row&&!!s&&row.verified===true&&row.reviewOnly!==true&&
  fields.every(f=>row[f]===s[f])&&JSON.stringify(members(row))===JSON.stringify(s.players);
}
function validateRecord(row,entry){
 const s=getSpec(row?.id),g=s&&GROUPS.find(x=>x.tag===s.group);
 const wanted=s&&expected(s),rule=s&&RULES[s.seasonId];
 return !!row&&!!entry&&!!s&&!!g&&
  entry.id===s.id&&entry.recordId===s.id&&entry.policy===POLICY&&
  entry.decision==='published'&&entry.source===s.source&&entry.rule===rule&&
  entry.evidence?.includes(SNAPSHOT_BLOB)&&entry.evidence.includes(g.sourceBlob)&&
  row.id===s.id&&row.date===s.date&&row.region===s.region&&row.player===s.player&&
  row.playerRaw===s.playerRaw&&row.verified===true&&row.reviewOnly!==true&&
  row.reviewReason===undefined&&row.kind===wanted.kind&&row.round===wanted.round&&
  row.prize===wanted.prize&&row.source===s.source&&row.event===s.event&&
  row.seasonId===s.seasonId&&row.tournamentId===s.tournamentId&&
  JSON.stringify(members(row))===JSON.stringify(s.players)&&
  ['rank','points','kills','vrs','matches'].every(k=>row[k]===s[k])&&
  (s.mode!=='cash'||row.teamPrize===wanted.prize&&row.prizePerPlayer===wanted.prize)&&
  (s.seasonId!=='S43'||row.teamPrize===0&&row.prizePerPlayer===0)&&
  typeof row.note==='string'&&row.note.includes(rule)&&row.note.includes(g.sourceBlob)&&
  row.note.includes('賞金$'+wanted.prize)&&
  (s.seasonId!=='S37'||row.note.includes('上位250'))&&
  (s.mode!=='qualifier'||row.note.includes('上位'+g.cutoff));
}
function removeExact(queue,idsToRemove){
 if(!Array.isArray(queue)||!Array.isArray(idsToRemove)||new Set(idsToRemove).size!==idsToRemove.length||
  queue.filter(x=>idsToRemove.includes(x.id)).length!==idsToRemove.length)
  throw Error('TWELVE_EVIDENCE missing/duplicate pending IDs');
 return queue.filter(x=>!idsToRemove.includes(x.id));
}
module.exports={POLICY,SNAPSHOT_PATH,SNAPSHOT_BLOB,SPECS,GROUPS,RULES,ids,getSpec,expected,
 members,matchesOriginal,validateRecord,removeExact,loadSnapshot};
