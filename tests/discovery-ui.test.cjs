'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../discovery.js');

const project=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(project,name),'utf8');

test('discovery scripts load before app and new navigation targets exist',()=>{
  const html=read('index.html');
  const source=html.indexOf('src="./discovery.js?');
  const ui=html.indexOf('src="./discovery-ui.js?');
  const app=html.indexOf('src="./app.js?');
  assert.ok(source>0&&ui>source&&app>ui);
  for(const id of ['page-search','quickfind-query','quickfind-date','quickfind-region','quickfind-favorites','quickfind-results','favorites-only'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('data-page="search"'));
  assert.ok(html.includes('discovery-ui.css'));
  assert.doesNotThrow(()=>new vm.Script(read('discovery-ui.js'),{filename:'discovery-ui.js'}));
  assert.doesNotThrow(()=>new vm.Script(read('app.js'),{filename:'app.js'}));
});

test('search matches event, date, region and canonical player or confirmed alias together',()=>{
  const row={date:'2026-09-22',region:'ME',event:'Solo Victory Cup',player:'3peace',round:'予選',kind:'予選'};
  const options={tournament:{name:'Solo Victory Cup',series:'victory-cup'},aliases:{'3peace':['Three Peace']}};
  assert.equal(core.matchRecord(row,{q:'Victory ME 2026/09/22 Three'},options),true);
  assert.equal(core.matchRecord(row,{q:'Victory NAC Three'},options),false);
  assert.equal(core.matchRecord(row,{q:'Victory Three',region:'EU'},options),false);
  assert.equal(core.matchRecord(row,{q:'Victory Three',date:'2026-09-23'},options),false);
  assert.equal(core.matchRecord(row,{q:'Victory',player:'Three'},options),true);
  assert.equal(core.matchRecord(row,{q:'Victory',player:'different'},options),false);
});

test('favorite IDs are exact known canonical players, not aliases, and survive storage errors',()=>{
  const players=['3peace','かめてぃん','Yama'];
  const added=core.toggleFavorite([],players[0],players);
  assert.deepEqual(added.items,['3peace']);
  assert.equal(added.changed,true);
  assert.deepEqual(core.toggleFavorite(added.items,'Three Peace',players).items,['3peace']);
  const storage={data:null,getItem(){return this.data},setItem(_k,v){this.data=v;}};
  assert.equal(core.saveFavorites(storage,added.items,players),true);
  assert.deepEqual(core.readFavorites(storage,players),['3peace']);
  assert.deepEqual(core.toggleFavorite(core.readFavorites(storage,players),'3peace',players).items,[]);
  assert.deepEqual(core.readFavorites({getItem(){throw new Error('blocked')}},players),[]);
  assert.equal(core.saveFavorites({setItem(){throw new Error('blocked')}},['3peace'],players),false);
});

test('favorites have a strict limit and selection remains deterministic',()=>{
  const roster=Array.from({length:35},(_,i)=>'player-'+i);
  let values=[];
  for(let i=0;i<30;i++)values=core.toggleFavorite(values,roster[i],roster).items;
  const blocked=core.toggleFavorite(values,roster[30],roster);
  assert.equal(blocked.limit,true);
  assert.equal(blocked.items.length,30);
  const rows=[{player:'player-2'},{player:'player-3'},{player:'player-3'}];
  assert.deepEqual(core.matchingPlayers(rows,roster,['player-2'],5).map(p=>p.name),['player-2','player-3']);
});
