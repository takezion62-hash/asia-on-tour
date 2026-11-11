'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const scriptDir=path.join(root,'scripts');
const ignored=new Set(['script-lifecycle.test.cjs']);
function rel(p){return path.relative(root,p).split(path.sep).join('/')}
function scanFiles(dir,pattern){
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>{
  const p=path.join(dir,x.name);
  if(x.isDirectory())return scanFiles(p,pattern);
  return x.isFile()&&pattern.test(x.name)?[p]:[];
 });
}
function audit(){
 const scripts=scanFiles(scriptDir,/\.cjs$/).sort();
 const sources=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scripts,
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const fileData=sources.map(p=>({p:rel(p),content:fs.readFileSync(p,'utf8')}));
 return scripts.map(file=>{
  const own=rel(file),basename=path.basename(file);
  const refs=fileData.filter(x=>x.p!==own&&x.content.includes(basename)).map(x=>x.p);
  const entry=refs.filter(x=>x.startsWith('.github/workflows/')||x==='package.json');
  const script=refs.filter(x=>x.startsWith('scripts/'));
  const tests=refs.filter(x=>x.startsWith('tests/'));
  const usage=entry.length?'entrypoint':script.length?'script-dependency':
   tests.length?'test-dependency':'review-candidate';
  return{path:own,usage,references:refs};
 });
}
test('現役の自動更新・安全マージ・データ検証は参照され続ける',()=>{
 const by=new Map(audit().map(x=>[x.path,x]));
 for(const name of ['osirion-sync.cjs','safe-sync-merge.cjs','validate-data.cjs']){
  const row=by.get('scripts/'+name);
  assert.ok(row,'script must exist: '+name);
  assert.equal(row.usage,'entrypoint',name+' must remain an active entrypoint');
 }
});
test('完了済みの順位訂正は実行コードだけ整理し、更新履歴を残す',()=>{
 const file='correct-20261107-3peace-job-rank.cjs';
 assert.equal(fs.existsSync(path.join(scriptDir,file)),false,'old one-shot executable must be removed');
 const sources=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const activeRefs=sources.filter(p=>fs.readFileSync(p,'utf8').includes(file)).map(rel);
 assert.deepEqual(activeRefs,[],'retired executable must not be imported or invoked');
 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 assert.ok(updates.some(x=>x.id==='corrected-20261107-performance-3peace-job-rank702'),
  'already applied rank correction must remain in the public update ledger');
});
test('全スクリプトを4種類に分類し、未参照を即時削除対象としない',()=>{
 const rows=audit(),seen=new Set(rows.map(x=>x.path));
 assert.equal(rows.length,seen.size);
 assert.ok(rows.every(x=>['entrypoint','script-dependency','test-dependency','review-candidate'].includes(x.usage)));
 const totals=Object.groupBy(rows,x=>x.usage);
 console.log('AOT_SCRIPT_USAGE_AUDIT '+JSON.stringify({
  total:rows.length,
  counts:Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,value.length])),
  reviewCandidates:rows.filter(x=>x.usage==='review-candidate').map(x=>x.path)
 }));
});


