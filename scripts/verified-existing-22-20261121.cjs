'use strict';
// Exact duplicate evidence: saved Epic account-ID rank==a previously published
// Fortnite Tracker record with identical player/date/event/region/stats.
// Never copies an original cash award into an unverified participation entry.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-exact-22-already-published.json'),'utf8'));
const GOLD=Object.freeze([
  {
    "candidate": {
      "id": "auto-s33-f41570d9396f",
      "date": "2024-12-08",
      "region": "ME",
      "event": "PlayStation Cup",
      "player": "Mofu",
      "playerRaw": "RC MOFU 16ǃ",
      "round": "単一開催枠 / 参加確認",
      "kind": "参加確認",
      "rank": 36,
      "points": 118,
      "kills": 10,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S33",
      "tournamentId": "ch6s1-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S33_PlaystationCup/?region=ME&round=S33_PlaystationCupFinal_ME",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s33-me-s33mebr-final-20241208-r36",
      "date": "2024-12-08",
      "region": "ME",
      "event": "PlayStation Cup",
      "player": "Mofu",
      "rank": 36,
      "points": 118,
      "kills": 10,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S33",
      "tournamentId": "ch6s1-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 250,
      "source": "https://fortnitetracker.com/events/epicgames_S33_PlaystationCup_ME?window=S33_PlaystationCupFinal_ME"
    }
  },
  {
    "candidate": {
      "id": "auto-s33-9a9e4a9f2302",
      "date": "2024-12-08",
      "region": "ME",
      "event": "PlayStation Cup",
      "player": "xyxyxyxyxyxyzz",
      "playerRaw": "xyxyxyxyxyxyzz",
      "round": "単一開催枠 / 参加確認",
      "kind": "参加確認",
      "rank": 93,
      "points": 7,
      "kills": 0,
      "vrs": 0,
      "matches": 3,
      "prize": null,
      "seasonId": "S33",
      "tournamentId": "ch6s1-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S33_PlaystationCup/?region=ME&round=S33_PlaystationCupFinal_ME",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s33-me-s33mebr-final-20241208-r93",
      "date": "2024-12-08",
      "region": "ME",
      "event": "PlayStation Cup",
      "player": "xyxyxyxyxyxyzz",
      "rank": 93,
      "points": 7,
      "kills": 0,
      "vrs": 0,
      "matches": 3,
      "seasonId": "S33",
      "tournamentId": "ch6s1-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S33_PlaystationCup_ME?window=S33_PlaystationCupFinal_ME"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-90a704b6486c",
      "date": "2025-09-04",
      "region": "OCE",
      "event": "PlayStation Cup",
      "player": "Mofu",
      "playerRaw": "RC MOFU 16ǃ",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 10,
      "points": 195,
      "kills": 7,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=OCE&round=S37_PlayStationCup_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s37-oce-s37oce-final-20250904-r10",
      "date": "2025-09-04",
      "region": "OCE",
      "event": "PlayStation Cup",
      "player": "Mofu",
      "rank": 10,
      "points": 195,
      "kills": 7,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 200,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_OCE?window=S37_PlayStationCup_Final_OCE"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-bf36f072d054",
      "date": "2025-09-04",
      "region": "OCE",
      "event": "PlayStation Cup",
      "player": "Saku",
      "playerRaw": "A_α さくʕᵔᴥᵔʔ",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 41,
      "points": 112,
      "kills": 6,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=OCE&round=S37_PlayStationCup_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s37-oce-s37oce-final-20250904-r41",
      "date": "2025-09-04",
      "region": "OCE",
      "event": "PlayStation Cup",
      "player": "Saku",
      "rank": 41,
      "points": 112,
      "kills": 6,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_OCE?window=S37_PlayStationCup_Final_OCE"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-06ee29bd1c9d",
      "date": "2025-09-04",
      "region": "OCE",
      "event": "PlayStation Cup",
      "player": "ごんた",
      "playerRaw": "GR go gonta go",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 84,
      "points": 9,
      "kills": 3,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=OCE&round=S37_PlayStationCup_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s37-oce-s37oce-final-20250904-r84",
      "date": "2025-09-04",
      "region": "OCE",
      "event": "PlayStation Cup",
      "player": "ごんた",
      "rank": 84,
      "points": 9,
      "kills": 3,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_OCE?window=S37_PlayStationCup_Final_OCE"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-55eba7471f6b",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "Jaemon",
      "playerRaw": "Jaemon.K",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 11,
      "points": 173,
      "kills": 4,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r11",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "Jaemon",
      "rank": 11,
      "points": 173,
      "kills": 4,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 400,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-cb664c17417b",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "モバイル勢のまかろん",
      "playerRaw": "BRN 916GonLuck",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 33,
      "points": 124,
      "kills": 8,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r33",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "モバイル勢のまかろん",
      "rank": 33,
      "points": 124,
      "kills": 8,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 400,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-86dcffd62e0d",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "sena",
      "playerRaw": "coolsabdad.xml",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 36,
      "points": 121,
      "kills": 5,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r36",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "sena",
      "rank": 36,
      "points": 121,
      "kills": 5,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 400,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-ef1ea9a9fec2",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "ちからV2",
      "playerRaw": "NEXUS ちからV2ǃ",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 37,
      "points": 117,
      "kills": 9,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r37",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "ちからV2",
      "rank": 37,
      "points": 117,
      "kills": 9,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 400,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-d40b982b4622",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "きみが死ぬまで恋をしたいɞ",
      "playerRaw": "きみが死ぬまで恋をしたいɞ",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 48,
      "points": 92,
      "kills": 1,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r48",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "きみが死ぬまで恋をしたいɞ",
      "rank": 48,
      "points": 92,
      "kills": 1,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-92353df2ab5a",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "えありー",
      "playerRaw": "zst Airyfnbr",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 67,
      "points": 56,
      "kills": 4,
      "vrs": 0,
      "matches": 4,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r67",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "えありー",
      "rank": 67,
      "points": 56,
      "kills": 4,
      "vrs": 0,
      "matches": 4,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-bbc60c0a3238",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "ちゃる",
      "playerRaw": "charufn",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 68,
      "points": 56,
      "kills": 3,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r68",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "ちゃる",
      "rank": 68,
      "points": 56,
      "kills": 3,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-e7ab29e571af",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "ちゃんおに",
      "playerRaw": "DYD チー牛ウン子漏らし滅ǃǃ",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 74,
      "points": 41,
      "kills": 4,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r74",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "ちゃんおに",
      "rank": 74,
      "points": 41,
      "kills": 4,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-68aa21faaa10",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "3peace",
      "playerRaw": "NEXUS 3peace",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 81,
      "points": 22,
      "kills": 0,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r81",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "3peace",
      "rank": 81,
      "points": 22,
      "kills": 0,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-cc596e34b758",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "きおらび",
      "playerRaw": "きおらび",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 84,
      "points": 15,
      "kills": 2,
      "vrs": 0,
      "matches": 5,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r84",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "きおらび",
      "rank": 84,
      "points": 15,
      "kills": 2,
      "vrs": 0,
      "matches": 5,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s37-5dc67c7d57bd",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "躯中の細胞に火を熾すように",
      "playerRaw": "躯中の細胞に火を熾すように",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 96,
      "points": 0,
      "kills": 0,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "source": "https://www.fortnite.com/competitive/events/S37_PlayStationCup/?region=NAW&round=S37_PlayStationCup_Final_NAW",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s37-naw-playstation-final-20250905-r96",
      "date": "2025-09-05",
      "region": "NAW",
      "event": "PlayStation Cup",
      "player": "躯中の細胞に火を熾すように",
      "rank": 96,
      "points": 0,
      "kills": 0,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S37",
      "tournamentId": "ch6s4-playstation-cup",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S37_PlayStationCup_NAW?window=S37_PlayStationCup_Final_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s39-25299cf460e5",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "テルハルル",
      "playerRaw": "BoF てるはるるの相方popo",
      "round": "単一開催枠 / 参加確認",
      "kind": "参加確認",
      "rank": 33,
      "points": 345,
      "kills": 7,
      "vrs": 0,
      "matches": 9,
      "prize": null,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "source": "https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region=NAW&round=S39_NvidiaCup_NAW",
      "reviewOnly": true,
      "reviewReason": "全ページ連続の順位表・Epic ID付完全スナップショットが未確認"
    },
    "existing": {
      "id": "owner-s39-naw-nvidia-20251222-r33",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "テルハルル",
      "rank": 33,
      "points": 345,
      "kills": 7,
      "vrs": 0,
      "matches": 9,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "kind": "賞金決勝",
      "round": "Session 1 / 賞金決勝",
      "prize": 100,
      "source": "https://fortnitetracker.com/events/epicgames_S39_NvidiaCup_NAW?window=S39_NvidiaCup_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s39-dadd5c4fcfe1",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "モバイル勢のまかろん",
      "playerRaw": "BRN 916GonLuck",
      "round": "単一開催枠 / 参加確認",
      "kind": "参加確認",
      "rank": 36,
      "points": 342,
      "kills": 9,
      "vrs": 1,
      "matches": 9,
      "prize": null,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "source": "https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region=NAW&round=S39_NvidiaCup_NAW",
      "reviewOnly": true,
      "reviewReason": "全ページ連続の順位表・Epic ID付完全スナップショットが未確認"
    },
    "existing": {
      "id": "owner-s39-naw-nvidia-20251222-r36",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "モバイル勢のまかろん",
      "rank": 36,
      "points": 342,
      "kills": 9,
      "vrs": 1,
      "matches": 9,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "kind": "賞金決勝",
      "round": "Session 1 / 賞金決勝",
      "prize": 100,
      "source": "https://fortnitetracker.com/events/epicgames_S39_NvidiaCup_NAW?window=S39_NvidiaCup_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s39-4331ce955a79",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "PONY",
      "playerRaw": "QTD Pony ψ",
      "round": "単一開催枠 / 参加確認",
      "kind": "参加確認",
      "rank": 53,
      "points": 322,
      "kills": 6,
      "vrs": 1,
      "matches": 8,
      "prize": null,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "source": "https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region=NAW&round=S39_NvidiaCup_NAW",
      "reviewOnly": true,
      "reviewReason": "全ページ連続の順位表・Epic ID付完全スナップショットが未確認"
    },
    "existing": {
      "id": "owner-s39-naw-nvidia-20251222-r53",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "PONY",
      "rank": 53,
      "points": 322,
      "kills": 6,
      "vrs": 1,
      "matches": 8,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "kind": "賞金決勝",
      "round": "Session 1 / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S39_NvidiaCup_NAW?window=S39_NvidiaCup_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s39-d3f0975d3ece",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "ふぃる",
      "playerRaw": "ポルターガイストǃ",
      "round": "単一開催枠 / 参加確認",
      "kind": "参加確認",
      "rank": 69,
      "points": 312,
      "kills": 10,
      "vrs": 0,
      "matches": 10,
      "prize": null,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "source": "https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region=NAW&round=S39_NvidiaCup_NAW",
      "reviewOnly": true,
      "reviewReason": "全ページ連続の順位表・Epic ID付完全スナップショットが未確認"
    },
    "existing": {
      "id": "owner-s39-naw-nvidia-20251222-r69",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "ふぃる",
      "rank": 69,
      "points": 312,
      "kills": 10,
      "vrs": 0,
      "matches": 10,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "kind": "賞金決勝",
      "round": "Session 1 / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S39_NvidiaCup_NAW?window=S39_NvidiaCup_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s39-a9fee57fd31c",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "Rise",
      "playerRaw": "Riddle RiIse",
      "round": "単一開催枠 / 参加確認",
      "kind": "参加確認",
      "rank": 71,
      "points": 310,
      "kills": 16,
      "vrs": 1,
      "matches": 10,
      "prize": null,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "source": "https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region=NAW&round=S39_NvidiaCup_NAW",
      "reviewOnly": true,
      "reviewReason": "全ページ連続の順位表・Epic ID付完全スナップショットが未確認"
    },
    "existing": {
      "id": "owner-s39-naw-nvidia-20251222-r71",
      "date": "2025-12-22",
      "region": "NAW",
      "event": "NVIDIA GeForce RTX Cup",
      "player": "Rise",
      "rank": 71,
      "points": 310,
      "kills": 16,
      "vrs": 1,
      "matches": 10,
      "seasonId": "S39",
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "kind": "賞金決勝",
      "round": "Session 1 / 賞金決勝",
      "prize": 0,
      "source": "https://fortnitetracker.com/events/epicgames_S39_NvidiaCup_NAW?window=S39_NvidiaCup_NAW"
    }
  },
  {
    "candidate": {
      "id": "auto-s41-66f61e566d8c",
      "date": "2026-06-09",
      "region": "OCE",
      "event": "Days of Play PlayStation Cup (Zero Build)",
      "player": "モバイル勢のまかろん",
      "playerRaw": "BRN 916GonLuck",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 1,
      "points": 253,
      "kills": 13,
      "vrs": 2,
      "matches": 6,
      "prize": null,
      "seasonId": "S41",
      "tournamentId": "ch7s3-days-of-play-playstation-cup-zb",
      "source": "https://www.fortnite.com/competitive/events/S41_PSCupDaysOfPlay_ZB/?region=OCE&round=S41_PSCupDaysOfPlay_ZB_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "owner-s41-oce-days-zb-20260609-r1",
      "date": "2026-06-09",
      "region": "OCE",
      "event": "Days of Play PlayStation Cup (Zero Build)",
      "player": "モバイル勢のまかろん",
      "rank": 1,
      "points": 253,
      "kills": 13,
      "vrs": 2,
      "matches": 6,
      "seasonId": "S41",
      "tournamentId": "ch7s3-days-of-play-playstation-cup-zb",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 1000,
      "source": "https://fortnitetracker.com/events/epicgames_S41_PSCupDaysOfPlay_ZB_OCE?window=S41_PSCupDaysOfPlay_ZB_Final_OCE"
    }
  }
]);
const fail=(ok,message)=>{if(!ok)throw Error('EXACT_EXISTING_22_PROOF '+message)};
const fields=['id','date','region','event','player','playerRaw','round','kind',
 'rank','points','kills','vrs','matches','prize','seasonId','tournamentId','source',
 'reviewOnly','reviewReason'];
