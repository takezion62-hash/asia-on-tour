'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const engine=require('../achievements.js');
const records=JSON.parse(fs.readFileSync(path.join(__dirname,'..','results.json'),'utf8'));

const fixture=(id,overrides={})=>({
  id,date:'2026-09-01',player:'Hero',region:'ME',event:'Solo Victory Cup Battle Royale',
  kind:'予選',round:'Round 1',rank:55,verified:true,vrs:0,prize:null,...overrides
});
const unlocked=(result,id)=>result.achievements.find(a=>a.id===id);

test('award catalog has stable unique IDs, valid goals and deterministic ordering',()=>{
  assert.equal(engine.CATALOG.length,19);
  assert.equal(new Set(engine.CATALOG.map(a=>a.id)).size,engine.CATALOG.length);
  assert.ok(engine.CATALOG.every(a=>a.goal>0&&a.title&&a.description&&a.tier));
  const rows=[fixture('one'),fixture('two',{region:'NAC'})];
  assert.deepEqual(engine.calculate(rows,'Hero').achievements,engine.calculate(rows,'Hero').achievements);
});

test('only verified exact roster membership counts; false aliases and no records do not award',()=>{
  const rows=[
    fixture('unverified',{verified:false,vrs:99,prize:9999,kind:'賞金決勝',rank:1}),
    fixture('reported',{verified:false,reported:true,vrs:1}),
    fixture('someone-else',{player:'NotHero',playerRaw:'Hero',verified:true,prize:100,vrs:3}),
    fixture('actual',{player:'Hero',verified:true,vrs:null}),
    fixture('team',{player:'Hero / Partner',players:['Hero','Partner'],verified:true,region:'NAW',vrs:1})
  ];
  const data=engine.calculate(rows,'Hero');
  assert.equal(data.metrics.records,2);
  assert.equal(data.metrics.regions,2);
  assert.equal(data.metrics.vrs,1);
  assert.equal(data.metrics.paidEvents,0);
  assert.equal(unlocked(data,'first-trip').unlocked,true);
  assert.equal(unlocked(data,'first-vr').unlocked,true);
  assert.equal(unlocked(data,'first-cash').unlocked,false);
  assert.equal(engine.calculate(rows,'Hero (different)').earned,0);
  assert.equal(engine.calculate(rows,'').earned,0);
  assert.equal(engine.calculate(rows,'Partner').metrics.records,1);
});

test('verified cash is credited individually and only for valid split amounts',()=>{
  const rows=[
    fixture('qual',{prize:100,kind:'予選'}),
    fixture('skin',{prize:100,kind:'スキン大会'}),
    fixture('unverified',{verified:false,prize:200,kind:'賞金決勝'}),
    fixture('solo',{prize:100,kind:'賞金決勝'}),
    fixture('duo',{players:['Hero','Pair'],prize:800,prizePerPlayer:400,kind:'賞金決勝'}),
    fixture('unknown',{players:['Hero','Pair'],prize:600,kind:'賞金決勝'}),
    fixture('invalid',{players:['Hero','Pair'],prize:500,prizePerPlayer:300,kind:'賞金決勝'})
  ];
  const result=engine.calculate(rows,'Hero');
  assert.equal(result.metrics.cash,500);
  assert.equal(result.metrics.paidEvents,2);
  assert.equal(unlocked(result,'first-cash').unlocked,true);
  assert.equal(unlocked(result,'cash-500').unlocked,true);
  assert.equal(unlocked(result,'cash-hunter').unlocked,false);
  assert.equal(engine.calculate(rows,'Pair').metrics.cash,400);
  assert.equal(engine.individualCash(rows[5]),0);
  assert.equal(engine.individualCash(rows[6]),0);
});

test('skin titles require explicit award; verified finals and VR stay independent',()=>{
  const rows=[
    fixture('cosmetic',{kind:'スキン大会',round:'Session 1 / 参加',rank:1,vrs:2}),
    fixture('reward',{kind:'スキン大会',round:'Session 2 / スキン獲得',rank:70,vrs:1}),
    fixture('fake-reward',{kind:'スキン大会',round:'Session 3 / スキン獲得',verified:false,vrs:5}),
    fixture('qual-top1',{kind:'予選',rank:1}),
    fixture('final',{kind:'賞金決勝',rank:8}),
    fixture('unknown-final',{kind:'賞金決勝',rank:1,verified:false})
  ];
  const result=engine.calculate(rows,'Hero');
  assert.equal(result.metrics.skins,1);
  assert.equal(result.metrics.finals,1);
  assert.equal(result.metrics.topTens,1);
  assert.equal(result.metrics.vrs,3);
  assert.equal(unlocked(result,'top-ten').unlocked,true);
  assert.equal(unlocked(result,'skin-earned').unlocked,true);
  assert.equal(unlocked(result,'vr-five').unlocked,false);
  assert.equal(engine.confirmedSkin(rows[0]),false);
  assert.equal(engine.confirmedSkin(rows[1]),true);
});

test('six confirmed regions unlock world traveler and highest-priority player title',()=>{
  const rows=engine.REGIONS.map((region,i)=>fixture('region-'+i,{region}));
  const data=engine.calculate(rows,'Hero');
  assert.equal(data.metrics.regions,6);
  assert.equal(unlocked(data,'three-regions').unlocked,true);
  assert.equal(unlocked(data,'six-regions').unlocked,true);
  assert.equal(data.title.id,'six-regions');
  assert.equal(data.visitedRegions.length,6);
  assert.equal(data.achievements.filter(a=>a.unlocked).length,data.earned);
  assert.equal(unlocked(data,'traveler-10').remaining,4);
});

test('real published archive remains immutable; roster-based calculation matches independently filtered rows',()=>{
  const snapshot=JSON.stringify(records);
  const names=[...new Set(records.flatMap(row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player]).filter(Boolean))];
  assert.ok(names.length>50,'real published players were loaded');
  for(const name of names){
    const expected=records.filter(row=>row.verified===true&&(Array.isArray(row.players)&&row.players.length?row.players:[row.player]).includes(name));
    const result=engine.calculate(records,name);
    assert.equal(result.metrics.records,expected.length,name);
    assert.equal(result.achievements.length,result.total,name);
    assert.equal(result.earned,result.unlocked.length,name);
    assert.equal(result.metrics.regions,new Set(expected.map(row=>row.region).filter(r=>engine.REGIONS.includes(r))).size,name);
  }
  assert.equal(JSON.stringify(records),snapshot,'no published result was changed');
});


test('six evolving badge tracks have five strictly increasing rank goals',()=>{
  assert.equal(engine.VERSION,8,'eleven secret achievements ship engine v8');
  assert.equal(engine.EVOLUTION_TRACKS.length,6);
  assert.deepEqual(engine.EVOLUTION_TIERS.map(t=>t.id),['bronze','silver','gold','platinum','prismatic']);
  assert.equal(new Set(engine.EVOLUTION_TRACKS.map(t=>t.id)).size,6);
  for(const track of engine.EVOLUTION_TRACKS){
    assert.equal(track.steps.length,5,track.id);
    assert.ok(track.steps.every((step,i)=>step.goal>0&&(!i||step.goal>track.steps[i-1].goal)),track.id);
    assert.deepEqual(track.steps.map(step=>step.tier),engine.EVOLUTION_TIERS.map(t=>t.id));
  }
});
test('legendary rarity promotions keep existing award criteria and 文武両道 stays RARE',()=>{
 const expected={
  'twenty-kills':'破壊神',
  'zero-build-champion':'ゼロビルドの覇者',
  'podium-streak':'表彰台の常連'
 };
 for(const [id,title] of Object.entries(expected)){
  const def=engine.SPECIAL_CATALOG.find(x=>x.id===id);
  assert.ok(def,'Missing existing title '+id);
  assert.equal(def.title,title);
  assert.equal(def.rarity,'legendary');
 }
 const keep=engine.SPECIAL_CATALOG.find(x=>x.id==='skin-and-cash');
 assert.equal(keep.title,'文武両道');
 assert.equal(keep.rarity,'rare');
 assert.equal(engine.SPECIAL_CATALOG.find(x=>x.id==='final-runner-up').rarity,'epic');
 assert.equal(engine.SPECIAL_CATALOG.find(x=>x.id==='no-vr-cash').rarity,'epic');
});

