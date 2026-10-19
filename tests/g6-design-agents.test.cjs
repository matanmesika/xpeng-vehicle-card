'use strict';
// Four independently named CI design reviewers. No vehicle service is called.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const screenshots=fs.readFileSync(path.join(root,'scripts/capture-dashboard.cjs'),'utf8');
const start='const XP_CSS = `';
const end='\n`;\n// Retain legacy manual';
const begin=source.indexOf(start),finish=source.indexOf(end,begin);
assert.ok(begin>=0&&finish>begin,'Unable to safely isolate the card CSS template');
const css=source.slice(begin+start.length,finish);
const withoutCss=s=>s.slice(0,s.indexOf(start)+start.length)+'[CSS_STYLES_ONLY]'+s.slice(s.indexOf(end,s.indexOf(start)));
const base=process.env.G6_REVIEW_BASE||'origin/release/v1.0.4-beta.10';
function git(...args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
test('Design Agent: proportional desktop SOC icon and premium components',()=>{
 assert.match(css,/@container xpeng-layout \(min-width:851px\)/);
 assert.match(css,/\.xp-home-navigation \.xp-batt-glyph \.xp-battery-level-icon\{[\s\S]*?--xp-icon-size:88px!important/);
 assert.match(css,/\.xp-ux-modal-climate \.xp-ux-cabin-art \.xp-ux-cycle-heat ha-icon\{[\s\S]*?color:#ff9b63!important/);
 assert.match(css,/\.xp-ux-modal-climate \.xp-ux-cabin-art \.xp-ux-cycle-vent ha-icon\{[\s\S]*?color:#68d8ff!important/);
 assert.match(css,/\.xp-scene\{[\s\S]*?--xp-ui-cyan:#39d9f5/);
 assert.match(css,/\.xp-ux-modal-extras \.xp-extra-tile\{[\s\S]*?background:linear-gradient/);
});
test('UX Agent: keyboard focus, distinct disabled states, one responsive card',()=>{
 assert.match(css,/button:focus-visible\{outline:/);
 assert.match(css,/\.xp-ux-dock-action:disabled\{opacity:/);
 assert.match(css,/@container xpeng-layout \(max-width:850px\)/);
 assert.match(css,/@container xpeng-layout \(max-width:520px\)/);
 assert.match(css,/\.xp-ux-modal\{[\s\S]*?overflow-y:auto/);
 assert.match(source,/getGridOptions\(\)\{return \{columns:12,min_columns:12,rows:'auto'\};\}/);
});
test('Behavior Guardian: authored source equals actual HACS bundle',()=>{
 assert.equal(source,dist);
});
test('Behavior Guardian: JS and vehicle assets do not change from the accepted beta',()=>{
 const reference=git('show',base+':src/xpeng-vehicle-card.js');
 // The isolated-design branch intentionally adds PRESENTATION-ONLY helper
 // methods and includes their HTML before existing controls. Undo exactly
 // those permitted additions before comparing the JS executable behavior.
 // Removed obsolete bilingual-code normalization; protected methods are checked directly.
 // UI and owner-approved direct Honk/Flash change in Beta 19, but the
 // underlying protected entity lookup, toggle policy, seat cycle, access policy
 // and service dispatch must remain exactly equal to the accepted baseline.
 const method=sig=>str=>{
   const i=str.indexOf(sig);
   assert.ok(i>=0,'Missing safety method: '+sig);
   const j=str.indexOf('\n }',i);
   assert.ok(j>i,'Method terminator missing: '+sig);
   return str.slice(i,j+3);
 };
 // Compare executable behavior byte-for-byte while allowing approved English
 // presentation copy to differ from the older Hebrew preview baseline.
 // This intentionally does NOT normalize domains, services, suffixes, permissions,
 // command arguments, conditions or state transitions.
 const withoutDisplayCopy=text=>text
   .replace(/label:'[^']*'/g,"label:'[COPY]'")
   .replace(/this\._xpNotice='[^']*'/g,"this._xpNotice='[COPY]'")
   .replace(/throw Error\('[^']*'\)/g,"throw Error('[COPY]')")
   .replace(/\(error\?\.message\|\|'[^']*'\)/g,"(error?.message||'[COPY]')")
   .replace(/\(err\?\.message\|\|'[^']*'\)/g,"(err?.message||'[COPY]')")
   .replace(/xpLocalizeMarkup\('[^']*',this\._hass\)/g,"xpLocalizeMarkup('[COPY]',this._hass)");
 for(const sig of [
   ' xpengEntity(domain,suffix){',' xpLive(domain,suffix){',
   ' xpActionState(action){',' xpToggleTarget(action){',
   ' xpPendingToggle(action){',' xpToggle(action){',' xpAccessAllowed(){',
   ' async xpCycleSeat(suffix){'
 ]){
   assert.equal(withoutDisplayCopy(method(sig)(source)),withoutDisplayCopy(method(sig)(reference)),
     'Protected vehicle/permission behavior was changed: '+sig);
 }
 const sendSig=' async xpSend(domain,service,suffix,value,verifiedDirectTap=false){';
 const oldSend=withoutDisplayCopy(method(sendSig)(reference));
 const newSend=withoutDisplayCopy(method(sendSig)(source)).replace(",'honk_horn','flash_lights'","");
 assert.equal(newSend,oldSend,'Only two verified direct map actions may extend xpSend');
 assert.match(method(sendSig)(source),/verifiedDirectTap&&/);
 assert.match(source,/if\(\['honk_horn','flash_lights'\]\.includes\(action\)\)this\.xpMapDirectAction\(action\)/);
 assert.match(source,/this\._xpMapPending\.has\(suffix\)/);

 // Ignore only redundant placeholders in asset directories that already contain images.
 // All actual WebP/PNG artwork remains strictly protected by this test.
 const changed=git('diff','--name-only',base+'...HEAD','--','assets/')
  .split('\n').map(x=>x.trim()).filter(Boolean)
  .filter(x=>!x.endsWith('/.gitkeep'));
 assert.deepEqual(changed,[],'Original owner-provided vehicle artwork must not be modified');
});
test('English Copy Agent: all UI and browser captures stay English',()=>{
 assert.match(screenshots,/Actual card screenshot \(English design review\)/);
 assert.match(screenshots,/language:'en'/);
 assert.match(screenshots,/localeBrowserQA\.untranslated/);
 assert.match(screenshots,/englishBack,'mdi:arrow-left'/);
 assert.match(screenshots,/localeBack,'mdi:arrow-left'/);
 assert.doesNotMatch(source,/XP_EN_TRANSLATIONS|[\u0590-\u05ff]/);
});
test('Integration Guardian: preserve live charging and state-dependent button actions',()=>{
 assert.match(source,/xpChargingActive\(\)\{/);
 assert.match(source,/xpActionState\(action\)\{/);
 for(const action of ["doors","trunk","windows","port"]){
  assert.ok(source.includes("if(action==='"+action+"')"),'Missing known-state action '+action);
 }
 assert.match(source,/xpExtrasPanel\(\)\{/);
 assert.match(source,/xpMaintenancePanel\(\)\{/);
});

test('Icon Reviewer: distinct MDI rear hatch lift/lower and correct automotive icons',()=>{
 assert.match(source,/trunk:'mdi:car-back'/);
 assert.match(source,/role="img"/);
 assert.match(source,/trunk_open:'mdi:car-back'/);
 assert.match(source,/trunk_close:'mdi:car-back'/);
 assert.match(source,/trunk_lift:'mdi:arrow-up-bold'/);
 assert.match(source,/trunk_lower:'mdi:arrow-down-bold'/);
 assert.doesNotMatch(source,/mdi:window-open|mdi:car-hatchback/);
 assert.match(source,/lock:'mdi:car-door-lock'/);
 assert.match(source,/unlock:'mdi:car-door-lock-open'/);
 assert.match(source,/windows:'mdi:car-door'/);
 assert.match(source,/xp-tailgate-icon/);
 assert.doesNotMatch(css,/\.xp-mdi-icon\[icon="mdi:car-back"\]/,
  'Old trunk-only color override must not make the primary icon inconsistent');
 assert.match(css,/\.xp-scene \.xp-ux-dock-seven \.xp-ux-dock-action ha-icon\{\s*color:#e9f4ff/,
  'All seven primary dock icons must share a neutral color');
});
