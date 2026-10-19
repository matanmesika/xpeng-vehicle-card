'use strict';
// Independent UI regression reviewers for the owner-approved transparent G6 layout.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const marker='/* G6 V3 - OWNER APPROVED FLOATING GLASS DESIGN.';
const v3=css.slice(css.indexOf(marker));
test('Glass Cascade Agent | approved rules are LAST and override old dark rectangular tiles',()=>{
 assert.ok(css.indexOf(marker)>0 && css.indexOf(marker)===css.lastIndexOf(marker));
 assert.match(v3,/\.xp-scene \.xp-ux-dock-seven\{[\s\S]*?background:transparent!important/);
 assert.match(v3,/\.xp-scene \.xp-ux-dock-seven \.xp-ux-dock-action\{[\s\S]*?border:0!important;[\s\S]*?background:transparent!important/);
 assert.match(v3,/\.xp-scene \.xp-ux-dock-seven \.xp-ux-dock-action>\.xp-mdi-icon,[\s\S]*?border-radius:50%!important/);
 assert.match(v3,/\.xp-scene \.xp-ux-dock-seven \.xp-ux-dock-action>\.xp-trunk-symbol/);
 assert.match(v3,/\.xp-scene\.xp-overview\.xp-home-navigation \.xp-overview-stat\{[\s\S]*?background:transparent!important/);
 assert.match(v3,/\.xp-scene\.xp-charge \.xp-charge-panel-actions button\{[\s\S]*?background:transparent!important/);
 assert.match(v3,/\.xp-scene \.xp-ux-modal-climate \.xp-ux-temp-line button\{[\s\S]*?border-radius:50%!important/);
 // Only the obsolete CSS-drawn battery terminal is hidden; never hide
 // any live buttons, seat hotspots or charging controls.
 const hidden=[...v3.matchAll(/([^{}]+)\\{([^{}]*)\\}/g)].filter(m=>m[2].includes('display:none!important'));
 assert.ok(hidden.every(m=>/\\.xp-batt-glyph:before/.test(m[1])),
   'No functionality or touch controls may be hidden by V3');
});
test('Responsive Glass UX Agent | one card, touch targets, accessibility and small HA Sections',()=>{
 assert.match(v3,/@container xpeng-layout \(max-width:850px\)/);
 assert.match(v3,/@container xpeng-layout \(max-width:520px\)/);
 assert.match(v3,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
 assert.match(v3,/min-height:73px!important/);
 assert.match(v3,/button:focus-visible\{outline:2px/);
 assert.match(v3,/\.xp-scene \.xp-ux-dock-seven \.xp-ux-dock-action:disabled/);
 assert.match(v3,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/ha-card\{[^}]*container-type:inline-size;container-name:xpeng-layout/);
});
test('Behavior Guardian | no executable wiring changes, both distributed copies rebuilt from CSS alone',()=>{
 const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
 assert.equal(src,dist);
 assert.equal(src,core.replace(slot,'const XP_CSS = `'+css+'\n`;'));
 assert.match(core,/this\.xpChargingActive\(\)/);
 assert.match(core,/xpToggleTarget\(action\)/);
 assert.match(core,/\['doors','windows','port','trunk'\]\.includes\(action\)/);
 assert.match(core,/xpCycleSeat\(b\.dataset\.xpCycle\)/);
 assert.match(core,/this\.xpSend\('number','set_value',key,value\)/);
 const dock=core.slice(core.indexOf(' xpDock(){'),core.indexOf(' xpSeatShownState('));
 for(const action of ['climate','doors','windows','port','trunk','maintenance','map'])
  assert.ok(dock.includes("['"+action+"'"),action+' action removed');
 assert.doesNotMatch(v3,/\.xp-car\{|\.xp-charge-cable\{|\.xp-night-photo\{/);
});
