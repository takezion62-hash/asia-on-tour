'use strict';
// Independent screenshot oracle: fixed Epic UUIDs, prize tables, region, event windows.
const POLICY='tracker-20261115-me-s31-ps-s26-console-zb-ten';
const TARGETS=[
  {
    "id": "s31-me-ps-sypherpk-final-20240902-takobel",
    "date": "2024-09-02",
    "region": "ME",
    "seasonId": "S31",
    "chapter": 5,
    "season": 4,
    "tournamentId": "ch5s4-playstation-sypherpk-cup",
    "event": "PlayStation SypherPK Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S31_PlaystationSypherPKCup",
    "windowId": "S31_PlaystationSypherPKCup_Final_ME",
    "rank": 92,
    "points": 4,
    "matches": 4,
    "kills": 0,
    "vrs": 0,
    "prize": 200,
    "prizePerPlayer": 200,
    "players": [
      "TakoBeL"
    ],
    "profiles": [
      {
        "name": "TakoBeL",
        "raw": "TakoBeL",
        "id": "7e1ee343-4f90-465f-8d17-09b76e5820dd",
        "url": "https://fortnitetracker.com/profile/all/TakoBeL/events?id=7e1ee343-4f90-465f-8d17-09b76e5820dd"
      }
    ],
    "playerRaw": "TakoBeL",
    "screenshot": "スクリーンショット (1830).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S31_PlaystationSypherPKCup_ME?window=S31_PlaystationSypherPKCup_Final_ME",
    "rule": "https://www.fortnite.com/news/playstation-sypherpk-cup-chapter-5-season-4-official-rules"
  },
  {
    "id": "s31-me-ps-sypherpk-final-20240902-solary-kurama",
    "date": "2024-09-02",
    "region": "ME",
    "seasonId": "S31",
    "chapter": 5,
    "season": 4,
    "tournamentId": "ch5s4-playstation-sypherpk-cup",
    "event": "PlayStation SypherPK Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S31_PlaystationSypherPKCup",
    "windowId": "S31_PlaystationSypherPKCup_Final_ME",
    "rank": 94,
    "points": 2,
    "matches": 4,
    "kills": 1,
    "vrs": 0,
    "prize": 200,
    "prizePerPlayer": 200,
    "players": [
      "Solary Kurаmа"
    ],
    "profiles": [
      {
        "name": "Solary Kurаmа",
        "raw": "Solary Kurаmа",
        "id": "1872812e-3050-4d6f-89bc-bd652b1d38d4",
        "url": "https://fortnitetracker.com/profile/all/Solary%20Kur%D0%B0m%D0%B0/events?id=1872812e-3050-4d6f-89bc-bd652b1d38d4"
      }
    ],
    "playerRaw": "Solary Kurаmа",
    "screenshot": "スクリーンショット (1831).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S31_PlaystationSypherPKCup_ME?window=S31_PlaystationSypherPKCup_Final_ME",
    "rule": "https://www.fortnite.com/news/playstation-sypherpk-cup-chapter-5-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-shinou-asuka",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 2,
    "points": 320,
    "matches": 6,
    "kills": 29,
    "vrs": 1,
    "prize": 550,
    "prizePerPlayer": 275,
    "players": [
      "神櫻神遊神楽舞",
      "Asuka"
    ],
    "profiles": [
      {
        "name": "神櫻神遊神楽舞",
        "raw": "神櫻神遊神楽舞",
        "id": "1c3cbd9a-3184-4d4b-b21d-1caaf058692a",
        "url": "https://fortnitetracker.com/profile/all/%E7%A5%9E%E6%AB%BB%E7%A5%9E%E9%81%8A%E7%A5%9E%E6%A5%BD%E8%88%9E/events?id=1c3cbd9a-3184-4d4b-b21d-1caaf058692a"
      },
      {
        "name": "Asuka",
        "raw": "Asuka",
        "id": "c34fb8f4-e6da-4345-a26c-d5bf33847f52",
        "url": "https://fortnitetracker.com/profile/all/Asuka/events?id=c34fb8f4-e6da-4345-a26c-d5bf33847f52"
      }
    ],
    "playerRaw": "神櫻神遊神楽舞 / Asuka",
    "screenshot": "スクリーンショット (1834).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-alive-alivenoah",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 4,
    "points": 273,
    "matches": 6,
    "kills": 26,
    "vrs": 0,
    "prize": 400,
    "prizePerPlayer": 200,
    "players": [
      "alive in love",
      "alivenoah"
    ],
    "profiles": [
      {
        "name": "alive in love",
        "raw": "alive in love",
        "id": "05947195-7690-49a5-943e-b723066352c0",
        "url": "https://fortnitetracker.com/profile/all/alive%20in%20love/events?id=05947195-7690-49a5-943e-b723066352c0"
      },
      {
        "name": "alivenoah",
        "raw": "alivenoah",
        "id": "b433079d-5333-4074-8a8d-e3f88acd073e",
        "url": "https://fortnitetracker.com/profile/all/alivenoah/events?id=b433079d-5333-4074-8a8d-e3f88acd073e"
      }
    ],
    "playerRaw": "alive in love / alivenoah",
    "screenshot": "スクリーンショット (1835).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-hero-rintaro",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 5,
    "points": 241,
    "matches": 6,
    "kills": 29,
    "vrs": 0,
    "prize": 350,
    "prizePerPlayer": 175,
    "players": [
      "ヒロインとオオカミ",
      "りんたろう"
    ],
    "profiles": [
      {
        "name": "ヒロインとオオカミ",
        "raw": "ヒロインとオオカミ",
        "id": "470431d9-756e-4bb7-9ee0-da1d8adab74a",
        "url": "https://fortnitetracker.com/profile/all/%E3%83%92%E3%83%AD%E3%82%A4%E3%83%B3%E3%81%A8%E3%82%AA%E3%82%AA%E3%82%AB%E3%83%9F/events?id=470431d9-756e-4bb7-9ee0-da1d8adab74a"
      },
      {
        "name": "りんたろう",
        "raw": "りんたろう",
        "id": "fba00f00-c834-451d-89b9-4c0ad7aa8e6c",
        "url": "https://fortnitetracker.com/profile/all/%E3%82%8A%E3%82%93%E3%81%9F%E3%82%8D%E3%81%86/events?id=fba00f00-c834-451d-89b9-4c0ad7aa8e6c"
      }
    ],
    "playerRaw": "ヒロインとオオカミ / りんたろう",
    "screenshot": "スクリーンショット (1836).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-kyoukai-kana",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 7,
    "points": 221,
    "matches": 6,
    "kills": 19,
    "vrs": 1,
    "prize": 300,
    "prizePerPlayer": 150,
    "players": [
      "羌瘣.",
      "KanA"
    ],
    "profiles": [
      {
        "name": "羌瘣.",
        "raw": "羌瘣.",
        "id": "b8673bef-7a30-4b79-8e20-a43d346cbab2",
        "url": "https://fortnitetracker.com/profile/all/%E7%BE%8C%E7%98%A3./events?id=b8673bef-7a30-4b79-8e20-a43d346cbab2"
      },
      {
        "name": "KanA",
        "raw": "KanA",
        "id": "ce198d52-d8e4-4400-a8a8-44a769eeccb7",
        "url": "https://fortnitetracker.com/profile/all/KanA/events?id=ce198d52-d8e4-4400-a8a8-44a769eeccb7"
      }
    ],
    "playerRaw": "羌瘣. / KanA",
    "screenshot": "スクリーンショット (1837).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-112345-beautiful",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 24,
    "points": 138,
    "matches": 6,
    "kills": 14,
    "vrs": 0,
    "prize": 0,
    "prizePerPlayer": 0,
    "players": [
      "112345abcde",
      "Beautiful World."
    ],
    "profiles": [
      {
        "name": "112345abcde",
        "raw": "112345abcde",
        "id": "51cac31c-907c-4e66-9bff-771a2c723883",
        "url": "https://fortnitetracker.com/profile/all/112345abcde/events?id=51cac31c-907c-4e66-9bff-771a2c723883"
      },
      {
        "name": "Beautiful World.",
        "raw": "Beautiful World.",
        "id": "9ee21610-5879-4711-ad43-027a7d0e8b9f",
        "url": "https://fortnitetracker.com/profile/all/Beautiful%20World./events?id=9ee21610-5879-4711-ad43-027a7d0e8b9f"
      }
    ],
    "playerRaw": "112345abcde / Beautiful World.",
    "screenshot": "スクリーンショット (1838).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-meip-mar",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 33,
    "points": 72,
    "matches": 6,
    "kills": 6,
    "vrs": 0,
    "prize": 0,
    "prizePerPlayer": 0,
    "players": [
      "Meip",
      "ultrxMarin"
    ],
    "profiles": [
      {
        "name": "Meip",
        "raw": "Meip",
        "id": "4a17f539-3908-4388-95a8-abd1b64e9af5",
        "url": "https://fortnitetracker.com/profile/all/Meip/events?id=4a17f539-3908-4388-95a8-abd1b64e9af5"
      },
      {
        "name": "ultrxMarin",
        "raw": "ultrxMarin",
        "id": "d307074c-3584-4cf8-87ce-e4666cf93a9e",
        "url": "https://fortnitetracker.com/profile/all/ultrxMarin/events?id=d307074c-3584-4cf8-87ce-e4666cf93a9e"
      }
    ],
    "playerRaw": "Meip / ultrxMarin",
    "screenshot": "スクリーンショット (1839).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-raru-mv",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 35,
    "points": 69,
    "matches": 6,
    "kills": 5,
    "vrs": 0,
    "prize": 0,
    "prizePerPlayer": 0,
    "players": [
      "らる",
      "MV.demonking鬼龍覇気"
    ],
    "profiles": [
      {
        "name": "らる",
        "raw": "はあちゃまっちゃまーwwǃǃӜ",
        "id": "3e0dee00-fce0-412d-b865-d2844e1e5317",
        "url": "https://fortnitetracker.com/profile/all/%E3%81%AF%E3%81%82%E3%81%A1%E3%82%83%E3%81%BE%E3%81%A3%E3%81%A1%E3%82%83%E3%81%BE%E3%83%BCww%C7%83%C7%83%D3%9C/events?id=3e0dee00-fce0-412d-b865-d2844e1e5317"
      },
      {
        "name": "MV.demonking鬼龍覇気",
        "raw": "MV.demonking鬼龍覇気",
        "id": "76e9d1fc-92b3-40b0-8340-802609fc4d5c",
        "url": "https://fortnitetracker.com/profile/all/MV.demonking%E9%AC%BC%E9%BE%8D%E8%A6%87%E6%B0%97/events?id=76e9d1fc-92b3-40b0-8340-802609fc4d5c"
      }
    ],
    "playerRaw": "はあちゃまっちゃまーwwǃǃӜ / MV.demonking鬼龍覇気",
    "screenshot": "スクリーンショット (1840).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  },
  {
    "id": "s26-me-zb-console-champions-final-20231030-eliy-p1ng",
    "date": "2023-10-30",
    "region": "ME",
    "seasonId": "S26",
    "chapter": 4,
    "season": 4,
    "tournamentId": "ch4s4-zero-build-console-champions-cup",
    "event": "Zero Build Console Champions Cup",
    "round": "Final / 賞金決勝",
    "eventId": "S26_ConsoleChampionsCupZB",
    "windowId": "S26_ConsoleChampionsCupZB_ME_Final",
    "rank": 46,
    "points": 38,
    "matches": 6,
    "kills": 4,
    "vrs": 0,
    "prize": 0,
    "prizePerPlayer": 0,
    "players": [
      "Eliy",
      "p1ng"
    ],
    "profiles": [
      {
        "name": "Eliy",
        "raw": "Wcr oco",
        "id": "8ed80db4-3547-4bc8-aa97-285ccf7816bb",
        "url": "https://fortnitetracker.com/profile/all/Wcr%20oco/events?id=8ed80db4-3547-4bc8-aa97-285ccf7816bb"
      },
      {
        "name": "p1ng",
        "raw": "p1ng",
        "id": "9766622e-ec65-443f-b8cf-2b860838c19d",
        "url": "https://fortnitetracker.com/profile/all/p1ng/events?id=9766622e-ec65-443f-b8cf-2b860838c19d"
      }
    ],
    "playerRaw": "Wcr oco / p1ng",
    "screenshot": "スクリーンショット (1841).png",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S26_ConsoleChampionsCupZB_ME?window=S26_ConsoleChampionsCupZB_ME_Final",
    "rule": "https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"
  }
];
const RULES={S31:"https://www.fortnite.com/news/playstation-sypherpk-cup-chapter-5-season-4-official-rules",S26:"https://www.fortnite.com/news/console-champions-cup-chapter-4-season-4-official-rules"};
function uuid(value){try{const u=new URL(value),id=u.searchParams.get('id');
return u.origin==='https://fortnitetracker.com'&&u.pathname.startsWith('/profile/all/')&&
/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id||'')?id.toLowerCase():null;}catch{return null;}}
function payout(t){
 if(t.seasonId==='S31'&&t.region==='ME'&&t.date==='2024-09-02'&&
 t.eventId==='S31_PlaystationSypherPKCup'&&t.windowId==='S31_PlaystationSypherPKCup_Final_ME')
  return t.rank>=11&&t.rank<=100?200:null;
 if(t.seasonId==='S26'&&t.region==='ME'&&t.date==='2023-10-30'&&
 t.eventId==='S26_ConsoleChampionsCupZB'&&t.windowId==='S26_ConsoleChampionsCupZB_ME_Final'){
  const exact={1:750,2:550,3:450,4:400,5:350,6:300,7:300,8:250,9:250};
  return exact[t.rank]??(t.rank>=10&&t.rank<=15?200:t.rank>=16&&t.rank<=50?0:null);
 }
 return null;
}
function verifyRow(r,e){
 const t=TARGETS.find(x=>x.id===r?.id);
 if(!t||!r||!e||e.id!==t.id||e.recordId!==t.id||e.policy!==POLICY||
 e.decision!=='published'||e.source!==t.sourceTracker||e.rule!==t.rule||
 payout(t)!==t.prize||t.prize!==t.prizePerPlayer*t.players.length)return false;
 for(const k of ['id','date','region','seasonId','chapter','season','tournamentId','event','round','rank','points','matches','kills','vrs','prize','prizePerPlayer'])
 if(r[k]!==t[k])return false;
 if(r.kind!=='賞金決勝'||r.source!==t.sourceTracker||r.teamPrize!==t.prize||
 r.verified!==true||r.reviewOnly===true||r.player!==t.players.join(' / ')||
 r.playerRaw!==t.playerRaw||JSON.stringify(r.players)!==JSON.stringify(t.players))return false;
 if(!Array.isArray(r.profiles)||r.profiles.length!==t.profiles.length||
 !r.profiles.every((p,i)=>p.name===t.profiles[i].name&&uuid(p.url)===t.profiles[i].id))return false;
 if(!Array.isArray(r.teamAccountIds)||r.teamAccountIds.length!==t.players.length||
 !r.teamAccountIds.every((id,i)=>id===t.profiles[i].id.replace(/-/g,'')))return false;
 return typeof r.note==='string'&&r.note.includes(t.sourceTracker)&&
 r.note.includes(t.rule)&&r.note.includes('各選手$'+t.prizePerPlayer);
}
module.exports={POLICY,TARGETS,RULES,payout,uuid,verifyRow};
