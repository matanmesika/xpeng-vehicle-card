'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'xpeng-vehicle-card.js'), 'utf8');
const dist = fs.readFileSync(path.join(__dirname, '..', 'dist', 'xpeng-vehicle-card.js'), 'utf8');
class FakeElement {
  attachShadow() { this.shadowRoot = {addEventListener() {}, innerHTML: ''}; return this.shadowRoot; }
  toggleAttribute() {}
}
function createCard(options = {}) {
  const sandbox = {HTMLElement: FakeElement,
    window: {customCards: [], confirm: () => true, location: {origin: 'http://localhost'}},
    customElements: {get() {return true}, define() {}},
    document: {documentElement: {}}, URL, console};
  const Card = vm.runInNewContext(src + '\nXpengVehicleCard;', sandbox);
  const card = new Card();
  card.setConfig({type: 'custom:xpeng-vehicle-card', model: 'G6', year: '2026',
    prefix: 'xpeng_g6', interior: 'light_gray', show_controls: true, ...options});
  card._xpengByKey = {
    'climate.cabin_climate': 'climate.renamed_hvac',
    'sensor.battery_soc': 'sensor.user_named_battery',
    'select.driver_seat_heat_select': 'select.driver_heater',
    'select.steering_wheel_heat_select': 'select.wheel_heat',
    'number.charge_limit_control': 'number.user_charge_limit',
    'button.open_charge_port': 'button.open_flap',
    'button.stop_charge': 'button.stop_vehicle_charging',
    'binary_sensor.charging': 'binary_sensor.is_charging',
    'binary_sensor.plugged_in': 'binary_sensor.cable_present'
  };
  const commands = [];
  card._hass = {
    states: {
      'sensor.user_named_battery': {state: '74', attributes: {}},
      'climate.renamed_hvac': {state: 'heat_cool', attributes: {temperature: 22, current_temperature: 24, min_temp: 16, max_temp: 32, target_temp_step: .5}},
      'select.driver_heater': {state: 'Heat 2', attributes: {options: ['Off','Heat 1','Heat 2','Heat 3']}},
      'select.wheel_heat': {state: 'Low', attributes: {options: ['Off','Low','Medium','High']}},
      'button.open_flap': {state: 'unknown', attributes: {}},
      'button.stop_vehicle_charging': {state: 'unknown', attributes: {}},
      'number.user_charge_limit': {state: '80', attributes: {min: 50, max: 100, step: 5}},
      'binary_sensor.is_charging': {state: 'on', attributes: {}},
      'binary_sensor.cable_present': {state: 'on', attributes: {}}
    },
    locale: {language: 'he'},
    callService: async (domain, service, data) => {commands.push({domain, service, data});}
  };
  return {card, commands};
}

test('source and HACS distribution remain identical', () => {assert.equal(src, dist);});
test('renamed entity IDs resolve from Xpengtk stable unique IDs', () => {
  const {card} = createCard();
  assert.equal(card.xpengEntity('sensor', 'battery_soc'), 'sensor.user_named_battery');
  assert.equal(card.xpengEntity('climate', 'cabin_climate'), 'climate.renamed_hvac');
});
test('interior artwork respects selected colour; original background unchanged', () => {
  const {card} = createCard();
  assert.match(card.xpCabinView(), /vehicles\/g6\/interior_light_gray\.webp/);
  const photo=card.artworkUrl('vehicles/g6/interior_light_gray.webp');
  card._failedArtwork.add(photo);
  assert.match(card.xpCabinView(), /xp-ux-cabin-missing/);
  assert.doesNotMatch(card.xpCabinView(), /\.svg|<svg|data-xp-cycle=/);
  card.setConfig({type: 'custom:xpeng-vehicle-card', prefix: 'xpeng_g6', model: 'G6', year: '2026', interior: 'black', show_controls: true});
  assert.match(card.xpCabinView(), /vehicles\/g6\/interior_dark_gray\.webp/);
  assert.match(src, /xp-night-photo/);
});
test('never hide unpressed HA button entities whose states are unknown', () => {
  const {card} = createCard();
  assert.ok(card.xpLive('button', 'open_charge_port'));
  assert.match(card.xpDock(), /data-xp-toggle="port"/);
  assert.match(card.xpChargeControls(), /stop_charge/);
  assert.match(card.xpChargeControls(), /charge_limit_control/);
});
test('charging view yields to confirmed cable disconnect even if state is stale', () => {
  const {card} = createCard();
  assert.equal(card.xpChargingActive(), true);
  card._hass.states['binary_sensor.cable_present'].state = 'off';
  assert.equal(card.xpChargingActive(), false);
});
test('seat and steering select levels use reported HA options', () => {
  const {card} = createCard();
  assert.match(card.xpSeatControls(), /Heat 2/);
  assert.match(card.xpSeatControls(), /Low/);
});
test('remote actions go through HA services with resolved IDs', async () => {
  const {card, commands} = createCard();
  await card.xpSend('button', 'press', 'open_charge_port');
  await card.xpSend('number', 'set_value', 'charge_limit_control', 85);
  assert.deepEqual(JSON.parse(JSON.stringify(commands)), [
    {domain: 'button', service: 'press', data: {entity_id: 'button.open_flap'}},
    {domain: 'number', service: 'set_value', data: {entity_id: 'number.user_charge_limit', value: 85}}
  ]);
});
test('controls are opt-in and have mobile breakpoints', () => {
  const {card} = createCard({show_controls: false});
  assert.equal(card.xpUiEnabled(), false);
  assert.equal(card.xpDock(), '');
  assert.match(src, /@media\(max-width:850px\)/);
  assert.match(src, /@media\(max-width:390px\)/);
});

