'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

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
 assert.match(card.shadowRoot.innerHTML,/illustrative artwork/); // descriptive alt, no watermark
 card.setConfig({model:'G9',year:'2026',color:'kaitoke_green_matte'});
 assert.match(card.asset(),/^data:image\/svg\+xml/);
});
