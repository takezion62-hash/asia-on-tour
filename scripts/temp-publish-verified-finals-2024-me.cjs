'use strict';
const fs=require('node:fs');
const read=n=>JSON.parse(fs.readFileSync(n,'utf8'));
const write=(n,d)=>fs.writeFileSync(n,JSON.stringify(d,null,2)+'\n');
const payload=read('data/verified-finals-2024-me.json');
const results=read('results.json');
const players=read('players.json');
const tournaments=read('tournaments.json');
const updates=read('updates.json');
if(payload.rows.length!==7)throw Error('Expected exactly seven verified teams');
const valid=payload.rows.map(r=>{
 const names=r.players||[];
 if(!(names.length===3||names.length===4)||r.region!=='ME'||r.round.indexOf('Round 2')===-1||!r.verified||r.prize<0||r.prize%names.length!==0||!r.profiles||r.profiles.length!==names.length||r.profiles.some(p=>!p.url.startsWith('https://fortnitetracker.com/')))throw Error('Invalid screenshot-verified entry '+r.id);
 if(r.prize>0&&r.prizePerPlayer*names.length!==r.prize)throw Error('Prize mismatch '+r.id);
 return r;
});
if(valid.reduce((sum,r)=>sum+r.prize,0)!==1700||valid.filter(r=>r.prize===0).length!==2)throw Error('Expected cash-total $1700 / two $0 records');
const inserted=[],already=[];
for(const r of valid){
 const possible=results.filter(x=>x.id===r.id||(x.date===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&/Round 2|決勝/.test(x.round||'')&&Array.isArray(x.players)&&x.players.length===r.players.length&&r.players.every(n=>x.players.includes(n))));
 if(possible.length>1)throw Error('Duplicate existing results '+r.id);
 if(possible.length===1){
   const old=possible[0];
   if(['rank','points','kills','vrs','prize'].some(key=>old[key]!==r[key]))throw Error('Conflicting result '+r.id);
   already.push(r.id);
 }else{
   if(results.some(x=>x.date===r.date&&x.tournamentId===r.tournamentId&&x.region===r.region&&x.rank===r.rank&&/Round 2|決勝/.test(x.round||'')))throw Error('Occupied rank '+r.id);
   results.push(r); inserted.push(r.id);
 }
}
const known=new Set(players.candidates.map(p=>p.name));
let newPlayers=0;
for(const candidate of payload.playerCandidates){
 if(!known.has(candidate.name)){players.candidates.push(candidate);known.add(candidate.name);newPlayers++;}
}
const tournament=tournaments.catalog.find(x=>x.id===payload.tournament.id);
if(!tournament)throw Error('Missing S32 tournament');
if(tournament.mode==='unknown'){tournament.mode=payload.tournament.mode;tournament.unknownFields=(tournament.unknownFields||[]).filter(x=>x!=='mode');}
if(tournament.mode!==payload.tournament.mode)throw Error('Tournament mode conflict');
for(const evidence of payload.tournament.evidence||[]){
 if(!(tournament.evidence||[]).some(x=>x.url===evidence.url&&x.text===evidence.text))tournament.evidence.push(evidence);
}
if(!updates.entries.some(x=>x.id===payload.update.id))updates.entries.unshift(payload.update);
write('results.json',results);
write('players.json',players);
write('tournaments.json',tournaments);
write('updates.json',updates);
console.log(JSON.stringify({inserted:inserted.length,already:already.length,newPlayers,totalResults:results.length,cashTotal:valid.reduce((s,r)=>s+r.prize,0)},null,2));