test('G6 driver, passenger, rear left/right and wheel have separate hotspots', () => {
  const {card} = createCard();
  const svg = card.xpCabinView();
  assert.match(svg, /data-xp-zone="driver"/);
  card._xpengByKey['select.passenger_seat_heat_select'] = 'select.passenger_heat';
  card._xpengByKey['select.left_rear_seat_heat_select'] = 'select.rear_left_heat';
  card._xpengByKey['select.right_rear_seat_heat_select'] = 'select.rear_right_heat';
  for(const id of ['select.passenger_heat','select.rear_left_heat','select.rear_right_heat']){
    card._hass.states[id]={state:'Off',attributes:{options:['Off','Heat 1','Heat 2','Heat 3']}};
  }
  const five=card.xpCabinView();
  assert.match(five, /data-xp-zone="passenger"/);
  assert.match(five, /data-xp-zone="rear_left"/);
  assert.match(five, /data-xp-zone="rear_right"/);
  assert.match(svg, /data-xp-zone="wheel"/);
  assert.equal((five.match(/data-xp-zone=/g)||[]).length, 5);
});
test('safe vehicle controls require only approved HA entities', () => {
  const {card} = createCard();
  card._xpengByKey['lock.door_lock'] = 'lock.user_lock';
  card._xpengByKey['button.close_windows'] = 'button.close_all';
  card._hass.states['lock.user_lock'] = {state:'unlocked', attributes:{}};
  card._hass.states['button.close_all'] = {state:'unknown', attributes:{}};
  assert.match(card.xpVehiclePanel(), /data-xp-vehicle="lock.lock.door_lock"/);
  assert.match(card.xpVehiclePanel(), /data-xp-vehicle="button.press.close_windows"/);
  assert.doesNotMatch(card.xpVehiclePanel(), /data-xp-vehicle="lock.unlock/);
});

test('charge flap panel includes both separate commands and a cable-release disclaimer', () => {
  const {card} = createCard();
  card._xpengByKey['button.close_charge_port']='button.close_flap';
  card._hass.states['button.close_flap']={state:'unknown',attributes:{}};
  assert.match(card.xpPortPanel(), /data-xp-toggle="port"/);
  assert.match(card.xpPortPanel(), /data-xp-toggle="port"/);
  assert.match(card.xpPortPanel(), /לא לשחרור נעילת הכבל/);
  card._xpPanel='port';card.render();
  assert.match(card.shadowRoot.innerHTML, /data-xp-toggle="port"/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /data-xp-page="seats"/);
});
test('G6 photo mapping keeps other XPENG model artwork unchanged', () => {
  const {card}=createCard({model:'G9',year:'2026'});
  assert.doesNotMatch(card.xpCabinView(), /vehicles\/g6\/.+_photo/);
});
test('photo files must be committed before releasing this draft', {
  skip: ['interior_light_gray.webp','interior_dark_gray.webp'].some(name=>
    !fs.existsSync(path.join(__dirname,'..','assets','vehicles','g6',name)))
    ? 'BLOCKED: owner-reviewed cabin photo WebPs have not been uploaded; not ready to release'
    : false
}, () => {
  const root=path.join(__dirname,'..','assets','vehicles','g6');
  const required=['interior_light_gray.webp','interior_dark_gray.webp'];
  for(const name of required){
    assert.ok(fs.existsSync(path.join(root,name)),name+' is not yet in GitHub');
  }
});


test('home screen presents exactly four controls, with no separate seats or map dock item', () => {
  const {card}=createCard();
  for(const [key,domain,suffix,state] of [
    ['port','button','open_charge_port','button.open_flap'],
    ['climate','climate','cabin_climate','climate.renamed_hvac'],
    ['doors','lock','door_lock','lock.user_lock'],
    ['windows','button','open_windows','button.open_windows']]){
    card._xpengByKey[domain+'.'+suffix]=state;
    card._hass.states[state] ??= {state:domain==='button'?'unknown':'locked',attributes:{}};
  }
  const nav=card.xpDock();
  assert.equal((nav.match(/data-xp-(?:open|toggle)=/g)||[]).length,4);
  for(const key of ['port','doors','windows'])assert.match(nav,new RegExp('data-xp-toggle="'+key+'"'));
  assert.match(nav,/data-xp-open="climate"/);
  assert.doesNotMatch(nav,/data-xp-open="(?:map|seats)"/);
});
test('seat controls stay on cabin image and do not open a second sheet',()=>{
  const {card}=createCard();
  card._xpPanel='climate';
  const html=card.xpModal();
  assert.match(html,/xp-ux-climate-bottom/);
  assert.match(html,/data-xp-cycle="driver_seat_heat_select"/);
  assert.match(html,/data-xp-cycle="steering_wheel_heat_select"/);
  assert.doesNotMatch(html,/xp-ux-seat-sheet/);
  assert.doesNotMatch(html,/data-xp-page="seats"/);
});
test('opening doors and windows requires explicit owner opt-in plus upstream Access policy',()=>{
  const {card}=createCard();
  card._xpengByKey['lock.door_lock']='lock.user_lock';
  card._xpengByKey['button.open_windows']='button.user_windows';
  card._hass.states['lock.user_lock']={state:'locked',attributes:{}};
  card._hass.states['button.user_windows']={state:'unknown',attributes:{}};
  assert.match(card.xpDoorsPanel(),/data-xp-toggle="doors" disabled/);
  assert.match(card.xpWindowsPanel(),/data-xp-toggle="windows" disabled/);
  card.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year:'2026',prefix:'xpeng_g6',show_controls:true,enable_access_controls:true});
  assert.doesNotMatch(card.xpDoorsPanel(),/data-xp-toggle="doors" disabled/);
  assert.doesNotMatch(card.xpWindowsPanel(),/data-xp-toggle="windows" disabled/);
});
test('map contains only horn and flash buttons, each resolved through Xpengtk',async()=>{
  const {card,commands}=createCard();
  card._xpengByKey['button.honk_horn']='button.user_horn';
  card._xpengByKey['button.flash_lights']='button.user_flash';
  card._hass.states['button.user_horn']={state:'unknown',attributes:{}};
  card._hass.states['button.user_flash']={state:'unknown',attributes:{}};
  const map=card.xpMapPanel();
  assert.equal((map.match(/data-xp-map-action=/g)||[]).length,2);
  assert.match(map,/data-xp-map-action="honk_horn"/);
  assert.match(map,/data-xp-map-action="flash_lights"/);
  await card.xpSend('button','press','honk_horn');
  await card.xpSend('button','press','flash_lights');
  assert.deepEqual(JSON.parse(JSON.stringify(commands)),[
    {domain:'button',service:'press',data:{entity_id:'button.user_horn'}},
    {domain:'button',service:'press',data:{entity_id:'button.user_flash'}}
  ]);
});
test('charging never labels Stop charging as cable release',()=>{
  const {card}=createCard();
  const charge=card.xpChargeControls();
  assert.match(charge,/הפסק טעינה/);
  assert.doesNotMatch(charge,/שחרר.*כבל/);
  assert.equal((charge.match(/data-xp-command="stop_charge"/g)||[]).length,1);
});


