'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {init,observe,occupied,registrationPlan,verify,fncsType,evidenceWindows}=require('../scripts/player-discovery.cjs');
const now=Date.parse('2026-11-28T07:00:00Z'),known='a'.repeat(32),unknown='b'.repeat(32);
const data=()=>({players:{candidates:[{name:'Known',epicAccountId:known}],confirmedAliases:{}},results:[]});
const accounts=[{epicAccountId:known,player:'Known'}];
const win=(event,region,date)=>({key:'epicgames_'+event+'_'+region+'/'+event+'_Event1_'+region,eventId:event,windowId:event+'_Event1_'+region,region,dateJst:date});
const normalize=(e)=>({teamAccountIds:e.players.map(p=>p.accountId),rank:1,matches:3,vrs:1});
const entry={players:[{accountId:known,username:'Known'},{accountId:unknown,username:'New'}]};
function fixture(){
 const d=data(),s=init(null,d,now),blocked=occupied(d);
 observe(s,win('S42_Cup','NAW','2026-09-01'),[entry],normalize,accounts,blocked,{now});
 for(const [e,day] of [['S43_FNCS_Solos_Qualifier1','2026-10-01'],['S43_FNCS_Solos_Qualifier2','2026-10-12'],['S43_FNCS_Solos_Heats','2026-10-20']])
  observe(s,win(e,'ASIA',day),[entry],normalize,accounts,blocked,{homeOnly:true,now});
 return {s,d,blocked};
}
test('auto registration requires exact account with foreign evidence and sustained ASIA FNCS',()=>{
 const {s,d}=fixture(),p=registrationPlan(s,d,now);
 assert.equal(p.additions.length,1);assert.equal(p.additions[0].epicAccountId,unknown);
 assert.equal(p.additions[0].epicAccountVerified,true);assert.equal(p.additions[0].autoDiscovery.homeEvidence.length,3);
 d.players.candidates.push(p.additions[0]);assert.equal(registrationPlan(s,d,now).additions.length,0);
});
test('name collisions, foreign FNCS conflict, missing proof, practice are not registered',()=>{
 const x=fixture();x.d.players.confirmedAliases.Known=['new'];assert.equal(registrationPlan(x.s,x.d,now).additions.length,0);
 const y=fixture();observe(y.s,win('S43_FNCS_Solos_Qualifier1','EU','2026-10-01'),[entry],normalize,accounts,y.blocked,{homeOnly:true,now});assert.equal(registrationPlan(y.s,y.d,now).decisions[0].state,'region-conflict');
 const z=fixture();z.s.candidates[0].home.pop();assert.equal(registrationPlan(z.s,z.d,now).additions.length,0);
 assert.equal(fncsType('S42_FNCSDivisionalCup_Division1'),null);assert.equal(fncsType('S43_FNCS_Solos_Practice'),null);
});
test('verification uses at most three shared budget units and stops on 429',async()=>{
 const {s,d,blocked}=fixture();let calls=0;
 const e=(region)=>({eventId:'epicgames_S43_FNCS_Solos_Qualifier1_'+region,eventWindows:[{eventWindowId:'S43_FNCS_Solos_Qualifier1_Event1_'+region,beginTime:'2026-10-01T00:00:00Z',endTime:'2026-10-01T03:00:00Z'}]});
 const opts={getAsia:async()=>{calls++;return [e('ASIA')]},getPage:async()=>{calls++;return {entries:[entry],totalPages:1}},normalize,accounts,blocked,now,budget:3,rateLimit:e=>e.message==='429',recoverable:()=>true};
 const r=await verify(s,[e('EU')],opts);assert.equal(r.attempts,3);assert.equal(calls,3);assert.equal(s.scannedPages,2);
 const y=fixture();calls=0;
 const p=await verify(y.s,[e('EU')],{...opts,getAsia:async()=>{calls++;throw Error('429')}});
 assert.equal(p.rateLimited,true);assert.equal(calls,1);assert.equal(p.attempts,1);
 assert.equal(evidenceWindows([e('ASIA')],now).length,1);
});

test('full candidate queue preserves verified mixed teammates by evicting weak singleton',()=>{
 const d=data(),s=init(null,d,now),blocked=occupied(d);
 for(let i=0;i<500;i++){
  const accountId=(i+1000).toString(16).padStart(32,'0');
  observe(s,win('S42_Cup','NAW','2026-09-01'),[{players:[{accountId,username:'sample'+i}]}],normalize,accounts,blocked,{now});
 }
 assert.equal(s.candidates.length,500);
 observe(s,win('S42_Cup','NAW','2026-09-01'),[entry],normalize,accounts,blocked,{now});
 assert.equal(s.candidates.length,500);assert.ok(s.candidates.some(x=>x.epicId===unknown&&x.foreign[0].knownTeammate));
});
