'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {discoverUnmapped,discoverUnmappedObservations}=require('../scripts/osirion-sync.cjs');
const {buildDiscoveryReport,combineReports,newestDiscoveryReport,draftFor,diagnoseEntry}=require('../scripts/unmapped-tournament-discovery.cjs');
const db={registry:require('../tournament-rules.json'),tournaments:require('../tournaments.json'),recent:require('../auto-sync-config.json'),history:require('../history-sync-config.json')};
const now=Date.parse('2026-11-24T10:00:00Z'),stamp=new Date(now).toISOString();
const opts={lookbackDays:7,reviewSeries:['victory-cup','cash-cup','skin-cup','playstation-cup']};
const event=(id,region,windows=[1])=>({eventId:'epicgames_'+id+'_'+region,displayData:{longFormatTitle:'Fixture Cup'},eventWindows:windows.map(n=>({eventWindowId:id+'_Event'+n+'_'+region,beginTime:'2026-11-'+String(17+n).padStart(2,'0')+'T16:00:00Z',endTime:'2026-11-'+String(17+n).padStart(2,'0')+'T18:00:00Z'}))});
const report=(events,scope='recent',time=stamp)=>buildDiscoveryReport(discoverUnmappedObservations(events,db.tournaments.catalog,opts,now),db,{scope,observedAt:time});
test('exact old event ID discovery matches detailed observations, with separate mode IDs and all regions',()=>{
 const br='S43_FixtureCup',zb='S43_FixtureCup_ZB';
 const events=[event(br,'ME',[1,2,3,4]),event(br,'EU'),event(br,'ME',[1,2]),event(zb,'ME'),event('S43_PlayStationCup','OCE'),event(br,'ASIA')];
 const out=report(events);
 assert.deepEqual(out.entries.map(x=>x.eventId).sort(),discoverUnmapped(events,db.tournaments.catalog,opts,now));
 assert.equal(out.totalEvents,2);
 const row=out.entries.find(x=>x.eventId===br);
 assert.deepEqual(row.observedRegions,['ME','EU']);assert.equal(row.windowCount,5);
 assert.equal(row.sampleWindows.filter(x=>x.region==='ME').length,3);
 assert.equal(row.firstDateJst,'2026-11-19');assert.equal(row.lastDateJst,'2026-11-22');
 assert.ok(row.missingFields.includes('rule.source'));
 assert.ok(row.missingFields.includes('catalog.mode'));
 assert.equal(row.automaticPublicationAuthorized,false);
});
test('unmapped eligibility date and series rules do not widen; malformed windows ignored',()=>{
 const vc=event('S43_FixtureVictoryCup','ME'),cup=event('S43_FixtureCup','ME');
 const malformed=event('S43_BadCashCup','ME');malformed.eventWindows[0].eventWindowId='S43_BadCashCup_EU';
 const old=event('S30_FixtureCashCup','ME');old.eventWindows[0]={eventWindowId:'S30_FixtureCashCup_ME',beginTime:'2024-07-01T16:00:00Z',endTime:'2024-07-01T18:00:00Z'};
 const all=[vc,cup,malformed,old];
 assert.deepEqual(discoverUnmapped(all,[],{lookbackDays:7,reviewSeries:['victory-cup']},now),['S43_FixtureVictoryCup']);
 assert.deepEqual(discoverUnmapped(all,[],{fromDate:'2024-07-02',toDate:'2024-07-02',reviewSeries:['cash-cup']},now),['S30_FixtureCashCup']);
});
test('all IDs retained, per-region samples bounded; conflicting timestamps visible',()=>{
 const events=Array.from({length:24},(_,i)=>event('S43_Fixture'+i+'CashCup','ME'));
 const dupe=event('S43_Fixture0CashCup','ME');dupe.eventWindows[0].endTime='2026-11-18T19:00:00Z';
 const out=report([...events,dupe]);
 assert.equal(out.totalEvents,24);
 const row=out.entries.find(x=>x.eventId==='S43_Fixture0CashCup');
 assert.equal(row.windowCount,1);assert.equal(row.observationCount,2);assert.equal(row.conflictingWindowTimes,true);
});
test('draft retains observed exact ID and display title, leaves official facts unset',()=>{
 const row=report([event('S43_FixtureCashCup','OCE')]).entries[0];
 const {draft,diagnostic}=diagnoseEntry(row,db);
 assert.deepEqual(draft,draftFor(row));assert.deepEqual(draft.rule.eventIds,['S43_FixtureCashCup']);
 assert.equal(draft.catalog.name,'Fixture Cup');assert.equal(draft.catalog.id,null);
 assert.equal(draft.catalog.series,null);assert.equal(draft.catalog.mode,null);assert.equal(draft.rule.source,null);
 assert.deepEqual(draft.rule.matchCaps,{});assert.deepEqual(draft.regions,[]);assert.deepEqual(draft.windows,[]);
 assert.equal(diagnostic.status,'blocked');assert.equal(diagnostic.automaticPublicationAuthorized,false);
});
test('combine newest scope snapshots without double-counting; registered events disappear',()=>{
 const id='S43_FixtureCashCup';
 const recent=report([event(id,'ME')]),history=report([event(id,'ME'),event(id,'EU')],'history');
 const status={recent:{unmappedDiscovery:recent},history:{unmappedDiscovery:history}};
 const out=combineReports(status,db.tournaments);
 assert.equal(out.totalEvents,1);assert.equal(out.entries[0].sampleWindows.length,2);
 assert.deepEqual(out.entries[0].scopeCounts.map(x=>x.windowCount),[1,2]);
 const catalog={...db.tournaments,catalog:[...db.tournaments.catalog,{seasonId:'S43',sourceEventIds:[id]}]};
 assert.equal(combineReports(status,catalog).totalEvents,0);
 const legacy=combineReports({recent:{unmappedEvents:20,unmappedEventIds:['S43_FixtureCashCup']}},db.tournaments);
 assert.equal(legacy.totalEvents,0);assert.equal(legacy.scopes[0].available,false);assert.equal(legacy.scopes[0].legacyCount,20);
});
test('freshness is tied to successful observations, not manual status stamps or failed scans',()=>{
 const old=report([event('S43_FixtureCashCup','ME')]),fresh=report([],'recent','2026-11-24T11:00:00Z');
 assert.equal(newestDiscoveryReport(fresh,old),fresh);
 assert.equal(newestDiscoveryReport(old,fresh),fresh);
 assert.equal(newestDiscoveryReport(undefined,fresh),fresh);
 assert.equal(newestDiscoveryReport(undefined,undefined),undefined);
});
