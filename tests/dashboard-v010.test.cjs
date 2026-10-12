'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname,'../dist/xpeng-vehicle-card.js'),'utf8');
class FakeElement {
  attachShadow(){
    this.shadowRoot={innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn}};
    return this.shadowRoot;
  }
  toggleAttribute(name,enabled){this.attrs??={};if(enabled)this.attrs[name]='';else delete this.attrs[name];}
  setAttribute(name,value){this.attrs??={};this.attrs[name]=value;}
  dispatchEvent(){}
}
const tags=new Map();
const context={
 HTMLElement:FakeElement,console,
 window:{customCards:[]},
 customElements:{get:id=>tags.get(id),define:(id,value)=>tags.set(id,value)},
 document:{createElement:()=>({}),addEventListener(){},removeEventListener(){},fullscreenElement:null},
 CustomEvent:class{},
 Date,Intl,Set,Object,Array,Number,Math,String,
};
vm.runInNewContext(source,context,{filename:'xpeng-vehicle-card.js'});
const Card=tags.get('xpeng-vehicle-card');

function setup(states={}){
 const c=new Card();
 c.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',color:'arctic_white'});
 c.hass={states};
 return c;
}
function data(){
 return {
  'sensor.my_xpeng_soc':{state:'62'},
  'sensor.my_xpeng_range_km':{state:'391'},
  'sensor.my_xpeng_odometer_km':{state:'12548'},
  'sensor.my_xpeng_charge_power_kw':{state:'11.2'},
  'sensor.my_xpeng_charge_target':{state:'90'},
  'sensor.my_xpeng_charge_remaining_min':{state:'135'},
  'sensor.my_xpeng_tire_pressure_front_left_kpa':{state:'250'},
  'sensor.my_xpeng_tire_pressure_front_right_kpa':{state:'250'},
  'sensor.my_xpeng_tire_pressure_rear_left_kpa':{state:'250'},
  'sensor.my_xpeng_tire_pressure_rear_right_kpa':{state:'250'},
  'device_tracker.my_xpeng_location':{state:'Ramat Gan, Israel'},
  'binary_sensor.my_xpeng_is_charging':{state:'off'}
 };
}

test('only vehicle status screen on idle: uses real telemetry',()=>{
 const card=setup(data()),html=card.shadowRoot.innerHTML;
 assert.equal(card._view,'overview');
 assert.match(html,/XPENG <em>G6<\/em>/);
 assert.match(html,/62<span class="xp-unit">%<\/span>/);
 assert.match(html,/391 km/);
 assert.match(html,/12,548 km/);
 assert.match(html,/2.5 bar/);
 assert.match(html,/Ramat Gan, Israel/);
 assert.doesNotMatch(html,/Climate & comfort|Interior & seats|data-view="controls"|data-view="climate"|xt-nav-row/);
});

test('charging screen opens on charging, then returns to overview on stop',()=>{
 const states=data(),card=setup(states);
 states['binary_sensor.my_xpeng_is_charging'].state='on';
 card.hass={states};
 assert.equal(card._view,'charging');
 const html=card.shadowRoot.innerHTML;
 assert.match(html,/Charging now/);
 assert.match(html,/11.2 kW/);
 assert.match(html,/2h 15m/);
 assert.match(html,/90 %/);
 assert.doesNotMatch(html,/Climate & comfort|data-view="controls"|xt-nav-row/);
 states['binary_sensor.my_xpeng_is_charging'].state='off';
 card.hass={states};
 assert.equal(card._view,'overview');
});

test('missing and invalid measurements never show sample data',()=>{
 const card=setup({'binary_sensor.my_xpeng_is_charging':{state:'on'},'sensor.my_xpeng_soc':{state:'unavailable'}});
 const html=card.shadowRoot.innerHTML;
 assert.equal(card._view,'charging');
 assert.match(html,/class="xp-soc">—/);
 assert.doesNotMatch(html,/11.2 kW|391 km|62<span/);
});

