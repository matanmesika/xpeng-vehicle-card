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
  assert.match(card.xpCabinView(), /#d8d9d4/i);
  card.setConfig({type: 'custom:xpeng-vehicle-card', prefix: 'xpeng_g6', model: 'G6', year: '2026', interior: 'black', show_controls: true});
  assert.match(card.xpCabinView(), /#40454b/i);
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
  assert.deepEqual(commands, [
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
