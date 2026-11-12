'use strict';
// Regression guard for the manually evidence-verified 2026-11-12 publication batch.
// Frozen tournament identities are tracked, without asserting that actual payments occurred.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
const results=read('results.json'),approved=read('approval-history.json'),reviewed=read('history-sync-reviewed.json');
const pending=read('history-sync-review.json').proposals;
const expected=['auto-s31-8fe9cea087bf','auto-s31-5f4f59c082d7','auto-s30-38edc2a4468e',
  'auto-s30-622ff6c2a448','auto-s30-5c100d6d95dc','auto-s30-64b28e27dafc',
  'auto-s30-399aecb49618','auto-s30-1662db26699a','auto-s30-a5c983fd5b90',
  'auto-s30-34e8e847274a','auto-s30-c8b9b18b2b58','auto-s31-8e50853183b3',
  'auto-s31-c3e1baa00d50','auto-s31-46721304168e','auto-s31-8effe69ec336',
  'auto-s31-be3f7178669c','auto-s31-9ee5af459903','auto-s31-4df46aeebbaf'];
const attendance=[{id:'auto-s36-8ed10eb27786',date:'2025-07-25',name:'なずな'},
  {id:'auto-s42-b57ae47b3a23',date:'2026-09-15',name:'Rise / 3peace'}];
test('2024 official qualifiers retain zero cash and the separately evidenced $100 final',()=>{
  assert.equal(new Set(expected).size,18);
  const rows=results.filter(x=>expected.includes(x.id));
  assert.equal(rows.length,18);
  const qualifiers=rows.filter(x=>x.id!=='auto-s31-8fe9cea087bf');
  assert.equal(qualifiers.length,17);
  for(const r of qualifiers){
    assert.equal(r.verified,true);
    assert.equal(r.kind,'予選');
    assert.match(r.round,/予選突破/);
    assert.equal(r.prize,0);
  }
  const final=rows.find(x=>x.id==='auto-s31-8fe9cea087bf');
  assert.deepEqual([final.player,final.date,final.region,final.rank,final.points,final.kills,final.vrs,final.prize],
    ['ちゃる','2024-10-08','NAC',257,100,2,1,100]);
  assert.match(final.note,/受賞資格|支払/);
});
test('all twenty evidence decisions are audited, with no duplicate result or cash for attendance',()=>{
  const allIds=[...expected,...attendance.map(x=>x.id)];
  const recorded=new Set(results.map(x=>x.id));
  assert.equal(recorded.size,results.length,'no duplicate canonical result IDs');
  const reviewedIds=new Set(reviewed.entries.map(x=>x.id));
  const approvedIds=new Set(approved.entries.filter(x=>x.decision==='published').map(x=>x.id));
  for(const id of allIds){
    assert.equal(pending.some(x=>x.id===id),false,id+' remains pending');
    assert.ok(reviewedIds.has(id),id+' missing reviewed evidence');
  }
  for(const id of expected)assert.ok(approvedIds.has(id),id+' missing approval ledger');
  for(const item of attendance){
    assert.equal(recorded.has(item.id),false,'attendance included as prize results');
    const archive=read('participation/'+item.date.slice(0,7)+'.json').entries;
    assert.ok(archive.some(x=>x.date===item.date&&x.player===item.name&&x.prize===null),item.name+' attendance not found');
  }
});
test('generated season index includes all published records',()=>{
  const manifest=read('season-data/manifest.json');
  assert.equal(manifest.total,results.length);
  assert.equal(manifest.scopes.all.count,results.length);
  for(const id of ['S30','S31']){
    assert.equal(read('season-data/'+id+'.json').length,manifest.scopes[id].count);
  }
});
