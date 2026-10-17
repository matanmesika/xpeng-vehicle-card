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
  return {card, commands, sandbox};
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

test('charge flap panel has one state-driven action and clear cable disclaimer', () => {
  const {card} = createCard();
  card._xpengByKey['button.close_charge_port']='button.close_flap';
  card._hass.states['button.close_flap']={state:'unknown',attributes:{}};
  assert.match(card.xpPortPanel(), /data-xp-toggle="port"/);
  assert.match(card.xpPortPanel(), /data-xp-toggle="port"/);
  assert.match(card.xpPortPanel(), /אין שחרור כבל/);
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


test('home screen presents seven compact controls with auto charging mode', () => {
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
  assert.equal((nav.match(/data-xp-(?:open|toggle)=/g)||[]).length,7);
  for(const key of ['port','doors','windows'])assert.match(nav,new RegExp('data-xp-toggle="'+key+'"'));
  assert.match(nav,/data-xp-open="climate"/);
  for(const key of ['maintenance','map'])assert.match(nav,new RegExp('data-xp-open="'+key+'"'));
 assert.match(nav,/data-xp-toggle="trunk"/);
  assert.doesNotMatch(nav,/data-xp-open="seats"|data-xp-open="charging"/);
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
  card._xpengByKey['binary_sensor.windows']='binary_sensor.window_status';
  card._hass.states['binary_sensor.window_status']={state:'off',attributes:{}};
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


test('extras menu has six categories and home preserves seven actions',()=>{
  const {card}=createCard();
  assert.match(card.header(),/data-xp-more/);
  card._xpPanel='extras';
  assert.doesNotMatch(card.header(),/data-xp-more/,'subpages must expose only Back');
  assert.equal((card.xpExtrasPanel().match(/data-xp-extra-page=/g)||[]).length,6);
  assert.equal((card.xpDock().match(/data-xp-(?:open|toggle)=/g)||[]).length,7);
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
 assert.equal((card.xpDock().match(/data-xp-(?:open|toggle)=/g)||[]).length,7);
 assert.equal(card.xpAccessAllowed(),false);
 card.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year:'2026',prefix:'xpeng_g6',show_controls:false});
 assert.equal(card.xpUiEnabled(),false);
});
test('G6 charging preserves original panel layout with approved front-oriented car',()=>{
 const {card}=createCard({show_controls:undefined});
 card._view='charging';
 assert.match(card.assetSpec().src,/\/g6\/2026\/[^/]+\/front\.webp$/);
 card.render();
 const h=card.shadowRoot.innerHTML;
 assert.match(h,/data-xp-open="charge_controls"/);
 assert.match(h,/data-xp-open="charge_schedule"/);
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


test('HVAC fan control uses real Home Assistant limits rather than fixed visual bars',()=>{
 const {card}=createCard();
 card._xpengByKey['number.fan_speed_control']='number.preview_fan';
 card._hass.states['number.preview_fan']={state:'7',attributes:{min:1,max:8,step:1}};
 const eight=card.xpFanControl();
 assert.match(eight,/min="1"/);
 assert.match(eight,/max="8"/);
 assert.match(eight,/value="7"/);
 card._hass.states['number.preview_fan']={state:'9',attributes:{min:1,max:10,step:1}};
 const ten=card.xpFanControl();
 assert.match(ten,/max="10"/);
 assert.match(ten,/value="9"/);
 assert.match(ten,/step="1"/);
});
test('rear heating controls render on the cabin only when matching G6 integration entities are present',()=>{
 const {card}=createCard();
 const absent=card.xpCabinView();
 assert.doesNotMatch(absent,/data-xp-zone="rear_left"/);
 assert.doesNotMatch(absent,/data-xp-zone="rear_right"/);
 for(const [suffix,name] of [['left_rear_seat_heat_select','select.rear_left'],['right_rear_seat_heat_select','select.rear_right']]){
   card._xpengByKey['select.'+suffix]=name;
   card._hass.states[name]={state:'Heat 2',attributes:{options:['Off','Heat 1','Heat 2','Heat 3']}};
 }
 const both=card.xpCabinView();
 assert.match(both,/data-xp-zone="rear_left"/);
 assert.match(both,/data-xp-zone="rear_right"/);
 assert.match(both,/data-xp-cycle="left_rear_seat_heat_select"/);
 assert.match(both,/data-xp-cycle="right_rear_seat_heat_select"/);
 assert.doesNotMatch(both,/data-xp-cycle="left_rear_seat_ventilation_select"/);
});

test('one navigation bar on Home, single Back and no dock on all subpages',()=>{
 const {card}=createCard({enable_access_controls:true});
 card._hass.states['binary_sensor.is_charging'].state='off';
 const h=card.shadowRoot;
 card.render();
 assert.equal((h.innerHTML.match(/class="xp-ux-dock-action"/g)||[]).length,7);
 assert.doesNotMatch(h.innerHTML,/data-xp-home/);
 for(const page of ['climate','maintenance','map','port','windows','doors','trunk']){
   card._xpPanel=page;card.render();
   assert.match(h.innerHTML,new RegExp('xp-ux-modal-'+page));
   assert.match(h.innerHTML,/data-xp-close/);
   assert.doesNotMatch(h.innerHTML,/class="xp-ux-dock-action"/);
   assert.doesNotMatch(h.innerHTML,/data-xp-home/);
 }
 card._xpPanel=null;card._hass.states['binary_sensor.is_charging'].state='on';card.render();
 assert.match(h.innerHTML,/data-xp-home/);
 assert.doesNotMatch(h.innerHTML,/class="xp-ux-dock-action"/);
 card._xpPanel='charge_schedule';card.render();
 assert.match(h.innerHTML,/data-xp-close/);
 assert.doesNotMatch(h.innerHTML,/data-xp-home/);
 assert.doesNotMatch(h.innerHTML,/class="xp-ux-dock-action"/);
});
test('only sensor state triggers charging; confirmed charge renders green cable',()=>{
 const {card}=createCard();
 card._hass.states['binary_sensor.is_charging'].state='off';
 card.render();
 assert.doesNotMatch(card.xpDock(),/data-xp-open="charging"/);
 card._hass.states['binary_sensor.is_charging'].state='on';
 card._hass.states['binary_sensor.is_plugged_in'].state='off';
 card.render();
 assert.match(card.shadowRoot.innerHTML,/class="xp-charge-card"/);
 assert.match(card.shadowRoot.innerHTML,/xp-charge-cable-live/);
 card._hass.states['binary_sensor.is_charging'].state='off';card.render();
 assert.doesNotMatch(card.shadowRoot.innerHTML,/xp-charge-cable-live/);
});

test('one-tap controls alter visible action labels, icons, and avoid duplicate confirms',async()=>{
 const {card,commands,sandbox}=createCard({enable_access_controls:true});
 let confirmations=0;
 sandbox.window.confirm=()=>{confirmations++;return true};
 const e=card._xpengByKey;
 Object.assign(e,{'lock.door_lock':'lock.real','binary_sensor.windows':'binary_sensor.real_windows',
   'sensor.slow_charge_port':'sensor.real_port',
   'button.open_windows':'button.real_open_window','button.close_windows':'button.real_close_window',
   'button.open_charge_port':'button.real_open_port','button.close_charge_port':'button.real_close_port'});
 const st=card._hass.states;
 Object.assign(st,{'lock.real':{state:'locked',attributes:{}},
   'binary_sensor.real_windows':{state:'off',attributes:{}},
   'sensor.real_port':{state:'Closed',attributes:{}},
   'button.real_open_window':{state:'unknown',attributes:{}},
   'button.real_close_window':{state:'unknown',attributes:{}},
   'button.real_open_port':{state:'unknown',attributes:{}},
   'button.real_close_port':{state:'unknown',attributes:{}}});
 let nav=card.xpDock();
 assert.match(nav,/פתח נעילה/);
 assert.match(nav,/פתח חלונות/);
 assert.match(nav,/פתח שקע/);
 assert.match(nav,/data-xp-toggle="windows"/);
 assert.match(nav,/data-xp-toggle="port"/);
 assert.match(nav,/data-xp-toggle="doors"/);
 ['doors','windows','port'].forEach(action=>card.xpToggle(action));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(confirmations,0,'a verified single-tap toggle must not open an extra confirmation dialog');
 assert.equal(commands.length,3);
 st['lock.real'].state='unlocked';
 st['binary_sensor.real_windows'].state='on';
 st['sensor.real_port'].state='Open';
 nav=card.xpDock();
 assert.match(nav,/נעל/);
 assert.match(nav,/סגור חלונות/);
 assert.match(nav,/סגור שקע/);
 st['sensor.real_port'].state='Connected';
 assert.doesNotMatch(card.xpDock(),/data-xp-toggle="port"[^>]*>[^]*?<small>סגור שקע/);
 const c=commands.length;card.xpToggle('port');
 assert.equal(commands.length,c,'cannot close charge flap when cable is connected');
 // Stop charging is always separately confirmed; the bypass is not general.
 await card.xpSend('button','press','stop_charge');
 assert.equal(confirmations,1);
});
test('native AUTO and airflow buttons only render and execute when advertised by HA',async()=>{
 const {card,commands}=createCard();
 let html=card.xpClimateFeatures();
 assert.doesNotMatch(html,/data-xp-hvac-mode|data-xp-swing-mode/);
 card._hass.states['climate.renamed_hvac'].attributes.hvac_modes=['off','heat_cool','auto'];
 card._hass.states['climate.renamed_hvac'].attributes.swing_modes=['off','vertical'];
 card._hass.states['climate.renamed_hvac'].attributes.swing_mode='off';
 html=card.xpClimateFeatures();
 assert.match(html,/data-xp-hvac-mode="auto"/);
 assert.match(html,/data-xp-swing-mode="vertical"/);
 await card.xpSend('climate','set_hvac_mode','cabin_climate','auto');
 await card.xpSend('climate','set_swing_mode','cabin_climate','vertical');
 assert.deepEqual(JSON.parse(JSON.stringify(commands.slice(-2))),[
  {domain:'climate',service:'set_hvac_mode',data:{entity_id:'climate.renamed_hvac',hvac_mode:'auto'}},
  {domain:'climate',service:'set_swing_mode',data:{entity_id:'climate.renamed_hvac',swing_mode:'vertical'}}
 ]);
});
test('G6 editor preview uses only owner cabin photos, never the old schematic',()=>{
 const {card}=createCard({interior:'light_gray'});
 assert.ok(card.interiorPreview().includes('vehicles/g6/interior_light_gray.webp'));
 assert.doesNotMatch(card.interiorPreview(),/<svg/);
 card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'xpeng_g6',model:'G6',year:'2026',interior:'dark_gray'});
 assert.ok(card.interiorPreview().includes('vehicles/g6/interior_dark_gray.webp'));
});

test('tailgate cycles open and close in one verified tap; Access and unknown state block opening',async()=>{
 const {card,commands,sandbox}=createCard({enable_access_controls:true});
 let confirms=0;sandbox.window.confirm=()=>{confirms++;return true};
 Object.assign(card._xpengByKey,{
  'binary_sensor.trunk':'binary_sensor.real_trunk','button.open_trunk':'button.real_open_trunk',
  'button.close_trunk':'button.real_close_trunk'
 });
 const st=card._hass.states;
 st['binary_sensor.real_trunk']={state:'off',attributes:{}};
 st['button.real_open_trunk']={state:'unknown',attributes:{}};
 st['button.real_close_trunk']={state:'unknown',attributes:{}};
 assert.equal(card.xpToggleTarget('trunk').suffix,'open_trunk');
 assert.match(card.xpDock(),/פתח תא מטען/);
 assert.match(card.xpTrunkPanel(),/data-xp-toggle="trunk"/);
 card.xpToggle('trunk');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(commands.at(-1).data.entity_id,'button.real_open_trunk');
 assert.equal(confirms,0);
 st['binary_sensor.real_trunk'].state='on';
 assert.equal(card.xpToggleTarget('trunk').suffix,'close_trunk');
 assert.match(card.xpDock(),/סגור תא מטען/);
 card.xpToggle('trunk');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(commands.at(-1).data.entity_id,'button.real_close_trunk');
 st['binary_sensor.real_trunk'].state='unavailable';
 assert.equal(card.xpToggleTarget('trunk'),null);
 const n=commands.length;card.xpToggle('trunk');assert.equal(commands.length,n);
 st['binary_sensor.real_trunk'].state='off';
 card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'xpeng_g6',model:'G6',year:'2026',enable_access_controls:false});
 assert.equal(card.xpToggleTarget('trunk'),null);
 assert.match(card.xpDock(),/data-xp-toggle="trunk"[^>]+disabled/);
 st['binary_sensor.real_trunk'].state='on';
 assert.equal(card.xpToggleTarget('trunk').suffix,'close_trunk');
});
test('finder uses real horn and light commands, correct Hebrew, map and Back',()=>{
 const {card}=createCard();
 let html=card.xpMapPanel();
 assert.match(html,/data-xp-map-action="honk_horn" disabled/);
 assert.match(html,/data-xp-map-action="flash_lights" disabled/);
 assert.match(html,/צופר/);
 assert.match(html,/הבהוב/);
 card._xpengByKey['button.honk_horn']='button.real_horn';
 card._xpengByKey['button.flash_lights']='button.real_flash';
 card._hass.states['button.real_horn']={state:'unknown',attributes:{}};
 card._hass.states['button.real_flash']={state:'unknown',attributes:{}};
 html=card.xpMapPanel();
 assert.doesNotMatch(html,/data-xp-map-action="honk_horn" disabled/);
 assert.doesNotMatch(html,/data-xp-map-action="flash_lights" disabled/);
 card._xpPanel='map';card.render();
 assert.match(card.shadowRoot.innerHTML,/data-xp-close aria-label="חזרה לבית"/);
 assert.doesNotMatch(card.shadowRoot.innerHTML,/class="xp-ux-dock-action"/);
});
test('real Xpengtk AUTO status is read only; executable AUTO needs advertised climate mode',()=>{
 const {card}=createCard();
 card._xpengByKey['binary_sensor.climate_auto']='binary_sensor.real_auto';
 card._xpengByKey['binary_sensor.mirror_heating']='binary_sensor.real_mirror';
 card._hass.states['binary_sensor.real_auto']={state:'on',attributes:{}};
 card._hass.states['binary_sensor.real_mirror']={state:'off',attributes:{}};
 let html=card.xpClimateFeatures();
 assert.match(html,/xp-ux-climate-readonly/);
 assert.match(html,/AUTO/);
 assert.match(html,/חיווי בלבד/);
 assert.doesNotMatch(html,/data-xp-hvac-mode/);
 assert.doesNotMatch(html,/data-xp-swing-mode/);
 const attrs=card._hass.states['climate.renamed_hvac'].attributes;
 attrs.hvac_modes=['off','heat_cool','auto'];attrs.swing_modes=['off','vertical'];attrs.swing_mode='off';
 html=card.xpClimateFeatures();
 assert.match(html,/data-xp-hvac-mode="auto"/);
 assert.match(html,/data-xp-swing-mode="vertical"/);
});
test('charging remains original scene with exactly two visible action shortcuts',()=>{
 const {card}=createCard();
 const html=card.charging();
 assert.equal((html.match(/data-xp-open=/g)||[]).length,2);
 assert.match(html,/data-xp-open="charge_controls"/);
 assert.match(html,/data-xp-open="charge_schedule"/);
 assert.doesNotMatch(html,/data-xp-toggle="trunk"/);
});

