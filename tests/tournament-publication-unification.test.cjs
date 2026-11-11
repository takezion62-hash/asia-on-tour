'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createPublicationFiles,verifyEpicReviewEvidence,upsertPublicationLog}=require('../scripts/reviewed-publication-core.cjs');

const remaining=[
 'publish-extra-verified-nov11.cjs',
 'publish-reviewed-s30-nac-zero-vr.cjs',
 'publish-verified-final4-persona.cjs',
 'publish-verified-finals-batch.cjs',
 'publish-verified-nov11-pending.cjs',
 'publish-verified-nov11-round2.cjs',
 'publish-verified-nov11-round3.cjs',
 'publish-verified-qualifier-batch.cjs',
 'publish-verified-s35-console-duos-20261108.cjs'
];
const integrated=[
 'publish-verified-cash-playstation-pending.cjs',
 'publish-verified-cosmetic-pending.cjs',
 'publish-verified-fncs-performance-days.cjs'
];
test('全12大会別掲載スクリプトが共通I/O・掲載エンジンを利用する',()=>{
 const folder=path.resolve(__dirname,'../scripts');
 for(const filename of [...remaining,...integrated]){
  const code=fs.readFileSync(path.join(folder,filename),'utf8');
  assert.match(code,/require\('\.\/reviewed-publication-core\.cjs'\)/,
   'shared publication module must be used: '+filename);
  assert.match(code,/require\('\.\/manual-approval-core\.cjs'\)/,
   'original identity, evidence and collision validator must remain: '+filename);
  if(remaining.includes(filename))assert.doesNotMatch(code,/fs\.writeFileSync|fs\.readFileSync/,
   'historical publisher JSON I/O should use the shared adapter: '+filename);
  assert.ok(code.includes('--dry-run'),'non-writing preview mode must remain: '+filename);
 }
 for(const filename of remaining){
  const src=fs.readFileSync(path.join(folder,filename),'utf8');
  assert.match(src,/createPublicationFiles\(/,'historical publisher has not been migrated: '+filename);
 }
 for(const filename of integrated){
  const src=fs.readFileSync(path.join(folder,filename),'utf8');
  assert.match(src,/loadReviewDb\(root\)/,'reviewed publisher lost shared workspace: '+filename);
  assert.match(src,/writeReviewDb\(root,db\)/,'reviewed publisher lost shared persistence: '+filename);
 }
});
test('共通ファイルアダプタは従来と同じJSONと改行で読み書きする',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'aot-unified-publisher-'));
 try{
  const {read,write}=createPublicationFiles(folder);
  const record={entries:[{id:'prior',prize:0},{id:'unknown',prize:null}],source:'Epic'};
  write('sample.json',record);
  assert.equal(fs.readFileSync(path.join(folder,'sample.json'),'utf8'),
   JSON.stringify(record,null,2)+'\n');
  assert.deepEqual(read('sample.json'),record);
  assert.equal(read('sample.json').entries[1].prize,null,
   'unknown cash must never be converted to a guessed $0');
 }finally{fs.rmSync(folder,{recursive:true,force:true})}
});
function verifiedFixture(){
 const spec={date:'2026-09-11',region:'NAC',season:'S42',event:'S42_DemoCup',
  window:'S42_DemoCup_Event1Round1_NAC',tournamentId:'demo-s42'};
 const row={id:'auto-s42-123456789abc',date:spec.date,region:spec.region,seasonId:spec.season,
  tournamentId:spec.tournamentId,event:'Demo Cup',player:'A / B',players:['A','B'],
  rank:4,points:210,kills:5,vrs:1,matches:6,verified:true,
  source:'https://www.fortnite.com/competitive/events/'+spec.event+'/?region=NAC&round='+spec.window};
 const key='epicgames_'+spec.event+'_'+spec.region+'/'+spec.window;
 const schedule={eventId:spec.event,sourceWindowId:spec.window,dateJst:spec.date,
  region:spec.region,tournamentId:spec.tournamentId,seasonId:spec.season};
 const d={results:[],players:{confirmedAliases:{}},
  scans:{history:{windows:{[key]:{rankingOrderValid:true,nextPage:2,lastSeenRank:100,proposals:[{...row}]}}},
   auto:{windows:{}}},calendar:{'2026-09':[schedule]}};
 const context={
  requireValid:(okay,message)=>{if(!okay)throw Error(message)},
  catalog:new Map([[spec.tournamentId,{name:row.event,seasonId:spec.season,team:'duo',sourceEventIds:[spec.event]}]]),
  known:new Set(['A','B']),d,
  read:()=>{throw Error('calendar should already be available')},
  resultIds:new Set(),approvedIds:new Set(),
  equalCandidate:(left,right)=>JSON.stringify(left)===JSON.stringify(right),
  collision:()=>false
 };
 return {row,spec,context};
}
test('共通公式検証は両ラウンドと同じEpic本人ID・公式開催枠・順位表を要求する',()=>{
 const {row,spec,context}=verifiedFixture();
 assert.equal(verifyEpicReviewEvidence(row,spec,context),undefined);
 const src=fs.readFileSync(path.join(__dirname,'../scripts/reviewed-publication-core.cjs'),'utf8');
 assert.match(src,/rankingOrderValid===true/);
 assert.match(src,/equalCandidate\(x,r\)/);
 assert.match(src,/sourceWindowId===spec\.window/);
 for(const filename of ['publish-verified-nov11-round2.cjs','publish-verified-nov11-round3.cjs']){
  const s=fs.readFileSync(path.join(__dirname,'../scripts',filename),'utf8');
  assert.match(s,/verifyEpicReviewEvidence\(r,spec,/);
  assert.match(s,/function classify\(r,spec\)/,'event-specific classification must be preserved');
 }
});
test('公式検証は偽サイト・同名チーム・順位改変・未確認の開催枠を拒否する',()=>{
 {
  const {row,spec,context}=verifiedFixture();
  assert.throws(()=>verifyEpicReviewEvidence({...row,source:row.source.replace('www.fortnite.com','fake.invalid')},spec,context),/official event URL differs/);
 }
 {
  const {row,spec,context}=verifiedFixture();
  assert.throws(()=>verifyEpicReviewEvidence({...row,players:['A','A'],player:'A / A'},spec,context),/team Epic ID roster unverified/);
 }
 {
  const {row,spec,context}=verifiedFixture();
  assert.throws(()=>verifyEpicReviewEvidence({...row,rank:10},spec,context),/Epic-ID leaderboard rank\/score did not match/);
 }
 {
  const {row,spec,context}=verifiedFixture();
  context.d.calendar['2026-09']=[];
  assert.throws(()=>verifyEpicReviewEvidence(row,spec,context),/official calendar date or region mismatch/);
 }
 {
  const {row,spec,context}=verifiedFixture();
  context.d.scans.history.windows[Object.keys(context.d.scans.history.windows)[0]].rankingOrderValid=false;
  assert.throws(()=>verifyEpicReviewEvidence(row,spec,context),/Epic-ID leaderboard rank\/score did not match/);
 }
});
test('公式検証は既存IDの再掲載と同日同大会のチーム重複を拒否する',()=>{
 {
  const {row,spec,context}=verifiedFixture();
  context.approvedIds.add(row.id);
  assert.throws(()=>verifyEpicReviewEvidence(row,spec,context),/previously approved ID/);
 }
 {
  const {row,spec,context}=verifiedFixture();
  context.d.results=[{...row,id:'another-verified-id'}];
  context.collision=()=>true;
  assert.throws(()=>verifyEpicReviewEvidence(row,spec,context),/overlapping existing achievement/);
 }
});
test('既存掲載履歴は人数連動タイトル・説明の再計算を共通化し再掲載しない',()=>{
 const row={id:'batch',date:'2026-11-11',title:'Previous',description:'Old',
  recordIds:['a','b']};
 const updates={entries:[row]};
 const outcome=upsertPublicationLog(updates,{id:'batch',date:'2026-11-12',title:'New',
  description:'New',recordIds:['b','c'],
  existingTitle:n=>'公開済み '+n+'件',existingDescription:n=>'確認済み '+n+'件'});
 assert.equal(outcome,row);
 assert.deepEqual(row.recordIds,['a','b','c']);
 assert.equal(row.title,'公開済み 3件');
 assert.equal(row.description,'確認済み 3件');
 assert.equal(row.date,'2026-11-11');
 upsertPublicationLog(updates,{id:'batch',recordIds:['c']});
 assert.equal(updates.entries.length,1);
 assert.deepEqual(row.recordIds,['a','b','c']);
});
