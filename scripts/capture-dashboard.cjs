'use strict';
// Screenshots are captured from the real custom card (same source shipped by HACS).
// Sensor readings are EXAMPLE VALUES only; no personal account or car data is used.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const OUTPUT=path.join(ROOT,'docs','screenshots');
// Only genuine rendered card pages, paired across desktop and phone.
// Direct vehicle actions are tested, not presented as imaginary pages.
const GALLERY=Object.freeze({
 'vehicle-status':'home-desktop.png',
 'mobile-vehicle-status':'home-mobile.png',
 'charging':'charging-desktop.png',
 'mobile-charging':'charging-mobile.png',
 'climate-desktop':'climate-desktop.png',
 'climate-mobile':'climate-mobile.png',
 'maintenance-desktop':'maintenance-desktop.png',
 'maintenance-mobile':'maintenance-mobile.png',
 'location-desktop':'map-desktop.png',
 'location-mobile':'map-mobile.png',
 'charging-actions-mobile':'charge-controls-mobile.png',
 'diagnostics-mobile':'diagnostics-mobile.png'
});
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

/* Only the standalone screenshot harness needs a HA icon preview.
 * The shipped card uses HA's native <ha-icon>; here the OFFICIAL @mdi/js paths
 * reproduce those very same MDI symbols without inventing any icon shapes.
 */
