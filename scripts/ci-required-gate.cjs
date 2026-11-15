'use strict';
// Preserve the existing required status: every allowed skip must match the
// trusted change scope; failed, absent, cancelled or unexpected jobs fail shut.
function evaluate({scopeResult,mode,unitResult,browserResult,smokeResult,focusedBrowserResult,focusedBrowserRequired}) {
 if (scopeResult !== 'success' || unitResult !== 'success')
   return {ok:false,reason:'classification-or-validation-failed'};
 if (mode === 'full') return {
   ok:browserResult === 'success' && smokeResult === 'skipped' && focusedBrowserResult === 'skipped',
   reason:'full-requires-every-browser-shard'
 };
 if (mode === 'data') return {
   ok:browserResult === 'skipped' && smokeResult === 'success' && focusedBrowserResult === 'skipped',
   reason:'data-requires-pc-mobile-smoke'
 };
 if (mode === 'focused') return {
   ok:browserResult === 'skipped' && smokeResult === 'skipped' &&
     (focusedBrowserRequired === 'true'
       ? focusedBrowserResult === 'success'
       : focusedBrowserRequired === 'false' && focusedBrowserResult === 'skipped'),
   reason:'focused-requires-related-units-and-if-applicable-both-device-browser-tests'
 };
 return {ok:false,reason:'unknown-mode'};
}
if(require.main===module){
 const input={
   scopeResult:process.env.SCOPE_RESULT,
   mode:process.env.MODE,
   unitResult:process.env.UNIT_RESULT,
   browserResult:process.env.BROWSER_RESULT,
   smokeResult:process.env.SMOKE_RESULT,
   focusedBrowserResult:process.env.FOCUSED_BROWSER_RESULT,
   focusedBrowserRequired:process.env.FOCUSED_BROWSER_REQUIRED
 };
 const result=evaluate(input);
 console.log('Required CI gate:',JSON.stringify(input),
   result.ok?'PASS':'FAIL: '+result.reason);
 if(!result.ok)process.exitCode=1;
}
module.exports={evaluate};