test('seat cycles through actual HA heat levels then genuinely sends Off',async()=>{
  const {card,commands}=createCard();
  card._hass.states['select.driver_heater'].state='Off';
  for(let i=0;i<4;i++)await card.xpCycleSeat('driver_seat_heat_select');
  assert.deepEqual(JSON.parse(JSON.stringify(commands.map(c=>c.data.option))),
    ['Heat 1','Heat 2','Heat 3','Off']);
});
test('steering wheel cycles through Low Medium High then Off',async()=>{
  const {card,commands}=createCard();
  card._hass.states['select.wheel_heat'].state='Off';
  for(let i=0;i<4;i++)await card.xpCycleSeat('steering_wheel_heat_select');
  assert.deepEqual(JSON.parse(JSON.stringify(commands.map(c=>c.data.option))),
    ['Low','Medium','High','Off']);
});
test('ventilation cycles independently of seat heating',async()=>{
  const {card,commands}=createCard();
  card._xpengByKey['select.driver_seat_ventilation_select']='select.driver_vent';
  card._hass.states['select.driver_vent']={state:'Off',
    attributes:{options:['Off','Ventilation 1','Ventilation 2','Ventilation 3']}};
  for(let i=0;i<4;i++)await card.xpCycleSeat('driver_seat_ventilation_select');
  assert.deepEqual(JSON.parse(JSON.stringify(commands.map(c=>c.data.option))),
    ['Ventilation 1','Ventilation 2','Ventilation 3','Off']);
  assert.match(card.xpCabinView(),/data-xp-cycle="driver_seat_heat_select"/);
  assert.match(card.xpCabinView(),/data-xp-cycle="driver_seat_ventilation_select"/);
});
test('passenger heat Off is never sent when upstream does not support it',async()=>{
  const {card,commands}=createCard();
  card._xpengByKey['select.passenger_seat_heat_select']='select.passenger_heat';
  card._hass.states['select.passenger_heat']={state:'Off',attributes:{options:['Off','Heat 1','Heat 2','Heat 3']}};
  for(let i=0;i<4;i++)await card.xpCycleSeat('passenger_seat_heat_select');
  assert.deepEqual(JSON.parse(JSON.stringify(commands.map(c=>c.data.option))),
    ['Heat 1','Heat 2','Heat 3']);
  assert.match(card._xpNotice,/אינו נתמך/);
});
test('rapid repeated taps serialize native HA commands by entity',async()=>{
  const {card,commands}=createCard();
  card._hass.states['select.driver_heater'].state='Off';
  let done;
  const blocker=new Promise(resolve=>{done=resolve});
  let first=true;
  card._hass.callService=async (domain,service,data)=>{
    commands.push({domain,service,data});
    if(first){first=false;await blocker;}
  };
  const one=card.xpCycleSeat('driver_seat_heat_select');
  await Promise.resolve();
  const two=card.xpCycleSeat('driver_seat_heat_select');
  const three=card.xpCycleSeat('driver_seat_heat_select');
  assert.equal(commands.length,1);
  done();
  await Promise.all([one,two,three]);
  assert.deepEqual(JSON.parse(JSON.stringify(commands.map(c=>c.data.option))),
    ['Heat 1','Heat 3']);
});
test('unknown or missing HA select options never trigger an invented seat command',async()=>{
  const {card,commands}=createCard();
  card._hass.states['select.driver_heater'].state='unavailable';
  await card.xpCycleSeat('driver_seat_heat_select');
  assert.equal(commands.length,0);
});


