'use strict';
const fs=require('node:fs');
const path=require('node:path');
function validateUpdateLog(results,log){
  const errors=[];
  if(!Array.isArray(results)||!log||log.version!==1||!Array.isArray(log.entries))return ['更新履歴のルート構造が不正です（version:1 / entries配列）'];
  const ids=new Set(results.map(r=>r?.id)),entryIds=new Set(),registered=new Set(),archived=new Set();
  let previousDate='9999-99-99';
  for(const entry of log.entries){
    if(!entry||typeof entry!=='object'||Array.isArray(entry)){errors.push('entryがオブジェクトではありません');continue}
    const prefix=String(entry.id||'ID未設定');
    if(typeof entry.id!=='string'||!entry.id.trim()||entryIds.has(entry.id))errors.push(prefix+': 更新IDが空または重複');
    entryIds.add(entry.id);
    if(typeof entry.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)){
      errors.push(prefix+': 日付形式が不正');
    }else{
      const d=new Date(entry.date);
      if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==entry.date)errors.push(prefix+': 実在しない日付');
      if(entry.date>previousDate)errors.push(prefix+': 更新履歴は新しい順に並べてください');
      previousDate=entry.date;
    }
    if(!['site','records','participation'].includes(entry.type))errors.push(prefix+': typeはsite・records・participation');
    if(typeof entry.title!=='string'||!entry.title.trim()||typeof entry.description!=='string'||!entry.description.trim())errors.push(prefix+': タイトル・説明が必要');
    if(!Array.isArray(entry.recordIds)){errors.push(prefix+': recordIds配列が必要');continue}
    if(entry.type==='site'&&entry.recordIds.length)errors.push(prefix+': サイト改善には戦績を紐付けない');
    if(entry.type==='records'&&!entry.recordIds.length)errors.push(prefix+': 新着戦績が空です');
    if(entry.type==='participation'){
      if(entry.recordIds.length)errors.push(prefix+': 出場確認に通常戦績IDを紐付けない');
      if(typeof entry.participationMonth!=='string'||!/^\d{4}-\d{2}$/.test(entry.participationMonth))errors.push(prefix+': 出場記録の月が不正');
      if(!Array.isArray(entry.participationIds)||!entry.participationIds.length||
         !Array.isArray(entry.participantTeams)||entry.participantTeams.length!==entry.participationIds?.length)
        errors.push(prefix+': 出場記録IDとチーム名の一覧が不正');
      for(const id of entry.participationIds||[]){
        if(typeof id!=='string'||!/^participation-[a-f0-9]{20}$/.test(id))errors.push(prefix+': 出場記録IDの形式が不正 '+String(id));
        if(archived.has(id))errors.push(prefix+': 出場記録IDが重複 '+String(id));
        archived.add(id);
      }
      if(Array.isArray(entry.participantTeams)&&entry.participantTeams.some(x=>typeof x!=='string'||!x.trim()))errors.push(prefix+': 出場チーム名が空');
    }
    for(const recordId of entry.recordIds){
      if(typeof recordId!=='string'||!ids.has(recordId))errors.push(prefix+': 存在しない戦績ID '+String(recordId));
      if(registered.has(recordId))errors.push(prefix+': 新着戦績IDが複数更新へ重複 '+String(recordId));
      registered.add(recordId);
    }
  }
  return errors;
}
if(require.main===module){
  try{
    const root=path.join(__dirname,'..');
    const results=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
    const log=JSON.parse(fs.readFileSync(path.join(root,'updates.json'),'utf8'));
    const errors=validateUpdateLog(results,log);
    if(errors.length){for(const error of errors)console.error('更新履歴エラー '+error);process.exitCode=1}
    else console.log('更新履歴: '+log.entries.length+'更新 / '+log.entries.filter(e=>e.type==='records').reduce((n,e)=>n+e.recordIds.length,0)+'件の登録戦績IDを検証しました。');
  }catch(error){console.error('更新履歴の読み込み失敗: '+error.message);process.exitCode=1}
}
module.exports={validateUpdateLog};
