'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateUpdateLog}=require('../scripts/validate-updates.cjs');
const folder=path.join(__dirname,'..');
const results=JSON.parse(fs.readFileSync(path.join(folder,'results.json'),'utf8'));
const log=JSON.parse(fs.readFileSync(path.join(folder,'updates.json'),'utf8'));
const clone=()=>structuredClone(log);
test('実登録履歴は存在する戦績IDを重複なく参照する',()=>{
  assert.deepEqual(validateUpdateLog(results,log),[]);
  const all=log.entries.filter(e=>e.type==='records').flatMap(e=>e.recordIds);
  assert.equal(all.length,new Set(all).size);
  assert.ok(all.length>0&&all.length<results.length);
});
test('架空の新着ID・二重登録・日付の順序違いを検出する',()=>{
  let value=clone();value.entries.find(e=>e.type==='records').recordIds.push('unknown-record');
  assert.ok(validateUpdateLog(results,value).some(m=>m.includes('存在しない')));
  value=clone();value.entries.find(e=>e.type==='records').recordIds.push(value.entries.find(e=>e.type==='records').recordIds[0]);
  assert.ok(validateUpdateLog(results,value).some(m=>m.includes('重複')));
  value=clone();value.entries[0].date='2020-01-01';
  assert.ok(validateUpdateLog(results,value).some(m=>m.includes('新しい順')));
});
