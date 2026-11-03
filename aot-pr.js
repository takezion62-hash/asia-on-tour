/* ASIA ON TOUR Power Ranking v1.4 - independent, deterministic, read-only scoring */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AotPR = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.7.0';
  const REGIONS = Object.freeze({ EU: 1.4, BR: 1.3, NAC: 1.2, ME: 1.1, OCE: 1.1, NAW: 1.0 });
  const STAGES = Object.freeze({ '予選': 0.35, '賞金決勝': 1, '決勝': 1, 'Practice決勝': 1,
    'Performance決勝': 1, 'スキン大会': 1, 'コスメ大会': 1, 'Test Cup': 1 });
  const TEAM_SIZES = Object.freeze({ solo: 1, duo: 2, trio: 3 });
  const SKIN_KINDS = new Set(['スキン大会', 'コスメ大会']);
  const SKIN_SERIES = new Set(['skin-cup', 'override-series']); // legacy Override data also skin-rated
  const OTHER_COSMETIC_SERIES = new Set(['icon-cup']);
  const SCORED_SERIES = new Set(['fncs', 'performance-evaluation', 'victory-cup', 'cash-cup', 'unreal-cup', 'playstation-cup', 'test-cup', ...SKIN_SERIES, ...OTHER_COSMETIC_SERIES]);

  function eventMultiplier(record, tournament) {
    if (!tournament || !SCORED_SERIES.has(tournament.series)) return null;
    // Test Cups reward verified overseas participation, without competing with cash cups.
    if (tournament.series === 'test-cup') return record.kind === 'Test Cup' ? 0.25 : null;
    if (record.kind === 'Test Cup') return null; // never treat a test as a higher-paying series
    // NickEh30 is mixed reward: cosmetic qualifier, paid-VR final. Its series tags
    // are shared by the event but cannot imply the same reward or weight per round.
    if (tournament.series === 'icon-cup' && ['nickeh30-icon-cup', 'playstation-clix-cup-battle-royale'].includes(tournament.subtype) &&
      Array.isArray(tournament.additionalSeries) && tournament.additionalSeries.includes('skin-cup')) {
      return record.kind === '予選' || SKIN_KINDS.has(record.kind) ? 0.50 :
        ['決勝', '賞金決勝'].includes(record.kind) ? 1.20 : null;
    }
    if (tournament.series === 'icon-cup' && Array.isArray(tournament.additionalSeries) &&
      tournament.additionalSeries.includes('skin-cup')) return 0.50;
    if (OTHER_COSMETIC_SERIES.has(tournament.series)) return 0.35;
    if (SKIN_KINDS.has(record.kind) || SKIN_SERIES.has(tournament.series)) return 0.50;
    if (tournament.series === 'performance-evaluation') return 1.2;
    if (tournament.series === 'fncs') {
      if (['fncs-division-1', 'fncs-division-1-practice'].includes(tournament.subtype)) return 1.4;
      return 1.6; // Major, Heats, LCQ and other verified FNCS tiers
    }
    if (tournament.series === 'victory-cup' || tournament.series === 'cash-cup' || tournament.series === 'unreal-cup' || tournament.series === 'playstation-cup') return 1;
    return null; // classification unknown: do not guess the importance of the event
  }

  // Bonus is for a verified cash achievement, not a conversion from USD to points.
  // Only an eligible *personal* payout qualifies; unknown duo shares are withheld.
  const CASH_FINALS = new Set(['賞金決勝', '決勝', 'Practice決勝', 'Performance決勝']);
  function confirmedCash(record, people, individualPrize) {
    if (record.verified !== true || record.reported || record.partial || !CASH_FINALS.has(record.kind) ||
      typeof record.prize !== 'number' || !Number.isFinite(record.prize) || record.prize <= 0) return false;
    if (typeof individualPrize === 'function') {
      const amount = individualPrize(record);
      return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= record.prize;
    }
    if (people.length === 1) return true;
    return Number.isFinite(record.prizePerPlayer) && record.prizePerPlayer > 0 &&
      record.prizePerPlayer * people.length <= record.prize + 0.001;
  }

  function bonusPolicy(tournament) {
    if (tournament.series === 'fncs') return {
      mode: 'event', base: ['fncs-division-1', 'fncs-division-1-practice'].includes(tournament.subtype) ? 60 : 80
    };
    if (tournament.series === 'performance-evaluation') return { mode: 'vr', base: 40 };
    if (tournament.series === 'victory-cup') return { mode: 'vr', base: 20 };
    if (tournament.series === 'playstation-cup') return { mode: 'event', base: 30 }; // placement-based paid final
    if (tournament.series === 'cash-cup') {
      // Victory Cash Cups explicitly award by VR; ordinary Cash Cups are placement based.
      const isVictory = /victory/i.test(String(tournament.subtype || '')) ||
        /victory\s+cash\s+cup/i.test(String(tournament.name || ''));
      return isVictory ? { mode: 'vr', base: 20 } : { mode: 'event', base: 30 };
    }
    return null; // No invented cash bonuses for skin, test or Icon series.
  }

  function sourceRound(record) {
    try {
      const url = new URL(record.source);
      if (!['fortnitetracker.com', 'www.fortnitetracker.com', 'fortnite.com', 'www.fortnite.com'].includes(url.hostname.toLowerCase())) return null;
      return url.searchParams.get('window') || url.searchParams.get('round') || null;
    } catch { return null; }
  }

  function sessionKey(record) {
    const identifiers = new Map();
    // Keep every explicit scheduling axis; rounds share attendance, sessions do not.
    // The trusted source takes precedence, while the recorded label can fill gaps.
    for (const round of [sourceRound(record), record.round]) {
      for (const match of String(round || '').matchAll(/(?:^|[^a-z])(Event|Session|Week|Day)[\s_.-]*(\d+)/gi)) {
        const word = match[1].toLowerCase();
        if (!identifiers.has(word)) identifiers.set(word, match[2]);
      }
    }
    return ['event', 'session', 'week', 'day'].filter(word => identifiers.has(word))
      .map(word => word + '-' + identifiers.get(word)).join('|') || 'unspecified';
  }

  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function cleanPeople(record, names) {
    const supplied = names(record);
    return [...new Set((Array.isArray(supplied) ? supplied : []).filter(name => typeof name === 'string' && name.trim()))];
  }

  function uniqueRecords(records, names, classify) {
    const byId = new Map(), anonymous = [], conflicts = new Set();
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      if (typeof record.id !== 'string' || !record.id) { anonymous.push(record); continue; }
      if (!byId.has(record.id)) byId.set(record.id, [record]);
      else byId.get(record.id).push(record);
    }
    const chosen = [...anonymous]; let duplicateCount = 0, conflictingCount = 0;
    for (const group of byId.values()) {
      if (group.some(item => stable(item) !== stable(group[0]))) {
        conflicts.add(group[0].id); conflictingCount++; duplicateCount += group.length;
      } else { chosen.push(group[0]); duplicateCount += group.length - 1; }
    }
    // Collapse a repeated imported result only when a verified source-round ID is available.
    const seen = new Set(), out = [];
    for (const record of chosen) {
      const round = sourceRound(record), tournament = classify(record) || {};
      const people = cleanPeople(record, names);
      const key = record.verified === true && round && tournament.id && !tournament.id.startsWith('unconfirmed-') && people.length ? stable([
        tournament.id, record.date, record.region, round, sessionKey(record), people.slice().sort(), record.kind,
        record.rank, record.points, record.kills, record.vrs
      ]) : null;
      if (key && seen.has(key)) duplicateCount++;
      else { if (key) seen.add(key); out.push(record); }
    }
    return { records: out, duplicateCount, conflictingCount };
  }

  function calculate(records, options = {}) {
    if (typeof options.names !== 'function' || typeof options.classify !== 'function') {
      throw new TypeError('AotPR.calculate requires names(record) and classify(record) helpers');
    }
    const region = Object.hasOwn(REGIONS, options.region) ? options.region : 'all';
    const input = Array.isArray(records) ? records : [];
    const unique = uniqueRecords(input, options.names, options.classify);
    const players = new Map();
    const seenEntries = new Set();
    const awardedBonusUnits = new Map();
    let included = 0, unknownModeKills = 0, missingRanks = 0, missingKills = 0, ignored = 0;

    for (const record of unique.records) {
      if (record.verified !== true || !(record.kind in STAGES) || !Object.hasOwn(REGIONS, record.region) ||
        (region !== 'all' && region !== record.region)) { ignored++; continue; }
      const tournament = options.classify(record) || {};
      const eventFactor = eventMultiplier(record, tournament);
      if (eventFactor === null) { ignored++; continue; }
      const people = cleanPeople(record, options.names);
      if (!people.length || typeof record.date !== 'string' || !record.date) { ignored++; continue; }
      included++;
      const stageFactor = STAGES[record.kind], regionFactor = REGIONS[record.region];
      const hasRank = Number.isInteger(record.rank) && record.rank > 0;
      const hasKills = Number.isInteger(record.kills) && record.kills >= 0;
      const teamSize = TEAM_SIZES[tournament.team] || people.length;
      const mode = tournament.mode;
      const killCoefficient = ['reload', 'reload-zero-build'].includes(mode) ? 0.7 :
        ['battle-royale', 'zero-build'].includes(mode) ? 1.5 : null;
      const rankBase = hasRank ? 100 / Math.sqrt(record.rank) * eventFactor * stageFactor : 0;
      const killsBase = hasKills && killCoefficient !== null ? Math.min(25, record.kills / teamSize * killCoefficient) * eventFactor * stageFactor : 0;
      if (!hasRank) missingRanks++;
      if (!hasKills) missingKills++;
      if (hasKills && killCoefficient === null) unknownModeKills++;

      for (const name of people) {
        // A participant gets one attendance award for a particular event/session/location/date,
        // while qualification and final round performances both count toward PR.
        const appearanceKey = stable([name, tournament.id || record.event, record.region, record.date, sessionKey(record)]);
        const newAppearance = !seenEntries.has(appearanceKey);
        seenEntries.add(appearanceKey);
        const attendance = (newAppearance ? 10 * eventFactor : 0) * regionFactor;
        const placement = rankBase * regionFactor;
        const elimination = killsBase * regionFactor;
        // A single final standing may summarize multiple paid VRs. Repeated exports
        // for that session use the maximum *confirmed* paid VR count, never a sum.
        const policy = bonusPolicy(tournament);
        const cashConfirmed = policy && confirmedCash(record, people, options.individualPrize);
        const candidateUnits = cashConfirmed && (policy.mode === 'event' || (Number.isInteger(record.vrs) && record.vrs > 0))
          ? (policy.mode === 'event' ? 1 : record.vrs) : 0;
        const alreadyAwarded = awardedBonusUnits.get(appearanceKey) || 0;
        const bonusUnits = Math.max(0, candidateUnits - alreadyAwarded);
        if (bonusUnits) awardedBonusUnits.set(appearanceKey, candidateUnits);
        const bonus = bonusUnits * (policy?.base || 0) * regionFactor;
        const total = attendance + placement + elimination + bonus;
        const value = players.get(name) || { name, score: 0, attendance: 0, placement: 0, eliminations: 0, bonus: 0,
          appearances: 0, roundRecords: 0, rows: [], regions: new Set() };
        value.score += total; value.attendance += attendance; value.placement += placement;
        value.eliminations += elimination; value.bonus += bonus; value.appearances += Number(newAppearance);
        value.roundRecords++; value.regions.add(record.region);
        value.rows.push({ id: record.id || null, date: record.date, region: record.region, event: record.event,
          kind: record.kind, rank: hasRank ? record.rank : null, kills: hasKills ? record.kills : null,
          source: record.source || null, attendance, placement, eliminations: elimination, bonus, bonusUnits, bonusMode: policy?.mode || null, total,
          regionMultiplier: regionFactor, eventMultiplier: eventFactor, stageMultiplier: stageFactor,
          modeKnown: killCoefficient !== null });
        players.set(name, value);
      }
    }
    const ordered = [...players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ja'));
    let placement = 0;
    const ranked = ordered.map((player, index) => {
      if (!index || Math.abs(player.score - ordered[index - 1].score) > 1e-8) placement = index + 1;
      return { ...player, rank: placement, regions: [...player.regions],
        rows: player.rows.slice().sort((a, b) => b.total - a.total || b.date.localeCompare(a.date)) };
    });
    return { version: VERSION, region, ranked, byName: new Map(ranked.map(player => [player.name, player])),
      recordCount: included, playerCount: ranked.length, ignored, duplicateCount: unique.duplicateCount,
      conflictingDuplicateCount: unique.conflictingCount, missingRanks, missingKills, unknownModeKills };
  }

  return Object.freeze({ VERSION, REGIONS, STAGES, eventMultiplier, sessionKey, calculate });
});
