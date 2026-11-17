'use strict';
// Six original ID-pinned zero-cash rows from fully observed leaderboard PREFIXES.
// A later rate limit is accepted only if its failed page is beyond all saved rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const POLICY='verified-deferred-page-six-20261117';
const SNAPSHOT_PATH='data/manual-approvals/deferred-page-six-20261117.json';
const SNAPSHOT_BLOB='9d87332517857016dab9fa76a2f97b1b7d719c77';
const WHITELIST=Object.freeze([
'auto-s30-152692d409d8','auto-s30-9f795aaece95',
'auto-s37-14d44ba0ee8a','auto-s37-a40ae8acd39b',
'auto-s31-6ba1a7092617','auto-s31-89772400e55a'
]);
function loadSnapshot(root=path.resolve(__dirname,'..')){
 const bytes=fs.readFileSync(path.join(root,SNAPSHOT_PATH));
 const digest=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(digest!==SNAPSHOT_BLOB)throw Error('DEFERRED_SIX original snapshot Git blob changed');
 const data=JSON.parse(bytes.toString('utf8'));
 if(data.version!==1||data.repo!=='takezion62-hash/asia-on-tour'||
   data.groups?.length!==3||data.specs?.length!==6||
   JSON.stringify(data.specs.map(s=>s.id))!==JSON.stringify(WHITELIST))
  throw Error('DEFERRED_SIX original ID whitelist changed');
 return data;
}
const SOURCE=loadSnapshot(),GROUPS=Object.freeze(SOURCE.groups),SPECS=Object.freeze(SOURCE.specs);
const RULES=Object.freeze(SOURCE.rules);
const specOf=id=>SPECS.find(s=>s.id===id);
const members=row=>Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];
const accounts=row=>Array.isArray(row?.teamAccountIds)?row.teamAccountIds:[];
const originals=['id','date','region','player','playerRaw','event','round','rank','points','kills',
 'vrs','matches','prize','kind','seasonId','chapter','season','tournamentId','source'];
function matchOriginal(row,s){
 return !!row&&!!s&&row.verified===true&&
  (row.reviewOnly===true)===(s.reviewOnly===true)&&
  originals.every(k=>row[k]===s[k])&&
  JSON.stringify(members(row))===JSON.stringify(s.players)&&
  JSON.stringify(accounts(row))===JSON.stringify(s.teamAccountIds);
}
function expected(s){
 if(s.seasonId==='S30')return {kind:'賞金決勝',round:s.round,prize:0};
 if(s.seasonId==='S37')return {kind:'参加確認',round:'Event 6 · Round 1 / 参加確認',prize:0};
 if(s.seasonId==='S31')return {kind:s.rank<=198?'予選':'参加確認',
  round:'Event 4 · Round 1 / '+(s.rank<=198?'予選突破':'参加確認'),prize:0};
 throw Error('DEFERRED_SIX unapproved season');
}
function validateRecord(row,entry){
 const s=specOf(row?.id),g=s&&GROUPS.find(x=>x.tag===s.group);
 const rule=s&&RULES[s.seasonId],target=s&&expected(s);
 return !!row&&!!entry&&!!s&&!!g&&
  entry.id===s.id&&entry.recordId===s.id&&entry.policy===POLICY&&
  entry.decision==='published'&&entry.source===s.source&&entry.rule===rule&&
  entry.evidence?.includes(SNAPSHOT_BLOB)&&entry.evidence.includes(g.sourceScanBlob)&&
  row.id===s.id&&row.date===s.date&&row.region===s.region&&
  row.seasonId===s.seasonId&&row.tournamentId===s.tournamentId&&
  row.player===s.player&&row.playerRaw===s.playerRaw&&
  row.event===s.event&&row.source===s.source&&row.verified===true&&
  row.reviewOnly!==true&&row.reviewReason===undefined&&
  row.kind===target.kind&&row.round===target.round&&row.prize===target.prize&&
  JSON.stringify(members(row))===JSON.stringify(s.players)&&
  JSON.stringify(accounts(row))===JSON.stringify(s.teamAccountIds)&&
  ['rank','points','kills','vrs','matches'].every(k=>row[k]===s[k])&&
  typeof row.note==='string'&&row.note.includes(rule)&&
  row.note.includes(g.sourceScanBlob)&&row.note.includes('賞金$0')&&
  row.note.includes('後続ページ')&&
  (s.seasonId!=='S37'||row.note.includes('上位250'))&&
  (s.seasonId!=='S31'||row.note.includes('上位198'));
}
function removeExact(queue,ids){
 if(!Array.isArray(queue)||!Array.isArray(ids)||new Set(ids).size!==ids.length||
  queue.filter(x=>ids.includes(x.id)).length!==ids.length)
  throw Error('DEFERRED_SIX duplicate or absent pending IDs');
 return queue.filter(x=>!ids.includes(x.id));
}
module.exports={POLICY,SNAPSHOT_PATH,SNAPSHOT_BLOB,WHITELIST,GROUPS,SPECS,RULES,loadSnapshot,
 specOf,members,accounts,matchOriginal,expected,validateRecord,removeExact};
