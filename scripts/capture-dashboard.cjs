'use strict';
// Screenshots are captured from the real custom card (same source shipped by HACS).
// Sensor readings are EXAMPLE VALUES only; no personal account or car data is used.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const OUTPUT=path.join(ROOT,'docs','screenshots');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

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
  'binary_sensor.my_xpeng_windows':state('off'),
  'sensor.my_xpeng_slow_charge_port':state('Closed'),
  'sensor.my_xpeng_charge_port':state('Closed'),
  'sensor.my_xpeng_next_maintenance':state('20 days',{next_date:'2027-01-10',km_remaining:2450}),
  'sensor.my_xpeng_vehicle_identity':state('G6',{vin_masked:'L1N******123456',model_year:'2026'}),
  'sensor.my_xpeng_charge_schedule_start':state('23:00'),
  'sensor.my_xpeng_charge_schedule_end':state('06:30'),
  'sensor.my_xpeng_tyre_pressure_fl':state('250'),
  'sensor.my_xpeng_tyre_pressure_fr':state('251'),
  'sensor.my_xpeng_tyre_pressure_rl':state('248'),
  'sensor.my_xpeng_tyre_pressure_rr':state('250'),
 }};
}
async function main(){
 fs.mkdirSync(OUTPUT,{recursive:true});
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
 await page.addScriptTag({path:path.join(ROOT,'src','xpeng-vehicle-card.js')});
 const car=page.locator('xpeng-vehicle-card');
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
      trim:'core_performance_awd',color:'arctic_white',interior:'light_gray',show_controls:false});
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
  await page.waitForTimeout(600);
  await car.screenshot({path:path.join(OUTPUT,'g6-2026-'+name+'.png'),animations:'disabled'});
  console.log('Captured '+name,JSON.stringify(info));
 }
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 await screen('vehicle-status');
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(true));
 await screen('charging');
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
       panelColumns:panel?getComputedStyle(panel).gridTemplateColumns.trim().split(/\s+/).length:0,
       charging:scene.classList.contains('xp-charge'),
       horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2};
   });
   assert.ok(layout.sceneWidth<=width+2 && layout.sceneWidth>=width-2,JSON.stringify(layout));
   assert.ok(layout.sceneHeight>=700,JSON.stringify(layout));
   assert.equal(layout.charging,charging,JSON.stringify(layout));
   if(!charging && width<=520)assert.equal(layout.panelColumns,2,JSON.stringify(layout));
   if(viewportWidth===width)assert.equal(layout.horizontalOverflow,false,JSON.stringify(layout));
   await car.screenshot({path:path.join(OUTPUT,'g6-2026-'+name+'.png'),animations:'disabled'});
   console.log('Responsive capture '+name,JSON.stringify(layout));
 }
 await responsiveShot(390,false,'mobile-vehicle-status');
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
 assert.equal(await car.locator('.xp-ux-dock-action').count(),8,'Seven home quick actions missing');
 for(const action of ['charging','maintenance','map'])assert.equal(await car.locator('button[data-xp-open="'+action+'"]').count(),1,action+' home action missing');
 assert.equal(await car.locator('.xp-ux-dock-action:not([disabled])').count(),8,'Mock owner has approved Access, so all seven actions must work');
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-controls-desktop.png'),animations:'disabled'});
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
   states['binary_sensor.my_xpeng_windows']={...states['binary_sensor.my_xpeng_windows'],state:'on'};
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
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-home-close-actions-desktop.png'),animations:'disabled'});
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
 assert.equal(await car.locator('button[data-xp-open="map"]').count(),1,'Desktop Location shortcut missing');
 await car.locator('button[data-xp-open="map"]').click();
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
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-location-desktop.png'),animations:'disabled'});
 console.log('Desktop Location map + finder + Back:',JSON.stringify(desktopMap));
 await car.locator('button[data-xp-close]').click();
 assert.equal(await car.locator('.xp-ux-modal-map').count(),0,'Desktop Back must close Location');
 assert.equal(await car.locator('.xp-ux-dock-action').count(),8,'Desktop Back must restore Home shortcuts');

 await car.locator('button[data-xp-open="climate"]').first().click();
 assert.ok(await car.locator('.xp-ux-modal-climate').count(),'Climate modal missing');
 assert.equal(await car.locator('.xp-ux-dock').count(),0,'Climate must have Back only, no home menu');
 assert.equal(await car.locator('[data-xp-close]').count(),1,'Climate must have one Back');
 const expectedZones=['wheel','driver','passenger','rear_left','rear_right'];
 for(const z of expectedZones){
   assert.equal(await car.locator('.xp-ux-hotspot-zone[data-xp-zone="'+z+'"]').count(),1,'HVAC hotspot missing: '+z);
 }
 assert.equal(await car.locator('button[data-xp-cycle="left_rear_seat_heat_select"]').count(),1,'Missing rear left heater button');
 assert.equal(await car.locator('[role="status"][aria-label="מצב AUTO: פעיל"]').count(),1,'Real AUTO feedback missing');
 assert.equal(await car.locator('[data-xp-hvac-mode="auto"]').count(),0,'Do not invent executable AUTO');
 assert.equal(await car.locator('[data-xp-swing-mode]').count(),0,'Do not invent remote airflow');
 assert.equal(await car.locator('button[data-xp-cycle="right_rear_seat_heat_select"]').count(),1,'Missing rear right heater button');
 const fan=await car.locator('[data-xp-range="fan_speed_control"]').first().evaluate(el=>({
   min:el.min,max:el.max,value:el.value,step:el.step
 }));
 assert.deepEqual(fan,{min:'1',max:'8',value:'3',step:'1'},'Use actual integration fan-range, not an invented 10-speed slider');
 console.log('HVAC validation: rear-left and rear-right heat visible; HA-provided fan-speed range',JSON.stringify(fan));
 await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752;});
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-climate-desktop.png'),animations:'disabled'});
 // Same user's actual cabin photo, dark finish configured in card editor.
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
     trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',enable_access_controls:true});
 });
 await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752&&img.src.includes('interior_dark_gray.webp');});
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-climate-dark-desktop.png'),animations:'disabled'});
 await car.locator('button[data-xp-close]').click();
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
     trim:'core_performance_awd',color:'arctic_white',interior:'light_gray',enable_access_controls:true});
 });
 await page.setViewportSize({width:390,height:900});
 await page.evaluate(()=>{const w=document.querySelector('.card-wrap');w.style.width='390px';w.style.margin='0 auto';});
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-controls-mobile.png'),animations:'disabled'});
 const dockScroll=await car.evaluate(el=>{
   const dock=el.shadowRoot.querySelector('.xp-ux-dock');
   const before=dock.scrollLeft;dock.scrollLeft=-dock.scrollWidth;
   return {width:dock.clientWidth,scrollWidth:dock.scrollWidth,before,after:dock.scrollLeft};
 });
 console.log('Mobile home dock measured:',JSON.stringify(dockScroll));
 assert.ok(dockScroll.scrollWidth>dockScroll.width+80,'Mobile Home shortcuts must scroll horizontally');
 assert.ok(Math.abs(dockScroll.after)>50,JSON.stringify(dockScroll));
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-controls-mobile-scrolled.png'),animations:'disabled'});
 console.log('Mobile dock horizontal scroll verified:',JSON.stringify(dockScroll));
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card'),h=card.hass;
   const states={...h.states};
   states['lock.my_xpeng_door_lock']={...states['lock.my_xpeng_door_lock'],state:'unlocked'};
   states['binary_sensor.my_xpeng_windows']={...states['binary_sensor.my_xpeng_windows'],state:'on'};
   states['sensor.my_xpeng_slow_charge_port']={...states['sensor.my_xpeng_slow_charge_port'],state:'Open'};
   states['sensor.my_xpeng_charge_port']={...states['sensor.my_xpeng_charge_port'],state:'Open'};
   states['binary_sensor.my_xpeng_trunk']={...states['binary_sensor.my_xpeng_trunk'],state:'on'};
   card.hass={...h,states};
 });
 assert.match((await readActions()).join(' '),/סגור חלונות/);
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-home-close-actions-mobile.png'),animations:'disabled'});
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(false));
 // The first-tap actions use real states; demo contains no backend car connection.
 for(const [action,name] of [['doors','doors-mobile'],['windows','windows-mobile'],['port','charge-port-mobile'],['trunk','trunk-mobile']]){
   await page.evaluate(action=>{const card=document.querySelector('xpeng-vehicle-card');card._xpPanel=action;card.render();},action);
   assert.ok(await car.locator('.xp-ux-modal-'+action).count(),action+' details modal missing');
   await car.screenshot({path:path.join(OUTPUT,'g6-2026-'+name+'.png'),animations:'disabled'});
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
   if(action==='maintenance'){
     const metrics=await car.evaluate(el=>{
       const root=el.shadowRoot,modal=root.querySelector('.xp-ux-modal-maintenance'),
        stage=root.querySelector('.xp-tire-stage'),wheel=root.querySelector('[data-wheel="tire_fl"]');
       modal.scrollTop=modal.scrollHeight;
       return {height:modal.clientHeight,scrollHeight:modal.scrollHeight,scrolled:modal.scrollTop,
         columns:getComputedStyle(stage).gridTemplateColumns.split(/\s+/).length,
         label:wheel.textContent.trim()};
     });
     assert.ok(metrics.scrolled>60,'Maintenance subpage must scroll vertically on mobile: '+JSON.stringify(metrics));
     assert.equal(metrics.columns,2,'Mobile TPMS must have two compact pressure columns');
     assert.match(metrics.label,/2\.5bar/);
     await car.locator('select[data-xp-tire-unit]').selectOption('psi');
     assert.match(await car.locator('[data-wheel="tire_fl"]').innerText(),/36\.3/);
     await car.screenshot({path:path.join(OUTPUT,'g6-2026-maintenance-mobile-psi.png'),animations:'disabled'});
     await car.locator('select[data-xp-tire-unit]').selectOption('kPa');
     assert.match(await car.locator('[data-wheel="tire_fl"]').innerText(),/250/);
     console.log('Mobile maintenance vertical scrolling and PSI/kPa conversion:',JSON.stringify(metrics));
   }
   await car.screenshot({path:path.join(OUTPUT,'g6-2026-'+name+'.png'),animations:'disabled'});
   await car.locator('button[data-xp-close]').click();
 }
 await page.evaluate(()=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',
     trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',enable_access_controls:true});
   card._xpPanel='climate';card.render();
 });
 await page.waitForFunction(()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('img[data-cabin-art]');return img&&img.complete&&img.naturalWidth===752&&img.src.includes('interior_dark_gray.webp');},{timeout:12000});
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-climate-dark-mobile.png'),animations:'disabled'});
 await car.locator('button[data-xp-close]').click();
 await page.evaluate(data=>{document.querySelector('xpeng-vehicle-card').hass=data;},demo(true));
 assert.equal(await car.locator('.xp-ux-dock').count(),0,'Charging should have no visible quick action dock');
 assert.equal(await car.locator('.xp-ux-charge-actions').count(),0,'Charging controls must not overlay hero');
 assert.equal(await car.locator('button[data-xp-open="charge_controls"]').count(),1,'Charge limit control missing');
 assert.equal(await car.locator('button[data-xp-open="charge_schedule"]').count(),1,'Charge schedules shortcut missing');
 assert.equal(await car.locator('button[data-xp-home]').count(),1,'Charging needs one Back to home');
 assert.equal(await car.locator('.xp-ux-dock').count(),0,'Charging must not have home dock');

 await car.screenshot({path:path.join(OUTPUT,'g6-2026-charging-reference-mobile.png'),animations:'disabled'});
 await car.locator('button[data-xp-open="charge_controls"]').click();
 assert.ok(await car.locator('.xp-ux-modal-charge_controls').count(),'Charging modal missing');
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-charging-actions-mobile.png'),animations:'disabled'});
 await car.locator('button[data-xp-close]').click();
 await car.locator('button[data-xp-open="charge_schedule"]').click();
 assert.ok(await car.locator('.xp-ux-modal-charge_schedule').count(),'Charging schedules modal missing');
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-charge-schedule-mobile.png'),animations:'disabled'});
 // Automatic charging remains live, but Back returns Home until charging resets.
 await car.locator('button[data-xp-close]').click();
 await car.locator('button[data-xp-home]').click();
 assert.equal(await car.locator('.xp-ux-dock-action').count(),8,'Back from live Charging should display Home menu');
 assert.equal(await car.locator('button[data-xp-home]').count(),0,'Home should not have Back');
 await car.screenshot({path:path.join(OUTPUT,'g6-2026-back-home-mobile.png'),animations:'disabled'});
 // Charging is also a manually accessible destination, with the exact same scene.
 await car.locator('button[data-xp-open="charging"]').click();
 assert.equal(await car.locator('.xp-charge-card').count(),1,'Manual charging view did not open');
 assert.equal(await car.locator('.xp-ux-dock').count(),0,'Manual charging must hide home dock');
 await car.locator('button[data-xp-home]').click();
 assert.equal(await car.locator('.xp-ux-dock-action').count(),8,'Back from manual Charging should return Home');
 assert.equal(errors.length,0,errors.join('\n'));
 assert.ok(imagesServed>=4,'Expected bundled vehicle and background assets to be loaded');
 await browser.close();
}
main().catch(err=>{console.error(err);process.exit(1);});

// Owner review captures: original charging hero remains unchanged by visible dock controls.

// Rear-heat gallery: real G6 owner images and Xpengtk entities; no synthetic climate mockups.
