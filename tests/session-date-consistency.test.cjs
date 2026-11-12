'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const records=require('./production-results.cjs');
const historyDir=path.join(root,'calendar-history');
const windows=new Map();
for(const filename of fs.readdirSync(historyDir).filter(x=>/^20\d{2}-\d{2}\.json$/.test(x))){
 for(const session of read('calendar-history/'+filename).sessions){
  const key=session.sourceWindowId+'|'+session.region;
  if(!windows.has(key))windows.set(key,session.dateJst);
 }
}
test('Epic window dates and displayed AOT result dates use the same JST day',()=>{
 let checked=0;
 for(const record of records){
  const m=String(record.source||'').match(/[?&](?:window|round)=([^&#]+)/);
  if(!m)continue;
  const date=windows.get(decodeURIComponent(m[1])+'|'+record.region);
  if(!date)continue;
  checked++;
  assert.equal(record.date,date,record.id+' must match the official JST window');
 }
 assert.ok(checked>=1000,'Expected a substantial set of official window-linked records');
});
test('manual-verified Sept NAC finalist is not duplicated by auto-approved archive',()=>{
 const names=['blaze','KAME','ダグトリオ大将fv','AMA-Crow'];
 for(const name of names){
  const subset=records.filter(r=>r.date==='2026-09-14'&&r.region==='NAC'
     &&r.tournamentId==='ch7s4-solo-victory-cup'&&r.player===name
     &&/Event 2 · Round 2/.test(r.round));
  assert.equal(subset.length,1,name+' one 2026/09/14 final appearance');
  assert.equal(subset[0].prize,0);
 }
});
