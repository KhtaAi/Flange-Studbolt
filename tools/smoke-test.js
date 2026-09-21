'use strict';
/* Headless smoke test for the core logic (no browser needed):
 *   node tools/smoke-test.js
 * Loads the same files the browser loads (minus DOM-only modules) and asserts
 * known engineering values from the dataset.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

global.window = global;          /* the scripts attach FSF to window */
function load(rel) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), { filename: rel });
}
load('data/data-embedded.js');
load('js/search.js');
load('js/calculations.js');

const FSF = global.FSF;
FSF.data = {
  sizes: FSF.FSF_DATA ? null : null
};
FSF.data = {
  sizes: global.window.FSF_DATA.sizes.sizes,
  bolting: global.window.FSF_DATA.bolting.records,
  wrench: global.window.FSF_DATA.wrench.records
};

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function eq(name, actual, expected) {
  ok(name, String(actual) === String(expected), 'got=' + actual + ' want=' + expected);
}

const C = FSF.Calc, U = FSF.Utils;

console.log('== utils ==');
eq('parseNumeric 3/4', U.parseNumeric('3/4'), 0.75);
eq('parseNumeric 1-3/4', U.parseNumeric('1-3/4'), 1.75);
eq('parseNumeric 0.75', U.parseNumeric('0.75'), 0.75);
eq('parseNumeric persian digit', U.parseNumeric('۳/۴'), 0.75);
eq('parseSizeNumeric 1/2', U.parseSizeNumeric('1/2'), 0.5);
eq('parseSizeNumeric 1 2', U.parseSizeNumeric('1 2'), 0.5);
eq('parseSizeNumeric 1-1/4', U.parseSizeNumeric('1-1/4'), 1.25);
eq('parseSizeNumeric 1-1 4', U.parseSizeNumeric('1-1 4'), 1.25);
eq('parseSizeNumeric 1 1/4', U.parseSizeNumeric('1 1/4'), 1.25);
eq('parseSizeNumeric 12', U.parseSizeNumeric('12'), 12);
eq('parseSizeNumeric 2-1/2', U.parseSizeNumeric('2-1/2'), 2.5);
eq('parseSizeNumeric DN150 is null', U.parseSizeNumeric('DN150'), null);
eq('parseSizeNumeric M20 is null', U.parseSizeNumeric('M20'), null);
eq('inchToFraction 1.75', U.inchToFraction(1.75), '1-3/4');
eq('inchToFraction 0.875', U.inchToFraction(0.875), '7/8');
eq('searchKey 1-1/4 == 11/4', U.searchKey('1-1/4') === U.searchKey('11/4'), true);

console.log('== size resolution ==');
eq('resolveSize "6"', C.resolveSize('6').dn, 150);
eq('resolveSize "6\\""', C.resolveSize('6"').dn, 150);
eq('resolveSize "DN150"', C.resolveSize('DN150').nps_inch, '6');
eq('resolveSize "150"', C.resolveSize('150').nps_inch, '6');
eq('resolveSize "1/2"', C.resolveSize('1/2').dn, 15);
eq('resolveSize "12"', C.resolveSize('12').dn, 300);
eq('resolveSize "1-1/4"', C.resolveSize('1-1/4').dn, 32);
eq('resolveSize "1 1/4"', C.resolveSize('1 1/4').dn, 32);
eq('resolveSize "0.5"', C.resolveSize('0.5').dn, 15);
eq('resolveSize "24"', C.resolveSize('24').dn, 600);
eq('resolveSize "600"', C.resolveSize('600').nps_inch, '24');
eq('resolveSize "60"', C.resolveSize('60').dn, 1500);
eq('resolveSize "2-1/2"', C.resolveSize('2-1/2').dn, 65);

