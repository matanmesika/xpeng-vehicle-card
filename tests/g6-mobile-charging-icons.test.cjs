'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const runtime=read('src/core/xpeng-vehicle-card.runtime.js');
const css=read('src/design/xpeng-vehicle-card.css');
const capture=read('scripts/capture-dashboard.cjs');

test('single charging component is used on mobile, Sections and desktop',()=>{
 const begin=runtime.indexOf(' charging(){'),end=runtime.indexOf('// Update matching nodes',begin);
 assert.ok(begin>0&&end>begin);
 const view=runtime.slice(begin,end);
 assert.equal(view.split('xp-charge-card xp-charge-unified').length-1,1);
 for(const x of ['xp-charge-heading','xp-charge-main','xp-charge-meta',
  'xp-charge-action-core','xp-charge-action-ring','xp-charge-action-label',
  'charge_controls','charge_schedule','stop_charge',
  "xpIcon('battery',22)","xpIcon('clock',22)","xpIcon('power',22)"]){
   assert.ok(view.includes(x),'Charging feature lost: '+x);
 }
 assert.ok(runtime.includes('<ha-icon class="xp-mdi-icon" icon="'));
});
test('responsive styles change only dimensions, not markup or visual style',()=>{
 const marker='/* ONE responsive charging dashboard component';
 assert.equal(css.split(marker).length-1,1);
 const style=css.slice(css.indexOf(marker));
 for(const x of ['--xp-charge-ring:48px','--xp-charge-icon:22px',
  '--xp-charge-ring:46px','--xp-charge-icon:21px',
  '--xp-charge-ring:44px','--xp-charge-icon:20px',
  'xp-charge-action-core','xp-charge-action-ring>.xp-mdi-icon',
  'justify-content:center!important','content:none!important',
  '@container xpeng-layout (max-width:520px)','@container xpeng-layout (max-width:360px)']){
   assert.ok(style.includes(x),'Charging layout rule missing: '+x);
 }
});
test('Chromium verifies real unified action rings and labels',()=>{
 for(const x of ['charging-mobile-panel-detail.png','charging-mobile-icon-detail.png',
  'chargingDiscMetrics','await chargingVisualAgent(width)']){
  assert.ok(capture.includes(x),'Browser QA missing '+x);
 }
});