test('extras menu has six categories and leaves home at exactly four actions',()=>{
  const {card}=createCard();
  card._xpPanel='extras';
  assert.match(card.header(),/data-xp-more/);
  assert.equal((card.xpExtrasPanel().match(/data-xp-extra-page=/g)||[]).length,6);
  assert.equal((card.xpDock().match(/data-xp-(?:open|toggle)=/g)||[]).length,4);
  for(const key of ['security','energy','schedule','power','maintenance','updates']){
    card._xpExtraSection=key;
    assert.match(card.xpModal(),/xp-extra-details/);
  }
});
test('extras menu disappears when optional controls are disabled',()=>{
  const {card}=createCard({show_controls:false});
  assert.doesNotMatch(card.header(),/data-xp-more/);
  card._xpPanel='extras';
  assert.equal(card.xpExtrasPanel().includes('data-xp-extra-page='),true);
  assert.equal(card.xpModal(),'');
});
test('X-Guard arming and sensitivity are driven by real XPENG entities',async()=>{
  const {card,commands}=createCard();
  card._xpengByKey['switch.sentinel_switch']='switch.guard';
  card._xpengByKey['number.sentinel_sensitivity_control']='number.guard_sensitivity';
  card._hass.states['switch.guard']={state:'off',attributes:{}};
  card._hass.states['number.guard_sensitivity']={state:'2',attributes:{min:1,max:3,step:1}};
  assert.match(card.xpExtraSectionContent('security'),/data-xp-extra-action="guard_on"/);
  assert.match(card.xpExtraSectionContent('security'),/data-xp-range="sentinel_sensitivity_control"/);
  await card.xpSend('switch','turn_on','sentinel_switch');
  await card.xpSend('number','set_value','sentinel_sensitivity_control',3);
  assert.deepEqual(JSON.parse(JSON.stringify(commands)),[
    {domain:'switch',service:'turn_on',data:{entity_id:'switch.guard'}},
    {domain:'number',service:'set_value',data:{entity_id:'number.guard_sensitivity',value:3}}
  ]);
  card._hass.states['switch.guard'].state='on';
  assert.match(card.xpExtraSectionContent('security'),/data-xp-extra-action="guard_off" disabled/);
});
test('V2L control uses supported switch and numeric timer only',async()=>{
  const {card,commands}=createCard();
  card._xpengByKey['switch.trunk_power_switch']='switch.v2l';
  card._xpengByKey['number.trunk_power_timer_control']='number.v2l_timer';
  card._hass.states['switch.v2l']={state:'off',attributes:{}};
  card._hass.states['number.v2l_timer']={state:'60',attributes:{min:0,max:1440,step:30}};
  assert.match(card.xpExtraSectionContent('power'),/data-xp-extra-action="v2l_on"/);
  assert.match(card.xpExtraSectionContent('power'),/data-xp-range="trunk_power_timer_control"/);
  await card.xpSend('switch','turn_on','trunk_power_switch');
  await card.xpSend('number','set_value','trunk_power_timer_control',90);
  assert.deepEqual(JSON.parse(JSON.stringify(commands)),[
    {domain:'switch',service:'turn_on',data:{entity_id:'switch.v2l'}},
    {domain:'number',service:'set_value',data:{entity_id:'number.v2l_timer',value:90}}
  ]);
});
test('schedule, maintenance, energy and OTA views never invent readings',()=>{
  const {card}=createCard();
  card._xpengByKey['sensor.hvac_schedules']='sensor.real_schedules';
  card._xpengByKey['sensor.maintenance']='sensor.real_maintenance';
  card._xpengByKey['sensor.parked_consumption']='sensor.real_parked';
  card._xpengByKey['sensor.ota_upgrade']='sensor.real_ota';
  card._hass.states['sensor.real_schedules']={state:'1',attributes:{schedules:[{start_time:'07:30',days:['Mon'] }]}};
  card._hass.states['sensor.real_maintenance']={state:'23 days',attributes:{km_remaining:3600}};
  card._hass.states['sensor.real_parked']={state:'1.2',attributes:{unit_of_measurement:'kWh'}};
  card._hass.states['sensor.real_ota']={state:'Up to date',attributes:{}};
  assert.match(card.xpExtraSectionContent('schedule'),/07:30/);
  assert.match(card.xpExtraSectionContent('maintenance'),/3600/);
  assert.match(card.xpExtraSectionContent('energy'),/1.2/);
  assert.match(card.xpExtraSectionContent('updates'),/Up to date/);
  card._hass.states['sensor.real_parked'].state='unavailable';
  assert.doesNotMatch(card.xpExtraSectionContent('energy'),/>1.2</);
});
test('without supported sensors extra pages contain no operative control',()=>{
  const {card}=createCard();
  for(const page of ['security','power','updates']){
    assert.doesNotMatch(card.xpExtraSectionContent(page),/data-xp-extra-action=/);
  }
});