test('Location requests HA native GPS map with dark mode and zoom 11, not a fabricated address',async()=>{
 const {card,sandbox}=createCard();
 let captured=null,attached=null;
 card._xpengByKey['device_tracker.location']='device_tracker.real_vehicle';
 card._hass.states['device_tracker.real_vehicle']={
   state:'not_home',attributes:{latitude:32.0,longitude:34.8,gps_accuracy:15}
 };
 card._xpPanel='map';
 const host={textContent:'טוען מפה…',replaceChildren(view){attached=view}};
 card.shadowRoot.querySelector=selector=>selector==='[data-xp-map-host]'?host:null;
 card.shadowRoot.contains=x=>x===host;
 sandbox.window.loadCardHelpers=async()=>({createCardElement(config){captured=config;return {hass:null}}});
 await card.xpMountMap();
 assert.deepEqual(JSON.parse(JSON.stringify(captured)),{
   type:'map',entities:[{entity:'device_tracker.real_vehicle'}],
   default_zoom:11,hours_to_show:0,dark_mode:true
 });
 assert.equal(attached.hass,card._hass);
 card._xpPanel=null;captured=null;
 await card.xpMountMap();
 assert.equal(captured,null);
});
test('G6 multilingual text and icon contract covers all new user-facing actions',()=>{
 const {card}=createCard({enable_access_controls:true});
 Object.assign(card._xpengByKey,{
   'binary_sensor.trunk':'binary_sensor.trunk_for_translation',
   'button.open_trunk':'button.open_trunk_translation',
   'button.close_trunk':'button.close_trunk_translation'
 });
 card._hass.states['binary_sensor.trunk_for_translation']={state:'off',attributes:{}};
 card._hass.states['button.open_trunk_translation']={state:'unknown',attributes:{}};
 card._hass.states['button.close_trunk_translation']={state:'unknown',attributes:{}};
 card._xpengByKey['binary_sensor.windows']='binary_sensor.window_for_translation';
 card._xpengByKey['button.open_windows']='button.open_windows_translation';
 card._hass.states['binary_sensor.window_for_translation']={state:'off',attributes:{}};
 card._hass.states['button.open_windows_translation']={state:'unknown',attributes:{}};
 for(const name of ['מיזוג','טעינה','תחזוקה','מיקום','חלונות','פתח תא מטען'])
   assert.ok(card.xpDock().includes(name),'Missing correct Hebrew action: '+name);
 assert.match(card.xpTrunkPanel(),/תא המטען/);
 assert.match(card.xpMapPanel(),/צופר/);
 assert.match(card.xpMapPanel(),/הבהוב/);
 assert.match(card.xpChargeSchedulesPanel(),/שעת התחלת טעינה/);
 assert.match(card.xpChargeSchedulesPanel(),/שעת סיום טעינה/);
 assert.match(card.charging(),/Charging information/);
 assert.match(card.charging(),/data-xp-open="charge_controls"/);
 assert.match(card.charging(),/data-xp-open="charge_schedule"/);
 assert.match(src,/auto:'<path/);
 assert.match(src,/horn:'<path/);
 assert.match(src,/flash:'<path/);
 assert.match(src,/windscreen:'<path/);
});

test('upstream Xpengtk unique IDs resolve without guessed windows/port names',()=>{
 const {card}=createCard({enable_access_controls:true}),st=card._hass.states;
 Object.assign(card._xpengByKey,{
  'binary_sensor.any_window_open':'binary_sensor.real_any_window_open',
  'binary_sensor.locked':'binary_sensor.real_locked',
  'sensor.slow_charge_port':'sensor.real_slow_charge_port',
  'binary_sensor.driver_door':'binary_sensor.real_driver_door',
  'binary_sensor.passenger_door':'binary_sensor.real_passenger_door'
 });
 Object.assign(st,{
  'binary_sensor.real_any_window_open':{state:'on',attributes:{}},
  'binary_sensor.real_locked':{state:'off',attributes:{}},
  'sensor.real_slow_charge_port':{state:'Open',attributes:{}},
  'binary_sensor.real_driver_door':{state:'on',attributes:{}},
  'binary_sensor.real_passenger_door':{state:'off',attributes:{}}
 });
 assert.equal(card.xpengEntity('binary_sensor','windows'),'binary_sensor.real_any_window_open');
 assert.equal(card.xpActionState('windows'),'open');
 assert.equal(card.xpActionState('port'),'open');
 assert.match(card.xpDoorsPanel(),/דלת נהג/);
 assert.match(card.xpDoorsPanel(),/דלת נוסע/);
 delete card._xpengByKey['lock.door_lock'];delete st['lock.user_lock'];
 assert.equal(card.xpActionState('doors'),'closed','Xpengtk locked binary ON means unlocked');
 st['sensor.real_slow_charge_port'].state='Connected';
 assert.equal(card.xpToggleTarget('port'),null,'connected cable blocks flap close');
 st['sensor.real_slow_charge_port'].state='unavailable';
 assert.equal(card.xpActionState('port'),null);
});
test('upstream Xpengtk prefixed HA entity IDs work without registry access',()=>{
 const {card}=createCard(),st=card._hass.states;
 card._xpengByKey={};
 st['binary_sensor.my_xpeng_any_window_open']={state:'off',attributes:{}};
 st['sensor.my_xpeng_slow_charge_port']={state:'Closed',attributes:{}};
 st['lock.my_xpeng_door_lock']={state:'locked',attributes:{}};
 assert.equal(card.xpActionState('windows'),'closed');
 assert.equal(card.xpActionState('port'),'closed');
 assert.equal(card.xpActionState('doors'),'closed');
 st['binary_sensor.my_xpeng_any_window_open'].state='unavailable';
 st['binary_sensor.my_xpeng_windows']={state:'on',attributes:{}};
 assert.equal(card.xpActionState('windows'),'open');
});
