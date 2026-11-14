'use strict';

// Browser regression tests must cover every published season and the full
// archive exactly once, but a single long test can mask the failing season.
function seasonCheckGroups(seasonIds,size=4){
 if(!Array.isArray(seasonIds)||!Number.isSafeInteger(size)||size<1||size>20||
   seasonIds.some(id=>typeof id!=='string'||!id.trim()))
  throw new Error('Invalid season check groups');
 const unique=[...new Set(seasonIds.filter(id=>id!=='all')),'all'];
 const groups=[];
 for(let i=0;i<unique.length;i+=size)groups.push(unique.slice(i,i+size));
 return groups;
}
module.exports={seasonCheckGroups};
