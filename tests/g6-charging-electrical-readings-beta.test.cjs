const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');

test('charging shows current (A) and voltage (V) without replacing the three existing metrics',()=>{
 const start=core.indexOf('\n charging(){');
 const end=core.indexOf(' // Update matching nodes in place',start);
 assert.ok(start>=0&&end>start);
 const view=core.slice(start,end);
 assert.equal((view.match(/class="xp-charge-stat"/g)||[]).length,3);
 for(const existing of ['Charging power','Time remaining','Charge limit'])assert.ok(view.includes(existing));
 const electrical=view.slice(view.indexOf('class="xp-charge-electrical"'),view.indexOf('class="xp-charge-panel-actions"'));
 assert.match(electrical,/role="group" aria-label="Charging current and voltage"/);
 assert.match(electrical,/this\.num\('current','A',1\)/);
 assert.match(electrical,/this\.num\('voltage','V',0\)/);
 assert.doesNotMatch(electrical,/data-xp-command|data-xp-switch|xpSend\(/);
 assert.match(view,/data-xp-command="stop_charge"/);
});

test('readings use existing XPENG sensors, and missing numeric data stays unavailable',()=>{
 assert.match(core,/current:\[\['sensor','charge_current'\]\]/);
 assert.match(core,/voltage:\[\['sensor','charge_voltage'\]\]/);
 assert.match(core,/num\(key,unit='',dec=0\)\{const v=this\.number\(key\);return v===null\?'—'/);
});

test('compact electrical row has responsive styles and generated bundles remain reproducible',()=>{
 assert.match(css,/\.xp-charge-electrical\{/);
 assert.match(css,/@container xpeng-layout \(max-width:520px\)\{/);
 const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
 assert.equal(src,core.replace(slot,'const XP_CSS = `'+css+'\n`;'));
 assert.equal(src,dist);
});