console.log('== bolting lookup (ASME B16.5) ==');
const b1_2_cl300 = C.findBolting(C.sizeRecord('1/2'), 300, 'RF');
eq('findBolting 1/2 CL300 RF count', b1_2_cl300.length, 1);
eq('findBolting 1/2 CL300 RF size', b1_2_cl300[0] && b1_2_cl300[0].nps_inch, '1/2');
const b12_cl300 = C.findBolting(C.sizeRecord('12'), 300, 'RF');
eq('findBolting 12 CL300 RF count', b12_cl300.length, 1);
eq('findBolting 12 CL300 RF size', b12_cl300[0] && b12_cl300[0].nps_inch, '12');
const b112_cl150 = C.findBolting(C.sizeRecord('1-1/2'), 150, 'RF');
eq('findBolting 1-1/2 CL150 RF count', b112_cl150.length, 1);
eq('findBolting 1-1/2 CL150 RF size', b112_cl150[0] && b112_cl150[0].nps_inch, '1-1/2');

const s6 = C.resolveSize('6');
const c150 = C.findBolting(s6, 150, 'RF');
eq('6" CL150 RF count', c150.length, 1);
eq('6" CL150 bolts', c150[0].number_of_bolts, 8);
eq('6" CL150 bolt dia', c150[0].bolt_diameter_inch, '3/4');
eq('6" CL150 stud length mm', c150[0].standard_stud_length_mm, 101.6);
const c300rtj = C.findBolting(s6, 300, 'RTJ');
eq('6" CL300 RTJ length', c300rtj[0].standard_stud_length_mm, 139.7);
eq('6" CL300 RTJ extra vs RF', c300rtj[0].stud_length_extra_vs_rf_mm, 19);
const c24 = C.findBolting(C.resolveSize('24'), 150, 'RF');
eq('24" CL150 bolts', c24[0].number_of_bolts, 20);
eq('24" CL150 bolt dia', c24[0].bolt_diameter_inch, '1-1/4');
eq('availableClasses NPS6', C.availableClasses(s6).join(','), '150,300,400,600,900,1500,2500');
eq('2500 not available for NPS16', C.availableClasses(C.resolveSize('16')).indexOf(2500), -1);
eq('missing combo (NPS22)', C.findBolting(C.resolveSize('22'), 150, 'RF').length, 0);

console.log('== bolting lookup (ASME B16.47) ==');
const s36 = C.resolveSize('36');
const isA = function (r) { return String(r.series).slice(-1) === 'A'; };
const isB = function (r) { return String(r.series).slice(-1) === 'B'; };
const a150 = C.findBolting(s36, 150, 'RF').filter(isA);
eq('36" B16.47-A CL150 bolts', a150[0].number_of_bolts, 32);
eq('36" B16.47-A CL150 bolt dia', a150[0].bolt_diameter_inch, '1-1/2');
eq('36" B16.47-A CL150 length', a150[0].standard_stud_length_mm, 279);
const b600 = C.findBolting(s36, 600, 'RF').filter(isB);
eq('36" B16.47-B CL600 thickness', b600[0].flange_thickness_mm, 152.45);
eq('two series returned for 36"', C.findBolting(s36, 150, 'RF').length, 2);

console.log('== stud / wrench lookup ==');
const st34 = C.resolveStud('3/4', 'inch');
ok('resolveStud 3/4 record found', !!st34.record);
eq('3/4" wrench mm', st34.record.wrench_size_mm, 32);
eq('3/4" wrench inch', st34.record.wrench_size_inch, '1-1/4');
eq('3/4" AF mm', st34.record.nut_across_flats_mm, 31.75);
eq('3/4" nut height mm', st34.record.nut_height_mm, 18.64);
eq('3/4" regular hex AF', st34.record.alt_nut_across_flats_mm, 28.58);
const st19 = C.resolveStud('19', 'mm');
ok('19 mm maps to 3/4" stud', st19.record && st19.record.bolt_diameter_inch === '3/4', JSON.stringify(st19.record && st19.record.bolt_diameter_inch));
const st19_05 = C.resolveStud('19.05', 'mm');
ok('19.05 mm maps to 3/4" stud', st19_05.record && st19_05.record.bolt_diameter_inch === '3/4');
const st20 = C.resolveStud('M20', 'mm');
eq('M20 AF', st20.record.nut_across_flats_mm, 30);
eq('M20 wrench', st20.record.wrench_size_mm, 30);
const st0_75 = C.resolveStud('0.75', 'inch');
ok('0.75 inch maps to 3/4"', st0_75.record && st0_75.record.bolt_diameter_inch === '3/4');

