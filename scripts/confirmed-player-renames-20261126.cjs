'use strict';
// Explicit user-confirmed canonical name changes, not new accounts.
const CHANGES=Object.freeze([
 Object.freeze(['yotta guɿäʙöɴ-ɷ-','gurabon','GU']),
 Object.freeze(['おらんげ','Lucci','LU']),
 Object.freeze(['ぜろむの弟','えるやちぇ','える'])
]);
const forward=new Map(CHANGES.map(([a,b])=>[a,b]));
const name=(n,map)=>map.get(n)||n;
function renameRow(row,map=forward){
 const r={...row};
 if(typeof r.player==='string')r.player=r.player.split(' / ').map(n=>name(n,map)).join(' / ');
 if(Array.isArray(r.players))r.players=r.players.map(n=>name(n,map));
 if(Array.isArray(r.profiles))r.profiles=r.profiles.map(p=>({...p,name:name(p.name,map)}));
 return r;
}
function renamePlayers(doc){
 const p=structuredClone(doc),known=new Set(p.candidates.map(x=>x.name));
 if(known.size!==p.candidates.length)throw Error('RENAME duplicate canonical name');
 for(const [old,fresh,initials] of CHANGES){
  if(known.has(old)&&known.has(fresh))throw Error('RENAME both canonical names exist: '+fresh);
  for(const [owner,aliases] of Object.entries(p.confirmedAliases))
   if(owner!==old&&owner!==fresh&&(aliases.includes(old)||aliases.includes(fresh)))throw Error('RENAME conflicting alias '+owner);
  if(known.has(old)){
   const c=p.candidates.find(x=>x.name===old);c.name=fresh;c.initials=initials;
   p.confirmedAliases[fresh]=[...new Set([...(p.confirmedAliases[fresh]||[]),...(p.confirmedAliases[old]||[]),old])].filter(x=>x!==fresh);
   delete p.confirmedAliases[old];known.delete(old);known.add(fresh);
  }
  if(!known.has(fresh)||!(p.confirmedAliases[fresh]||[]).includes(old))throw Error('RENAME missing confirmed identity '+old);
 }
 return p;
}
// Only for replay of immutable historic proof: use an explicitly confirmed
// old canonical identity, then require the original byte-level proof hash.
function historicalContext(context){
 const doc=context.players;if(!doc||!Array.isArray(doc.candidates))return null;
 const reverse=new Map(CHANGES.filter(([old,fresh])=>doc.candidates.some(p=>p.name===fresh)&&
  !doc.candidates.some(p=>p.name===old)&&(doc.confirmedAliases?.[fresh]||[]).includes(old)).map(([old,fresh])=>[fresh,old]));
 if(!reverse.size)return null;
 const players=structuredClone(doc);
 for(const [fresh,old] of reverse){
  players.candidates.find(p=>p.name===fresh).name=old;
  players.confirmedAliases[old]=[...new Set([...(players.confirmedAliases[fresh]||[]).filter(n=>n!==old),fresh])];
  delete players.confirmedAliases[fresh];
 }
 return {reverse,context:{...context,players,results:context.results.map(r=>renameRow(r,reverse)),
  verifiedAccounts:context.verifiedAccounts.map(a=>({...a,player:name(a.player,reverse)}))}};
}
module.exports={CHANGES,forward,renameRow,renamePlayers,historicalContext};
