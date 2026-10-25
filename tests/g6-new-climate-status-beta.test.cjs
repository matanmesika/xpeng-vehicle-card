const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');

test('new G6 climate features are status-only, not commands',()=>{
 for(const key of ['maximum_cooling','maximum_heating','rear_window_defroster','refresh','sterilisation','a_c_cleaning','pet_mode']){
   assert.match(core,new RegExp("'switch\\."+key+"'"));
   assert.match(core,new RegExp("\\['"+key+"'"));
 }
 const section=core.slice(core.indexOf('const newModes=['),core.indexOf('if(schedule){',core.indexOf('const newModes=[')));
 assert.match(section,/role="status"/);
 assert.match(section,/Status only/);
 assert.doesNotMatch(section,/data-xp-switch|data-xp-extra-action|xpSend\(/);
});
test('generated browser and HACS bundles match',()=>assert.equal(src,dist));
