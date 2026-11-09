'use strict';
// One-off *reviewed* batch, no guesses: exact Epic IDs & live rank checks.
// Incomplete $1M Unreal Cup boards stay pending until every page is verified.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {linkedAccounts,getLeaderboard,normalizeRow}=require('./osirion-sync.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const assert=(condition,why)=>{if(!condition)throw Error('AOT_ROUND2_SAFETY '+why)};
const members=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r.player];
const names=r=>members(r).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('\u001f');
const numeric=['rank','points','kills','vrs','matches'];
const EXPECTED=Object.freeze([{"id":"auto-s43-9d42693207cd","player":"たろくん風呂やねー / lef.lef","region":"EU","date":"2026-11-07","tournamentId":"ch7s5-one-piece-zoro-cup-zero-build","round":"単一開催枠 / 参加確認","rank":363,"points":447,"kills":17,"vrs":1,"matches":11,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S43_OnePieceZoroCup_ZB/?region=EU&round=S43_OnePieceZoroCup_ZB_EU"},{"id":"auto-s43-37b3d4421c8d","player":"Acris rqxzr11 / hoimin","region":"EU","date":"2026-11-07","tournamentId":"ch7s5-one-piece-zoro-cup-zero-build","round":"単一開催枠 / 参加確認","rank":374,"points":446,"kills":61,"vrs":2,"matches":11,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S43_OnePieceZoroCup_ZB/?region=EU&round=S43_OnePieceZoroCup_ZB_EU"},{"id":"auto-s42-d0e7d0fff043","player":"nezah / あいりす","region":"NAW","date":"2026-10-26","tournamentId":"ch7s4-inoxtag-icon-cup-battle-royale","round":"単一開催枠 / 参加確認","rank":11,"points":458,"kills":34,"vrs":2,"matches":7,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_InoxtagIconCup/?region=NAW&round=S42_InoxtagIconCup_NAW"},{"id":"auto-s42-4f2f19eeaa06","player":"すらふ / そーすきむ","region":"NAW","date":"2026-10-26","tournamentId":"ch7s4-inoxtag-icon-cup-battle-royale","round":"単一開催枠 / 参加確認","rank":19,"points":424,"kills":49,"vrs":2,"matches":7,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_InoxtagIconCup/?region=NAW&round=S42_InoxtagIconCup_NAW"},{"id":"auto-s42-3d6463648572","player":"いるえもん / ARIKA","region":"NAW","date":"2026-10-26","tournamentId":"ch7s4-inoxtag-icon-cup-battle-royale","round":"単一開催枠 / 参加確認","rank":62,"points":374,"kills":42,"vrs":2,"matches":9,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_InoxtagIconCup/?region=NAW&round=S42_InoxtagIconCup_NAW"},{"id":"auto-s42-f3b4beadcf78","player":"Esosa Vee / 覚醒EX極","region":"NAW","date":"2026-10-26","tournamentId":"ch7s4-inoxtag-icon-cup-battle-royale","round":"単一開催枠 / 参加確認","rank":73,"points":369,"kills":40,"vrs":1,"matches":11,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_InoxtagIconCup/?region=NAW&round=S42_InoxtagIconCup_NAW"},{"id":"auto-s42-ca9c5d891437","player":"falcon manzuǃ / ns tmu","region":"NAW","date":"2026-10-26","tournamentId":"ch7s4-inoxtag-icon-cup-battle-royale","round":"単一開催枠 / 参加確認","rank":81,"points":367,"kills":24,"vrs":1,"matches":10,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_InoxtagIconCup/?region=NAW&round=S42_InoxtagIconCup_NAW"},{"id":"auto-s42-536315d52b2a","player":"めいる","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 2 / 賞金決勝","rank":1014,"points":0,"kills":1,"vrs":0,"matches":2,"kind":"賞金決勝","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round2_NAC"},{"id":"auto-s42-4398d47bf98b","player":"きみが死ぬまで恋をしたいɞ","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 2 / 賞金決勝","rank":1048,"points":0,"kills":1,"vrs":0,"matches":2,"kind":"賞金決勝","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round2_NAC"},{"id":"auto-s42-bda63d2f8b6f","player":"ぽいずん","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 2 / 賞金決勝","rank":1073,"points":0,"kills":1,"vrs":0,"matches":3,"kind":"賞金決勝","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round2_NAC"},{"id":"auto-s42-d56aa63522e6","player":"VLZ 対面の極意","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 2 / 賞金決勝","rank":1131,"points":0,"kills":1,"vrs":0,"matches":3,"kind":"賞金決勝","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round2_NAC"},{"id":"auto-s42-4e37bcbc4ad7","player":"Dartri","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 2 / 賞金決勝","rank":1463,"points":0,"kills":0,"vrs":0,"matches":2,"kind":"賞金決勝","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round2_NAC"},{"id":"auto-s42-3b7f227601f0","player":"tzd Misosqnda","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 2 / 賞金決勝","rank":1857,"points":0,"kills":0,"vrs":0,"matches":2,"kind":"賞金決勝","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round2_NAC"},{"id":"auto-s42-3e7b4bb853a6","player":"tzd Misosqnda","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1043,"points":187,"kills":16,"vrs":0,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-c9769dc6d347","player":"Marikoro きーさんの弟","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1165,"points":183,"kills":16,"vrs":1,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-417d45ba6d85","player":"miru","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1234,"points":181,"kills":34,"vrs":1,"matches":4,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-690155dcd74a","player":"きみが死ぬまで恋をしたいɞ","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1287,"points":180,"kills":18,"vrs":0,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-f1359f439d7c","player":"ЯGN Pinobot ǃ","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1514,"points":174,"kills":34,"vrs":0,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-5d1a73d35f84","player":"青ヘッドホンスーモくん","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1546,"points":173,"kills":18,"vrs":1,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-120059d7cdac","player":"ホーリーファカオくん","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1599,"points":172,"kills":16,"vrs":0,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-ac8718eeb935","player":"めいる","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1639,"points":171,"kills":24,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-ecedf8ff89bd","player":"北条時行respectなGORI","region":"NAW","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1791,"points":167,"kills":14,"vrs":1,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAW"},{"id":"auto-s42-701f04a5be18","player":"Marikoro きーさんの弟","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1191,"points":197,"kills":13,"vrs":1,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAC"},{"id":"auto-s42-4cea5c3a3e95","player":"りむた","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1304,"points":195,"kills":4,"vrs":0,"matches":5,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAC"},{"id":"auto-s42-22d2853eba20","player":"Dartri","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1566,"points":189,"kills":0,"vrs":0,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAC"},{"id":"auto-s42-319c71f0f671","player":"ホーリーファカオくん","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1593,"points":188,"kills":11,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAC"},{"id":"auto-s42-29732163ebad","player":"ЯGN Pinobot ǃ","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1670,"points":186,"kills":33,"vrs":2,"matches":5,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAC"},{"id":"auto-s42-3857e5844d83","player":"ぽいずん","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1776,"points":184,"kills":9,"vrs":0,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAC"},{"id":"auto-s42-be9c4690ddc4","player":"偽キノコ","region":"NAC","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":1820,"points":183,"kills":14,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAC&round=S42_ConsoleVCC_SolosZB_Event8Round1_NAC"},{"id":"auto-s42-d7572e6813bb","player":"朝比奈まふゆӝ","region":"BR","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 2 / 賞金決勝","rank":679,"points":0,"kills":1,"vrs":0,"matches":3,"kind":"賞金決勝","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=BR&round=S42_ConsoleVCC_SolosZB_Event8Round2_BR"},{"id":"auto-s42-65d851b94e0d","player":"朝比奈まふゆӝ","region":"BR","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":3,"points":303,"kills":13,"vrs":1,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=BR&round=S42_ConsoleVCC_SolosZB_Event8Round1_BR"},{"id":"auto-s42-b694ad29003a","player":"はむたろう","region":"BR","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":143,"points":232,"kills":9,"vrs":1,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=BR&round=S42_ConsoleVCC_SolosZB_Event8Round1_BR"},{"id":"auto-s42-71542614317d","player":"たらこ唇","region":"BR","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":256,"points":221,"kills":5,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=BR&round=S42_ConsoleVCC_SolosZB_Event8Round1_BR"},{"id":"auto-s42-ea923c967b61","player":"ぬぬぬぬぬぬぬぬwww覚醒WWW","region":"BR","date":"2026-10-25","tournamentId":"ch7s4-console-zero-build-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":916,"points":188,"kills":24,"vrs":0,"matches":8,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=BR&round=S42_ConsoleVCC_SolosZB_Event8Round1_BR"},{"id":"auto-s39-c71a2ed8749f","player":"Dark / こーくん","region":"NAC","date":"2025-12-21","tournamentId":"ch7s1-one-million-unreal-cup","round":"単一開催枠 / 参加確認","rank":705,"points":273,"kills":33,"vrs":0,"matches":9,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=NAC&round=S39_1MillionUnrealCup_NAC"},{"id":"auto-s39-6080516837cb","player":"BRNw x4lly sǃ / Celis やなぎさわつつ上等","region":"NAC","date":"2025-12-21","tournamentId":"ch7s1-one-million-unreal-cup","round":"単一開催枠 / 参加確認","rank":839,"points":268,"kills":13,"vrs":1,"matches":10,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=NAC&round=S39_1MillionUnrealCup_NAC"},{"id":"auto-s39-04061d8fd305","player":"Rabbit / Silent","region":"NAC","date":"2025-12-21","tournamentId":"ch7s1-one-million-unreal-cup","round":"単一開催枠 / 参加確認","rank":1201,"points":257,"kills":22,"vrs":1,"matches":10,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=NAC&round=S39_1MillionUnrealCup_NAC"},{"id":"auto-s39-3919abca3a94","player":"ももち / らいちん","region":"NAC","date":"2025-12-21","tournamentId":"ch7s1-one-million-unreal-cup","round":"単一開催枠 / 参加確認","rank":1218,"points":257,"kills":15,"vrs":0,"matches":9,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=NAC&round=S39_1MillionUnrealCup_NAC"},{"id":"auto-s42-96301a6ea435","player":"じんくん","region":"OCE","date":"2026-09-25","tournamentId":"ch7s4-override-persona-5-royal-cup-reload","round":"単一開催枠 / 参加確認","rank":42,"points":385,"kills":22,"vrs":1,"matches":9,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_Persona5Cup/?region=OCE&round=S42_Persona5Cup_OCE"},{"id":"auto-s30-d6bb0f59c808","player":"huggyfv","region":"ME","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":803,"points":138,"kills":15,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=ME&round=S30_SoloVictoryCashCup_Event8Round1_ME"},{"id":"auto-s30-3ef5ca72953b","player":"渡良瀬佳乃","region":"ME","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":807,"points":138,"kills":3,"vrs":1,"matches":3,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=ME&round=S30_SoloVictoryCashCup_Event8Round1_ME"},{"id":"auto-s30-abbb70c8ad95","player":"Silent","region":"ME","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":821,"points":138,"kills":11,"vrs":0,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=ME&round=S30_SoloVictoryCashCup_Event8Round1_ME"},{"id":"auto-s30-e6b19ac81022","player":"Job","region":"ME","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":846,"points":137,"kills":13,"vrs":1,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=ME&round=S30_SoloVictoryCashCup_Event8Round1_ME"},{"id":"auto-s30-bef7f3c86829","player":"モバイル勢のまかろん","region":"ME","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":886,"points":136,"kills":7,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=ME&round=S30_SoloVictoryCashCup_Event8Round1_ME"},{"id":"auto-s30-3e8082fe67dd","player":"Melon","region":"ME","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":928,"points":135,"kills":5,"vrs":1,"matches":4,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=ME&round=S30_SoloVictoryCashCup_Event8Round1_ME"},{"id":"auto-s30-ae665deae0c4","player":"favsie","region":"ME","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":985,"points":134,"kills":20,"vrs":0,"matches":5,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=ME&round=S30_SoloVictoryCashCup_Event8Round1_ME"},{"id":"auto-s30-db83d2a7a0aa","player":"どんぐり","region":"NAC","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":424,"points":176,"kills":4,"vrs":0,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=NAC&round=S30_SoloVictoryCashCup_Event8Round1_NAC"},{"id":"auto-s30-7eb381176452","player":"TONIGHTREET","region":"NAC","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":467,"points":174,"kills":15,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=NAC&round=S30_SoloVictoryCashCup_Event8Round1_NAC"},{"id":"auto-s30-56d5cafb78b6","player":"ぱな","region":"NAC","date":"2024-08-06","tournamentId":"ch5s3-solo-victory-cup","round":"Event 8 · Round 1 / 予選","rank":468,"points":174,"kills":12,"vrs":1,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloVictoryCashCup/?region=NAC&round=S30_SoloVictoryCashCup_Event8Round1_NAC"},{"id":"auto-s42-3b06d375c222","player":"Reo / あくりあ / huggyfv","region":"NAC","date":"2026-10-02","tournamentId":"ch7s4-performance-evaluation-trios","round":"Event 6 · Round 1 / 参加確認","rank":858,"points":42,"kills":12,"vrs":0,"matches":5,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_PerformanceEvaluationTrios/?region=NAC&round=S42_PerformanceEvaluation_Event6Round1_NAC"},{"id":"auto-s42-b0bbf274178e","player":"ひろ / そみー / Plank","region":"NAC","date":"2026-10-02","tournamentId":"ch7s4-performance-evaluation-trios","round":"Event 6 · Round 1 / 参加確認","rank":901,"points":28,"kills":2,"vrs":0,"matches":8,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_PerformanceEvaluationTrios/?region=NAC&round=S42_PerformanceEvaluation_Event6Round1_NAC"},{"id":"auto-s40-8c20156046f0","player":"huggyfv / rakirye","region":"ME","date":"2026-05-05","tournamentId":"ch7s2-fncs-division-1","round":"単一開催枠 / 参加確認","rank":202,"points":99,"kills":3,"vrs":0,"matches":7,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_FNCSDivisionalCup_Division1/?region=ME&round=S40_FNCSDivisionalCup_Division1_Week3Day1_ME"},{"id":"auto-s40-dad1d598bc5b","player":"meah / RiaM","region":"ME","date":"2026-05-05","tournamentId":"ch7s2-fncs-division-1","round":"単一開催枠 / 参加確認","rank":259,"points":3,"kills":1,"vrs":0,"matches":2,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_FNCSDivisionalCup_Division1/?region=ME&round=S40_FNCSDivisionalCup_Division1_Week3Day1_ME"},{"id":"auto-s30-ad977b21cb5c","player":"Aim","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":209,"points":138,"kills":30,"vrs":0,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-3991065eadd5","player":"hoimin","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":213,"points":138,"kills":11,"vrs":0,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-98428d7d0179","player":"まろやかれおちゃあいと","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":242,"points":135,"kills":30,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-ee32b4a30964","player":"えるなのくろちゃあんりぽよー","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":264,"points":131,"kills":11,"vrs":1,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-a72acbe57f09","player":"favsie","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":265,"points":131,"kills":11,"vrs":1,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-a4f91241d992","player":"あくりあ","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":271,"points":131,"kills":9,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-08c4533a8fa8","player":"Karf","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":279,"points":130,"kills":9,"vrs":1,"matches":6,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-2162f1181efb","player":"らる","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":283,"points":130,"kills":10,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-9374074402ef","player":"ns tmu","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":286,"points":130,"kills":5,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-dc628ed11325","player":"Raito","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":291,"points":129,"kills":36,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-012585c2a675","player":"Stain","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":303,"points":128,"kills":31,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-878b6010e0c2","player":"りんたろう","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":304,"points":128,"kills":23,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-fbdbf7943116","player":"ふぃる","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":307,"points":128,"kills":6,"vrs":1,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-328f566bb520","player":"ホーリーファカオくん","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":313,"points":128,"kills":10,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-bca6215f8915","player":"angelwing","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":376,"points":123,"kills":7,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s30-7ff0f0b25a5f","player":"どんぐり","region":"ME","date":"2024-06-18","tournamentId":"ch5s3-zb-solo-victory","round":"Event 3 · Round 1 / 予選","rank":389,"points":122,"kills":12,"vrs":0,"matches":7,"kind":"予選","prize":0,"source":"https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=ME&round=S30_SoloZBVictoryCashCup_Event3Round1_ME"},{"id":"auto-s42-cf57afb11827","player":"FTW 僕は最低だドビュ / mint","region":"OCE","date":"2026-10-09","tournamentId":"ch7s4-street-fighter-cup-reload","round":"単一開催枠 / 参加確認","rank":29,"points":527,"kills":109,"vrs":5,"matches":10,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S42_StreetFighterCup/?region=OCE&round=S42_StreetFighterCup_OCE"},{"id":"auto-s36-85a20a40a527","player":"すかい","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":2,"points":240,"kills":16,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-dd864197cec4","player":"AUR t3eny 19ǃ","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":16,"points":163,"kills":10,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-3c858021ebda","player":"3peace","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":36,"points":110,"kills":1,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-76b163aee5ab","player":"Mofu","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":38,"points":106,"kills":3,"vrs":1,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-fd406c83c45f","player":"fuwa","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":43,"points":101,"kills":3,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-10759b59d2d3","player":"なつあいせぶん","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":46,"points":93,"kills":1,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-3eb2cb5327ae","player":"Saku","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":48,"points":90,"kills":3,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-a77a640b375c","player":"EXV mAximum24","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":58,"points":67,"kills":4,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-623ca1686ba1","player":"Aim","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":60,"points":56,"kills":4,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-5602fbc08f39","player":"ごちおです","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":61,"points":51,"kills":6,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-d6e7b7a3ec2d","player":"めいる","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":63,"points":49,"kills":3,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-480ec42cdf3c","player":"Hagane","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":65,"points":48,"kills":1,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-135accd63979","player":"ちゃる","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":68,"points":45,"kills":2,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-f29eaa6406ca","player":"Botえもん","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":71,"points":40,"kills":3,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-3e75ec6ffa02","player":"ぱな","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":76,"points":28,"kills":0,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-46c3f019d517","player":"Reeton120fps-","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":83,"points":14,"kills":2,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s36-8fc7b1bdf272","player":"ゆらぎ","region":"NAW","date":"2025-07-28","tournamentId":"ch6s3-playstation-cup","round":"Final / 参加確認","rank":92,"points":0,"kills":0,"vrs":0,"matches":3,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAW&round=S36_PlayStationCup_Final_NAW"},{"id":"auto-s40-326739c52d44","player":"めいる","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":4,"points":100,"kills":9,"vrs":1,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-8374c972baab","player":"3peace","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":17,"points":0,"kills":9,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-b7401961720b","player":"モバイル勢のまかろん","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":29,"points":0,"kills":8,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-d7c28c69cb6e","player":"ゴーゴーチャンスいぶき","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":34,"points":0,"kills":1,"vrs":0,"matches":1,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-cccaa25e42b6","player":"れっどうぃんぐ","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":39,"points":0,"kills":5,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-2f4caeb6383d","player":"DX Nicolas67","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":48,"points":0,"kills":4,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-9d4b3736a9f5","player":"えありー","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":69,"points":0,"kills":2,"vrs":0,"matches":5,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-e80e79e363b4","player":"かぷせるてぃーてぃーTTていてい","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":71,"points":0,"kills":2,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-8f7c4e4ee894","player":"Jaemon","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":75,"points":0,"kills":2,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-a24a8a18ea6f","player":"なぎ","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":79,"points":0,"kills":2,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-7f1315bb19a8","player":"tzd Misosqnda","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":82,"points":0,"kills":1,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-4d58f75003b8","player":"ごんた","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":84,"points":0,"kills":1,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-b40e2d8f46f7","player":"まっちゃやけん","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":87,"points":0,"kills":0,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"},{"id":"auto-s40-223d5fe57374","player":"Dartri","region":"NAW","date":"2026-05-03","tournamentId":"ch7s2-playstation-clix-cup-br","round":"Final / 参加確認","rank":92,"points":0,"kills":0,"vrs":0,"matches":6,"kind":"参加確認","prize":null,"source":"https://www.fortnite.com/competitive/events/S40_PlayStationCupClix/?region=NAW&round=S40_PlayStationCupClix_Final_NAW"}]);
const liveEvents=Object.freeze({
 'ch7s5-one-piece-zoro-cup-zero-build':{eventId:'S43_OnePieceZoroCup_ZB',region:'EU',page:3,cutoff:525},
 'ch7s4-inoxtag-icon-cup-battle-royale':{eventId:'S42_InoxtagIconCup',region:'NAW',page:0,cutoff:120}
});
const onlyReview=new Set([
 'ch7s4-performance-evaluation-trios','ch7s2-fncs-division-1',
 'ch7s4-street-fighter-cup-reload','ch7s4-override-persona-5-royal-cup-reload',
 'ch7s4-inoxtag-icon-cup-battle-royale','ch7s5-one-piece-zoro-cup-zero-build',
 'ch6s3-playstation-cup','ch7s2-playstation-clix-cup-br'
]);
const safeDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
 !Number.isNaN(Date.parse(d));
const getWindow=s=>{try{const u=new URL(s);return u.searchParams.get('round')||
  u.searchParams.get('window')||null}catch{return null}};
const sameTeam=(a,b)=>a.date===b.date&&a.region===b.region&&
 a.tournamentId===b.tournamentId&&names(a)===names(b);
// Some manually curated single-session cosmetic and PS final rows were saved
// with a Tracker URL rather than the Epic round ID. Do not make two different
// rounds collide just because the team and date match.
function sameWindow(a,b,cat){
 if(!sameTeam(a,b))return false;
 const wa=getWindow(a.source),wb=getWindow(b.source);
 if(wa&&wb)return wa===wb;
 const r1=/Round\s*1|_Round1|予選|Qualifier/i;
 const r2=/Round\s*2|_Round2|賞金決勝|Final/i;
 const bText=String(b.round||'')+' '+String(wb||'');
 const aText=String(a.round||'')+' '+String(wa||'');
 if(r1.test(bText)&&r2.test(aText))return false;
 if(r2.test(bText)&&r1.test(aText))return false;
 if(['skin-cup','icon-cup','unreal-cup'].includes(cat.series))return true;
 // PS finals are the only relevant PS single event at that date; a qualifier
 // never shares the same local day with its final in these archived sessions.
 if(cat.series==='playstation-cup'&&(/Final/i.test(bText)||/Final|Round\s*2/i.test(aText)))return true;
 return false; // unknown source round: hold instead of assuming duplicate
}
function originalEvidence(row,db,archives){
 assert(row.verified===true&&/^auto-s\d+-[0-9a-f]{12}$/.test(row.id),'candidate identity '+row.id);
 assert(numeric.every(k=>Number.isSafeInteger(row[k])&&row[k]>=(k==='matches'||k==='rank'?1:0))&&
  row.vrs<=row.matches,'invalid score '+row.id);
 assert(safeDate(row.date)&&['ME','EU','NAC','NAW','OCE','BR'].includes(row.region),'date/region '+row.id);
 const cat=db.tournaments.catalog.find(t=>t.id===row.tournamentId);
 assert(cat&&cat.name===row.event&&cat.seasonId===row.seasonId,
  'event catalog '+row.id);
 const size={solo:1,duo:2,trio:3,squad:4}[cat.team],people=members(row);
 assert(size&&people.length===size&&new Set(people).size===size&&
  row.player===people.join(' / ')&&
  people.every(p=>db.players.candidates.some(v=>v.name===p)),
  'verified canonical roster '+row.id);
 const idMap=new Map(db.accounts.map(a=>[a.epicAccountId,a.player]));
 if(row.teamAccountIds){
  assert(row.teamAccountIds.length===size&&
   row.teamAccountIds.every((id,i)=>idMap.get(id)===people[i]),
   'Epic identifiers mismatch '+row.id);
 }
 let u;try{u=new URL(row.source)}catch{}
 assert(u&&u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
   !u.username&&!u.password&&!u.hash,'source host '+row.id);
 const eventId=decodeURIComponent(u.pathname.split('/')[3]||''),window=u.searchParams.get('round');
 assert(cat.sourceEventIds.includes(eventId)&&window&&window.startsWith(row.seasonId+'_')&&
   window.endsWith('_'+row.region)&&u.searchParams.get('region')===row.region,'source window '+row.id);
 const key='epicgames_'+eventId+'_'+row.region+'/'+window;
 let cp=null;
 for(const scope of ['auto','history']){
  const current=db.scans[scope].windows[key];
  if(!current?.proposals?.some(p=>p.id===row.id&&sameScannedCandidate(p,row)))continue;
  if(!cp||Number(current.complete)>Number(cp.complete)||current.pages>cp.pages)cp=current;
 }
 assert(cp&&cp.rankingOrderValid===true&&Number.isSafeInteger(cp.pages)&&cp.pages>0&&
   Number.isSafeInteger(cp.nextPage)&&cp.nextPage>=1&&
   Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=row.rank&&
   !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&!cp.emptyAttempts,
   'source leaderboard integrity '+row.id);
 const observed=Date.parse(cp.lastSuccessAt||'');
 assert(Number.isFinite(observed)&&observed>=Date.parse(row.date+'T00:00:00Z')+4*3600000,
  'provider not settled '+row.id);
 const month=row.date.slice(0,7);
 if(!archives[month])archives[month]=read('calendar-history/'+month+'.json').sessions;
 const session=archives[month].filter(s=>s.sourceWindowId===window&&s.eventId===eventId&&
  s.tournamentId===row.tournamentId&&s.seasonId===row.seasonId&&
  s.region===row.region&&s.dateJst===row.date);
 assert(session.length===1,'calendar date and window '+row.id);
 return {cat,cp,eventId,window,session:session[0]};
}
function buildRecord(row,proof){
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 let record={...base},claim='';
 if(['ch5s3-solo-victory-cup','ch5s3-zb-solo-victory'].includes(row.tournamentId)){
  assert(row.seasonId==='S30'&&proof.cat.team==='solo'&&row.kind==='予選'&&
   row.prize===0&&row.matches<=7&&/Round1_/.test(proof.window),
   'S30 Victory qualifier session '+row.id);
  // Never treat being shown in a partial Round1 board as proof of advancing.
  record.kind='予選';record.prize=0;
  claim='2024年公式Victory Cup予選の参加・順位を記録。予選突破の断定なし、予選現金賞金$0';
 }else if(row.tournamentId==='ch7s2-playstation-clix-cup-br'){
  assert(row.seasonId==='S40'&&row.region==='NAW'&&proof.cat.team==='solo'&&
   proof.window==='S40_PlayStationCupClix_Final_NAW'&&row.kind==='参加確認'&&
   row.prize===null&&row.vrs===0&&row.matches<=6&&proof.cp.complete,
   'S40 PS Clix NAW no-VR official final '+row.id);
  record.kind='賞金決勝';record.round='Final / 賞金決勝';record.prize=0;
  claim='Epic公式規則はNAW決勝で1VRにつき個人$250。本人0VRなので賞金$0。スキン獲得の有無は別';
 }else if(['ch7s4-performance-evaluation-trios','ch7s2-fncs-division-1'].includes(row.tournamentId)){
  assert(onlyReview.has(row.tournamentId)&&row.kind==='参加確認'&&row.prize===null&&
   row.reviewOnly===true,'unsupported tournament qualification '+row.id);
  record.kind='参加確認';record.prize=null;
  claim='出場・順位・実測値のみ確認。現金賞金・予選突破は推定しない';
 }else{
  throw Error('not allowed to publish this series without dedicated rule: '+row.tournamentId);
 }
 record.note='ChatGPT 2026-11-09の出典再検証：保存済みOsirion順位表とEpic開催枠、'
  +row.region+' '+row.rank+'位 '+row.points+'pt '+row.kills+'K '+row.vrs+'VR / '+row.matches+
  '試合、確認済み選手名、重複を照合。'+claim+'。ソース: '+row.source;
 return record;
}
async function currentLiveRanks(db,rows){
 const accounts=new Map(db.accounts.map(x=>[x.epicAccountId,x.player])),ret=new Map(),errors=[];
 for(const [type,info] of Object.entries(liveEvents)){
  const target=rows.filter(r=>r.tournamentId===type);
  if(!target.length)continue;
  const win={fullEventId:'epicgames_'+info.eventId+'_'+info.region,
   eventId:info.eventId,region:info.region,
   windowId:info.eventId+'_'+info.region,
   key:'epicgames_'+info.eventId+'_'+info.region+'/'+info.eventId+'_'+info.region};
  try{
   const l=await getLeaderboard(win,info.page),hits=new Set();
   assert(Array.isArray(l.entries)&&l.entries.length>0,'live page empty '+type);
   for(const e of l.entries){
    const actual=normalizeRow(e,win);
    if(!actual)continue;
    const knownNames=actual.teamAccountIds.map(id=>accounts.get(id)||'unverified');
    const matches=target.filter(t=>
      names(t)===knownNames.slice().sort((a,b)=>a.localeCompare(b,'ja')).join('\u001f')&&
      t.points===actual.points&&t.kills===actual.kills&&
      t.vrs===actual.vrs&&t.matches===actual.matches);
    if(matches.length!==1)continue;
    const chosen=matches[0];
    if(!Number.isSafeInteger(e.rank)||e.rank<1||e.rank>info.cutoff||hits.has(chosen.id))continue;
    ret.set(chosen.id,{rank:e.rank,points:actual.points,kills:actual.kills,vrs:actual.vrs,
      matches:actual.matches,source:'Osirion live Epic window '+win.windowId+' page '+info.page,
      identities:knownNames.length,cutoff:info.cutoff});
    hits.add(chosen.id);
   }
  }catch(e){errors.push({type,error:String(e.message||e).slice(0,190)})}
 }
 return {ranks:ret,errors};
}
async function main(){
 const db={results:read('results.json'),players:read('players.json'),
  tournaments:read('tournaments.json'),updates:read('updates.json'),
  reviewed:read('history-sync-reviewed.json'),
  reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
  statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
  scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')}};
 db.accounts=linkedAccounts({results:db.results,players:db.players}).accounts;
 assert(db.accounts.length>=400,'too few strictly confirmed Epic IDs');
 const queue=new Map(),conflicted=new Set();
 for(const scope of ['auto','history'])for(const row of db.reviews[scope].proposals){
  const old=queue.get(row.id);
  if(old&&!sameScannedCandidate(old,row))conflicted.add(row.id);
  else if(!old)queue.set(row.id,row);
 }
 const live=await currentLiveRanks(db,[...queue.values()]);
 const archives={},now=new Date().toISOString(),
  taken=new Set(db.reviewed.entries.map(x=>x.id)),
  ids=new Set(db.results.map(x=>x.id)),
  touched=new Set(),added=[],rankFixed=[],already=[],held=[],notFound=[];
 for(const expected of EXPECTED){
  const row=queue.get(expected.id);
  if(!row){
   if(ids.has(expected.id)||taken.has(expected.id))already.push({id:expected.id,why:'previously resolved'});
   else notFound.push(expected.id);
   continue;
  }
  if(conflicted.has(row.id)||!Object.keys(expected).every(k=>Object.is(expected[k],row[k]))){
   held.push({id:row.id,why:'current score/identity differs from frozen reviewed candidate'});continue;
  }
  if(taken.has(row.id)||ids.has(row.id)){
   touched.add(row.id);already.push({id:row.id,why:'ID already published'});continue;
  }
  let proof;
  try{proof=originalEvidence(row,db,archives)}catch(e){held.push({id:row.id,why:String(e.message)});continue}
  if(row.tournamentId==='ch7s1-one-million-unreal-cup'){
   held.push({id:row.id,why:'100-page Unreal Cup session not fully verified; keep possible official payout pending'});continue;
  }
  const candidates=db.results.filter(r=>sameWindow(r,row,proof.cat));
  if(candidates.length>1){
   held.push({id:row.id,why:'multiple existing records for the same team and session'});continue;
  }
  if(candidates.length===1){
   const old=candidates[0];
   const sameScores=['points','kills','vrs'].every(k=>old[k]===row[k])&&
     (old.matches==null||old.matches===row.matches);
   if(!sameScores){held.push({id:row.id,why:'existing team score differs from exact Epic row'});continue}
   let fixed=false,prior=null;
   if(old.rank!==row.rank){
    const latest=live.ranks.get(row.id);
    if(!latest||old.kind!=='スキン大会'||old.prize!==0||
       !Object.hasOwn(liveEvents,row.tournamentId)){
     held.push({id:row.id,why:'rank differs but current provider/skin evidence is insufficient'});continue;
    }
    prior=old.rank;old.rank=latest.rank;fixed=true;
    if(old.matches==null)old.matches=row.matches;
    old.note='2026-11-09に最新Osirion/Epic順位表で同一の確認済みチームEpic ID・'
      +row.points+'pt / '+row.kills+'K / '+row.vrs+'VR / '+row.matches+'試合を再照合。'
      +'旧掲載'+prior+'位→確定照合'+latest.rank+'位へ修正。'
      +'登録済みのスキン報酬圏内記録・現金賞金$0はそのまま。'
      +'コスメの実際の配布は未確認。公式開催枠: '+row.source;
    rankFixed.push({id:row.id,existingId:old.id,player:row.player,before:prior,after:latest.rank});
   }else if(old.matches==null){
    old.matches=row.matches;
   }
   touched.add(row.id);already.push({id:row.id,why:fixed?'rank aligned with live Epic':'matched existing result'});
   db.reviewed.entries.push({id:row.id,recordId:old.id,decision:fixed?'rank-reconciled':'already-published',
    reviewedAt:now,approvedBy:'ChatGPT reviewed source recheck 2026-11-09',
    source:row.source,evidence:fixed?'Re-fetched exact Epic/Osirion page with both confirmed IDs and matching team score; preserved cosmetic payout':
     'Existing official event/roster/rank/statistics; kept any previous verified reward',previousRank:prior,
    newRank:fixed?old.rank:undefined});
   taken.add(row.id);
   continue;
  }
  // Other ambiguous manual results still block, even if their round label is incomplete.
  const ambiguous=db.results.filter(x=>collision(x,row,db.players.confirmedAliases));
  if(ambiguous.length){
   held.push({id:row.id,why:'ambiguous existing record '+ambiguous.map(x=>x.id).join(',')});continue;
  }
  let result;
  try{result=buildRecord(row,proof)}catch(e){held.push({id:row.id,why:String(e.message)});continue}
  assert(result.verified===true&&result.reviewOnly!==true&&
    numeric.every(k=>result[k]===row[k])&&result.prize===0&&
    !ids.has(result.id),'publication safety '+row.id);
  db.results.push(result);ids.add(row.id);touched.add(row.id);
  added.push({id:row.id,player:row.player,rank:row.rank,event:row.event,kind:result.kind,
    prize:result.prize,date:row.date,region:row.region});
  db.reviewed.entries.push({id:row.id,recordId:row.id,decision:'published',
   reviewedAt:now,approvedBy:'ChatGPT reviewed source recheck 2026-11-09',
   policy:'verified-source-attendance-or-no-vr',source:row.source,
   evidence:'Exact saved leaderboard source, canonical Epic roster, official session, no duplicate or unsupported cash inference'});
  taken.add(row.id);
 }
 if(touched.size){
  db.reviewed.reviewedAt=now;
  for(const scope of ['auto','history']){
   db.reviews[scope].proposals=db.reviews[scope].proposals.filter(x=>!touched.has(x.id));
   db.reviews[scope].manualReviewedAt=now;
   db.statuses[scope].found=db.reviews[scope].proposals.length;
   db.statuses[scope].manualReviewCandidates=db.reviews[scope].proposals.length;
   db.statuses[scope].reviewOnlyCandidates=db.reviews[scope].proposals.filter(x=>x.reviewOnly===true).length;
   db.statuses[scope].lastReviewedBatchAt=now;
   db.statuses[scope].message='公式順位表と確認待ちを再検証。新規'+added.length+
      '件、順位修正'+rankFixed.length+'件、既存登録の確認'+(already.length-rankFixed.length)+
      '件。保留'+db.reviews[scope].proposals.length+'件。';
  }
 }
 if(added.length||rankFixed.length){
  const id='assistant-reviewed-pending-round2-20261109';
  assert(!db.updates.entries.some(e=>e.id===id),'duplicate update history');
  db.updates.entries.unshift({id,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
   type:'records',title:'確認候補を再照合：新規'+added.length+'件・順位修正'+rankFixed.length+'件',
   description:'Epic/Osirionと既存戦績の照合。Zoro/Inoxtagスキン大会の順位差は現行の公式データに統一。既存スキン賞・PlayStation決勝賞金は保持し重複なしで承認済み候補を整理。'
     +'2024年Victory予選は出場確認のみ・PlayStation Clix決勝の0VRは$0として掲載。'
     +'賞金と順位の完全性が必要なUnreal Cupは保留。',
   recordIds:[...added.map(x=>x.id),...rankFixed.map(x=>x.existingId)]});
 }
 const summary={expected:EXPECTED.length,found:queue.size,added:added.length,rankFixed:rankFixed.length,
  already:already.length-rankFixed.length,held:held.length,notFound:notFound.length,liveErrors:live.errors,
  byTournament:added.reduce((m,r)=>(m[r.event]=(m[r.event]||0)+1,m),{}),
  rankCorrections:rankFixed,held,addedRecords:added,
  resultsBefore:db.results.length-added.length,resultsAfter:db.results.length,
  cashAdded:added.reduce((s,x)=>s+x.prize,0),
  queues:{auto:db.reviews.auto.proposals.length,history:db.reviews.history.proposals.length}};
 console.log('AOT_ROUND2_REVIEW '+JSON.stringify(summary));
 if(process.argv.includes('--dry-run')||!touched.size)return summary;
 for(const [name,obj] of Object.entries({
  'results.json':db.results,'updates.json':db.updates,
  'auto-sync-review.json':db.reviews.auto,'history-sync-review.json':db.reviews.history,
  'auto-sync-status.json':db.statuses.auto,'history-sync-status.json':db.statuses.history,
  'history-sync-reviewed.json':db.reviewed
 }))write(name,obj);
 return summary;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1});
module.exports={main,EXPECTED,sameWindow,buildRecord};
