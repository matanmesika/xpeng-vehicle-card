const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');

test('charging current and voltage are integrated into the same measurement grid',()=>{
 const start=core.indexOf('\n charging(){');
 const end=core.indexOf(' // Update matching nodes in place',start);
 assert.ok(start>=0&&end>start);
 const view=core.slice(start,end);
 assert.equal((view.match(/class="xp-charge-stat"/g)||[]).length,3,'preserve original three metrics');
 assert.equal((view.match(/class="xp-charge-stat xp-charge-electrical"/g)||[]).length,2,'add two integrated metric cells');
 for(const existing of ['Charging power','Time remaining','Charge limit'])assert.ok(view.includes(existing));
 assert.match(view,/class="xp-charge-meta" role="group" aria-label="Charging measurements"/);
 assert.match(view,/this\.chargingElectrical\('current','A'\)/);
 assert.match(view,/this\.chargingElectrical\('voltage','V'\)/);
 assert.doesNotMatch(view,/class="xp-charge-electrical" role="group"/,'no detached current/voltage row');
 assert.match(view,/data-xp-command="stop_charge"/,'keep charging controls');
});

test('missing or invalid electrical values display 0.0 A and 0.0 V without changing global fallback',()=>{
 assert.match(core,/current:\[\['sensor','charge_current'\]\]/);
 assert.match(core,/voltage:\[\['sensor','charge_voltage'\]\]/);
 assert.match(core,/num\(key,unit='',dec=0\)\{const v=this\.number\(key\);return v===null\?'—'/);
 assert.match(core,/chargingElectrical\(key,unit\)\{const v=this\.number\(key\);return \(v===null\?0:v\)\.toFixed\(1\)\+' '\+unit;\}/);
 assert.match(core,/this\.chargingElectrical\('current','A'\)/);
 assert.match(core,/this\.chargingElectrical\('voltage','V'\)/);
});

test('integrated electrical cells have responsive styles and generated bundles remain reproducible',()=>{
 assert.match(css,/\.xp-charge-meta>\.xp-charge-electrical\{/);
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-column:span 3!important/);
 assert.match(css,/@container xpeng-layout \(max-width:520px\)\{/);
 const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
 assert.equal(src,core.replace(slot,'const XP_CSS = `'+css+'\n`;'));
 assert.equal(src,dist);
});
