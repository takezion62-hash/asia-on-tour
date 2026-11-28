'use strict';
// Source-only schedule label repair, no API and no match-result mutations.
// Regenerate labels in both historical archive representations; idempotent.
const fs=require('node:fs'),path=require('node:path');
const {touchStage}=require('./touch-only-stage.cjs');
const root=path.resolve(__dirname,'..');
function correct(doc){
 let changed=0;
 for(const s of doc.sessions||[]){
  if(s.tournamentId!=='ch7s1-touch-only-test-cup'||s.eventId!=='S39_MobileTestCup')continue;
  const t=touchStage(s.sourceWindowId);
  if(!t||t.region!==s.region)continue;
  if(s.round!==t.round||s.stage!==t.stage){s.round=t.round;s.stage=t.stage;changed++}
 }
 return changed;
}
function main(){
 for(const file of ['calendar-history.json','calendar-history/2026-02.json']){
  const p=path.join(root,file),doc=JSON.parse(fs.readFileSync(p,'utf8')),changed=correct(doc);
  if(changed&&!process.argv.includes('--dry-run'))fs.writeFileSync(p,JSON.stringify(doc)+'\n');
  console.log('TOUCH_ONLY_CALENDAR '+JSON.stringify({file,changed,dry:process.argv.includes('--dry-run')}));
 }
}
if(require.main===module)main();
module.exports={correct};
