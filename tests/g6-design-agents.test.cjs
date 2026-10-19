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
 const normalize=s=>{
  let v=withoutCss(s);
  // Owner-approved Beta 15 UI copy only; keep the strict original vehicle
  // state / service / permissions baseline comparison intact.
  const beta15Copy=[
   ["נתוני הצמיגים מתקבלים מ־Home Assistant, והיחידות נקבעות בהגדרות הכרטיס.","Tire data is provided by Home Assistant; units are configured in the card settings."],
   ["אין כרגע נתוני טיפול זמינים באינטגרציה.","No upcoming service data is currently available from the integration."],
   ["נתוני הרכב אינם זמינים כרגע.","Vehicle details are currently unavailable."],
   ["נתוני טיפול אמיתיים","Live vehicle service data"],
   ["מספר שלדה מוסתר","Masked VIN"],
   ["פרטי הרכב","Vehicle details"]
  ].map(item=>JSON.stringify(item)+',').join('');
  v=v.replace('const XP_EN_TRANSLATIONS=Object.freeze(['+beta15Copy,
    'const XP_EN_TRANSLATIONS=Object.freeze([');
  const from=' // Guide copy is intentionally separate from sensor mappings and service';
  const to=' xpExtrasPanel(){';
  const a=v.indexOf(from),b=v.indexOf(to,a);
  if(a>=0){
    assert.ok(b>a,'Guidance helpers are not correctly isolated');
    const lineStart=v.lastIndexOf('\n',a);
    v=v.slice(0,lineStart>=0?lineStart:a)+v.slice(b);
    v=v.replace("this.xpExtraSectionGuide(section[0])+","");
    v=v.replace("this.xpModalGuide(page)+","");
    v=v.replace(/   \/\/ An in-page explanation must never force[\s\S]*?   }\n(?=   inner\.style\.zoom='1')/,'');
  }
  // Presentation-only icon changes: exact allowlist normalizes official MDI
  // registry/rendering and the two trunk action selection expressions.
  // Actual target suffix, permission and service dispatch code must match.
  const iconStart=v.indexOf('const XP_ICONS = Object.freeze({');
  const iconEnd=v.indexOf('function xpEsc(v)',iconStart);
  assert.ok(iconStart>=0&&iconEnd>iconStart,'Central icon registry must exist');
  v=v.slice(0,iconStart)+'[OFFICIAL_MDI_UI_ICON_REGISTRY_AND_RENDERER]\n'+v.slice(iconEnd);
  v=v.replaceAll("target?.suffix==='open_trunk'?'trunk_open':target?.suffix==='close_trunk'?'trunk_close':'trunk'",
    "target?.suffix==='open_trunk'?'trunk_open':'trunk'");
  v=v.replace("xpIcon(state==='closed'?'trunk_open':state==='open'?'trunk_close':'trunk',36)+",
    "xpIcon('trunk',36)+");
  // Remove exactly scoped presentation methods from BOTH compared versions.
  // All state, service, and command methods outside these scopes must still match.
  const guideTranslation='["לחצי הצמיגים מתקבלים מחיישני הרכב דרך Home Assistant. ערך חסר נשאר לא זמין; יחידות הלחץ נקבעות בהגדרות הכרטיס.","Tire pressure comes from the vehicle sensors through Home Assistant. Missing values stay unavailable; units are configured in the card editor."],';
  v=v.replace(guideTranslation,'');
  const aux=v.indexOf(' xpTireExtra(key){');
  if(aux>=0){
    const next=v.indexOf('  tireScreen(showBack=true){',aux);
    assert.ok(next>aux,'TPMS read-only attribute helper must be beside the tire view');
    v=v.slice(0,aux)+v.slice(next);
  }
  const tpmsStart=v.indexOf(' xpMaintenancePanel(){'),chargeNext=v.indexOf(' xpChargeLimitPanel(){',tpmsStart);
  assert.ok(tpmsStart>=0&&chargeNext>tpmsStart,'TPMS-only page must not move service handlers');
  v=v.slice(0,tpmsStart)+' [OWNER_TPMS_PRESENTATION_ONLY]\n'+v.slice(chargeNext);
  const tireStart=v.indexOf('tireScreen(showBack=true){'),overviewNext=v.indexOf(' overview(){',tireStart);
  assert.ok(tireStart>=0&&overviewNext>tireStart,'Tire layout must not affect Home handler');
  const tireLine=v.lastIndexOf('\n',tireStart)+1;
  v=v.slice(0,tireLine)+' [OWNER_TIRE_LAYOUT_PRESENTATION_ONLY]\n'+v.slice(overviewNext);
  v=v.replace('this.xpTempControl()+this.xpClimatePrimaryControls()+this.xpFanControl()+',
    'this.xpClimatePrimaryControls()+this.xpTempControl()+this.xpFanControl()+');
  v=v.replace('<div class="xp-station xp-station-v3" aria-hidden="true"><span class="xp-station-display">${xpIcon(\'station\',24)}</span><span class="xp-station-charge-light"></span><span class="xp-station-side-light"></span></div>',
    '<div class="xp-station" aria-hidden="true">${xpIcon(\'station\',24)}</div>');
  // Beta 15 changes only native map presentation and excludes duplicate maintenance.
  v=v.replace("default_zoom:16,auto_fit:true,fit_zones:false,hours_to_show:0",
    "default_zoom:11,hours_to_show:0");
  v=v.replace("return this.xpMaintenancePanel();",
    "return this.xpMaintenancePanel()+(out?'<div class=\"xp-maint-additional\">'+out+'</div>':'');");
  // Beta 16 only mounts a one-time UI camera fix; car permissions and state are unchanged.
  const centerStart=v.indexOf(' xpMapDisplayHass(gps){');
  if(centerStart>=0){
    const centerEnd=v.indexOf(' async xpMountMap(){',centerStart);
    assert.ok(centerEnd>centerStart,'One-time camera helper must be isolated');
    v=v.slice(0,centerStart)+v.slice(centerEnd);
    // Retain exactly the legacy separator between map methods.
    v=v.replace('\n\n async xpMountMap(){','\n async xpMountMap(){');
  }
  v=v.replace('     this.xpCenterMapOnVehicle(map,gps);\n','');
  // Beta 17 rendering-only changes; preserve protected service and command handlers.
  v=v.replace("  const homeSurface=!isCharging&&!this._tireOpen&&this.xpUiEnabled();"+String.fromCharCode(10),'');
  v=v.replace("${homeSurface?'xp-home-navigation':''}","${onHome&&this.xpUiEnabled()?'xp-home-navigation':''}");
  v=v.replace("<h1><em>${xpEsc(this.model())}</em></h1>","<h1>XPENG <em>${xpEsc(this.model())}</em></h1>");
  v=v.replace('return `<header class="xp-header">'+String.fromCharCode(10),
    'return `<header class="xp-header"><div class="xp-brand"><span>XPENG</span></div>'+String.fromCharCode(10));
  v=v.replace("' aria-label=\"'+xpEsc(label)+'\" '","' aria-label=\"'+xpEsc(label)+'\" title=\"'+xpEsc(label)+'\" '");
  v=v.replace("this._xpMapElement.hass=this.xpMapDisplayHass(gps);","this._xpMapElement.hass=this._hass;");
  v=v.replace("map.hass=this.xpMapDisplayHass(gps);","map.hass=this._hass;");
  v=v.replace("entities:[{entity:gps.id,label_mode:'icon',focus:true}]","entities:[{entity:gps.id}]");
  return v;
 };
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
 for(const sig of [
   ' xpengEntity(domain,suffix){',' xpLive(domain,suffix){',
   ' xpActionState(action){',' xpToggleTarget(action){',
   ' xpPendingToggle(action){',' xpToggle(action){',' xpAccessAllowed(){',
   ' async xpCycleSeat(suffix){'
 ]){
   assert.equal(method(sig)(source),method(sig)(reference),
     'Protected vehicle/permission behavior was changed: '+sig);
 }
 const sendSig=' async xpSend(domain,service,suffix,value,verifiedDirectTap=false){';
 const oldSend=method(sendSig)(reference);
 const newSend=method(sendSig)(source).replace(",'honk_horn','flash_lights'","");
 assert.equal(newSend,oldSend,'Only two verified direct map actions may extend xpSend');
 assert.match(method(sendSig)(source),/verifiedDirectTap&&/);
 assert.match(source,/if\(\['honk_horn','flash_lights'\]\.includes\(action\)\)this\.xpMapDirectAction\(action\)/);
 assert.match(source,/this\._xpMapPending\.has\(suffix\)/);

 const changed=git('diff','--name-only',base+'...HEAD','--','assets/').trim();
 assert.equal(changed,'','Original owner-provided vehicle artwork must not be modified');
});
test('English Copy Agent: real browser captures switch to English but preserve RTL regression',()=>{
 assert.match(screenshots,/Actual card screenshot \(English design review\)/);
 assert.match(screenshots,/language:'en'/);
 assert.match(screenshots,/localeBrowserQA\.untranslated/);
 assert.match(screenshots,/englishBack,'mdi:arrow-left'/);
 assert.match(screenshots,/hebrewBack,'mdi:arrow-right'/);
 assert.match(source,/const XP_EN_TRANSLATIONS=Object\.freeze/);
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
