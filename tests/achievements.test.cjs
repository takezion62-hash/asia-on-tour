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
  assert.equal(engine.VERSION,2);
  assert.equal(engine.EVOLUTION_TRACKS.length,6);
  assert.deepEqual(engine.EVOLUTION_TIERS.map(t=>t.id),['bronze','silver','gold','platinum','prismatic']);
  assert.equal(new Set(engine.EVOLUTION_TRACKS.map(t=>t.id)).size,6);
  for(const track of engine.EVOLUTION_TRACKS){
    assert.equal(track.steps.length,5,track.id);
    assert.ok(track.steps.every((step,i)=>step.goal>0&&(!i||step.goal>track.steps[i-1].goal)),track.id);
    assert.deepEqual(track.steps.map(step=>step.tier),engine.EVOLUTION_TIERS.map(t=>t.id));
  }
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
