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
 assert.match(source,/const isCharging=this\.xpChargingActive\(\);/);
 assert.match(source,/this\._view=isCharging\?'charging':'overview'/);
 assert.match(source,/isCharging\?this\.charging\(\)/);
 assert.match(source,/interior:'dark_gray'/);
});

test('owner charging hero stays free of overview dock CSS and uses the front cutout',()=>{
 assert.match(source,/this\.xpUiEnabled\(\)&&!isCharging\?'xp-has-controls':''/);
 assert.match(source,/xp-charge-heading-action/);
 assert.match(source,/a\.model==='G6'\?'front'/);
});
