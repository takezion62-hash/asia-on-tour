'use strict';
const fs=require('node:fs');
const read=(side,file)=>JSON.parse(fs.readFileSync('/tmp/aot-'+side+'-'+file+'.json','utf8'));
const write=(file,obj)=>fs.writeFileSync(file+'.json',JSON.stringify(obj,null,2)+'\n');
const main=read('main','results'), ours=read('ours','results');
const manual=ours.filter(x=>/^manual-s(?:30|32)-me-(?:trios|squads)-final-2024/.test(x.id||''));
if(manual.length!==7)throw Error('Expected 7 screenshot-verified results, got '+manual.length);
const existingIds=new Set(main.map(x=>x.id));
for(const row of manual){
 const match=main.find(x=>x.id===row.id||(x.date===row.date&&x.region===row.region&&x.tournamentId===row.tournamentId&&/Round 2|決勝/.test(x.round||'')&&Array.isArray(x.players)&&x.players.length===row.players.length&&row.players.every(n=>x.players.includes(n))));
 if(match){
   if(['rank','points','kills','vrs','prize'].some(k=>match[k]!==row[k]))throw Error('Conflicting exact team: '+row.id);
 }else{
   if(existingIds.has(row.id))throw Error('ID collision: '+row.id);
   main.push(row);
   existingIds.add(row.id);
 }
}
write('results',main);
const pm=read('main','players'),po=read('ours','players'), known=new Set(pm.candidates.map(p=>p.name));
for(const p of po.candidates){
 if(!known.has(p.name)&&manual.some(r=>r.players.includes(p.name))){pm.candidates.push(p);known.add(p.name);}
}
write('players',pm);
const tm=read('main','tournaments'),to=read('ours','tournaments'),target=tm.catalog.find(t=>t.id==='ch5s5-trios-cash'),from=to.catalog.find(t=>t.id==='ch5s5-trios-cash');
if(!target||!from)throw Error('Missing S32 tournament');
if(target.mode==='unknown'){target.mode=from.mode;target.unknownFields=(target.unknownFields||[]).filter(x=>x!=='mode');}
if(target.mode!==from.mode)throw Error('Inconsistent S32 mode');
for(const e of (from.evidence||[]))if(!(target.evidence||[]).some(x=>x.text===e.text&&x.url===e.url))target.evidence.push(e);
write('tournaments',tm);
const um=read('main','updates'),uo=read('ours','updates'),entry=uo.entries.find(x=>x.id==='manual-verified-2024-me-finals-20261111');
if(!entry||entry.recordIds.length!==7)throw Error('Missing update entry');
if(!um.entries.some(x=>x.id===entry.id))um.entries.unshift(entry);
write('updates',um);
console.log('Reconciled latest main with seven verified manual rows:',main.length,'results',known.size,'player profiles');
// Repeatable merge tool: includes verified screenshot source and concurrent main records.
