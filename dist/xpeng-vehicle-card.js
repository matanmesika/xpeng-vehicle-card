/**
 * XPENG Vehicle Card v0.9.0-alpha.1 — XPENG vehicle monitoring dashboard (read-only).
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
:host{display:block;--x-bg:#18191b;--x-bg2:#222427;--x-ink:#f3f4f5;--x-muted:#989fa7;--x-line:#323437;--x-accent:#62c995;color:var(--x-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
:host([data-theme=light]){--x-bg:#f7f8f9;--x-bg2:#e9ebed;--x-ink:#1f272c;--x-muted:#5c6872;--x-line:#c9d0d6;--x-accent:#188959}
*{box-sizing:border-box}ha-card{display:block;box-shadow:none!important;background:transparent!important;border:0!important;color:var(--x-ink)}
.vehicle-app{background:var(--x-bg);border:1px solid var(--x-line);box-shadow:0 16px 40px #0002;border-radius:20px;max-width:570px;margin:0 auto;padding:19px 20px 13px;min-height:330px;overflow:hidden;direction:ltr}
.vehicle-app.wide{max-width:940px}.x-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:2px 2px 10px}
.x-head-title{font-size:26px;font-weight:700;letter-spacing:-.55px;line-height:1.13}
.x-small{color:var(--x-muted);font-size:11px;line-height:1.6}.x-header-meta{display:flex;align-items:center;gap:12px;margin:8px 0 5px;font-size:14px}
.x-meta-pair{display:flex;gap:5px;align-items:center}.x-strong{font-weight:660}.x-header-right{display:flex;gap:6px}
.x-icon-button{border:0;border-radius:9px;color:var(--x-ink);background:transparent;display:grid;place-items:center;width:35px;height:35px;cursor:pointer}
.x-icon-button:hover,.x-entry:hover,.x-quick button:not(:disabled):hover{background:var(--x-bg2)}
.x-icon-button:focus-visible,.x-entry:focus-visible,.x-quick button:focus-visible,.x-footer button:focus-visible{outline:2px solid #529bd9;outline-offset:2px}
.x-charge-label{color:var(--x-accent)}.x-muted{color:var(--x-muted)}.x-status{font-size:11px;color:var(--x-muted);margin-top:6px}
.x-home{display:block}.x-car-stage{height:268px;width:100%;position:relative;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 60%,#383a3d 0%,#1d1f22 68%);border-radius:13px;overflow:hidden}
.x-car-stage img{position:relative;width:100%;height:100%;object-fit:contain;object-position:center;display:block}
.x-charge-indicator{position:absolute;right:10px;bottom:10px;padding:6px 10px;border-radius:9px;background:#113b2bbf;color:#a4f9ce;font-size:11px;display:flex;gap:5px;align-items:center}
.x-drive-label{position:absolute;left:10px;bottom:9px;color:#c7ced8;background:#1013178c;padding:4px 8px;border-radius:7px;font-size:11px}
.x-car-caption{font-size:10px;color:var(--x-muted);text-align:center;margin-top:4px}
.x-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 13px 11px}
.x-quick button{min-height:49px;width:49px;display:grid;place-items:center;border:0;border-radius:50%;background:var(--x-bg2);color:var(--x-ink);cursor:pointer;justify-self:center}
.x-quick button:disabled{cursor:not-allowed;opacity:.5}
.x-nav{margin-top:10px}.x-entry{display:flex;width:100%;align-items:center;text-align:left;gap:12px;min-height:66px;padding:12px 7px;border:0;border-bottom:1px solid var(--x-line);background:transparent;color:var(--x-ink);cursor:pointer;font:inherit}
.x-entry:last-child{border-bottom:0}.x-entry-icon{width:33px;display:grid;place-items:center;color:#c4cbd1}
.x-entry-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.x-entry-copy strong{font-size:14px;font-weight:630}.x-entry-copy small{font-size:11px;color:var(--x-muted)}.x-entry svg:last-child{color:var(--x-muted)}
.x-panel-header{display:flex;align-items:center;gap:9px;margin:4px 0 15px}.x-panel-header h2{margin:0;font-size:21px;font-weight:650}
.x-panel-header .x-icon-button{margin-left:-6px}.x-main-panel{min-height:300px}
.x-control-car{position:relative;height:340px;background:#151719;border-radius:14px;overflow:hidden}
.x-top-svg{width:100%;height:100%;max-width:460px;display:block;margin:0 auto;filter:drop-shadow(0 10px 20px #0008)}
.x-control-pin{position:absolute;z-index:2;background:#262b31e8;border:1px solid #49515b;border-radius:10px;color:#e7eef4;min-width:83px;padding:7px;font-size:10px;line-height:1.5;text-align:center}
.x-control-pin b{display:block;font-size:11px}.x-control-pin.active{border-color:#d8a16a;color:#ffcd93}
.x-fl{left:2%;top:20%}.x-fr{right:2%;top:20%}.x-rl{left:2%;bottom:22%}.x-rr{right:2%;bottom:22%}
.x-disabled-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:14px}
.x-disabled-tools button{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;border:0;background:transparent;color:var(--x-muted);cursor:not-allowed;min-height:62px;font-size:10px;opacity:.66}
.x-submenu{margin:13px 0}.x-menu-link{width:100%;background:var(--x-bg2);border:1px solid var(--x-line);border-radius:10px;padding:12px 13px;text-align:left;color:var(--x-ink);cursor:pointer;display:flex;align-items:center;gap:8px;font:inherit;font-size:12px}
.x-menu-link>span{flex:1}.x-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
.x-fact{background:var(--x-bg2);border:1px solid var(--x-line);border-radius:11px;padding:11px;min-width:0}
.x-fact small{display:block;font-size:10px;color:var(--x-muted)}.x-fact strong{display:block;margin-top:5px;font-size:13px;overflow-wrap:anywhere}
.x-climate-art{position:relative;display:grid;place-items:center;height:355px;background:radial-gradient(ellipse at center,#42474d,#1d1f22 77%);border-radius:13px;overflow:hidden}
.x-climate-art svg.xp-cabin-svg{height:100%;max-width:100%;width:auto;filter:drop-shadow(0 7px 18px #0007)}
.x-seat-bubbles{position:absolute;inset:0;pointer-events:none}
.x-seat-bubbles>span{position:absolute;display:grid;place-items:center;color:#9baebf;border:1px solid #5f778d;border-radius:50%;background:#0e1d2abc;width:32px;height:32px}
.x-seat-bubbles span:nth-child(1){left:29%;top:29%}.x-seat-bubbles span:nth-child(2){right:29%;top:29%}.x-seat-bubbles span:nth-child(3){left:44%;top:9%}
.x-temp-row{display:flex;align-items:center;justify-content:space-around;gap:13px;margin:17px 0}
.x-temp-figure{display:flex;flex-direction:column;align-items:center;gap:5px}.x-temp-figure small{color:var(--x-muted);font-size:10px}.x-temp-figure strong{font-size:21px}
.x-stepper{display:flex;align-items:center;gap:11px}.x-stepper button{width:38px;height:38px;background:var(--x-bg2);color:var(--x-muted);border:1px solid var(--x-line);border-radius:9px;font-size:20px;cursor:not-allowed}
.x-comfort-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.x-comfort-list>div{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 11px;border:1px solid var(--x-line);border-radius:10px;background:var(--x-bg2)}
.x-comfort-list span{font-size:11px}.x-comfort-list button{border:0;background:#363d44;color:#9aa6b3;border-radius:8px;padding:7px 8px;font-size:10px;cursor:not-allowed}
.x-charging-car{height:230px;border-radius:13px;background:#222428;display:grid;place-items:center;overflow:hidden}
.x-charging-car img{display:block;width:100%;height:100%;object-fit:contain}
.x-charge-panel{padding:12px 0}.x-line{border-top:1px solid var(--x-line);padding:15px 0}
.x-line-title{display:flex;justify-content:space-between;gap:10px;font-size:13px}
.x-line-title strong{font-size:16px}.x-progress{height:10px;width:100%;border-radius:30px;background:#42494b;overflow:hidden;margin-top:13px}
.x-progress span{display:block;background:var(--x-accent);height:100%}
.x-line input[type=range]{width:100%;accent-color:var(--x-accent);margin-top:15px;opacity:.6}
.x-line button[disabled]{opacity:.55;cursor:not-allowed}
.x-location{height:280px;background:repeating-linear-gradient(45deg,#202731 0,#202731 2px,#222b33 2px,#222b33 26px);border:1px solid var(--x-line);border-radius:12px;display:grid;place-items:center;align-content:center;gap:10px;color:var(--x-muted);font-size:13px;text-align:center;padding:20px}
.x-location small{font-size:11px}.x-notice{font-size:11px;color:var(--x-muted);line-height:1.55;margin-top:11px}.x-footer{text-align:center;font-size:10px;color:var(--x-muted);margin-top:14px}
:host([data-expanded]){position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483000!important;display:block!important;overflow-y:auto!important;background:var(--x-bg)}
:host([data-expanded]) .vehicle-app,:host(:fullscreen) .vehicle-app{min-height:100vh;max-width:1200px!important;border:0;border-radius:0;padding:clamp(16px,3vw,32px)}
:host([data-expanded]) .x-car-stage,:host(:fullscreen) .x-car-stage{height:min(57vh,640px)}
@media(min-width:740px){.vehicle-app.wide .x-home{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(270px,.8fr);gap:26px;align-items:center}.vehicle-app.wide .x-nav{margin-top:0}.vehicle-app.wide .x-car-stage{height:330px}}
@media(max-width:500px){.vehicle-app{padding:15px 12px 12px;border-radius:12px}.x-car-stage{height:240px}.x-head-title{font-size:23px}.x-nav .x-entry{min-height:61px}.x-climate-art{height:300px}.x-control-car{height:310px}.x-control-pin{min-width:67px;font-size:9px;padding:5px}.x-comfort-list{grid-template-columns:1fr}.x-seat-bubbles span:nth-child(1){left:23%}.x-seat-bubbles span:nth-child(2){right:23%}.x-facts{gap:6px}.x-footer{padding-bottom:68px}}
`;

class XpengVehicleCard extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});
  this._cfg=xpNormalizeAppearance({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',dashboard_layout:'cockpit'});
  this._hass=null;this._page='home';this._index=0;this._expanded=false;
  this.shadowRoot.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-page')){this._page=button.getAttribute('data-page');this.render();return;}
    if(button.hasAttribute('data-back')){this._page='home';this.render();return;}
    if(button.hasAttribute('data-next')){this._index=(this._index+1)%this.vehicles().length;this._page='home';this.render();return;}
    if(button.hasAttribute('data-expanded')){
      this._expanded=!this._expanded;
      if(this._expanded&&typeof this.requestFullscreen==='function'){this.requestFullscreen().catch(()=>{});}
      else if(!this._expanded&&document.fullscreenElement===this&&document.exitFullscreen){document.exitFullscreen().catch(()=>{});}
      this.render();
    }
  });
 }
 connectedCallback(){
  if(!this._fsListener)this._fsListener=()=>{if(!document.fullscreenElement&&this._expanded){this._expanded=false;this.render();}};
  document.addEventListener('fullscreenchange',this._fsListener);
 }
 disconnectedCallback(){if(this._fsListener)document.removeEventListener('fullscreenchange',this._fsListener);}
 static getStubConfig(){return {prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',dashboard_layout:'cockpit',theme:'dark'};}
 static getConfigElement(){return document.createElement('xpeng-vehicle-card-editor');}
 getCardSize(){return 9;}
 setConfig(cfg){
  if(!cfg||typeof cfg!=='object')throw Error('XPENG configuration must be an object');
  if(cfg.prefix&&!/^[a-z0-9_]+$/.test(cfg.prefix))throw Error('Invalid XPENG entity prefix');
  this._cfg={...cfg,...xpNormalizeAppearance(cfg)};
  if(!['home','controls','tires','climate','comfort','interior','charging','location','vehicle'].includes(this._page))this._page='home';
  this.render();
 }
 set hass(hass){this._hass=hass;this.render();}
 get hass(){return this._hass;}
 vehicles(){return Array.isArray(this._cfg.vehicles)&&this._cfg.vehicles.length?this._cfg.vehicles:[{}];}
 vehicle(){return this.vehicles()[this._index]||this.vehicles()[0]||{};}
 appearance(){return xpNormalizeAppearance({...this._cfg,...this.vehicle()});}
 selectedModel(){return this.appearance().model;}
 model(){return this.selectedModel();}
 year(){return this.appearance().year;}
 trim(){return this.appearance().trim;}
 paint(){return this.appearance().color;}
 interior(){return this.appearance().interior;}
 isG6(){return this.model()==='G6';}
 prefix(){return this.vehicle().prefix||this._cfg.prefix||'my_xpeng';}
 name(){const raw=this.vehicle().name||this._cfg.name||this.val('name');return raw&&raw!=='My XPENG'?String(raw):'XPENG '+this.model();}
 asset(){
  const base=(this._cfg.image_path||'/hacsfiles/xpeng-vehicle-card/assets').replace(/\/$/,'');
  const custom=this.vehicle().image||this._cfg.image;
  if(custom&&/^\/(local|hacsfiles)\/[A-Za-z0-9_./-]+$/.test(custom)&&!custom.includes('..'))return custom;
  if(this.isG6()&&this.year()==='2026')return base+'/g6-2026-'+this.paint()+'.webp';
  return base+'/models/'+xpAssetModel(this.model())+'-'+this.paint()+'.webp';
 }
 data(key){
  const tuple=XP_KEYS[key];if(!tuple)return null;
  const id=this.vehicle().entities?.[key]||this._cfg.entities?.[key]||tuple[0]+'.'+this.prefix()+'_'+tuple[1];
  const entity=this._hass?.states?.[id];
  const raw=entity?.state??null;
  return {id,entity,value:raw===null||(typeof raw==='string'&&XP_INVALID.has(raw.toLowerCase()))?null:raw};
 }
 val(key){return this.data(key)?.value??null;}
 bool(key){return xpBool(this.val(key));}
 value(key,unit='',dec=0){const v=this.val(key);return v===null?'—':xpNum(v,dec)+(unit?' '+unit:'');}
 status(key,on,off){const b=this.bool(key);return b===null?'Unavailable':b?on:off;}
 connected(){return ['online','connected'].includes(String(this.val('connection')||'').toLowerCase());}
 badge(){return this.connected()?'Connected':'Not connected';}
 svg(name,size=21){return xpIcon(name,size);}
 menu(page,label,sub,icon){return `<button class="x-entry" type="button" data-page="${page}"><span class="x-entry-icon">${this.svg(icon,21)}</span><span class="x-entry-copy"><strong>${label}</strong><small>${xpEsc(sub)}</small></span>${this.svg('arrow',17)}</button>`;}
 header(){
  const soc=xpPercent(this.val('soc'));
  const range=this.value('range','km');
  return `<header class="x-header"><div>
   <div class="x-head-title">${xpEsc(this.name())}${this.vehicles().length>1?'<button data-next title="Switch vehicle" class="x-icon-button" aria-label="Switch vehicle">⌄</button>':''}</div>
   <div class="x-header-meta"><span class="x-meta-pair">${this.svg('battery',18)} <span class="x-strong">${soc===null?'—':xpNum(soc)+'%'}</span></span><span>${xpEsc(range)}</span></div>
   <div class="x-small">${xpEsc(this.year())} · ${xpEsc(xpAllowedTrims(this.model(),this.year()).find(t=>t.id===this.trim())?.label||this.trim())}</div>
   <div class="x-status">${xpEsc(this.badge())} · ${xpEsc(this.status('locked','Locked','Unlocked'))}</div>
  </div><div class="x-header-right"><button class="x-icon-button" type="button" data-expanded aria-label="${this._expanded?'Exit full screen':'Full screen'}">${this._expanded?'✕':'⛶'}</button></div></header>`;
 }
 home(){
  const charging=this.bool('charging');
  return `<section class="x-home" aria-label="XPENG vehicle dashboard"><div>
   <div class="x-car-stage"><img alt="XPENG ${xpEsc(this.model())} ${xpEsc(this.year())} ${xpEsc(this.paint().replace(/_/g,' '))}" src="${xpEsc(this.asset())}">
     ${charging===true?`<span class="x-charge-indicator">${this.svg('bolt',17)} Charging</span>`:''}
     <span class="x-drive-label">${xpEsc(this.value('speed','km/h'))==='—'?'Parked / status unavailable':this.value('speed','km/h')}</span>
   </div><div class="x-quick" aria-label="Vehicle quick actions">
     <button disabled type="button" aria-label="Lock unavailable until authorized vehicle API">${this.svg('lock',24)}</button>
     <button type="button" data-page="controls" aria-label="Controls">${this.svg('car',24)}</button>
     <button type="button" data-page="charging" aria-label="Charging">${this.svg('bolt',24)}</button>
     <button type="button" data-page="climate" aria-label="Climate">${this.svg('fan',24)}</button>
   </div></div><nav class="x-nav" aria-label="XPENG vehicle menus">
     ${this.menu('controls','Controls',this.status('locked','Locked','Unlocked'),'car')}
     ${this.menu('climate','Climate',this.status('climate','On','Off')+' · '+this.value('cabin','°C',1),'fan')}
     ${this.menu('location','Location',this.gpsAvailable()?'GPS available':'Unavailable','pin')}
     ${this.menu('charging','Charging',charging===null?'Unavailable':charging?'Charging':'Not charging','bolt')}
   </nav></section>`;
 }
 gpsAvailable(){
  const e=this.data('location')?.entity?.attributes;
  return e&&e.latitude!=null&&e.longitude!=null&&Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude));
 }
 topCar(){
  return `<svg class="x-top-svg" viewBox="0 0 410 360" role="img" aria-label="Illustrative top-down XPENG vehicle" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="xBody" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8e1e6"/><stop offset=".3" stop-color="#7e9aaf"/><stop offset=".63" stop-color="#41627b"/><stop offset="1" stop-color="#1e3347"/></linearGradient><linearGradient id="xRoof" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2a4154"/><stop offset="1" stop-color="#0f1b24"/></linearGradient></defs>
  <ellipse cx="208" cy="318" rx="101" ry="16" fill="#000" opacity=".37"/>
  <rect x="122" y="70" width="23" height="64" rx="7" fill="#101317"/><rect x="265" y="70" width="23" height="64" rx="7" fill="#101317"/>
  <rect x="122" y="231" width="23" height="63" rx="7" fill="#101317"/><rect x="265" y="231" width="23" height="63" rx="7" fill="#101317"/>
  <rect x="136" y="17" width="140" height="324" rx="49" fill="url(#xBody)" stroke="#9eafb8" stroke-width="2"/>
  <path d="M153 104 Q206 71 259 104 L257 257 Q206 281 155 257Z" fill="url(#xRoof)" stroke="#a2b0b9" stroke-width="3"/>
  <path d="M151 124L260 124M157 246L257 246M206 126V246" fill="none" stroke="#7594ac" stroke-width="2.6"/>
  <path d="M164 38H246" stroke="#f8fcff" stroke-width="6" stroke-linecap="round"/><path d="M170 320H240" stroke="#e46f79" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
 }
 pins(tires){
  const xs=tires?[['FL','tire_fl','x-fl'],['FR','tire_fr','x-fr'],['RL','tire_rl','x-rl'],['RR','tire_rr','x-rr']]:
    [['Front left','door_fl','x-fl'],['Front right','door_fr','x-fr'],['Rear left','door_rl','x-rl'],['Rear right','door_rr','x-rr']];
  return xs.map(([name,key,pos])=>`<div class="x-control-pin ${pos} ${!tires&&this.bool(key)===true?'active':''}"><span>${xpEsc(name)}</span><b>${xpEsc(tires?this.value(key,'kPa'):this.status(key,'Open','Closed'))}</b></div>`).join('');
 }
 controls(tires){
  return `<div class="x-control-car">${this.topCar()}${this.pins(tires)}</div>
    ${!tires?`<div class="x-submenu"><button type="button" data-page="tires" class="x-menu-link">${this.svg('tire',18)} <span>Tire pressure</span>${this.svg('arrow',17)}</button></div>
      <div class="x-facts"><div class="x-fact"><small>Vehicle locks</small><strong>${xpEsc(this.status('locked','Locked','Unlocked'))}</strong></div><div class="x-fact"><small>Trunk</small><strong>${xpEsc(this.status('trunk','Open','Closed'))}</strong></div><div class="x-fact"><small>Front hood</small><strong>${xpEsc(this.status('hood','Open','Closed'))}</strong></div><div class="x-fact"><small>Windows</small><strong>Unavailable</strong></div></div>`:''}
    <div class="x-disabled-tools">${[['Lock','lock'],['Open trunk','car'],['Flash lights','sun'],['Horn','gauge']].map(([s,i])=>`<button disabled aria-label="${s} unavailable">${this.svg(i,22)}<span>${s}</span></button>`).join('')}</div>
    <p class="x-notice">Controls remain disabled until XPENG authorizes and documents the relevant remote functions.</p>`;
 }
 climate(){
  const finish=XP_INTERIORS.find(i=>i.id===this.interior())?.label||this.interior();
  const comfort=['Steering wheel heating','Driver seat heating','Passenger seat heating','Rear seat heating','Driver seat ventilation','Passenger seat ventilation','Driver seat massage','Passenger seat massage'];
  return `<div class="x-climate-art">${xpCabinSvg(this.interior())}<div class="x-seat-bubbles" aria-hidden="true"><span>${this.svg('thermometer',16)}</span><span>${this.svg('thermometer',16)}</span><span>${this.svg('thermometer',16)}</span></div></div>
  <div class="x-temp-row">
    <div class="x-temp-figure"><small>Cabin temperature</small><strong>${xpEsc(this.value('cabin','°C',1))}</strong></div>
    <div class="x-stepper"><button disabled aria-label="Decrease temperature">−</button><span>— °C</span><button disabled aria-label="Increase temperature">+</button></div>
    <div class="x-temp-figure"><small>Outside</small><strong>${xpEsc(this.value('outside','°C',1))}</strong></div>
  </div>
  <div class="x-comfort-list">${comfort.map(s=>`<div><span>${s}</span><button disabled title="No authorized XPENG cloud command">Unavailable</button></div>`).join('')}</div>
  <div class="x-notice">Interior finish: ${xpEsc(finish)}. To change paint or upholstery, use Edit card in Home Assistant. Functions are display-only until vendor API verification.</div>`;
 }
 charging(){
  const soc=xpPercent(this.val('soc')),target=xpPercent(this.val('target'));
  return `<div class="x-charging-car"><img src="${xpEsc(this.asset())}" alt="XPENG ${xpEsc(this.model())} charging display"></div>
    <div class="x-charge-panel">
      <div class="x-line"><div class="x-line-title"><span>Battery level</span><strong>${soc===null?'—':xpNum(soc)+'%'}</strong></div><div class="x-progress"><span style="width:${soc??0}%"></span></div>
      <p class="x-notice">Range: ${xpEsc(this.value('range','km'))} · Charging power: ${xpEsc(this.value('power','kW',1))}</p></div>
      <div class="x-line"><div class="x-line-title"><span>Charge limit</span><strong>${xpEsc(this.value('target','%'))}</strong></div><input disabled type="range" min="0" max="100" value="${target??0}" aria-label="Charge limit unavailable"></div>
      <div class="x-line"><div class="x-line-title"><span>Charge current</span><strong>${xpEsc(this.value('current','A',1))}</strong></div><div class="x-stepper" style="justify-content:center;margin:10px auto"><button disabled>−</button><span>${xpEsc(this.value('current','A',1))}</span><button disabled>+</button></div></div>
    </div><p class="x-notice">Charging commands and charge-port operations require a verified, authorized XPENG API.</p>`;
 }
 location(){return `<div class="x-location">${this.svg('pin',35)}<strong>${this.gpsAvailable()?'Vehicle position available':'Vehicle location unavailable'}</strong><small>Real Home Assistant data only; no external map service or synthetic coordinates.</small></div>`;}
 info(){return `<div class="x-facts">${[['Model',this.model()],['Year',this.year()],['Variant',this.trim()],['Odometer',this.value('odometer','km')],['Connection',this.badge()],['Battery',this.value('soc','%')]].map(([k,v])=>`<div class="x-fact"><small>${xpEsc(k)}</small><strong>${xpEsc(v)}</strong></div>`).join('')}</div>`;}
 panel(){
  const pg=this._page,title={controls:'Controls',tires:'Tire pressure',climate:'Climate',comfort:'Climate & comfort',interior:'Interior',charging:'Charging',location:'Location',vehicle:'Vehicle'}[pg]||'Vehicle';
  const body=pg==='controls'||pg==='tires'?this.controls(pg==='tires'):
     pg==='climate'||pg==='comfort'||pg==='interior'?this.climate():
     pg==='charging'?this.charging():pg==='location'?this.location():this.info();
  return `<div class="x-panel-header"><button class="x-icon-button" data-back type="button" aria-label="Back to vehicle">${this.svg('back',24)}</button><h2>${title}</h2></div><section class="x-main-panel" data-view="${pg}">${body}</section>`;
 }
 render(){
  if(!this.shadowRoot)return;
  this.setAttribute('data-theme',this._cfg.theme==='light'?'light':'dark');
  this.toggleAttribute('data-expanded',this._expanded);
  const wide=this._cfg.layout==='wide'||this._cfg.dashboard_layout==='wide';
  this.shadowRoot.innerHTML=`<style>${XP_CSS}</style><ha-card><div class="vehicle-app ${wide?'wide':''}">${this._page==='home'?this.header()+this.home():this.panel()}<footer class="x-footer">XPENG Vehicle Card · ${xpEsc(this.badge())} · Remote commands disabled until verified</footer></div></ha-card>`;
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
  ${selector('layout',[{id:'standard',label:'Standard vehicle-card size'},{id:'wide',label:'Wide landscape layout'}])}
 <p>Year selection filters models. Interior finish changes the visual material theme of the whole cabin, not the real car. Changing model refreshes available trims; changing trim refreshes available paint colors. Factory trim and color catalogs may differ between markets; other models use illustrative studio artwork until audited model-year renders are available.</p>
 </section>`;}
}
if(!customElements.get('xpeng-vehicle-card'))customElements.define('xpeng-vehicle-card',XpengVehicleCard);
if(!customElements.get('xpeng-vehicle-card-editor'))customElements.define('xpeng-vehicle-card-editor',XpengVehicleCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='xpeng-vehicle-card'))window.customCards.push({type:'xpeng-vehicle-card',name:'XPENG Vehicle Card',description:'XPENG vehicle app style dashboard with G6 artwork, read-only live entity mapping'});
