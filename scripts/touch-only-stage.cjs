'use strict';
// February 2026 only: numbered Round/Final IDs identify weekly pairs,
// not consecutive stages. Never extrapolate to S38 or another Test Cup.
function touchStage(windowId){
 const m=String(windowId||'').match(/^S39_MobileTestCup_(Round[1-4]|Final[2-4]?)_(EU|NAC)$/u);
 if(!m)return null;
 const qualifier=m[1].startsWith('Round'),n=qualifier?Number(m[1].slice(5)):Number(m[1].slice(5)||1);
 return {round:qualifier?'Round '+n:n===1?'Final':'Final '+n,stage:qualifier?'予選':'決勝',region:m[2]};
}
module.exports={touchStage};
