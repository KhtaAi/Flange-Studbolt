/* ============================================================================
 * js/search.js - Persian normalisation utils + searchable ComboBox component
 * Vanilla JS, no dependencies, no network access.
 * ==========================================================================*/
window.FSF = window.FSF || {};

/* ------------------------------- utils ---------------------------------- */
(function (FSF) {
  'use strict';
  const FA_DIGITS = /[\u06F0-\u06F9]/g;
  const AR_DIGITS = /[\u0660-\u0669]/g;

  function normalizeFa(value) {
    return String(value == null ? '' : value)
      .replace(FA_DIGITS, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(AR_DIGITS, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/\u064A/g, '\u06CC')   /* Arabic yeh -> Persian yeh */
      .replace(/\u0643/g, '\u06A9')   /* Arabic kaf -> Persian kaf */
      .replace(/[\u200c\u200f\u200e]/g, ' ')  /* ZWNJ / bidi marks */
      .replace(/["'`«»„“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  /* search key: normalised, lower case, separators removed so that
     "1-1/4", "1 1/4" and "11/4" all compare equal                          */
  function searchKey(value) {
    return normalizeFa(value).toLowerCase()
      .replace(/[_\-\u2010-\u2015\u2212]/g, '')
      .replace(/[\/\\]/g, '')
      .replace(/\s+/g, '')
      .replace(/[()]/g, '');
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function round(value, digits) {
    const f = Math.pow(10, digits == null ? 2 : digits);
    return Math.round(value * f) / f;
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  /* decimal inch -> inch fraction string, e.g. 1.75 -> "1-3/4" */
  function inchToFraction(value, denomMax) {
    if (value == null || isNaN(value)) { return ''; }
    denomMax = denomMax || 32;
    const sign = value < 0 ? -1 : 1;
    let x = Math.abs(value);
    let whole = Math.floor(x);
    let n = Math.round((x - whole) * denomMax), d = denomMax;
    const g = gcd(n, d) || 1; n /= g; d /= g;
    if (n === d) { whole += 1; n = 0; d = 1; }
    let out = '';
    if (whole) { out += whole; }
    if (n) { out += (out ? '-' : '') + n + '/' + d; }
    return (sign < 0 ? '-' : '') + (out || '0');
  }
  /* "1-3/4" | "3/4" | "0.75" | "19,05" -> number in the given unit        */
  function parseNumeric(value) {
    const s = normalizeFa(value).replace(/٫/g, '.').replace(/,/g, '.').replace(/\s+/g, '');
    if (!s) { return null; }
    if (/^-?\d*\.?\d+$/.test(s)) { return parseFloat(s); }
    const f = s.match(/^(-?\d+)[-](\d+)\/(\d+)$/);    /* 1-3/4 */
    if (f) { return parseInt(f[1], 10) + parseInt(f[2], 10) / parseInt(f[3], 10); }
    const g = s.match(/^(-?\d+)\/(\d+)$/);            /* 3/4 (also typed as 13/4) */
    if (g) { return parseInt(g[1], 10) / parseInt(g[2], 10); }
    return null;
  }
  /* Parses a size query strictly when there are no letters.
     Normalises Persian/Arabic digits, removes quotes.
     If the string has no letters and only digits/fractions/dashes/spaces,
     converts spaces between digits to create proper fraction forms,
     then evaluates as numeric. Returns null if letters are present.        */
  function parseSizeNumeric(value) {
    if (value == null) { return null; }
    let s = normalizeFa(value).replace(/["'`«»„“”]/g, '').trim();
    if (!s) { return null; }
    if (/[a-zA-Z\u0600-\u06FF]/.test(s)) { return null; }
    if (!/^[\d.\-/\s,]+$/.test(s)) { return null; }
    if (!/\d/.test(s)) { return null; }

    s = s.replace(/(\d+)\s*[-]\s*(\d+)\s+(\d+)/g, '$1-$2/$3');
    s = s.replace(/(\d+)\s+(\d+)\/(\d+)/g, '$1-$2/$3');
    s = s.replace(/(\d+)\s+(\d+)\s+(\d+)/g, '$1-$2/$3');
    s = s.replace(/(\d+)\s+(\d+)/g, '$1/$2');

    return parseNumeric(s);
  }
  function debounce(fn, wait) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 120);
    };
  }
  function csvCell(value) {
    const s = String(value == null ? '' : value);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {
    return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove(); resolve();
      } catch (e) { reject(e); }
    });
  }
  FSF.Utils = {
    normalizeFa: normalizeFa, searchKey: searchKey, escapeHtml: escapeHtml,
    round: round, inchToFraction: inchToFraction, parseNumeric: parseNumeric,
    parseSizeNumeric: parseSizeNumeric,
    debounce: debounce, toCsv: toCsv, download: download, copyText: copyText
  };
})(window.FSF);

/* --------------------------- ComboBox ----------------------------------- */
(function (FSF) {
  'use strict';
  const U = FSF.Utils;

  /* Ranking helper: options are [{value,label,sub,terms:[...],numbers:[...]}].
     Returns a filtered + ranked copy for the given query.                  */
  function filterAndRank(options, query, emptyMessage) {
    emptyMessage = emptyMessage || 'نتیجه‌ای یافت نشد';
    const key = U.searchKey(query);
    if (!key) { return options.slice(0, 200); }
    const numeric = U.parseSizeNumeric ? U.parseSizeNumeric(query) : U.parseNumeric(query);
    const scored = [];
    options.forEach(function (opt) {
      let best = null;
      const terms = opt.terms || [opt.value, opt.label];
      terms.forEach(function (t) {
        let score = null;
        if (numeric !== null) {
          const termNum = U.parseSizeNumeric ? U.parseSizeNumeric(t) : U.parseNumeric(t);
          if (termNum !== null) {
            const diff = Math.abs(termNum - numeric);
            if (diff < 0.001) {
              score = 0;
            } else if (diff <= 0.55) {
              score = 0.5 + diff;
            }
          } else {
            const k = U.searchKey(t);
            if (k) {
              if (k === key) { score = 0; }
              else if (k.indexOf(key) === 0) { score = 1 + k.length / 1000; }
              else if (k.indexOf(key) > 0) { score = 2 + k.length / 1000; }
            }
          }
        } else {
          const k = U.searchKey(t);
          if (k) {
            if (k === key) { score = 0; }
            else if (k.indexOf(key) === 0) { score = 1 + k.length / 1000; }
            else if (k.indexOf(key) > 0) { score = 2 + k.length / 1000; }
          }
        }
        if (score !== null && (best === null || score < best)) { best = score; }
      });
      if (best === null && numeric !== null && opt.numbers) {
        opt.numbers.forEach(function (n) {
          if (typeof n === 'number') {
            const diff = Math.abs(n - numeric);
            if (diff < 0.001) {
              const s = 0;
              if (best === null || s < best) { best = s; }
            } else if (diff <= 0.55) {
              const s = 0.5 + diff / 100;
              if (best === null || s < best) { best = s; }
            }
          }
        });
      }
      if (best !== null) { scored.push({ opt: opt, score: best, label: String(opt.label) }); }
    });
    scored.sort(function (a, b) { return a.score - b.score || a.label.localeCompare(b.label); });
    return scored.map(function (s) { return s.opt; }).slice(0, 200);
  }

  function ComboBox(opts) {
    this.root = opts.root;
    this.input = opts.input;
    this.list = opts.list;
    this.clearBtn = opts.clearBtn;
    this.getOptions = opts.getOptions || function () { return []; };
    this.onSelect = opts.onSelect || function () {};
    this.onChange = opts.onChange || function () {};
    this.emptyMessage = opts.emptyMessage || 'نتیجه‌ای یافت نشد';
    this.openOnFocus = opts.openOnFocus !== false;
    this.minChars = opts.minChars || 0;
    this.allowFreeText = !!opts.allowFreeText;
    this.selected = null;
    this.activeIndex = -1;
    this.items = [];
    this.isOpen = false;
    this._bind();
  }

  ComboBox.prototype._bind = function () {
    const self = this;
    this.input.addEventListener('input', function () {
      self.selected = null;
      self.root.classList.remove('is-invalid');
      self.updateClear();
      self.onChange(self.input.value, null);
      self.refresh();
      if (self.input.value.length >= self.minChars) { self.open(); }
    });
    this.input.addEventListener('focus', function () {
      if (self.openOnFocus) { self.refresh(); self.open(); }
    });
    this.input.addEventListener('keydown', function (e) { self._onKey(e); });
    this.input.addEventListener('blur', function () {
      setTimeout(function () { self.close(); }, 140);   /* allow option click */
    });
    this.input.addEventListener('click', function () { self.refresh(); self.open(); });
    if (this.clearBtn) {
      this.clearBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      this.clearBtn.addEventListener('click', function () { self.clear(); self.input.focus(); });
    }
    document.addEventListener('click', function (e) {
      if (!self.root.contains(e.target)) { self.close(); }
    });
  };

  ComboBox.prototype._onKey = function (e) {
    const key = e.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      if (!this.isOpen) { this.refresh(); this.open(); return; }
      if (!this.items.length) { return; }
      const dir = key === 'ArrowDown' ? 1 : -1;
      this.activeIndex = (this.activeIndex + dir + this.items.length) % this.items.length;
      this._highlight();
    } else if (key === 'Enter') {
      if (this.isOpen && this.items.length) {
        e.preventDefault();
        const idx = this.activeIndex >= 0 ? this.activeIndex : 0;
        this.selectItem(this.items[idx], true);
      } else if (this.allowFreeText) {
        this.commitFreeText();
      }
    } else if (key === 'Escape') {
      if (this.isOpen) { e.preventDefault(); this.close(); }
    } else if (key === 'Tab') {
      this.close();
    } else if (key === 'Home' && this.isOpen) {
      e.preventDefault(); this.activeIndex = 0; this._highlight();
    } else if (key === 'End' && this.isOpen) {
      e.preventDefault(); this.activeIndex = this.items.length - 1; this._highlight();
    }
  };

  ComboBox.prototype.refresh = function () {
    const options = this.getOptions(this.input.value) || [];
    this.items = options;
    this.list.innerHTML = '';
    if (!options.length) {
      const li = document.createElement('li');
      li.className = 'combo-empty';
      li.textContent = this.emptyMessage;
      this.list.appendChild(li);
      this.activeIndex = -1;
      return;
    }
    const self = this;
    options.forEach(function (opt, i) {
      const li = document.createElement('li');
      const isSel = !!(self.selected && self.selected.value === opt.value);
      li.className = 'combo-option' + (isSel ? ' is-selected' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', isSel ? 'true' : 'false');
      li.dataset.index = String(i);
      li.innerHTML = '<span class="opt-main">' + U.escapeHtml(opt.label) + '</span>' +
        (opt.sub ? '<span class="opt-sub">' + U.escapeHtml(opt.sub) + '</span>' : '');
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { self.selectItem(opt, true); });
      li.addEventListener('mousemove', function () { self.activeIndex = i; self._highlight(); });
      self.list.appendChild(li);
    });
    this.activeIndex = 0;
    this._highlight();
  };

  ComboBox.prototype._highlight = function () {
    const nodes = this.list.querySelectorAll('.combo-option');
    for (let i = 0; i < nodes.length; i++) {
      const on = i === this.activeIndex;
      nodes[i].classList.toggle('is-active', on);
      if (on && this.isOpen && nodes[i].scrollIntoView) {
        nodes[i].scrollIntoView({ block: 'nearest' });
      }
    }
  };

  ComboBox.prototype.selectItem = function (opt, fireChange) {
    this.selected = opt;
    this.input.value = opt.label;
    this.root.classList.remove('is-invalid');
    this.updateClear();
    this.close();
    if (fireChange !== false) { this.onSelect(opt.value, opt); }
    this.onChange(this.input.value, opt);
  };

  ComboBox.prototype.commitFreeText = function () {
    const raw = this.input.value.trim();
    if (!raw) { return; }
    this.selected = { value: raw, label: raw, freeText: true };
    this.updateClear();
    this.onSelect(raw, this.selected);
  };

  ComboBox.prototype.setValue = function (value, label) {
    if (value == null || value === '') { this.clear(true); return; }
    this.selected = { value: value, label: label == null ? String(value) : label };
    this.input.value = this.selected.label;
    this.updateClear();
  };

  ComboBox.prototype.getValue = function () {
    return this.selected ? this.selected.value : '';
  };

  ComboBox.prototype.updateClear = function () {
    if (this.clearBtn) { this.clearBtn.hidden = !this.input.value; }
  };

  ComboBox.prototype.open = function () {
    if (this.isOpen) { return; }
    this.isOpen = true;
    this.root.classList.add('is-open');
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this._highlight();
  };

  ComboBox.prototype.close = function () {
    if (!this.isOpen) { return; }
    this.isOpen = false;
    this.root.classList.remove('is-open');
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
  };

  ComboBox.prototype.clear = function (silent) {
    this.input.value = '';
    this.selected = null;
    this.root.classList.remove('is-invalid');
    this.updateClear();
    this.close();
    if (!silent) { this.onSelect('', null); this.onChange('', null); }
  };

  ComboBox.prototype.setInvalid = function (bad) {
    this.root.classList.toggle('is-invalid', !!bad);
  };

  FSF.Search = { ComboBox: ComboBox, filterAndRank: filterAndRank };
})(window.FSF);