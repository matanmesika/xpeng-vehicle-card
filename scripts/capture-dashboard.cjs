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
 // Only purge old QA images inside docs/screenshots, never the car art assets.
 for(const file of fs.readdirSync(OUTPUT)){
   if(/\.(png|jpe?g|webp)$/i.test(file))fs.rmSync(path.join(OUTPUT,file));
 }
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
   default_zoom:11,hours_to_show:0,dark_mode:true
 },'Native dark map must use the real vehicle tracker entity');
 await reviewShot('location-desktop');
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
 await car.locator('button[data-xp-extra-page="diagnostics"]').click();
 assert.ok(await car.locator('.xp-ux-modal-extras').count(),'Diagnostics extra page missing');
 const summary=await car.locator('.xp-entity-diagnostic').count();
 assert.ok(summary>=30,'Expected mocked integration entities in diagnostics: '+summary);
 await reviewShot('diagnostics-mobile');
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('.xp-ux-dock-action').count(),7);

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
   if(action==='map'){
     assert.equal(await car.locator('button[data-xp-map-action="honk_horn"]').count(),1);
     assert.equal(await car.locator('button[data-xp-map-action="flash_lights"]').count(),1);
   }
   if(action==='climate')await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752;});

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

   await reviewShot(name);
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
 assert.equal(await car.locator('.xp-ux-dock').count(),0,'Charging should have no visible quick action dock');
 assert.equal(await car.locator('.xp-ux-charge-actions').count(),0,'Charging controls must not overlay hero');
 assert.equal(await car.locator('button[data-xp-open="charge_controls"]').count(),1,'Charge limit control missing');
 assert.equal(await car.locator('button[data-xp-open="charge_schedule"]').count(),1,'Charge schedules shortcut missing');
 assert.equal(await car.locator('button[data-xp-home]').count(),1,'Charging needs one Back to home');
 assert.equal(await car.locator('.xp-ux-dock').count(),0,'Charging must not have home dock');

 await reviewShot('charging-reference-mobile');
 await car.locator('button[data-xp-open="charge_controls"]').click();
 assert.ok(await car.locator('.xp-ux-modal-charge_controls').count(),'Charging modal missing');
 await reviewShot('charging-actions-mobile');
 await car.locator('button[data-xp-close]').click();
 await car.locator('button[data-xp-open="charge_schedule"]').click();
 assert.ok(await car.locator('.xp-ux-modal-charge_schedule').count(),'Charging schedules modal missing');
 await reviewShot('charge-schedule-mobile');
 // Automatic charging remains live, but Back returns Home until charging resets.
 await car.locator('button[data-xp-close]').click();
 await car.locator('button[data-xp-home]').click();
 assert.equal(await car.locator('.xp-ux-dock-action').count(),7,'Back from live Charging should display Home menu');
 assert.equal(await car.locator('button[data-xp-home]').count(),0,'Home should not have Back');
 await reviewShot('back-home-mobile');
 // An explicit Back suppresses the current charge; a NEW charge session reopens it.
 assert.equal(await car.locator('button[data-xp-open="charging"]').count(),0);
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(true));
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
