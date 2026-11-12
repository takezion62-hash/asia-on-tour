'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const results = require('./production-results.cjs');
const expected = [
  ['manual-s32-me-trios-final-20241124-rank16',16,89,6,5,0,300,3],
  ['manual-s32-me-trios-final-20241124-rank19',19,64,6,5,0,300,3],
  ['manual-s32-me-trios-final-20241117-rank21',21,60,6,6,0,300,3],
  ['manual-s30-me-squads-final-20240812-rank8',8,100,3,20,1,400,4],
  ['manual-s30-me-squads-final-20240812-rank10',10,100,3,15,1,400,4],
  ['manual-s30-me-squads-final-20240812-rank18',18,0,2,25,0,0,4],
  ['manual-s30-me-squads-final-20240812-rank41',41,0,3,20,0,0,4]
];
test('2024 ME screenshot-verified finals are each present once with exact results', () => {
  let totalPrize=0;
  for (const [id,rank,points,matches,kills,vrs,prize,rosterSize] of expected) {
    const matchesById = results.filter(x=>x.id===id);
    assert.equal(matchesById.length, 1, id + ' must occur once');
    const r=matchesById[0];
    assert.equal(r.region,'ME');
    assert.equal(r.rank,rank);
    assert.equal(r.points,points);
    assert.equal(r.matches,matches);
    assert.equal(r.kills,kills);
    assert.equal(r.vrs,vrs);
    assert.equal(r.prize,prize);
    assert.equal(r.players?.length,rosterSize);
    assert.equal(r.profiles?.length,rosterSize);
    if(prize) assert.equal(r.prizePerPlayer,100);
    totalPrize+=r.prize;
  }
  assert.equal(totalPrize,1700);
});
test('previously confirmed 2024 ME squads result remains intact', () => {
  assert.ok(results.some(r=>r.id==='auto-s30-75127cb7684f'&&r.prize===800&&r.vrs===2));
});
