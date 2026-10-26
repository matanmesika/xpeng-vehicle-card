const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/design/xpeng-vehicle-card.css'),'utf8');
const bundle=fs.readFileSync(path.join(__dirname,'../src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(__dirname,'../dist/xpeng-vehicle-card.js'),'utf8');
const a=src.indexOf(' xpCover(action){'),b=src.indexOf(' xpPendingToggle(action){',a);
assert.ok(a>=0&&b>a);
const methods=Function('return ({'+src.slice(a,b)+'})')();
function vehicle(opts={}){
 const states={};
 for(const [suffix,entry] of Object.entries(opts.covers||{})){
  states['cover.xpeng_test_'+suffix]={state:entry.state,attributes:entry.attributes||{}};
 }
 for(const [suffix,entry] of Object.entries(opts.sensors||{})){
  states['binary_sensor.xpeng_test_'+suffix]={state:entry,attributes:{}};
 }
 if(opts.portSensor)states['sensor.xpeng_test_slow_charge_port']={state:opts.portSensor,attributes:{}};
 if(opts.lock)states['lock.xpeng_test_door_lock']={state:opts.lock,attributes:{}};
 const obj={
  ...methods,_hass:{states},xpAccessAllowed:()=>opts.access!==false,
  bool:()=>opts.plugged===true,
  xpengEntity(domain,suffix){
   const map={port:'charge_port'};
   const id=domain+'.xpeng_test_'+(map[suffix]||suffix);
   return states[id]?id:null;
  },
  xpLive(domain,suffix){
   const id=this.xpengEntity(domain,suffix);
   const e=id&&states[id];
   return e&&!['unknown','unavailable'].includes(e.state)?{id,state:e}:null;
  }
 };
 return obj;
}
function cover(state,features,attrs={}){
 return {state,attributes:{supported_features:features,...attrs}};
}
test('official compact covers drive all three home buttons',()=>{
 for(const suffix of ['trunk','windows','charge_port']){
  const action=suffix==='charge_port'?'port':suffix;
  for(const [state,features,service] of [['closed',1,'open_cover'],['open',2,'close_cover']]){
   const v=vehicle({covers:{[suffix]:cover(state,features)}});
   assert.equal(v.xpActionState(action),state);
   assert.deepEqual(v.xpToggleTarget(action),{
    domain:'cover',service,suffix,
    label:suffix==='windows'?(state==='closed'?'Vent windows':'Close windows'):
     suffix==='trunk'?(state==='closed'?'Open Trunk':'Close Trunk'):
     (state==='closed'?'Open charging port':'Close charging port')
   });
  }
 }
});
test('read-only, unsupported, stale, partial permissions and access gate do not send actions',()=>{
 for(const suffix of ['trunk','windows','charge_port']){
  const action=suffix==='charge_port'?'port':suffix;
  for(const [state,features] of [['closed',0],['closed',2],['open',1],['open',0],['closed',undefined],['unknown',3],['unavailable',3]]){
   const v=vehicle({covers:{[suffix]:cover(state,features)}});
   assert.equal(v.xpToggleTarget(action),null);
  }
 }
 for(const suffix of ['trunk','windows']){
  assert.equal(vehicle({covers:{[suffix]:cover('closed',3)},access:false}).xpToggleTarget(suffix),null);
  assert.equal(vehicle({covers:{[suffix]:cover('open',3)},access:false}).xpToggleTarget(suffix).service,'close_cover');
 }
});
test('connected charge port can never be closed, even with supported_features',()=>{
 const v=vehicle({covers:{charge_port:cover('open',3,{port_state:'Connected'})}});
 assert.equal(v.xpToggleTarget('port'),null);
 const plugged=vehicle({covers:{charge_port:cover('open',3)},plugged:true});
 assert.equal(plugged.xpToggleTarget('port'),null);
 const legacy=vehicle({portSensor:'Connected',plugged:true});
 assert.equal(legacy.xpToggleTarget('port'),null);
});
test('legacy window, trunk and port telemetry remain readable without compact covers',()=>{
 assert.equal(vehicle({sensors:{trunk:'off'}}).xpActionState('trunk'),'closed');
 assert.equal(vehicle({sensors:{windows:'on'}}).xpActionState('windows'),'open');
 assert.equal(vehicle({portSensor:'Open'}).xpActionState('port'),'open');
 assert.equal(vehicle({portSensor:'Connected'}).xpActionState('port'),null);
 assert.equal(vehicle({lock:'locked'}).xpActionState('doors'),'closed');
});
test('cover mapping supports both canonical unique ID and generated English entity name',()=>{
 for(const suffix of ['trunk','windows','charge_port']){
  assert.match(src,new RegExp("'cover\\."+suffix+"'"));
  assert.match(src,new RegExp("'"+suffix+"_cover'"));
 }
 assert.match(src,/features&\(opening\?1:2\)/);
 assert.match(src,/this\.xpSend\(target\.domain,target\.service,target\.suffix,undefined,true\)/);
 assert.match(src,/domain==='cover'&&\['trunk','windows','charge_port'\]/);
});
test('both shipped HACS bundles are rebuilt from canonical runtime and CSS',()=>{
 const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
 assert.equal(bundle,src.replace(slot,'const XP_CSS = `'+css+'\n`;'));
 assert.equal(dist,bundle);
});
