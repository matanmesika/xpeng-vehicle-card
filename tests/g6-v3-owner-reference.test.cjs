'use strict';
// Owner-approved: original car photo and cabin picture, sensor-driven TPMS,
// real Home Assistant controls, and CSS-only charging pedestal.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const runtime=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const bundle=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const theme=css.slice(css.indexOf('/* G6 V3 · Owner-approved Reference Layout'));
test('Tire design guardian: same approved overhead photo, four data-bound pressure labels',()=>{
 assert.match(runtime,/this\.topCarArt\(\)/);
 assert.match(runtime,/this\.tirePressureDisplay\(key\)/);
 for(const k of ['tire_fl','tire_fr','tire_rl','tire_rr'])assert.ok(runtime.includes("'"+k+"'"));
 assert.match(runtime,/xp-wheel-highlight xp-wheel-fl/);
 assert.match(runtime,/xp-wheel-highlight xp-wheel-rr/);
 assert.match(theme,/\.xp-tire-stage/);
 assert.match(theme,/\.xp-tire-reading\[data-wheel="tire_fl"\]/);
 assert.match(theme,/TPMS photo-geometry acceptance/);
 assert.match(theme,/bottom:auto!important/);
 assert.match(runtime,/xp-maintenance-split/);
 assert.match(runtime,/this\.xpLive\('sensor','maintenance'\)/);
 assert.match(runtime,/attrs\.next_date/);
 assert.match(runtime,/this\.xpLive\('sensor','odometer'\)/);
 assert.match(runtime,/info\.vin_masked/);
 assert.match(css,/Beta 15 owner visual refinements/);
 assert.match(css,/\.xp-wheel-highlight\{display:none!important\}/);
});
test('No fake tire temperatures or service data: optional sensor attributes only',()=>{
 assert.match(runtime,/a\.tire_temperature_c\?\?/);
 assert.match(runtime,/a\.air_life_percent\?\?/);
 assert.match(runtime,/this\.tirePressureUnit\(\)/);
 assert.match(runtime,/this\.xpTireExtra\(key\)/);
});
test('Cabin layout guardian: unchanged cabin photo and seat-zone event handling',()=>{
 assert.match(runtime,/this\.xpCabinView\(\)/);
 assert.match(runtime,/xpCycleSeat\(b\.dataset\.xpCycle\)/);
 assert.match(runtime,/this\.xpTempControl\(\)\+this\.xpClimatePrimaryControls\(\)/);
 assert.match(theme,/\.xp-climate-target/);
 assert.match(theme,/\.xp-fan-bars i\.xp-fan-bar-on/);
 assert.match(theme,/V3 HVAC final polish/);
 assert.match(theme,/\.xp-ux-modal\.xp-ux-modal-climate \.xp-climate-primary-controls \.xp-climate-primary/);
 assert.match(runtime,/data-xp-range="fan_speed_control"/);
});
test('Pedestal guardian: only CSS-built charging unit around original car and cable',()=>{
 assert.match(runtime,/class="xp-station xp-station-v3"/);
 assert.match(runtime,/this\.carArt\(\)/);
 assert.match(runtime,/xp-charge-cable-core/);
 assert.match(theme,/\.xp-station-display/);
 assert.match(theme,/\.xp-station-charge-light/);
});
test('Build guardian: isolated design and runtime create identical HACS JS',()=>{
 assert.equal(bundle,dist);
 assert.equal(bundle,runtime.replace('const XP_CSS = "__XPENG_STYLES_FROM_THEME__";','const XP_CSS = '+String.fromCharCode(96)+css+'\n'+String.fromCharCode(96)+';'));
});
