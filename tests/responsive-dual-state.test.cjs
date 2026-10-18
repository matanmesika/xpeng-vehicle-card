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
test('Home keeps its battery/range content and no location overlay at every breakpoint',()=>{
 const body=source.slice(source.indexOf(' overview(){'),source.indexOf('\n charging(){'));
 assert.doesNotMatch(body,/xp-status-panel|xp-location-row|Location|this\.locationText\(\)/);
 assert.match(body,/xp-overview-stat/);
 assert.match(body,/xp-maintenance-home-button/);
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
 assert.match(source,/ownerCharging=a\.model==='G6'/);
 assert.match(source,/chargingAppearance=ownerCharging/);
 assert.match(source,/this\.model\(\)==='G6'&&this\.xpChargingActive\(\)/);
 assert.match(css,/\.xp-charge-cable-live \.xp-charge-cable-halo\{stroke:#00df90;stroke-width:5\.2/);
 assert.doesNotMatch(source,/\['charging','bolt','טעינה'\]/);
});


test('native MDI glyphs replace ALL hand-drawn dashboard controls',()=>{
 const block=source.slice(source.indexOf('const XP_ICONS = Object.freeze('),source.indexOf('function xpEsc(v)'));
 assert.match(block,/fan:'mdi:fan'/);
 for(const icon of ['mdi:lock','mdi:window-closed','mdi:window-open','mdi:car-back','mdi:map-marker','mdi:wifi'])
   assert.ok(block.includes(icon),'Native MDI mapping missing: '+icon);
 assert.doesNotMatch(block,/<(?:svg|ellipse|circle|path|rect)\b/,'No hand-drawn SVG for buttons');
 assert.match(block,/<ha-icon class="xp-mdi-icon" icon="\$\{mdi\}"/);
 assert.match(source,/\$\{xpIcon\('wifi',24\)\}/,'Connection indicator must also be native');
 assert.doesNotMatch(source,/\.xp-ux-(?:dock-action|cycle|climate-feature) svg/);
 assert.match(css,/\.xp-mdi-icon\{display:inline-flex/);
});

test('desktop and mobile charging overlays use separate viewBox geometry',()=>{
 assert.match(source,/viewBox="0 0 1400 788"/);
 assert.match(source,/viewBox="0 0 390 780"/);
 assert.match(css,/\.xp-charge-cable\.xp-cable-mobile\{display:none\}/);
 assert.match(css,/\.xp-charge-cable\.xp-cable-desktop\{display:none\}/);
});
test('tyre pressure units exist only in card editor and never in vehicle screens',()=>{
 assert.match(source,/select\('tire_pressure_unit'/);
 assert.doesNotMatch(source,/data-xp-tire-unit|_xpTireUnit|xp-tire-units/);
 assert.match(source,/this\.vehicle\(\)\?\.tire_pressure_unit/);
});

test('the Home screen hides maintenance summaries but preserves a single dedicated shortcut',()=>{
 assert.doesNotMatch(source.slice(source.indexOf(' overview(){'),source.indexOf('\n charging(){')),/xp-status-panel|Location/);
 assert.doesNotMatch(source,/const rows=\[\['settings','תחזוקת הרכב'/);
 assert.match(source,/xp-maintenance-home-button/);
 assert.match(source,/\['maintenance','maintenance','תחזוקה'\]/);
 assert.match(source,/page==='maintenance'\)body=this\.xpMaintenancePanel\(\)/);
 assert.match(source,/xp-maintenance-home-button/);
});

test('modern glass design uses official Material Design action icons without changing vehicle actions',()=>{
 assert.match(source,/maintenance:'mdi:tools'/);
 assert.match(source,/settings:'mdi:cog'/);
 assert.match(source,/xpIcon\(ico,27\)/);
 assert.match(css,/Modern Glass UI v2/);
 assert.match(css,/\.xp-home-navigation \.xp-overview-stat\{[^}]*backdrop-filter:blur\(20px\)/);
 assert.match(css,/\.xp-home-navigation \.xp-ux-dock-seven \.xp-ux-dock-action ha-icon\{/);
 assert.match(css,/\.xp-scene\.xp-overview\.xp-home-navigation \.xp-car\{/);
 assert.match(css,/\.xp-home-navigation \.xp-ux-dock-action\[data-xp-open="climate"\] ha-icon\{/);
 assert.match(css,/@container xpeng-layout \(max-width:850px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(source.slice(source.indexOf(' overview(){'),source.indexOf('\n charging(){')),/Location|xp-status-panel/);
 assert.ok(source.includes("['doors','windows','port','trunk'].includes(action)"));
 assert.match(source,/data-xp-toggle/);
 assert.match(source,/verifiedDirectTap/);
});

test('shared premium styling spans actual pages without introducing vehicle-action pages',()=>{
 assert.match(css,/Shared XPENG glass design language for real pages and action buttons/);
 for(const cls of ['xp-ux-modal-climate','xp-ux-modal-maintenance','xp-ux-modal-map','xp-charge-card','xp-tire-reading','xp-ux-climate-feature','xp-ux-port-action']){
   assert.ok(css.includes('.'+cls),'Unstyled interface category '+cls);
 }
 assert.match(css,/\.xp-ux-climate-feature ha-icon\{/);
 assert.match(css,/\.xp-charge-heading ha-icon\{/);
 assert.match(css,/\.xp-ux-modal-map \.xp-ux-map-panel/);
 assert.match(css,/\.xp-ux-cycle-heat\.xp-ux-cycle-on/);
 assert.match(css,/\.xp-ux-cycle-vent\.xp-ux-cycle-on/);
 assert.match(css,/@container xpeng-layout \(max-width:520px\)/);
 const dock=source.slice(source.indexOf(' xpDock(){'),source.indexOf('\n xpCabinView(){'));
 assert.match(dock,/data-xp-toggle/);
 assert.match(dock,/data-xp-open/);
 assert.match(dock,/\['doors','windows','port','trunk'\]\.includes\(action\)/);
 for(const key of ['doors','windows','port','trunk']){
   assert.match(source,new RegExp('xpToggleButton'),'Vehicle toggle buttons must stay directly addressable: '+key);
 }
});
