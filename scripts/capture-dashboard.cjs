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
  'sensor.my_xpeng_charge_power_kw':state('79.2'),
  'sensor.my_xpeng_charge_remaining_min':state('32'),
  'sensor.my_xpeng_charge_target':state('90'),
  'sensor.my_xpeng_last_update':state('2026-10-14T12:00:00'),
  'binary_sensor.my_xpeng_is_charging':state(charging?'on':'off'),
  'binary_sensor.my_xpeng_is_plugged_in':state(charging?'on':'off'),
  'sensor.my_xpeng_tire_pressure_front_left_kpa':state('250'),
  'sensor.my_xpeng_tire_pressure_front_right_kpa':state('251'),
  'sensor.my_xpeng_tire_pressure_rear_left_kpa':state('248'),
  'sensor.my_xpeng_tire_pressure_rear_right_kpa':state('250'),
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
      trim:'core_performance_awd',color:'arctic_white',interior:'light_gray'});
 });
 async function screen(name){
  console.log('Checking browser screen:',name);
  const selector=name==='tire-pressure'?'[data-top-art]':'[data-car-art]';
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
 await car.locator('button[data-tire-toggle]').first().click();
 assert.ok(await car.locator('.xp-tire-screen').count(),'Top view was not opened');
 await screen('tire-pressure');
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
 assert.equal(errors.length,0,errors.join('\n'));
 assert.ok(imagesServed>=4,'Expected bundled vehicle and background assets to be loaded');
 await browser.close();
}
main().catch(err=>{console.error(err);process.exit(1);});
