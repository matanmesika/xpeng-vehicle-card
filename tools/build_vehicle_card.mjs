#!/usr/bin/env node
/**
 * Build XPENG card from TWO independent maintained sources:
 *   src/core/xpeng-vehicle-card.runtime.js - vehicle state, actions and views
 *   src/design/xpeng-vehicle-card.css - every styling rule
 *
 * The HACS/browser entrypoints are generated, self-contained JS files.
 * This removes duplicate/manual CSS edits in the runtime and distribution.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const core=readFileSync(join(root,'src/core/xpeng-vehicle-card.runtime.js'),'utf8');
const theme=readFileSync(join(root,'src/design/xpeng-vehicle-card.css'),'utf8');
const slot='const XP_CSS = "__XPENG_STYLES_FROM_THEME__";';
if(core.split(slot).length!==2)throw new Error('Missing or duplicated CSS slot in runtime');
if(theme.includes('`')||theme.includes('${')||theme.includes('\\'))
 throw new Error('Stylesheet has forbidden template-literal characters; update escaping in build script before continuing');
const compiled=core.replace(slot,'const XP_CSS = `'+theme+'\n`;');
const targets=['src/xpeng-vehicle-card.js','dist/xpeng-vehicle-card.js'];
const check=process.argv.includes('--check');
if(check){
 for(const target of targets){
  const actual=readFileSync(join(root,target),'utf8');
  if(actual!==compiled)throw new Error('Generated bundle is stale: '+target+'. Run node tools/build_vehicle_card.mjs.');
 }
 console.log('PASS: both generated entrypoints reproduce isolated runtime+CSS byte for byte');
}else{
 for(const target of targets)writeFileSync(join(root,target),compiled,'utf8');
 console.log('Generated both XPENG card entrypoints from isolated design and core');
}
