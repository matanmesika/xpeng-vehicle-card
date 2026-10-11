/**
 * XPENG Dashboard v0.1.0 — two-screen vehicle status and charging dashboard (read-only).
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
function xpBool(v){return v==='on'?true:v==='off'?false:null;}
function xpPercent(v){if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))return null;return Math.max(0,Math.min(100,Number(v)));}
function xpArt(model){let m=String(model).toUpperCase();if(/^G6(\W|$)/.test(m))return 'g6-studio.webp';if(/X9|MPV/.test(m))return 'mpv.svg';if(/P7|P5|M03|MONA|SEDAN/.test(m))return 'sedan.svg';return 'suv.svg';}
const XP_CATALOG = Object.freeze({"models":[{"id":"G3","name":"G3","start":2018,"end":2021,"shape":"crossover","trim":"none"},{"id":"G3i","name":"G3i","start":2021,"end":2023,"shape":"crossover","trim":"none"},{"id":"P5","name":"P5","start":2021,"end":2024,"shape":"compact_sedan","trim":"none"},{"id":"P7","name":"P7 (Original)","start":2020,"end":2024,"shape":"fastback","trim":"none"},{"id":"P7i","name":"P7i","start":2023,"end":2025,"shape":"fastback","trim":"none"},{"id":"Next P7","name":"Next P7","start":2025,"end":2026,"shape":"fastback","trim":"none"},{"id":"P7+","name":"P7+","start":2024,"end":2026,"shape":"fastback","trim":"none"},{"id":"G6","name":"G6","start":2023,"end":2026,"shape":"g6","trim":"g6"},{"id":"G7","name":"G7","start":2025,"end":2026,"shape":"crossover","trim":"none"},{"id":"G9","name":"G9","start":2022,"end":2026,"shape":"suv","trim":"g9"},{"id":"G9L","name":"G9L","start":2026,"end":2026,"shape":"suv","trim":"none"},{"id":"X9","name":"X9","start":2024,"end":2026,"shape":"mpv","trim":"x9"},{"id":"MONA M03","name":"MONA M03","start":2024,"end":2026,"shape":"compact_sedan","trim":"none"},{"id":"L03","name":"L03","start":2026,"end":2026,"shape":"fastback","trim":"none"},{"id":"GX","name":"GX (fleet/research)","start":2026,"end":2026,"shape":"suv","trim":"none","research":true},{"id":"Other","name":"Other / Future XPENG","start":2018,"end":2026,"shape":"suv","trim":"none","other":true}],"paints":[{"id":"arctic_white","label":"Arctic White","hex":"#F2F4F2"},{"id":"silver_frost","label":"Silver Frost","hex":"#BCC4C9"},{"id":"space_grey","label":"Space Grey","hex":"#66717B"},{"id":"stellar_purple","label":"Stellar Purple","hex":"#867592"},{"id":"jet_black","label":"Jet Black","hex":"#1C2026"}],"trims":{"default":[{"id":"unspecified","label":"Trim not specified (market-dependent)"}],"G6:2026":[{"id":"core_rwd","label":"Core RWD"},{"id":"core_plus_rwd","label":"Core+ RWD"},{"id":"core_performance_awd","label":"Core Performance AWD"},{"id":"black_edition","label":"Core Performance AWD Black Edition"},{"id":"unspecified","label":"Other configuration / region"}],"G6:2023-2025":[{"id":"unspecified","label":"Trim not specified"},{"id":"standard_range_rwd","label":"Standard Range RWD"},{"id":"long_range_rwd","label":"Long Range RWD"},{"id":"performance_awd","label":"Performance AWD"}],"G9:2022-2026":[{"id":"unspecified","label":"Trim not specified"},{"id":"standard_range_rwd","label":"Standard Range RWD"},{"id":"long_range_rwd","label":"Long Range RWD"},{"id":"performance_awd","label":"Performance AWD"}],"X9:2024-2026":[{"id":"unspecified","label":"Trim not specified"},{"id":"fwd_long_range","label":"FWD Long Range"}]}});
const XP_YEARS = Object.freeze(Array.from({length:9},(_,i)=>String(2026-i)));
const XP_MODELS = XP_CATALOG.models;
const XP_PAINTS = XP_CATALOG.paints;
const XP_DEFAULT_TRIM = XP_CATALOG.trims.default;
// 2026 facelift cabin colours verified against official XPENG New G6 sources.
// Display-only preset: real materials and option combinations vary by market.
const XP_INTERIORS = Object.freeze([
 {id:'dark_gray',label:'Dark Gray',hex:'#40454b',secondary:'#252a30'},
 {id:'light_gray',label:'Light Gray',hex:'#d8d9d4',secondary:'#aeb1b4'}
]);
function xpAllowedInteriors(model,year,trim){
 if(model==='G6'&&String(year)==='2026'&&trim==='black_edition')return XP_INTERIORS.filter(v=>v.id==='dark_gray');
 return XP_INTERIORS;
}

function xpAllowedModels(year){const y=Number(year);return XP_MODELS.filter(m=>y>=m.start&&y<=m.end);}
function xpModel(model){return XP_MODELS.find(m=>m.id===model)||XP_MODELS.find(m=>m.id==='Other');}
function xpAllowedTrims(model,year){const y=Number(year), x=String(model);
 if(x==='G6')return y===2026?XP_CATALOG.trims['G6:2026']:XP_CATALOG.trims['G6:2023-2025'];
 if(x==='G9')return XP_CATALOG.trims['G9:2022-2026'];
 if(x==='X9')return y>=2025?[...XP_CATALOG.trims['X9:2024-2026'],{id:'reev_unspecified',label:'REEV / range extender (market-dependent)'}]:XP_CATALOG.trims['X9:2024-2026'];
 if(y===2026&&['G7','P7+','G9L'].includes(x))return [{id:'unspecified',label:'Variant unspecified'},{id:'reev_unspecified',label:'REEV / range extender (market-dependent)'}];
 return XP_DEFAULT_TRIM;
}
function xpAllowedPaints(model,year,trim){if(model==='G6'&&String(year)==='2026'&&trim==='black_edition')return XP_PAINTS.filter(p=>p.id==='jet_black');
 if(model==='G6'&&String(year)==='2026'&&trim==='core_rwd')return XP_PAINTS.filter(p=>p.id!=='stellar_purple');
 return XP_PAINTS;
}
function xpNormalizeAppearance(value){const v=value||{};const yr=XP_YEARS.includes(String(v.year))?String(v.year):'2026';
 const mdl=xpAllowedModels(yr).some(x=>x.id===v.model)?v.model:(xpAllowedModels(yr).some(x=>x.id==='G6')?'G6':xpAllowedModels(yr)[0]?.id||'Other');
 const opts=xpAllowedTrims(mdl,yr);const tr=opts.some(x=>x.id===v.trim)?v.trim:opts[0].id;
 const colors=xpAllowedPaints(mdl,yr,tr);const col=colors.some(x=>x.id===v.color)?v.color:colors[0].id;
 const interiors=xpAllowedInteriors(mdl,yr,tr);
 const interior=interiors.some(x=>x.id===v.interior)?v.interior:interiors[0].id;
 return {...v,year:yr,model:mdl,trim:tr,color:col,interior};
}

function xpAssetModel(model){return String(model).toLowerCase().replace(/\s+/g,'_').replace(/\+/g,'_plus').replace(/[^a-z0-9_]/g,'');}
const XP_CSS = `
:host{display:block;color:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;--xp-mint:#00efbe;--xp-sky:#6aaaff}
*{box-sizing:border-box}
ha-card{background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important}
button{font:inherit;color:inherit;cursor:pointer}
button:focus-visible{outline:2px solid #81bbff;outline-offset:3px}
.xp-scene{position:relative;width:100%;min-height:620px;aspect-ratio:16/9;overflow:hidden;background:radial-gradient(ellipse 57% 35% at 56% 42%,#25365b 0%,#0e2441 43%,transparent 100%),linear-gradient(180deg,#030f21 0%,#041629 51%,#071e34 69%,#020914 100%);isolation:isolate;direction:ltr}
.xp-scene:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 65% 8% at 60% 69%,#147fbb75,transparent),radial-gradient(ellipse 63% 16% at 67% 81%,#173c7a95,transparent);z-index:1}
.xp-sky{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.xp-ground{position:absolute;inset:68% 0 0;background:repeating-linear-gradient(173deg,#3565ab1a 0px,#3565ab1a 2px,transparent 3px,transparent 46px),linear-gradient(180deg,#0b2139,#04111e);transform:perspective(500px) rotateX(12deg);transform-origin:50% 0}
.xp-ground:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 48% 48% at 59% 24%,#137ace4a,transparent 70%)}
.xp-stage-glow{position:absolute;left:22%;right:6%;bottom:18%;height:12%;background:#168de7;border-radius:100%;filter:blur(34px);opacity:.25}
.xp-stage-glow:after{content:"";position:absolute;inset:58% 2% 27%;background:#28bbff;filter:blur(8px)}
.xp-header{position:absolute;z-index:8;top:3.2%;left:4.5%;right:3%;display:flex;align-items:center;justify-content:space-between;gap:16px}
.xp-brand{display:flex;align-items:center;gap:14px;font-weight:600;letter-spacing:.31em;font-size:clamp(14px,1.4vw,23px);white-space:nowrap}
.xp-x-mark{font-size:26px;letter-spacing:-.13em;transform:scaleX(1.4)}
.xp-header-right{display:flex;align-items:center;gap:18px;font-size:clamp(12px,1.2vw,20px)}
.xp-head-button{display:grid;place-items:center;border:0;background:transparent;padding:6px;color:#fff;border-radius:9px}
.xp-head-button:hover{background:#ffffff1c}
.xp-head-button svg{width:24px;height:24px}
.xp-wifi{color:#7088a0;display:flex;align-items:center}
.xp-wifi.xp-connected{color:#66a9ff}
.xp-head-separator{height:22px;border-left:1px solid #41506c}
.xp-clock{font-variant-numeric:tabular-nums;font-weight:500}
.xp-version{position:absolute;bottom:10px;right:12px;font-size:10px;color:#8399b6;opacity:.52;z-index:8}
.xp-updated{position:absolute;z-index:4;right:5%;top:15%;text-align:right;color:#9cacca;font-size:clamp(11px,1vw,16px);line-height:1.45}
.xp-updated strong{display:block;font-weight:400;color:#b4c5e1}
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
.xp-charge .xp-brand{visibility:hidden}
.xp-charge .xp-updated{right:19%;top:14%}
.xp-station{position:absolute;z-index:2;right:3%;bottom:30%;width:5.3%;height:23%;min-width:45px;border:2px solid #55c8fb;border-radius:13px 13px 6px 6px;background:linear-gradient(90deg,#013861,#041b32 55%,#0b3150);box-shadow:0 0 18px #00c6ff85,inset 0 0 13px #08cafa74;display:grid;place-items:start center;padding-top:25px;font-size:26px;color:#e1f7ff}
.xp-station:before{content:"";position:absolute;bottom:-5px;width:110%;height:7px;background:#03d7cf;filter:blur(4px)}
.xp-cable{position:absolute;z-index:2;inset:0;width:100%;height:100%;pointer-events:none}
.xp-subtle-link{position:absolute;z-index:8;left:5.4%;bottom:4%;border:1px solid #779cce77;background:#0a2139a1;color:#cfe6fa;border-radius:20px;padding:6px 13px;font-size:12px}
.xp-subtle-link:hover{background:#1e4361}
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
.xp-updated{top:155px;right:5%;font-size:11px}
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
.xp-charge .xp-updated{top:165px;right:5%}
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
.xp-subtle-link{bottom:15px;left:5%}
.xp-version{right:10px;bottom:3px}
}
@media(max-width:400px){.xp-charge-meta>div{padding:0 7px}.xp-charge-heading{font-size:19px}.xp-charge-meta b{font-size:12px}.xp-overview-stat{top:219px}.xp-status-panel{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
class XpengVehicleCard extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});this._config={};this._hass=null;this._view='overview';this._lastCharging=undefined;this._expanded=false;this._vehicleIndex=0;
  this.shadowRoot.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-expand')){this.toggleFullScreen();return;}
    if(b.dataset.view){this._view=b.dataset.view;this.render();return;}
    if(b.hasAttribute('data-cycle')){this._vehicleIndex=(this._vehicleIndex+1)%this.vehicles().length;this._lastCharging=undefined;this.render();}
  });
 }
 connectedCallback(){if(!this._fullscreenHandler){this._fullscreenHandler=()=>{if(!document.fullscreenElement&&this._expanded){this._expanded=false;this.render();}};}document.addEventListener('fullscreenchange',this._fullscreenHandler);}
 disconnectedCallback(){if(this._fullscreenHandler)document.removeEventListener('fullscreenchange',this._fullscreenHandler);}
 toggleFullScreen(){this._expanded=!this._expanded;if(this._expanded&&this.requestFullscreen){this.requestFullscreen().catch(()=>{});}else if(!this._expanded&&document.fullscreenElement===this){document.exitFullscreen().catch(()=>{});}this.render();}
 setConfig(config){
  if(!config||typeof config!=='object')throw Error('XPENG card configuration required');
  if(config.prefix&&!/^[a-z0-9_]+$/.test(config.prefix))throw Error('XPENG prefix must be a slug');
  if(config.image_path&&!/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_-]+\/?$/.test(config.image_path))throw Error('Invalid local image_path');
  const v={prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',theme:'dark',...config};
  this._config=xpNormalizeAppearance(v);this.render();
 }
 set hass(hass){
  this._hass=hass;
  const charging=this.bool('charging')===true;
  if(this._lastCharging===undefined||this._lastCharging!==charging){this._view=charging?'charging':'overview';this._lastCharging=charging;}
  this.render();
 }
 get hass(){return this._hass;}
 getCardSize(){return 8;}
 static getConfigElement(){return document.createElement('xpeng-vehicle-card-editor');}
 static getStubConfig(){return {type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray'};}
 vehicles(){return Array.isArray(this._config.vehicles)&&this._config.vehicles.length?this._config.vehicles:[this._config];}
 vehicle(){return this.vehicles()[Math.min(this._vehicleIndex,this.vehicles().length-1)];}
 prefix(){return this.vehicle()?.prefix||this._config.prefix||'my_xpeng';}
 appearance(){return xpNormalizeAppearance({...this._config,...this.vehicle()});}
 model(){return this.appearance().model;}
 year(){return this.appearance().year;}
 paint(){return this.appearance().color;}
 data(key){
   const spec=XP_KEYS[key];if(!spec)return null;
   const override=this.vehicle()?.entities?.[key]||this._config.entities?.[key];
   const ids=override?[override]:spec.slice(1).map(s=>spec[0]+'.'+this.prefix()+'_'+s);
   const id=ids.find(x=>this._hass?.states?.[x])||ids[0];
   const entity=this._hass?.states?.[id];const raw=entity?.state??null;
   const valid=raw!==null&&!(typeof raw==='string'&&XP_INVALID.has(raw.toLowerCase()));
   return {id,entity,value:valid?raw:null};
 }
 val(key){return this.data(key)?.value??null;}
 number(key){const v=this.val(key);return v===null||v===''||!Number.isFinite(Number(v))?null:Number(v);}
 bool(key){return xpBool(this.val(key));}
 num(key,unit='',dec=0){const v=this.number(key);return v===null?'—':xpNum(v,dec)+(unit?' '+unit:'');}
 asset(){
   const base=(this._config.image_path||'/hacsfiles/xpeng-vehicle-card/assets').replace(/\/$/,'');
   const img=this.vehicle().image||this._config.image;
   if(img&&/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_\-.]+$/.test(img))return img;
   if(this.model()==='G6'&&this.year()==='2026')return base+'/g6-studio.webp';
   return base+'/models/'+xpAssetModel(this.model())+'-'+this.paint()+'.webp';
 }
 lastUpdate(){
   const raw=this.val('last_update'),stamp=this.data('last_update')?.entity?.last_updated;
   const t=raw||stamp;if(!t)return 'Unavailable';
   const parsed=Date.parse(String(t));if(!Number.isFinite(parsed))return String(t);
   const age=Math.max(0,Math.floor((Date.now()-parsed)/60000));return age<1?'Just now':age<60?age+' min ago':age<1440?Math.floor(age/60)+'h ago':new Date(parsed).toLocaleDateString();
 }
 tireSummary(){
  const values=['tire_fl','tire_fr','tire_rl','tire_rr'].map(k=>this.number(k));
  if(values.some(v=>v===null))return '—';
  return xpNum(values.reduce((a,b)=>a+b,0)/400,2)+' bar';
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
  const v=this.bool('charging'),plug=this.bool('plugged');
  if(v===true)return 'Charging now';
  if(plug===true)return 'Plugged in';
  if(v===false)return 'Not charging';
  return 'Charging unavailable';
 }
 title(){
  return `<div class="xp-title"><h1>XPENG <em>${xpEsc(this.model())}</em></h1><div class="xp-subtitle">${this._view==='charging'?xpEsc(this.chargeStatus()):'Vehicle status'}</div></div>`;
 }
 sceneBackdrop(){
  return `<svg class="xp-sky" viewBox="0 0 1500 850" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="xp-ridge" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#152a49"/><stop offset="1" stop-color="#031425"/></linearGradient>
      <linearGradient id="xp-haze" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#314778"/><stop offset="1" stop-color="#031b35"/></linearGradient></defs>
    <path d="M0 337L45 331 98 308 140 334 188 303 248 315 298 279 351 308 407 293 456 315 525 291 590 315 634 278 683 302 733 273 785 302 830 269 880 300 935 273 983 297 1034 260 1093 288 1154 255 1207 281 1250 270 1319 303 1370 275 1430 303 1500 282V710H0Z" fill="url(#xp-haze)" opacity=".6"/>
    <path d="M0 430L57 415 103 390 151 409 198 385 245 401 289 373 324 394 392 355 437 373 475 340 527 366 565 338 602 356 646 331 686 363 737 324 788 349 828 327 866 353 910 316 951 356 1004 331 1053 357 1098 320 1155 346 1222 311 1265 343 1310 309 1359 340 1408 314 1454 344 1500 323V690H0Z" fill="url(#xp-ridge)" opacity=".9"/>
    <path d="M0 552L60 534 106 518 174 536 227 499 273 507 327 485 384 508 419 486 462 506 516 478 558 496 620 471 666 496 726 472 769 486 821 464 871 488 912 470 964 489 1015 472 1072 492 1109 478 1158 505 1227 485 1264 517 1330 496 1391 525 1450 512 1500 527V692H0Z" fill="#061326" opacity=".9"/>
  </svg><div class="xp-ground"></div><div class="xp-stage-glow"></div>`;
 }
 header(){
   const now=new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
   const conn=String(this.val('connection')||'').toLowerCase();
   const connected=['connected','online'].includes(conn);
   return `<header class="xp-header"><div class="xp-brand"><span class="xp-x-mark">✕</span><span>XPENG</span></div>
     <div class="xp-header-right"><span class="xp-wifi ${connected?'xp-connected':''}" aria-label="${xpEsc(xpConnText(this.val('connection')))}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M2 8c5.7-5.6 14.3-5.6 20 0M5 12c4-3.6 10-3.6 14 0M9 16c1.8-1.4 4.2-1.4 6 0"/><circle cx="12" cy="20" r="1.3" fill="currentColor" stroke="none"/></svg></span>
     <button class="xp-head-button" type="button" data-view="overview" aria-label="Vehicle overview">${xpIcon('home',23)}</button>
     <button class="xp-head-button" type="button" data-expand aria-label="${this._expanded?'Exit full screen':'Full screen'}">${this._expanded?'✕':'⛶'}</button>
     <span class="xp-head-separator"></span><span class="xp-clock">${xpEsc(now)}</span></div></header>`;
 }
 progress(){
   const soc=xpPercent(this.val('soc'));
   return `<div class="xp-progress" role="progressbar" aria-label="Battery state of charge" aria-valuemin="0" aria-valuemax="100" ${soc===null?'':'aria-valuenow="'+soc+'"'}>
      <div style="width:${soc??0}%"></div></div>`;
 }
 socHtml(){
  const v=this.number('soc');return v===null?'—':xpNum(v)+'<span class="xp-unit">%</span>';
 }
 updated(){return `<div class="xp-updated">Last update<strong>${xpEsc(this.lastUpdate())}</strong></div>`;}
 carArt(){
   return `<img class="xp-car xp-paint-${xpEsc(this.paint())}" src="${xpEsc(this.asset())}" alt="XPENG ${xpEsc(this.model())} vehicle" loading="eager">`;
 }
 overview(){
  const rows=[['gauge','Odometer',this.num('odometer','km')],['tire','Tire pressure',this.tireSummary()],['pin','Location',this.locationText()]];
  return `${this.title()}${this.updated()}${this.carArt()}
    <section class="xp-overview-stat" aria-label="Battery and estimated range">
     <div class="xp-batt-line"><div class="xp-batt-glyph"><div class="xp-batt-fill" style="height:${xpPercent(this.val('soc'))??0}%"></div></div>
       <div><div class="xp-stat-label">Battery</div><div class="xp-soc">${this.socHtml()}</div></div></div>
     ${this.progress()}<div class="xp-overview-range"><div class="xp-stat-label">Estimated range</div><div class="xp-range-num">${xpIcon('gauge',36)}<span>${xpEsc(this.num('range','km'))}</span></div></div>
    </section>
    <aside class="xp-status-panel" aria-label="Vehicle information">
      ${rows.map(([icon,label,val])=>`<div class="xp-info-row"><div class="xp-info-icon">${xpIcon(icon,31)}</div>
      <div class="xp-info-copy"><small>${xpEsc(label)}</small><b>${xpEsc(val)}</b></div><span class="xp-chevron">${xpIcon('arrow',19)}</span></div>`).join('')}
    </aside>`;
 }
 charging(){
  return `${this.title()}${this.updated()}
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
  const isCharging=this._view==='charging';
  this.shadowRoot.innerHTML=`<style>${XP_CSS}</style><ha-card><div class="xp-scene ${isCharging?'xp-charge':'xp-overview'}">
   ${this.sceneBackdrop()}${this.header()}${isCharging?this.charging():this.overview()}
   <span class="xp-version">Dashboard v0.1.0</span>
   </div></ha-card>`;
 }
}
class XpengVehicleCardEditor extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});
  this._cfg=xpNormalizeAppearance({prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'arctic_white'});
  this.shadowRoot.addEventListener('change',e=>{
   const el=e.target.closest('[data-key]');if(!el)return;
   const key=el.dataset.key;
   let cfg={...this._cfg,[key]:el.value};
   if(cfg.prefix&&!/^[a-z0-9_]+$/.test(cfg.prefix))return;
   if(key==='year'&&!xpAllowedModels(cfg.year).some(x=>x.id===cfg.model))cfg.model=xpAllowedModels(cfg.year)[0]?.id||'Other';
   if(key==='year'||key==='model'){cfg.trim=xpAllowedTrims(cfg.model,cfg.year)[0].id;cfg.color=xpAllowedPaints(cfg.model,cfg.year,cfg.trim)[0].id;}
   if(key==='trim'&&!xpAllowedPaints(cfg.model,cfg.year,cfg.trim).some(x=>x.id===cfg.color))cfg.color=xpAllowedPaints(cfg.model,cfg.year,cfg.trim)[0].id;
   this._cfg=xpNormalizeAppearance(cfg);this.render();
   this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._cfg},bubbles:true,composed:true}));
  });
 }
 setConfig(cfg){this._cfg=xpNormalizeAppearance({...cfg});this.render();}
 set hass(_value){}
 render(){
  const v=xpNormalizeAppearance(this._cfg);
  const select=(key,label,values)=>`<label>${xpEsc(label)}<select data-key="${key}">${values.map(x=>`<option value="${xpEsc(x.id)}" ${v[key]===x.id?'selected':''}>${xpEsc(x.label)}</option>`).join('')}</select></label>`;
  this.shadowRoot.innerHTML=`<style>section{display:grid;gap:13px;padding:14px;font:inherit}label{display:grid;gap:5px;font-size:13px}input,select{border:1px solid #8b959e;border-radius:7px;padding:10px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#111)}p{font-size:12px;opacity:.8;line-height:1.5}</style><section>
    <label>Entity prefix<input data-key="prefix" value="${xpEsc(v.prefix||'my_xpeng')}"></label>
    ${select('year','Model year',XP_YEARS.map(y=>({id:y,label:y})))}
    ${select('model','Model',xpAllowedModels(v.year).map(m=>({id:m.id,label:m.name})))}
    ${select('trim','Trim',xpAllowedTrims(v.model,v.year))}
    ${select('color','Exterior paint',xpAllowedPaints(v.model,v.year,v.trim))}
    <label>Image assets directory<input data-key="image_path" value="${xpEsc(v.image_path||'/hacsfiles/xpeng-vehicle-card/assets')}"></label>
    <p>Dashboard v0.1.0 has two read-only screens: vehicle status and charging. Screens switch automatically when the charging binary sensor changes. Vehicle telemetry comes only from Home Assistant entities. Appearance options are visual only.</p>
  </section>`;
 }
}
if(!customElements.get('xpeng-vehicle-card'))customElements.define('xpeng-vehicle-card',XpengVehicleCard);
if(!customElements.get('xpeng-vehicle-card-editor'))customElements.define('xpeng-vehicle-card-editor',XpengVehicleCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='xpeng-vehicle-card'))window.customCards.push({type:'xpeng-vehicle-card',name:'XPENG Dashboard',description:'Two-screen vehicle status and charging dashboard (read-only)'});
