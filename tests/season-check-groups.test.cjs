'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {seasonCheckGroups}=require('./season-check-groups.cjs');

test('every known season and all-time scope is checked exactly once in bounded groups',()=>{
 const ids=Array.from({length:21},(_,i)=>'S'+(20+i));
 const groups=seasonCheckGroups([...ids,'S25','S30','all'],4);
 assert.equal(groups.length,6);
 assert.ok(groups.every(g=>g.length>0&&g.length<=4));
 const flattened=groups.flat();
 assert.deepEqual(flattened,[...ids,'all']);
 assert.equal(new Set(flattened).size,flattened.length);
 assert.deepEqual(groups.at(-1),['all']);
});

test('unknown seasons and a newly added season remain in exhaustive test coverage',()=>{
 const groups=seasonCheckGroups(['S41','unknown','S43','S44','all','S41'],3);
 assert.deepEqual(groups,[['S41','unknown','S43'],['S44','all']]);
});

test('small or empty histories still check all-time safely',()=>{
 assert.deepEqual(seasonCheckGroups([],4),[['all']]);
 assert.deepEqual(seasonCheckGroups(['S43','all'],4),[['S43','all']]);
 assert.deepEqual(seasonCheckGroups(['all'],1),[['all']]);
});

test('invalid grouping configuration fails closed rather than hiding a season',()=>{
 assert.throws(()=>seasonCheckGroups(['S43'],0),/Invalid/);
 assert.throws(()=>seasonCheckGroups(['S43'],21),/Invalid/);
 assert.throws(()=>seasonCheckGroups(['S43',null],4),/Invalid/);
 assert.throws(()=>seasonCheckGroups('S43',4),/Invalid/);
});
