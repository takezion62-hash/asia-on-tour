'use strict';
// The existing required status name is shared by both scopes. A skipped
// browser job is permitted ONLY for a trusted, successful data-only PR whose
// PC/mobile smoke also passed. All other skips or unknown modes fail.
function evaluate({scopeResult,mode,unitResult,browserResult,smokeResult}) {
 if (scopeResult !== 'success' || unitResult !== 'success')
   return {ok:false,reason:'classification-or-validation-failed'};
 if (mode === 'full') return {
   ok:browserResult === 'success' && smokeResult === 'skipped',
   reason:'full-requires-every-browser-shard'
 };
 if (mode === 'data') return {
   ok:browserResult === 'skipped' && smokeResult === 'success',
   reason:'data-requires-pc-mobile-smoke'
 };
 return {ok:false,reason:'unknown-mode'};
}
if(require.main===module){
 const input={
   scopeResult:process.env.SCOPE_RESULT,
   mode:process.env.MODE,
   unitResult:process.env.UNIT_RESULT,
   browserResult:process.env.BROWSER_RESULT,
   smokeResult:process.env.SMOKE_RESULT
 };
 const result=evaluate(input);
 console.log('Required CI gate:',JSON.stringify(input),
   result.ok?'PASS':'FAIL: '+result.reason);
 if(!result.ok)process.exitCode=1;
}
module.exports={evaluate};
