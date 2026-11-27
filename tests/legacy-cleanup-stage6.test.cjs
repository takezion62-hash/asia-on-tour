'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const snapshots=[
 ['results (1).json','results-original-snapshot.json','7b7082c0950816e1e8c3f7c60276be98e21d564a',183],
 ['results-20260922-nac-additions.json','results-20260922-nac-additions.json','dcf9ff37259588721ece098a45ae9b1030f6dd21',10],
 ['tournaments (1).json','tournaments-original-snapshot.json','1e4e6fdfdb525c87d31f005abb935b0bb4ff06c8',13]
];
const archive='docs/archive/legacy-data/';
function walk(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(['.git','node_modules','playwright-report','test-results','docs'].includes(e.name))return [];
  const p=path.join(dir,e.name);
  if(e.isDirectory())return walk(p);
  return e.isFile()&&/\.(?:[cm]?js|html|css|ya?ml|sh|py)$/.test(e.name)&&p!==__filename?[p]:[];
 });
}
test('retired root snapshots retain exact Git blobs, never become active data',()=>{
 const sources=[...walk(root),path.join(root,'package.json')];
 for(const [old,name,sha,count] of snapshots){
  assert.equal(fs.existsSync(path.join(root,old)),false,old);
  const bytes=fs.readFileSync(path.join(root,archive,name));
  assert.equal(crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sha,name);
  const json=JSON.parse(bytes);
  assert.equal((json.catalog||json).length,count);
  const refs=sources.filter(p=>fs.readFileSync(p,'utf8').includes(old)||fs.readFileSync(p,'utf8').includes(archive+name)||fs.readFileSync(p,'utf8').includes(encodeURIComponent(old)));
  assert.deepEqual(refs.map(p=>path.relative(root,p)),[],'retired snapshot is referenced by active code: '+old);
 }
});
test('current documentation directs operators to split canonical data, generated indexes and historical sections',()=>{
 for(const name of ['README.md','AUTO_SYNC.md','docs/WORKFLOW_OPERATIONS.md']){
  const c=fs.readFileSync(path.join(root,name),'utf8');
  assert.match(c,/source-results\//,name);
  assert.match(c,/season-data\//,name);
  assert.match(c,/2026-11-27/,name);
 }
 const c=fs.readFileSync(path.join(root,'README.md'),'utf8');
 assert.doesNotMatch(c,/新しい戦績を登録する際は、results\.json/);
 assert.match(c,/旧スナップショットを正本にコピー/);
});
