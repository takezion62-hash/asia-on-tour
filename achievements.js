/* ASIA ON TOUR · data-backed achievements and player titles.
 * Read-only: published records are never mutated. No nickname guessing, no cash
 * inference from placements, no skin rewards inferred from tournament entry.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AsiaAchievements = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const REGIONS = ['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR'];
  const FINAL_KINDS = new Set(['賞金決勝', 'Practice決勝', 'Performance決勝', '決勝']);
  const NO_CASH_KINDS = new Set(['予選', 'コスメ大会', 'スキン大会', 'Test Cup']);
  const RANK = { common: 1, rare: 2, epic: 3, legendary: 4 };

  function roster(row) {
    return Array.isArray(row?.players) && row.players.length ? row.players : [row?.player];
  }
  function individualCash(row) {
    if (row?.verified !== true || NO_CASH_KINDS.has(row.kind) || typeof row.prize !== 'number' || !Number.isFinite(row.prize) || row.prize <= 0) return 0;
    const members = roster(row);
    if (!members.length || new Set(members).size !== members.length) return 0;
    if (members.length === 1) return row.prize;
    const share = row.prizePerPlayer;
    return typeof share === 'number' && Number.isFinite(share) && share > 0 && share * members.length <= row.prize + .001 ? share : 0;
  }
  function confirmedSkin(row) {
    return row?.verified === true &&
      ['スキン大会', 'コスメ大会'].includes(row.kind) &&
      String(row.round || '').split(/[\/／·・|｜]/u)
        .some(part => /^(?:スキン|スキン報酬)獲得(?:済み)?$/.test(part.trim()));
  }
  const BASE = [
    {id:'first-trip',icon:'🧭',title:'海外遠征デビュー',description:'確認済みの海外戦績を1件掲載',unit:'件',metric:'records',goal:1,tier:'common',priority:1},
    {id:'traveler-10',icon:'🛫',title:'遠征常連',description:'確認済みの海外戦績を10件掲載',unit:'件',metric:'records',goal:10,tier:'rare',priority:10},
    {id:'veteran-30',icon:'✈️',title:'遠征ベテラン',description:'確認済みの海外戦績を30件掲載',unit:'件',metric:'records',goal:30,tier:'epic',priority:20},
    {id:'three-regions',icon:'🌏',title:'多地域チャレンジャー',description:'3地域で海外戦績を確認',unit:'地域',metric:'regions',goal:3,tier:'rare',priority:17},
    {id:'six-regions',icon:'🌐',title:'世界旅行者',description:'6地域すべてに確認済みの海外戦績',unit:'地域',metric:'regions',goal:6,tier:'legendary',priority:100},
    {id:'first-cash',icon:'💵',title:'海外初賞金',description:'個人受取額が確認できた賞金記録を1件掲載',unit:'件',metric:'paidEvents',goal:1,tier:'rare',priority:23},
    {id:'cash-hunter',icon:'💰',title:'賞金ハンター',description:'個人賞金が確認できた記録を3件掲載',unit:'件',metric:'paidEvents',goal:3,tier:'epic',priority:35},
    {id:'cash-500',icon:'🏆',title:'賞金コレクター',description:'確認済みの個人賞金累計が500 USD',unit:'USD',metric:'cash',goal:500,tier:'epic',priority:40},
    {id:'first-vr',icon:'👑',title:'VRハンター',description:'確認済みの海外VRを1回記録（チーム戦を含む）',unit:'VR',metric:'vrs',goal:1,tier:'rare',priority:24},
    {id:'vr-five',icon:'⚡',title:'VRコレクター',description:'確認済みの海外VRを5回記録（チーム戦を含む）',unit:'VR',metric:'vrs',goal:5,tier:'epic',priority:36},
    {id:'first-final',icon:'🎟️',title:'海外ファイナリスト',description:'確認済みの決勝出場記録が1件',unit:'件',metric:'finals',goal:1,tier:'rare',priority:15},
    {id:'top-ten',icon:'🥇',title:'海外決勝TOP10',description:'確認済みの決勝で総合10位以内を1回記録',unit:'回',metric:'topTens',goal:1,tier:'epic',priority:45},
    {id:'skin-earned',icon:'🎭',title:'スキン獲得者',description:'報酬獲得が明記された確認済みスキン大会記録が1件',unit:'件',metric:'skins',goal:1,tier:'rare',priority:28}
  ];
  const REGIONAL = REGIONS.map((region,i)=>({
    id:'specialist-'+region.toLowerCase(),
    icon:['🏜️','🏰','🌆','🌉','🌊','🌴'][i],
    title:region+'スペシャリスト',
    description:region+'で確認済みの海外戦績が5件',
    unit:'件',metric:'region:'+region,goal:5,tier:'rare',priority:18
  }));
  const CATALOG = Object.freeze([...BASE,...REGIONAL].map(def=>Object.freeze(def)));
  function calculate(records, playerName) {
    const name = typeof playerName === 'string' ? playerName : '';
    const verified = (Array.isArray(records)?records:[]).filter(row=>
      row && row.verified === true && roster(row).includes(name) && name.length > 0);
    const regions = REGIONS.filter(region=>verified.some(row=>row.region===region));
    const paid = verified.filter(row=>individualCash(row)>0);
    const value = {
      records:verified.length,
      regions:regions.length,
      paidEvents:paid.length,
      cash:paid.reduce((sum,row)=>sum+Math.round(individualCash(row)*100),0)/100,
      vrs:verified.reduce((sum,row)=>sum+(Number.isInteger(row.vrs)&&row.vrs>=0?row.vrs:0),0),
      finals:verified.filter(row=>FINAL_KINDS.has(row.kind)&&Number.isInteger(row.rank)&&row.rank>0).length,
      topTens:verified.filter(row=>FINAL_KINDS.has(row.kind)&&Number.isInteger(row.rank)&&row.rank>=1&&row.rank<=10).length,
      skins:verified.filter(confirmedSkin).length
    };
    for (const region of REGIONS) value['region:'+region]=verified.filter(row=>row.region===region).length;
    const achievements=CATALOG.map(def=>{
      const progress=value[def.metric] || 0;
      return {...def,progress,unlocked:progress>=def.goal,remaining:Math.max(0,def.goal-progress)};
    });
    const unlocked=achievements.filter(a=>a.unlocked).sort((a,b)=>RANK[b.tier]-RANK[a.tier]||b.priority-a.priority||a.id.localeCompare(b.id));
    const title=unlocked.slice().sort((a,b)=>b.priority-a.priority||RANK[b.tier]-RANK[a.tier])[0]||null;
    return {
      name,
      metrics:value,
      visitedRegions:regions,
      achievements,
      unlocked,
      title,
      earned:unlocked.length,
      total:CATALOG.length
    };
  }
  return Object.freeze({VERSION:1,REGIONS:Object.freeze(REGIONS),CATALOG,calculate,individualCash,confirmedSkin});
});
