'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8')).catalog;
const begin=app.indexOf('    function isQualifyingParticipation(');
const end=app.indexOf('    // Calendar-only result scope;',begin);
assert.ok(begin>=0&&end>begin);
const {canonicalTournamentRound:round,canonicalTournamentKind:kind}=vm.runInNewContext(
 '(function(){'+app.slice(begin,end)+';return {canonicalTournamentRound,canonicalTournamentKind}})()',
 {tournamentCatalog:catalog,URL,all:()=>[],classifyTournamentRecord:r=>({id:r.tournamentId})});
const source=(event,window,region)=>'https://www.fortnite.com/competitive/events/'+event+'/?region='+region+'&round='+window;
test('legacy PlayStation verified Final window is rendered as one actual cash-final session, not unresolved attendance',()=>{
 const t=catalog.find(x=>x.sourceEventIds?.includes('S30_PlaystationCupZBJune'));
 assert.ok(t&&t.series==='playstation-cup');
 const src=source('S30_PlaystationCupZBJune','S30_PlaystationCupZBJune_Final_OCE','OCE');
 assert.equal(kind('参加確認',t.id,'Final / 参加確認',src),'賞金決勝');
 assert.equal(round('Final / 参加確認','参加確認',t.id,'2024-06-30','OCE',src),'Final / 賞金決勝');
 assert.equal(kind('賞金決勝',t.id,'Final / 賞金決勝',src),'賞金決勝');
 assert.equal(round('Final / 賞金決勝','賞金決勝',t.id,'2024-06-30','OCE',src),'Final / 賞金決勝');
});
test('unlabeled PlayStation Final stage is backed by an actual Final source, not assumed from participation',()=>{
 const t=catalog.find(x=>x.sourceEventIds?.includes('S33_PlaystationCup'));
 assert.ok(t&&t.series==='playstation-cup');
 const src=source('S33_PlaystationCup','S33_PlaystationCupFinal_ME','ME');
 assert.equal(kind('参加確認',t.id,'単一開催枠 / 参加確認',src),'賞金決勝');
 assert.equal(round('単一開催枠 / 参加確認','参加確認',t.id,'2024-12-08','ME',src),'Final / 賞金決勝');
});
test('qualifier participation remains a qualifier and ambiguous single-session Nvidia is not invented as a final',()=>{
 const ps=catalog.find(x=>x.sourceEventIds?.includes('S30_PlaystationCupZBJune'));
 const q=source('S30_PlaystationCupZBJune','S30_PlaystationCupZBJune_Qualifier1_OCE','OCE');
 assert.equal(kind('参加確認',ps.id,'Qualifier 1 / 参加確認',q),'予選');
 assert.equal(round('Qualifier 1 / 参加確認','参加確認',ps.id,'2024-05-30','OCE',q),'Qualifier 1 / 予選');
 const nv=catalog.find(x=>x.sourceEventIds?.includes('S39_NvidiaCup'));
 assert.ok(nv);
 const s=source('S39_NvidiaCup','S39_NvidiaCup_NAW','NAW');
 assert.equal(kind('参加確認',nv.id,'単一開催枠 / 参加確認',s),'参加確認');
 assert.equal(round('単一開催枠 / 参加確認','参加確認',nv.id,'2025-12-22','NAW',s),'単一開催枠 / 参加確認');
});
test('Victory Cup Round1 and Round2 stay in distinct stages even when both were saved attendance-only',()=>{
 const t=catalog.find(x=>x.id==='ch5s3-zb-solo-victory');
 assert.ok(t);
 const e='S30_SoloZBVictoryCashCup';
 const src1=source(e,e+'_Event5Round1_NAC','NAC'),src2=source(e,e+'_Event5Round2_NAC','NAC');
 assert.equal(kind('参加確認',t.id,'Event 5 · Round 1 / 参加確認',src1),'予選');
 assert.equal(kind('参加確認',t.id,'Event 5 · Round 2 / 参加確認',src2),'賞金決勝');
 assert.equal(round('Event 5 · Round 2 / 参加確認','参加確認',t.id,'2024-07-16','NAC',src2),'Event 5 · Round 2 / 賞金決勝');
});
