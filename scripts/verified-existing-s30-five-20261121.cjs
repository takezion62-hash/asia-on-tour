'use strict';
// Five S30 exact duplicate proofs: saved Epic account-ID rank==a previously published
// Fortnite Tracker record with identical player/date/event/region/stats.
// Never copies an original cash award into an unverified participation entry.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-exact-s30-five-already-published.json'),'utf8'));
const GOLD=Object.freeze([
  {
    "candidate": {
      "id": "auto-s30-01041f98555b",
      "date": "2024-06-29",
      "region": "OCE",
      "event": "PlayStation Cup Battle Royale",
      "player": "Mofu",
      "playerRaw": "RC MOFU 16ǃ",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 6,
      "points": 95,
      "kills": 5,
      "vrs": 2,
      "matches": 6,
      "prize": null,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-br",
      "source": "https://www.fortnite.com/competitive/events/S30_PlaystationCupJune/?region=OCE&round=S30_PlaystationCupJune_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s30-oce-s30ocebr-final-20240629-r6",
      "date": "2024-06-29",
      "region": "OCE",
      "event": "PlayStation Cup Battle Royale",
      "player": "Mofu",
      "rank": 6,
      "points": 95,
      "kills": 5,
      "vrs": 2,
      "matches": 6,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-br",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 300,
      "source": "https://fortnitetracker.com/events/epicgames_S30_PlaystationCupJune_OCE?window=S30_PlaystationCupJune_Final_OCE"
    }
  },
  {
    "candidate": {
      "id": "auto-s30-b21d54b0ed04",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "とまと",
      "playerRaw": "helix r7chay4",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 25,
      "points": 59,
      "kills": 9,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "source": "https://www.fortnite.com/competitive/events/S30_PlaystationCupZBJune/?region=OCE&round=S30_PlaystationCupZBJune_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s30-oce-s30ocezb-final-20240630-r25",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "とまと",
      "rank": 25,
      "points": 59,
      "kills": 9,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 100,
      "source": "https://fortnitetracker.com/events/epicgames_S30_PlaystationCupZBJune_OCE?window=S30_PlaystationCupZBJune_Final_OCE"
    }
  },
  {
    "candidate": {
      "id": "auto-s30-599f8746ab74",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "ぱやぱやの和田もひ",
      "playerRaw": "VRS k3nz1xJR",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 41,
      "points": 35,
      "kills": 2,
      "vrs": 0,
      "matches": 5,
      "prize": null,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "source": "https://www.fortnite.com/competitive/events/S30_PlaystationCupZBJune/?region=OCE&round=S30_PlaystationCupZBJune_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s30-oce-s30ocezb-final-20240630-r41",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "ぱやぱやの和田もひ",
      "rank": 41,
      "points": 35,
      "kills": 2,
      "vrs": 0,
      "matches": 5,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 100,
      "source": "https://fortnitetracker.com/events/epicgames_S30_PlaystationCupZBJune_OCE?window=S30_PlaystationCupZBJune_Final_OCE"
    }
  },
  {
    "candidate": {
      "id": "auto-s30-3b9f24dd844c",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "はるぱか",
      "playerRaw": "Lit どうみてもはるぱか",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 56,
      "points": 22,
      "kills": 7,
      "vrs": 0,
      "matches": 6,
      "prize": null,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "source": "https://www.fortnite.com/competitive/events/S30_PlaystationCupZBJune/?region=OCE&round=S30_PlaystationCupZBJune_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s30-oce-s30ocezb-final-20240630-r56",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "はるぱか",
      "rank": 56,
      "points": 22,
      "kills": 7,
      "vrs": 0,
      "matches": 6,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 100,
      "source": "https://fortnitetracker.com/events/epicgames_S30_PlaystationCupZBJune_OCE?window=S30_PlaystationCupZBJune_Final_OCE"
    }
  },
  {
    "candidate": {
      "id": "auto-s30-95264e1cc8ad",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "Mofu",
      "playerRaw": "RC MOFU 16ǃ",
      "round": "Final / 参加確認",
      "kind": "参加確認",
      "rank": 83,
      "points": 5,
      "kills": 1,
      "vrs": 0,
      "matches": 4,
      "prize": null,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "source": "https://www.fortnite.com/competitive/events/S30_PlaystationCupZBJune/?region=OCE&round=S30_PlaystationCupZBJune_Final_OCE",
      "reviewOnly": true,
      "reviewReason": "確認専用大会は自動承認不可"
    },
    "existing": {
      "id": "ps-s30-oce-s30ocezb-final-20240630-r83",
      "date": "2024-06-30",
      "region": "OCE",
      "event": "PlayStation Cup Zero Build",
      "player": "Mofu",
      "rank": 83,
      "points": 5,
      "kills": 1,
      "vrs": 0,
      "matches": 4,
      "seasonId": "S30",
      "tournamentId": "ch5s3-playstation-cup-zb",
      "kind": "賞金決勝",
      "round": "Final / 賞金決勝",
      "prize": 100,
      "source": "https://fortnitetracker.com/events/epicgames_S30_PlaystationCupZBJune_OCE?window=S30_PlaystationCupZBJune_Final_OCE"
    }
  }
]);
const fail=(ok,message)=>{if(!ok)throw Error('EXACT_EXISTING_S30_FIVE_PROOF '+message)};
const fields=['id','date','region','event','player','playerRaw','round','kind',
 'rank','points','kills','vrs','matches','prize','seasonId','tournamentId','source',
 'reviewOnly','reviewReason'];
