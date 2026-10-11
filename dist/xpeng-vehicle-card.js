/**
 * XPENG Vehicle Card v1.0.0-alpha.1 — XPENG vehicle monitoring dashboard (read-only).
 * Independent implementation. Uses no external vehicle-control APIs.
 * Reads only Home Assistant state. Does not send vehicle commands.
 */
const XP_INVALID = new Set(['unknown','unavailable','none','null','']);
const XP_KEYS = Object.freeze({
 model:['sensor','vehicle_model'],name:['sensor','vehicle_name'],powertrain:['sensor','vehicle_powertrain'],
 connection:['sensor','api_connection_status'],soc:['sensor','battery'],range:['sensor','estimated_range'],
 charging:['binary_sensor','charging'],plugged:['binary_sensor','plugged_in'],target:['sensor','charging_target'],
 power:['sensor','charging_power'],energy:['sensor','charge_session_energy'],remaining:['sensor','charge_remaining'],
 current:['sensor','charge_current'],voltage:['sensor','charge_voltage'],odometer:['sensor','odometer'],
 locked:['binary_sensor','locked'],door_fl:['binary_sensor','door_front_left_open'],
 door_fr:['binary_sensor','door_front_right_open'],door_rl:['binary_sensor','door_rear_left_open'],
 door_rr:['binary_sensor','door_rear_right_open'],trunk:['binary_sensor','trunk_open'],hood:['binary_sensor','hood_open'],
 climate:['binary_sensor','climate_active'],cabin:['sensor','cabin_temperature'],outside:['sensor','outside_temperature'],
 health:['sensor','battery_health'],battery_voltage:['sensor','battery_voltage'],
 battery_current:['sensor','battery_current'],battery_12v:['sensor','12v_supply_voltage'],
 tire_fl:['sensor','front_left_tire_pressure'],tire_fr:['sensor','front_right_tire_pressure'],
 tire_rl:['sensor','rear_left_tire_pressure'],tire_rr:['sensor','rear_right_tire_pressure'],
 fuel:['sensor','fuel_level'],fuel_range:['sensor','fuel_powered_range'],combined:['sensor','combined_range'],
 last_update:['sensor','last_vehicle_update'],location:['device_tracker','location'],
 speed:['sensor','vehicle_speed']
});
const XP_ICONS = {
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
function xpCabinSvg(theme){
 const light=theme==='light_gray';
 const c=light?{
  floor:'#222830',structure:'#545b62',leather:'#d9dbd7',leather2:'#c2c6c5',leather3:'#eceee9',doors:'#b7bec0',dash:'#d5d7d5',wheel:'#b1b6ba',seams:'#90999d',console:'#c9cdcd',screen:'#0d1927',lights:'#8fa6b8'
 }:{
  floor:'#12171e',structure:'#333c45',leather:'#424b53',leather2:'#303941',leather3:'#555f68',doors:'#343c43',dash:'#3f464d',wheel:'#454e56',seams:'#78828a',console:'#3b434b',screen:'#101b29',lights:'#647788'
 };
 const seat=(x,y,w,h)=>`<g><rect x="${x+4}" y="${y+14}" width="${w-8}" height="${h-6}" rx="21" fill="${c.leather2}" stroke="${c.seams}" stroke-width="1.4"/>
  <rect x="${x+3}" y="${y-6}" width="${w-6}" height="30" rx="12" fill="${c.leather3}" stroke="${c.seams}" stroke-width="1.2"/>
  <rect x="${x+10}" y="${y+33}" width="${w-20}" height="${h-31}" rx="15" fill="${c.leather}" stroke="${c.seams}" stroke-width="1.15"/>
  <path d="M${x+12} ${y+55} Q${x+w/2} ${y+42} ${x+w-12} ${y+55} M${x+12} ${y+h-24} Q${x+w/2} ${y+h-17} ${x+w-12} ${y+h-24}" fill="none" stroke="${c.seams}" stroke-opacity=".46" stroke-width="1.5"/></g>`;
 return `<svg class="xp-cabin-svg" viewBox="0 0 420 554" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="XPENG illustrative cabin, ${light?'Light Gray':'Dark Gray'} upholstery, steering wheel, dashboard, door panels and seats all in selected finish">
 <defs><linearGradient id="xpCockpitGlaze" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.leather3}"/><stop offset="1" stop-color="${c.leather2}"/></linearGradient><linearGradient id="xpFloor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${c.floor}"/><stop offset="1" stop-color="#0a1017"/></linearGradient></defs>
 <path d="M111 22 Q210 1 309 22 L352 79 358 436 331 523 Q210 550 89 523 L62 436 68 79Z" fill="${c.structure}" stroke="#687480" stroke-width="2" />
 <path d="M117 34 Q210 18 303 34 L335 87 341 423 314 510 Q210 532 106 510 L79 423 85 87Z" fill="url(#xpFloor)"/>
 <!-- Entire door inserts follow the selected interior theme -->
 <path d="M86 106 Q67 131 75 273 L83 398 109 401 112 145Z" fill="${c.doors}" stroke="${c.seams}" stroke-width="1.5"/>
 <path d="M334 106 Q353 131 345 273 L337 398 311 401 308 145Z" fill="${c.doors}" stroke="${c.seams}" stroke-width="1.5"/>
 <path d="M93 166 L98 355 M327 166 L322 355" stroke="${c.lights}" opacity=".7" stroke-width="3" stroke-linecap="round"/>
 <!-- Dash cover & fascia -->
 <rect x="91" y="48" width="238" height="89" rx="21" fill="${c.dash}" stroke="${c.seams}" stroke-width="1.4"/>
 <path d="M103 102 Q210 92 317 102" stroke="${c.leather3}" stroke-width="10" stroke-linecap="round" opacity=".55" />
 <path d="M103 122 Q210 112 317 122" stroke="${c.lights}" stroke-width="2.2" stroke-linecap="round" />
 <!-- Steering wheel trim and spokes match selected palette; central screen remains dark -->
 <circle cx="149" cy="94" r="33" fill="none" stroke="${c.wheel}" stroke-width="13" />
 <circle cx="149" cy="94" r="33" fill="none" stroke="${c.seams}" stroke-width="1.2"/>
 <path d="M122 91 L141 100 M176 91 L157 100 M148 102 L148 121" stroke="${c.wheel}" stroke-width="9" stroke-linecap="round"/>
 <ellipse cx="149" cy="99" rx="15" ry="11" fill="${c.leather3}" stroke="${c.seams}" />
 <path d="M143 99l6-4 6 4-6 3z" fill="${c.structure}" opacity=".9"/>
 <rect x="207" y="69" width="74" height="51" rx="7" fill="#11171b" stroke="${c.seams}" stroke-width="2"/>
 <rect x="213" y="75" width="62" height="39" rx="4" fill="${c.screen}"/><path d="M220 96 L266 96 M242 80V108" stroke="#597b8c" opacity=".23"/>
 <!-- Center console trim flows from dashboard to rear -->
 <rect x="185" y="151" width="50" height="264" rx="18" fill="${c.console}" stroke="${c.seams}" stroke-width="1.3"/>
 <rect x="191" y="169" width="38" height="78" rx="11" fill="${c.leather2}"/>
 <circle cx="204" cy="193" r="9" fill="${c.screen}" stroke="${c.seams}"/><circle cx="216" cy="215" r="9" fill="${c.screen}" stroke="${c.seams}"/>
 <rect x="191" y="272" width="38" height="105" rx="12" fill="${c.leather}" stroke="${c.seams}"/>
 <!-- Front seats -->
 ${seat(112,188,73,150)}${seat(235,188,73,150)}
 <!-- Backrests & seat bases in same upholstery -->
 ${seat(107,406,67,84)}${seat(177,406,67,84)}${seat(247,406,67,84)}
 <path d="M98 394 Q210 376 322 394" stroke="${c.leather3}" stroke-opacity=".4" fill="none" stroke-width="5"/>
 <!-- Structural non-upholstered surfaces remain dark for material realism -->
 <path d="M115 38 Q210 19 305 38" stroke="#b0bec8" opacity=".18" stroke-width="4" fill="none" />
 </svg>`;
}

function xpAssetModel(model){return model.toLowerCase().replace(/\s+/g,'_').replace(/\+/g,'_plus').replace(/[^a-z0-9_]/g,'');}
const XP_CSS = `
:host{display:block;--xp-bg:#171819;--xp-text:#f5f6f7;--xp-soft:#98a1aa;--xp-green:#4cbd87;color:var(--xp-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}*{box-sizing:border-box}ha-card{display:block;width:100%;background:#171819!important;color:#f5f6f7!important;border:0!important;border-radius:20px!important;overflow:hidden!important}.app{width:100%;max-width:none;min-height:0;margin:0;padding:0;direction:ltr}:host([data-theme="light"]){--xp-text:#18212b;--xp-soft:#697988} :host([data-theme="light"]) .xt-card{background:#f8f9fb;color:#1b222a}:host([data-theme="light"]) .xt-nav-row{border-color:#dde2e6}:host([data-theme="light"]) .xt-nav-copy small{color:#596b7c}:host([data-theme="light"]) .xt-shortcuts button{background:#e5e9ee;color:#263644}:host([data-theme="light"]) .xt-car-stage{background:#eceff3}:host([data-theme="light"]) .xt-panel-head button{color:#273343}:host([data-expanded]),:host(:fullscreen){position:fixed!important;inset:0!important;z-index:2147483100!important;max-width:none!important;width:100vw!important;height:100vh!important;height:100dvh!important;overflow:auto!important;background:#181a1c!important}:host([data-expanded]) ha-card,:host(:fullscreen) ha-card{border-radius:0!important;min-height:100%!important}:host([data-expanded]) .xt-card,:host(:fullscreen) .xt-card{max-width:1300px;min-height:95vh}
/* v0.8 experimental vehicle-app style structure, independently implemented for XPENG. */
:host([data-cockpit]) ha-card{background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important}
:host([data-cockpit]) .app{padding:0!important;background:transparent!important;max-width:none!important;margin:0 auto!important}
:host([data-cockpit]) .app{min-height:0!important;height:auto!important}
:host([data-cockpit]){display:block}
.xt-card{width:100%;max-width:900px;box-sizing:border-box;margin:0 auto;background:#17181a;border:1px solid #303235;color:#f4f5f6;border-radius:22px;padding:24px 25px 14px;box-shadow:0 18px 55px #0003;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.xt-card button{font:inherit;color:inherit}
.xt-card button:focus-visible{outline:2px solid #7cbbff;outline-offset:2px}
.xt-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:0 2px 13px}
.xt-car-name{display:flex;align-items:center;gap:6px;font-size:24px;font-weight:700;letter-spacing:-.5px}
.xt-car-name button{border:0;background:transparent;color:#aab0b5;cursor:pointer}
.xt-head-details{display:flex;align-items:center;gap:14px;color:#e1e3e6;margin-top:8px;font-size:14px;font-weight:580}
.xt-mini-battery{display:flex;align-items:center;gap:6px}
.xt-muted{font-size:11px;color:#8a919a;margin-top:8px;line-height:1.5}
.xt-head-buttons button,.xt-panel-head button{border:0;background:transparent;padding:5px 9px;color:#cacfd5;font-size:24px;cursor:pointer}
.xt-landing{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(255px,1fr);gap:24px;align-items:center}
.xt-left{min-width:0}
.xt-car-stage{position:relative;aspect-ratio:1.7;display:flex;justify-content:center;align-items:center;overflow:hidden;border-radius:10px;background:#1e2023}
.xt-car-stage img{display:block;width:100%;height:100%;object-fit:contain}
.xt-charge-tag{position:absolute;right:8px;bottom:8px;background:#15382a;color:#8bffbb;border-radius:12px;padding:6px 10px;font-size:11px}
.xt-shortcuts{display:flex;justify-content:space-evenly;gap:12px;margin-top:15px}
.xt-shortcuts button{display:grid;place-items:center;min-height:49px;min-width:49px;border-radius:50%;border:0;background:#25272a;cursor:pointer;color:#f2f3f5}
.xt-shortcuts button:hover:not(:disabled){background:#303b4a}
.xt-shortcuts button[disabled]{opacity:.45;cursor:not-allowed}
.xt-navigation{min-width:0;align-self:stretch;display:flex;flex-direction:column;justify-content:center}
.xt-nav-row{display:flex;align-items:center;gap:14px;border:0;background:transparent;border-bottom:1px solid #33363a;padding:15px 5px;min-height:66px;cursor:pointer;text-align:left;width:100%}
.xt-nav-row:last-child{border-bottom:0}
.xt-nav-row:hover{background:#202225}
.xt-nav-icon{display:grid;place-items:center;width:36px;color:#d9e0e6}
.xt-nav-copy{display:flex;flex-direction:column;flex:1;gap:3px}
.xt-nav-copy b{font-weight:600;font-size:15px}
.xt-nav-copy small{font-size:11px;color:#8f969c}
.xt-nav-row>svg{color:#858b93}
.xt-footnote{text-align:center;margin-top:17px;font-size:10px;color:#858c97}
.xt-panel-head{height:43px;display:flex;align-items:center;gap:8px;margin-bottom:8px}
.xt-panel-head h2{font-size:22px;margin:0;font-weight:600}
.xt-panel{min-height:300px}
.xt-control-stage{position:relative;background:#181a1d;border-radius:11px;min-height:350px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.xt-diagram{position:relative;width:80%;height:330px}
.xt-diagram .xp-top-car{position:absolute;inset:0;width:100%;height:100%}
.xt-diagram .xp-pin-label{max-width:125px}
.xp-pin-label{position:absolute;z-index:2;max-width:112px;min-width:84px;padding:6px 8px;background:#171e28e6;border:1px solid #556574;border-radius:10px;color:#dfe7ef;font-size:10px;line-height:1.3}
.xp-pin-label b{display:block;margin-top:3px;font-size:11px}
.xp-pin-fl{top:20%;left:4%}.xp-pin-fr{top:20%;right:4%}.xp-pin-rl{bottom:19%;left:4%}.xp-pin-rr{bottom:19%;right:4%}
.xp-pin-label.is-open{border-color:#eab090}

.xt-car-zones{position:absolute;inset:0;pointer-events:none}
.xt-car-zones button{position:absolute;pointer-events:none;border:1px solid #4d5359;border-radius:7px;background:#23262ae0;padding:7px 10px;font-size:11px;color:#8a939c;opacity:.8}
.xt-car-zones button:nth-child(1){top:8%;left:46%}
.xt-car-zones button:nth-child(2){top:43%;left:47%}
.xt-car-zones button:nth-child(3){bottom:10%;left:46%}
.xt-segmented{display:flex;justify-content:space-between;align-items:center;padding:12px 4px;gap:16px;color:#acb7c4;font-size:12px}
.xt-segmented button{display:flex;align-items:center;gap:7px;background:#292d31;border:0;border-radius:7px;padding:8px 12px;font-size:12px;cursor:pointer}
.xt-control-bar{display:flex;justify-content:space-around;gap:8px;padding:16px 0}
.xt-control-bar button{display:flex;align-items:center;flex-direction:column;gap:7px;background:transparent;border:0;padding:6px;color:#7c858f;opacity:.65;cursor:not-allowed}
.xt-control-bar small{font-size:11px}
.xt-climate-area{height:330px;position:relative;display:grid;place-items:center;background:linear-gradient(180deg,#232528,#141618);border-radius:11px;overflow:hidden}
.xt-cabin-surface{height:100%;width:100%;display:flex;align-items:center;justify-content:center}
.xt-cabin-surface svg{height:100%;width:auto;max-width:100%}
.xt-cabin-overlay{position:absolute;left:calc(50% - 80px);top:31%;width:160px;height:105px;pointer-events:none;display:flex;justify-content:space-between;align-items:center}
.xt-cabin-overlay button{border:1px solid #5b6670;border-radius:50%;width:36px;height:36px;background:#161d25bb;opacity:.5;cursor:not-allowed;display:grid;place-items:center}
.xt-temp-panel{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:20px 9px}
.xt-temp-panel>div{display:flex;flex-direction:column;align-items:center;gap:5px}
.xt-temp-panel small{font-size:11px;color:#989fa8}
.xt-temp-panel strong{font-size:21px}
.xt-climate-stepper{display:flex!important;flex-direction:row!important;align-items:center;gap:9px}
.xt-climate-stepper button,.xt-stepper button{background:#2b2d30;border:0;border-radius:7px;width:38px;height:38px;font-size:22px;opacity:.5}
.xt-seat-functions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.xt-seat-functions>div{display:flex;justify-content:space-between;gap:9px;align-items:center;padding:12px;border:1px solid #34383b;border-radius:11px;background:#222427}
.xt-seat-functions span{display:flex;align-items:center;gap:7px;font-size:12px}
.xt-seat-functions button{font-size:11px;background:#303236;border:0;border-radius:7px;padding:8px;color:#a2abb4;cursor:not-allowed}
.xt-inline-foot{font-size:10px;color:#858c95;padding-top:12px}
.xt-charger-image{height:230px;display:grid;place-items:center;background:#202225;border-radius:11px;overflow:hidden}
.xt-charger-image img{width:100%;height:100%;object-fit:contain}
.xt-battery,.xt-charging-setting{padding:18px 6px;border-bottom:1px solid #363a3f}
.xt-battery>div:first-child,.xt-charging-setting label{display:flex;justify-content:space-between;align-items:center;gap:10px}
.xt-battery span,.xt-charging-setting label{font-size:13px}
.xt-battery strong{font-size:23px}
.xt-battery>span{display:block;font-size:11px;color:#a5adb5;margin-top:10px}
.xt-track{background:#32383a;border-radius:90px;height:12px;margin-top:13px;overflow:hidden}
.xt-track div{height:100%;background:#4abb88;border-radius:90px}
.xt-charging-setting input{width:100%;accent-color:#4abb88;margin-top:14px;opacity:.5}
.xt-stepper{display:flex;justify-content:center;align-items:center;gap:18px;padding:10px 0}
.xt-port-button{display:block;border:0;background:transparent;color:#9eabb4!important;margin:22px auto 7px;opacity:.55;cursor:not-allowed}
.xt-location-map{min-height:300px;display:flex;align-items:center;flex-direction:column;justify-content:center;background:#20252a;border-radius:10px;gap:13px;color:#c6cdd6}
.xt-location-map small{color:#929ca6;font-size:11px}
.xt-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.xt-values>div{background:#232528;border-radius:9px;padding:14px;display:flex;justify-content:space-between;gap:8px}
.xt-values span{font-size:12px;color:#a2adb7}
.xt-values b{font-size:12px;color:#e9edef}
:host([data-cockpit][data-expanded]) .xt-card{max-width:1150px;min-height:98vh}
:host([data-cockpit][data-expanded]) .xt-car-stage{min-height:48vh}
@media(max-width:680px){
 .xt-card{border-radius:14px;padding:17px 12px 12px}
 .xt-car-name{font-size:22px}
 .xt-landing{display:block}
 .xt-car-stage{aspect-ratio:1.55}
 .xt-navigation{margin-top:15px}
 .xt-nav-row{min-height:56px;padding:11px}
 .xt-shortcuts{margin-top:12px}
 .xt-climate-area{height:300px}
 .xt-control-stage{min-height:310px}
 .xt-diagram{width:100%;height:290px}
 .xt-car-zones button:nth-child(1){left:43%}
 .xt-car-zones button:nth-child(2){left:44%}
 .xt-car-zones button:nth-child(3){left:43%}
 .xt-seat-functions{grid-template-columns:1fr}
 .xt-temp-panel{padding:14px 0}
 .xt-footnote{padding-bottom:92px}
}

`;
class XpengVehicleCard extends HTMLElement{
 constructor(){super();this.attachShadow({mode:'open'});this._expanded=false;this._nativeFull=false;this._config={prefix:'my_xpeng',theme:'dark'};this._view='overview';this._hass=null;this._vehicleIndex=0;
   this.shadowRoot.addEventListener('click',e=>{const target=e.target.closest('button[data-view],button[data-back],button[data-cycle],button[data-expand]');if(!target)return;
    if(target.hasAttribute('data-expand')){
      this._expanded=!this._expanded;
      if(this._expanded&&typeof this.requestFullscreen==='function'){
        this._nativeFull=true;this.requestFullscreen().catch(()=>{this._nativeFull=false;});
      }else if(!this._expanded&&document.fullscreenElement===this&&typeof document.exitFullscreen==='function'){
        document.exitFullscreen().catch(()=>{});
      }
      this.render();return;
    }
    if(target.dataset.view){this._view=target.dataset.view;this.render();}
    else if(target.dataset.back!==undefined){this._view='overview';this.render();}
    else if(target.dataset.cycle!==undefined){this._vehicleIndex=(this._vehicleIndex+1)%this.vehicles().length;this._view='overview';this.render();}});
   
 }
 connectedCallback(){
   if(!this._fsListener)this._fsListener=()=>{if(this._nativeFull&&!document.fullscreenElement){this._nativeFull=false;this._expanded=false;this.render();}};
   document.addEventListener('fullscreenchange',this._fsListener);
 }
 disconnectedCallback(){if(this._fsListener)document.removeEventListener('fullscreenchange',this._fsListener);}
 setConfig(config){if(config.dashboard_layout && !['classic','cockpit'].includes(config.dashboard_layout))throw Error('dashboard_layout must be classic or cockpit');
  if(config.prefix&&!/^[a-z0-9_]+$/.test(config.prefix))throw Error('XPENG prefix must be a slug');
 if(config.image_path&&!/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_-]+\/?$/.test(config.image_path))throw Error('image_path must be a local Home Assistant directory');
 const original={prefix:'my_xpeng',theme:'dark',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',...config};
 // For older configs, coerce only values that are no longer valid in the selected model year.
 const normalized=xpNormalizeAppearance(original);this._config={...original,...normalized};this.render();}
 set hass(hass){this._hass=hass;this.render();}get hass(){return this._hass;}
 getCardSize(){return this._view==='overview'?6:9;}
 static getConfigElement(){return document.createElement('xpeng-vehicle-card-editor');}
 static getStubConfig(){return {type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',theme:'dark'};}
 vehicles(){const list=this._config.vehicles;return Array.isArray(list)&&list.length?list:[this._config];}
 vehicle(){return this.vehicles()[Math.min(this._vehicleIndex,this.vehicles().length-1)]||this._config;}
 prefix(){return this.vehicle().prefix||this._config.prefix||'my_xpeng';}
 appearance(){return xpNormalizeAppearance({...this._config,...this.vehicle()});}

 year(){return this.appearance().year;}
 selectedModel(){return this.appearance().model;}
 trim(){return this.appearance().trim;}
 paint(){return this.appearance().color;}
 interior(){return this.appearance().interior;}
 isG6(){return this.selectedModel()==='G6';}

 data(key){const explicit=this.vehicle().entities?.[key]||this._config.entities?.[key];const tuple=XP_KEYS[key];if(!tuple)return null;const id=explicit||`${tuple[0]}.${this.prefix()}_${tuple[1]}`;const entity=this._hass?.states?.[id];const raw=entity?.state??null;return {id,entity,value:raw===null||(typeof raw==='string'&&XP_INVALID.has(raw.toLowerCase()))?null:raw};}
 val(key){return this.data(key)?.value??null;}
 bool(key){return xpBool(this.val(key));}
 n(key,dec=0){return xpNum(this.val(key),dec);}
 model(){return this.selectedModel();}
 name(){const n=this.vehicle().name||this.val('name');return n&&n!=='My XPENG'&&n!=='XPENG'?n:'XPENG '+this.model();}
 charging(){return this.bool('charging')===true;}
 plugged(){return this.bool('plugged')===true;}
 asset(){const base=(this._config.image_path||'/hacsfiles/xpeng-vehicle-card/assets').replace(/\/$/,'');const img=this.vehicle().image||this._config.image;
 if(img&&/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_\-.]+$/.test(img))return img;
 if(this.isG6()&&this.year()==='2026')return `${base}/g6-2026-${this.paint()}.webp`;
 return `${base}/models/${xpAssetModel(this.model())}-${this.paint()}.webp`;
 }
 status(key,onLabel,offLabel){const b=this.bool(key);return b===null?'Not available':b?onLabel:offLabel;}
 topVisual(){
   const tires=this._view==='tires';
   const entries=tires
    ?[['tire_fl','Front left','xp-pin-fl'],['tire_fr','Front right','xp-pin-fr'],['tire_rl','Rear left','xp-pin-rl'],['tire_rr','Rear right','xp-pin-rr']]
    :[['door_fl','Front left','xp-pin-fl'],['door_fr','Front right','xp-pin-fr'],['door_rl','Rear left','xp-pin-rl'],['door_rr','Rear right','xp-pin-rr']];
   const labels=entries.map(([key,label,pos])=>{
     const value=tires?this.value(key,'kPa'):this.status(key,'Open','Closed');
     return `<div class="xp-pin-label ${pos} ${!tires&&this.bool(key)===true?'is-open':''}">${xpEsc(label)}<b>${xpEsc(value)}</b></div>`;
   }).join('');
   return `<svg class="xp-top-car" viewBox="0 0 560 340" role="img" aria-label="Vehicle viewed from above" xmlns="http://www.w3.org/2000/svg">
     <defs><linearGradient id="xp-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8697a6"/><stop offset=".5" stop-color="#445666"/><stop offset="1" stop-color="#202c36"/></linearGradient></defs>
     <ellipse cx="280" cy="297" rx="100" ry="15" fill="#070b0e" opacity=".5"/>
     <rect x="202" y="56" width="15" height="61" rx="6" fill="#0d1116"/><rect x="343" y="56" width="15" height="61" rx="6" fill="#0d1116"/><rect x="202" y="228" width="15" height="61" rx="6" fill="#0d1116"/><rect x="343" y="228" width="15" height="61" rx="6" fill="#0d1116"/>
     <rect x="211" y="25" width="138" height="288" rx="47" fill="url(#xp-body)" stroke="#9aa8b2" stroke-width="1.5"/>
     <path d="M226 95 Q280 74 334 95 L330 225 Q280 245 230 225Z" fill="#172b39" stroke="#7a919d" stroke-width="3"/>
     <path d="M228 115 H332 M230 221 H330 M280 115 V221" stroke="#8096a6" stroke-width="3" fill="none" opacity=".76"/>
     <rect x="248" y="42" width="65" height="5" rx="3" fill="#e5f3fa"/><rect x="246" y="294" width="68" height="5" rx="3" fill="#f16d6a"/>
   </svg>${labels}`;
 }
 hero(){
   const view=this._view,model=this.model();
   if(view==='climate'||view==='interior'||view==='comfort')
     return `<div class="hero xp-hero-cabin" data-hero-view="${xpEsc(view)}"><div class="xp-view-caption">${view==='climate'?'Climate & cabin':view==='comfort'?'Comfort & seats':'Interior & seats'}</div>${xpCabinSvg(this.interior())}</div>`;
   if(view==='controls'||view==='vehicle'||view==='tires')
     return `<div class="hero xp-hero-plan" data-hero-view="${xpEsc(view)}"><div class="xp-view-caption">${view==='tires'?'Tire monitoring':'Vehicle access'}</div>${this.topVisual()}</div>`;
   const charging=this.charging(),soc=xpPercent(this.val('soc'));
   const chargeOverlay=view==='charging'
    ?`<div class="xp-charge-visual xp-page-visual"><small>BATTERY</small><strong>${soc===null?'—':xpNum(soc)+'%'}</strong><small>${this.val('power')===null?'Power unavailable':xpEsc(this.n('power',1)+' kW')}</small></div>`:'';
   const locationOverlay=view==='location'
    ?`<div class="xp-pin-visual xp-page-visual">${xpIcon('pin',37)}<small>LOCATION</small></div>`:'';
   const headerText={charging:'Charging system',location:'Vehicle location',info:'Vehicle information',appearance:'Exterior appearance'};
   return `<div class="hero ${this.isG6()?'g6':''} ${charging?'is-charging':''}" data-hero-view="${xpEsc(view)}">${headerText[view]?`<div class="xp-view-caption">${headerText[view]}</div>`:''}<img alt="XPENG ${xpEsc(model)} vehicle artwork" src="${xpEsc(this.asset())}" loading="eager">${chargeOverlay}${locationOverlay}${charging&&view==='overview'?`<div class="hero-badge">${xpIcon('bolt',15)} ${this.val('power')===null?'Charging':this.n('power',1)+' kW'}</div>`:''}</div>`;
 }

 vehicleMenuHeader(){
  const soc=xpPercent(this.val('soc')),range=this.value('range','km');
  const trim=xpAllowedTrims(this.model(),this.year()).find(v=>v.id===this.trim())?.label||'';
  return `<header class="xt-header">
    <div><div class="xt-car-name">${xpEsc(this.name())}${this.vehicles().length>1?`<button type="button" data-cycle aria-label="Switch vehicle">⌄</button>`:''}</div>
      <div class="xt-head-details"><span class="xt-mini-battery">${xpIcon('battery',19)} <span>${soc===null?'—':xpNum(soc)+'%'}</span></span><span>${xpEsc(range)}</span></div>
      <div class="xt-muted">${xpEsc(this.year())} · ${xpEsc(trim)} · ${xpEsc(xpConnText(this.val('connection')))}</div>
    </div>
    <div class="xt-head-buttons">
      <button type="button" data-expand aria-label="${this._expanded?'Exit full screen':'Full screen'}">${this._expanded?'✕':'⛶'}</button>
    </div>
  </header>`;
 }
 vehicleMenuLanding(){
  const charging=this.bool('charging');
  const locked=this.bool('locked');
  const menu=[
    ['controls','Controls',xpIcon('car',20),this.status('locked','Locked','Unlocked')],
    ['climate','Climate',xpIcon('fan',20),this.status('climate','On','Off')+' · '+this.value('cabin','°C',1)],
    ['location','Location',xpIcon('pin',20),this.val('location')===null?'Not available':'Open location details'],
    ['charging','Charging',xpIcon('bolt',20),charging===null?'Not available':charging?'Charging':'Not charging']
  ];
  return `<div class="xt-landing"><div class="xt-left">
    <div class="xt-car-stage"><img src="${xpEsc(this.asset())}" alt="XPENG ${xpEsc(this.model())} in ${xpEsc(this.paint())}" loading="eager">
      ${charging===true?'<div class="xt-charge-tag">⚡ Charging</div>':''}
    </div>
    <div class="xt-shortcuts" aria-label="Vehicle quick functions">
      <button type="button" disabled aria-label="Lock or unlock unavailable without approved XPENG API" title="Remote locks unavailable">${xpIcon(locked?'lock':'unlock',23)}</button>
      <button type="button" data-view="controls" aria-label="Controls">${xpIcon('car',23)}</button>
      <button type="button" data-view="charging" aria-label="Charging">${xpIcon('bolt',23)}</button>
      <button type="button" data-view="climate" aria-label="Climate">${xpIcon('fan',23)}</button>
    </div>
    </div>
    <nav class="xt-navigation" aria-label="Vehicle menus">
      ${menu.map(([view,label,icon,subtitle])=>`<button type="button" class="xt-nav-row" data-view="${view}"><span class="xt-nav-icon">${icon}</span><span class="xt-nav-copy"><b>${label}</b><small>${xpEsc(subtitle)}</small></span>${xpIcon('arrow',17)}</button>`).join('')}
    </nav></div>`;
 }
 vehicleMenuPanel(){
  const view=this._view;
  const labels={controls:'Controls',vehicle:'Controls',tires:'Tire Pressure',charging:'Charging',climate:'Climate',comfort:'Comfort',interior:'Interior',location:'Location',info:'Vehicle Information'};
  const top=`<div class="xt-panel-head"><button type="button" data-back aria-label="Back to car">${xpIcon('back',23)}</button><h2>${xpEsc(labels[view]||'Vehicle')}</h2></div>`;
  let content='';
  if(view==='controls'||view==='vehicle'||view==='tires'){
   const tires=view==='tires';
   const prev=this._view;
   // Labels on top-down vehicle follow current page, with no simulated remote states.
   const body=this.topVisual();
   content=`<div class="xt-control-stage"><div class="xt-diagram">${body}</div>
     ${!tires?`<div class="xt-car-zones" aria-label="Remote control unavailable">
       <button disabled title="No authorized XPENG remote control">Frunk</button>
       <button disabled title="No authorized XPENG remote control">${xpIcon('lock',21)}</button>
       <button disabled title="No authorized XPENG remote control">Trunk</button>
     </div>`:''}
   </div>
   ${tires?`<div class="xt-values">${[['Front left','tire_fl'],['Front right','tire_fr'],['Rear left','tire_rl'],['Rear right','tire_rr']].map(([name,k])=>`<div><span>${name}</span><b>${xpEsc(this.value(k,'kPa'))}</b></div>`).join('')}</div>`:
    `<div class="xt-segmented"><button type="button" data-view="tires">${xpIcon('tire',18)} View tire pressure</button>
    <span>Locks: ${xpEsc(this.status('locked','Locked','Unlocked'))}</span></div>`}
   <div class="xt-control-bar">${[['Flash lights','sun'],['Horn','gauge'],['Remote start','power'],['Windows','car']].map(([label,icon])=>`<button type="button" disabled aria-label="${xpEsc(label)} unavailable">${xpIcon(icon,23)}<small>${label}</small></button>`).join('')}</div>`;
  }else if(view==='climate'||view==='comfort'||view==='interior'){
   const cab=XP_INTERIORS.find(x=>x.id===this.interior())?.label||'—';
   const modes=[
    ['steering wheel heat','Steering wheel heating'],['seat heat','Front seat heating'],
    ['seat cooling','Seat ventilation'],['seat massage','Seat massage']
   ];
   content=`<div class="xt-climate-area">
      <div class="xt-cabin-surface">${xpCabinSvg(this.interior())}</div>
      <div class="xt-cabin-overlay">
        <button disabled aria-label="Driver seat heater unavailable">${xpIcon('thermometer',21)}</button>
        <button disabled aria-label="Passenger seat heater unavailable">${xpIcon('thermometer',21)}</button>
        <button disabled aria-label="Steering wheel heater unavailable">${xpIcon('thermometer',21)}</button>
      </div>
    </div>
    <div class="xt-temp-panel">
       <div><small>Cabin</small><strong>${xpEsc(this.value('cabin','°C',1))}</strong></div>
       <div class="xt-climate-stepper"><button disabled aria-label="Lower target temperature">−</button><b>— °C</b><button disabled aria-label="Raise target temperature">+</button></div>
       <div><small>Climate status</small><strong>${xpEsc(this.status('climate','On','Off'))}</strong></div>
    </div>
    <div class="xt-seat-functions">
      ${modes.map(([key,label])=>`<div><span>${xpIcon('thermometer',20)} ${label}</span><button disabled title="No XPENG authorized cloud command">Unavailable</button></div>`).join('')}
    </div><div class="xt-inline-foot">Interior: ${xpEsc(cab)} · Change exterior and upholstery only in Home Assistant Edit card.</div>`;
  }else if(view==='charging'){
   const soc=xpPercent(this.val('soc'));
   content=`<div class="xt-charger-image"><img src="${xpEsc(this.asset())}" alt="XPENG ${xpEsc(this.model())} charging view"></div>
     <div class="xt-battery">
       <div><span>Battery state</span><strong>${soc===null?'—':xpNum(soc)+'%'}</strong></div>
       <div class="xt-track"><div style="width:${soc??0}%"></div></div>
       <span>Range ${xpEsc(this.value('range','km'))} · Power ${xpEsc(this.value('power','kW',1))}</span>
     </div>
     <div class="xt-charging-setting"><label>Charging limit <strong>${xpEsc(this.value('target','%'))}</strong></label><input type="range" min="0" max="100" value="${xpPercent(this.val('target'))??0}" disabled aria-label="Charging limit unavailable"/></div>
     <div class="xt-charging-setting"><label>Charging current <strong>${xpEsc(this.value('current','A',1))}</strong></label><div class="xt-stepper"><button disabled aria-label="Decrease charging current">−</button><span>${xpEsc(this.value('current','A',1))}</span><button disabled aria-label="Increase charging current">+</button></div></div>
     <button class="xt-port-button" disabled>Open charging port · Not connected</button>`;
  }else if(view==='location'){
   const loc=this.data('location')?.entity?.attributes||{};
   const gps=loc.latitude!=null&&loc.longitude!=null&&Number.isFinite(Number(loc.latitude))&&Number.isFinite(Number(loc.longitude));
   content=`<div class="xt-location-map">${xpIcon('pin',35)}<strong>${gps?'Location available':'Location unavailable'}</strong><small>Home Assistant coordinates only. No external map requests.</small></div>`;
  }else{
   content=`<div class="xt-values">${[['Model',this.model()],['Year',this.year()],['Edition',this.trim()],['Odometer',this.value('odometer','km')],['Powertrain',this.val('powertrain')||'—'],['Connection',xpConnText(this.val('connection'))]].map(([k,v])=>`<div><span>${xpEsc(k)}</span><b>${xpEsc(v)}</b></div>`).join('')}</div>`;
  }
  return top+`<section class="xt-panel" data-xpeng-menu-panel="${xpEsc(view)}">${content}</section>`;
 }
 cockpit(){
   const active=this._view!=='overview';
   return `<div class="xt-card">${!active?this.vehicleMenuHeader():''}
       ${active?this.vehicleMenuPanel():this.vehicleMenuLanding()}
       <div class="xt-footnote">XPENG Direct · ${xpEsc(xpConnText(this.val('connection')))} · Read only pending manufacturer-approved control API</div>
   </div>`;
 }

 render(){
   if(!this.shadowRoot)return;
   this.setAttribute('data-theme',this._config.theme==='light'?'light':'dark');
   this.toggleAttribute('data-expanded',this._expanded);
   this.toggleAttribute('data-cockpit',true);
   this.shadowRoot.innerHTML=`<style>${XP_CSS}</style><ha-card><div class="app">${this.cockpit()}</div></ha-card>`;
  }
}
class XpengVehicleCardEditor extends HTMLElement{
 constructor(){super();this.attachShadow({mode:'open'});this._cfg=xpNormalizeAppearance({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',theme:'dark'});
 this.shadowRoot.addEventListener('change',e=>{const input=e.target.closest('[data-key]');if(!input)return;const key=input.dataset.key;let cfg={...this._cfg,[key]:input.value};
 if(cfg.prefix&&!/^[a-z0-9_]+$/.test(cfg.prefix))return;
 if(key==='year'&&!xpAllowedModels(cfg.year).some(m=>m.id===cfg.model))cfg.model=xpAllowedModels(cfg.year)[0]?.id||'Other';
 if(key==='year'||key==='model'){cfg.trim=xpAllowedTrims(cfg.model,cfg.year)[0].id;cfg.color=xpAllowedPaints(cfg.model,cfg.year,cfg.trim)[0].id;cfg.interior='dark_gray';}
 if(key==='trim'&&!xpAllowedPaints(cfg.model,cfg.year,cfg.trim).some(p=>p.id===cfg.color))cfg.color=xpAllowedPaints(cfg.model,cfg.year,cfg.trim)[0].id;
   if(key==='trim'&&!xpAllowedInteriors(cfg.model,cfg.year,cfg.trim).some(x=>x.id===cfg.interior))cfg.interior='dark_gray';
 this._cfg=xpNormalizeAppearance(cfg);this.render();this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._cfg},bubbles:true,composed:true}));});
 }
 setConfig(cfg){this._cfg=xpNormalizeAppearance({...cfg});this.render();}set hass(_v){}
 render(){const v=xpNormalizeAppearance(this._cfg),selector=(key,values)=>`<label>${{year:'1. Model year',model:'2. Model',trim:'3. Variant / trim',color:'4. Exterior paint',interior:'5. Interior finish / upholstery',theme:'Theme'}[key]}<select data-key="${key}">${values.map(x=>`<option value="${xpEsc(x.id)}" ${v[key]===x.id?'selected':''}>${xpEsc(x.label)}</option>`).join('')}</select></label>`;
 this.shadowRoot.innerHTML=`<style>section{display:grid;gap:14px;padding:13px;font:inherit}label{display:grid;gap:5px;font-size:13px}input,select{border:1px solid #888;border-radius:7px;padding:10px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#111)}p{font-size:12px;line-height:1.5;opacity:.8}</style><section>
 <label>Entity prefix<input data-key="prefix" value="${xpEsc(v.prefix||'my_xpeng')}"></label>
 <label>Image assets path<input data-key="image_path" value="${xpEsc(v.image_path||'/hacsfiles/xpeng-vehicle-card/assets')}"></label>
 ${selector('year',XP_YEARS.map(y=>({id:y,label:y})))}
 ${selector('model',xpAllowedModels(v.year).map(m=>({id:m.id,label:m.name})))}
 ${selector('trim',xpAllowedTrims(v.model,v.year))}
 ${selector('color',xpAllowedPaints(v.model,v.year,v.trim))}
 ${selector('interior',xpAllowedInteriors(v.model,v.year,v.trim))}
 <label>Vehicle name (optional)<input data-key="name" value="${xpEsc(v.name||'')}"></label>
 ${selector('theme',[{id:'dark',label:'Dark'},{id:'light',label:'Light'}])}
 <p>Year selection filters models. Interior finish changes the visual material theme of the whole cabin, not the real car. Changing model refreshes available trims; changing trim refreshes available paint colors. Factory trim and color catalogs may differ between markets; other models use illustrative studio artwork until audited model-year renders are available.</p>
 </section>`;}
}
if(!customElements.get('xpeng-vehicle-card'))customElements.define('xpeng-vehicle-card',XpengVehicleCard);
if(!customElements.get('xpeng-vehicle-card-editor'))customElements.define('xpeng-vehicle-card-editor',XpengVehicleCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='xpeng-vehicle-card'))window.customCards.push({type:'xpeng-vehicle-card',name:'XPENG Vehicle Card',description:'XPENG vehicle dashboard with configurable model, paint and interior (read-only)'});