test('no-VR cash earner and finals runner-up are EPIC; achievement conditions stay intact',()=>{
 for(const [id,title] of [
  ['no-vr-cash','勝たずして稼ぐ'],
  ['final-runner-up','あと一歩の英雄']
 ]){
  const def=engine.SPECIAL_CATALOG.find(x=>x.id===id);
  assert.ok(def,id+' must remain in the special title catalog');
  assert.equal(def.title,title);
  assert.equal(def.rarity,'epic');
  assert.equal(def.goal,1);
 }
 const one=fixture('runner',{kind:'賞金決勝',rank:2,prize:100,vrs:0});
 const awarded=engine.calculateSpecial([one],'Hero').achievements;
 const runner=awarded.find(x=>x.id==='final-runner-up');
 const earner=awarded.find(x=>x.id==='no-vr-cash');
 assert.equal(runner?.unlocked,true);
 assert.equal(earner?.unlocked,true);
 assert.equal(runner?.rarity,'epic');
 assert.equal(earner?.rarity,'epic');
});

test('each badge evolves at exact milestones and shows progress only toward next tier',()=>{
  for(const def of engine.EVOLUTION_TRACKS){
    const original=def.steps.map(x=>x.goal);
    for(let level=0;level<=5;level++){
      const value=level===0?0:original[level-1];
      const evolution=engine.calculateEvolution({[def.metric]:value});
      const track=evolution.tracks.find(t=>t.id===def.id);
      assert.equal(track.level,level,def.id+':'+value);
      assert.equal(track.current?.tier||'locked',engine.EVOLUTION_TIERS[level-1]?.id||'locked');
      assert.equal(track.next?.goal||null,original[level]||null);
      assert.equal(track.remaining,level===5?0:original[level]-value);
      assert.equal(track.percent,level===5?100:0);
      if(level>0&&level<5&&original[level]-original[level-1]>1){
        const nextValue=original[level-1]+1;
        const updated=engine.calculateEvolution({[def.metric]:nextValue}).tracks.find(t=>t.id===def.id);
        assert.equal(updated.level,level);
        assert.ok(updated.percent>0&&updated.percent<=100);
      }
    }
    const beyond=engine.calculateEvolution({[def.metric]:original[4]+500}).tracks.find(t=>t.id===def.id);
    assert.equal(beyond.level,5);
    assert.equal(beyond.completed,true);
    assert.equal(beyond.percent,100);
    assert.deepEqual(def.steps.map(x=>x.goal),original,'static milestone thresholds never mutate');
  }
});
test('six-region traveler is prismatic, and highest reached tier selects the representative title',()=>{
  const regions=engine.REGIONS.map((region,i)=>fixture('visited-'+i,{region}));
  const progress=engine.calculate(regions,'Hero').evolution;
  const region=progress.tracks.find(t=>t.id==='regions');
  assert.equal(region.level,5);
  assert.equal(region.current.title,'世界旅行者');
  assert.equal(region.current.tier,'prismatic');
  assert.equal(progress.featured.id,'regions');
  assert.equal(progress.earnedStages,6);
  assert.equal(progress.totalStages,30);
});
test('cash award milestones are dollar totals; team VR counts do not imply individual victories',()=>{
  const earned=engine.calculate([
    fixture('cash',{kind:'賞金決勝',prize:510,rank:21,vrs:0}),
    fixture('team-vr',{kind:'賞金決勝',players:['Hero','Partner'],player:'Hero / Partner',prize:null,rank:50,vrs:5})
  ],'Hero');
  const cash=earned.evolution.tracks.find(t=>t.id==='earnings'),vr=earned.evolution.tracks.find(t=>t.id==='victories');
  assert.equal(cash.level,2);
  assert.equal(cash.value,510);
  assert.equal(cash.next.goal,2000);
  assert.equal(vr.level,2);
  assert.equal(vr.current.title,'VRコレクター');
  assert.equal(earned.metrics.paidEvents,1);
});
test('every real published player gets exactly six evolving tracks without modifying results',()=>{
  const original=JSON.stringify(records);
  const players=[...new Set(records.flatMap(row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player]).filter(Boolean))];
  for(const name of players){
    const result=engine.calculate(records,name);
    const progression=result.evolution;
    assert.equal(progression.tracks.length,6,name);
    assert.equal(progression.totalStages,30);
    assert.equal(progression.earnedStages,progression.tracks.reduce((s,t)=>s+t.level,0),name);
    assert.ok(progression.tracks.every(t=>t.level>=0&&t.level<=5&&t.percent>=0&&t.percent<=100),name);
  }
  assert.equal(JSON.stringify(records),original,'published results are read-only');
});


