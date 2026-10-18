'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {createG6Simulation}=require('./fixtures/xpengtk-g6-simulator.cjs');
const cardSource=fs.readFileSync(path.join(__dirname,'../src/xpeng-vehicle-card.js'),'utf8');
class FakeElement{
 attachShadow(){this.shadowRoot={addEventListener(){},innerHTML:''};return this.shadowRoot}
 toggleAttribute(){}
}
function makeCard(){
 const sandbox={HTMLElement:FakeElement,document:{documentElement:{}},
  window:{customCards:[],confirm:()=>true,location:{origin:'http://localhost'}},
  customElements:{get(){return true},define(){}},URL,console};
 const Card=vm.runInNewContext(cardSource+'\nXpengVehicleCard;',sandbox);
 const card=new Card();
 card.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year:'2025',
  prefix:'my_xpeng',show_controls:true,enable_access_controls:true});
 return card;
}
test('simulator covers all relevant G6 Xpengtk categories with VIN-style automatic prefix',()=>{
 const sim=createG6Simulation();
 assert.ok(sim.entityCount>=48,'Insufficient simulated entity inventory: '+sim.entityCount);
 const card=makeCard();card.hass=sim.hass;
 assert.equal(card.xpAutoVehiclePrefix(),sim.prefix);
 assert.equal(card.xpengEntity('device_tracker','location'),'device_tracker.'+sim.prefix+'_location');
 assert.equal(card.xpActionState('doors'),'closed');
 assert.equal(card.xpActionState('windows'),'closed');
 assert.equal(card.xpActionState('port'),'closed');
 assert.equal(card.xpActionState('trunk'),'closed');
 assert.equal(card.xpChargingActive(),false);
 assert.equal(card.xpLive('sensor','vehicle_identity').state.attributes.model_year,2025);
 for(const key of ['tire_fl','tire_fr','tire_rl','tire_rr'])
   assert.ok(Number.isFinite(card.tirePressureBar(key)),'TPMS missing: '+key);
 for(const key of ['driver_seat_heat_select','passenger_seat_heat_select',
   'driver_seat_ventilation_select','passenger_seat_ventilation_select',
   'left_rear_seat_heat_select','right_rear_seat_heat_select','steering_wheel_heat_select'])
   assert.ok(card.xpLive('select',key),'HVAC simulator missing '+key);
});
test('G6 sensor simulator reproduces charge/plugged/port precedence and live GPS',()=>{
 const sim=createG6Simulation(),card=makeCard();card.hass=sim.hass;
 sim.simulate({charging:true,plugged:true,port:'Connected',battery:81,range:390});
 card.hass=sim.hass;
 assert.equal(card.xpChargingActive(),true);
 assert.equal(card.xpActionState('port'),null,'Connected cable must block charge flap close');
 assert.equal(card._view,'charging');
 sim.simulate({charging:true,plugged:false});
 card.hass=sim.hass;
 assert.equal(card.xpChargingActive(),false,'Confirmed unplugged wins over stale charging flag');
 assert.equal(card._view,'overview');
 sim.simulate({latitude:32.021,longitude:34.861});
 card.hass=sim.hass;
 const tracker=card.xpLive('device_tracker','location');
 assert.equal(tracker.state.attributes.latitude,32.021);
 assert.equal(tracker.state.attributes.longitude,34.861);
});
test('simulated entity refresh is read-only, command emits once, and lock jitter cannot flip UI',async()=>{
 const sim=createG6Simulation(),card=makeCard();card.hass=sim.hass;
 for(let i=0;i<100;i++){
   sim.simulate({battery:70+i%12,range:380+i});
   card.hass=sim.hass;
 }
 assert.equal(sim.commands.length,0,'100 telemetry events must not send any command to a car');
 card.xpToggle('doors');
 assert.equal(sim.commands.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(sim.commands[0])),{
  domain:'lock',service:'unlock',data:{entity_id:'lock.'+sim.prefix+'_door_lock'}
 });
 for(let i=0;i<30;i++){
   sim.simulate({locked:!!(i%2)});
   card.hass=sim.hass;card.xpToggle('doors');
 }
 assert.equal(sim.commands.length,1,'No repeated commands during alternating lock sensor reports');
 sim.simulate({locked:false});card.hass=sim.hass;
 const p=card._xpTogglePending.doors;
 assert.ok(p);
 p.at-=2000;
 assert.equal(card.xpPendingToggle('doors'),null);
 assert.equal(card.xpActionState('doors'),'open');
});
test('simulator can exercise G6 seat/wheel controls without Home Assistant network',async()=>{
 const sim=createG6Simulation(),card=makeCard();card.hass=sim.hass;
 await card.xpCycleSeat('steering_wheel_heat_select');
 assert.equal(sim.commands.at(-1).domain,'select');
 assert.equal(sim.commands.at(-1).service,'select_option');
 assert.equal(sim.commands.at(-1).data.option,'Low');
 assert.equal(sim.commands.at(-1).data.entity_id,'select.'+sim.prefix+'_steering_wheel_heating');
 assert.equal(card._xpSeatBusy.steering_wheel_heat_select,undefined);
});
