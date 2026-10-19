'use strict';
// A release-ready README must not silently point at deleted screenshots or
// overstate the model/year/paint inventory. Tests use checked-in repo files.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=path=>fs.readFileSync(require('node:path').join(root,path),'utf8');
const screenshotNames=[
 'home-desktop.png','home-mobile.png','charging-desktop.png','charging-mobile.png',
 'climate-desktop.png','climate-mobile.png','maintenance-desktop.png','maintenance-mobile.png',
 'map-desktop.png','map-mobile.png','charge-controls-mobile.png','diagnostics-mobile.png',
 'functions-desktop.png','functions-mobile.png'
];
test('release README and G6 guide link only to the fourteen current screenshots',()=>{
 const dir=path.join(root,'docs/screenshots');
 const actual=fs.readdirSync(dir).filter(f=>/\.(?:png|jpe?g|webp)$/i.test(f)).sort();
 assert.deepEqual(actual,screenshotNames.slice().sort(),'The curated screenshot folder must contain exactly 14 files');
 for(const doc of ['README.md','docs/README_HE.md','docs/G6_DASHBOARD_GUIDE_HE.md']){
   const markdown=read(doc),base=path.join(root,path.dirname(doc));
   const markdownImages=[...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
   assert.ok(markdownImages.length>=10,doc+' should render the five desktop/mobile screen pairs');
   for(const rel of markdownImages){
     assert.ok(fs.existsSync(path.resolve(base,rel)),doc+' references missing screenshot '+rel);
   }
   for(const n of screenshotNames)
     assert.ok(markdown.includes(n),doc+' should link '+n);
 }
});
test('climate has no text over the cabin photo and source equals HACS bundle',()=>{
 const src=read('src/xpeng-vehicle-card.js'),dist=read('dist/xpeng-vehicle-card.js');
 assert.equal(src,dist,'HACS frontend must be byte-for-byte current source');
 assert.doesNotMatch(src,/xp-ux-cabin-disclaimer|found\.caption/);
 assert.match(src,/data-cabin-art/);
 assert.match(src,/xpCabinHotspots\(\)/);
});
test('G6 functional mapping complete does not imply all G6 model artwork is complete',()=>{
 const data=JSON.parse(read('data/artwork-status.json'));
 const g6=data.by_model.find(x=>x.model==='G6');
 assert.ok(g6,'Artwork inventory must include G6');
 assert.equal(g6.available_views,30);
 assert.equal(g6.total_views,33);
 assert.equal(g6.missing_views,3);
 const docs=read('README.md')+'\n'+read('docs/G6_RELEASE_READINESS_HE.md');
 assert.match(docs,/G6 functional mapping status: COMPLETE|מיפוי.*G6.*הושלם/);
 assert.match(docs,/30\/33/,'Document real G6 image inventory, not 100% claim');
 assert.match(docs,/other 14 vehicle families|14 משפחות/,'Other vehicle image characterization remains open');
});
test('historical alpha workflows and discontinued pre-v1 tests were removed safely',()=>{
 const missing=['tests/all-profiles.test.cjs','tests/dashboard-v010.test.cjs',
   '.github/workflows/publish-dashboard-alpha3.yml',
   '.github/workflows/publish-dashboard-alpha4.yml',
   '.github/workflows/publish-dashboard-alpha5.yml',
   '.github/workflows/publish-dashboard-previews.yml',
   '.github/workflows/publish-preview-v1.yml',
   '.github/workflows/publish-v1.yml',
   '.github/workflows/release-beta.yml',
   '.github/workflows/publish-v1.0.4-beta.5.yml',
   '.github/workflows/publish-v1.0.4-beta.6.yml',
   '.github/workflows/publish-v1.0.4-beta.7.yml',
   '.github/workflows/publish-v1.0.4-beta.8.yml'
 ];
 for(const file of missing)assert.equal(fs.existsSync(path.join(root,file)),false,'obsolete file still present: '+file);
 for(const alive of ['.github/workflows/test.yml','tests/xpeng-controls-smoke.test.cjs',
   'data/vehicle-art-map.json','profiles/year-profiles.json',
   'assets/vehicles/g6/interior_light_gray.webp','assets/vehicles/g6/interior_dark_gray.webp'])
   assert.ok(fs.existsSync(path.join(root,alive)),'A required source/QA asset was removed: '+alive);
});
