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
 assert.match(source,/Dashboard v0\.1\.0/);
});
