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
  assert.match(card.xpCabinView(), /interiors\/g6\/2026\/light_gray_photo\.webp/);
  const photo=card.artworkUrl('interiors/g6/2026/light_gray_photo.webp');
  card._failedArtwork.add(photo);
  assert.match(card.xpCabinView(), /interiors\/g6\/2026\/light_gray\.svg/);
  assert.equal((card.xpCabinView().match(/data-xp-cycle=/g) || []).length, 2);
  card.setConfig({type: 'custom:xpeng-vehicle-card', prefix: 'xpeng_g6', model: 'G6', year: '2026', interior: 'black', show_controls: true});
  assert.match(card.xpCabinView(), /interiors\/g6\/2026\/dark_gray_photo\.webp/);
  const artRoot = path.join(__dirname, '..', 'assets', 'interiors', 'g6', '2026');
  const light = fs.readFileSync(path.join(artRoot, 'light_gray.svg'), 'utf8');
  const dark = fs.readFileSync(path.join(artRoot, 'dark_gray.svg'), 'utf8');
  assert.match(light, /viewBox="0 0 800 500"/);
  assert.match(dark, /viewBox="0 0 800 500"/);
  assert.notEqual(light, dark);
  assert.match(src, /xp-night-photo/);
});
test('never hide unpressed HA button entities whose states are unknown', () => {
  const {card} = createCard();
  assert.ok(card.xpLive('button', 'open_charge_port'));
  assert.match(card.xpDock(), /data-xp-open="port"/);
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
  assert.match(card.xpPortPanel(), /data-xp-port="open"/);
  assert.match(card.xpPortPanel(), /data-xp-port="close"/);
  assert.match(card.xpPortPanel(), /לא לשחרור נעילת הכבל/);
  card._xpPanel='port';card.render();
  assert.match(card.shadowRoot.innerHTML, /data-xp-port="close"/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /data-xp-page="seats"/);
});
test('G6 photo mapping keeps other XPENG model artwork unchanged', () => {
  const {card}=createCard({model:'G9',year:'2026'});
  assert.doesNotMatch(card.xpCabinView(), /interiors\/g6\/2026\/.+_photo/);
});
test('photo files must be committed before releasing this draft', () => {
  const root=path.join(__dirname,'..','assets','interiors','g6','2026');
  const required=['light_gray_photo.webp','dark_gray_photo.webp'];
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
  assert.equal((nav.match(/data-xp-open=/g)||[]).length,4);
  for(const key of ['port','climate','doors','windows'])assert.match(nav,new RegExp('data-xp-open="'+key+'"'));
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
  assert.match(card.xpDoorsPanel(),/data-xp-access="unlock" disabled/);
  assert.match(card.xpWindowsPanel(),/data-xp-access="open_windows" disabled/);
  card.setConfig({type:'custom:xpeng-vehicle-card',model:'G6',year:'2026',prefix:'xpeng_g6',show_controls:true,enable_access_controls:true});
  assert.doesNotMatch(card.xpDoorsPanel(),/data-xp-access="unlock" disabled/);
  assert.doesNotMatch(card.xpWindowsPanel(),/data-xp-access="open_windows" disabled/);
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