const special=(rows,id,name='Hero')=>engine.calculateSpecial(rows,name).achievements.find(badge=>badge.id===id);
test('special title catalog includes solo cumulative KILLS and existing titles',()=>{
  assert.equal(engine.SPECIAL_CATALOG.length,31);
  assert.equal(new Set(engine.SPECIAL_CATALOG.map(def=>def.id)).size,31);
  for(const def of engine.SPECIAL_CATALOG){
    assert.ok(['rare','epic','legendary'].includes(def.rarity),def.id);
    assert.ok(def.goal>=1&&def.description&&def.title&&def.icon,def.id);
  }
  assert.equal(engine.SPECIAL_TIERS.legendary.name,'レジェンダリー');
});
test('zero-kill cash: explicit zero KILLS and verified individual cash are both mandatory',()=>{
  const valid=fixture('zero-cash',{kind:'賞金決勝',rank:9,kills:0,prize:100});
  const invalid=[
    fixture('unknown-kills',{kind:'賞金決勝',rank:5,kills:null,prize:500}),
    fixture('reported',{kind:'賞金決勝',rank:6,kills:0,prize:100,verified:false}),
    fixture('skin',{kind:'スキン大会',rank:7,kills:0,prize:100}),
    fixture('team-unsplit',{player:'Hero / Pair',players:['Hero','Pair'],kind:'賞金決勝',kills:0,prize:400}),
    fixture('team-invalid',{player:'Hero / Pair',players:['Hero','Pair'],kind:'賞金決勝',kills:0,prize:400,prizePerPlayer:300})
  ];
  assert.equal(special(invalid,'silent-earner').unlocked,false);
  const win=special([...invalid,valid],'silent-earner');
  assert.equal(win.unlocked,true);
  assert.equal(win.progress,1);
  assert.deepEqual(win.evidence.map(row=>row.id),['zero-cash']);
  const duo=fixture('team-valid',{player:'Hero / Pair',players:['Hero','Pair'],kind:'賞金決勝',kills:0,prize:400,prizePerPlayer:200});
  assert.equal(special([duo],'silent-earner').unlocked,true);
  assert.equal(special([duo],'silent-earner','Pair').unlocked,true);
  assert.equal(special([duo],'silent-earner','NotPair').unlocked,false);
});
test('no-kill VR, one-kill cash and solo 65-kill record cannot infer unknown individual or per-match results',()=>{
  const rows=[
    fixture('zero-vr',{kills:0,vrs:1,kind:'決勝',prize:null}),
    fixture('one-cash',{kills:1,kind:'賞金決勝',prize:100}),
    fixture('killer',{kills:65,kind:'予選'}),
    fixture('unknown-vr',{kills:null,vrs:7}),
    fixture('unverified-kills',{kills:100,verified:false}),
    fixture('no-cash-one',{kills:1,prize:null})
  ];
  for(const id of ['pacifist-vr','one-kill-earner','twenty-kills'])assert.equal(special(rows,id).unlocked,true,id);
  assert.deepEqual(special(rows,'pacifist-vr').evidence.map(e=>e.id),['zero-vr']);
  assert.deepEqual(special(rows,'one-kill-earner').evidence.map(e=>e.id),['one-cash']);
  assert.deepEqual(special(rows,'twenty-kills').evidence.map(e=>e.id),['killer']);
  const notYet=rows.filter(row=>!['zero-vr','one-cash','killer'].includes(row.id));
  for(const id of ['pacifist-vr','one-kill-earner','twenty-kills'])assert.equal(special(notYet,id).unlocked,false,id);
});
test('overseas champion uses verified final rank one; qualifying rank one and VR alone are insufficient',()=>{
  const rows=[
    fixture('qual-first',{kind:'予選',rank:1,vrs:2}),
    fixture('final-not-first',{kind:'賞金決勝',rank:2,vrs:1}),
    fixture('unknown-final',{kind:'賞金決勝',rank:1,verified:false})
  ];
  assert.equal(special(rows,'final-champion').unlocked,false);
  assert.equal(special([...rows,fixture('final-champ',{kind:'賞金決勝',rank:1})],'final-champion').unlocked,true);
});
test('cross-region cash and VR require 3 different supported overseas regions, not 3 events in one region',()=>{
  const cashRows=['ME','EU','NAC'].map((region,i)=>fixture('cash-region-'+i,{region,kind:'賞金決勝',prize:100,vrs:i?0:1}));
  const vrRows=['ME','EU','NAW'].map((region,i)=>fixture('vr-region-'+i,{region,kind:'予選',vrs:1}));
  const sameCash=Array.from({length:3},(_,i)=>fixture('same-'+i,{kind:'賞金決勝',prize:100,vrs:1,region:'ME'}));
  assert.equal(special(sameCash,'cash-three-regions').progress,1);
  assert.equal(special(sameCash,'vr-three-regions').unlocked,false);
  assert.equal(special(cashRows,'cash-three-regions').unlocked,true);
  assert.equal(special(cashRows,'vr-three-regions').unlocked,false);
  assert.equal(special(vrRows,'vr-three-regions').unlocked,true);
  assert.equal(special(vrRows,'cash-three-regions').unlocked,false);
});
test('solo and team payouts, explicit skin reward + cash, and VR + payout in same record unlock combinations',()=>{
  const solo=fixture('solo-paid',{kind:'賞金決勝',prize:200,vrs:0});
  const team=fixture('duo-paid',{player:'Hero / Pair',players:['Hero','Pair'],event:'Reload Duos Cash Cup',kind:'賞金決勝',prize:400,prizePerPlayer:200,vrs:0});
  const skin=fixture('rewarded',{kind:'スキン大会',prize:0,round:'Session 1 / スキン獲得'});
  const both=fixture('double',{kind:'賞金決勝',prize:150,vrs:1});
  assert.equal(special([solo],'solo-and-team-cash').progress,1);
  assert.equal(special([solo,team],'solo-and-team-cash').unlocked,true);
  assert.equal(special([solo,team],'skin-and-cash').unlocked,false);
  assert.equal(special([solo,skin],'skin-and-cash').unlocked,true);
  assert.equal(special([solo,skin],'skin-and-cash').progress,2);
  assert.equal(special([solo,skin],'vr-and-cash').unlocked,false);
  assert.equal(special([both],'vr-and-cash').unlocked,true);
  assert.equal(special([solo,fixture('vr-only',{vrs:1})],'vr-and-cash').unlocked,false);
  const duoUnpaid=fixture('duo-unknown',{player:'Hero / Pair',players:['Hero','Pair'],kind:'賞金決勝',prize:400,prizePerPlayer:null});
  assert.equal(special([solo,duoUnpaid],'solo-and-team-cash').unlocked,false);
});
test('legacy top ten and region specialist survive; report does not mutate evidence rows',()=>{
  const rows=[
    ...Array.from({length:5},(_,i)=>fixture('me-'+i,{region:'ME',kind:i===0?'賞金決勝':'予選',rank:i===0?6:100})),
    fixture('other',{region:'NAC',verified:false,rank:1})
  ];
  const before=JSON.stringify(rows);
  const report=engine.calculateSpecial(rows,'Hero');
  assert.equal(report.total,31);
  assert.equal(report.unlocked.length,2);
  assert.equal(special(rows,'top-ten').unlocked,true);
  assert.equal(special(rows,'specialist-me').unlocked,true);
  assert.equal(special(rows,'specialist-nac').unlocked,false);
  assert.equal(JSON.stringify(rows),before);
});
test('new special titles for every published player are deterministic and read-only',()=>{
  const before=JSON.stringify(records);
  const players=[...new Set(records.flatMap(row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player]).filter(Boolean))];
  for(const player of players){
    const report=engine.calculate(records,player).special;
    assert.equal(report.total,31);
    assert.equal(report.earned,report.unlocked.length,player);
    assert.equal(report.locked.length+report.earned,report.total,player);
    assert.ok(report.achievements.every(a=>a.evidence.length<=(a.id==='solo-and-team-cash'?4:3)&&a.evidence.every(e=>e.id)),player);
    assert.deepEqual(report.achievements.map(a=>a.id),engine.calculateSpecial(records,player).achievements.map(a=>a.id));
  }
  assert.equal(JSON.stringify(records),before,'published results not mutated');
});

