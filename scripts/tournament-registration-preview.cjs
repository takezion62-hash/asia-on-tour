'use strict';
// Read-only registration preview. No write, API calls, or approval permission.
const fs=require('node:fs'),path=require('node:path');
const {isDeepStrictEqual}=require('node:util');
const {POLICIES,policyIds,eventWindow,matchesWindow}=require('./tournament-approval-policy.cjs');
const E=require('./tournament-rule-engine.cjs');
const {validateRegistry}=require('./validate-tournament-rules.cjs');
const REGIONS=['ME','EU','NAC','NAW','OCE','BR','ASIA'];
const AXES=['series','mode','subtype','team','platform'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const str=x=>typeof x==='string'&&x.trim().length>0;
const pos=x=>Number.isSafeInteger(x)&&x>0;
const list=x=>Array.isArray(x)&&x.length>0&&x.every(str)&&new Set(x).size===x.length;
const copy=x=>JSON.parse(JSON.stringify(x));
function url(value,official=false){
 if(!str(value))return false;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&
  (!official||['fortnite.com','www.fortnite.com'].includes(u.hostname))}catch{return false}
}
const evidence=x=>Array.isArray(x)&&x.length>0&&x.every(e=>obj(e)&&str(e.text)&&url(e.url));
function template(){
 return {catalog:{id:null,name:null,seasonId:null,chapter:null,season:null,series:null,mode:null,subtype:null,team:null,platform:null,sourceEventIds:[],unknownFields:[],evidence:[]},
 rule:{id:null,seasonId:null,series:null,team:null,eventIds:[],source:null,matchCaps:{},evidence:[]},regions:[],windows:[]};
}
// Suggest policy fields without silently applying them.
function suggestions(rule){
 if(!obj(rule))return [];
 if(rule.autoApproval!==undefined||rule.cashFinalAutoApproval!==undefined)return [];
 const variants=[];
 if(rule.series==='cash-cup'&&rule.cashPrizes?.basis==='per-player'){
  if(rule.team==='duo'&&obj(rule.advance)&&E.matchCap(rule,'賞金決勝')!==null)
   variants.push({autoApproval:'verified-duo-qualifier-only',cashFinalAutoApproval:'verified-duo-round2-rank'});
  else if(rule.advance===undefined)variants.push({autoApproval:'verified-team-rank'});
 }
 const mode={'performance-evaluation':'verified-performance-vr','playstation-cup':'verified-playstation-solo','unreal-cup':'verified-team-rank','nvidia-cup':'verified-solo-rank'}[rule.series];
 if(mode)variants.push({autoApproval:mode});
 return variants.map(fields=>({fields,routes:policyIds({...rule,...fields})})).filter(x=>x.routes.length);
}
function windowRoutes(rule,win,routes){
 if(!obj(win)||!matchesWindow(rule,win,win.kind))return [];
 const ids=[];
 if(routes.includes('verified')&&['予選','賞金決勝'].includes(win.kind)){
  const round=win.kind==='予選'?1:2;
  if(eventWindow(rule,win,{kind:win.kind,rounds:[round],optionalSeparator:true})||
   (win.windowId.startsWith(win.eventId+'_')&&new RegExp('^_Round'+round+'_Day[1-9][0-9]*_'+win.region+'$').test(win.windowId.slice(win.eventId.length))))ids.push('verified');
 }
 if(routes.includes('squads')&&['予選','賞金決勝'].includes(win.kind)&&eventWindow(rule,win,{kind:win.kind,rounds:[win.kind==='予選'?1:2],optionalSeparator:true}))ids.push('squads');
 if(routes.includes('duo')&&eventWindow(rule,win,{kind:rule.series==='cash-cup'?'参加確認':'予選',rounds:[1],optionalSeparator:true}))ids.push('duo');
 if(routes.includes('cash')&&eventWindow(rule,win,rule.cashFinalAutoApproval==='verified-duo-round2-rank'?{rounds:[2]}:{format:'event'}))ids.push('cash');
 if(routes.includes('performance')&&['EU','NAC'].includes(win.region)&&eventWindow(rule,win))ids.push('performance');
 if(routes.includes('playstation')&&win.kind==='参加確認'&&E.namedRound(rule,win))ids.push('playstation');
 for(const id of ['cosmetic','unreal','nvidia'])if(routes.includes(id)&&eventWindow(rule,win,{format:'single'}))ids.push(id);
 return ids;
}
function diagnose(input,{registry,tournaments,recent={},history={}}){
 const missing=[],errors=[],review=[],coverage=[],routeReport=[],windowReport=[];
 const add=(arr,field,message)=>arr.push({field,message});
 const miss=(f,m)=>add(missing,f,m),err=(f,m)=>add(errors,f,m),hold=(f,m)=>add(review,f,m);
 if(!obj(input))input={};
 const c=obj(input.catalog)?input.catalog:{},rule=obj(input.rule)?input.rule:{};
 const oldC=tournaments.catalog.find(x=>x.id===c.id),oldR=registry.rules.find(x=>x.id===rule.id);
 const cConflict=!!oldC&&!isDeepStrictEqual(c,oldC),rConflict=!!oldR&&!isDeepStrictEqual(rule,oldR);
 const registered=!!oldC&&!!oldR&&!cConflict&&!rConflict;
 if(cConflict)err('catalog.id','既存大会の変更は別途修正PRへ。上書きしない');
 if(rConflict)err('rule.id','既存ルールの変更は別途修正PRへ。上書きしない');
 for(const k of ['id','name','seasonId',...AXES])if(!str(c[k]))miss('catalog.'+k,'必須情報がありません');
 for(const k of ['chapter','season'])if(!pos(c[k]))miss('catalog.'+k,'確認済みの正の整数が必要');
 for(const k of ['id','seasonId','series','team','source'])if(!str(rule[k]))miss('rule.'+k,'必須情報がありません');
 for(const k of ['id','seasonId','series','team'])if(str(c[k])&&str(rule[k])&&c[k]!==rule[k])err('rule.'+k,'カタログと不一致');
 for(const k of ['mode','platform','chapter','season'])if(rule[k]!==undefined&&rule[k]!==c[k])err('rule.'+k,'カタログと不一致');
 if(str(c.seasonId)&&!/^S[1-9][0-9]*$/.test(c.seasonId))err('catalog.seasonId','公式シーズンIDが必要');
 for(const k of AXES){
  if(!str(c[k]))continue;
  if(c[k]==='unknown')miss('catalog.'+k,'未確認分類を確定してください');
  if(!tournaments.axes.find(x=>x.key===k)?.options.some(x=>x.id===c[k]))err('catalog.'+k,'未登録タグ: '+c[k]);
 }
 if(c.unknownFields?.length)miss('catalog.unknownFields','未確定の分類が残っています');
 if(tournaments.catalog.some(x=>x.seasonId===c.seasonId&&(x.chapter!==c.chapter||x.season!==c.season)))err('catalog.chapter/season','同じシーズンIDの既存大会と不一致');
 for(const [k,v] of [['catalog.sourceEventIds',c.sourceEventIds],['rule.eventIds',rule.eventIds]]){
  if(!list(v)){miss(k,'重複のない正確なEpicイベントIDが必要');continue}
  for(const id of v){
   if(!id.startsWith(c.seasonId+'_'))err(k,'イベントIDとシーズン不一致: '+id);
   const collisions=tournaments.catalog.filter(x=>x.id!==c.id&&x.sourceEventIds?.includes(id));
   if(collisions.length)err(k,'別大会に同じイベントID: '+id+' / '+collisions.map(x=>x.id).join(', '));
  }
 }
 if(list(c.sourceEventIds)&&list(rule.eventIds)&&
  (c.sourceEventIds.length!==rule.eventIds.length||rule.eventIds.some(x=>!c.sourceEventIds.includes(x))))err('rule.eventIds','カタログと対象ID集合が不一致');
 if(str(rule.source)&&!url(rule.source,true))err('rule.source','Epic公式HTTPS規則URLが必要');
 if(!registered){
  if(!evidence(c.evidence))miss('catalog.evidence','大会形式・イベントIDの説明と根拠URLが必要');
  if(!evidence(rule.evidence))miss('rule.evidence','試合数・突破・賞金の説明と根拠URLが必要');
 }
 const regions=Array.isArray(input.regions)?input.regions:[];
 if(!list(regions))miss('regions','確認済みの開催地域を重複なく指定');
 if(regions.some(x=>!REGIONS.includes(x)))err('regions','未対応地域。NAをNAC/NAWへ変換しない');
 if(regions.length&&!regions.some(x=>REGIONS.includes(x)&&x!=='ASIA'))hold('regions','ASIAのみは海外遠征対象外');
 const routes=policyIds(rule),suggested=suggestions(rule);
 if(rule.autoApproval==='review-only')hold('rule.autoApproval','明示的な確認専用');
 else if(!routes.length){
  if(suggested.length)miss('rule.autoApproval','候補方式と公式規則を確認して明示してください');
  else hold('rule.autoApproval','既存承認方式では未対応');
 }
 const cap=s=>{if(E.matchCap(rule,s)===null)miss('rule.matchCaps.'+s,'公式試合数上限が必要')};
 if(!obj(rule.matchCaps)||!Object.keys(rule.matchCaps).length)miss('rule.matchCaps','公式試合数上限が必要');
 const duo=rule.autoApproval==='verified-duo-qualifier-only';
 if(rule.series==='victory-cup'){cap('予選');cap('賞金決勝');if(E.individualVrPrize(rule,1)===null)hold('rule.prizePerVictory','正のVR賞金は単価未確認。0VR例外は既存専用条件のみ')}
 if(rule.series==='skin-cup'){cap('スキン大会');if(!['solo','duo'].includes(rule.team))hold('rule.team','既存スキン承認はソロ／デュオのみ')}
 if(rule.series==='cash-cup'){
  cap('単一ラウンド');if(duo){cap('賞金決勝');if(rule.cashFinalAutoApproval!=='verified-duo-round2-rank')hold('rule.cashFinalAutoApproval','決勝は別方式が必要')}
  if(!obj(rule.rankedEligibility))miss('rule.rankedEligibility','公式参加条件が必要');
 }
 if(rule.series==='performance-evaluation'){
  cap('予選');cap('Performance決勝');
  if(!str(rule.windowIdPrefix))miss('rule.windowIdPrefix','公式開催枠の接頭辞が必要');
  if(E.individualVrPrize(rule,1)===null)miss('rule.prizePerVictory','公式個人VR賞金が必要');
  if(!pos(rule.finalWinPoints))miss('rule.finalWinPoints','公式VRポイントが必要');
 }
 if(rule.series==='playstation-cup'){
  cap('予選');cap('賞金決勝');
  if(!str(rule.roundWindows?.qualifier)||!str(rule.roundWindows?.final)||rule.roundWindows.qualifier===rule.roundWindows.final)miss('rule.roundWindows','予選・決勝の公式開催枠名が必要');
  if(!pos(rule.sessionMinutes)||!pos(rule.finalSessionMinutes))miss('rule.sessionMinutes/finalSessionMinutes','予選・決勝の公式時間が必要');
 }
 if(['unreal-cup','nvidia-cup'].includes(rule.series)){cap('単一ラウンド');if(!rule.sessionDates)miss('rule.sessionDates','公式開催日が必要')}
 const advance=['victory-cup','performance-evaluation','playstation-cup'].includes(rule.series)||(rule.series==='cash-cup'&&duo);
 const cash=['cash-cup','unreal-cup','nvidia-cup','playstation-cup'].includes(rule.series);
 for(const region of [...new Set(regions)].filter(x=>REGIONS.includes(x))){
  const item={region,overseas:region!=='ASIA',advance:null,cosmeticRank:null,payingRank:null};
  if(advance){item.advance=E.advancementCutoff(rule,region);if(item.advance===null)miss('rule.advance.'+region,'突破順位が不明')}
  if(rule.series==='skin-cup'){item.cosmeticRank=E.cosmeticCutoff(rule,region);if(item.cosmeticRank===null)miss('rule.cosmeticRanks.'+region,'報酬順位が不明')}
  if(cash){
   const basis=rule.series==='unreal-cup'?'per-team':'per-player';item.payingRank=E.payingRank(rule,region,basis);
   if(item.payingRank===null||(basis==='per-team'&&E.teamRankPrize(rule,region,1)===null))miss('rule.cashPrizes.tiers.'+region,'公式USD賞金表または個人配分が不足・不正');
  }
  coverage.push(item);
 }
 for(const id of [...new Set([...routes,...suggested.flatMap(x=>x.routes)])]){
  const p=POLICIES.find(x=>x.id===id),active=(cfg,h)=>cfg[p.flag]===true&&(!p.historicalOnly||h)&&cfg.reviewSeries?.includes(rule.series)===true;
  routeReport.push({id,configured:routes.includes(id),flag:p.flag,recent:active(recent,false),history:active(history,true)});
 }
 if(routes.length&&!routeReport.some(x=>x.configured&&(x.recent||x.history)))hold('config','現在の新着・過去大会設定では無効');
 if(!registered&&routes.some(x=>['performance','unreal','nvidia','playstation','duo'].includes(x)))hold('adapter','シーズン／イベント固有の承認条件と公式日程の追加確認が必要');
 if(!registered&&rule.series==='victory-cup'&&rule.team!=='solo')hold('adapter','チームVR賞金の専用承認確認が必要');
 if(rule.id==='ch7s5-squads-victory-cup')hold('adapter','S43 Squadsは専用4人Epic ID・公式カレンダー・決勝100pt/VR検証が必要');
 if(input.windows!==undefined&&!Array.isArray(input.windows))err('windows','配列が必要');
 for(const [i,w] of (Array.isArray(input.windows)?input.windows:[]).entries()){
  const matched=windowRoutes(rule,w,routes);
  windowReport.push({windowId:w?.windowId??null,region:w?.region??null,routes:matched});
  if(!matched.length)hold('windows.'+i,'既存開催枠形式と一致しない');
  if(!regions.includes(w?.region))err('windows.'+i+'.region','宣言対象地域と不一致');
 }
 if(!registered){
  const supplied=new Set(windowReport.filter(w=>w.routes.length).map(w=>w.region));
  for(const region of regions.filter(x=>REGIONS.includes(x)&&x!=='ASIA'))if(!supplied.has(region))hold('windows.'+region,'公式開催枠の照合例が不足');
  hold('publication','新大会の公式根拠本文・実際の承認アダプター回帰テストを別途確認するまで公開しない');
 }
 if(!cConflict&&!rConflict&&str(c.id)&&c.id===rule.id&&obj(rule.matchCaps)&&list(c.sourceEventIds)&&list(rule.eventIds)){
  try{
   const next={...registry,rules:oldR?registry.rules:[...registry.rules,rule]};
   const catalog={...tournaments,catalog:oldC?tournaments.catalog:[...tournaments.catalog,c]};
   for(const message of validateRegistry(next,catalog))err('validator',message);
  }catch(e){err('validator','入力不足・不正で既存規則検証に失敗: '+e.message)}
 }else hold('validator','必須入力・ID競合を解消してから規則検証');
 const status=missing.length||errors.length?'blocked':!routes.length||rule.autoApproval==='review-only'?'review-only':review.length?'needs-verification':'preview-ready';
 return {status,registered,automaticPublicationAuthorized:false,missing,errors,review,suggested,routeReport,coverage,windowReport,
  registrationPreview:!registered&&!missing.length&&!errors.length?{catalog:oldC?null:copy(c),rule:oldR?null:copy(rule)}:null,
  notes:['診断は公開許可ではありません。公式本文、開催時刻、本人ID、順位表、重複、承認処理を別途確認。','不明値を0に変換しない。既存ファイル・設定・戦績を変更しない。']};
}
function load(root=path.resolve(__dirname,'..')){
 const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
 return {registry:read('tournament-rules.json'),tournaments:read('tournaments.json'),recent:read('auto-sync-config.json'),history:read('history-sync-config.json')};
}
function existing(id,db){
 const catalog=db.tournaments.catalog.find(x=>x.id===id),rule=db.registry.rules.find(x=>x.id===id);
 if(!catalog||!rule)throw Error('登録済み大会ルールが見つかりません: '+id);
 return {catalog,rule,regions:[...new Set([...Object.keys(rule.advance||{}),...Object.keys(rule.cosmeticRanks||{}),...Object.keys(rule.cashPrizes?.tiers||{})])],windows:[]};
}
function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--template'){console.log(JSON.stringify(template(),null,2));return}
 if(args.length!==2||!['--draft','--id'].includes(args[0]))throw Error('使い方: npm run tournament:preview -- --template | --draft <JSON> | --id <大会ID>');
 const db=load(),draft=args[0]==='--id'?existing(args[1],db):JSON.parse(fs.readFileSync(args[1],'utf8'));
 const report=diagnose(draft,db);console.log(JSON.stringify(report,null,2));
 if(report.status==='blocked')process.exitCode=2;
}
if(require.main===module){try{main()}catch(e){console.error(e.message);process.exitCode=2}}
module.exports={diagnose,template,existing,suggestions,windowRoutes};
