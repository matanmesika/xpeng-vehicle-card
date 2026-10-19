'use strict';
// V3 inner-page visual contracts: only CSS changes, no vehicle action changes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const runtime=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const source=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const innerStart=css.indexOf('/* V3 COMPACT INNER-PAGE DESIGN');
const innerEnd=css.indexOf('@media(prefers-reduced-motion:reduce){',innerStart);
assert.ok(innerStart>=0&&innerEnd>innerStart,'V3 subpage module not found');
const inner=css.slice(innerStart,innerEnd);
const rule=(selector)=>{
 const i=inner.indexOf(selector);
 assert.ok(i>=0,'missing scoped V3 selector: '+selector);
 return inner.slice(i,inner.indexOf('}',i)+1);
};
test('V3 design agent: all secondary screens share glass controls',()=>{
 for(const s of ['.xp-ux-modal-climate','.xp-ux-modal-maintenance','.xp-ux-modal-extras','.xp-ux-modal-map','.xp-ux-modal-charge_controls','.xp-diagnostics-scroll']){
  assert.ok(inner.includes(s),s+' V3 styling missing');
 }
 assert.match(inner,/--xp-v3-control-bg:rgba\(13,43,64,\.26\)/);
 assert.match(inner,/background:var\(--xp-v3-control-bg\)!important/);
 assert.doesNotMatch(inner,/display:none!important/);
});
test('V3 icon agent: proportional official MDI glyphs and compact accessible targets',()=>{
 assert.match(rule('.xp-scene .xp-ux-modal-head button{'),/42px!important/);
 assert.match(rule('.xp-scene .xp-ux-modal-extras .xp-extra-tile>.xp-mdi-icon{'),/--xp-icon-size:21px!important/);
 assert.match(rule('.xp-scene .xp-ux-modal-extras .xp-extra-tile>.xp-mdi-icon{'),/border-radius:50%!important/);
 assert.match(rule('.xp-scene .xp-ux-modal-extras .xp-extra-tile{'),/background:transparent!important/);
 assert.match(rule('.xp-scene .xp-ux-modal-climate .xp-ux-climate-feature>.xp-mdi-icon{'),/22px!important/);
 assert.match(rule('.xp-scene .xp-ux-modal-map .xp-ux-map-actions button>.xp-mdi-icon{'),/19px!important/);
 assert.match(rule('.xp-scene .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle{'),/42px!important/);
 assert.match(inner,/@container xpeng-layout \(max-width:520px\)/);
});
test('V3 functions agent: seven launcher routes and real map/seat actions survive',()=>{
 const start=runtime.indexOf(' xpExtrasPanel(){');
 const end=runtime.indexOf(' xpVehiclePanel(){',start);
 assert.ok(start>=0&&end>start);
 for(const page of ["security","schedule","energy","power","maintenance","updates","diagnostics"])
   assert.ok(runtime.slice(start,end).includes("'"+page+"'"),page+' launcher removed');
 assert.match(runtime,/xpCycleSeat\(b\.dataset\.xpCycle\)/);
 assert.match(runtime,/xpMapPanel\(\)\{/);
 assert.match(runtime,/xpChargingActive\(\)/);
 assert.match(runtime,/xpToggleTarget\(action\)/);
});
test('V3 build agent: CSS-only source maps to exactly identical HACS distribution',()=>{
 const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
 assert.equal(source,dist);
 assert.equal(source,runtime.replace(slot,'const XP_CSS = '+String.fromCharCode(96)+css+'\n'+String.fromCharCode(96)+';'));
});
