'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const profiles=JSON.parse(fs.readFileSync(path.join(ROOT,'profiles/year-profiles.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'model-catalog.json'),'utf8'));
const source=fs.readFileSync(path.join(ROOT,'dist/xpeng-vehicle-card.js'),'utf8');

class FakeElement{
 attachShadow(){this.shadowRoot={innerHTML:'',handlers:{},addEventListener(name,fn){this.handlers[name]=fn},querySelector(){return null}};return this.shadowRoot;}
 toggleAttribute(){}
 dispatchEvent(){}
}
const tags=new Map();
const context={
 HTMLElement:FakeElement,console,
 window:{customCards:[]},
 customElements:{get:id=>tags.get(id),define:(id,cls)=>tags.set(id,cls)},
 document:{addEventListener(){},removeEventListener(){},fullscreenElement:null,createElement(){return {}}},
 CustomEvent:class{},URL,
};
vm.runInNewContext(source,context,{filename:'xpeng-vehicle-card.js'});
const Card=tags.get('xpeng-vehicle-card');
const Editor=tags.get('xpeng-vehicle-card-editor');
const lib=vm.runInNewContext('({xpAllowedModels,xpAllowedTrims,xpAllowedPaints,xpAllowedInteriors})',context);

test('catalog includes a profile for every supported model-year',()=>{
 assert.equal(profiles.version,'0.1.1');
 const expected=catalog.models.reduce((count,model)=>count+model.end-model.start+1,0);
 assert.equal(profiles.profile_count,expected);
 assert.equal(profiles.profiles.length,expected);
 assert.equal(new Set(profiles.profiles.map(p=>p.model+':'+p.year)).size,expected);
 assert.equal(new Set(profiles.profiles.map(p=>p.model)).size,catalog.models.length);
});

test('all year profiles load in the card editor without errors',()=>{
 const editor=new Editor(),card=new Card();
 for(const p of profiles.profiles){
   assert.ok(lib.xpAllowedModels(p.year).some(x=>x.id===p.model),p.display_name);
   editor.setConfig({prefix:'my_xpeng',model:p.model,year:p.year,color:p.paint_options[0],interior:p.interior_options[0]});
   assert.match(editor.shadowRoot.innerHTML,/data-key="model"/);
   assert.match(editor.shadowRoot.innerHTML,/data-key="interior"/);
   assert.match(editor.shadowRoot.innerHTML,/Manual sensor mapping/);
   assert.equal(editor._cfg.model,p.model,p.display_name);
   assert.equal(editor._cfg.year,p.year,p.display_name);
   card.setConfig({prefix:'my_xpeng',model:p.model,year:p.year,trim:p.trims[0],color:p.paint_options[0],interior:p.interior_options[0]});
   assert.equal(card.appearance().model,p.model,p.display_name);
   assert.equal(card.appearance().year,p.year,p.display_name);
   assert.match(card.shadowRoot.innerHTML,/data-car-art/);
   assert.doesNotMatch(card.shadowRoot.innerHTML,/Manual sensor mapping|data-key="model"/);
 }
});

test('every offered exterior choice loads existing bundled art or a labelled silhouette fallback',()=>{
 const card=new Card(),prefix='/hacsfiles/xpeng-vehicle-card/xpeng-asset-';
 let checked=0;
 for(const p of profiles.profiles){
  for(const trim of p.trims){
   for(const color of p.paint_options){
    card.setConfig({prefix:'my_xpeng',model:p.model,year:p.year,trim,color,interior:p.interior_options[0]});
    const spec=card.assetSpec();
    if(spec.src.startsWith('data:image/svg+xml')){
      assert.match(spec.description,/Transparent model\+paint preview pending/);
      assert.equal(spec.illustrative,true);
    }else{
      assert.ok(spec.src.startsWith(prefix),spec.src);
      const sourcePath=path.join(ROOT,'dist',spec.src.replace('/hacsfiles/xpeng-vehicle-card/',''));
      assert.ok(fs.existsSync(sourcePath),p.display_name+' '+trim+' '+color+' missing: '+sourcePath);
      assert.equal(spec.illustrative,true);
    }
    checked++;
   }
  }
 }
 assert.ok(checked>=200,checked);
});

