/**
 * XPENG Dashboard v0.1.1 — two-screen vehicle status and charging dashboard (read-only).
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
const XP_ICONS = {
 home:'<path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3Z"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0V6a4 4 0 0 0-7-2"/>',
 car:'<path d="M4 16H2v-5l2-5h16l2 5v5h-2M4 16h16M4 16v3m16-3v3M2 11h20M7 6l-2 5m12-5 2 5"/><circle cx="6.5" cy="15" r=".8"/><circle cx="17.5" cy="15" r=".8"/>',
 fan:'<path d="M12 12c6-2 7-9 3-9-3 0-3 6-3 9Zm0 0c4 5 11 3 9-1-2-3-6 0-9 1Zm0 0c-5 4-3 11 1 9 3-2 0-6-1-9Z"/>',
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
  if(['connected','online'].includes(raw))return 'Connected';
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
const XP_CATALOG = Object.freeze({"models":[{"id":"G3","name":"G3","start":2018,"end":2021,"shape":"crossover","trim":"none"},{"id":"G3i","name":"G3i","start":2021,"end":2023,"shape":"crossover","trim":"none"},{"id":"P5","name":"P5","start":2021,"end":2024,"shape":"compact_sedan","trim":"none"},{"id":"P7","name":"P7 (Original)","start":2020,"end":2024,"shape":"fastback","trim":"none"},{"id":"P7i","name":"P7i","start":2023,"end":2025,"shape":"fastback","trim":"none"},{"id":"Next P7","name":"Next P7","start":2025,"end":2026,"shape":"fastback","trim":"none"},{"id":"P7+","name":"P7+","start":2024,"end":2026,"shape":"fastback","trim":"none"},{"id":"G6","name":"G6","start":2023,"end":2026,"shape":"g6","trim":"g6"},{"id":"G7","name":"G7","start":2025,"end":2026,"shape":"crossover","trim":"none"},{"id":"G9","name":"G9","start":2022,"end":2026,"shape":"suv","trim":"g9"},{"id":"G9L","name":"G9L","start":2026,"end":2026,"shape":"suv","trim":"none"},{"id":"X9","name":"X9","start":2024,"end":2026,"shape":"mpv","trim":"x9"},{"id":"MONA M03","name":"MONA M03","start":2024,"end":2026,"shape":"compact_sedan","trim":"none"},{"id":"L03","name":"L03","start":2026,"end":2026,"shape":"fastback","trim":"none"},{"id":"GX","name":"GX (fleet/research)","start":2026,"end":2026,"shape":"suv","trim":"none","research":true},{"id":"Other","name":"Other / Future XPENG","start":2018,"end":2026,"shape":"suv","trim":"none","other":true}],"paints":[{"id":"arctic_white","label":"Arctic White","hex":"#F2F4F2"},{"id":"graphite_gray","label":"Graphite Gray","hex":"#66717B"},{"id":"midnight_black","label":"Midnight Black","hex":"#15191F"},{"id":"silver_frost","label":"Silver Frost","hex":"#BCC4C9"},{"id":"stellar_purple","label":"Stellar Purple","hex":"#867592"},{"id":"kaitoke_green_matte","label":"Kaitoke Green Matte","hex":"#526F64"}],"trims":{"default":[{"id":"unspecified","label":"Trim not specified (market-dependent)"}],"G6:2026":[{"id":"core_rwd","label":"Core RWD"},{"id":"core_plus_rwd","label":"Core+ RWD"},{"id":"core_performance_awd","label":"Core Performance AWD"},{"id":"black_edition","label":"Core Performance AWD Black Edition"},{"id":"unspecified","label":"Other configuration / region"}],"G6:2023-2025":[{"id":"unspecified","label":"Trim not specified"},{"id":"standard_range_rwd","label":"Standard Range RWD"},{"id":"long_range_rwd","label":"Long Range RWD"},{"id":"performance_awd","label":"Performance AWD"}],"G9:2022-2026":[{"id":"unspecified","label":"Trim not specified"},{"id":"standard_range_rwd","label":"Standard Range RWD"},{"id":"long_range_rwd","label":"Long Range RWD"},{"id":"performance_awd","label":"Performance AWD"}],"X9:2024-2026":[{"id":"unspecified","label":"Trim not specified"},{"id":"fwd_long_range","label":"FWD Long Range"}]}});
const XP_YEARS = Object.freeze(Array.from({length:9},(_,i)=>String(2026-i)));
const XP_MODELS = XP_CATALOG.models;
const XP_PAINTS = XP_CATALOG.paints;
const XP_DEFAULT_TRIM = XP_CATALOG.trims.default;
// 2026 facelift cabin colours verified against official XPENG New G6 sources.
// Display-only preset: real materials and option combinations vary by market.
const XP_INTERIORS=Object.freeze([
{id:'dark_gray',label:'Dark Gray',hex:'#40454b',secondary:'#252a30'},
{id:'light_gray',label:'Light Gray',hex:'#d8d9d4',secondary:'#aeb1b4'},
{id:'coffee',label:'Coffee',hex:'#93725b',secondary:'#574338'},
{id:'saddle',label:'Saddle',hex:'#aa704d',secondary:'#724934'}]);
const XP_VERIFIED_PAINTS=Object.freeze({
 'G6:2026':['arctic_white','graphite_gray','midnight_black','silver_frost','stellar_purple'],
 'G9:2026':['arctic_white','graphite_gray','midnight_black','silver_frost','kaitoke_green_matte']});
const XP_VERIFIED_INTERIORS=Object.freeze({
 'G6:2026':['dark_gray','light_gray'],
 'G9:2026':['dark_gray','coffee','saddle','light_gray']});
const XP_ALIASES={space_grey:'graphite_gray',space_gray:'graphite_gray',
 graphite_grey:'graphite_gray',jet_black:'midnight_black',
 black:'dark_gray',dark:'dark_gray',light_grey:'light_gray',white:'light_gray'};
function xpAppearanceId(v,kind='color'){
 const k=String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
 if(kind==='interior'&&k==='black')return 'dark_gray';
 if(kind==='interior'&&k==='white')return 'light_gray';
 if(kind==='color'&&k==='black')return 'midnight_black';
 if(kind==='color'&&k==='white')return 'arctic_white';
 return XP_ALIASES[k]||k;
}
function xpAllowedInteriors(model,year,trim){
 const palette=XP_VERIFIED_INTERIORS[model+':2026']||['dark_gray','light_gray'];
 return XP_INTERIORS.filter(p=>palette.includes(p.id));
}
function xpIsVerifiedPalette(model,year){return Boolean(XP_VERIFIED_PAINTS[model+':2026']);}
function xpAllowedModels(year){const y=Number(year);return XP_MODELS.filter(m=>y>=m.start&&y<=m.end);}
function xpAllowedYears(model){const m=xpModel(model);return XP_YEARS.filter(y=>Number(y)>=m.start&&Number(y)<=m.end);}
function xpModel(model){return XP_MODELS.find(m=>m.id===model)||XP_MODELS.find(m=>m.id==='Other');}
function xpAllowedTrims(model,year){const y=Number(year), x=String(model);
 if(x==='G6')return y===2026?XP_CATALOG.trims['G6:2026']:XP_CATALOG.trims['G6:2023-2025'];
 if(x==='G9')return XP_CATALOG.trims['G9:2022-2026'];
 if(x==='X9')return y>=2025?[...XP_CATALOG.trims['X9:2024-2026'],{id:'reev_unspecified',label:'REEV / range extender (market-dependent)'}]:XP_CATALOG.trims['X9:2024-2026'];
 if(y===2026&&['G7','P7+','G9L'].includes(x))return [{id:'unspecified',label:'Variant unspecified'},{id:'reev_unspecified',label:'REEV / range extender (market-dependent)'}];
 return XP_DEFAULT_TRIM;
}
function xpAllowedPaints(model,year,trim){
 // Paint choices are scoped to model and year, never to the selected trim.
 const list=XP_VERIFIED_PAINTS[model+':'+year]||XP_PAINTS.map(p=>p.id);
 return XP_PAINTS.filter(p=>list.includes(p.id));
}
function xpNormalizeAppearance(value){const v=value||{};
 const incoming=String(v.model??'').replace(/^XPENG\s+/i,'').trim();
 const mdl=XP_MODELS.find(x=>x.id.toLowerCase()===incoming.toLowerCase())?.id||'G6';
 const years=xpAllowedYears(mdl);
 const yr=years.includes(String(v.year))?String(v.year):years[0]||'2026';
 const options=xpAllowedTrims(mdl,yr);
 const trim=options.some(x=>x.id===v.trim)?v.trim:options[0].id;
 const paints=xpAllowedPaints(mdl,yr,trim),requestedPaint=xpAppearanceId(v.color);
 const color=paints.some(x=>x.id===requestedPaint)?requestedPaint:paints[0].id;
 const interiors=xpAllowedInteriors(mdl,yr,trim),requestedInterior=xpAppearanceId(v.interior,'interior');
 const interior=interiors.some(x=>x.id===requestedInterior)?requestedInterior:interiors[0].id;
 return {...v,year:yr,model:mdl,trim,color,interior};
}

function xpAssetModel(model){return String(model).toLowerCase().replace(/\s+/g,'_').replace(/\+/g,'_plus').replace(/[^a-z0-9_]/g,'');}
// Build-time inventory: each entry corresponds to an existing packaged file.
const XP_ARTWORK_INDEX = Object.freeze({
  exact:new Set(), // Three-view assets are not packaged yet; do not advertise missing files.
  family:new Set()
});
const XP_SCENE_BACKGROUND = 'xpeng-approved-lakeside-background.webp';
// HACS installs files directly under dist/; nested folders are not reliably copied.
// Keep every runtime file as a *direct child* of dist/ with a collision-free name.
const XP_HACS_BASE='/hacsfiles/xpeng-vehicle-card/';
function xpPackagedUrl(relative){return XP_HACS_BASE+'xpeng-asset-'+relative.replaceAll('/','-');}
function xpLocalArtworkPath(value){return typeof value==='string'&&/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_\-.]+$/.test(value);}
const XP_CSS = `
:host{display:block;color:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;--xp-mint:#00efbe;--xp-sky:#6aaaff}
*{box-sizing:border-box}
ha-card{background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important}
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
.xp-cable{position:absolute;z-index:2;inset:0;width:100%;height:100%;pointer-events:none}
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
`;
// Retain legacy manual entity mapping for older YAML; new configs are automatic.
function xpSensorMappingMode(cfg,profile){
 const mode=profile?.sensor_mapping_mode??cfg?.sensor_mapping_mode;
 if(mode==='auto'||mode==='manual')return mode;
 return Object.keys(profile?.entities||{}).length||Object.keys(cfg?.entities||{}).length?'manual':'auto';
}
class XpengVehicleCard extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});this._config={};this._hass=null;this._view='overview';this._expanded=false;this._vehicleIndex=0;this._infoOpen=false;this._tireOpen=false;
  this.shadowRoot.addEventListener('error',ev=>{
      const img=ev.target;
      if(!img?.matches?.('img[data-car-art]')||img.dataset.fallbackUsed)return;
      img.dataset.fallbackUsed='true';img.src=this.placeholderArt();
    },true);
   this.shadowRoot.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
     if(b.hasAttribute('data-meta-toggle')){this._infoOpen=!this._infoOpen;this.render();return;}
     if(b.hasAttribute('data-tire-toggle')){this._tireOpen=!this._tireOpen;this._infoOpen=false;this.render();return;}
    if(b.hasAttribute('data-cycle')){this._vehicleIndex=(this._vehicleIndex+1)%this.vehicles().length;this._tireOpen=false;this.render();}
  });
 }
 connectedCallback(){if(!this._fullscreenHandler){this._fullscreenHandler=()=>{if(!document.fullscreenElement&&this._expanded){this._expanded=false;this.render();}};}document.addEventListener('fullscreenchange',this._fullscreenHandler);}
 disconnectedCallback(){if(this._fullscreenHandler)document.removeEventListener('fullscreenchange',this._fullscreenHandler);}
 toggleFullScreen(){this._expanded=!this._expanded;if(this._expanded&&this.requestFullscreen){this.requestFullscreen().catch(()=>{});}else if(!this._expanded&&document.fullscreenElement===this){document.exitFullscreen().catch(()=>{});}this.render();}
 setConfig(config){
  if(!config||typeof config!=='object')throw Error('XPENG card configuration required');
  if(config.prefix&&!/^[a-z0-9_]+$/.test(config.prefix))throw Error('XPENG prefix must be a slug');
  if(config.image_path&&!/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_-]+\/?$/.test(config.image_path))throw Error('Invalid local image_path');
  if(config.background_image&&!xpLocalArtworkPath(config.background_image))throw Error('Invalid local background_image');
  const v={prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',theme:'dark',...config};
  this._config=xpNormalizeAppearance(v);this._infoOpen=false;this._tireOpen=false;this.render();
 }
 set hass(hass){
  this._hass=hass;
  this._view=xpChargingActive(this.val('charging'))===true?'charging':'overview';
  if(this._view==='charging')this._tireOpen=false;
  this.render();
 }
 get hass(){return this._hass;}
 getCardSize(){return 8;}
 static getConfigElement(){return document.createElement('xpeng-vehicle-card-editor');}
 static getStubConfig(){return {type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray'};}
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
   const ids=custom?[custom.id]:spec.slice(1).map(s=>spec[0]+'.'+this.prefix()+'_'+s);
   const id=ids.find(x=>this._hass?.states?.[x])||ids[0];
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
 assetSpec(){
    const configuredBase=this._config.image_path;
    const base=(!configuredBase||configuredBase==='/hacsfiles/xpeng-vehicle-card/assets')?null:configuredBase.replace(/\/$/,'');
    const bundled=relative=>base?base+'/'+relative:xpPackagedUrl(relative);
    const profileArt=key=>Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.[key]:this.vehicle()?.[key]||this._config[key];
    const chosen=(this._view==='charging'&&profileArt('charging_image'))||profileArt('image');
    const a=this.appearance(),model=xpAssetModel(a.model),view=this._view==='charging'?'rear':'front';
    if(xpLocalArtworkPath(chosen))
      return {src:chosen,illustrative:false,studio:false,tier:'manual',view,view_status:'owner_supplied',
        description:'Owner-supplied artwork for '+a.model+' '+a.color};
    // Prefer separately packaged and verified three-view assets when present.
    // A view must never silently reuse a front render as a rear or overhead render.
    const candidate='vehicles/'+model+'/'+a.color+'/'+(view==='rear'?'charging':'front')+'.webp';
    if(XP_ARTWORK_INDEX.exact.has(candidate))
      return {src:bundled(candidate),illustrative:false,studio:false,tier:'exact-view',view,
        view_status:'matching_view',description:'Matched '+a.model+' '+a.year+' '+a.color+' '+view};
    // Display uses one representative trim per model/year, regardless of selected trim.
    // Legacy 2026 previews are used only for 2026, never for other model years.
    const highest={G6:'core_performance_awd',G9:'performance_awd'}[a.model];
    if(highest&&String(a.year)==='2026'){
      const exact='vehicles/'+model+'/2026/'+highest+'/'+a.color+'.webp';
      if(XP_ARTWORK_INDEX.exact.has(exact))
        return {src:bundled(exact),illustrative:true,studio:false,tier:'highest-trim-preview',view,
          view_status:view==='rear'?'front_fallback_rear_pending':'highest_available_preview',
          description:'Representative '+a.model+' 2026 preview in '+a.color+' for all selected trims; not manufacturer verified'};
    }
    const alias={graphite_gray:'space_grey',midnight_black:'jet_black'}[a.color]||a.color;
    const family='models/'+model+'-'+alias+'.webp';
    if(XP_ARTWORK_INDEX.family.has(family))
      return {src:bundled(family),illustrative:true,studio:false,tier:'model-family',view,
        view_status:view==='rear'?'front_fallback_rear_pending':'generic_model_illustration',
        description:'Shared model+paint illustration; no verified high-trim transparent cutout yet'};
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
    const source=this._config.background_image||(XP_HACS_BASE+XP_SCENE_BACKGROUND);
    return `<div class="xp-night-photo" aria-hidden="true"
      style="background-image:url(&quot;${xpEsc(source)}&quot;)"></div>`;
  }
 header(){
   const connection=this.val('connection'),status=xpConnText(connection);
   const stateClass=status==='Connected'?'xp-connected':status==='Connection error'?'xp-error':'xp-disconnected';
   return `<header class="xp-header"><div class="xp-brand"><span class="xp-x-mark">✕</span><span>XPENG</span></div>
     <div class="xp-header-right"><div class="xp-meta-tools">
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
    // The cabin preview is editor-controlled; changing year or trim does not select a different design.
    // If no matching art is provided, the colour-accurate schematic remains honest.
    const interiorImg=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.interior_image:this.vehicle()?.interior_image||this._config.interior_image;
    if(xpLocalArtworkPath(interiorImg))
      return `<img class="xp-cabin-mini" src="${xpEsc(interiorImg)}"
        alt="${xpEsc(a.model+' '+finish.label+' interior (user-supplied artwork)')}" loading="lazy">`;
    const colour=xpEsc(finish.hex),shade=xpEsc(finish.secondary);
    return `<svg class="xp-cabin-mini" viewBox="0 0 350 155" role="img"
      aria-label="${xpEsc(a.model+' cabin, '+finish.label)}">
      <rect x="0" y="0" width="350" height="155" rx="14" fill="#091a2c"/>
      <path d="M16 36Q175 -4 334 36L322 91H28Z" fill="${shade}" stroke="#687c93" stroke-width="2"/>
      <path d="M20 90l43-12 34 65H5Z M330 90l-43-12-34 65h92Z" fill="${colour}" stroke="#475d71"/>
      <circle cx="107" cy="75" r="26" fill="none" stroke="${colour}" stroke-width="11"/>
      <path d="M107 75v22M83 67h49" stroke="#ccd8e1" stroke-width="3"/>
      <path d="M138 79h77l18 60H124Z" fill="${shade}"/>
      <path d="M157 89h51v30h-51z" fill="#243a50"/>
      <path d="M69 141l9-43q30-15 52 7l20 36Z M213 141l15-36q22-22 49-7l11 43Z" fill="${colour}" stroke="${shade}" stroke-width="4"/>
      <path d="M146 141l12-22h32l14 22Z" fill="${colour}"/>
    </svg>`;
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
    if(xpLocalArtworkPath(photo))return `<img class="xp-top-cutout" data-top-art src="${xpEsc(photo)}" alt="${xpEsc('Top-down view of '+a.model)}" loading="eager">`;
    const model=xpAssetModel(a.model);
    const candidate='vehicles/'+model+'/'+a.color+'/top.webp';
    if(XP_ARTWORK_INDEX.exact.has(candidate))
      return `<img class="xp-top-cutout" data-top-art src="${xpEsc((this._config.image_path&&this._config.image_path!=="/hacsfiles/xpeng-vehicle-card/assets"?this._config.image_path.replace(/\/$/,"")+"/"+candidate:xpPackagedUrl(candidate)))}" alt="${xpEsc('Top-down view of '+a.model)}" loading="eager">`;
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
  tireScreen(){
    const a=this.appearance(),photo=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.top_image:this.vehicle()?.top_image||this._config.top_image;
    const wheel=(key,label)=>{const bar=this.tirePressureBar(key);
      return `<div class="xp-tire-reading" data-wheel="${key}"><small>${label}</small>
        <strong>${bar===null?'—':xpEsc(xpNum(bar,2))}</strong><span>${bar===null?'Unavailable':'bar'}</span></div>`;};
    return `<section class="xp-tire-screen" role="region" aria-label="Tire pressure from above">
       <div class="xp-tire-actions"><button type="button" data-tire-toggle aria-label="Back to vehicle status">${xpIcon('back',20)} Back to vehicle</button></div>
       <div class="xp-tire-stage"><div class="xp-tire-center">${this.topCarArt()}</div>
         ${wheel('tire_fl','Front left')}${wheel('tire_fr','Front right')}
         ${wheel('tire_rl','Rear left')}${wheel('tire_rr','Rear right')}</div>
       ${!xpLocalArtworkPath(photo)?'<div class="xp-tire-disclaimer">Illustrative overhead view · exact model artwork pending</div>':''}
     </section>`;
  }
 overview(){
  const rows=[['gauge','Odometer',this.num('odometer','km')],['tire','Tire pressure',this.tireSummary()],['pin','Location',this.locationText()]];
  return `${this.title()}${this.carArt()}
    <section class="xp-overview-stat" aria-label="Battery and estimated range">
     <div class="xp-batt-line"><div class="xp-batt-glyph"><div class="xp-batt-fill" style="height:${xpPercent(this.val('soc'))??0}%"></div></div>
       <div><div class="xp-stat-label">Battery</div><div class="xp-soc">${this.socHtml()}</div></div></div>
     ${this.progress()}<div class="xp-overview-range"><div class="xp-stat-label">Estimated range</div><div class="xp-range-num">${xpIcon('gauge',36)}<span>${xpEsc(this.num('range','km'))}</span></div></div>
    </section>
    <aside class="xp-status-panel" aria-label="Vehicle information">
      ${rows.map(([icon,label,val])=>icon==='tire'
      ?`<button class="xp-info-row xp-tire-row" type="button" data-tire-toggle aria-expanded="${this._tireOpen?'true':'false'}" aria-label="View all four tire pressures"><span class="xp-info-icon">${xpIcon(icon,31)}</span><span class="xp-info-copy"><small>${xpEsc(label)}</small><b>${xpEsc(val)}</b></span><span class="xp-chevron">${xpIcon('arrow',19)}</span></button>`
      :`<div class="xp-info-row"><div class="xp-info-icon">${xpIcon(icon,31)}</div>
      <div class="xp-info-copy"><small>${xpEsc(label)}</small><b>${xpEsc(val)}</b></div><span class="xp-chevron">${xpIcon('arrow',19)}</span></div>`).join('')}
    </aside>`;
 }
 charging(){
  return `${this.title()}
    <svg class="xp-cable" viewBox="0 0 1500 850" preserveAspectRatio="none" aria-hidden="true"><path d="M1282 444 Q1329 474 1366 569T1453 566" fill="none" stroke="#00e8b9" stroke-width="13" stroke-linecap="round" opacity=".29"/>
    <path d="M1282 444 Q1329 474 1366 569T1453 566" fill="none" stroke="#2efad2" stroke-width="5" stroke-linecap="round"/></svg>
    <div class="xp-station" aria-hidden="true">✕</div>${this.carArt()}
    <section class="xp-charge-card" aria-label="Charging information">
       <div class="xp-charge-heading">${xpIcon('bolt',42)}<span>${xpEsc(this.chargeStatus())}</span></div>
       ${this.progress()}
       <div class="xp-charge-main"><div class="xp-soc">${this.socHtml()}</div><div class="xp-charge-divider"></div>
          <div class="xp-charge-range"><div class="xp-stat-label">Estimated range</div><b>${xpEsc(this.num('range','km'))}</b></div></div>
       <div class="xp-charge-meta"><div><small>Charging power</small><b>${xpEsc(this.num('power','kW',1))}</b></div>
       <div><small>Time remaining</small><b>${xpEsc(this.remainingText())}</b></div>
       <div><small>Charge limit</small><b>${xpEsc(this.num('target','%'))}</b></div></div>
    </section>`;
 }
 render(){
  if(!this.shadowRoot)return;
  this.toggleAttribute('data-expanded',this._expanded);
  // The charging entity is the single source of truth for choosing the screen.
  // Only an explicit 'on' shows Charging. 'off', unknown and unavailable show Overview.
  const isCharging=xpChargingActive(this.val('charging'))===true;
  this._view=isCharging?'charging':'overview';
  if(isCharging)this._tireOpen=false;
  this.shadowRoot.innerHTML=`<style>${XP_CSS}</style><ha-card><div class="xp-scene ${isCharging?'xp-charge':this._tireOpen?'xp-overview xp-tire-mode':'xp-overview'}">
   ${this.sceneBackdrop()}${this.header()}${isCharging?this.charging():this._tireOpen?this.title()+this.tireScreen():this.overview()}
   
   </div></ha-card>`;
 }
}
const XP_MAPPABLE_FIELDS = Object.freeze([{"key":"charging","label":"Charging state"},{"key":"soc","label":"Battery level (%)"},{"key":"range","label":"Estimated range (km)"},{"key":"power","label":"Charging power (kW)"},{"key":"remaining","label":"Time remaining (minutes)"},{"key":"target","label":"Charging limit (%)"},{"key":"plugged","label":"Cable connected"},{"key":"odometer","label":"Odometer (km)"},{"key":"tire_fl","label":"Tire front left (kPa)"},{"key":"tire_fr","label":"Tire front right (kPa)"},{"key":"tire_rl","label":"Tire rear left (kPa)"},{"key":"tire_rr","label":"Tire rear right (kPa)"},{"key":"location","label":"Vehicle location"},{"key":"last_update","label":"Last update"},{"key":"connection","label":"Connection status"}]);
class XpengVehicleCardEditor extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});
  this._cfg=xpNormalizeAppearance({prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray'});this._hass=null;this._entitySignature='';
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
   let cfg={...this._cfg,[key]:el.value};
   // Year changes ONLY the informational trim list; neither selection changes photos or colours.
   if(['model','color'].includes(key)){delete cfg.image;delete cfg.charging_image;delete cfg.top_image;}
   if(['model','interior'].includes(key))delete cfg.interior_image;
   if(cfg.prefix&&!/^[a-z0-9_]+$/.test(cfg.prefix))return;
   if(key==='model'){
     cfg.year=xpAllowedYears(cfg.model)[0]||cfg.year;
     cfg.trim=xpAllowedTrims(cfg.model,cfg.year)[0].id;
     cfg.color=xpAllowedPaints(cfg.model,cfg.year,cfg.trim)[0].id;
     cfg.interior=xpAllowedInteriors(cfg.model,cfg.year,cfg.trim)[0].id;
   }
   if(key==='year')cfg.trim=xpAllowedTrims(cfg.model,cfg.year)[0].id;
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
  const select=(key,label,values)=>`<label>${xpEsc(label)}<select data-key="${key}">${values.map(x=>`<option value="${xpEsc(x.id)}" ${v[key]===x.id?'selected':''}>${xpEsc(x.label)}</option>`).join('')}</select></label>`;
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
    <h3>Vehicle appearance (manual settings)</h3><p>The car always displays one highest-available-trim image for the selected model. Only exterior paint changes that image. Model year filters trim names; trim is information only.</p>
     
    ${select('model','Model',XP_MODELS.map(m=>({id:m.id,label:m.name})))}
    ${select('year','Model year (trim names only)',xpAllowedYears(v.model).map(y=>({id:y,label:y})))}
    ${select('trim','Trim (informational only)',xpAllowedTrims(v.model,v.year))}
    ${select('color','Exterior paint',xpAllowedPaints(v.model,v.year,v.trim))}
     ${select('interior','Interior finish',xpAllowedInteriors(v.model,v.year,v.trim))}
     <p>These exterior/interior colours are model-wide visual previews; historical factory paint availability has not been verified.</p>
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
     <p>The only screens are Vehicle status and Charging. Live readings update automatically; missing sensors stay unavailable. Vehicle appearance is edited here, never on the dashboard.</p>
  </section>`;
 }
}
if(!customElements.get('xpeng-vehicle-card'))customElements.define('xpeng-vehicle-card',XpengVehicleCard);
if(!customElements.get('xpeng-vehicle-card-editor'))customElements.define('xpeng-vehicle-card-editor',XpengVehicleCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='xpeng-vehicle-card'))window.customCards.push({type:'xpeng-vehicle-card',name:'XPENG Dashboard',description:'Two-screen vehicle status and charging dashboard (read-only)'});
