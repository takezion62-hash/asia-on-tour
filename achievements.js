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

  // One evolving badge per progression track. All tiers derive from verified
  // published records; no separate persisted unlock state is needed.
  const EVOLUTION_TIERS = Object.freeze([
    Object.freeze({id:'bronze',label:'BRONZE',display:'ブロンズ'}),
    Object.freeze({id:'silver',label:'SILVER',display:'シルバー'}),
    Object.freeze({id:'gold',label:'GOLD',display:'ゴールド'}),
    Object.freeze({id:'platinum',label:'PLATINUM',display:'プラチナ'}),
    Object.freeze({id:'prismatic',label:'PRISMATIC',display:'プリズマティック'})
  ]);
  const EVOLUTION_TRACKS = Object.freeze([
    {id:'expeditions',icon:'🧭',label:'海外遠征',description:'出典確認済みの掲載戦績数',metric:'records',unit:'件',priority:40,
      steps:[[1,'海外遠征デビュー'],[10,'遠征常連'],[30,'遠征ベテラン'],[60,'遠征マスター'],[100,'遠征レジェンド']]},
    {id:'earnings',icon:'💰',label:'海外賞金',description:'個人受取額が確認済みの現金賞金合計',metric:'cash',unit:'USD',priority:85,
      steps:[[1,'海外初賞金'],[500,'賞金コレクター'],[2000,'賞金ハンター'],[5000,'賞金エリート'],[10000,'賞金レジェンド']]},
    {id:'victories',icon:'👑',label:'VR記録',description:'確認済みのVictory Royale合計（チーム戦を含む）',metric:'vrs',unit:'VR',priority:80,
      steps:[[1,'VRハンター'],[5,'VRコレクター'],[15,'VRエース'],[30,'VRマスター'],[60,'VRレジェンド']]},
    {id:'regions',icon:'🌏',label:'遠征地域',description:'掲載済みの海外地域の種類（最大6地域）',metric:'regions',unit:'地域',priority:100,
      steps:[[1,'海外挑戦者'],[3,'多地域チャレンジャー'],[4,'クロスリージョン'],[5,'グローバルトラベラー'],[6,'世界旅行者']]},
    {id:'finals',icon:'🏆',label:'決勝出場',description:'確認済みの決勝出場記録（順位あり）',metric:'finals',unit:'件',priority:70,
      steps:[[1,'海外ファイナリスト'],[5,'決勝常連'],[15,'決勝エース'],[30,'決勝マスター'],[60,'決勝レジェンド']]},
    {id:'skins',icon:'🎭',label:'スキン獲得',description:'報酬獲得が明記されたスキン大会記録',metric:'skins',unit:'件',priority:55,
      steps:[[1,'スキン獲得者'],[3,'スキンコレクター'],[10,'スキンエース'],[20,'スキンマスター'],[40,'スキンレジェンド']]}
  ].map(track=>Object.freeze({...track,steps:Object.freeze(track.steps.map(([goal,title],index)=>Object.freeze({
    goal,title,tier:EVOLUTION_TIERS[index].id,tierLabel:EVOLUTION_TIERS[index].display,index:index+1
  })))})));
  function calculateEvolution(metrics) {
    const tracks=EVOLUTION_TRACKS.map(track=>{
      const value=Math.max(0,Number(metrics[track.metric])||0);
      const achieved=track.steps.filter(step=>value>=step.goal);
      const level=achieved.length;
      const current=achieved.at(-1)||null;
      const next=track.steps[level]||null;
      const start=current?.goal||0;
      const percent=next?Math.min(100,Math.max(0,Math.round((value-start)/(next.goal-start)*100))):100;
      return {
        id:track.id,icon:track.icon,label:track.label,description:track.description,
        metric:track.metric,unit:track.unit,priority:track.priority,value,level,
        current,next,remaining:next?Math.max(0,next.goal-value):0,
        percent,milestones:track.steps,completed:level===track.steps.length
      };
    });
    const featured=tracks.filter(track=>track.level>0).sort((a,b)=>b.level-a.level||b.priority-a.priority||a.id.localeCompare(b.id))[0]||null;
    return {
      tracks,
      featured,
      activeTracks:tracks.filter(track=>track.level>0).length,
      completedTracks:tracks.filter(track=>track.completed).length,
      earnedStages:tracks.reduce((sum,track)=>sum+track.level,0),
      totalStages:tracks.reduce((sum,track)=>sum+track.milestones.length,0)
    };
  }

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
      total:CATALOG.length,
      evolution:calculateEvolution(value)
    };
  }
  return Object.freeze({VERSION:2,REGIONS:Object.freeze(REGIONS),CATALOG,EVOLUTION_TIERS,EVOLUTION_TRACKS,calculate,calculateEvolution,individualCash,confirmedSkin});
});
