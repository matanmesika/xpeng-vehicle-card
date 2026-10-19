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

test('only mobile charging controls receive the centered icon override', () => {
  const marker = '/* v1.0.4: proportional mobile-only charging telemetry';
  assert.ok(css.includes(marker), 'mobile-only CSS section is missing');
  const block = css.slice(css.lastIndexOf(marker));
  assert.match(block, /@container xpeng-layout \(max-width:520px\)/);
  assert.match(block, /@container xpeng-layout \(max-width:360px\)/);
  assert.match(block, /\.xp-scene\.xp-charge\.xp-charge-navigation \.xp-charge-panel-actions button>\.xp-mdi-icon/);
  assert.match(block, /position:absolute!important/);
  assert.match(block, /top:calc\(\(var\(--xp-ring-size\) - var\(--xp-glyph-size\)\) \/ 2\)!important/);
  assert.match(block, /left:50%!important;transform:translateX\(-50%\)!important/);
  assert.match(block, /--xp-ring-size:34px!important;--xp-glyph-size:18px!important/);
  assert.match(block, /--xp-ring-size:32px!important;--xp-glyph-size:17px!important/);
});

test('the three supported charging actions keep genuine HA MDI icons', () => {
  const begin = runtime.indexOf('  charging(){');
  const end = runtime.indexOf('  // Update matching nodes', begin);
  const screen = runtime.slice(begin,end);
  assert.ok(begin > 0 && end > begin);
  for(const name of ['charge_controls','charge_schedule','stop_charge']){
    assert.match(screen,new RegExp(name));
  }
  for(const glyph of ["xpIcon('battery',22)","xpIcon('clock',22)","xpIcon('power',22)"])
    assert.ok(screen.includes(glyph), 'Missing native MDI: '+glyph);
  assert.match(runtime, /<ha-icon class="xp-mdi-icon" icon="/);
});

test('Chromium visual QA measures each actual icon center, ring and caption', () => {
  for (const assertion of ['ringY','xOffset','yOffset','captionFits',
      'labelBelowRing','notClipped','nativeMdi','missingGlyph',
      'await chargingVisualAgent(width)']) {
    assert.ok(capture.includes(assertion), 'Missing browser acceptance check: '+assertion);
  }
  assert.ok(capture.includes('charging-mobile-icon-detail.png'),
    'Chromium must capture an inspectable close-up from the real card');
});
