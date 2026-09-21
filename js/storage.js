/* ============================================================================
 * js/storage.js - localStorage settings/history/favorites + offline data loading
 *
 * Data priority: user-imported JSON (localStorage) > data/*.json (fetch) >
 * data/data-embedded.js fallback globals (needed because browsers block fetch()
 * on file:// URLs).
 * ==========================================================================*/
window.FSF = window.FSF || {};
(function (FSF) {
  'use strict';
  const U = FSF.Utils;

  const KEYS = {
    settings: 'fsf.settings.v1',
    history: 'fsf.history.v1',
    favorites: 'fsf.favorites.v1',
    overrides: 'fsf.data.v1'
  };

  /* ------------------------- settings ------------------------------------ */
  function defaultSettings() {
    const fileDefaults = (window.FSF_DATA && window.FSF_DATA.settings) || {};
    return Object.assign({
      thread_projection_mm: 6,
      spiral_wound_gasket_thickness_mm: 4.5,
      flat_gasket_thickness_mm: 3,
      rtj_gasket_thickness_mm: 12.7,
      custom_gasket_thickness_mm: 4.5,
      nut_height_method: 'heavy_hex_table',
      nut_height_factor: 1.0,
      flange_count: 2,
      round_stud_length: 'up_1mm',
      stud_length_warn_delta_mm: 6,
      default_flange_face: 'RF',
      default_gasket_type: 'spiral_wound',
      show_only_available_classes: true,
      show_calc: true,
      show_diagram: true,
      max_history_items: 30,
      theme: 'dark',
      language: 'fa'
    }, fileDefaults, { _meta: undefined });
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { return fallback; }
      const val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function loadSettings() {
    const def = defaultSettings();
    const saved = read(KEYS.settings, {});
    Object.keys(saved).forEach(function (k) {
      if (saved[k] !== undefined && saved[k] !== null && saved[k] !== '') { def[k] = saved[k]; }
    });
    return def;
  }
  function saveSettings(patch) {
    const merged = loadSettings();
    Object.keys(patch || {}).forEach(function (k) {
      if (patch[k] !== undefined && patch[k] !== null && patch[k] !== '') { merged[k] = patch[k]; }
    });
    write(KEYS.settings, merged);
    return merged;
  }
  function resetSettings() {
    try { localStorage.removeItem(KEYS.settings); } catch (e) { /* ignore */ }
    return loadSettings();
  }

  /* ------------------------- history / favorites -------------------------- */
  function loadHistory() { return read(KEYS.history, []); }
  function addHistory(entry) {
    const list = loadHistory();
    const settings = loadSettings();
    const max = settings.max_history_items || 30;
    list.unshift(Object.assign({ time: new Date().toISOString() }, entry));
    while (list.length > max) { list.pop(); }
    write(KEYS.history, list);
    return list;
  }
  function clearHistory() { write(KEYS.history, []); }

  function loadFavorites() { return read(KEYS.favorites, []); }
  function hasFavorite(id) { return loadFavorites().some(function (f) { return f.id === id; }); }
  function toggleFavorite(fav) {
    const list = loadFavorites();
    const idx = list.findIndex(function (f) { return f.id === fav.id; });
    if (idx >= 0) { list.splice(idx, 1); } else { list.unshift(fav); }
    write(KEYS.favorites, list);
    return { list: list, added: idx < 0 };
  }
  function removeFavorite(id) {
    write(KEYS.favorites, loadFavorites().filter(function (f) { return f.id !== id; }));
  }
  function clearFavorites() { write(KEYS.favorites, []); }

  /* ------------------------- data overrides ------------------------------- */
  function getOverrides() { return read(KEYS.overrides, {}); }
  function setOverride(kind, doc) {
    const all = getOverrides();
    all[kind] = { doc: doc, time: new Date().toISOString() };
    write(KEYS.overrides, all);
  }
  function clearOverrides() { write(KEYS.overrides, {}); }

  /* ------------------------- data loading --------------------------------- */
  /* fetch() fails on file:// in Chrome/Edge, so every source is optional and
     we always fall back to the embedded copy in data/data-embedded.js        */
  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    });
  }
  function pickDoc(sourceName, fetched, kind) {
    const ov = getOverrides();
    if (ov[kind] && ov[kind].doc) {
      return { doc: ov[kind].doc, source: 'بارگذاری‌شده توسط کاربر', time: ov[kind].time };
    }
    if (fetched) { return { doc: fetched, source: 'فایل data/*.json' }; }
    const embedded = window.FSF_DATA || {};
    if (embedded[kind]) { return { doc: embedded[kind], source: 'نسخه داخلی (data-embedded.js)' }; }
    console.warn('[FSF] no data source for ' + sourceName);
    return { doc: kind === 'settings' ? { settings: {} } : { records: [], sizes: [] }, source: 'خالی' };
  }

  function loadAll() {
    const wants = [
      fetchJson('data/flange-sizes.json').catch(function () { return null; }),
      fetchJson('data/flange-bolting.json').catch(function () { return null; }),
      fetchJson('data/stud-wrench-map.json').catch(function () { return null; }),
      fetchJson('data/settings.json').catch(function () { return null; })
    ];
    return Promise.all(wants).then(function (res) {
      const sizesDoc = pickDoc('flange-sizes.json', res[0], 'sizes');
      const boltDoc = pickDoc('flange-bolting.json', res[1], 'bolting');
      const wrenchDoc = pickDoc('stud-wrench-map.json', res[2], 'wrench');
      const settingsDoc = pickDoc('settings.json', res[3], 'settings');
      FSF.data = {
        sizes: (sizesDoc.doc && sizesDoc.doc.sizes) || [],
        bolting: (boltDoc.doc && boltDoc.doc.records) || [],
        wrench: (wrenchDoc.doc && wrenchDoc.doc.records) || [],
        settingsDoc: settingsDoc.doc || {}
      };
      FSF.dataSources = {
        sizes: sizesDoc, bolting: boltDoc, wrench: wrenchDoc, settings: settingsDoc
      };
      return FSF.data;
    });
  }
  function refreshFromOverrides() { return loadAll(); }

  function dataSummary() {
    const d = FSF.data || {};
    return {
      sizes: (d.sizes || []).length,
      bolting: (d.bolting || []).length,
      wrench: (d.wrench || []).length
    };
  }

  /* ------------------------- misc helpers --------------------------------- */
  function applyTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    const label = document.getElementById('themeToggleLabel');
    if (btn) { btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false'); }
    if (label) { label.textContent = t === 'dark' ? 'حالت روشن' : 'حالت تاریک'; }
    const ico = btn ? btn.querySelector('.ico') : null;
    if (ico) { ico.textContent = t === 'dark' ? '☀️' : '🌙'; }
    try { localStorage.setItem('fsf.theme', t); } catch (e) { /* ignore */ }
  }

  function parseJsonFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        try { resolve(JSON.parse(String(reader.result))); }
        catch (e) { reject(new Error('فایل JSON معتبر نیست: ' + e.message)); }
      };
      reader.onerror = function () { reject(new Error('خطا در خواندن فایل')); };
      reader.readAsText(file, 'utf-8');
    });
  }

  FSF.Store = {
    KEYS: KEYS,
    defaultSettings: defaultSettings, loadSettings: loadSettings, saveSettings: saveSettings,
    resetSettings: resetSettings,
    loadHistory: loadHistory, addHistory: addHistory, clearHistory: clearHistory,
    loadFavorites: loadFavorites, hasFavorite: hasFavorite, toggleFavorite: toggleFavorite,
    removeFavorite: removeFavorite, clearFavorites: clearFavorites,
    getOverrides: getOverrides, setOverride: setOverride, clearOverrides: clearOverrides,
    loadAll: loadAll, refreshFromOverrides: refreshFromOverrides, dataSummary: dataSummary,
    applyTheme: applyTheme, parseJsonFile: parseJsonFile
  };
})(window.FSF);