test('the same model+paint always uses the same higher-trim image across years',()=>{
 const c=new Card();
 for(const [model,years,trims] of [
 ['G6',['2023','2026'],['standard_range_rwd','core_performance_awd']],
 ['G9',['2022','2026'],['standard_range_rwd','performance_awd']]]){
   let seen=null;
   for(let i=0;i<years.length;i++){
      c.setConfig({model,year:years[i],trim:trims[i],color:'arctic_white'});
      const art=c.assetSpec();
      assert.equal(art.tier,'highest-trim-preview');
      if(seen)assert.equal(art.src,seen);
      seen=art.src;
   }
 }
 c.setConfig({model:'G9',year:'2024',color:'kaitoke_green_matte'});
 assert.equal(c.assetSpec().tier,'silhouette');
});
test('the approved background stays byte-for-byte frozen and shared between status and charging',()=>{
 const expectedGitBlob='a28766ffcb8607f096077e67fdc3fbb04b79c883';
 const file=path.join(ROOT,'dist/assets/xpeng-approved-lakeside-background.webp');
 const raw=fs.readFileSync(file);
 const blob=crypto.createHash('sha1')
    .update(Buffer.from('blob '+raw.length)).update(Buffer.from([0]))
   .update(raw).digest('hex');
 assert.equal(blob,expectedGitBlob,
   'Backdrop was changed without explicit owner approval; restore approved pixels');
 const root=fs.readFileSync(path.join(ROOT,'assets/xpeng-approved-lakeside-background.webp'));
 assert.ok(root.equals(raw),'Root and HACS background must be byte-identical');
 const card=new Card();card.setConfig({model:'G6',year:'2026',color:'arctic_white'});
 const idle=card.sceneBackdrop();
 card.hass={states:{'binary_sensor.my_xpeng_is_charging':{state:'on'}}};
 const active=card.sceneBackdrop();
 assert.equal(idle,active);
 assert.ok(idle.includes('xpeng-approved-lakeside-background.webp'));
 assert.equal((idle.match(/xp-night-photo/g)||[]).length,1);
 assert.ok(!source.includes('night-mountain-scene.svg'));
});
test('G6 and G9 use one highest-available-trim photo regardless of selected trim',()=>{
  const card=new Card();
  for(const [model,visualTrim,trims] of [
    ['G9','performance_awd',['unspecified','standard_range_rwd','long_range_rwd','performance_awd']],
    ['G6','core_performance_awd',['unspecified','core_rwd','core_plus_rwd','core_performance_awd','black_edition']]
  ])for(const trim of trims){
    card.setConfig({model,year:'2026',trim,color:'arctic_white'});
    const art=card.assetSpec();
    assert.equal(art.tier,'highest-trim-preview');
    assert.ok(art.src.endsWith('/xpeng-asset-vehicles-'+model.toLowerCase()+'-2026-'+visualTrim+'-arctic_white.webp'),art.src);
  }
});
test('card editor remains appearance-only and dashboard does not add new screens',()=>{
 const card=new Card(),editor=new Editor();
 editor.setConfig({model:'G9',year:'2026',trim:'performance_awd',color:'arctic_white',interior:'coffee'});
 assert.match(editor.shadowRoot.innerHTML,/data-key="year"/);
 assert.match(editor.shadowRoot.innerHTML,/data-key="model"/);
 assert.match(editor.shadowRoot.innerHTML,/data-key="interior"/);
 assert.match(editor.shadowRoot.innerHTML,/Manual sensor mapping/);
 card.setConfig({...editor._cfg});
 assert.equal(card.appearance().model,'G9');
 assert.doesNotMatch(card.shadowRoot.innerHTML,/data-key="year"|Manual sensor mapping/);
 assert.equal((card.shadowRoot.innerHTML.match(/class="xp-night-photo"/g)||[]).length,1);
});