test('entity override and safe HTML escaping',()=>{
 const states=data();
 states['sensor.my_xpeng_soc'].state='41';
 states['sensor.custom_soc']={state:'77'};
 states['device_tracker.my_xpeng_location'].state='<script>unsafe</script>';
 const card=setup(states);
 card.setConfig({prefix:'my_xpeng',entities:{soc:'sensor.custom_soc'},model:'G6'});
 card.hass={states};
 assert.match(card.shadowRoot.innerHTML,/77<span class="xp-unit">%<\/span>/);
 assert.match(card.shadowRoot.innerHTML,/&lt;script&gt;/);
 assert.doesNotMatch(card.shadowRoot.innerHTML,/<script>unsafe/);
});

test('editor exists; no vehicle-control API calls or old page renderers',()=>{
 assert.ok(tags.get('xpeng-vehicle-card-editor'));
 assert.doesNotMatch(source,/hass\.callService|vehicleMenuPanel\(|xpCabinSvg\(/);
 assert.match(source,/Dashboard v0\.1\.1/);
});

test('manual appearance in card editor always wins over integration profile entities',()=>{
 const states=data();
 states['sensor.my_xpeng_vehicle_model']={state:'G9'};
 states['sensor.my_xpeng_exterior_color']={state:'Kaitoke Green Matte'};
 states['sensor.my_xpeng_interior_color']={state:'Coffee'};
 const card=setup(states);
 assert.equal(card.appearance().model,'G6');
 assert.equal(card.appearance().color,'arctic_white');
 assert.equal(card.appearance().interior,'dark_gray');
 assert.match(card.asset(),/\/vehicles\/g6\/2026\/core_plus_rwd\/arctic_white\.webp$/);
 assert.doesNotMatch(card.shadowRoot.innerHTML,/Manual sensor mapping|Exterior paint|Interior cabin finish/);
});

test('when backend has no appearance entities, editor configuration is used',()=>{
  const card=setup(data());
  card.setConfig({prefix:'my_xpeng',year:'2026',model:'G6',color:'arctic_white',interior:'light_gray'});
  card.hass={states:data()};
  assert.equal(card.appearance().interior,'light_gray');
  assert.equal(card.appearance().color,'arctic_white');
});

test('official 2026 paints and cabin colours depend on model',()=>{
  const x=vm.runInNewContext('({xpAllowedPaints,xpAllowedInteriors,xpIsVerifiedPalette})',context);
  assert.equal(x.xpIsVerifiedPalette('G6','2026'),true);
  assert.equal(x.xpIsVerifiedPalette('G6','2024'),false);
  assert.equal(x.xpAllowedPaints('G6','2026','core_plus_rwd').some(v=>v.id==='kaitoke_green_matte'),false);
  assert.equal(x.xpAllowedPaints('G9','2026','unspecified').some(v=>v.id==='kaitoke_green_matte'),true);
  assert.equal(x.xpAllowedInteriors('G9','2026','unspecified').some(v=>v.id==='saddle'),true);
});

test('update time is behind an accessible info button, not static text',()=>{
  const card=setup(data());
  let html=card.shadowRoot.innerHTML;
  assert.match(html,/data-meta-toggle/);
  assert.doesNotMatch(html,/class="xp-updated"/);
  card.shadowRoot.handlers.click({target:{closest:()=>({hasAttribute:key=>key==='data-meta-toggle',dataset:{}})}});
  html=card.shadowRoot.innerHTML;
  assert.match(html,/Last vehicle update/);
  assert.match(html,/xp-cabin-mini/);
});

test('rendering missing exact art uses safe shape fallback, not previous-year imagery',()=>{
 const card=setup(data());
 assert.match(card.asset(),/\/vehicles\/g6\/2026\/core_plus_rwd\/arctic_white\.webp$/);
 assert.match(card.placeholderArt(),/^data:image\/svg\+xml;/);
 assert.doesNotMatch(card.asset(),/g6-studio\.webp/);
});

test('card editor offers model/year/paint/interior only in settings, alongside 15 mapping fields',()=>{
  const Editor=tags.get('xpeng-vehicle-card-editor');
  const editor=new Editor();
  editor.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',
    color:'arctic_white',interior:'light_gray'});
  editor.hass={states:{'sensor.custom_battery':{state:'93'},'binary_sensor.custom_charging':{state:'on'}}};
  const html=editor.shadowRoot.innerHTML;
  assert.match(html,/Manual sensor mapping/);
  assert.match(html,/data-key="year"/);
  assert.match(html,/data-key="model"/);
  assert.match(html,/data-key="trim"/);
  assert.match(html,/data-key="color"/);
  assert.match(html,/data-key="interior"/);
  assert.match(html,/data-entity="soc"/);
  assert.match(html,/data-entity="charging"/);
  assert.match(html,/sensor.custom_battery/);
  assert.match(html,/binary_sensor.custom_charging/);
});

