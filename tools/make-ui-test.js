'use strict';
/* Builds a diagnostic copy of index.html that reports boot state:
   node tools/make-ui-test.js
   then: chrome --headless --dump-dom tools/ui-test.html                        */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const driver = [
  '<script>',
  'window.__err = [];',
  'window.__log = [];',
  'var _ce = console.error;',
  'console.error = function () { window.__log.push(Array.prototype.map.call(arguments, String).join(" ")); _ce.apply(console, arguments); };',
  'window.addEventListener("error", function (e) { window.__err.push("ERR:" + e.message); });',
  'window.addEventListener("load", function () {',
  '  var tries = 0;',
  '  var timer = setInterval(function () {',
  '    var badge = document.getElementById("dataSourceBadge");',
  '    var ready = badge && badge.textContent.indexOf("رکورد") > -1;',
  '    if (!ready && ++tries < 60) { return; }',
  '    clearInterval(timer);',
  '    var log = [];',
  '    try {',
  '      log.push("boot=" + (ready ? "ok" : "timeout"));',
  '      var panelIds = ["flange", "stud", "history", "settings", "help"];',
  '      panelIds.forEach(function (id) {',
  '        document.getElementById("tab-" + id).click();',
  '        var p = document.getElementById("panel-" + id);',
  '        var rect = p.getBoundingClientRect();',
  '        var visible = !p.hidden && p.offsetParent !== null && rect.height > 40;',
  '        var leak = panelIds.filter(function (o) { return o !== id; }).some(function (o) {',
  '          return document.getElementById("panel-" + o).offsetParent !== null;',
  '        });',
  '        log.push(id + "=" + (visible ? "VISIBLE" : "INVISIBLE") + "(h=" + Math.round(rect.height) +',
  '          ",len=" + p.textContent.trim().length + ",leak=" + leak + ")");',
  '      });',
  '      document.getElementById("tab-flange").click();',
  '      log.push("visibleAfterFlange=" + panelIds.filter(function (o) {',
  '        return document.getElementById("panel-" + o).offsetParent !== null;',
  '      }).join("+"));',
  '      log.push("data=" + FSF.data.sizes.length + "/" + FSF.data.bolting.length + "/" + FSF.data.wrench.length);',
  '      var rec = FSF.Calc.findBolting(FSF.Calc.resolveSize("6"), 300, "RF")[0];',
  '      document.getElementById("flangeResult").innerHTML = FSF.UI.flangeCardHtml(rec, { gasketType: "spiral_wound" });',
  '      var ftxt = document.getElementById("flangeResult").textContent;',
  '      ["12", "3/4", "120.7", "32", "1-1/4", "35.1"].forEach(function (v) {',
  '        log.push("flange[" + v + "]=" + (ftxt.indexOf(v) > -1 ? "ok" : "MISS"));',
  '      });',
  '      var st = FSF.Calc.resolveStud("3/4", "inch");',
  '      document.getElementById("studResult").innerHTML = FSF.UI.studCardHtml(st, "inch");',
  '      var stxt = document.getElementById("studResult").textContent;',
  '      ["19.05", "32", "1-1/4", "18.64", "31.75"].forEach(function (v) {',
  '        log.push("stud[" + v + "]=" + (stxt.indexOf(v) > -1 ? "ok" : "MISS"));',
  '      });',
  '      var two = FSF.Calc.findBolting(FSF.Calc.resolveSize("2"), 150, "RF")[0];',
  '      log.push("2in_wrench=" + (two && two.wrench_size_mm) + "mm/" + (two && two.wrench_size_inch));',
  '      var big = FSF.Calc.findBolting(FSF.Calc.resolveSize("36"), 150, "RF");',
  '      log.push("36in_records=" + big.length);',
  '      log.push("history=" + FSF.Store.loadHistory().length);',
  '      log.push("favorites=" + FSF.Store.loadFavorites().length);',
  '      log.push("csv=" + FSF.Utils.toCsv(FSF.UI.flangeRows([rec])).split("\\r\\n").length);',
  '    } catch (e) { log.push("ERROR=" + e.message); }',
  '    log.push("consoleErrors=" + (window.__log.length ? window.__log.join(";") : "none"));',
  '    log.push("uncaught=" + (window.__err.length ? window.__err.join(";") : "none"));',
  '    var pre = document.createElement("pre");',
  '    pre.id = "diag";',
  '    pre.textContent = "DIAG::" + log.join(" | ");',
  '    document.body.appendChild(pre);',
  '  }, 250);',
  '});',
  '</script>'
].join('\n');



fs.writeFileSync(path.join(ROOT, 'ui-test.html'), html.replace('</body>', driver + '\n</body>'), 'utf8');
console.log('wrote ui-test.html (project root, so relative script paths resolve)');
