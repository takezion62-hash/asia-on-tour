'use strict';
/**
 * ASIA ON TOUR — admin reviewed candidate publication.
 * Pure planner: never writes. A manual GitHub Action opens a PR; merging is the
 * final authorization. Unknown prizes, qualifications and identity stay unknown.
 */
const {decide:verifiedRuleDecide}=require('./verified-history-approval.cjs');
const allowedRegions=new Set(['ME','EU','NAC','NAW','OCE','BR']);
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const exactArray=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const knownFields=['id','date','region','player','playerRaw','players','event','round','rank','points','kills','vrs','matches','prize','kind','seasonId','chapter','season','tournamentId','source','verified','reviewOnly'];
const pick=(r,k)=>r?.[k]===undefined?null:r[k];
const equalCandidate=(a,b)=>knownFields.every(k=>JSON.stringify(pick(a,k))===JSON.stringify(pick(b,k)));
const safeInt=n=>Number.isSafeInteger(n)&&n>=0;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const norm=s=>String(s||'').trim();
const canon=(name,aliases)=>{
  if(!aliases||typeof aliases!=='object')return name;
  const hits=Object.entries(aliases).filter(([primary,list])=>primary===name||(Array.isArray(list)&&list.includes(name))).map(([primary])=>primary);
  return hits.length===1?hits[0]:name;
};
const lineup=(r,aliases)=>roster(r).map(name=>canon(name,aliases)).sort((a,b)=>a.localeCompare(b,'ja'));
const matchSig=(r,aliases)=>lineup(r,aliases).join('\u001f');
const stage=r=>{
  const raw=norm(r?.round),src=norm(r?.source);
  let window='';
  try{window=new URL(src).searchParams.get('round')||''}catch{}
  const full=window+' '+raw;
  const a=full.match(/(?:event|day|week|session)\s*[_\s.-]*(\d+)/i);
  const b=full.match(/(?:round)\s*[_\s.-]*([12])/i);
  if(a&&b)return 'ev:'+a[0].replace(/[^a-z0-9]/ig,'').toLowerCase()+'/r'+b[1];
  if(a&&/\/\s*(?:予選|予選突破|予選通過|賞金決勝|決勝|参加確認)/.test(raw))return 'ev:'+a[0].replace(/[^a-z0-9]/ig,'').toLowerCase()+'/kind:'+(raw.includes('予選')?'q':raw.includes('決勝')?'f':'other');
  if(b)return 'r'+b[1];
  return '';
};
function collision(existing,newRecord,aliases){
  if(existing.id===newRecord.id)return '同じ戦績IDが登録済み';
  if(existing.date!==newRecord.date||existing.region!==newRecord.region)return '';
  if(existing.tournamentId&&newRecord.tournamentId&&existing.tournamentId!==newRecord.tournamentId)return '';
  if(norm(existing.event)!==norm(newRecord.event))return '';
  if(matchSig(existing,aliases)!==matchSig(newRecord,aliases))return '';
  const a=stage(existing),b=stage(newRecord);
  if(!a||!b)return '同日・同大会・同選手の既存戦績にラウンド識別不足（要手動照合）';
  if(a===b)return '同一開催枠・同一選手に既存戦績あり';
  if(a.startsWith('r')||b.startsWith('r'))return '片方がEvent識別不足のため要照合';
  if(a.includes('/kind:other')||b.includes('/kind:other'))return '予選/決勝の識別が不足';
  return '';
}
function parseIds(raw){
  const list=Array.isArray(raw)?raw:String(raw||'').split(/[\s,，、;；]+/).filter(Boolean);
  if(list.length<1||list.length>20)throw Error('一度に1〜20件の候補IDを指定してください');
  for(const id of list){
    if(typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{4,99}$/.test(id))throw Error('候補IDの形式が不正: '+String(id));
  }
  if(new Set(list).size!==list.length)throw Error('同じ候補IDを二重指定しないでください');
  return list;
}
function validateOriginal(row,checkpoint,window,catalog,players){
  if(!row||row.verified!==true||!/^auto-s\d+-[a-z0-9]{12}$/.test(row.id||''))throw Error('照合候補ID・本人確認フラグに問題');
  if(!checkpoint||!Array.isArray(checkpoint.proposals)||checkpoint.nextPage<1||!checkpoint.proposals.some(x=>equalCandidate(x,row)))throw Error('保存済みのOsirion順位表と一致しない候補: '+row.id);
  if(!catalog||catalog.id!==row.tournamentId||catalog.name!==row.event||catalog.seasonId!==row.seasonId)throw Error('大会マスターに照合できません: '+row.id);
  if(!validDate(row.date)||!allowedRegions.has(row.region))throw Error('開催日または地域が不正: '+row.id);
  if(!safeInt(row.rank)||row.rank===0||!safeInt(row.points)||!safeInt(row.kills)||!safeInt(row.vrs)||!safeInt(row.matches)||row.matches===0||row.vrs>row.matches)throw Error('順位表の数値が不正: '+row.id);
  const people=roster(row),teamSize={solo:1,duo:2,trio:3,squad:4}[catalog.team],known=new Set(players.candidates.map(x=>x.name));
  if(!teamSize||people.length!==teamSize||new Set(people).size!==people.length||people.some(x=>!known.has(x))||row.player!==people.join(' / '))throw Error('選手・チームの本人照合が不正: '+row.id);
  let u;
  try{u=new URL(row.source)}catch{throw Error('公式出典URLが不正: '+row.id)}
  if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||u.username||u.password||u.hash)throw Error('公式出典が不正: '+row.id);
  const found=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
  if(!found)throw Error('出典はEpic公式イベントURLが必要: '+row.id);
  const eventId=decodeURIComponent(found[1]),windowId=u.searchParams.get('round');
  if(!windowId||!catalog.sourceEventIds?.includes(eventId)||!windowId.startsWith(row.seasonId+'_')||!windowId.endsWith('_'+row.region)||u.searchParams.get('region')!==row.region)throw Error('出典イベント・地域・ラウンドが不一致: '+row.id);
  if(!window||window.sourceWindowId!==windowId||window.eventId!==eventId||window.dateJst!==row.date||
    window.region!==row.region||window.tournamentId!==row.tournamentId||window.seasonId!==row.seasonId)throw Error('大会カレンダーの公式開催枠と一致しません: '+row.id);
  return {eventId,windowId,source:row.source};
}
function candidatesFor(db){
  const out=new Map();
  for(const origin of ['auto','history']){
    const data=db.reviews?.[origin];
    if(!Array.isArray(data?.proposals))throw Error(origin+'確認待ちファイルが不正です');
    for(const item of data.proposals){
      if(!item?.id)throw Error('候補IDが未設定');
      if(out.has(item.id)&&!equalCandidate(out.get(item.id).row,item))throw Error('直近と過去の同じIDで内容が衝突: '+item.id);
      if(!out.has(item.id))out.set(item.id,{origin,row:item});
    }
  }
  return out;
}
function checkpointFor(row,scans){
  let found=null;
  for(const scan of Object.values(scans||{})){
    if(!object(scan?.windows))continue;
    for(const [key,checkpoint] of Object.entries(scan.windows)){
      for(const candidate of checkpoint.proposals||[]){
        if(candidate.id!==row.id)continue;
        if(!equalCandidate(candidate,row))throw Error('API保存記録と候補の内容が異なる: '+row.id);
        if(found&&found.key!==key)throw Error('複数の異なるAPI開催枠に同じ候補IDが存在: '+row.id);
        found={key,checkpoint};
      }
    }
  }
  return found;
}
function apply(db,input){
  const ids=parseIds(input.ids),policy=input.policy;
  if(!['attendance-only','verified-rule'].includes(policy))throw Error('承認種別はattendance-only / verified-ruleのみ');
  if(input.confirmation!=='CONFIRM')throw Error('管理者の明示的なCONFIRMが必要です');
  const sources=candidatesFor(db),catalogs=new Map(db.tournaments.catalog.map(c=>[c.id,c]));
  const next={results:db.results.map(r=>({...r})),
    reviews:{auto:{...db.reviews.auto,proposals:[...db.reviews.auto.proposals]},history:{...db.reviews.history,proposals:[...db.reviews.history.proposals]}},
    statuses:{auto:{...db.statuses.auto},history:{...db.statuses.history}},
    ledger:{...db.ledger,entries:[...db.ledger.entries]},
    updates:{...db.updates,entries:[...db.updates.entries]}};
  const changes=[],skipped=[];
  for(const id of ids){
    const found=sources.get(id),old=next.results.find(r=>r.id===id);
    if(!found){
      if(old){skipped.push({id,reason:'同じIDがすでに掲載済み'});continue}
      throw Error('確認待ち一覧に存在しないID: '+id);
    }
    if(old)throw Error('確認待ち候補IDが既存戦績と衝突: '+id);
    if(next.ledger.entries.some(x=>x.id===id))throw Error('過去に処理済みの候補です: '+id);
    const row=found.row,catalog=catalogs.get(row.tournamentId),cp=checkpointFor(row,db.scans);
    const ref=new URL(row.source).searchParams.get('round');
    const session=(db.calendar?.[row.date.slice(0,7)]||[]).find(w=>w.sourceWindowId===ref&&w.region===row.region&&w.tournamentId===row.tournamentId);
    validateOriginal(row,cp?.checkpoint,session,catalog,db.players);
    if(!cp?.key.endsWith('/'+ref))throw Error('API開催枠キーが不正: '+id);
    let record,rule=null;
    if(policy==='attendance-only'){
      if(row.reviewOnly!==true||row.kind!=='参加確認'||row.prize!==null)throw Error('出場確認専用の候補ではありません: '+id);
      const {reviewOnly,reviewReason,...base}=row;
      record={...base,prize:null,kind:'参加確認',note:'管理者がEpic ID・公式大会ウィンドウ・Osirion順位表の参加と数値を再確認。予選突破・賞金・スキン獲得は未確認のため加算しない。出典: '+row.source};
    }else{
      const win={key:cp.key,eventId:session.eventId,windowId:session.sourceWindowId,dateJst:session.dateJst,
        tournamentId:row.tournamentId,seasonId:row.seasonId,region:row.region,round:row.round,kind:row.kind};
      const decision=verifiedRuleDecide(row,win,cp.checkpoint,{players:db.players,tournaments:db.tournaments,results:next.results});
      if(!decision.approved)throw Error('公式規則による承認条件を満たさない: '+id+' / '+decision.reason);
      record=decision.record;rule=decision.rule;
    }
    if(record.prize!==0&&record.prize!==null)throw Error('金額の自動承認は非対応。個別根拠の確認が必要: '+id);
    for(const oldRecord of next.results){
      const reason=collision(oldRecord,record,db.players.confirmedAliases);
      if(reason)throw Error('重複・開催枠の疑い: '+id+' / '+oldRecord.id+' / '+reason);
    }
    next.results.push(record);
    changes.push({id,origin:found.origin,record,rule});
  }
  if(!changes.length)return {next,changes,skipped};
  const added=new Set(changes.map(x=>x.id));
  for(const origin of ['auto','history']){
    const current=next.reviews[origin];
    current.proposals=current.proposals.filter(x=>!added.has(x.id));
    current.manualReviewedAt=input.timestamp;
    next.statuses[origin].found=current.proposals.length;
    next.statuses[origin].manualReviewCandidates=current.proposals.length;
    next.statuses[origin].reviewOnlyCandidates=current.proposals.filter(x=>x.reviewOnly===true).length;
  }
  next.ledger.reviewedAt=input.timestamp;
  next.ledger.entries.push(...changes.map(x=>({
    id:x.id,decision:'published',recordId:x.id,policy,approvedAt:input.timestamp,
    approvedBy:'GitHub Actions / manual workflow',
    rule:x.rule||null,source:x.record.source,
    evidence:'Exact saved API candidate, verified Epic ID, official event window, duplicate check. No inferred cash or cosmetic payout.'
  })));
  const jst=new Date(Date.parse(input.timestamp)+9*3600000).toISOString().slice(0,10);
  const entry={id:'review-publication-'+input.runId,date:jst,type:'records',title:'管理者確認済み戦績 '+changes.length+'件を追加',
    description:policy==='attendance-only'?'Epic ID・開催枠・順位表を再照合した出場確認のみ。賞金・予選突破・スキン獲得を未認定。':'公式規則に基づく予選突破または決勝0VRのみを確認。未確認賞金なし。',
    recordIds:changes.map(x=>x.id)};
  if(next.updates.entries.some(x=>x.id===entry.id))throw Error('この実行IDの更新履歴がすでに存在');
  next.updates.entries.unshift(entry);
  return {next,changes,skipped};
}
module.exports={parseIds,equalCandidate,collision,apply};
