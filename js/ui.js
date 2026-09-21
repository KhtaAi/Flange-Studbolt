/* ============================================================================
 * js/ui.js - DOM rendering for results, history, favorites, data status
 * ==========================================================================*/
window.FSF = window.FSF || {};
(function (FSF) {
  'use strict';
  const U = FSF.Utils;
  const C = FSF.Calc;

  function esc(v) { return U.escapeHtml(v); }
  /* keeps "value + unit" fragments readable inside Persian (RTL) sentences */
  function ltr(v) { return '<span class="num-ltr">' + esc(v) + '</span>'; }
  function kv(label, value, opts) {
    opts = opts || {};
    return '<div class="kv' + (opts.hero ? ' is-hero' : '') + '">' +
      '<span class="kv-label">' + esc(label) + '</span>' +
      '<span class="kv-value' + (opts.ltr || opts.dir === 'ltr' ? ' dir-ltr' : '') + '">' + value + '</span></div>';
  }
  function badge(text, cls) { return '<span class="badge ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function notice(text, kind) { return '<div class="notice notice-' + (kind || 'info') + '">' + text + '</div>'; }

  const DISCLAIMER = 'نتایج باید با آخرین ویرایش استاندارد، مدارک پروژه و دیتاشیت سازنده کنترل شود.';
  const NO_DATA_MSG = 'داده برای این ترکیب در جدول محلی وجود ندارد. لطفاً دیتابیس را ویرایش یا تکمیل کنید.';

  function fmtMm(v, digits) { return v == null ? '—' : U.round(v, digits == null ? 1 : digits); }
  function confidenceBadge(record) {
    if (record.confidence === 'high') { return badge('داده تاییدشده جدول', 'badge-ok'); }
    return badge('نیازمند بازبینی', 'badge-warn');
  }
  function modelFitNote(record) {
    if (record.model_fit === 'matched') {
      return 'طول جدول استاندارد با مدل محاسباتی ساده (۲ فلنج + گسکت + ۲ مهره + بیرون‌زدگی) همخوان است.';
    }
    if (record.model_fit_reason === 'rtj') {
      return 'برای RTJ، نشست رینگ در شیار دو فلنج در طول جدول لحاظ شده است' +
        (record.stud_length_extra_vs_rf_mm != null
          ? ' (حدود ' + U.round(record.stud_length_extra_vs_rf_mm, 1) + ' میلی‌متر بیشتر از RF).' : '.');
    }
    if (record.model_fit === 'table_governs') {
      return 'طول جدول استاندارد برای این رکورد حاشیه بیشتری نسبت به مدل ساده دارد؛ مقدار جدول مبنا است.';
    }
    return null;
  }

  /* ---------------------- schematic svg diagrams -------------------------- */
  const FS_DIM = 13;   // Dimension numbers and texts
  const FS_LABEL = 12; // Component labels, legends, captions
  const FS_TITLE = 15; // View titles / headers

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function isPersianChar(c) {
    const code = c.charCodeAt(0);
    return (code >= 0x0600 && code <= 0x06FF) || (code >= 0xFB50 && code <= 0xFDFF) || (code >= 0xFE70 && code <= 0xFEFF);
  }

  function approxTextWidth(str, fs) {
    fs = fs || FS_DIM;
    const s = String(str || '');
    let w = 0;
    for (let i = 0; i < s.length; i++) {
      if (isPersianChar(s[i])) {
        w += 0.55 * fs;
      } else {
        w += 0.60 * fs;
      }
    }
    return w;
  }

  function clampX(x, text, fs, anchor, minX, maxX) {
    minX = minX == null ? 100 : minX;
    maxX = maxX == null ? 900 : maxX;
    const w = approxTextWidth(text, fs);
    if (anchor === 'start') {
      return clamp(x, minX, maxX - w);
    }
    if (anchor === 'end') {
      return clamp(x, minX + w, maxX);
    }
    return clamp(x, minX + w / 2, maxX - w / 2);
  }

  function clampGroupX(x, texts, fontSizes, anchor, minX, maxX) {
    minX = minX == null ? 100 : minX;
    maxX = maxX == null ? 900 : maxX;
    let maxW = 0;
    for (let i = 0; i < texts.length; i++) {
      if (texts[i]) {
        const fs = fontSizes && fontSizes[i] ? fontSizes[i] : FS_DIM;
        const w = approxTextWidth(texts[i], fs);
        if (w > maxW) { maxW = w; }
      }
    }
    if (anchor === 'start') {
      return clamp(x, minX, maxX - maxW);
    }
    if (anchor === 'end') {
      return clamp(x, minX + maxW, maxX);
    }
    return clamp(x, minX + maxW / 2, maxX - maxW / 2);
  }

  function svgDimH(x1, x2, y, label, sublabel, minX, maxX) {
    if (x1 > x2) { const t = x1; x1 = x2; x2 = t; }
    minX = minX == null ? 100 : minX;
    maxX = maxX == null ? 900 : maxX;
    x1 = clamp(x1, minX, maxX);
    x2 = clamp(x2, minX, maxX);
    const midX = U.round((x1 + x2) / 2, 1);
    const texts = sublabel ? [label, sublabel] : [label];
    const fss = sublabel ? [FS_DIM, FS_LABEL] : [FS_DIM];
    const groupX = clampGroupX(midX, texts, fss, 'middle', minX, maxX);
    let out = '<g class="diag-dim">' +
      '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="var(--text-3)" stroke-width="1.2"/>' +
      '<polygon points="' + x1 + ',' + y + ' ' + (x1 + 6) + ',' + (y - 3.5) + ' ' + (x1 + 6) + ',' + (y + 3.5) + '" fill="var(--text-3)"/>' +
      '<polygon points="' + x2 + ',' + y + ' ' + (x2 - 6) + ',' + (y - 3.5) + ' ' + (x2 - 6) + ',' + (y + 3.5) + '" fill="var(--text-3)"/>' +
      '<text x="' + groupX + '" y="' + (y - 6) + '" text-anchor="middle" fill="var(--text)" font-size="' + FS_DIM + '" font-weight="600" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">' +
      esc(label) + '</text>';
    if (sublabel) {
      out += '<text x="' + groupX + '" y="' + (y + 16) + '" text-anchor="middle" fill="var(--text-3)" font-size="' + FS_LABEL + '" font-family="var(--font-fa)" direction="rtl" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">' +
        esc(sublabel) + '</text>';
    }
    out += '</g>';
    return out;
  }

  function svgDimV(x, y1, y2, label, labelPos, sublabel, minY, maxY) {
    if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
    minY = minY == null ? 80 : minY;
    maxY = maxY == null ? 330 : maxY;
    y1 = clamp(y1, minY, maxY);
    y2 = clamp(y2, minY, maxY);
    const midY = U.round((y1 + y2) / 2, 1);
    const isLeft = labelPos === 'left';
    const tx = isLeft ? (x - 8) : (x + 8);
    const anchor = isLeft ? 'end' : 'start';
    const texts = sublabel ? [label, sublabel] : [label];
    const fss = sublabel ? [FS_DIM, FS_LABEL] : [FS_DIM];
    const clampedTx = clampGroupX(tx, texts, fss, anchor, 100, 900);
    let out = '<g class="diag-dim">' +
      '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="var(--text-3)" stroke-width="1.2"/>' +
      '<polygon points="' + x + ',' + y1 + ' ' + (x - 3.5) + ',' + (y1 + 6) + ' ' + (x + 3.5) + ',' + (y1 + 6) + '" fill="var(--text-3)"/>' +
      '<polygon points="' + x + ',' + y2 + ' ' + (x - 3.5) + ',' + (y2 - 6) + ' ' + (x + 3.5) + ',' + (y2 - 6) + '" fill="var(--text-3)"/>' +
      '<text x="' + clampedTx + '" y="' + (midY + 4.5) + '" text-anchor="' + anchor + '" fill="var(--text)" font-size="' + FS_DIM + '" font-weight="600" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">' +
      esc(label) + '</text>';
    if (sublabel) {
      out += '<text x="' + clampedTx + '" y="' + (midY + 20) + '" text-anchor="' + anchor + '" fill="var(--text-3)" font-size="' + FS_LABEL + '" font-family="var(--font-fa)" direction="rtl" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">' +
        esc(sublabel) + '</text>';
    }
    out += '</g>';
    return out;
  }

  function flangeDiagramSvg(record, ctx, settings) {
    if (!record) { return ''; }
    settings = settings || (FSF.Store ? FSF.Store.loadSettings() : {});
    ctx = ctx || {};

    const n = Math.max(1, Number(record.number_of_bolts) || 4);
    const boltIn = record.bolt_diameter_inch ? record.bolt_diameter_inch + '"' : '';
    const boltMm = record.bolt_diameter_mm != null ? fmtMm(record.bolt_diameter_mm, 2) + ' mm' : '';
    const holeLabel = n + ' × ' + boltIn + (boltMm ? ' (' + boltMm + ')' : '');

    // ----------------- 1. Front View Geometry (viewBox: 0 0 1000 420) -----------------
    const cx = 500, cy = 210;
    const R_outer = 155, R_pcd = 112, R_bore = 50;
    const rHole = n > 24 ? 4.5 : (n > 16 ? 6 : (n > 8 ? 8 : 10.5));
    const offsetAngle = Math.PI / n;

    let holesSvg = '';
    let chosenHoleX = cx + R_pcd, chosenHoleY = cy;
    let minAngDiff = 999;
    const targetAng = -Math.PI / 4; // -45 deg (top-right quadrant)

    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + offsetAngle + (i * 2 * Math.PI / n);
      const hx = U.round(cx + R_pcd * Math.cos(ang), 1);
      const hy = U.round(cy + R_pcd * Math.sin(ang), 1);

      let normAng = ang;
      while (normAng < -Math.PI) { normAng += 2 * Math.PI; }
      while (normAng > Math.PI) { normAng -= 2 * Math.PI; }
      const diff = Math.abs(normAng - targetAng);
      if (diff < minAngDiff) {
        minAngDiff = diff;
        chosenHoleX = hx;
        chosenHoleY = hy;
      }
      holesSvg += '<circle cx="' + hx + '" cy="' + hy + '" r="' + rHole + '" fill="var(--surface)" stroke="#2563eb" stroke-width="2"/>';
    }

    // Callout 1 (Top-Right): Hole count & bolt diameter (Short Leader & Safe Margin Clamped)
    const leader1XEnd = clampGroupX(880, [holeLabel, 'تعداد سوراخ × قطر پیچ'], [FS_DIM, FS_LABEL], 'end', 100, 900);
    const leader1XElbow = clamp(chosenHoleX + 50, 620, leader1XEnd - 30);
    const leader1Y = 95;

    // Callout 2 (Top-Left): PCD (Short Leader & Safe Margin Clamped)
    const pcdAng = -3 * Math.PI / 4; // -135 deg (top-left quadrant)
    const pcdX1 = U.round(cx + R_pcd * Math.cos(pcdAng), 1);
    const pcdY1 = U.round(cy + R_pcd * Math.sin(pcdAng), 1);
    const leader2XStart = clampGroupX(120, ['دایره گام پیچ (PCD)', 'Pitch Circle Diameter'], [FS_DIM, FS_LABEL], 'start', 100, 900);
    const leader2XElbow = clamp(pcdX1 - 50, leader2XStart + 30, 380);
    const leader2Y = 95;

    const frontSvg = '<svg class="diagram-svg" viewBox="0 0 1000 420" role="img" aria-label="دیاگرام ابعادی فلنج: نمای روبه‌رو شامل چیدمان سوراخ‌ها و دایره گام پیچ">' +
      '<title>نمای روبه‌روی فلنج (Front View)</title>' +
      '<line x1="100" y1="' + cy + '" x2="900" y2="' + cy + '" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="10,6,3,6"/>' +
      '<line x1="' + cx + '" y1="40" x2="' + cx + '" y2="380" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="10,6,3,6"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_outer + '" fill="var(--surface-2)" stroke="#2563eb" stroke-width="2.5"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_pcd + '" fill="none" stroke="var(--text-3)" stroke-width="1.4" stroke-dasharray="6,4,2,4"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_bore + '" fill="var(--surface)" stroke="var(--border-strong)" stroke-width="2"/>' +
      holesSvg +
      // Leader 1 (Top-Right)
      '<circle cx="' + chosenHoleX + '" cy="' + chosenHoleY + '" r="3" fill="#2563eb"/>' +
      '<polyline points="' + chosenHoleX + ',' + chosenHoleY + ' ' + leader1XElbow + ',' + leader1Y + ' ' + leader1XEnd + ',' + leader1Y + '" fill="none" stroke="#2563eb" stroke-width="1.4"/>' +
      '<text x="' + leader1XEnd + '" y="' + (leader1Y - 7) + '" text-anchor="end" fill="var(--text)" font-size="' + FS_DIM + '" font-weight="700" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">' +
      esc(holeLabel) + '</text>' +
      '<text x="' + leader1XEnd + '" y="' + (leader1Y + 16) + '" text-anchor="end" fill="var(--text-3)" font-size="' + FS_LABEL + '" font-family="var(--font-fa)" direction="rtl" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">تعداد سوراخ × قطر پیچ</text>' +
      // Leader 2 (Top-Left)
      '<circle cx="' + pcdX1 + '" cy="' + pcdY1 + '" r="3" fill="var(--text-3)"/>' +
      '<polyline points="' + pcdX1 + ',' + pcdY1 + ' ' + leader2XElbow + ',' + leader2Y + ' ' + leader2XStart + ',' + leader2Y + '" fill="none" stroke="var(--text-3)" stroke-width="1.4"/>' +
      '<text x="' + leader2XStart + '" y="' + (leader2Y - 7) + '" text-anchor="start" fill="var(--text)" font-size="' + FS_DIM + '" font-weight="700" font-family="var(--font-fa)" direction="rtl" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">دایره گام پیچ (PCD)</text>' +
      '<text x="' + leader2XStart + '" y="' + (leader2Y + 16) + '" text-anchor="start" fill="var(--text-3)" font-size="' + FS_LABEL + '" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">Pitch Circle Diameter</text>' +
      '</svg>';

    // ----------------- 2. Section Assembly View (Part A) (viewBox: 0 0 1000 370) -----------------
    const isRtj = record.flange_face === 'RTJ';
    const gType = isRtj ? 'rtj' : ((ctx && ctx.gasketType) || settings.default_gasket_type || 'spiral_wound');
    const gThick = C.gasketThickness ? C.gasketThickness(settings, gType) : (isRtj ? 12.7 : 4.5);
    const gName = isRtj ? 'رینگ RTJ' : (gType === 'flat' ? 'گسکت تخت' : (gType === 'custom' ? 'گسکت دلخواه' : 'گسکت اسپیرال ووند'));
    const gasketLabel = gName + ' (' + gThick + ' mm)';

    const studLenMm = record.standard_stud_length_mm;
    const studLenIn = record.standard_stud_length_inch ? ' (' + record.standard_stud_length_inch + '")' : '';
    const studLenLabel = studLenMm != null ? ('طول Stud: ' + fmtMm(studLenMm) + ' mm' + studLenIn) : null;

    const projMm = settings.thread_projection_mm != null ? Number(settings.thread_projection_mm) : 6;
    const nutHMm = record.nut_height_mm;
    const flThickMm = record.flange_thickness_mm;
    const hasMissing = (flThickMm == null || nutHMm == null || studLenMm == null);

    const fx1 = 380, fx2 = 485, fx3 = 515, fx4 = 620;
    const gx1 = 485, gx2 = 515;
    const px1 = 220, px2 = 780;
    const nx1 = 305, nx2 = 380, nx3 = 620, nx4 = 695;
    const syTop = 115, syBot = 155;
    const nyTop = 105, nyBot = 165;
    const fyTop = 90, fyBot = 290;
    const gyTop = 90, gyBot = 290;

    let sectionDims = '';
    // Lane 1 (Top Lane): Stud Bolt Length
    if (studLenLabel) {
      sectionDims += '<line x1="' + px1 + '" y1="' + (syTop - 5) + '" x2="' + px1 + '" y2="65" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>' +
        '<line x1="' + px2 + '" y1="' + (syTop - 5) + '" x2="' + px2 + '" y2="65" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>' +
        svgDimH(px1, px2, 70, studLenLabel, null, 100, 900);
    }

    // Lane 2 (Mid-Left Side): Thread Projection Leader (Short & Clamped)
    const projX = clampGroupX(100, [projMm + ' mm', 'بیرون‌زدگی رزوه'], [FS_DIM, FS_LABEL], 'start', 100, 900);
    sectionDims += '<circle cx="220" cy="135" r="3" fill="#16a34a"/>' +
      '<polyline points="220,135 180,135 ' + projX + ',135" fill="none" stroke="#16a34a" stroke-width="1.3"/>' +
      '<text x="' + projX + '" y="128" text-anchor="start" fill="var(--text)" font-size="' + FS_DIM + '" font-weight="700" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">' +
      projMm + ' mm</text>' +
      '<text x="' + projX + '" y="148" text-anchor="start" fill="var(--text-3)" font-size="' + FS_LABEL + '" font-family="var(--font-fa)" direction="rtl" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">بیرون‌زدگی رزوه</text>';

    // Lane 3 (Bottom-Left Lane): Flange Thickness
    if (flThickMm != null) {
      sectionDims += '<line x1="' + fx1 + '" y1="' + (fyBot + 5) + '" x2="' + fx1 + '" y2="335" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>' +
        '<line x1="' + fx2 + '" y1="' + (fyBot + 5) + '" x2="' + fx2 + '" y2="335" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>' +
        svgDimH(fx1, fx2, 330, fmtMm(flThickMm) + ' mm', 'ضخامت فلنج', 100, 900);
    }
    // Lane 4 (Right Lane): Nut Height
    if (nutHMm != null) {
      sectionDims += '<line x1="' + nx3 + '" y1="' + (nyBot + 5) + '" x2="' + nx3 + '" y2="215" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>' +
        '<line x1="' + nx4 + '" y1="' + (nyBot + 5) + '" x2="' + nx4 + '" y2="215" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>' +
        svgDimH(nx3, nx4, 210, fmtMm(nutHMm) + ' mm', 'ارتفاع مهره', 100, 900);
    }
    // Lane 5 (Bottom-Right Side): Gasket Leader (Short & Clamped)
    const gTextX = clampGroupX(750, [gasketLabel, '(ضخامت آب‌بندی)'], [FS_DIM, FS_LABEL], 'end', 100, 900);
    sectionDims += '<circle cx="515" cy="275" r="3" fill="#ea580c"/>' +
      '<polyline points="515,275 600,325 ' + gTextX + ',325" fill="none" stroke="#ea580c" stroke-width="1.3"/>' +
      '<text x="' + gTextX + '" y="319" text-anchor="end" fill="var(--text)" font-size="' + FS_DIM + '" font-weight="700" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">' +
      esc(gasketLabel) + '</text>' +
      '<text x="' + gTextX + '" y="339" text-anchor="end" fill="var(--text-3)" font-size="' + FS_LABEL + '" font-family="var(--font-fa)" direction="rtl" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5" stroke-linejoin="round">(ضخامت آب‌بندی)</text>';

    // Component Legend HTML Row (Above SVG, No Overlap)
    const legendHtml = '<div class="diag-legend-bar" role="list" aria-label="راهنمای اجزای اتصال">' +
      '<div class="diag-legend-item" role="listitem"><span class="diag-legend-dot" style="background:#2563eb;"></span><span class="diag-legend-label">۱. فلنج (Flange)</span></div>' +
      '<div class="diag-legend-item" role="listitem"><span class="diag-legend-dot" style="background:#ea580c;"></span><span class="diag-legend-label">۲. گسکت (Gasket)</span></div>' +
      '<div class="diag-legend-item" role="listitem"><span class="diag-legend-dot" style="background:#16a34a;"></span><span class="diag-legend-label">۳. استادبول (Stud Bolt)</span></div>' +
      '<div class="diag-legend-item" role="listitem"><span class="diag-legend-dot" style="background:#7c3aed;"></span><span class="diag-legend-label">۴. مهره (Nut)</span></div>' +
      '</div>';

    const assemblySvg = '<svg class="diagram-svg" viewBox="0 0 1000 370" role="img" aria-label="دیاگرام ابعادی فلنج: مونتاژ اتصال و بولتینگ">' +
      '<title>مونتاژ اتصال و بولتینگ (Assembly View)</title>' +
      '<line x1="100" y1="190" x2="900" y2="190" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="10,6,3,6"/>' +
      '<line x1="500" y1="70" x2="500" y2="330" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="10,6,3,6"/>' +
      // Two Flange Plates
      '<rect x="' + fx1 + '" y="' + fyTop + '" width="' + (fx2 - fx1) + '" height="' + (fyBot - fyTop) + '" rx="3" fill="var(--surface-2)" stroke="#2563eb" stroke-width="2"/>' +
      '<rect x="' + fx3 + '" y="' + fyTop + '" width="' + (fx4 - fx3) + '" height="' + (fyBot - fyTop) + '" rx="3" fill="var(--surface-2)" stroke="#2563eb" stroke-width="2"/>' +
      // Center Bore Cutout
      '<rect x="' + (fx1 - 1) + '" y="170" width="' + (fx4 - fx1 + 2) + '" height="40" fill="var(--surface)" stroke="none"/>' +
      '<line x1="' + fx1 + '" y1="170" x2="' + fx4 + '" y2="170" stroke="#2563eb" stroke-width="1.8"/>' +
      '<line x1="' + fx1 + '" y1="210" x2="' + fx4 + '" y2="210" stroke="#2563eb" stroke-width="1.8"/>' +
      // Gasket Layer
      '<rect x="' + gx1 + '" y="' + gyTop + '" width="' + (gx2 - gx1) + '" height="' + (gyBot - gyTop) + '" fill="var(--surface-3)" stroke="#ea580c" stroke-width="2"/>' +
      // Stud Bolt Rod
      '<rect x="' + px1 + '" y="' + syTop + '" width="' + (px2 - px1) + '" height="' + (syBot - syTop) + '" rx="3" fill="var(--surface)" stroke="#16a34a" stroke-width="2"/>' +
      // Thread Hatching on Left
      '<g stroke="#16a34a" stroke-width="1" opacity="0.7">' +
      '<line x1="228" y1="' + syTop + '" x2="228" y2="' + syBot + '"/><line x1="240" y1="' + syTop + '" x2="240" y2="' + syBot + '"/>' +
      '<line x1="252" y1="' + syTop + '" x2="252" y2="' + syBot + '"/><line x1="264" y1="' + syTop + '" x2="264" y2="' + syBot + '"/>' +
      '<line x1="276" y1="' + syTop + '" x2="276" y2="' + syBot + '"/><line x1="288" y1="' + syTop + '" x2="288" y2="' + syBot + '"/>' +
      '<line x1="300" y1="' + syTop + '" x2="300" y2="' + syBot + '"/>' +
      // Thread Hatching on Right
      '<line x1="700" y1="' + syTop + '" x2="700" y2="' + syBot + '"/><line x1="712" y1="' + syTop + '" x2="712" y2="' + syBot + '"/>' +
      '<line x1="724" y1="' + syTop + '" x2="724" y2="' + syBot + '"/><line x1="736" y1="' + syTop + '" x2="736" y2="' + syBot + '"/>' +
      '<line x1="748" y1="' + syTop + '" x2="748" y2="' + syBot + '"/><line x1="760" y1="' + syTop + '" x2="760" y2="' + syBot + '"/>' +
      '<line x1="772" y1="' + syTop + '" x2="772" y2="' + syBot + '"/>' +
      '</g>' +
      // Left Nut
      '<rect x="' + nx1 + '" y="' + nyTop + '" width="' + (nx2 - nx1) + '" height="' + (nyBot - nyTop) + '" rx="4" fill="var(--surface-3)" stroke="#7c3aed" stroke-width="2"/>' +
      '<line x1="' + (nx1 + 22) + '" y1="' + nyTop + '" x2="' + (nx1 + 22) + '" y2="' + nyBot + '" stroke="#7c3aed" stroke-width="1" opacity="0.6"/>' +
      '<line x1="' + (nx2 - 22) + '" y1="' + nyTop + '" x2="' + (nx2 - 22) + '" y2="' + nyBot + '" stroke="#7c3aed" stroke-width="1" opacity="0.6"/>' +
      // Right Nut
      '<rect x="' + nx3 + '" y="' + nyTop + '" width="' + (nx4 - nx3) + '" height="' + (nyBot - nyTop) + '" rx="4" fill="var(--surface-3)" stroke="#7c3aed" stroke-width="2"/>' +
      '<line x1="' + (nx3 + 22) + '" y1="' + nyTop + '" x2="' + (nx3 + 22) + '" y2="' + nyBot + '" stroke="#7c3aed" stroke-width="1" opacity="0.6"/>' +
      '<line x1="' + (nx4 - 22) + '" y1="' + nyTop + '" x2="' + (nx4 - 22) + '" y2="' + nyBot + '" stroke="#7c3aed" stroke-width="1" opacity="0.6"/>' +
      sectionDims +
      '</svg>';

    // ----------------- 3. Exploded Components Row (Part B) (viewBox: 0 0 1000 250) -----------------
    const thread = record.thread || (record.bolt_diameter_inch ? record.bolt_diameter_inch + ' UNC' : 'UNC');
    const afLabel = record.nut_across_flats_mm != null ? fmtMm(record.nut_across_flats_mm, 2) + ' mm' : '—';
    const nhLabel = record.nut_height_mm != null ? fmtMm(record.nut_height_mm, 2) + ' mm' : '—';
    const wrenchLabel = record.wrench_size_mm != null ? record.wrench_size_mm + ' mm' : '—';

    // Box 1 (Stud Bolt): x=30 to 250 (w=220)
    const b1x = 30, b1w = 220, b1mid = 140;
    const b1Content = '<rect x="' + b1x + '" y="15" width="' + b1w + '" height="220" rx="8" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.2"/>' +
      '<text x="' + b1mid + '" y="38" text-anchor="middle" font-size="' + FS_LABEL + '" font-weight="700" fill="#16a34a" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">۱. استادبول (Stud Bolt)</text>' +
      '<text x="' + b1mid + '" y="66" text-anchor="middle" font-size="' + FS_DIM + '" font-weight="600" fill="var(--text)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">قطر: ' + esc(boltIn) + (boltMm ? ' (' + esc(boltMm) + ')' : '') + '</text>' +
      '<rect x="52" y="78" width="176" height="32" rx="3" fill="var(--surface)" stroke="#16a34a" stroke-width="1.8"/>' +
      '<g stroke="#16a34a" stroke-width="0.9" opacity="0.7">' +
      '<line x1="58" y1="78" x2="58" y2="110"/><line x1="68" y1="78" x2="68" y2="110"/><line x1="78" y1="78" x2="78" y2="110"/><line x1="88" y1="78" x2="88" y2="110"/>' +
      '<line x1="192" y1="78" x2="192" y2="110"/><line x1="202" y1="78" x2="202" y2="110"/><line x1="212" y1="78" x2="212" y2="110"/><line x1="222" y1="78" x2="222" y2="110"/>' +
      '</g>' +
      (studLenMm != null
        ? svgDimH(52, 228, 140, fmtMm(studLenMm) + ' mm', 'طول استاندارد', 40, 240)
        : '<text x="' + b1mid + '" y="145" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--warn)">در دیتاست نیست</text>') +
      '<text x="' + b1mid + '" y="200" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--text-3)" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">رزوه: ' + esc(thread) + '</text>';

    // Box 2 (Nut): x=270 to 490 (w=220)
    const b2x = 270, b2w = 220, b2mid = 380;
    const hPoints = '337,74 337,106 310,122 283,106 283,74 310,58';
    const b2Content = '<rect x="' + b2x + '" y="15" width="' + b2w + '" height="220" rx="8" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.2"/>' +
      '<text x="' + b2mid + '" y="38" text-anchor="middle" font-size="' + FS_LABEL + '" font-weight="700" fill="#7c3aed" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">۲. مهره سنگین (Nut)</text>' +
      // Nut Hex Front View
      '<polygon points="' + hPoints + '" fill="var(--surface)" stroke="#7c3aed" stroke-width="1.8"/>' +
      '<circle cx="310" cy="90" r="11" fill="none" stroke="var(--border-strong)" stroke-width="1.4"/>' +
      // Nut Side View
      '<rect x="390" y="62" width="56" height="56" rx="3" fill="var(--surface)" stroke="#7c3aed" stroke-width="1.8"/>' +
      '<line x1="408" y1="62" x2="408" y2="118" stroke="#7c3aed" stroke-width="0.9" opacity="0.6"/>' +
      '<line x1="428" y1="62" x2="428" y2="118" stroke="#7c3aed" stroke-width="0.9" opacity="0.6"/>' +
      (record.nut_across_flats_mm != null
        ? svgDimH(283, 337, 145, 'AF: ' + afLabel, 'آچار: ' + esc(wrenchLabel), 280, 480)
        : '<text x="310" y="145" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--warn)">در دیتاست نیست</text>') +
      (nutHMm != null
        ? svgDimH(390, 446, 145, 'H: ' + nhLabel, 'ارتفاع مهره', 280, 480)
        : '<text x="418" y="145" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--warn)">در دیتاست نیست</text>') +
      '<text x="' + b2mid + '" y="200" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--text-3)" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">استاندارد: ASME B18.2.2</text>';

    // Box 3 (Flange Piece): x=510 to 730 (w=220)
    const b3x = 510, b3w = 220, b3mid = 620;
    const b3Content = '<rect x="' + b3x + '" y="15" width="' + b3w + '" height="220" rx="8" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.2"/>' +
      '<text x="' + b3mid + '" y="38" text-anchor="middle" font-size="' + FS_LABEL + '" font-weight="700" fill="#2563eb" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">۳. فلنج (Flange)</text>' +
      (flThickMm != null
        ? '<rect x="575" y="65" width="90" height="58" rx="3" fill="var(--surface)" stroke="#2563eb" stroke-width="1.8"/>' +
        '<line x1="620" y1="65" x2="620" y2="123" stroke="var(--border-strong)" stroke-width="1.2" stroke-dasharray="4,2"/>' +
        svgDimH(575, 665, 150, fmtMm(flThickMm) + ' mm', 'ضخامت فلنج (C)', 520, 720)
        : '<rect x="560" y="65" width="120" height="58" rx="4" fill="none" stroke="var(--border)" stroke-dasharray="4,4"/>' +
        '<text x="' + b3mid + '" y="98" text-anchor="middle" font-size="' + FS_LABEL + '" font-weight="600" fill="var(--warn)">در دیتاست نیست</text>' +
        '<text x="' + b3mid + '" y="150" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--text-3)">بدون داده ضخامت</text>') +
      '<text x="' + b3mid + '" y="200" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--text-3)" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">' + esc(record.standard) + '</text>';

    // Box 4 (Gasket): x=750 to 970 (w=220)
    const b4x = 750, b4w = 220, b4mid = 860;
    const b4Content = '<rect x="' + b4x + '" y="15" width="' + b4w + '" height="220" rx="8" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.2"/>' +
      '<text x="' + b4mid + '" y="38" text-anchor="middle" font-size="' + FS_LABEL + '" font-weight="700" fill="#ea580c" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">۴. گسکت (Gasket)</text>' +
      '<rect x="805" y="70" width="110" height="48" rx="3" fill="var(--surface)" stroke="#ea580c" stroke-width="1.8"/>' +
      '<line x1="860" y1="70" x2="860" y2="118" stroke="#ea580c" stroke-width="1" stroke-dasharray="3,3"/>' +
      svgDimH(805, 915, 150, gThick + ' mm', esc(gName), 760, 960) +
      '<text x="' + b4mid + '" y="200" text-anchor="middle" font-size="' + FS_LABEL + '" fill="var(--text-3)" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">ضخامت آب‌بندی موثر</text>';

    const explodedSvg = '<svg class="diagram-svg" viewBox="0 0 1000 250" role="img" aria-label="دیاگرام تفکیک اجزای اتصال: استادبول، مهره سنگین، فلنج و گسکت">' +
      '<title>تفکیک اجزا و ابعاد قطعات (Exploded Components)</title>' +
      b1Content + b2Content + b3Content + b4Content +
      '</svg>';

    return '<section class="diagram-section" aria-label="دیاگرام ابعادی فلنج">' +
      '<div class="diagram-header">' +
      '<h4 class="diagram-title">دیاگرام ابعادی (شماتیک — غیرمقیاس)</h4>' +
      '<span class="diagram-badge">شماتیک — غیرمقیاس</span>' +
      '</div>' +
      '<div class="diagram-stack">' +
      '<div class="diagram-pane">' + frontSvg + '<div class="diagram-caption">نمای روبه‌روی فلنج (Front View) — چیدمان سوراخ‌ها و دایره گام پیچ (PCD)</div></div>' +
      '<div class="diagram-pane">' + legendHtml + assemblySvg + '<div class="diagram-caption">الف) مونتاژ اتصال و بولتینگ (Assembly View)</div></div>' +
      '<div class="diagram-pane">' + explodedSvg + '<div class="diagram-caption">ب) تفکیک اجزا و ابعاد قطعات (Exploded Components)</div></div>' +
      '</div>' +
      (hasMissing ? '<p class="diagram-missing-note">⚠️ برخی ابعاد در دیتاست نیست؛ خطوط اندازه مربوطه نمایش داده نشدند.</p>' : '') +
      '</section>';
  }

  function studDiagramSvg(res, unit, settings) {
    if (!res) { return ''; }
    const rec = res.record;
    const diaIn = res.inch != null ? res.inch : (rec ? rec.bolt_diameter_decimal_inch : null);
    const diaMm = res.mm != null ? res.mm : (rec ? rec.bolt_diameter_mm : null);
    const diaLabel = (rec && rec.bolt_diameter_inch ? rec.bolt_diameter_inch + '"' : (diaIn != null ? diaIn + '"' : '')) +
      (diaMm != null ? ' (' + fmtMm(diaMm, 2) + ' mm)' : '');
    const thread = rec && rec.thread ? rec.thread : (diaIn != null ? diaIn + ' UNC' : 'UNC');
    const afLabel = rec && rec.nut_across_flats_mm != null
      ? fmtMm(rec.nut_across_flats_mm, 2) + ' mm' + (rec.nut_across_flats_inch ? ' (' + rec.nut_across_flats_inch + '")' : '')
      : '—';
    const nhLabel = rec && rec.nut_height_mm != null
      ? fmtMm(rec.nut_height_mm, 2) + ' mm' + (rec.nut_height_inch ? ' (' + rec.nut_height_inch + '")' : '')
      : '—';
    const wrenchLabel = rec && rec.wrench_size_mm != null
      ? rec.wrench_size_mm + ' mm' + (rec.wrench_size_inch ? ' (' + rec.wrench_size_inch + '")' : '')
      : '—';

    const hPoints = '845,130 845,210 775,250 705,210 705,130 775,90';

    const svg = '<svg class="diagram-svg" viewBox="0 0 1000 360" role="img" aria-label="دیاگرام ابعادی Stud Bolt و مهره شش‌ضلعی شامل نمای جانبی میلگرد و نمای روبه‌روی شش‌ضلعی مهره">' +
      '<title>دیاگرام ابعادی Stud Bolt و مهره شش‌ضلعی</title>' +
      '<line x1="100" y1="170" x2="550" y2="170" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="10,6,3,6"/>' +
      '<line x1="620" y1="170" x2="900" y2="170" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="10,6,3,6"/>' +
      '<line x1="775" y1="50" x2="775" y2="310" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="10,6,3,6"/>' +
      '<line x1="580" y1="50" x2="580" y2="310" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>' +

      // Left view: Stud shank + side nut
      '<rect x="120" y="145" width="420" height="50" rx="4" fill="var(--surface-2)" stroke="#16a34a" stroke-width="2"/>' +
      '<g stroke="#16a34a" stroke-width="1" opacity="0.7">' +
      '<line x1="135" y1="145" x2="135" y2="195"/><line x1="150" y1="145" x2="150" y2="195"/><line x1="165" y1="145" x2="165" y2="195"/>' +
      '<line x1="180" y1="145" x2="180" y2="195"/><line x1="195" y1="145" x2="195" y2="195"/><line x1="210" y1="145" x2="210" y2="195"/>' +
      '<line x1="450" y1="145" x2="450" y2="195"/><line x1="465" y1="145" x2="465" y2="195"/><line x1="480" y1="145" x2="480" y2="195"/>' +
      '<line x1="495" y1="145" x2="495" y2="195"/><line x1="510" y1="145" x2="510" y2="195"/><line x1="525" y1="145" x2="525" y2="195"/>' +
      '</g>' +
      '<rect x="310" y="120" width="110" height="100" rx="5" fill="var(--surface-3)" stroke="#7c3aed" stroke-width="2"/>' +
      '<line x1="346" y1="120" x2="346" y2="220" stroke="#7c3aed" stroke-width="1" opacity="0.6"/>' +
      '<line x1="384" y1="120" x2="384" y2="220" stroke="#7c3aed" stroke-width="1" opacity="0.6"/>' +

      svgDimV(115, 145, 195, 'قطر: ' + diaLabel, 'left', null, 80, 300) +
      '<polyline points="200,145 200,85 105,85" fill="none" stroke="#16a34a" stroke-width="1.3"/>' +
      '<circle cx="200" cy="145" r="3" fill="#16a34a"/>' +
      '<text x="' + clampX(105, 'رزوه: ' + thread, FS_LABEL, 'start', 100, 900) + '" y="77" text-anchor="start" fill="var(--text)" font-size="' + FS_LABEL + '" font-weight="700" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">رزوه: ' + esc(thread) + '</text>' +
      svgDimH(310, 420, 95, 'ارتفاع مهره: ' + nhLabel, 'ASME B18.2.2', 100, 900) +

      // Right view: Hexagon nut front view
      '<polygon points="' + hPoints + '" fill="var(--surface-2)" stroke="#7c3aed" stroke-width="2.2"/>' +
      '<circle cx="775" cy="170" r="28" fill="var(--surface)" stroke="var(--border-strong)" stroke-width="2"/>' +
      '<circle cx="775" cy="170" r="34" fill="none" stroke="var(--text-3)" stroke-width="1.3" stroke-dasharray="6,3"/>' +

      '<line x1="775" y1="90" x2="895" y2="90" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>' +
      '<line x1="775" y1="250" x2="895" y2="250" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>' +
      svgDimV(890, 90, 250, 'آچارخور (AF): ' + afLabel, 'right', null, 80, 300) +
      '<text x="' + clampX(775, 'سایز آچار: ' + wrenchLabel, FS_DIM, 'middle', 100, 900) + '" y="295" text-anchor="middle" fill="#7c3aed" font-size="' + FS_DIM + '" font-weight="700" font-family="var(--font-fa)" direction="ltr" paint-order="stroke fill" stroke="var(--surface)" stroke-width="3.5">سایز آچار: ' + esc(wrenchLabel) + '</text>' +
      '</svg>';

    return '<section class="diagram-section" aria-label="دیاگرام ابعادی Stud و مهره">' +
      '<div class="diagram-header">' +
      '<h4 class="diagram-title">دیاگرام ابعادی (شماتیک — غیرمقیاس)</h4>' +
      '<span class="diagram-badge">شماتیک — غیرمقیاس</span>' +
      '</div>' +
      '<div class="diagram-pane diagram-pane-full">' + svg + '<div class="diagram-caption">نمای جانبی Stud Bolt و روبه‌روی مهره شش‌ضلعی (Hexagon)</div></div>' +
      '</section>';
  }

  /* ---------------------- flange result rendering ------------------------- */
  function flangeCardHtml(record, ctx) {
    ctx = ctx || {};
    const settings = FSF.Store.loadSettings();
    const bd = C.studLengthBreakdown(record, settings, ctx.gasketType);
    const nutRec = C.findWrenchInch(record.bolt_diameter_decimal_inch);
    const wrenchMm = nutRec ? nutRec.wrench_size_mm : record.wrench_size_mm;
    const wrenchIn = nutRec ? nutRec.wrench_size_inch : record.wrench_size_inch;

    const title = '<span class="nps">' + esc(record.nps_inch) + '" / DN' + esc(record.dn) +
      '</span> — Class ' + esc(record.pressure_class);
    const badges = badge(record.standard, 'badge-std') +
      (record.series && record.series !== 'B16.5' ? badge(record.series, 'badge-std') : '') +
      badge(record.flange_face + (record.flange_face === 'RF' ? ' - Raised Face' :
        record.flange_face === 'RTJ' ? ' - Ring Type Joint' : ' - Flat Face'), 'badge-face') +
      confidenceBadge(record);

    let html = '<article class="result-card" data-record-id="' + esc(record.id) + '">' +
      '<div class="result-head"><h3 class="result-title">' + title + '</h3>' +
      '<div class="badge-group">' + badges + '</div></div>';

    let ringKv = '';
    if (record.flange_face === 'RTJ') {
      const ring = C.rtjRingInfo ? C.rtjRingInfo(record.nps_inch, record.pressure_class, record.standard) : null;
      const ringText = ring
        ? (esc(ring.ring_number) + ' — Style R — هشت‌ضلعی (Octagonal)')
        : '— (با آخرین ویرایش استاندارد کنترل شود)';
      ringKv = kv('رینگ RTJ (شماره / نوع)', ringText, { ltr: true });
    }

    html += '<div class="kv-grid">' +
      kv('تعداد Stud Bolt', esc(record.number_of_bolts) + ' عدد') +
      kv('قطر Stud / Bolt', esc(record.bolt_diameter_inch) + '"', { ltr: true }) +
      kv('قطر Stud معادل', fmtMm(record.bolt_diameter_mm, 2) + ' mm', { ltr: true }) +
      kv('طول Stud (جدول استاندارد)', fmtMm(record.standard_stud_length_mm) + ' mm' +
        (record.standard_stud_length_inch ? ' <small>(' + esc(record.standard_stud_length_inch) + '")</small>' : ''),
        { ltr: true }) +
      kv('آچارخور مهره (mm)', wrenchMm != null ? wrenchMm + ' mm' : '—', { hero: true, ltr: true }) +
      kv('آچارخور مهره (اینچ)', wrenchIn ? esc(wrenchIn) + '"' : '—', { ltr: true }) +
      ringKv +
      kv('ضخامت فلنج', record.flange_thickness_mm != null ? fmtMm(record.flange_thickness_mm) + ' mm' : 'در دیتاست نیست', { ltr: true }) +
      kv('رزوه / Thread', record.thread ? esc(record.thread) : '—', { ltr: true }) +
      kv('مهره', record.nut_standard ? esc(record.nut_standard) + ' — AF ' + fmtMm(record.nut_across_flats_mm, 1) +
        ' mm / H ' + fmtMm(record.nut_height_mm, 1) + ' mm' : '—', { ltr: true }) +
      '</div>';

    if (settings.show_calc !== false) {
      if (bd.rows.length) {
        html += '<div class="breakdown"><h4>جزئیات محاسبه طول Stud (تخمینی)</h4>';
        bd.rows.forEach(function (r) {
          html += '<div class="breakdown-row"><span>' + esc(r.label) +
            ' <small style="color:var(--text-3)">(' + ltr(r.detail) + ')</small></span><span>' + ltr(r.value + ' mm') + '</span></div>';
        });
        html += '<div class="breakdown-row total"><span>طول محاسبه‌شده (گِردشده)</span><span>' +
          ltr(bd.rounded + ' mm') + '</span></div>';
        html += '<div class="formula-line">' + esc(bd.formula) + '</div>';
        if (bd.standard != null && bd.delta != null) {
          const limit = settings.stud_length_warn_delta_mm != null ? settings.stud_length_warn_delta_mm : 6;
          html += notice('اختلاف طول محاسبه‌شده با جدول استاندارد: ' + ltr(bd.delta + ' mm') +
            (Math.abs(bd.delta) > limit ? ' — مقدار جدول استاندارد مبنا است.' : ''), Math.abs(bd.delta) > limit ? 'warn' : 'ok');
        }
        html += '</div>';
      } else {
        html += notice('برای محاسبه تفصیلی، ضخامت فلنج یا ارتفاع مهره در دیتاست نیست؛ طول جدول استاندارد نمایش داده شد.', 'warn');
      }
    }

    if (settings.show_diagram !== false) {
      html += flangeDiagramSvg(record, ctx, settings);
    }

    const notes = [];
    const fit = modelFitNote(record);
    if (fit) { notes.push(esc(fit)); }
    if (record.notes) { notes.push(esc(record.notes)); }
    if (record.flange_face === 'RTJ') {
      notes.push('شماره رینگ نمایش‌داده‌شده از سبک R بر اساس ASME B16.20 است (مقطع هشت‌ضلعی Octagonal برای کارهای جدید، بیضوی Oval برای کارهای قدیمی). سبک RX نوع فشارتقویت‌شده (Pressure-Energized) است و می‌تواند در همان شیار سبک R هم‌اندازه بنشیند (تعویض‌پذیر طبق جدول تطبیق B16.20) و برای سرویس‌های فشار بالاتر استفاده می‌شود. سبک BX فقط مخصوص فلنج‌های سرچاهی API 6A / 6BX است و با شیارهای R و RX تعویض‌پذیر نیست.');
      notes.push('سختی رینگ باید کمتر از سختی فلنج باشد و رینگ RTJ پس از هر بازکردن اتصال تعویض می‌شود.');
    }
    if (record.stud_length_basis) { notes.push('مبنای طول جدول: ' + esc(record.stud_length_basis)); }
    notes.push('منبع رکورد: ' + esc(record.source || '—'));
    html += '<div class="result-notes"><strong>توضیحات:</strong><ul>' +
      notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') +
      '<li>' + esc(DISCLAIMER) + '</li></ul></div>';
    html += '</article>';
    return html;
  }

  /* ----------------------- stud / wrench rendering ------------------------ */
  function studCardHtml(res, unit) {
    const rec = res.record;
    const settings = FSF.Store.loadSettings();
    const diaIn = res.inch != null ? res.inch : (rec ? rec.bolt_diameter_decimal_inch : null);
    const diaMm = res.mm != null ? res.mm : (rec ? rec.bolt_diameter_mm : null);
    const title = rec ? esc(rec.thread || rec.bolt_diameter_inch || rec.bolt_diameter_mm) :
      esc(unit === 'mm' ? diaMm + ' mm' : diaIn + '"');

    let html = '<article class="result-card" data-stud="1">' +
      '<div class="result-head"><h3 class="result-title">Stud <span class="nps">' + title +
      '</span></h3><div class="badge-group">' +
      (rec ? badge(rec.nut_standard || '—', 'badge-std') : badge('خارج از جدول محلی', 'badge-warn')) +
      '</div></div>';

    if (!rec) {
      html += notice('این قطر در جدول محلی آچار موجود نیست. لطفاً دیتابیس stud-wrench-map.json را ویرایش یا تکمیل کنید.', 'warn');
      html += '<div class="kv-grid">' +
        kv('قطر Stud (اینچ)', diaIn != null ? U.round(diaIn, 3) + '"' : '—', { ltr: true }) +
        kv('قطر Stud (mm)', diaMm != null ? U.round(diaMm, 2) + ' mm' : '—', { ltr: true }) + '</div>';
      if (settings.show_diagram !== false && (diaIn != null || diaMm != null)) {
        html += studDiagramSvg(res, unit, settings);
      }
    } else {
      const showBoth = settings.nut_height_method !== 'regular_hex_table' && rec.alt_nut_type;
      html += '<div class="kv-grid">' +
        kv('قطر Stud', esc(rec.bolt_diameter_inch || '—') + '"', { ltr: true }) +
        kv('قطر Stud معادل', fmtMm(rec.bolt_diameter_mm, 2) + ' mm', { ltr: true }) +
        kv('آچارخور مهره (mm)', (rec.wrench_size_mm != null ? rec.wrench_size_mm + ' mm' : '—'), { hero: true, ltr: true }) +
        kv('آچارخور مهره (اینچ)', rec.wrench_size_inch ? esc(rec.wrench_size_inch) + '"' : '—', { ltr: true }) +
        kv('اندازه مهره (Across Flats)', fmtMm(rec.nut_across_flats_mm, 2) + ' mm / ' +
          esc(rec.nut_across_flats_inch || '—') + '"', { ltr: true }) +
        kv('ارتفاع مهره', fmtMm(rec.nut_height_mm, 2) + ' mm / ' + esc(rec.nut_height_inch || '—') + '"', { ltr: true }) +
        kv('نوع مهره', esc(rec.nut_type || '—')) +
        kv('رزوه / Thread', rec.thread ? esc(rec.thread) : '—', { ltr: true }) +
        '</div>';
      if (settings.show_diagram !== false) {
        html += studDiagramSvg(res, unit, settings);
      }
      if (showBoth && rec.alt_nut_across_flats_mm != null) {
        html += '<div class="breakdown"><h4>مهره جایگزین: ' + esc(rec.alt_nut_type) + '</h4>' +
          '<div class="breakdown-row"><span>آچارخور</span><span>' +
          ltr(rec.alt_wrench_size_mm + ' mm / ' + rec.alt_wrench_size_inch + '"') + '</span></div>' +
          '<div class="breakdown-row"><span>اندازه مهره (AF)</span><span>' +
          ltr(fmtMm(rec.alt_nut_across_flats_mm, 2) + ' mm') + '</span></div>' +
          '<div class="breakdown-row"><span>ارتفاع مهره</span><span>' +
          ltr(fmtMm(rec.alt_nut_height_mm, 2) + ' mm') + '</span></div></div>';
      }
      html += '<div class="result-notes"><strong>توضیحات:</strong><ul>' +
        (rec.notes ? '<li>' + esc(rec.notes) + '</li>' : '') +
        '<li>' + esc('اندازه آچار = فاصله بین دو وجه مهره (Width Across Flats) بر اساس ASME B18.2.2؛ برای اتصالات فلنجی مهره سنگین مرسوم است.') + '</li>' +
        '<li>' + esc(DISCLAIMER) + '</li></ul></div>';
    }
    html += '</article>';
    return html;
  }

  /* --------------------- container-level rendering ------------------------ */
  function renderInto(containerId, html) {
    const box = document.getElementById(containerId);
    if (box) { box.innerHTML = html; }
  }
  function emptyStateHtml(message, icon) {
    return '<div class="empty-state"><span class="big">' + (icon || '🔎') + '</span>' + esc(message) + '</div>';
  }
  function renderFlangeResults(records, ctx) {
    const parts = [];
    if (ctx && ctx.noticeHtml) { parts.push(ctx.noticeHtml); }
    if (!records || !records.length) {
      parts.push(notice(esc(NO_DATA_MSG), 'warn'));
      parts.push(emptyStateHtml('ترکیب انتخابی در دیتاست محلی یافت نشد. می‌توانید داده را در تب تنظیمات تکمیل کنید.', '📭'));
    } else {
      records.forEach(function (r) { parts.push(flangeCardHtml(r, ctx)); });
      parts.push('<div class="row-actions no-print">' +
        '<button type="button" class="btn btn-ghost" data-act="copy-flange">📋 کپی نتیجه</button>' +
        '<button type="button" class="btn btn-ghost" data-act="csv-flange">⬇️ خروجی CSV</button>' +
        '<button type="button" class="btn btn-ghost" data-act="print">🖨️ چاپ نتیجه</button></div>');
    }
    renderInto('flangeResult', parts.join(''));
  }
  function renderStudResults(res, unit) {
    const parts = [];
    if (!res) {
      parts.push(emptyStateHtml('قطر استادبول را انتخاب یا وارد کنید.', '🔧'));
    } else {
      parts.push(studCardHtml(res, unit));
      parts.push('<div class="row-actions no-print">' +
        '<button type="button" class="btn btn-ghost" data-act="copy-stud">📋 کپی نتیجه</button>' +
        '<button type="button" class="btn btn-ghost" data-act="csv-stud">⬇️ خروجی CSV</button>' +
        '<button type="button" class="btn btn-ghost" data-act="print">🖨️ چاپ نتیجه</button></div>');
    }
    renderInto('studResult', parts.join(''));
  }

  /* --------------------------- copy / export ------------------------------ */
  function flangeRows(records, ctx) {
    const rows = [['سایز فلنج (NPS)', 'DN', 'کلاس', 'استاندارد', 'سری/نوع', 'فیس', 'رینگ RTJ',
      'تعداد Stud', 'قطر Stud (اینچ)', 'قطر Stud (mm)', 'طول Stud جدول (mm)', 'طول Stud جدول (اینچ)',
      'آچارخور (mm)', 'آچارخور (اینچ)', 'ضخامت فلنج (mm)', 'رزوه', 'نکات']];
    (records || []).forEach(function (r) {
      let ringStr = '';
      if (r.flange_face === 'RTJ') {
        const ring = C.rtjRingInfo ? C.rtjRingInfo(r.nps_inch, r.pressure_class, r.standard) : null;
        ringStr = ring ? ring.ring_number : '—';
      }
      rows.push([r.nps_inch, r.dn, r.pressure_class, r.standard, r.series, r.flange_face, ringStr,
        r.number_of_bolts, r.bolt_diameter_inch, r.bolt_diameter_mm, r.standard_stud_length_mm,
        r.standard_stud_length_inch || '', r.wrench_size_mm != null ? r.wrench_size_mm : '',
        r.wrench_size_inch || '', r.flange_thickness_mm != null ? r.flange_thickness_mm : '',
        r.thread || '', (r.notes || '') + ' | ' + DISCLAIMER]);
    });
    return rows;
  }
  function flangeText(records) {
    const lines = [];
    (records || []).forEach(function (r) {
      lines.push('— فلنج ' + r.nps_inch + '" / DN' + r.dn + ' | Class ' + r.pressure_class +
        ' | ' + r.standard + (r.series && r.series !== 'B16.5' ? ' (' + r.series + ')' : '') +
        ' | فیس ' + r.flange_face);
      lines.push('  تعداد Stud Bolt: ' + r.number_of_bolts);
      lines.push('  قطر Stud: ' + r.bolt_diameter_inch + '" (' + r.bolt_diameter_mm + ' mm)');
      if (r.flange_face === 'RTJ') {
        lines.push('  سبک رینگ: R (هشت‌ضلعی) بر اساس ASME B16.20 — سبک RX تعویض‌پذیر با شیار R؛ سبک BX فقط برای API 6BX.');
      }
      lines.push('  طول Stud (جدول): ' + r.standard_stud_length_mm + ' mm' +
        (r.standard_stud_length_inch ? ' (' + r.standard_stud_length_inch + '")' : ''));
      lines.push('  آچارخور مهره: ' + (r.wrench_size_mm != null ? r.wrench_size_mm + ' mm' : '—') +
        (r.wrench_size_inch ? ' (' + r.wrench_size_inch + '")' : ''));
      if (r.flange_face === 'RTJ') {
        const ring = C.rtjRingInfo ? C.rtjRingInfo(r.nps_inch, r.pressure_class, r.standard) : null;
        lines.push('  رینگ RTJ: ' + (ring ? (ring.ring_number + ' (Style R — هشت‌ضلعی)') : '— (با آخرین ویرایش استاندارد کنترل شود)'));
      }
      if (r.flange_thickness_mm != null) {
        lines.push('  ضخامت فلنج: ' + r.flange_thickness_mm + ' mm');
      }
      if (r.notes) { lines.push('  نکته: ' + r.notes); }
    });
    lines.push(DISCLAIMER);
    return lines.join('\n');
  }
  function studText(res) {
    const r = res.record;
    const lines = ['— Stud ' + (r ? (r.thread || r.bolt_diameter_inch) : res.inch)];
    if (r) {
      lines.push('  قطر Stud: ' + r.bolt_diameter_inch + '" (' + r.bolt_diameter_mm + ' mm)');
      lines.push('  آچارخور مهره: ' + r.wrench_size_mm + ' mm (' + r.wrench_size_inch + '")');
      lines.push('  مهره: ' + r.nut_standard + ' | AF ' + r.nut_across_flats_mm + ' mm | ارتفاع ' + r.nut_height_mm + ' mm');
      if (r.notes) { lines.push('  نکته: ' + r.notes); }
    } else {
      lines.push('  قطر Stud: ' + res.inch + '" / ' + res.mm + ' mm (خارج از جدول محلی)');
    }
    lines.push(DISCLAIMER);
    return lines.join('\n');
  }
  function studRows(res) {
    const r = res.record;
    return [['قطر Stud (اینچ)', 'قطر Stud (mm)', 'رزوه', 'آچارخور (mm)', 'آچارخور (اینچ)',
      'مهره AF (mm)', 'ارتفاع مهره (mm)', 'استاندارد', 'نکات'],
      r ? [r.bolt_diameter_inch, r.bolt_diameter_mm, r.thread || '', r.wrench_size_mm,
        r.wrench_size_inch, r.nut_across_flats_mm, r.nut_height_mm, r.nut_standard, r.notes || '']
        : [res.inch, res.mm, '', '', '', '', '', '', 'خارج از جدول محلی']];
  }

  /* ------------------------ hole count rendering -------------------------- */
  function holeGroupCardHtml(g, holeCount) {
    let html = '<article class="result-card">';
    html += '<div class="result-head">';
    html += '<div class="result-title">گروه قطر استادبول: <span class="nps">' + esc(g.bolt_diameter_inch) + '"</span> (' + g.bolt_diameter_mm + ' mm)</div>';
    html += '<div class="badge-group">';
    html += badge(holeCount + ' سوراخ', 'face');
    if (g.wrench_size_mm != null) { html += badge('آچار ' + g.wrench_size_mm + ' mm', 'std'); }
    html += badge(g.total_combinations + ' ترکیب فلنج', 'ok');
    html += '</div></div>';

    html += '<div class="kv-grid">';
    html += kv('تعداد سوراخ فلنج', holeCount + ' عدد');
    html += kv('قطر استادبول (اینچ)', g.bolt_diameter_inch ? g.bolt_diameter_inch + '"' : '—', { ltr: true });
    html += kv('قطر استادبول (mm)', g.bolt_diameter_mm != null ? g.bolt_diameter_mm + ' mm' : '—', { ltr: true });
    html += kv('رزوه / Thread', g.thread || '—', { ltr: true });
    html += kv('آچارخور مهره (mm)', g.wrench_size_mm != null ? g.wrench_size_mm + ' mm' : '—', { hero: true, ltr: true });
    html += kv('آچارخور مهره (اینچ)', g.wrench_size_inch ? g.wrench_size_inch + '"' : '—', { ltr: true });
    html += kv('فاصله دو وجه مهره (AF)', (g.nut_across_flats_mm != null ? g.nut_across_flats_mm + ' mm' : '—') + (g.nut_across_flats_inch ? ' <small>(' + esc(g.nut_across_flats_inch) + '")</small>' : ''), { ltr: true });
    html += kv('ارتفاع مهره', (g.nut_height_mm != null ? g.nut_height_mm + ' mm' : '—') + (g.nut_height_inch ? ' <small>(' + esc(g.nut_height_inch) + '")</small>' : ''), { ltr: true });
    const lengthSpan = g.min_stud_length_mm != null
      ? (g.min_stud_length_mm === g.max_stud_length_mm ? g.min_stud_length_mm + ' mm' : g.min_stud_length_mm + ' تا ' + g.max_stud_length_mm + ' mm')
      : '—';
    html += kv('بازه طول Stud جدول', lengthSpan, { dir: 'ltr' });
    html += '</div>';

    html += '<div style="margin-top:14px;"><h4 style="font-size:0.92rem;margin-bottom:6px;font-weight:600;">ترکیب‌های فلنج دارای این مشخصات (' + g.items.length + ' مورد):</h4>';
    html += '<div class="table-wrap" style="max-height: 280px; overflow-y: auto;">';
    html += '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>سایز (NPS)</th>' +
      '<th>معادل DN</th>' +
      '<th>کلاس فشاری</th>' +
      '<th>استاندارد</th>' +
      '<th>سری</th>' +
      '<th>نوع فیس</th>' +
      '<th>طول Stud جدول (mm)</th>' +
      '<th>طول اینچ</th>' +
      '</tr></thead><tbody>';

    g.items.forEach(function (it) {
      html += '<tr>' +
        '<td class="cell-num">' + esc(it.nps_inch) + '"</td>' +
        '<td class="cell-num">DN ' + esc(String(it.dn)) + '</td>' +
        '<td class="cell-num">Class ' + esc(String(it.pressure_class)) + '</td>' +
        '<td>' + esc(it.standard) + '</td>' +
        '<td>' + esc(it.series || '—') + '</td>' +
        '<td>' + esc(it.flange_face) + '</td>' +
        '<td class="cell-num">' + esc(String(it.standard_stud_length_mm != null ? it.standard_stud_length_mm : '—')) + '</td>' +
        '<td class="cell-num">' + esc(it.standard_stud_length_inch ? it.standard_stud_length_inch + '"' : '—') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';

    html += '<div class="result-notes">' +
      '<strong>ملاحظات فنی:</strong>' +
      '<ul>' +
      '<li>سایز آچار مهره بر مبنای مهره شش‌گوش سنگین (Heavy Hex - ASME B18.2.2) استاندارد خطوط لوله است.</li>' +
      '<li>' + esc(DISCLAIMER) + '</li>' +
      '</ul></div>';

    html += '</article>';
    return html;
  }

  function renderHoleResults(res, holeCount, nearestCounts) {
    const parts = [];
    if (!holeCount && (!res || !res.groups || !res.groups.length)) {
      parts.push(emptyStateHtml('تعداد سوراخ‌های فلنج را وارد کنید — نتایج شامل سایز، کلاس، قطر استود، طول و آچارخور نمایش داده می‌شود.', '⭕'));
    } else if (holeCount && (!res || !res.groups || !res.groups.length)) {
      parts.push(notice('تعداد سوراخ «' + esc(String(holeCount)) + '» در جدول محلی یافت نشد.', 'warn'));
      if (nearestCounts && nearestCounts.length) {
        let chipHtml = '<div style="margin: 10px 0; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
          '<span style="font-size:0.88rem; font-weight:500;">نزدیک‌ترین تعداد سوراخ‌های موجود در استاندارد:</span>';
        nearestCounts.forEach(function (n) {
          chipHtml += '<button type="button" class="btn btn-ghost btn-sm quick-hole-btn" data-hole="' + n + '">' + n + ' سوراخ</button>';
        });
        chipHtml += '</div>';
        parts.push(chipHtml);
      }
      parts.push(emptyStateHtml('هیچ فلنجی با این تعداد سوراخ در دیتابیس محلی ثبت نشده است. لطفاً تعداد سوراخ دیگری را انتخاب یا امتحان نمایید.', '📭'));
    } else {
      const totalCombos = res.groups.reduce(function (sum, g) { return sum + g.total_combinations; }, 0);
      parts.push('<div class="notice notice-ok">تعداد ' + res.groups.length + ' گروه قطر استادبول و ' + totalCombos + ' ترکیب فلنج با ' + esc(String(holeCount)) + ' سوراخ یافت شد.</div>');
      res.groups.forEach(function (g) {
        parts.push(holeGroupCardHtml(g, holeCount));
      });
      parts.push('<div class="row-actions no-print">' +
        '<button type="button" class="btn btn-ghost" data-act="copy-hole">📋 کپی نتیجه</button>' +
        '<button type="button" class="btn btn-ghost" data-act="csv-hole">⬇️ خروجی CSV</button>' +
        '<button type="button" class="btn btn-ghost" data-act="print">🖨️ چاپ نتیجه</button></div>');
    }
    renderInto('holeResult', parts.join(''));
  }

  function holeText(res) {
    if (!res || !res.groups || !res.groups.length) { return ''; }
    const totalCombos = res.groups.reduce(function (sum, g) { return sum + g.total_combinations; }, 0);
    const lines = [
      '— فلنج‌های دارای ' + res.holeCount + ' سوراخ (مجموعاً ' + totalCombos + ' ترکیب در ' + res.groups.length + ' گروه قطر Stud)',
      ''
    ];
    res.groups.forEach(function (g, idx) {
      lines.push('گروه ' + (idx + 1) + ': Stud ' + g.bolt_diameter_inch + '" (' + g.bolt_diameter_mm + ' mm) | رزوه: ' + (g.thread || '—') +
        ' | آچارخور: ' + (g.wrench_size_mm != null ? g.wrench_size_mm + ' mm' : '—') +
        (g.wrench_size_inch ? ' (' + g.wrench_size_inch + '")' : '') +
        ' | AF مهره: ' + (g.nut_across_flats_mm != null ? g.nut_across_flats_mm + ' mm' : '—') +
        ' | بازه طول Stud: ' + (g.min_stud_length_mm === g.max_stud_length_mm ? g.min_stud_length_mm + ' mm' : (g.min_stud_length_mm + ' تا ' + g.max_stud_length_mm + ' mm')));
      g.items.forEach(function (it) {
        lines.push('   • ' + it.nps_inch + '" (DN' + it.dn + ') | Class ' + it.pressure_class +
          ' | ' + it.standard + (it.series && it.series !== 'B16.5' ? ' (' + it.series + ')' : '') +
          ' | فیس ' + it.flange_face + ' | طول Stud: ' + it.standard_stud_length_mm + ' mm' +
          (it.standard_stud_length_inch ? ' (' + it.standard_stud_length_inch + '")' : ''));
      });
      lines.push('');
    });
    lines.push(DISCLAIMER);
    return lines.join('\n');
  }

  function holeRows(res) {
    const rows = [[
      'تعداد سوراخ', 'قطر Stud (اینچ)', 'قطر Stud (mm)', 'رزوه', 'آچارخور (mm)', 'آچارخور (اینچ)',
      'مهره AF (mm)', 'ارتفاع مهره (mm)', 'سایز فلنج (NPS)', 'DN', 'کلاس', 'استاندارد',
      'سری', 'فیس', 'طول Stud جدول (mm)', 'طول Stud جدول (اینچ)', 'نکات'
    ]];
    if (!res || !res.groups) { return rows; }
    res.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        rows.push([
          res.holeCount,
          g.bolt_diameter_inch,
          g.bolt_diameter_mm,
          g.thread || '',
          g.wrench_size_mm != null ? g.wrench_size_mm : '',
          g.wrench_size_inch || '',
          g.nut_across_flats_mm != null ? g.nut_across_flats_mm : '',
          g.nut_height_mm != null ? g.nut_height_mm : '',
          it.nps_inch,
          it.dn,
          it.pressure_class,
          it.standard,
          it.series || '',
          it.flange_face,
          it.standard_stud_length_mm != null ? it.standard_stud_length_mm : '',
          it.standard_stud_length_inch || '',
          (it.notes || '') + ' | ' + DISCLAIMER
        ]);
      });
    });
    return rows;
  }

  /* ------------------- history / favorites / status ----------------------- */
  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return iso; }
  }
  function renderHistory() {
    const rawList = FSF.Store.loadHistory();
    const list = rawList.filter(function (h) { return h && h.type !== 'reverse'; });
    const tbody = document.querySelector('#historyTable tbody');
    const empty = document.getElementById('historyEmpty');
    if (!tbody) { return; }
    tbody.innerHTML = '';
    if (!list.length) {
      if (empty) { empty.hidden = false; }
      document.getElementById('historyTable').closest('.table-wrap').hidden = true;
      return;
    }
    if (empty) { empty.hidden = true; }
    document.getElementById('historyTable').closest('.table-wrap').hidden = false;
    list.forEach(function (h, i) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + esc(fmtTime(h.time)) + '</td>' +
        '<td>' + esc(h.typeLabel || h.type) + '</td>' +
        '<td class="cell-num">' + esc(h.input) + '</td>' +
        '<td>' + esc(h.summary || '') + '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-hist="' + i + '">نمایش</button></td>';
      tbody.appendChild(tr);
    });
  }
  function renderFavorites() {
    const rawList = FSF.Store.loadFavorites();
    const list = rawList.filter(function (f) { return f && f.kind !== 'reverse'; });
    const box = document.getElementById('favoriteChips');
    if (!box) { return; }
    box.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.innerHTML = '⭐<br>هنوز چیزی به علاقه‌مندی‌ها اضافه نشده است. در نتایج جستجو روی «افزودن به علاقه‌مندی‌ها» بزنید.';
      box.appendChild(p);
      return;
    }
    list.forEach(function (f) {
      const chip = el('button', 'chip');
      chip.type = 'button';
      chip.innerHTML = '<span class="chip-label">' + esc(f.label) + '</span>' +
        '<span class="chip-x" title="حذف" data-fav-del="' + esc(f.id) + '">×</span>';
      chip.addEventListener('click', function (e) {
        if (e.target.dataset.favDel) { return; }
        document.dispatchEvent(new CustomEvent('fsf:runFavorite', { detail: f }));
      });
      box.appendChild(chip);
      const x = chip.querySelector('[data-fav-del]');
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        FSF.Store.removeFavorite(f.id);
        renderFavorites();
      });
    });
  }
  function renderDataStatus() {
    const grid = document.getElementById('dataStatusGrid');
    if (!grid) { return; }
    const sum = FSF.Store.dataSummary();
    const src = FSF.dataSources || {};
    const ov = FSF.Store.getOverrides();
    const items = [
      ['سایزهای فلنج', sum.sizes],
      ['رکوردهای بولتینگ فلنج', sum.bolting],
      ['رکوردهای آچار/مهره', sum.wrench],
      ['منبع داده فعال', src.bolting ? src.bolting.source : '—'],
      ['داده سفارشی ذخیره‌شده', Object.keys(ov).length ? 'دارد' : 'ندارد']
    ];
    grid.innerHTML = items.map(function (it) {
      return '<div class="status-item"><span class="k">' + esc(it[0]) + '</span><span class="v">' +
        esc(String(it[1])) + '</span></div>';
    }).join('');
  }
  function updateSourceBadge() {
    const b = document.getElementById('dataSourceBadge');
    if (!b) { return; }
    const sum = FSF.Store.dataSummary();
    const src = FSF.dataSources && FSF.dataSources.bolting ? FSF.dataSources.bolting.source : '';
    b.textContent = 'داده محلی: ' + sum.bolting + ' رکورد بولتینگ · ' + (src || '—');
  }

  FSF.UI = {
    esc: esc, kv: kv, badge: badge, notice: notice,
    NO_DATA_MSG: NO_DATA_MSG, DISCLAIMER: DISCLAIMER,
    flangeCardHtml: flangeCardHtml, studCardHtml: studCardHtml, holeGroupCardHtml: holeGroupCardHtml,
    renderFlangeResults: renderFlangeResults, renderStudResults: renderStudResults,
    renderHoleResults: renderHoleResults,
    renderHistory: renderHistory, renderFavorites: renderFavorites,
    renderDataStatus: renderDataStatus, updateSourceBadge: updateSourceBadge,
    flangeRows: flangeRows, flangeText: flangeText, studText: studText, studRows: studRows,
    holeRows: holeRows, holeText: holeText,
    emptyStateHtml: emptyStateHtml
  };
})(window.FSF);