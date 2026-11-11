'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {loadReviewDb,upsertPublicationLog,writeReviewDb}=require('../scripts/reviewed-publication-core.cjs');

const fixture=()=>({
 'results.json':[{id:'published-a',prize:0}],
 'players.json':{candidates:[{name:'A'}]},
 'tournaments.json':{catalog:[{id:'event'}]},
 'auto-sync-review.json':{proposals:[{id:'recent-candidate'}]},
 'history-sync-review.json':{proposals:[{id:'old-candidate'}]},
 'auto-sync-status.json':{found:1},
 'history-sync-status.json':{found:1},
 'auto-sync-scan.json':{windows:{recent:{complete:true}}},
 'history-sync-scan.json':{windows:{history:{complete:true}}},
 'approval-history.json':{entries:[{id:'published-a',decision:'published'}]},
 'updates.json':{entries:[]}
});
function sandbox(action){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aot-publisher-'));
 try{
  const source=fixture();
  for(const [file,content] of Object.entries(source))
   fs.writeFileSync(path.join(root,file),JSON.stringify(content,null,2)+'\n');
  return action(root,source);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
}
test('3種類の大会別掲載処理が同じデータ構造を安全に読み込める',()=>sandbox((root,source)=>{
 const before=JSON.stringify(source);
 const db=loadReviewDb(root);
 assert.deepEqual(db.results,source['results.json']);
 assert.deepEqual(db.players,source['players.json']);
 assert.deepEqual(db.tournaments,source['tournaments.json']);
 assert.deepEqual(db.reviews.auto,source['auto-sync-review.json']);
 assert.deepEqual(db.reviews.history,source['history-sync-review.json']);
 assert.deepEqual(db.statuses.auto,source['auto-sync-status.json']);
 assert.deepEqual(db.statuses.history,source['history-sync-status.json']);
 assert.deepEqual(db.scans.auto,source['auto-sync-scan.json']);
 assert.deepEqual(db.scans.history,source['history-sync-scan.json']);
 assert.deepEqual(db.ledger,source['approval-history.json']);
 assert.deepEqual(db.updates,source['updates.json']);
 assert.deepEqual(db.calendar,{});
 assert.equal(JSON.stringify(source),before,'loader must not change source objects');
}));
test('共通の保存処理は従来の7ファイルだけを更新して読み取り専用資料を保持',()=>sandbox((root,source)=>{
 const unchanged=['players.json','tournaments.json','auto-sync-scan.json','history-sync-scan.json'];
 const before=Object.fromEntries(unchanged.map(p=>[p,fs.readFileSync(path.join(root,p),'utf8')]));
 const db=loadReviewDb(root);
 db.results.push({id:'new-result',prize:null});
 db.reviews.auto.proposals=[];
 db.reviews.history.proposals=[];
 db.statuses.auto.found=0;
 db.statuses.history.found=0;
 db.ledger.entries.push({id:'new-result',decision:'published'});
 db.updates.entries.push({id:'reviewed-batch',recordIds:['new-result']});
 writeReviewDb(root,db);
 const mapped=[
  ['results.json',db.results],['auto-sync-review.json',db.reviews.auto],
  ['history-sync-review.json',db.reviews.history],['auto-sync-status.json',db.statuses.auto],
  ['history-sync-status.json',db.statuses.history],
  ['approval-history.json',db.ledger],['updates.json',db.updates]
 ];
 for(const [file,expected] of mapped){
  const raw=fs.readFileSync(path.join(root,file),'utf8');
  assert.equal(raw,JSON.stringify(expected,null,2)+'\n','exact JSON format must be preserved: '+file);
 }
 for(const file of unchanged)assert.equal(fs.readFileSync(path.join(root,file),'utf8'),before[file],
  'read-only source must not be rewritten: '+file);
 assert.equal(source['results.json'].length,1,'original file fixture must not be mutated');
}));
test('初回掲載マーカーは元の履歴を残して先頭に1件追加',()=>{
 const updates={entries:[{id:'older',recordIds:['old']}]};
 const ids=['one','two'];
 const row=upsertPublicationLog(updates,{id:'batch',date:'2026-11-11',
  title:'Official event',description:'Verified only',recordIds:ids});
 assert.deepEqual(row,{id:'batch',date:'2026-11-11',type:'records',
  title:'Official event',description:'Verified only',recordIds:['one','two']});
 assert.equal(updates.entries.length,2);
 assert.equal(updates.entries[0],row);
 assert.deepEqual(updates.entries[1],{id:'older',recordIds:['old']});
 ids.push('three');
 assert.deepEqual(row.recordIds,['one','two'],'caller must not mutate stored audit list');
});
test('再掲載マーカーは順序を保持しつつ重複を除外し説明だけ更新',()=>{
 const prev={id:'batch',date:'2026-11-10',type:'records',title:'Old title',
  description:'Old description',recordIds:['one','two']};
 const updates={entries:[{id:'older',recordIds:['x']},prev]};
 const options={id:'batch',date:'2026-11-11',title:'Ignored title',description:'Ignored description',
  recordIds:['two','three'],existingDescription:n=>'Total '+n};
 const result=upsertPublicationLog(updates,options);
 assert.equal(result,prev);
 assert.equal(updates.entries.length,2);
 assert.deepEqual(updates.entries.map(x=>x.id),['older','batch']);
 assert.deepEqual(prev.recordIds,['one','two','three']);
 assert.equal(prev.description,'Total 3');
 assert.equal(prev.date,'2026-11-10');
 assert.equal(prev.title,'Old title');
 upsertPublicationLog(updates,options);
 assert.deepEqual(prev.recordIds,['one','two','three'],'repeated run must not duplicate records');
 assert.equal(prev.description,'Total 3');
});
test('履歴の二重マーカー・空バッチ・不正IDは公開せず中止',()=>{
 assert.throws(()=>upsertPublicationLog({entries:[{id:'a'},{id:'a'}]},
  {id:'a',recordIds:['safe']}),/duplicate update marker/);
 for(const ids of [[],[''],['same','same']]){
  const updates={entries:[]};
  assert.throws(()=>upsertPublicationLog(updates,{id:'bad',recordIds:ids}),/invalid marker or result IDs/);
  assert.deepEqual(updates,{entries:[]},'invalid input must not write an audit log');
 }
 assert.throws(()=>upsertPublicationLog({entries:[]},{id:'',recordIds:['safe']}),/invalid marker/);
});
test('Cash・コスメ・FNCSの既存エントリーが共通基盤を使い、固有ルールを維持',()=>{
 const root=path.resolve(__dirname,'..');
 const fixtures=[
  ['publish-verified-cash-playstation-pending.cjs','cash-playstation-reviewed-batch-20261111','const RULES=Object.freeze'],
  ['publish-verified-cosmetic-pending.cjs','reviewed-cosmetic-result-batch-20261111','CUT_OFFS'],
  ['publish-verified-fncs-performance-days.cjs','fncs-performance-days-20261111','const allow={']
 ];
 for(const [file,marker,rules] of fixtures){
  const src=fs.readFileSync(path.join(root,'scripts',file),'utf8');
  assert.match(src,/require\('\.\/manual-approval-core\.cjs'\)/);
  assert.match(src,/require\('\.\/reviewed-publication-core\.cjs'\)/);
  assert.match(src,/loadReviewDb\(root\)/);
  assert.match(src,/upsertPublicationLog\(db\.updates,/);
  assert.match(src,/writeReviewDb\(root,db\)/);
  assert.ok(src.includes(marker),'original publication audit ID must be kept');
  assert.ok(src.includes(rules),'tournament-specific rules must stay intact');
  assert.match(src,/apply\(db,/,'shared Epic ID/score/collision validation must remain');
  assert.ok(src.includes('!dry&&'),'dry-run must retain its no-write behavior');
 }
});
