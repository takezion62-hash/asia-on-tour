'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));

test('historical calendar month archive is complete, unique and source-only',()=>{
 const index=read('calendar-history-index.json');
 assert.equal(index.version,1);
 assert.ok(Array.isArray(index.months)&&index.months.length>0);
 const regions=new Set(['ME','EU','NAC','NAW','OCE','BR']);
 const ids=new Set(),dates=[];
 let total=0;
 for(const entry of index.months){
  assert.match(entry.month,/^\d{4}-\d{2}$/);
  assert.ok(Number.isSafeInteger(entry.count)&&entry.count>0);
  const month=read('calendar-history/'+entry.month+'.json');
  assert.equal(month.version,1);
  assert.equal(month.month,entry.month);
  assert.ok(Array.isArray(month.sessions));
  assert.equal(month.sessions.length,entry.count,entry.month+' count mismatch');
  for(const s of month.sessions){
   assert.equal(s.dateJst.slice(0,7),entry.month);
   assert.ok(regions.has(s.region));
   assert.ok(typeof s.name==='string'&&s.name.trim().length>=3);
   assert.ok(typeof s.id==='string'&&!ids.has(s.id),'duplicate historical window: '+s.id);
   ids.add(s.id);
   assert.equal('players' in s,false);
   assert.equal('prize' in s,false);
   assert.equal('rank' in s,false);
   const start=Date.parse(s.startUtc),end=Date.parse(s.endUtc);
   assert.ok(Number.isFinite(start)&&Number.isFinite(end)&&start<=end);
   assert.equal(new Date(start+9*3600000).toISOString().slice(0,10),s.dateJst);
   const source=new URL(s.url);
   assert.equal(source.protocol,'https:');
   assert.equal(source.hostname,'www.fortnite.com');
   assert.equal(source.searchParams.get('region'),s.region);
   assert.equal(source.searchParams.get('round'),s.sourceWindowId);
   dates.push(s.dateJst);
  }
  total+=month.sessions.length;
 }
 assert.equal(total,index.total);
 assert.equal(ids.size,index.total);
 assert.equal(dates.reduce((a,b)=>a<b?a:b),index.fromDate);
 assert.equal(dates.reduce((a,b)=>a>b?a:b),index.toDate);
});
