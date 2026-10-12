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
 const card=new Card(),prefix='/hacsfiles/xpeng-vehicle-card/assets/';
 let checked=0;
 for(const p of profiles.profiles){
  for(const trim of p.trims){
   for(const color of p.paint_options){
    card.setConfig({prefix:'my_xpeng',model:p.model,year:p.year,trim,color,interior:p.interior_options[0]});
    const spec=card.assetSpec();
    if(spec.src.startsWith('data:image/svg+xml')){
      assert.match(spec.description,/Coloured silhouette/);
      assert.equal(spec.illustrative,true);
    }else{
      assert.ok(spec.src.startsWith(prefix),spec.src);
      const sourcePath=path.join(ROOT,'dist/assets',spec.src.slice(prefix.length));
      assert.ok(fs.existsSync(sourcePath),p.display_name+' '+trim+' '+color+' missing: '+sourcePath);
      assert.equal(spec.illustrative,true);
    }
    checked++;
   }
  }
 }
 assert.ok(checked>=200,checked);
});

test('any unknown-year image is clearly labelled illustrative, no false official claim',()=>{
 const card=new Card();
 card.setConfig({model:'G9',year:'2024',color:'arctic_white'});
 assert.equal(card.assetSpec().illustrative,true);
 assert.match(card.assetSpec().description,/Generic model-family/);
 assert.match(card.shadowRoot.innerHTML,/illustrative artwork/); // clearly disclosed via accessible image alt without visual watermark
 card.setConfig({model:'G9',year:'2026',color:'kaitoke_green_matte'});
 assert.match(card.asset(),/^data:image\/svg\+xml/);
});

test('the approved background stays byte-for-byte frozen and shared between status and charging',()=>{
 const expectedGitBlob='cc33b657c1785d1dbad0cb943a38ea4275a8435d';
 const file=path.join(ROOT,'dist/assets/xpeng-reference-background.webp');
 const raw=fs.readFileSync(file);
 const blob=crypto.createHash('sha1')
    .update(Buffer.from('blob '+raw.length)).update(Buffer.from([0]))
   .update(raw).digest('hex');
 assert.equal(blob,expectedGitBlob,
   'Backdrop was changed without explicit owner approval; restore approved pixels');
 const root=fs.readFileSync(path.join(ROOT,'assets/xpeng-reference-background.webp'));
 assert.ok(root.equals(raw),'Root and HACS background must be byte-identical');
 const card=new Card();card.setConfig({model:'G6',year:'2026',color:'arctic_white'});
 const idle=card.sceneBackdrop();
 card.hass={states:{'binary_sensor.my_xpeng_is_charging':{state:'on'}}};
 const active=card.sceneBackdrop();
 assert.equal(idle,active);
 assert.ok(idle.includes('xpeng-reference-background.webp'));
 assert.equal((idle.match(/xp-night-photo/g)||[]).length,1);
 assert.ok(!source.includes('night-mountain-scene.svg'));
});
test('new 2026 G9 uses the actual bundled year/trim/paint-specific preview',()=>{
 const card=new Card();
 for(const trim of ['unspecified','standard_range_rwd','long_range_rwd','performance_awd']){
   for(const paint of ['arctic_white','graphite_gray','midnight_black','silver_frost']){
     card.setConfig({model:'G9',year:'2026',trim,color:paint});
     const art=card.assetSpec();
     assert.ok(art.src.endsWith('/vehicles/g9/2026/'+trim+'/'+paint+'.webp'),art.src);
     assert.equal(art.illustrative,true);
     const rel=art.src.replace('/hacsfiles/xpeng-vehicle-card/assets/','');
     assert.ok(fs.existsSync(path.join(ROOT,'dist/assets',rel)),art.src);
   }
 }
 // This colour is allowed by the catalogue but has no model-year verified art yet.
 card.setConfig({model:'G9',year:'2026',trim:'long_range_rwd',color:'kaitoke_green_matte'});
 assert.ok(card.assetSpec().src.startsWith('data:image/svg+xml'));
 assert.match(card.assetSpec().description,/artwork pending/);
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
