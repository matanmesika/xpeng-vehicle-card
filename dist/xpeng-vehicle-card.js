/**
 * XPENG Dashboard v1.0.2 — two-screen vehicle status and charging dashboard (read-only).
 * Independent implementation. Uses no external vehicle-control APIs.
 * Reads only Home Assistant state. Does not send vehicle commands.
 */
const XP_INVALID = new Set(['unknown','unavailable','none','null','']);
const XP_KEYS = Object.freeze({
 model:['sensor','vehicle_model'],name:['sensor','vehicle_name'],powertrain:['sensor','vehicle_powertrain'],
 connection:['sensor','api_connection_status'],soc:['sensor','soc','battery'],range:['sensor','range_km','estimated_range'],
 charging:['binary_sensor','is_charging','charging'],plugged:['binary_sensor','is_plugged_in','plugged_in'],target:['sensor','charge_target','charging_target'],
 power:['sensor','charge_power_kw','charging_power'],energy:['sensor','charge_session_energy_kwh','charge_session_energy'],remaining:['sensor','charge_remaining_min','charge_remaining'],
 current:['sensor','charge_current_a','charge_current'],voltage:['sensor','charge_voltage_v','charge_voltage'],odometer:['sensor','odometer_km','odometer'],
 locked:['binary_sensor','is_locked','locked'],door_fl:['binary_sensor','door_front_left_open'],
 door_fr:['binary_sensor','door_front_right_open'],door_rl:['binary_sensor','door_rear_left_open'],
 door_rr:['binary_sensor','door_rear_right_open'],trunk:['binary_sensor','trunk_open'],hood:['binary_sensor','hood_open'],
 climate:['binary_sensor','climate_active'],cabin:['sensor','cabin_temperature_c','cabin_temperature'],outside:['sensor','outside_temperature_c','outside_temperature'],
 health:['sensor','battery_soh','battery_health'],battery_voltage:['sensor','battery_voltage'],
 battery_current:['sensor','battery_current'],battery_12v:['sensor','battery_12v_voltage_v','12v_supply_voltage'],
 tire_fl:['sensor','tire_pressure_front_left_kpa','front_left_tire_pressure'],tire_fr:['sensor','tire_pressure_front_right_kpa','front_right_tire_pressure'],
 tire_rl:['sensor','tire_pressure_rear_left_kpa','rear_left_tire_pressure'],tire_rr:['sensor','tire_pressure_rear_right_kpa','rear_right_tire_pressure'],
 fuel:['sensor','fuel_level_pct','fuel_level'],fuel_range:['sensor','fuel_range_km','fuel_powered_range'],combined:['sensor','total_range_km','combined_range'],
 last_update:['sensor','last_update','last_vehicle_update'],location:['device_tracker','location'],
 speed:['sensor','vehicle_speed_kmh','vehicle_speed']
});
/* Xpengtk (xpengtoolkit/xpengtoolkit) aliases.
 * Home Assistant creates entity IDs from translated names, not unique_id keys.
 * These aliases are additional automatic read-only sources. Never infer commands
 * from a matching name, and keep manual mappings authoritative.
 */
const XP_XPENGTK_KEYS = Object.freeze({
 connection:[['binary_sensor','mqtt_connected']],
 soc:[['sensor','battery']],
 range:[['sensor','range']],
 charging:[['binary_sensor','charging']],
 plugged:[['binary_sensor','plugged_in']],
 target:[['number','charge_limit'],['sensor','max_charge']],
 power:[['sensor','charge_power']],
 remaining:[['sensor','charge_time_remaining']],
 current:[['sensor','charge_current']],
 voltage:[['sensor','charge_voltage']],
 odometer:[['sensor','odometer']],
 tire_fl:[['sensor','tyre_pressure_front_left']],
 tire_fr:[['sensor','tyre_pressure_front_right']],
 tire_rl:[['sensor','tyre_pressure_rear_left']],
 tire_rr:[['sensor','tyre_pressure_rear_right']],
 last_update:[['sensor','last_data_timestamp'],['sensor','last_data_update']],
 cabin:[['sensor','cabin_temperature']],
 speed:[['sensor','speed']],
 location:[['device_tracker','location']]
});


function xpNextSeatOption(current,choices,suffix){
 if(!Array.isArray(choices)||!choices.includes('Off'))return null;
 const levels=suffix==='steering_wheel_heat_select'?['Low','Medium','High']
   :suffix.includes('ventilation')?['Ventilation 1','Ventilation 2','Ventilation 3']
   :['Heat 1','Heat 2','Heat 3'];
 const valid=levels.filter(o=>choices.includes(o));
 if(!valid.length)return null;
 if(current==='Off')return valid[0];
 const i=valid.indexOf(current);
 if(i<0)return null;
 return i===valid.length-1?'Off':valid[i+1];
}
function xpSeatLevel(option){
 if(option==='Off')return '0';
 return ({Low:'1',Medium:'2',High:'3'})[option]||/ [123]$/.exec(option||'')?.[0]?.trim()||'—';
}

const XP_UNIQUE_KEYS=Object.freeze({
 soc:[['sensor','battery_soc']],range:[['sensor','range']],odometer:[['sensor','odometer']],
 connection:[['binary_sensor','mqtt_connected']],charging:[['binary_sensor','charging']],
 plugged:[['binary_sensor','plugged_in']],target:[['number','charge_limit_control'],['sensor','max_charge']],
 power:[['sensor','charge_power']],remaining:[['sensor','charge_time_remaining']],
 current:[['sensor','charge_current']],voltage:[['sensor','charge_voltage']],
 tire_fl:[['sensor','tyre_pressure_fl']],tire_fr:[['sensor','tyre_pressure_fr']],
 tire_rl:[['sensor','tyre_pressure_rl']],tire_rr:[['sensor','tyre_pressure_rr']],
 last_update:[['sensor','last_data_update'],['sensor','last_update']],
 cabin:[['sensor','cabin_temperature']],speed:[['sensor','speed']],
 location:[['device_tracker','location']],locked:[['binary_sensor','locked']],
 climate:[['binary_sensor','hvac_on']],door_fl:[['binary_sensor','driver_door']],
 door_fr:[['binary_sensor','passenger_door']],door_rl:[['binary_sensor','rear_left_door']],
 door_rr:[['binary_sensor','rear_right_door']],trunk:[['binary_sensor','trunk']],
 hood:[['binary_sensor','bonnet']]
});
/* Resolves Xpengtk stable unique IDs from HA Entity Registry so user-renamed
 * entity IDs work automatically. Never mingle different XPENG devices.
 */
function xpVehicleRegistryRows(rows,prefix,deviceSelector){
 const own=Array.isArray(rows)?rows.filter(e=>e?.platform==='xpeng'
   && typeof e.unique_id==='string'&&e.unique_id.startsWith('xpeng_')
   && typeof e.entity_id==='string'&&/^[a-z_]+\.[a-z0-9_]+$/.test(e.entity_id)):[];
 const gps=own.filter(e=>e.unique_id.endsWith('_location')&&e.entity_id.startsWith('device_tracker.'));
 const matchingGps=gps.find(e=>e.entity_id.startsWith('device_tracker.'+prefix+'_'));
 const chosen=gps.find(e=>deviceSelector&&e.device_id===deviceSelector)
   ||matchingGps||(gps.length===1?gps[0]:null);
 if(!chosen)return {byKey:Object.create(null),entries:[],message:gps.length>1?'multiple_vehicles':'no_vehicle'};
 const marker=chosen.unique_id.slice(0,-'_location'.length)+'_';
 const sameVehicle=own.filter(e=>e.unique_id.startsWith(marker)&&e.device_id===chosen.device_id);
 const byKey=Object.create(null);
 for(const e of sameVehicle){
   const suffix=e.unique_id.slice(marker.length);
   byKey[e.entity_id.split('.')[0]+'.'+suffix]=e.entity_id;
 }
 return {byKey,entries:sameVehicle,message:null};
}

/* Local ID aliases only when HA Entity Registry is not readable. */
const XP_CONTROL_FALLBACKS=Object.freeze({
 'climate.cabin_climate':'climate',
 'number.charge_limit_control':'charge_limit','number.fan_speed_control':'fan_speed',
 'button.start_charge':'start_charging','button.stop_charge':'stop_charging',
 'select.driver_seat_heat_select':'driver_seat_heating',
 'select.passenger_seat_heat_select':'passenger_seat_heating',
 'select.driver_seat_ventilation_select':'driver_seat_ventilation',
 'select.passenger_seat_ventilation_select':'passenger_seat_ventilation',
 'select.left_rear_seat_heat_select':'left_rear_seat_heating',
 'select.right_rear_seat_heat_select':'right_rear_seat_heating',
 'select.left_rear_seat_ventilation_select':'left_rear_seat_ventilation',
 'select.right_rear_seat_ventilation_select':'right_rear_seat_ventilation',
 'select.steering_wheel_heat_select':'steering_wheel_heating',
 'sensor.slow_charge_port':'slow_charge_port',
 'binary_sensor.windows':'any_window_open',
 'switch.defrost_switch':'front_defrost',
 'switch.sentinel_switch':'x_guard',
 'number.sentinel_sensitivity_control':'sentinel_sensitivity',
 'switch.trunk_power_switch':'trunk_power',
 'number.trunk_power_timer_control':'trunk_power_timer',
 'switch.auto_upgrade_switch':'ota_auto_upgrade',
 'sensor.maintenance':'next_maintenance',
 'sensor.vehicle_identity':'vehicle_identity',
 'sensor.charge_schedule_start':'charge_schedule_start',
 'sensor.charge_schedule_end':'charge_schedule_end',
 'sensor.ota_upgrade':'ota_update',
 'calendar.hvac_schedule_calendar':'hvac_schedule'
});

