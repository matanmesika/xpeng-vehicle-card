const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');

test('all three electrical metrics are grouped in the first row; charging session stays below',()=>{
 const start=core.indexOf('\n charging(){');
 const end=core.indexOf(' // Update matching nodes in place',start);
 assert.ok(start>=0&&end>start);
 const view=core.slice(start,end);
 assert.equal((view.match(/class="xp-charge-stat xp-charge-electrical"/g)||[]).length,3);
 assert.equal((view.match(/class="xp-charge-stat xp-charge-session"/g)||[]).length,2);
 assert.match(view,/class="xp-charge-meta" role="group" aria-label="Charging measurements"/);
 const positions=['Charging power','Current</small>','Voltage</small>','Time remaining','Charge limit</small>'].map(s=>view.indexOf(s));
 assert.ok(positions.every(x=>x>=0)&&positions.every((x,i)=>i===0||x>positions[i-1]),'power, current and voltage must be contiguous before session metrics');
 assert.match(view,/xpIcon\('ampere',16\)/);
 assert.match(view,/xpIcon\('voltage',16\)/);
 assert.match(core,/ampere:'mdi:alpha-a-circle-outline'/);
 assert.match(core,/voltage:'mdi:alpha-v-circle-outline'/);
 assert.doesNotMatch(view,/xpIcon\('gauge',16\)/,'speedometer must not be used for electrical measurements');
 assert.match(view,/this\.chargingElectrical\('current','A'\)/);
 assert.match(view,/this\.chargingElectrical\('voltage','V'\)/);
 assert.match(view,/data-xp-command="stop_charge"/);
});

test('missing or invalid electrical values display 0.0 A and 0.0 V without changing global fallback',()=>{
 assert.match(core,/current:\[\['sensor','charge_current'\]\]/);
 assert.match(core,/voltage:\[\['sensor','charge_voltage'\]\]/);
 assert.match(core,/num\(key,unit='',dec=0\)\{const v=this\.number\(key\);return v===null\?'—'/);
 assert.match(core,/chargingElectrical\(key,unit\)\{const v=this\.number\(key\);return \(v===null\?0:v\)\.toFixed\(1\)\+' '\+unit;\}/);
 assert.match(core,/this\.chargingElectrical\('current','A'\)/);
 assert.match(core,/this\.chargingElectrical\('voltage','V'\)/);
});

test('electrical and session rows have responsive styles and generated bundles remain reproducible',()=>{
 assert.match(css,/\.xp-charge-meta>\.xp-charge-electrical\{/);
 assert.match(css,/\.xp-charge-meta>\.xp-charge-session\{/);
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-column:span 2!important/);
 assert.match(css,/grid-column:span 3!important/);
 assert.match(css,/@container xpeng-layout \(max-width:520px\)\{/);
 const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
 assert.equal(src,core.replace(slot,'const XP_CSS = `'+css+'\n`;'));
 assert.equal(src,dist);
});
