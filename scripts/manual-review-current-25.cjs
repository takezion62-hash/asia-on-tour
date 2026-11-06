'use strict';
// Frozen, reproducible human review of 25 saved candidates on 2026-11-06.
// This module is pure: no GitHub/network writes. Source windows are matched to
// saved Osirion checkpoints, official Epic calendar sessions and existing IDs.
// Incomplete overall scans are never relabeled "complete".
const GROUPS=Object.freeze({
  finals:['auto-s42-a29d5abfdde1','auto-s42-da66be8e9fa9','auto-s42-4c96acf7fce7','auto-s42-5b435e65dee5','auto-s42-3e5b24d8de09','auto-s42-8b9d1a14049a','auto-s42-161f399f2393'],
  qualifiers:['auto-s30-d27fd75f26d1','auto-s30-3886ec700045','auto-s30-45d7fae30238','auto-s30-53025e0809f2','auto-s30-b3aa7e588740','auto-s30-b91da6629a3f','auto-s30-06b41deb3e77','auto-s30-0ac4c0c4ec81','auto-s30-a88caac715cd'],
  duos:['auto-s36-6b80a74c7942','auto-s36-26aa6aec5ad9'],
  cosmetics:['auto-s42-a91e9dc73967','auto-s42-e540dbde6826','auto-s42-12400467151f'],
  playstation:['auto-s41-f33780c48e6f'],
  fncsDuplicate:['auto-s41-3a936214d56e'],
  performanceDuplicate:['auto-s42-6bb958181194'],
  recent:['auto-s43-21408f1d31bc']
});
const expected=new Map(Object.entries(GROUPS).flatMap(([group,ids])=>ids.map(id=>[id,group])));
const rules=Object.freeze({
  S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
  S36:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules',
  S42:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules',
  PS:'https://fortnitetracker.com/events/epicgames_S41_PSCupDaysOfPlay_NAW?window=S41_PSCupDaysOfPlay_Qualifier_NAW',
  COSMETIC:'https://myfortnitestats.com/events/epicgames_S42_MadisonBeerIconCup_NAW',
  PERF:'https://www.fortnite.com/competitive/events/S43_PerformanceEvaluationTrios/?region=NAC'
});
const roster=r=>(Array.isArray(r?.players)&&r.players.length?r.players:[r.player]).slice().sort();
const sameRoster=(a,b)=>roster(a).join('\x1f')===roster(b).join('\x1f');
function source(r){
  const m=String(r.source||'').match(/^https:\/\/www\.fortnite\.com\/competitive\/events\/([^/]+)\/\?region=([A-Z]+)&round=([^&#]+)$/);
  return m?{eventId:m[1],region:m[2],windowId:m[3]}:null;
}
function originalSource(r){
  const raw=String(r.source||''),windowId=raw.match(/[?&](?:round|window)=([^&#]+)/)?.[1];
  return windowId||null;
}
const assert=(yes,message)=>{if(!yes)throw Error(message)};
const sameRaw=(a,b)=>{
  const fields=['id','date','region','player','playerRaw','players','event','round','rank','points','kills','vrs','prize','kind','matches','seasonId','chapter','season','tournamentId','source','verified','reviewOnly'];
  return fields.every(k=>JSON.stringify(a[k]??null)===JSON.stringify(b[k]??null));
};
function build(db,opts={}){
  assert(db&&Array.isArray(db.results)&&Array.isArray(db.players?.candidates)&&Array.isArray(db.tournaments?.catalog),'Invalid input data');
  const expectedCount=[...expected].length;
  assert(expectedCount===25,'Frozen manifest should include exactly 25 IDs');
  const candidates=new Map(),origins=new Map();
  for(const origin of ['history','recent']){
    const current=db.reviews[origin];
    assert(Array.isArray(current?.proposals),'Missing '+origin+' candidate file');
    for(const c of current.proposals){
      if(!expected.has(c.id))continue;
      assert(!candidates.has(c.id),'Duplicate ID across candidate sources '+c.id);
      candidates.set(c.id,c);origins.set(c.id,origin);
    }
  }
  assert([...expected.keys()].every(id=>candidates.has(id)),'A reviewed candidate disappeared or changed; refresh the review');
  const checkpoints=new Map();
  for(const [origin,scan] of Object.entries(db.scans)){
    assert(scan&&scan.windows&&typeof scan.windows==='object','Missing '+origin+' API snapshot');
    for(const [key,win] of Object.entries(scan.windows)){
      for(const p of win.proposals||[]){
        if(!expected.has(p.id))continue;
        const previous=checkpoints.get(p.id);
        assert(!previous||sameRaw(previous.row,p),'Conflicting scan windows for '+p.id);
        checkpoints.set(p.id,{origin,key,win,row:p});
      }
    }
  }
  const tour=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
  const known=new Set(db.players.candidates.map(x=>x.name));
  const resultIds=new Set(db.results.map(x=>x.id));
  assert(resultIds.size===db.results.length,'Existing result IDs are not unique');
  const ledgerIds=new Set((db.historyLedger.entries||[]).map(x=>x.id));
  assert(ledgerIds.size===db.historyLedger.entries.length,'History ledger IDs conflict');
  const approvalIds=new Set((db.approvalLedger.entries||[]).map(x=>x.id));
  assert(approvalIds.size===db.approvalLedger.entries.length,'Manual approval ledger IDs conflict');
  const byId=new Map(db.results.map(x=>[x.id,x]));
  const work=db.results.map(x=>({...x}));
  const decisions=[],added=[],duplicates=[],updated=[];
  for(const [id,group] of expected){
    const c=candidates.get(id),e=source(c),checkpoint=checkpoints.get(id),cat=tour.get(c.tournamentId);
    const official=(db.calendars[c.date.slice(0,7)]||[]).find(x=>x.sourceWindowId===e?.windowId&&x.dateJst===c.date&&x.region===c.region&&x.eventId===e?.eventId&&x.tournamentId===c.tournamentId);
    assert(c.verified===true&&e&&e.region===c.region&&e.windowId.startsWith(c.seasonId+'_')&&e.windowId.endsWith('_'+c.region),'Unverified source '+id);
    assert(cat?.seasonId===c.seasonId&&cat?.name===c.event&&cat.sourceEventIds?.includes(e.eventId),'Bad catalog '+id);
    assert(roster(c).length===({solo:1,duo:2,trio:3,squad:4})[cat.team]&&roster(c).every(name=>known.has(name)),'Unknown roster '+id);
    assert(official,'Official calendar mismatch '+id);
    assert(checkpoint&&checkpoint.key===('epicgames_'+e.eventId+'_'+c.region+'/'+e.windowId)&&sameRaw(c,checkpoint.row)&&checkpoint.win.nextPage>0,'Saved leaderboard mismatch '+id);
    assert(['rank','points','kills','vrs','matches'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=(k==='rank'||k==='matches'?1:0))&&c.vrs<=c.matches,'Invalid rank or score '+id);
    assert(!resultIds.has(id)&&!ledgerIds.has(id)&&!approvalIds.has(id),'Previously imported '+id);
    const matches=work.filter(r=>r.date===c.date&&r.region===c.region&&r.tournamentId===c.tournamentId&&sameRoster(r,c)&&originalSource(r)===e.windowId);
    const base={...c};
    delete base.reviewReason;delete base.reviewOnly;
    let decision=null,record=null,rule=null;
    if(group==='fncsDuplicate'){
      const x=work.find(r=>r.id==='s41-me-fncs-div1-week1-final-20260614-kametin-huggyfv');
      assert(matches.length===1&&matches[0]===x&&x.rank===14&&x.kills===10&&x.prize===200&&x.prizePerPlayer===100,'FNCS cash result must be preserved');
      decision='already-published';duplicates.push({id,existingId:x.id,reason:'Same FNCS Division 1 official final, rank, kills and confirmed team payout'});
    }else if(group==='performanceDuplicate'){
      const x=work.find(r=>r.id==='s42-nac-performance-eval-qual-20260911-meath-3peace');
      assert(matches.length===1&&matches[0]===x&&x.rank===47&&x.points===273&&x.vrs===1&&c.kills===12&&c.matches===6,'Performance Evaluation earlier qualifier must match');
      assert(x.kills===null||x.kills===c.kills,'Conflicting prior kills for '+id);
      assert(x.matches==null||x.matches===c.matches,'Conflicting prior matches for '+id);
      x.kills=c.kills;x.matches=c.matches;
      x.note=(x.note||'')+' Epic公式の同一Event 3 Round 1順位表で12キル・6試合を追加確認: '+c.source;
      decision='already-published';duplicates.push({id,existingId:x.id,reason:'Previously published qualifier matched; supplemented missing kills/matches'});
      updated.push({id:x.id,fields:['kills','matches','note']});
    }else{
      assert(matches.length===0,'Potential duplicate official round '+id);
      if(group==='finals'){
        assert(c.date==='2026-09-06'&&c.region==='NAW'&&c.kind==='賞金決勝'&&c.vrs===0&&c.points===0&&c.prize===null&&c.matches<=3,'Unverified $0 final '+id);
        record={...base,prize:0,
          note:'Epic CH7 S4公式はSolo Victory Cup決勝の1VRごとに$100。順位表で決勝0VRを個別確認したため$0。順位表は一部ページのみ保存済み（全体の再収集は未完）。規則: '+rules.S42};
        rule=rules.S42;
      }else if(group==='qualifiers'){
        assert(c.date==='2024-07-23'&&c.region==='ME'&&c.kind==='予選'&&c.rank<=2000&&c.prize===0&&c.matches<=7,'Unverified 2024 ME qualifier '+id);
        const round2=work.some(r=>r.date===c.date&&r.region===c.region&&r.tournamentId===c.tournamentId&&sameRoster(r,c)&&/Round\s*2|決勝/.test(r.round||''));
        assert(round2,'No matching Round 2 evidence for the 2024 qualifier '+id);
        record={...base,round:'Event 6 · Round 1 / 予選突破',
          note:'Epic CH5 S3公式ME上位2000名が予選通過。順位表'+c.rank+'位、さらに同大会Round 2掲載結果と本人Epic IDを突合。予選は賞金$0。規則: '+rules.S30};
        rule=rules.S30;
      }else if(group==='duos'){
        assert(c.date==='2025-06-14'&&c.region==='NAC'&&c.kind==='予選'&&c.rank>500&&c.prize===0&&c.matches<=7,'Unverified 2025 duos result '+id);
        record={...base,kind:'参加確認',round:'Event 1 · Round 1 / 参加確認',
          note:'Epic CH6 S3 Console Duos公式のNAC予選通過上位500組には入らないため、出場・順位・チームキルのみ掲載。予選賞金$0。規則: '+rules.S36};
        rule=rules.S36;
      }else if(group==='cosmetics'){
        assert(c.date==='2026-09-25'&&c.region==='NAW'&&c.kind==='参加確認'&&c.rank>100&&c.prize===null,'Unexpected Madison Beer award claim '+id);
        record={...base,prize:0,kind:'参加確認',
          note:'Madison Beer Icon Cup ReloadのEpic公式ウィンドウで参加順位を確認。スキン・バックアクセサリー等の報酬取得は認定しない。現金賞金はない大会。参考: '+rules.COSMETIC};
        rule=rules.COSMETIC;
      }else if(group==='playstation'){
        assert(c.region==='NAW'&&c.date==='2026-06-08'&&c.kind==='参加確認'&&c.rank>100&&c.prize===null,'Unexpected PlayStation final claim '+id);
        record={...base,kind:'参加確認',
          note:'Days of Play PlayStation Cup予選順位をEpic IDで照合。NAW予選の通過枠上位100名に届かず、決勝進出・現金賞金は付与しない。参照: '+rules.PS};
        rule=rules.PS;
      }else if(group==='recent'){
        assert(c.date==='2026-11-06'&&c.region==='NAC'&&c.rank===141&&c.kind==='参加確認'&&c.prize===null&&c.matches<=8&&checkpoint.win.complete===true,'2026 Trios attendance only '+id);
        record={...base,note:'Epic公式Performance Evaluation Trios NAC Event 1 Round 1。Osirion保存済み順位表で141位・175pt・11チームキル・0VR・8試合。公式上位33組の決勝進出対象外で、賞金・突破は未認定。公式: '+rules.PERF};
        rule=rules.PERF;
      }else throw Error('Unknown decision group '+group+' for '+id);
      assert(record.verified===true&&!Object.hasOwn(record,'reviewOnly')&&!Object.hasOwn(record,'reviewReason'),'Invalid published record '+id);
      assert(record.prize===null||record.prize===0,'Unverified cash payout '+id);
      work.push(record);resultIds.add(id);added.push({record,origin:origins.get(id),rule,group});
      decision='published';
    }
    decisions.push({id,group,origin:origins.get(id),decision,
      existingId:duplicates.find(x=>x.id===id)?.existingId||null,
      evidence:checkpoint.win.complete?'Complete saved API window with individually verified rank':'Individual ranked row in incomplete saved API window (no completeness claim)',
      round:c.round,source:c.source,rule:rule||null});
  }
  assert(added.length===23&&duplicates.length===2&&updated.length===1,'Unexpected review totals');
  assert(added.filter(x=>x.origin==='recent').length===1,'Recent review count mismatch');
  const savedIds=new Set([...expected.keys()]);
  const reviews={
    history:{...db.reviews.history,proposals:db.reviews.history.proposals.filter(r=>!savedIds.has(r.id))},
    recent:{...db.reviews.recent,proposals:db.reviews.recent.proposals.filter(r=>!savedIds.has(r.id))}
  };
  const stamp=opts.stamp||'2026-11-06T08:15:53.000Z',date='2026-11-06';
  reviews.history.manualReviewedAt=stamp;reviews.recent.manualReviewedAt=stamp;
  const historyLedger={...db.historyLedger,reviewedAt:stamp,entries:db.historyLedger.entries.concat(
    decisions.filter(x=>x.origin==='history').map(x=>x.decision==='published'
      ?{id:x.id,decision:'published',recordId:x.id,rule:x.rule,evidence:'Rank/Epic ID, official session, saved API checkpoint, duplicate and payout/qualification rules individually verified'}
      :{id:x.id,decision:'already-published',existingId:x.existingId,evidence:'Same official session and verified published result; no second prize or qualification'}))};
  const approvalLedger={...db.approvalLedger,reviewedAt:stamp,entries:db.approvalLedger.entries.concat(
    decisions.filter(x=>x.origin==='recent').map(x=>({id:x.id,recordId:x.id,decision:'published',
      policy:'attendance-only',source:x.source,approvedAt:stamp,approvedBy:'ChatGPT (user-authorized GitHub integration)',
      evidence:'Epic ID, official session and complete saved leaderboard checkpoint; no award/qualification inferred'})))};
  const statuses={};
  for(const origin of ['history','recent']){
    const status=db.statuses[origin],remaining=reviews[origin].proposals;
    statuses[origin]={...status,found:remaining.length,
      manualReviewCandidates:remaining.filter(r=>!r.reviewOnly).length,
      reviewOnlyCandidates:remaining.filter(r=>r.reviewOnly===true).length,
      manualReviewResolvedAt:stamp,manualReviewProcessed:decisions.filter(x=>x.origin===origin).length,
      message:'管理者確認で'+decisions.filter(x=>x.origin===origin&&x.decision==='published').length+'件を掲載、既存重複'+decisions.filter(x=>x.origin===origin&&x.decision!=='published').length+'件を解消。未確認賞金なし。'};
  }
  const updateId='reviewed-25-results-20261106';
  assert(!db.updates.entries.some(x=>x.id===updateId),'Review already published');
  const addedIds=added.map(x=>x.record.id);
  const updates={...db.updates,entries:[{
    id:updateId,date,type:'records',title:'確認待ち25件を精査・23戦績を追加',
    description:'2024年ME Solo Victory Cup予選突破9件、2026年NAW Solo VC 0VR決勝7件、2025年NACデュオ予選参加2件、Madison Beerスキン大会参加3件、PS Cup参加1件、2026/11/6 NAC Performance Evaluation Trios参加1件。既存重複2件は再登録せず、meath/3peace予選は不足していた12キル・6試合を補完。未確認賞金・スキン報酬は付与しない。',
    recordIds:addedIds
  },...db.updates.entries]};
  const audit={version:1,reviewedAt:stamp,source:'Osirion saved API checkpoints + Epic competition windows + published player registry',baseResults:db.results.length,
    newResults:added.length,resolvedDuplicates:duplicates,updatedExisting:updated,
    rules,entries:decisions};
  return {results:work,reviews,statuses,historyLedger,approvalLedger,updates,audit,added,duplicates,updated};
}
module.exports={GROUPS,build};
