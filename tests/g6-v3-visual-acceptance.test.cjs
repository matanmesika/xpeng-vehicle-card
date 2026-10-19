'use strict';
// V3 visual acceptance agents: presentation-only static guardrails.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const source=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const v3=css.slice(css.indexOf('G6 V3 - OWNER APPROVED FLOATING GLASS DESIGN'));
test('Visual Agent: V3 owner-approved styles exist and override older CSS',()=>{
 assert.ok(v3.length>5000,'Missing substantial V3 design layer');
 assert.match(v3,/\.xp-scene \.xp-ux-dock-seven\s*\{/);
 assert.match(v3,/background:transparent!important/);
 assert.match(v3,/\.xp-ux-dock-action>\.xp-mdi-icon/);
 assert.match(v3,/border-radius:50%!important/);
});
test('Minimalism Agent: no opaque rectangular dock behind quick actions',()=>{
 const dock=v3.match(/\.xp-scene \.xp-ux-dock-seven\s*\{([^}]+)\}/);
 assert.ok(dock,'Dock override missing');
 assert.match(dock[1],/background:transparent!important/);
 assert.match(dock[1],/border:0!important/);
 assert.match(dock[1],/box-shadow:none!important/);
 const actions=v3.match(/\.xp-scene \.xp-ux-dock-seven \.xp-ux-dock-action\s*\{([^}]+)\}/);
 assert.ok(actions);
 assert.match(actions[1],/background:transparent!important/);
 assert.match(actions[1],/border-radius:0!important/);
});
test('Responsive Agent: one card adapts to Sections and narrow phones',()=>{
 assert.match(v3,/@container xpeng-layout \(max-width:850px\)/);
 assert.match(v3,/@container xpeng-layout \(max-width:520px\)/);
 assert.match(v3,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(v3,/\.xp-ux-modal/);
});
test('Integration Guardian: compiled HACS asset stays synchronized',()=>{
 assert.equal(source,dist,'src and dist bundles differ');
 for(const symbol of ['xpChargingActive(', 'xpActionState(', 'xpMaintenancePanel(', 'xpExtrasPanel(']){
  assert.ok(source.includes(symbol),'Missing live feature: '+symbol);
 }
});
test('Climate & Charging Design Agents: retain dedicated surfaces and seat actions',()=>{
 assert.match(v3,/\.xp-scene\.xp-charge \.xp-charge-card/);
 assert.match(v3,/\.xp-scene\.xp-charge \.xp-charge-panel-actions/);
 assert.match(v3,/\.xp-ux-modal-climate \.xp-ux-cabin-art \.xp-ux-cycle/);
 assert.match(v3,/\.xp-ux-modal-maintenance \.xp-tire-reading/);
});