test('2025-12-20 OCE Unreal Cupの完了済み個人賞金修正は実行コードを整理しても残る',()=>{
 const retired='fix-unreal-oce-duo-personal-payout.cjs';
 assert.equal(fs.existsSync(path.join(scriptDir,retired)),false,
  'completed payout migration must not be rerun from a residual executable');
 const sources=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const live=sources.filter(p=>fs.readFileSync(p,'utf8').includes(retired)).map(rel);
 assert.deepEqual(live,[],'retired payout script must have zero active references');

 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 assert.equal(updates.filter(e=>e.id==='fix-unreal-cup-oce-20251220-personal-50').length,1,
  'payout correction must remain in the published update ledger');
 const approvals=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8')).entries;
 const correction=approvals.find(e=>e.id==='auto-s39-4d5f1e94f897');
 assert.ok(correction && correction.decision==='published',
  'original official result must remain approved');
 assert.equal(correction.personalAwardCorrection?.amount,50);
 assert.equal(correction.personalAwardCorrection?.perPlayer,true);
 assert.equal(correction.personalAwardCorrection?.source,
  'https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_OCE?page=0&window=S39_1MillionUnrealCup_OCE');
 assert.equal(correction.personalAwardCorrection?.rule,
  'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules');

 const rows=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
 const actual=rows.filter(r=>r.id==='auto-s39-4d5f1e94f897');
 assert.equal(actual.length,1,'verified source row must stay unique');
 const row=actual[0];
 for(const [key,expected] of Object.entries({
  date:'2025-12-20',region:'OCE',tournamentId:'ch7s1-one-million-unreal-cup',
  rank:172,points:236,prize:100,prizePerPlayer:50,verified:true,
  source:'https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=OCE&round=S39_1MillionUnrealCup_OCE'
 }))assert.deepEqual(row[key],expected,'verified award field changed: '+key);
 assert.deepEqual(row.players,['まいにちフロッパー','mint']);
 assert.equal(row.prizePerPlayer*row.players.length,row.prize,
  'the duo team cash must equal both personal awards combined');
 const {personalCents}=require('../scripts/data-checks.cjs');
 assert.equal(personalCents(row),5000,'each individual must receive exactly $50 in cash totals');
});


