'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const theme=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
function card(){
 class FakeElement{attachShadow(){this.shadowRoot={addEventListener(){},innerHTML:''};return this.shadowRoot;}toggleAttribute(){}}
 const sandbox={HTMLElement:FakeElement,window:{customCards:[],confirm:()=>true,location:{origin:'http://localhost'}},customElements:{get(){return true},define(){}},document:{documentElement:{}},URL,console};
 const Card=vm.runInNewContext(src+'\nXpengVehicleCard;',sandbox);
 const c=new Card();
 c.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year:'2026',prefix:'xpeng_g6',show_controls:true});
 c._xpengByKey={'number.charge_limit_control':'number.owner_limit','number.sentinel_sensitivity_control':'number.owner_sensitivity','switch.sentinel_switch':'switch.owner_guard'};
 c._hass={locale:{language:'en'},states:{
  'number.owner_limit':{state:'85',attributes:{min:60,max:90,step:5}},
  'number.owner_sensitivity':{state:'3',attributes:{min:0,max:4,step:1}},
  'switch.owner_guard':{state:'off',attributes:{}}
 },callService:()=>Promise.resolve()};
 return c;
}
test('separate CSS and runtime reproduce both shipping entrypoints deterministically',()=>{
 assert.ok(core.includes(slot));
 assert.ok(!core.includes('.xp-ux-modal{'), 'No CSS layout rule may live in the runtime source');
 assert.ok(theme.includes('.xp-ux-modal{'));
 assert.equal(src,dist);
 assert.equal(src,core.replace(slot,'const XP_CSS = `'+theme+'\n`;'));
 cp.execFileSync(process.execPath,['tools/build_vehicle_card.mjs','--check'],{cwd:root,stdio:'pipe'});
});
test('X-Guard help is inside its destination page and bounds reflect renamed HA number',()=>{
 const c=card();c._xpExtraSection='security';
 const html=c.xpExtrasPanel();
 assert.match(html,/What is X-Guard\?/);
 assert.match(html,/Current: 3 · Minimum: 0 · Maximum: 4/);
 assert.match(html,/xp-extra-details/);
 c._xpExtraSection=null;const launcher=c.xpExtrasPanel();
 assert.doesNotMatch(launcher,/Minimum: 0/);
 assert.match(launcher,/data-xp-extra-page="security"/);
});
test('charge limit help reads actual HA min/max, with no invented universal range',()=>{
 const c=card();c._xpPanel='charge_controls';
 const html=c.xpModal();
 assert.match(html,/A lower limit stops at a lower target SOC/);
 assert.match(html,/Current: 85 % · Minimum: 60 % · Maximum: 90 %/);
 assert.match(html,/data-xp-range="charge_limit_control"/);
 delete c._hass.states['number.owner_limit'].attributes.min;
 assert.match(c.xpModal(),/Minimum: Not provided/);
});
test('all existing extra detail destinations have explanations without fictitious ranges',()=>{
 const c=card();
 for(const id of ['security','schedule','energy','power','maintenance','updates','diagnostics']){
  const html=c.xpExtraSectionGuide(id);
  assert.match(html,/aria-label="Function explanation"/,id);
  assert.match(html,/xp-help-intro/,id);
 }
 for(const page of ['climate','charge_controls','charge_schedule','maintenance','port','doors','windows','trunk','map']){
  const html=c.xpModalGuide(page);
  assert.match(html,/xp-help-intro/,page);
 }
 assert.match(c.xpExtraSectionGuide('energy'),/read-only measurements/);
 assert.match(c.xpExtraSectionGuide('power'),/does not change the outlet power rating/);
 assert.match(c.xpModalGuide('maintenance'),/no universal minimum or maximum/);
});
test('help UI only changes presentation, not the real user-control event handlers',()=>{
 assert.match(src,/data-xp-extra-action/);
 assert.match(src,/xpActionState\(action\)\{/);
 assert.match(src,/xpChargingActive\(\)\{/);
 assert.match(src,/this\.xpSend\('number','set_value',key,value\)/);
 assert.match(src,/this\.xpExtraSectionGuide\(section\[0\]\)/);
 assert.match(src,/this\.xpModalGuide\(page\)/);
});
