/**
 * XPENG Vehicle Card v0.7.0-alpha.1 — XPENG vehicle monitoring dashboard (read-only).
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
:host{display:block;--xp-bg:#171819;--xp-text:#fafafa;--xp-soft:#8b8f93;--xp-line:#292b2d;--xp-panel:#202224;--xp-green:#39d78d;--xp-card:#1c1e20;color:var(--xp-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
:host([data-theme="light"]) .brand-mini{filter:invert(1)}:host([data-theme="light"]){--xp-bg:#f5f6f7;--xp-text:#1d2024;--xp-soft:#6f7981;--xp-line:#e0e3e6;--xp-panel:#e9edef;--xp-card:#fff;--xp-green:#168a57}
*{box-sizing:border-box}ha-card{display:block;background:var(--xp-bg)!important;color:var(--xp-text)!important;border:0!important;border-radius:17px!important;overflow:hidden;box-shadow:none!important}
.app{max-width:920px;min-height:700px;margin:auto;padding:21px 0 8px;direction:ltr}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:0 24px}
.vehicle-name{font-size:28px;line-height:1.12;font-weight:730;letter-spacing:-.6px;max-width:255px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vehicle-title-line{display:flex;align-items:center;gap:9px}.brand-mini{display:block;width:26px;height:26px;object-fit:contain}.trim-label{font-size:11px;letter-spacing:.13px;color:var(--xp-soft);margin-top:6px}.meta{display:flex;align-items:center;gap:9px;margin-top:6px;font-size:12px;color:var(--xp-text)}.battery-ico{display:inline-flex;align-items:center;width:24px;height:12px;padding:1.5px;border:1px solid var(--xp-text);border-radius:2px;position:relative}.battery-ico:after{content:"";position:absolute;width:2px;height:6px;background:var(--xp-text);right:-4px;border-radius:0 2px 2px 0}.battery-ico span{background:var(--xp-text);height:100%;display:block;border-radius:1px}
.meta .charging-text{color:var(--xp-green)}.sub-status{font-size:12px;color:var(--xp-soft);margin-top:5px;min-height:18px}.head-tools{display:flex;gap:14px;padding-top:4px}.head-tools button,.back{border:0;background:transparent;color:var(--xp-soft);cursor:pointer;padding:3px;line-height:0}.head-tools button:hover,.back:hover{color:var(--xp-text)}
.hero{height:276px;display:flex;justify-content:center;align-items:center;position:relative;overflow:hidden;margin:0 auto 0}.hero img{width:100%;height:100%;object-fit:contain;object-position:center;filter:drop-shadow(0 10px 11px #0006);position:relative;z-index:1}.hero:before{content:"";position:absolute;left:16%;right:16%;bottom:13px;height:33px;border-radius:50%;background:#0006;filter:blur(24px)}.hero.g6 img{transform:scale(.96)}
.hero.is-charging:after{content:"";position:absolute;width:34%;height:12%;left:48%;bottom:15px;background:radial-gradient(ellipse,rgba(36,219,125,.34),transparent 72%);filter:blur(10px);animation:xpPulse 2s ease-in-out infinite alternate;z-index:0}@keyframes xpPulse{to{opacity:.25}}
.hero-badge{position:absolute;bottom:8px;right:20px;background:rgba(29,37,32,.95);color:var(--xp-green);font-size:12px;padding:6px 10px;border-radius:24px;z-index:2;display:flex;align-items:center;gap:6px}
.navicons{display:grid;grid-template-columns:repeat(4,1fr);padding:8px 16px 13px;gap:7px;align-items:center;border-bottom:1px solid var(--xp-line)}button.quick{appearance:none;border:0;background:transparent;color:#818588;display:grid;place-items:center;min-height:47px;cursor:pointer;position:relative}button.quick:hover,button.quick.selected{color:var(--xp-text)}button.quick.selected:after{content:"";background:var(--xp-green);position:absolute;bottom:0;width:25px;height:2px;border-radius:4px}button.quick.positive{color:var(--xp-green)}
.rows{padding:0 19px}.listrow{width:100%;display:flex;align-items:center;text-align:left;gap:15px;border:0;border-bottom:1px solid var(--xp-line);color:var(--xp-text);background:transparent;padding:17px 4px 17px 1px;min-height:70px;cursor:pointer;font:inherit}.listrow:hover{background:rgba(127,127,127,.045)}.listrow:last-child{border-bottom:0}.rowicon{display:flex;align-items:center;justify-content:center;color:var(--xp-soft);width:25px;flex:0 0 25px}.rowtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}.rowtitle{font-size:14px;font-weight:680}.rowsub{font-size:11px;color:var(--xp-soft);text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.rowarrow{color:#707477;flex:0 0 auto}
.detail-head{display:flex;align-items:center;gap:8px;margin:5px 20px 6px}.detail-head button{color:var(--xp-text);display:grid;place-items:center}.detail-head h2{font-weight:680;font-size:20px;margin:0 0 0 3px}.content{border-top:1px solid var(--xp-line);margin:0 19px;padding:16px 3px 25px}.section-caption{font-size:12px;color:var(--xp-soft);line-height:1.55}.metric-hero{display:flex;align-items:baseline;justify-content:space-between;margin:4px 0 15px}.metric-hero strong{font-size:36px;line-height:1.25;letter-spacing:-1.1px}.metric-hero span{color:var(--xp-soft);font-size:13px}.track{width:100%;height:10px;border-radius:7px;overflow:hidden;background:#454a4c;position:relative}.track>.fill{height:100%;background:var(--xp-green);transition:width 350ms}.track>.target{position:absolute;left:var(--target);top:0;width:3px;background:white;height:100%;opacity:.8}.progressfoot{display:flex;justify-content:space-between;margin:9px 0 22px;color:var(--xp-soft);font-size:12px}
.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--xp-line);border-radius:10px;overflow:hidden;margin-bottom:13px}.metric{padding:16px 13px;background:var(--xp-card);min-height:79px}.metric b{display:block;font-size:22px;font-weight:660;margin:4px 0}.metric small{color:var(--xp-soft);font-size:11px}.detailrow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid var(--xp-line);font-size:13px}.detailrow span:first-child{color:var(--xp-soft)}.detailrow strong{text-align:right;font-weight:620;direction:ltr}.notice{color:var(--xp-soft);font-size:12px;line-height:1.65;margin:15px 0 0}.hint{padding:9px 12px;background:rgba(48,191,123,.1);border-radius:8px;color:var(--xp-green);font-size:12px;margin-bottom:13px}
.door-grid{display:grid;grid-template-columns:1fr 100px 1fr;align-items:stretch;gap:5px;margin:8px 0 14px}.door-mid{border-radius:49px;background:linear-gradient(0deg,#40464c,#1e2227,#40464c);min-height:230px;position:relative;border:5px solid #525b64;box-shadow:0 4px 15px #0008;overflow:hidden}.door-mid:before{content:"";position:absolute;inset:16% 12% 29%;border-radius:35px;background:linear-gradient(90deg,#111923,#3c4752,#10151c)}.door-mid:after{content:"";position:absolute;inset:71% 12% 11%;border-radius:20px;background:linear-gradient(90deg,#10151c,#333f49,#10151c)}.door-col{display:flex;flex-direction:column;justify-content:space-around;gap:10px}.door-pill{font-size:11px;line-height:1.35;color:var(--xp-soft);text-align:center}.door-pill b{display:block;color:var(--xp-text);font-size:13px;margin-top:5px}.door-pill.open b{color:#ff9869}
.vehicle-list{margin-top:2px}.footer-brand{font-size:10px;letter-spacing:2px;color:#75787a;text-align:center;padding:15px 0 7px}.disconnected-note{text-align:center;background:rgba(222,154,69,.10);color:#d4ae75;border-radius:8px;margin:2px 21px 12px;font-size:11px;padding:9px;line-height:1.4}
@media(max-width:470px){.app{min-height:665px}.hero{height:254px}.head{padding:0 20px}.hero.g6 img{transform:scale(.96)}.vehicle-name{font-size:27px}.listrow{min-height:68px;padding:15px 4px}.navicons{padding-top:4px;padding-bottom:9px}}
.xp-appearance-select{display:block;width:100%;border-radius:9px;border:1px solid var(--xp-line);background:var(--xp-card);padding:12px;color:var(--xp-text);margin:8px 0 18px;font:inherit;font-size:13px;min-height:43px;}
.paint-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:14px 0 18px}.paint-option{border:1px solid var(--xp-line);border-radius:10px;min-height:76px;padding:8px 3px;color:var(--xp-text);background:var(--xp-card);cursor:pointer;font-size:10px;display:grid;justify-items:center;align-items:center;gap:4px;text-align:center}.paint-option[aria-pressed="true"]{border-color:var(--xp-green);outline:1px solid var(--xp-green)}.paint-dot{width:27px;height:27px;border-radius:50%;border:1px solid #7e8287;box-shadow:0 1px 8px #0005}.trim-option{display:block;width:100%;background:transparent;color:var(--xp-text);border:1px solid var(--xp-line);border-radius:9px;padding:12px;margin:8px 0;text-align:left;font-size:13px;cursor:pointer}.trim-option[aria-pressed="true"]{border-color:var(--xp-green);color:var(--xp-green)}.settings-label{font-size:13px;color:var(--xp-soft);margin:15px 0 3px}
@media(min-width:800px){.app{max-width:810px}.hero{height:330px}.hero img{max-width:720px}.rows{max-width:720px;margin:auto}.navicons{max-width:700px;margin:auto}.head{padding:0 42px}.content{max-width:700px;margin:auto}.detail-head{max-width:700px;margin:8px auto}}

/* Interior-wide, linked material palette. All upholstering is a single selection. */
.xp-cabin-wrap{max-width:460px;margin:6px auto 16px;position:relative;padding:10px;border:1px solid var(--xp-line);border-radius:19px;background:radial-gradient(ellipse at 50% 30%,#303943 0%,#15191e 66%,#101316 100%)}
.xp-cabin-svg{display:block;width:100%;max-height:525px;object-fit:contain;filter:drop-shadow(0 9px 14px #0009)}
.xp-cabin-note{font-size:11px;color:var(--xp-soft);text-align:center;max-width:420px;margin:0 auto 18px;line-height:1.5}
.xp-interior-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0 16px}
.xp-interior-choice{min-height:81px;background:var(--xp-card);color:var(--xp-text);border:1px solid var(--xp-line);border-radius:12px;font:inherit;font-size:12px;display:flex;align-items:center;flex-direction:column;justify-content:center;gap:7px;cursor:pointer}
.xp-interior-choice[aria-pressed="true"]{border-color:var(--xp-green);outline:1px solid var(--xp-green)}
.xp-interior-chip{width:54px;height:28px;border-radius:7px;border:1px solid #a2a5a977;box-shadow:inset 0 0 0 4px #1115}
.xp-interior-choice:focus-visible{outline:3px solid var(--xp-green)}
.xp-interior-list{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;margin:15px 0}
.xp-interior-list>div{font-size:12px;padding:8px 0;color:var(--xp-soft);border-bottom:1px solid var(--xp-line)}


/* Category-aware vehicle visualisation, fullscreen layout. */
:host([data-expanded]),:host(:fullscreen){position:fixed!important;inset:0!important;z-index:2147483000!important;display:block!important;width:100vw!important;max-width:none!important;height:100vh!important;height:100dvh!important;background:var(--xp-bg)!important;overflow:auto!important;margin:0!important}
:host([data-expanded]) ha-card,:host(:fullscreen) ha-card{border-radius:0!important;min-height:100%!important;overflow:auto!important}
:host([data-expanded]) .app,:host(:fullscreen) .app{max-width:1500px!important;width:100%!important;min-height:100%!important;margin:0 auto!important;padding:clamp(18px,3vh,40px) 2vw!important}
:host([data-expanded]) .hero,:host(:fullscreen) .hero{height:clamp(360px,48vh,700px)!important}
:host([data-expanded]) .hero img,:host(:fullscreen) .hero img{max-width:1150px!important}
:host([data-expanded]) .content,:host(:fullscreen) .content{max-width:1080px!important}
:host([data-expanded]) .rows,:host(:fullscreen) .rows{max-width:1000px!important}
:host([data-expanded]) .navicons,:host(:fullscreen) .navicons{max-width:950px!important}
.hero[data-hero-view]{isolation:isolate}
.xp-view-caption{position:absolute;z-index:3;top:15px;left:24px;color:var(--xp-soft);font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.xp-page-visual{position:absolute;z-index:2;pointer-events:none}
.xp-charge-visual{right:8%;top:20%;display:grid;justify-items:center;gap:6px;padding:17px;background:#11251fea;border:1px solid #39d78d6c;border-radius:20px;color:#a1f9d0;box-shadow:0 16px 30px #0006}
.xp-charge-visual strong{font-size:30px;color:white}.xp-charge-visual small{font-size:10px;letter-spacing:.7px}
.xp-pin-visual{right:10%;top:20%;display:grid;place-items:center;gap:7px;width:98px;height:98px;border:1px solid #47779077;border-radius:50%;color:#8cd8ff;background:#092538cc}
.xp-hero-cabin{height:344px!important;background:radial-gradient(ellipse at center,#333e46,transparent 75%)}
.xp-hero-cabin .xp-cabin-svg{height:100%!important;width:auto!important;max-width:100%;max-height:100%;margin:auto;filter:drop-shadow(0 9px 19px #000b)}
.xp-hero-plan{height:325px!important;background:radial-gradient(ellipse at center,#293740,transparent 72%)}
.xp-top-car{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 10px 18px #000a)}
.xp-pin-label{position:absolute;z-index:3;min-width:113px;padding:8px 10px;border-radius:11px;background:#101923ef;border:1px solid #62708070;color:#dbe4ec;font-size:11px;line-height:1.35}
.xp-pin-label b{display:block;font-weight:700;color:white;margin-top:2px}.xp-pin-label.is-open{border-color:#ff987b}.xp-pin-label.is-open b{color:#ff987b}
.xp-pin-fl{top:20%;left:4%}.xp-pin-fr{top:20%;right:4%}.xp-pin-rl{bottom:20%;left:4%}.xp-pin-rr{bottom:20%;right:4%}
@media(max-width:470px){.xp-hero-plan,.xp-hero-cabin{height:290px!important}.xp-pin-label{min-width:88px;padding:5px 7px;font-size:10px}.xp-pin-fl,.xp-pin-rl{left:1%}.xp-pin-fr,.xp-pin-rr{right:1%}.xp-view-caption{top:9px;left:14px}.xp-charge-visual{right:2%;top:24%;padding:9px}.xp-charge-visual strong{font-size:23px}}
@media(prefers-reduced-motion:reduce){.hero.is-charging:after{animation:none}}


/* Optional vehicle-centered XPENG cockpit; classic remains unchanged. */
:host([data-cockpit]){--xp-bg:#0b111c;--xp-text:#eaf4ff;--xp-soft:#9aafc7;--xp-line:#293b52;--xp-panel:#142136;--xp-card:#142238;--xp-green:#54d5a6}
:host([data-cockpit]) .app{max-width:none!important;width:100%;min-height:760px!important;margin:0;padding:0!important}
:host([data-cockpit]) ha-card{background:#0a111d!important;border:1px solid #2a3950!important;border-radius:18px!important}
.xp-cockpit{display:grid;grid-template-columns:178px minmax(0,1fr);min-height:760px;background:linear-gradient(135deg,#08101b 10%,#0d1724 70%);overflow:hidden}
.xp-side{padding:21px 9px;display:flex;flex-direction:column;gap:26px;background:#090f19;border-right:1px solid #26354b}
.xp-side-brand{display:flex;align-items:center;gap:9px;letter-spacing:2.5px;color:#f2f8ff;font-size:14px;padding-left:12px}
.xp-side-brand img{width:29px;height:29px;object-fit:contain}
.xp-side-menu{display:grid;gap:5px}
.xp-side-menu button{display:flex;align-items:center;gap:11px;min-height:43px;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:#9bb1c8;text-align:left;font:inherit;font-size:12px;cursor:pointer}
.xp-side-menu button:hover,.xp-side-menu button.active{background:#173761;color:#e1f1ff}
.xp-side-menu button.active{box-shadow:inset 3px 0 #52a5ff}
.xp-side-foot{margin-top:auto;color:#8293a7;font-size:10px;padding:15px 8px 0;border-top:1px solid #26354b}
.xp-main{min-width:0;min-height:740px;padding:22px clamp(14px,2.3vw,36px) 12px}
:host([data-cockpit]) .head{padding:0 5px 15px}
:host([data-cockpit]) .vehicle-name{font-size:29px;max-width:none}
:host([data-cockpit]) .brand-mini{height:28px;width:28px}
:host([data-cockpit]) .disconnected-note{margin:0 2px 12px;text-align:left;border:1px solid #92754740}
.xp-workspace{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(220px,.81fr);gap:13px;align-items:start}
.xp-primary{min-width:0;border:1px solid #314258;background:radial-gradient(ellipse at center,#1a2c40aa,#111c2b 82%);border-radius:17px;overflow:hidden;padding:8px 12px 14px}
:host([data-cockpit]) .xp-primary .hero{height:339px!important;max-width:100%;margin:0 auto}
:host([data-cockpit]) .xp-primary .hero img{max-width:700px;object-fit:contain}
:host([data-cockpit]) .xp-primary .xp-hero-plan{height:325px!important}
:host([data-cockpit]) .xp-primary .xp-hero-cabin{height:360px!important}
.xp-actions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:0 3px 14px}
.xp-action{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:85px;padding:9px 3px;background:#21344a;border:1px solid #334961;border-radius:11px;color:#f0f6ff;font:inherit;cursor:pointer}
.xp-action:hover{background:#2c4664}.xp-action strong{font-size:11px;font-weight:650;text-align:center}.xp-action small{font-size:10px;color:#9fb1c2}
.xp-rail{display:grid;gap:12px}.xp-rail-box{min-width:0;padding:16px;background:#172437d9;border:1px solid #283b52;border-radius:14px}
.xp-rail-box h3{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin:0 0 13px;color:#f0f5fc}
.xp-map-stub{min-height:115px;border:1px solid #29465f;background:radial-gradient(ellipse at center,#294965,#101f31);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#a2c5df;font-size:12px;text-align:center}
.xp-rail-link{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;background:none;color:#bad6f5;padding:13px 4px 0;font:inherit;font-size:12px;cursor:pointer}
.xp-rail-box .detailrow{padding:11px 0;font-size:12px}.xp-rail-box .detailrow strong{color:#e7f1fa}
.xp-rail-box p{font-size:13px;color:#bbccde}.xp-rail-box small{color:#8da4bb;font-size:11px;line-height:1.5}
.xp-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0 6px}
.xp-tile{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:12px;min-height:134px;padding:16px;text-align:left;border:1px solid #293d56;border-radius:15px;background:#17253a;color:#edf5ff;font:inherit;cursor:pointer}
.xp-tile:hover{background:#203550}.xp-tile span{display:flex;align-items:center;gap:7px;font-size:13px}.xp-tile strong{font-size:20px}.xp-tile small{font-size:11px;color:#91aac5}
:host([data-cockpit]) .rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:0 3px}
:host([data-cockpit]) .listrow{background:#172537;border:1px solid #2e4058;border-radius:10px;min-height:58px;padding:10px;gap:8px}
:host([data-cockpit]) .listrow:last-child{border:1px solid #2e4058}
:host([data-cockpit]) .content{max-width:100%;margin:0;padding:12px 8px 24px;border-top:1px solid #2f4360}
:host([data-cockpit]) .detail-head{margin:8px 5px 12px}
.xp-comfort-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}
.xp-comfort-item{display:grid;gap:9px;border:1px solid #31465e;background:#1a2a40;border-radius:12px;padding:13px}
.xp-comfort-item span{display:flex;align-items:center;gap:8px}.xp-comfort-item strong{font-size:12px}
.xp-comfort-item button[disabled]{min-height:34px;background:#26364a;border:1px solid #4a5c71;border-radius:10px;color:#a2b4c6;cursor:not-allowed}
:host([data-cockpit]) .footer-brand{padding-top:18px}
:host([data-cockpit]) button:focus-visible{outline:2px solid #65aaff;outline-offset:2px}
:host([data-cockpit][data-expanded]) .xp-cockpit{min-height:100%}
@media(max-width:1020px){.xp-workspace{grid-template-columns:minmax(0,1fr)}.xp-rail{grid-template-columns:repeat(3,minmax(0,1fr))}.xp-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){.xp-cockpit{grid-template-columns:minmax(0,1fr)}.xp-side{padding:11px;gap:8px;border-right:0;border-bottom:1px solid #273a52}.xp-side-brand{padding:0 4px}.xp-side-menu{display:flex;gap:5px;overflow-x:auto;padding-bottom:5px}.xp-side-menu button{flex:0 0 auto;padding:8px 10px;min-height:37px;font-size:11px;gap:5px}.xp-side-foot{display:none}.xp-main{min-height:650px;padding:10px}:host([data-cockpit]) .head{padding:0 5px 11px}:host([data-cockpit]) .vehicle-name{font-size:23px}.xp-rail{grid-template-columns:1fr}.xp-actions{grid-template-columns:repeat(3,minmax(0,1fr))}.xp-action{min-height:75px}.xp-tiles{gap:8px}.xp-tile{min-height:105px;padding:12px}.xp-comfort-grid{grid-template-columns:1fr}:host([data-cockpit]) .rows{grid-template-columns:1fr}}
@media(max-width:440px){:host([data-cockpit]) .xp-primary .hero{height:255px!important}:host([data-cockpit]) .xp-primary .xp-hero-cabin{height:300px!important}.xp-main{padding:8px}.xp-primary{padding:5px}.xp-tile strong{font-size:16px}}

/* v0.7 redesign: real car art, editorial dashboard, per-view panels (no fake commands). */
:host([data-cockpit]){--xp-bg:#08101a;--xp-text:#eef6ff;--xp-soft:#9baec6}
:host([data-cockpit]) ha-card{background:#080f19!important;border:1px solid #26364a!important;border-radius:20px!important;overflow:hidden}
:host([data-cockpit]) .app{max-width:none!important;width:100%!important;padding:0!important;background:transparent!important}
.xp-studio{display:grid!important;grid-template-columns:178px minmax(0,1fr)!important;min-height:830px!important;background:linear-gradient(125deg,#080e17,#0a1422 66%)!important;color:#eaf2fe;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.xs-sidebar{background:#080d16;border-right:1px solid #253447;padding:27px 11px 17px;min-width:0;display:flex;flex-direction:column;gap:34px}
.xs-brand{display:flex;align-items:center;gap:9px;padding:0 12px;font-size:19px;letter-spacing:3px;font-weight:650;color:#f1f5fa;white-space:nowrap}
.xs-brand-mark{display:grid;place-items:center;width:31px;height:30px;color:#e9f4ff;font-size:25px;font-weight:700;transform:scaleX(1.25)}
.xs-nav{display:grid;gap:5px}
.xs-nav button{display:flex;align-items:center;gap:13px;width:100%;min-height:44px;padding:10px 14px;background:transparent;color:#a9bbd0;border:0;border-radius:9px;text-align:left;font:inherit;font-size:13px;cursor:pointer}
.xs-nav button.selected{background:linear-gradient(90deg,#0d386b,#12253f);box-shadow:inset 3px 0 #49aaff;color:#effaff}
.xs-nav button:hover:not(.selected){background:#18283b;color:white}
.xs-nav-footer{margin-top:auto;padding:14px 6px 0;border-top:1px solid #263449;color:#7890ac;font-size:10px;display:flex;align-items:center;gap:6px}
.xs-state-dot,.xs-connection span{width:8px;height:8px;display:inline-block;flex:none;border-radius:50%;background:#9eabc0}
.xs-main{min-width:0;padding:23px clamp(16px,2.5vw,34px) 18px}
.xs-head{display:flex;justify-content:space-between;gap:18px;align-items:center;margin:0 0 15px}
.xs-eyebrow{font-size:10px;letter-spacing:2.3px;color:#688fbb;font-weight:750;margin-bottom:8px}
.xs-heading{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.xs-heading h2{font-size:25px;line-height:1.2;font-weight:650;letter-spacing:.15px;margin:0;color:#f7fbff}
.xs-edition{font-size:11px;color:#8fa2bb}
.xs-head-reading{display:flex;gap:8px;align-items:center;color:#bccde0;font-size:13px;margin-top:9px}
.xs-head-reading span{color:#536781}
.xs-head-tools{display:flex;gap:13px;align-items:center}
.xs-private-status{font-size:11px;color:#97aabd;max-width:180px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
.xs-head-tools button{border:1px solid #2c435c;background:#142438;color:white;border-radius:10px;min-width:41px;min-height:39px;cursor:pointer;font-size:25px}
.xs-not-connected{border:1px solid #63584266;background:#30271950;color:#e6cda4;border-radius:9px;font-size:11px;padding:9px 12px;margin-bottom:13px}
.xs-workspace{display:grid;grid-template-columns:minmax(0,2.65fr) minmax(230px,1fr);gap:15px;align-items:start}
.xs-left{min-width:0}
.xs-hero{position:relative;min-height:440px;overflow:hidden;background:radial-gradient(ellipse at 65% 60%,#233044,#101826);border:1px solid #33445c;border-radius:20px;isolation:isolate}
.xs-car-photo{display:block!important;position:absolute;inset:0;width:100%!important;height:100%!important;max-width:none!important;object-fit:cover;object-position:center 48%;filter:saturate(.98)}
.xs-hero-shade{position:absolute;inset:0;background:linear-gradient(90deg,#09111df2 0%,#0c1929db 22%,#11203735 57%,#09142311 100%),linear-gradient(0deg,#09111be5,transparent 36%);pointer-events:none}
.xs-hero-copy{position:absolute;z-index:4;top:30px;left:26px;width:clamp(150px,32%,250px);text-shadow:0 2px 12px #06101dee}
.xs-hero-kicker{display:block;color:#c7d8eb;font-size:10px;letter-spacing:2.2px;font-weight:700;margin-bottom:8px}
.xs-hero-copy h3{font-size:clamp(23px,2.8vw,37px);line-height:1.13;font-weight:650;letter-spacing:-.5px;color:white;margin:0 0 18px;max-width:215px}
.xs-connection{font-size:11px;color:#c2d2e6;display:flex;align-items:center;gap:8px;margin-bottom:25px}
.xs-connection.xs-online span{background:#36d68e;box-shadow:0 0 0 4px #35bd871c}
.xs-charge-figure{display:flex;align-items:center;gap:12px}
.xs-charge-figure span{color:#60d8aa}
.xs-charge-figure strong{font-size:38px;color:#f9fcff;font-weight:690}
.xs-hero-copy p{font-size:11px;margin:6px 0 12px;color:#adbed0}
.xs-hero-copy p strong{display:block;font-size:19px;color:#fff;margin-top:3px}
.xs-progress{width:180px;max-width:92%;height:8px;background:#53677e88;border-radius:100px;overflow:hidden}
.xs-progress div,.xs-charge-track div{height:100%;background:linear-gradient(90deg,#35d79a,#63dda7);border-radius:100px}
.xs-hero-photo-note{position:absolute;bottom:12px;right:14px;font-size:9px;letter-spacing:.05px;color:#bfd0e7bb;z-index:4;text-shadow:0 1px 9px #000}
.xs-hero-detail{position:absolute;right:20px;top:30px;z-index:3;border:1px solid #68819d55;border-radius:17px;background:#101b2abf;backdrop-filter:blur(6px);box-shadow:0 14px 30px #0006}
.xs-hero-map{width:min(43%,285px);height:315px;overflow:hidden}
.xs-hero-map .xp-top-car{width:100%;height:100%;position:absolute;inset:0}
.xs-hero-map .xp-pin-label{min-width:0;max-width:100px;padding:6px;font-size:9px;background:#0c1829ef}
.xs-hero-map .xp-pin-fl,.xs-hero-map .xp-pin-rl{left:0}
.xs-hero-map .xp-pin-fr,.xs-hero-map .xp-pin-rr{right:0}
.xs-hero-cabin{width:min(35%,205px);height:315px;display:flex;align-items:center;justify-content:center}
.xs-hero-cabin .xp-cabin-svg{width:100%;height:100%;max-height:300px;max-width:100%;filter:drop-shadow(0 7px 14px #0009)}
.xs-battery-symbol{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;right:24px;color:#d1edfc;font-size:12px}
.xs-battery-symbol b{font-size:14px;color:#fff}
.xs-actions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:12px}
.xs-action{min-height:94px;display:flex;align-items:center;justify-content:center;gap:6px;flex-direction:column;background:linear-gradient(150deg,#1b2b42,#111d2d);border:1px solid #3a4b61;border-radius:15px;color:#eff7ff;cursor:pointer;font:inherit;padding:12px 4px;text-align:center}
.xs-action:hover,.xs-module:hover{background:#1a3350}
.xs-action strong{font-size:11px;font-weight:580}
.xs-action small{font-size:10px;color:#8ca1b6}
.xs-rail{display:grid;gap:13px}
.xs-rail-box,.xs-module,.xs-detail{border:1px solid #2b3a50;border-radius:17px;background:linear-gradient(145deg,#131f30,#0e1929);color:#eef4ff}
.xs-rail-box{padding:16px}
.xs-rail-title{display:flex;align-items:center;gap:9px}
.xs-rail-title h3{margin:0;font-size:14px;font-weight:610}
.xs-location{margin-top:12px;text-align:center;border:1px solid #2d4663;background:#101f31;border-radius:11px;overflow:hidden}
.xs-location-grid{display:grid;place-items:center;min-height:111px;background-image:linear-gradient(43deg,transparent 49%,#3b5b7444 50%,transparent 51%),linear-gradient(130deg,transparent 49%,#39567355 50%,transparent 51%),linear-gradient(#30486124 1px,transparent 1px),linear-gradient(90deg,#30486124 1px,transparent 1px);background-size:100% 100%,100% 100%,27px 27px,27px 27px;background-color:#152438}
.xs-location-marker{display:grid;place-items:center;width:43px;height:43px;background:#123b70;border:1px solid #5ba3ff;color:#a2d8ff;border-radius:50%}
.xs-location p{margin:8px 0 0;color:#bbccdf;font-size:11px}
.xs-location small{display:block;margin:0 0 10px;font-size:9px;color:#8697a8}
.xs-link{display:flex;justify-content:space-between;align-items:center;width:100%;border:0;background:transparent;color:#a6caff;font:inherit;font-size:11px;margin-top:9px;cursor:pointer}
.xs-rail-box .detailrow{border-bottom:1px solid #27364a;padding:11px 0!important;font-size:11px;gap:12px}
.xs-rail-box .detailrow:last-child{border-bottom:0}
.xs-rail-box .detailrow strong{font-size:11px;color:#dbeaf7;max-width:60%;text-align:right}
.xs-alert p{font-size:13px;margin:14px 0 8px;color:#c2d3e8;overflow-wrap:anywhere}
.xs-alert small{font-size:11px;line-height:1.5;color:#95a7b9}
.xs-module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:15px}
.xs-module{position:relative;display:flex;align-items:flex-start;text-align:left;flex-direction:column;gap:10px;min-height:190px;padding:17px 17px 30px;cursor:pointer;font:inherit}
.xs-module-title{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:650;color:#d9e8f7}
.xs-module>strong{font-size:24px;line-height:1.15;color:white}
.xs-module>span:not(.xs-module-title):not(.xs-module-arrow){font-size:11px;color:#ced8e6}
.xs-module small{font-size:10px;line-height:1.4;color:#889fb6}
.xs-module-arrow{position:absolute;right:11px;bottom:10px;color:#7fa8d2}
.xs-detail{padding:21px;margin-top:15px}
.xs-detail-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 18px}
.xs-detail-heading h3{font-size:18px;margin:0;color:white}
.xs-detail-heading button,.xs-panel-link{display:flex;align-items:center;gap:7px;background:#192d44;border:1px solid #3a5878;border-radius:9px;color:#c7deff;padding:10px 13px;font:inherit;font-size:11px;cursor:pointer}
.xs-data-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.xs-data-chip,.xs-comfort-item{border:1px solid #30435a;border-radius:12px;background:#101f30;padding:14px;min-width:0}
.xs-data-chip span{display:block;font-size:11px;color:#8ea5ba;margin-bottom:10px}
.xs-data-chip strong{font-size:14px;color:#e8f2ff;overflow-wrap:anywhere}
.xs-comfort-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.xs-comfort-item{display:flex;align-items:center;justify-content:space-between;gap:10px}
.xs-comfort-item span{display:flex;align-items:center;gap:7px;font-size:12px}
.xs-comfort-item button[disabled]{border:1px solid #37506b;border-radius:9px;padding:7px;background:#24344a;color:#a7b7c8;cursor:not-allowed;font-size:10px}
.xs-control-notice{margin-top:17px;background:#132134;border:1px solid #2c3c50;border-radius:10px;color:#a3b5c9;padding:13px;font-size:11px;line-height:1.5}
.xs-climate-control{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px}
.xs-climate-control span{font-size:11px;color:#9eb3ca}
.xs-climate-control strong{display:block;font-size:36px;margin:3px 0;color:white}
.xs-climate-status{padding:9px 14px;background:#1b2d45;border:1px solid #3a526d;border-radius:12px}
.xs-panel-link{margin-top:15px}
.xs-charge-meter{display:grid;grid-template-columns:1fr auto;align-items:center;margin-bottom:20px;gap:8px}
.xs-charge-meter>span{font-size:12px;color:#b5c6d6}
.xs-charge-meter b{font-size:27px}
.xs-charge-track{grid-column:span 2;background:#465871;border-radius:30px;height:9px;overflow:hidden}
.xs-bottom-note{font-size:10px;color:#6f829c;letter-spacing:.1px;margin:15px 0 0;text-align:right}
:host([data-cockpit][data-expanded]) .xp-studio{min-height:100vh!important}
:host([data-cockpit][data-expanded]) .xs-hero{min-height:clamp(460px,50vh,770px)}
.xp-studio button:focus-visible{outline:2px solid #53a6ff!important;outline-offset:2px}
@media(max-width:1140px){.xs-workspace{grid-template-columns:minmax(0,1fr)}.xs-rail{grid-template-columns:repeat(3,minmax(0,1fr))}.xs-rail-box{padding:12px}.xs-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.xp-studio{grid-template-columns:minmax(0,1fr)!important}.xs-sidebar{gap:9px;padding:9px 10px;border-right:0;border-bottom:1px solid #2d3a51}.xs-brand{font-size:14px;padding:0 5px}.xs-nav{display:flex;overflow-x:auto;gap:5px;scrollbar-width:thin}.xs-nav button{flex:0 0 auto;min-height:37px;padding:8px 11px;gap:7px;font-size:11px}.xs-nav-footer{display:none}.xs-main{padding:12px}.xs-hero{min-height:360px}.xs-rail{grid-template-columns:1fr}.xs-module-grid{gap:8px}.xs-actions{gap:5px}.xs-action{min-height:75px;padding:8px 2px}.xs-action strong{font-size:10px}.xs-action small{font-size:9px}.xs-head{gap:8px}.xs-heading h2{font-size:20px}.xs-private-status{display:none}.xs-data-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:470px){.xs-hero{min-height:320px}.xs-car-photo{object-position:60% center}.xs-hero-shade{background:linear-gradient(90deg,#0a111df5 0%,#0a1222bc 44%,transparent 86%),linear-gradient(0deg,#09111b,transparent 36%)}.xs-hero-copy{top:15px;left:14px;width:150px}.xs-hero-copy h3{font-size:22px}.xs-connection{margin-bottom:15px}.xs-charge-figure strong{font-size:29px}.xs-hero-detail{right:5px;top:65px}.xs-hero-cabin{height:200px;width:100px}.xs-hero-map{height:230px;width:145px}.xs-hero-map .xp-pin-label{font-size:7px;max-width:70px}.xs-actions{grid-template-columns:repeat(5,minmax(0,1fr))}.xs-action strong{font-size:9px}.xs-action svg{height:20px;width:20px}.xs-module{min-height:155px;padding:13px}.xs-module>strong{font-size:18px}.xs-comfort-grid{grid-template-columns:1fr}.xs-data-grid{grid-template-columns:1fr}.xs-bottom-note{margin-bottom:92px}.xs-hero-photo-note{font-size:8px;right:6px}}

.xs-control-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}
.xs-control-buttons button[disabled]{display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid #324861;border-radius:10px;background:#202e40;color:#8c9fb3;padding:11px 5px;font-size:12px;cursor:not-allowed;opacity:.76}
@media(max-width:760px){
 .xs-nav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;overflow:visible!important}
 .xs-nav button{width:100%!important;min-width:0!important;min-height:54px!important;display:flex!important;flex-direction:column;justify-content:center;gap:3px!important;padding:6px 1px!important;font-size:9px!important;text-align:center!important}
 .xs-nav button span{font-size:9.5px;white-space:nowrap}
 .xs-nav button svg{width:17px;height:17px}
}
@media(max-width:470px){
 .xs-hero{min-height:355px!important}
 .xs-car-photo{object-fit:contain!important;object-position:center center!important;transform:translateY(42px)}
 .xs-hero-copy h3{font-size:21px!important;max-width:150px!important;margin-bottom:9px!important}
 .xs-hero-copy{top:14px!important}
 .xs-connection{margin-bottom:10px!important;font-size:10px!important}
 .xs-charge-figure strong{font-size:26px!important}
 .xs-charge-figure svg{height:20px;width:20px}
 .xs-hero-copy p{margin:4px 0 6px!important;font-size:10px}
 .xs-hero-copy p strong{font-size:15px!important}
 .xs-progress{height:5px!important;max-width:132px!important}
 .xs-control-buttons{grid-template-columns:1fr}
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
 getCardSize(){return this._view==='overview'?8:7;}
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
 stateText(){if(this.charging())return `Charging${this.val('power')!==null?' · '+this.n('power',1)+' kW':''}`;if(this.plugged())return 'Plugged in';const conn=this.val('connection');if(conn==='not_configured'||conn===null)return 'Waiting for XPENG API';if(conn==='stale_vehicle_data')return 'Vehicle data stale';if(conn==='connection_error')return 'Connection error';return this.bool('locked')===true?'Parked · Locked':this.bool('locked')===false?'Parked · Unlocked':'Parked · Status unavailable';}
 asset(){const base=(this._config.image_path||'/hacsfiles/xpeng-vehicle-card/assets').replace(/\/$/,'');const img=this.vehicle().image||this._config.image;
 if(img&&/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_\-.]+$/.test(img))return img;
 if(this.isG6()&&this.year()==='2026')return `${base}/g6-2026-${this.paint()}.webp`;
 return `${base}/models/${xpAssetModel(this.model())}-${this.paint()}.webp`;
 }
 status(key,onLabel,offLabel){const b=this.bool(key);return b===null?'Not available':b?onLabel:offLabel;}
 items(){const loc=this.data('location')?.entity;const gps=loc?.attributes&&Number.isFinite(Number(loc.attributes.latitude))&&Number.isFinite(Number(loc.attributes.longitude));return [
  ['controls','car','Controls',this.status('locked','Locked','Unlocked')],
  ['climate','fan','Climate',this.status('climate','On','Off')+(this.val('cabin')!==null?' · '+this.n('cabin',1)+'°C':'')],
  ['interior','car','Interior & seats',XP_INTERIORS.find(x=>x.id===this.interior())?.label||'Dark Gray'],
  ['location','pin','Location',gps?'GPS available':'Not available'],
  ['charging','bolt','Charging',this.charging()?`${this.n('power',1)} kW · ${this.n('soc')}%`:this.plugged()?'Plugged in':'Not charging'],
  ['tires','tire','Tire pressure',this.val('tire_fl')!==null?`${this.n('tire_fl')} kPa front left`:'Not available'],
  ['info','info','Vehicle information',this.val('odometer')!==null?`${this.n('odometer')} km`:'Model '+this.model()]
 ];}
 header(){const soc=xpPercent(this.val('soc')),trim=xpAllowedTrims(this.model(),this.year()).find(x=>x.id===this.trim());const trLabel=trim&&this.trim()!=='unspecified'?` · ${trim.label}`:'';
 return `<header class="head"><div><div class="vehicle-title-line"><img class="brand-mini" alt="XPENG" src="${xpEsc((this._config.image_path||'/hacsfiles/xpeng-vehicle-card/assets').replace(/\/$/,'')+'/xpeng-logo.png')}"><div class="vehicle-name">${xpEsc(this.name())}${this.vehicles().length>1?` <button class="back" data-cycle aria-label="Switch vehicle">⌄</button>`:''}</div></div><div class="trim-label">${xpEsc(this.year()+trLabel)}</div><div class="meta"><span class="battery-ico"><span style="width:${soc??0}%"></span></span><b>${soc===null?'—':xpNum(soc)+'%'}</b><span>${this.val('range')===null?'—':this.n('range')+' km'}</span></div><div class="sub-status ${this.charging()?'charging-text':''}">${xpEsc(this.stateText())}</div></div><div class="head-tools"><button type="button" data-expand aria-label="${this._expanded?'Exit full screen':'Full screen'}" title="${this._expanded?'Exit full screen':'Full screen'}">${this._expanded?'✕':'⛶'}</button><button data-view="info" title="Connection details" aria-label="Connection details">${xpIcon('info',20)}</button></div></header>`;}
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

 nav(){const opts=[['controls','lock'],['vehicle','car'],['charging','bolt'],['climate','fan']];return `<div class="navicons" aria-label="Vehicle panels">${opts.map(([view,iconName])=>`<button type="button" class="quick ${this._view===view?'selected':''} ${view==='charging'&&this.charging()?'positive':''}" data-view="${view}" title="${xpEsc(view)}" aria-label="Show ${xpEsc(view)} panel">${xpIcon(iconName,25)}</button>`).join('')}</div>`;}
 overview(){return `<section class="rows" aria-label="Vehicle status">${this.items().map(([view,ico,name,sub])=>`<button type="button" class="listrow" data-view="${view}"><span class="rowicon">${xpIcon(ico,21)}</span><span class="rowtext"><span class="rowtitle">${xpEsc(name)}</span><span class="rowsub">${xpEsc(sub)}</span></span><span class="rowarrow">${xpIcon('arrow',16)}</span></button>`).join('')}</section>`;}
 field(label,value){return `<div class="detailrow"><span>${xpEsc(label)}</span><strong>${xpEsc(value)}</strong></div>`;}
 value(key,unit='',digits=0){const v=this.val(key);return v===null?'—':`${xpNum(v,digits)}${unit?' '+unit:''}`;}
 metric(label,key,unit='',digits=0){return `<div class="metric"><small>${xpEsc(label)}</small><b>${xpEsc(this.value(key,unit,digits))}</b></div>`;}
 chargingView(){const soc=xpPercent(this.val('soc')), target=xpPercent(this.val('target'));return `<div class="hint">${this.charging()?'⚡ Charging now':this.plugged()?'Charging cable connected':'Charging is not active'}</div><div class="metric-hero"><strong>${soc===null?'—':xpNum(soc)+'%'}</strong><span>${this.n('range')} km estimated</span></div><div class="track"><div class="fill" style="width:${soc??0}%"></div>${target!==null?`<div class="target" style="--target:${target}%"></div>`:''}</div><div class="progressfoot"><span>Battery</span><span>Charge limit: ${target===null?'—':xpNum(target)+'%'}</span></div><div class="metrics">${this.metric('Charging power','power','kW',1)}${this.metric('Time remaining','remaining','min')}${this.metric('Energy added','energy','kWh',2)}${this.metric('Voltage','voltage','V',1)}${this.metric('Current','current','A',1)}${this.metric('Range','range','km')}</div><p class="notice">Monitoring only. Charging controls will appear after XPENG remote commands are validated. Charging power (kW) and energy (kWh) are separate measurements.</p>`;}
 controlsView(){const b=(k,a)=>this.status(k,a,'Closed');return `<div class="door-grid"><div class="door-col"><div class="door-pill ${this.bool('door_fl')?'open':''}">Front left<b>${b('door_fl','Open')}</b></div><div class="door-pill ${this.bool('door_rl')?'open':''}">Rear left<b>${b('door_rl','Open')}</b></div></div><div class="door-mid" aria-label="Top-down car silhouette"></div><div class="door-col"><div class="door-pill ${this.bool('door_fr')?'open':''}">Front right<b>${b('door_fr','Open')}</b></div><div class="door-pill ${this.bool('door_rr')?'open':''}">Rear right<b>${b('door_rr','Open')}</b></div></div></div>${this.field('Door locks',this.status('locked','Locked','Unlocked'))}${this.field('Trunk',b('trunk','Open'))}${this.field('Front hood',b('hood','Open'))}<p class="notice">Door indicators are read-only. No unlock or open commands are sent.</p>`;}
 vehicleView(){return this.controlsView();}
 climateView(){return `<div class="metric-hero"><strong>${xpEsc(this.value('cabin','°C',1))}</strong><span>Cabin temperature</span></div>${this.field('Air conditioning',this.status('climate','On','Off'))}${this.field('Outside temperature',this.value('outside','°C',1))}<button class="trim-option" type="button" data-view="comfort">Seat & steering-wheel comfort</button><button class="trim-option" type="button" data-view="interior">Interior overview ${xpIcon('arrow',16)}</button><p class="notice">Steering wheel heating, front seat heat, ventilation and massage are not currently mapped to any VERIFIED direct XPENG cloud control entities. No buttons are activated or hidden API sensors invented.</p>`;}
 comfortView(){
   const functions=['Steering wheel heating','Driver seat heating','Passenger seat heating','Rear seat heating','Driver seat ventilation','Passenger seat ventilation','Driver seat massage','Passenger seat massage'];
   return `<p class="notice">Comfort controls will be enabled only when an authorized XPENG command API and matching vehicle features have been verified.</p><div class="xp-comfort-grid">${functions.map(label=>`<div class="xp-comfort-item"><span>${xpIcon('thermometer',22)}<strong>${xpEsc(label)}</strong></span><button type="button" disabled aria-label="${xpEsc(label)} unavailable">Unavailable</button></div>`).join('')}</div>`;
 }
 interiorView(){
    const finish=XP_INTERIORS.find(x=>x.id===this.interior())?.label||'Not specified';
    return `<div class="xp-cabin-note">Your configured cabin finish applies to the dashboard, steering wheel, door panels, centre console and all seats together.</div>
      ${this.field('Interior finish',finish)}
      <div class="xp-interior-list">${['Steering wheel','Dashboard','Door panels','Centre console','Driver & passenger seats','Rear seating'].map(x=>`<div>${xpEsc(x)}</div>`).join('')}</div>
      <p class="notice">To change vehicle paint or cabin upholstery, open Home Assistant dashboard Edit mode → Edit card → Exterior paint / Interior finish. Settings are saved in card configuration for all devices. No appearance controls exist inside the dashboard.</p>`;
  }
 tiresView(){return `<div class="metrics">${this.metric('Front left','tire_fl','kPa')}${this.metric('Front right','tire_fr','kPa')}${this.metric('Rear left','tire_rl','kPa')}${this.metric('Rear right','tire_rr','kPa')}</div><p class="notice">Readings depend on actual cloud telemetry. G6 OBD mappings are not treated as verified cloud API fields.</p>`;}
 locationView(){const loc=this.data('location')?.entity;const lat=Number(loc?.attributes?.latitude),lon=Number(loc?.attributes?.longitude),ok=loc&&Number.isFinite(lat)&&Number.isFinite(lon);return `${this.field('Location status',ok?'GPS available':'Not available')}${ok?this.field('Latitude',lat.toFixed(5))+this.field('Longitude',lon.toFixed(5)):''}${this.field('Last update',this.val('last_update')||'—')}<p class="notice">The card does not send your vehicle position to external map providers.</p>`;}
 infoView(){const reev=String(this.val('powertrain')||this.vehicle().powertrain||'').toUpperCase()==='REEV';return `${this.field('Brand','XPENG')}${this.field('Model',this.model())}${this.field('Model year',this.year())}${this.field('Edition',xpAllowedTrims(this.model(),this.year()).find(t=>t.id===this.trim())?.label||'—')}${this.field('Powertrain',this.val('powertrain')||this.vehicle().powertrain||'—')}${this.field('Odometer',this.value('odometer','km'))}${this.field('Battery health',this.value('health','%'))}${this.field('High-voltage battery',this.value('battery_voltage','V',1))}${this.field('Battery current',this.value('battery_current','A',1))}${this.field('12V system',this.value('battery_12v','V',1))}${reev?this.field('Fuel level',this.value('fuel','%'))+this.field('Fuel range',this.value('fuel_range','km')):''}${this.field('API status',this.val('connection')||'not configured')}<p class="notice">XPENG Direct is experimental. No public XPENG cloud account login or control API has been verified for this integration.</p>`;}
 
 detail(){const names={comfort:'Comfort',interior:'Interior & seats',controls:'Controls',vehicle:'Vehicle',charging:'Charging',climate:'Climate',location:'Location',tires:'Tire pressure',info:'Vehicle information'};const fn={comfort:'comfortView',interior:'interiorView',controls:'controlsView',vehicle:'vehicleView',charging:'chargingView',climate:'climateView',location:'locationView',tires:'tiresView',info:'infoView'}[this._view]||'infoView';return `<div class="detail-head"><button class="back" data-back aria-label="Back to overview">${xpIcon('back',24)}</button><h2>${names[this._view]||'Details'}</h2></div><div class="content">${this[fn]()}</div>`;}


 cockpitSidebar(){
   const pages=[['overview','Home','car'],['controls','Controls','lock'],['climate','Climate','fan'],['charging','Charging','bolt'],['comfort','Comfort','thermometer'],['tires','Tires','tire'],['location','Location','pin'],['info','Vehicle','info'],['interior','Interior','carfront']];
   return `<aside class="xs-sidebar" aria-label="XPENG vehicle navigation">
     <div class="xs-brand" aria-label="XPENG"><span class="xs-brand-mark" aria-hidden="true">✕</span><span>XPENG</span></div>
     <nav class="xs-nav" aria-label="Vehicle sections">${pages.map(([id,label,icon])=>`<button type="button" data-view="${id}" class="${this._view===id?'selected':''}" aria-current="${this._view===id?'page':'false'}">${xpIcon(icon,19)}<span>${label}</span></button>`).join('')}</nav>
     <div class="xs-nav-footer"><span class="xs-state-dot"></span><span>Community interface</span></div>
   </aside>`;
 }
 studioHeader(){
   const soc=xpPercent(this.val('soc')),range=this.val('range');
   const trim=xpAllowedTrims(this.model(),this.year()).find(t=>t.id===this.trim())?.label||'';
   return `<header class="xs-head">
     <div><div class="xs-eyebrow">VEHICLE CONTROL CENTER</div><div class="xs-heading"><h2>${xpEsc(this.name())}</h2><span class="xs-edition">${xpEsc(this.year())} · ${xpEsc(trim)}</span></div>
       <div class="xs-head-reading">${xpIcon('battery',19)} ${soc===null?'—':xpNum(soc)+'%'} <span>·</span> ${range===null?'—':xpNum(range)+' km'}</div>
     </div>
     <div class="xs-head-tools"><span class="xs-private-status">${xpEsc(xpConnText(this.val('connection')))}</span><button type="button" data-expand aria-label="${this._expanded?'Exit full screen':'Full screen'}" title="${this._expanded?'Exit full screen':'Full screen'}">${this._expanded?'✕':'⛶'}</button></div>
   </header>`;
 }
 studioHero(){
   const soc=xpPercent(this.val('soc')),range=this.val('range');
   const title={overview:'Your XPENG '+this.model(),controls:'Vehicle access',vehicle:'Vehicle access',climate:'Cabin climate',charging:'Charging',comfort:'Cabin comfort',tires:'Tire pressure',location:'Vehicle location',info:'Vehicle information',interior:'Interior & upholstery'}[this._view]||this.model();
   const img=this.asset();
   const conn=this.val('connection');
   const online=conn==='connected' || conn==='online';
   const graph=(this._view==='controls'||this._view==='vehicle'||this._view==='tires')
      ?`<div class="xs-hero-detail xs-hero-map" aria-hidden="true">${this.topVisual()}</div>`
      :(this._view==='climate'||this._view==='comfort'||this._view==='interior')
      ?`<div class="xs-hero-detail xs-hero-cabin" aria-hidden="true">${xpCabinSvg(this.interior())}</div>`
      :this._view==='charging'?`<div class="xs-hero-detail xs-battery-symbol">${xpIcon('bolt',36)}<span>Charging status</span><b>${this.bool('charging')===null?'Unavailable':this.status('charging','Charging','Not charging')}</b></div>`
      :'';
   return `<section class="xs-hero" data-cockpit-view="${xpEsc(this._view)}" aria-label="${xpEsc(title)}">
      <img class="xs-car-photo" src="${xpEsc(img)}" alt="XPENG ${xpEsc(this.model())} ${xpEsc(this.year())} vehicle in ${xpEsc(this.paint().replace(/_/g,' '))}" loading="eager">
      <div class="xs-hero-shade" aria-hidden="true"></div>
      <div class="xs-hero-copy">
        <span class="xs-hero-kicker">XPENG · ${xpEsc(this.year())}</span>
        <h3>${xpEsc(title)}</h3>
        <div class="xs-connection ${online?'xs-online':''}"><span></span>${xpEsc(xpConnText(this.val('connection')))}</div>
        <div class="xs-charge-figure"><span>${xpIcon('battery',29)}</span><strong>${soc===null?'—':xpNum(soc)+'%'}</strong></div>
        <p>Estimated range <strong>${range===null?'—':xpNum(range)+' km'}</strong></p>
        <div class="xs-progress"><div style="width:${soc===null?0:soc}%"></div></div>
      </div>
      ${graph}
      <span class="xs-hero-photo-note">Illustrative vehicle artwork · statuses from Home Assistant only</span>
   </section>`;
 }
 studioActions(){
   const action=[['controls','Locks & doors','lock'],['climate','Climate','fan'],['charging','Charging','bolt'],['comfort','Seats & wheel','thermometer'],['tires','Tires','tire']];
   return `<div class="xs-actions" aria-label="Vehicle section shortcuts">
     ${action.map(([v,label,icon])=>`<button type="button" data-view="${v}" class="xs-action">${xpIcon(icon,24)}<strong>${label}</strong><small>View</small></button>`).join('')}
   </div>`;
 }
 studioStatusRail(){
   const loc=this.data('location')?.entity,lat=loc?.attributes?.latitude,lon=loc?.attributes?.longitude;
   const gps=lat!==null&&lat!==undefined&&lon!==null&&lon!==undefined&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon));
   return `<aside class="xs-rail" aria-label="Vehicle status details">
     <section class="xs-rail-box">
       <div class="xs-rail-title">${xpIcon('pin',19)}<h3>Location</h3></div>
       <div class="xs-location"><div class="xs-location-grid"><span class="xs-location-marker">${xpIcon('pin',26)}</span></div><p>${gps?'Location data available':'Location unavailable'}</p><small>No external map requests</small></div>
       <button type="button" data-view="location" class="xs-link">View location ${xpIcon('arrow',16)}</button>
     </section>
     <section class="xs-rail-box">
       <div class="xs-rail-title">${xpIcon('car',19)}<h3>Vehicle status</h3></div>
       ${this.field('Battery',this.value('soc','%'))}
       ${this.field('Range',this.value('range','km'))}
       ${this.field('Door locks',this.status('locked','Locked','Unlocked'))}
       ${this.field('Odometer',this.value('odometer','km'))}
       ${this.field('Front tire',this.value('tire_fl','kPa'))}
     </section>
     <section class="xs-rail-box xs-alert">
       <div class="xs-rail-title">${xpIcon('shield',18)}<h3>Integration status</h3></div>
       <p>${xpEsc(xpConnText(this.val('connection')))}</p>
       <small>Remote commands are unavailable until a manufacturer-authorized API is verified.</small>
     </section>
   </aside>`;
 }
 studioModules(){
   const soc=xpPercent(this.val('soc'));
   const rawLoc=this.data('location')?.entity?.attributes||{};
   const locPresent=rawLoc.latitude!=null&&rawLoc.longitude!=null&&Number.isFinite(Number(rawLoc.latitude))&&Number.isFinite(Number(rawLoc.longitude));

   const panels=[
      {v:'charging',icon:'bolt',title:'Charging',value:soc===null?'—':xpNum(soc)+'%',sub:this.bool('charging')===null?'Status unavailable':this.status('charging','Charging','Not charging'),bottom:'Charging power: '+this.value('power','kW',1)},
      {v:'climate',icon:'fan',title:'Climate control',value:this.value('cabin','°C',1),sub:this.status('climate','Climate on','Climate off'),bottom:'Outside: '+this.value('outside','°C',1)},
      {v:'comfort',icon:'thermometer',title:'Seats & wheel',value:'Unavailable',sub:'Steering wheel heating',bottom:'Seat heating, cooling & massage'},
      {v:'location',icon:'pin',title:'Location',value:locPresent?'Available':'Unavailable',sub:'Vehicle position',bottom:'No location shared externally'}
   ];
   return `<div class="xs-module-grid" aria-label="Quick vehicle information">
      ${panels.map(x=>`<button data-view="${x.v}" type="button" class="xs-module">
        <span class="xs-module-title">${xpIcon(x.icon,22)} ${x.title}</span><strong>${xpEsc(x.value)}</strong>
        <span>${xpEsc(x.sub)}</span><small>${xpEsc(x.bottom)}</small>
        <span class="xs-module-arrow">${xpIcon('arrow',17)}</span>
      </button>`).join('')}
    </div>`;
 }
 studioDetail(){
   const view=this._view;
   if(view==='overview')return this.studioModules();
   const panelTitle={controls:'Access & doors',vehicle:'Vehicle access',tires:'Tire pressure',climate:'Climate control',charging:'Charging',comfort:'Comfort & seats',location:'Location',info:'Vehicle diagnostics',interior:'Interior & seats'}[view]||'Vehicle details';
   let content='';
   if(view==='controls'||view==='vehicle'){
     content=`<div class="xs-data-grid">${[['Front left','door_fl'],['Front right','door_fr'],['Rear left','door_rl'],['Rear right','door_rr'],['Trunk','trunk'],['Front hood','hood']].map(([label,key])=>`<div class="xs-data-chip"><span>${xpEsc(label)}</span><strong>${xpEsc(this.status(key,'Open','Closed'))}</strong></div>`).join('')}</div>
       <div class="xs-control-buttons">${[['Lock','lock'],['Unlock','unlock'],['Open trunk','car']].map(([label,icon])=>`<button type="button" disabled title="No verified XPENG command API">${xpIcon(icon,18)} ${label}</button>`).join('')}</div>
       <div class="xs-control-notice">${xpIcon('lock',18)} Remote lock / unlock and trunk actions are disabled until verified by XPENG.</div>`;
   }else if(view==='tires'){
     content=`<div class="xs-data-grid">${[['Front left','tire_fl'],['Front right','tire_fr'],['Rear left','tire_rl'],['Rear right','tire_rr']].map(([label,key])=>`<div class="xs-data-chip"><span>${xpEsc(label)}</span><strong>${xpEsc(this.value(key,'kPa'))}</strong></div>`).join('')}</div>`;
   }else if(view==='climate'){
     content=`<div class="xs-climate-control"><div><span>Cabin temperature</span><strong>${xpEsc(this.value('cabin','°C',1))}</strong></div><span class="xs-climate-status">${xpEsc(this.status('climate','On','Off'))}</span></div>
      <div class="xs-data-grid"><div class="xs-data-chip"><span>Outside temperature</span><strong>${xpEsc(this.value('outside','°C',1))}</strong></div><div class="xs-data-chip"><span>Air conditioning</span><strong>${xpEsc(this.status('climate','On','Off'))}</strong></div></div>
      <button type="button" data-view="comfort" class="xs-panel-link">Steering wheel, heating, ventilation & massage ${xpIcon('arrow',17)}</button>`;
   }else if(view==='comfort'){
     const comfort=['Steering wheel heating','Driver seat heating','Passenger seat heating','Rear seat heating','Driver seat ventilation','Passenger seat ventilation','Driver seat massage','Passenger seat massage'];
     content=`<div class="xs-comfort-grid">${comfort.map((label)=>`<div class="xs-comfort-item"><span>${xpIcon('thermometer',20)}${xpEsc(label)}</span><button type="button" disabled title="No verified XPENG remote API for this function">Unavailable</button></div>`).join('')}</div>`;
   }else if(view==='charging'){
     content=`<div class="xs-charge-meter"><span>Battery level</span><b>${xpEsc(this.value('soc','%'))}</b><div class="xs-charge-track"><div style="width:${xpPercent(this.val('soc'))??0}%"></div></div></div>
       <div class="xs-data-grid">${[['Estimated range','range','km'],['Charging power','power','kW'],['Target','target','%'],['Energy added','energy','kWh'],['Voltage','voltage','V'],['Current','current','A']].map(([label,key,unit])=>`<div class="xs-data-chip"><span>${xpEsc(label)}</span><strong>${xpEsc(this.value(key,unit,key==='power'||key==='energy'?1:0))}</strong></div>`).join('')}</div>
       <div class="xs-control-notice">Charge commands are disabled pending approved vehicle APIs.</div>`;
   }else if(view==='interior'){
     content=`<div class="xs-data-grid"><div class="xs-data-chip"><span>Upholstery & dashboard</span><strong>${xpEsc(XP_INTERIORS.find(v=>v.id===this.interior())?.label||'—')}</strong></div><div class="xs-data-chip"><span>Car paint</span><strong>${xpEsc(XP_PAINTS.find(v=>v.id===this.paint())?.label||'—')}</strong></div></div>
       <div class="xs-control-notice">Paint and upholstery can only be changed from Home Assistant → Edit card.</div>`;
   }else if(view==='location'){
     const attrs=this.data('location')?.entity?.attributes||{},valid=attrs.latitude!=null&&attrs.longitude!=null&&Number.isFinite(Number(attrs.latitude))&&Number.isFinite(Number(attrs.longitude));
     content=`<div class="xs-data-grid"><div class="xs-data-chip"><span>GPS</span><strong>${valid?'Position available':'Unavailable'}</strong></div><div class="xs-data-chip"><span>Last update</span><strong>${xpEsc(this.val('last_update')||'—')}</strong></div></div><div class="xs-control-notice">Location is read from Home Assistant only. No external map service is contacted.</div>`;
   }else{content=`<div class="xs-data-grid">${[['Model',this.model()],['Year',this.year()],['Odometer',this.value('odometer','km')],['Battery health',this.value('health','%')],['API status',this.val('connection')||'Not configured'],['Powertrain',this.val('powertrain')||'—']].map(([label,value])=>`<div class="xs-data-chip"><span>${xpEsc(label)}</span><strong>${xpEsc(value)}</strong></div>`).join('')}</div>`;}
   return `<section class="xs-detail" aria-label="${xpEsc(panelTitle)}"><div class="xs-detail-heading"><h3>${xpEsc(panelTitle)}</h3><button type="button" data-view="overview">${xpIcon('back',17)} Home</button></div>${content}</section>`;
 }
 cockpit(){
   const isOffline=!['online','connected'].includes(String(this.val('connection')||'').toLowerCase());
   return `<div class="xp-cockpit xp-studio">${this.cockpitSidebar()}<main class="xs-main">${this.studioHeader()}
     ${isOffline?'<div class="xs-not-connected">XPENG Direct not connected — live data and remote commands are unavailable.</div>':''}
     <div class="xs-workspace">
       <div class="xs-left">${this.studioHero()}${this._view==='overview'?this.studioActions():''}${this.studioDetail()}</div>
       ${this.studioStatusRail()}
     </div>
     <div class="xs-bottom-note">Independent Home Assistant vehicle dashboard · read-only until an authorized XPENG API is verified</div>
   </main></div>`;
 }

 render(){
  if(!this.shadowRoot)return;
  this.setAttribute('data-theme',this._config.theme==='light'?'light':'dark');
  this.toggleAttribute('data-expanded',this._expanded);
  const cockpit=this._config.dashboard_layout==='cockpit';
  this.toggleAttribute('data-cockpit',cockpit);
  const conn=this.val('connection'),offline=conn===null||conn==='not_configured';
  const classic=`${this.header()}${this.hero()+this.nav()}${offline?'<div class="disconnected-note">XPENG API not connected · All live vehicle data remains unavailable</div>':''}${this._view==='overview'?this.overview():this.detail()}<footer class="footer-brand">XPENG · COMMUNITY VEHICLE CARD</footer>`;
  this.shadowRoot.innerHTML=`<style>${XP_CSS}</style><ha-card><div class="app">${cockpit?this.cockpit():classic}</div></ha-card>`;
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
