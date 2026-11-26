'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CHANGES,renamePlayers,renameRow,historicalContext}=require('../scripts/confirmed-player-renames-20261126.cjs');
const old=CHANGES[0][0];
function fixture(){return {candidates:CHANGES.map(([name])=>({name,initials:'X',desc:'historical',accent:'cyan'})),confirmedAliases:{[old]:['old tracker spelling'],'おらんげ':['みかんわおらんげ']}}}
test('all three canonical names, exact aliases and existing profiles migrate idempotently',()=>{
 const input=fixture(),p=renamePlayers(input);
 assert.deepEqual(p.candidates.map(x=>x.name),['gurabon','Lucci','えるやちぇ']);
 assert.deepEqual(p.confirmedAliases.gurabon,['old tracker spelling',old]);
 assert.deepEqual(p.confirmedAliases.Lucci,['みかんわおらんげ','おらんげ']);
 assert.deepEqual(p.confirmedAliases['えるやちぇ'],['ぜろむの弟']);
 assert.deepEqual(renamePlayers(p),p);assert.deepEqual(input,fixture());
});
test('only canonical identity fields change, not raw name, source, rank, prize or IDs',()=>{
 const row={id:'original',player:old+' / おらんげ / ぜろむの弟',players:[old,'おらんげ','ぜろむの弟'],playerRaw:old,profiles:[{name:old,url:'https://example.com/track'},{name:'unrelated',url:'https://example.com/other'}],rank:1,prize:300,prizePerPlayer:100,note:old,teamAccountIds:['id1','id2','id3']};
 const r=renameRow(row);
 assert.equal(r.player,'gurabon / Lucci / えるやちぇ');
 assert.deepEqual(r.players,['gurabon','Lucci','えるやちぇ']);
 assert.equal(r.profiles[0].name,'gurabon');assert.deepEqual(r.profiles[1],row.profiles[1]);
 for(const k of ['id','playerRaw','rank','prize','prizePerPlayer','note','teamAccountIds'])assert.deepEqual(r[k],row[k]);
 assert.deepEqual(renameRow(r),r);
 const p=renamePlayers(fixture()),h=historicalContext({players:p,results:[r],verifiedAccounts:[{player:'gurabon',epicAccountId:'id1',confirmed:true}]});
 assert.deepEqual(renameRow(r,h.reverse),row);
 assert.equal(h.context.verifiedAccounts[0].player,old);
 assert.equal(historicalContext({players:fixture(),results:[],verifiedAccounts:[]}),null);
});
test('do not merge distinct players or reassign aliases',()=>{
 const p=fixture();p.candidates.push({name:'Lucci'});
 assert.throws(()=>renamePlayers(p),/both canonical/);
 const q=fixture();q.confirmedAliases.someone=['gurabon'];
 assert.throws(()=>renamePlayers(q),/conflicting alias/);
});

test('only pinned historic records may replay exact original evidence; tampering fails',()=>{
 const {verifyHistoricalRow}=require('../scripts/confirmed-player-renames-20261126.cjs');
 const p=renamePlayers(fixture());
 const source={id:'owner-s42-nac-mini-20260927-r34',player:old,playerRaw:old,rank:34,prize:50,profileUrl:'https://example.com/original'};
 const changed=renameRow(source),entry={id:source.id};
 const verify=(r,e)=>JSON.stringify(r)===JSON.stringify(source)&&e.id===source.id;
 assert.equal(verifyHistoricalRow(verify,changed,entry,p),true);
 assert.equal(verifyHistoricalRow(verify,{...changed,prize:500},entry,p),false);
 assert.equal(verifyHistoricalRow(verify,{...changed,rank:1},entry,p),false);
 assert.equal(verifyHistoricalRow(verify,{...changed,profileUrl:'https://example.com/other'},entry,p),false);
 assert.equal(verifyHistoricalRow(verify,{...changed,playerRaw:'gurabon'},entry,p),false);
 assert.equal(verifyHistoricalRow(verify,changed,entry,fixture()),false);
 const noAlias=structuredClone(p);noAlias.confirmedAliases.gurabon=[];
 assert.equal(verifyHistoricalRow(verify,changed,entry,noAlias),false);
 assert.equal(verifyHistoricalRow(verify,{...changed,id:'unrelated-id'},entry,p),false);
});
