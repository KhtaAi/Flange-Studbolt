'use strict';
/* Extracts and prints the TESTLOG line written by tools/ui-test.html:
   node tools/read-ui-log.js <dump-file>                                  */
const fs = require('fs');
const file = process.argv[2] || (process.env.TEMP + '/ui.txt');
const t = fs.readFileSync(file, 'utf8');
const marker = 'TESTLOG::';
const idx = t.lastIndexOf(marker);
if (idx < 0) { console.log('NO TESTLOG FOUND in ' + file); process.exit(1); }
const end = t.indexOf('</pre>', idx);
console.log(t.slice(idx, end < 0 ? idx + 800 : end));
