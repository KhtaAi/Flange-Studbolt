'use strict';
/* ============================================================================
 * Flange & Stud Bolt Finder - DATA BUILDER (developer tool, NOT needed at runtime)
 * ----------------------------------------------------------------------------
 * Usage (optional):  node tools/generate-data.js
 *
 * It converts the verified compact tables below into the app data files:
 *   data/flange-sizes.json      data/flange-bolting.json
 *   data/stud-wrench-map.json   data/settings.json
 *   data/data-embedded.js       (offline fallback: same data as JS globals,
 *                                needed because browsers block fetch() on file://)
 *
 * Source tables encoded here (extracted from public engineering reference tables):
 *  - ASME B16.5 bolt count / bolt diameter / stud length (RF and RTJ), class 150-2500
 *  - ASME B16.5 class 400 bolting + stud length (mm)
 *  - ASME B16.5 min. flange thickness, class 150/300/400/600/900/1500/2500 (mm)
 *  - ASME B16.47 Series A / Series B, class 150/300/400/600/900: thickness +
 *    stud bolt data for NPS 26-60 (mm)
 *  - ASME B18.2.2 heavy hex nut width across flats + thickness (inch) 1/4"-4"
 *  - ISO 4032 / ISO 4033 metric nuts M12-M56
 *
 * ENGINEERING NOTE: records flagged confidence:"medium" (or carrying a note)
 * must be verified against the latest edition of the standard and the project
 * specification before field use.
 * ==========================================================================*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data');
const MM = 25.4;

/* ----------------------------- helpers ---------------------------------- */
function fracToIn(s) {
  if (s === null || s === undefined || s === '') return null;
  if (typeof s === 'number') return s;
  let t = String(s).trim().replace(/["']/g, '').replace(/\s+/g, '');
  if (/^-?\d*\.?\d+$/.test(t)) return parseFloat(t);
  let sign = 1;
  if (t.startsWith('-')) { sign = -1; t = t.slice(1); }
  let whole = 0;
  const m = t.match(/^(\d+)[-](.+)$/);
  if (m) { whole = parseInt(m[1], 10); t = m[2]; }
  const f = t.split('/');
  if (f.length === 2) return sign * (whole + parseInt(f[0], 10) / parseInt(f[1], 10));
  return null;
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function inToFrac(x, denomMax) {
  denomMax = denomMax || 32;
  if (x === 0 || x === null) return '0';
  const sign = x < 0 ? -1 : 1; x = Math.abs(x);
  let whole = Math.floor(x);
  let rem = x - whole;
  let n = Math.round(rem * denomMax), d = denomMax;
  const g = gcd(n, d) || 1; n /= g; d /= g;
  if (n === d) { whole += 1; n = 0; d = 1; }
  let out = '';
  if (whole) out += whole;
  if (n) out += (out ? '-' : '') + n + '/' + d;
  return (sign < 0 ? '-' : '') + (out || '0');
}
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const in2mm = (i) => (i === null || i === undefined ? null : r2(i * MM));

/* --------------------------- NPS <-> DN table --------------------------- */
const NPS_DN = [
  ['1/2', 15], ['3/4', 20], ['1', 25], ['1-1/4', 32], ['1-1/2', 40], ['2', 50],
  ['2-1/2', 65], ['3', 80], ['3-1/2', 90], ['4', 100], ['5', 125], ['6', 150],
  ['8', 200], ['10', 250], ['12', 300], ['14', 350], ['16', 400], ['18', 450],
  ['20', 500], ['22', 550], ['24', 600], ['26', 650], ['28', 700], ['30', 750],
  ['32', 800], ['34', 850], ['36', 900], ['38', 950], ['40', 1000], ['42', 1050],
  ['44', 1100], ['46', 1150], ['48', 1200], ['50', 1250], ['52', 1300],
  ['54', 1350], ['56', 1400], ['58', 1450], ['60', 1500]
];
const DN_OF = {}; NPS_DN.forEach(function (p) { DN_OF[p[0]] = p[1]; });

/* ------------- ASME B16.5 minimum flange thickness (mm) ------------------ */
const B165_THICK = {
  150: { '1/2': 9.7, '3/4': 11.2, '1': 12.7, '1-1/4': 14.2, '1-1/2': 15.9, '2': 17.5, '2-1/2': 20.6, '3': 22.4, '3-1/2': 22.4, '4': 22.4, '5': 22.4, '6': 23.9, '8': 26.9, '10': 28.4, '12': 30.2, '14': 33.3, '16': 35.1, '18': 38.1, '20': 41.1, '22': 44.4, '24': 46.0 },
  300: { '1/2': 12.7, '3/4': 14.2, '1': 15.7, '1-1/4': 17.5, '1-1/2': 19.0, '2': 20.6, '2-1/2': 23.9, '3': 26.9, '3-1/2': 28.4, '4': 30.2, '5': 33.3, '6': 35.1, '8': 39.6, '10': 46.0, '12': 49.3, '14': 52.3, '16': 55.6, '18': 58.7, '20': 62.0, '22': 65.0, '24': 68.3 },
  400: { '1/2': 14.2, '3/4': 15.7, '1': 17.5, '1-1/4': 20.6, '1-1/2': 22.4, '2': 25.4, '2-1/2': 28.4, '3': 31.8, '3-1/2': 35.1, '4': 35.1, '5': 38.1, '6': 41.1, '8': 47.8, '10': 53.8, '12': 57.2, '14': 60.5, '16': 63.5, '18': 66.5, '20': 69.8, '22': 73.2, '24': 76.2 },
  600: { '1/2': 14.2, '3/4': 15.7, '1': 17.5, '1-1/4': 20.6, '1-1/2': 22.4, '2': 25.4, '2-1/2': 28.4, '3': 31.8, '3-1/2': 35.1, '4': 38.1, '5': 44.5, '6': 47.6, '8': 55.6, '10': 63.5, '12': 66.7, '14': 69.8, '16': 76.2, '18': 82.6, '20': 88.9, '22': 95.3, '24': 101.6 },
  900: { '1/2': 22.4, '3/4': 25.4, '1': 28.4, '1-1/4': 28.4, '1-1/2': 31.8, '2': 38.1, '2-1/2': 41.1, '3': 38.1, '3-1/2': 44.5, '4': 44.5, '5': 50.8, '6': 55.6, '8': 63.5, '10': 69.8, '12': 79.2, '14': 85.9, '16': 88.9, '18': 101.6, '20': 108.0 },
  1500: { '1/2': 22.4, '3/4': 25.4, '1': 28.4, '1-1/4': 28.4, '1-1/2': 31.8, '2': 38.1, '2-1/2': 41.1, '3': 47.8, '3-1/2': 53.8, '4': 53.8, '5': 73.2, '6': 82.6, '8': 91.9, '10': 108.0, '12': 124.0, '14': 133.4, '16': 146.0, '18': 162.1, '20': 177.8, '24': 203.2 },
  2500: { '1/2': 30.2, '3/4': 31.8, '1': 35.1, '1-1/4': 38.1, '1-1/2': 44.4, '2': 50.8, '2-1/2': 57.2, '3': 66.5, '4': 76.2, '5': 91.9, '6': 108.0, '8': 127.0, '10': 165.1, '12': 184.2 }
};

/* ---- ASME B16.5 bolting: [NPS, qty, bolt dia (in), stud RF (in), stud RTJ (in)]
   Source: published ASME B16.5 bolt chart, inch units, RF and RTJ columns.
   RTJ is null where the reference chart leaves the RTJ cell empty.           */
const B165_BOLTS = {
  150: [
    ['1/2', 4, '0.50', '2-1/4', null], ['3/4', 4, '0.50', '2-1/2', null],
    ['1', 4, '0.50', '2-1/2', '3'], ['1-1/4', 4, '0.50', '2-3/4', '3-1/4'],
    ['1-1/2', 4, '0.50', '2-3/4', '3-1/4'], ['2', 4, '0.63', '3-1/4', '3-3/4'],
    ['2-1/2', 4, '0.63', '3-1/2', '4'], ['3', 4, '0.63', '3-1/2', '4'],
    ['3-1/2', 8, '0.63', '3-1/2', '4'], ['4', 8, '0.63', '3-1/2', '4'],
    ['5', 8, '0.75', '3-3/4', '4-1/4'], ['6', 8, '0.75', '4', '4-1/2'],
    ['8', 8, '0.75', '4-1/4', '4-3/4'], ['10', 12, '0.88', '4-1/2', '5'],
    ['12', 12, '0.88', '4-3/4', '5-1/4'], ['14', 12, '1.00', '5-1/4', '5-3/4'],
    ['16', 16, '1.00', '5-1/4', '5-3/4'], ['18', 16, '1.13', '5-3/4', '6-1/4'],
    ['20', 20, '1.13', '6-1/4', '6-3/4'], ['24', 20, '1.25', '6-3/4', '7-1/4']
  ],
  300: [
    ['1/2', 4, '0.50', '2-1/2', '3'], ['3/4', 4, '0.63', '3', '3-1/2'],
    ['1', 4, '0.63', '3', '3-1/2'], ['1-1/4', 4, '0.63', '3-1/4', '3-3/4'],
    ['1-1/2', 4, '0.75', '3-1/2', '4'], ['2', 8, '0.63', '3-1/2', '4'],
    ['2-1/2', 8, '0.75', '4', '4-1/2'], ['3', 8, '0.75', '4-1/4', '4-3/4'],
    ['3-1/2', 8, '0.75', '4-1/4', '5'], ['4', 8, '0.75', '4-1/2', '5'],
    ['5', 8, '0.75', '4-3/4', '5-1/4'], ['6', 12, '0.75', '4-3/4', '5-1/2'],
    ['8', 12, '0.88', '5-1/2', '6'], ['10', 16, '1.00', '6-1/4', '6-3/4'],
    ['12', 16, '1.13', '6-3/4', '7-1/4'], ['14', 20, '1.13', '7', '7-1/2'],
    ['16', 20, '1.25', '7-1/2', '8'], ['18', 24, '1.25', '7-3/4', '8-1/4'],
    ['20', 24, '1.25', '8', '8-3/4'], ['24', 24, '1.50', '9', '10']
  ],
  600: [
    ['1/2', 4, '0.50', '3', '3'], ['3/4', 4, '0.63', '3-1/2', '3-1/2'],
    ['1', 4, '0.63', '3-1/2', '3-1/2'], ['1-1/4', 4, '0.63', '3-3/4', '3-3/4'],
    ['1-1/2', 4, '0.75', '4-1/4', '4-1/4'], ['2', 8, '0.63', '4-1/4', '4-1/4'],
    ['2-1/2', 8, '0.75', '4-3/4', '4-3/4'], ['3', 8, '0.75', '5', '5'],
    ['3-1/2', 8, '0.88', '5-1/2', '5-1/2'], ['4', 8, '0.88', '5-3/4', '5-3/4'],
    ['5', 8, '1.00', '6-1/2', '6-1/2'], ['6', 12, '1.00', '6-3/4', '6-3/4'],
    ['8', 12, '1.13', '7-1/2', '7-3/4'], ['10', 16, '1.25', '8-1/2', '8-1/2'],
    ['12', 20, '1.25', '8-3/4', '8-3/4'], ['14', 20, '1.38', '9-1/4', '9-1/4'],
    ['16', 20, '1.50', '10', '10'], ['18', 20, '1.63', '10-3/4', '10-3/4'],
    ['20', 24, '1.63', '11-1/4', '11-1/2'], ['24', 24, '1.88', '13', '13-1/4']
  ],
  900: [
    ['1/2', 4, '0.75', '4-1/4', '4-1/4'], ['3/4', 4, '0.75', '4-1/2', '4-1/2'],
    ['1', 4, '0.88', '5', '5'], ['1-1/4', 4, '0.88', '5', '5'],
    ['1-1/2', 4, '1.00', '5-1/2', '5-1/2'], ['2', 8, '0.88', '5-3/4', '5-3/4'],
    ['2-1/2', 8, '1.00', '6-1/4', '6-1/4'], ['3', 8, '0.88', '5-3/4', '5-3/4'],
    ['4', 8, '1.13', '6-3/4', '6-3/4'], ['5', 8, '1.25', '7-1/2', '7-1/2'],
    ['6', 12, '1.13', '7-1/2', '7-3/4'], ['8', 12, '1.38', '8-3/4', '8-3/4'],
    ['10', 16, '1.38', '9-1/4', '9-1/4'], ['12', 20, '1.38', '10', '10'],
    ['14', 20, '1.50', '10-3/4', '11'], ['16', 20, '1.63', '11-1/4', '11-1/2'],
    ['18', 20, '1.88', '12-3/4', '13-1/4'], ['20', 20, '2.00', '13-3/4', '14-1/4'],
    ['24', 20, '2.50', '17-1/4', '18']
  ],
  1500: [
    ['1/2', 4, '0.75', '4-1/4', '4-1/4'], ['3/4', 4, '0.75', '4-1/2', '4-1/2'],
    ['1', 4, '0.88', '5', '5'], ['1-1/4', 4, '0.88', '5', '5'],
    ['1-1/2', 4, '1.00', '5-1/2', '5-1/2'], ['2', 8, '0.88', '5-3/4', '5-3/4'],
    ['2-1/2', 8, '1.00', '6-1/4', '6-1/4'], ['3', 8, '1.13', '7', '7'],
    ['4', 8, '1.25', '7-3/4', '7-3/4'], ['5', 8, '1.50', '9-3/4', '9-3/4'],
    ['6', 12, '1.38', '10-1/4', '10-1/2'], ['8', 12, '1.63', '11-1/2', '11-3/4'],
    ['10', 12, '1.88', '13-1/4', '13-1/2'], ['12', 16, '2.00', '14-3/4', '15-1/4'],
    ['14', 16, '2.25', '16', '16-3/4'], ['16', 16, '2.50', '17-1/2', '18-1/2'],
    ['18', 16, '2.75', '19-1/2', '20-3/4'], ['20', 16, '3.00', '21-1/4', '22-1/4'],
    ['24', 16, '3.50', '24-1/4', '25-1/2']
  ],
  2500: [
    ['1/2', 4, '0.75', '4-3/4', '4-3/4'], ['3/4', 4, '0.75', '5', '5'],
    ['1', 4, '0.88', '5-1/2', '5-1/2'], ['1-1/4', 4, '1.00', '6', '6'],
    ['1-1/2', 4, '1.13', '6-3/4', '6-3/4'], ['2', 8, '1.00', '7', '7'],
    ['2-1/2', 8, '1.13', '7-3/4', '8'], ['3', 8, '1.25', '8-3/4', '9'],
    ['4', 8, '1.50', '10', '10-1/4'], ['5', 8, '1.75', '11-3/4', '12-1/4'],
    ['6', 8, '2.00', '13-1/2', '14'], ['8', 12, '2.00', '15', '15-1/2'],
    ['10', 12, '2.50', '19-1/4', '20'], ['12', 12, '2.75', '21-1/4', '22']
  ]
};

/* ---- ASME B16.5 class 400 bolting (published class 400 table, stud length in
   mm for 7 mm raised face): [NPS, qty, bolt dia (in), stud RF (mm)]         */
const B165_BOLTS_400 = [
  ['1/2', 4, '1/2', 75], ['3/4', 4, '5/8', 90], ['1', 4, '5/8', 90],
  ['1-1/4', 4, '5/8', 95], ['1-1/2', 4, '3/4', 110], ['2', 8, '5/8', 110],
  ['2-1/2', 8, '3/4', 120], ['3', 8, '3/4', 125], ['3-1/2', 8, '7/8', 140],
  ['4', 8, '7/8', 140], ['5', 8, '7/8', 145], ['6', 12, '7/8', 150],
  ['8', 12, '1-1/8', 170], ['10', 16, '1', 190], ['12', 16, '1-1/4', 205],
  ['14', 20, '1-1/4', 210], ['16', 20, '1-3/8', 220], ['18', 24, '1-3/8', 230],
  ['20', 24, '1-1/2', 240], ['24', 24, '1-3/4', 265]
];

/* ---- ASME B16.47 Series A / Series B: [NPS, thickness mm, qty, bolt dia in,
   stud length mm] (raised face, includes one 4.5 mm spiral wound gasket that is
   compressed to 3 mm while tightening) -------------------------------------- */
const B1647 = {
  A150: [
    ['26', 68.3, 24, '1-1/4', 222], ['28', 71.5, 28, '1-1/4', 228],
    ['30', 74.7, 28, '1-1/4', 234], ['32', 81.0, 28, '1-1/2', 266],
    ['34', 82.6, 32, '1-1/2', 266], ['36', 90.5, 32, '1-1/2', 279],
    ['38', 87.4, 32, '1-1/2', 279], ['40', 90.5, 36, '1-1/2', 279],
    ['42', 96.9, 36, '1-1/2', 292], ['44', 101.7, 40, '1-1/2', 304],
    ['46', 103.2, 40, '1-1/2', 304], ['48', 108.0, 44, '1-1/2', 317],
    ['50', 111.2, 44, '1-3/4', 336], ['52', 115.9, 44, '1-3/4', 349],
    ['54', 120.7, 44, '1-3/4', 355], ['56', 123.9, 48, '1-3/4', 361],
    ['58', 128.6, 48, '1-3/4', 374], ['60', 131.8, 52, '1-3/4', 381]
  ],
  A300: [
    ['26', 79.4, 28, '1-5/8', 273], ['28', 85.8, 28, '1-5/8', 285],
    ['30', 92.1, 28, '1-3/4', 304], ['32', 98.5, 28, '1-7/8', 317],
    ['34', 101.7, 28, '1-7/8', 330], ['36', 104.8, 32, '2', 342],
    ['38', 108.0, 32, '1-1/2', 317], ['40', 114.4, 32, '1-5/8', 336],
    ['42', 119.1, 32, '1-5/8', 349], ['44', 123.9, 32, '1-3/4', 361],
    ['46', 128.6, 28, '1-7/8', 381], ['48', 133.4, 32, '1-7/8', 387],
    ['50', 139.8, 32, '2', 406], ['52', 144.5, 32, '2', 419],
    ['54', 152.5, 28, '2-1/4', 444], ['56', 154.0, 28, '2-1/4', 450],
    ['58', 158.8, 32, '2-1/4', 457], ['60', 163.6, 32, '2-1/4', 469]
  ],
  A400: [
    ['26', 95.25, 28, '1-3/4', 317], ['28', 101.65, 28, '1-7/8', 336],
    ['30', 107.95, 28, '2', 355], ['32', 114.35, 28, '2', 361],
    ['34', 117.55, 28, '2', 374], ['36', 120.65, 32, '2', 381],
    ['38', 130.25, 32, '1-3/4', 374], ['40', 136.55, 32, '1-7/8', 393],
    ['42', 139.75, 32, '1-7/8', 400], ['44', 146.05, 32, '2', 419],
    ['46', 152.45, 36, '2', 431], ['48', 158.75, 28, '2-1/4', 457],
    ['50', 163.55, 32, '2-1/4', 469], ['52', 168.35, 32, '2-1/4', 476],
    ['54', 176.25, 28, '2-1/2', 508], ['56', 181.05, 32, '2-1/2', 514],
    ['58', 184.15, 32, '2-1/2', 520], ['60', 192.15, 32, '2-3/4', 552]
  ],
  A600: [
    ['26', 114.35, 28, '1-7/8', 368], ['28', 117.55, 28, '2', 381],
    ['30', 120.65, 28, '2', 393], ['32', 123.85, 28, '2-1/4', 419],
    ['34', 127.05, 28, '2-1/4', 425], ['36', 130.25, 28, '2-1/2', 450],
    ['38', 158.75, 28, '2-1/4', 463], ['40', 165.15, 32, '2-1/4', 476],
    ['42', 174.65, 28, '2-1/2', 501], ['44', 179.45, 32, '2-1/2', 514],
    ['46', 185.75, 32, '2-1/2', 527], ['48', 195.35, 32, '2-3/4', 565],
    ['50', 203.25, 28, '3', 590], ['52', 209.55, 32, '3', 603],
    ['54', 215.95, 32, '3', 615], ['56', 223.75, 32, '3-1/4', 647],
    ['58', 228.65, 32, '3-1/4', 660], ['60', 239.75, 28, '3-1/2', 692]
  ],
  A900: [
    ['26', 146.05, 20, '2-3/4', 476], ['28', 149.25, 20, '3', 501],
    ['30', 155.65, 20, '3', 520], ['32', 165.15, 20, '3-1/4', 558],
    ['34', 171.45, 20, '3-1/2', 584], ['36', 177.85, 20, '3-1/2', 603],
    ['38', 196.85, 20, '3-1/2', 622], ['40', 203.25, 24, '3-1/2', 635],
    ['42', 212.75, 24, '3-1/2', 654], ['44', 220.75, 24, '3-3/4', 685],
    ['46', 231.95, 24, '4', 723], ['48', 239.75, 24, '4', 736]
  ],
  B150: [
    ['26', 41.4, 36, '3/4', 140], ['28', 44.6, 40, '3/4', 146],
    ['30', 44.6, 44, '3/4', 146], ['32', 46.2, 48, '3/4', 146],
    ['34', 49.3, 40, '7/8', 159], ['36', 52.5, 44, '7/8', 165],
    ['38', 54.1, 40, '1', 178], ['40', 55.7, 44, '1', 178],
    ['42', 58.9, 48, '1', 184], ['44', 60.5, 52, '1', 190],
    ['46', 62.0, 40, '1-1/8', 203], ['48', 65.2, 44, '1-1/8', 203],
    ['50', 68.4, 48, '1-1/8', 210], ['52', 70.0, 52, '1-1/8', 216],
    ['54', 71.6, 56, '1-1/8', 216], ['56', 73.2, 60, '1-1/8', 222],
    ['58', 74.7, 48, '1-1/4', 229], ['60', 76.3, 52, '1-1/4', 235]
  ],
  B300: [
    ['26', 89.0, 32, '1-1/4', 260], ['28', 89.0, 36, '1-1/4', 260],
    ['30', 93.7, 36, '1-3/8', 273], ['32', 103.2, 32, '1-1/2', 298],
    ['34', 103.2, 36, '1-1/2', 298], ['36', 103.2, 32, '1-3/8', 305],
    ['38', 111.2, 36, '1-3/8', 324], ['40', 115.9, 40, '1-5/8', 330],
    ['42', 119.1, 36, '1-3/4', 343], ['44', 127.1, 40, '1-3/4', 362],
    ['46', 128.6, 36, '1-7/8', 368], ['48', 128.6, 40, '1-7/8', 368],
    ['50', 138.2, 44, '1-7/8', 387], ['52', 142.9, 48, '1-7/8', 400],
    ['54', 136.6, 48, '1-7/8', 387], ['56', 154.0, 36, '2-1/4', 438],
    ['58', 154.0, 40, '2-1/4', 438], ['60', 150.9, 40, '2-1/4', 432]
  ],
  B400: [
    ['26', 95.25, 28, '1-3/8', 279], ['28', 101.65, 24, '1-1/2', 298],
    ['30', 107.95, 28, '1-1/2', 311], ['32', 114.35, 28, '1-5/8', 330],
    ['34', 117.55, 32, '1-5/8', 337], ['36', 125.45, 28, '1-3/4', 356],
    ['38', 130.25, 32, '1-3/4', 368], ['40', 136.55, 32, '1-7/8', 387],
    ['42', 139.75, 32, '1-7/8', 394], ['44', 146.05, 32, '2', 413],
    ['46', 152.45, 36, '2', 425], ['48', 158.75, 28, '2-1/4', 451],
    ['50', 163.55, 32, '2-1/4', 457], ['52', 168.35, 32, '2-1/4', 470],
    ['54', 176.25, 28, '2-1/2', 502], ['56', 181.05, 32, '2-1/2', 508],
    ['58', 184.15, 32, '2-1/2', 514], ['60', 192.15, 32, '2-3/4', 546]
  ],
  B600: [
    ['26', 117.55, 28, '1-5/8', 337], ['28', 122.25, 28, '1-3/4', 349],
    ['30', 131.85, 28, '1-7/8', 375], ['32', 136.55, 28, '2', 394],
    ['34', 147.65, 24, '2-1/4', 425], ['36', 152.45, 28, '2-1/4', 438],
    ['38', 158.75, 28, '2-1/4', 451], ['40', 165.15, 32, '2-1/4', 464],
    ['42', 174.65, 28, '2-1/2', 495], ['44', 179.45, 32, '2-1/2', 508],
    ['46', 185.75, 32, '2-1/2', 521], ['48', 195.35, 32, '2-3/4', 552],
    ['50', 203.25, 28, '3', 578], ['52', 209.55, 32, '3', 591],
    ['54', 215.95, 32, '3', 603], ['56', 223.75, 32, '3-1/4', 635],
    ['58', 228.65, 32, '3-1/4', 641], ['60', 239.75, 28, '3-1/2', 679]
  ],
  B900: [
    ['26', 141.35, 20, '2-1/2', 425], ['28', 154.05, 20, '2-3/4', 470],
    ['30', 161.95, 20, '3', 495], ['32', 166.75, 20, '3', 508],
    ['34', 177.85, 20, '3-1/4', 540], ['36', 179.45, 24, '3', 533],
    ['38', 196.85, 20, '3-1/2', 591], ['40', 203.25, 24, '3-1/2', 603],
    ['42', 212.75, 24, '3-1/2', 622], ['44', 220.75, 24, '3-3/4', 654],
    ['46', 231.95, 24, '4', 686], ['48', 239.75, 24, '4', 705]
  ]
};

/* ---- ASME B18.2.2 heavy hex nuts: [bolt dia in, width across flats in, height in]
   basic dimensions; two independent published tables agree on these values    */
const HH_NUTS = [
  [0.25, 0.5, 0.234], [0.3125, 0.5625, 0.297], [0.375, 0.6875, 0.359],
  [0.4375, 0.75, 0.422], [0.5, 0.875, 0.484], [0.5625, 0.9375, 0.547],
  [0.625, 1.0625, 0.609], [0.75, 1.25, 0.734], [0.875, 1.4375, 0.859],
  [1, 1.625, 0.984], [1.125, 1.8125, 1.109], [1.25, 2, 1.219],
  [1.375, 2.1875, 1.343], [1.5, 2.375, 1.469], [1.625, 2.5625, 1.594],
  [1.75, 2.75, 1.719], [1.875, 2.9375, 1.844], [2, 3.125, 1.969],
  [2.25, 3.5, 2.203], [2.5, 3.875, 2.453], [2.75, 4.25, 2.703],
  [3, 4.625, 2.953], [3.25, 5, 3.188], [3.5, 5.375, 3.438],
  [3.75, 5.75, 3.688], [4, 6.125, 3.938]
];
/* ---- ASME B18.2.2 regular hex nuts (1/4"-1-1/2"): [dia in, AF in, height in]
   (secondary reference only - flange bolting uses heavy hex nuts)            */
const RH_NUTS = [
  [0.25, 0.4375, 0.219], [0.3125, 0.5, 0.273], [0.375, 0.5625, 0.328],
  [0.4375, 0.6875, 0.375], [0.5, 0.75, 0.4375], [0.5625, 0.875, 0.484],
  [0.625, 0.9375, 0.547], [0.75, 1.125, 0.641], [0.875, 1.3125, 0.75],
  [1, 1.5, 0.859], [1.125, 1.6875, 0.969], [1.25, 1.875, 1.0625],
  [1.375, 2.0625, 1.172], [1.5, 2.25, 1.281]
];
/* ---- metric nuts: [thread, pitch, ISO 4032 AF, ISO 4032 h, ISO 4033 AF, ISO 4033 h] */
const M_NUTS = [
  ['M12', '1.75', 18, 10, 18, 12], ['M16', '2', 24, 13, 24, 16],
  ['M20', '2.5', 30, 16, 30, 20], ['M22', '2.5', 32, 14, 34, 22],
  ['M24', '3', 36, 19, 36, 24], ['M27', '3', 41, 17, 41, 27],
  ['M30', '3.5', 46, 24, 46, 30], ['M33', '3.5', 50, 21, 50, 33],
  ['M36', '4', 55, 29, 55, 36], ['M39', '4', 60, 25, 60, 39],
  ['M42', '4.5', 65, 34, 65, 42], ['M45', '4.5', 70, 28, 70, 45],
  ['M48', '5', 75, 38, 75, 48], ['M52', '5', 80, 32, 80, 52],
  ['M56', '5.5', 85, 45, 85, 56]
];
/* standard metric hexagon wrench sizes (A/F) used for "nearest wrench" output */
const METRIC_WRENCH_SIZES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 35, 36, 38, 41, 42, 46, 50, 54, 55,
  60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145,
  150, 155, 160, 165, 170, 175, 180];
function nearestMetricWrench(afMm) {
  let best = METRIC_WRENCH_SIZES[0], bestD = Infinity;
  METRIC_WRENCH_SIZES.forEach(function (s) {
    const d = Math.abs(s - afMm);
    if (d < bestD - 1e-9) { bestD = d; best = s; }
  });
  return best;
}
function nutFor(diaIn, table) {
  for (let i = 0; i < table.length; i++) {
    if (Math.abs(table[i][0] - diaIn) < 1e-6) { return table[i]; }
  }
  return null;
}
const THREADS = {
  0.25: '1/4-20 UNC', 0.3125: '5/16-18 UNC', 0.375: '3/8-16 UNC',
  0.4375: '7/16-14 UNC', 0.5: '1/2-13 UNC', 0.5625: '9/16-12 UNC',
  0.625: '5/8-11 UNC', 0.75: '3/4-10 UNC', 0.875: '7/8-9 UNC', 1: '1-8 UNC',
  1.125: '1-1/8-8 UN', 1.25: '1-1/4-8 UN', 1.375: '1-3/8-8 UN', 1.5: '1-1/2-8 UN',
  1.625: '1-5/8-8 UN', 1.75: '1-3/4-8 UN', 1.875: '1-7/8-8 UN', 2: '2-8 UN',
  2.25: '2-1/4-8 UN', 2.5: '2-1/2-8 UN', 2.75: '2-3/4-8 UN', 3: '3-8 UN',
  3.25: '3-1/4-8 UN', 3.5: '3-1/2-8 UN', 3.75: '3-3/4-8 UN', 4: '4-8 UN'
};

/* ============================== BUILDERS ================================ */
const bolting = [];
/* bolt diameters in published charts are often rounded to 2 decimals
   ("0.63" for 5/8", "1.13" for 1-1/8"). Snap to the exact 1/16" so the
   ASME B18.2.2 nut/wrench lookup matches for EVERY size/class.            */
function snap16(x) { return Math.round(x * 16) / 16; }
function addBolt(o) {
  const nut = nutFor(o.bolt_diameter_decimal_inch, HH_NUTS);
  if (nut) {
    o.nut_standard = 'ASME B18.2.2';
    o.nut_type = 'heavy_hex';
    o.nut_across_flats_mm = in2mm(nut[1]);
    o.nut_height_mm = in2mm(nut[2]);
    o.wrench_size_mm = nearestMetricWrench(nut[1] * MM);
    o.wrench_size_inch = inToFrac(nut[1], 16);
  }
  o.id = [o.standard.replace(/[^A-Z0-9.]/g, ''), o.series, o.nps_inch.replace('/', '-'),
    o.pressure_class, o.flange_face].join('-');
  /* model fit: 2 flanges + gasket(4.5) + 2 nut heights + 2 x 6 mm thread projection.
     For B16.47 large-size class 600/900 rows the published table length carries an
     extra allowance; those records are marked table_governs so the UI relies on the
     table value and explains the difference instead of implying the model is wrong. */
  if (o.standard_stud_length_mm && o.flange_thickness_mm && o.nut_height_mm &&
    o.flange_face === 'RF') {
    const calc = 2 * o.flange_thickness_mm + 4.5 + 2 * o.nut_height_mm + 2 * 6;
    o.calc_stud_length_mm_default = r1(calc);
    o.calc_vs_standard_delta_mm = r1(calc - o.standard_stud_length_mm);
    o.model_fit = Math.abs(calc - o.standard_stud_length_mm) <= 8 ? 'matched' : 'table_governs';
  } else if (o.flange_face === 'RTJ') {
    /* RTJ stud length must cover the ring gasket seating into both grooves; the
       published table value includes that, the simple RF model does not.        */
    o.model_fit = 'table_governs';
    o.model_fit_reason = 'rtj';
  } else {
    o.model_fit = 'unknown';
  }
  bolting.push(o);
}

Object.keys(B165_BOLTS).forEach(function (cl) {
  B165_BOLTS[cl].forEach(function (row) {
    const nps = row[0], qty = row[1], diaDec = snap16(fracToIn(row[2]));
    const t = B165_THICK[cl][nps];
    [['RF', row[3]], ['RTJ', row[4]]].forEach(function (f) {
      const face = f[0], len = f[1];
      if (!len) { return; }
      addBolt({
        standard: 'ASME B16.5', series: 'B16.5', nps_inch: nps, dn: DN_OF[nps],
        pressure_class: Number(cl), flange_face: face,
        number_of_bolts: qty, bolt_diameter_inch: inToFrac(diaDec, 16),
        bolt_diameter_decimal_inch: diaDec, bolt_diameter_mm: in2mm(diaDec),
        thread: THREADS[diaDec] || null,
        flange_thickness_mm: t,
        standard_stud_length_mm: in2mm(fracToIn(len)),
        standard_stud_length_inch: inToFrac(fracToIn(len), 32),
        stud_length_basis: 'جدول استاندارد (RF: واشر SW 4.5 mm فشرده‌شده)',
        confidence: t ? 'high' : 'medium',
        notes: face === 'RTJ' ? 'طول RTJ از ستون RTJ جدول مرجع' : '',
        source: 'ASME B16.5 bolt chart (inch, RF/RTJ) + flange thickness table (mm)'
      });
    });
  });
});

B165_BOLTS_400.forEach(function (row) {
  const nps = row[0], qty = row[1], diaDec = snap16(fracToIn(row[2])), lenMm = row[3];
  addBolt({
    standard: 'ASME B16.5', series: 'B16.5', nps_inch: nps, dn: DN_OF[nps],
    pressure_class: 400, flange_face: 'RF',
    number_of_bolts: qty, bolt_diameter_inch: inToFrac(diaDec, 16),
    bolt_diameter_decimal_inch: diaDec, bolt_diameter_mm: in2mm(diaDec),
    thread: THREADS[diaDec] || null, flange_thickness_mm: B165_THICK[400][nps],
    standard_stud_length_mm: lenMm, standard_stud_length_inch: inToFrac(lenMm / MM, 32),
    stud_length_basis: 'جدول استاندارد کلاس 400 (RF 7 mm)',
    confidence: 'high',
    notes: 'طول‌های RTJ کلاس 400 در دیتاست محلی نیست',
    source: 'ASME B16.5 class 400 bolting table (mm)'
  });
});

Object.keys(B1647).forEach(function (key) {
  const series = key.charAt(0);
  const cl = Number(key.slice(1));
  B1647[key].forEach(function (row) {
    const nps = row[0], t = row[1], qty = row[2], diaDec = snap16(fracToIn(row[3])), lenMm = row[4];
    const flagged = (series === 'A' && cl === 300 && nps >= '38') ||
      (cl === 900 && nps >= '44');
    /* Series A class 600/900 published stud lengths include an extra allowance
       over the simple model (Series B rows of the same class/size are ~10-25 mm
       shorter). Value from the table governs; the UI explains the difference. */
    const aHighClass = (series === 'A' && (cl === 600 || cl === 900));
    addBolt({
      standard: 'ASME B16.47', series: 'ASME B16.47 Series ' + series,
      nps_inch: nps, dn: DN_OF[nps], pressure_class: cl, flange_face: 'RF',
      number_of_bolts: qty, bolt_diameter_inch: inToFrac(diaDec, 16),
      bolt_diameter_decimal_inch: diaDec, bolt_diameter_mm: in2mm(diaDec),
      thread: THREADS[diaDec] || null, flange_thickness_mm: t,
      standard_stud_length_mm: lenMm, standard_stud_length_inch: inToFrac(lenMm / MM, 32),
      stud_length_basis: 'جدول استاندارد (گسکت SW 4.5 mm فشرده‌شده به 3 mm)',
      confidence: flagged ? 'medium' : 'high',
      notes: (series === 'B' ? 'Series B معادل API 605؛ ' : 'Series A معادل MSS SP-44؛ ') +
        (t ? '' : 'ضخامت فلنج در دیتاست نیست. ') +
        (aHighClass ? 'طول جدول Series A در این کلاس شامل حاشیه اضافی نسبت به مدل ساده است؛ مقدار جدول مبنا است. ' : '') +
        (flagged ? 'مقدار نیازمند بازبینی با آخرین ویرایش استاندارد.' : ''),
      source: 'ASME B16.47 Series ' + series + ' class ' + cl + ' dimension table (mm)'
    });
  });
});

/* --------------------------- flange sizes ------------------------------- */
function npsAliases(nps, dn, dec) {
  const a = [nps, nps + '"', 'NPS ' + nps, nps + ' inch', 'DN' + dn, 'DN ' + dn,
    String(dn), String(dec), dec + '"'];
  if (nps.indexOf('/') >= 0) { a.push(nps.replace('/', ' ')); }
  return a;
}
const sizes = NPS_DN.map(function (p) {
  const nps = p[0], dn = p[1], dec = fracToIn(nps);
  let standard, notes = '';
  if (dec <= 24) { standard = 'ASME B16.5'; }
  else { standard = 'ASME B16.47'; notes = 'Series A = MSS SP-44 | Series B = API 605'; }
  if (nps === '22') {
    notes = (notes ? notes + ' | ' : '') +
      'داده بولتینگ NPS 22 در دیتاست محلی موجود نیست؛ لطفاً از تب تنظیمات تکمیل کنید.';
  }
  if (dec >= 26 && dec <= 60) {
    notes = (notes ? notes + ' | ' : '') +
      'کلاسهای 400/600/900 برای NPS 38 و بالاتر بین Series A و B یکسان است.';
  }
  return {
    nps_inch: nps, nps_decimal_inch: dec, dn: dn, standard: standard,
    aliases: npsAliases(nps, dn, dec), notes: notes
  };
});

/* ---------------------- stud diameter -> wrench map --------------------- */
const wrench = [];
HH_NUTS.forEach(function (n) {
  const d = n[0], af = n[1], h = n[2];
  const rh = nutFor(d, RH_NUTS);
  wrench.push({
    id: 'inch-' + inToFrac(d, 16).replace('/', '-'),
    system: 'inch',
    bolt_diameter_inch: inToFrac(d, 16),
    bolt_diameter_decimal_inch: d,
    bolt_diameter_mm: in2mm(d),
    thread: THREADS[d] || null,
    nut_standard: 'ASME B18.2.2',
    nut_type: 'heavy_hex (مهره سنگین - استاندارد فلنج)',
    nut_across_flats_mm: in2mm(af),
    nut_across_flats_inch: inToFrac(af, 16),
    nut_height_mm: in2mm(h),
    nut_height_inch: inToFrac(h, 64),
    wrench_size_mm: nearestMetricWrench(af * MM),
    wrench_size_inch: inToFrac(af, 16),
    alt_nut_type: rh ? 'regular_hex (مهره ششگوش معمولی)' : null,
    alt_nut_across_flats_mm: rh ? in2mm(rh[1]) : null,
    alt_nut_height_mm: rh ? in2mm(rh[2]) : null,
    alt_wrench_size_mm: rh ? nearestMetricWrench(rh[1] * MM) : null,
    alt_wrench_size_inch: rh ? inToFrac(rh[1], 16) : null,
    confidence: 'high',
    notes: d > 1 ? 'بالای ۱ اینچ: سری رزوه 8UN' : 'رزوه UNC'
  });
});
M_NUTS.forEach(function (m) {
  const d = Number(m[0].slice(1));
  wrench.push({
    id: 'metric-' + m[0],
    system: 'metric',
    bolt_diameter_mm: d,
    bolt_diameter_inch: r2(d / MM),
    thread: m[0] + '×' + m[1],
    nut_standard: 'ISO 4032 / ISO 4033',
    nut_type: 'hex (ISO 4032 - سبک)',
    nut_across_flats_mm: m[2],
    nut_across_flats_inch: r2(m[2] / MM),
    nut_height_mm: m[3],
    nut_height_inch: r2(m[3] / MM),
    wrench_size_mm: nearestMetricWrench(m[2]),
    wrench_size_inch: r2(m[2] / MM),
    alt_nut_type: 'heavy hex (ISO 4033 - سنگین)',
    alt_nut_across_flats_mm: m[4],
    alt_nut_height_mm: m[5],
    alt_wrench_size_mm: nearestMetricWrench(m[4]),
    alt_wrench_size_inch: r2(m[4] / MM),
    confidence: 'medium',
    notes: 'ابعاد مهره متریک ISO 4032/4033؛ اندازه آچار دقیق بر اساس سازنده کنترل شود'
  });
});

/* ------------------------------ settings -------------------------------- */
const settings = {
  _meta: {
    description: 'Default calculation settings for Flange & Stud Bolt Finder',
    units: 'mm',
    note: 'stud length = flange_count x flange_thickness + gasket + 2 x nut height + thread projection'
  },
  thread_projection_mm: 6,
  spiral_wound_gasket_thickness_mm: 4.5,
  flat_gasket_thickness_mm: 3,
  rtj_gasket_thickness_mm: 12.7,
  nut_height_method: 'heavy_hex_table',
  flange_count: 2,
  round_stud_length: 'up_1mm',
  stud_length_warn_delta_mm: 6,
  default_flange_face: 'RF',
  default_gasket_type: 'spiral_wound',
  show_only_available_classes: true,
  max_history_items: 30,
  theme: 'dark',
  language: 'fa'
};
const DATA_META = {
  dataset: 'Flange & Stud Bolt Finder - local engineering dataset',
  generated: new Date().toISOString().slice(0, 10),
  standards: ['ASME B16.5', 'ASME B16.47 (A/B)', 'ASME B18.2.2', 'ASME B18.31.2',
    'ISO 4032/4033 (metric nuts)'],
  sources: [
    'ASME B16.5 flange bolt chart (bolt count, bolt dia, stud length RF/RTJ)',
    'ASME B16.5 min. flange thickness tables, class 150-2500 (mm)',
    'ASME B16.5 class 400 bolting table (mm, 7 mm raised face)',
    'ASME B16.47 Series A/B dimension + bolting tables, NPS 26-60 (mm)',
    'ASME B18.2.2 heavy/regular hex nut dimensional tables (inch)'
  ],
  disclaimer: 'داده‌ها از جداول عمومی استاندارد استخراج شده‌اند. نتایج باید با آخرین ویرایش استاندارد، مدارک پروژه و دیتاشیت سازنده کنترل شود.'
};

/* ------------------------------- output --------------------------------- */
/* cross-reference: for every RTJ record store how much longer it is than the
   matching RF record, so the app can explain the difference to the user      */
bolting.forEach(function (rtj) {
  if (rtj.flange_face !== 'RTJ' || !rtj.standard_stud_length_mm) { return; }
  const rf = bolting.filter(function (x) {
    return x.flange_face === 'RF' && x.standard === rtj.standard && x.series === rtj.series &&
      x.nps_inch === rtj.nps_inch && x.pressure_class === rtj.pressure_class;
  })[0];
  if (rf && rf.standard_stud_length_mm) {
    rtj.stud_length_extra_vs_rf_mm = r1(rtj.standard_stud_length_mm - rf.standard_stud_length_mm);
  }
});
bolting.sort(function (a, b) {
  const key = (x) => [x.standard, x.series, x.pressure_class,
    fracToIn(x.nps_inch), x.flange_face].join('|');
  return key(a) < key(b) ? -1 : (key(a) > key(b) ? 1 : 0);
});
wrench.sort(function (a, b) {
  return (a.system === b.system)
    ? (a.bolt_diameter_mm - b.bolt_diameter_mm)
    : (a.system === 'inch' ? -1 : 1);
});

function writeJson(rel, obj) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return fs.statSync(path.join(ROOT, rel)).size;
}
const sizesDoc = { meta: DATA_META, sizes: sizes };
const boltDoc = { meta: DATA_META, records: bolting };
const wrenchDoc = { meta: DATA_META, records: wrench };
const s1 = writeJson('data/flange-sizes.json', sizesDoc);
const s2 = writeJson('data/flange-bolting.json', boltDoc);
const s3 = writeJson('data/stud-wrench-map.json', wrenchDoc);
const s4 = writeJson('data/settings.json', settings);

const embedded = '/* AUTO-GENERATED by tools/generate-data.js - offline fallback copy of the\n' +
  '   JSON files in this folder. Browsers block fetch() on file://, so the app\n' +
  '   falls back to these globals when the JSON files cannot be read.\n' +
  '   Do not edit by hand: edit the JSON files and re-run the generator, or use\n' +
  '   Settings -> import in the app. */\n' +
  'window.FSF_DATA = window.FSF_DATA || {};\n' +
  'window.FSF_DATA.sizes = ' + JSON.stringify(sizesDoc) + ';\n' +
  'window.FSF_DATA.bolting = ' + JSON.stringify(boltDoc) + ';\n' +
  'window.FSF_DATA.wrench = ' + JSON.stringify(wrenchDoc) + ';\n' +
  'window.FSF_DATA.settings = ' + JSON.stringify(settings) + ';\n';
fs.writeFileSync(path.join(ROOT, 'data/data-embedded.js'), embedded, 'utf8');

/* --------------------------- validation report -------------------------- */
function nutHeightMm(diaDec) {
  const n = nutFor(diaDec, HH_NUTS);
  return n ? n[2] * MM : null;
}
const devs = [];
bolting.forEach(function (b) {
  if (b.flange_face !== 'RF' || !b.flange_thickness_mm || !b.nut_height_mm) { return; }
  const calc = 2 * b.flange_thickness_mm + 4.5 + 2 * b.nut_height_mm + 2 * 6;
  devs.push({ id: b.id, std: b.standard_stud_length_mm, calc: r1(calc),
    d: r1(calc - b.standard_stud_length_mm) });
});
const absDev = devs.map(function (x) { return Math.abs(x.d); });
const meanDev = absDev.length ? absDev.reduce(function (a, b) { return a + b; }, 0) / absDev.length : 0;
const maxDev = absDev.length ? Math.max.apply(null, absDev) : 0;
const worst = devs.slice().sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 8);
const classes = {};
bolting.forEach(function (b) {
  const k = b.standard + ' C' + b.pressure_class;
  classes[k] = (classes[k] || 0) + 1;
});
const lines = [];
function say(s) { lines.push(s); console.log(s); }
say('=== Flange & Stud Bolt Finder - data build report ===');
say('sizes            : ' + sizes.length);
say('bolting records  : ' + bolting.length);
say('   B16.5         : ' + bolting.filter(function (b) { return b.standard === 'ASME B16.5'; }).length);
say('   B16.47         : ' + bolting.filter(function (b) { return b.standard === 'ASME B16.47'; }).length);
say('   RF / RTJ       : ' + bolting.filter(function (b) { return b.flange_face === 'RF'; }).length +
  ' / ' + bolting.filter(function (b) { return b.flange_face === 'RTJ'; }).length);
