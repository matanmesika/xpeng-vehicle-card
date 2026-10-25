const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');

const MODES=[
 ['climate_max_cooling','maximum_cooling'],
 ['climate_max_heating','maximum_heating'],
 ['climate_rear_defrost','rear_window_defroster'],
 ['climate_refresh','refresh'],
 ['climate_sterilisation','sterilisation'],
 ['climate_ac_cleaning','a_c_cleaning'],
 ['climate_pet_mode','pet_mode']
];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const icons=()=>'<svg></svg>';
const a=core.indexOf(' xpClimateFeatures(){');
const z=core.indexOf('\n xpSeatControls(){',a);
assert.ok(a>=0&&z>a,'climate method must exist');
const feature=Function('xpEsc','xpIcon','return ({'+core.slice(a,z)+'}).xpClimateFeatures')(esc,icons);

function render(switches){
 const states=Object.create(null);
 for(const [suffix,data] of Object.entries(switches)){
  states['switch.xpeng_test_'+suffix]={state:data.state,attributes:data.attributes||{}};
 }
 const obj={
  _hass:{states},
  xpLive:()=>null,
  xpengEntity:(domain,suffix)=>domain==='switch'&&states['switch.xpeng_test_'+suffix]?'switch.xpeng_test_'+suffix:null
 };
 return feature.call(obj);
}

const clickStart=core.indexOf("     if(b.hasAttribute('data-xp-climate-switch')){");
const clickEnd=core.indexOf("     if(b.hasAttribute('data-xp-hvac-mode')){",clickStart);
assert.ok(clickStart>=0&&clickEnd>clickStart,'climate click handler must exist');
const click=Function('b',core.slice(clickStart,clickEnd));

function invoke(suffix,state,allowed=true){
 const calls=[];
 const obj={
  xpLive:(domain,key)=>domain==='switch'&&key===suffix&&state!==null?{
   id:'switch.xpeng_test_'+suffix,
   state:{state,attributes:{control_allowed:allowed}}
  }:null,
  xpSend:(...args)=>calls.push(args)
 };
 click.call(obj,{dataset:{xpClimateSwitch:suffix},hasAttribute:key=>key==='data-xp-climate-switch'});
 return calls;
}

test('all seven canonical Xpengtk mode IDs resolve their English entity-name fallbacks',()=>{
 for(const [suffix,fallback] of MODES){
  assert.match(core,new RegExp("'switch\\."+suffix+"':'"+fallback+"'"));
  assert.match(core,new RegExp("\\['"+suffix+"'"));
 }
 assert.match(core,/const id=this\.xpengEntity\('switch',suffix\)/);
});

test('approved and live modes are real buttons with state-specific aria-pressed and correct on/off',()=>{
 for(const [suffix] of MODES){
  const on=render({[suffix]:{state:'on',attributes:{control_allowed:true}}});
  const off=render({[suffix]:{state:'off',attributes:{control_allowed:true}}});
  assert.match(on,new RegExp('data-xp-climate-switch="'+suffix+'" aria-pressed="true"'));
  assert.match(off,new RegExp('data-xp-climate-switch="'+suffix+'" aria-pressed="false"'));
  assert.deepEqual(invoke(suffix,'off'),[['switch','turn_on',suffix]]);
  assert.deepEqual(invoke(suffix,'on'),[['switch','turn_off',suffix]]);
 }
});

test('unsupported, read-only, unknown and unavailable modes never become clickable',()=>{
 const suffix='climate_max_cooling';
 for(const attrs of [{control_allowed:false},{}]){
  const html=render({[suffix]:{state:'on',attributes:attrs}});
  assert.match(html,/role="status"/);
  assert.match(html,/Status only/);
  assert.doesNotMatch(html,/data-xp-climate-switch/);
 }
 for(const state of ['unknown','unavailable']){
  const html=render({[suffix]:{state,attributes:{control_allowed:true}}});
  assert.match(html,/Status only/);
  assert.doesNotMatch(html,/data-xp-climate-switch/);
  assert.deepEqual(invoke(suffix,state),[]);
 }
 assert.equal(render({}),'');
 assert.deepEqual(invoke(suffix,'on',false),[]);
 assert.deepEqual(invoke(suffix,null),[]);
 assert.deepEqual(invoke('defrost_switch','on'),[]);
 assert.deepEqual(invoke('climate_fake_mode','off'),[]);
});

test('front defrost remains separate, mirror heat remains read-only, generated HACS bundles match',()=>{
 assert.match(core,/data-xp-switch=\\"defrost_switch\\"/);
 assert.match(core,/Mirror heating/);
 assert.match(core,/xp-ux-climate-readonly/);
 const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
 assert.equal(src,core.replace(slot,'const XP_CSS = `'+css+'\\n`;'));
 assert.equal(src,dist);
});
