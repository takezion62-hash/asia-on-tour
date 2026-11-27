'use strict';
// Compatibility entrypoint; evidence and rules are unchanged.
const {applyBatch,cli}=require('./mobile-screenshot-publication.cjs');
const BATCH='mobile-extra-ten-20261121';
const apply=options=>applyBatch(BATCH,options);
if(require.main===module)try{cli(BATCH)}catch(error){console.error(error.stack);process.exitCode=1}
module.exports={apply};