test('破壊神 uses precise solo 65 / duo 120 / trio 150 thresholds, including exact boundaries',()=>{
  const cases=[
    {label:'solo',size:1,goal:65,event:'Solo Victory Cup Battle Royale'},
    {label:'duo',size:2,goal:120,event:'Reload Duos Cash Cup'},
    {label:'trio',size:3,goal:150,event:'HamiKuma Cup Battle Royale'}
  ];
  const make=(which,kills)=>fixture(which.label+'-'+kills,{
    event:which.event,kills,kind:'予選',
    ...(which.size===1?{}:{player:['Hero','Pair','Third'].slice(0,which.size).join(' / '),players:['Hero','Pair','Third'].slice(0,which.size)})
  });
  for(const which of cases){
    assert.equal(engine.confirmedKillFormat(make(which,which.goal)),which.label);
    assert.equal(special([make(which,which.goal-1)],'twenty-kills').unlocked,false,which.label+' under threshold');
    const exact=special([make(which,which.goal)],'twenty-kills');
    assert.equal(exact.unlocked,true,which.label+' exact threshold');
    assert.equal(exact.progress,1);
    assert.equal(exact.evidence[0].kills,which.goal);
    assert.equal(exact.evidence[0].killThreshold,which.goal);
    assert.equal(exact.evidence[0].killFormat,which.label);
    assert.equal(special([make(which,which.goal+1)],'twenty-kills').unlocked,true,which.label+' above');
  }
  assert.equal(engine.DESTRUCTION_KILLS.solo,65);
  assert.equal(engine.DESTRUCTION_KILLS.duo,120);
  assert.equal(engine.DESTRUCTION_KILLS.trio,150);
  assert.equal(engine.SPECIAL_CATALOG.find(x=>x.id==='twenty-kills').rarity,'legendary');
  assert.equal(engine.SPECIAL_CATALOG.find(x=>x.id==='vr-and-cash').rarity,'rare');
});
test('破壊神 does not infer team size from incomplete/contradictory entries and rejects unverified KILLS',()=>{
  const bad=[
    fixture('unknown-solo',{event:'Generic Cup',kills:1000}),
    fixture('missing-solo',{event:'Generic Cup',player:'Hero / Unknown',kills:1000}),
    fixture('incomplete-duo',{event:'Reload Duos Cup',player:'Hero',players:['Hero'],kills:150}),
    fixture('unverified',{event:'Solo Victory Cup',kills:200,verified:false}),
    fixture('null',{event:'Solo Victory Cup',kills:null}),
    fixture('many',{event:'HamiKuma Cup',players:['Hero','Pair','Third','Fourth'],kills:200}),
    fixture('dup-roster',{event:'Reload Duos Cup',players:['Hero','Hero'],kills:200})
  ];
  assert.equal(special(bad,'twenty-kills').unlocked,false);
  assert.equal(engine.confirmedKillFormat(bad[0]),null);
  assert.equal(engine.confirmedKillFormat(bad[1]),null);
  // Authoritative tournament catalog exposes a contradiction: 1 listed player in a duo event.
  const catalog=[{name:'Reload Duos Cup',team:'duo'}];
  assert.equal(engine.confirmedKillFormat(bad[2],catalog),null);
  const duo=fixture('contradictory',{event:'Known Solo Cup',players:['Hero','Pair'],player:'Hero / Pair',kills:130});
  assert.equal(engine.confirmedKillFormat(duo,[{name:'Known Solo Cup',team:'solo'}]),null);
  const result=engine.calculateSpecial([duo],'Hero',{catalog:[{name:'Known Solo Cup',team:'solo'}]});
  assert.equal(result.achievements.find(a=>a.id==='twenty-kills').unlocked,false);
});
test('catalog-verified solo events without Solo in title are eligible while ambiguous names are not',()=>{
  const row=fixture('persona',{event:'Override Series: Persona 5 Royal Cup Reload',kills:65});
  assert.equal(engine.confirmedKillFormat(row),null);
  assert.equal(special([row],'twenty-kills').unlocked,false);
  const catalog=[{name:row.event,team:'solo',seasonId:'S42'}];
  assert.equal(engine.confirmedKillFormat(row,catalog),'solo');
  const report=engine.calculateSpecial([row],'Hero',{catalog});
  const badge=report.achievements.find(x=>x.id==='twenty-kills');
  assert.equal(badge.unlocked,true);
  assert.equal(badge.evidence[0].killFormat,'solo');
  assert.equal(engine.calculateSpecial([row],'Hero',{catalog:[...catalog,{...catalog[0],team:'duo'}]}).unlocked.some(x=>x.id==='twenty-kills'),false);
});


test('regional specialist titles evolve cumulatively through 5/10/20/40/80 records without duplicate badge IDs',()=>{
  assert.deepEqual(engine.SPECIALIST_GOALS,[5,10,20,40,80]);
  for(const region of engine.REGIONS){
    for(const count of [0,4,5,9,10,19,20,39,40,79,80,105]){
      const rows=Array.from({length:count},(_,i)=>fixture(region+'-'+i,{region}));
      const badge=special(rows,'specialist-'+region.toLowerCase());
      const goals=[5,10,20,40,80];
      const level=goals.filter(g=>count>=g).length;
      const currentTitle=level===0?region+'スペシャリスト':region+(level===5?'の覇者':engine.SPECIALIST_NAMES[level-1]);
      assert.equal(badge.title,currentTitle,region+' '+count);
      assert.equal(badge.progress,count);
      assert.equal(badge.unlocked,level>0);
      assert.equal(badge.growth.level,level);
      assert.equal(badge.growth.stages.length,5);
      assert.equal(badge.growth.next?.goal||null,goals[level]||null);
      assert.equal(badge.goal,goals[level]||80);
      assert.equal(badge.rarity,level===5?'legendary':level===3||level===4?'epic':'rare');
      assert.equal(badge.growth.remaining,level===5?0:goals[level]-count);
      assert.ok(badge.growth.percent>=0&&badge.growth.percent<=100);
      assert.equal(badge.growth.maxed,level===5);
    }
  }
});
test('cash format specialty evolves 二刀流→三刀流→四刀流 for solo/duo/trio/squad winnings',()=>{
  const cases=[
    fixture('solo-paid',{event:'Solo Victory Cup Battle Royale',kind:'賞金決勝',prize:100}),
    fixture('duo-paid',{event:'Reload Duos Cash Cup',player:'Hero / Pair',players:['Hero','Pair'],kind:'賞金決勝',prize:400,prizePerPlayer:200}),
    fixture('trio-paid',{event:'Trios Cash Cup',player:'Hero / Pair / Third',players:['Hero','Pair','Third'],kind:'賞金決勝',prize:600,prizePerPlayer:200}),
    fixture('squad-paid',{event:'Squads Victory Cup Battle Royale',player:'Hero / Pair / Third / Fourth',players:['Hero','Pair','Third','Fourth'],kind:'賞金決勝',prize:800,prizePerPlayer:200})
  ];
  assert.deepEqual(cases.map(e=>engine.confirmedPrizeFormat(e)),['solo','duo','trio','squad']);
  assert.deepEqual(engine.WEAPON_MILESTONES.map(x=>x.title),['二刀流','三刀流','四刀流']);
  assert.deepEqual(engine.TEAM_FORMATS,['solo','duo','trio','squad']);
  for(let n=0;n<=4;n++){
    const badge=special(cases.slice(0,n),'solo-and-team-cash');
    assert.equal(badge.progress,n);
    assert.equal(badge.growth.level,Math.max(0,n-1));
    assert.equal(badge.unlocked,n>=2);
    assert.equal(badge.title,n===4?'四刀流':n===3?'三刀流':'二刀流');
    assert.equal(badge.rarity,n===4?'legendary':'epic');
    assert.equal(badge.growth.next?.goal||null,n===4?null:Math.max(2,n+1));
    assert.equal(badge.evidence.length,n);
  }
  const four=engine.calculateSpecial(cases,'Hero').achievements.find(x=>x.id==='solo-and-team-cash');
  assert.equal(four.growth.maxed,true);
  assert.equal(four.growth.percent,100);
  assert.deepEqual(four.evidence.map(e=>e.teamFormat),engine.TEAM_FORMATS);
  assert.equal(engine.calculateSpecial(cases,'Pair').achievements.find(x=>x.id==='solo-and-team-cash').progress,3);
});
test('two distinct cash-winning team formats count as 二刀流 even without solo, but repeated one format counts once',()=>{
  const duo=fixture('duo-only',{event:'Duos Cash Cup',player:'Hero / Pair',players:['Hero','Pair'],kind:'賞金決勝',prize:200,prizePerPlayer:100});
  const trio=fixture('trio-only',{event:'Trios Cash Cup',player:'Hero / Pair / Third',players:['Hero','Pair','Third'],kind:'賞金決勝',prize:300,prizePerPlayer:100});
  const duplicate={...duo,id:'duo-repeated'};
  const single=special([duo,duplicate],'solo-and-team-cash');
  assert.equal(single.progress,1);
  assert.equal(single.unlocked,false);
  const twin=special([duo,duplicate,trio],'solo-and-team-cash');
  assert.equal(twin.progress,2);
  assert.equal(twin.unlocked,true);
  assert.equal(twin.title,'二刀流');
  assert.equal(twin.evidence.length,2);
});
test('cash format progression requires verified personal payout, matching season and complete rosters',()=>{
  const solos=fixture('solo',{event:'Solo Cash Cup',kind:'賞金決勝',prize:100});
  const paidUnknown=fixture('unknown',{event:'Ambiguous Cup',kind:'賞金決勝',prize:100});
  const unverified=fixture('unverified',{event:'Solo Victory Cup',verified:false,kind:'賞金決勝',prize:100});
  const noShare=fixture('duo-no-share',{event:'Duos Cup',player:'Hero / Pair',players:['Hero','Pair'],kind:'賞金決勝',prize:400});
  const notPaid=fixture('duo-skin',{event:'Duos Skin Cup',player:'Hero / Pair',players:['Hero','Pair'],kind:'スキン大会',prize:200,prizePerPlayer:100});
  const duplicate=fixture('duo-dup',{event:'Duos Cup',player:'Hero / Hero',players:['Hero','Hero'],kind:'賞金決勝',prize:400,prizePerPlayer:200});
  const contradict=fixture('squad-known-as-duo',{event:'Known Duos Cup',player:'Hero / Pair / Third / Fourth',players:['Hero','Pair','Third','Fourth'],kind:'賞金決勝',prize:400,prizePerPlayer:100});
  assert.equal(engine.confirmedPrizeFormat(paidUnknown),null);
  assert.equal(engine.confirmedPrizeFormat(contradict,[{name:'Known Duos Cup',team:'duo'}]),null);
  const badge=engine.calculateSpecial([solos,paidUnknown,unverified,noShare,notPaid,duplicate,contradict],'Hero',{catalog:[{name:'Known Duos Cup',team:'duo'}]}).achievements.find(b=>b.id==='solo-and-team-cash');
  assert.equal(badge.progress,1);
  assert.equal(badge.unlocked,false);
  assert.deepEqual(badge.evidence.map(e=>e.id),['solo']);
  const override=fixture('verified-by-catalog',{event:'Persona 5 Royal Cup Reload',kind:'賞金決勝',prize:100,seasonId:'S42'});
  assert.equal(engine.confirmedPrizeFormat(override),null);
  assert.equal(engine.confirmedPrizeFormat(override,[{name:override.event,team:'solo',seasonId:'S42'}]),'solo');
  assert.equal(engine.confirmedPrizeFormat(override,[{name:override.event,team:'solo',seasonId:'S41'}]),null);
});

