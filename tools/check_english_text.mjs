#!/usr/bin/env node
// English-only source and documentation guard for the XPENG dashboard.
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const included=new Set(['.js','.cjs','.mjs','.css','.md']);
const files=['README.md'];
const scan=dir=>{
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory())scan(path);
  else if([...included].some(ext=>entry.name.endsWith(ext)))files.push(path);
 }
};
for(const folder of ['src','docs','scripts','tests','tools'])scan(folder);
const violations=[];
for(const file of files){
 const lines=readFileSync(file,'utf8').split(/\r?\n/);
 lines.forEach((line,index)=>{
  // Unicode U+0590..U+05FF indicates an accidental hardcoded Hebrew label.
  // Escaped Unicode sequences inside a test remain ASCII and are allowed.
  if(/[\u0590-\u05ff]/u.test(line))
   violations.push(file+':'+(index+1));
 });
}
if(violations.length){
 console.error('English-only audit failed. Non-English interface text in:\n'+violations.join('\n'));
 process.exitCode=1;
}else console.log('PASS: English-only source, tests and documentation ('+files.length+' files)');
