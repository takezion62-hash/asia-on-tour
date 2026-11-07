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
      const percent=next?(value<=start?0:Math.min(99,Math.max(1,Math.round((value-start)/(next.goal-start)*100)))):100;
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


  // Unusual accomplishments are evaluated from explicit, verified archive
  // fields. A session-level kill/VR value is never treated as per-match data;
  // team results are team totals, never inferred individual eliminations.
  const SPECIAL_TIERS = Object.freeze({
    rare:Object.freeze({label:'RARE',name:'レア',order:1}),
    epic:Object.freeze({label:'EPIC',name:'エピック',order:2}),
    legendary:Object.freeze({label:'LEGENDARY',name:'レジェンダリー',order:3})
  });
  // KILLS in an archive record are tournament-session totals. Duos/trios use
  // complete, distinct roster lists; solo-only rows require a confirmed solo
  // tournament (catalog or explicit "Solo" in its event title). Unknown or
  // contradictory formats are deliberately ineligible for this badge.
  const DESTRUCTION_KILLS = Object.freeze({solo:65,duo:120,trio:150});
  function confirmedKillFormat(row, catalog=[]) {
    if(!row || typeof row!=='object')return null;
    const matches=Array.isArray(catalog)?catalog.filter(t=>t&&t.name===row.event&&['solo','duo','trio'].includes(t.team)
      &&(!row.seasonId||t.seasonId===row.seasonId)):[];
    const types=[...new Set(matches.map(t=>t.team))];
    const known=types.length===1?types[0]:null;
    if(types.length>1)return null;
    const members=Array.isArray(row.players)&&row.players.length?row.players:null;
    if(members && (members.length<1||members.length>3||members.some(n=>typeof n!=='string'||!n.trim())||new Set(members).size!==members.length))return null;
    if(!members && (typeof row.player!=='string'||!row.player.trim()||/\s+\/\s+/.test(row.player)))return null;
    const size=members?.length||1;
    const format=['solo','duo','trio'][size-1];
    if(!format || (known&&known!==format))return null;
    if(format==='solo'&&!known&&!/\bsolo\b/i.test(String(row.event||'')))return null;
    return format;
  }
  // The specialist award is one per region, with an evolving lifetime tier.
  // Keep the original IDs so saved links and published badge references work.
  const SPECIALIST_GOALS = Object.freeze([5,10,20,40,80]);
  const SPECIALIST_NAMES = Object.freeze(['スペシャリスト','エキスパート','マスター','レジェンド','の覇者']);
  const SPECIALIST_RARITIES = Object.freeze(['rare','rare','epic','epic','legendary']);
  const WEAPON_MILESTONES = Object.freeze([
    Object.freeze({goal:2,title:'二刀流',rarity:'epic'}),
    Object.freeze({goal:3,title:'三刀流',rarity:'epic'}),
    Object.freeze({goal:4,title:'四刀流',rarity:'legendary'})
  ]);
  // Lifetime confirmed solo KILLS, separate from 破壊神's single-session record.
  const SOLO_KILL_MILESTONES = Object.freeze([
    Object.freeze({goal:20,title:'孤独な追跡者',rarity:'rare',tier:'bronze'}),
    Object.freeze({goal:50,title:'孤高の狩人',rarity:'rare',tier:'silver'}),
    Object.freeze({goal:100,title:'戦場の死神',rarity:'epic',tier:'gold'}),
    Object.freeze({goal:200,title:'百戦の支配者',rarity:'epic',tier:'platinum'}),
    Object.freeze({goal:300,title:'孤高の覇王',rarity:'legendary',tier:'prismatic'})
  ]);
  const TEAM_FORMATS = Object.freeze(['solo','duo','trio','squad']);
  const TEAM_FORMAT_LABELS = Object.freeze({solo:'ソロ',duo:'デュオ',trio:'トリオ',squad:'スクワッド'});
  function confirmedPrizeFormat(row,catalog=[]) {
    if(!row||typeof row!=='object')return null;
    const title=String(row.event||'');
    const matches=Array.isArray(catalog)?catalog.filter(t=>t&&t.name===title&&TEAM_FORMATS.includes(t.team)
      &&(!row.seasonId||t.seasonId===row.seasonId)):[];
    const known=[...new Set(matches.map(t=>t.team))];
    if(known.length>1)return null;
    const members=Array.isArray(row.players)&&row.players.length?row.players:null;
    if(members && (members.length<1||members.length>4||members.some(n=>typeof n!=='string'||!n.trim())||new Set(members).size!==members.length))return null;
    if(!members&&(typeof row.player!=='string'||!row.player.trim()||/\s+\/\s+/.test(row.player)))return null;
    const format=TEAM_FORMATS[(members?.length||1)-1]||null;
    if(!format||(known.length===1&&known[0]!==format))return null;
    // A complete duo/trio/squad roster is evidence of team size even if
    // tournament metadata is missing. Solo requires a named or catalog match.
    const titleSolo=/\bsolos?\b/i.test(title);
    if(format!=='solo'&&titleSolo)return null;
    if(format==='solo'&&known[0]!=='solo'&&!titleSolo)return null;
    return format;
  }
  function progression(value, milestones) {
    const current=milestones.filter(stage=>value>=stage.goal).at(-1)||null;
    const level=current?milestones.indexOf(current)+1:0;
    const next=milestones[level]||null;
    const start=current?.goal||0;
    const percent=next?(value<=start?0:Math.min(99,Math.max(1,Math.round((value-start)/(next.goal-start)*100)))):100;
    return {level,current,next,remaining:next?Math.max(0,next.goal-value):0,percent,
      maxed:level===milestones.length,stages:milestones};
  }

  // Tournament-format badges use catalog metadata first; an explicit name
  // provides a conservative fallback when no catalog entry matches.
  function tournamentMatches(row,catalog=[]) {
    return Array.isArray(catalog)?catalog.filter(t=>t&&t.name===row.event
      &&(!row.seasonId||t.seasonId===row.seasonId)):[];
  }
  function confirmedMode(row,catalog,predicate,fallback) {
    const matches=tournamentMatches(row,catalog);
    if(matches.length)return matches.every(predicate);
    return fallback.test(String(row.event||''));
  }
  function isReloadEvent(row,catalog) {
    return confirmedMode(row,catalog,t=>['reload','reload-zero-build'].includes(t.mode),/\breload\b/i);
  }
  function isZeroBuildEvent(row,catalog) {
    return confirmedMode(row,catalog,t=>['zero-build','reload-zero-build'].includes(t.mode),/\b(?:zero[ -]?build|zb)\b/i);
  }
  function isFNCSEvent(row,catalog) {
    return confirmedMode(row,catalog,t=>t.series==='fncs',/^(?:FNCS\b|Fortnite Champion Series\b)/i);
  }
  function dayNumber(value) {
    if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return null;
    const day=new Date(value+'T00:00:00Z');
    return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===value
      ?Math.floor(day.getTime()/86400000):null;
  }
  function eventIdentity(row) {
    if(dayNumber(row.date)===null||!REGIONS.includes(row.region)
      ||typeof row.event!=='string'||!row.event.trim())return null;
    return [row.date,row.region,row.event,row.seasonId||''].join('\u001f');
  }
  // Return the strongest qualifying group, counting each region/event once
  // within the inclusive date window. No inferred times or player identities.
  function bestDateWindow(rows,days,keyOf) {
    const sorted=rows.filter(row=>dayNumber(row.date)!==null&&REGIONS.includes(row.region))
      .sort((a,b)=>a.date.localeCompare(b.date)||String(a.id||'').localeCompare(String(b.id||'')));
    let best=[];
    for(let i=0;i<sorted.length;i++){
      const start=dayNumber(sorted[i].date),keys=new Set(),candidate=[];
      for(let j=i;j<sorted.length;j++){
        if(dayNumber(sorted[j].date)-start>=days)break;
        const key=keyOf(sorted[j]);
        if(key!=null&&!keys.has(key)){keys.add(key);candidate.push(sorted[j]);}
      }
      if(candidate.length>best.length)best=candidate;
    }
    return best;
  }
  function uniqueTournamentRows(rows) {
    const used=new Set();
    return rows.filter(row=>{const key=eventIdentity(row);if(!key||used.has(key))return false;used.add(key);return true;});
  }

  const SPECIAL_CATALOG = Object.freeze([
    {id:'silent-earner',icon:'🥷',title:'静かなる賞金稼ぎ',description:'KILLSが明確に0の掲載戦績で、個人の現金賞金を獲得',rarity:'epic',goal:1},
    {id:'pacifist-vr',icon:'🕊️',title:'戦わずして勝つ',description:'KILLSが明確に0の掲載戦績でVRを獲得（チーム戦はチーム合計）',rarity:'legendary',goal:1},
    {id:'one-kill-earner',icon:'🎯',title:'一撃の価値',description:'KILLSが明確に1の掲載戦績で、個人の現金賞金を獲得',rarity:'rare',goal:1},
    {id:'solo-kill-mastery',icon:'🐺',title:'孤独な追跡者',description:'確認済みソロ大会の掲載KILLSを全期間で累計。キル数に応じて5段階に進化',rarity:'rare',goal:20,unit:'K'},
    {id:'twenty-kills',icon:'🔥',title:'破壊神',description:'1件の掲載大会戦績でソロ65K／デュオ120K／トリオ150K以上（チーム戦はチーム合計）',rarity:'epic',goal:1},
    {id:'final-champion',icon:'🏆',title:'海外制覇',description:'確認済みの海外大会決勝で総合1位',rarity:'legendary',goal:1},
    {id:'cash-three-regions',icon:'🌎',title:'越境マネーメーカー',description:'異なる海外3地域で個人の現金賞金を獲得',rarity:'legendary',goal:3,unit:'地域'},
    {id:'solo-and-team-cash',icon:'⚔️',title:'二刀流',description:'ソロ・デュオ・トリオ・スクワッドのうち異なる2形式以上で個人の現金賞金を獲得',rarity:'epic',goal:2,unit:'形式'},
    {id:'skin-and-cash',icon:'🎭',title:'文武両道',description:'スキン報酬獲得と個人の現金賞金獲得を両方確認',rarity:'rare',goal:2,unit:'条件'},
    {id:'vr-three-regions',icon:'🌏',title:'旅先の勝者',description:'異なる海外3地域でVRを確認（チーム戦を含む）',rarity:'legendary',goal:3,unit:'地域'},
    {id:'vr-and-cash',icon:'✨',title:'ダブルクラウン',description:'同じ掲載戦績でVRと個人の現金賞金を両方確認',rarity:'rare',goal:1},
    {id:'top-ten',icon:'🥇',title:'海外決勝TOP10',description:'確認済みの海外大会決勝で総合10位以内',rarity:'epic',goal:1},
    // New special awards: all derived from confirmed archive records.
    {id:'final-kill-tyrant',icon:'⚔️',title:'決勝の暴君',description:'海外ソロ大会の決勝セッションで30K以上を記録',rarity:'epic',goal:1},
    {id:'final-runner-up',icon:'🥈',title:'あと一歩の英雄',description:'海外大会の決勝で総合2位を獲得',rarity:'epic',goal:1},
    {id:'podium-streak',icon:'🏅',title:'表彰台の常連',description:'異なる海外大会の決勝で総合TOP3を累計3回',rarity:'epic',goal:3},
    {id:'cash-windfall',icon:'💸',title:'一攫千金',description:'1大会戦績で個人現金賞金500 USD以上を獲得',rarity:'epic',goal:1},
    {id:'cash-chain',icon:'🔗',title:'賞金連鎖',description:'30日以内（両端の日付差30日以内）に異なる海外3大会で個人現金賞金を獲得',rarity:'epic',goal:3},
    {id:'same-day-traveler',icon:'🌍',title:'時差を駆ける者',description:'同じ日に異なる海外2地域で確認済み戦績を記録',rarity:'epic',goal:2,unit:'地域'},
    {id:'same-day-cash',icon:'💎',title:'ダブル遠征賞金王',description:'同じ日に異なる海外2地域で個人現金賞金を獲得',rarity:'legendary',goal:2,unit:'地域'},
    {id:'reload-regular',icon:'🧱',title:'リロードの申し子',description:'海外Reload大会の確認済み掲載戦績が累計10件',rarity:'rare',goal:10},
    {id:'no-vr-cash',icon:'🎯',title:'勝たずして稼ぐ',description:'VRが明確に0の大会戦績で個人現金賞金を獲得',rarity:'epic',goal:1},
    {id:'zero-build-champion',icon:'🛡️',title:'ゼロビルドの覇者',description:'海外Zero Build大会の決勝で総合1位を獲得',rarity:'epic',goal:1},
    {id:'fncs-finalist',icon:'🏟️',title:'世界への挑戦状',description:'海外FNCS本大会・Division・Practiceの決勝で順位付き戦績を記録（スキン大会は除外）',rarity:'epic',goal:1},
    {id:'seven-day-traveler',icon:'🗺️',title:'七日間の旅人',description:'連続する7日間以内に異なる海外3地域で戦績を記録',rarity:'legendary',goal:3,unit:'地域'},
    ...REGIONS.map((region,index)=>({
      id:'specialist-'+region.toLowerCase(),
      icon:['🏜️','🏰','🌆','🌉','🌊','🌴'][index],
      title:region+'スペシャリスト',
      description:region+'での確認済み海外戦績が増えるほど称号が5段階で進化',
      rarity:'rare',goal:5,unit:'件',region
    }))
  ].map(def=>Object.freeze({unit:'件',...def})));
  function specialRecordEvidence(row) {
    return {id:String(row.id||''),date:String(row.date||''),region:String(row.region||''),event:String(row.event||''),kind:String(row.kind||'')};
  }
  function computeSpecial(verified, catalog=[]) {
    const paid=verified.filter(row=>individualCash(row)>0);
    const withVR=verified.filter(row=>Number.isInteger(row.vrs)&&row.vrs>0);
    const skins=verified.filter(confirmedSkin);
    const uniqueRegions=rows=>{
      const byRegion=new Map();
      for(const row of rows)if(REGIONS.includes(row.region)&&!byRegion.has(row.region))byRegion.set(row.region,row);
      return [...byRegion.values()];
    };
    const specials=SPECIAL_CATALOG.map(def=>{
      let evidence=[];
      let progress=0;
      switch(def.id){
        case 'silent-earner': evidence=paid.filter(row=>row.kills===0);break;
        case 'pacifist-vr': evidence=withVR.filter(row=>row.kills===0);break;
        case 'one-kill-earner': evidence=paid.filter(row=>row.kills===1);break;
        case 'solo-kill-mastery':{
          const seenIds=new Set();
          evidence=verified.filter(row=>{
            if(confirmedKillFormat(row,catalog)!=='solo'||!Number.isInteger(row.kills)||row.kills<0
              ||!row.id||seenIds.has(row.id))return false;
            seenIds.add(row.id);
            return true;
          }).sort((a,b)=>b.kills-a.kills||String(a.id).localeCompare(String(b.id)));
          break;
        }
        case 'twenty-kills': evidence=verified.filter(row=>{const format=confirmedKillFormat(row,catalog);return Number.isInteger(row.kills)&&format!=null&&row.kills>=DESTRUCTION_KILLS[format];});break;
        case 'final-champion': evidence=verified.filter(row=>FINAL_KINDS.has(row.kind)&&row.rank===1);break;
        case 'cash-three-regions': evidence=uniqueRegions(paid);break;
        case 'solo-and-team-cash':{
          const byFormat=new Map();
          for(const row of paid){
            const team=confirmedPrizeFormat(row,catalog);
            if(team&&!byFormat.has(team))byFormat.set(team,row);
          }
          evidence=TEAM_FORMATS.filter(team=>byFormat.has(team)).map(team=>byFormat.get(team));
          break;
        }
        case 'skin-and-cash': evidence=[skins[0],paid[0]].filter(Boolean);break;
        case 'vr-three-regions': evidence=uniqueRegions(withVR);break;
        case 'vr-and-cash': evidence=paid.filter(row=>Number.isInteger(row.vrs)&&row.vrs>0);break;
        case 'top-ten': evidence=verified.filter(row=>FINAL_KINDS.has(row.kind)&&Number.isInteger(row.rank)&&row.rank>=1&&row.rank<=10);break;
        case 'final-kill-tyrant': evidence=verified.filter(row=>FINAL_KINDS.has(row.kind)
          &&confirmedKillFormat(row,catalog)==='solo'&&Number.isInteger(row.kills)&&row.kills>=30);break;
        case 'final-runner-up': evidence=verified.filter(row=>FINAL_KINDS.has(row.kind)&&row.rank===2);break;
        case 'podium-streak': evidence=uniqueTournamentRows(verified.filter(row=>FINAL_KINDS.has(row.kind)
          &&Number.isInteger(row.rank)&&row.rank>=1&&row.rank<=3));break;
        case 'cash-windfall': evidence=paid.filter(row=>individualCash(row)>=500);break;
        case 'cash-chain': evidence=bestDateWindow(paid,31,eventIdentity);break;
        case 'same-day-traveler': evidence=bestDateWindow(verified,1,row=>row.region);break;
        case 'same-day-cash': evidence=bestDateWindow(paid,1,row=>row.region);break;
        case 'reload-regular':{
          const seen=new Set();
          evidence=verified.filter(row=>row.id&&!seen.has(row.id)&&isReloadEvent(row,catalog)
            &&(seen.add(row.id),true));break;
        }
        case 'no-vr-cash': evidence=paid.filter(row=>row.vrs===0);break;
        case 'zero-build-champion': evidence=verified.filter(row=>FINAL_KINDS.has(row.kind)
          &&row.rank===1&&isZeroBuildEvent(row,catalog));break;
        case 'fncs-finalist': evidence=verified.filter(row=>FINAL_KINDS.has(row.kind)
          &&Number.isInteger(row.rank)&&row.rank>0&&isFNCSEvent(row,catalog));break;
        case 'seven-day-traveler': evidence=bestDateWindow(verified,7,row=>row.region);break;
        default: evidence=def.region?verified.filter(row=>row.region===def.region):[];break;
      }
      const isSoloKills=def.id==='solo-kill-mastery';
      progress=isSoloKills?evidence.reduce((sum,row)=>sum+row.kills,0):evidence.length;
      const isSpecialist=Boolean(def.region);
      const isWeapons=def.id==='solo-and-team-cash';
      const milestones=isSpecialist?SPECIALIST_GOALS.map((goal,index)=>({
        goal,title:def.region+(index===4?'の覇者':SPECIALIST_NAMES[index]),
        tier:EVOLUTION_TIERS[index].id,rarity:SPECIALIST_RARITIES[index]
      })):isWeapons?WEAPON_MILESTONES:isSoloKills?SOLO_KILL_MILESTONES:null;
      const growth=milestones?progression(progress,milestones):null;
      const active=growth?.current;
      const rarity=active?.rarity||def.rarity;
      const title=active?.title||def.title;
      const goal=growth?(growth.next?.goal||growth.current?.goal||def.goal):def.goal;
      return {...def,title,goal,rarity,unlocked:progress>=def.goal,progress,
        remaining:Math.max(0,goal-progress),
        rarityLabel:SPECIAL_TIERS[rarity].name,
        ...(growth?{growth}:{}),
        evidence:evidence.slice(0,isWeapons?4:3).map(row=>({ ...specialRecordEvidence(row),
          ...(isWeapons?{teamFormat:confirmedPrizeFormat(row,catalog)}:{}),
          ...(isSoloKills?{kills:row.kills,killFormat:'solo'}:{}),
          ...(def.id==='final-kill-tyrant'?{kills:row.kills,killFormat:'solo'}:{}),
          ...(def.id==='cash-windfall'?{personalCash:individualCash(row)}:{}),
          ...(def.id==='twenty-kills'?{
            kills:row.kills,killFormat:confirmedKillFormat(row,catalog),killThreshold:DESTRUCTION_KILLS[confirmedKillFormat(row,catalog)]
          }:{})
        }))};
    });
    specials.sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)||SPECIAL_TIERS[b.rarity].order-SPECIAL_TIERS[a.rarity].order||a.title.localeCompare(b.title,'ja'));
    return {achievements:specials,unlocked:specials.filter(a=>a.unlocked),locked:specials.filter(a=>!a.unlocked),
      earned:specials.filter(a=>a.unlocked).length,total:specials.length};
  }

  // Separate secret gallery. A hidden badge is never rendered with a real
  // title or detailed requirement until the verified archive unlocks it.
  const SECRET_CATALOG = Object.freeze([
    {id:'silent-crown',icon:'🕊️',title:'無音の王冠',hint:'勝利に、銃声は必要ない',
      description:'ソロ決勝の同一掲載戦績で0K・0VR・確認済み個人現金賞金を同時達成',
      rarity:'legendary',difficulty:'極高'},
    {id:'golden-strike',icon:'🎯',title:'黄金の一撃',hint:'たった一撃が運命を変えた',
      description:'ソロ決勝の同一掲載戦績で1K・1VR以上・確認済み個人現金賞金を同時達成',
      rarity:'legendary'},
    {id:'death-coronation',icon:'💀',title:'死神の戴冠',hint:'勝者であり、狩人でもある',
      description:'ソロ決勝の同一掲載戦績で総合1位・30K以上・確認済み個人現金賞金を同時達成',
      rarity:'legendary'},
    {id:'three-world-shadow',icon:'🌌',title:'三界を渡る影',hint:'一日のうちに、世界を三度渡った',
      description:'同じ開催日に異なる海外3地域で確認済み戦績を記録',
      rarity:'legendary'},
    {id:'triple-gold',icon:'💎',title:'三重の黄金',hint:'三つの世界から黄金を持ち帰る',
      description:'同じ開催日に異なる海外3地域で確認済み個人現金賞金を獲得',
      rarity:'legendary',sealed:true},
    {id:'six-region-bounty',icon:'🌐',title:'六界の賞金首',hint:'もはや逃げ場は、どこにもない',
      description:'ME・EU・NAC・NAW・OCE・BRの海外6地域すべてで個人現金賞金を獲得',
      rarity:'legendary'},
    {id:'borderless-champion',icon:'👑',title:'国境なき王者',hint:'王座に国境は存在しない',
      description:'異なる海外3地域の大会決勝でそれぞれ総合1位を記録',
      rarity:'legendary'},
    {id:'returning-phoenix',icon:'🔥',title:'不死鳥の遠征',hint:'時を超え、再び戦場へ',
      description:'同じ海外地域で365日以上離れた日付の大会から個人現金賞金を獲得',
      rarity:'epic'},
    {id:'light-and-shadow',icon:'🎭',title:'光と影の双貌',hint:'静寂と破壊、二つの顔を持つ者',
      description:'確認済みソロ戦績で0K・個人賞金獲得と、別のソロ大会セッションで65K以上を両方記録',
      rarity:'legendary',sealed:true},
    {id:'double-crown-miracle',icon:'⚡',title:'双冠の奇跡',hint:'二つの戦場で、二つの王冠を掲げた',
      description:'同じ開催日に異なる海外2地域それぞれの同一戦績でVRと個人現金賞金を両方獲得',
      rarity:'legendary'}
  ].map(x=>Object.freeze({goal:1,unit:'条件',...x})));

  function calculateSecretEvidence(verified,catalog=[]) {
    const paid=verified.filter(row=>individualCash(row)>0);
    const solo=row=>confirmedKillFormat(row,catalog)==='solo';
    const isFinal=row=>FINAL_KINDS.has(row.kind);
    const validCashDay=row=>dayNumber(row.date)!==null&&REGIONS.includes(row.region);
    const pickOnePerRegion=rows=>{
      const seen=new Set();
      return rows.filter(row=>REGIONS.includes(row.region)&&!seen.has(row.region)&&(seen.add(row.region),true));
    };
    const sameDayRegions=rows=>bestDateWindow(rows,1,row=>row.region);
    const results=SECRET_CATALOG.map(def=>{
      let evidence=[];
      switch(def.id){
        case 'silent-crown':
          evidence=paid.filter(row=>isFinal(row)&&solo(row)&&row.kills===0&&row.vrs===0);
          break;
        case 'golden-strike':
          evidence=paid.filter(row=>isFinal(row)&&solo(row)&&row.kills===1&&Number.isInteger(row.vrs)&&row.vrs>=1);
          break;
        case 'death-coronation':
          evidence=paid.filter(row=>isFinal(row)&&solo(row)&&row.rank===1&&Number.isInteger(row.kills)&&row.kills>=30);
          break;
        case 'three-world-shadow':
          evidence=sameDayRegions(verified);
          break;
        case 'triple-gold':
          evidence=sameDayRegions(paid);
          break;
        case 'six-region-bounty':
          evidence=pickOnePerRegion(paid);
          break;
        case 'borderless-champion':
          evidence=pickOnePerRegion(verified.filter(row=>isFinal(row)&&row.rank===1));
          break;
        case 'returning-phoenix':{
          const byRegion=new Map();
          for(const row of paid){
            if(!validCashDay(row))continue;
            const entries=byRegion.get(row.region)||[];
            entries.push(row);
            byRegion.set(row.region,entries);
          }
          for(const [region,entries] of byRegion){
            entries.sort((a,b)=>a.date.localeCompare(b.date));
            if(entries.length<2)continue;
            const first=entries[0],last=entries[entries.length-1];
            if(dayNumber(last.date)-dayNumber(first.date)>=365){
              evidence=[first,last];
              break;
            }
          }
          break;
        }
        case 'light-and-shadow':{
          const zero=paid.find(row=>solo(row)&&row.kills===0);
          const destruction=verified.find(row=>solo(row)&&Number.isInteger(row.kills)&&row.kills>=65&&row.id!==zero?.id);
          if(zero&&destruction)evidence=[zero,destruction];
          break;
        }
        case 'double-crown-miracle':
          evidence=sameDayRegions(paid.filter(row=>Number.isInteger(row.vrs)&&row.vrs>0));
          break;
      }
      const goal=def.id==='three-world-shadow'||def.id==='triple-gold'||def.id==='borderless-champion'?3:
        def.id==='six-region-bounty'?6:def.id==='returning-phoenix'||def.id==='light-and-shadow'||def.id==='double-crown-miracle'?2:1;
      const unlocked=evidence.length>=goal;
      return {...def,goal,progress:evidence.length,unlocked,
        remaining:Math.max(0,goal-evidence.length),
        rarityLabel:SPECIAL_TIERS[def.rarity].name,
        evidence:unlocked?evidence.slice(0,6).map(row=>({
          ...specialRecordEvidence(row),
          ...(Number.isInteger(row.kills)?{kills:row.kills}:{}),
          ...(Number.isInteger(row.vrs)?{vrs:row.vrs}:{}),
          ...(individualCash(row)>0?{personalCash:individualCash(row)}:{})
        })):[]
      };
    });
    return {
      achievements:results,
      unlocked:results.filter(b=>b.unlocked),
      locked:results.filter(b=>!b.unlocked),
      earned:results.filter(b=>b.unlocked).length,
      total:results.length,
      visibleLocked:results.filter(b=>!b.unlocked&&!b.sealed)
    };
  }
  function calculateSecret(records,playerName,options={}) {
    const verified=typeof playerName==='string'&&playerName
      ?(Array.isArray(records)?records:[]).filter(row=>row&&row.verified===true&&roster(row).includes(playerName))
      :[];
    return calculateSecretEvidence(verified,options.catalog);
  }

  function calculateSpecial(records,playerName,options={}) {
    if(typeof playerName!=='string'||!playerName)return computeSpecial([],options.catalog);
    const verified=(Array.isArray(records)?records:[]).filter(row=>row&&row.verified===true&&roster(row).includes(playerName));
    return computeSpecial(verified,options.catalog);
  }

  function calculate(records, playerName, options={}) {
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
      evolution:calculateEvolution(value),
      special:computeSpecial(verified,options.catalog),
      secret:calculateSecretEvidence(verified,options.catalog)
    };
  }
  return Object.freeze({VERSION:7,REGIONS:Object.freeze(REGIONS),CATALOG,EVOLUTION_TIERS,EVOLUTION_TRACKS,SPECIAL_TIERS,SPECIAL_CATALOG,SECRET_CATALOG,calculate,calculateSpecial,calculateSecret,calculateEvolution,confirmedKillFormat,confirmedPrizeFormat,DESTRUCTION_KILLS,SPECIALIST_GOALS,SPECIALIST_NAMES,WEAPON_MILESTONES,SOLO_KILL_MILESTONES,TEAM_FORMATS,TEAM_FORMAT_LABELS,individualCash,confirmedSkin});
});
