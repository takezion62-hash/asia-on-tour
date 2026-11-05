'use strict';
const crypto=require('node:crypto');
const REGIONS=new Set(['ME','EU','NAC','NAW','OCE','BR']);
const int=n=>Number.isSafeInteger(n)&&n>=0;
const epicId=s=>typeof s==='string'&&/^[0-9a-f]{32}$/i.test(s)?s.toLowerCase():null;
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const roster=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const normalizedRound=round=>{
 const text=String(round||'');
 const event=text.match(/Event\s*(\d+)/i),day=text.match(/Day\s*(\d+)/i),stage=text.match(/Round\s*([12])/i);
 return stage&&(event||day)?(event?'event'+Number(event[1]):'day'+Number(day[1]))+'/round'+stage[1]:text;
};
const normalizedRoster=members=>members.slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
function createIndex(config,data){
  if(config?.version!==1||!Array.isArray(config.accounts)||!Array.isArray(config.windows))throw Error('自動更新設定が不正');
  const known=new Set(data.players.candidates.map(x=>x.name)),accounts=new Map(),windows=new Map();
  for(const x of config.accounts){
    const id=epicId(x.epicAccountId);
    if(!id||!known.has(x.player)||x.confirmed!==true||accounts.has(id))throw Error('本人未確認または重複Epic ID: '+String(x.player));
    accounts.set(id,x.player);
  }
  for(const x of config.windows){
    if(!x?.eventId||!x.windowId||!dateOK(x.dateJst)||!REGIONS.has(x.region)||!['予選','決勝','賞金決勝','スキン大会'].includes(x.kind)||!x.round)throw Error('大会ウィンドウ設定が不正');
    const t=data.tournaments.catalog.find(y=>y.id===x.tournamentId);
    if(!t||!t.sourceEventIds.includes(x.eventId)||t.seasonId!==x.seasonId||!['solo','duo','trio','squad'].includes(t.team))throw Error('大会カタログ不一致: '+x.windowId);
    if(!x.windowId.startsWith(x.seasonId+'_')||!x.windowId.endsWith('_'+x.region))throw Error('地域/シーズンが不一致');
    const key=x.eventId+'/'+x.windowId;
    if(windows.has(key))throw Error('大会ウィンドウ重複');
    windows.set(key,{...x,catalog:t});
  }
  return {accounts,windows};
}
function prepare(feed,config,data){
  const {accounts,windows}=createIndex(config,data);
  if(!Array.isArray(feed?.entries))throw Error('取得した順位表が不正');
  const registeredIds=new Set(data.results.map(x=>x.id));
  const existing=new Set(data.results.map(x=>[x.date,x.region,x.tournamentId,normalizedRound(x.round),normalizedRoster(roster(x))].join('|')));
  const seen=new Set(),proposals=[],skipped=[];
  for(const x of feed.entries){
    const key=x.eventId+'/'+x.windowId,win=windows.get(key);
    if(!win){skipped.push({key,reason:'追跡対象外の大会'});continue}
    if(!Array.isArray(x.teamAccountIds)||!x.teamAccountIds.length){skipped.push({key,reason:'Epic IDなし'});continue}
    const ids=x.teamAccountIds.map(epicId);
    if(ids.some(x=>!x)||new Set(ids).size!==ids.length||ids.some(x=>!accounts.has(x))){skipped.push({key,reason:'未確認アカウント'});continue}
    const members=ids.map(id=>accounts.get(id));
    if(members.length!=={solo:1,duo:2,trio:3,squad:4}[win.catalog.team]||new Set(members).size!==members.length){skipped.push({key,reason:'チーム人数不一致'});continue}
    if(!Number.isSafeInteger(x.rank)||x.rank<1||!int(x.points)||!int(x.kills)||!int(x.vrs)||!int(x.matches)){skipped.push({key,reason:'成績が未確定'});continue}
    const deDup=[win.dateJst,win.region,win.tournamentId,normalizedRound(win.round),normalizedRoster(members)].join('|');
    if(existing.has(deDup)||seen.has(deDup)){skipped.push({key,reason:'登録済み'});continue}
    const id='auto-'+win.seasonId.toLowerCase()+'-'+crypto.createHash('sha256').update(JSON.stringify([key,ids])).digest('hex').slice(0,12);
    if(registeredIds.has(id)){skipped.push({key,reason:'ID重複'});continue}
    const source='https://www.fortnite.com/competitive/events/'+encodeURIComponent(win.eventId)+'/?region='+encodeURIComponent(win.region)+'&round='+encodeURIComponent(win.windowId);
    const cashConfirmed=win.kind==='賞金決勝'&&x.cashVerified===true&&Number.isFinite(x.prize)&&x.prize>=0&&Math.abs(x.prize*100-Math.round(x.prize*100))<1e-6;
    const prize=['予選','スキン大会'].includes(win.kind)?0:cashConfirmed?x.prize:null;
    const rec={id,date:win.dateJst,region:win.region,player:members.join(' / '),playerRaw:typeof x.rawName==='string'&&x.rawName.trim()?x.rawName.trim():members.join(' / '),event:win.catalog.name,round:win.round,rank:x.rank,points:x.points,kills:x.kills,vrs:x.vrs,prize,kind:win.kind,matches:x.matches,seasonId:win.seasonId,chapter:win.catalog.chapter,season:win.catalog.season,tournamentId:win.tournamentId,source,verified:true,note:'大会APIウィンドウと本人確認済みEpic IDによる登録。'+(prize===null?'現金賞金の確定情報なし。':'賞金額を推定せず登録。')};
    if(members.length>1)rec.players=members;
    if(cashConfirmed&&members.length>1&&Number.isFinite(x.prizePerPlayer)&&x.prizePerPlayer>0&&x.prizePerPlayer*members.length<=prize)rec.prizePerPlayer=x.prizePerPlayer;
    proposals.push(rec);seen.add(deDup);
  }
  return {proposals,skipped,linkedPlayers:accounts.size,windows:windows.size};
}
function applyProposals(data,proposals,timestamp){
  if(!proposals.length)return 0;
  const ids=new Set(data.results.map(x=>x.id));
  if(proposals.some(x=>ids.has(x.id)))throw Error('コミット前の重複');
  data.results.push(...proposals);
  const jst=new Date(new Date(timestamp).getTime()+9*3600000).toISOString().slice(0,10);
  data.updates.entries.unshift({id:'auto-sync-'+timestamp.replace(/[^\d]/g,'').slice(0,14),date:jst,type:'records',title:'自動取り込み：新規戦績'+proposals.length+'件',description:'本人確認済みのEpic IDと大会ウィンドウを照合。既存結果を保持して重複なく追記、未確定賞金はnull。',recordIds:proposals.map(x=>x.id)});
  return proposals.length;
}
module.exports={epicId,createIndex,prepare,applyProposals};