test('solo-only cumulative eliminations unlock five escalating titles using verified session KILLS',()=>{
  const goals=engine.SOLO_KILL_MILESTONES.map(stage=>stage.goal);
  assert.deepEqual(goals,[20,50,100,200,300]);
  assert.deepEqual(engine.SOLO_KILL_MILESTONES.map(stage=>stage.title),
    ['孤独な追跡者','孤高の狩人','戦場の死神','百戦の支配者','孤高の覇王']);
  for(const goal of [0,19,20,49,50,99,100,199,200,299,300,401]){
    const row=fixture('solo-'+goal,{kills:goal});
    const badge=special([row],'solo-kill-mastery');
    const level=goals.filter(value=>goal>=value).length;
    assert.equal(badge.progress,goal);
    assert.equal(badge.unlocked,level>0);
    assert.equal(badge.growth.level,level);
    assert.equal(badge.title,level?engine.SOLO_KILL_MILESTONES[level-1].title:'孤独な追跡者');
    assert.equal(badge.rarity,level===5?'legendary':level>=3?'epic':'rare');
    assert.equal(badge.goal,goals[level]||300);
    assert.equal(badge.growth.remaining,goals[level]?goals[level]-goal:0);
    assert.equal(badge.growth.maxed,level===5);
  }
});
test('solo KILLS sum qualifying and final sessions, never teams, missing kills, unknown formats, or duplicate IDs',()=>{
  const allowed=[
    fixture('solo-qual',{event:'Solo Victory Cup Battle Royale',kills:14,kind:'予選'}),
    fixture('solo-final',{event:'Solo Victory Cup Battle Royale',kills:13,kind:'賞金決勝'}),
    fixture('catalog-solo',{event:'Persona Reload Cup',kills:25,kind:'スキン大会',seasonId:'S42'})
  ];
  const denied=[
    fixture('team-duo',{event:'Duos Cash Cup',player:'Hero / Pair',players:['Hero','Pair'],kills:999}),
    fixture('team-trio',{event:'Trios Cash Cup',player:'Hero / Pair / Third',players:['Hero','Pair','Third'],kills:999}),
    fixture('solo-unverified',{event:'Solo Victory Cup',kills:999,verified:false}),
    fixture('unknown-format',{event:'No Format Cup',kills:999}),
    fixture('no-kills',{event:'Solo Victory Cup',kills:null}),
    fixture('negative-kills',{event:'Solo Victory Cup',kills:-5}),
    fixture('noninteger-kills',{event:'Solo Victory Cup',kills:9.5}),
    fixture('conflicting-catalog',{event:'Registered Duos Cup',kills:999}),
    {...allowed[0]}
  ];
  const catalog=[{name:'Persona Reload Cup',team:'solo',seasonId:'S42'},{name:'Registered Duos Cup',team:'duo'}];
  const report=engine.calculateSpecial([...allowed,...denied],'Hero',{catalog});
  const badge=report.achievements.find(item=>item.id==='solo-kill-mastery');
  assert.equal(badge.progress,52);
  assert.equal(badge.title,'孤高の狩人');
  assert.equal(badge.growth.level,2);
  assert.equal(badge.goal,100);
  assert.deepEqual(badge.evidence.map(e=>e.kills),[25,14,13]);
  assert.ok(badge.evidence.every(row=>row.killFormat==='solo'));
  assert.equal(report.achievements.find(item=>item.id==='twenty-kills').unlocked,true,'破壊神はチーム戦の高キル記録も対象のまま');
  const nonmember=engine.calculateSpecial([...allowed,...denied],'Pair',{catalog}).achievements.find(item=>item.id==='solo-kill-mastery');
  assert.equal(nonmember.progress,0);
  assert.equal(nonmember.unlocked,false);
});


