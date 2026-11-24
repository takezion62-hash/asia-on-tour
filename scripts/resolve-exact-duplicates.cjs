'use strict';
// Read-only preview by default. The scheduled history workflow applies and
// pushes only onto freshly fetched main; never write public results or awards.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb}=require('./reviewed-publication-core.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const {validateRegistry}=require('./validate-tournament-rules.cjs');
const {planDuplicates}=require('./exact-duplicate-resolution.cjs');
const root=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>!['--dry-run','--apply'].includes(x)))throw Error('use --dry-run or --apply');
const apply=args.includes('--apply');
const db=loadReviewDb(root);db.reviewed=read('history-sync-reviewed.json');
const errors=validateRegistry(read('tournament-rules.json'),db.tournaments);
if(errors.length)throw Error('official rule registry invalid: '+errors.join('; '));
db.verifiedAccounts=linkedAccounts(db).accounts;
for(const month of new Set(Object.values(db.reviews).flatMap(q=>q.proposals.map(r=>r.date?.slice(0,7))))){
 if(!/^\d{4}-\d{2}$/.test(month||''))continue;
 const file='calendar-history/'+month+'.json';
 if(fs.existsSync(path.join(root,file)))db.calendar[month]=read(file).sessions||[];
}
const plan=planDuplicates(db);
console.log('AOT_EXACT_DUPLICATES '+JSON.stringify({apply,resolved:plan.resolved.map(x=>({id:x.id,existingId:x.existingId,prize:x.evidence.prize})),held:plan.held}));
if(apply&&plan.resolved.length){
 // Existing reviewed ledger is the authoritative tombstone used by the
 // scanner and concurrent safe merge. Never remove the saved scan evidence.
 const files={'history-sync-reviewed.json':plan.next.reviewed,
  'auto-sync-review.json':plan.next.reviews.auto,'history-sync-review.json':plan.next.reviews.history,
  'auto-sync-status.json':plan.next.statuses.auto,'history-sync-status.json':plan.next.statuses.history};
 for(const [name,doc] of Object.entries(files)){
  const before=fs.readFileSync(path.join(root,name),'utf8'),next=JSON.stringify(doc,null,2)+'\n';
  if(before===next)continue;
  const temp=path.join(root,name+'.duplicate-tmp');
  fs.writeFileSync(temp,next);fs.renameSync(temp,path.join(root,name));
 }
}
