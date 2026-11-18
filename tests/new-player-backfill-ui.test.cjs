'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('new-player backfill is shown inside the existing Updates AUTO SYNC card, not on a separate page',()=>{
 const html=read('index.html'),css=read('auto-sync-ui.css'),js=read('auto-sync-ui.js');
 const section=html.indexOf('id="page-updates"');
 const auto=html.indexOf('id="auto-sync-heading"',section);
 const player=html.indexOf('id="new-player-backfill-heading"',auto);
 const history=html.indexOf('id="history-sync-heading"',auto);
 const end=html.indexOf('</section>',section);
 assert.ok(section>=0&&auto>section&&player>auto&&history>player,'new section belongs in existing AUTO SYNC card');
 assert.ok(end>section);
 for(const id of ['new-player-backfill-status','new-player-backfill-refresh'])
  assert.ok(html.includes('id="'+id+'"'));
 assert.ok(css.includes('.auto-sync-delta-stats'));
 assert.ok(css.includes('@media(max-width:640px)'));
 assert.ok(js.includes("new URL('history-sync-status.json',base)"));
 assert.ok(js.includes('renderNewPlayerBackfill(status)'));
 assert.ok(js.includes("deltaBtn.addEventListener('click',refreshHistory)"));
 assert.ok(!/fetch\([^;]*method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(js));
 assert.doesNotThrow(()=>new Function(js));
});

class FakeNode {
 constructor(name='div'){this.name=name;this._text='';this.children=[];this.handlers={};this.disabled=false;this.className=''}
 set textContent(v){this._text=String(v);this.children=[]}
 get textContent(){return this._text+this.children.map(x=>typeof x==='string'?x:x.textContent).join('')}
 replaceChildren(...children){this._text='';this.children=children}
 append(...children){this.children.push(...children)}
 addEventListener(type,callback){this.handlers[type]=callback}
}
function startUi(){
 const ids=['auto-sync-status','auto-sync-refresh','auto-sync-proposals',
  'history-sync-status','history-sync-refresh','history-sync-proposals',
  'new-player-backfill-status','new-player-backfill-refresh'];
 const elements=new Map(ids.map(id=>[id,new FakeNode(id)]));
 let history={
  version:1,scope:'history',checkedAt:'2026-11-18T09:09:33.493Z',
  fromDate:'2023-01-01',toDate:'2026-11-18',
  newPlayerBackfill:{
   initialized:false,newAccounts:0,pendingWindows:0,windowsVisited:0,
   windowsCompleted:0,pagesScanned:0,proposalsFound:0,
   heldWindows:0,rateLimited:false,retryAfter:null}
 };
 const calls=[];
 const fetch=async target=>{
  const name=new URL(String(target)).pathname.split('/').pop();
  calls.push(name);
  const data={
   'auto-sync-status.json':{version:1,state:'checked',mode:'review',linkedPlayers:669,found:0,imported:0},
   'auto-sync-review.json':{version:1,proposals:[]},
   'history-sync-status.json':history,
   'history-sync-review.json':{version:1,proposals:[]}
  }[name];
  if(!data)return {ok:false,status:404};
  return {ok:true,json:async()=>structuredClone(data)};
 };
 const document={
  currentScript:{src:'https://example.test/asia-on-tour/auto-sync-ui.js'},
  baseURI:'https://example.test/asia-on-tour/index.html',
  getElementById:id=>elements.get(id)||null,
  createElement:name=>new FakeNode(name)
 };
 vm.runInNewContext(read('auto-sync-ui.js'),{document,fetch,URL,Date,Number,Map,console});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {elements,calls,flush,changeHistory:s=>{history=s}};
}

test('render uses accurate latest historical run metrics and makes an empty queue understandable',async()=>{
 const app=startUi();await app.flush();
 const txt=app.elements.get('new-player-backfill-status').textContent;
 assert.match(txt,/今回検出した新規Epic ID0件/);
 assert.match(txt,/再調査待ちの開催枠0枠/);
 assert.match(txt,/今回見つかった確認候補0件/);
 assert.match(txt,/現在は新しい本人確認済みEpic IDの登録待ちです/);
 assert.match(txt,/最新の過去大会チェック/);
 assert.ok(app.calls.includes('history-sync-status.json'));
 const btn=app.elements.get('new-player-backfill-refresh');
 assert.equal(typeof btn.handlers.click,'function');
 assert.equal(btn.disabled,false);
});
test('the same button refreshes the subsection, shows rate limit and never treats candidates as published results',async()=>{
 const app=startUi();await app.flush();
 app.changeHistory({
  version:1,scope:'history',checkedAt:'2026-11-18T10:30:00.000Z',
  fromDate:'2023-01-01',toDate:'2026-11-18',
  newPlayerBackfill:{
   initialized:false,newAccounts:2,pendingWindows:12,windowsVisited:2,
   windowsCompleted:1,pagesScanned:4,proposalsFound:3,
   heldWindows:1,rateLimited:true,retryAfter:'2026-11-18T12:22:50.278Z'}
 });
 await app.elements.get('new-player-backfill-refresh').handlers.click();
 const txt=app.elements.get('new-player-backfill-status').textContent;
 assert.match(txt,/今回検出した新規Epic ID2件/);
 assert.match(txt,/再調査待ちの開催枠12枠/);
 assert.match(txt,/今回取得した順位表4ページ/);
 assert.match(txt,/今回発見した確認候補3件/);
 assert.match(txt,/APIアクセス制限により新規取得を中断しました/);
 assert.match(txt,/再試行可能時刻/);
 assert.doesNotMatch(txt,/3件掲載|3件賞金確定/);
 assert.ok(app.calls.every(x=>x.endsWith('.json')),'site controls only read status files');
});
test('absent and initial-baseline status are shown explicitly rather than inventing zero progress',async()=>{
 const app=startUi();await app.flush();
 const btn=app.elements.get('new-player-backfill-refresh');
 app.changeHistory({version:1,scope:'history',checkedAt:'2026-11-18T09:30:00Z'});
 await btn.handlers.click();
 assert.match(app.elements.get('new-player-backfill-status').textContent,/実行結果はまだありません/);
 app.changeHistory({version:1,scope:'history',checkedAt:'2026-11-18T09:50:00Z',
   newPlayerBackfill:{initialized:true,newAccounts:0,pendingWindows:0}});
 await btn.handlers.click();
 assert.match(app.elements.get('new-player-backfill-status').textContent,/基準化が完了/);
});