test('climate image follows interior finish only in card settings',()=>{
  const {card}=createCard({interior:'light_gray'});
  card._xpPanel='climate';
  assert.match(card.xpCabinView(),/interior_light_gray\.webp/);
  assert.doesNotMatch(card.xpModal(),/data-key="interior"/);
  card.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year:'2026',prefix:'xpeng_g6',interior:'dark_gray',show_controls:true});
  assert.match(card.xpCabinView(),/interior_dark_gray\.webp/);
  assert.doesNotMatch(card.xpModal(),/data-key="interior"/);
});
test('screenshot functions wired only when upstream Xpengtk offers native entity',()=>{
  const {card}=createCard();
  card._xpengByKey['switch.defrost_switch']='switch.real_defrost';
  card._xpengByKey['calendar.hvac_schedule_calendar']='calendar.real_schedule';
  card._hass.states['switch.real_defrost']={state:'off',attributes:{}};
  card._hass.states['calendar.real_schedule']={state:'off',attributes:{}};
  const html=card.xpClimateFeatures();
  assert.equal((html.match(/class="xp-ux-climate-feature(?: |")/g)||[]).length,3);
  assert.match(html,/data-xp-climate="off"/);
  assert.match(html,/data-xp-switch="defrost_switch"/);
  assert.match(html,/data-xp-extra-page="schedule"/);
  for(const fake of ['pet_mode','sterilisation','ac_cleaning','rear_defrost','quick_heat','quick_cool'])
    assert.doesNotMatch(html,new RegExp('data-xp-[^=]+="'+fake+'"'));
  card._xpPanel='climate';
  assert.match(card.xpModal(),/xp-ux-climate-features/);
  assert.match(card.xpModal(),/data-xp-temp/);
});
test('front defroster shows live state and calls only native HA switch service',async()=>{
  const {card,commands}=createCard();
  card._xpengByKey['switch.defrost_switch']='switch.real_defrost';
  card._hass.states['switch.real_defrost']={state:'off',attributes:{}};
  assert.match(card.xpClimateFeatures(),/data-xp-switch="defrost_switch" aria-pressed="false"/);
  await card.xpSend('switch','toggle','defrost_switch');
  assert.deepEqual(JSON.parse(JSON.stringify(commands)),[
    {domain:'switch',service:'toggle',data:{entity_id:'switch.real_defrost'}}
  ]);
  card._hass.states['switch.real_defrost'].state='on';
  assert.match(card.xpClimateFeatures(),/data-xp-switch="defrost_switch" aria-pressed="true"/);
  card._hass.states['switch.real_defrost'].state='unavailable';
  assert.doesNotMatch(card.xpClimateFeatures(),/data-xp-switch="defrost_switch"/);
});
test('no rear defrost/pet/sterilisation control is faked without a supported Xpengtk entity',()=>{
  const {card}=createCard();
  const html=card.xpClimateFeatures();
  assert.doesNotMatch(html,/data-xp-pet/);
  assert.doesNotMatch(html,/data-xp-rear-defrost/);
  assert.doesNotMatch(html,/data-xp-sterilis/);
  assert.doesNotMatch(html,/data-xp-clean/);
  assert.doesNotMatch(html,/MAX/);
});


