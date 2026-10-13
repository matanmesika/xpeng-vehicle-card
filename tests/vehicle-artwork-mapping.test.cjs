'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'vehicle-catalog.json')));
const artMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'vehicle-art-map.json')));
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'vehicle-art-inventory.json')));
const js = fs.readFileSync(path.join(ROOT, 'src/xpeng-vehicle-card.js'), 'utf8');
const dist = fs.readFileSync(path.join(ROOT, 'dist/xpeng-vehicle-card.js'), 'utf8');
const classes = new Map();
const sandbox = {
 HTMLElement: class { attachShadow() { return {addEventListener() {}, innerHTML: ''}; }},
 customElements: {get:k=>classes.get(k), define:(k,c)=>classes.set(k,c)},
 window: {customCards:[]}, document: {addEventListener() {}, removeEventListener() {}},
 console, URL, CustomEvent: class {}
};
vm.runInNewContext(js, sandbox);
const api = vm.runInNewContext('({xpNormalizeAppearance,xpVehicleAssetPath,xpAllowedTrims,xpAllowedPaints,XP_ARTWORK_INDEX,XP_ILLUSTRATIVE_ARTWORK_INDEX})', sandbox);
const Card = classes.get('xpeng-vehicle-card');
function instance(cfg, charging=false) {
 const obj = Object.create(Card.prototype);
 obj._config = cfg; obj._vehicleIndex = 0;
 obj._failedArtwork = new Set(); obj._view = charging?'charging':'overview';
 return obj;
}
test('source/dist parity, 15-model mapped catalogue and no trim path key', () => {
 assert.equal(js, dist);
 assert.equal(catalog.models.length, 15);
 assert.equal(artMap.entries.length, catalog.models.reduce((n,m)=>n+m.groups.reduce((x,g)=>x+g.colors.length,0),0));
 assert.deepEqual(Array.from(artMap.selection_key), ['model','year_group','exterior_color']);
 assert.equal(artMap.trim_affects_artwork, false);
 assert.equal(inventory.trim_affects_artwork, false);
});
test('all catalogued model/year-group/paint selections resolve to a model-specific canonical path', () => {
 for (const e of artMap.entries) {
   for (const view of ['front','charging','top']) {
     const a = api.xpNormalizeAppearance({model:e.model,year:e.year_group,color:e.exterior_color});
     const candidate = api.xpVehicleAssetPath(a, view);
     assert.equal(candidate, e.views[view].path);
     const expected = e.views[view].status==='available';
     assert.equal(api.XP_ARTWORK_INDEX.has(candidate), expected, candidate);
     assert.equal(fs.existsSync(path.join(ROOT,'assets',candidate)), expected, candidate);
   }
 }
});
test('trim labels can differ by year; trim never changes image, paint or cabin choices', () => {
 for (const e of artMap.entries) {
   const a = api.xpNormalizeAppearance({model:e.model,year:e.year_group,color:e.exterior_color});
   const options = api.xpAllowedTrims(e.model,e.year_group);
   const car = instance({...a,trim:options[0].id});
   const baseline = car.assetSpec().src;
   const chargingBaseline = instance({...a,trim:options[0].id},true).assetSpec().src;
   for (const trim of options) {
     const other = {...a,trim:trim.id};
     assert.equal(instance(other).assetSpec().src, baseline);
     assert.equal(instance(other,true).assetSpec().src, chargingBaseline);
     assert.equal(api.xpNormalizeAppearance(other).color, a.color);
     assert.equal(api.xpNormalizeAppearance(other).interior, a.interior);
   }
 }
});
test('missing artwork is a labelled colour-matched silhouette, never another model or model year', () => {
 for (const e of artMap.entries) {
   const cfg={model:e.model,year:e.year_group,color:e.exterior_color};
   const car=instance(cfg);
   const art=car.assetSpec();
   if (e.views.front.status==='pending') {
     assert.equal(art.tier,'silhouette');
     assert.ok(art.src.startsWith('data:image/svg+xml;'));
     assert.equal(art.illustrative,true);
   } else {
     assert.equal(art.tier,api.XP_ILLUSTRATIVE_ARTWORK_INDEX.has(e.views.front.path)?'generated-preview':'exact-view');
     assert.equal(art.illustrative,api.XP_ILLUSTRATIVE_ARTWORK_INDEX.has(e.views.front.path));
     assert.ok(art.src.endsWith(e.views.front.path));
   }
 }
});
test('year editor changes must invalidate old manual hero images, unlike trim changes', () => {
 assert.match(js, /\['model','year','color'\]\.includes\(key\)/);
 assert.doesNotMatch(js, /\['model','year','color','trim'\]\.includes\(key\)/);
});
test('front and charging require their own actual view; missing or broken URLs fall back', () => {
 const cfg={model:'G6',year:'2026',color:'graphite_gray'};
 const car=instance(cfg);
 const front=car.assetSpec();
 assert.ok(front.src.endsWith('/vehicles/g6/2026/graphite_gray/front.webp'));
 car._failedArtwork.add(front.src);
 assert.equal(car.assetSpec().tier,'silhouette');
 const charge=instance(cfg,true);
 assert.ok(charge.assetSpec().src.endsWith('/vehicles/g6/2026/graphite_gray/charging.webp'));
 const top=instance(cfg);
 assert.match(top.topCarArt(),/data-top-art/);
 top._failedArtwork.add(top.artworkUrl('vehicles/g6/2026/graphite_gray/top.webp'));
 assert.match(top.topCarArt(),/xp-top-car/);
});

