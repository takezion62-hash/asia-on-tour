'use strict';
// Safe, idempotent review. Existing review-batch validates saved Epic ID,
// contiguous observed pages, final date, unique team, prize rule and approvals.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),EXPECTED=[{"id":"auto-s32-8f74d57250ad","date":"2024-11-26","player":"Unger","rank":548,"round":"S32_SoloVictoryCashCup_Event4Round2_NAC"},{"id":"auto-s32-3f14de177d34","date":"2024-11-23","player":"kmyt","rank":1115,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-02577ef4430c","date":"2024-11-23","player":"TONIGHTREET","rank":1152,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-d09e46968bf2","date":"2024-11-26","player":"Lark","rank":676,"round":"S32_SoloVictoryCashCup_Event4Round2_NAC"},{"id":"auto-s32-fec7934229ca","date":"2024-11-26","player":"ばぶっち","rank":914,"round":"S32_SoloVictoryCashCup_Event4Round2_NAC"},{"id":"auto-s32-2e0b4ebe3b18","date":"2024-11-26","player":"ぽっちゃまǃǃ","rank":1056,"round":"S32_SoloVictoryCashCup_Event4Round2_NAC"},{"id":"auto-s32-1b595ae1f98f","date":"2024-11-23","player":"みるやちぇ","rank":1852,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-469958ae27e5","date":"2024-11-26","player":"raru","rank":1424,"round":"S32_SoloVictoryCashCup_Event4Round2_NAC"},{"id":"auto-s32-40b5e47bac20","date":"2024-11-26","player":"みやぐらーる","rank":1502,"round":"S32_SoloVictoryCashCup_Event4Round2_NAC"},{"id":"auto-s32-c760b1f709a8","date":"2024-11-23","player":"wantﾠtoﾠbeﾠhappy","rank":2087,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-4fea096ba467","date":"2024-11-23","player":"KENTAch","rank":2276,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-5f1606d34d77","date":"2024-11-23","player":"RyoIT","rank":2841,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-d4c6dae6a5bb","date":"2024-11-23","player":"らいちん","rank":2878,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-a6a7dd2025c4","date":"2024-11-23","player":"rara","rank":3105,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-dd981e7eaefd","date":"2024-11-23","player":"りっく","rank":3295,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-2eb48b7ab0b2","date":"2024-11-23","player":"りんたろう","rank":3418,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"},{"id":"auto-s32-d039a7213417","date":"2024-11-23","player":"MMC KAAN BABA","rank":3598,"round":"S32_SoloVictoryCashCup_Event3Round2_NAC"}];
const wanted=new Map(EXPECTED.map(x=>[x.id,x]));
const mode=process.argv[2];
if(!['--dry-run','--apply'].includes(mode)||process.argv.length!==3)throw Error('S32_NAC: mode must be --dry-run or --apply');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const rows=read('history-sync-review.json').proposals.filter(x=>wanted.has(x.id));
const sessions=read('calendar-history/2024-11.json').sessions;
if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('S32_NAC: duplicate pending candidate');
for(const r of rows){
 const e=wanted.get(r.id),win=r.source.split('round=')[1];
 if(!e||r.date!==e.date||r.player!==e.player||r.rank!==e.rank||
 win!==e.round||r.region!=='NAC'||r.seasonId!=='S32'||
 r.tournamentId!=='ch5s5-solo-victory-cup'||r.kind!=='賞金決勝'||
 r.points!==0||r.vrs!==0||r.prize!==null||r.verified!==true||
 r.reviewOnly===true||r.round!=='Event '+(win.includes('Event3')?'3':'4')+' · Round 2 / 賞金決勝'||
 !r.source.startsWith('https://www.fortnite.com/competitive/events/S32_SoloVictoryCashCup/?region=NAC&round=')||
 sessions.filter(s=>s.sourceWindowId===win&&s.dateJst===r.date&&s.region==='NAC'&&
 s.stage==='決勝'&&s.tournamentId===r.tournamentId&&s.seasonId===r.seasonId).length!==1)
 throw Error('S32_NAC: original evidence or official window differs '+r.id);
}
if(!rows.length){console.log('S32_NAC: no remaining targeted candidates; idempotent no-op');process.exit(0);}
const argv=[path.join(__dirname,'review-batch.cjs'),mode,'--limit=100','--ids='+rows.map(x=>x.id).join(',')];
const result=spawnSync(process.execPath,argv,{cwd:ROOT,encoding:'utf8',maxBuffer:16*1024*1024,
 env:{...process.env,...(mode==='--apply'?{AOT_BATCH_CONFIRMATION:'CONFIRM'}:{})}});
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
if(result.status!==0)throw Error('S32_NAC: batch review failed '+result.status);
const report=read('.batch-review-report.json');
if(report.selected!==rows.length||report.published.some(x=>!wanted.has(x.id)||x.prize!==0||
 x.kind!=='賞金決勝'||x.rank!==wanted.get(x.id).rank)||
 report.duplicates.some(x=>!wanted.has(x.id))||
 report.held.some(x=>!wanted.has(x.id)))
 throw Error('S32_NAC: batch review returned unexpected change');
if(mode==='--apply'&&report.held.length){
 const hist=read('history-sync-review.json'),hold=new Set(report.held.map(x=>x.id));
 let changed=false;
 for(const row of hist.proposals){
  if(!hold.has(row.id)||!wanted.has(row.id))continue;
  if(row.reviewReason==='開催日・地域・ラウンド不一致'){
    row.reviewReason='日程・地域・Round2照合済み／元順位表の追加検証待ち';
    changed=true;
  }
 }
 if(changed)fs.writeFileSync(path.join(ROOT,'history-sync-review.json'),JSON.stringify(hist,null,2)+'\n');
}
console.log('S32_NAC_REVIEW '+JSON.stringify({mode,selected:rows.length,
 published:report.published.length,duplicates:report.duplicates.length,
 held:report.held.length,holdReasons:report.held.map(x=>({id:x.id,why:x.reason}))}));
