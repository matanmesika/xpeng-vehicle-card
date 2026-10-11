/**
 * XPENG Vehicle Card v0.5.0-alpha.4 — XPENG vehicle monitoring dashboard (read-only).
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

`;
class XpengVehicleCard extends HTMLElement{
 constructor(){super();this.attachShadow({mode:'open'});this._expanded=false;this._config={prefix:'my_xpeng',theme:'dark'};this._view='overview';this._hass=null;this._vehicleIndex=0;this._preferences={};
   this.shadowRoot.addEventListener('click',e=>{const target=e.target.closest('button[data-view],button[data-back],button[data-cycle],button[data-color],button[data-interior],button[data-expand]');if(!target)return;
    if(target.dataset.color){const v=target.dataset.color;if(xpAllowedPaints(this.selectedModel(),this.year(),this.trim()).some(p=>p.id===v)){this._saveAppearance({...this.appearance(),color:v});this.render();}}
    else if(target.dataset.interior){const v=target.dataset.interior;if(xpAllowedInteriors(this.selectedModel(),this.year(),this.trim()).some(x=>x.id===v)){this._saveAppearance({...this.appearance(),interior:v});this.render();}}
    else if(target.dataset.view){this._view=target.dataset.view;this.render();}
    else if(target.dataset.back!==undefined){this._view='overview';this.render();}
    else if(target.dataset.cycle!==undefined){this._vehicleIndex=(this._vehicleIndex+1)%this.vehicles().length;this._loadAppearance();this._view='overview';this.render();}});
   this.shadowRoot.addEventListener('change',e=>{const t=e.target.closest('select[data-appearance]');if(!t)return;
    const k=t.dataset.appearance;const values={...this.appearance(),[k]:t.value};
    // Recompute only dependent dimensions: year -> model -> trim -> paint; model -> trim -> paint.
    if(k==='year') {if(!xpAllowedModels(values.year).some(m=>m.id===values.model))values.model=xpAllowedModels(values.year)[0]?.id||'Other';}
    if(k==='year'||k==='model'){values.trim=xpAllowedTrims(values.model,values.year)[0].id;values.color=xpAllowedPaints(values.model,values.year,values.trim)[0].id;values.interior='dark_gray';}
    if(k==='trim'){values.color=xpAllowedPaints(values.model,values.year,values.trim).some(p=>p.id===values.color)?values.color:xpAllowedPaints(values.model,values.year,values.trim)[0].id;values.interior=xpAllowedInteriors(values.model,values.year,values.trim).some(x=>x.id===values.interior)?values.interior:'dark_gray';}
    this._saveAppearance(xpNormalizeAppearance(values));this.render();});
 }
 setConfig(config){if(config.prefix&&!/^[a-z0-9_]+$/.test(config.prefix))throw Error('XPENG prefix must be a slug');
 if(config.image_path&&!/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_-]+\/?$/.test(config.image_path))throw Error('image_path must be a local Home Assistant directory');
 const original={prefix:'my_xpeng',theme:'dark',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',...config};
 // For older configs, coerce only values that are no longer valid in the selected model year.
 const normalized=xpNormalizeAppearance(original);this._config={...original,...normalized};this._loadAppearance();this.render();}
 set hass(hass){this._hass=hass;this.render();}get hass(){return this._hass;}
 getCardSize(){return this._view==='overview'?8:7;}
 static getConfigElement(){return document.createElement('xpeng-vehicle-card-editor');}
 static getStubConfig(){return {type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',theme:'dark'};}
 vehicles(){const list=this._config.vehicles;return Array.isArray(list)&&list.length?list:[this._config];}
 vehicle(){return this.vehicles()[Math.min(this._vehicleIndex,this.vehicles().length-1)]||this._config;}
 prefix(){return this.vehicle().prefix||this._config.prefix||'my_xpeng';}
 _prefKey(){return 'xpeng-vehicle-card-appearance-v2-'+this.prefix();}
 _loadAppearance(){try{const raw=JSON.parse(localStorage.getItem(this._prefKey())||'null');this._preferences=raw?xpNormalizeAppearance(raw):null;}catch{this._preferences=null;}}
 _saveAppearance(v){this._preferences=xpNormalizeAppearance(v);try{localStorage.setItem(this._prefKey(),JSON.stringify(this._preferences));}catch{/* storage disabled */}}
 appearance(){return xpNormalizeAppearance({...this._config,...this.vehicle(),...(this._preferences||{})});}
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
 return `<header class="head"><div><div class="vehicle-title-line"><img class="brand-mini" alt="XPENG" src="${xpEsc((this._config.image_path||'/hacsfiles/xpeng-vehicle-card/assets').replace(/\/$/,'')+'/xpeng-logo.png')}"><div class="vehicle-name">${xpEsc(this.name())}${this.vehicles().length>1?` <button class="back" data-cycle aria-label="Switch vehicle">⌄</button>`:''}</div></div><div class="trim-label">${xpEsc(this.year()+trLabel)}</div><div class="meta"><span class="battery-ico"><span style="width:${soc??0}%"></span></span><b>${soc===null?'—':xpNum(soc)+'%'}</b><span>${this.val('range')===null?'—':this.n('range')+' km'}</span></div><div class="sub-status ${this.charging()?'charging-text':''}">${xpEsc(this.stateText())}</div></div><div class="head-tools"><button type="button" data-expand aria-label="${this._expanded?'Exit full screen':'Full screen'}" title="${this._expanded?'Exit full screen':'Full screen'}">${this._expanded?'✕':'⛶'}</button><button data-view="appearance" aria-label="Customize vehicle" title="Customize vehicle">${xpIcon('settings',20)}</button><button data-view="info" title="Connection details" aria-label="Connection details">${xpIcon('info',20)}</button></div></header>`;}
 hero(){const charging=this.charging();const model=this.model();const cls=this.isG6()?'g6':'';return `<div class="hero ${cls} ${charging?'is-charging':''}"><img alt="XPENG ${xpEsc(model)} vehicle artwork" src="${xpEsc(this.asset())}" loading="eager">${charging?`<div class="hero-badge">${xpIcon('bolt',15)} ${this.n('power',1)} kW</div>`:''}</div>`;}
 nav(){const opts=[['controls','lock'],['vehicle','car'],['charging','bolt'],['climate','fan']];return `<div class="navicons" aria-label="Vehicle panels">${opts.map(([view,iconName])=>`<button type="button" class="quick ${this._view===view?'selected':''} ${view==='charging'&&this.charging()?'positive':''}" data-view="${view}" title="${xpEsc(view)}" aria-label="Show ${xpEsc(view)} panel">${xpIcon(iconName,25)}</button>`).join('')}</div>`;}
 overview(){return `<section class="rows" aria-label="Vehicle status">${this.items().map(([view,ico,name,sub])=>`<button type="button" class="listrow" data-view="${view}"><span class="rowicon">${xpIcon(ico,21)}</span><span class="rowtext"><span class="rowtitle">${xpEsc(name)}</span><span class="rowsub">${xpEsc(sub)}</span></span><span class="rowarrow">${xpIcon('arrow',16)}</span></button>`).join('')}</section>`;}
 field(label,value){return `<div class="detailrow"><span>${xpEsc(label)}</span><strong>${xpEsc(value)}</strong></div>`;}
 value(key,unit='',digits=0){const v=this.val(key);return v===null?'—':`${xpNum(v,digits)}${unit?' '+unit:''}`;}
 metric(label,key,unit='',digits=0){return `<div class="metric"><small>${xpEsc(label)}</small><b>${xpEsc(this.value(key,unit,digits))}</b></div>`;}
 chargingView(){const soc=xpPercent(this.val('soc')), target=xpPercent(this.val('target'));return `<div class="hint">${this.charging()?'⚡ Charging now':this.plugged()?'Charging cable connected':'Charging is not active'}</div><div class="metric-hero"><strong>${soc===null?'—':xpNum(soc)+'%'}</strong><span>${this.n('range')} km estimated</span></div><div class="track"><div class="fill" style="width:${soc??0}%"></div>${target!==null?`<div class="target" style="--target:${target}%"></div>`:''}</div><div class="progressfoot"><span>Battery</span><span>Charge limit: ${target===null?'—':xpNum(target)+'%'}</span></div><div class="metrics">${this.metric('Charging power','power','kW',1)}${this.metric('Time remaining','remaining','min')}${this.metric('Energy added','energy','kWh',2)}${this.metric('Voltage','voltage','V',1)}${this.metric('Current','current','A',1)}${this.metric('Range','range','km')}</div><p class="notice">Monitoring only. Charging controls will appear after XPENG remote commands are validated. Charging power (kW) and energy (kWh) are separate measurements.</p>`;}
 controlsView(){const b=(k,a)=>this.status(k,a,'Closed');return `<div class="door-grid"><div class="door-col"><div class="door-pill ${this.bool('door_fl')?'open':''}">Front left<b>${b('door_fl','Open')}</b></div><div class="door-pill ${this.bool('door_rl')?'open':''}">Rear left<b>${b('door_rl','Open')}</b></div></div><div class="door-mid" aria-label="Top-down car silhouette"></div><div class="door-col"><div class="door-pill ${this.bool('door_fr')?'open':''}">Front right<b>${b('door_fr','Open')}</b></div><div class="door-pill ${this.bool('door_rr')?'open':''}">Rear right<b>${b('door_rr','Open')}</b></div></div></div>${this.field('Door locks',this.status('locked','Locked','Unlocked'))}${this.field('Trunk',b('trunk','Open'))}${this.field('Front hood',b('hood','Open'))}<p class="notice">Door indicators are read-only. No unlock or open commands are sent.</p>`;}
 vehicleView(){return this.controlsView();}
 climateView(){return `<div class="metric-hero"><strong>${xpEsc(this.value('cabin','°C',1))}</strong><span>Cabin temperature</span></div><div class="xp-cabin-wrap">${xpCabinSvg(this.interior())}</div>${this.field('Air conditioning',this.status('climate','On','Off'))}${this.field('Outside temperature',this.value('outside','°C',1))}<button class="trim-option" type="button" data-view="interior">Interior & seat finish ${xpIcon('arrow',16)}</button><p class="notice">Steering wheel heating, front seat heat, ventilation and massage are not currently mapped to any VERIFIED direct XPENG cloud control entities. No buttons are activated or hidden API sensors invented.</p>`;}
 interiorView(){const v=this.interior();const choices=xpAllowedInteriors(this.model(),this.year(),this.trim());const buttons=choices.map(c=>`<button type="button" class="xp-interior-choice" data-interior="${c.id}" aria-pressed="${v===c.id}"><span class="xp-interior-chip" style="background:linear-gradient(130deg,${c.hex} 60%,${c.secondary} 61%)"></span>${xpEsc(c.label)}</button>`).join('');return `<div class="xp-cabin-wrap">${xpCabinSvg(v)}</div><div class="xp-cabin-note">Conceptual top-down cabin illustration • Trim colour applies to steering wheel, dashboard, console, door inserts, front seats and rear seats together.</div><div class="settings-label">Interior finish · ${xpEsc(this.model())} ${xpEsc(this.year())}</div><div class="xp-interior-grid">${buttons}</div><div class="xp-interior-list">${['Steering wheel','Dashboard','Door panels','Centre console','Driver & passenger seats','Rear seating'].map(x=>`<div>${xpEsc(x)}</div>`).join('')}</div><p class="notice">Interior selection is visual-only and does not change the real vehicle. Official Dark Gray and Light Gray themes are published for the refreshed G6; availability and upholstery materials vary by market and variant. Controls require verified XPENG API entities.</p>`;}

 tiresView(){return `<div class="metrics">${this.metric('Front left','tire_fl','kPa')}${this.metric('Front right','tire_fr','kPa')}${this.metric('Rear left','tire_rl','kPa')}${this.metric('Rear right','tire_rr','kPa')}</div><p class="notice">Readings depend on actual cloud telemetry. G6 OBD mappings are not treated as verified cloud API fields.</p>`;}
 locationView(){const loc=this.data('location')?.entity;const lat=Number(loc?.attributes?.latitude),lon=Number(loc?.attributes?.longitude),ok=loc&&Number.isFinite(lat)&&Number.isFinite(lon);return `${this.field('Location status',ok?'GPS available':'Not available')}${ok?this.field('Latitude',lat.toFixed(5))+this.field('Longitude',lon.toFixed(5)):''}${this.field('Last update',this.val('last_update')||'—')}<p class="notice">The card does not send your vehicle position to external map providers.</p>`;}
 infoView(){const reev=String(this.val('powertrain')||this.vehicle().powertrain||'').toUpperCase()==='REEV';return `${this.field('Brand','XPENG')}${this.field('Model',this.model())}${this.field('Model year',this.year())}${this.field('Edition',xpAllowedTrims(this.model(),this.year()).find(t=>t.id===this.trim())?.label||'—')}${this.field('Powertrain',this.val('powertrain')||this.vehicle().powertrain||'—')}${this.field('Odometer',this.value('odometer','km'))}${this.field('Battery health',this.value('health','%'))}${this.field('High-voltage battery',this.value('battery_voltage','V',1))}${this.field('Battery current',this.value('battery_current','A',1))}${this.field('12V system',this.value('battery_12v','V',1))}${reev?this.field('Fuel level',this.value('fuel','%'))+this.field('Fuel range',this.value('fuel_range','km')):''}${this.field('API status',this.val('connection')||'not configured')}<p class="notice">XPENG Direct is experimental. No public XPENG cloud account login or control API has been verified for this integration.</p>`;}
 appearanceView(){const y=this.year(),m=this.model(),t=this.trim(),c=this.paint();
 const years=XP_YEARS.map(x=>`<option value="${x}" ${y===x?'selected':''}>${x}</option>`).join('');
 const models=xpAllowedModels(y).map(x=>`<option value="${xpEsc(x.id)}" ${m===x.id?'selected':''}>${xpEsc(x.name)}</option>`).join('');
 const trims=xpAllowedTrims(m,y).map(x=>`<option value="${xpEsc(x.id)}" ${t===x.id?'selected':''}>${xpEsc(x.label)}</option>`).join('');
 const paints=xpAllowedPaints(m,y,t).map(p=>`<button type="button" class="paint-option" data-color="${p.id}" aria-pressed="${p.id===c}"><span class="paint-dot" style="background:${p.hex}"></span><span>${xpEsc(p.label)}</span></button>`).join('');
 return `<div class="settings-label">1. Model year</div><select class="xp-appearance-select" data-appearance="year" aria-label="Model year">${years}</select>
 <div class="settings-label">2. Vehicle model</div><select class="xp-appearance-select" data-appearance="model" aria-label="Vehicle model">${models}</select>
 <div class="settings-label">3. Vehicle variant / trim</div><select class="xp-appearance-select" data-appearance="trim" aria-label="Variant and trim">${trims}</select>
 <div class="settings-label">4. Exterior paint</div><div class="paint-grid">${paints}</div>
 <div class="settings-label">5. Interior trim / upholstery theme</div><div class="xp-interior-grid">${xpAllowedInteriors(m,y,t).map(x=>`<button type="button" class="xp-interior-choice" data-interior="${x.id}" aria-pressed="${this.interior()===x.id}"><span class="xp-interior-chip" style="background:linear-gradient(130deg,${x.hex} 60%,${x.secondary} 61%)"></span>${xpEsc(x.label)}</button>`).join('')}</div>
 <p class="notice">Appearance changes are stored in this browser. To apply to all devices, select the same values in the card's Home Assistant editor. Model-year availability is a catalog approximation: variants and paint offerings differ by region. Except for the specially illustrated G6 2026 facelift, the vehicle images are stylized concept art and not manufacturer-accurate photos for each year.</p>`;
 }
 detail(){const names={interior:'Interior & seats',appearance:'Appearance',controls:'Controls',vehicle:'Vehicle',charging:'Charging',climate:'Climate',location:'Location',tires:'Tire pressure',info:'Vehicle information'};const fn={interior:'interiorView',appearance:'appearanceView',controls:'controlsView',vehicle:'vehicleView',charging:'chargingView',climate:'climateView',location:'locationView',tires:'tiresView',info:'infoView'}[this._view]||'infoView';return `<div class="detail-head"><button class="back" data-back aria-label="Back to overview">${xpIcon('back',24)}</button><h2>${names[this._view]||'Details'}</h2></div><div class="content">${this[fn]()}</div>`;}
 render(){if(!this.shadowRoot)return;this.setAttribute('data-theme',this._config.theme==='light'?'light':'dark');this.toggleAttribute('data-expanded',this._expanded);const conn=this.val('connection');const unconfigured=conn===null||conn==='not_configured';this.shadowRoot.innerHTML=`<style>${XP_CSS}</style><ha-card><div class="app">${this.header()}${['interior','climate'].includes(this._view)?'':this.hero()+this.nav()}${unconfigured?'<div class="disconnected-note">XPENG API not connected · All live vehicle data remains unavailable</div>':''}${this._view==='overview'?this.overview():this.detail()}<footer class="footer-brand">XPENG · COMMUNITY VEHICLE CARD</footer></div></ha-card>`;}
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
