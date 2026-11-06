'use strict';
// Correct legacy local-date labels to official JST history and reconcile exact
// duplicate player-round records. Keep the original user-verified record IDs,
// profile links and awards; preserve the official source in their notes.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const save=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
const REPAIRS={
 's42-naw-reload-solo-20261017-taiga':'2026-10-13',
 's42-naw-reload-solo-20261002-shiroka':'2026-10-03',
 'official-shiroka-champion-2026':'2026-09-21',
 's42-me-megaman-cup-20260908-maguro-osydd':'2026-09-09',
 's42-me-megaman-cup-20260908-popo-ao':'2026-09-09',
 's42-nac-solo-vc-qual-20260913-blaze':'2026-09-14',
 's42-nac-solo-vc-qual-20260913-kame':'2026-09-14',
 's42-nac-solo-vc-qual-20260913-dagutorio-taisho':'2026-09-14',
 's42-nac-solo-vc-qual-20260913-ama-crow':'2026-09-14',
 's42-nac-solo-vc-qual-20260913-diguda':'2026-09-14',
 's42-nac-solo-vc-final-20260913-blaze':'2026-09-14',
 's42-nac-solo-vc-final-20260913-kame':'2026-09-14',
 's42-nac-solo-vc-final-20260913-dagutorio-taisho':'2026-09-14',
 's42-nac-solo-vc-final-20260913-ama-crow':'2026-09-14'
};
const DUPLICATES={
 'auto-s42-0b675770d2ed':'s42-nac-solo-vc-final-20260913-blaze',
 'auto-s42-609ece393978':'s42-nac-solo-vc-final-20260913-kame',
 'auto-s42-b7878775d624':'s42-nac-solo-vc-final-20260913-dagutorio-taisho',
 'auto-s42-5844fef9dc36':'s42-nac-solo-vc-final-20260913-ama-crow'
};
const marker='site-fix-session-dates-and-duplicate-finals-20261106';
const rows=load('results.json'),updates=load('updates.json'),reviewed=load('history-sync-reviewed.json');
if(updates.entries.some(x=>x.id===marker)){console.log('Session date repair already committed');process.exit(0)}
const byId=new Map(rows.map(r=>[r.id,r]));
if(byId.size!==rows.length)throw Error('Pre-existing record IDs duplicate');
const history=new Map();
for(const month of new Set(Object.values(REPAIRS).map(x=>x.slice(0,7)))){
 const monthRows=load('calendar-history/'+month+'.json').sessions;
 for(const row of monthRows)history.set(row.sourceWindowId+'|'+row.region,row);
}
const key=(r,date=r.date)=>[date,r.region,r.tournamentId||r.event,
 String(r.round||'').split('/')[0].trim(),...(r.players||[r.player]).slice().sort()].join('|');
const duplicates=new Map();
for(const [autoId,manualId] of Object.entries(DUPLICATES)){
 const auto=byId.get(autoId),manual=byId.get(manualId);
 if(!auto||!manual)throw Error('Missing exact duplicate pair: '+autoId);
 if(auto.date!=='2026-09-14'||manual.date!=='2026-09-13'||manual.region!=='NAC'||auto.region!=='NAC')
   throw Error('Unexpected original dates for '+autoId);
 for(const field of ['rank','points','kills','vrs','matches','prize'])
   if(auto[field]!==manual[field])throw Error('Conflicting source data '+autoId+' '+field);
 if(key(auto)!==key(manual,'2026-09-14'))throw Error('Not the same appearance: '+autoId);
 if(reviewed.entries.some(x=>x.id===autoId))throw Error('History ledger already contains duplicate '+autoId);
 duplicates.set(autoId,manualId);
}
const planned=new Set(Object.keys(REPAIRS)),changed=[];
for(const [id,newDate] of Object.entries(REPAIRS)){
 const row=byId.get(id);
 if(!row||row.date===newDate)throw Error('Unexpected/missing legacy date '+id);
 const m=String(row.source||'').match(/[?&](?:window|round)=([^&#]+)/);
 if(!m)throw Error('Missing canonical window source '+id);
 const win=history.get(decodeURIComponent(m[1])+'|'+row.region);
 if(!win||win.dateJst!==newDate||win.tournamentId!==row.tournamentId)
   throw Error('Official JST window differs from expected date '+id);
 row.date=newDate;
 row.note=(row.note||'')+' 【開催日表記をEpic大会ウィンドウの日本時間'+newDate+'に統一。】';
 changed.push(id);
}
const retained=rows.filter(r=>!duplicates.has(r.id));
const seen=new Map();
for(const row of retained){
 const k=key(row);
 if(seen.has(k)&&Object.values(REPAIRS).includes(row.date)){
  // Existing records must never be silently merged: stop on a new conflict.
  const other=seen.get(k);
  if(planned.has(row.id)||planned.has(other)||Object.values(DUPLICATES).includes(row.id)||Object.values(DUPLICATES).includes(other))
    throw Error('Unresolved semantic duplicate '+row.id+' '+other);
 }
 seen.set(k,row.id);
}
const automatic=updates.entries.find(x=>x.recordIds?.some(id=>duplicates.has(id)));
if(!automatic||!automatic.title.includes('77戦績'))throw Error('Original auto-import history has changed');
const oldLength=automatic.recordIds.length;
automatic.recordIds=automatic.recordIds.filter(id=>!duplicates.has(id));
if(oldLength-automatic.recordIds.length!==4)throw Error('Unexpected duplicate audit count');
automatic.title=automatic.title.replace('77戦績','73戦績');
automatic.description+=' 重複4件は先行する本人確認済み戦績へ出典を統合し二重計上を解消。';
for(const [autoId,manualId] of duplicates){
 const auto=byId.get(autoId),manual=byId.get(manualId);
 manual.note+=' Epic公式ウィンドウとの再照合：'+auto.source;
 reviewed.entries.push({id:autoId,decision:'already-published',existingId:manualId,reason:'JST date normalized; exact same player, rank and match statistics'});
}
reviewed.reviewedAt=new Date().toISOString();
updates.entries.unshift({id:marker,date:'2026-11-06',type:'site',
 title:'大会開催日のJST統一と決勝重複の解消',
 description:'Epic公式大会ウィンドウで14戦績の開催日を日本時間へ統一。NAC Solo Victory Cup決勝の同一選手4件は既存の本人確認済み記録に公式出典を統合。旧リンクの記録ID・個人の実績・賞金は保持。',
 recordIds:[]});
save('results.json',retained);save('updates.json',updates);save('history-sync-reviewed.json',reviewed);
console.log('SESSION_DATE_REPAIR '+JSON.stringify({datesCorrected:changed.length,duplicatesReconciled:duplicates.size,before:rows.length,after:retained.length}));