const oldFields=['id','date','region','event','player','rank','points','kills','vrs',
 'matches','seasonId','tournamentId','kind','round','prize','source'];
const same=(a,b,fields)=>fields.every(k=>a[k]===b[k]);
function parseSources(candidate,old){
 let u,v;
 try{u=new URL(candidate.source);v=new URL(old.source)}catch{return false}
 const id=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/u)?.[1];
 const window=u.searchParams.get('round'),region=u.searchParams.get('region');
 return Boolean(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
  v.protocol==='https:'&&v.hostname==='fortnitetracker.com'&&
  id&&window&&region===candidate.region&&
  v.pathname==='/events/epicgames_'+id+'_'+region&&
  v.searchParams.get('window')===window&&
  u.searchParams.size===2&&v.searchParams.size===1&&
  window.endsWith('_'+region));
}
function validateProof(){
 const data=DOC.batch?.records||[];
 fail(DOC.version===1&&DOC.batch.id==='verified-existing-22-20261121'&&
  DOC.batch.reviewedOn==='2026-11-21'&&data.length===22&&
  DOC.expected.duplicates===22&&DOC.expected.resultsAdded===0&&
  DOC.expected.cashAdded===0&&DOC.expected.stillHeldS30===5,
  'approved duplicate snapshot changed');
 const seen=new Set(),oldSeen=new Set();
 for(let i=0;i<GOLD.length;i++){
  const g=GOLD[i],p=data[i],c=p?.candidate,e=p?.existing;
  fail(c&&e&&same(c,g.candidate,fields)&&same(e,g.existing,oldFields),
   'source or published result mutated '+g.candidate.id);
  fail(!seen.has(c.id)&&!oldSeen.has(e.id)&&c.id!==e.id,
   'duplicate ID or published ID reused '+c.id);
  seen.add(c.id);oldSeen.add(e.id);
  fail(c.kind==='参加確認'&&e.kind==='賞金決勝'&&
   c.verified===true&&typeof c.reviewReason==='string'&&c.reviewReason.length>0&&
   c.date===e.date&&c.region===e.region&&c.event===e.event&&
   c.player===e.player&&c.rank===e.rank&&c.points===e.points&&
   c.kills===e.kills&&c.vrs===e.vrs&&c.seasonId===e.seasonId&&
   c.tournamentId===e.tournamentId&&
   (e.matches===undefined||c.matches===e.matches)&&
   Number.isFinite(e.prize)&&e.prize>=0,
   'not exactly the same published stat or missing existing award '+c.id);
  fail(parseSources(c,e),'different Epic/Tracker event or window '+c.id);
 }
 return true;
}
function matchCandidate(r,spec){
 return Boolean(r&&spec&&same(r,spec.candidate,fields)&&r.verified===true&&
  parseSources(r,spec.existing));
}
function matchPublished(r,spec){
 return Boolean(r&&spec&&same(r,spec.existing,oldFields)&&
  r.kind==='賞金決勝'&&r.prize===spec.existing.prize&&
  parseSources(spec.candidate,r));
}
validateProof();
module.exports={DOC,GOLD,validateProof,matchCandidate,matchPublished,parseSources};
