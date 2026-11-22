'use strict';
// Source-locked owner authorization for nine different verified Epic accounts
// and six exact official session windows. Player awards and advancement are
// derived from the correct historical official competition, never guessed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261122-nine-round-classified.json'),'utf8'));
const POLICY='verified-nine-rule-backed-review-20261122';
const GOLD=Object.freeze([
  {
    "source": {
      "id": "auto-s30-e4bc01df6c7f",
      "date": "2024-06-02",
      "region": "ME",
      "player": "tzd Misosqnda",
      "playerRaw": "Twitch misofn01",
      "event": "PlayStation Cup Battle Royale",
      "round": "単一開催枠 / 参加確認",
      "rank": 285,
      "points": 80,
      "kills": 7,
      "vrs": 1,
      "prize": null,
      "kind": "参加確認",
      "matches": 10,
      "seasonId": "S30",
      "chapter": 5,
      "season": 3,
      "tournamentId": "ch5s3-playstation-cup-br",
      "source": "https://www.fortnite.com/competitive/events/S30_PlaystationCupJune/?region=ME&round=S30_PlaystationCupJune_Qualifier1_ME",
      "verified": true,
      "note": "参加データのみ自動照合。通過・賞金・スキン報酬の確定情報なし。",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "decision": {
      "stage": "qualifier",
      "kind": "予選",
      "round": "Qualifier 1 / 予選",
      "advance": false,
      "prize": 0,
      "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-5-season-3-official-rules",
      "cutoff": 50
    }
  },
  {
    "source": {
      "id": "auto-s30-4740b0efb760",
      "date": "2024-06-24",
      "region": "OCE",
      "player": "朝比奈まふゆӝ",
      "playerRaw": "ily 不可思議のカルテ",
      "event": "ZB Solo Victory Cup",
      "round": "Event 4 · Round 1 / 予選",
      "rank": 121,
      "points": 143,
      "kills": 3,
      "vrs": 0,
      "prize": 0,
      "kind": "予選",
      "matches": 7,
      "seasonId": "S30",
      "chapter": 5,
      "season": 3,
      "tournamentId": "ch5s3-zb-solo-victory",
      "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=OCE&round=S30_SoloZBVictoryCashCup_Event4Round1_OCE",
      "verified": true,
      "note": "大会APIウィンドウと本人確認済みEpic IDによる登録。賞金額を推定せず登録。",
      "reviewReason": "順位表の取得が完了していません"
    },
    "decision": {
      "stage": "qualifier",
      "kind": "予選",
      "round": "Event 4 · Round 1 / 予選突破",
      "advance": true,
      "prize": 0,
      "rule": "https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules",
      "cutoff": 2000
    }
  },
  {
    "source": {
      "id": "auto-s30-5c708c2d2a55",
      "date": "2024-06-24",
      "region": "OCE",
      "player": "ぬぬぬぬぬぬぬぬwww覚醒WWW",
      "playerRaw": "Mask Taishy",
      "event": "ZB Solo Victory Cup",
      "round": "Event 4 · Round 1 / 予選",
      "rank": 157,
      "points": 137,
      "kills": 17,
      "vrs": 1,
      "prize": 0,
      "kind": "予選",
      "matches": 4,
      "seasonId": "S30",
      "chapter": 5,
      "season": 3,
      "tournamentId": "ch5s3-zb-solo-victory",
      "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=OCE&round=S30_SoloZBVictoryCashCup_Event4Round1_OCE",
      "verified": true,
      "note": "大会APIウィンドウと本人確認済みEpic IDによる登録。賞金額を推定せず登録。",
      "reviewReason": "順位表の取得が完了していません"
    },
    "decision": {
      "stage": "qualifier",
      "kind": "予選",
      "round": "Event 4 · Round 1 / 予選突破",
      "advance": true,
      "prize": 0,
      "rule": "https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules",
      "cutoff": 2000
    }
  },
  {
    "source": {
      "id": "auto-s30-cda46496ad05",
      "date": "2024-06-24",
      "region": "OCE",
      "player": "huggyfv",
      "playerRaw": "stx huggyfvǃ",
      "event": "ZB Solo Victory Cup",
      "round": "Event 4 · Round 1 / 予選",
      "rank": 158,
      "points": 137,
      "kills": 19,
      "vrs": 1,
      "prize": 0,
      "kind": "予選",
      "matches": 5,
      "seasonId": "S30",
      "chapter": 5,
      "season": 3,
      "tournamentId": "ch5s3-zb-solo-victory",
      "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=OCE&round=S30_SoloZBVictoryCashCup_Event4Round1_OCE",
      "verified": true,
      "note": "大会APIウィンドウと本人確認済みEpic IDによる登録。賞金額を推定せず登録。",
      "reviewReason": "順位表の取得が完了していません"
    },
    "decision": {
      "stage": "qualifier",
      "kind": "予選",
      "round": "Event 4 · Round 1 / 予選突破",
      "advance": true,
      "prize": 0,
      "rule": "https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules",
      "cutoff": 2000
    }
  },
  {
    "source": {
      "id": "auto-s30-83318f0cf781",
      "date": "2024-07-30",
      "region": "NAC",
      "player": "ごんた",
      "playerRaw": "GR go gonta go",
      "event": "ZB Solo Victory Cup",
      "round": "Event 7 · Round 1 / 予選",
      "rank": 6038,
      "points": 91,
      "kills": 15,
      "vrs": 0,
      "prize": 0,
      "kind": "予選",
      "matches": 7,
      "seasonId": "S30",
      "chapter": 5,
      "season": 3,
      "tournamentId": "ch5s3-zb-solo-victory",
      "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event7Round1_NAC",
      "verified": true,
      "note": "大会APIウィンドウと本人確認済みEpic IDによる登録。賞金額を推定せず登録。",
      "reviewReason": "順位表の取得が完了していません"
    },
    "decision": {
      "stage": "qualifier",
      "kind": "予選",
      "round": "Event 7 · Round 1 / 予選",
      "advance": false,
      "prize": 0,
      "rule": "https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules",
      "cutoff": 5000
    }
  },
  {
    "source": {
      "id": "auto-s30-26faa7f634e5",
      "date": "2024-08-13",
      "region": "NAC",
      "player": "ちゃる",
      "playerRaw": "charufn",
      "event": "ZB Solo Victory Cup",
      "round": "Event 9 · Round 1 / 予選",
      "rank": 2641,
      "points": 119,
      "kills": 8,
      "vrs": 0,
      "prize": 0,
      "kind": "予選",
      "matches": 5,
      "seasonId": "S30",
      "chapter": 5,
      "season": 3,
      "tournamentId": "ch5s3-zb-solo-victory",
      "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event9Round1_NAC",
      "verified": true,
      "note": "大会APIウィンドウと本人確認済みEpic IDによる登録。賞金額を推定せず登録。",
      "reviewReason": "順位表の取得が完了していません"
    },
    "decision": {
      "stage": "qualifier",
      "kind": "予選",
      "round": "Event 9 · Round 1 / 予選突破",
      "advance": true,
      "prize": 0,
      "rule": "https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules",
      "cutoff": 5000
    }
  },
  {
    "source": {
      "id": "auto-s39-a899afac8090",
      "date": "2025-12-21",
      "region": "OCE",
      "player": "Kol",
      "playerRaw": "UC.KolGyroǃ",
      "event": "NVIDIA GeForce RTX Cup",
      "round": "単一開催枠 / 参加確認",
      "rank": 2521,
      "points": 110,
      "kills": 19,
      "vrs": 0,
      "prize": null,
      "kind": "参加確認",
      "matches": 5,
      "seasonId": "S39",
      "chapter": 7,
      "season": 1,
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "source": "https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region=OCE&round=S39_NvidiaCup_OCE",
      "verified": true,
      "note": "参加データのみ自動照合。通過・賞金・スキン報酬の確定情報なし。",
      "reviewOnly": true,
      "reviewReason": "全ページ連続の順位表・Epic ID付完全スナップショットが未確認",
      "teamAccountIds": [
        "3f1c89c5fbe94f0887648ce5ce122ec0"
      ]
    },
    "decision": {
      "stage": "single-round-cash",
      "kind": "賞金決勝",
      "round": "Session 1 / 賞金決勝",
      "advance": null,
      "prize": 0,
      "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/nvidia-geforce-rtx-cup-official-rules",
      "cashThrough": 40
    }
  },
  {
    "source": {
      "id": "auto-s39-89fcb265b852",
      "date": "2025-12-21",
      "region": "OCE",
      "player": "Dartri",
      "playerRaw": "FPG Dartrinok",
      "event": "NVIDIA GeForce RTX Cup",
      "round": "単一開催枠 / 参加確認",
      "rank": 2568,
      "points": 109,
      "kills": 2,
      "vrs": 0,
      "prize": null,
      "kind": "参加確認",
      "matches": 5,
      "seasonId": "S39",
      "chapter": 7,
      "season": 1,
      "tournamentId": "ch7s1-nvidia-geforce-rtx-cup",
      "source": "https://www.fortnite.com/competitive/events/S39_NvidiaCup/?region=OCE&round=S39_NvidiaCup_OCE",
      "verified": true,
      "note": "参加データのみ自動照合。通過・賞金・スキン報酬の確定情報なし。",
      "reviewOnly": true,
      "reviewReason": "全ページ連続の順位表・Epic ID付完全スナップショットが未確認",
      "teamAccountIds": [
        "80605916b7964bedaee91a4d2fbd3181"
      ]
    },
    "decision": {
      "stage": "single-round-cash",
      "kind": "賞金決勝",
      "round": "Session 1 / 賞金決勝",
      "advance": null,
      "prize": 0,
      "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/nvidia-geforce-rtx-cup-official-rules",
      "cashThrough": 40
    }
  },
  {
    "source": {
      "id": "auto-s40-ea5151d35408",
      "date": "2026-05-10",
      "region": "NAW",
      "player": "LBworks / Jaemon",
      "playerRaw": "DELTA LBworks / Jaemon.K",
      "event": "FNCS Division 1",
      "round": "単一開催枠 / 参加確認",
      "rank": 45,
      "points": 16,
      "kills": 2,
      "vrs": 0,
      "prize": null,
      "kind": "参加確認",
      "matches": 6,
      "seasonId": "S40",
      "chapter": 7,
      "season": 2,
      "tournamentId": "ch7s2-fncs-division-1",
      "source": "https://www.fortnite.com/competitive/events/S40_FNCSDivisionalCup_Division1/?region=NAW&round=S40_FNCSDivisionalCup_Division1_Week3Final_NAW",
      "verified": true,
      "note": "参加データのみ自動照合。通過・賞金・スキン報酬の確定情報なし。",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可",
      "players": [
        "LBworks",
        "Jaemon"
      ],
      "teamAccountIds": [
        "4e28a12c7852417ea4a90cdff234d4ec",
        "dcc5f4df088a4bcab4058b9b0fb2f97c"
      ]
    },
    "decision": {
      "stage": "weekly-final",
      "kind": "賞金決勝",
      "round": "Week 3 Final / 賞金決勝",
      "advance": null,
      "prize": 0,
      "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fncs-divisional-cups-chapter-7-season-2-official-rules",
      "cashThrough": 20
    }
  }
]);
const EXPECT=Object.freeze({rows:9,qualifiers:6,weeklyFinals:1,singleRoundCash:2,advanced:4,prizeTotalUSD:0,uniqueSessions:6});
const rules={
 victory:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 ps:'https://www.fortnite.com/news/fortnite-playstation-cup-chapter-5-season-3-official-rules',
 fncs:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fncs-divisional-cups-chapter-7-season-2-official-rules',
 nvidia:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/nvidia-geforce-rtx-cup-official-rules'
};
const must=(yes,why)=>{if(!yes)throw Error('NINE_OFFICIAL_REVIEW_PROOF '+why)};
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function validateProof(){
 const b=DOC.batch,e=DOC.expected;
 must(DOC.version===1&&b?.id==='review-nine-real-rounds-20261122'&&
  b.reviewedOn==='2026-11-22'&&JSON.stringify(e)===JSON.stringify(EXPECT)&&
  b.entries?.length===9,'batch metadata changed');
 const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8')).catalog;
 const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8')).rules;
 const ids=new Set(),sessions=new Set(),ranks=new Set(),stages=new Map();
 for(let i=0;i<GOLD.length;i++){
  const gold=GOLD[i],item=b.entries[i],s=item?.source,d=item?.decision;
  must(item&&s&&d&&JSON.stringify(item)===JSON.stringify(gold),'locked source changed '+(s?.id||i));
  must(s.verified===true&&!ids.has(s.id),'missing/duplicate Epic identity '+s.id);
  ids.add(s.id);sessions.add(s.source);
  const url=new URL(s.source),ev=url.pathname.match(/^\/competitive\/events\/([^/]+)\/$/u)?.[1],win=url.searchParams.get('round');
  must(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&url.searchParams.size===2&&
   url.searchParams.get('region')===s.region&&ev&&win&&win.endsWith('_'+s.region),
   'unverified Epic event '+s.id);
  const sessionRank=win+'/'+s.rank;
  must(!ranks.has(sessionRank),'same leaderboard rank entered twice '+s.id);ranks.add(sessionRank);
  const t=catalog.find(x=>x.id===s.tournamentId);
  must(t&&t.name===s.event&&t.seasonId===s.seasonId&&t.sourceEventIds.includes(ev)&&
   Number.isSafeInteger(s.rank)&&s.rank>0&&
   Number.isSafeInteger(s.points)&&s.points>=0&&
   Number.isSafeInteger(s.matches)&&s.matches>=1&&
   Number.isSafeInteger(s.kills)&&s.kills>=0&&
   Number.isSafeInteger(s.vrs)&&s.vrs>=0&&s.vrs<=s.matches,
   'event catalog or original numbers changed '+s.id);
  must(d.prize===0&&d.kind=== (d.stage==='qualifier'?'予選':'賞金決勝')&&
   typeof d.round==='string'&&d.round.endsWith(' / '+(d.kind==='予選'?(d.advance?'予選突破':'予選'):'賞金決勝')),
   'round/prize mapping changed '+s.id);
  if(s.tournamentId==='ch5s3-zb-solo-victory'){
   const m=win.match(/^S30_SoloZBVictoryCashCup_Event(\d+)Round1_(NAC|OCE)$/u);
   const cutoff=s.region==='NAC'?5000:2000;
   must(m&&t.mode==='zero-build'&&t.team==='solo'&&t.seasonId==='S30'&&
    d.rule===rules.victory&&d.cutoff===cutoff&&
    d.advance===(s.rank<=cutoff)&&d.stage==='qualifier'&&
    s.kind==='予選'&&s.prize===0&&s.matches<=7&&
    d.round==='Event '+m[1]+' · Round 1 / '+(d.advance?'予選突破':'予選')&&
    registry.some(x=>x.id===t.id&&x.source===rules.victory),
    'S30 Round1 advancement/prize wrong '+s.id);
  }else if(s.tournamentId==='ch5s3-playstation-cup-br'){
   must(win==='S30_PlaystationCupJune_Qualifier1_ME'&&s.region==='ME'&&
    s.date==='2024-06-02'&&s.rank===285&&s.matches<=10&&
    t.team==='solo'&&d.stage==='qualifier'&&d.rule===rules.ps&&
    d.cutoff===50&&d.advance===false&&d.round==='Qualifier 1 / 予選',
    'ME PlayStation qualifier is not a Final '+s.id);
  }else if(s.tournamentId==='ch7s1-nvidia-geforce-rtx-cup'){
   const n=registry.find(x=>x.id===t.id);
   must(win==='S39_NvidiaCup_OCE'&&s.region==='OCE'&&
    s.date==='2025-12-21'&&t.team==='solo'&&
    d.stage==='single-round-cash'&&d.rule===rules.nvidia&&
    d.round==='Session 1 / 賞金決勝'&&d.advance===null&&
    d.cashThrough===40&&s.rank>40&&
    n?.source===rules.nvidia&&n.cashPrizes?.tiers?.OCE?.at(-1)?.through===40,
    'NVIDIA OCE single-round cash cutoff changed '+s.id);
  }else if(s.tournamentId==='ch7s2-fncs-division-1'){
   must(win==='S40_FNCSDivisionalCup_Division1_Week3Final_NAW'&&
    s.date==='2026-05-10'&&s.region==='NAW'&&s.rank===45&&
    t.team==='duo'&&Array.isArray(s.players)&&s.players.length===2&&
    s.player===s.players.join(' / ')&&
    Array.isArray(s.teamAccountIds)&&s.teamAccountIds.length===2&&
    new Set(s.teamAccountIds).size===2&&
    s.matches===6&&d.stage==='weekly-final'&&d.rule===rules.fncs&&
    d.round==='Week 3 Final / 賞金決勝'&&d.advance===null&&d.cashThrough===20,
    'FNCS weekly Final 45th is out of NAW prize range '+s.id);
  }else must(false,'unapproved event '+s.tournamentId);
  stages.set(d.stage,(stages.get(d.stage)||0)+1);
 }
 must(ids.size===9&&sessions.size===6&&
  stages.get('qualifier')===6&&stages.get('weekly-final')===1&&
  stages.get('single-round-cash')===2&&
  b.entries.filter(x=>x.decision.advance===true).length===4,
  'expected nine ranks or six windows altered');
 return true;
}
function noteFor(item,prefix){
 const s=item.source,d=item.decision;
 let stage;
 if(s.tournamentId==='ch5s3-zb-solo-victory')
  stage=d.advance?'Round 1の公式地域別通過圏内なので予選突破。':'Round 1の公式地域別通過圏外なので予選参加。';
 else if(s.tournamentId==='ch5s3-playstation-cup-br')
  stage='PlayStation Cup Battle Royale Qualifier 1。地域上位50位だけ決勝へ進出するため285位は予選参加（決勝未進出）。';
 else if(s.tournamentId==='ch7s1-nvidia-geforce-rtx-cup')
  stage='NVIDIA大会は予選・決勝に分かれない1ラウンドの賞金大会。OCEの現金賞金は40位までで、この順位は圏外。8点以上のコスメ条件と受け取り確認は現金賞金と区別。';
 else stage='FNCS Division 1のWeek 3 Weekly Finals（FNCS Grand Finalsではない）。NAWの賞金は上位20チームまで、45位は圏外。賞金はチーム$0、個人$0。';
 return '保存済みEpic/Osirion公式アカウント順位表の連続先頭'+prefix+'ページで'+
  s.date+' '+s.region+' '+s.player+' '+s.rank+'位・'+s.points+'pt・'+s.matches+
  '試合・'+s.kills+'キル・'+s.vrs+'VRを確認。'+
  stage+'この成績の個人現金賞金は$0。実際の報酬受取は未確認。全ページ取得完了とは扱わない。'+
  '公式大会：'+s.source+' 公式規則：'+d.rule;
}
function project(item,prefix){
 const s=item.source,d=item.decision;
 const {reviewOnly:_a,reviewReason:_b,note:_c,...original}=s;
 return {...original,kind:d.kind,round:d.round,prize:d.prize,
  ...(s.tournamentId==='ch7s2-fncs-division-1'?{prizePerPlayer:0,teamPrize:0}:{}),
  note:noteFor(item,prefix)};
}
function approval(item,record){
 return {id:record.id,recordId:record.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-22T02:24:43Z',
  approvedBy:'Owner-approved verification; locked Epic account ranking, official event window and historical cash/advancement rules',
  source:item.source.source,rule:item.decision.rule,
  originalHash:sha(item),recordHash:sha(record),
  evidence:'Official Round 1 cutoff or verified FNCS Week3Final/NVIDIA single cash session; no invented rank award'};
}
function verifyRow(row,entry){
 const item=DOC.batch.entries.find(x=>x.source.id===row?.id);
 const match=row?.note?.match(/連続先頭(\d+\/\d+)ページ/u);
 return Boolean(item&&entry&&match&&entry.id===row.id&&entry.recordId===row.id&&
  entry.decision==='published'&&entry.policy===POLICY&&
  entry.source===item.source.source&&entry.rule===item.decision.rule&&
  entry.originalHash===sha(item)&&entry.recordHash===sha(row)&&row.verified===true&&
  JSON.stringify(row)===JSON.stringify(project(item,match[1])));
}
validateProof();
module.exports={POLICY,DOC,GOLD,EXPECT,rules,validateProof,project,approval,verifyRow};
