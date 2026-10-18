'use strict';
/**
 * Xpengtk G6 Home Assistant simulator.
 * Synthetic entity states ONLY. No car credentials, network calls, or physical commands.
 * Suffixes match the frontend's Xpengtk and HA Entity Registry aliases.
 * Use simulate() for repeatable charging, lock, window, flap and GPS transitions.
 */
const value=(state,attributes={})=>({state:String(state),attributes});
function createG6Simulation({prefix='xpeng_a1b2c3',charging=false,modelYear=2025}={}){
 const entities={
  'binary_sensor.mqtt_connected':value('on'),
  'sensor.battery':value(76,{unit_of_measurement:'%'}),
  'sensor.range':value(420,{unit_of_measurement:'km'}),
  'sensor.odometer':value(15284,{unit_of_measurement:'km'}),
  'sensor.vehicle_identity':value('G6',{model_family:'G6',model_year:modelYear,identity_confidence:'confirmed',vin_masked:'L1N******'}),
  'device_tracker.location':value('not_home',{latitude:31.973,longitude:34.795,gps_accuracy:12,source_type:'gps'}),
  'binary_sensor.charging':value(charging?'on':'off'),
  'binary_sensor.plugged_in':value(charging?'on':'off'),
  'sensor.charge_power':value(charging?'76.5':'0',{unit_of_measurement:'kW'}),
  'sensor.charge_time_remaining':value(charging?'42':'0',{unit_of_measurement:'min'}),
  'sensor.charge_current':value(charging?'160':'0'),
  'sensor.charge_voltage':value(charging?'410':'0'),
  'number.charge_limit':value(90,{min:50,max:100,step:5}),
  'button.stop_charging':value('unknown'),
  'lock.door_lock':value('locked'),
  'binary_sensor.locked':value('off'),
  'binary_sensor.any_window_open':value('off'),
  'binary_sensor.driver_door':value('off'),
  'binary_sensor.passenger_door':value('off'),
  'binary_sensor.rear_left_door':value('off'),
  'binary_sensor.rear_right_door':value('off'),
  'binary_sensor.trunk':value('off'),
  'sensor.slow_charge_port':value(charging?'Connected':'Closed'),
  'button.open_windows':value('unknown'),
  'button.close_windows':value('unknown'),
  'button.open_charge_port':value('unknown'),
  'button.close_charge_port':value('unknown'),
  'button.open_trunk':value('unknown'),
  'button.close_trunk':value('unknown'),
  'button.honk_horn':value('unknown'),
  'button.flash_lights':value('unknown'),
  'climate.climate':value('heat_cool',{temperature:22,current_temperature:24,min_temp:16,max_temp:32,target_temp_step:.5,hvac_modes:['off','heat_cool','auto']}),
  'number.fan_speed':value(3,{min:1,max:8,step:1}),
  'binary_sensor.hvac_on':value('on'),
  'sensor.cabin_temperature':value(24),
  'sensor.outside_temperature':value(27),
  'select.driver_seat_heating':value('Heat 2',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.passenger_seat_heating':value('Heat 1',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.driver_seat_ventilation':value('Off',{options:['Off','Ventilation 1','Ventilation 2','Ventilation 3']}),
  'select.passenger_seat_ventilation':value('Off',{options:['Off','Ventilation 1','Ventilation 2','Ventilation 3']}),
  'select.left_rear_seat_heating':value('Off',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.right_rear_seat_heating':value('Off',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.steering_wheel_heating':value('Off',{options:['Off','Low','Medium','High']}),
  'sensor.tyre_pressure_front_left':value(250,{unit_of_measurement:'kPa'}),
  'sensor.tyre_pressure_front_right':value(252,{unit_of_measurement:'kPa'}),
  'sensor.tyre_pressure_rear_left':value(249,{unit_of_measurement:'kPa'}),
  'sensor.tyre_pressure_rear_right':value(251,{unit_of_measurement:'kPa'}),
  'sensor.last_data_update':value('2026-10-18T09:00:00+03:00'),
  'sensor.next_maintenance':value('2000 km',{km_remaining:2000}),
  'sensor.hvac_schedules':value(0,{schedules:[]}),
  'switch.x_guard':value('off'),
  'switch.trunk_power':value('off'),
  'switch.ota_auto_upgrade':value('off')
 };
 const states={};for(const [key,entry] of Object.entries(entities)){
  const dot=key.indexOf('.');
  states[key.slice(0,dot+1)+prefix+'_'+key.slice(dot+1)]=entry;
 }
 const commands=[];
 const hass={states,callService:async(domain,service,data)=>{commands.push({domain,service,data});}};
 function simulate(next){
  // These are synthetic incoming HA states. A command never changes the states
  // implicitly; confirmation can only arrive through an explicit simulated tick.
  const changes={};
  const put=(key,newState,attributes)=>{
   const id=key.slice(0,key.indexOf('.')+1)+prefix+'_'+key.slice(key.indexOf('.')+1);
   const prev=hass.states[id];if(!prev)throw Error('Unknown Xpengtk fixture: '+key);
   changes[id]=value(newState,attributes||prev.attributes);
  };
  if(next.locked!==undefined){put('lock.door_lock',next.locked?'locked':'unlocked');put('binary_sensor.locked',next.locked?'off':'on')}
  if(next.windowsOpen!==undefined)put('binary_sensor.any_window_open',next.windowsOpen?'on':'off');
  if(next.port!==undefined)put('sensor.slow_charge_port',next.port);
  if(next.charging!==undefined){
   put('binary_sensor.charging',next.charging?'on':'off');
   put('sensor.charge_power',next.charging?'76.5':'0');
  }
  if(next.plugged!==undefined)put('binary_sensor.plugged_in',next.plugged?'on':'off');
  if(next.battery!==undefined)put('sensor.battery',next.battery);
  if(next.range!==undefined)put('sensor.range',next.range);
  if(next.latitude!==undefined||next.longitude!==undefined){
   const id='device_tracker.'+prefix+'_location',previous=hass.states[id];
   put('device_tracker.location',previous.state,{
     ...previous.attributes,latitude:next.latitude??previous.attributes.latitude,
     longitude:next.longitude??previous.attributes.longitude});
  }
  hass.states={...hass.states,...changes};
  return hass;
 }
 return {hass,commands,simulate,prefix,entityCount:Object.keys(states).length};
}
module.exports={createG6Simulation};
