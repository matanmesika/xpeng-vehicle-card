'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('src/design/xpeng-vehicle-card.css');
const runtime = read('src/core/xpeng-vehicle-card.runtime.js');
const capture = read('scripts/capture-dashboard.cjs');

test('charging and dock share the same ring and native icon sizing on desktop and iPhone', () => {
 const mark = '/* 1.0.4 dock + charging: the exact same native MDI size and glass circle. */';
 assert.ok(css.includes(mark));
 const shared = css.slice(css.lastIndexOf(mark));
 for(const part of [
   '--xp-common-ring:48px', '--xp-common-icon:22px',
   '--xp-common-ring:46px', '--xp-common-icon:21px',
   '--xp-common-ring:44px', '--xp-common-icon:20px',
   '--xp-ring-size:var(--xp-common-ring)!important',
   '--xp-glyph-size:var(--xp-common-icon)!important',
   '.xp-ux-dock-seven .xp-ux-dock-action',
   '.xp-charge-panel-actions button>.xp-mdi-icon',
   'top:auto!important;left:auto!important;right:auto!important',
 ]) assert.ok(shared.includes(part),'Missing shared icon style: '+part);
});

test('native Home Assistant MDI symbols are used for all three live charging actions', () => {
 const start = runtime.indexOf('charging(){');
 const end = runtime.indexOf('xpReconcileChildren(',start);
 assert.ok(start>0&&end>start,'Charging screen method not found');
 const charging = runtime.slice(start,end);
 for(const action of ['charge_controls','charge_schedule','stop_charge'])
   assert.ok(charging.includes(action),'Missing control: '+action);
 for(const icon of ["xpIcon('battery',22)","xpIcon('clock',22)","xpIcon('power',22)"])
   assert.ok(charging.includes(icon),'Missing icon: '+icon);
 assert.ok(runtime.includes('<ha-icon class="xp-mdi-icon" icon="'));
});

test('real Chromium validates dock parity, icon centering and captures detail screenshots',()=>{
 for(const needle of ['chargingDiscMetrics.dock','metrics.dock.ring','metrics.dock.glyph',
   'xOffset<=1.5','yOffset<=1.5','captionFits','nativeMdi',
   'charging-mobile-icon-detail.png','charging-mobile-panel-detail.png']){
   assert.ok(capture.includes(needle),'Missing live browser assertion: '+needle);
 }
});