test('existing HVAC schedules use Xpengtk appointment-specific switches only',async()=>{
  const {card,commands}=createCard();
  card._xpengByKey['sensor.hvac_schedules']='sensor.schedules';
  card._xpengByKey['switch.hvac_schedule_12']='switch.workday';
  card._xpengByKey['switch.hvac_schedule_88']='switch.weekend';
  card._hass.states['sensor.schedules']={state:'2',attributes:{schedules:[
    {appointment_id:12,start_time:'07:30',days:['Mon'],is_valid:true},
    {appointment_id:88,start_time:'19:15',days:['Sun'],is_valid:false}
  ]}};
  card._hass.states['switch.workday']={state:'on',attributes:{}};
  card._hass.states['switch.weekend']={state:'off',attributes:{}};
  const html=card.xpExtraSectionContent('schedule');
  assert.match(html,/data-xp-hvac-schedule="12"/);
  assert.match(html,/data-xp-hvac-schedule="88"/);
  assert.match(html,/07:30/);
  assert.match(html,/19:15/);
  await card.xpSend('switch','turn_off','hvac_schedule_12');
  await card.xpSend('switch','turn_on','hvac_schedule_88');
  assert.deepEqual(JSON.parse(JSON.stringify(commands)),[
    {domain:'switch',service:'turn_off',data:{entity_id:'switch.workday'}},
    {domain:'switch',service:'turn_on',data:{entity_id:'switch.weekend'}}
  ]);
  card._hass.states['switch.weekend'].state='unavailable';
  assert.doesNotMatch(card.xpExtraSectionContent('schedule'),/data-xp-hvac-schedule="88"/);
});