test('G6 original five colours use explicit AI-generation provenance and independently mapped views',()=>{
 const photos=JSON.parse(fs.readFileSync(path.join(ROOT,'sources/ai-generated-vehicle-art.json'),'utf8'));
 assert.equal(photos.manufacturer_verified,false);
 assert.equal(photos.paths.filter(p=>p.startsWith('vehicles/g6/2023-2025/')).length,15);
 const originals=artMap.entries.filter(e=>e.model==='G6'&&e.year_group==='2023-2025');
 assert.equal(originals.length,5);
 for(const item of originals){
  const seen=new Set();
  for(const view of ['front','charging','top']){
   const path=item.views[view].path;
   assert.equal(item.views[view].status,'available');
   assert.ok(photos.paths.includes(path));
   seen.add(path);
  }
  assert.equal(seen.size,3);
  assert.equal(instance({model:'G6',year:'2023-2025',color:item.exterior_color}).assetSpec().view_status,'ai_generated_preview');
 }
});

test('G7 2025 and 2026 expose distinct verified China-market palettes without changing trim routing',()=>{
 const palette2025=Array.from(api.xpAllowedPaints('G7','2025'),p=>p.id);
 const palette2026=Array.from(api.xpAllowedPaints('G7','2026'),p=>p.id);
 assert.equal(palette2025.length,6);
 assert.equal(palette2026.length,5);
 assert.ok(palette2025.includes('interstellar_green')&&!palette2026.includes('interstellar_green'));
 assert.ok(palette2026.includes('twilight_purple')&&!palette2025.includes('twilight_purple'));
 for(const view of ['front','charging','top']){
  const relative='vehicles/g7/2025/nebula_white/'+view+'.webp';
  assert.ok(api.XP_ARTWORK_INDEX.has(relative),relative);
  assert.ok(api.XP_ILLUSTRATIVE_ARTWORK_INDEX.has(relative),relative);
 }
 const a=api.xpNormalizeAppearance({model:'G7',year:'2025',color:'nebula_white'});
 assert.equal(api.xpVehicleAssetPath(a,'front'),'vehicles/g7/2025/nebula_white/front.webp');
 assert.equal(instance(a).assetSpec().tier,'generated-preview');
 assert.equal(instance({...a,trim:'market_dependent'}).assetSpec().src,instance(a).assetSpec().src);
 const b=api.xpNormalizeAppearance({model:'G7',year:'2026',color:'twilight_purple'});
 assert.equal(api.xpVehicleAssetPath(b,'front'),'vehicles/g7/2026/twilight_purple/front.webp');
 assert.equal(instance(b).assetSpec().tier,'silhouette');
});
