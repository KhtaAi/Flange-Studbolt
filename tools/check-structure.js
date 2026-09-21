'use strict';
/* Reports the nesting of <section>/<main>/<div> tags in index.html so a broken
   structure (a panel nested inside another panel) becomes visible:
   node tools/check-structure.js                                        */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lines = html.split('\n');
const VOID = /^(meta|link|br|hr|img|input|source|area|base|col|embed|param|track|wbr)$/i;
const WATCH = /^(section|main|div|article|nav|header|footer|ul|table|pre)$/i;
const stack = [];
let depth = 0;
lines.forEach(function (line, idx) {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(line))) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (!WATCH.test(name)) { continue; }
    if (VOID.test(name) || /\/\s*$/.test(attrs)) { continue; }
    if (closing) {
      let matched = false;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name === name) {
          if (i !== stack.length - 1) {
            console.log('WARN line ' + (idx + 1) + ': </' + name + '> closes early; still open: ' +
              stack.slice(i + 1).map(function (s) { return s.name + '@' + s.line; }).join(' > '));
          }
          stack.length = i;
          matched = true;
          break;
        }
      }
      if (!matched) { console.log('WARN line ' + (idx + 1) + ': stray </' + name + '> with no open tag'); }
    } else {
      if (/^section$/i.test(name)) {
        console.log('OPEN section line ' + (idx + 1) + ' id=' +
          ((attrs.match(/id="([^"]+)"/) || [])[1] || '-') +
          ' | parents: ' + (stack.map(function (s) { return s.name + '@' + s.line; }).join(' > ') || 'root'));
      }
      if (/^(main|footer)$/i.test(name)) {
        console.log('OPEN ' + name + ' line ' + (idx + 1) + ' | parents: ' +
          (stack.map(function (s) { return s.name + '@' + s.line; }).join(' > ') || 'root'));
      }
      stack.push({ name: name, line: idx + 1 });
      depth++;
    }
  }
});
console.log('--- still open at EOF: ' + (stack.map(function (s) { return s.name + '@' + s.line; }).join(' > ') || 'none'));