test('missing XPENG target and cabin telemetry must not be rendered as zero degrees',async()=>{
  const {card,commands}=createCard();
  const climate=card._hass.states['climate.renamed_hvac'];
  climate.attributes.temperature=null;
  climate.attributes.current_temperature=undefined;
  const html=card.xpTempControl();
  assert.match(html,/<b>—<\/b>/);
  assert.match(html,/data-xp-temp="-1"[^>]*disabled/);
  assert.match(html,/data-xp-temp="1"[^>]*disabled/);
  card.xpDoTemperature(1);
  assert.equal(commands.length,0);
  climate.attributes.temperature=22;
  const restored=card.xpTempControl();
  assert.match(restored,/<b>22(?:\.0)?°C<\/b>/);
  assert.doesNotMatch(restored,/data-xp-temp="1"[^>]*disabled/);
  card.xpDoTemperature(1);
  assert.deepEqual(JSON.parse(JSON.stringify(commands)),[
    {domain:'climate',service:'set_temperature',data:{entity_id:'climate.renamed_hvac',temperature:22.5}}
  ]);
});

test('G6 home controls default visible but still allow explicit hiding',()=>{
 const {card}=createCard({show_controls:undefined});
 assert.equal(card.xpUiEnabled(),true);
 assert.equal((card.xpDock().match(/data-xp-(?:open|toggle)=/g)||[]).length,4);
 assert.equal(card.xpAccessAllowed(),false);
 card.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year:'2026',prefix:'xpeng_g6',show_controls:false});
 assert.equal(card.xpUiEnabled(),false);
});
test('G6 charging uses front asset and defers active actions to a modal',()=>{
 const {card}=createCard({show_controls:undefined});
 card._view='charging';
 assert.match(card.assetSpec().src,/\/g6\/2026\/[^/]+\/front\.webp$/);
 card.render();
 const h=card.shadowRoot.innerHTML;
 assert.match(h,/data-xp-open="charge_controls"/);
 assert.doesNotMatch(h,/class="xp-ux-charge-actions"/);
 assert.doesNotMatch(h,/class="xp-ux-dock /);
 assert.doesNotMatch(h,/class="xp-more-trigger"/);
 card._xpPanel='charge_controls';
 assert.match(card.xpModal(),/data-xp-command="stop_charge"/);
 assert.match(card.xpModal(),/data-xp-toggle="port"/);
});

test('all G6 generations use the same owner-photo slots',()=>{
 for(const year of ['2023','2024','2025','2026']){
   const {card}=createCard({model:'G6',year,interior:'light_gray'});
   assert.match(card.xpCabinView(),/vehicles\/g6\/interior_light_gray\.webp/);
   card.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year,interior:'dark_gray',show_controls:true});
   assert.match(card.xpCabinView(),/vehicles\/g6\/interior_dark_gray\.webp/);
 }
 const {card}=createCard({model:'G9',year:'2026'});
 assert.doesNotMatch(card.xpCabinView(),/vehicles\/g6\//);
});
test('missing G6 photo must never show old synthetic SVG',()=>{
 const {card}=createCard({model:'G6',year:'2026',interior:'light_gray'});
 card._failedArtwork.add(card.artworkUrl('vehicles/g6/interior_light_gray.webp'));
 const html=card.xpCabinView();
 assert.match(html,/xp-ux-cabin-missing/);
 assert.doesNotMatch(html,/\.svg|<svg|xp-ux-cabin-fallback/);
});
test('only verified same-vehicle integration colour overrides G6 editor choice',()=>{
 const {card}=createCard({model:'G6',year:'2026',interior:'light_gray'});
 assert.equal(card.xpCabinFinish(),'light_gray');
 card._hass.states['sensor.another_vehicle_colour']={state:'black',attributes:{}};
 assert.equal(card.xpCabinFinish(),'light_gray');
 card._xpengByKey['sensor.interior_color']='sensor.vehicle_colour';
 card._hass.states['sensor.vehicle_colour']={state:'black',attributes:{}};
 assert.equal(card.xpCabinFinish(),'dark_gray');
 assert.match(card.xpCabinView(),/interior_dark_gray\.webp/);
 card._hass.states['sensor.vehicle_colour'].state='unavailable';
 assert.equal(card.xpCabinFinish(),'light_gray');
});

