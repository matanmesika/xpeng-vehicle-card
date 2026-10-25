const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const src=fs.readFileSync(path.join(root,'src/xpeng-vehicle-card.js'),'utf8');
const dist=fs.readFileSync(path.join(root,'dist/xpeng-vehicle-card.js'),'utf8');
const start=core.indexOf('function xpVehicleDataStatus(');
const end=core.indexOf('\nfunction xpBool(',start);
assert.ok(start>=0&&end>start,'freshness helper must exist');
const ctx={XP_INVALID:new Set(['unknown','unavailable','none','null',''])};
vm.runInNewContext(core.slice(start,end),ctx);
const status=(value,now)=>JSON.parse(JSON.stringify(ctx.xpVehicleDataStatus(value,now)));
const now=Date.parse('2026-10-25T14:00:00Z');

test('separate actual vehicle update age from transport connectivity',()=>{
 assert.deepEqual(status(null,now),{state:'unknown',age:'Unavailable',timestamp:null});
 assert.equal(status('unavailable',now).state,'unknown');
 assert.equal(status('invalid date',now).state,'unknown');
 assert.equal(status('2026-10-25T13:45:00Z',now).state,'recent');
 assert.equal(status('2026-10-25T12:00:00Z',now).state,'recent');
 assert.equal(status('2026-10-25T11:59:00Z',now).state,'old');
 assert.equal(status('2026-10-25T13:45:00Z',now).age,'15m ago');
 assert.equal(status('2026-10-25T11:45:00Z',now).age,'2h 15m ago');
 assert.equal(status('2026-10-25T14:10:00Z',now).state,'unknown');
 assert.equal(status('2026-10-25T14:03:00Z',now).age,'Just now');
 assert.equal(status('1792935900',now).state,'recent');
 assert.equal(status('1792935900000',now).state,'recent');
});

test('Wi-Fi popover shows two distinct statuses, age and source without claiming car online',()=>{
 const a=core.indexOf('\n header(){');
 const b=core.indexOf('\n progress(){',a);
 assert.ok(a>=0&&b>a);
 const view=core.slice(a,b);
 for(const s of ["this.data('connection')","this.val('last_update')","xpVehicleDataStatus(","'mqtt_connected'","Vehicle data","Data age","Last vehicle update","xp-stale","xp-unknown","Parked vehicles may sleep"]){
   assert.ok(view.includes(s),'Missing '+s);
 }
 assert.match(view,/data-meta-toggle/);
 assert.match(view,/aria-expanded=/);
 assert.doesNotMatch(view,/\.last_updated/);
});

test('same icon responsive styling and HACS bundles remain reproducible',()=>{
 assert.match(css,/\.xp-header \.xp-wifi\.xp-stale/);
 assert.match(css,/\.xp-header \.xp-wifi\.xp-unknown/);
 assert.match(css,/@container xpeng-layout \(max-width:520px\)/);
 assert.equal(src,dist);
 assert.equal(src,core.replace('const XP_CSS = "__XPENG_STYLES_FROM_THEME__";','const XP_CSS = `'+css+'\n`;'));
});