const oldFields=['id','date','region','event','player','rank','points','kills','vrs',
 'matches','seasonId','tournamentId','kind','round','prize','source'];
const same=(a,b,fields)=>fields.every(k=>a[k]===b[k]);
function parseSources(candidate,old){
 let u,v;
 try{u=new URL(candidate.source);v=new URL(old.source)}catch{return false}
 const id=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/u)?.[1];
 const window=u.searchParams.get('round'),region=u.searchParams.get('region');
 return Boolean(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
  v.protocol==='https:'&&v.hostname==='fortnitetracker.com'&&
  id&&window&&region===candidate.region&&
  v.pathname==='/events/epicgames_'+id+'_'+region&&
  v.searchParams.get('window')===window&&
  u.searchParams.size===2&&v.searchParams.size===1&&
  window.endsWith('_'+region));
}
function validateProof(){
 const data=DOC.batch?.records||[];
 fail(DOC.version===1&&DOC.batch.id==='verified-existing-s30-five-20261121'&&
  DOC.batch.reviewedOn==='2026-11-21'&&data.length===5&&
  DOC.expected.duplicates===5&&DOC.expected.resultsAdded===0&&
  DOC.expected.cashAdded===0,
  'approved duplicate snapshot changed');
 const seen=new Set(),oldSeen=new Set();
 for(let i=0;i<GOLD.length;i++){
  const g=GOLD[i],p=data[i],c=p?.candidate,e=p?.existing;
  fail(c&&e&&same(c,g.candidate,fields)&&same(e,g.existing,oldFields),
   'source or published result mutated '+g.candidate.id);
  fail(!seen.has(c.id)&&!oldSeen.has(e.id)&&c.id!==e.id,
   'duplicate ID or published ID reused '+c.id);
  seen.add(c.id);oldSeen.add(e.id);
  fail(c.kind==='参加確認'&&e.kind==='賞金決勝'&&
   c.verified===true&&typeof c.reviewReason==='string'&&c.reviewReason.length>0&&
   c.date===e.date&&c.region===e.region&&c.event===e.event&&
   c.player===e.player&&c.rank===e.rank&&c.points===e.points&&
   c.kills===e.kills&&c.vrs===e.vrs&&c.seasonId===e.seasonId&&
   c.tournamentId===e.tournamentId&&
   (e.matches===undefined||c.matches===e.matches)&&
   Number.isFinite(e.prize)&&e.prize>=0,
   'not exactly the same published stat or missing existing award '+c.id);
  fail(parseSources(c,e),'different Epic/Tracker event or window '+c.id);
 }
 return true;
}
function matchCandidate(r,spec){
 return Boolean(r&&spec&&same(r,spec.candidate,fields)&&r.verified===true&&
  parseSources(r,spec.existing));
}
function matchPublished(r,spec){
 return Boolean(r&&spec&&same(r,spec.existing,oldFields)&&
  r.kind==='賞金決勝'&&r.prize===spec.existing.prize&&
  parseSources(spec.candidate,r));
}
validateProof();
module.exports={DOC,GOLD,validateProof,matchCandidate,matchPublished,parseSources};
