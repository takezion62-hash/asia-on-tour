'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {diagnose,template,existing,suggestions}=require('../scripts/tournament-registration-preview.cjs');
const db={registry:require('../tournament-rules.json'),tournaments:require('../tournaments.json'),recent:require('../auto-sync-config.json'),history:require('../history-sync-config.json')};
const copy=x=>JSON.parse(JSON.stringify(x));
const sample=id=>copy(existing(id,db));
const PS='ch7s5-playstation-cup-battle-royale';
function newSkin(){
 const d=sample('ch7s5-one-piece-buggy-mobile-cup');
 d.catalog.id=d.rule.id='fixture-preview-skin';d.catalog.name='Fixture only';
 d.catalog.sourceEventIds=d.rule.eventIds=['S43_PreviewFixtureMobile'];
 d.catalog.evidence=[{text:'TEST FIXTURE ONLY',url:d.rule.source}];
 d.rule.evidence=[{text:'TEST FIXTURE ONLY',url:d.rule.source}];
 d.windows=d.regions.map(region=>({tournamentId:d.rule.id,seasonId:d.rule.seasonId,series:'skin-cup',eventId:d.rule.eventIds[0],region,kind:'参加確認',windowId:d.rule.eventIds[0]+'_'+region}));
 return d;
}
test('registered BR and ZB show distinct IDs, exact regional cutoff and current route',()=>{
 for(const id of [PS,'ch7s5-playstation-cup-zero-build']){
  const d=sample(id),out=diagnose(d,db);
  assert.equal(out.registered,true);assert.deepEqual(out.errors,[]);assert.deepEqual(out.missing,[]);
  assert.deepEqual(out.routeReport.map(r=>r.id),['playstation']);
  assert.equal(out.coverage.find(x=>x.region==='EU').payingRank,50);
  assert.equal(out.coverage.find(x=>x.region==='OCE').advance,80);
  assert.equal(out.automaticPublicationAuthorized,false);assert.equal(out.registrationPreview,null);
 }
});
test('new structurally valid draft produces JSON preview only, never mutates input or database',()=>{
 const d=newSkin(),before=JSON.stringify(d),base=JSON.stringify(db),out=diagnose(d,db);
 assert.equal(out.status,'needs-verification',JSON.stringify(out));
 assert.ok(out.registrationPreview);assert.equal(out.registrationPreview.rule.id,d.rule.id);
 assert.equal(out.automaticPublicationAuthorized,false);
 assert.equal(JSON.stringify(d),before);assert.equal(JSON.stringify(db),base);
});
test('empty template reports missing fields without inventing prizes',()=>{
 const out=diagnose(template(),db);assert.equal(out.status,'blocked');
 for(const field of ['catalog.id','catalog.mode','rule.source','rule.eventIds','rule.matchCaps','regions'])assert.ok(out.missing.some(x=>x.field===field),field);
 assert.equal(out.registrationPreview,null);assert.equal(out.automaticPublicationAuthorized,false);
});
test('ID collisions, unregistered tags, unknown modes, wrong season, wrong rule mode, non-Epic source all blocked',()=>{
 for(const mutate of [
  d=>{d.catalog.sourceEventIds=d.rule.eventIds=['S43_PlayStationCup_ZB']},
  d=>{d.catalog.subtype='unregistered-subtype'},
  d=>{d.catalog.mode='unknown'},
  d=>{d.catalog.chapter=8},
  d=>{d.rule.mode='battle-royale'},
  d=>{d.catalog.sourceEventIds=['S42_Wrong']},
  d=>{d.rule.source='https://example.com/rules'}
 ]){
  const d=newSkin();mutate(d);const out=diagnose(d,db);
  assert.equal(out.status,'blocked',JSON.stringify(out));assert.equal(out.registrationPreview,null);
 }
 const old=sample(PS);old.rule.advance.EU=81;assert.equal(diagnose(old,db).status,'blocked');
});
test('regional missing/invalid prize or cosmetic cutoff never becomes zero',()=>{
 const d=newSkin();delete d.rule.cosmeticRanks.ME;
 assert.ok(diagnose(d,db).missing.some(x=>x.field==='rule.cosmeticRanks.ME'));
 const cash=sample('ch7s5-trios-cash-cup');cash.rule.cashPrizes.tiers.ME[0].perPlayer=-1;
 assert.ok(diagnose(cash,db).missing.some(x=>x.field==='rule.cashPrizes.tiers.ME'));
});
test('pinned PS rule cannot be copied to a new event; official validator still blocks',()=>{
 const d=sample(PS);d.catalog.id=d.rule.id='fixture-preview-ps';d.catalog.sourceEventIds=d.rule.eventIds=['S43_PreviewPS'];
 const out=diagnose(d,db);assert.equal(out.status,'blocked');
 assert.ok(out.errors.some(x=>x.field==='validator'));assert.equal(out.registrationPreview,null);
});
test('dual policies and review-only are separate; wrong window and disabled flag diagnosed',()=>{
 const d=sample('ch7s1-solo-series-finals');assert.deepEqual(diagnose(d,db).routeReport,[]);
 const duo=sample('ch7s5-reload-zero-build-duos-cash-cup');assert.deepEqual(diagnose(duo,db).routeReport.map(x=>x.id),['cash','duo']);
 const candidate=newSkin();candidate.windows[0].windowId='S43_PreviewFixtureMobile_XX';
 const report=diagnose(candidate,db);assert.ok(report.review.some(x=>x.field==='windows.0'));
 assert.ok(diagnose(newSkin(),{...db,recent:{},history:{}}).review.some(x=>x.field==='config'));
 const cash=sample('ch7s5-trios-cash-cup').rule;delete cash.autoApproval;
 assert.deepEqual(suggestions(cash),[{fields:{autoApproval:'verified-team-rank'},routes:['cash']}]);
});
