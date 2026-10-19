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
  return v;
 };
 assert.equal(normalize(source),normalize(reference),
  'Service calls, sensors and actions must stay identical; only guides and CSS are permitted');
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
 assert.match(source,/trunk:'mdi:car-estate'/);
 assert.match(source,/trunk_open:'mdi:car-estate'/);
 assert.match(source,/trunk_close:'mdi:car-estate'/);
 assert.match(source,/trunk_lift:'mdi:arrow-up-bold'/);
 assert.match(source,/trunk_lower:'mdi:arrow-down-bold'/);
 assert.doesNotMatch(source,/mdi:car-back|mdi:window-open|mdi:car-hatchback/);
 assert.match(source,/lock:'mdi:car-door-lock'/);
 assert.match(source,/unlock:'mdi:car-door-lock-open'/);
 assert.match(source,/windows:'mdi:car-door'/);
 assert.match(css,/\.xp-trunk-symbol-lower>\.xp-trunk-arrow/);
 assert.doesNotMatch(css,/\.xp-mdi-icon\[icon="mdi:car-back"\]/,
  'Old trunk-only color override must not make the primary icon inconsistent');
 assert.match(css,/\.xp-scene \.xp-ux-dock-seven \.xp-ux-dock-action ha-icon\{\s*color:#e9f4ff/,
  'All seven primary dock icons must share a neutral color');
});
