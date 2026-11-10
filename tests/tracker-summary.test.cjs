'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const summary=require('../tracker-summary.js');
const root=path.resolve(__dirname,'..');
const sample={player:'A / B / C / D',players:['A','B','C','D'],points:0,matches:2,vrs:0,kills:4};
const find=(row,key)=>summary.metrics(row).find(x=>x.key===key).value;
test('Tracker nine-panel displays observed zero and computed averages but never derives K/D',()=>{
 assert.equal(summary.metrics(sample).length,9);
 assert.equal(find(sample,'points'),'0');
 assert.equal(find(sample,'matches'),'2');
 assert.equal(find(sample,'wins'),'0');
 assert.equal(find(sample,'elims'),'4');
 assert.equal(find(sample,'avg-points'),'0.00');
 assert.equal(find(sample,'avg-elims'),'2.00');
 assert.equal(find(sample,'avg-place'),'—');
 assert.equal(find(sample,'avg-time'),'—');
 assert.equal(find(sample,'kd'),'—');
 assert.match(summary.render(sample),/チーム記録/);
 assert.match(summary.render(sample),/data-tracker-metric="kd"/);
});
test('Source-verified Tracker values render exact avg place, time and K/D',()=>{
 const row={...sample,trackerStats:{verified:true,source:'https://fortnitetracker.com/events/epicgames_S43_Test_NAW?window=S43_Test_NAW',
   avgPlace:11,avgTimeAliveSeconds:939,kdRatio:2}};
 assert.deepEqual(summary.validate(row),[]);
 assert.equal(find(row,'avg-place'),'11.00');
 assert.equal(find(row,'avg-time'),'15分39秒');
 assert.equal(find(row,'kd'),'2.00');
 assert.match(summary.render(row),/Trackerで追加指標を確認/);
});
test('Unknown totals are unknown, not zero or NaN',()=>{
 const row={player:'A',points:null,matches:null,vrs:null,kills:null};
 for(const key of ['points','matches','wins','elims','avg-points','avg-elims','kd'])
  assert.equal(find(row,key),'—');
 assert.ok(!summary.render(row).includes('NaN'));
});
test('Reject unsourced and invalid averages and unsafe Tracker links',()=>{
 const row={...sample,trackerStats:{verified:true,source:'javascript:alert(1)',avgPlace:0,kdRatio:-4}};
 assert.ok(summary.validate(row).length>=3);
 assert.equal(find(row,'kd'),'—');
 assert.equal(find(row,'avg-place'),'—');
 for(const s of ['https://fortnitetracker.com.evil.test/events/x','https://fortnitetracker.com@evil.test/events/x','http://fortnitetracker.com/events/x'])
  assert.ok(summary.validate({...row,trackerStats:{verified:true,source:s,avgPlace:11}}).length);
 assert.ok(summary.validate({...row,trackerStats:{verified:true,source:'https://fortnitetracker.com/events/x',avgPlace:11,avgTimeAliveSeconds:939.1}}).length);
});
test('Values cannot inject HTML and tracker totals do not become individual team kills',()=>{
 const row={...sample,player:'<img src=x onerror=alert(1)>'};
 const html=summary.render(row);
 assert.doesNotMatch(html,/<img src=x onerror=/);
 assert.match(html,/チーム記録/);
});
test('Both regular results and participation archive expose the same nine metrics, with scripts ordered',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const participation=fs.readFileSync(path.join(root,'participation-ui.js'),'utf8');
 assert.ok(html.indexOf('tracker-summary.js')>0&&html.indexOf('tracker-summary.js')<html.indexOf('participation-ui.js'));
 assert.ok(html.indexOf('tracker-summary.js')<html.indexOf('app.js?v='));
 assert.match(html,/tracker-summary\.css/);
 assert.match(app,/data-detail="tracker-summary"/);
 assert.match(participation,/participation-tracker-details/);
 for(const code of ['tracker-summary.js','participation-ui.js'])assert.doesNotThrow(
  ()=>new Function(fs.readFileSync(path.join(root,code),'utf8')));
});
