'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { audit } = require('../scripts/validate-approvals.cjs');
const { collision, collisionKey } = require('../scripts/manual-approval-core.cjs');

const aliases = {Alpha: ['Alpha_old']};
const players = {confirmedAliases: aliases};
const make = (id, extra = {}) => ({
  id, date: '2024-06-07', region: 'ME', player: 'Alpha',
  event: 'Zero Build Duos Victory Cup',
  round: 'Event 1 · Round 1 / 参加確認',
  source: 'https://fortnitetracker.com/events/epicgames_S30_ZeroBuildDuosVictoryCup_ME?window=S30_ZeroBuildDuosVictoryCup_Event1Round1_ME',
  kind: '参加確認', prize: null, verified: true, ...extra
});
const ledgerFor = row => ({version:1,entries:[{
  id:row.id,recordId:row.id,decision:'published',
  policy:'attendance-only',source:row.source
}]});

function exhaustiveCollisionReport(rows, row) {
  const matches = rows.filter(other => other.id === row.id);
  if (matches.length !== 1) return ['Published record missing or duplicate: '+row.id];
  const conflicting = rows.filter(other => other.id !== row.id)
    .map(other => ({id:other.id,reason:collision(other,row,aliases)}))
    .filter(other => other.reason);
  return conflicting.length ?
    ['Potential duplicate for approved '+row.id+': '+
      conflicting.slice(0,4).map(other => other.id).join(', ')] : [];
}

test('collisionKey never filters out actual collisions across aliases and rounds', () => {
  const target = make('seed');
  const rows = [
    make('same-round'),make('alias', {player:'Alpha_old'}),
    make('other-round', {round:'Event 2 · Round 1 / 参加確認'}),
    make('different-date', {date:'2024-06-08'}),
    make('different-region', {region:'NAC'}),
    make('different-event', {event:'Another Cup'}),
    make('different-player', {player:'Beta'}),
    make('different-team', {player:'Alpha / Beta',players:['Alpha','Beta']})
  ];
  for (const row of rows) {
    if (collision(row,target,aliases))
      assert.equal(collisionKey(row,aliases),collisionKey(target,aliases),row.id);
  }
});

test('indexed approval audit matches the complete prior scan and error ordering', () => {
  const target = make('approved-one');
  const rows = [
    make('alias', {player:'Alpha_old'}),
    make('same-round-1'),make('same-round-2'),
    make('different-date', {date:'2024-06-08'}),
    target,
    make('same-round-3'),
    make('different-player', {player:'Beta'}),
    make('same-round-4'),
    make('same-round-5')
  ];
  const expected = exhaustiveCollisionReport(rows,target);
  assert.ok(expected.length, 'Expected true collisions for this regression case');
  assert.deepEqual(audit(rows,ledgerFor(target),players),expected);
});

test('different sessions and identities remain independent and approved', () => {
  const target = make('verified-participant');
  const rows = [target,
    make('other-day',{date:'2024-06-08'}),
    make('other-region',{region:'EU'}),
    make('other-event',{event:'Unrelated Cup'}),
    make('other-player',{player:'Beta'}),
    make('other-round',{round:'Event 2 · Round 1 / 参加確認'})
  ];
  assert.deepEqual(audit(rows,ledgerFor(target),players),[]);
});

test('duplicate approved IDs still fail instead of silently choosing one', () => {
  const target = make('repeated-id');
  assert.deepEqual(audit([target,{...target}],ledgerFor(target),players),
    ['Published record missing or duplicate: repeated-id']);
});
