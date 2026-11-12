'use strict';
// The canonical season shards are the only production source for test fixtures.
module.exports=require('../scripts/source-results-store.cjs').readResults().rows;
