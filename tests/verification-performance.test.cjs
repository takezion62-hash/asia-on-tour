'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('verification computes integrity results once per refresh; tab/search/page changes reuse the snapshot',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','verification.js'),'utf8');
 const pageElements=new Map(),tabs=[];
 class Element {
  constructor(id=''){this.id=id;this.dataset={};this.listeners=new Map();this.children=[];this.textContent='';this.disabled=false;this.hidden=false;this.attributes=new Map();}
  addEventListener(type,fn){this.listeners.set(type,fn)}
  setAttribute(name,value){this.attributes.set(name,value)}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  fire(type,value){const handler=this.listeners.get(type);assert.ok(handler,this.id+' '+type);handler({target:{value}})}
 }
 for(const id of ['audit-last-check','audit-data-date','audit-items','audit-summary','audit-pagination',
   'audit-prev','audit-next','audit-selected-count','audit-copy-ids','audit-refresh','audit-loading',
   'audit-search','audit-region','audit-year','audit-tournament','audit-triage','audit-groups',...['queue','duplicate','error','unmapped'].map(x=>'metric-'+x)])pageElements.set(id,new Element(id));
 for(const key of ['queue','duplicates','errors','unmapped','coverage','history']){
  const tab=new Element('tab-'+key);tab.dataset.tab=key;tabs.push(tab);
 }
 const clone=x=>JSON.parse(JSON.stringify(x));
 const sample={
  'results.json':[{id:'one',date:'2026-10-01',region:'ME',event:'Event',player:'Alice',verified:true}],
  'auto-sync-review.json':{proposals:[]},'history-sync-review.json':{proposals:[]},
  'auto-sync-status.json':{checkedAt:'2026-11-09T00:00:00Z',unmappedEventIds:[]},
  'history-sync-status.json':{checkedAt:'2026-11-09T00:00:00Z',fromDate:'2024-05-29',toDate:'2026-11-09',unmappedEventIds:[]},
  'history-sync-reviewed.json':{entries:[]},'updates.json':{entries:[]},
  'calendar-history-status.json':{dates:['2024-05-29','2026-11-09']},
  'calendar-history-index.json':{months:[{month:'2026-10'}]},
  'approval-history.json':{entries:[]},'candidate-triage.json':{version:1,sourceCheckedAt:'2026-11-09T00:00:00Z',queue:[]}
 };
 let inspections=0,proposals=0,requests=0;const cachePolicies=[];
 const engine={
  inspect(rows){inspections++;assert.equal(rows.length,1);return []},
  proposals(){proposals++;return []},
  coverage(){return [{month:'2026-10',region:'ME',published:1,pending:0}]},
  unregistered(){return []}
 };
 const context={
  window:{AotVerification:engine},
  document:{
   currentScript:{src:'http://localhost/verification.js'},
   baseURI:'http://localhost/verification.html',
   getElementById:id=>{assert.ok(pageElements.has(id),'unexpected element '+id);return pageElements.get(id)},
   createElement:tag=>new Element(tag),
   querySelectorAll:selector=>selector==='[data-tab]'?tabs:[]
  },
  navigator:{clipboard:{writeText:async()=>{}}},
  location:{hash:'#coverage'},
  history:{replaceState(){}},
  URL,Option:class {constructor(label,value){this.text=label;this.value=value}},
  fetch:async(url,opts)=>{const name=new URL(url).pathname.slice(1);requests++;cachePolicies.push(opts.cache);
   assert.ok(Object.hasOwn(sample,name),'unexpected network request '+name);
   return {ok:true,json:async()=>clone(sample[name])}
  },
  console
 };
 vm.runInNewContext(source,context,{filename:'verification.js'});
 const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve))};
 await flush();
 assert.equal(inspections,1,'initial load should inspect once');
 assert.equal(proposals,1,'initial load should compute candidate queue once');
 assert.equal(requests,11,'load each file once');
 assert.ok(cachePolicies.every(x=>x==='no-cache'),'JSON should revalidate without forced re-download');
 for(const tab of tabs){tab.fire('click');}
 pageElements.get('audit-search').fire('input','2026');
 pageElements.get('audit-region').fire('change','ME');
 pageElements.get('audit-prev').fire('click');
 pageElements.get('audit-next').fire('click');
 assert.equal(inspections,1,'normal navigation never reruns full 3k-row scan');
 assert.equal(proposals,1,'search and filters reuse queue snapshot');
 assert.equal(requests,11,'tab/filter navigation never refetches JSON');
 pageElements.get('audit-refresh').fire('click');
 await flush();
 assert.equal(inspections,2,'explicit refresh reruns inspection exactly once');
 assert.equal(proposals,2,'explicit refresh reruns candidate lookup exactly once');
 assert.equal(requests,22,'explicit refresh reloads the eleven current sources');
});
