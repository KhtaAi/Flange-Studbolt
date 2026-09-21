/* ============================================================================
 * js/calculations.js - units, nut table lookup, stud-length calculation
 * All formulas are local and offline; values come from the local JSON data.
 * ==========================================================================*/
window.FSF = window.FSF || {};
(function (FSF) {
  'use strict';
  const U = FSF.Utils;
  const MM_PER_IN = 25.4;

  /* ------------------------- data set helpers --------------------------- */
  function data() { return FSF.data || { sizes: [], bolting: [], wrench: [] }; }

  /* Size equivalence helper: parses both as numeric fractions if possible.
     If both numeric, checks difference < 1e-6. Otherwise exact string check. */
  function sameSize(a, b) {
    if (a === b) { return true; }
    if (a == null || b == null) { return false; }
    const numA = U.parseSizeNumeric ? U.parseSizeNumeric(a) : U.parseNumeric(a);
    const numB = U.parseSizeNumeric ? U.parseSizeNumeric(b) : U.parseNumeric(b);
    if (numA !== null && numB !== null) {
      return Math.abs(numA - numB) < 0.000001;
    }
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  function sizeRecord(npsInch) {
    const list = data().sizes || [];
    for (let i = 0; i < list.length; i++) {
      if (sameSize(list[i].nps_inch, npsInch)) { return list[i]; }
    }
    return null;
  }
  /* resolve free text ("6", '6"', "DN150", "150", "0.5") to a size record  */
  function resolveSize(query) {
    if (query == null || query === '') { return null; }
    const list = data().sizes || [];
    const num = U.parseSizeNumeric ? U.parseSizeNumeric(query) : U.parseNumeric(query);

    /* (a) query has a fractional / numeric value */
    if (num != null) {
      /* 1. Exact match with nps_decimal_inch */
      for (let i = 0; i < list.length; i++) {
        if (Math.abs(list[i].nps_decimal_inch - num) < 0.000001) { return list[i]; }
      }
      /* 2. Exact match with dn */
      for (let i = 0; i < list.length; i++) {
        if (Math.abs(list[i].dn - num) < 0.000001) { return list[i]; }
      }
      /* 3. Fallback to nearest value with tolerance <= 3 */
      let best = null, bestD = Infinity;
      list.forEach(function (s) {
        const d = Math.min(Math.abs(s.dn - num), Math.abs(s.nps_decimal_inch - num));
        if (d < bestD) { bestD = d; best = s; }
      });
      if (best && bestD <= 3) { return best; }
      return null;
    }

    /* (b) query has NO numeric value (e.g. "DN150", "NPS 6") -> text alias match */
    const key = U.searchKey(query);
    if (!key) { return null; }
    let hit = null;
    const qHasSlash = /\//.test(String(query));
    list.forEach(function (s) {
      if (hit) { return; }
      const terms = [s.nps_inch, String(s.nps_decimal_inch), String(s.dn), 'dn' + s.dn,
        'nps' + s.nps_inch].concat(s.aliases || []);
      for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        if (U.searchKey(term) === key) {
          const tHasSlash = /\//.test(String(term));
          if (qHasSlash !== tHasSlash) { continue; }
          hit = s;
          return;
        }
      }
    });
    return hit;
  }

  function findBolting(sizeRec, pressureClass, face, series) {
    if (!sizeRec) { return []; }
    const cls = Number(pressureClass);
    const wantedFace = (face || 'RF').toUpperCase();
    const out = [];
    (data().bolting || []).forEach(function (r) {
      if (!sameSize(r.nps_inch, sizeRec.nps_inch)) { return; }
      if (Number(r.pressure_class) !== cls) { return; }
      if (wantedFace !== 'ANY' && r.flange_face !== wantedFace) { return; }
      if (series && String(r.series).indexOf(series) === -1) { return; }
      out.push(r);
    });
    return out.sort(function (a, b) { return String(a.series).localeCompare(String(b.series)); });
  }
  function findBoltingAnyFace(sizeRec, pressureClass, series) {
    return findBolting(sizeRec, pressureClass, 'ANY', series);
  }
  function availableClasses(sizeRec) {
    if (!sizeRec) { return []; }
    const set = {};
    (data().bolting || []).forEach(function (r) {
      if (sameSize(r.nps_inch, sizeRec.nps_inch)) { set[Number(r.pressure_class)] = true; }
    });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }
  function availableFaces(sizeRec, cls) {
    const set = {};
    (data().bolting || []).forEach(function (r) {
      if (sameSize(r.nps_inch, sizeRec.nps_inch) &&
        Number(r.pressure_class) === Number(cls)) { set[r.flange_face] = true; }
    });
    return Object.keys(set).sort();
  }
  function availableSeries(sizeRec, cls) {
    const set = {};
    (data().bolting || []).forEach(function (r) {
      if (sameSize(r.nps_inch, sizeRec.nps_inch) &&
        Number(r.pressure_class) === Number(cls)) { set[r.series] = true; }
    });
    return Object.keys(set).sort();
  }

  /* ------------------------- RTJ Ring Number Table ----------------------- */
  /* ASME B16.5 / ASME B16.20 Ring Numbers for Class 150 to 2500            */
  const RTJ_B16_5_RINGS = {
    '1/2': { 150: 'R11', 300: 'R11', 400: 'R12', 600: 'R12', 900: 'R13', 1500: 'R13', 2500: 'R16' },
    '3/4': { 150: 'R14', 300: 'R14', 400: 'R15', 600: 'R15', 900: 'R16', 1500: 'R16', 2500: 'R17' },
    '1': { 150: 'R16', 300: 'R16', 400: 'R16', 600: 'R16', 900: 'R17', 1500: 'R17', 2500: 'R18' },
    '1-1/4': { 150: 'R18', 300: 'R18', 400: 'R18', 600: 'R18', 900: 'R18', 1500: 'R18', 2500: 'R20' },
    '1-1/2': { 150: 'R20', 300: 'R20', 400: 'R20', 600: 'R20', 900: 'R20', 1500: 'R20', 2500: 'R22' },
    '2': { 150: 'R23', 300: 'R23', 400: 'R23', 600: 'R23', 900: 'R23', 1500: 'R23', 2500: 'R25' },
    '2-1/2': { 150: 'R26', 300: 'R26', 400: 'R26', 600: 'R26', 900: 'R26', 1500: 'R26', 2500: 'R28' },
    '3': { 150: 'R29', 300: 'R29', 400: 'R29', 600: 'R29', 900: 'R29', 1500: 'R29', 2500: 'R31' },
    '3-1/2': { 150: 'R32', 300: 'R32', 400: 'R32', 600: 'R32', 900: 'R32', 1500: 'R32' },
    '4': { 150: 'R35', 300: 'R35', 400: 'R35', 600: 'R35', 900: 'R35', 1500: 'R35', 2500: 'R39' },
    '5': { 150: 'R38', 300: 'R38', 400: 'R38', 600: 'R38', 900: 'R38', 1500: 'R38', 2500: 'R42' },
    '6': { 150: 'R41', 300: 'R41', 400: 'R41', 600: 'R41', 900: 'R41', 1500: 'R41', 2500: 'R45' },
    '8': { 150: 'R45', 300: 'R45', 400: 'R45', 600: 'R45', 900: 'R45', 1500: 'R45', 2500: 'R49' },
    '10': { 150: 'R50', 300: 'R50', 400: 'R50', 600: 'R50', 900: 'R50', 1500: 'R50', 2500: 'R54' },
    '12': { 150: 'R54', 300: 'R54', 400: 'R54', 600: 'R54', 900: 'R54', 1500: 'R54', 2500: 'R58' },
    '14': { 150: 'R57', 300: 'R57', 400: 'R57', 600: 'R57', 900: 'R57', 1500: 'R57' },
    '16': { 150: 'R61', 300: 'R61', 400: 'R61', 600: 'R61', 900: 'R61', 1500: 'R61' },
    '18': { 150: 'R65', 300: 'R65', 400: 'R65', 600: 'R65', 900: 'R65', 1500: 'R65' },
    '20': { 150: 'R69', 300: 'R69', 400: 'R69', 600: 'R69', 900: 'R69', 1500: 'R69' },
    '24': { 150: 'R73', 300: 'R73', 400: 'R73', 600: 'R73', 900: 'R73', 1500: 'R73' }
  };

  function rtjRingInfo(npsInch, pressureClass, standard) {
    if (standard && String(standard).trim() !== 'ASME B16.5') { return null; }
    if (npsInch == null || pressureClass == null) { return null; }
    const cls = Number(pressureClass);
    if (!cls) { return null; }

    const keys = Object.keys(RTJ_B16_5_RINGS);
    let matchedKey = null;
    for (let i = 0; i < keys.length; i++) {
      if (sameSize(keys[i], npsInch)) {
        matchedKey = keys[i];
        break;
      }
    }
    if (!matchedKey) { return null; }
    const classMap = RTJ_B16_5_RINGS[matchedKey];
    const ringNum = classMap ? classMap[cls] : null;
    if (!ringNum) { return null; }

    return {
      ring_number: ringNum,
      ring_style: 'R',
      shape: 'هشت‌ضلعی (Octagonal)',
      standard: 'ASME B16.20'
    };
  }

  /* ------------------------- nut / wrench lookup ------------------------ */
  function wrenchRecords() { return data().wrench || []; }
  function parseInchDecimal(value) {
    if (value == null) { return null; }
    if (typeof value === 'number') { return value; }
    return U.parseNumeric(value);
  }
  function findWrenchInch(decimalInch) {
    const list = wrenchRecords();
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.system !== 'inch') { continue; }
      if (Math.abs(r.bolt_diameter_decimal_inch - decimalInch) < 0.005) { return r; }
    }
    return null;
  }
  function findWrenchMetric(diameterMm) {
    const list = wrenchRecords();
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.system !== 'metric') { continue; }
      if (Math.abs(r.bolt_diameter_mm - diameterMm) <= 0.6) { return r; }
    }
    return null;
  }
  /* Accepts any stud input (fraction, decimal inch, mm, "M20") and returns the
     matching wrench-map record plus the resolved diameters.                 */
  function resolveStud(query, unit) {
    if (query == null || query === '') { return null; }
    const text = U.normalizeFa(query).toUpperCase();
    const metricMatch = text.match(/M\s?(\d{1,2})/);
    const num = U.parseNumeric(text);
    if (metricMatch && num == null) {
      const mm = parseFloat(metricMatch[1]);
      return { record: findWrenchMetric(mm), mm: mm, inch: U.round(mm / MM_PER_IN, 4) };
    }
    if (num == null) { return null; }
    const looksMetric = unit === 'mm' || (unit !== 'inch' && num > 4);
    if (looksMetric) {
      let rec = findWrenchMetric(num);
      if (!rec) { rec = findWrenchInch(U.round(num / MM_PER_IN, 4)); }
      return { record: rec, mm: num, inch: U.round(num / MM_PER_IN, 4) };
    }
    return { record: findWrenchInch(num), inch: num, mm: U.round(num * MM_PER_IN, 4) };
  }

  function nutHeight(record, settings, method) {
    settings = settings || {};
    method = method || settings.nut_height_method || 'heavy_hex_table';
    if (!record) { return null; }
    if (method === 'regular_hex_table' && record.alt_nut_height_mm != null) {
      return { mm: record.alt_nut_height_mm, source: 'جدول مهره معمولی ASME B18.2.2' };
    }
    if (method === 'factor_diameter') {
      const f = settings.nut_height_factor != null ? settings.nut_height_factor : 1.0;
      const diaMm = record.bolt_diameter_mm != null ? record.bolt_diameter_mm :
        (record.bolt_diameter_decimal_inch != null ? record.bolt_diameter_decimal_inch * MM_PER_IN : null);
      if (diaMm != null) { return { mm: U.round(diaMm * f, 2), source: 'ضریب ' + f + ' × قطر استادبول' }; }
    }
    if (record.nut_height_mm != null) {
      return { mm: record.nut_height_mm, source: 'جدول مهره سنگین ASME B18.2.2' };
    }
    return null;
  }

  /* --------------------------- gasket + length --------------------------- */
  function gasketThickness(settings, gasketType) {
    settings = settings || {};
    const t = {
      spiral_wound: settings.spiral_wound_gasket_thickness_mm,
      flat: settings.flat_gasket_thickness_mm,
      rtj: settings.rtj_gasket_thickness_mm,
      custom: settings.custom_gasket_thickness_mm
    };
    const value = t[gasketType];
    return value == null ? 4.5 : value;
  }

  function roundStudLength(value, mode) {
    mode = mode || 'up_1mm';
    if (value == null) { return null; }
    if (mode === 'up_5mm') { return Math.ceil(value / 5) * 5; }
    if (mode === 'up_10mm') { return Math.ceil(value / 10) * 10; }
    if (mode === 'nearest_1mm') { return Math.round(value); }
    if (mode === 'none') { return U.round(value, 1); }
    return Math.ceil(value);
  }

  /* Full breakdown so the UI can show every term of:
     L = flange_count x t + gasket + 2 x nut_height + 2 x thread_projection  */
  function studLengthBreakdown(record, settings, gasketType) {
    settings = settings || {};
    const flangeCount = settings.flange_count != null ? Number(settings.flange_count) : 2;
    const projection = settings.thread_projection_mm != null ? Number(settings.thread_projection_mm) : 6;
    const gasket = gasketThickness(settings, gasketType || 'spiral_wound');
    const nut = nutHeight(record, settings);
    const thickness = record && record.flange_thickness_mm != null ? record.flange_thickness_mm : null;
    const rows = [];
    let raw = null;
    if (thickness != null && nut) {
      rows.push({ label: 'ضخامت فلنج', detail: thickness + ' mm × ' + flangeCount, value: U.round(thickness * flangeCount, 2) });
      rows.push({ label: 'ضخامت گسکت', detail: gasketType || 'spiral_wound', value: gasket });
      rows.push({ label: 'ارتفاع مهره', detail: nut.mm + ' mm × 2 (' + nut.source + ')', value: U.round(nut.mm * 2, 2) });
      rows.push({ label: 'بیرون‌زدگی رزوه', detail: projection + ' mm × 2', value: projection * 2 });
      raw = thickness * flangeCount + gasket + nut.mm * 2 + projection * 2;
    }
    const rounded = raw == null ? null : roundStudLength(raw, settings.round_stud_length);
    let formula = 'L = ' + flangeCount + ' x ' + (thickness == null ? '?' : thickness) +
      ' + ' + gasket + ' + 2 x ' + (nut ? nut.mm : '?') + ' + 2 x ' + projection;
    if (raw != null) { formula += ' = ' + U.round(raw, 1) + ' mm'; }
    const standard = record && record.standard_stud_length_mm != null ? record.standard_stud_length_mm : null;
    const delta = (raw != null && standard != null) ? U.round(rounded - standard, 1) : null;
    return {
      rows: rows, raw: raw == null ? null : U.round(raw, 2), rounded: rounded, formula: formula,
      standard: standard, delta: delta, gasket: gasket, nutHeight: nut ? nut.mm : null,
      nutSource: nut ? nut.source : null, flangeCount: flangeCount, projection: projection
    };
  }

  /* ---------------------- hole count search & grouping ------------------- */
  function availableHoleCounts() {
    const list = data().bolting || [];
    const set = Object.create(null);
    list.forEach(function (r) {
      if (r.number_of_bolts != null && !isNaN(r.number_of_bolts)) {
        set[Number(r.number_of_bolts)] = true;
      }
    });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }

  function holeCountStats() {
    const list = data().bolting || [];
    const counts = Object.create(null);
    list.forEach(function (r) {
      if (r.number_of_bolts != null && !isNaN(r.number_of_bolts)) {
        const n = Number(r.number_of_bolts);
        counts[n] = (counts[n] || 0) + 1;
      }
    });
    return counts;
  }

  function findNearestHoleCounts(count, limit) {
    const target = Number(count);
    if (isNaN(target)) { return []; }
    const avail = availableHoleCounts();
    if (!avail.length) { return []; }
    const withDiff = avail.map(function (n) {
      return { n: n, diff: Math.abs(n - target) };
    });
    withDiff.sort(function (a, b) {
      if (a.diff !== b.diff) { return a.diff - b.diff; }
      return a.n - b.n;
    });
    return withDiff.slice(0, limit || 3).map(function (x) { return x.n; });
  }

  function findByHoleCount(holeCount) {
    let count = null;
    if (typeof holeCount === 'number') {
      count = holeCount;
    } else if (holeCount != null) {
      count = U.parseNumeric(U.normalizeFa(String(holeCount)));
    }
    if (count == null || isNaN(count)) { return { holeCount: null, groups: [] }; }
    count = Math.round(count);

    const list = data().bolting || [];
    const matched = list.filter(function (r) {
      return Number(r.number_of_bolts) === count;
    });

    if (!matched.length) {
      return { holeCount: count, groups: [] };
    }

    const groups = {};
    matched.forEach(function (r) {
      const diaDec = Number(r.bolt_diameter_decimal_inch) || 0;
      const nutRec = findWrenchInch(diaDec);
      const wrenchMm = nutRec && nutRec.wrench_size_mm != null ? nutRec.wrench_size_mm : r.wrench_size_mm;
      const wrenchIn = nutRec && nutRec.wrench_size_inch ? nutRec.wrench_size_inch : r.wrench_size_inch;
      const nutAF = nutRec && nutRec.nut_across_flats_mm != null ? nutRec.nut_across_flats_mm : r.nut_across_flats_mm;
      const nutAFIn = nutRec && nutRec.nut_across_flats_inch ? nutRec.nut_across_flats_inch : null;
      const nutH = nutRec && nutRec.nut_height_mm != null ? nutRec.nut_height_mm : r.nut_height_mm;
      const nutHIn = nutRec && nutRec.nut_height_inch ? nutRec.nut_height_inch : null;
      const thread = r.thread || (nutRec ? nutRec.thread : '');
      const nutStd = r.nut_standard || (nutRec ? nutRec.nut_standard : 'ASME B18.2.2');
      const nutType = r.nut_type || (nutRec ? nutRec.nut_type : 'heavy_hex');

      const groupKey = [diaDec.toFixed(3), thread, nutStd, nutAF].join('|');
      if (!groups[groupKey]) {
        groups[groupKey] = {
          bolt_diameter_decimal_inch: diaDec,
          bolt_diameter_inch: r.bolt_diameter_inch,
          bolt_diameter_mm: r.bolt_diameter_mm,
          thread: thread,
          nut_standard: nutStd,
          nut_type: nutType,
          nut_across_flats_mm: nutAF,
          nut_across_flats_inch: nutAFIn,
          nut_height_mm: nutH,
          nut_height_inch: nutHIn,
          wrench_size_mm: wrenchMm,
          wrench_size_inch: wrenchIn,
          items: [],
          itemKeys: Object.create(null)
        };
      }
      const itemKey = [
        r.standard,
        r.series || '',
        r.nps_inch,
        r.dn,
        r.pressure_class,
        r.flange_face,
        r.standard_stud_length_mm
      ].join('|');

      if (!groups[groupKey].itemKeys[itemKey]) {
        groups[groupKey].itemKeys[itemKey] = true;
        groups[groupKey].items.push({
          number_of_bolts: r.number_of_bolts,
          standard: r.standard,
          series: r.series,
          nps_inch: r.nps_inch,
          dn: r.dn,
          pressure_class: r.pressure_class,
          flange_face: r.flange_face,
          standard_stud_length_mm: r.standard_stud_length_mm,
          standard_stud_length_inch: r.standard_stud_length_inch,
          notes: r.notes
        });
      }
    });

    const resultGroups = Object.keys(groups).map(function (k) {
      const g = groups[k];
      const lengths = g.items.map(function (it) { return it.standard_stud_length_mm; }).filter(function (l) { return l != null; });
      const minLength = lengths.length ? Math.min.apply(null, lengths) : null;
      const maxLength = lengths.length ? Math.max.apply(null, lengths) : null;
      delete g.itemKeys;

      g.items.sort(function (a, b) {
        const npsA = U.parseNumeric(a.nps_inch) || 0;
        const npsB = U.parseNumeric(b.nps_inch) || 0;
        if (npsA !== npsB) { return npsA - npsB; }
        if (a.pressure_class !== b.pressure_class) { return a.pressure_class - b.pressure_class; }
        return String(a.flange_face).localeCompare(String(b.flange_face));
      });

      return {
        bolt_diameter_decimal_inch: g.bolt_diameter_decimal_inch,
        bolt_diameter_inch: g.bolt_diameter_inch,
        bolt_diameter_mm: g.bolt_diameter_mm,
        thread: g.thread,
        nut_standard: g.nut_standard,
        nut_type: g.nut_type,
        nut_across_flats_mm: g.nut_across_flats_mm,
        nut_across_flats_inch: g.nut_across_flats_inch,
        nut_height_mm: g.nut_height_mm,
        nut_height_inch: g.nut_height_inch,
        wrench_size_mm: g.wrench_size_mm,
        wrench_size_inch: g.wrench_size_inch,
        min_stud_length_mm: minLength,
        max_stud_length_mm: maxLength,
        total_combinations: g.items.length,
        items: g.items
      };
    });

    resultGroups.sort(function (a, b) {
      return a.bolt_diameter_decimal_inch - b.bolt_diameter_decimal_inch;
    });

    return {
      holeCount: count,
      groups: resultGroups
    };
  }

  FSF.Calc = {
    MM_PER_IN: MM_PER_IN,
    sizeRecord: sizeRecord, resolveSize: resolveSize,
    findBolting: findBolting, findBoltingAnyFace: findBoltingAnyFace,
    availableClasses: availableClasses, availableFaces: availableFaces, availableSeries: availableSeries,
    availableHoleCounts: availableHoleCounts, holeCountStats: holeCountStats,
    findNearestHoleCounts: findNearestHoleCounts, findByHoleCount: findByHoleCount,
    findWrenchInch: findWrenchInch, findWrenchMetric: findWrenchMetric, resolveStud: resolveStud,
    nutHeight: nutHeight, parseInchDecimal: parseInchDecimal,
    gasketThickness: gasketThickness, roundStudLength: roundStudLength,
    studLengthBreakdown: studLengthBreakdown,
    rtjRingInfo: rtjRingInfo
  };
})(window.FSF);