'use strict';
// The HACS page (rendered README) opens with the official XPENG logo, served from
// this repository on a light tile so it is readable in light and dark themes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('README opens with the repository-hosted XPENG logo',()=>{
 const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
 assert.match(readme,/^<img src="https:\/\/raw\.githubusercontent\.com\/matanmesika\/xpeng-vehicle-card\/main\/assets\/brand\/xpeng-logo\.svg"/);
 const logo=fs.readFileSync(path.join(root,'assets/brand/xpeng-logo.svg'),'utf8');
 assert.match(logo,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(logo,/<rect [^>]*fill="#ffffff"/,'light tile keeps the logo readable in dark themes');
});