test('one tap chooses an opposite action only from verified live state',async()=>{
 const {card,commands}=createCard({show_controls:true,enable_access_controls:true});
 const reg=card._xpengByKey;
 reg['lock.door_lock']='lock.user_lock';
 reg['binary_sensor.windows']='binary_sensor.user_windows';
 reg['sensor.slow_charge_port']='sensor.user_port';
 reg['button.close_windows']='button.user_close';
 reg['button.open_windows']='button.user_open';
 reg['button.open_charge_port']='button.user_flap_open';
 reg['button.close_charge_port']='button.user_flap_close';
 const st=card._hass.states;
 st['lock.user_lock']={state:'locked',attributes:{}};
 st['binary_sensor.user_windows']={state:'off',attributes:{}};
 st['sensor.user_port']={state:'Closed',attributes:{}};
 st['button.user_close']={state:'unknown',attributes:{}};
 st['button.user_open']={state:'unknown',attributes:{}};
 st['button.user_flap_open']={state:'unknown',attributes:{}};
 st['button.user_flap_close']={state:'unknown',attributes:{}};
 assert.equal(card.xpToggleTarget('doors').service,'unlock');
 assert.equal(card.xpToggleTarget('windows').suffix,'open_windows');
 assert.equal(card.xpToggleTarget('port').suffix,'open_charge_port');
 card.xpToggle('doors');card.xpToggle('windows');card.xpToggle('port');
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(JSON.parse(JSON.stringify(commands.slice(-3))),[
  {domain:'lock',service:'unlock',data:{entity_id:'lock.user_lock'}},
  {domain:'button',service:'press',data:{entity_id:'button.user_open'}},
  {domain:'button',service:'press',data:{entity_id:'button.user_flap_open'}}
 ]);
 st['lock.user_lock'].state='unlocked';
 st['binary_sensor.user_windows'].state='on';
 st['sensor.user_port'].state='Open';
 assert.equal(card.xpToggleTarget('doors').service,'lock');
 assert.equal(card.xpToggleTarget('windows').suffix,'close_windows');
 assert.equal(card.xpToggleTarget('port').suffix,'close_charge_port');
 st['sensor.user_port'].state='Connected';
 assert.equal(card.xpToggleTarget('port'),null);
 st['binary_sensor.user_windows'].state='unknown';
 assert.equal(card.xpToggleTarget('windows'),null);
 st['lock.user_lock'].state='unknown';
 assert.equal(card.xpToggleTarget('doors'),null);
 const n=commands.length;card.xpToggle('port');card.xpToggle('windows');card.xpToggle('doors');
 assert.equal(commands.length,n,'uncertain telemetry must never issue a vehicle command');
});
test('charge schedules are read-only, charge limit remains a real HA control',()=>{
 const {card}=createCard();
 card._xpengByKey['sensor.charge_schedule_start']='sensor.user_start';
 card._xpengByKey['sensor.charge_schedule_end']='sensor.user_end';
 card._hass.states['sensor.user_start']={state:'23:00',attributes:{}};
 card._hass.states['sensor.user_end']={state:'06:30',attributes:{}};
 assert.match(card.xpChargeSchedulesPanel(),/23:00/);
 assert.match(card.xpChargeSchedulesPanel(),/06:30/);
 assert.doesNotMatch(card.xpChargeSchedulesPanel(),/data-xp-(?:range|extra-action|command)/);
 assert.match(card.xpChargeControls(),/charge_limit_control/);
 card._view='charging';card.render();
 assert.match(card.shadowRoot.innerHTML,/data-xp-open="charge_schedule"/);
 assert.match(card.shadowRoot.innerHTML,/data-xp-open="charge_controls"/);
});