const badge30=(rows,id,catalog=[])=>engine.calculateSpecial(rows,'Hero',{catalog}).achievements.find(x=>x.id===id);
const cashRow=(id,overrides={})=>fixture(id,{
  kind:'賞金決勝',prize:100,vrs:0,kills:2,rank:15,date:'2026-10-01',...overrides
});
test('12 new special awards have stable IDs, rarities and distinct achievement catalog entries',()=>{
  const ids=['final-kill-tyrant','final-runner-up','podium-streak','cash-windfall',
    'cash-chain','same-day-traveler','same-day-cash','reload-regular','no-vr-cash',
    'zero-build-champion','fncs-finalist','seven-day-traveler','triple-format-vr'];
  assert.equal(engine.VERSION,8);
  assert.equal(engine.SPECIAL_CATALOG.length,31);
  assert.equal(new Set(engine.SPECIAL_CATALOG.map(x=>x.id)).size,31);
  for(const id of ids){
    const def=engine.SPECIAL_CATALOG.find(x=>x.id===id);
    assert.ok(def&&def.description&&def.title, id);
    assert.ok(['rare','epic','legendary'].includes(def.rarity),id);
    assert.equal(badge30([],id).unlocked,false,id+' is locked without verified evidence');
  }
});
test('solo final 30K, final runner-up and three distinct podium finals respect exact boundaries',()=>{
  const solo=fixture('solo-final',{kind:'賞金決勝',rank:2,kills:30,date:'2026-11-01'});
  const under={...solo,id:'under',kills:29};
  const team={...solo,id:'duo-90',event:'Reload Duos Victory Cup',player:'Hero / Pair',players:['Hero','Pair'],kills:90};
  const qualifier={...solo,id:'qualifier',kind:'予選',kills:50};
  const unknown={...solo,id:'unknown',event:'Ambiguous Tournament',kills:60};
  assert.equal(badge30([solo],'final-kill-tyrant').unlocked,true);
  assert.equal(badge30([under,team,qualifier,unknown],'final-kill-tyrant').unlocked,false);
  assert.equal(badge30([solo],'final-runner-up').unlocked,true);
  assert.equal(badge30([{...solo,kind:'予選'}, {...solo,id:'third',rank:3}],'final-runner-up').unlocked,false);
  const f1=solo,f2={...solo,id:'f2',date:'2026-11-02',rank:1},f3={...solo,id:'f3',date:'2026-11-03',rank:3};
  const duplicate={...solo,id:'same-day-duplicate',kind:'Practice決勝'};
  assert.equal(badge30([solo,f2,duplicate],'podium-streak').progress,2);
  assert.equal(badge30([solo,f2,f3],'podium-streak').unlocked,true);
  assert.equal(badge30([solo,f2,f3],'podium-streak').progress,3);
  assert.equal(badge30([solo,{...f2,id:'not-verified',verified:false},f3],'podium-streak').unlocked,false);
});
test('single-event windfall uses confirmed personal cash, zero VR cash requires explicit 0',()=>{
  const solo=cashRow('rich',{prize:500});
  const duo=cashRow('duo-rich',{player:'Hero / Pair',players:['Hero','Pair'],event:'Reload Duos Cash Cup',prize:1000,prizePerPlayer:500});
  const teamUnknown={...duo,id:'duo-unknown',prizePerPlayer:null};
  assert.equal(badge30([solo],'cash-windfall').unlocked,true);
  assert.equal(badge30([{...solo,prize:499}],'cash-windfall').unlocked,false);
  assert.equal(badge30([duo],'cash-windfall').unlocked,true);
  assert.equal(badge30([teamUnknown],'cash-windfall').unlocked,false);
  assert.equal(badge30([duo],'cash-windfall').evidence[0].personalCash,500);
  assert.equal(badge30([solo],'no-vr-cash').unlocked,true);
  assert.equal(badge30([{...solo,vrs:null}, {...solo,id:'vr1',vrs:1}],'no-vr-cash').unlocked,false);
  assert.equal(badge30([{...solo,verified:false}],'no-vr-cash').unlocked,false);
});
test('cash chain requires three different cash-paying events within inclusive 30-day date span',()=>{
  const a=cashRow('a',{event:'Cup A',date:'2026-10-01'});
  const b=cashRow('b',{event:'Cup B',date:'2026-10-15'});
  const c=cashRow('c',{event:'Cup C',date:'2026-10-31'});
  assert.equal(badge30([a,b,c],'cash-chain').unlocked,true);
  assert.equal(badge30([a,b,c],'cash-chain').progress,3);
  assert.deepEqual(badge30([a,b,c],'cash-chain').evidence.map(x=>x.id),['a','b','c']);
  assert.equal(badge30([a,b,{...c,date:'2026-11-01'}],'cash-chain').unlocked,false);
  assert.equal(badge30([a,b,{...c,event:'Cup A',date:'2026-10-01'}],'cash-chain').progress,2);
  assert.equal(badge30([a,b,{...c,date:'2026-13-01'}],'cash-chain').progress,2);
  assert.equal(badge30([a,b,{...c,prize:0}],'cash-chain').progress,2);
});
test('two regions on one calendar date count for traveler; cash version requires confirmed payouts in both regions',()=>{
  const a=cashRow('same-me',{date:'2026-10-15',region:'ME'});
  const b=cashRow('same-eu',{date:'2026-10-15',region:'EU'});
  assert.equal(badge30([a,b],'same-day-traveler').unlocked,true);
  assert.equal(badge30([a,b],'same-day-cash').unlocked,true);
  assert.equal(badge30([a,{...b,date:'2026-10-16'}],'same-day-traveler').unlocked,false);
  assert.equal(badge30([a,{...b,date:'2026-10-16'}],'same-day-cash').unlocked,false);
  assert.equal(badge30([a,{...b,region:'ME'}],'same-day-traveler').progress,1);
  assert.equal(badge30([a,{...b,prize:0}],'same-day-cash').progress,1);
  assert.equal(badge30([a,{...b,verified:false}],'same-day-traveler').progress,1);
  assert.equal(badge30([a,{...b,date:'2026-02-30'}],'same-day-traveler').progress,1);
});
test('Reload 10 verified entries respect catalog modes; battle-royale contradictions do not qualify',()=>{
  const ten=Array.from({length:10},(_,i)=>fixture('reload-'+i,{
    event:'Solo Reload Victory Cup',date:'2026-10-'+String(i+1).padStart(2,'0')
  }));
  assert.equal(badge30(ten.slice(0,9),'reload-regular').unlocked,false);
  assert.equal(badge30(ten,'reload-regular').progress,10);
  assert.equal(badge30(ten,'reload-regular').unlocked,true);
  const withDuplicate=[...ten.slice(0,9),{...ten[0]}];
  assert.equal(badge30(withDuplicate,'reload-regular').progress,9);
  const falseMode=[{name:'Solo Reload Victory Cup',team:'solo',mode:'battle-royale'}];
  assert.equal(badge30(ten,'reload-regular',falseMode).progress,0);
  const trueMode=[{name:'Ambiguous Event',team:'solo',mode:'reload-zero-build'}];
  assert.equal(badge30([fixture('catalog',{event:'Ambiguous Event'})],'reload-regular',trueMode).progress,1);
});
test('Zero Build winner and actual FNCS finalist use catalog metadata, not cosmetic cup names',()=>{
  const champ=cashRow('zb',{event:'Console Zero Build Solo Victory Cup',rank:1});
  assert.equal(badge30([champ],'zero-build-champion').unlocked,true);
  assert.equal(badge30([{...champ,kind:'予選'}],'zero-build-champion').unlocked,false);
  assert.equal(badge30([{...champ,rank:2}],'zero-build-champion').unlocked,false);
  assert.equal(badge30([champ],'zero-build-champion',[{name:champ.event,mode:'battle-royale'}]).unlocked,false);
  const event='Cryptic Tournament';
  assert.equal(badge30([cashRow('catalog-zb',{event,rank:1})],'zero-build-champion',
    [{name:event,mode:'reload-zero-build'}]).unlocked,true);
  const fncs=cashRow('fncs',{event:'FNCS Division 1',kind:'Practice決勝',rank:45});
  assert.equal(badge30([fncs],'fncs-finalist').unlocked,true);
  assert.equal(badge30([{...fncs,rank:null}, {...fncs,id:'qual',kind:'予選'}],'fncs-finalist').unlocked,false);
  const skin=cashRow('cosmetic',{event:'Champion Focus FNCS Cup',kind:'決勝',rank:3});
  assert.equal(badge30([skin],'fncs-finalist',[{name:skin.event,series:'skin-cup'}]).unlocked,false);
  assert.equal(badge30([cashRow('real',{event:'Unknown Championship',kind:'決勝',rank:12})],
    'fncs-finalist',[{name:'Unknown Championship',series:'fncs'}]).unlocked,true);
});
test('seven-day traveler needs three distinct regions within seven consecutive calendar dates',()=>{
  const rows=[
    fixture('day-me',{date:'2026-11-01',region:'ME'}),
    fixture('day-eu',{date:'2026-11-04',region:'EU'}),
    fixture('day-nac',{date:'2026-11-07',region:'NAC'})
  ];
  assert.equal(badge30(rows,'seven-day-traveler').progress,3);
  assert.equal(badge30(rows,'seven-day-traveler').unlocked,true);
  assert.equal(badge30([rows[0],rows[1],{...rows[2],date:'2026-11-08'}],
    'seven-day-traveler').unlocked,false);
  assert.equal(badge30([rows[0],rows[1],{...rows[2],region:'ME'}],
    'seven-day-traveler').progress,2);
  assert.equal(badge30([rows[0],rows[1],{...rows[2],verified:false}],
    'seven-day-traveler').progress,2);
});


