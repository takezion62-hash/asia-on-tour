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