test('14件のJST開催日修正と4件の重複解消は古い実行ファイル削除後も維持',()=>{
 const retired='repair-historical-session-dates.cjs';
 assert.equal(fs.existsSync(path.join(scriptDir,retired)),false,
  'historical one-shot repair should not remain executable');
 const sources=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 assert.deepEqual(sources.filter(p=>fs.readFileSync(p,'utf8').includes(retired)).map(rel),[],
  'no active code may execute or import the retired repair');

 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 const marker='site-fix-session-dates-and-duplicate-finals-20261106';
 assert.equal(updates.filter(x=>x.id===marker).length,1,
  'the completed session/date correction must remain logged');
 const results=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
 const byId=new Map(results.map(r=>[r.id,r]));
 assert.equal(byId.size,results.length,'published IDs must remain unique');
 const dates={
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
 assert.equal(Object.keys(dates).length,14);
 for(const [id,date] of Object.entries(dates)){
  const row=byId.get(id);
  assert.ok(row,'JST-corrected achievement must remain: '+id);
  assert.equal(row.date,date,'JST event date changed for '+id);
  assert.ok(row.source,'original result source must remain for '+id);
  assert.match(row.note||'',/開催日表記をEpic大会ウィンドウの日本時間/,
   'JST correction evidence must remain for '+id);
 }
 const duplicates={
  'auto-s42-0b675770d2ed':'s42-nac-solo-vc-final-20260913-blaze',
  'auto-s42-609ece393978':'s42-nac-solo-vc-final-20260913-kame',
  'auto-s42-b7878775d624':'s42-nac-solo-vc-final-20260913-dagutorio-taisho',
  'auto-s42-5844fef9dc36':'s42-nac-solo-vc-final-20260913-ama-crow'
 };
 const reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8')).entries;
 assert.equal(Object.keys(duplicates).length,4);
 for(const [duplicate,existing] of Object.entries(duplicates)){
  assert.equal(byId.has(duplicate),false,'removed duplicate was restored: '+duplicate);
  assert.ok(byId.has(existing),'canonical published record was lost: '+existing);
  const recorded=reviewed.filter(x=>x.id===duplicate);
  assert.equal(recorded.length,1,'duplicate resolution entry must be unique: '+duplicate);
  assert.equal(recorded[0].decision,'already-published');
  assert.equal(recorded[0].existingId,existing);
 }
});

test('第4段階：掲載完了4バッチの旧実行ファイルを除去しても63戦績・賞金・審査履歴を守る',()=>{
 const batches=[
  {
    "script": "manual-review-20261107-oce-qualifiers3.cjs",
    "marker": "review-20261107-oce-s31-qualifier-last-three",
    "count": 3
  },
  {
    "script": "manual-review-20261107-round1-21.cjs",
    "marker": "review-20261107-round1-participation-21",
    "count": 21
  },
  {
    "script": "manual-review-20261107-s31-aphrodite.cjs",
    "marker": "review-20261107-s31-victory-aphrodite-38",
    "count": 37
  },
  {
    "script": "publish-last-two-nov11.cjs",
    "marker": "verified-final-reviews-20261111",
    "count": 2
  }
];
 const active=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 const results=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
 const reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8')).entries;
 const approvals=JSON.parse(fs.readFileSync(path.join(root,'approval-history.json'),'utf8')).entries;
 const pending=JSON.parse(fs.readFileSync(path.join(root,'history-sync-review.json'),'utf8')).proposals;
 const byId=new Map(results.map(r=>[r.id,r]));
 assert.equal(byId.size,results.length,'published result IDs must remain unique');
 const ids=[];
 for(const {script,marker,count} of batches){
  assert.equal(fs.existsSync(path.join(scriptDir,script)),false,'retired one-shot executable reappeared: '+script);
  assert.deepEqual(active.filter(p=>fs.readFileSync(p,'utf8').includes(script)).map(rel),[],
   'active reference to retired one-shot executable: '+script);
  const logs=updates.filter(e=>e.id===marker);
  assert.equal(logs.length,1,'published correction batch must be logged exactly once: '+marker);
  assert.equal(logs[0].recordIds?.length,count,'published batch size changed: '+marker);
  assert.equal(new Set(logs[0].recordIds).size,count,'duplicate ID in batch: '+marker);
  for(const id of logs[0].recordIds){
   ids.push(id);
   const row=byId.get(id);
   assert.ok(row,'published achievement lost: '+id);
   assert.equal(row.verified,true,'original official verification lost: '+id);
   assert.ok(row.source,'original source lost: '+id);
   assert.ok(typeof row.prize==='number'&&Number.isFinite(row.prize)&&row.prize>=0,
    'confirmed prize has been changed to unknown: '+id);
   assert.ok(reviewed.some(e=>e.id===id&&e.decision==='published')||
     approvals.some(e=>e.id===id&&e.decision==='published'),
    'approval decision lost: '+id);
   assert.equal(pending.some(e=>e.id===id),false,'published ID returned to pending review: '+id);
  }
 }
 assert.equal(ids.length,63);
 assert.equal(new Set(ids).size,63,'batch overlap was reintroduced');
 const duo=byId.get('auto-s42-3fc137750a4c');
 assert.equal(duo?.prize,200,'Karf / huggyfv verified team prize must remain $200');
 assert.equal(byId.get('auto-s40-aa4c808b5bea')?.prize,0,
  'Clix Cup zero-VR final must remain $0');
});

test('第5段階：完了済み4掲載バッチを整理しても115件・既存Zoro重複判定を保護',()=>{
 const batches=[["manual-review-history-20261107-rule30.cjs","manual-history-20261107-rule-30",30],["manual-review-history-20261107-attendance50.cjs","manual-history-20261107-attendance-50",38],["manual-review-20261107-followup-33.cjs","verified-history-20261107-followup-33",30],["manual-review-20261107-new-23.cjs","verified-review-20261107-21-history-and-2-recent",17]];
 const activeFiles=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 const results=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
 const review=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8')).entries;
 const approvals=JSON.parse(fs.readFileSync(path.join(root,'approval-history.json'),'utf8')).entries;
 const pendingHistory=JSON.parse(fs.readFileSync(path.join(root,'history-sync-review.json'),'utf8')).proposals;
 const pendingCurrent=JSON.parse(fs.readFileSync(path.join(root,'auto-sync-review.json'),'utf8')).proposals;
 const byId=new Map(results.map(r=>[r.id,r]));
 assert.equal(byId.size,results.length,'published records must have unique IDs');
 const ids=[];
 for(const [filename,marker,count] of batches){
  assert.equal(fs.existsSync(path.join(scriptDir,filename)),false,
   'retired historic publisher must not be executable: '+filename);
  const live=activeFiles.filter(p=>fs.readFileSync(p,'utf8').includes(filename)).map(rel);
  assert.deepEqual(live,[],'active code still references a retired publisher: '+filename);
  const logs=updates.filter(e=>e.id===marker);
  assert.equal(logs.length,1,'published batch marker must remain unique: '+marker);
  assert.equal(logs[0].recordIds?.length,count,'published record count changed: '+marker);
  assert.equal(new Set(logs[0].recordIds).size,count,'duplicate record in update batch: '+marker);
  for(const id of logs[0].recordIds){
   ids.push(id);
   const row=byId.get(id);
   assert.ok(row,'already-published record was removed: '+id);
   assert.equal(row.verified,true,'Epic-verified record must remain verified: '+id);
   assert.ok(row.source,'original result source was removed: '+id);
   assert.ok(row.prize===null||(Number.isFinite(row.prize)&&row.prize>=0),
    'recorded prize must be nonnegative money or explicitly unconfirmed null: '+id);
   assert.ok(review.some(x=>x.id===id&&x.decision==='published')||
     approvals.some(x=>x.id===id&&x.decision==='published'),
     'existing published approval was removed: '+id);
   assert.ok(!pendingHistory.some(x=>x.id===id)&&!pendingCurrent.some(x=>x.id===id),
     'published record reappeared in a review queue: '+id);
  }
 }
 assert.equal(ids.length,115,'four completed batches must preserve 115 records');
 assert.equal(new Set(ids).size,115,'overlapping achievement IDs were reintroduced');
 const zoro=[
  ['auto-s43-c51e2bbfb3ed','s43-oce-zoro-mobile-skin-20261106-akuria'],
  ['auto-s43-6b7fe976d9eb','s43-oce-zoro-mobile-skin-20261106-brn-916gonluck']
 ];
 for(const [candidate,canonical] of zoro){
  assert.equal(byId.has(candidate),false,'duplicate Zoro result was published again: '+candidate);
  assert.ok(byId.has(canonical),'canonical Zoro result was removed: '+canonical);
  const matching=review.filter(x=>x.id===candidate);
  assert.equal(matching.length,1,'duplicate decision must not be lost: '+candidate);
  assert.equal(matching[0].decision,'already-published');
  assert.equal(matching[0].existingId,canonical);
 }
});

test('第6段階：完了済み4監査処理を整理して79戦績・18重複・32無効大会と順位競合を保護',()=>{
 const retired=[["manual-review-20261107-final-audit.cjs","review-20261107-final-voided-and-duplicates",0],["manual-review-20261107-unreal-na-west-voided.cjs","review-20261107-unreal-na-west-and-voided-oce-20",1],["manual-unreal-20261107-teamcash.cjs","manual-unreal-20261107-team-prize",1],["manual-review-history-95.cjs","manual-reviewed-history-95-20261106",77]];
 const voidIds=["auto-s41-2a0ca39875d4","auto-s41-62f75d6684c6","auto-s41-bb9668bd35e5","auto-s41-2cce4619d5f2","auto-s41-b8e6b6ea2115","auto-s41-704ead32c1b3","auto-s41-6d3693648527","auto-s41-1d23722df81b","auto-s41-22bc1422dbfc","auto-s41-27c4ed02bdaf","auto-s41-2b023a1a37bc","auto-s41-dfaec5d7dc8c","auto-s41-adcbb8ece8a2","auto-s41-0b735deca3de","auto-s41-8ee445e815bd","auto-s41-605380df065c","auto-s41-25773441abe2","auto-s41-9b5da99a2c77","auto-s41-7d673a661fcc","auto-s41-e199bfc5ca58","auto-s41-b93d5f9982cc","auto-s41-ab5f532b51e5","auto-s41-b74c5f18bde2","auto-s41-2dcbaf01d1b6","auto-s41-99dde642c80f","auto-s41-0cc56a920990","auto-s41-1dc242e86e63","auto-s41-22611231606a","auto-s41-07b6e9b2b37e","auto-s41-fa745c4bc14a","auto-s41-0989e8a09e8d","auto-s41-25fca1e49aa1"];
 const active=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 const reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8')).entries;
 const reviewQueue=JSON.parse(fs.readFileSync(path.join(root,'history-sync-review.json'),'utf8')).proposals;
 const recentQueue=JSON.parse(fs.readFileSync(path.join(root,'auto-sync-review.json'),'utf8')).proposals;
 const rows=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
 const plan=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261106-remaining-95.json'),'utf8'));
 const results=new Map(rows.map(x=>[x.id,x]));
 const decisions=new Map(reviewed.map(x=>[x.id,x]));
 const pending=new Set([...reviewQueue,...recentQueue].map(x=>x.id));
 assert.equal(results.size,rows.length,'published record IDs must remain unique');
 assert.equal(decisions.size,reviewed.length,'historical review IDs must remain unique');
 for(const [file,marker,count] of retired){
  assert.equal(fs.existsSync(path.join(scriptDir,file)),false,'retired executable must not be replayed: '+file);
  assert.deepEqual(active.filter(p=>fs.readFileSync(p,'utf8').includes(file)).map(rel),[],
   'old executable is still invoked: '+file);
  const log=updates.filter(x=>x.id===marker);
  assert.equal(log.length,1,'completed update marker lost or duplicated: '+marker);
  assert.equal(log[0].recordIds?.length,count,'original published count changed: '+marker);
  for(const id of log[0].recordIds){
   assert.ok(results.has(id),'original confirmed result lost: '+id);
   assert.equal(decisions.get(id)?.decision,'published','published approval lost: '+id);
   assert.equal(pending.has(id),false,'confirmed result returned to review: '+id);
  }
 }
 assert.equal(plan.entries.length,95,'frozen 95-case review manifest must remain');
 const approved=plan.entries.filter(e=>e.decision==='publish');
 const duplicate=plan.entries.filter(e=>e.decision==='duplicate');
 assert.equal(approved.length,77,'original published portion must remain 77');
 assert.equal(duplicate.length,18,'original duplicate portion must remain 18');
 assert.equal(new Set(plan.entries.map(x=>x.id)).size,95);
 for(const item of approved){
  const row=results.get(item.id);
  assert.ok(row,'verified result from 95-case batch missing: '+item.id);
  assert.equal(row.verified,true,'original verification flag lost: '+item.id);
  assert.ok(row.source,'original Epic evidence lost: '+item.id);
  assert.equal(decisions.get(item.id)?.decision,'published','review approval changed: '+item.id);
  assert.equal(pending.has(item.id),false,'previously reviewed record returned to queue: '+item.id);
 }
 for(const item of duplicate){
  assert.equal(results.has(item.id),false,'duplicate result republished: '+item.id);
  assert.ok(results.has(item.existingId),'canonical result lost: '+item.existingId);
  assert.equal(decisions.get(item.id)?.decision,'already-published','duplicate decision removed: '+item.id);
  assert.equal(decisions.get(item.id)?.existingId,item.existingId,'canonical mapping changed: '+item.id);
  assert.equal(pending.has(item.id),false);
 }
 assert.equal(voidIds.length,32);
 assert.equal(new Set(voidIds).size,32,'original void manifests overlapped');
 for(const id of voidIds){
  assert.equal(results.has(id),false,'VOIDED PlayStation Cup result must not be public: '+id);
  assert.equal(decisions.get(id)?.decision,'voided-not-published',
   'VOIDED decision must remain: '+id);
  assert.equal(pending.has(id),false,'VOIDED result returned to review: '+id);
 }
 const dispute=decisions.get('auto-s43-1f3a56f9719d');
 assert.equal(dispute?.decision,'rank-conflict-resolved-existing-official');
 assert.equal(dispute.existingId,'s43-me-solo-reload-test-20261102-rvl-grape');
 const canonical=results.get(dispute.existingId);
 assert.ok(canonical,'corrected official test-cup result must remain');
 assert.equal(canonical.rank,75,'official Epic rank 75 must be preserved');
 assert.equal(results.has('auto-s43-1f3a56f9719d'),false,'conflicting rank 74 must not be republished');
 const naw=results.get('auto-s39-6b024a834d72');
 assert.ok(naw,'NAW Unreal team cash result must remain');
 assert.equal(naw.rank,122);
 assert.equal(naw.prize,200,'NAW Unreal team prize must remain $200');
 assert.equal(naw.prizePerPlayer,100,'NAW Unreal personal awards must remain $100 each');
 const oce=results.get('auto-s39-4d5f1e94f897');
 assert.ok(oce,'OCE Unreal team cash result must remain');
 assert.equal(oce.rank,172);
 assert.equal(oce.prize,100,'OCE Unreal team prize must remain $100');
 assert.equal(oce.prizePerPlayer,50,'corrected OCE personal awards must remain $50 each');
 assert.equal(decisions.get(oce.id)?.personalAwardCorrection?.perPlayer,true);
});

test('第7段階：4本の一時掲載処理を整理しても169件の公開成績と審査記録を保持',()=>{
 const completedBatches=[["publish-reviewed-direct-20261108.cjs","assistant-reviewed-pending-20261108",49],["publish-reviewed-pending-evening-20261108.cjs","assistant-reviewed-pending-20261108-evening",30],["publish-reviewed-pending-morning-20261109.cjs","assistant-reviewed-pending-20261109-morning",20],["publish-reviewed-round2-20261109.cjs","assistant-reviewed-pending-round2-20261109",70]];
 const liveFiles=[
  ...scanFiles(path.join(root,'.github','workflows'),/\.ya?ml$/),
  ...scanFiles(scriptDir,/\.cjs$/),
  ...scanFiles(path.join(root,'tests'),/\.[cm]?js$/).filter(p=>!ignored.has(path.basename(p))),
  path.join(root,'package.json')
 ];
 const updates=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8')).entries;
 const reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8')).entries;
 const approvals=JSON.parse(fs.readFileSync(path.join(root,'approval-history.json'),'utf8')).entries;
 const results=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
 const pendingHistory=JSON.parse(fs.readFileSync(path.join(root,'history-sync-review.json'),'utf8')).proposals;
 const pendingAuto=JSON.parse(fs.readFileSync(path.join(root,'auto-sync-review.json'),'utf8')).proposals;
 const byId=new Map(results.map(row=>[row.id,row]));
 const pending=new Set([...pendingHistory,...pendingAuto].map(row=>row.id));
 const accepted=new Set([...reviewed,...approvals].filter(x=>x.decision==='published').map(x=>x.id));
 assert.equal(results.length,byId.size,'public results must not contain duplicate IDs');
 const checked=[];
 for(const [script,marker,expected] of completedBatches){
  assert.equal(fs.existsSync(path.join(scriptDir,script)),false,
   'completed one-shot publication script unexpectedly restored: '+script);
  const refs=liveFiles.filter(file=>fs.readFileSync(file,'utf8').includes(script)).map(rel);
  assert.deepEqual(refs,[],'active references to a retired publication script: '+script);
  const logs=updates.filter(u=>u.id===marker);
  assert.equal(logs.length,1,'publication ledger marker missing or duplicated: '+marker);
  const ids=logs[0].recordIds;
  assert.equal(ids?.length,expected,'published batch count changed: '+marker);
  assert.equal(new Set(ids).size,expected,'published batch contains duplicate IDs: '+marker);
  for(const id of ids){
   checked.push(id);
   const record=byId.get(id);
   assert.ok(record,'historical published record was removed: '+id);
   assert.ok(record.source,'original result source was removed: '+id);
   assert.ok(record.prize===null||(Number.isFinite(record.prize)&&record.prize>=0),
    'cash must remain nonnegative or explicitly unconfirmed: '+id);
   assert.ok(accepted.has(id),'published approval decision was removed: '+id);
   assert.equal(pending.has(id),false,'old published record reentered review queue: '+id);
  }
 }
 assert.equal(checked.length,169,'four original batches must total 169 published results');
 assert.equal(new Set(checked).size,169,'published batch overlap reintroduced');
});
