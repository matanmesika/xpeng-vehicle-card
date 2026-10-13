const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
for (const file of ['src/xpeng-vehicle-card.js','dist/xpeng-vehicle-card.js']) {
 test(`${file}: charging cable is supplied by charging.webp, no neon static cable path`, () => {
   const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
   assert.match(content, /charging\\.webp/);
   assert.doesNotMatch(content, /class="xp-cable"/);
   assert.doesNotMatch(content, /stroke="#00e8b9"/);
   assert.doesNotMatch(content, /stroke="#2efad2"/);
 });
}