test('data-driven asset index matches actual repo files for every model and year',()=>{
 const index=JSON.parse(fs.readFileSync(path.join(ROOT,'vehicle-art-inventory.json'),'utf8'));
 const packaged=JSON.parse(fs.readFileSync(path.join(ROOT,'dist/vehicle-art-inventory.json'),'utf8'));
 assert.deepEqual(index,packaged);
 assert.equal(index.backdrop,'xpeng-approved-lakeside-background.webp');
 assert.equal(index.backdrop_is_common,true);
 const c=vm.runInNewContext('({exact:Array.from(XP_ARTWORK_INDEX.exact),family:Array.from(XP_ARTWORK_INDEX.family)})',context);
 assert.deepEqual(Array.from(c.exact).sort(),index.exact.slice().sort());
 assert.deepEqual(Array.from(c.family).sort(),index.model_family.slice().sort());
 assert.equal(new Set(index.exact).size,index.exact.length);
 assert.equal(new Set(index.model_family).size,index.model_family.length);
 for(const rel of [...index.exact,...index.model_family]){
   assert.ok(fs.existsSync(path.join(ROOT,'dist/assets',rel)),rel);
   assert.ok(fs.existsSync(path.join(ROOT,'assets',rel)),rel);
 }
});
test('bundled top-trim artwork is stable across every year and paint',()=>{
 const c=new Card(),scene=c.sceneBackdrop();
 const inventory=JSON.parse(fs.readFileSync(path.join(ROOT,'vehicle-art-inventory.json'),'utf8'));
 for(const model of ['G6','G9']){
  const top=model==='G6'?'core_performance_awd':'performance_awd';
  for(const paint of ['arctic_white','graphite_gray','midnight_black','silver_frost']){
   assert.ok(inventory.exact.includes('vehicles/'+model.toLowerCase()+'/2026/'+top+'/'+paint+'.webp'));
   const years=model==='G6'?['2023','2024','2025','2026']:['2022','2023','2024','2025','2026'];
   let first=null;
   for(const year of years){
     c.setConfig({model,year,color:paint});
     const art=c.assetSpec();
     assert.equal(art.tier,'highest-trim-preview');
     if(first)assert.equal(art.src,first);
     first=art.src;
     assert.equal(c.sceneBackdrop(),scene);
   }
  }
 }
});
test('every catalog model and supported year keeps its selection and emits an honest artwork tier',()=>{
 const card=new Card();
 for(const p of profiles.profiles){
   const a={model:p.model,year:p.year,trim:p.trims[0],color:p.paint_options[0],interior:p.interior_options[0]};
   card.setConfig(a);
   const art=card.assetSpec();
   assert.equal(card.appearance().model,a.model);
   assert.equal(card.appearance().year,a.year);
   assert.ok(['highest-trim-preview','model-family','silhouette','manual'].includes(art.tier),p.display_name);
   if(art.tier==='model-family')assert.match(art.description,/illustration/);
   if(art.tier==='silhouette')assert.match(art.description,/Transparent model\+paint preview pending/);
 }
});
test('model or paint changes never retain an unrelated manual vehicle/cabin image',()=>{
 const editor=new Editor();
 editor.setConfig({model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',
  interior:'light_gray',image:'/local/car-exact.webp',interior_image:'/local/cabin-exact.webp'});
 assert.match(editor.shadowRoot.innerHTML,/data-key="image"/);
 assert.match(editor.shadowRoot.innerHTML,/data-key="interior_image"/);
 const simulate=(key,value)=>{
  const ctrl={dataset:{key},value,hasAttribute:()=>false,setCustomValidity(){},reportValidity(){}};
  editor.shadowRoot.handlers.change({target:{closest:()=>ctrl}});
 };
 simulate('color','graphite_gray');
 assert.equal(editor._cfg.image,undefined,'old paint must not keep white car');
 assert.equal(editor._cfg.interior_image,'/local/cabin-exact.webp','cabin choice independent of paint');
 simulate('interior','dark_gray');
 assert.equal(editor._cfg.interior_image,undefined,'changing upholstery invalidates manual cabin photo');
});
test('cabin preview changes with selected interior colour without changing the background',()=>{
 const card=new Card();
 card.setConfig({model:'G6',year:'2026',color:'arctic_white',interior:'light_gray'});
 const backdrop=card.sceneBackdrop();
 const light=card.interiorPreview();
 assert.match(light,/#d8d9d4/);
 card.setConfig({model:'G6',year:'2026',color:'arctic_white',interior:'dark_gray'});
 const dark=card.interiorPreview();
 assert.match(dark,/#40454b/);
 assert.notEqual(light,dark);
 assert.equal(card.sceneBackdrop(),backdrop);
 card.setConfig({model:'G6',year:'2026',interior:'light_gray',interior_image:'/local/my-cabin.webp'});
 assert.match(card.interiorPreview(),/my-cabin.webp/);
});

test('a charging/rear image is selected by charging state without ever changing scene background',()=>{
 const card=new Card();
 card.setConfig({model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',
    image:'/local/front-g6.webp',charging_image:'/local/rear-g6.webp'});
 const backdrop=card.sceneBackdrop();
 assert.equal(card.assetSpec().src,'/local/front-g6.webp');
 card.hass={states:{'binary_sensor.my_xpeng_is_charging':{state:'on'}}};
 assert.equal(card.assetSpec().src,'/local/rear-g6.webp');
 assert.equal(card.sceneBackdrop(),backdrop);
 card.hass={states:{'binary_sensor.my_xpeng_is_charging':{state:'off'}}};
 assert.equal(card.assetSpec().src,'/local/front-g6.webp');
 assert.equal(card.sceneBackdrop(),backdrop);
 const editor=new Editor();
 editor.setConfig({model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',
     image:'/local/front-g6.webp',charging_image:'/local/rear-g6.webp'});
 assert.match(editor.shadowRoot.innerHTML,/data-key="charging_image"/);
 const ctrl={dataset:{key:'color'},value:'graphite_gray',hasAttribute:()=>false,
     setCustomValidity(){},reportValidity(){}};
 editor.shadowRoot.handlers.change({target:{closest:()=>ctrl}});
 assert.equal(editor._cfg.image,undefined);
 assert.equal(editor._cfg.charging_image,undefined);
});

test('multi-vehicle profiles never inherit a different cars exterior or interior image',()=>{
 const card=new Card();
 card.setConfig({
   prefix:'my_xpeng',
   model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',
   image:'/local/root-image.webp',
   interior_image:'/local/root-cabin.webp',
   charging_image:'/local/root-rear.webp',
   vehicles:[
     {model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',
       interior:'light_gray',image:'/local/g6-front.webp',
       interior_image:'/local/g6-cabin.webp',charging_image:'/local/g6-rear.webp'},
     {model:'G9',year:'2026',trim:'long_range_rwd',color:'graphite_gray',
       interior:'coffee'}
   ]
 });
 const sharedBackground=card.sceneBackdrop();
 assert.equal(card.assetSpec().src,'/local/g6-front.webp');
 assert.match(card.interiorPreview(),/g6-cabin.webp/);
 card._vehicleIndex=1;
 card.render();
 const g9=card.assetSpec();
 assert.equal(g9.tier,'highest-trim-preview');
 assert.ok(g9.src.endsWith('/xpeng-asset-vehicles-g9-2026-performance_awd-graphite_gray.webp'),g9.src);
 assert.doesNotMatch(card.interiorPreview(),/g6-cabin|root-cabin/);
 assert.match(card.interiorPreview(),/coffee/i);
 card.hass={states:{'binary_sensor.my_xpeng_is_charging':{state:'on'}}};
 const g9Charging=card.assetSpec();
 assert.equal(g9Charging.src,g9.src,'do not inherit G6 rear/charging artwork');
 assert.equal(card.sceneBackdrop(),sharedBackground);
 card._vehicleIndex=0;
 card.render();
 assert.equal(card.assetSpec().src,'/local/g6-rear.webp');
});


test('year only filters informational trim names: all vehicle assets and colours remain',()=>{
 const ed=new Editor();
 ed.setConfig({model:'G6',year:'2026',trim:'core_plus_rwd',color:'stellar_purple',interior:'light_gray',
   image:'/local/g6-purple.webp',charging_image:'/local/g6-rear.webp',top_image:'/local/g6-top.webp',
   interior_image:'/local/g6-cabin.webp'});
 assert.doesNotMatch(ed.shadowRoot.innerHTML,/data-key="shape_family"/);
 const change=(key,value)=>{
   const el={dataset:{key},value,hasAttribute:()=>false,setCustomValidity(){},reportValidity(){}};
   ed.shadowRoot.handlers.change({target:{closest:()=>el}});
 };
 change('year','2023');
 assert.equal(ed._cfg.year,'2023');
 assert.ok(ed.shadowRoot.innerHTML.includes('Long Range RWD'));
 assert.ok(!ed.shadowRoot.innerHTML.includes('Core+ RWD'));
 const keys=['color','interior','image','charging_image','top_image','interior_image'];
 for(const key of keys)assert.ok(ed._cfg[key]!==undefined,'year cleared '+key);
 const unchanged={...ed._cfg};
 change('trim','long_range_rwd');
 for(const key of keys)assert.equal(ed._cfg[key],unchanged[key],'trim changed '+key);
 const card=new Card();card.setConfig({...ed._cfg});
 const art=card.assetSpec().src;
 assert.match(card.topCarArt(),/g6-top.webp/);
 card.setConfig({...ed._cfg,year:'2026',trim:'core_performance_awd'});
 assert.equal(card.assetSpec().src,art);
 assert.match(card.topCarArt(),/g6-top.webp/);
 change('color','midnight_black');
 assert.equal(ed._cfg.image,undefined);
 assert.equal(ed._cfg.charging_image,undefined);
 assert.equal(ed._cfg.top_image,undefined);
});
test('charging view does not misrepresent a front-only asset as verified rear artwork',()=>{
 const car=new Card();car.setConfig({model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white'});
 const normal=car.assetSpec();assert.equal(normal.view_status,'highest_available_preview');
 car.hass={states:{'binary_sensor.my_xpeng_is_charging':{state:'on'}}};
 const charging=car.assetSpec();
 assert.equal(charging.view,'rear');
 assert.equal(charging.view_status,'front_fallback_rear_pending');
 assert.equal(charging.src,normal.src);
});
