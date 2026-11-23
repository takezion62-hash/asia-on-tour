'use strict';
// Frozen allowlist for 10 source-observed NAW Event 2 Round 2 non-winners.
// This is NOT a generic duo Round 2 auto-approval. Score, roster and UUID
// must match the saved Epic leaderboard before the standard review planner
// may publish a $0 final with an auditable approval record.
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules';
const EVENT='S37_ConsoleDuosCashCups',REGION='NAW',DATE='2025-08-25';
const WINDOW=EVENT+'_Event2Round2_NAW';
const TOURNAMENT='ch6s4-console-duos-victory';
const ROUND='Event 2 · Round 2 / 賞金決勝';
const SPECS=Object.freeze([
  {
    "id": "auto-s37-f1f5e661f29f",
    "player": "3peace / Jaemon",
    "playerRaw": "NEXUS 3peace / Jaemon.K",
    "players": [
      "3peace",
      "Jaemon"
    ],
    "teamAccountIds": [
      "bc21e86cc3cf4761a52906a8e4fd910b",
      "dcc5f4df088a4bcab4058b9b0fb2f97c"
    ],
    "rank": 38,
    "kills": 8,
    "matches": 2,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-5f9eb7fd95be",
    "player": "Saku / れっどうぃんぐ",
    "playerRaw": "A_α さくʕᵔᴥᵔʔ / ptt れっどにゃんぐ",
    "players": [
      "Saku",
      "れっどうぃんぐ"
    ],
    "teamAccountIds": [
      "556abff4657c4b25b743e70b2574f97a",
      "a0562b2dee314a31bd40b897d6a54544"
    ],
    "rank": 44,
    "kills": 12,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-1dd86101bc78",
    "player": "くりたる / TONIGHTREET",
    "playerRaw": "FTW kulitalu 10ǃ / イーザンバロンⅤナス寿郎聖",
    "players": [
      "くりたる",
      "TONIGHTREET"
    ],
    "teamAccountIds": [
      "02463a80d4954907b95d2e0bf0bfa887",
      "4bd5f43c9f784537b345efa0eb941329"
    ],
    "rank": 52,
    "kills": 10,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-ada2a42f94a5",
    "player": "でーもんくらげǃ / すかい",
    "playerRaw": "でーもんくらげǃ / AtlanticSkyx",
    "players": [
      "でーもんくらげǃ",
      "すかい"
    ],
    "teamAccountIds": [
      "1ec763a9ecbf4b1385d3702e7a64b22c",
      "fba14a7d6fc342ba9599c6afa9f2c568"
    ],
    "rank": 94,
    "kills": 7,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-9daba2b8303f",
    "player": "きおらび / めろんなんばーわん",
    "playerRaw": "きおらび / めろんなんばーわん",
    "players": [
      "きおらび",
      "めろんなんばーわん"
    ],
    "teamAccountIds": [
      "7dcdf989faa347fbbab8c2228abb4142",
      "9ad60a80f89b432fa134857d0077251a"
    ],
    "rank": 110,
    "kills": 6,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-82eeb2061b6e",
    "player": "ちからV2 / Rura",
    "playerRaw": "NEXUS ちからV2ǃ / agеnt peterbotǃ",
    "players": [
      "ちからV2",
      "Rura"
    ],
    "teamAccountIds": [
      "2512ed089c99409fb69d2cc3de7c35c6",
      "d5e9dc74c49e4825bd81a9d69056c683"
    ],
    "rank": 112,
    "kills": 6,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-1e4ec01c2420",
    "player": "Dark / VLZ 対面の極意",
    "playerRaw": "dの一族ではありませんǃ / VLZ 対面の極意",
    "players": [
      "Dark",
      "VLZ 対面の極意"
    ],
    "teamAccountIds": [
      "1c6ed629b952401898d7f2f4812411ab",
      "5c8913af3a134f0cb3c9365ee281aada"
    ],
    "rank": 122,
    "kills": 5,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-8f4906a4e4ac",
    "player": "MAT4DOR. / ちゃる",
    "playerRaw": "MAT4DOR. / charufn",
    "players": [
      "MAT4DOR.",
      "ちゃる"
    ],
    "teamAccountIds": [
      "17b382b1e9be42a1b8d5b961c04fa963",
      "e3d0bd7d4b8c4e60ac46564918e3e3a1"
    ],
    "rank": 137,
    "kills": 4,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-2fbcba9c4057",
    "player": "かめてぃん / Asuka",
    "playerRaw": "かめてぃん.魔女 / VOLARE Asuka",
    "players": [
      "かめてぃん",
      "Asuka"
    ],
    "teamAccountIds": [
      "a63f6c3b03304aecb65862c0a45f03a4",
      "c34fb8f4e6da4345a26cd5bf33847f52"
    ],
    "rank": 169,
    "kills": 3,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  },
  {
    "id": "auto-s37-348291159099",
    "player": "りむた / sena",
    "playerRaw": "A_α Rimuta / coolsabdad.xml",
    "players": [
      "りむた",
      "sena"
    ],
    "teamAccountIds": [
      "2b08f9919df14bbd90ae95db167db8cf",
      "f4f0cf26d8e14042a9cc8f731831d1f2"
    ],
    "rank": 170,
    "kills": 3,
    "matches": 3,
    "source": "https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event2Round2_NAW"
  }
].map(s=>Object.freeze(s)));
const byId=new Map(SPECS.map(s=>[s.id,s]));
const decline=reason=>({approved:false,reason});
function decide(row,win,cp,data,rule){
 const spec=byId.get(row?.id);
 if(!spec)return decline('保存済み10組の対象候補ではありません');
 if(!rule||rule.id!==TOURNAMENT||rule.seasonId!=='S37'||
   rule.prizePerVictory!==100||rule.teamPrizePerVictory!==200||
   rule.matchCaps?.['賞金決勝']!==3||!rule.eventIds?.includes(EVENT)||
   rule.source!==RULE)return decline('公式Ruleの0VR賞金規則が一致しません');
 if(!win||win.eventId!==EVENT||win.windowId!==WINDOW||
   win.dateJst!==DATE||win.region!==REGION||win.tournamentId!==TOURNAMENT||
   win.seasonId!=='S37'||win.kind!=='賞金決勝'||win.round!==ROUND)
   return decline('公式開催枠の同定が不一致');
 const catalog=data?.tournaments?.catalog?.find(x=>x.id===TOURNAMENT);
 if(!catalog||catalog.name!=='Duos Console Victory Cash Cup'||
   catalog.team!=='duo'||catalog.series!=='victory-cup'||
   catalog.seasonId!=='S37'||!catalog.sourceEventIds?.includes(EVENT))
   return decline('大会カタログ不一致');
 const fields=['id','player','playerRaw','players','teamAccountIds','rank','kills','matches','source'];
 for(const field of fields){
  if(JSON.stringify(row?.[field])!==JSON.stringify(spec[field]))
   return decline('確定済みの本人ID・人数・成績と異なります: '+field);
 }
 if(row.verified!==true||row.date!==DATE||row.region!==REGION||
   row.tournamentId!==TOURNAMENT||row.seasonId!=='S37'||
   row.kind!=='賞金決勝'||row.round!==ROUND||
   row.event!=='Duos Console Victory Cash Cup'||
   row.prize!==null||row.vrs!==0||row.points!==0||
   !Number.isSafeInteger(row.rank)||row.rank<1||
   !Number.isSafeInteger(row.kills)||row.kills<0||
   !Number.isSafeInteger(row.matches)||row.matches<1||row.matches>3||
   row.reviewOnly===true)
   return decline('0VR・$0決勝候補の条件が不一致');
 if(row.players.length!==2||row.player!==row.players.join(' / ')||
   new Set(row.players).size!==2||
   row.teamAccountIds.length!==2||
   new Set(row.teamAccountIds).size!==2||
   row.teamAccountIds.some(id=>!/^[a-f0-9]{32}$/.test(id))||
   row.players.some(name=>!data.players?.candidates?.some(x=>x.name===name)))
   return decline('デュオの本人Epic ID・名鑑が照合できません');
 let url;
 try{url=new URL(row.source)}catch{return decline('公式出典URLの形式が不正')}
 if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
   url.username||url.password||url.hash||
   url.pathname!=='/competitive/events/'+EVENT+'/'||
   url.searchParams.get('region')!==REGION||
   url.searchParams.get('round')!==WINDOW)
   return decline('Epic公式Round 2出典が不一致');
 if(!cp||cp.rankingOrderValid!==true||
   cp.emptyAttempts>0||cp.lastError||cp.lastErrorCode||cp.retryAfter||
   !Array.isArray(cp.proposals)||
   !cp.proposals.some(x=>sameScannedCandidate(x,row))||
   (cp.complete!==true&&!verifiedPartialPage(row,win,cp)))
   return decline('元順位表の取得済み連続ページが未検証');
 if(!Number.isFinite(win.end)||Date.now()-win.end<4*3600000)
   return decline('大会終了後の成熟期間が不足');
 if((data.results||[]).some(old=>old.id===row.id||
   (old.date===DATE&&old.region===REGION&&old.tournamentId===TOURNAMENT&&
    old.source===row.source&&old.player===row.player)))
   return decline('同一決勝戦績が掲載済み');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 return {approved:true,record:{...base,prize:0,
  note:'2025-08-25 NAW Duos Console Victory Cash Cup Event 2 Round 2。'+
   '本人2名のEpic ID、取得済み連続順位表上の順位・試合数・キル・0VRを照合。'+
   '公式規則は決勝1VRにつき各選手$100、0VRなので各選手$0。'+
   '順位表の未取得ページや他チームの結果は推定しない。出典: '+row.source+
   ' 規則: '+RULE},rule:RULE};
}
module.exports={decide,SPECS,RULE,WINDOW};
