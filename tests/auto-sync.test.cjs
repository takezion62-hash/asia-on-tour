'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepare,applyProposals}=require('../scripts/auto-sync-core.cjs');
const a='a'.repeat(32),b='b'.repeat(32),c='c'.repeat(32);
const setup=()=>({data:{results:[],players:{candidates:[{name:'A'},{name:'B'}]},tournaments:{catalog:[{id:'cup',name:'Solo Victory Cup Battle Royale',sourceEventIds:['S43_SoloVictoryCup'],seasonId:'S43',chapter:7,season:5,team:'solo'}]},updates:{entries:[]}},config:{version:1,accounts:[{player:'A',epicAccountId:a,confirmed:true},{player:'B',epicAccountId:b,confirmed:true}],windows:[{eventId:'S43_SoloVictoryCup',windowId:'S43_SoloVictoryCup_Event1Round1_NAW',dateJst:'2026-11-15',region:'NAW',seasonId:'S43',tournamentId:'cup',kind:'予選',round:'Event 1 · Round 1 / 予選'}]}});
const entry=(id,other={})=>({eventId:'S43_SoloVictoryCup',windowId:'S43_SoloVictoryCup_Event1Round1_NAW',teamAccountIds:[id],rank:35,points:240,kills:5,vrs:1,matches:8,...other});
test('verified Epic ID only and zero cash for qualifier',()=>{const{data,config}=setup();const x=prepare({entries:[entry(a,{prize:100,cashVerified:true}),entry(c)]},config,data);assert.equal(x.proposals.length,1);assert.equal(x.skipped.length,1);assert.equal(x.proposals[0].prize,0)});
test('idempotent and preserves old data',()=>{const{data,config}=setup();const feed={entries:[entry(a)]};const a1=prepare(feed,config,data);assert.equal(applyProposals(data,a1.proposals,'2026-11-15T22:00:00Z'),1);assert.equal(prepare(feed,config,data).proposals.length,0);assert.equal(data.updates.entries[0].recordIds[0],data.results[0].id)});
test('unknown final cash is null, not guessed',()=>{const{data,config}=setup();config.windows[0].kind='賞金決勝';assert.equal(prepare({entries:[entry(a)]},config,data).proposals[0].prize,null)});
test('unverified account and team size rejected',()=>{const{data,config}=setup();assert.throws(()=>prepare({entries:[]},{...config,accounts:[{player:'A',epicAccountId:a,confirmed:false}]},data));assert.equal(prepare({entries:[entry(a,{teamAccountIds:[a,b]})]},config,data).proposals.length,0)});

test('qualifier label changes do not reimport the same player',()=>{
 const {data,config}=setup();
 data.results.push({id:'old',date:'2026-11-15',region:'NAW',tournamentId:'cup',round:'Event 1 · Round 1 / 予選突破',player:'A',rank:35});
 assert.equal(prepare({entries:[entry(a)]},config,data).proposals.length,0);
});
test('same duo with reversed roster does not create another record',()=>{
 const {data,config}=setup();
 config.windows[0].round='Event 1 · Round 1 / 予選';
 data.tournaments.catalog[0].team='duo';
 data.results.push({id:'duo-old',date:'2026-11-15',region:'NAW',tournamentId:'cup',round:'Event 1 · Round 1 / 予選突破',player:'B / A',players:['B','A'],rank:35});
 assert.equal(prepare({entries:[entry(a,{teamAccountIds:[a,b]})]},config,data).proposals.length,0);
});
