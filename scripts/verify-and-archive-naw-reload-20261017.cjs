'use strict';
// User-supplied three Fortnite Tracker snapshots, rechecked against the exact
// Epic event's Osirion ranked row and account ID before archive publication.
// In NAW Round 1, 320 qualify; these ranks 339/341/342 are NOT qualifiers.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {getLeaderboard,normalizeRow}=require('./osirion-sync.cjs');
const {appendArchive,recordId,publishedEquivalent}=require('./participation-archive.cjs');
const load=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const save=(file,obj)=>fs.writeFileSync(path.join(root,file),JSON.stringify(obj,null,2)+'\n');
const check=(ok,msg)=>{if(!ok)throw Error('RELOAD_NAW_20261017_VERIFICATION '+msg)};
const nowJst=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const normalize=s=>String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
const targets=Object.freeze([
 {name:'RyoIT',raw:'RyoIT',rank:341,points:298,kills:23,vrs:2,matches:7,
  profile:'https://fortnitetracker.com/profile/all/RyoIT/events?id=f4cd4eba-e078-4e02-999a-c7f8d911b4c8'},
 {name:'ろず',raw:'ptt ろず',rank:339,points:299,kills:14,vrs:0,matches:8,
  profile:'https://fortnitetracker.com/profile/all/ptt%20%E3%82%8D%E3%81%9A/events?id=00a599b8-02b5-4bd8-9b85-2cc0a9385784'},
 {name:'シルス',raw:'wcr シルス',rank:342,points:298,kills:20,vrs:2,matches:7,
  profile:'https://fortnitetracker.com/profile/all/wcr%20%E3%82%B7%E3%83%AB%E3%82%B9/events?id=da998f2c-4b67-411e-888a-fce974baf9e1'}
]);
async function main(){
 const players=load('players.json'),published=load('results.json');
 const archive=load('participation/2026-10.json'),updates=load('updates.json');
 const tournaments=load('tournaments.json');
 const sessions=load('calendar-history/2026-10.json').sessions.filter(x=>
  x.dateJst==='2026-10-17'&&x.region==='NAW'&&
  x.tournamentId==='ch7s4-solo-reload-victory-cup'&&
  x.sourceWindowId==='S42_ReloadSoloVictoryCup_Event4_Round1_NAW'&&
  x.stage==='予選');
 check(sessions.length===1,'incorrect or ambiguous exact event window');
 const session=sessions[0];
 check(session.eventId==='S42_ReloadReloadSoloVictoryCup'&&
  session.startUtc==='2026-10-17T01:00:00.000Z'&&
  session.endUtc==='2026-10-17T03:00:00.000Z','official session data changed');
 const catalog=tournaments.catalog.find(x=>x.id===session.tournamentId);
 check(catalog&&catalog.team==='solo'&&catalog.mode==='reload'&&
  catalog.sourceEventIds.includes('S42_ReloadSoloVictoryCup')&&catalog.name==='Solo Reload Victory Cup',
  'tournament format not validated');
 const win={key:session.id,fullEventId:session.id.split('/')[0],
  eventId:session.eventId,windowId:session.sourceWindowId,region:'NAW'};
 // These ranks are around the fourth hundred-row page. Check a small bounded
 // neighborhood in case ranked-page numbering differs from screenshot position.
 const entries=[];
 for(const page of [2,3,4]){
  const board=await getLeaderboard(win,page);
  check(board.totalPages>=4&&board.totalPages<=2000,'invalid provider leaderboard pages');
  for(const e of board.entries||[])entries.push(e);
 }
 const toAdd=[];
 const expectedSource='https://www.fortnite.com/competitive/events/S42_ReloadSoloVictoryCup/?region=NAW&round=S42_ReloadSoloVictoryCup_Event4_Round1_NAW';
 const archWin={...session,eventId:'S42_ReloadSoloVictoryCup',
  windowId:session.sourceWindowId,round:'Event 4 · Round 1 / 予選',
  kind:'予選',series:'victory-cup'};
 const verifiedAccounts=[];
 for(const t of targets){
  check(t.rank>320&&t.points<300,'not a verified below-cutoff participant '+t.name);
  const exact=entries.filter(e=>{
   const r=normalizeRow(e,win);
   return r&&r.rank===t.rank&&r.points===t.points&&
    r.kills===t.kills&&r.vrs===t.vrs&&r.matches===t.matches&&
    normalize(e.players?.[0]?.username)===normalize(t.raw);
  });
  if(exact.length!==1){
   const nearby=entries.filter(e=>Math.abs(e.rank-t.rank)<=3 || e.pointsEarned===t.points).slice(0,25).map(e=>{
    const n=normalizeRow(e,win);return {rank:e.rank,name:e.players?.[0]?.username,points:e.pointsEarned,normalized:n?{kills:n.kills,vrs:n.vrs,matches:n.matches}:null};
   });
   console.log('NAW_RELOAD_VERIFICATION_DIAGNOSTIC '+JSON.stringify({target:t.name,expected:{rank:t.rank,points:t.points,kills:t.kills,vrs:t.vrs,matches:t.matches,raw:t.raw},nearby,entries:entries.length}));
  }
  check(exact.length===1,'official leaderboard row/username/scores not uniquely matched: '+t.name+
   ' (matched '+exact.length+')');
  const verified=normalizeRow(exact[0],win);
  check(verified.teamAccountIds.length===1&&/^[a-f0-9]{32}$/.test(verified.teamAccountIds[0]),
   'Epic account ID invalid '+t.name);
  verifiedAccounts.push({name:t.name,raw:t.raw,rank:t.rank,accountId:verified.teamAccountIds[0]});
  const proposal={id:'user-verified-reload-'+t.name,
   date:'2026-10-17',region:'NAW',player:t.name,
   event:'Solo Reload Victory Cup',tournamentId:catalog.id,
   seasonId:'S42',rank:t.rank,points:t.points,kills:t.kills,vrs:t.vrs,matches:t.matches,
   verified:true,source:expectedSource};
  const previous=archive.entries.filter(x=>x.id===recordId(proposal)||
   (x.date===proposal.date&&x.region===proposal.region&&
    x.tournamentId===proposal.tournamentId&&x.player===proposal.player&&
    new URL(x.source).searchParams.get('round')===session.sourceWindowId));
  check(previous.length<=1,'multiple existing archive records for '+t.name);
  if(previous.length)check(['rank','points','kills','vrs','matches','source'].every(k=>
   previous[0][k]===proposal[k]),'existing participation conflicts with screenshot: '+t.name);
  const existingPublished=published.filter(r=>publishedEquivalent(proposal,[r])||
   (r.date===proposal.date&&r.region===proposal.region&&
    r.tournamentId===proposal.tournamentId&&r.rank===proposal.rank&&
    r.points===proposal.points&&r.kills===proposal.kills&&r.vrs===proposal.vrs&&
    new URL(r.source).searchParams.get('round')===session.sourceWindowId));
  check(existingPublished.length<=1,'multiple published matching results '+t.name);
  if(!existingPublished.length)toAdd.push({proposal,profile:t.profile,name:t.name});
 }
 const known=new Set(players.candidates.map(x=>x.name));
 for(const t of targets){
  if(!known.has(t.name)){
   players.candidates.push({name:t.name,initials:t.name==='RyoIT'?'RY':'ろず',
    accent:t.name==='RyoIT'?'cyan':'pink',
    desc:'2026/10/17 NAW Solo Reload Victory Cup Event4予選'+t.rank+
     '位・'+t.points+'pt・'+t.kills+'K・'+t.vrs+
     'VR。320位の通過枠外。Tracker表示名「'+t.raw+'」。'});
   known.add(t.name);
  }
  if(t.raw!==t.name){
   const holders=Object.entries(players.confirmedAliases||{}).filter(([canonical,aliases])=>
    aliases.includes(t.raw)&&canonical!==t.name);
   check(!holders.length,'Tracker name alias belongs to another player: '+t.raw);
   if(!players.confirmedAliases[t.name])players.confirmedAliases[t.name]=[];
   if(!players.confirmedAliases[t.name].includes(t.raw))players.confirmedAliases[t.name].push(t.raw);
  }
 }
 const beforeCount=archive.entries.length;
 const outcome=appendArchive(root,toAdd.map(x=>({win:archWin,cutoff:320,proposals:[x.proposal]})),
   published,{checkedAt:new Date().toISOString()});
 check(outcome.rejected===0&&outcome.skippedPublished===0&&
   outcome.added===toAdd.length,'archive write rejected or skipped unexpectedly '+JSON.stringify(outcome));
 const modified=load('participation/2026-10.json');
 const changed=[];
 for(const item of toAdd){
  const id=recordId(item.proposal);
  const r=modified.entries.find(x=>x.id===id);
  check(r&&r.status==='通過圏外'&&r.qualification==='outside-cutoff'&&
   r.officialCutoff===320&&r.rank===item.proposal.rank,'participation state invalid '+item.name);
  r.note='2026/10/17 NAW Solo Reload Victory Cup Event4予選。Fortnite Tracker画像の順位・ポイント・キル・VR・試合数とEpic/Osirion順位表のEpic ID・表示名を照合。NAW通過上位320名、最終300ptのため通過圏外、予選賞金$0。プロフィール: '+item.profile;
  changed.push({name:item.name,id});
 }
 if(changed.length){
  save('participation/2026-10.json',modified);
  const updateId='user-supplied-naw-reload-20261017-trio-20261109';
  check(!updates.entries.some(x=>x.id===updateId),'duplicate update ID');
  updates.entries.unshift({
   id:updateId,date:nowJst(),type:'participation',
   title:'2026/10/17 NAW Solo Reload VC 予選参加3名を追加',
   description:'RyoIT（341位・23K・2VR）、ろず（339位・14K・0VR）、シルス（342位・20K・2VR）。Fortnite Tracker提供画像と公式順位表を照合し、上位320名の通過圏外として参加記録に掲載。賞金・通過・称号の誤加算なし。',
   recordIds:[],participationMonth:'2026-10',
   participationIds:changed.map(x=>x.id),
   participantTeams:changed.map(x=>x.name)
  });
  save('updates.json',updates);
 }
 save('players.json',players);
 console.log('NAW_RELOAD_20261017_PUBLICATION '+JSON.stringify({
  added:outcome.added,skippedExisting:targets.length-toAdd.length,
  archivedIds:changed,accountsVerified:verifiedAccounts.map(x=>({name:x.name,raw:x.raw,rank:x.rank})),
  archiveCountBefore:beforeCount,archiveCountAfter:modified.entries.length,
  cutoff:320,confirmedPrizeTotal:0,totalArchive:outcome.total
 }));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
