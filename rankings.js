(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AsiaRankings = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const REGIONS = Object.freeze(['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR']);
  const MODES = Object.freeze(['battle-royale', 'zero-build', 'reload', 'reload-zero-build']);
  const FINAL_KINDS = Object.freeze(['賞金決勝', 'Practice決勝', 'Performance決勝', '決勝']);
  const METRICS = Object.freeze([
    { id: 'prize', label: '個人獲得賞金', unit: 'USD' },
    { id: 'prizeCount', label: '賞金獲得回数', unit: '件' },
    { id: 'finals', label: '掲載済み決勝出場記録', unit: '件' },
    { id: 'wins', label: '賞金決勝・総合優勝', unit: '件' },
    { id: 'podiums', label: '賞金決勝・総合TOP3', unit: '件' },
    { id: 'vrs', label: '海外VR合計', unit: 'VR' },
    { id: 'regions', label: '遠征地域数', unit: '地域' },
    { id: 'skins', label: 'スキン獲得回数', unit: '件' }
  ].map(Object.freeze));
  const DEFAULT_FILTERS = Object.freeze({ metric: 'prize', region: 'all', mode: 'all', series: 'all', finalKind: 'all' });

  function sanitizeFilters(input = {}, options = {}) {
    const values = input && typeof input === 'object' ? input : {};
    const filters = {
      metric: METRICS.some(item => item.id === values.metric) ? values.metric : 'prize',
      region: REGIONS.includes(values.region) ? values.region : 'all',
      mode: MODES.includes(values.mode) ? values.mode : 'all',
      series: Array.isArray(options.series) && options.series.includes(values.series) ? values.series : 'all',
      finalKind: FINAL_KINDS.includes(values.finalKind) ? values.finalKind : 'all'
    };
    if (filters.metric === 'regions' && filters.region !== 'all') filters.metric = 'prize';
    if (filters.metric !== 'finals') filters.finalKind = 'all';
    return filters;
  }

  const stableJSON = value => JSON.stringify(value, (key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]]));
  });
  const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const positiveRank = value => Number.isInteger(value) && value > 0;
  const moneyCents = value => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
    const cents = Math.round(value * 100);
    return Number.isSafeInteger(cents) ? cents : 0;
  };

  function publishedFinal(record) {
    return record.verified === true && !record.reported && !record.partial && FINAL_KINDS.includes(record.kind) &&
      (positiveRank(record.rank) || ['points', 'kills', 'vrs'].some(key => validNumber(record[key])));
  }

  // Only an explicitly identified source round can establish a duplicate across
  // different record IDs. Missing round IDs never collapse distinct sessions.
  function semanticKey(record, people, tournament) {
    if (typeof tournament.id !== 'string' || tournament.id.startsWith('unconfirmed-')) return null;
    try {
      const source = new URL(record.source);
      if (!['https:', 'http:'].includes(source.protocol) ||
          !['fortnite.com', 'www.fortnite.com', 'fortnitetracker.com', 'www.fortnitetracker.com'].includes(source.hostname.toLowerCase())) return null;
      const round = source.searchParams.get('window') || source.searchParams.get('round');
      if (!round || !record.date || !REGIONS.includes(record.region) || !people.length) return null;
      return stableJSON([
        tournament.id, record.date, record.region, round, [...people].sort(),
        ...['seasonId', 'chapter', 'season', 'round', 'kind', 'rank', 'points', 'kills', 'vrs', 'prize', 'prizePerPlayer', 'verified', 'partial', 'reported'].map(key => record[key])
      ]);
    } catch { return null; }
  }

  function uniqueRecords(records, roster, classification) {
    const byId = new Map(), candidates = [];
    let duplicateCount = 0, conflictingDuplicateCount = 0;
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
      const entry = { record, index };
      if (typeof record.id !== 'string' || !record.id) candidates.push(entry);
      else {
        const group = byId.get(record.id) || [];
        group.push(entry); byId.set(record.id, group);
      }
    }
    for (const group of byId.values()) {
      const signature = stableJSON(group[0].record);
      if (group.some(entry => stableJSON(entry.record) !== signature)) {
        // A conflicting ID cannot safely choose one of its records as truth.
        conflictingDuplicateCount++;
        duplicateCount += group.length;
      } else {
        candidates.push(group[0]);
        duplicateCount += group.length - 1;
      }
    }
    const seen = new Set(), unique = [];
    for (const { record } of candidates.sort((a, b) => a.index - b.index)) {
      const key = semanticKey(record, roster(record), classification(record));
      if (key && seen.has(key)) duplicateCount++;
      else { if (key) seen.add(key); unique.push(record); }
    }
    return { records: unique, duplicateCount, conflictingDuplicateCount };
  }

  function buildRankings(records, input = {}, helpers = {}) {
    for (const key of ['names', 'individualPrize', 'classifyTournamentRecord', 'confirmedPrizeFinalRank', 'confirmedSkinReward']) {
      if (typeof helpers[key] !== 'function') throw new TypeError('ランキング集計に共通関数 ' + key + ' が必要です。');
    }
    const source = Array.isArray(records) ? records : [];
    const peopleCache = new Map(), classificationCache = new Map();
    const peopleFor = record => {
      if (!peopleCache.has(record)) peopleCache.set(record, [...new Set(helpers.names(record).filter(name => typeof name === 'string' && name.length))]);
      return peopleCache.get(record);
    };
    const classify = record => {
      if (!classificationCache.has(record)) classificationCache.set(record, helpers.classifyTournamentRecord(record) || {});
      return classificationCache.get(record);
    };
    const unique = uniqueRecords(source, peopleFor, classify);
    const series = Array.isArray(helpers.series) ? helpers.series : [...new Set(unique.records.map(record => classify(record).series).filter(value => typeof value === 'string'))];
    const filters = sanitizeFilters(input, { series });
    const selected = unique.records.filter(record => {
      if (!REGIONS.includes(record.region)) return false;
      const tournament = classify(record);
      return (filters.region === 'all' || record.region === filters.region) &&
        (filters.mode === 'all' || tournament.mode === filters.mode) &&
        (filters.series === 'all' || tournament.series === filters.series) &&
        (filters.metric !== 'finals' || filters.finalKind === 'all' || record.kind === filters.finalKind);
    });
    const players = new Map();
    let totalCents = 0, unknownRecords = 0;
    for (const record of selected) {
      const people = peopleFor(record);
      const cents = moneyCents(helpers.individualPrize(record));
      totalCents += cents * people.length;
      const final = publishedFinal(record);
      const finalRank = helpers.confirmedPrizeFinalRank(record);
      const knownVR = record.verified === true && Number.isInteger(record.vrs) && record.vrs >= 0;
      if (filters.metric === 'vrs' && !knownVR) unknownRecords++;
      for (const name of people) {
        let player = players.get(name);
        if (!player) {
          player = { name, value: 0, prizeEvents: 0, knownRecords: 0, unknownRecords: 0, teamRecords: 0,
            regions: new Set(), finalKinds: Object.fromEntries(FINAL_KINDS.map(kind => [kind, 0])) };
          players.set(name, player);
        }
        if (cents > 0) player.prizeEvents++;
        if (final) player.finalKinds[record.kind]++;
        let contribution = 0, known = false;
        switch (filters.metric) {
          case 'prize': contribution = cents; known = cents > 0; break;
          case 'prizeCount': contribution = cents > 0 ? 1 : 0; known = cents > 0; break;
          case 'finals': contribution = final ? 1 : 0; known = final; break;
          case 'wins':
            known = record.verified === true && record.kind === '賞金決勝' && finalRank === 1;
            contribution = known ? 1 : 0; break;
          case 'podiums':
            known = record.verified === true && record.kind === '賞金決勝' && positiveRank(finalRank) && finalRank <= 3;
            contribution = known ? 1 : 0; break;
          case 'vrs':
            known = knownVR;
            if (known) contribution = record.vrs;
            else player.unknownRecords++;
            break;
          case 'regions': known = true; break;
          case 'skins': known = helpers.confirmedSkinReward(record) === true; contribution = known ? 1 : 0; break;
        }
        if (known) {
          player.knownRecords++;
          if (people.length > 1) player.teamRecords++;
          player.regions.add(record.region);
          player.value += contribution;
        }
      }
    }
    const rows = [], unranked = [];
    for (const player of players.values()) {
      const row = { ...player, regions: REGIONS.filter(region => player.regions.has(region)) };
      if (filters.metric === 'prize') row.value /= 100;
      if (filters.metric === 'regions') row.value = row.regions.length;
      if (filters.metric === 'vrs' && !row.knownRecords) unranked.push({ ...row, value: null, rank: null });
      else if (row.value > 0 || filters.metric === 'vrs' && row.knownRecords > 0) rows.push(row);
    }
    rows.sort((a, b) => b.value - a.value || b.prizeEvents - a.prizeEvents || a.name.localeCompare(b.name, 'ja'));
    let previous;
    for (let index = 0; index < rows.length; index++) {
      rows[index].rank = index > 0 && rows[index].value === previous ? rows[index - 1].rank : index + 1;
      previous = rows[index].value;
    }
    unranked.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return {
      filters, rows, unranked, totalPrize: totalCents / 100, recordCount: selected.length, unknownRecords,
      duplicateCount: unique.duplicateCount, conflictingDuplicateCount: unique.conflictingDuplicateCount
    };
  }

  return Object.freeze({ METRICS, REGIONS, MODES, FINAL_KINDS, DEFAULT_FILTERS, sanitizeFilters, buildRankings });
});
