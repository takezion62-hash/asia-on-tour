'use strict';
// Exactly six source-locked S35 ME Event1 Round1 teams. Never infer a final or cash.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const FILE='data/manual-approvals/20261118-s35-me-round1-remaining-six.json';
const POLICY='verified-s35-me-event1-round1-six-20261118';
const RULE='https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-may-2025-official-rules';
const WINDOW='S35_VictoryDuosCup_Event1Round1_ME';
const EVENT='S35_VictoryDuosCup';
const SOURCE='https://www.fortnite.com/competitive/events/'+EVENT+'/?region=ME&round='+WINDOW;
const PINS=Object.freeze({
 'auto-s35-1d8317e62e26':[284,'Acris 0x / DIE Peterbot 23ǃ','5768dce9d8d84c5580e1fb0ed49401d0','d392d3b651304354bc5b3be766819ea8'],
 'auto-s35-1dae8998aef9':[275,'Solary Kurаmа / p1ng','1872812e30504d6f89bcbd652b1d38d4','9766622eec65443fb8cf2b860838c19d'],
 'auto-s35-2feccd077d35':[280,'えありー / すかい','bf6b915c60d94e09a7e155165440e01b','fba14a7d6fc342ba9599c6afa9f2c568'],
 'auto-s35-70945663bd3e':[228,'kaf / Rura','57581f38ee2547ba90d1d18a9bec234d','d5e9dc74c49e4825bd81a9d69056c683'],
 'auto-s35-abfa67e68898':[395,'ふぃる / Amo','b8ee0fe8a5744c3ca37bb746388064ec','eb25328dadd04911867fa412c34341bb'],
 'auto-s35-baf1676e9290':[313,'Hakkun / あすふぁろず','63826005a9c24444b113589813cde1d8','de58135a20f245168875431fd8dd9fc3']
});
const manifest=read(FILE);
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const must=(v,m)=>{if(!v)throw Error('S35_SIX_'+m)};
function validate(){
 must(manifest.version===1&&manifest.reviewedOn==='2026-11-18'&&
 manifest.rule===RULE&&manifest.eventId===EVENT&&manifest.windowId===WINDOW&&
 Array.isArray(manifest.rows)&&manifest.rows.length===6,'manifest differs');
 const seen=new Set();
 for(const x of manifest.rows){
  must(!seen.has(x.id)&&PINS[x.id],'unexpected/repeated candidate '+x.id);seen.add(x.id);
  must(JSON.stringify([x.rank,x.player,...(x.teamAccountIds||[])])===JSON.stringify(PINS[x.id]),'identity/rank differs '+x.id);
  must(x.verified===true&&x.kind==='予選'&&x.prize===0&&
   x.date==='2025-05-17'&&x.region==='ME'&&x.seasonId==='S35'&&
   x.tournamentId==='ch6s2-console-duos-victory'&&x.event==='Duos Console Victory Cash Cup'&&
   x.round==='Event 1 · Round 1 / 予選'&&x.source===SOURCE&&
   x.players?.length===2&&x.player===x.players.join(' / ')&&
   x.teamAccountIds?.length===2&&new Set(x.teamAccountIds).size===2&&
   x.teamAccountIds.every(z=>/^[0-9a-f]{32}$/.test(z))&&
   Number.isSafeInteger(x.points)&&x.points>=0&&Number.isSafeInteger(x.kills)&&x.kills>=0&&
   Number.isSafeInteger(x.vrs)&&x.vrs>=0&&Number.isSafeInteger(x.matches)&&x.matches>=1&&
   x.matches<=7&&x.vrs<=x.matches,'source evidence invalid '+x.id);
 }
 must(seen.size===Object.keys(PINS).length,'target group incomplete');
 return true;
}
validate();
function record(x){
 const qualified=x.rank<=250;
 const {reviewReason,reviewOnly,teamAccountIds,note,...base}=x;
 return {...base,kind:qualified?'予選':'参加確認',
  round:'Event 1 · Round 1 / '+(qualified?'予選突破':'参加確認'),prize:0,
  note:'2026/11/18 保存済みEpic公式連続Round1順位表、2名のEpic IDおよび公式開催枠を照合。'+
  '2025/05/17 ME順位'+x.rank+'位、'+x.matches+'試合・'+x.kills+'K。'+
  'ME上位250組のみ決勝進出。'+(qualified?'予選突破。':'予選突破圏外の出場確認。')+
  '予選現金賞金$0。決勝・支払いは未確認。規則: '+RULE};
}
function ledger(original,r){
 return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt:'2026-11-18T01:00:00Z',
  approvedBy:'ChatGPT / owner-authorized verified Epic checkpoint review',source:r.source,rule:RULE,
  originalSha256:hash(original),recordSha256:hash(r),
  evidence:'Source-pinned original Epic UUID pair, score/rank, mature contiguous prefix and rule-specific ME top250 cutoff'};
}
function verifyRow(r,e){
 try{
  if(!r||!e||e.policy!==POLICY||e.decision!=='published'||e.id!==r.id||
   e.recordId!==r.id||e.source!==r.source||e.rule!==RULE)return false;
  const o=manifest.rows.find(x=>x.id===r.id);
  return Boolean(o)&&e.originalSha256===hash(o)&&e.recordSha256===hash(r)&&
   JSON.stringify(record(o))===JSON.stringify(r);
 }catch{return false}
}
module.exports={FILE,POLICY,RULE,EVENT,WINDOW,SOURCE,PINS,manifest,validate,record,ledger,verifyRow,hash};