test('manual sensor mapping persists as entities and overrides automatic prefix lookup',()=>{
  const Editor=tags.get('xpeng-vehicle-card-editor');
  const editor=new Editor();
  editor.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',color:'arctic_white'});
  const el={dataset:{entity:'soc'},value:'sensor.alternate_battery',hasAttribute:k=>k==='data-entity',
    setCustomValidity(){},reportValidity(){}};
  editor.shadowRoot.handlers.change({target:{closest:()=>el}});
  assert.equal(editor._cfg.entities.soc,'sensor.alternate_battery');
  const states=data();
  states['sensor.alternate_battery']={state:'81'};
  const card=setup(states);
  card.setConfig({...editor._cfg});
  card.hass={states};
  assert.match(card.shadowRoot.innerHTML,/81<span class="xp-unit">%<\/span>/);
  el.value='';
  editor.shadowRoot.handlers.change({target:{closest:()=>el}});
  assert.equal(editor._cfg.entities.soc,undefined);
});

test('card editor rejects invalid manual entity IDs',()=>{
  const Editor=tags.get('xpeng-vehicle-card-editor');
  const editor=new Editor();
  editor.setConfig({prefix:'my_xpeng',year:'2026',model:'G6'});
  let rejected=false;
  const el={dataset:{entity:'soc'},value:'sensor.BAD-ID',hasAttribute:k=>k==='data-entity',
    setCustomValidity:message=>{rejected=Boolean(message);},reportValidity(){}};
  editor.shadowRoot.handlers.change({target:{closest:()=>el}});
  assert.equal(rejected,true);
  assert.equal(editor._cfg.entities?.soc,undefined);
});

test('both dashboard views share one clean atmospheric backdrop without embedded telemetry',()=>{
  const card=setup(data());
  let html=card.shadowRoot.innerHTML;
  assert.match(html,/class="xp-night-photo"/);
  assert.match(html,/xpeng-reference-background\.webp/);
  assert.doesNotMatch(html,/<svg class="xp-sky"/);
  assert.equal((html.match(/xp-night-photo/g)||[]).length>=1,true);
  const state=data();
  state['binary_sensor.my_xpeng_is_charging'].state='on';
  card.hass={states:state};
  html=card.shadowRoot.innerHTML;
  assert.match(html,/class="xp-night-photo"/);
  assert.match(html,/xpeng-reference-background\.webp/);
  assert.match(html,/Charging now/);
  assert.doesNotMatch(html,/class="xp-ground"|class="xp-night-floor-glow"/);
});

test('the alpha-cutout G6 preview has no studio mask or visible artwork watermark',()=>{
 const c=setup(data());
 const html=c.shadowRoot.innerHTML;
 assert.doesNotMatch(html,/Illustrative vehicle art/);
 assert.doesNotMatch(html,/class="xp-car xp-studio-car"/);
 assert.match(c.asset(),/\/vehicles\/g6\/2026\/core_plus_rwd\/arctic_white\.webp$/);
 assert.match(html,/class="xp-night-photo"/);
});

