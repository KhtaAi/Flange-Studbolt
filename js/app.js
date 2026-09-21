/* ============================================================================
 * js/app.js - bootstrap, tab wiring, combobox providers, actions
 * Fully offline. No dependencies.
 * ==========================================================================*/
window.FSF = window.FSF || {};
(function (FSF) {
  'use strict';
  const U = FSF.Utils;
  const C = FSF.Calc;
  const Store = FSF.Store;
  const UI = FSF.UI;

  const state = {
    size: null,
    cls: null,
    face: 'RF',
    gasketType: 'spiral_wound',
    studUnit: 'inch',
    studResult: null,
    holeCount: null,
    holeResult: null,
    flangeRecords: [],
    currentFlangeText: '',
    currentStudText: '',
    currentHoleText: ''
  };

  let comboSize = null, comboClass = null, comboFace = null,
    comboGasket = null, comboStud = null, comboHole = null;
  let activateTab = function () {};

  /* ---------------------------- error safety ------------------------------ */
  function showError(msg) {
    try {
      const b = document.getElementById('dataSourceBadge');
      if (b) { b.textContent = 'خطا: ' + msg; }
    } catch (e) { /* ignore */ }
  }
  function safe(fn, label) {
    try { fn(); }
    catch (e) {
      console.error('[FSF][' + label + ']', e);
      showError(label);
    }
  }
  window.addEventListener('error', function (e) {
    showError(e && e.message ? String(e.message).slice(0, 80) : 'خطای ناشناخته');
  });

  function on(id, ev, fn) {
    const node = document.getElementById(id);
    if (node) { node.addEventListener(ev, fn); }
  }
  function onAll(selector, ev, fn) {
    document.querySelectorAll(selector).forEach(function (node) {
      node.addEventListener(ev, fn);
    });
  }

  /* ------------------------------- tabs ---------------------------------- */
  function initTabs() {
    const tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    if (!tabs.length) { return function () {}; }
    function activate(id, focus) {
      tabs.forEach(function (t) {
        const on_ = t.dataset.tab === id;
        t.classList.toggle('is-active', on_);
        t.setAttribute('aria-selected', on_ ? 'true' : 'false');
        t.tabIndex = on_ ? 0 : -1;
        const panel = document.getElementById('panel-' + t.dataset.tab);
        if (panel) { panel.hidden = !on_; }
      });
      if (focus) {
        const btn = document.getElementById('tab-' + id);
        if (btn) { btn.focus(); }
      }
      safe(function () {
        if (id === 'history') { UI.renderHistory(); UI.renderFavorites(); }
        if (id === 'settings') { fillSettingsForm(); UI.renderDataStatus(); }
      }, 'panel-' + id);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        safe(function () { activate(t.dataset.tab); }, 'tab-click');
      });
      t.addEventListener('keydown', function (e) {
        let next = null;
        if (e.key === 'ArrowLeft') { next = tabs[(i + 1) % tabs.length]; }
        if (e.key === 'ArrowRight') { next = tabs[(i - 1 + tabs.length) % tabs.length]; }
        if (e.key === 'Home') { next = tabs[0]; }
        if (e.key === 'End') { next = tabs[tabs.length - 1]; }
        if (next) { e.preventDefault(); activate(next.dataset.tab, true); }
      });
    });
    return activate;
  }

  /* --------------------------- combobox options --------------------------- */
  function sizeOptions(query) {
    const sizes = (FSF.data && FSF.data.sizes) || [];
    const opts = sizes.map(function (s) {
      return {
        value: s.nps_inch,
        label: s.nps_inch + '" / DN' + s.dn,
        sub: s.standard + (s.standard === 'ASME B16.47' ? ' Series A/B' : ''),
        terms: [s.nps_inch, 'nps ' + s.nps_inch, 'dn' + s.dn, 'dn ' + s.dn, String(s.dn),
          String(s.nps_decimal_inch), s.standard].concat(s.aliases || []),
        numbers: [s.nps_decimal_inch, s.dn],
        size: s
      };
    });
    return FSF.Search.filterAndRank(opts, query, 'سایزی مطابق جستجو یافت نشد');
  }
  function classOptions(query) {
    const settings = Store.loadSettings();
    const all = [150, 300, 400, 600, 900, 1500, 2500];
    let list = all;
    if (state.size && settings.show_only_available_classes !== false) {
      const avail = C.availableClasses(state.size);
      if (avail.length) { list = avail; }
    }
    const opts = list.map(function (c) {
      return {
        value: c,
        label: 'Class ' + c,
        sub: state.size && state.size.nps_decimal_inch > 24 ? 'ASME B16.47' : 'ASME B16.5',
        terms: [String(c), 'class ' + c, 'کلاس ' + c],
        numbers: [c]
      };
    });
    return FSF.Search.filterAndRank(opts, query, 'کلاسی مطابق جستجو یافت نشد');
  }
  function faceOptions(query) {
    const opts = [
      { value: 'RF', label: 'RF — Raised Face (فیس برجسته)', terms: ['rf', 'raised face', 'برجسته'] },
      { value: 'RTJ', label: 'RTJ — Ring Type Joint (فیس رینگ)', terms: ['rtj', 'ring', 'رینگ'] },
      { value: 'FF', label: 'FF — Flat Face (فیس تخت)', terms: ['ff', 'flat', 'تخت'] }
    ];
    return FSF.Search.filterAndRank(opts, query, 'نوع فیسی یافت نشد');
  }
  function gasketOptions(query) {
    const s = Store.loadSettings();
    const opts = [
      { value: 'spiral_wound', label: 'Spiral Wound Gasket (اسپیرال ووند)', sub: s.spiral_wound_gasket_thickness_mm + ' mm', terms: ['spiral', 'wound', 'اسپیرال'] },
      { value: 'rtj', label: 'RTJ Ring Gasket (رینگ متال)', sub: s.rtj_gasket_thickness_mm + ' mm', terms: ['rtj', 'ring', 'رینگ'] },
      { value: 'flat', label: 'Flat Gasket (گسکت تخت)', sub: s.flat_gasket_thickness_mm + ' mm', terms: ['flat', 'تخت'] },
      { value: 'custom', label: 'Custom Thickness (ضخامت دلخواه)', sub: s.custom_gasket_thickness_mm + ' mm', terms: ['custom', 'دلخواه'] }
    ];
    return FSF.Search.filterAndRank(opts, query, 'نوع گسکتی یافت نشد');
  }
  function studOptions(query) {
    const list = ((FSF.data && FSF.data.wrench) || []).filter(function (r) {
      return state.studUnit === 'mm' ? r.system === 'metric' : r.system === 'inch';
    });
    const opts = list.map(function (r) {
      const label = state.studUnit === 'mm'
        ? (r.thread || ('M' + r.bolt_diameter_mm)) + ' — ' + r.bolt_diameter_mm + ' mm'
        : (r.bolt_diameter_inch + '" — ' + r.bolt_diameter_mm + ' mm');
      return {
        value: state.studUnit === 'mm' ? String(r.bolt_diameter_mm) : r.bolt_diameter_inch,
        label: label,
        sub: 'آچار: ' + r.wrench_size_mm + ' mm / ' + r.wrench_size_inch + '"',
        terms: [r.bolt_diameter_inch, r.thread, String(r.bolt_diameter_mm),
          String(r.bolt_diameter_decimal_inch), label],
        numbers: state.studUnit === 'mm'
          ? [r.bolt_diameter_mm, r.bolt_diameter_inch]
          : [r.bolt_diameter_decimal_inch, r.bolt_diameter_mm],
        rec: r
      };
    });
    return FSF.Search.filterAndRank(opts, query, 'قطر مطابق جستجو یافت نشد');
  }

  function holeOptions(query) {
    const counts = C.availableHoleCounts();
    const stats = C.holeCountStats();
    const opts = counts.map(function (c) {
      const recCount = stats[c] || 0;
      return {
        value: c,
        label: c + ' سوراخ',
        sub: c + ' سوراخ — ' + recCount + ' رکورد در دیتاست',
        terms: [
          String(c),
          c + ' سوراخ',
          'سوراخ ' + c,
          c + ' hole',
          c + ' holes',
          'hole ' + c
        ],
        numbers: [c]
      };
    });
    return FSF.Search.filterAndRank(opts, query, 'تعداد سوراخی مطابق جستجو یافت نشد');
  }

  /* ------------------------------ combos ---------------------------------- */
  function initCombos() {
    function parts(rootId) {
      const root = document.getElementById(rootId);
      if (!root) { return null; }
      return {
        root: root,
        input: root.querySelector('.combo-input'),
        list: root.querySelector('.combo-list'),
        clear: root.querySelector('.combo-clear')
      };
    }
    const s = parts('comboFlangeSize');
    if (s) {
      comboSize = new FSF.Search.ComboBox({
        root: s.root, input: s.input, list: s.list, clearBtn: s.clear,
        emptyMessage: 'سایزی مطابق جستجو یافت نشد',
        getOptions: sizeOptions,
        onSelect: function (value, opt) {
          state.size = opt && opt.size ? opt.size : C.resolveSize(value);
          state.cls = null;
          if (comboClass) { comboClass.clear(true); }
          updateClassHint();
          runFlangeSearch(true);
        }
      });
    }
    const c = parts('comboFlangeClass');
    if (c) {
      comboClass = new FSF.Search.ComboBox({
        root: c.root, input: c.input, list: c.list, clearBtn: c.clear,
        emptyMessage: 'کلاسی مطابق جستجو یافت نشد',
        getOptions: classOptions,
        onSelect: function (value) {
          state.cls = Number(value);
          updateClassHint();
          runFlangeSearch(true);
        }
      });
    }
    const f = parts('comboFlangeFace');
    if (f) {
      comboFace = new FSF.Search.ComboBox({
        root: f.root, input: f.input, list: f.list, clearBtn: f.clear,
        getOptions: faceOptions,
        onSelect: function (value) {
          state.face = value || Store.loadSettings().default_flange_face || 'RF';
          runFlangeSearch(true);
        }
      });
    }
    const g = parts('comboGasketType');
    if (g) {
      comboGasket = new FSF.Search.ComboBox({
        root: g.root, input: g.input, list: g.list, clearBtn: g.clear,
        getOptions: gasketOptions,
        onSelect: function (value, opt) {
          state.gasketType = value || Store.loadSettings().default_gasket_type || 'spiral_wound';
          comboGasket.setValue(state.gasketType, opt ? opt.label : '');
          runFlangeSearch(false);
        }
      });
    }
    const hc = parts('comboHoleCount');
    if (hc) {
      comboHole = new FSF.Search.ComboBox({
        root: hc.root, input: hc.input, list: hc.list, clearBtn: hc.clear,
        emptyMessage: 'تعداد سوراخی مطابق جستجو یافت نشد',
        getOptions: holeOptions,
        onSelect: function (value) {
          state.holeCount = Number(value);
          runHoleSearch();
        }
      });
    }
    const st = parts('comboStudDia');
    if (st) {
      comboStud = new FSF.Search.ComboBox({
        root: st.root, input: st.input, list: st.list, clearBtn: st.clear,
        emptyMessage: 'قطر مطابق جستجو یافت نشد',
        getOptions: studOptions,
        onSelect: function () { runStudSearch(); }
      });
    }

    const settings = Store.loadSettings();
    state.face = settings.default_flange_face || 'RF';
    state.gasketType = settings.default_gasket_type || 'spiral_wound';
    const faceOpt = faceOptions('').filter(function (o) { return o.value === state.face; })[0];
    if (faceOpt && comboFace) { comboFace.setValue(faceOpt.value, faceOpt.label); }
    const gOpt = gasketOptions('').filter(function (o) { return o.value === state.gasketType; })[0];
    if (gOpt && comboGasket) { comboGasket.setValue(gOpt.value, gOpt.label); }
  }

  function updateClassHint() {
    const hint = document.getElementById('flClassHint');
    if (!hint) { return; }
    if (!state.size) {
      hint.textContent = 'کلاس‌های موجود برای سایز انتخابی فیلتر میشوند.';
      return;
    }
    const avail = C.availableClasses(state.size);
    hint.textContent = avail.length
      ? 'کلاس‌های موجود برای ' + state.size.nps_inch + '" در دیتاست: ' + avail.join(' ، ')
      : 'برای این سایز رکوردی در دیتاست محلی نیست.';
  }

  /* ----------------------------- searches -------------------------------- */
  function runFlangeSearch(silentWhenIncomplete) {
    const box = document.getElementById('flangeResult');
    if (!box) { return; }
    if (!state.size || state.cls == null) {
      if (!silentWhenIncomplete) {
        box.innerHTML = UI.emptyStateHtml('برای مشاهده نتیجه، سایز فلنج و کلاس فشاری را انتخاب کنید.', '🔎');
      }
      document.getElementById('flFavoriteBtn').disabled = true;
      return;
    }
    if (comboSize) { comboSize.setValue(state.size.nps_inch, state.size.nps_inch + '" / DN' + state.size.dn); }
    if (comboClass) { comboClass.setValue(state.cls, 'Class ' + state.cls); }

    let records = [];
    let noticeHtml = '';
    if (state.face === 'FF') {
      records = C.findBolting(state.size, state.cls, 'RF');
      noticeHtml = UI.notice('داده فیس FF در جدول محلی موجود نیست. در ASME B16.5/B16.47 طول استادبول فیس FF معمولاً برابر RF است؛ رکورد RF فقط برای مقایسه نمایش داده می‌شود.', 'warn');
    } else {
      records = C.findBolting(state.size, state.cls, state.face);
      if (!records.length) {
        const rf = C.findBolting(state.size, state.cls, 'RF');
        if (rf.length) {
          noticeHtml = UI.notice(UI.NO_DATA_MSG + ' (رکورد RF همین ترکیب به‌عنوان مرجع موجود است)', 'warn');
        }
      }
    }
    state.flangeRecords = records;
    UI.renderFlangeResults(records, { gasketType: state.gasketType, noticeHtml: noticeHtml });
    state.currentFlangeText = records.length ? UI.flangeText(records) : '';
    const favBtn = document.getElementById('flFavoriteBtn');
    if (favBtn) { favBtn.disabled = !records.length; }

    const label = state.size.nps_inch + '" / Class ' + state.cls;
    const extra = { nps: state.size.nps_inch, cls: state.cls };
    if (records.length) {
      const r0 = records[0];
      addHistory('flange', label, r0.number_of_bolts + ' × ' + r0.bolt_diameter_inch +
        '" × ' + r0.standard_stud_length_mm + ' mm', extra);
    } else {
      addHistory('flange', label, 'بدون داده', extra);
    }
  }

  function runStudSearch() {
    const input = document.getElementById('stDiaInput');
    const raw = (comboStud && comboStud.getValue()) || (input ? input.value : '');
    if (!raw) {
      UI.renderStudResults(null, state.studUnit);
      const b = document.getElementById('stFavoriteBtn');
      if (b) { b.disabled = true; }
      return;
    }
    const res = C.resolveStud(raw, state.studUnit);
    state.studResult = res;
    UI.renderStudResults(res, state.studUnit);
    state.currentStudText = res ? UI.studText(res) : '';
    const fav = document.getElementById('stFavoriteBtn');
    if (fav) { fav.disabled = !res; }
    if (res) {
      const r = res.record;
      addHistory('stud', raw, r
        ? ('آچار ' + r.wrench_size_mm + ' mm / ' + r.wrench_size_inch + '"')
        : 'خارج از جدول محلی');
    }
  }

  function runHoleSearch(countOverride) {
    const input = document.getElementById('holeCountInput');
    let raw = countOverride != null
      ? countOverride
      : ((comboHole && comboHole.getValue()) || (input ? input.value : ''));
    raw = U.normalizeFa(String(raw == null ? '' : raw)).trim();
    if (!raw) {
      state.holeCount = null;
      state.holeResult = null;
      state.currentHoleText = '';
      UI.renderHoleResults(null, null, []);
      const b = document.getElementById('holeFavoriteBtn');
      if (b) { b.disabled = true; }
      return;
    }
    const parsed = U.parseNumeric(raw);
    const count = parsed != null ? Math.round(parsed) : null;
    state.holeCount = count;
    if (comboHole && count != null) {
      comboHole.setValue(count, count + ' سوراخ');
    } else if (input && count != null) {
      input.value = count;
    }
    const res = C.findByHoleCount(count);
    state.holeResult = res;
    const nearest = (res && res.groups && res.groups.length) ? [] : C.findNearestHoleCounts(count, 4);
    UI.renderHoleResults(res, count, nearest);
    state.currentHoleText = (res && res.groups && res.groups.length) ? UI.holeText(res) : '';
    const fav = document.getElementById('holeFavoriteBtn');
    if (fav) { fav.disabled = !(res && res.groups && res.groups.length); }

    if (res && res.groups && res.groups.length) {
      const totalCombos = res.groups.reduce(function (sum, g) { return sum + g.total_combinations; }, 0);
      addHistory('hole', count + ' سوراخ', totalCombos + ' ترکیب در ' + res.groups.length + ' گروه قطر');
    } else if (count != null) {
      addHistory('hole', count + ' سوراخ', 'خارج از جدول محلی');
    }
  }

  function addHistory(type, input, summary, extra) {
    const labels = { flange: 'فلنج', stud: 'قطر Stud', hole: 'تعداد Hole فلنج' };
    safe(function () {
      const entry = Object.assign({
        type: type,
        typeLabel: labels[type] || type,
        input: input,
        summary: summary
      }, extra || {});
      Store.addHistory(entry);
    }, 'history-add');
  }

  function setStudUnit(unit) {
    state.studUnit = unit;
    document.querySelectorAll('#stUnit .seg').forEach(function (b) {
      const on_ = b.dataset.unit === unit;
      b.classList.toggle('is-active', on_);
      b.setAttribute('aria-checked', on_ ? 'true' : 'false');
    });
    const input = document.getElementById('stDiaInput');
    if (input) {
      input.placeholder = unit === 'mm' ? 'مثال: 20 ، M20 ، 19.05' : 'مثال: 3/4 ، 0.75 ، 19.05';
    }
    if (comboStud) { comboStud.clear(true); }
    UI.renderStudResults(null, unit);
  }

  /* --------------------------- settings form ------------------------------ */
  function numVal(id) {
    const el = document.getElementById(id);
    if (!el) { return null; }
    const v = parseFloat(el.value);
    return isNaN(v) ? null : v;
  }
  function fillSettingsForm() {
    const s = Store.loadSettings();
    const set = function (id, value) {
      const el = document.getElementById(id);
      if (el) { el.value = value; }
    };
    set('setThreadProjection', s.thread_projection_mm);
    set('setSwGasket', s.spiral_wound_gasket_thickness_mm);
    set('setFlatGasket', s.flat_gasket_thickness_mm);
    set('setRtjGasket', s.rtj_gasket_thickness_mm);
    set('setNutMethod', s.nut_height_method);
    set('setNutFactor', s.nut_height_factor);
    set('setFlangeCount', s.flange_count);
    set('setRoundMode', s.round_stud_length);
    set('setWarnDelta', s.stud_length_warn_delta_mm);
    set('setTheme', s.theme);
    set('setMaxHistory', s.max_history_items);
    const avail = document.getElementById('setShowAvailableClasses');
    if (avail) { avail.checked = s.show_only_available_classes !== false; }
    const calc = document.getElementById('setShowCalc');
    if (calc) { calc.checked = s.show_calc !== false; }
    const diag = document.getElementById('setShowDiagram');
    if (diag) { diag.checked = s.show_diagram !== false; }
  }
  function collectSettings() {
    const avail = document.getElementById('setShowAvailableClasses');
    const calc = document.getElementById('setShowCalc');
    const diag = document.getElementById('setShowDiagram');
    const thick = numVal('setFlatGasket');
    return {
      thread_projection_mm: numVal('setThreadProjection'),
      spiral_wound_gasket_thickness_mm: numVal('setSwGasket'),
      flat_gasket_thickness_mm: thick,
      rtj_gasket_thickness_mm: numVal('setRtjGasket'),
      custom_gasket_thickness_mm: thick,
      nut_height_method: document.getElementById('setNutMethod').value,
      nut_height_factor: numVal('setNutFactor'),
      flange_count: numVal('setFlangeCount'),
      round_stud_length: document.getElementById('setRoundMode').value,
      stud_length_warn_delta_mm: numVal('setWarnDelta'),
      theme: document.getElementById('setTheme').value,
      max_history_items: numVal('setMaxHistory'),
      show_only_available_classes: avail ? avail.checked : true,
      show_calc: calc ? calc.checked : true,
      show_diagram: diag ? diag.checked : true
    };
  }
  function saveSettingsForm(showNote) {
    const saved = Store.saveSettings(collectSettings());
    Store.applyTheme(saved.theme);
    updateClassHint();
    runFlangeSearch(true);
    runStudSearch();
    if (showNote) {
      const note = document.getElementById('setSaveNote');
      if (note) {
        note.hidden = false;
        setTimeout(function () { note.hidden = true; }, 2200);
      }
    }
  }

  function flash(msg) {
    let t = document.getElementById('fsfToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'fsfToast';
      t.style.cssText = 'position:fixed;bottom:18px;inset-inline-start:50%;transform:translateX(50%);' +
        'background:var(--accent);color:var(--accent-ink);padding:10px 18px;border-radius:999px;' +
        'font-weight:600;z-index:80;box-shadow:var(--shadow-1);transition:opacity .3s;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(function () { t.style.opacity = '0'; }, 1800);
  }

  /* --------------------------- result actions ----------------------------- */
  function initActions() {
    const flangeBox = document.getElementById('flangeResult');
    if (flangeBox) {
      flangeBox.addEventListener('click', function (e) {
        const act = e.target.closest('[data-act]');
        if (!act) { return; }
        const kind = act.dataset.act;
        if (kind === 'copy-flange') {
          U.copyText(state.currentFlangeText || UI.flangeText(state.flangeRecords))
            .then(function () { flash('نتیجه در کلیپ‌بورد کپی شد.'); })
            .catch(function () { flash('کپی ناموفق بود؛ متن را دستی انتخاب کنید.'); });
        }
        if (kind === 'csv-flange') {
          U.download('flange-results.csv', U.toCsv(UI.flangeRows(state.flangeRecords)), 'text/csv');
        }
        if (kind === 'print') { window.print(); }
      });
    }
    const studBox = document.getElementById('studResult');
    if (studBox) {
      studBox.addEventListener('click', function (e) {
        const act = e.target.closest('[data-act]');
        if (!act) { return; }
        const kind = act.dataset.act;
        if (kind === 'copy-stud') {
          U.copyText(state.currentStudText || '').then(function () { flash('نتیجه کپی شد.'); });
        }
        if (kind === 'csv-stud') {
          U.download('stud-wrench.csv', U.toCsv(UI.studRows(state.studResult)), 'text/csv');
        }
        if (kind === 'print') { window.print(); }
      });
    }
    const holeBox = document.getElementById('holeResult');
    if (holeBox) {
      holeBox.addEventListener('click', function (e) {
        const quick = e.target.closest('.quick-hole-btn');
        if (quick && quick.dataset.hole) {
          runHoleSearch(Number(quick.dataset.hole));
          return;
        }
        const act = e.target.closest('[data-act]');
        if (!act) { return; }
        const kind = act.dataset.act;
        if (kind === 'copy-hole') {
          U.copyText(state.currentHoleText || UI.holeText(state.holeResult))
            .then(function () { flash('نتیجه در کلیپ‌بورد کپی شد.'); })
            .catch(function () { flash('کپی ناموفق بود؛ متن را دستی انتخاب کنید.'); });
        }
        if (kind === 'csv-hole') {
          U.download('flange-by-holes-' + (state.holeCount || 'result') + '.csv', U.toCsv(UI.holeRows(state.holeResult)), 'text/csv');
        }
        if (kind === 'print') { window.print(); }
      });
    }
  }

  /* --------------------------- control groups ----------------------------- */
  function initFlangeControls() {
    on('flFindBtn', 'click', function () { runFlangeSearch(false); });
    on('flResetBtn', 'click', function () {
      if (comboSize) { comboSize.clear(true); }
      if (comboClass) { comboClass.clear(true); }
      state.size = null;
      state.cls = null;
      const box = document.getElementById('flangeResult');
      if (box) { box.innerHTML = UI.emptyStateHtml('سایز فلنج و کلاس فشاری را انتخاب کنید.', '🔎'); }
    });
    on('flFavoriteBtn', 'click', function () {
      if (!state.flangeRecords.length) { return; }
      const r = state.flangeRecords[0];
      const label = r.nps_inch + '" DN' + r.dn + ' CL' + r.pressure_class + ' ' + state.face;
      const res = Store.toggleFavorite({
        id: 'flange:' + r.id, kind: 'flange', label: label,
        nps: r.nps_inch, cls: r.pressure_class, face: state.face, gasket: state.gasketType
      });
      UI.renderFavorites();
      flash(res.added ? 'به علاقه‌مندی‌ها اضافه شد.' : 'از علاقه‌مندی‌ها حذف شد.');
    });
  }

  function initStudControls() {
    on('stFindBtn', 'click', runStudSearch);
    on('stResetBtn', 'click', function () {
      if (comboStud) { comboStud.clear(true); }
      state.studResult = null;
      const box = document.getElementById('studResult');
      if (box) { box.innerHTML = UI.emptyStateHtml('قطر استادبول را انتخاب کنید.', '🔧'); }
    });
    on('stFavoriteBtn', 'click', function () {
      if (!state.studResult) { return; }
      const r = state.studResult.record;
      const label = r ? (r.thread || r.bolt_diameter_inch + '"') : String(state.studResult.inch);
      const res = Store.toggleFavorite({ id: 'stud:' + label, kind: 'stud', label: label, dia: label });
      UI.renderFavorites();
      flash(res.added ? 'به علاقه‌مندی‌ها اضافه شد.' : 'از علاقه‌مندی‌ها حذف شد.');
    });
    onAll('#stUnit .seg', 'click', function () { setStudUnit(this.dataset.unit); });
    on('stDiaInput', 'keydown', function (e) {
      if (e.key === 'Enter') { runStudSearch(); }
    });
    on('stNutSelect', 'change', function (e) {
      const map = { heavy: 'heavy_hex_table', regular: 'regular_hex_table', auto: 'heavy_hex_table' };
      Store.saveSettings({ nut_height_method: map[e.target.value] || 'heavy_hex_table' });
      runStudSearch();
    });
  }

  function initHoleControls() {
    on('holeFindBtn', 'click', function () { runHoleSearch(); });
    on('holeResetBtn', 'click', function () {
      if (comboHole) { comboHole.clear(true); }
      state.holeCount = null;
      state.holeResult = null;
      state.currentHoleText = '';
      UI.renderHoleResults(null, null, []);
      const fav = document.getElementById('holeFavoriteBtn');
      if (fav) { fav.disabled = true; }
    });
    on('holeFavoriteBtn', 'click', function () {
      if (!state.holeResult || !state.holeResult.groups || !state.holeResult.groups.length) { return; }
      const count = state.holeCount;
      const label = count + ' سوراخ فلنج';
      const res = Store.toggleFavorite({ id: 'hole:' + count, kind: 'hole', label: label, count: count });
      UI.renderFavorites();
      flash(res.added ? 'به علاقه‌مندی‌ها اضافه شد.' : 'از علاقه‌مندی‌ها حذف شد.');
    });
    on('holeCountInput', 'keydown', function (e) {
      if (e.key === 'Enter') { runHoleSearch(); }
    });
  }

  function initHeaderControls() {
    on('themeToggle', 'click', function () {
      const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      Store.applyTheme(cur);
      Store.saveSettings({ theme: cur });
      fillSettingsForm();
    });
  }

  function initSettingsControls() {
    on('setSaveBtn', 'click', function () { saveSettingsForm(true); });
    on('setSaveBtn2', 'click', function () { saveSettingsForm(true); });
    on('setResetBtn', 'click', function () {
      Store.resetSettings();
      fillSettingsForm();
      Store.applyTheme(Store.loadSettings().theme);
      runFlangeSearch(true);
      runStudSearch();
      flash('تنظیمات به پیش‌فرض بازگشت.');
    });
  }

  function initHistoryControls() {
    on('histClearBtn', 'click', function () {
      Store.clearHistory();
      UI.renderHistory();
    });
    on('histExportBtn', 'click', function () {
      const rows = [['زمان', 'نوع', 'ورودی', 'خلاصه']];
      Store.loadHistory().forEach(function (h) {
        rows.push([h.time, h.typeLabel || h.type, h.input, h.summary || '']);
      });
      U.download('fsf-history.csv', U.toCsv(rows), 'text/csv');
    });
    const tbody = document.querySelector('#historyTable tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-hist]');
        if (!btn) { return; }
        const h = Store.loadHistory()[Number(btn.dataset.hist)];
        if (!h) { return; }
        if (h.type === 'flange') {
          let size = null;
          let cls = null;
          if (h.nps && h.cls) {
            size = C.resolveSize(h.nps);
            cls = Number(h.cls);
          }
          if (!size || !cls) {
            const chunk = String(h.input).split('/')[0];
            const clsPart = String(h.input).split('Class')[1];
            size = C.resolveSize(chunk);
            cls = clsPart ? parseInt(clsPart.replace(/\D/g, ''), 10) : null;
          }
          if (size && cls) {
            state.size = size;
            state.cls = cls;
            activateTab('flange');
            runFlangeSearch(false);
          }
        } else if (h.type === 'stud') {
          const probe = C.resolveStud(h.input, 'inch');
          const metric = probe && probe.record && probe.record.system === 'metric';
          setStudUnit(metric ? 'mm' : 'inch');
          if (comboStud) { comboStud.setValue(h.input, h.input); }
          activateTab('stud');
          runStudSearch();
        } else if (h.type === 'hole') {
          const count = U.parseNumeric(U.normalizeFa(String(h.input || '')));
          if (count) {
            activateTab('hole');
            runHoleSearch(count);
          }
        }
      });
    }
    on('favClearBtn', 'click', function () {
      Store.clearFavorites();
      UI.renderFavorites();
    });
    on('favExportBtn', 'click', function () {
      U.download('fsf-favorites.json', JSON.stringify(Store.loadFavorites(), null, 2), 'application/json');
    });
    document.addEventListener('fsf:runFavorite', function (e) {
      const f = e.detail || {};
      if (f.kind === 'flange') {
        const size = C.resolveSize(f.nps);
        if (size && f.cls) {
          state.size = size;
          state.cls = Number(f.cls);
          if (f.face) { state.face = f.face; }
          if (f.gasket) { state.gasketType = f.gasket; }
          activateTab('flange');
          runFlangeSearch(false);
        }
      } else if (f.kind === 'stud') {
        const probe = C.resolveStud(f.dia, 'inch');
        const metric = probe && probe.record && probe.record.system === 'metric';
        setStudUnit(metric ? 'mm' : 'inch');
        if (comboStud) { comboStud.setValue(f.dia, f.dia); }
        activateTab('stud');
        runStudSearch();
      } else if (f.kind === 'hole') {
        activateTab('hole');
        runHoleSearch(f.count);
      }
    });
  }

  function initDataControls() {
    on('importBolting', 'change', function (e) { importData(e.target.files[0], 'bolting', 'flange-bolting'); });
    on('importWrench', 'change', function (e) { importData(e.target.files[0], 'wrench', 'stud-wrench-map'); });
    on('importSizes', 'change', function (e) { importData(e.target.files[0], 'sizes', 'flange-sizes'); });
    on('exportDataBtn', 'click', function () {
      const meta = (FSF.dataSources && FSF.dataSources.bolting ? FSF.dataSources.bolting.doc.meta : {}) || {};
      const pack = { meta: meta, sizes: FSF.data.sizes, bolting: FSF.data.bolting, wrench: FSF.data.wrench };
      U.download('fsf-data-pack.json', JSON.stringify(pack, null, 2), 'application/json');
    });
    on('exportSettingsBtn', 'click', function () {
      U.download('settings.json', JSON.stringify(Store.loadSettings(), null, 2), 'application/json');
    });
    on('clearOverridesBtn', 'click', function () {
      Store.clearOverrides();
      Store.loadAll().then(function () {
        UI.renderDataStatus();
        UI.updateSourceBadge();
        runFlangeSearch(true);
        runStudSearch();
        flash('داده‌های بارگذاری‌شده حذف شد.');
      });
    });
    function importData(file, kind, label) {
      if (!file) { return; }
      const status = document.getElementById('importStatus');
      Store.parseJsonFile(file).then(function (doc) {
        const ok = kind === 'sizes' ? Array.isArray(doc.sizes)
          : (Array.isArray(doc.records) || Array.isArray(doc));
        if (!ok) { throw new Error('ساختار فایل معتبر نیست (records یا sizes یافت نشد).'); }
        if (kind !== 'sizes' && Array.isArray(doc)) { doc = { records: doc }; }
        Store.setOverride(kind, doc);
        return Store.loadAll();
      }).then(function () {
        UI.renderDataStatus();
        UI.updateSourceBadge();
        runFlangeSearch(true);
        runStudSearch();
        if (status) { status.textContent = 'فایل ' + label + '.json با موفقیت بارگذاری شد.'; }
        flash('فایل ' + label + '.json بارگذاری شد.');
      }).catch(function (err) {
        if (status) { status.textContent = err.message; }
      });
    }
  }

  /* ------------------------------- init ---------------------------------- */
  function initialRender() {
    UI.renderFlangeResults([], { noticeHtml: '' });
    const box = document.getElementById('flangeResult');
    if (box) {
      box.innerHTML = UI.emptyStateHtml('سایز فلنج و کلاس فشاری را انتخاب کنید — نتیجه بلافاصله نمایش داده می‌شود.', '🔎');
    }
    UI.renderStudResults(null, 'inch');
    UI.renderHoleResults(null, null, []);
    UI.renderHistory();
    UI.renderFavorites();
    UI.renderDataStatus();
    UI.updateSourceBadge();
  }

  let booted = false;
  function init() {
    if (booted) { return; }
    booted = true;
    safe(function () { Store.applyTheme(Store.loadSettings().theme); }, 'theme');
    activateTab = initTabs();
    safe(initCombos, 'combos');
    safe(initActions, 'actions');
    safe(initFlangeControls, 'flange-controls');
    safe(initStudControls, 'stud-controls');
    safe(initHoleControls, 'hole-controls');
    safe(initHeaderControls, 'header-controls');
    safe(initSettingsControls, 'settings-controls');
    safe(initHistoryControls, 'history-controls');
    safe(initDataControls, 'data-controls');
    safe(initialRender, 'initial-render');
  }

  /* Boot: works both when the DOM is still loading and when this script runs
     after DOMContentLoaded has already fired (e.g. opened from file:// with a
     warm cache), so the UI is always wired up.                              */
  function boot() {
    Store.loadAll().then(function () {
      safe(init, 'init');
    }).catch(function (err) {
      console.error(err);
      showError('بارگذاری داده‌ها');
      safe(init, 'init-fallback');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})(window.FSF);







