'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vehicle-catalog.json')));
const artMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vehicle-art-map.json')));
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vehicle-art-inventory.json')));
const js = fs.readFileSync(path.join(ROOT, 'src/xpeng-vehicle-card.js'), 'utf8');
const dist = fs.readFileSync(path.join(ROOT, 'dist/xpeng-vehicle-card.js'), 'utf8');
const classes = new Map();
const sandbox = {
 HTMLElement: class { attachShadow() { this.shadowRoot={addEventListener() {}, innerHTML: ''}; return this.shadowRoot; }},
 customElements: {get:k=>classes.get(k), define:(k,c)=>classes.set(k,c)},
 window: {customCards:[]}, document: {addEventListener() {}, removeEventListener() {}},
 console, URL, CustomEvent: class {}
};
vm.runInNewContext(js, sandbox);
const api = vm.runInNewContext('({xpNormalizeAppearance,xpVehicleAssetPath,xpAllowedTrims,xpAllowedPaints,xpAllowedYears,xpAllowedModels,XP_ARTWORK_INDEX,XP_ILLUSTRATIVE_ARTWORK_INDEX})', sandbox);
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
     const group = catalog.models.find(m=>m.id===e.model).groups.find(g=>g.id===e.year_group);
   const validYear = group.years.find(y=>group.colors_by_year[String(y)].includes(e.exterior_color));
   assert.ok(validYear,e.model+' '+e.year_group+' '+e.exterior_color);
   const a = api.xpNormalizeAppearance({model:e.model,year:String(validYear),color:e.exterior_color});
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
   const group=catalog.models.find(m=>m.id===e.model).groups.find(g=>g.id===e.year_group);
   const year=group.years.find(y=>group.colors_by_year[String(y)].includes(e.exterior_color));
   const cfg={model:e.model,year:String(year),color:e.exterior_color};
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
 assert.match(js, /\['model','year_group','year','color'\]\.includes\(key\)/);
 assert.doesNotMatch(js, /\['model','year','color','trim'\]\.includes\(key\)/);
});
test('G6 front-facing charging reference overrides rear-only legacy asset', () => {
 const cfg={model:'G6',year:'2026',color:'graphite_gray'};
 const car=instance(cfg);
 const front=car.assetSpec();
 assert.ok(front.src.endsWith('/vehicles/g6/2026/graphite_gray/front.webp'));
 car._failedArtwork.add(front.src);
 assert.equal(car.assetSpec().tier,'silhouette');
 const charge=instance(cfg,true);
 assert.ok(charge.assetSpec().src.endsWith('/vehicles/g6/2026/graphite_gray/front.webp'));
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

test('2025/2026 MONA and Next P7 use distinct colour palettes, selected trims stay inert',()=>{
 const sample=[
   ['MONA M03','2024',5,['star_blue'],['roland_purple']],
   ['MONA M03','2026',7,['roland_purple','avocado_green','cherry_pink'],['star_blue']],
   ['Next P7','2025',6,['rhythm_yellow','stellar_green'],['night_black']],
   ['Next P7','2026',10,['night_black','star_red','matte_new_moon_silver'],[]]
 ];
 for(const [model,year,count,must,not] of sample){
   const palette=Array.from(api.xpAllowedPaints(model,year),p=>p.id);
   assert.equal(palette.length,count,model+' '+year);
   for(const c of must)assert.ok(palette.includes(c),model+' '+year+' '+c);
   for(const c of not)assert.ok(!palette.includes(c),model+' '+year+' '+c);
 }
 const old=api.xpNormalizeAppearance({model:'Next P7',year:'2025',color:'rhythm_yellow'});
 const newer=api.xpNormalizeAppearance({model:'Next P7',year:'2026',color:'rhythm_yellow'});
 assert.notEqual(api.xpVehicleAssetPath(old,'front'),api.xpVehicleAssetPath(newer,'front'));
 const trims=api.xpAllowedTrims('Next P7','2026');
 assert.equal(instance({...newer,trim:trims[0].id}).assetSpec().src,instance({...newer,trim:'bogus'}).assetSpec().src);
});
test('every single model year resolves to one group; no missing view may borrow a picture',()=>{
 for(const model of catalog.models){
  const visited=new Set();
  for(const group of model.groups){
   for(const year of group.years){
    assert.ok(!visited.has(year),model.id+' year '+year);
    visited.add(year);
    const normalized=api.xpNormalizeAppearance({model:model.id,year:String(year),color:group.colors[0]});
    assert.equal(normalized.year,String(year),model.id+' '+year);
    for(const view of ['front','charging','top']){
     assert.equal(api.xpVehicleAssetPath(normalized,view),
       'vehicles/'+model.id.toLowerCase().replace(/\+/g,'_plus').replace(/ /g,'_')+'/'+group.id+'/'+group.colors[0]+'/'+view+'.webp');
    }
   }
  }
 }
});

test('G9 refreshed 2025-2026 first three paint sets are complete with independent images',()=>{
 for(const paint of ['arctic_white','graphite_gray','midnight_black']){
  const found=artMap.entries.find(e=>e.model==='G9'&&e.year_group==='2025-2026'&&e.exterior_color===paint);
  assert.ok(found);
  for(const view of ['front','charging','top']){
    assert.equal(found.views[view].status,'available');
    assert.ok(api.XP_ARTWORK_INDEX.has(found.views[view].path));
    assert.ok(api.XP_ILLUSTRATIVE_ARTWORK_INDEX.has(found.views[view].path));
  }
  const app=api.xpNormalizeAppearance({model:'G9',year:'2026',color:paint});
  assert.equal(instance(app).assetSpec().tier,'generated-preview');
 }
});

test('year-specific colour choices and historic group fallback',()=>{
 const allYears=vm.runInNewContext('xpAllowedYears',sandbox);
 assert.deepEqual(Array.from(allYears('P7i'),x=>x.id),['2025','2024','2023']);
 const ids=year=>Array.from(api.xpAllowedPaints('P7i',year),p=>p.id);
 const basic=['arctic_white','jet_black','space_gray','silver_frost','kaitoke_green_matte'];
 assert.deepEqual(ids('2023'),basic);
 assert.deepEqual(ids('2024'),[...basic,'starry_dusk_purple','star_blue']);
 assert.deepEqual(ids('2025'),basic);
 assert.deepEqual(ids('2023-2025'),basic);
 const selected=api.xpNormalizeAppearance({model:'P7i',year:'2024',color:'starry_dusk_purple'});
 assert.equal(selected.year,'2024');
 assert.equal(api.xpVehicleAssetPath(selected,'front'),'vehicles/p7i/2023-2025/starry_dusk_purple/front.webp');
 assert.equal(api.xpNormalizeAppearance({...selected,year:'2023'}).color,'arctic_white');
});
test('all individual years have explicitly recorded year palettes',()=>{
 let count=0;
 for(const m of catalog.models){
  const seen=new Set();
  for(const g of m.groups)for(const y of g.years){
   count++;assert.equal(seen.has(y),false);seen.add(y);
   assert.deepEqual(Array.from(api.xpAllowedPaints(m.id,String(y)),p=>p.id),g.colors_by_year[String(y)]);
   assert.ok(g.year_palette_sources[String(y)]);
   assert.equal(api.xpNormalizeAppearance({model:m.id,year:String(y)}).year,String(y));
  }
 }
 assert.equal(count,42);
});

test('P7i white front is a provenance-tagged partial 3-view combination',()=>{
 const item=artMap.entries.find(x=>x.model==='P7i'&&x.year_group==='2023-2025'&&x.exterior_color==='arctic_white');
 assert.equal(item.views.front.status,'available');
 assert.equal(item.views.charging.status,'pending');
 assert.equal(item.views.top.status,'pending');
 const front=item.views.front.path;
 assert.equal(api.XP_ARTWORK_INDEX.has(front),true);
 assert.equal(api.XP_ILLUSTRATIVE_ARTWORK_INDEX.has(front),true);
 const a=api.xpNormalizeAppearance({model:'P7i',year:'2024',color:'arctic_white'});
 assert.equal(instance(a).assetSpec().tier,'generated-preview');
 assert.equal(instance(a,true).assetSpec().tier,'silhouette');
});

test('model years are unique, descending, and never display mixed-year group options', () => {
 const models=Array.from(api.xpAllowedModels());
 const newest=m=>Math.max(...catalog.models.find(x=>x.id===m.id).groups.flatMap(g=>g.years));
 for(let i=1;i<models.length;i++)assert.ok(newest(models[i-1])>=newest(models[i]));
 for(const model of catalog.models){
  const years=Array.from(api.xpAllowedYears(model.id),x=>Number(x.id));
  const expected=[...new Set(model.groups.flatMap(g=>g.years))].sort((a,b)=>b-a);
  assert.deepEqual(years,expected,model.id);
  assert.equal(years.length,new Set(years).size,model.id);
  for(const year of years){
   const normalized=api.xpNormalizeAppearance({model:model.id,year:String(year)});
   assert.equal(normalized.year,String(year));
   const group=model.groups.find(g=>g.years.includes(year));
   assert.ok(api.xpVehicleAssetPath(normalized,'front').includes('/'+group.id+'/'));
  }
 }
});

// Regression: 2023-2025 G6 uses one body generation; facelift 2026 must never reuse it.
test('G6 2023, 2024 and 2025 share shape assets, while 2026 uses distinct facelift assets', () => {
 const group=catalog.models.find(m=>m.id==='G6').groups;
 assert.deepEqual(group.map(g=>g.id),['2023-2025','2026']);
 for(const view of ['front','charging','top']) {
  const historic=['2023','2024','2025'].map(year=>api.xpVehicleAssetPath(api.xpNormalizeAppearance({model:'G6',year,color:'arctic_white'}),view));
  assert.equal(new Set(historic).size,1,'2023-2025 must share '+view);
  assert.match(historic[0],/\/g6\/2023-2025\/arctic_white\//);
  const facelift=api.xpVehicleAssetPath(api.xpNormalizeAppearance({model:'G6',year:'2026',color:'arctic_white'}),view);
  assert.match(facelift,/\/g6\/2026\/arctic_white\//);
  assert.notEqual(facelift,historic[0],'2026 must use facelift '+view);
  assert.ok(api.XP_ARTWORK_INDEX.has(facelift),'2026 '+view+' artwork must exist');
  assert.ok(api.XP_ARTWORK_INDEX.has(historic[0]),'2023-2025 '+view+' artwork must exist');
 }
 assert.deepEqual(Array.from(api.xpAllowedYears('G6'),x=>x.id),['2026','2025','2024','2023']);
});

test('all 15 model pickers group shared generations instead of repeating years', () => {
 const {xpYearGroupChoices,xpYearNeedsSpecificChoice,xpYearGroupFor} = vm.runInNewContext(
   '({xpYearGroupChoices,xpYearNeedsSpecificChoice,xpYearGroupFor})',sandbox);
 const Editor = classes.get('xpeng-vehicle-card-editor');
 for (const model of catalog.models) {
  const choices=Array.from(xpYearGroupChoices(model.id));
  assert.equal(choices.length,model.groups.length,model.id);
  assert.equal(new Set(choices.map(x=>x.id)).size,choices.length,model.id);
  assert.deepEqual(choices.map(x=>x.id).sort(),model.groups.map(x=>x.id).sort(),model.id);
  for (const group of model.groups)for (const year of group.years) {
   const e=new Editor();
   e.setConfig({model:model.id,year:String(year)});
   const html=e.shadowRoot.innerHTML;
   assert.ok(html.includes('data-key="year_group"'),model.id);
   assert.ok(html.includes('<option value="'+group.id+'" selected>'),model.id+' '+year);
   const expectedPaletteDiff=new Set(group.years.map(y=>JSON.stringify(group.colors_by_year[String(y)]))).size>1;
   assert.equal(xpYearNeedsSpecificChoice(model.id,String(year)),expectedPaletteDiff);
   assert.equal(html.includes('data-key="year"'),expectedPaletteDiff,model.id+' '+year);
   assert.equal(xpYearGroupFor(model.id,String(year)).id,group.id);
  }
 }
});

test('G6 2026 display names match the official Israeli lineup and do not combine legacy labels',()=>{
 const trims=Array.from(api.xpAllowedTrims('G6','2026'),x=>x.label);
 assert.deepEqual(trims,['Core RWD','Core+ RWD','Core Performance AWD','Black Edition']);
 const Editor=classes.get('xpeng-vehicle-card-editor');
 const e=new Editor();e.setConfig({model:'G6',year:'2026',trim:'core_performance_awd'});
 assert.match(e.shadowRoot.innerHTML,/data-key="year_group"/);
 assert.doesNotMatch(e.shadowRoot.innerHTML,/data-key="year"/);
 for(const name of trims)assert.ok(e.shadowRoot.innerHTML.includes('>'+name+'</option>'),name);
 assert.doesNotMatch(e.shadowRoot.innerHTML,/RWD Standard Range|AWD Performance<\/option>/);
});
test('P7i keeps exact-year colour selection for the 2024-only paints',()=>{
 const Editor=classes.get('xpeng-vehicle-card-editor');
 const editor=new Editor();
 editor.setConfig({model:'P7i',year:'2024',color:'star_blue'});
 assert.match(editor.shadowRoot.innerHTML,/data-key="year_group"/);
 assert.match(editor.shadowRoot.innerHTML,/data-key="year"/);
 assert.ok(editor.shadowRoot.innerHTML.includes('<option value="2024" selected>'));
 assert.ok(editor.shadowRoot.innerHTML.includes('value="star_blue"'));
 editor.setConfig({model:'P7i',year:'2025',color:'star_blue'});
 assert.equal(editor._cfg.color,'arctic_white');
});

test('the README dashboard gallery ships three real browser PNG captures',()=>{
 const gallery=fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
 const files=['vehicle-status','charging','tire-pressure'].map(view=>'g6-2026-'+view+'.png');
 const sizes=[];
 for(const f of files){
  const relative='docs/screenshots/'+f;
  assert.ok(gallery.includes(']('+relative+')'),'gallery link missing: '+relative);
  const raw=fs.readFileSync(path.join(ROOT,relative));
  assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a',f);
  assert.ok(raw.readUInt32BE(16)>=1100&&raw.readUInt32BE(20)>=620,f);
  assert.ok(raw.length>80000,f);
  sizes.push(raw.length);
 }
 assert.equal(new Set(sizes).size,3,'views must be independent captures');
 assert.ok(fs.existsSync(path.join(ROOT,'scripts/capture-dashboard.cjs')),'capture script missing');
});