test('header has no Home button or clock on either screen, while fullscreen remains',()=>{
 const states=data(),card=setup(states);
 assert.doesNotMatch(card.shadowRoot.innerHTML,/data-view="overview"|xp-clock|xp-head-separator/);
 assert.doesNotMatch(card.shadowRoot.innerHTML,/<button[^>]*\sdata-expand(?:\s|>)/);
 states['binary_sensor.my_xpeng_is_charging'].state='on';
 card.hass={states};
 assert.equal(card._view,'charging');
 assert.doesNotMatch(card.shadowRoot.innerHTML,/data-view="overview"|xp-clock|xp-head-separator/);
 assert.doesNotMatch(card.shadowRoot.innerHTML,/<button[^>]*\sdata-expand(?:\s|>)/);
});
test('charging view is strictly sensor-driven and unaffected by other entity changes',()=>{
 const states=data(),card=setup(states);
 for(const status of ['off','unavailable','unknown','idle','plugged_in','paused','disconnected']){
   states['binary_sensor.my_xpeng_is_charging'].state=status;
   card.hass={states};
   assert.equal(card._view,'overview',status);
 }
 for(const status of ['on','true','1','charging','in_progress','active']){
   states['binary_sensor.my_xpeng_is_charging'].state=status;
   card.hass={states};
   assert.equal(card._view,'charging',status);
 }
 states['binary_sensor.my_xpeng_is_charging'].state='off';
 states['sensor.my_xpeng_soc'].state='99';
 card.hass={states};
 assert.equal(card._view,'overview');
 assert.match(card.shadowRoot.innerHTML,/99<span class="xp-unit">%<\/span>/);
});
test('external integrations may map any HA entity domain or an attribute, with auto fallback',()=>{
 const states=data();
 states['select.third_party_status']={state:'idle',attributes:{charge_state:'charging'}};
 states['input_number.third_party_battery']={state:'79'};
 states['sensor.third_party_ev']={state:'active',attributes:{range_km:418,soc:67}};
 const card=setup(states);
 card.setConfig({model:'G6',year:'2026',prefix:'my_xpeng',
   entities:{charging:'select.third_party_status|charge_state',
             soc:'input_number.third_party_battery',
             range:'sensor.third_party_ev|range_km'}});
 card.hass={states};
 assert.equal(card._view,'charging');
 assert.equal(card.val('charging'),'charging');
 assert.equal(card.number('range'),418);
 assert.match(card.shadowRoot.innerHTML,/79<span class="xp-unit">%<\/span>/);
 assert.match(card.shadowRoot.innerHTML,/418 km/);
 states['select.third_party_status'].attributes.charge_state='paused';
 card.hass={states};
 assert.equal(card._view,'overview');
 card.setConfig({model:'G6',prefix:'my_xpeng',entities:{charging:'select.third_party_status|charge_state'}});
 card.hass={states};
 assert.equal(card.number('soc'),62,'unmapped battery falls back to automatic entity');
});
test('editor accepts other HA domains and attribute paths, invalid strings are rejected',()=>{
 const Editor=tags.get('xpeng-vehicle-card-editor');
 const editor=new Editor();
 editor.setConfig({prefix:'my_xpeng',year:'2026',model:'G6'});
 editor.hass={states:{'select.external_charge':{state:'charging'},'input_number.ev_soc':{state:'80'}}};
 assert.match(editor.shadowRoot.innerHTML,/select.external_charge/);
 assert.match(editor.shadowRoot.innerHTML,/input_number.ev_soc/);
 const field={dataset:{entity:'charging'},hasAttribute:key=>key==='data-entity',
   value:'select.external_charge|charge_state',setCustomValidity(){},reportValidity(){}};
 editor.shadowRoot.handlers.change({target:{closest:()=>field}});
 assert.equal(editor._cfg.entities.charging,'select.external_charge|charge_state');
 field.value='select.external_charge|__proto__';
 let bad=false;field.setCustomValidity=message=>{bad=Boolean(message)};
 editor.shadowRoot.handlers.change({target:{closest:()=>field}});
 assert.equal(bad,true);
 assert.equal(editor._cfg.entities.charging,'select.external_charge|charge_state');
});

test('overview and charging must render the exact same raster background and geometry',()=>{
 const states=data(),card=setup(states);
 const before=card.shadowRoot.innerHTML;
 const normalize=html=>{
    const match=html.match(/<div class="xp-night-photo"[^>]*><\/div>/);
    assert.ok(match,'missing single background element');
    return match[0];
 };
 const b1=normalize(before);
 assert.match(b1,/xpeng-reference-background\.webp/);
 assert.doesNotMatch(before,/<svg class="xp-sky"/);
 assert.equal((before.match(/<div class="xp-night-photo"/g)||[]).length,1);
 states['binary_sensor.my_xpeng_is_charging'].state='on';
 card.hass={states};
 const during=card.shadowRoot.innerHTML,b2=normalize(during);
 assert.equal(b1,b2,'background URL, position, and markup may not vary with charging');
 assert.equal((during.match(/<div class="xp-night-photo"/g)||[]).length,1);
 assert.doesNotMatch(during,/<svg class="xp-sky"/);
 states['binary_sensor.my_xpeng_is_charging'].state='off';
 card.hass={states};
 assert.equal(b1,normalize(card.shadowRoot.innerHTML));
});
