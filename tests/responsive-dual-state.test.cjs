'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const css=source.slice(source.indexOf('const XP_CSS = `'),source.indexOf('\n`;\n// Retain legacy'));
test('HACS dist and authored src stay byte-identical',()=>assert.equal(source,dist));
test('HA card width drives responsive changes, not just viewport width',()=>{
 assert.match(css,/ha-card\{[^}]*container-type:inline-size;container-name:xpeng-layout/);
 for(const width of [850,600,520,400,360])
   assert.ok(css.includes('@container xpeng-layout (max-width:'+width+'px)'),width+'px rule missing');
 assert.match(css,/@media\(max-width:850px\)/,'keep viewport fallback');
});
test('on phone status information becomes two columns with final location spanning both',()=>{
 assert.match(css,/\.xp-status-panel\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.xp-info-row:last-child\{grid-column:1\/-1/);
 assert.match(css,/\.xp-charge-card\{left:4%;width:92%;top:206px/);
});
test('original desktop composition, vehicle artwork and automatic charge logic stay intact',()=>{
 assert.match(css,/\.xp-scene\{position:relative;width:100%;min-height:620px;aspect-ratio:16\/9/);
 assert.match(source,/xp-night-photo/);
 assert.match(source,/const actualCharging=this\.xpChargingActive\(\);/);
 assert.match(source,/const isCharging=actualCharging&&!this\._xpChargingDismissed/);
 assert.match(source,/this\._view=isCharging\?'charging':'overview'/);
 assert.match(source,/isCharging\?this\.charging\(\)/);
 assert.match(source,/interior:'dark_gray'/);
});

test('existing charge view keeps its own model artwork and no overview dock',()=>{
 assert.match(source,/this\.xpUiEnabled\(\)&&!isCharging\?'xp-has-controls':''/);
 assert.match(source,/xp-charge-heading-action/);
 assert.match(source,/view==='rear'\?'charging':'front'/);
});

test('phone subpages are touch scrollable and maintenance grid stacks rows',()=>{
 assert.match(css,/\.xp-ux-modal\{overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch/);
 assert.match(css,/touch-action:pan-y/);
 assert.match(css,/\.xp-ux-modal-maintenance \.xp-tire-stage\{display:grid;width:100%;height:auto/);
});
test('original charging art is restored and green cable only exists during charging',()=>{
 assert.match(source,/const candidate=xpVehicleAssetPath\(a,view==='rear'\?'charging':'front'\)/);
 assert.match(source,/this\.model\(\)==='G6'&&this\.xpChargingActive\(\)/);
 assert.match(css,/\.xp-charge-cable-live \.xp-charge-cable-halo\{stroke:#00f59c/);
 assert.doesNotMatch(source,/\['charging','bolt','טעינה'\]/);
});