const XP_ICONS = {
 home:'<path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3Z"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0V6a4 4 0 0 0-7-2"/>',
 car:'<path d="M4 16H2v-5l2-5h16l2 5v5h-2M4 16h16M4 16v3m16-3v3M2 11h20M7 6l-2 5m12-5 2 5"/><circle cx="6.5" cy="15" r=".8"/><circle cx="17.5" cy="15" r=".8"/>',
 windows:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 10h18"/><path d="m7 15 2-2 2 2"/>',
 windows_open:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 10h18"/><path d="m6.5 17 2-2 2 2m5-1 2-2 2 2"/>',
 trunk:'<path d="M3 8h18v11H3zM4 8l2-4h12l2 4M4 14h16M10 17h4"/><path d="M8 19v2m8-2v2"/>',
 trunk_open:'<path d="M3 12h18v7H3zM4 12l3-7h10l3 7M4 16h16M10 18h4"/><path d="m9 7 3-4 3 4"/>',
 horn:'<path d="M3 10h4l8-5v14l-8-5H3v-4Zm12-1c2 1 2 5 0 6m3-9c4 3 4 9 0 12"/><path d="M6 14l1 5h3"/>',
 flash:'<path d="M3 8c5-2 10-2 14 0v8c-4 2-9 2-14 0V8Zm17 1 2-2m-2 5h3m-3 3 2 2"/><path d="M7 10h6m-6 4h6"/>',
 auto:'<path d="M20 8a8 8 0 0 0-14-3L4 7V3M4 7h4M4 16a8 8 0 0 0 14 3l2-2v4m0-4h-4"/><path d="m9 15 3-7 3 7m-5-2h4"/>',
 windscreen:'<path d="m4 18 2-12h12l2 12H4Zm4-7 1-2m3 2 1-2m3 2 1-2M8 15l1-2m3 2 1-2m3 2 1-2"/>',
 port_open:'<rect x="4" y="7" width="16" height="13" rx="3"/><path d="m8 11 4-4 4 4m-4-4V2"/><path d="M8 17h8"/>',
 fan:'<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="7.8" rx="2.5" ry="3.5"/><ellipse cx="12" cy="7.8" rx="2.5" ry="3.5" transform="rotate(120 12 12)"/><ellipse cx="12" cy="7.8" rx="2.5" ry="3.5" transform="rotate(240 12 12)"/><circle cx="12" cy="12" r="1.5"/>',
 bolt:'<path d="M13 2 4 13h7l-1 9 10-12h-7l1-8Z"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>', back:'<path d="m15 5-7 7 7 7"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.5-2"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
 thermometer:'<path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z"/>',
 tire:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5m8 3h-5m-3 8v-5m-8-3h5"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v1"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 3"/>',
 battery:'<rect x="2" y="6" width="18" height="12" rx="2"/><path d="M22 10v4"/>',
 power:'<path d="M12 2v10m-5-8a9 9 0 1 0 10 0"/>',
 plug:'<path d="M8 2v6m8-6v6M5 8h14v5a7 7 0 0 1-14 0V8Zm7 12v2"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 carfront:'<path d="M5 17v3m14-3v3M3 13l3-8h12l3 8v4H3v-4Zm0 0h18m-14 2h1m8 0h1"/>',
 shield:'<path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6l-9-4Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
 gauge:'<path d="M4 18a9 9 0 1 1 16 0M12 16l4-7"/>'
};
function xpIcon(name,size=22){return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${XP_ICONS[name]||XP_ICONS.info}</svg>`;}
function xpEsc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function xpNum(v,dec=0){if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))return '—';return Number(v).toLocaleString('en-US',{maximumFractionDigits:dec});}
function xpConnText(v){
  const raw=String(v??'').trim().toLowerCase();
  if(!raw || ['not_configured','not_connected','unavailable','unknown','none','null','offline'].includes(raw))return 'Not connected';
  if(['connected','online','on','true','1'].includes(raw))return 'Connected';
  if(['off','false','0'].includes(raw))return 'Not connected';
  if(['error','connection_error','auth_error'].includes(raw))return 'Connection error';
  return String(v).replace(/_/g,' ');
}
function xpBool(v){
  const state=String(v??'').trim().toLowerCase();
  if(['on','true','1'].includes(state))return true;
  if(['off','false','0'].includes(state))return false;
  return null;
}
// Accept status sensors from other integrations without confusing 'plugged in' with charging.
function xpChargingActive(v){
  const state=String(v??'').trim().toLowerCase().replace(/[ -]+/g,'_');
  if(['on','true','1','charging','charging_now','charging_active','in_progress','active'].includes(state))return true;
  if(['off','false','0','idle','paused','ready','stopped','not_charging','disconnected','plugged_in','connected','complete','finished'].includes(state))return false;
  return null;
}
// Explicit mappings can read an entity state or one of its HA attributes.
// Examples: sensor.vehicle_soc  or  sensor.ev_status|charging_state.
function xpParseEntityMapping(value){
  const text=String(value??'').trim();
  const match=/^([a-z][a-z0-9_]*\.[a-z0-9_]+)(?:\|([A-Za-z_][A-Za-z0-9_]*))?$/.exec(text);
  if(!match)return null;
  if(match[2]&&['__proto__','prototype','constructor'].includes(match[2]))return null;
  return {id:match[1],attribute:match[2]||null};
}
function xpPercent(v){if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))return null;return Math.max(0,Math.min(100,Number(v)));}
const XP_CATALOG = Object.freeze({"models":[{"id":"G3","name":"G3","start":2018,"end":2021,"shape":"crossover","trim":"catalog"},{"id":"G3i","name":"G3i","start":2021,"end":2023,"shape":"crossover","trim":"catalog"},{"id":"P5","name":"P5","start":2021,"end":2024,"shape":"compact_sedan","trim":"catalog"},{"id":"P7","name":"P7 (Original)","start":2020,"end":2022,"shape":"fastback","trim":"catalog"},{"id":"P7i","name":"P7i","start":2023,"end":2025,"shape":"fastback","trim":"catalog"},{"id":"Next P7","name":"Next P7","start":2025,"end":2026,"shape":"fastback","trim":"catalog"},{"id":"P7+","name":"P7+","start":2024,"end":2026,"shape":"fastback","trim":"catalog"},{"id":"G6","name":"G6","start":2023,"end":2026,"shape":"g6","trim":"catalog"},{"id":"G7","name":"G7","start":2025,"end":2026,"shape":"crossover","trim":"catalog"},{"id":"G9","name":"G9","start":2022,"end":2026,"shape":"suv","trim":"catalog"},{"id":"G9L","name":"G9L","start":2026,"end":2026,"shape":"suv","trim":"catalog"},{"id":"X9","name":"X9","start":2024,"end":2026,"shape":"mpv","trim":"catalog"},{"id":"MONA M03","name":"MONA M03","start":2024,"end":2026,"shape":"compact_sedan","trim":"catalog"},{"id":"L03","name":"L03","start":2026,"end":2026,"shape":"fastback","trim":"catalog"},{"id":"GX","name":"GX","start":2026,"end":2026,"shape":"suv","trim":"catalog"}],"paints":[{"id":"arctic_white","label":"Arctic White","hex":"#F2F4F2"},{"id":"graphite_gray","label":"Graphite Gray","hex":"#66717B"},{"id":"midnight_black","label":"Midnight Black","hex":"#15191F"},{"id":"silver_frost","label":"Silver Frost","hex":"#BCC4C9"},{"id":"stellar_purple","label":"Stellar Purple","hex":"#867592"},{"id":"fiery_orange","label":"Fiery Orange","hex":"#C95D2A"},{"id":"kaitoke_green_matte","label":"Kaitoke Green Matte","hex":"#526F64"},{"id":"jet_black","label":"Jet Black","hex":"#111316"},{"id":"space_gray","label":"Space Gray","hex":"#727A82"},{"id":"lambent_cyan","label":"Lambent Cyan","hex":"#7BAFB2"},{"id":"polar_violet","label":"Polar Violet","hex":"#8D7F9D"},{"id":"matte_gray","label":"Matte Gray","hex":"#777B7E"},{"id":"phantom_purple","label":"Phantom Purple","hex":"#77637F"},{"id":"rock_gray","label":"Rock Gray","hex":"#6F7375"},{"id":"black_edition","label":"Black Edition","hex":"#0D1013"},{"id":"diamond_black","label":"Diamond Black","hex":"#111214"},{"id":"mirror_gray","label":"Mirror Gray","hex":"#8C9194"},{"id":"waving_green","label":"Waving Green","hex":"#667C70"},{"id":"everest_white","label":"Everest White","hex":"#F4F4F1"},{"id":"matte_desert_gold","label":"Matte Desert Gold","hex":"#B5A083"},{"id":"two_tone_gray_silver","label":"Two Tone Grey & Silver","hex":"#8A9298"},{"id":"coral_green","label":"Coral Green","hex":"#75A49C"},{"id":"red","label":"Red","hex":"#A72C35"},{"id":"green","label":"Green","hex":"#476B5C"},{"id":"nebula_white","label":"G7 Nebula White (2025/2026)","hex":"#F0F0EC"},{"id":"starday_gray","label":"G7 Star Day Gray (2025/2026)","hex":"#7B8390"},{"id":"crescent_silver","label":"G7 Crescent Silver (2025/2026)","hex":"#B6BDC4"},{"id":"night_black","label":"G7 Night Black (2025/2026)","hex":"#17191B"},{"id":"cloud_beige","label":"G7 Cloud Beige (2025)","hex":"#BEB4A1"},{"id":"interstellar_green","label":"G7 Interstellar Green (2025)","hex":"#596C63"},{"id":"twilight_purple","label":"G7 Twilight Purple (2026)","hex":"#827690"},{"id":"new_moon_silver","label":"New Moon Silver","hex":"#B3B8BC"},{"id":"rhythm_yellow","label":"Rhythm Yellow","hex":"#E3C449"},{"id":"stellar_green","label":"Stellar Green","hex":"#6A8072"},{"id":"dusk_purple","label":"Dusk Purple","hex":"#86778B"},{"id":"micro_star_gray","label":"Micro Star Gray","hex":"#777D83"},{"id":"starburst_blue","label":"Starburst Blue","hex":"#456B8D"},{"id":"star_red","label":"Star Red","hex":"#A73F40"},{"id":"matte_new_moon_silver","label":"Matte New Moon Silver","hex":"#A7AAAB"},{"id":"star_gray","label":"Star Gray","hex":"#82868A"},{"id":"starlight_beige","label":"Starlight Beige","hex":"#CCBFAA"},{"id":"star_blue","label":"Star Blue","hex":"#6792AC"},{"id":"roland_purple","label":"Roland Purple","hex":"#8C7A99"},{"id":"avocado_green","label":"Avocado Green","hex":"#95B39D"},{"id":"micro_moon_gray","label":"Micro Moon Gray","hex":"#909497"},{"id":"cherry_pink","label":"Cherry Pink","hex":"#E5A6B4"},{"id":"starry_dusk_purple","label":"Starry Dusk Purple","hex":"#806F91"}]});
const XP_MODELS = XP_CATALOG.models;
const XP_PAINTS = XP_CATALOG.paints;
const XP_INTERIORS = Object.freeze([{"id":"dark_gray","label":"Dark Gray","hex":"#40454b","secondary":"#252a30"},{"id":"light_gray","label":"Light Gray","hex":"#d8d9d4","secondary":"#aeb1b4"},{"id":"coffee","label":"Coffee","hex":"#93725b","secondary":"#574338"},{"id":"saddle","label":"Saddle","hex":"#aa704d","secondary":"#724934"},{"id":"meteorite_black","label":"Meteorite Black","hex":"#25272b","secondary":"#121417"},{"id":"tangerine","label":"Tangerine","hex":"#a96a46","secondary":"#6c432d"}]);
const XP_YEAR_GROUPS = Object.freeze({"G3":[{"id":"2018-2021","label":"2018-2021","years":[2018,2019,2020,2021],"trims":[{"id":"long_range","label":"Long Range"},{"id":"market_dependent","label":"Other / market-dependent"}],"colors":["arctic_white","graphite_gray","midnight_black"],"catalog_status":"historic_market_dependent","colors_by_year":{"2018":["arctic_white","graphite_gray","midnight_black"],"2019":["arctic_white","graphite_gray","midnight_black"],"2020":["arctic_white","graphite_gray","midnight_black"],"2021":["arctic_white","graphite_gray","midnight_black"]},"year_palette_sources":{"2018":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2019":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2020":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2021":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G3i":[{"id":"2021-2023","label":"2021-2023","years":[2021,2022,2023],"trims":[{"id":"long_range","label":"Long Range"},{"id":"market_dependent","label":"Other / market-dependent"}],"colors":["arctic_white","graphite_gray","midnight_black","coral_green"],"catalog_status":"historic_market_dependent","colors_by_year":{"2021":["arctic_white","graphite_gray","midnight_black","coral_green"],"2022":["arctic_white","graphite_gray","midnight_black","coral_green"],"2023":["arctic_white","graphite_gray","midnight_black","coral_green"]},"year_palette_sources":{"2021":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2022":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2023":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P5":[{"id":"2021-2024","label":"2021-2024","years":[2021,2022,2023,2024],"trims":[{"id":"standard","label":"Standard / market-dependent"},{"id":"max","label":"Max / market-dependent"}],"colors":["arctic_white","graphite_gray","midnight_black"],"catalog_status":"historic_market_dependent","colors_by_year":{"2021":["arctic_white","graphite_gray","midnight_black"],"2022":["arctic_white","graphite_gray","midnight_black"],"2023":["arctic_white","graphite_gray","midnight_black"],"2024":["arctic_white","graphite_gray","midnight_black"]},"year_palette_sources":{"2021":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2022":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2023":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2024":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P7":[{"id":"2020-2022","label":"2020-2022","years":[2020,2021,2022],"trims":[{"id":"rwd_super_long_range","label":"RWD Super Long Range"},{"id":"awd_high_performance","label":"4WD High Performance"},{"id":"wing_edition","label":"Wing Edition"}],"colors":["arctic_white","jet_black","space_gray","red","green"],"catalog_status":"official_global","colors_by_year":{"2020":["arctic_white","jet_black","space_gray","red","green"],"2021":["arctic_white","jet_black","space_gray","red","green"],"2022":["arctic_white","jet_black","space_gray","red","green"]},"year_palette_sources":{"2020":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2021":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2022":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P7i":[{"id":"2023-2025","label":"2023-2025","years":[2023,2024,2025],"trims":[{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"},{"id":"wing_edition","label":"Wing Edition / market-dependent"}],"colors":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte","starry_dusk_purple","star_blue"],"catalog_status":"official_global","colors_by_year":{"2023":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte"],"2024":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte","starry_dusk_purple","star_blue"],"2025":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte"]},"year_palette_sources":{"2023":{"confidence":"international_baseline","source":"https://www.xpeng.com/model/p7","notes":"International P7i colour names; market dependent."},"2024":{"confidence":"manufacturer_reported","source":"https://www.xiaopeng.com/news/company_news/5267.html","notes":"Starry Dusk Purple and Star Blue introduced in 2024 Wing Edition; trim selection remains display-only."},"2025":{"confidence":"baseline_unverified","source":"https://www.xpeng.com/model/p7","notes":"Baseline palette only; 2024 limited paints not asserted for 2025."}}}],"Next P7":[{"id":"2025","label":"2025","years":[2025],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue"],"catalog_status":"official_cn_launch","source_url":"https://www.xiaopeng.com/news/company_news/5489.html","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2025":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue"]},"year_palette_sources":{"2025":{"confidence":"inherited_group_market_specific","source":"https://www.xiaopeng.com/news/company_news/5489.html","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue","night_black","nebula_white","star_red","matte_new_moon_silver"],"catalog_status":"official_cn_configurator","source_url":"https://www.xiaopeng.com/p7n/configuration.html","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2026":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue","night_black","nebula_white","star_red","matte_new_moon_silver"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":"https://www.xiaopeng.com/p7n/configuration.html","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P7+":[{"id":"2024-2026","label":"2024-2026","years":[2024,2025,2026],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"],"catalog_status":"official_global","colors_by_year":{"2024":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"],"2025":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"],"2026":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"]},"year_palette_sources":{"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G6":[{"id":"2023-2025","label":"2023-2025","years":[2023,2024,2025],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"],"interiors":["dark_gray","light_gray"],"catalog_status":"official_global","colors_by_year":{"2023":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"],"2024":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"],"2025":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"]},"year_palette_sources":{"2023":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"core_rwd","label":"Core RWD"},{"id":"core_plus_rwd","label":"Core+ RWD"},{"id":"core_performance_awd","label":"Core Performance AWD"},{"id":"black_edition","label":"Black Edition"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple","black_edition"],"interiors":["dark_gray","light_gray"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple","black_edition"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G7":[{"id":"2025","label":"2025","years":[2025],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["starday_gray","crescent_silver","cloud_beige","interstellar_green","night_black","nebula_white"],"catalog_status":"official_cn","colors_by_year":{"2025":["starday_gray","crescent_silver","cloud_beige","interstellar_green","night_black","nebula_white"]},"year_palette_sources":{"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["twilight_purple","starday_gray","crescent_silver","night_black","nebula_white"],"catalog_status":"official_cn","colors_by_year":{"2026":["twilight_purple","starday_gray","crescent_silver","night_black","nebula_white"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G9":[{"id":"2022-2024","label":"2022-2024","years":[2022,2023,2024],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"],"catalog_status":"official_global","colors_by_year":{"2022":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"],"2023":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"],"2024":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"]},"year_palette_sources":{"2022":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2023":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2025-2026","label":"2025-2026","years":[2025,2026],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"},{"id":"black_edition","label":"Black Edition"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte","black_edition"],"interiors":["dark_gray","coffee","saddle","light_gray"],"catalog_status":"official_global","colors_by_year":{"2025":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte","black_edition"],"2026":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte","black_edition"]},"year_palette_sources":{"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G9L":[{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"awd_performance_ultra_6","label":"6-seater AWD Performance Ultra"},{"id":"rwd_long_range_ultra_7","label":"7-seater RWD Long Range Ultra"},{"id":"awd_performance_ultra_7","label":"7-seater AWD Performance Ultra"}],"colors":["arctic_white","diamond_black","mirror_gray","waving_green"],"interiors":["meteorite_black","tangerine"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","diamond_black","mirror_gray","waving_green"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"X9":[{"id":"2024-2025","label":"2024-2025","years":[2024,2025],"trims":[{"id":"fwd_long_range","label":"FWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","midnight_black","silver_frost","matte_gray"],"catalog_status":"official_global","colors_by_year":{"2024":["arctic_white","midnight_black","silver_frost","matte_gray"],"2025":["arctic_white","midnight_black","silver_frost","matte_gray"]},"year_palette_sources":{"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"fwd_standard_range","label":"FWD Standard Range"},{"id":"fwd_long_range","label":"FWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","midnight_black","silver_frost","matte_gray","lambent_cyan","polar_violet"],"interiors":["meteorite_black","coffee"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","midnight_black","silver_frost","matte_gray","lambent_cyan","polar_violet"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"MONA M03":[{"id":"2024-2025","label":"2024-2025","years":[2024,2025],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["night_black","nebula_white","star_gray","starlight_beige","star_blue"],"catalog_status":"official_cn_launch_baseline","source_url":"https://bbs.xiaopeng.com/article/2764153","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2024":["night_black","nebula_white","star_gray","starlight_beige","star_blue"],"2025":["night_black","nebula_white","star_gray","starlight_beige","star_blue"]},"year_palette_sources":{"2024":{"confidence":"inherited_group_market_specific","source":"https://bbs.xiaopeng.com/article/2764153","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":"https://bbs.xiaopeng.com/article/2764153","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["roland_purple","avocado_green","micro_moon_gray","night_black","nebula_white","starlight_beige","cherry_pink"],"catalog_status":"official_cn_configurator","source_url":"https://www.xiaopeng.com/m03_2026.html","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2026":["roland_purple","avocado_green","micro_moon_gray","night_black","nebula_white","starlight_beige","cherry_pink"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":"https://www.xiaopeng.com/m03_2026.html","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"L03":[{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"},{"id":"awd_performance_ultra","label":"AWD Performance Ultra"},{"id":"reev","label":"REEV / Range Extender"}],"colors":["arctic_white","midnight_black","silver_frost","rock_gray","phantom_purple","black_edition"],"interiors":["dark_gray","light_gray"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","midnight_black","silver_frost","rock_gray","phantom_purple","black_edition"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"GX":[{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"preorder","label":"Pre-order / market-dependent"}],"colors":["diamond_black","everest_white","matte_desert_gold","graphite_gray","two_tone_gray_silver"],"catalog_status":"official_regional","colors_by_year":{"2026":["diamond_black","everest_white","matte_desert_gold","graphite_gray","two_tone_gray_silver"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}]});
const XP_ALIASES={space_grey:'space_gray',space_gray:'space_gray',graphite_grey:'graphite_gray',jet_black:'jet_black',black:'dark_gray',dark:'dark_gray',light_grey:'light_gray',white:'light_gray'};
function xpAppearanceId(v,kind='color'){
 const k=String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
 if(kind==='interior'&&k==='black')return 'dark_gray';
 if(kind==='interior'&&k==='white')return 'light_gray';
 if(kind==='color'&&k==='black')return 'midnight_black';
 if(kind==='color'&&k==='white')return 'arctic_white';
 return XP_ALIASES[k]||k;
}
function xpModel(model){return XP_MODELS.find(m=>m.id===model)||XP_MODELS.find(m=>m.id==='G6');}
function xpAllowedModels(){return [...XP_MODELS].sort((a,b)=>Math.max(...xpAllowedYearGroups(b.id).flatMap(g=>g.years))-Math.max(...xpAllowedYearGroups(a.id).flatMap(g=>g.years))||a.name.localeCompare(b.name));}
function xpAllowedYearGroups(model){return XP_YEAR_GROUPS[String(model)]||[];}
function xpYearGroupFor(model,value){
 const groups=xpAllowedYearGroups(model);if(!groups.length)return null;
 const raw=String(value??'').trim();
 return groups.find(g=>g.id===raw)||groups.find(g=>g.years.includes(Number(raw)))||groups[groups.length-1];
}
function xpAllowedYears(model){
 const years=new Set(xpAllowedYearGroups(model).flatMap(g=>g.years));
 return [...years].sort((a,b)=>b-a).map(year=>({id:String(year),label:String(year)}));
}
function xpYearGroupChoices(model){
 return [...xpAllowedYearGroups(model)].sort((a,b)=>Math.max(...b.years)-Math.max(...a.years))
  .map(g=>({id:g.id,label:g.id.replace('-', '–')+(model==='G6'?(g.id==='2026'?' · Facelift':' · Original G6'):'')}));
}
function xpYearNeedsSpecificChoice(model,year){
 const g=xpYearGroupFor(model,year);
 return Boolean(g&&g.years.length>1&&new Set(g.years.map(y=>JSON.stringify(g.colors_by_year?.[String(y)]||g.colors))).size>1);
}
function xpYearsWithinGroup(model,year){
 const g=xpYearGroupFor(model,year);
 return g?[...g.years].sort((a,b)=>b-a).map(y=>({id:String(y),label:String(y)})):[];
}
function xpAllowedTrims(model,year){return xpYearGroupFor(model,year)?.trims||[{id:'market_dependent',label:'Variant / market-dependent'}];}
function xpAllowedPaints(model,year){
 const group=xpYearGroupFor(model,year),raw=String(year??'');
 const byYear=group?.colors_by_year;
 const ids=byYear&&Object.prototype.hasOwnProperty.call(byYear,raw)?byYear[raw]:byYear?group.colors.filter(id=>group.years.every(y=>byYear[String(y)]?.includes(id))):group?.colors||[];
 return ids.map(id=>XP_PAINTS.find(p=>p.id===id)).filter(Boolean);
}
function xpAllowedInteriors(model,year){
 const ids=xpYearGroupFor(model,year)?.interiors||['dark_gray','light_gray'];
 return ids.map(id=>XP_INTERIORS.find(p=>p.id===id)).filter(Boolean);
}
function xpIsVerifiedPalette(model,year){return Boolean(xpYearGroupFor(model,year)?.catalog_status?.startsWith('official'));}
function xpNormalizeAppearance(value){
 const v=value||{};
 const incoming=String(v.model??'G6').replace(/^XPENG\s+/i,'').trim();
 const mdl=XP_MODELS.some(m=>m.id===incoming)?incoming:'G6';
 const group=xpYearGroupFor(mdl,v.year)||xpAllowedYearGroups(mdl)[0];
 const rawYear=String(v.year??'');
 const availableYears=xpAllowedYears(mdl).map(x=>x.id);
  const yr=availableYears.includes(rawYear)||xpAllowedYearGroups(mdl).some(g=>g.id===rawYear)?rawYear:(availableYears[0]||'2026');
 const trims=xpAllowedTrims(mdl,yr),requestedTrim=String(v.trim??'');
 const trim=trims.some(x=>x.id===requestedTrim)?requestedTrim:(trims[0]?.id||'market_dependent');
 const paints=xpAllowedPaints(mdl,yr),requestedPaint=xpAppearanceId(v.color);
 const color=paints.some(x=>x.id===requestedPaint)?requestedPaint:(paints[0]?.id||'arctic_white');
 const interiors=xpAllowedInteriors(mdl,yr),requestedInterior=xpAppearanceId(v.interior,'interior');
 const interior=interiors.some(x=>x.id===requestedInterior)?requestedInterior:(interiors[0]?.id||'dark_gray');
 return {...v,year:yr,model:mdl,trim,color,interior};
}
function xpAssetModel(model){return String(model).toLowerCase().replace(/\s+/g,'_').replace(/\+/g,'_plus').replace(/[^a-z0-9_]/g,'');}
const XP_ARTWORK_INDEX = new Set(["vehicles/g6/2023-2025/arctic_white/charging.webp","vehicles/g6/2023-2025/arctic_white/front.webp","vehicles/g6/2023-2025/arctic_white/top.webp","vehicles/g6/2023-2025/fiery_orange/charging.webp","vehicles/g6/2023-2025/fiery_orange/front.webp","vehicles/g6/2023-2025/fiery_orange/top.webp","vehicles/g6/2023-2025/graphite_gray/charging.webp","vehicles/g6/2023-2025/graphite_gray/front.webp","vehicles/g6/2023-2025/graphite_gray/top.webp","vehicles/g6/2023-2025/midnight_black/charging.webp","vehicles/g6/2023-2025/midnight_black/front.webp","vehicles/g6/2023-2025/midnight_black/top.webp","vehicles/g6/2023-2025/silver_frost/charging.webp","vehicles/g6/2023-2025/silver_frost/front.webp","vehicles/g6/2023-2025/silver_frost/top.webp","vehicles/g6/2026/arctic_white/charging.webp","vehicles/g6/2026/arctic_white/front.webp","vehicles/g6/2026/arctic_white/top.webp","vehicles/g6/2026/graphite_gray/charging.webp","vehicles/g6/2026/graphite_gray/front.webp","vehicles/g6/2026/graphite_gray/top.webp","vehicles/g6/2026/midnight_black/charging.webp","vehicles/g6/2026/midnight_black/front.webp","vehicles/g6/2026/midnight_black/top.webp","vehicles/g6/2026/silver_frost/charging.webp","vehicles/g6/2026/silver_frost/front.webp","vehicles/g6/2026/silver_frost/top.webp","vehicles/g6/2026/stellar_purple/charging.webp","vehicles/g6/2026/stellar_purple/front.webp","vehicles/g6/2026/stellar_purple/top.webp","vehicles/g7/2025/cloud_beige/charging.webp","vehicles/g7/2025/cloud_beige/front.webp","vehicles/g7/2025/cloud_beige/top.webp","vehicles/g7/2025/crescent_silver/charging.webp","vehicles/g7/2025/crescent_silver/front.webp","vehicles/g7/2025/crescent_silver/top.webp","vehicles/g7/2025/interstellar_green/charging.webp","vehicles/g7/2025/interstellar_green/front.webp","vehicles/g7/2025/interstellar_green/top.webp","vehicles/g7/2025/nebula_white/charging.webp","vehicles/g7/2025/nebula_white/front.webp","vehicles/g7/2025/nebula_white/top.webp","vehicles/g7/2025/night_black/charging.webp","vehicles/g7/2025/night_black/front.webp","vehicles/g7/2025/night_black/top.webp","vehicles/g7/2025/starday_gray/charging.webp","vehicles/g7/2025/starday_gray/front.webp","vehicles/g7/2025/starday_gray/top.webp","vehicles/g9/2025-2026/arctic_white/charging.webp","vehicles/g9/2025-2026/arctic_white/front.webp","vehicles/g9/2025-2026/arctic_white/top.webp","vehicles/g9/2025-2026/graphite_gray/charging.webp","vehicles/g9/2025-2026/graphite_gray/front.webp","vehicles/g9/2025-2026/graphite_gray/top.webp","vehicles/g9/2025-2026/kaitoke_green_matte/charging.webp","vehicles/g9/2025-2026/kaitoke_green_matte/front.webp","vehicles/g9/2025-2026/kaitoke_green_matte/top.webp","vehicles/g9/2025-2026/midnight_black/charging.webp","vehicles/g9/2025-2026/midnight_black/front.webp","vehicles/g9/2025-2026/midnight_black/top.webp","vehicles/g9/2025-2026/silver_frost/charging.webp","vehicles/g9/2025-2026/silver_frost/front.webp","vehicles/g9/2025-2026/silver_frost/top.webp","vehicles/p7i/2023-2025/arctic_white/front.webp"]);
const XP_ILLUSTRATIVE_ARTWORK_INDEX = new Set(["vehicles/g6/2023-2025/arctic_white/charging.webp","vehicles/g6/2023-2025/arctic_white/front.webp","vehicles/g6/2023-2025/arctic_white/top.webp","vehicles/g6/2023-2025/fiery_orange/charging.webp","vehicles/g6/2023-2025/fiery_orange/front.webp","vehicles/g6/2023-2025/fiery_orange/top.webp","vehicles/g6/2023-2025/graphite_gray/charging.webp","vehicles/g6/2023-2025/graphite_gray/front.webp","vehicles/g6/2023-2025/graphite_gray/top.webp","vehicles/g6/2023-2025/midnight_black/charging.webp","vehicles/g6/2023-2025/midnight_black/front.webp","vehicles/g6/2023-2025/midnight_black/top.webp","vehicles/g6/2023-2025/silver_frost/charging.webp","vehicles/g6/2023-2025/silver_frost/front.webp","vehicles/g6/2023-2025/silver_frost/top.webp","vehicles/g7/2025/cloud_beige/charging.webp","vehicles/g7/2025/cloud_beige/front.webp","vehicles/g7/2025/cloud_beige/top.webp","vehicles/g7/2025/crescent_silver/charging.webp","vehicles/g7/2025/crescent_silver/front.webp","vehicles/g7/2025/crescent_silver/top.webp","vehicles/g7/2025/interstellar_green/charging.webp","vehicles/g7/2025/interstellar_green/front.webp","vehicles/g7/2025/interstellar_green/top.webp","vehicles/g7/2025/nebula_white/charging.webp","vehicles/g7/2025/nebula_white/front.webp","vehicles/g7/2025/nebula_white/top.webp","vehicles/g7/2025/night_black/charging.webp","vehicles/g7/2025/night_black/front.webp","vehicles/g7/2025/night_black/top.webp","vehicles/g7/2025/starday_gray/charging.webp","vehicles/g7/2025/starday_gray/front.webp","vehicles/g7/2025/starday_gray/top.webp","vehicles/g9/2025-2026/arctic_white/charging.webp","vehicles/g9/2025-2026/arctic_white/front.webp","vehicles/g9/2025-2026/arctic_white/top.webp","vehicles/g9/2025-2026/graphite_gray/charging.webp","vehicles/g9/2025-2026/graphite_gray/front.webp","vehicles/g9/2025-2026/graphite_gray/top.webp","vehicles/g9/2025-2026/kaitoke_green_matte/charging.webp","vehicles/g9/2025-2026/kaitoke_green_matte/front.webp","vehicles/g9/2025-2026/kaitoke_green_matte/top.webp","vehicles/g9/2025-2026/midnight_black/charging.webp","vehicles/g9/2025-2026/midnight_black/front.webp","vehicles/g9/2025-2026/midnight_black/top.webp","vehicles/g9/2025-2026/silver_frost/charging.webp","vehicles/g9/2025-2026/silver_frost/front.webp","vehicles/g9/2025-2026/silver_frost/top.webp","vehicles/p7i/2023-2025/arctic_white/front.webp"]);
function xpVehicleAssetPath(a,view){
 if(!['front','charging','top'].includes(view))return null;
 const group=xpYearGroupFor(a.model,a.year);
 return group?'vehicles/'+xpAssetModel(a.model)+'/'+group.id+'/'+a.color+'/'+view+'.webp':null;
}
const XP_SCENE_BACKGROUND = 'https://raw.githubusercontent.com/matanmesika/xpeng-vehicle-card/main/assets/xpeng-approved-lakeside-background.webp';
const XP_HACS_BASE='/hacsfiles/xpeng-vehicle-card/';
function xpPackagedUrl(relative){return 'https://raw.githubusercontent.com/matanmesika/xpeng-vehicle-card/main/assets/'+relative;}
function xpLocalArtworkPath(value){return typeof value==='string'&&/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_\-.]+$/.test(value);}
const XP_CSS = `
:host{display:block;color:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;--xp-mint:#00efbe;--xp-sky:#6aaaff}
*{box-sizing:border-box}
ha-card{display:block;width:100%;container-type:inline-size;container-name:xpeng-layout;background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important}
button{font:inherit;color:inherit;cursor:pointer}
button:focus-visible{outline:2px solid #81bbff;outline-offset:3px}
.xp-scene{position:relative;width:100%;min-height:620px;aspect-ratio:16/9;overflow:hidden;background:#020b16;isolation:isolate;direction:ltr}

.xp-night-photo{position:absolute;inset:0;z-index:0;pointer-events:none;background-color:#020d1b;background-size:cover;background-position:center center;background-repeat:no-repeat}
.xp-header{position:absolute;z-index:8;top:3.2%;left:4.5%;right:3%;display:flex;align-items:center;justify-content:space-between;gap:16px}
.xp-brand{display:flex;align-items:center;gap:14px;font-weight:600;letter-spacing:.31em;font-size:clamp(14px,1.4vw,23px);white-space:nowrap}
.xp-x-mark{font-size:26px;letter-spacing:-.13em;transform:scaleX(1.4)}
.xp-header-right{display:flex;align-items:center;gap:12px;min-width:0;font-size:clamp(12px,1.2vw,20px)}
.xp-wifi{display:grid;place-items:center;width:42px;height:42px;flex:none;padding:8px;border-radius:13px;border:1px solid #7399c077;background:#03172bba;color:#a8b3c4;transition:background .15s,border-color .15s}
.xp-wifi svg{display:block;flex:none}
.xp-wifi.xp-connected{color:#66a9ff;border-color:#4e96d699}
.xp-wifi.xp-error{color:#ffb16a;border-color:#d99b6388}
.xp-wifi:hover,.xp-wifi:focus-visible{background:#194465;border-color:#8bc1fa}

.xp-title{position:absolute;z-index:5;left:5.4%;top:17%;display:flex;flex-direction:column;gap:3px}
.xp-title h1{font-size:clamp(32px,3.7vw,62px);line-height:1.02;letter-spacing:.035em;font-weight:730;margin:0;white-space:nowrap}
.xp-title h1 em{font-style:normal;color:#7eaeff}
.xp-subtitle{font-size:clamp(15px,2vw,30px);color:#8192b6;font-weight:400}
.xp-car{position:absolute;z-index:3;width:57%;height:auto;max-height:73%;object-fit:contain;left:21%;bottom:16%;filter:drop-shadow(0 20px 20px #000b) brightness(1.6) contrast(1.00)}
.xp-car.xp-paint-silver_frost{filter:drop-shadow(0 20px 20px #000b) brightness(1.13)}
.xp-car.xp-paint-space_grey{filter:drop-shadow(0 20px 20px #000b) brightness(.78) hue-rotate(4deg)}
.xp-car.xp-paint-jet_black{filter:drop-shadow(0 20px 20px #000b) brightness(.45)}
.xp-car.xp-paint-stellar_purple{filter:drop-shadow(0 20px 20px #000b) brightness(.84) sepia(.13) hue-rotate(190deg)}
.xp-overview-stat{position:absolute;left:5.3%;top:42%;z-index:5;width:18%;max-width:290px;display:flex;flex-direction:column;gap:4px}
.xp-batt-line{display:flex;align-items:center;gap:18px}
.xp-batt-glyph{width:62px;height:90px;border:3px solid #cad7e7;border-radius:11px;position:relative;padding:7px;flex:none;display:flex;align-items:flex-end}
.xp-batt-glyph:before{content:"";position:absolute;width:22px;height:8px;border:3px solid #cad7e7;border-bottom:0;top:-10px;left:calc(50% - 11px);border-radius:4px 4px 0 0}
.xp-batt-fill{width:100%;background:linear-gradient(180deg,#7cefb1,#00ba84);border-radius:4px;min-height:0;box-shadow:0 0 12px #00e4a941}
.xp-stat-label{font-size:clamp(13px,1.3vw,21px);color:#b0c1dd}
.xp-soc{font-size:clamp(42px,5vw,76px);line-height:1.08;font-weight:730;white-space:nowrap}
.xp-unit{font-size:.55em}
.xp-progress{height:12px;background:#294767;border-radius:40px;overflow:hidden;width:100%;position:relative;box-shadow:inset 0 1px 3px #0007}
.xp-progress div{height:100%;background:linear-gradient(90deg,#00da91,#0ceec2);border-radius:40px;box-shadow:0 0 15px #00ffb85a}
.xp-overview-range{margin-top:28px}
.xp-range-num{display:flex;gap:12px;align-items:center;font-size:clamp(27px,3vw,49px);white-space:nowrap;font-weight:700;line-height:1.2;margin-top:8px}
.xp-range-num small{font-size:.54em}
.xp-status-panel{position:absolute;z-index:6;right:2.7%;bottom:11%;width:22%;min-width:264px;background:linear-gradient(125deg,#091a2bda,#051020eb);border:1px solid #6782a058;backdrop-filter:blur(17px);border-radius:24px;padding:0 17px}
.xp-info-row{display:flex;align-items:center;gap:16px;min-height:77px;border-bottom:1px solid #56708a43}
.xp-info-row:last-child{border-bottom:0}
.xp-info-icon{width:38px;flex:none;color:#f0f8ff}
.xp-info-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
.xp-info-copy small{font-size:clamp(10px,.99vw,15px);color:#c8d5e7}
.xp-info-copy b{font-size:clamp(12px,1.1vw,18px);font-weight:450;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xp-status-panel .xp-chevron{color:#dceeff;opacity:.75}
.xp-charge-card{position:absolute;z-index:6;left:2.8%;top:33.5%;width:40.8%;border:1px solid #2089ce88;border-radius:22px;background:linear-gradient(130deg,#041422e8,#06162acb);backdrop-filter:blur(14px);box-shadow:0 10px 55px #0007;padding:clamp(16px,2.4vw,36px) clamp(17px,2.7vw,43px)}
.xp-charge-heading{display:flex;align-items:center;gap:17px;color:var(--xp-mint);font-weight:630;font-size:clamp(17px,2.6vw,40px);margin:0 0 22px}
.xp-charge-heading svg{flex:none;width:clamp(26px,3.6vw,56px);height:clamp(26px,3.6vw,56px)}
.xp-charge-card .xp-progress{height:20px}
.xp-charge-main{display:flex;align-items:center;gap:18px;justify-content:space-between;margin-top:23px}
.xp-charge-main .xp-soc{font-size:clamp(40px,5.4vw,86px)}
.xp-charge-divider{height:65px;border-left:1px solid #56708a88}
.xp-charge-range{flex:1;min-width:0}
.xp-charge-range b{display:block;font-size:clamp(22px,2.1vw,36px);margin-top:8px;white-space:nowrap}
.xp-charge-meta{border-top:1px solid #4268878a;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:25px;padding-top:22px}
.xp-charge-meta>div{min-width:0;display:flex;flex-direction:column;gap:8px;padding:0 13px;border-right:1px solid #52719066}
.xp-charge-meta>div:first-child{padding-left:0}
.xp-charge-meta>div:last-child{padding-right:0;border-right:0}
.xp-charge-meta small{font-size:clamp(10px,1vw,16px);color:#9eb3d0;white-space:nowrap}
.xp-charge-meta b{font-size:clamp(12px,1.5vw,25px);font-weight:560;white-space:nowrap}
.xp-charge .xp-car{width:52%;left:41%;bottom:12%;height:auto;max-height:70%;z-index:7}
.xp-charge .xp-title{left:5.3%;top:17%}
.xp-station{position:absolute;z-index:2;right:3%;bottom:30%;width:5.3%;height:23%;min-width:45px;border:2px solid #55c8fb;border-radius:13px 13px 6px 6px;background:linear-gradient(90deg,#013861,#041b32 55%,#0b3150);box-shadow:0 0 18px #00c6ff85,inset 0 0 13px #08cafa74;display:grid;place-items:start center;padding-top:25px;font-size:26px;color:#e1f7ff}
.xp-station:before{content:"";position:absolute;bottom:-5px;width:110%;height:7px;background:#03d7cf;filter:blur(4px)}
:host([data-expanded]){position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483100!important;background:#020b15!important;overflow:auto!important}
:host([data-expanded]) ha-card,:host([data-expanded]) .xp-scene{width:100%!important;height:100dvh!important;min-height:550px!important;aspect-ratio:auto!important}
@media(max-width:850px){
.xp-scene{min-height:800px;aspect-ratio:auto}
.xp-header{top:16px;left:4%;right:4%}
.xp-brand{font-size:13px;letter-spacing:.12em}
.xp-header-right{gap:9px}
.xp-title{left:5%;top:89px}
.xp-title h1{font-size:34px}
.xp-subtitle{font-size:18px}
.xp-car{width:106%;left:-2%;bottom:29%;max-height:48%;object-fit:contain}
.xp-overview-stat{left:5%;top:220px;width:43%}
.xp-batt-glyph{height:56px;width:37px;border-width:2px;padding:4px}
.xp-batt-glyph:before{height:5px;top:-7px;border-width:2px}
.xp-batt-line{gap:9px}
.xp-soc{font-size:40px}
.xp-stat-label{font-size:13px}
.xp-progress{height:8px}
.xp-overview-range{margin-top:14px}
.xp-range-num{font-size:26px;margin-top:4px}
.xp-status-panel{width:90%;min-width:0;left:5%;right:5%;bottom:24px;border-radius:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:7px}
.xp-info-row{min-width:0;display:block;padding:7px 10px;border-bottom:0;border-right:1px solid #56708a43;min-height:88px}
.xp-info-row:last-child{border-right:0}
.xp-info-icon{display:none}
.xp-info-copy small{font-size:11px}
.xp-info-copy b{font-size:12px;white-space:normal;overflow-wrap:anywhere}
.xp-status-panel .xp-chevron{display:none}
.xp-charge .xp-title{left:5%;top:83px}
.xp-charge-card{top:225px;left:5%;width:90%;padding:18px}
.xp-charge-heading{font-size:22px;margin-bottom:15px}
.xp-charge-card .xp-progress{height:13px}
.xp-charge-main{margin-top:13px}
.xp-charge-main .xp-soc{font-size:42px}
.xp-charge-range b{font-size:20px}
.xp-charge-divider{height:45px}
.xp-charge-meta{margin-top:15px;padding-top:15px}
.xp-charge-meta small{font-size:10px;white-space:normal}
.xp-charge-meta b{font-size:14px}
.xp-charge .xp-car{width:96%;left:2%;bottom:9%;max-height:36%}
.xp-station{right:5%;bottom:22%;height:13%;min-width:40px;font-size:16px}
}
.xp-meta-tools{position:relative;z-index:25;flex:none;display:flex;align-items:center}
.xp-meta-popover{position:absolute;right:0;top:calc(100% + 9px);width:min(275px,82vw);border:1px solid #6580a388;border-radius:12px;background:#061829f3;padding:12px 14px;box-shadow:0 12px 35px #000b;backdrop-filter:blur(12px);display:flex;flex-direction:column;gap:9px}
.xp-meta-field{display:flex;align-items:center;justify-content:space-between;gap:12px}
.xp-meta-field+.xp-meta-field{padding-top:9px;border-top:1px solid #7399c044}
.xp-meta-popover small{font-size:11px;color:#b1c0d3}
.xp-meta-popover strong{font-size:13px;font-weight:600;color:#f0f7ff;text-align:right;white-space:nowrap}
.xp-cabin-mini{width:100%;height:auto;max-height:140px;margin-top:10px;display:block}
@media(max-width:850px){.xp-header-right{gap:8px}.xp-wifi{width:38px;height:38px;padding:7px}.xp-meta-popover{top:calc(100% + 8px)}}
.xp-car,.xp-car.xp-paint-silver_frost,.xp-car.xp-paint-space_grey,.xp-car.xp-paint-jet_black,.xp-car.xp-paint-stellar_purple{filter:drop-shadow(0 20px 20px #000b)}
.xp-studio-car{mask-image:none;-webkit-mask-image:none}

.xp-tire-screen{position:absolute;z-index:7;inset:26% 4% 4%;display:flex;flex-direction:column}
.xp-tire-actions{position:absolute;right:0;top:-76px;z-index:2;display:flex;justify-content:flex-end}
.xp-tire-actions button{display:flex;align-items:center;gap:8px;border:1px solid #6782a088;background:linear-gradient(125deg,#091a2bda,#051020eb);backdrop-filter:blur(17px);border-radius:13px;padding:11px 15px;color:#f2faff;white-space:nowrap}
.xp-tire-actions button:hover,.xp-tire-actions button:focus-visible{background:#194465}
.xp-tire-stage{width:min(900px,100%);flex:1;min-height:0;align-self:center;display:grid;grid-template-columns:minmax(92px,1fr) minmax(170px,43%) minmax(92px,1fr);grid-template-rows:1fr 1fr;gap:10px;align-items:center}
.xp-tire-center{grid-area:1/2/3/3;min-height:0;height:100%;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 16px 20px #0009)}
.xp-top-car,.xp-top-cutout{width:100%;max-width:325px;height:100%;max-height:100%;object-fit:contain}
.xp-tire-reading{background:linear-gradient(125deg,#091a2bda,#051020eb);border:1px solid #6782a058;backdrop-filter:blur(17px);border-radius:20px;padding:14px 9px;text-align:center;display:flex;flex-direction:column;gap:4px;min-width:0}
.xp-tire-reading small{color:#c8d5e7;font-size:clamp(10px,1.15vw,15px)}
.xp-tire-reading strong{font-size:clamp(24px,3vw,45px);color:#fff;line-height:1.1}
.xp-tire-reading span{color:#75f4c5;font-size:clamp(11px,1.2vw,17px)}
.xp-tire-reading[data-wheel="tire_fl"]{grid-area:1/1}.xp-tire-reading[data-wheel="tire_fr"]{grid-area:1/3}
.xp-tire-reading[data-wheel="tire_rl"]{grid-area:2/1}.xp-tire-reading[data-wheel="tire_rr"]{grid-area:2/3}
.xp-tire-disclaimer{text-align:center;font-size:10px;color:#b9c9d8;padding-bottom:5px}
@media(max-width:850px){.xp-tire-screen{inset:23% 3% 4%}.xp-tire-actions{top:-52px;right:3px}
.xp-tire-actions button{font-size:12px;padding:8px 10px}
.xp-tire-stage{grid-template-columns:minmax(80px,1fr) minmax(116px,40%) minmax(80px,1fr);gap:5px}
.xp-tire-reading{padding:12px 4px;border-radius:13px}.xp-tire-reading strong{font-size:24px}.xp-tire-reading small{font-size:11px}.xp-tire-reading span{font-size:12px}}
@media(max-width:400px){.xp-tire-stage{grid-template-columns:minmax(70px,1fr) minmax(107px,40%) minmax(70px,1fr)}.xp-tire-reading strong{font-size:21px}}

.xp-tire-row{width:100%;color:inherit;border:0;border-bottom:1px solid #56708a43;background:transparent;text-align:left;font:inherit}
.xp-tire-row:hover,.xp-tire-row:focus-visible{background:#2e54653b}
.xp-tire-row .xp-info-copy{align-items:flex-start}
@media(max-width:850px){.xp-tire-row{min-height:88px;padding:7px 10px;border:0;border-right:1px solid #56708a43}}

/* The approved 2026 white G6 cutout is already tightly cropped: frame its pixels to the reference shot. */
.xp-overview .xp-car.xp-reference-cutout{left:25.5%;bottom:26.6%;width:51.4%;max-height:none;filter:drop-shadow(0 13px 13px #0005)}
@media(max-width:850px){.xp-overview .xp-car.xp-reference-cutout{left:-3%;bottom:27%;width:108%;max-height:42%}}
@media(max-width:400px){.xp-charge-meta>div{padding:0 7px}.xp-charge-heading{font-size:19px}.xp-charge-meta b{font-size:12px}.xp-overview-stat{top:219px}.xp-status-panel{grid-template-columns:repeat(3,minmax(0,1fr))}}

/* Opt-in XPENG controls. Keep all existing hero and charging artwork unchanged. */
.xp-ux-dock{position:absolute;z-index:12;bottom:2.5%;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 12px;border:1px solid #6598b45c;border-radius:40px;background:#06162acb;backdrop-filter:blur(18px);max-width:96%}
.xp-ux-dock-action{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:60px;min-height:58px;border:1px solid #78a1b84b;background:#132b4587;border-radius:24px;color:#effbff}
.xp-ux-dock-action svg{color:#99caff}
.xp-ux-dock-action small{font-size:10px;white-space:nowrap}
.xp-ux-dock-action:hover,.xp-ux-dock-action:focus-visible{border-color:#1debca;background:#124965}
.xp-ux-modal{position:absolute;z-index:35;inset:2% 2.5%;padding:16px 20px 25px;overflow:auto;overscroll-behavior:contain;border:1px solid #5e91b078;border-radius:23px;background:linear-gradient(165deg,#060d19f8,#081e34fa);box-shadow:0 28px 75px #000d;backdrop-filter:blur(22px);direction:rtl}
.xp-ux-modal-head{display:flex;align-items:center;gap:15px}
.xp-ux-modal-head h2{margin:0;flex:1;font-size:clamp(18px,2.1vw,29px)}
.xp-ux-modal-head span{color:#b4c8df;font-size:13px}
.xp-ux-modal-head button{border:1px solid #60849d82;background:#12334d;border-radius:12px;padding:8px;display:grid;place-items:center;min-width:43px;min-height:43px}
.xp-ux-tabs{display:flex;gap:10px;margin:13px 0}
.xp-ux-tabs button{border:1px solid #557b9f88;border-radius:18px;padding:10px 19px;background:#1b2b42;color:#bdcee0}
.xp-ux-selected{background:#124c86!important;color:#fff!important;border-color:#54b9ff!important;box-shadow:0 0 0 1px #54b9ff3a inset}
.xp-ux-cabin{position:relative;margin:8px auto 12px;width:min(690px,100%);max-height:350px;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#06121e,#19304b);border:1px solid #6a81994f}
.xp-ux-cabin svg,.xp-ux-cabin-picture{display:block;width:100%;max-height:325px;object-fit:contain}
.xp-ux-cabin small{display:block;text-align:center;color:#b2c4d9;padding:4px;font-size:10px}
.xp-ux-cabin-disclaimer{position:absolute;bottom:0;left:0;right:0;background:#061625a0}
.xp-ux-hotspot{position:absolute;border:1px solid #88c5ff;color:#fff;background:#194879db;border-radius:50%;width:37px;height:37px;display:grid;place-items:center;box-shadow:0 0 17px #007ee95b}
.xp-ux-wheel{top:12%;left:21%}.xp-ux-driver{top:49%;left:25%}.xp-ux-passenger{top:49%;right:25%}.xp-ux-rear{bottom:8%;left:50%}
.xp-ux-climate-card,.xp-ux-range-row,.xp-ux-seat{border:1px solid #6787a165;border-radius:16px;background:#12253bca;padding:14px}
.xp-ux-climate-caption{display:flex;justify-content:space-between;gap:9px;align-items:center}
.xp-ux-climate-caption span{font-size:12px;color:#afc7e2}
.xp-ux-temp-line{display:flex;gap:18px;align-items:center;justify-content:center;margin:12px auto}
.xp-ux-temp-line b{font-size:clamp(29px,3vw,43px);min-width:115px;text-align:center}
.xp-ux-temp-line button{border:1px solid #668ab3;background:#1d344d;width:45px;height:45px;border-radius:50%;font-size:26px}
.xp-ux-pill-row{display:flex;flex-wrap:wrap;gap:10px}
.xp-ux-pill-row button,.xp-ux-nav-seats{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #5783a5;border-radius:14px;padding:10px 16px;background:#1b334c}
.xp-ux-range-row{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.xp-ux-range-row span{display:flex;justify-content:space-between;align-items:center;gap:10px}
.xp-ux-nav-seats{margin-top:10px;width:100%}
.xp-ux-modal input[type=range],.xp-ux-charge-limit input[type=range]{width:100%;accent-color:#19dec4;cursor:pointer}
.xp-ux-seats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.xp-ux-seat h3{margin:0 0 11px;font-size:16px}
.xp-ux-seat-line{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}
.xp-ux-seat-line>span{color:#bcd3e7;font-size:12px}
.xp-ux-seat-options{display:flex;gap:5px}
.xp-ux-seat-options button{min-width:35px;min-height:39px;border-radius:10px;border:1px solid #567491;background:#15263d;padding:5px 8px}
.xp-ux-seat-options button:disabled{opacity:.3;cursor:not-allowed}
.xp-ux-notice{margin:12px 0 0;border-radius:12px;background:#12374f;padding:9px;font-size:12px}
.xp-ux-charge-actions{position:absolute;z-index:12;bottom:3.2%;left:3%;right:3%;display:flex;justify-content:flex-start;gap:10px;align-items:center}
.xp-ux-charge-stop{border:1px solid #11ddc1;border-radius:14px;background:#033b3ebd;color:#9ff7eb;min-height:50px;padding:9px 16px;display:inline-flex;gap:9px;align-items:center;justify-content:center;white-space:nowrap}
.xp-ux-charge-limit{border:1px solid #6f9abb73;background:#081e37e3;border-radius:14px;min-height:50px;display:flex;flex:1;max-width:450px;min-width:150px;flex-direction:column;gap:3px;padding:7px 13px}
.xp-ux-charge-limit span{display:flex;justify-content:space-between;font-size:13px}
.xp-ux-charge-limit input{height:17px}
@media(max-width:850px){
 .xp-overview:has(.xp-ux-dock) .xp-status-panel{bottom:18px}
 .xp-overview .xp-ux-dock{bottom:133px;gap:5px;padding:5px 7px}
 .xp-ux-dock-action{min-width:49px;min-height:51px;border-radius:18px;gap:2px}
 .xp-ux-dock-action small{font-size:9px}
 .xp-ux-modal{inset:1.5% 2%;padding:13px}
 .xp-ux-cabin{max-height:290px}
 .xp-ux-cabin svg,.xp-ux-cabin-picture{max-height:285px}
 .xp-ux-seats-grid{grid-template-columns:1fr}
 .xp-ux-charge-actions{bottom:8%;left:4%;right:4%;gap:8px}
 .xp-ux-charge-stop{font-size:12px;padding:6px 10px}
 .xp-ux-charge-limit{min-width:0}
 .xp-charge.xp-has-controls .xp-car{bottom:21%;max-height:26%}
}
@media(max-width:390px){
 .xp-ux-dock{gap:3px}
 .xp-ux-dock-action{min-width:46px;min-height:48px}
 .xp-ux-dock-action small{font-size:8.5px}
 .xp-ux-charge-actions{flex-wrap:wrap;bottom:3%}
 .xp-ux-charge-stop,.xp-ux-charge-limit{flex:1 1 100%}
 .xp-charge.xp-has-controls .xp-car{bottom:29%;max-height:24%}
 .xp-ux-seat-line{align-items:flex-start;flex-direction:column}
}
@media(pointer:coarse){.xp-ux-seat-options button,.xp-ux-dock-action,.xp-ux-pill-row button{min-height:44px}}

/* Matching G6 cabin image hotspot alignment, consistent across both palettes. */
.xp-ux-cabin-art{aspect-ratio:8/5;max-height:none!important}
.xp-ux-cabin-art{aspect-ratio:8/5}
.xp-ux-cabin-art .xp-ux-cabin-picture{display:block;max-height:none!important;width:100%;height:100%;object-fit:contain}
.xp-ux-cabin-art .xp-ux-hotspot{z-index:2;transform:translate(-50%,-50%);width:38px;height:38px}
.xp-ux-cabin-art .xp-ux-wheel{left:27.25%;top:18%}
.xp-ux-cabin-art .xp-ux-driver{left:27%;top:53%}
.xp-ux-cabin-art .xp-ux-passenger{left:72%;top:53%}
.xp-ux-cabin-art .xp-ux-rear_left{left:27.5%;top:86%}
.xp-ux-cabin-art .xp-ux-rear_right{left:72.5%;top:86%}
.xp-ux-active-heat{background:#7b2534e9!important;border-color:#ff8b8b!important;box-shadow:0 0 14px #ff505085!important}
.xp-ux-active-vent{background:#064c89ed!important;border-color:#79cfff!important;box-shadow:0 0 14px #18acff85!important}
@media(max-width:600px){.xp-ux-cabin-art .xp-ux-hotspot{width:32px;height:32px;padding:5px}.xp-ux-cabin-art .xp-ux-cabin-disclaimer{font-size:9px}}
@media(pointer:coarse){.xp-ux-cabin-art .xp-ux-hotspot{min-width:44px;min-height:44px}}

/* Adaptive card-width layout for HA Sections, desktop and mobile browsers. */
@supports (container-type:inline-size){.xp-scene.xp-has-controls{container-name:xpeng-card;container-type:inline-size}}
@container xpeng-card (max-width:650px){
 .xp-ux-dock{bottom:127px;gap:5px;padding:5px 7px;max-width:94%}
 .xp-ux-dock-action{min-width:49px;min-height:50px;border-radius:18px;gap:2px}
 .xp-ux-dock-action small{font-size:9px}
 .xp-ux-modal{inset:1.5% 2%;padding:13px}
 .xp-ux-seats-grid,.xp-ux-vehicle-statuses,.xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}
 .xp-ux-seat-line{align-items:flex-start;flex-direction:column}
}
@container xpeng-card (max-width:430px){
 .xp-ux-dock{bottom:134px;gap:2px;padding:4px}
 .xp-ux-dock-action{min-width:44px;min-height:48px}
 .xp-ux-dock-action small{font-size:8px}
 .xp-ux-seats-grid{grid-template-columns:1fr}
 .xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}
 .xp-ux-charge-actions{bottom:8%;gap:6px}
 .xp-ux-charge-stop{padding:6px 9px;font-size:12px}
}
/* Native XPENG securing/lighting controls: no direct Access actions. */
.xp-ux-vehicle-panel{margin-top:10px}
.xp-ux-vehicle-panel h3{font-size:16px;margin:18px 0 10px}
.xp-ux-vehicle-statuses{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.xp-ux-vehicle-state{border:1px solid #517a977c;background:#11233a;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:7px;min-width:0}
.xp-ux-vehicle-state small{font-size:12px;color:#a4bcce}
.xp-ux-vehicle-state strong{font-size:14px;overflow-wrap:anywhere}
.xp-ux-vehicle-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.xp-ux-vehicle-buttons button{display:flex;align-items:center;justify-content:center;gap:9px;padding:15px 10px;min-height:56px;border:1px solid #4a92ba92;border-radius:14px;background:#103149a8}
.xp-ux-vehicle-buttons button:hover{background:#12546e}
.xp-ux-note{color:#a9bac8;font-size:12px;line-height:1.6;margin-top:22px}
@media(max-width:600px){.xp-ux-vehicle-statuses,.xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}.xp-ux-vehicle-buttons button{min-height:50px;padding:9px 7px;font-size:12px}}

/* New G6 photo: portrait cabin top view; hotspots line up with the actual seats. */
.xp-ux-cabin-art.xp-ux-cabin-portrait{aspect-ratio:480/853;width:min(420px,100%);max-height:none!important;margin:10px auto 18px;overflow:hidden}
.xp-ux-cabin-portrait .xp-ux-cabin-picture{display:block;width:100%;height:auto;max-height:none!important;object-fit:contain}
.xp-ux-cabin-portrait .xp-ux-wheel{left:27%;top:21%}
.xp-ux-cabin-portrait .xp-ux-driver{left:28%;top:41%}
.xp-ux-cabin-portrait .xp-ux-passenger{left:72%;top:41%}
.xp-ux-cabin-portrait .xp-ux-rear_left{left:28%;top:77%}
.xp-ux-cabin-portrait .xp-ux-rear_right{left:72%;top:77%}
.xp-ux-port-panel{padding:12px;max-width:590px;margin:auto}
.xp-ux-port-state{display:flex;align-items:center;gap:18px;border:1px solid #4b77976e;border-radius:18px;background:#122640;padding:20px}
.xp-ux-port-state>div{display:flex;flex-direction:column;gap:6px}
.xp-ux-port-state small{opacity:.75}
.xp-ux-port-actions{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.xp-ux-port-action{display:flex;align-items:center;justify-content:center;gap:10px;border-radius:18px;background:#145069;border:1px solid #36a6bc;padding:14px 18px;min-height:48px;flex:1}
@media(max-width:450px){.xp-ux-port-panel{padding:5px}.xp-ux-port-action{font-size:13px}.xp-ux-cabin-portrait .xp-ux-hotspot{width:44px;height:44px}}

/* Four dedicated home controls plus seat, access and map interactions. */
.xp-ux-dock-four{gap:clamp(3px,1vw,13px);max-width:92%}
.xp-ux-dock-four .xp-ux-dock-action{flex:1 1 0;min-width:51px;max-width:94px;padding:6px 8px}
.xp-ux-dock-action:disabled{opacity:.4;cursor:not-allowed}
.xp-location-row{width:100%;text-align:inherit;background:transparent;border:0;color:inherit}
.xp-ux-climate-bottom{margin-top:12px}
.xp-ux-seat-sheet{margin:12px 0;padding:12px;background:#14253adf;border:1px solid #4a88ad;border-radius:18px}
.xp-ux-sheet-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.xp-ux-sheet-title button{border:1px solid #507d99;background:#19354b;padding:8px 12px;border-radius:12px}
.xp-ux-access-panel{padding:16px 3px}
.xp-ux-access-head{display:flex;align-items:center;gap:15px;border-bottom:1px solid #51748c50;padding:12px}
.xp-ux-access-head h3{margin:0 0 6px;font-size:21px}
.xp-ux-access-head p{margin:0;color:#abc1d2}
.xp-ux-access-states{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
.xp-ux-access-state{border:1px solid #61849a59;background:#173047ab;border-radius:12px;padding:11px;display:flex;justify-content:space-between;gap:7px}
.xp-ux-access-state span{color:#aec4d5}
.xp-ux-access-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.xp-ux-access-buttons button{border:1px solid #467e9a;background:#12445a;padding:12px 16px;border-radius:14px;display:inline-flex;align-items:center;gap:8px;min-height:48px;flex:1}
.xp-ux-access-buttons button:disabled{opacity:.4;cursor:not-allowed}
.xp-ux-map-stage{min-height:260px;border-radius:14px;overflow:hidden;background:#0c2237;display:flex;align-items:center;justify-content:center}
.xp-ux-map-stage hui-map-card{display:block;width:100%;min-height:300px}
.xp-ux-modal-map .xp-ux-map-panel{width:100%;margin:12px auto 0}
.xp-ux-modal-map .xp-ux-map-stage{min-height:clamp(350px,51vh,520px)}
.xp-ux-modal-map .xp-ux-map-stage hui-map-card{display:block;align-self:stretch;width:100%;min-height:clamp(350px,51vh,520px)}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-map .xp-ux-map-stage{min-height:260px}
 .xp-ux-modal-map .xp-ux-map-stage hui-map-card{min-height:260px}
}
.xp-ux-map-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0 7px}
.xp-ux-map-actions button{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border:1px solid #4d89ae;background:#133b5b;border-radius:14px;min-height:48px}
.xp-ux-map-actions button:disabled{opacity:.4;cursor:not-allowed}
@media(max-width:600px){
 .xp-ux-dock-four{max-width:97%;gap:4px}
 .xp-ux-dock-four .xp-ux-dock-action{min-width:49px;max-width:none;padding:6px 5px}
 .xp-ux-access-panel{padding:8px 0}
 .xp-ux-map-stage{min-height:250px}
 .xp-ux-map-actions button{font-size:12px;padding:10px 6px}
}
@container xpeng-card (max-width:430px){
 .xp-ux-dock-four{bottom:132px;gap:4px}
 .xp-ux-dock-four .xp-ux-dock-action{min-width:43px;min-height:48px;padding:5px 3px}
}

/* Tap to cycle each seat's actual Xpengtk select entity (not another page).
 * Zones line up with both paired cabin image palettes and shrink with the card.
 */
.xp-ux-cabin-art .xp-ux-hotspot-zone{position:absolute;z-index:4;display:flex;align-items:center;justify-content:center;gap:4px;transform:translate(-50%,-50%);width:auto;height:auto;max-width:44%;background:transparent;box-shadow:none}
.xp-ux-cycle{border:1px solid #608ead;background:#0c243fdc;color:#ebf6ff;width:42px;height:44px;min-width:42px;min-height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:3px;box-shadow:0 3px 15px #06111e70;cursor:pointer;touch-action:manipulation}
.xp-ux-cycle svg{width:17px;height:17px}
.xp-ux-cycle .xp-ux-level{font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;min-width:8px}
.xp-ux-cycle-heat.xp-ux-cycle-on{background:#963746ed;border-color:#ff8b8b;color:#fff;box-shadow:0 0 12px #ff5b5780}
.xp-ux-cycle-vent.xp-ux-cycle-on{background:#145b9de9;border-color:#6cd3ff;color:#fff;box-shadow:0 0 12px #47aeff80}
.xp-ux-cycle-busy{outline:1px dotted #dce9f2;outline-offset:2px}
.xp-ux-cycle:focus-visible{outline:3px solid #fff;outline-offset:3px}
.xp-ux-cabin-fallback .xp-ux-wheel{top:21%;left:26%}
.xp-ux-cabin-fallback .xp-ux-driver{top:49%;left:26%}
.xp-ux-cabin-fallback .xp-ux-passenger{top:49%;left:74%}
.xp-ux-cabin-fallback .xp-ux-rear_left{top:86%;left:26%}
.xp-ux-cabin-fallback .xp-ux-rear_right{top:86%;left:74%}
@media(max-width:600px){
 .xp-ux-cabin-art .xp-ux-hotspot-zone{gap:2px}
 .xp-ux-cycle{width:37px;min-width:37px;height:44px;min-height:44px;padding:3px;gap:2px}
 .xp-ux-cycle svg{width:15px;height:15px}
 .xp-ux-cycle .xp-ux-level{font-size:12px}
}
@container xpeng-card (max-width:430px){
 .xp-ux-cycle{width:33px;min-width:33px;height:44px;min-height:44px;padding:2px}
 .xp-ux-hotspot-zone{gap:2px}
}

/* Opt-in extra controls: reuse the approved XPENG background and in-card overlay. */
.xp-more-trigger{width:42px;height:42px;display:grid;place-items:center;cursor:pointer;
 border:1px solid #7aa0bc81;border-radius:14px;color:#e9f9ff;background:#122a43b8}
.xp-more-trigger:focus-visible,.xp-extra-tile:focus-visible{outline:2px solid #a0ecff;outline-offset:2px}
.xp-extra-body{width:min(760px,100%);margin:16px auto 0}
.xp-extra-subtitle{font-size:13px;color:#aac7df;margin:0 0 20px}
.xp-extra-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.xp-extra-tile{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;
 text-align:center;min-height:150px;padding:14px 8px;border:1px solid #4c87ab9c;border-radius:19px;
 background:linear-gradient(155deg,#142b44e3,#071a2eea);color:#f0f8ff;cursor:pointer}
.xp-extra-tile:hover{background:#163959}
.xp-extra-tile svg{color:#77d7fb}
.xp-extra-tile b{font-size:16px}
.xp-extra-tile small{font-size:11px;color:#a8c6de;line-height:1.4}
.xp-extra-heading{display:flex;align-items:center;gap:14px;font-size:19px;margin-bottom:15px}
.xp-extra-heading button{border:1px solid #5d88a7;background:#1a3753;color:#fff;border-radius:11px;
 padding:10px;display:grid;place-items:center}
.xp-extra-details{display:grid;gap:9px}
.xp-extra-line{display:flex;justify-content:space-between;align-items:center;gap:15px;
 border:1px solid #6387aa60;background:#10283bdf;padding:13px 15px;border-radius:14px;min-height:29px}
.xp-extra-line span{color:#acc8dd;font-size:13px}
.xp-extra-line b{font-size:15px;overflow-wrap:anywhere;min-width:0;text-align:end}
.xp-extra-line small{font-size:11px;color:#a6bfd5}
.xp-extra-action{border:1px solid #23b5d6;background:#134e67d9;color:#f2fcff;
 padding:13px;border-radius:14px;min-height:48px;cursor:pointer}
.xp-extra-action:disabled{opacity:.35;cursor:not-allowed}
.xp-extra-range{display:flex;flex-direction:column;gap:11px;padding:13px 15px;
 border:1px solid #6387aa60;background:#10283bdf;border-radius:14px}
.xp-extra-range span{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#c8dfec}
.xp-extra-range input{width:100%;accent-color:#29d9bd}
@media(max-width:600px){.xp-more-trigger{width:40px;height:40px}.xp-extra-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 .xp-extra-tile{min-height:120px;padding:11px 6px;gap:8px}.xp-extra-tile b{font-size:14px}
 .xp-extra-body{margin:10px auto 0}}
@container xpeng-card (max-width:430px){.xp-extra-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .xp-extra-tile{min-height:116px}.xp-extra-line{padding:11px;gap:8px}}

/* A portrait cabin must not push the A/C temperature completely off-screen on phones. */
@media(max-width:600px){
 .xp-ux-modal-climate .xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(280px,100%);margin:5px auto 10px}
 .xp-ux-modal-climate .xp-ux-temp-line{margin:8px auto}
 .xp-ux-modal-climate .xp-ux-climate-card{padding:11px}
 .xp-ux-modal-climate .xp-ux-cycle{min-height:44px}
}
@container xpeng-card (max-width:430px){
 .xp-ux-modal-climate .xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(270px,100%)}
}

/* Verified Xpengtk A/C actions, intentionally excluding unsupported app tiles. */
.xp-ux-climate-features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin:13px 0 8px}
.xp-ux-climate-feature{display:flex;flex-direction:column;align-items:center;justify-content:center;
 gap:9px;min-height:105px;padding:12px 8px;border:1px solid #658cab80;border-radius:16px;
 background:#0f2942dd;color:#f0f8ff;cursor:pointer;text-align:center}
.xp-ux-climate-feature svg{color:#bbdbfa}
.xp-ux-climate-feature span{font-size:14px;font-weight:650}
.xp-ux-climate-feature small{font-size:11px;color:#b0c9db}
.xp-ux-climate-feature:focus-visible{outline:2px solid #9ddaff;outline-offset:2px}
@media(max-width:600px){.xp-ux-climate-features{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .xp-ux-climate-feature{min-height:95px;padding:9px 4px;gap:7px}
 .xp-ux-climate-feature span{font-size:11px}
 .xp-ux-climate-feature small{font-size:9px;line-height:1.3}}
@container xpeng-card (max-width:390px){.xp-ux-climate-feature span{font-size:10px}}

.xp-extra-schedule-line{display:flex;align-items:center;gap:8px}
.xp-extra-schedule-line .xp-extra-line{flex:1}
.xp-extra-schedule-toggle{min-height:44px;padding:10px 12px;border:1px solid #38c0d6;
 border-radius:13px;color:#d9faf5;background:#0c4e5de6;cursor:pointer;white-space:nowrap}
@media(max-width:600px){.xp-extra-schedule-line{flex-wrap:wrap}
 .xp-extra-schedule-line .xp-extra-line{flex-basis:100%}
 .xp-extra-schedule-toggle{width:100%}}


/* Automatic card-width adaptation even when Home Assistant Sections renders a narrow
   card on a wide desktop monitor. Legacy viewport media rules above remain as fallback. */
@container xpeng-layout (max-width:850px){
.xp-scene{min-height:800px;aspect-ratio:auto}
.xp-header{top:16px;left:4%;right:4%}
.xp-brand{font-size:13px;letter-spacing:.12em}
.xp-header-right{gap:9px}
.xp-title{left:5%;top:89px}
.xp-title h1{font-size:34px}
.xp-subtitle{font-size:18px}
.xp-car{width:106%;left:-2%;bottom:29%;max-height:48%;object-fit:contain}
.xp-overview-stat{left:5%;top:220px;width:43%}
.xp-batt-glyph{height:56px;width:37px;border-width:2px;padding:4px}
.xp-batt-glyph:before{height:5px;top:-7px;border-width:2px}
.xp-batt-line{gap:9px}
.xp-soc{font-size:40px}
.xp-stat-label{font-size:13px}
.xp-progress{height:8px}
.xp-overview-range{margin-top:14px}
.xp-range-num{font-size:26px;margin-top:4px}
.xp-status-panel{width:90%;min-width:0;left:5%;right:5%;bottom:24px;border-radius:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:7px}
.xp-info-row{min-width:0;display:block;padding:7px 10px;border-bottom:0;border-right:1px solid #56708a43;min-height:88px}
.xp-info-row:last-child{border-right:0}
.xp-info-icon{display:none}
.xp-info-copy small{font-size:11px}
.xp-info-copy b{font-size:12px;white-space:normal;overflow-wrap:anywhere}
.xp-status-panel .xp-chevron{display:none}
.xp-charge .xp-title{left:5%;top:83px}
.xp-charge-card{top:225px;left:5%;width:90%;padding:18px}
.xp-charge-heading{font-size:22px;margin-bottom:15px}
.xp-charge-card .xp-progress{height:13px}
.xp-charge-main{margin-top:13px}
.xp-charge-main .xp-soc{font-size:42px}
.xp-charge-range b{font-size:20px}
.xp-charge-divider{height:45px}
.xp-charge-meta{margin-top:15px;padding-top:15px}
.xp-charge-meta small{font-size:10px;white-space:normal}
.xp-charge-meta b{font-size:14px}
.xp-charge .xp-car{width:96%;left:2%;bottom:9%;max-height:36%}
.xp-station{right:5%;bottom:22%;height:13%;min-width:40px;font-size:16px}
}
@container xpeng-layout (max-width:850px){.xp-header-right{gap:8px}.xp-wifi{width:38px;height:38px;padding:7px}.xp-meta-popover{top:calc(100% + 8px)}}
@container xpeng-layout (max-width:850px){.xp-tire-screen{inset:23% 3% 4%}.xp-tire-actions{top:-52px;right:3px}
.xp-tire-actions button{font-size:12px;padding:8px 10px}
.xp-tire-stage{grid-template-columns:minmax(80px,1fr) minmax(116px,40%) minmax(80px,1fr);gap:5px}
.xp-tire-reading{padding:12px 4px;border-radius:13px}.xp-tire-reading strong{font-size:24px}.xp-tire-reading small{font-size:11px}.xp-tire-reading span{font-size:12px}}
@container xpeng-layout (max-width:400px){.xp-tire-stage{grid-template-columns:minmax(70px,1fr) minmax(107px,40%) minmax(70px,1fr)}.xp-tire-reading strong{font-size:21px}}
@container xpeng-layout (max-width:850px){.xp-tire-row{min-height:88px;padding:7px 10px;border:0;border-right:1px solid #56708a43}}
@container xpeng-layout (max-width:850px){.xp-overview .xp-car.xp-reference-cutout{left:-3%;bottom:27%;width:108%;max-height:42%}}
@container xpeng-layout (max-width:400px){.xp-charge-meta>div{padding:0 7px}.xp-charge-heading{font-size:19px}.xp-charge-meta b{font-size:12px}.xp-overview-stat{top:219px}.xp-status-panel{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container xpeng-layout (max-width:850px){
 .xp-overview:has(.xp-ux-dock) .xp-status-panel{bottom:18px}
 .xp-overview .xp-ux-dock{bottom:133px;gap:5px;padding:5px 7px}
 .xp-ux-dock-action{min-width:49px;min-height:51px;border-radius:18px;gap:2px}
 .xp-ux-dock-action small{font-size:9px}
 .xp-ux-modal{inset:1.5% 2%;padding:13px}
 .xp-ux-cabin{max-height:290px}
 .xp-ux-cabin svg,.xp-ux-cabin-picture{max-height:285px}
 .xp-ux-seats-grid{grid-template-columns:1fr}
 .xp-ux-charge-actions{bottom:8%;left:4%;right:4%;gap:8px}
 .xp-ux-charge-stop{font-size:12px;padding:6px 10px}
 .xp-ux-charge-limit{min-width:0}
 .xp-charge.xp-has-controls .xp-car{bottom:21%;max-height:26%}
}
@container xpeng-layout (max-width:390px){
 .xp-ux-dock{gap:3px}
 .xp-ux-dock-action{min-width:46px;min-height:48px}
 .xp-ux-dock-action small{font-size:8.5px}
 .xp-ux-charge-actions{flex-wrap:wrap;bottom:3%}
 .xp-ux-charge-stop,.xp-ux-charge-limit{flex:1 1 100%}
 .xp-charge.xp-has-controls .xp-car{bottom:29%;max-height:24%}
 .xp-ux-seat-line{align-items:flex-start;flex-direction:column}
}
@container xpeng-layout (max-width:600px){.xp-ux-cabin-art .xp-ux-hotspot{width:32px;height:32px;padding:5px}.xp-ux-cabin-art .xp-ux-cabin-disclaimer{font-size:9px}}
@container xpeng-layout (max-width:600px){.xp-ux-vehicle-statuses,.xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}.xp-ux-vehicle-buttons button{min-height:50px;padding:9px 7px;font-size:12px}}
@container xpeng-layout (max-width:450px){.xp-ux-port-panel{padding:5px}.xp-ux-port-action{font-size:13px}.xp-ux-cabin-portrait .xp-ux-hotspot{width:44px;height:44px}}
@container xpeng-layout (max-width:600px){
 .xp-ux-dock-four{max-width:97%;gap:4px}
 .xp-ux-dock-four .xp-ux-dock-action{min-width:49px;max-width:none;padding:6px 5px}
 .xp-ux-access-panel{padding:8px 0}
 .xp-ux-map-stage{min-height:250px}
 .xp-ux-map-actions button{font-size:12px;padding:10px 6px}
}
@container xpeng-layout (max-width:600px){
 .xp-ux-cabin-art .xp-ux-hotspot-zone{gap:2px}
 .xp-ux-cycle{width:37px;min-width:37px;height:44px;min-height:44px;padding:3px;gap:2px}
 .xp-ux-cycle svg{width:15px;height:15px}
 .xp-ux-cycle .xp-ux-level{font-size:12px}
}
@container xpeng-layout (max-width:600px){.xp-more-trigger{width:40px;height:40px}.xp-extra-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 .xp-extra-tile{min-height:120px;padding:11px 6px;gap:8px}.xp-extra-tile b{font-size:14px}
 .xp-extra-body{margin:10px auto 0}}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-climate .xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(280px,100%);margin:5px auto 10px}
 .xp-ux-modal-climate .xp-ux-temp-line{margin:8px auto}
 .xp-ux-modal-climate .xp-ux-climate-card{padding:11px}
 .xp-ux-modal-climate .xp-ux-cycle{min-height:44px}
}
@container xpeng-layout (max-width:600px){.xp-ux-climate-features{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .xp-ux-climate-feature{min-height:95px;padding:9px 4px;gap:7px}
 .xp-ux-climate-feature span{font-size:11px}
 .xp-ux-climate-feature small{font-size:9px;line-height:1.3}}
@container xpeng-layout (max-width:600px){.xp-extra-schedule-line{flex-wrap:wrap}
 .xp-extra-schedule-line .xp-extra-line{flex-basis:100%}
 .xp-extra-schedule-toggle{width:100%}}
@container xpeng-layout (max-width:520px){
 .xp-scene{min-height:780px}
 .xp-title{top:84px}
 .xp-title h1{font-size:30px}
 .xp-overview-stat{left:5%;top:207px;width:53%;max-width:none}
 .xp-overview .xp-car{left:0;width:100%;bottom:29%;max-height:38%}
 .xp-overview .xp-car.xp-reference-cutout{left:0;width:100%;bottom:29%;max-height:38%}
 .xp-status-panel{left:4%;right:4%;width:92%;bottom:14px;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;padding:5px 10px}
 .xp-info-row{min-height:57px;padding:8px 7px}
 .xp-info-row:nth-child(2){border-right:0}
 .xp-info-row:last-child{grid-column:1/-1;min-height:48px;border-top:1px solid #56708a43;padding-left:10px;border-right:0}
 .xp-info-copy b{font-size:12px}
 .xp-charge-card{left:4%;width:92%;top:206px;padding:16px 14px}
 .xp-charge-heading{margin-bottom:15px}
 .xp-charge .xp-car{width:100%;left:0;bottom:5%;max-height:30%}
 .xp-station{right:4%;bottom:16%;height:12%}
 .xp-ux-dock{bottom:177px}
}
@container xpeng-layout (max-width:360px){
 .xp-title h1{font-size:28px}
 .xp-overview-stat{width:58%}
 .xp-charge-main{gap:10px}
 .xp-charge-range b{font-size:17px}
 .xp-charge-meta>div{padding:0 5px}
 .xp-charge-meta b{font-size:12px}
 .xp-status-panel{padding:5px 7px}
}

/* Keep the G6 Charging-now composition unchanged while still allowing an accessible
   control modal when the user taps the original visible heading. */
.xp-charge-heading-action{background:transparent;border:0;padding:0;text-align:left;width:auto;cursor:pointer;color:var(--xp-mint)}
.xp-charge-heading-action:focus-visible{outline:2px solid #82dbfe;outline-offset:4px;border-radius:8px}
.xp-ux-modal-charge_controls .xp-ux-charge-actions{position:static;inset:auto;display:flex;flex-wrap:wrap;margin:12px 0 20px}
.xp-ux-modal-charge_controls .xp-ux-charge-limit{max-width:none}
.xp-ux-modal-charge_controls .xp-ux-port-panel{margin-top:15px}
/* Owner's original charging scene stays intact; only two compact shortcuts added. */
.xp-charge-shortcuts{position:absolute;z-index:12;bottom:3.1%;left:3%;display:flex;gap:10px}
.xp-charge-shortcuts button{min-height:44px;padding:8px 16px;border:1px solid #1cbec7;border-radius:13px;color:#e7fcff;background:#082e46e8;cursor:pointer}
.xp-maintenance-page{max-width:940px;margin:0 auto}
.xp-maintenance-page h3{font-size:17px;margin:15px 0 8px;color:#d8f5fa}
.xp-ux-modal-maintenance .xp-tire-screen{position:relative;inset:auto;display:block;height:300px;min-height:260px;margin:0 auto 16px;width:100%}
.xp-ux-modal-maintenance .xp-tire-stage{width:min(690px,100%);height:100%;min-height:0;grid-template-columns:minmax(60px,1fr) minmax(100px,43%) minmax(60px,1fr);grid-template-rows:1fr 1fr;gap:7px}
.xp-ux-modal-maintenance .xp-tire-reading{padding:7px 4px;border-radius:12px}
.xp-ux-modal-maintenance .xp-tire-reading strong{font-size:clamp(17px,2vw,27px)}
.xp-maint-info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.xp-ux-modal-maintenance .xp-extra-line{overflow-wrap:anywhere;gap:9px}
.xp-ux-charge-schedule{max-width:590px;margin:20px auto}
.xp-ux-access-buttons button:disabled,.xp-ux-port-actions button:disabled{opacity:.45;cursor:not-allowed}
@container xpeng-layout (max-width:520px){
 .xp-charge-shortcuts{bottom:3%;left:3%;right:3%;justify-content:center;gap:7px}
 .xp-charge-shortcuts button{font-size:12px;padding:8px 10px;min-height:44px}
 .xp-maint-info{grid-template-columns:1fr}
 .xp-ux-modal-maintenance .xp-tire-screen{height:250px;min-height:240px}
 .xp-ux-modal-maintenance .xp-tire-reading strong{font-size:18px}
}

/* The home dashboard owns the only navigation menu. Subpages show Back only. */
.xp-ux-dock-seven{gap:clamp(4px,.6vw,10px);max-width:96%;padding:8px 10px;bottom:2.3%;border-radius:26px}
.xp-ux-dock-seven .xp-ux-dock-action{flex:0 1 84px;min-width:66px;max-width:88px;min-height:63px;padding:6px 4px;border-radius:17px}
.xp-ux-dock-seven .xp-ux-dock-action small{font-size:11px}
.xp-page-back{position:absolute;z-index:22;top:10%;right:3.5%;min-height:44px;border:1px solid #6d9dbbba;border-radius:13px;background:#0b2c48e9;color:#effaff;display:flex;align-items:center;gap:9px;padding:8px 13px;cursor:pointer;direction:rtl}
.xp-page-back:hover,.xp-page-back:focus-visible{background:#145371;border-color:#17dfcd}
.xp-ux-modal-head{position:sticky;top:-16px;z-index:9;padding:8px 0 12px;background:linear-gradient(180deg,#071626 78%,#07162600)}
@container xpeng-layout (max-width:850px){
 .xp-home-navigation .xp-ux-dock-seven{bottom:22px;left:50%;max-width:94%;width:min(550px,94%);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:7px;border-radius:18px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{width:100%;min-width:0;max-width:none;min-height:53px;padding:4px;gap:3px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:10px;white-space:normal;line-height:1.15}
 .xp-page-back{top:22px;right:4%;padding:6px 10px}
}
@container xpeng-layout (max-width:360px){
 .xp-home-navigation .xp-ux-dock-seven{bottom:20px;gap:3px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:49px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:9px}
}

/* Desktop climate = cabin + controls side by side; mobile = one scrolling page.
   The two owner photos remain unchanged and preserve their proportions. */
.xp-ux-modal-climate .xp-climate-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:clamp(14px,2.5vw,42px);align-items:start;max-width:1180px;margin:12px auto 0;direction:ltr}
.xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(354px,100%);margin:0 auto;height:auto;max-height:none}
.xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{margin:0;direction:rtl;min-width:0;display:flex;flex-direction:column;gap:10px}
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-card,
.xp-ux-modal-climate .xp-climate-layout .xp-ux-range-row{margin:0}
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-features{grid-template-columns:repeat(2,minmax(0,1fr));margin:0}
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-feature{min-height:89px}
@container xpeng-layout (max-width:850px){
 .xp-ux-modal-climate .xp-climate-layout{display:flex;flex-direction:column;align-items:center;gap:8px;margin:6px auto 0}
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(258px,100%);margin:0 auto}
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{width:100%;max-width:530px;gap:8px}
 .xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-features{grid-template-columns:repeat(3,minmax(0,1fr))}
 .xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-feature{min-height:82px}
}
@container xpeng-layout (max-width:390px){
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(230px,100%)}
}
/* Final owner acceptance: responsive charging uses FRONT G6 and a decorative
   glowing cable; telemetry remains DOM/HA-driven, never baked into image art. */
.xp-charge-cable{position:absolute;inset:0;width:100%;height:100%;z-index:8;pointer-events:none;overflow:visible}
.xp-charge-cable-halo,.xp-charge-cable-core{fill:none;stroke-linecap:round}
.xp-charge-cable-halo{stroke:#00eebb;stroke-width:12;filter:drop-shadow(0 0 14px #00ffcc)}
.xp-charge-cable-core{stroke:#c3fff2;stroke-width:3}
.xp-cable-mobile{display:none}
@container xpeng-layout (max-width:850px){
 .xp-cable-desktop{display:none}
 .xp-cable-mobile{display:block}
}
.xp-ux-dock-seven .xp-ux-dock-action small{font-size:10px;white-space:normal;line-height:1.12}
.xp-ux-dock-seven .xp-ux-dock-action:disabled{opacity:.48}
/* Use live HA state for labels and icon; status-only climate feedback stays inert. */
.xp-ux-climate-readonly{cursor:default;opacity:.80;border-style:dashed}
.xp-ux-dock-seven .xp-ux-dock-action{flex-basis:78px;min-width:61px;max-width:84px}
.xp-ux-map-actions button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px}
.xp-ux-modal-trunk .xp-ux-access-buttons button{min-height:48px}

/* Mobile scroll: modal is an independent touch-scrolling surface inside the scene. */
.xp-ux-modal{overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;
 touch-action:pan-y;overscroll-behavior-y:contain;max-height:96%;box-sizing:border-box}
.xp-ux-modal-head{position:sticky;top:-16px;z-index:5;padding:4px 2px 12px;
 background:linear-gradient(180deg,#07182b 80%,#07182b00)}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal{inset:1% 1%;height:auto;min-height:0;max-height:98%;
   padding:11px 11px 38px;touch-action:pan-y}
 .xp-ux-modal-head{top:-11px}
 .xp-ux-modal-maintenance .xp-tire-screen{position:relative;inset:auto;
    height:auto!important;min-height:0!important;margin:8px 0 22px;overflow:visible}
 .xp-ux-modal-maintenance .xp-tire-stage{display:grid;width:100%;height:auto;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    grid-template-rows:auto auto auto;gap:10px;align-items:stretch}
 .xp-ux-modal-maintenance .xp-tire-center{grid-area:1/1/2/3;height:195px;
    width:100%;max-width:220px;justify-self:center;filter:none}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fl"]{grid-area:2/1}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fr"]{grid-area:2/2}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rl"]{grid-area:3/1}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rr"]{grid-area:3/2}
 .xp-ux-modal-maintenance .xp-tire-reading{min-width:0;padding:12px 8px}
 .xp-ux-modal-maintenance .xp-tire-reading strong{font-size:clamp(21px,6vw,29px)}
 .xp-ux-modal-maintenance .xp-maint-info{grid-template-columns:minmax(0,1fr)}
 .xp-ux-modal-maintenance .xp-extra-line{min-width:0;overflow-wrap:anywhere}
 .xp-ux-modal-climate .xp-climate-layout{padding-bottom:55px}
}
.xp-charge-cable-live .xp-charge-cable-halo{stroke:#00f59c;stroke-width:13;
 filter:drop-shadow(0 0 12px #00ffab)}
.xp-charge-cable-live .xp-charge-cable-core{stroke:#abffe6;stroke-width:3}
`;
// Retain legacy manual entity mapping for older YAML; new configs are automatic.
function xpSensorMappingMode(cfg,profile){
 const mode=profile?.sensor_mapping_mode??cfg?.sensor_mapping_mode;
 if(mode==='auto'||mode==='manual')return mode;
 return Object.keys(profile?.entities||{}).length||Object.keys(cfg?.entities||{}).length?'manual':'auto';
}
class XpengVehicleCard extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});this._config={};this._hass=null;this._view='overview';this._expanded=false;this._vehicleIndex=0;this._infoOpen=false;this._tireOpen=false;this._failedArtwork=new Set();
  this.shadowRoot.addEventListener('error',ev=>{
      const img=ev.target;
      if(!img?.matches?.('img[data-car-art],img[data-top-art],img[data-cabin-art]'))return;
      const failed=img.getAttribute('src');
      if(!failed||this._failedArtwork.has(failed))return;
      this._failedArtwork.add(failed);
      this.render();
    },true);
   this.shadowRoot.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
     
     if(b.hasAttribute('data-xp-close')){this._xpPanel=null;this._xpSeatFocus=null;this._xpNotice='';this.render();return;}
     if(b.hasAttribute('data-xp-home')){this._xpPanel=null;this._xpSeatFocus=null;this._xpManualCharging=false;this._xpChargingDismissed=this.xpChargingActive();this._xpNotice='';this.render();return;}
     if(b.hasAttribute('data-xp-page')){this._xpPanel=b.dataset.xpPage;this._xpSeatFocus=null;this._xpNotice='';this.render();return;}
     if(b.hasAttribute('data-xp-cycle')){this.xpCycleSeat(b.dataset.xpCycle);return;}
      
     if(b.hasAttribute('data-xp-open')){
       const action=b.dataset.xpOpen;
       if(['climate','port','doors','windows','trunk','map','maintenance','charge_controls','charge_schedule'].includes(action)){
         this._xpPanel=action;this._xpSeatFocus=null;
         this._xpNotice='';this.render();
       }
       return;
      }
      if(b.hasAttribute('data-xp-toggle')){
       const action=b.dataset.xpToggle;
       if(['doors','windows','port','trunk'].includes(action))this.xpToggle(action);
       return;
     }
     if(b.hasAttribute('data-xp-port')){
       const suffix=b.dataset.xpPort==='open'?'open_charge_port':b.dataset.xpPort==='close'?'close_charge_port':null;
       if(suffix)this.xpSend('button','press',suffix);
       return;
     }
     if(b.hasAttribute('data-xp-command')){
       if(b.dataset.xpCommand==='stop_charge')this.xpSend('button','press','stop_charge');
       return;
     }
     if(b.hasAttribute('data-xp-vehicle')){
       const actions={
         'lock.lock.door_lock':['lock','lock','door_lock'],
         'button.press.close_windows':['button','press','close_windows'],
         'button.press.close_trunk':['button','press','close_trunk'],
         'button.press.flash_lights':['button','press','flash_lights'],
         'button.press.honk_horn':['button','press','honk_horn'],
         'switch.turn_on.sentinel_switch':['switch','turn_on','sentinel_switch']
       };
       const command=actions[b.dataset.xpVehicle];
       if(command)this.xpSend(...command);
       return;
     }
     if(b.hasAttribute('data-xp-access')){
        const act=b.dataset.xpAccess;
        const enabled=this.vehicle()?.enable_access_controls??this._config.enable_access_controls??false;
        const allowed=enabled===true||enabled==='true';
        if(!allowed)return;
        if(act==='unlock')this.xpSend('lock','unlock','door_lock');
        if(act==='open_windows')this.xpSend('button','press','open_windows');
        return;
      }
      if(b.hasAttribute('data-xp-door-lock')){this.xpSend('lock','lock','door_lock');return;}
      if(b.hasAttribute('data-xp-window-close')){this.xpSend('button','press','close_windows');return;}
      if(b.hasAttribute('data-xp-map-action')){
        const action=b.dataset.xpMapAction;
        if(['honk_horn','flash_lights'].includes(action))this.xpSend('button','press',action);
        return;
      }
      if(b.hasAttribute('data-xp-temp')){this.xpDoTemperature(Number(b.dataset.xpTemp));return;}
     if(b.hasAttribute('data-xp-climate')){
       this.xpSend('climate',b.dataset.xpClimate==='on'?'turn_on':'turn_off','cabin_climate');return;
     }
     if(b.hasAttribute('data-xp-switch')){
       if(b.dataset.xpSwitch==='defrost_switch')this.xpSend('switch','toggle','defrost_switch');
       return;
     }
     if(b.hasAttribute('data-xp-hvac-mode')){
       const mode=b.dataset.xpHvacMode,c=this.xpLive('climate','cabin_climate');
       if(c&&Array.isArray(c.state.attributes?.hvac_modes)&&c.state.attributes.hvac_modes.includes(mode))
         this.xpSend('climate','set_hvac_mode','cabin_climate',mode);
       return;
     }
     if(b.hasAttribute('data-xp-swing-mode')){
       const mode=b.dataset.xpSwingMode,c=this.xpLive('climate','cabin_climate');
       if(c&&Array.isArray(c.state.attributes?.swing_modes)&&c.state.attributes.swing_modes.includes(mode))
         this.xpSend('climate','set_swing_mode','cabin_climate',mode);
       return;
     }
     if(b.hasAttribute('data-xp-select')){
       const suffix=b.dataset.xpSelect,option=b.dataset.xpOption;
       const permitted=new Set(['driver_seat_heat_select','passenger_seat_heat_select',
         'driver_seat_ventilation_select','passenger_seat_ventilation_select',
         'left_rear_seat_heat_select','right_rear_seat_heat_select',
         'left_rear_seat_ventilation_select','right_rear_seat_ventilation_select',
         'steering_wheel_heat_select']);
       const ent=permitted.has(suffix)?this.xpLive('select',suffix):null;
       if(ent?.state?.attributes?.options?.includes(option) && !(suffix==='passenger_seat_heat_select'&&option==='Off')){
         this.xpSend('select','select_option',suffix,option);
       }
       return;
     }

     if(b.hasAttribute('data-xp-more')){
       this._xpPanel='extras';this._xpExtraSection=null;this._xpNotice='';this.render();return;
     }
     if(b.hasAttribute('data-xp-extra-page')){
       const page=b.dataset.xpExtraPage;
       if(['security','energy','schedule','power','maintenance','updates'].includes(page)){
         this._xpPanel='extras';this._xpExtraSection=page;this._xpNotice='';this.render();
       }
       return;
     }
     if(b.hasAttribute('data-xp-extra-back')){
       this._xpExtraSection=null;this._xpNotice='';this.render();return;
     }
     if(b.hasAttribute('data-xp-hvac-schedule')){
       const id=b.dataset.xpHvacSchedule;
       const schedule=this.xpLive('sensor','hvac_schedules');
       const matches=Array.isArray(schedule?.state.attributes?.schedules)?
         schedule.state.attributes.schedules.some(item=>item&&item.appointment_id!=null&&String(item.appointment_id)===id):false;
       if(!matches)return;
       const suffix='hvac_schedule_'+id,entity=this.xpLive('switch',suffix);
       if(!entity||!['on','off'].includes(entity.state.state))return;
       this.xpSend('switch',entity.state.state==='on'?'turn_off':'turn_on',suffix);
       return;
     }
     if(b.hasAttribute('data-xp-extra-detail')){
       const lookup={
         schedules:['sensor','hvac_schedules'], calendar:['calendar','hvac_schedule_calendar'],
         maintenance:['sensor','maintenance'], ota:['sensor','ota_upgrade']
       };
       const key=lookup[b.dataset.xpExtraDetail];
       if(key)this.xpDetails(key[1],key[0]);
       return;
     }
     if(b.hasAttribute('data-xp-extra-action')){
       const cmds={
         'guard_on':['switch','turn_on','sentinel_switch'],
         'guard_off':['switch','turn_off','sentinel_switch'],
         'v2l_on':['switch','turn_on','trunk_power_switch'],
         'v2l_off':['switch','turn_off','trunk_power_switch'],
         'ota_on':['switch','turn_on','auto_upgrade_switch'],
         'ota_off':['switch','turn_off','auto_upgrade_switch']
       };
       const action=b.dataset.xpExtraAction;
       if(action==='guard_off'&&!this.xpAccessAllowed())return;
       const command=cmds[action];
       if(command&&this.xpLive(command[0],command[2]))this.xpSend(...command);
       return;
     }
     if(b.hasAttribute('data-meta-toggle')){this._infoOpen=!this._infoOpen;this.render();return;}
     if(b.hasAttribute('data-tire-toggle')){this._tireOpen=!this._tireOpen;this._infoOpen=false;this.render();return;}
    if(b.hasAttribute('data-cycle')){this._vehicleIndex=(this._vehicleIndex+1)%this.vehicles().length;this._tireOpen=false;this._xpPanel=null;this._xpengRegistryLoaded=false;this._xpengByKey=null;this.ensureXpengRegistry();this.render();}
  });
   this.shadowRoot.addEventListener('input',ev=>{
     const slider=ev.target.closest('input[data-xp-range]');
     if(!slider)return;
     const label=slider.closest('label'),output=label?.querySelector('span b');
     if(output)output.textContent=slider.value+(slider.dataset.xpRange==='charge_limit_control'?'%':'');
   });
   this.shadowRoot.addEventListener('change',ev=>{
     const slider=ev.target.closest('input[data-xp-range]');
     if(!slider)return;
     const key=slider.dataset.xpRange;
     if(!['charge_limit_control','fan_speed_control','sentinel_sensitivity_control','trunk_power_timer_control'].includes(key))return;
     const entity=this.xpLive('number',key);
     if(!entity)return;
     const attrs=entity.state.attributes||{};
     const lo=Number(attrs.min??(key==='charge_limit_control'?50:1));
     const hi=Number(attrs.max??(key==='charge_limit_control'?100:8));
     const step=Number(attrs.step??(key==='charge_limit_control'?5:1));
     const raw=Number(slider.value);
     if(!Number.isFinite(raw)||!Number.isFinite(lo)||!Number.isFinite(hi)||!Number.isFinite(step)||step<=0)return;
     const value=Math.max(lo,Math.min(hi,Math.round((raw-lo)/step)*step+lo));
     this.xpSend('number','set_value',key,value);
   });
 }

 async ensureXpengRegistry(){
  if(this._xpengRegistryPending||this._xpengRegistryLoaded)return;
  const conn=this._hass?.connection;
  if(typeof conn?.sendMessagePromise!=='function')return;
  this._xpengRegistryPending=true;
  try{
   const entries=await conn.sendMessagePromise({type:'config/entity_registry/list'});
   const selection=xpVehicleRegistryRows(entries,this.prefix(),this._config.xpeng_device_id);
   this._xpengByKey=selection.byKey;
   this._xpengEntities=selection.entries;
   this._xpengRegistryMessage=selection.message;
   this._xpengRegistryLoaded=true;
   this.render();
  }catch(error){
   this._xpengRegistryMessage='registry_unavailable';
  }finally{
   this._xpengRegistryPending=false;
  }
 }
 xpengEntity(domain,suffix){
  const key=domain+'.'+suffix;
  const equivalent=key==='binary_sensor.windows'?'binary_sensor.any_window_open':null;
  const candidates=[
    this._xpengByKey?.[key],equivalent?this._xpengByKey?.[equivalent]:null,
    domain+'.'+this.prefix()+'_'+(XP_CONTROL_FALLBACKS[key]||suffix),
    domain+'.'+this.prefix()+'_'+suffix,
    ...(key==='sensor.slow_charge_port'?[domain+'.'+this.prefix()+'_charge_port']:[])
  ].filter(Boolean);
  return candidates.find(id=>this._hass?.states?.[id]&&!XP_INVALID.has(String(this._hass.states[id].state).trim().toLowerCase()))
    ||candidates.find(id=>this._hass?.states?.[id])||null;
 }


 xpUiEnabled(){const v=this.vehicle()?.show_controls??this._config.show_controls;return v===undefined?this.model()==='G6':v===true||v==='true';}
 xpLive(domain,suffix){
  const id=this.xpengEntity(domain,suffix);
  const state=id?this._hass?.states?.[id]:null;
  return state&&state.state!=='unavailable'&&(domain==='button'||state.state!=='unknown')?{id,state}:null;
 }
 xpChargingActive(){
  // A confirmed unplugged cable overrides stale charging telemetry.
  if(this.bool('plugged')===false)return false;
  return xpChargingActive(this.val('charging'))===true;
 }
 xpActionState(action){
   if(action==='doors'){
     const state=this.xpLive('lock','door_lock')?.state?.state;
     if(state==='locked'||state==='unlocked')return state==='locked'?'closed':'open';
     // In Xpengtk binary_sensor.locked: ON means *unlocked*, OFF means locked.
     const sensor=this.xpLive('binary_sensor','locked')?.state?.state;
     return sensor==='on'?'open':sensor==='off'?'closed':null;
   }
   if(action==='trunk'){
     const state=this.xpLive('binary_sensor','trunk')?.state?.state;
     return state==='off'?'closed':state==='on'?'open':null;
   }
   if(action==='windows'){
     const state=this.xpLive('binary_sensor','windows')?.state?.state;
     return state==='off'?'closed':state==='on'?'open':null;
   }
   if(action==='port'){
     // Xpengtk slow-charge-port enum: Closed / Open / Connected (with optional raw 0/1/2).
     const raw=this.xpLive('sensor','slow_charge_port')||this.xpLive('sensor','charge_port');
     const val=String(raw?.state?.state??'').trim().toLowerCase();
     return ['closed','0'].includes(val)?'closed':['open','1'].includes(val)?'open':null;
   }
   return null;
 }
 xpToggleTarget(action){
   const state=this.xpActionState(action);
   if(state===null)return null;
   if(action==='doors')return state==='open'
     ?{domain:'lock',service:'lock',suffix:'door_lock',label:'נעילת הרכב'}
     :this.xpAccessAllowed()?{domain:'lock',service:'unlock',suffix:'door_lock',label:'שחרור נעילה'}:null;
   if(action==='windows')return state==='open'
     ?{domain:'button',service:'press',suffix:'close_windows',label:'סגירת חלונות'}
     :this.xpAccessAllowed()?{domain:'button',service:'press',suffix:'open_windows',label:'פתיחת חלונות'}:null;
   if(action==='trunk')return state==='open'
     ?{domain:'button',service:'press',suffix:'close_trunk',label:'סגירת תא מטען'}
     :this.xpAccessAllowed()?{domain:'button',service:'press',suffix:'open_trunk',label:'פתיחת תא מטען'}:null;
   if(action==='port')return state==='open'
     ?{domain:'button',service:'press',suffix:'close_charge_port',label:'סגירת שקע טעינה'}
     :{domain:'button',service:'press',suffix:'open_charge_port',label:'פתיחת שקע טעינה'};
   return null;
 }
 xpToggle(action){
   const target=this.xpToggleTarget(action);
   if(!target||!this.xpLive(target.domain,target.suffix))return;
   // Only a user click reaches this function. No sensor-state listener issues car commands.
   this.xpSend(target.domain,target.service,target.suffix,undefined,true);
 }
 xpToggleButton(action){
   const target=this.xpToggleTarget(action);
   const usable=target&&this.xpLive(target.domain,target.suffix);
   const title=target?.label||(this.xpActionState(action)===null?'המצב אינו ידוע':'נדרשת הרשאת Access');
   return '<button type="button" data-xp-toggle="'+action+'" '+(usable?'':'disabled')+
     ' aria-label="'+xpEsc(title)+'" title="'+xpEsc(title)+'">'+
     xpIcon(action==='doors'?(target?.service==='unlock'?'unlock':'lock'):action==='trunk'?(target?.suffix==='open_trunk'?'trunk_open':'trunk'):action==='port'?(target?.suffix==='open_charge_port'?'port_open':'plug'):(target?.suffix==='open_windows'?'windows_open':'windows'),20)+'<span>'+xpEsc(title)+'</span></button>';
 }
 xpDock(){
   if(!this.xpUiEnabled())return '';
   const items=[
     ['climate','fan','מיזוג'],
     ['doors','lock','נעילה'],['windows','windows','חלונות'],
     ['port','plug','שקע טעינה'],['trunk','trunk','תא מטען'],
     ['maintenance','settings','תחזוקה'],['map','pin','מיקום']
   ];
   return '<nav class="xp-ux-dock xp-ux-dock-seven" aria-label="מעבר בין מסכים" dir="rtl">'+
     items.map(([action,icon,title])=>{
       const toggle=['doors','windows','port','trunk'].includes(action);
       const target=toggle?this.xpToggleTarget(action):null;
       const available=toggle?!!(target&&this.xpLive(target.domain,target.suffix)):
         action==='climate'?!!this.xpLive('climate','cabin_climate'):true;
       const label=toggle?(target?.label||(this.xpActionState(action)===null?'מצב לא ידוע':'דרושה הרשאת גישה')):title;
       const compact=toggle?({
         'נעילת הרכב':'נעל','שחרור נעילה':'פתח נעילה',
         'סגירת חלונות':'סגור חלונות','פתיחת חלונות':'פתח חלונות',
         'סגירת שקע טעינה':'סגור שקע','פתיחת שקע טעינה':'פתח שקע',
         'סגירת תא מטען':'סגור תא מטען','פתיחת תא מטען':'פתח תא מטען'
       }[label]||'לא זמין'):title;
       const ico=action==='doors'?(target?.service==='unlock'?'unlock':'lock'):
         action==='windows'?(target?.suffix==='open_windows'?'windows_open':'windows'):
         action==='port'?(target?.suffix==='open_charge_port'?'port_open':'plug'):
         action==='trunk'?(target?.suffix==='open_trunk'?'trunk_open':'trunk'):icon;
       return '<button class="xp-ux-dock-action" type="button" '+
         (toggle?'data-xp-toggle="'+action+'"':'data-xp-open="'+action+'"')+
         ' aria-label="'+xpEsc(label)+'" title="'+xpEsc(label)+'" '+(available?'':'disabled')+'>'+
         xpIcon(ico,21)+'<small>'+xpEsc(compact)+'</small></button>';
     }).join('')+'</nav>';
 }
 xpSeatShownState(suffix){
   const e=this.xpLive('select',suffix);if(!e)return null;
   const old=e.state.state,pending=this._xpSeatPending?.[suffix];
   if(!pending)return old;
   if((pending.sent===true&&old===pending.option)||Date.now()-pending.at>90000){
     delete this._xpSeatPending[suffix];return old;
   }
   return pending.option;
 }
 xpSeatButtons(){
   const zones=[
     ['wheel','הגה',['steering_wheel_heat_select']],
     ['driver','נהג',['driver_seat_heat_select','driver_seat_ventilation_select']],
     ['passenger','נוסע',['passenger_seat_heat_select','passenger_seat_ventilation_select']],
     ['rear_left','אחורי שמאל',['left_rear_seat_heat_select','left_rear_seat_ventilation_select']],
     ['rear_right','אחורי ימין',['right_rear_seat_heat_select','right_rear_seat_ventilation_select']]
   ];
   return zones.map(([zone,label,keys])=>{
     const buttons=keys.map(key=>{
       const e=this.xpLive('select',key);
       if(!e)return '';
       const state=this.xpSeatShownState(key);
       const active=state&&state!=='Off';
       const vent=key.includes('ventilation');
       const type=vent?'xp-ux-cycle-vent':'xp-ux-cycle-heat';
       const title=(vent?'אוורור ':'חימום ')+label;
       const busy=this._xpSeatBusy?.[key];
       return '<button type="button" class="xp-ux-cycle '+type
         +(active?' xp-ux-cycle-on':'')+(busy?' xp-ux-cycle-busy':'')
         +'" data-xp-cycle="'+xpEsc(key)+'" aria-label="'+xpEsc(title+', דרגה '+xpSeatLevel(state))
         +'" title="'+xpEsc(title)+'">'+xpIcon(vent?'fan':'thermometer',17)
         +'<span class="xp-ux-level">'+xpSeatLevel(state)+'</span></button>';
     }).filter(Boolean).join('');
     return buttons?'<div class="xp-ux-hotspot-zone xp-ux-'+zone+'" data-xp-zone="'+zone
       +'" role="group" aria-label="'+label+'">'+buttons+'</div>':'';
   }).join('');
 }
 async xpCycleSeat(suffix){
   const allowed=new Set([
     'driver_seat_heat_select','passenger_seat_heat_select',
     'driver_seat_ventilation_select','passenger_seat_ventilation_select',
     'left_rear_seat_heat_select','right_rear_seat_heat_select',
     'left_rear_seat_ventilation_select','right_rear_seat_ventilation_select',
     'steering_wheel_heat_select'
   ]);
   if(!allowed.has(suffix))return;
   const e=this.xpLive('select',suffix);
   const choices=e?.state.attributes?.options;
   if(!e||!Array.isArray(choices))return;
   const next=xpNextSeatOption(this.xpSeatShownState(suffix),choices,suffix);
   if(!next){this._xpNotice='רמת החימום או האוורור אינה זמינה כעת.';this.render();return;}
   if(suffix==='passenger_seat_heat_select'&&next==='Off'){
     this._xpNotice='כיבוי חימום מושב הנוסע הקדמי אינו נתמך כרגע ב־Xpengtk. ניתן לכבות מתוך הרכב.';
     this.render();return;
   }
   this._xpSeatPending??=Object.create(null);
   this._xpSeatPending[suffix]={option:next,at:Date.now()};
   this._xpNotice='';
   this.render();
   if(this._xpSeatBusy?.[suffix])return;
   this._xpSeatBusy??=Object.create(null);
   this._xpSeatBusy[suffix]=true;
   let lastSent=null;
   try{
     while(this._xpSeatPending?.[suffix]){
       const target=this._xpSeatPending[suffix].option;
       if(target===lastSent)break;
       const ent=this.xpLive('select',suffix);
       if(!ent?.state.attributes?.options?.includes(target))throw Error('הדרגה אינה נתמכת כעת.');
       if(typeof this._hass?.callService!=='function')throw Error('שירות HA אינו זמין.');
       await this._hass.callService('select','select_option',{entity_id:ent.id,option:target});
       if(this._xpSeatPending?.[suffix]?.option===target)this._xpSeatPending[suffix].sent=true;
       lastSent=target;
     }
   }catch(error){
     delete this._xpSeatPending[suffix];
     this._xpNotice='פקודת המושב נכשלה: '+(error?.message||'שגיאה');
   }finally{
     delete this._xpSeatBusy[suffix];
     this.render();
   }
 }
 xpCabinHotspots(){
   return this.xpSeatButtons();
 }
 // Xpengtk currently does not publish an interior-colour sensor.
 // Only a colour from the selected vehicle's actual entity registry may
 // supersede the editor setting, otherwise the editor stays authoritative.
 xpCabinFinish(){
   const selected=this.appearance().interior;
   if(this.model()!=='G6')return selected;
   const entityId=this._xpengByKey?.['sensor.interior_color']||this._xpengByKey?.['sensor.cabin_color'];
   const entry=entityId?this._hass?.states?.[entityId]:null;
   const raw=String(entry?.state??'').trim().toLowerCase().replace(/[ -]+/g,'_');
   if(['white','light','light_gray','light_grey'].includes(raw))return 'light_gray';
   if(['black','dark','dark_gray','dark_grey'].includes(raw))return 'dark_gray';
   return selected;
 }
 xpCabinView(){
   const a={...this.appearance(),interior:this.xpCabinFinish()};
   const finish=XP_INTERIORS.find(x=>x.id===a.interior)||XP_INTERIORS[0];
   const multi=Array.isArray(this._config.vehicles)&&this._config.vehicles.length>0;
   const photos=multi?this.vehicle()?.interior_images:this._config.interior_images;
   const custom=photos&&typeof photos==='object'?photos[a.interior]:null;
   // Both owner photos are shared by every G6 year/trim and never replaced by SVG.
   const known=a.model==='G6';
   const photo=known?this.artworkUrl('vehicles/g6/interior_'+a.interior+'.webp'):null;
   const candidates=[
     ...(xpLocalArtworkPath(custom)?[{src:custom,portrait:!(this._config.interior_images_landscape===true),caption:'תמונת פנים לפי הגדרות הרכב'}]:[]),
     ...(photo?[{src:photo,portrait:true,caption:'תמונת פנים בעל הרכב · XPENG G6'}]:[])
   ];
   const found=candidates.find(x=>!this._failedArtwork.has(x.src));
   if(!found&&known)return '<div class="xp-ux-cabin xp-ux-cabin-art xp-ux-cabin-missing" role="status" dir="rtl">תמונת פנים G6 בצבע שנבחר עדיין לא צורפה לפרויקט. לא מוצגת הדמיה חלופית.</div>';
   if(!found)return this.xpCabinFallback();
   const orientation=found.portrait?' xp-ux-cabin-portrait':'';
   return '<div class="xp-ux-cabin xp-ux-cabin-art'+orientation+'" dir="ltr"><img class="xp-ux-cabin-picture" data-cabin-art src="'+xpEsc(found.src)
     +'" alt="'+xpEsc(a.model+' '+a.year+', '+finish.label+' interior')+'" loading="eager">'
     +this.xpCabinHotspots()+'<small class="xp-ux-cabin-disclaimer">'+xpEsc(found.caption)+' · '+xpEsc(finish.label)+'</small></div>';
 }
 xpCabinFallback(){
  const a=this.appearance();
  const finish=XP_INTERIORS.find(x=>x.id===a.interior)||XP_INTERIORS[0];
  const pictures=Array.isArray(this._config.vehicles)&&this._config.vehicles.length?this.vehicle()?.interior_images:this._config.interior_images;
  const selected=pictures&&typeof pictures==='object'?pictures[a.interior]:null;
  if(xpLocalArtworkPath(selected))return '<div class="xp-ux-cabin"><img src="'+xpEsc(selected)+'" loading="lazy" alt="'+xpEsc('פנים רכב '+a.model+' בצבע '+finish.label)+'" class="xp-ux-cabin-picture">'
    +'<small>תמונת פנים לפי הגדרת הצבע</small></div>';
  const seat=xpEsc(finish.hex),shade=xpEsc(finish.secondary);
  // Honest, colour-matched illustration, never an invented factory photograph.
  const seatShape=(x,y,w,h)=>'<g><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="24" fill="'+shade+'" stroke="#87a4b9" stroke-opacity=".48" stroke-width="2"/>'
   +'<rect x="'+(x+9)+'" y="'+(y+9)+'" width="'+(w-18)+'" height="'+(h-18)+'" rx="18" fill="'+seat+'" stroke="#a8b9bf" stroke-opacity=".35"/>'
   +'<path d="M'+(x+15)+' '+(y+h*.48)+'h'+(w-30)+'" stroke="'+shade+'" stroke-width="6" opacity=".48"/></g>';
  const seatHtml=seatShape(105,112,130,151)+seatShape(447,112,130,151)
    +seatShape(105,278,130,87)+seatShape(276,278,130,87)+seatShape(447,278,130,87);
  return '<div class="xp-ux-cabin xp-ux-cabin-art xp-ux-cabin-fallback" dir="ltr"><svg viewBox="0 0 680 390" role="img" aria-label="'+xpEsc('איור פנים רכב '+a.model+' — '+finish.label)+'">'
    +'<rect x="43" y="7" width="594" height="375" rx="87" fill="#0c1e30" stroke="#6c859c" stroke-width="4"/>'
    +'<path d="M91 55Q340 5 589 55L605 104H75Z" fill="#1b324a" stroke="#5c819c" stroke-width="3"/>'
    +'<rect x="294" y="78" width="92" height="39" rx="8" fill="#101620" stroke="#407197" stroke-width="2"/>'
    +'<circle cx="170" cy="87" r="31" fill="none" stroke="'+seat+'" stroke-width="10"/>'
    +'<path d="M151 77h38m-19 0v30" stroke="'+shade+'" stroke-width="4"/>'
    +'<rect x="288" y="122" width="104" height="153" rx="18" fill="#1c2c39" stroke="#5a778d"/>'
    +seatHtml+'</svg>'
    +this.xpSeatButtons()
    +'<small class="xp-ux-cabin-disclaimer">תצוגה מאוירת · '+xpEsc(finish.label)+'</small></div>';
 }
 xpTempControl(){
  const c=this.xpLive('climate','cabin_climate');
  if(!c)return '<p>בקרת המיזוג אינה זמינה כרגע.</p>';
  const attrs=c.state.attributes||{};
  const target=attrs.temperature===null||attrs.temperature===undefined||attrs.temperature===''?null:Number(attrs.temperature);
  const inside=attrs.current_temperature===null||attrs.current_temperature===undefined||attrs.current_temperature===''?null:Number(attrs.current_temperature);
  const insideText=inside!==null&&Number.isFinite(inside)?xpNum(inside,1)+'°C':this.num('cabin','°C',1);
  const running=c.state.state!=='off';
  const known=target!==null&&Number.isFinite(target)&&target>=Number(attrs.min_temp??16)&&target<=Number(attrs.max_temp??32);
  const value=known?xpNum(target,1)+'°C':'—';
  return '<div class="xp-ux-climate-card">'
   +'<div class="xp-ux-climate-caption"><strong>מיזוג אוויר</strong><span>בתא הנוסעים: '+xpEsc(insideText)+'</span></div>'
   +'<div class="xp-ux-temp-line"><button type="button" data-xp-temp="-1" aria-label="הורד חצי מעלה" '+(known?'':'disabled')+'>−</button>'
   +'<b>'+value+'</b><button type="button" data-xp-temp="1" aria-label="העלה חצי מעלה" '+(known?'':'disabled')+'>+</button></div>'
   +'</div>';
 }
 xpFanControl(){
  const c=this.xpLive('number','fan_speed_control');
  if(!c)return '';
  const a=c.state.attributes||{}, min=Number(a.min??1), max=Number(a.max??8), step=Number(a.step??1);
  const v=Number(c.state.state);
  if(!Number.isFinite(v))return '';
  return '<label class="xp-ux-range-row"><span>'+xpIcon('fan',18)+' עוצמת מאוורר <b>'+xpEsc(v)+'</b></span>'
   +'<input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v+'" data-xp-range="fan_speed_control" aria-label="מהירות מאוורר"></label>';
 }

 xpClimateFeatures(){
   // All actionable tiles below correspond to native HA services supported
   // by Xpengtk. Do not treat quick-heat/cool status telemetry as a command.
   const climate=this.xpLive('climate','cabin_climate');
   const defrost=this.xpLive('switch','defrost_switch');
   const schedule=this.xpLive('calendar','hvac_schedule_calendar')||
     this.xpLive('sensor','hvac_schedules');
   const tiles=[];
   if(climate){
     const running=climate.state.state!=='off';
     tiles.push('<button type="button" class="xp-ux-climate-feature'
       +(running?' xp-ux-selected':'')+'" data-xp-climate="'+(running?'off':'on')
       +'" aria-pressed="'+String(running)+'">'
       +xpIcon('power',25)+'<span>מיזוג A/C</span><small>'
       +(running?'פעיל — לחץ לכיבוי':'כבוי — לחץ להפעלה')+'</small></button>');
   }
   if(climate){
     const a=climate.state.attributes||{};
     const hvacModes=Array.isArray(a.hvac_modes)?a.hvac_modes:[];
     if(hvacModes.includes('auto')){
       const active=climate.state.state==='auto';
       tiles.push('<button type="button" class="xp-ux-climate-feature'+(active?' xp-ux-selected':'')
         +'" data-xp-hvac-mode="auto" aria-pressed="'+String(active)+'">'+xpIcon('auto',25)
         +'<span>AUTO</span><small>'+(active?'פעיל':'מצב אוטומטי')+'</small></button>');
     }
     if(Array.isArray(a.swing_modes)&&a.swing_modes.length>1){
       const current=String(a.swing_mode||a.swing_modes[0]),n=a.swing_modes.indexOf(current);
       const next=a.swing_modes[(n+1)%a.swing_modes.length];
       tiles.push('<button type="button" class="xp-ux-climate-feature" data-xp-swing-mode="'+xpEsc(next)
         +'" title="'+xpEsc('החלף כיוון זרימת אוויר אל '+next)+'">'+xpIcon('refresh',25)
         +'<span>כיוון אוויר</span><small>'+xpEsc(current)+'</small></button>');
     }
   }
   // Xpengtk reports AUTO telemetry but normally only off/heat_cool remote modes.
   // A live indicator is not a fake control.
   if(climate&&!climate.state.attributes?.hvac_modes?.includes('auto')){
     const auto=this.xpLive('binary_sensor','climate_auto');
     if(auto&&['on','off'].includes(auto.state.state)){
       const on=auto.state.state==='on';
       tiles.push('<span class="xp-ux-climate-feature xp-ux-climate-readonly'+
         (on?' xp-ux-selected':'')+'" role="status" aria-label="מצב AUTO: '+(on?'פעיל':'כבוי')+'">'+
         xpIcon('auto',25)+'<span>AUTO</span><small>'+
         (on?'פעיל • חיווי בלבד':'כבוי • חיווי בלבד')+'</small></span>');
     }
   }
   const mirror=this.xpLive('binary_sensor','mirror_heating');
   if(mirror&&['on','off'].includes(mirror.state.state)){
     tiles.push('<span class="xp-ux-climate-feature xp-ux-climate-readonly" role="status">'+
       xpIcon('windscreen',25)+'<span>חימום מראות</span><small>'+
       (mirror.state.state==='on'?'פעיל • חיווי בלבד':'כבוי • חיווי בלבד')+'</small></span>');
   }
   if(defrost){
     const active=defrost.state.state==='on';
     tiles.push('<button type="button" class="xp-ux-climate-feature'
       +(active?' xp-ux-selected':'')+'" data-xp-switch="defrost_switch" aria-pressed="'
       +String(active)+'">'+xpIcon('windscreen',25)
       +'<span>הפשרת שמשה קדמית</span><small>'
       +(active?'פעיל':'כבוי')+'</small></button>');
   }
   if(schedule){
     tiles.push('<button type="button" class="xp-ux-climate-feature" data-xp-extra-page="schedule">'
       +xpIcon('clock',25)+'<span>תזמון מיזוג</span><small>הצג תזמונים קיימים</small></button>');
   }
   return tiles.length?'<div class="xp-ux-climate-features" role="group" aria-label="פונקציות מיזוג">'
     +tiles.join('')+'</div>':'';
 }

 xpSeatControls(){
  const slots=[
    ['driver','נהג','driver_seat_heat_select','driver_seat_ventilation_select'],
    ['passenger','נוסע','passenger_seat_heat_select','passenger_seat_ventilation_select'],
    ['rear_left','אחורי שמאל','left_rear_seat_heat_select','left_rear_seat_ventilation_select'],
    ['rear_right','אחורי ימין','right_rear_seat_heat_select','right_rear_seat_ventilation_select'],
    ['wheel','חימום הגה','steering_wheel_heat_select',null]
  ];
  const focus=this._xpSeatFocus;
  const controls=slots.filter(r=>!focus||r[0]===focus).map(([zone,title,heat,cool])=>{
    const rows=[['חימום',heat],['אוורור',cool]].filter(([,suffix])=>suffix&&this.xpLive('select',suffix));
    if(!rows.length)return '';
    return '<article class="xp-ux-seat"><h3>'+title+'</h3>'+rows.map(([label,suffix])=>{
      const ent=this.xpLive('select',suffix),current=ent.state.state;
      const choices=(Array.isArray(ent.state.attributes?.options)?ent.state.attributes.options:[]).filter(s=>typeof s==='string');
      // The passenger front heat Off command is not supported by the current integration.
      const options=choices.map(choice=>{
        const unsupported=title==='נוסע'&&suffix==='passenger_seat_heat_select'&&choice==='Off';
        const short=choice==='Off'?'כבוי':(/[1-3]/.exec(choice)?.[0]||choice);
        const active=choice===current?' xp-ux-selected':'';
        return '<button type="button" data-xp-select="'+xpEsc(suffix)+'" data-xp-option="'+xpEsc(choice)+'" class="'+active+'" '+(unsupported?'disabled title="כיבוי חימום נוסע אינו מאומת באינטגרציה"':'')+' aria-pressed="'+(choice===current)+'">'+xpEsc(short)+'</button>';
      }).join('');
      return '<div class="xp-ux-seat-line"><span>'+label+'</span><div class="xp-ux-seat-options">'+options+'</div></div>';
    }).join('')+'</article>';
  }).filter(Boolean).join('');
  return '<div class="xp-ux-seats-grid">'+(controls||'<p>לא נמצאו בקרות מושבים נתמכות לרכב זה.</p>')+'</div>';
 }
 xpPortPanel(){
   const status=this.xpLive('sensor','slow_charge_port')||this.xpLive('sensor','charge_port');
   const readable=this.xpActionState('port');
   const msg=readable===null?'מצב הדלתית אינו זמין או שכבל מחובר':readable==='open'?'דלתית פתוחה':'דלתית סגורה';
   return '<div class="xp-ux-port-panel"><div class="xp-ux-port-state">'+xpIcon('plug',34)+
     '<div><strong>דלתית שקע הטעינה</strong><small>'+xpEsc(msg)+'</small></div></div>'+
     '<div class="xp-ux-port-actions">'+this.xpToggleButton('port')+'</div>'+
     '<p class="xp-ux-note">לחיצה אחת הופכת את מצב הדלתית על סמך חיווי Xpengtk. אין שחרור כבל.</p></div>';
 }
 xpAccessAllowed(){
   const opt=this.vehicle()?.enable_access_controls??this._config.enable_access_controls??false;
   return opt===true||opt==='true';
 }
 xpDoorsPanel(){
   const entry=this.xpLive('lock','door_lock');
   const doors=[['driver_door','דלת נהג'],['passenger_door','דלת נוסע'],['rear_left_door','אחורי שמאל'],['rear_right_door','אחורי ימין']];
   const status=doors.map(([key,label])=>{
     const e=this.xpLive('binary_sensor',key);if(!e)return '';
     return '<div class="xp-ux-access-state"><span>'+label+'</span><strong>'+
       (e.state.state==='on'?'פתוחה':e.state.state==='off'?'סגורה':xpEsc(e.state.state))+'</strong></div>';
   }).join('');
   return '<div class="xp-ux-access-panel"><div class="xp-ux-access-head">'+xpIcon('lock',36)+
     '<div><h3>נעילת רכב</h3><p>'+xpEsc(entry?.state?.state||'לא זמין')+'</p></div></div>'+
     '<div class="xp-ux-access-states">'+status+'</div><div class="xp-ux-access-buttons">'+
     this.xpToggleButton('doors')+'</div>'+
     '<p class="xp-ux-note">נעילה ושחרור נעילה מתבצעים בלחיצה אחת, בהתאם למצב. שחרור מחייב הרשאת Access.</p></div>';
 }
 xpWindowsPanel(){
   const status=this.xpActionState('windows');
   return '<div class="xp-ux-access-panel"><div class="xp-ux-access-head">'+xpIcon('car',36)+
     '<div><h3>חלונות</h3><p>'+xpEsc(status===null?'מצב לא ידוע':status==='open'?'פתוחים':'סגורים')+'</p></div></div>'+
     '<div class="xp-ux-access-buttons">'+this.xpToggleButton('windows')+'</div>'+
     '<p class="xp-ux-note">פתיחת חלונות דורשת הרשאת Access. אין פקודה כאשר מצבם אינו ידוע.</p></div>';
 }
 xpTrunkPanel(){
   const state=this.xpActionState('trunk');
   const status=state==='open'?'פתוח':state==='closed'?'סגור':'לא ידוע';
   return '<div class="xp-ux-access-panel"><div class="xp-ux-access-head">'+xpIcon('trunk',36)+
     '<div><h3>תא המטען</h3><p>מצב נוכחי: '+xpEsc(status)+'</p></div></div>'+
     '<div class="xp-ux-access-buttons">'+this.xpToggleButton('trunk')+'</div>'+
     '<p class="xp-ux-note">פתיחת תא המטען מחייבת הרשאת Access. אם החיישן לא מדווח מצב ברור, לא תישלח פקודה.</p></div>';
 }
 xpMapPanel(){
   const location=this.xpLive('device_tracker','location');
   const horn=this.xpLive('button','honk_horn');
   const lights=this.xpLive('button','flash_lights');
   return '<div class="xp-ux-map-panel"><div class="xp-ux-map-stage" role="region" aria-label="מפת מיקום הרכב" data-xp-map-host>'
    +(location?'טוען מפה…':'מיקום הרכב אינו זמין')+'</div>'
    +'<div class="xp-ux-map-actions">'
    +'<button type="button" data-xp-map-action="honk_horn" '+(horn?'':'disabled')
    +'>'+xpIcon('horn',20)+' צופר</button>'
    +'<button type="button" data-xp-map-action="flash_lights" '+(lights?'':'disabled')
    +'>'+xpIcon('flash',20)+' הבהוב</button></div></div>';
 }
 async xpMountMap(){
   if(this._xpPanel!=='map')return;
   const host=this.shadowRoot?.querySelector?.('[data-xp-map-host]');
   const gps=this.xpLive('device_tracker','location');
   if(!host||!gps)return;
   try{
     // Use the Home Assistant native map card, not a hardcoded coordinate or third-party tile URL.
     const helper=typeof window.loadCardHelpers==='function'?await window.loadCardHelpers():null;
     if(!helper){host.textContent='המפה המובנית אינה זמינה בכרטיס זה כרגע.';return;}
     if(this._xpPanel!=='map'||!this.shadowRoot?.contains?.(host))return;
     const map=helper.createCardElement({type:'map',entities:[{entity:gps.id}],
       default_zoom:11,hours_to_show:0,dark_mode:true});
     map.hass=this._hass;
     host.replaceChildren(map);
   }catch(err){
     host.textContent='המפה אינה זמינה בתוך הכרטיס כרגע.';
   }
 }
 xpModal(){
   if(!this._xpPanel||(!this.xpUiEnabled()&&!['maintenance','map'].includes(this._xpPanel)))return '';
   const page=this._xpPanel;
   if(!['climate','port','doors','windows','trunk','map','maintenance','charge_controls','charge_schedule','extras'].includes(page))return '';
   const labels={climate:'מיזוג אוויר',port:'שקע טעינה',doors:'דלתות',windows:'חלונות',charge_controls:'פעולות טעינה',charge_schedule:'תזמוני טעינה',maintenance:'תחזוקת הרכב',trunk:'תא מטען',map:'מיקום הרכב',extras:'אפשרויות נוספות'};
   let body='';
   if(page==='climate'){
     body='<div class="xp-climate-layout">'+this.xpCabinView()+
       '<section class="xp-ux-climate-bottom" aria-label="בקרת אקלים">'+
       this.xpTempControl()+this.xpFanControl()+this.xpClimateFeatures()+'</section></div>';
   }else if(page==='charge_controls')body='<div class="xp-ux-charging-panel">'+(this.xpChargeControls()||'<p>אין פקודות טעינה זמינות לרכב כרגע.</p>')+this.xpPortPanel()+'</div>';
   else if(page==='charge_schedule')body=this.xpChargeSchedulesPanel();
   else if(page==='maintenance')body=this.xpMaintenancePanel();
   else if(page==='port')body=this.xpPortPanel();
   else if(page==='doors')body=this.xpDoorsPanel();
   else if(page==='windows')body=this.xpWindowsPanel();
   else if(page==='trunk')body=this.xpTrunkPanel();
   else if(page==='map')body=this.xpMapPanel();
   else if(page==='extras')body=this.xpExtrasPanel();
   return '<section class="xp-ux-modal xp-ux-modal-'+page+'" role="dialog" aria-modal="true" aria-label="'+labels[page]+'" dir="rtl">'
    +'<header class="xp-ux-modal-head"><button type="button" data-xp-close aria-label="חזרה לבית">'+xpIcon('back',24)+'</button>'
    +'<h2>'+labels[page]+'</h2><span>'+xpEsc(this.appearance().model)+'</span></header>'
    +body+(this._xpNotice?'<p class="xp-ux-notice" role="status">'+xpEsc(this._xpNotice)+'</p>':'')
    +'</section>';
 }

 xpMaintenancePanel(){
   const odometer=this.num('odometer','km');
   const maint=this.xpLive('sensor','maintenance');
   const ident=this.xpLive('sensor','vehicle_identity');
   const attrs=ident?.state?.attributes||{};
   const masked=typeof attrs.vin_masked==='string'&&attrs.vin_masked.trim()?attrs.vin_masked:'—';
   const line=(name,value)=>'<div class="xp-extra-line"><span>'+xpEsc(name)+'</span><b>'+xpEsc(value)+'</b></div>';
   const info=[
     line('קילומטראז׳',odometer),
     line('הטיפול הבא',maint?.state?.state||'—'),
     line('תאריך טיפול',maint?.state?.attributes?.next_date||'—'),
     line('ק״מ שנותרו לטיפול',maint?.state?.attributes?.km_remaining??'—'),
     line('מספר שלדה (מוסתר)',masked),
     line('דגם',attrs.vehicle_type_name||attrs.model_family||this.model()),
     line('שנת דגם',attrs.model_year||this.year()),
     line('יצרן',attrs.manufacturer||'XPENG'),
     line('גרסת XOS',this.xpLive('sensor','xos_version')?.state?.state||'—')
   ].join('');
   return '<div class="xp-maintenance-page"><h3>לחץ אוויר בארבעת הצמיגים</h3>'+
      this.tireScreen(false)+'<h3>תחזוקה ופרטי רכב</h3><div class="xp-maint-info">'+info+'</div>'+
      '<p class="xp-ux-note">הערכים מתעדכנים לפי Home Assistant. מספר השלדה המלא אינו חשוף באינטגרציה.</p></div>';
 }
 xpChargeSchedulesPanel(){
   const start=this.xpLive('sensor','charge_schedule_start');
   const end=this.xpLive('sensor','charge_schedule_end');
   const row=(label,v)=>'<div class="xp-extra-line"><span>'+label+'</span><b>'+xpEsc(v)+'</b></div>';
   return '<div class="xp-ux-charge-schedule">'+
     row('שעת התחלת טעינה',start?.state?.state||'—')+
     row('שעת סיום טעינה',end?.state?.state||'—')+
     '<p class="xp-ux-note">Xpengtk מספקת חיישני תזמון טעינה לקריאה בלבד. אין כרגע פקודת שינוי תזמון טעינה מאומתת.</p></div>';
 }

 xpExtraLive(domain,suffix){return this.xpLive(domain,suffix);}
 xpExtraValue(domain,suffix){
   const e=this.xpExtraLive(domain,suffix);
   return e?xpEsc(e.state.state):'—';
 }
 xpExtraLine(label,domain,suffix,unit=''){
   const e=this.xpExtraLive(domain,suffix);
   if(!e)return '';
   const u=unit||e.state.attributes?.unit_of_measurement||'';
   return '<div class="xp-extra-line"><span>'+xpEsc(label)+'</span><b>'
     +xpEsc(e.state.state)+(u?' <small>'+xpEsc(u)+'</small>':'')+'</b></div>';
 }
 xpExtraNumber(label,suffix){
   const e=this.xpExtraLive('number',suffix);
   if(!e)return '';
   const attrs=e.state.attributes||{},now=Number(e.state.state);
   const min=Number(attrs.min),max=Number(attrs.max),step=Number(attrs.step);
   if(!Number.isFinite(now)||!Number.isFinite(min)||!Number.isFinite(max)||!Number.isFinite(step)||step<=0)return '';
   return '<label class="xp-extra-range"><span>'+xpEsc(label)+' <b>'+xpEsc(now)
     +'</b></span><input type="range" data-xp-range="'+xpEsc(suffix)
     +'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+now
     +'" aria-label="'+xpEsc(label)+'"></label>';
 }
 xpExtraAction(label,action,domain,suffix,restricted=false){
   const e=this.xpExtraLive(domain,suffix);
   if(!e)return '';
   const disabled=restricted&&!this.xpAccessAllowed();
   return '<button type="button" class="xp-extra-action" data-xp-extra-action="'+xpEsc(action)+'" '
     +(disabled?'disabled title="פעולה זו דורשת הרשאת Access באינטגרציה ובהגדרות הכרטיס"':'')
     +'>'+xpEsc(label)+'</button>';
 }
 xpExtraSectionContent(section){
   if(section==='security'){
     const guard=this.xpExtraLive('switch','sentinel_switch');
     let out=this.xpExtraLine('X-Guard','switch','sentinel_switch');
     if(guard?.state.state==='off')out+=this.xpExtraAction('הפעל X-Guard','guard_on','switch','sentinel_switch');
     else if(guard?.state.state==='on')out+=this.xpExtraAction('כבה X-Guard','guard_off','switch','sentinel_switch',true);
     out+=this.xpExtraNumber('רגישות השמירה','sentinel_sensitivity_control');
     return out||'<p>לא נמצאו ישויות אבטחה זמינות לרכב זה.</p>';
   }
   if(section==='energy'){
     const lines=[
       ['צריכה ממוצעת ב־7 ימים','energy_consumption_7_day_avg'],
       ['צריכת אנרגיה בחניה','parked_consumption'],
       ['אנרגיה בטעינה האחרונה','last_charge_energy'],
       ['משך הטעינה האחרונה','last_charge_duration'],
       ['טווח שנוסף בטעינה','last_charge_range_added'],
       ['נסועה כוללת','odometer']
     ].map(([title,key])=>this.xpExtraLine(title,'sensor',key)).join('');
     return lines||'<p>אין כרגע נתוני אנרגיה זמינים.</p>';
   }
   if(section==='schedule'){
     const schedule=this.xpExtraLive('sensor','hvac_schedules');
     const calendar=this.xpExtraLive('calendar','hvac_schedule_calendar');
     let out=schedule?this.xpExtraLine('תזמונים מוגדרים','sensor','hvac_schedules'):'';
     const items=schedule?.state.attributes?.schedules;
     if(Array.isArray(items)){
       out+=items.slice(0,8).map(x=>{
         if(!x||typeof x!=='object')return '';
         const time=x.start_time||'—',days=Array.isArray(x.days)?x.days.join(', '):'';
         const id=x.appointment_id==null?'':String(x.appointment_id);
         const control=id?this.xpLive('switch','hvac_schedule_'+id):null;
         const active=control?.state.state==='on';
         const available=control&&['on','off'].includes(control.state.state);
         return '<div class="xp-extra-schedule-line"><div class="xp-extra-line"><span>'
           +xpEsc(days||'תזמון מיזוג')+'</span><b>'+xpEsc(time)+'</b></div>'
           +(available?'<button type="button" class="xp-extra-schedule-toggle" data-xp-hvac-schedule="'
             +xpEsc(id)+'" aria-label="'+(active?'השבת תזמון':'הפעל תזמון')+'">'
             +(active?'פעיל · השבת':'כבוי · הפעל')+'</button>':'')
           +'</div>';
       }).join('');
     }
     if(calendar)out+='<button type="button" class="xp-extra-action" data-xp-extra-detail="calendar">הצג לוח תזמוני מיזוג</button>';
     return out||'<p>אין לוח תזמוני מיזוג זמין באינטגרציה. לא ניצור תזמון מדומה.</p>';
   }
   if(section==='power'){
     const power=this.xpExtraLive('switch','trunk_power_switch');
     let out=this.xpExtraLine('שקע חשמל בתא המטען','switch','trunk_power_switch');
     if(power?.state.state==='off')out+=this.xpExtraAction('הפעל שקע V2L','v2l_on','switch','trunk_power_switch');
     else if(power?.state.state==='on')out+=this.xpExtraAction('כבה שקע V2L','v2l_off','switch','trunk_power_switch');
     out+=this.xpExtraNumber('טיימר לכיבוי אוטומטי (דקות)','trunk_power_timer_control');
     return out||'<p>בקרות V2L אינן זמינות בדגם או בהרשאות האינטגרציה.</p>';
   }
   if(section==='maintenance'){
     const maintenance=this.xpExtraLive('sensor','maintenance');
     let out=this.xpExtraLine('הטיפול הבא','sensor','maintenance');
     if(maintenance){
       const attrs=maintenance.state.attributes||{};
       for(const [field,label] of [['next_date','תאריך טיפול'],['days_remaining','ימים נותרו'],
         ['km_remaining','קילומטרים נותרו']]){
         const v=attrs[field];
         if(v!==null&&v!==undefined&&v!=='')out+='<div class="xp-extra-line"><span>'+label+'</span><b>'+xpEsc(v)+'</b></div>';
       }
       out+='<button type="button" class="xp-extra-action" data-xp-extra-detail="maintenance">פרטי תחזוקה ב־Home Assistant</button>';
     }
     return this.xpMaintenancePanel()+(out?'<div class="xp-maint-additional">'+out+'</div>':'');
   }
   if(section==='updates'){
     let out=this.xpExtraLine('גרסת XOS','sensor','xos_version');
     out+=this.xpExtraLine('עדכוני תוכנה','sensor','ota_upgrade');
     const auto=this.xpExtraLive('switch','auto_upgrade_switch');
     if(auto?.state.state==='on')out+=this.xpExtraAction('כבה עדכונים אוטומטיים','ota_off','switch','auto_upgrade_switch');
     else if(auto?.state.state==='off')out+=this.xpExtraAction('הפעל עדכונים אוטומטיים','ota_on','switch','auto_upgrade_switch');
     if(this.xpExtraLive('sensor','ota_upgrade'))out+='<button type="button" class="xp-extra-action" data-xp-extra-detail="ota">פרטי עדכון</button>';
     return out||'<p>אין נתוני גרסה או עדכונים זמינים.</p>';
   }
   return '';
 }
 xpExtrasPanel(){
   const sections=[
     ['security','shield','X-Guard','אבטחה ורגישות השמירה'],
     ['schedule','clock','תזמון מיזוג','תזמונים קיימים'],
     ['energy','gauge','נתוני אנרגיה','צריכה והיסטוריית טעינה'],
     ['power','plug','V2L','חשמל בתא המטען'],
     ['maintenance','settings','תחזוקה','הטיפול הבא'],
     ['updates','refresh','עדכוני תוכנה','XOS ו־OTA']
   ];
   const section=sections.find(x=>x[0]===this._xpExtraSection);
   if(section){
     return '<div class="xp-extra-body"><div class="xp-extra-heading"><strong>'+xpEsc(section[2])+'</strong></div>'
       +'<div class="xp-extra-details">'+this.xpExtraSectionContent(section[0])+'</div>'
       +'<p class="xp-ux-note">המידע מגיע מ־Xpengtk. הפקודות פועלות לפי הרשאות Home Assistant והרכב בלבד.</p></div>';
   }
   return '<div class="xp-extra-body"><p class="xp-extra-subtitle">אפשרויות נוספות לרכב — שבעת קיצורי הדרך נשארים במסך הבית בלבד.</p>'
     +'<div class="xp-extra-grid">'+sections.map(([id,icon,title,detail])=>
       '<button type="button" class="xp-extra-tile" data-xp-extra-page="'+id+'">'
       +xpIcon(icon,30)+'<b>'+title+'</b><small>'+detail+'</small></button>').join('')
     +'</div></div>';
 }

 xpVehiclePanel(){
   // Display status only if Xpengtk provides the associated entity.
   const statuses=[
     ['lock','door_lock','נעילת דלתות'],
     ['binary_sensor','windows','חלונות'],
     ['binary_sensor','doors','דלתות'],
     ['binary_sensor','trunk','תא מטען'],
     ['sensor','charge_port','שקע טעינה'],
     ['binary_sensor','sentinel_mode','מצב X-Guard']
   ].map(([domain,suffix,label])=>{
     const e=this.xpLive(domain,suffix);
     if(!e)return '';
     const raw=e.state.state, state=domain==='lock'
       ?({locked:'נעול',unlocked:'לא נעול',locking:'נועל',unlocking:'פותח'}[raw]||raw)
       :domain==='binary_sensor'?({on:'פעיל / פתוח',off:'כבוי / סגור'}[raw]||raw):raw;
     return '<article class="xp-ux-vehicle-state"><small>'+label+'</small><strong>'+xpEsc(state)+'</strong></article>';
   }).filter(Boolean).join('');
   // Safe / securing controls only; Access (unlock, open doors,
   // open trunk, open windows, disarm security) is deliberately not here.
   const buttons=[
      ['lock','lock','door_lock','נעילת דלתות','lock'],
      ['button','press','close_windows','סגירת חלונות','car'],
      ['button','press','close_trunk','סגירת תא מטען','car'],
      ['button','press','flash_lights','הבהוב אורות','sun'],
      ['button','press','honk_horn','צפירה','info']
   ].filter(([domain,service,suffix])=>!!this.xpLive(domain,suffix));
   const xGuard=this.xpLive('switch','sentinel_switch');
   if(xGuard?.state?.state==='off')buttons.push(['switch','turn_on','sentinel_switch','הפעלת X-Guard','shield']);
   const actionHtml=buttons.map(([domain,service,suffix,label,icon])=>
     '<button type="button" data-xp-vehicle="'+xpEsc(domain+'.'+service+'.'+suffix)+'">'
       +xpIcon(icon,18)+'<span>'+label+'</span></button>').join('');
   return '<div class="xp-ux-vehicle-panel">'
     +(statuses?'<div class="xp-ux-vehicle-statuses">'+statuses+'</div>':'')
     +(actionHtml?'<h3>פעולות זמינות</h3><div class="xp-ux-vehicle-buttons">'+actionHtml+'</div>':'<p>אין כרגע פקודות זמינות באינטגרציה.</p>')
     +'<p class="xp-ux-note">לא מוצגות פקודות פתיחת נעילה, פתיחת חלונות או תא מטען. פעולות רגישות דורשות אישור ויעברו דרך הרשאות Xpengtk.</p>'
     +'</div>';
 }
 xpChargeControls(){
  if(!this.xpUiEnabled())return '';
  const stop=this.xpLive('button','stop_charge');
  const limit=this.xpLive('number','charge_limit_control');
  const controls=[];
  if(stop)controls.push('<button class="xp-ux-charge-stop" type="button" data-xp-command="stop_charge">'+xpIcon('plug',19)+' הפסק טעינה</button>');
  if(limit){
    const n=Number(limit.state.state),a=limit.state.attributes||{};
    if(Number.isFinite(n))controls.push('<label class="xp-ux-charge-limit"><span>הגבלת טעינה <b>'+xpEsc(xpNum(n))+'%</b></span>'
      +'<input type="range" data-xp-range="charge_limit_control" min="'+Number(a.min??50)+'" max="'+Number(a.max??100)+'" step="'+Number(a.step??5)+'" value="'+n+'" aria-label="הגבלת טעינה"></label>');
  }
  return controls.length?'<div class="xp-ux-charge-actions" dir="rtl">'+controls.join('')+'</div>':'';
 }
 xpDetails(suffix,domain){
  const entity=this.xpLive(domain,suffix);
  if(!entity)return;
  this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:entity.id},bubbles:true,composed:true}));
 }
 async xpSend(domain,service,suffix,value,verifiedDirectTap=false){
  const entity=this.xpLive(domain,suffix);
  if(!entity||typeof this._hass?.callService!=='function')return;
  const data={entity_id:entity.id};
  if(service==='set_value')data.value=value;
  else if(service==='set_temperature')data.temperature=value;
  else if(service==='select_option')data.option=value;
  else if(service==='set_hvac_mode')data.hvac_mode=value;
  else if(service==='set_swing_mode')data.swing_mode=value;
  const sensitive=(domain==='lock'||suffix==='stop_charge'||suffix==='open_trunk'||suffix==='open_charge_port'||suffix==='close_charge_port'||suffix==='close_trunk'||suffix==='close_windows'||suffix==='open_windows'||suffix==='honk_horn'||suffix==='flash_lights'||suffix==='sentinel_switch'||suffix.startsWith('hvac_schedule_'));
  // One-tap means one click for verified status-driven lock/windows/flap actions.
  // Never bypass confirmation for arbitrary callers or other sensitive operations.
  const directAllowed=verifiedDirectTap&&(
    (domain==='lock'&&suffix==='door_lock'&&['lock','unlock'].includes(service))||
    (domain==='button'&&service==='press'&&
      ['open_windows','close_windows','open_charge_port','close_charge_port','open_trunk','close_trunk'].includes(suffix))
  );
  if((sensitive||['trunk_power_switch','auto_upgrade_switch','sentinel_sensitivity_control','trunk_power_timer_control'].includes(suffix))
     &&!directAllowed&&typeof window.confirm==='function'
     &&!window.confirm('לשלוח את הפקודה לרכב?'))return;
  try{
    await this._hass.callService(domain,service,data);
    this._xpNotice='הפקודה נשלחה ל־Home Assistant. יש לוודא שהרכב אישר את הפעולה.';
  }catch(err){
    this._xpNotice='שגיאה בשליחת הפקודה: '+(err?.message||'נסה שוב');
  }
  this.render();
 }
 xpDoTemperature(direction){
  const c=this.xpLive('climate','cabin_climate');
  if(!c)return;
  const a=c.state.attributes||{};
  if(a.temperature===null||a.temperature===undefined||a.temperature==='')return;
  const now=Number(a.temperature),step=Number(a.target_temp_step)||.5;
  if(!Number.isFinite(now)||now<Number(a.min_temp??16)||now>Number(a.max_temp??32))return;
  const target=Math.round(Math.max(Number(a.min_temp??16),Math.min(Number(a.max_temp??32),now+direction*step))*10)/10;
  if(target!==now)this.xpSend('climate','set_temperature','cabin_climate',target);
 }

 connectedCallback(){if(!this._fullscreenHandler){this._fullscreenHandler=()=>{if(!document.fullscreenElement&&this._expanded){this._expanded=false;this.render();}};}document.addEventListener('fullscreenchange',this._fullscreenHandler);}
 disconnectedCallback(){if(this._fullscreenHandler)document.removeEventListener('fullscreenchange',this._fullscreenHandler);}
 toggleFullScreen(){this._expanded=!this._expanded;if(this._expanded&&this.requestFullscreen){this.requestFullscreen().catch(()=>{});}else if(!this._expanded&&document.fullscreenElement===this){document.exitFullscreen().catch(()=>{});}this.render();}
 setConfig(config){
  if(!config||typeof config!=='object')throw Error('XPENG card configuration required');
  if(config.prefix&&!/^[a-z0-9_]+$/.test(config.prefix))throw Error('XPENG prefix must be a slug');
  if(config.image_path&&!/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_-]+\/?$/.test(config.image_path))throw Error('Invalid local image_path');
  if(config.background_image&&!xpLocalArtworkPath(config.background_image))throw Error('Invalid local background_image');
  const v={prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'graphite_gray',interior:'dark_gray',theme:'dark',...config};
  this._config=xpNormalizeAppearance(v);this._infoOpen=false;this._tireOpen=false;this._xpManualCharging=false;this._xpChargingDismissed=false;this._xpLastActualCharging=false;this.render();
 }
 set hass(hass){
  this._hass=hass;
  if(!this._xpengRegistryLoaded)this.ensureXpengRegistry();
  const actualCharging=this.xpChargingActive();
  if(actualCharging&&!this._xpLastActualCharging){
    this._xpChargingDismissed=false;this._xpManualCharging=false;
    this._xpPanel=null;this._xpSeatFocus=null;
  }
  if(!actualCharging)this._xpChargingDismissed=false;
  this._xpLastActualCharging=actualCharging;
  if(actualCharging&&!this._xpChargingDismissed)this._tireOpen=false;
  this.render();
 }
 get hass(){return this._hass;}
 getCardSize(){return 8;}
 static getConfigElement(){return document.createElement('xpeng-vehicle-card-editor');}
 static getStubConfig(){return {type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'graphite_gray',interior:'dark_gray'};}
 vehicles(){return Array.isArray(this._config.vehicles)&&this._config.vehicles.length?this._config.vehicles:[this._config];}
 vehicle(){return this.vehicles()[Math.min(this._vehicleIndex,this.vehicles().length-1)];}
 prefix(){return this.vehicle()?.prefix||this._config.prefix||'my_xpeng';}
 // Vehicle model, year, trim and both colours are MANUALLY selected in the card editor/YAML only.
 appearance(){return xpNormalizeAppearance({...this._config,...this.vehicle()});}
 model(){return this.appearance().model;}
 year(){return this.appearance().year;}
 paint(){return this.appearance().color;}
 data(key){
   const spec=XP_KEYS[key];if(!spec)return null;
   const override=xpSensorMappingMode(this._config,this.vehicle())==='manual'?(this.vehicle()?.entities?.[key]??this._config.entities?.[key]):null;
   const custom=override?xpParseEntityMapping(override):null;
   const ids=custom?[custom.id]:[
     ...(XP_UNIQUE_KEYS[key]||[]).map(([domain,suffix])=>this._xpengByKey?.[domain+'.'+suffix]).filter(Boolean),
     ...spec.slice(1).map(s=>spec[0]+'.'+this.prefix()+'_'+s),
     ...(XP_XPENGTK_KEYS[key]||[]).map(([domain,suffix])=>domain+'.'+this.prefix()+'_'+suffix)
   ];
   const id=ids.find(x=>this._hass?.states?.[x]&&!XP_INVALID.has(String(this._hass.states[x].state).trim().toLowerCase()))
     ||ids.find(x=>this._hass?.states?.[x])||ids[0];
   const entity=this._hass?.states?.[id];
   const attribute=custom?.attribute;
   const attrs=entity?.attributes;
   const raw=attribute
     ?(attrs&&Object.prototype.hasOwnProperty.call(attrs,attribute)?attrs[attribute]:null)
     :(entity?.state??null);
   const valid=raw!==null&&raw!==undefined&&!(typeof raw==='string'&&XP_INVALID.has(raw.trim().toLowerCase()));
   return {id,entity,attribute,value:valid?raw:null};
 }
 val(key){return this.data(key)?.value??null;}
 number(key){const v=this.val(key);return v===null||v===''||!Number.isFinite(Number(v))?null:Number(v);}
 bool(key){return xpBool(this.val(key));}
 num(key,unit='',dec=0){const v=this.number(key);return v===null?'—':xpNum(v,dec)+(unit?' '+unit:'');}
 artworkUrl(relative){
    const configuredBase=this._config.image_path;
    const base=(!configuredBase||configuredBase==='/hacsfiles/xpeng-vehicle-card/assets')?null:configuredBase.replace(/\/$/,'');
    return base?base+'/'+relative:xpPackagedUrl(relative);
  }
  assetSpec(){
    const bundled=relative=>this.artworkUrl(relative);
    const profileArt=key=>Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.[key]:this.vehicle()?.[key]||this._config[key];
    const chosen=(this._view==='charging'&&profileArt('charging_image'))||profileArt('image');
    const a=this.appearance(),model=xpAssetModel(a.model),view=this._view==='charging'?'rear':'front';
    if(xpLocalArtworkPath(chosen)&&!this._failedArtwork.has(chosen))
      return {src:chosen,illustrative:false,studio:false,tier:'manual',view,view_status:'owner_supplied',
        description:'Owner-supplied artwork for '+a.model+' '+a.color};
    // Prefer separately packaged and verified three-view assets when present.
    // A view must never silently reuse a front render as a rear or overhead render.
    // Preserve the existing separately supplied charging artwork and geometry.
    // The owner approved the original left-side charging metrics layout but the
    // reference shows a front three-quarter G6, never the rear-facing cutout.
    const candidate=xpVehicleAssetPath(a,view==='rear'?'charging':'front');
    if(candidate&&XP_ARTWORK_INDEX.has(candidate)&&!this._failedArtwork.has(bundled(candidate))){
      const generated=XP_ILLUSTRATIVE_ARTWORK_INDEX.has(candidate);
      return {src:bundled(candidate),illustrative:generated,studio:false,tier:generated?'generated-preview':'exact-view',view,
        view_status:generated?'ai_generated_preview':'matching_view',description:(generated?'AI-generated illustration (not official photography): ':'Matched ')+a.model+' '+a.year+' '+a.color+' '+view};
    }
    return {src:this.placeholderArt(),illustrative:true,studio:false,tier:'silhouette',view,
      view_status:'image_pending',description:'Transparent model+paint preview pending for '+a.model+' '+a.color};
  }
  asset(){return this.assetSpec().src;}
  placeholderArt(){
    const a=this.appearance(),colour=XP_PAINTS.find(x=>x.id===a.color)?.hex||'#b6bdc2';
    const shape=xpModel(a.model)?.shape||'suv';
    const roof=shape==='mpv'?'M140 220L200 83H613L735 225':shape.includes('sedan')||shape==='fastback'?'M140 220L298 125H558L735 225':'M140 220L246 105H607L735 225';
    const label=xpEsc(a.model);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 420">'+
      '<path d="'+roof+'L785 254L774 324H67L65 253Z" fill="'+colour+'" stroke="#9dbad4" stroke-width="4"/>'+
      '<circle cx="223" cy="325" r="61" fill="#08101e" stroke="#8297ad" stroke-width="11"/>'+
      '<circle cx="649" cy="325" r="61" fill="#08101e" stroke="#8297ad" stroke-width="11"/>'+
      '<text x="425" y="397" text-anchor="middle" fill="#c2d9f1" font-family="Arial" font-size="20">'+label+' • Preview artwork</text>'+
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  lastUpdate(){
   // Home Assistant's last_updated is not necessarily a vehicle refresh.
   const t=this.val('last_update');if(!t)return 'Unavailable';
   const parsed=Date.parse(String(t));if(!Number.isFinite(parsed))return String(t);
   return new Date(parsed).toLocaleString(this._hass?.locale?.language||undefined,{dateStyle:'medium',timeStyle:'short'});
 }
  tirePressureBar(key){
    const d=this.data(key),n=this.number(key);
    if(n===null||n<0)return null;
    const unit=String(d?.entity?.attributes?.unit_of_measurement||'kPa').trim().toLowerCase();
    let bar=null;
    if(unit==='kpa')bar=n/100;
    else if(unit==='bar')bar=n;
    else if(unit==='psi')bar=n*0.0689475729;
    else if(unit==='pa')bar=n/100000;
    return bar!==null&&bar>=0.5&&bar<=6?bar:null;
  }

 tireSummary(){
  const values=['tire_fl','tire_fr','tire_rl','tire_rr'].map(k=>this.tirePressureBar(k));
  if(values.some(v=>v===null))return '—';
  return xpNum(values.reduce((a,b)=>a+b,0)/4,2)+' bar';
 }
 locationText(){
  const d=this.data('location');const raw=d?.value;
  if(!raw)return 'Unavailable';
  if(raw==='not_home')return 'Away';
  return String(raw).replace(/_/g,' ');
 }
 remainingText(){
   const min=this.number('remaining');
   if(min===null||min<0)return '—';
   return Math.floor(min/60)+'h '+Math.round(min%60)+'m';
 }
 chargeStatus(){
  const v=xpChargingActive(this.val('charging')),plug=this.bool('plugged');
  if(v===true)return 'Charging now';
  if(plug===true)return 'Plugged in';
  if(v===false)return 'Not charging';
  return 'Charging unavailable';
 }
 title(){
  return `<div class="xp-title"><h1>XPENG <em>${xpEsc(this.model())}</em></h1><div class="xp-subtitle">${this._view==='charging'?xpEsc(this.chargeStatus()):this._tireOpen?'Tire pressure':'Vehicle status'}</div></div>`;
 }
 sceneBackdrop(){
    // The scenic background belongs to the DASHBOARD, not to a model image folder.
    // Identical pixel source and placement in both vehicle status and charging.
    // One real image layer, shared for charging and overview. No CSS mountain or sky illustration.
    // A manual dashboard-wide background never changes when vehicle/colour/charging changes.
    const source=this._config.background_image||XP_SCENE_BACKGROUND;
    return `<div class="xp-night-photo" aria-hidden="true"
      style="background-image:url(&quot;${xpEsc(source)}&quot;)"></div>`;
  }
 header(){
   const connection=this.val('connection'),status=xpConnText(connection);
   const stateClass=status==='Connected'?'xp-connected':status==='Connection error'?'xp-error':'xp-disconnected';
   return `<header class="xp-header"><div class="xp-brand"><span class="xp-x-mark">✕</span><span>XPENG</span></div>
     <div class="xp-header-right"><div class="xp-meta-tools">
        ${this.xpUiEnabled()&&this._view!=='charging'&&!this._xpPanel?'<button type="button" class="xp-more-trigger" data-xp-more aria-label="אפשרויות נוספות" title="אפשרויות נוספות">'+xpIcon('settings',21)+'</button>':''}
       <button class="xp-wifi ${stateClass}" type="button" data-meta-toggle
         aria-label="Vehicle communication details" aria-expanded="${this._infoOpen?'true':'false'}"
         aria-controls="xp-last-update-details" title="Vehicle communication details">
         <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
           stroke-width="2.3" stroke-linecap="round" aria-hidden="true">
           <path d="M2 8c5.7-5.6 14.3-5.6 20 0M5 12c4-3.6 10-3.6 14 0M9 16c1.8-1.4 4.2-1.4 6 0"/>
           <circle cx="12" cy="20" r="1.3" fill="currentColor" stroke="none"/></svg></button>
       ${this._infoOpen?`<div id="xp-last-update-details" class="xp-meta-popover" role="region"
         aria-label="Vehicle connection and last update">
           <div class="xp-meta-field"><small>Connection</small><strong>${xpEsc(status)}</strong></div>
           <div class="xp-meta-field"><small>Last vehicle update</small><strong>${xpEsc(this.lastUpdate())}</strong></div>
         </div>`:''}
     </div></div></header>`;
 }
 progress(){
   const soc=xpPercent(this.val('soc'));
   return `<div class="xp-progress" role="progressbar" aria-label="Battery state of charge" aria-valuemin="0" aria-valuemax="100" ${soc===null?'':'aria-valuenow="'+soc+'"'}>
      <div style="width:${soc??0}%"></div></div>`;
 }
 socHtml(){
  const v=this.number('soc');return v===null?'—':xpNum(v)+'<span class="xp-unit">%</span>';
 }
 interiorPreview(){
    const a=this.appearance(),finish=XP_INTERIORS.find(x=>x.id===a.interior)||XP_INTERIORS[0];
    const override=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.interior_image:this.vehicle()?.interior_image||this._config.interior_image;
    const image=a.model==='G6'?this.artworkUrl('vehicles/g6/interior_'+a.interior+'.webp'):override;
    if(a.model==='G6'||xpLocalArtworkPath(image))
      return '<img class="xp-cabin-mini" src="'+xpEsc(image)+'" loading="lazy" alt="'+xpEsc(a.model+' '+finish.label+' interior')+'">';
    return '<p class="xp-cabin-mini" role="status">תמונת פנים לא זמינה לדגם זה.</p>';
 }
  carArt(){
    const a=this.appearance(),spec=this.assetSpec();
    const referenceCutout=a.model==='G6'&&a.color==='arctic_white'&&(spec.tier==='highest-trim-preview'||/\/xpeng-g6-2026-white-cutout\.(?:png|webp)$/.test(spec.src));
    return `<img class="xp-car ${referenceCutout?'xp-reference-cutout':''} ${spec.studio?'xp-studio-car':''}" data-car-art
      src="${xpEsc(spec.src)}"
      title="${xpEsc(spec.description)}" data-view-status="${xpEsc(spec.view_status)}"
      data-art-tier="${xpEsc(spec.tier)}"
      alt="${xpEsc('XPENG '+a.model+', '+a.color.replaceAll('_',' ')+(spec.illustrative?' (illustrative artwork)':''))}" loading="eager">
      `;
  }
 
  topCarArt(){
    const a=this.appearance(),photo=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.top_image:this.vehicle()?.top_image||this._config.top_image;
    if(xpLocalArtworkPath(photo)&&!this._failedArtwork.has(photo))return `<img class="xp-top-cutout" data-top-art src="${xpEsc(photo)}" alt="${xpEsc('Top-down view of '+a.model)}" loading="eager">`;
    const candidate=xpVehicleAssetPath(a,'top');
    if(candidate&&XP_ARTWORK_INDEX.has(candidate)&&!this._failedArtwork.has(this.artworkUrl(candidate)))
      return `<img class="xp-top-cutout" data-top-art src="${xpEsc(this.artworkUrl(candidate))}" alt="${xpEsc((XP_ILLUSTRATIVE_ARTWORK_INDEX.has(candidate)?'AI-generated illustrative ':'')+'Top-down view of '+a.model)}" loading="eager">`;
    const paint=XP_PAINTS.find(p=>p.id===a.color)?.hex||'#f2f4f2';
    return `<svg class="xp-top-car" viewBox="0 0 300 600" role="img" aria-label="${xpEsc('Illustrative overhead view of '+a.model)}">
    <defs><linearGradient id="xp-top-body"><stop offset="0" stop-color="#647381"/><stop offset=".2" stop-color="${xpEsc(paint)}"/><stop offset=".8" stop-color="${xpEsc(paint)}"/><stop offset="1" stop-color="#546576"/></linearGradient>
    <linearGradient id="xp-top-window" x2="1" y2="1"><stop stop-color="#2e4b64"/><stop offset="1" stop-color="#0b1728"/></linearGradient></defs>
    <ellipse cx="150" cy="301" rx="119" ry="270" fill="#000" opacity=".35"/>
    <g fill="#111820" stroke="#8597a4" stroke-width="3">
      <rect x="17" y="135" width="45" height="111" rx="14"/><rect x="238" y="135" width="45" height="111" rx="14"/>
      <rect x="17" y="362" width="45" height="111" rx="14"/><rect x="238" y="362" width="45" height="111" rx="14"/></g>
    <path d="M109 33Q150 9 191 33L239 95Q255 145 255 200V451Q255 504 231 546Q150 573 69 546Q45 504 45 451V200Q45 145 61 95Z" fill="url(#xp-top-body)" stroke="#b1c7d5" stroke-width="3"/>
    <path d="M77 143Q150 104 223 143L228 199Q150 221 72 199Z" fill="url(#xp-top-window)" stroke="#abc0ca" stroke-width="3"/>
    <path d="M75 222Q150 211 225 222V406Q150 423 75 406Z" fill="url(#xp-top-window)" stroke="#abbac4" stroke-width="3"/>
    <path d="M80 434Q150 422 220 434L211 488Q150 497 89 488Z" fill="url(#xp-top-window)" stroke="#9cabb6" stroke-width="2"/>
    <path d="M73 60L106 46M194 46L227 60" stroke="#f3fcff" stroke-width="9" stroke-linecap="round"/>
    <path d="M70 537Q150 554 230 537" stroke="#fa4047" stroke-width="9" fill="none" stroke-linecap="round"/>
    </svg>`;
  }
  tireScreen(showBack=true){
    const a=this.appearance(),photo=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.top_image:this.vehicle()?.top_image||this._config.top_image;
    const wheel=(key,label)=>{const bar=this.tirePressureBar(key);
      return `<div class="xp-tire-reading" data-wheel="${key}"><small>${label}</small>
        <strong>${bar===null?'—':xpEsc(xpNum(bar,2))}</strong><span>${bar===null?'Unavailable':'bar'}</span></div>`;};
    return `<section class="xp-tire-screen" role="region" aria-label="Tire pressure from above">
       ${showBack?`<div class="xp-tire-actions"><button type="button" data-tire-toggle aria-label="Back to vehicle status">${xpIcon('back',20)} Back to vehicle</button></div>`:''}
       <div class="xp-tire-stage"><div class="xp-tire-center">${this.topCarArt()}</div>
         ${wheel('tire_fl','Front left')}${wheel('tire_fr','Front right')}
         ${wheel('tire_rl','Rear left')}${wheel('tire_rr','Rear right')}</div>
       ${!xpLocalArtworkPath(photo)?'<div class="xp-tire-disclaimer">Illustrative overhead view · exact model artwork pending</div>':''}
     </section>`;
  }
 overview(){
  const rows=[['settings','תחזוקת הרכב','צמיגים · טיפולים · נתוני רכב'],['pin','Location',this.locationText()]];
  return `${this.title()}${this.carArt()}
    <section class="xp-overview-stat" aria-label="Battery and estimated range">
     <div class="xp-batt-line"><div class="xp-batt-glyph"><div class="xp-batt-fill" style="height:${xpPercent(this.val('soc'))??0}%"></div></div>
       <div><div class="xp-stat-label">Battery</div><div class="xp-soc">${this.socHtml()}</div></div></div>
     ${this.progress()}<div class="xp-overview-range"><div class="xp-stat-label">Estimated range</div><div class="xp-range-num">${xpIcon('gauge',36)}<span>${xpEsc(this.num('range','km'))}</span></div></div>
    </section>
    ${this.xpUiEnabled()?'':`    <aside class="xp-status-panel" aria-label="Vehicle information">
      ${rows.map(([icon,label,val])=>icon==='settings'
       ?`<button type="button" class="xp-info-row xp-tire-row" data-xp-open="maintenance" aria-label="תחזוקת הרכב"><span class="xp-info-icon">${xpIcon(icon,31)}</span><span class="xp-info-copy"><small>${xpEsc(label)}</small><b>${xpEsc(val)}</b></span><span class="xp-chevron">${xpIcon('arrow',19)}</span></button>`
       :icon==='pin'&&this.xpLive('device_tracker','location')
       ?`<button type="button" class="xp-info-row xp-location-row" data-xp-open="map" aria-label="מפת מיקום הרכב"><div class="xp-info-icon">${xpIcon(icon,31)}</div>
       <div class="xp-info-copy"><small>${xpEsc(label)}</small><b>${xpEsc(val)}</b></div><span class="xp-chevron">${xpIcon('arrow',19)}</span></button>`
       :`<div class="xp-info-row"><div class="xp-info-icon">${xpIcon(icon,31)}</div>
       <div class="xp-info-copy"><small>${xpEsc(label)}</small><b>${xpEsc(val)}</b></div></div>`).join('')}
    </aside>`}`;
 }
 charging(){
  return `${this.title()}
    <div class="xp-station" aria-hidden="true">✕</div>${this.carArt()}
    ${this.model()==='G6'&&this.xpChargingActive()?'<svg class="xp-charge-cable xp-charge-cable-live" aria-hidden="true" viewBox="0 0 1536 864" preserveAspectRatio="none"><path class="xp-charge-cable-halo xp-cable-desktop" d="M1443 500C1464 647 1366 663 1235 625S1174 522 1185 479"/><path class="xp-charge-cable-core xp-cable-desktop" d="M1443 500C1464 647 1366 663 1235 625S1174 522 1185 479"/><path class="xp-charge-cable-halo xp-cable-mobile" d="M1440 685Q1408 747 1300 714"/><path class="xp-charge-cable-core xp-cable-mobile" d="M1440 685Q1408 747 1300 714"/></svg>':''}
    <section class="xp-charge-card" aria-label="Charging information">
       <div class="xp-charge-heading">${xpIcon('bolt',42)}<span>${xpEsc(this.chargeStatus())}</span></div>
       ${this.progress()}
       <div class="xp-charge-main"><div class="xp-soc">${this.socHtml()}</div><div class="xp-charge-divider"></div>
          <div class="xp-charge-range"><div class="xp-stat-label">Estimated range</div><b>${xpEsc(this.num('range','km'))}</b></div></div>
       <div class="xp-charge-meta"><div><small>Charging power</small><b>${xpEsc(this.num('power','kW',1))}</b></div>
       <div><small>Time remaining</small><b>${xpEsc(this.remainingText())}</b></div>
       <div><small>Charge limit</small><b>${xpEsc(this.num('target','%'))}</b></div></div>
    </section>${this.xpUiEnabled()&&!this._xpPanel?'<nav class="xp-charge-shortcuts" aria-label="בקרות טעינה" dir="rtl"><button type="button" data-xp-open="charge_controls">הגבלת טעינה</button><button type="button" data-xp-open="charge_schedule">תזמונים</button></nav>':''}
    ${!this._xpPanel?'<button type="button" class="xp-page-back" data-xp-home aria-label="חזרה למסך הבית">'+xpIcon('back',20)+'<span>חזרה לבית</span></button>':''}`;
 }
 render(){
  if(!this.shadowRoot)return;
  this.toggleAttribute('data-expanded',this._expanded);
  // The charging entity is the single source of truth for choosing the screen.
  // Only an explicit 'on' shows Charging. 'off', unknown and unavailable show Overview.
  const actualCharging=this.xpChargingActive();
  const isCharging=actualCharging&&!this._xpChargingDismissed;
  this._view=isCharging?'charging':'overview';
  if(isCharging)this._tireOpen=false;
  const onHome=!isCharging&&!this._tireOpen&&!this._xpPanel;
  this.shadowRoot.innerHTML=`<style>${XP_CSS}</style><ha-card><div class="xp-scene ${isCharging?'xp-charge':this._tireOpen?'xp-overview xp-tire-mode':'xp-overview'} ${this.xpUiEnabled()&&!isCharging?'xp-has-controls':''} ${onHome&&this.xpUiEnabled()?'xp-home-navigation':''}">
   ${this.sceneBackdrop()}${this.header()}${isCharging?this.charging():this._tireOpen?this.title()+this.tireScreen():this.overview()}${onHome?this.xpDock():""}${this.xpModal()}
   
   </div></ha-card>`;
  if(this._xpPanel==='map')this.xpMountMap();
 }
}
const XP_MAPPABLE_FIELDS = Object.freeze([{"key":"charging","label":"Charging state"},{"key":"soc","label":"Battery level (%)"},{"key":"range","label":"Estimated range (km)"},{"key":"power","label":"Charging power (kW)"},{"key":"remaining","label":"Time remaining (minutes)"},{"key":"target","label":"Charging limit (%)"},{"key":"plugged","label":"Cable connected"},{"key":"odometer","label":"Odometer (km)"},{"key":"tire_fl","label":"Tire front left (kPa)"},{"key":"tire_fr","label":"Tire front right (kPa)"},{"key":"tire_rl","label":"Tire rear left (kPa)"},{"key":"tire_rr","label":"Tire rear right (kPa)"},{"key":"location","label":"Vehicle location"},{"key":"last_update","label":"Last update"},{"key":"connection","label":"Connection status"}]);
class XpengVehicleCardEditor extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});
  this._cfg=xpNormalizeAppearance({prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'graphite_gray',interior:'dark_gray'});this._hass=null;this._entitySignature='';
  this.shadowRoot.addEventListener('change',e=>{
   const el=e.target.closest('[data-key],[data-entity]');if(!el)return;
   if(el.hasAttribute('data-entity'))el.setCustomValidity('');
   if(el.hasAttribute('data-entity')){
     if(xpSensorMappingMode(this._cfg)!=='manual')return;
     const field=el.dataset.entity,raw=String(el.value||'').trim();
     if(!XP_MAPPABLE_FIELDS.some(x=>x.key===field))return;
     if(raw&&!xpParseEntityMapping(raw)){
       el.setCustomValidity('Enter a valid Home Assistant entity ID');el.reportValidity();return;
     }
     const mapping={...(this._cfg.entities||{})};
     if(raw)mapping[field]=raw;else delete mapping[field];
     this._cfg={...this._cfg,entities:mapping};
     this.render();
     this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._cfg},bubbles:true,composed:true}));
     return;
   }
   const key=el.dataset.key;
    let cfg={...this._cfg,[key==='year_group'?'year':key]:el.value};
    // Model, generation, exact model-year and colour select image; trim stays display-only.
    if(['model','year_group','year','color'].includes(key)){delete cfg.image;delete cfg.charging_image;delete cfg.top_image;}
    if(['model','interior'].includes(key))delete cfg.interior_image;
    if(cfg.prefix&&!/^[a-z0-9_]+$/.test(cfg.prefix))return;
    if(key==='model')cfg.year=xpYearGroupChoices(cfg.model)[0]?.id||cfg.year;
    if(key==='year_group'&&xpYearNeedsSpecificChoice(cfg.model,cfg.year)){
      const group=xpYearGroupFor(cfg.model,cfg.year);
      cfg.year=String(group.years[group.years.length-1]);
    }
    if(['model','year_group','year'].includes(key)){
      cfg.trim=xpAllowedTrims(cfg.model,cfg.year)[0]?.id||cfg.trim;
      cfg.color=xpAllowedPaints(cfg.model,cfg.year)[0]?.id||cfg.color;
      cfg.interior=xpAllowedInteriors(cfg.model,cfg.year)[0]?.id||cfg.interior;
    }
    this._cfg=xpNormalizeAppearance(cfg);this.render();
   this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._cfg},bubbles:true,composed:true}));
  });
 }
 setConfig(cfg){this._cfg=xpNormalizeAppearance({...cfg});this.render();}
 set hass(value){
   this._hass=value;
   const signature=Object.keys(value?.states||{}).sort().join('|');
   if(signature!==this._entitySignature){this._entitySignature=signature;this.render();}
 }
 get hass(){return this._hass;}
 render(){
  const v=xpNormalizeAppearance(this._cfg);
  const select=(key,label,values,selected=v[key])=>`<label>${xpEsc(label)}<select data-key="${key}">${values.map(x=>`<option value="${xpEsc(x.id)}" ${selected===x.id?'selected':''}>${xpEsc(x.label)}</option>`).join('')}</select></label>`;
  const prefix=v.prefix||'my_xpeng';
  const mappingMode=xpSensorMappingMode(v);
  const states=this._hass?.states||{};
  const dataList=Object.keys(states).filter(id=>xpParseEntityMapping(id)).sort().map(id=>'<option value="'+xpEsc(id)+'"></option>').join('');
  const mappingRows=XP_MAPPABLE_FIELDS.map(field=>{
   const spec=XP_KEYS[field.key];
   const auto=spec[0]+'.'+prefix+'_'+spec[1];
   return '<label class="xp-map-row"><span>'+xpEsc(field.label)+'</span><input data-entity="'+xpEsc(field.key)+'" list="xp-entity-choices" autocomplete="off" value="'+xpEsc(v.entities?.[field.key]||'')+'" placeholder="Auto: '+xpEsc(auto)+'" title="Leave blank for automatic mapping. Supports entity_id or entity_id|attribute_name"></label>';
  }).join('');
  this.shadowRoot.innerHTML=`<style>section{display:grid;gap:13px;padding:14px;font:inherit}label{display:grid;gap:5px;font-size:13px}input,select{border:1px solid #8b959e;border-radius:7px;padding:10px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#111)}p{font-size:12px;opacity:.8;line-height:1.5}
   h3{margin:8px 0 0;font-size:15px}
   details{border:1px solid var(--divider-color,#7d879a77);border-radius:9px;padding:11px}
   summary{cursor:pointer;font-weight:600}
   .xp-map-fields{display:grid;gap:9px;margin-top:12px}
   .xp-map-row{display:grid;grid-template-columns:minmax(105px,1fr) minmax(145px,2fr);gap:9px;align-items:center}
   .xp-map-row input{font-size:12px}
   @media(max-width:460px){.xp-map-row{grid-template-columns:1fr}}
   </style><section>
    <h3>Vehicle appearance</h3>
     ${select('model','Model',xpAllowedModels().map(m=>({id:m.id,label:m.name})))}
     ${select('year_group','Generation / facelift',xpYearGroupChoices(v.model),xpYearGroupFor(v.model,v.year)?.id)}
      ${xpYearNeedsSpecificChoice(v.model,v.year)?select('year','Model year · paint availability',xpYearsWithinGroup(v.model,v.year),xpYearsWithinGroup(v.model,v.year).some(y=>y.id===v.year)?v.year:xpYearsWithinGroup(v.model,v.year)[0]?.id):''}
     ${select('trim','Trim · display only',xpAllowedTrims(v.model,v.year))}
     ${select('color','Exterior paint',xpAllowedPaints(v.model,v.year))}
     ${select('interior','Interior finish · צבע פנים הרכב',xpAllowedInteriors(v.model,v.year))}
     ${select('show_controls','Control buttons', [{id:'true',label:'Visible · four quick buttons'},{id:'false',label:'Hidden · original status-only view'}],String(v.show_controls===undefined?v.model==='G6':v.show_controls===true||v.show_controls==='true'))}
     ${select('enable_access_controls','Access actions (unlock / windows)',[{id:'false',label:'Off (safe default)'},{id:'true',label:'On (requires Xpengtk Access permission)'}],String(v.enable_access_controls===true||v.enable_access_controls==='true'))}
     <p>Years sharing the same exterior/facelift are grouped. Select a specific year only when paint availability differs. Trim labels never change vehicle pictures.</p>
    <h3>Sensor mapping</h3>
     <label>Mapping mode<select data-key="sensor_mapping_mode">
       <option value="auto" ${mappingMode==='auto'?'selected':''}>Automatic · XPENG integration</option>
       <option value="manual" ${mappingMode==='manual'?'selected':''}>Manual · choose sensors</option>
     </select></label>
     ${mappingMode==='manual'? `<div class="xp-map-fields" data-mappings>
       <p>Choose any of the ${XP_MAPPABLE_FIELDS.length} Home Assistant sensors. A blank field uses automatic integration mapping. Entity attributes: entity_id|attribute_name.</p>
       ${mappingRows}
       <datalist id="xp-entity-choices">${dataList}</datalist>
     </div>`:`<p data-auto-mapping>Vehicle sensors are matched automatically using the XPENG integration. Choose Manual to show and assign individual sensor entities.</p>`}
     <p>Vehicle status and automatic Charging remain the two principal scenes. Optional in-card overlays show climate and seat controls and use native Home Assistant services. The cabin illustration reflects the selected interior colour.</p>
  </section>`;
 }
}
if(!customElements.get('xpeng-vehicle-card'))customElements.define('xpeng-vehicle-card',XpengVehicleCard);
if(!customElements.get('xpeng-vehicle-card-editor'))customElements.define('xpeng-vehicle-card-editor',XpengVehicleCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='xpeng-vehicle-card'))window.customCards.push({type:'xpeng-vehicle-card',name:'XPENG Dashboard',description:'Two-screen vehicle status and charging dashboard (read-only)'});