say('   medium conf.   : ' + bolting.filter(function (b) { return b.confidence !== 'high'; }).length);
say('wrench records   : ' + wrench.length +
  ' (inch ' + wrench.filter(function (w) { return w.system === 'inch'; }).length +
  ', metric ' + wrench.filter(function (w) { return w.system === 'metric'; }).length + ')');
say('class coverage   : ' + JSON.stringify(classes));
say('deviation calc vs standard stud length (RF, 4.5 gasket, 6 mm projection per end):');
say('   model matched  : ' + bolting.filter(function (b) { return b.model_fit === 'matched'; }).length +
  ' / ' + bolting.filter(function (b) { return b.model_fit !== 'unknown'; }).length + ' records');
const fitByGroup = {};
bolting.forEach(function (b) {
  if (b.model_fit === 'unknown') { return; }
  const k = b.standard + ' C' + b.pressure_class + (b.standard === 'ASME B16.47' ? ' ' + b.series.slice(-1) : '');
  fitByGroup[k] = fitByGroup[k] || { n: 0, ok: 0, maxD: 0 };
  fitByGroup[k].n++;
  if (b.model_fit === 'matched') { fitByGroup[k].ok++; }
  fitByGroup[k].maxD = Math.max(fitByGroup[k].maxD, Math.abs(b.calc_vs_standard_delta_mm));
});
Object.keys(fitByGroup).sort().forEach(function (k) {
  const g = fitByGroup[k];
  say('     ' + k + ': matched ' + g.ok + '/' + g.n + ' maxDelta=' + r1(g.maxD) + ' mm');
});
say('   mean |delta|   : ' + r1(meanDev) + ' mm   max |delta|: ' + r1(maxDev) + ' mm');
say('   largest deltas :');
worst.forEach(function (w) { say('     ' + w.id + ' std=' + w.std + ' calc=' + w.calc + ' delta=' + w.d); });
const missingSizes = [];
sizes.forEach(function (s) {
  const has = bolting.some(function (b) { return b.nps_inch === s.nps_inch; });
  if (!has) { missingSizes.push(s.nps_inch); }
});
say('sizes without any bolting record: ' + (missingSizes.length ? missingSizes.join(', ') : 'none'));
say('files: flange-sizes.json ' + s1 + ' B | flange-bolting.json ' + s2 + ' B | stud-wrench-map.json ' +
  s3 + ' B | settings.json ' + s4 + ' B | data-embedded.js ' +
  fs.statSync(path.join(ROOT, 'data/data-embedded.js')).size + ' B');
fs.writeFileSync(path.join(__dirname, 'data-report.txt'), lines.join('\n') + '\n', 'utf8');