const secret=(rows,id,catalog=[])=>engine.calculateSecret(rows,'Hero',{catalog}).achievements.find(x=>x.id===id);
const secretPaid=(id,overrides={})=>fixture(id,{
  date:'2026-09-01',kind:'賞金決勝',rank:12,kills:2,vrs:0,prize:100,...overrides
});
test('secret titles have separate 11-item catalog, keep ordinary 31 titles and hide two completely',()=>{
  const ids=['silent-crown','golden-strike','death-coronation','three-world-shadow',
    'triple-gold','six-region-bounty','dual-world-champion','borderless-champion','returning-phoenix',
    'light-and-shadow','double-crown-miracle'];
  assert.equal(engine.VERSION,8);
  assert.equal(engine.SECRET_CATALOG.length,11);
  assert.deepEqual(engine.SECRET_CATALOG.map(x=>x.id),ids);
  assert.equal(engine.SPECIAL_CATALOG.length,31);
  assert.ok(engine.SECRET_CATALOG.every(x=>x.title&&x.icon&&x.hint&&x.description&&x.rarity));
  assert.equal(engine.SECRET_CATALOG.filter(x=>x.sealed).length,2);
  const empty=engine.calculateSecret([],'Hero');
  assert.equal(empty.total,11);
  assert.equal(empty.earned,0);
  assert.equal(empty.visibleLocked.length,9);
  assert.equal(empty.locked.length,11);
  assert.ok(empty.achievements.every(x=>x.evidence.length===0));
  assert.equal(empty.achievements.find(x=>x.id==='silent-crown').difficulty,'極高');
});
test('無音の王冠: confirmed solo FINAL 0K 0VR personal cash, not 1VR or team cash',()=>{
  const win=secretPaid('win',{kills:0,vrs:0,prize:100});
  const unlocked=secret([win],'silent-crown');
  assert.equal(unlocked.unlocked,true);
  assert.equal(unlocked.evidence[0].kills,0);
  assert.equal(unlocked.evidence[0].vrs,0);
  assert.equal(unlocked.evidence[0].personalCash,100);
  const rejected=[
    {...win,id:'one-vr',vrs:1}, {...win,id:'no-vr',vrs:null},
    {...win,id:'one-kill',kills:1}, {...win,id:'missing-kill',kills:null},
    {...win,id:'qualifier',kind:'予選'}, {...win,id:'test',kind:'Test Cup'},
    {...win,id:'unknown-format',event:'Unknown Cup'},
    {...win,id:'team',event:'Duos Cash Cup',players:['Hero','Pair'],player:'Hero / Pair',prize:200,prizePerPlayer:100},
    {...win,id:'no-pay',prize:0}, {...win,id:'unverified',verified:false}
  ];
  assert.equal(secret(rejected,'silent-crown').unlocked,false);
  assert.equal(engine.calculateSecret([win],'Different').earned,0);
  const contradictory=[{name:'Solo Victory Cup Battle Royale',team:'duo'}];
  assert.equal(secret([win],'silent-crown',contradictory).unlocked,false);
});
test('黄金の一撃 is 1K with VR+cash in a solo final, 死神の戴冠 is rank 1+30K+cash',()=>{
  const golden=secretPaid('golden',{kills:1,vrs:1});
  assert.equal(secret([golden],'golden-strike').unlocked,true);
  assert.equal(secret([{...golden,vrs:0},{...golden,id:'kill2',kills:2}],'golden-strike').unlocked,false);
  assert.equal(secret([{...golden,kind:'予選'}],'golden-strike').unlocked,false);
  const death=secretPaid('death',{rank:1,kills:30,vrs:1});
  assert.equal(secret([death],'death-coronation').unlocked,true);
  assert.equal(secret([{...death,rank:2}],'death-coronation').unlocked,false);
  assert.equal(secret([{...death,kills:29}],'death-coronation').unlocked,false);
  assert.equal(secret([{...death,prize:0}],'death-coronation').unlocked,false);
  assert.equal(secret([{...death,kind:'予選'}],'death-coronation').unlocked,false);
});
test('三界を渡る影 and 三重の黄金 require three distinct regions on the SAME calendar date',()=>{
  const a=secretPaid('a',{region:'ME',date:'2026-10-01'});
  const b=secretPaid('b',{region:'EU',date:'2026-10-01'});
  const c=secretPaid('c',{region:'NAW',date:'2026-10-01'});
  assert.equal(secret([a,b,c],'three-world-shadow').unlocked,true);
  assert.equal(secret([a,b,c],'triple-gold').unlocked,true);
  assert.equal(secret([a,b,{...c,date:'2026-10-02'}],'three-world-shadow').unlocked,false);
  assert.equal(secret([a,b,{...c,region:'ME'}],'triple-gold').unlocked,false);
  assert.equal(secret([a,b,{...c,prize:0}],'triple-gold').unlocked,false);
  assert.equal(secret([a,b,{...c,date:'2026-02-30'}],'three-world-shadow').unlocked,false);
});
test('六界の賞金首: verified individual cash in ALL six overseas regions, team unknown split ignored',()=>{
  const six=engine.REGIONS.map((region,i)=>secretPaid('cash-'+region,{region,date:'2026-10-'+String(i+1).padStart(2,'0')}));
  assert.equal(secret(six,'six-region-bounty').progress,6);
  assert.equal(secret(six,'six-region-bounty').unlocked,true);
  assert.equal(secret(six.slice(0,5),'six-region-bounty').unlocked,false);
  assert.equal(secret([...six.slice(0,5),{...six[5],verified:false}],'six-region-bounty').unlocked,false);
  assert.equal(secret([...six.slice(0,5),{...six[5],players:['Hero','Pair'],player:'Hero / Pair',prizePerPlayer:null}],
    'six-region-bounty').unlocked,false);
});
test('国境なき王者 needs three DISTINCT regions with verified rank-one finals',()=>{
  const champions=['ME','EU','NAC'].map((region,i)=>secretPaid('c-'+i,{region,rank:1}));
  assert.equal(secret(champions,'borderless-champion').unlocked,true);
  assert.equal(secret([...champions.slice(0,2),{...champions[2],region:'EU'}],'borderless-champion').progress,2);
  assert.equal(secret([...champions.slice(0,2),{...champions[2],rank:2}],'borderless-champion').unlocked,false);
  assert.equal(secret([...champions.slice(0,2),{...champions[2],kind:'予選'}],'borderless-champion').unlocked,false);
});
test('不死鳥の遠征 needs >=365 full days between two personal payouts IN SAME overseas region',()=>{
  const one=secretPaid('old',{date:'2025-01-01',region:'ME'});
  const far=secretPaid('new',{date:'2026-01-01',region:'ME'});
  assert.equal(secret([one,far],'returning-phoenix').unlocked,true);
  assert.equal(secret([one,{...far,date:'2025-12-31'}],'returning-phoenix').unlocked,false);
  assert.equal(secret([one,{...far,region:'EU'}],'returning-phoenix').unlocked,false);
  assert.equal(secret([one,{...far,prize:0}],'returning-phoenix').unlocked,false);
  assert.deepEqual(secret([one,far],'returning-phoenix').evidence.map(e=>e.id),['old','new']);
});
test('光と影の双貌 pairs solo 0K-paid and a DISTINCT solo >=65K session, excluding team totals',()=>{
  const quiet=secretPaid('quiet',{kills:0,prize:100});
  const wild=fixture('wild',{kills:65,kind:'予選'});
  assert.equal(secret([quiet,wild],'light-and-shadow').unlocked,true);
  assert.equal(secret([quiet,{...wild,kills:64}],'light-and-shadow').unlocked,false);
  assert.equal(secret([quiet,{...wild,event:'Duos Cash Cup',players:['Hero','Pair'],player:'Hero / Pair',kills:150}],
    'light-and-shadow').unlocked,false);
  assert.equal(secret([{...quiet,prize:0},wild],'light-and-shadow').unlocked,false);
  assert.equal(secret([quiet,{...wild,verified:false}],'light-and-shadow').unlocked,false);
});
test('双冠の奇跡 needs on a single date two distinct regions EACH with VR + individual cash',()=>{
  const a=secretPaid('a',{date:'2026-10-01',region:'ME',vrs:1});
  const b=secretPaid('b',{date:'2026-10-01',region:'NAW',vrs:2});
  assert.equal(secret([a,b],'double-crown-miracle').unlocked,true);
  assert.equal(secret([a,{...b,vrs:0}],'double-crown-miracle').unlocked,false);
  assert.equal(secret([a,{...b,date:'2026-10-02'}],'double-crown-miracle').unlocked,false);
  assert.equal(secret([a,{...b,region:'ME'}],'double-crown-miracle').unlocked,false);
  assert.equal(secret([a,{...b,prize:0}],'double-crown-miracle').unlocked,false);
});
test('三冠の支配者: verified solo/duo/trio VRs are required, not cash or winless entries',()=>{
 const solo=fixture('solo-vr',{event:'Solo Victory Cup Battle Royale',vrs:1,prize:null,region:'ME'});
 const duo=fixture('duo-vr',{event:'Duos Cash Cup',player:'Hero / Pair',
   players:['Hero','Pair'],vrs:1,prize:0,region:'EU'});
 const trio=fixture('trio-vr',{event:'Trios Cash Cup',player:'Hero / Pair / Third',
   players:['Hero','Pair','Third'],vrs:2,prize:null,region:'NAC'});
 const trioBadge=special([solo,duo,trio],'triple-format-vr');
 assert.equal(trioBadge.title,'三冠の支配者');
 assert.equal(trioBadge.rarity,'epic');
 assert.equal(trioBadge.unlocked,true);
 assert.equal(trioBadge.progress,3);
 assert.deepEqual(trioBadge.evidence.map(e=>e.teamFormat),['solo','duo','trio']);
 assert.equal(special([solo,duo],'triple-format-vr').progress,2);
 assert.equal(special([solo,duo,{...trio,vrs:0}],'triple-format-vr').unlocked,false);
 assert.equal(special([solo,duo,{...trio,vrs:null}],'triple-format-vr').unlocked,false);
 assert.equal(special([solo,duo,{...trio,verified:false}],'triple-format-vr').unlocked,false);
 assert.equal(special([solo,{...solo,id:'solo-again',region:'BR'}],'triple-format-vr').progress,1);
 assert.equal(special([{...solo,event:'Unlabeled Cup'},duo,trio],'triple-format-vr').progress,2);
 assert.equal(special([solo,{...duo,event:'Solo Victory Cup Battle Royale'},trio],'triple-format-vr').progress,2);
 assert.equal(special([solo,duo,trio],'triple-format-vr').goal,3);
 assert.equal(special([solo,duo,trio],'triple-format-vr').unit,'形式');
});
test('二界の覇者: confirmed Battle Royale AND Zero Build final champions unlock the hidden legendary',()=>{
 const br=fixture('br-champion',{date:'2026-09-01',event:'Solo Victory Cup Battle Royale',
   region:'ME',kind:'賞金決勝',rank:1,vrs:0,prize:0});
 const zb=fixture('zb-champion',{date:'2026-09-04',event:'Zero Build Solo Victory Cup',
   region:'EU',kind:'賞金決勝',rank:1,vrs:0,prize:0});
 const claim=secret([br,zb],'dual-world-champion');
 assert.equal(claim.rarity,'legendary');
 assert.equal(claim.difficulty,'極高');
 assert.equal(claim.goal,2);
 assert.equal(claim.unlocked,true);
 assert.deepEqual(claim.evidence.map(e=>e.id),['br-champion','zb-champion']);
 assert.equal(secret([br],'dual-world-champion').progress,1);
 assert.equal(secret([br,br],'dual-world-champion').progress,1);
 assert.equal(secret([br,{...zb,rank:2}],'dual-world-champion').unlocked,false);
 assert.equal(secret([br,{...zb,kind:'予選'}],'dual-world-champion').unlocked,false);
 assert.equal(secret([br,{...zb,verified:false}],'dual-world-champion').unlocked,false);
 assert.equal(secret([br,{...zb,region:'ASIA'}],'dual-world-champion').unlocked,false);
 assert.equal(secret([br,{...zb,event:'Unlabeled Cup'}],'dual-world-champion').unlocked,false);
 assert.equal(secret([br,{...zb,event:'Solo Victory Cup Battle Royale'}],'dual-world-champion').unlocked,false);
 assert.equal(secret([br,zb],'dual-world-champion',[
   {name:'Solo Victory Cup Battle Royale',mode:'zero-build'},
   {name:'Zero Build Solo Victory Cup',mode:'zero-build'}
 ]).unlocked,false,'explicit catalog contradicts title BR claim');
 assert.equal(secret([br,zb],'dual-world-champion',[
   {name:'Solo Victory Cup Battle Royale',mode:'battle-royale'},
   {name:'Zero Build Solo Victory Cup',mode:'zero-build'}
 ]).unlocked,true);
 const unk=fixture('unknown-br',{event:'Tournament Mystery',region:'ME',kind:'賞金決勝',rank:1});
 assert.equal(secret([unk,zb],'dual-world-champion').unlocked,false,'do not infer BR from absence of Zero Build');
});
test('every existing archived player gets deterministic secret badges without mutating records or special titles',()=>{
  const before=JSON.stringify(records);
  const players=[...new Set(records.flatMap(row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player]).filter(Boolean))];
  for(const name of players){
    const a=engine.calculate(records,name);
    const secretOnly=engine.calculateSecret(records,name);
    assert.equal(a.secret.total,11,name);
    assert.equal(a.special.total,31,name);
    assert.equal(a.secret.earned,a.secret.unlocked.length,name);
    assert.equal(a.secret.locked.length+a.secret.earned,11,name);
    assert.deepEqual(a.secret.achievements.map(b=>b.id),secretOnly.achievements.map(b=>b.id));
    assert.ok(a.secret.locked.every(b=>b.evidence.length===0),name);
  }
  assert.equal(JSON.stringify(records),before);
});
