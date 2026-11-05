'use strict';
// Diagnostic-only: no credentials, no uploads, no modifications, and no bulk collection.
const target='https://fnapi.osirion.gg';
async function inspect(url) {
  const response=await fetch(url,{headers:{Accept:'application/json,text/html;q=0.9,*/*;q=0.5'},signal:AbortSignal.timeout(18000)});
  const contentType=response.headers.get('content-type')||'';
  const raw=await response.text();
  const base={url:response.url,status:response.status,contentType,bytes:raw.length};
  if(contentType.includes('json')){
    try{
      const data=JSON.parse(raw);
      base.topKeys=data&&typeof data==='object'?Object.keys(data).slice(0,24):[];
      for(const key of ['events','tournaments','items','data','results']){
        const rows=data?.[key];
        if(Array.isArray(rows)){base[key+'_count']=rows.length;base[key+'_firstKeys']=rows[0]&&typeof rows[0]==='object'?Object.keys(rows[0]).slice(0,28):[];}
      }
      if(data?.paths&&typeof data.paths==='object'){
        base.openapiPaths=Object.keys(data.paths).filter(x=>x.includes('tournament'));
        base.operationMeta=Object.entries(data.paths)
          .filter(([path])=>path.includes('/v1/tournaments'))
          .map(([path,ops])=>({path,methods:Object.keys(ops),getParams:(ops.get?.parameters||[]).map(x=>({name:x.name,in:x.in,required:x.required,schema:x.schema})),responseSchema:ops.get?.responses?.['200']?.content?.['application/json']?.schema}));
      }
      if(!response.ok)base.errorCode=data?.error?.code||data?.code||null;
      return base;
    }catch {base.json='unparseable';return base;}
  }
  if(contentType.includes('html')){
    base.docsLinks=[...raw.matchAll(/(?:href|src|url|spec)\s*[:=]\s*["']([^"']{1,260})["']/gi)].map(x=>x[1]).filter(x=>/openapi|swagger|spec|\.json/i.test(x)).slice(0,25);
    base.openapiMentions=[...raw.matchAll(/.{0,100}(?:openapi|swagger|scalar).{0,100}/gi)].slice(0,9).map(x=>x[0].slice(0,220));
  }
  return base;
}
async function run(){
  for(const route of ['/','/openapi.json','/v1/tournaments']){
    try{console.log('OSIRION_PROBE '+JSON.stringify(await inspect(target+route)).slice(0,12000));}
    catch(e){console.log('OSIRION_PROBE_ERROR '+JSON.stringify({route,error:e.message}));}
  }
}
run();