const MDI_MODULE=process.env.MDI_JS_MODULE||
  path.join(path.dirname(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright')),'@mdi/js');
const officialMdi=require(MDI_MODULE);
const cardSource=fs.readFileSync(path.join(ROOT,'src','xpeng-vehicle-card.js'),'utf8');
const iconPaths={};
for(const icon of new Set([...cardSource.matchAll(/mdi:[a-z0-9-]+/g)].map(match=>match[0]))){
 const exportName='mdi'+icon.slice(4).split('-').map(part=>part[0].toUpperCase()+part.slice(1)).join('');
 assert.equal(typeof officialMdi[exportName],'string','Missing official Material Design icon: '+icon+' ('+exportName+')');
 iconPaths[icon]=officialMdi[exportName];
}
assert.ok(Object.keys(iconPaths).length>=25,'Expected all native dashboard icons');



const state=(value,attrs={})=>({state:String(value),attributes:attrs});
function demo(charging){
 return {states:{
  'sensor.my_xpeng_api_connection_status':state('connected'),
  'sensor.my_xpeng_soc':state('76'),
  'sensor.my_xpeng_range_km':state('420'),
  'sensor.my_xpeng_odometer_km':state('15284'),
  'device_tracker.my_xpeng_location':state('not_home'),
  'sensor.my_xpeng_charge_power_kw':state('79.2'),
  'sensor.my_xpeng_charge_remaining_min':state('32'),
  'sensor.my_xpeng_charge_target':state('90'),
  'sensor.my_xpeng_last_update':state('2026-10-14T12:00:00'),
  'binary_sensor.my_xpeng_is_charging':state(charging?'on':'off'),
  'binary_sensor.my_xpeng_is_plugged_in':state(charging?'on':'off'),
  'climate.my_xpeng_climate':state('heat_cool',{temperature:22,current_temperature:24,min_temp:16,max_temp:32,target_temp_step:0.5,hvac_modes:['off','heat_cool']}),
  'lock.my_xpeng_door_lock':state('locked'),
  'binary_sensor.my_xpeng_trunk':state('off'),
  'button.my_xpeng_open_trunk':state('unknown'),
  'button.my_xpeng_close_trunk':state('unknown'),
  'button.my_xpeng_honk_horn':state('unknown'),
  'button.my_xpeng_flash_lights':state('unknown'),
  'binary_sensor.my_xpeng_climate_auto':state('on'),
  'binary_sensor.my_xpeng_mirror_heating':state('off'),
  'button.my_xpeng_open_windows':state('unknown'),
  'button.my_xpeng_close_windows':state('unknown'),
  'button.my_xpeng_open_charge_port':state('unknown'),
  'button.my_xpeng_close_charge_port':state('unknown'),
  'button.my_xpeng_stop_charging':state('unknown'),
  'number.my_xpeng_charge_limit':state('90',{min:50,max:100,step:5}),
  // Preview explicitly includes verified Xpengtk comfort entities.
  // Fan maximum is read from HA attributes, not forced to 10.
  'number.my_xpeng_fan_speed':state('3',{min:1,max:8,step:1}),
  'select.my_xpeng_driver_seat_heating':state('Heat 2',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.my_xpeng_passenger_seat_heating':state('Heat 1',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.my_xpeng_driver_seat_ventilation':state('Off',{options:['Off','Ventilation 1','Ventilation 2','Ventilation 3']}),
  'select.my_xpeng_passenger_seat_ventilation':state('Off',{options:['Off','Ventilation 1','Ventilation 2','Ventilation 3']}),
  'select.my_xpeng_left_rear_seat_heating':state('Heat 2',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.my_xpeng_right_rear_seat_heating':state('Heat 1',{options:['Off','Heat 1','Heat 2','Heat 3']}),
  'select.my_xpeng_steering_wheel_heating':state('Low',{options:['Off','Low','Medium','High']}),
  'binary_sensor.my_xpeng_any_window_open':state('off'),
  'sensor.my_xpeng_slow_charge_port':state('Closed'),
  'sensor.my_xpeng_charge_port':state('Closed'),
  'sensor.my_xpeng_next_maintenance':state('20 days',{next_date:'2027-01-10',km_remaining:2450}),
  'sensor.my_xpeng_vehicle_identity':state('G6',{vin_masked:'L1N******123456',model_year:'2026'}),
  'sensor.my_xpeng_charge_schedule_start':state('23:00'),
  'sensor.my_xpeng_charge_schedule_end':state('06:30'),
  'sensor.my_xpeng_tire_pressure_front_left_kpa':state('250'),
  'sensor.my_xpeng_tire_pressure_front_right_kpa':state('251'),
  'sensor.my_xpeng_tire_pressure_rear_left_kpa':state('248'),
  'sensor.my_xpeng_tire_pressure_rear_right_kpa':state('250'),
 }};
}
async function main(){
 fs.mkdirSync(OUTPUT,{recursive:true});
 // Always purge stale QA captures before a new screenshot session.
 // This directory contains test output ONLY; never touch assets/vehicles or owner artwork.
 const oldCaptures=fs.readdirSync(OUTPUT).filter(file=>/\.(png|jpe?g|webp)$/i.test(file));
 for(const file of oldCaptures)fs.rmSync(path.join(OUTPUT,file));
 const leftovers=fs.readdirSync(OUTPUT).filter(file=>/\.(png|jpe?g|webp)$/i.test(file));
 assert.deepEqual(leftovers,[],'Stale screenshots must be removed before Chromium capture');
 console.log('Fresh XPENG visual QA: purged',oldCaptures.length,'old gallery image(s); preserving vehicle artwork.');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:860},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('requestfailed',request=>console.warn('Browser request failed',request.url(),request.failure()));
 page.on('console',msg=>{if(msg.type()==='error')console.warn('Browser console error',msg.text());});
 let imagesServed=0;
 // Never use remote 'main' images for this branch: serve the exact checked-out artwork.
 await page.route('https://raw.githubusercontent.com/matanmesika/xpeng-vehicle-card/main/assets/**',async route=>{
   const suffix=decodeURIComponent(route.request().url().split('/main/assets/')[1]||'');
   const local=path.resolve(ROOT,'assets',suffix);
   if(!local.startsWith(path.join(ROOT,'assets')+path.sep)||!fs.existsSync(local)){
      return route.fulfill({status:404,body:'Asset missing'});
   }
   imagesServed++;
   return route.fulfill({status:200,path:local,contentType:local.endsWith('.webp')?'image/webp':'image/png'});
 });
 await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
 <style>html,body{margin:0;padding:0;background:#06111f;color:white}
 body{font-family:Arial,sans-serif}
 .card-wrap{width:1400px;margin:18px auto}</style></head>
 <body><div class="card-wrap"><xpeng-vehicle-card></xpeng-vehicle-card></div></body></html>`);

 // HA itself registers ha-icon; the standalone browser does not. Only the
 // screenshot harness registers an equivalent test renderer using official paths.
 await page.evaluate(paths=>{
   if(window.customElements.get('ha-icon'))return;
   class PreviewHomeAssistantIcon extends HTMLElement{
     connectedCallback(){
       const glyph=paths[this.getAttribute('icon')];
       if(!glyph){this.setAttribute('data-mdi-missing','true');return;}
       const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
       svg.setAttribute('viewBox','0 0 24 24');
       svg.setAttribute('width','100%');svg.setAttribute('height','100%');
       svg.setAttribute('fill','currentColor');
       const p=document.createElementNS('http://www.w3.org/2000/svg','path');
       p.setAttribute('d',glyph);svg.append(p);
       this.attachShadow({mode:'open'}).append(svg);
     }
   }
   window.customElements.define('ha-icon',PreviewHomeAssistantIcon);
 },iconPaths);
 await page.addScriptTag({path:path.join(ROOT,'src','xpeng-vehicle-card.js')});
 const car=page.locator('xpeng-vehicle-card');
 const created=new Set();
 async function reviewShot(name){
   const filename=GALLERY[name];
   if(!filename)return; // all existing behaviour assertions still run
   assert.ok(!created.has(filename),'Duplicate current gallery screenshot: '+filename);
   created.add(filename);
   await car.screenshot({path:path.join(OUTPUT,filename),animations:'disabled'});
   console.log('Actual card screenshot:',filename);
 }
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
      trim:'core_performance_awd',color:'arctic_white',interior:'light_gray',show_controls:true,enable_access_controls:true});
 });
 async function screen(name){
  console.log('Checking browser screen:',name);
  const selector=name==='maintenance-desktop'?'[data-top-art]':'[data-car-art]';
  await page.waitForFunction(selector=>{
   const root=document.querySelector('xpeng-vehicle-card').shadowRoot;
   const img=root.querySelector(selector);
   return img&&img.complete&&img.naturalWidth>200;
  },selector,{timeout:12000});
  // Also ensure the exact body view is attached and actually rendered.
  const info=await car.evaluate((e,selector)=>{
    const root=e.shadowRoot,stage=root.querySelector('.xp-scene'),img=root.querySelector(selector);
    return {width:stage.getBoundingClientRect().width,height:stage.getBoundingClientRect().height,
      imageWidth:img.naturalWidth,imageSrc:img.src,kind:stage.className};
  },selector);
  assert.ok(info.width>=1300&&info.height>=700,JSON.stringify(info));
  assert.ok(info.imageWidth>200,JSON.stringify(info));

  const officialIcons=await car.evaluate(el=>{
    const icons=[...el.shadowRoot.querySelectorAll('ha-icon')];
    return {count:icons.length,missing:icons.filter(icon=>!icon.shadowRoot?.querySelector('svg path[d]'))
      .map(icon=>icon.getAttribute('icon'))};
  });
  assert.ok(officialIcons.count>0,'At least one native HA icon should appear on every scene');
  assert.deepEqual(officialIcons.missing,[],'All screenshot glyphs must use official MDI paths');
  console.log('Native MDI icons validated:',officialIcons.count,'scene:',name);

  await page.waitForTimeout(600);
  await reviewShot(name);
  console.log('Captured '+name,JSON.stringify(info));
 }
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 await screen('vehicle-status');
 // Curated gallery uses a single full-resolution PNG per view.
 // Desktop and mobile must contain exactly the same rendered actions and
 // vehicle-status rows with the same simulated HA payload.
 const contentSignature=async()=>car.evaluate(el=>{
   const root=el.shadowRoot;
   return {
     actions:[...root.querySelectorAll('.xp-ux-dock-action')].map(b=>b.dataset.xpToggle||b.dataset.xpOpen),
     infoRows:[...root.querySelectorAll('.xp-status-panel .xp-info-row')].map(r=>r.querySelector('.xp-info-copy small')?.textContent?.trim()),
     soc:root.querySelector('.xp-overview-stat .xp-soc')?.textContent.trim(),
     range:root.querySelector('.xp-overview-range .xp-range-num')?.textContent.trim()
   };
 });
 const desktopContent=await contentSignature();
 assert.deepEqual(desktopContent.actions,['climate','doors','windows','port','trunk','maintenance','map']);
 assert.deepEqual(desktopContent.infoRows,[]);
 assert.equal(await car.locator('.xp-status-panel').count(),0,'Home must have no right-hand Location panel');
 assert.equal(await car.locator('.xp-ux-dock-action[data-xp-open="maintenance"]').count(),1,'Only Home maintenance shortcut should remain');
 assert.equal(await car.locator('.xp-status-panel [data-xp-open="maintenance"]').count(),0,'Home maintenance card must be absent');
 console.log('Canonical desktop/phone content signature:',JSON.stringify(desktopContent));

 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(true));
 await screen('charging');
 // Compact owner-review JPEG: GitHub's binary API cannot preview large PNGs.
 // Keep the existing full-resolution PNG too.
 // Curated gallery uses a single full-resolution PNG per view.
 const chargingDesktop=await car.evaluate(el=>{
   const root=el.shadowRoot,find=q=>root.querySelector(q)?.getBoundingClientRect().toJSON();
   return {actions:[...root.querySelectorAll('.xp-ux-dock-seven .xp-ux-dock-action')].map(n=>n.dataset.xpToggle||n.dataset.xpOpen),
     buttons:[...root.querySelectorAll('.xp-charge-panel-actions button')].map(n=>({action:n.dataset.xpOpen||n.dataset.xpCommand,disabled:n.disabled})),
     image:find('.xp-charge .xp-car'),station:find('.xp-station'),dock:find('.xp-ux-dock-seven')};
 });
 assert.deepEqual(chargingDesktop.actions,desktopContent.actions,
   'Desktop charging scene must show all seven exact Home actions');
 assert.deepEqual(chargingDesktop.buttons.map(x=>x.action),['charge_controls','charge_schedule','stop_charge'],
   'Charging must retain the three scoped charge buttons');
 assert.ok(chargingDesktop.image.width<.45*1400,
   'Desktop vehicle image must be smaller than original charging layout');
 assert.ok(chargingDesktop.image.right<=chargingDesktop.station.left+5,
   'Desktop charging station must be exposed beside smaller car');
 assert.ok(chargingDesktop.image.bottom<chargingDesktop.dock.top+2,
   'Desktop car must not cover Home dock');
 console.log('Desktop charging: smaller car, station, 3 controls and identical Home dock',JSON.stringify(chargingDesktop));
 const rearArt=await car.locator('[data-car-art]').getAttribute('src');
 assert.match(rearArt,/\/g6\/2026\/graphite_gray\/charging\.webp/,'Charge view must use owner-supplied grey rear-three-quarter artwork');
 const overlays=await car.evaluate(el=>[...el.shadowRoot.querySelectorAll('svg[data-xp-cable]')].map(svg=>({
  mode:svg.dataset.xpCable,visible:getComputedStyle(svg).display!=='none',
  core:Number.parseFloat(getComputedStyle(svg.querySelector('.xp-charge-cable-core')).strokeWidth),
  halo:Number.parseFloat(getComputedStyle(svg.querySelector('.xp-charge-cable-halo')).strokeWidth)
 })));
 assert.equal(overlays.filter(x=>x.visible).length,1,'Only one responsive charging cable may be visible');
 assert.ok(overlays.every(x=>x.core<=3&&x.halo<=6),'Green cable must remain thin: '+JSON.stringify(overlays));
 console.log('Owner-grey rear charging image and thin grounded cable:',JSON.stringify({rearArt,overlays}));
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 await car.locator('button[data-xp-open="maintenance"]').first().click();
 assert.ok(await car.locator('.xp-ux-modal-maintenance').count(),'Maintenance modal was not opened');
 await screen('maintenance-desktop');
 await car.locator('button[data-xp-close]').click();
 // Exercise both HA-driven screens at phone widths and within a narrow
 // Home Assistant Sections column on a wide desktop viewport.
 async function responsiveShot(width,charging,name,viewportWidth=width){
   await page.setViewportSize({width:viewportWidth,height:900});
   await page.evaluate(w=>{
     const wrap=document.querySelector('.card-wrap');
     wrap.style.width=w+'px';wrap.style.margin='0 auto';wrap.style.maxWidth='100%';
   },width);
   // Charging true first dismisses any previously open tyre-detail view.
   if(!charging)await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(true));
   await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(charging));
   await page.waitForFunction(()=>{
     const root=document.querySelector('xpeng-vehicle-card').shadowRoot;
     const img=root.querySelector('[data-car-art]');
     return img && img.complete && img.naturalWidth>200;
   },null,{timeout:12000});
   const layout=await car.evaluate(element=>{
     const scene=element.shadowRoot.querySelector('.xp-scene');
     const panel=element.shadowRoot.querySelector('.xp-status-panel');
     return {sceneWidth:scene.getBoundingClientRect().width,
       sceneHeight:scene.getBoundingClientRect().height,
       panelColumns:panel?(getComputedStyle(panel).display==='grid'
         ?getComputedStyle(panel).gridTemplateColumns.trim().split(/\s+/).length:1):0,
       charging:scene.classList.contains('xp-charge'),
       horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2};
   });
   assert.ok(layout.sceneWidth<=width+2 && layout.sceneWidth>=width-2,JSON.stringify(layout));
   assert.ok(layout.sceneHeight>=700,JSON.stringify(layout));
   assert.equal(layout.charging,charging,JSON.stringify(layout));
   if(charging){
     const details=await car.evaluate(el=>{
       const r=el.shadowRoot,image=r.querySelector('[data-car-art]');
       const cables=[...r.querySelectorAll('svg[data-xp-cable]')];
       return {imageSrc:image?.getAttribute('src'),cables:cables.map(svg=>({
         mode:svg.dataset.xpCable,visible:getComputedStyle(svg).display!=='none',
         stroke:parseFloat(getComputedStyle(svg.querySelector('.xp-charge-cable-core')).strokeWidth)
       }))};
     });
     assert.match(details.imageSrc||'',/\/g6\/2026\/graphite_gray\/charging\.webp/,
       'All charging breakpoints must use owner-selected rear-grey image');
     assert.equal(details.cables.length,2,'Both cable layouts must be defined');
     assert.equal(details.cables.filter(c=>c.visible).length,1,'Exactly one charging cable should show');
     assert.ok(details.cables.every(c=>c.stroke<=3),'Green cable must be thin at all breakpoints');
     console.log('Verified breakpoint charging imagery and cable:',JSON.stringify(details));
     const geo=await car.evaluate(el=>{
       const root=el.shadowRoot,rect=q=>root.querySelector(q)?.getBoundingClientRect().toJSON();
       return {actions:[...root.querySelectorAll('.xp-ux-dock-action')].map(n=>n.dataset.xpToggle||n.dataset.xpOpen),
        controls:[...root.querySelectorAll('.xp-charge-panel-actions button')].map(n=>n.dataset.xpOpen||n.dataset.xpCommand),
        car:rect('.xp-charge .xp-car'),station:rect('.xp-station'),dock:rect('.xp-ux-dock-seven'),panel:rect('.xp-charge-card')};
     });
     assert.deepEqual(geo.actions,desktopContent.actions,'Charging loses Home actions on '+width+'px');
     assert.deepEqual(geo.controls,['charge_controls','charge_schedule','stop_charge'],'Charging loses a charge control on '+width+'px');
     assert.ok(geo.car.width<=width*.81&&geo.car.width>=width*.72,
       'Scaled charging car is too large/small: '+JSON.stringify(geo));
     assert.ok(geo.car.right<=geo.station.left+5,
       'Charging station hidden behind vehicle on '+width+'px: '+JSON.stringify(geo));
     assert.ok(geo.car.bottom<geo.dock.top+4&&geo.station.bottom<geo.dock.top+4,
       'Charging scene objects overlap navigation dock: '+JSON.stringify(geo));
     assert.ok(geo.panel.bottom<geo.car.bottom,
       'Charging telemetry must stay above the car and navigation: '+JSON.stringify(geo));
     console.log('Mobile charging geometry verified '+width+'px',JSON.stringify(geo));

   }
   if(!charging){
     const current=await contentSignature();
     assert.deepEqual(current,desktopContent,'Home contents differ on '+width+'px Sections/iPhone card');
     const geometry=await car.evaluate(el=>{
       const root=el.shadowRoot,stage=root.querySelector('.xp-scene');
       const d=stage.getBoundingClientRect();
       const dock=root.querySelector('.xp-ux-dock-seven');
       const boxes=[dock,...root.querySelectorAll('.xp-ux-dock-action')].map(x=>({
         className:x.className,rect:x.getBoundingClientRect().toJSON(),
         displayed:getComputedStyle(x).display!=='none'
       }));
       return {scene:d.toJSON(),boxes,
         noLocationPanel:!root.querySelector('.xp-status-panel,.xp-location-row')};
     });
     assert.equal(geometry.boxes.length,8,'seven direct/navigation actions plus dock container required');
     assert.equal(geometry.noLocationPanel,true,'Unwanted Location overlay on '+width+'px');
     assert.ok(geometry.boxes.every(b=>b.displayed&&b.rect.width>0&&b.rect.height>0&&
       b.rect.left>=geometry.scene.left-2&&b.rect.right<=geometry.scene.right+2&&
       b.rect.top>=geometry.scene.top-2&&b.rect.bottom<=geometry.scene.bottom+2),
       'Controls or vehicle status clipped on '+width+'px card: '+JSON.stringify(geometry));
     // The narrow card must shrink actual objects, not just set overflow/viewport rules.
     const sized=await car.evaluate(el=>{
       const root=el.shadowRoot,rect=selector=>root.querySelector(selector)?.getBoundingClientRect();
       return {car:rect('.xp-overview .xp-car')?.toJSON(),
         battery:rect('.xp-overview-stat')?.toJSON(),
         icon:rect('.xp-ux-dock-seven .xp-ux-dock-action ha-icon')?.toJSON(),
         actions:[...root.querySelectorAll('.xp-ux-dock-seven .xp-ux-dock-action')]
           .map(e=>e.getBoundingClientRect().toJSON())};
     });
     assert.ok(sized.car?.width<=width*.9&&sized.car.width>width*.6,
       'Mobile vehicle object was not proportionally sized: '+JSON.stringify(sized));
     assert.ok(sized.battery?.height<=171&&sized.battery.height>=80,
       'Mobile battery card was not compacted: '+JSON.stringify(sized));
     assert.ok(sized.icon?.width<=25&&sized.icon.width>=19,
       'Mobile dock icons did not scale with card: '+JSON.stringify(sized));
     assert.ok(sized.actions.length===7&&sized.actions.every(r=>r.height>=48),
       'Mobile dock has clipped/untappable actions: '+JSON.stringify(sized));
     assert.ok(sized.battery.bottom<=sized.car.top+3,
       'Scaled battery card and scaled vehicle overlap: '+JSON.stringify(sized));
     console.log('Verified independent mobile object sizing:',width,JSON.stringify({
       carWidth:sized.car.width,batteryHeight:sized.battery.height,iconWidth:sized.icon.width}));

   }
   if(!charging)assert.equal(layout.panelColumns,0,'Home location panel must not render: '+JSON.stringify(layout));
   if(viewportWidth===width)assert.equal(layout.horizontalOverflow,false,JSON.stringify(layout));
   await reviewShot(name);
   console.log('Responsive capture '+name,JSON.stringify(layout));
 }
 await responsiveShot(390,false,'mobile-vehicle-status');
 // Curated gallery uses a single full-resolution PNG per view.
 await responsiveShot(390,true,'mobile-charging');
 await responsiveShot(320,false,'small-mobile-vehicle-status');
 await responsiveShot(320,true,'small-mobile-charging');
 await responsiveShot(420,false,'sections-vehicle-status',1200);
 await responsiveShot(420,true,'sections-charging',1200);
 // Capture real component's additional home controls, using demo HA entities only.
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{
   const wrap=document.querySelector('.card-wrap');
   wrap.style.width='1400px';wrap.style.margin='18px auto';
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
     trim:'core_performance_awd',color:'arctic_white',interior:'light_gray',enable_access_controls:true});
 });
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 assert.equal(await car.locator('.xp-ux-dock-action').count(),7,'Seven home quick actions missing');
 const homeIconQuality=await car.evaluate(el=>{
   const root=el.shadowRoot;
   return [...root.querySelectorAll('.xp-ux-dock-action')].map(button=>{
     const icon=button.querySelector('ha-icon');
     const r=icon?.getBoundingClientRect(),b=button.getBoundingClientRect();
     return {mdi:icon?.getAttribute('icon'),width:r?.width,height:r?.height,
       within:!!r&&r.width>0&&r.height>0&&
         r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1};
   });
 });
 assert.ok(homeIconQuality.length===7&&homeIconQuality.every(i=>i.mdi?.startsWith('mdi:')&&i.within),
   'All seven actions must have genuine, centered native MDI icons: '+JSON.stringify(homeIconQuality));
 console.log('Desktop official MDI icons and bounding-box alignment verified:',JSON.stringify(homeIconQuality));

 // Beta 7: rendered Home Assistant header geometry and actual dock icon colors.
 const desktopHeaderPolish=await car.evaluate(el=>{
   const root=el.shadowRoot,gear=root.querySelector('.xp-header .xp-more-trigger'),
     wifi=root.querySelector('.xp-header .xp-wifi'),glyph=wifi?.querySelector('ha-icon'),
     gr=gear?.getBoundingClientRect(),wr=wifi?.getBoundingClientRect(),
     ir=glyph?.getBoundingClientRect();
   const icons=[...root.querySelectorAll('.xp-ux-dock-seven .xp-ux-dock-action ha-icon')]
     .map(icon=>getComputedStyle(icon).color);
   return {hasGear:!!gear,hasWifi:!!wifi,
     cssGap:parseFloat(getComputedStyle(root.querySelector('.xp-meta-tools')).gap),
     actualGap:gr&&wr?Math.abs(wr.left-gr.right):null,
     glyphOffset:ir&&wr?(ir.top+ir.height/2)-(wr.top+wr.height/2):null,
     colors:[...new Set(icons)],iconCount:icons.length,
     disabled:root.querySelectorAll('.xp-ux-dock-action[disabled]').length};
 });
 assert.equal(desktopHeaderPolish.hasGear,true,'Desktop gear must remain available');
 assert.equal(desktopHeaderPolish.hasWifi,true,'Desktop communication indicator must remain available');
 assert.equal(desktopHeaderPolish.cssGap,14,'Gear and Wi-Fi should have 14px desktop spacing');
 assert.ok(desktopHeaderPolish.actualGap>=13,'Rendered desktop header controls overlap: '+JSON.stringify(desktopHeaderPolish));
 assert.ok(Math.abs(desktopHeaderPolish.glyphOffset)<=.75,
   'Desktop Wi-Fi glyph must be geometrically centered in the button: '+JSON.stringify(desktopHeaderPolish));
 assert.deepEqual(desktopHeaderPolish.colors,['rgb(233, 244, 255)'],
   'Seven shortcut pictograms must share one neutral color');
 assert.equal(desktopHeaderPolish.iconCount,7);
 assert.equal(desktopHeaderPolish.disabled,0,'All mock actions remain enabled');
 console.log('PASS desktop cog/Wi-Fi spacing and uniform action icon palette:',JSON.stringify(desktopHeaderPolish));

 for(const action of ['maintenance','map'])assert.equal(await car.locator('.xp-ux-dock-action[data-xp-open="'+action+'"]').count(),1,action+' home dock action missing');
 assert.equal(await car.locator('.xp-ux-dock-action:not([disabled])').count(),7,'Mock owner has approved Access, so all seven actions must work');
 await reviewShot('controls-desktop');
 const readActions=async()=>car.locator('.xp-ux-dock-action').allTextContents();
 let quickLabels=(await readActions()).join(' ');
 assert.match(quickLabels,/פתח נעילה/);
 assert.match(quickLabels,/פתח חלונות/);
 assert.match(quickLabels,/פתח שקע/);
 assert.match(quickLabels,/פתח תא מטען/);
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card'),h=card.hass;
   const states={...h.states};
   states['lock.my_xpeng_door_lock']={...states['lock.my_xpeng_door_lock'],state:'unlocked'};
   states['binary_sensor.my_xpeng_any_window_open']={...states['binary_sensor.my_xpeng_any_window_open'],state:'on'};
   states['sensor.my_xpeng_slow_charge_port']={...states['sensor.my_xpeng_slow_charge_port'],state:'Open'};
   states['sensor.my_xpeng_charge_port']={...states['sensor.my_xpeng_charge_port'],state:'Open'};
   states['binary_sensor.my_xpeng_trunk']={...states['binary_sensor.my_xpeng_trunk'],state:'on'};
   card.hass={...h,states};
 });
 quickLabels=(await readActions()).join(' ');
 assert.match(quickLabels,/נעל/);
 assert.match(quickLabels,/סגור חלונות/);
 assert.match(quickLabels,/סגור שקע/);
 assert.match(quickLabels,/סגור תא מטען/);
 await reviewShot('home-close-actions-desktop');
 // Restore reference states; this mock does not issue any vehicle commands.
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));


 // The actual HOME location button must open its page on a wide desktop.
 // Native HA map helpers are stubbed here, because standalone Chromium lacks HA tiles.
 await page.evaluate(()=>{
   window.__xpengNativeMapRequest=null;
   window.loadCardHelpers=async()=>({
     createCardElement(config){
       window.__xpengNativeMapRequest=config;
       const el=document.createElement('hui-map-card');
       el.dataset.qaNativeMap='true';
       el.style.cssText='display:flex;width:100%;min-height:410px;align-items:center;justify-content:center;text-align:center;color:#d6e7f6;background:#0b253d;border:1px solid #3f698c;border-radius:14px;';
       el.textContent='מפה במצב בדיקה • אריחי מפה חיים זמינים רק ב־Home Assistant';
       return el;
     }
   });
 });
 assert.equal(await car.locator('.xp-ux-dock-action[data-xp-open="map"]').count(),1,'Desktop Location dock shortcut missing');
 await car.locator('.xp-ux-dock-action[data-xp-open="map"]').click();
 await car.locator('[data-xp-map-host] hui-map-card[data-qa-native-map="true"]').waitFor({state:'visible'});
 const desktopMap=await car.evaluate(element=>{
   const root=element.shadowRoot,host=root.querySelector('[data-xp-map-host]'),
     map=host.querySelector('hui-map-card[data-qa-native-map]'),
     r=host.getBoundingClientRect(),back=root.querySelector('[data-xp-close]'),
     b=back?.getBoundingClientRect();
   return {modal:!!root.querySelector('.xp-ux-modal-map'),
     mapHasHass:map?.hass===element.hass,
     horn:root.querySelectorAll('button[data-xp-map-action="honk_horn"]').length,
     flash:root.querySelectorAll('button[data-xp-map-action="flash_lights"]').length,
     back:root.querySelectorAll('button[data-xp-close]').length,
     backVisible:!!b&&b.width>0&&b.height>0,
     homeButtons:root.querySelectorAll('.xp-ux-dock-action').length,
     stageWidth:Math.round(r.width),stageHeight:Math.round(r.height),
     config:window.__xpengNativeMapRequest};
 });
 assert.equal(desktopMap.modal,true,'Desktop Location page missing');
 assert.equal(desktopMap.mapHasHass,true,'Native map is not bound to HA');
 assert.equal(desktopMap.horn,1,'Horn button missing in desktop map');
 assert.equal(desktopMap.flash,1,'Flash button missing in desktop map');
 assert.equal(desktopMap.back,1,'Desktop map should have exactly one Back');
 assert.equal(desktopMap.backVisible,true,'Desktop Back is not visible');
 assert.equal(desktopMap.homeButtons,0,'Home dock must hide in Location');
 assert.ok(desktopMap.stageWidth>900&&desktopMap.stageHeight>=350,JSON.stringify(desktopMap));
 assert.deepEqual(desktopMap.config,{
   type:'map',entities:[{entity:'device_tracker.my_xpeng_location'}],
   default_zoom:11,hours_to_show:0,theme_mode:'dark',aspect_ratio:'4:3'
 },'Native dark map must use the real vehicle tracker entity');
 await reviewShot('location-desktop');
 const mapStable=await car.evaluate(el=>{
   const map=el.shadowRoot.querySelector('[data-xp-map-host] hui-map-card');
   const h=el.hass;
   el._xpQaMapReference=map;
   el.hass={...h,states:{...h.states,'sensor.my_xpeng_soc':{state:'73',attributes:{}}}};
   return {sameElement:map===el.shadowRoot.querySelector('[data-xp-map-host] hui-map-card'),
     hasCurrentHass:map.hass===el.hass,mapStillVisible:map.isConnected};
 });
 assert.ok(mapStable.sameElement&&mapStable.hasCurrentHass&&mapStable.mapStillVisible,
   'Live HA updates must not tear down and recreate the native map: '+JSON.stringify(mapStable));
 console.log('Desktop real HA map instance survives sensor update:',JSON.stringify(mapStable));
 console.log('Desktop Location map + finder + Back:',JSON.stringify(desktopMap));
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('.xp-ux-modal-map').count(),0,'Desktop Back must close Location');
 assert.equal(await car.locator('.xp-ux-dock-action').count(),7,'Desktop Back must restore Home shortcuts');

 await car.locator('button[data-xp-open="climate"]').first().click();
 assert.ok(await car.locator('.xp-ux-modal-climate').count(),'Climate modal missing');
 assert.equal(await car.locator('.xp-ux-dock').count(),0,'Climate must have Back only, no home menu');
 assert.equal(await car.locator('[data-xp-close]').count(),1,'Climate must have one Back');
 const expectedZones=['wheel','driver','passenger','rear_left','rear_right'];
 for(const z of expectedZones){
   assert.equal(await car.locator('.xp-ux-hotspot-zone[data-xp-zone="'+z+'"]').count(),1,'HVAC hotspot missing: '+z);
 }
 assert.equal(await car.locator('.xp-ux-hotspot-zone button[data-xp-cycle="left_rear_seat_heat_select"]').count(),1,'Missing rear left heater on cabin photo');
  assert.equal(await car.locator('.xp-seat-summary-action').count(),0,'No seat actions allowed outside cabin hotspots');
 assert.equal(await car.locator('[role="status"][aria-label="מצב AUTO: פעיל"]').count(),1,'Real AUTO feedback missing');
 assert.equal(await car.locator('[data-xp-hvac-mode="auto"]').count(),0,'Do not invent executable AUTO');
 assert.equal(await car.locator('[data-xp-swing-mode]').count(),0,'Do not invent remote airflow');
 assert.equal(await car.locator('.xp-ux-hotspot-zone button[data-xp-cycle="right_rear_seat_heat_select"]').count(),1,'Missing rear right heater on cabin photo');
  assert.equal(await car.locator('button[data-xp-cycle="right_rear_seat_heat_select"]').count(),1,'Only one seat-heater control on photo');
 const fan=await car.locator('[data-xp-range="fan_speed_control"]').first().evaluate(el=>({
   min:el.min,max:el.max,value:el.value,step:el.step
 }));
 assert.deepEqual(fan,{min:'1',max:'8',value:'3',step:'1'},'Use actual integration fan-range, not an invented 10-speed slider');
 console.log('HVAC validation: rear-left and rear-right heat visible; HA-provided fan-speed range',JSON.stringify(fan));
 await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752;});
 // Every seat and steering hotspot must fit inside the desktop modal.
 const climateGeometry=await car.evaluate(el=>{
   const root=el.shadowRoot;
   const modal=root.querySelector('.xp-ux-modal-climate').getBoundingClientRect();
   const photo=root.querySelector('.xp-ux-modal-climate .xp-ux-cabin-art').getBoundingClientRect();
   const zones=[...root.querySelectorAll('.xp-ux-modal-climate .xp-ux-hotspot-zone')].map(node=>({
     zone:node.dataset.xpZone,rect:node.getBoundingClientRect().toJSON()
   }));
   return {modal:modal.toJSON(),photo:photo.toJSON(),zones};
 });
 assert.ok(climateGeometry.photo.bottom<=climateGeometry.modal.bottom+3,
   'Cabin photo is clipped on desktop: '+JSON.stringify(climateGeometry));
 assert.ok(climateGeometry.zones.every(z=>z.rect.top>=climateGeometry.modal.top-3&&
   z.rect.bottom<=climateGeometry.modal.bottom+3&&z.rect.left>=climateGeometry.modal.left-3&&
   z.rect.right<=climateGeometry.modal.right+3),
   'At least one heating/ventilation button is clipped: '+JSON.stringify(climateGeometry));
 console.log('All physical seat and wheel buttons fit:',JSON.stringify(climateGeometry.zones.map(z=>z.zone)));
 await reviewShot('climate-desktop');
 // Same user's actual cabin photo, dark finish configured in card editor.
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
     trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',enable_access_controls:true});
 });
 await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752&&img.src.includes('interior_dark_gray.webp');});
 await reviewShot('climate-dark-desktop');
 await car.locator('button[data-xp-close]').click();
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
     trim:'core_performance_awd',color:'arctic_white',interior:'light_gray',enable_access_controls:true});
 });
 await page.setViewportSize({width:390,height:900});
 await page.evaluate(()=>{const w=document.querySelector('.card-wrap');w.style.width='390px';w.style.margin='0 auto';});
 await reviewShot('controls-mobile');
 // Diagnose all entities associated with this card without invoking car commands.
 await car.locator('button[data-xp-more]').click();
 await car.locator('button[data-xp-extra-page="maintenance"]').click();
 assert.equal(await car.locator('.xp-ux-modal-maintenance').count(),1,
   'Gear -> Maintenance must use the dedicated tire/vehicle modal, not nested Extras');
 const maintenanceFromGear=await car.evaluate(el=>{
   const root=el.shadowRoot;
   return {tires:root.querySelectorAll('.xp-ux-modal-maintenance .xp-tire-reading').length,
     source:root.querySelector('.xp-ux-modal-maintenance .xp-maint-info')?.innerText||''};
 });
 assert.equal(maintenanceFromGear.tires,4);
 assert.match(maintenanceFromGear.source,/שנת דגם \(מהאינטגרציה\)/,
   'Verified Xpengtk identity year must be explicitly distinguished from editor default');
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('.xp-ux-modal-extras').count(),1,'Maintenance Back must return to Gear options');
 await car.locator('button[data-xp-extra-page="diagnostics"]').click();
 assert.ok(await car.locator('.xp-ux-modal-extras').count(),'Diagnostics extra page missing');
 const summary=await car.locator('.xp-entity-diagnostic').count();
 assert.ok(summary>=30,'Expected mocked integration entities in diagnostics: '+summary);
 const diagScroll=await car.evaluate(el=>{
   const root=el.shadowRoot,modal=root.querySelector('.xp-ux-modal-extras'),
     list=root.querySelector('.xp-diagnostics-scroll'),h=el.hass;
   const innerOverflow=getComputedStyle(list).overflowY;
   list.scrollTop=200;
   const start=list.scrollTop;
   el.hass={...h,states:{...h.states,'sensor.my_xpeng_soc':{state:'72',attributes:{}}}};
   const restored=root.querySelector('.xp-ux-modal-extras');
   return {innerOverflow,start,end:restored?.querySelector('.xp-diagnostics-scroll')?.scrollTop,
     exists:!!restored,modalOverflow:getComputedStyle(restored).overflowY};
 });
 assert.equal(diagScroll.innerOverflow,'auto','Only the compact diagnostic list may scroll');
 assert.equal(diagScroll.modalOverflow,'hidden','Dashboard modal must not scroll during diagnostics');
 assert.ok(diagScroll.start>=80&&Math.abs(diagScroll.end-diagScroll.start)<=2,
   'Live HA updates must preserve phone diagnostics scroll: '+JSON.stringify(diagScroll));
 await car.locator('.xp-diagnostics-scroll').evaluate(e=>{e.scrollTop=0});
 await reviewShot('diagnostics-mobile');
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('button[data-xp-extra-page="diagnostics"]').count(),1,
   'Diagnostics Back must return to Extras, not Home');
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('.xp-ux-dock-action').count(),7,
   'Second Back should return to Home navigation');

 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card'),h=card.hass;
   const states={...h.states};
   states['lock.my_xpeng_door_lock']={...states['lock.my_xpeng_door_lock'],state:'unlocked'};
   states['binary_sensor.my_xpeng_any_window_open']={...states['binary_sensor.my_xpeng_any_window_open'],state:'on'};
   states['sensor.my_xpeng_slow_charge_port']={...states['sensor.my_xpeng_slow_charge_port'],state:'Open'};
   states['sensor.my_xpeng_charge_port']={...states['sensor.my_xpeng_charge_port'],state:'Open'};
   states['binary_sensor.my_xpeng_trunk']={...states['binary_sensor.my_xpeng_trunk'],state:'on'};
   card.hass={...h,states};
 });
 assert.match((await readActions()).join(' '),/סגור חלונות/);
 await reviewShot('home-close-actions-mobile');
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 // The first-tap actions use real states; demo contains no backend car connection.
 for(const [action,name] of [['doors','doors-mobile'],['windows','windows-mobile'],['port','charge-port-mobile'],['trunk','trunk-mobile']]){
   await page.evaluate(action=>{const card=document.querySelector('xpeng-vehicle-card');card._xpPanel=action;card.render();},action);
   assert.ok(await car.locator('.xp-ux-modal-'+action).count(),action+' details modal missing');
   await reviewShot(name);
   await car.locator('button[data-xp-close]').click();
 }
 for(const [action,name] of [['climate','climate-mobile'],['maintenance','maintenance-mobile'],['map','location-mobile']]){
   await car.locator('button[data-xp-open="'+action+'"]').first().click();
   assert.ok(await car.locator('.xp-ux-modal-'+action).count(),action+' modal missing');
   const arrow=await car.locator('.xp-ux-modal-'+action+' button[data-xp-close]').evaluate(button=>{
     const icon=button.querySelector('ha-icon');
     return {aria:button.getAttribute('aria-label'),icon:icon?.getAttribute('icon'),
       text:button.textContent.trim(),size:button.getBoundingClientRect().width};
   });
   assert.equal(arrow.icon,'mdi:arrow-right','Hebrew Back arrow must be the official RTL MDI');
   assert.equal(arrow.text,'','Back arrow button must not show any visible text');
   assert.ok(arrow.aria?.includes('חזרה')&&arrow.size>=43,
     'Icon-only Back must remain accessible and touch-sized: '+JSON.stringify(arrow));
   if(action==='map'){
     assert.equal(await car.locator('button[data-xp-map-action="honk_horn"]').count(),1);
     assert.equal(await car.locator('button[data-xp-map-action="flash_lights"]').count(),1);
   }
   if(action==='climate')await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752;});
   if(action==='climate'){
     const c=await car.evaluate(el=>{
       const root=el.shadowRoot,photo=root.querySelector('.xp-ux-modal-climate .xp-ux-cabin-art').getBoundingClientRect();
       const controls=[...root.querySelectorAll('.xp-ux-modal-climate .xp-ux-hotspot-zone button')]
         .map(node=>node.getBoundingClientRect().toJSON());
       return {photo:photo.toJSON(),controls};
     });
     assert.ok(c.photo.width>=235&&c.photo.width<=280,'Mobile cabin photo not appropriately shrunk: '+JSON.stringify(c));
     assert.ok(c.controls.length>=5&&c.controls.every(x=>x.width>=35&&x.width<=42),
       'Heating/ventilation controls must scale along with seat photo: '+JSON.stringify(c));
     console.log('Verified scaled cabin photo with seat/steering hotspots:',JSON.stringify({photoWidth:c.photo.width,buttons:c.controls.length}));
     const passenger=await car.evaluate(el=>{
       const root=el.shadowRoot,group=root.querySelector('.xp-ux-modal-climate .xp-ux-passenger');
       const heat=group?.querySelector('button[data-xp-cycle="passenger_seat_heat_select"]')?.getBoundingClientRect();
       const vent=group?.querySelector('button[data-xp-cycle="passenger_seat_ventilation_select"]')?.getBoundingClientRect();
       return {heat:heat?.toJSON(),vent:vent?.toJSON()};
     });
     assert.ok(passenger.heat&&passenger.vent&&
       (passenger.heat.right<=passenger.vent.left+1||passenger.vent.right<=passenger.heat.left+1),
       'Passenger heat/vent controls must NOT overlap on the resized cabin photo: '+JSON.stringify(passenger));
   }
   if(action==='maintenance'){
     const tyre=await car.evaluate(el=>{
       const root=el.shadowRoot,stage=root.querySelector('.xp-ux-modal-maintenance .xp-tire-stage').getBoundingClientRect();
       return {height:stage.height,width:stage.width};
     });
     assert.ok(tyre.height>=250&&tyre.height<=320,'Mobile tire-stage objects not scaled: '+JSON.stringify(tyre));
   }

   if(action==='climate'||action==='maintenance'){
     const scroll=await car.locator('.xp-ux-modal-'+action).evaluate((el,action)=>{
       const start=el.scrollTop,clientHeight=el.clientHeight,scrollHeight=el.scrollHeight;
       el.scrollTop=el.scrollHeight;
       const target=action==='climate'
         ?el.querySelector('.xp-ux-climate-feature:last-child')
         :el.querySelector('.xp-maint-info .xp-extra-line:last-child');
       const area=el.getBoundingClientRect(),end=target?.getBoundingClientRect();
       return {start,position:el.scrollTop,clientHeight,scrollHeight,
         visible:!!end&&end.top<area.bottom&&end.bottom>area.top};
     },action);
     assert.ok(scroll.scrollHeight>scroll.clientHeight+30,
       action+' content must overflow vertically: '+JSON.stringify(scroll));
     assert.ok(scroll.position>scroll.start+30,
       action+' cannot scroll down on phone: '+JSON.stringify(scroll));
     assert.equal(scroll.visible,true,action+' last control not visible after scrolling');
     await reviewShot(action+'-scrolled-mobile');
     await car.locator('.xp-ux-modal-'+action).evaluate(el=>{el.scrollTop=0});
   }

   const modalTitle=await car.locator('.xp-ux-modal-head').innerText();
   assert.ok(!/(^|\\s)G6(\\s|$)/.test(modalTitle),
     'No subpage repeats model G6 in title: '+modalTitle);
   await reviewShot(name);
   if(action==='climate'){
     // Real phone clicks: Climate -> HVAC schedules -> contextual Back -> Climate
     await page.evaluate(()=>{
       const card=document.querySelector('xpeng-vehicle-card'),h=card.hass;
       card.hass={...h,states:{...h.states,
         'sensor.my_xpeng_hvac_schedules':{state:'1',attributes:{schedules:[]}}}};
     });
     assert.equal(await car.locator('button[data-xp-extra-page="schedule"]').count(),1,
       'Live HA schedule entity must add nested climate schedule action');
     const scheduleButton=car.locator('button[data-xp-extra-page="schedule"]');
     await scheduleButton.scrollIntoViewIfNeeded();
     const scrollBefore=await car.locator('.xp-ux-modal-climate').evaluate(el=>el.scrollTop);
     await scheduleButton.click();
     assert.equal(await car.locator('.xp-ux-modal-extras').count(),1,'Nested schedule page missing');
     assert.match(await car.locator('.xp-ux-modal-head button').getAttribute('aria-label'),/חלון הקודם/);
     await car.locator('button[data-xp-close]').click();
     assert.equal(await car.locator('.xp-ux-modal-climate').count(),1,
       'Back from schedule must return to Climate, not to Home');
     const scrollAfter=await car.locator('.xp-ux-modal-climate').evaluate(el=>el.scrollTop);
     assert.ok(Math.abs(scrollAfter-scrollBefore)<=2,
       'Return to Climate must restore scroll position: '+scrollBefore+' -> '+scrollAfter);
     console.log('PASS contextual Back: Climate -> HVAC schedules -> Climate');
   }
   await car.locator('button[data-xp-close]').click();
 }
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
     trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',enable_access_controls:true});
   card._xpPanel='climate';card.render();
 });
 await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752&&img.src.includes('interior_dark_gray.webp');},{timeout:12000});
 await reviewShot('climate-dark-mobile');
 await car.locator('button[data-xp-close]').click();
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(true));
 assert.deepEqual(await car.locator('.xp-ux-dock-action').evaluateAll(all=>all.map(n=>n.dataset.xpToggle||n.dataset.xpOpen)),
   desktopContent.actions,'Charging must display all seven live Home shortcuts');
 assert.equal(await car.locator('button[data-xp-home]').count(),0,'Automatic charging must not have a redundant Back-to-Home button');
 assert.equal(await car.locator('button[data-xp-open="charge_controls"]').count(),1,'Charge limit control missing');
 assert.equal(await car.locator('button[data-xp-open="charge_schedule"]').count(),1,'Charge schedules shortcut missing');
 assert.equal(await car.locator('button[data-xp-command="stop_charge"]').count(),1,'Stop Charge must remain visible');
 await reviewShot('charging-reference-mobile');
 const chargeVehicleBefore=await car.locator('.xp-charge .xp-car').boundingBox();
 const chargeStationBefore=await car.locator('.xp-station').boundingBox();
 await car.locator('button[data-xp-open="charge_controls"]').click();
 assert.ok(await car.locator('.xp-charge-compact-modal.xp-ux-modal-charge_controls').count(),'Compact charge limit overlay missing');
 const chargeVehicleInside=await car.locator('.xp-charge .xp-car').boundingBox();
 const chargeStationInside=await car.locator('.xp-station').boundingBox();
 assert.ok(chargeVehicleBefore&&chargeVehicleInside&&chargeStationBefore&&chargeStationInside,
   'Charging scene geometry missing while opening controls');
 for(const [a,b,label] of [[chargeVehicleBefore,chargeVehicleInside,'car'],[chargeStationBefore,chargeStationInside,'station']]){
   for(const k of ['x','y','width','height'])
     assert.ok(Math.abs(a[k]-b[k])<=1,'Opening small charge overlay must not shift '+label+' '+k);
 }
 assert.equal(await car.locator('.xp-ux-modal-charge_controls input[data-xp-range="charge_limit_control"]').count(),1,
   'Charge limit should operate the real HA number entity');
 assert.equal(await car.locator('.xp-ux-modal-charge_controls button[data-xp-command="stop_charge"]').count(),0,
   'Charge limit popup must not duplicate stop command');
 await reviewShot('charging-actions-mobile');
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('.xp-ux-dock-action').count(),7,'Closing charge limit must restore vehicle shortcuts');
 await car.locator('button[data-xp-open="charge_schedule"]').click();
 assert.ok(await car.locator('.xp-charge-compact-modal.xp-ux-modal-charge_schedule').count(),'Compact schedule overlay missing');
 assert.match(await car.locator('.xp-ux-modal-charge_schedule').innerText(),/קריאה בלבד/,'Never fake executable charge schedule');
 await reviewShot('charge-schedule-mobile');
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('.xp-charge').count(),1,'Closing charge overlay must stay in automatic Charging');
 assert.equal(await car.locator('.xp-ux-dock-action').count(),7,'Dock must return with all seven actions');
 assert.equal(await car.locator('button[data-xp-open="charging"]').count(),0,'Never add manual Charging shortcut');
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 assert.equal(await car.locator('.xp-charge').count(),0,'Stopped charge must return to regular Home automatically');
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(true));
 assert.equal(await car.locator('.xp-charge').count(),1,'New charge session must enter Charging automatically');
 const greenDebug=await car.evaluate(e=>({active:e.xpChargingActive(),view:e._view,dismissed:e._xpChargingDismissed,last:e._xpLastActualCharging,charging:e.val('charging'),plugged:e.val('plugged'),svg:!!e.shadowRoot.querySelector('svg.xp-charge-cable-live')}));
 console.log('Live cable after charge transition:',JSON.stringify(greenDebug));
 assert.equal(await car.locator('.xp-charge-cable-live').count(),2,'Both breakpoint-specific charging overlays are present: '+JSON.stringify(greenDebug));
 const liveCable=await car.evaluate(el=>{
  const svgs=[...el.shadowRoot.querySelectorAll('svg[data-xp-cable]')];
  return svgs.map(svg=>({mode:svg.dataset.xpCable,visible:getComputedStyle(svg).display!=='none',paths:svg.querySelectorAll('path').length}));
 });
 assert.equal(liveCable.filter(x=>x.visible).length,1,'Only the correct desktop/phone cable may be visible');
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 assert.equal(await car.locator('.xp-charge-cable-live').count(),0,'Idle state removes green cable');

 // Stress test a real-sized mobile container with repeated Xpengtk state ticks.
 // Verify DOM identity and scroll position, not just a static screenshot.
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{
   const wrap=document.querySelector('.card-wrap');
   wrap.style.width='390px';wrap.style.margin='0 auto';
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
      interior:'dark_gray',color:'graphite_gray',enable_access_controls:true});
 });
 await page.evaluate(data=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.hass={...data,callService:async(...args)=>{
     window.__xpCallLog??=[];
     window.__xpCallLog.push(args);
   }};
 },demo(false));
 await car.locator('button[data-xp-open="climate"]').click();
 const tickResult=await car.evaluate(el=>{
   const modal=el.shadowRoot.querySelector('.xp-ux-modal-climate');
   modal.scrollTop=0;
   const initial=modal.scrollTop;
   const initialParent=document.scrollingElement.scrollTop;
   window.__xpModalRef=modal;
   for(let i=0;i<100;i++){
     const h=el.hass,states={...h.states};
     states['sensor.my_xpeng_soc']={...states['sensor.my_xpeng_soc'],state:String(71+(i%8))};
     states['sensor.my_xpeng_range_km']={...states['sensor.my_xpeng_range_km'],state:String(393+i)};
     el.hass={...h,states};
   }
   const after=el.shadowRoot.querySelector('.xp-ux-modal-climate');
   return {sameNode:modal===after,initial,after:after.scrollTop,
      parentDelta:document.scrollingElement.scrollTop-initialParent,
      overflow:getComputedStyle(after).overflowY,touchAction:getComputedStyle(after).touchAction};
 });
 assert.equal(tickResult.sameNode,true,'Live telemetry must not replace scrolling DOM on iPhone: '+JSON.stringify(tickResult));
 assert.equal(tickResult.initial,0,'The revised fixed-height modal should start at its top');
 assert.equal(tickResult.after,0,'Sensor changes may not scroll the dashboard overlay');
 assert.equal(tickResult.overflow,'hidden','Dashboard modal must never become a second scroll container');
 assert.equal(tickResult.touchAction,'manipulation','Only diagnostics list should own vertical touch scrolling');
 assert.ok(Math.abs(tickResult.parentDelta)<=2,'Outer HA page jumps while scrolling modal');
 await car.locator('button[data-xp-close]').click();
 const lockStress=await car.evaluate(el=>{
   const button=el.shadowRoot.querySelector('button[data-xp-toggle="doors"]');
   const first=el.hass;
   el.xpToggle('doors');
   const pending=el._xpTogglePending.doors;
   for(let i=0;i<60;i++){
     const states={...el.hass.states};
     states['lock.my_xpeng_door_lock']={...states['lock.my_xpeng_door_lock'],state:i%2?'locked':'unlocked'};
     el.hass={...el.hass,states};
     el.xpToggle('doors'); // simulates rapid repeated taps before command acknowledgement
   }
   const updated=el.shadowRoot.querySelector('button[data-xp-toggle="doors"]');
   return {sameButton:updated===button,clickCount:window.__xpCallLog?.length||0,
     busy:updated.getAttribute('aria-busy'),disabled:updated.disabled,
     originalTarget:pending?.target?.service,lastTarget:el._xpTogglePending.doors?.target?.service};
 });
 assert.equal(lockStress.sameButton,true,'The pressed lock control cannot be rebuilt mid-tap: '+JSON.stringify(lockStress));
 assert.equal(lockStress.clickCount,1,'Repeated lock commands under jitter: '+JSON.stringify(lockStress));
 assert.equal(lockStress.busy,'true','In-flight command needs stable feedback');
 assert.equal(lockStress.disabled,true,'Disable duplicate tap while command waits for state confirmation');
 assert.equal(lockStress.originalTarget,lockStress.lastTarget,'Lock label/action changed before acknowledgement');
 await car.locator('button[data-xp-open="map"]').click();
 await car.locator('[data-xp-map-host] hui-map-card').waitFor({state:'visible'});
 const mobileMapStable=await car.evaluate(el=>{
   const before=el.shadowRoot.querySelector('[data-xp-map-host] hui-map-card');
   const h=el.hass;
   for(let i=0;i<50;i++)el.hass={...h,states:{...h.states,
     'device_tracker.my_xpeng_location':{state:'not_home',attributes:{latitude:31.95+i/10000,longitude:34.80}}}};
   const after=el.shadowRoot.querySelector('[data-xp-map-host] hui-map-card');
   return {same:before===after,connected:after?.isConnected,
     details:!!el.shadowRoot.querySelector('button[data-xp-map-details]')};
 });
 assert.ok(mobileMapStable.same&&mobileMapStable.connected&&mobileMapStable.details,
    'Mobile map must survive tracker updates and expose native HA details: '+JSON.stringify(mobileMapStable));
 await car.locator('button[data-xp-close]').click();
 console.log('PASS iPhone telemetry stress / scroll / lock / map: ',
    JSON.stringify({tickResult,lockStress,mobileMapStable}));


 // Beta 8: real Chromium verifies English text, LTR actions and Hebrew fallback.
 // No screenshots are replaced; owner reference imagery remains unchanged.
 const localeBrowserQA=await car.evaluate(el=>{
   const h=el.hass;
   el.hass={...h,locale:{...(h.locale||{}),language:'en'}};
   const pages=[null,'climate','maintenance','windows','doors','trunk','map','port','extras','charge_controls','charge_schedule'];
   const untranslated=[];
   for(const page of pages){
     el._xpPanel=page;el.render();
     // The standalone test's fake hui-map-card contains its own Hebrew stub text;
     // only translate/assert the XPENG card's own UI, never Home Assistant-owned map content.
     const nativeStub=el.shadowRoot.querySelector('[data-xp-map-host] hui-map-card[data-qa-native-map]');
     const html=nativeStub?el.shadowRoot.innerHTML.replace(nativeStub.outerHTML,''):el.shadowRoot.innerHTML;
     const matches=[...new Set((html.match(/[\u0590-\u05ff][\u0590-\u05ff\s.,•·־״׳()]+/g)||[]).map(x=>x.trim()))];
     if(matches.length)untranslated.push({page:page||'Home',matches:matches.slice(0,12)});
   }
   el._xpPanel='maintenance';el.render();
   const englishBack=el.shadowRoot.querySelector('[data-xp-close] ha-icon')?.getAttribute('icon');
   el._xpPanel=null;el.render();
   const englishDock=el.shadowRoot.querySelector('.xp-ux-dock-seven')?.getAttribute('dir');
   const helpers=el.xpWarmMapHelpers();
   const reused=helpers===el.xpWarmMapHelpers();
   el.hass={...h,locale:{...(h.locale||{}),language:'he'}};
   el._xpPanel='maintenance';el.render();
   const hebrewBack=el.shadowRoot.querySelector('[data-xp-close] ha-icon')?.getAttribute('icon');
   el._xpPanel=null;el.render();
   return {untranslated,englishBack,englishDock,hebrewBack,reused};
 });
 assert.deepEqual(localeBrowserQA.untranslated,[],'English panels leave Hebrew text in browser: '+JSON.stringify(localeBrowserQA));
 assert.equal(localeBrowserQA.englishBack,'mdi:arrow-left','English mode needs standard LTR Back arrow');
 assert.equal(localeBrowserQA.englishDock,'ltr','English shortcut labels should be LTR');
 assert.equal(localeBrowserQA.hebrewBack,'mdi:arrow-right','Hebrew RTL arrow must be preserved');
 assert.equal(localeBrowserQA.reused,true,'Native map helper preload must use same shared promise');
 console.log('PASS bilingual Home Assistant locale and native map warm-up:',JSON.stringify(localeBrowserQA));

 // Audit every functional overlay at desktop, phone and HA Sections widths.
 // The only scrolling region permitted is the dedicated diagnostic entity box.
 const responsiveModalQA=[];
 for(const [width,viewportHeight] of [[1440,900],[420,900],[390,844],[320,740]]){
   await page.setViewportSize({width,height:viewportHeight});
   await page.evaluate(w=>{
      const wrap=document.querySelector('.card-wrap');
      wrap.style.width=(w>900?1400:w)+'px';
      wrap.style.margin='0 auto';wrap.style.maxWidth='100%';
   },width);
   await page.evaluate(data=>{const c=document.querySelector('xpeng-vehicle-card');
      c.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
       interior:'dark_gray',color:'graphite_gray',enable_access_controls:true});
      c.hass=data;
   },demo(false));
   const byPage=await car.evaluate(el=>{
     const widths=[];
     const scene=el.shadowRoot.querySelector('.xp-scene');
     const sceneBox=scene.getBoundingClientRect();
     const wifi=el.shadowRoot.querySelector('.xp-header .xp-wifi'),
       glyph=wifi?.querySelector('ha-icon');
     const wr=wifi.getBoundingClientRect(),gr=glyph.getBoundingClientRect();
     const wifiOffset={x:(gr.left+gr.width/2)-(wr.left+wr.width/2),
       y:(gr.top+gr.height/2)-(wr.top+wr.height/2)};
     const pages=['map','climate','maintenance','port','doors','windows','trunk',
       'charge_controls','charge_schedule','extras'];
     for(const panel of pages){
       el._xpPanel=panel;el._xpExtraSection=null;el.render();
       const m=el.shadowRoot.querySelector('.xp-ux-modal');
       const b=m.getBoundingClientRect(),h=m.querySelector('.xp-ux-modal-head');
       const content=m.querySelector('.xp-ux-modal-content'),area=content?.getBoundingClientRect();
       widths.push({panel,visible:b.height>0&&b.bottom<=sceneBox.bottom+1&&b.top>=sceneBox.top-1,
         overflows:getComputedStyle(m).overflowY,contentHeight:content?.scrollHeight,
         availableHeight:content?.clientHeight,top:area?.top,bottom:area?.bottom,
         modalTop:b.top,modalBottom:b.bottom,sceneBottom:sceneBox.bottom});
     }
     // More options -> Diagnostics must contain many real entities in a small, scrollable list.
     el._xpPanel='extras';el._xpExtraSection='diagnostics';el.render();
     const modal=el.shadowRoot.querySelector('.xp-ux-modal'),
       scroll=modal.querySelector('.xp-diagnostics-scroll'),
       note=modal.querySelector('.xp-extra-diagnostics-layout>.xp-ux-note'),
       summary=modal.querySelector('.xp-entity-diagnostics>p[role="status"]');
     const sr=scroll.getBoundingClientRect(),nr=note.getBoundingClientRect(),
       mr=modal.getBoundingClientRect();
     const diag={scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight,
       overflow:getComputedStyle(scroll).overflowY,
       visible:sr.height>=45&&sr.bottom<=nr.top+1&&nr.bottom<=mr.bottom+1,
       noteVisible:nr.height>0&&nr.bottom<=mr.bottom+1,
       summaryVisible:!!summary&&summary.getBoundingClientRect().height>0,
       outerScroll:getComputedStyle(modal).overflowY,scrollTop:0};
     scroll.scrollTop=180;
     diag.scrollTop=scroll.scrollTop;
     el._xpPanel=null;el._xpExtraSection=null;el.render();
     return {sceneHeight:sceneBox.height,wifiOffset,pages:widths,diag};
   });
   responsiveModalQA.push({width,viewportHeight,...byPage});
   assert.ok(byPage.sceneHeight<=viewportHeight,
     'Card scene should fit its host viewport: '+JSON.stringify(responsiveModalQA.at(-1)));
   assert.ok(Math.abs(byPage.wifiOffset.x)<=.75&&Math.abs(byPage.wifiOffset.y)<=.75,
     'Wi-Fi visual must be centered in the actual button: '+JSON.stringify(responsiveModalQA.at(-1)));
   assert.ok(byPage.pages.every(x=>x.visible&&x.overflows==='hidden'),
     'Card subpage must not scroll or leak beyond its scene: '+JSON.stringify(responsiveModalQA.at(-1)));
   const map=byPage.pages.find(x=>x.panel==='map');
   assert.ok(map.availableHeight>180,'Map should reserve real visible height: '+JSON.stringify(map));
   assert.ok(byPage.diag.noteVisible&&byPage.diag.visible&&byPage.diag.summaryVisible
       &&byPage.diag.outerScroll==='hidden'&&byPage.diag.overflow==='auto',
     'Diagnostics should scroll only in sensor box and keep explanatory note visible: '+JSON.stringify(responsiveModalQA.at(-1)));
 }
 console.log('PASS Sections/mobile/desktop modal containment, centered Wi-Fi and sticky diagnostics note:',JSON.stringify(responsiveModalQA));
 assert.equal(errors.length,0,errors.join('\n'));
 assert.ok(imagesServed>=4,'Expected bundled vehicle and background assets to be loaded');
 const expected=Object.values(GALLERY).sort();
 assert.deepEqual([...created].sort(),expected,'Missing curated screen capture');
 assert.deepEqual(
  fs.readdirSync(OUTPUT).filter(x=>/\.(png|jpe?g|webp)$/i.test(x)).sort(),expected,
  'No obsolete screenshots may remain after capture');
 await browser.close();
}
main().catch(err=>{console.error(err);process.exit(1);});

// Owner review captures: original charging hero remains unchanged by visible dock controls.

// Rear-heat gallery: real G6 owner images and Xpengtk entities; no synthetic climate mockups.