console.log('== stud length calculation ==');
const settings = {
  thread_projection_mm: 6, spiral_wound_gasket_thickness_mm: 4.5,
  flange_count: 2, round_stud_length: 'up_1mm', nut_height_method: 'heavy_hex_table',
  flat_gasket_thickness_mm: 3, rtj_gasket_thickness_mm: 12.7, custom_gasket_thickness_mm: 4.5
};
const bd = C.studLengthBreakdown(c150[0], settings, 'spiral_wound');
eq('6" CL150 calc raw', bd.raw, 101.58);
eq('6" CL150 calc rounded', bd.rounded, 102);
eq('6" CL150 standard', bd.standard, 101.6);
eq('6" CL150 delta', bd.delta, 0.4);
eq('nut height source', bd.nutHeight, 18.64);
const bdFlat = C.studLengthBreakdown(c150[0], settings, 'flat');
eq('flat gasket thickness used', bdFlat.gasket, 3);
const bdRtj = C.studLengthBreakdown(c300rtj[0], settings, 'rtj');
eq('rtj gasket thickness used', bdRtj.gasket, 12.7);

console.log('== hole count lookup ==');
const availHoles = C.availableHoleCounts();
ok('availableHoleCounts has items', availHoles.length > 10);
ok('availableHoleCounts includes 4', availHoles.indexOf(4) !== -1);
ok('availableHoleCounts includes 32', availHoles.indexOf(32) !== -1);
ok('availableHoleCounts is sorted', availHoles[0] < availHoles[availHoles.length - 1]);
const stats = C.holeCountStats();
ok('stats has 32 count', typeof stats[32] === 'number' && stats[32] > 0);
const nearest = C.findNearestHoleCounts(30, 2);
ok('nearest to 30 includes 28 or 32', nearest.indexOf(28) !== -1 || nearest.indexOf(32) !== -1);
const res32 = C.findByHoleCount(32);
eq('findByHoleCount(32) holeCount', res32.holeCount, 32);
ok('findByHoleCount(32) groups found', res32.groups.length > 0);
const g0 = res32.groups[0];
ok('group has bolt_diameter_inch', !!g0.bolt_diameter_inch);
ok('group has wrench_size_mm', typeof g0.wrench_size_mm === 'number');
ok('group has items', g0.items.length > 0);
eq('group items have 32 holes', g0.items[0].number_of_bolts, 32);
const res999 = C.findByHoleCount(999);
eq('res999 has 0 groups', res999.groups.length, 0);

console.log('== RTJ ring lookup ==');
const ring6_300 = C.rtjRingInfo('6', 300);
ok('rtjRingInfo 6" CL300 defined', !!ring6_300);
eq('rtjRingInfo 6" CL300 ring_number', ring6_300 && ring6_300.ring_number, 'R41');
eq('rtjRingInfo 6" CL300 standard', ring6_300 && ring6_300.standard, 'ASME B16.20');

const ringHalf_150 = C.rtjRingInfo('1/2', 150);
eq('rtjRingInfo 1/2" CL150', ringHalf_150 && ringHalf_150.ring_number, 'R11');

const ringHalf_600 = C.rtjRingInfo('1/2', 600);
eq('rtjRingInfo 1/2" CL600', ringHalf_600 && ringHalf_600.ring_number, 'R12');

const ringHalf_2500 = C.rtjRingInfo('1/2', 2500);
eq('rtjRingInfo 1/2" CL2500', ringHalf_2500 && ringHalf_2500.ring_number, 'R16');

const ring24_900 = C.rtjRingInfo('24', 900);
eq('rtjRingInfo 24" CL900', ring24_900 && ring24_900.ring_number, 'R73');

const ring14_2500 = C.rtjRingInfo('14', 2500);
eq('rtjRingInfo 14" CL2500 is null', ring14_2500, null);

const ring36_150_b1647 = C.rtjRingInfo('36', 150, 'ASME B16.47');
eq('rtjRingInfo 36" CL150 ASME B16.47 is null', ring36_150_b1647, null);

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
