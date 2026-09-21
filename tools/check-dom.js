'use strict';
/* Verifies that every element id referenced from JS exists in index.html */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const js = ['js/app.js', 'js/ui.js', 'js/storage.js']
  .map(function (f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }).join('\n');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ids = [];
let m;
const re = /getElementById\('([^']+)'\)/g;
while ((m = re.exec(js))) { if (ids.indexOf(m[1]) === -1) { ids.push(m[1]); } }
const missing = ids.filter(function (id) {
  if (id === 'fsfToast') { return false; }   /* created dynamically at runtime */
  return html.indexOf('id="' + id + '"') === -1;
});
console.log('IDs referenced:', ids.length);
console.log('missing:', missing.length ? missing.join(', ') : 'none');
['panel-flange', 'panel-stud', 'panel-history', 'panel-settings', 'panel-help',
  'comboFlangeSize', 'comboFlangeClass', 'comboFlangeFace', 'comboGasketType', 'comboStudDia'
].forEach(function (id) {
  console.log((html.indexOf('id="' + id + '"') > -1 ? 'OK   ' : 'MISS ') + id);
});
const scripts = html.match(/<script src="[^"]+"/g) || [];
console.log('script tags:\n  ' + scripts.join('\n  '));
process.exit(missing.length ? 1 : 0);
