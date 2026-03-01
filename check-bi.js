const fs = require('fs');
const path = 'C:/new.au-aris.org/apps/web/.next/static/chunks/app/(dashboard)/layout.js';
if (!fs.existsSync(path)) { console.log('layout.js not found - needs rebuild'); process.exit(0); }
const content = fs.readFileSync(path, 'utf8');
const soonMatches = content.match(/"Soon"/g);
console.log('"Soon" literal count:', soonMatches ? soonMatches.length : 0);
const disabledTrue = content.match(/disabled:\s*!0/g);
console.log('disabled:!0 (true) count:', disabledTrue ? disabledTrue.length : 0);

// Find where "Soon" appears in context
const idx = content.indexOf('"Soon"');
if (idx > -1) {
  console.log('\nContext around "Soon":');
  console.log(content.substring(Math.max(0, idx - 100), idx + 100));
}
