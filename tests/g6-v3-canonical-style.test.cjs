'use strict';
/* XPENG G6 V3 – executable design guardians. Never touch vehicle services. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const bundle=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const v3=css.indexOf('/* G6 V3 - OWNER APPROVED FLOATING GLASS DESIGN');
const before=css.slice(0,v3);
test('V3 design guardian: only canonical V3 theme, not stacked V2 visual themes',()=>{
 assert.ok(v3>0);
 assert.doesNotMatch(css,/XPENG G6 \/ V2 DESIGN SYSTEM|G6 V2\.1 — actual information-layout refresh/);
 assert.match(css,/XPENG G6 canonical V3 stylesheet/);
});
test('Minimalism guardian: legacy dock rectangles and their visual chrome are gone',()=>{
 const rules=[...before.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>/\.xp-ux-dock-seven|\.xp-ux-dock-action/.test(m[1])&&!/:\w|\[/.test(m[1]));
 assert.ok(rules.length>0);
 for(const m of rules)assert.doesNotMatch(m[2],/(?:^|;)\s*(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|backdrop-filter)\s*:/,'obsolete rectangular chrome: '+m[1].slice(-100));
 assert.match(css.slice(v3),/\.xp-scene \.xp-ux-dock-seven[\s\S]*?background:transparent!important/);
 assert.match(css.slice(v3),/border-radius:50%!important/);
});
test('Responsive and behavior guardian: one layout and identical core vehicle logic',()=>{
 assert.match(css,/@container xpeng-layout \(max-width:850px\)/);
 assert.match(css,/@container xpeng-layout \(max-width:520px\)/);
 assert.equal(bundle,dist);
 assert.equal(bundle,core.replace('const XP_CSS = "__XPENG_STYLES_FROM_THEME__";','const XP_CSS = `'+css+'\n`;'));
 for(const fn of ['xpChargingActive(', 'xpActionState(', 'xpMaintenancePanel(', 'xpExtrasPanel('])assert.ok(bundle.includes(fn));
});
