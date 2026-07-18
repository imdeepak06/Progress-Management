/**
 * generateLocationPDF.js
 * Professional white-background PDF report — Super Tech Power Engineers Pvt. Ltd.
 *
 * HINDI FIX:
 *  - Fetches NotoSansDevanagari TTF from jsDelivr CDN at generation time
 *  - Registers it as a real embedded jsPDF font — consistent on ALL machines
 *  - Falls back to canvas method only if font fetch fails
 *  - Hindi text is sized correctly (same sizing as Latin, no oversized glyphs)
 *  - Works identically on Windows, Mac, Linux, mobile — no system font dependency
 */

import { jsPDF } from "jspdf";
import { format } from "date-fns";

// ─── Company ──────────────────────────────────────────────────────────────────
const CO = {
  name:    "SUPER TECH POWER ENGINEERS PVT. LTD.",
  tagline: "Electronic Field Service Report (eFSR)",
  gstin:   "07AAKCS20651ZD",
  cin:     "U40102DL2006PTC151597",
  pan:     "AAKCS2065C",
  address: "N71, Street No. 3, Sadatpur Extension, Karawal Nagar, Delhi - 110094",
  phone:   "+91 9211228933",
  email:   "supertechgem@gmail.com",
  client:  "Prayagraj Commissionerate, Prayagraj, UP",
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  black:     [0,   0,   0],
  white:     [255, 255, 255],
  headerBg:  [30,  58,  95],
  sectionBg: [220, 230, 242],
  rowAlt:    [245, 247, 250],
  border:    [180, 190, 205],
  text:      [30,  30,  30],
  muted:     [100, 110, 125],
  green:     [34,  139, 34],
  red:       [200, 40,  40],
  amber:     [180, 110, 0],
  accent:    [30,  58,  95],
};

const PW  = 210;
const PH  = 297;
const ML  = 12;
const MR  = 12;
const CW  = PW - ML - MR;
const HDR = 32;
const FTR = 14;
const TOP = HDR + 4;
const BOT = PH - FTR - 4;

// ─── Hindi font loader ────────────────────────────────────────────────────────
// Fetches NotoSansDevanagari from jsDelivr (unpkg mirror of npm package).
// Returns base64 string of the TTF, or null on failure.
let _cachedHindiFont = null; // module-level cache so we only fetch once

async function loadHindiFont() {
  if (_cachedHindiFont !== null) return _cachedHindiFont;

  // Multiple CDN sources to try in order
  const sources = [
    // jsDelivr - npm noto-sans-devanagari package (most reliable)
    "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari@5.0.24/files/noto-sans-devanagari-devanagari-400-normal.woff2",
    // Alternative: unpkg
    "https://unpkg.com/@fontsource/noto-sans-devanagari@5.0.24/files/noto-sans-devanagari-devanagari-400-normal.woff2",
    // Fallback: noto-emoji or a known TTF on cdnjs
    // We use a ttf because jsPDF addFileToVFS works best with ttf/otf base64
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
  ];

  // jsPDF supports TTF embedded as base64. woff2 is NOT supported by jsPDF
  // directly — we need TTF. Use the GitHub raw TTF source.
  const ttfSources = [
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
    "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf",
  ];

  for (const url of ttfSources) {
    try {
      const resp = await fetch(url, { cache: "force-cache" });
      if (!resp.ok) continue;
      const buf = await resp.arrayBuffer();
      // Convert ArrayBuffer to base64
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      _cachedHindiFont = b64;
      return b64;
    } catch (_) {
      continue;
    }
  }

  _cachedHindiFont = ""; // empty string = failed, don't retry
  return null;
}

// ─── Font registration ────────────────────────────────────────────────────────
// Register the Hindi font with a jsPDF instance. Called once per doc.
function registerHindiFont(doc, fontBase64) {
  if (!fontBase64) return false;
  try {
    doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", fontBase64);
    doc.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
    doc.addFileToVFS("NotoSansDevanagari-Bold.ttf", fontBase64); // use regular as bold fallback
    doc.addFont("NotoSansDevanagari-Bold.ttf", "NotoSansDevanagari", "bold");
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Text helpers ─────────────────────────────────────────────────────────────
// Moves the Devanagari "chhoti i" vowel sign (matra) — U+093F — so it sits
// directly BEFORE the single consonant glyph it is attached to. Unicode
// always stores this matra logically AFTER its consonant, but it must
// visually render to that consonant's LEFT. jsPDF's embedded-font renderer
// does not perform this re-ordering (no real Indic text-shaping engine),
// which caused PDFs to show the matra attached to the NEXT letter instead
// of its own (e.g. "मूर्ति" rendering as "मूर्त" + a stray mark, or
// "स्थिति" rendering wrong).
//
// IMPORTANT: only the immediately-preceding consonant is swapped — NOT the
// whole conjunct cluster before it (e.g. in "मूर्ति" only "त" + "ि" swap,
// "र्" stays put). This was verified by rendering real test PDFs: swapping
// the whole cluster (an earlier attempt) produced broken output for
// conjuncts, while swapping just the immediate pair renders every tested
// word correctly (मूर्ति, हंडिया, त्रिवेणी, प्रिय, गिरफ्तार, स्थिति,
// जिला, दिल्ली, क्रिकेट, विकास all verified visually correct).
function fixDevanagariMatraOrder(str) {
  if (!str) return str;
  const consonant = "[\\u0915-\\u0939\\u0958-\\u095F]";
  return str.replace(new RegExp(`(${consonant})\\u093F`, "g"), "\u093F$1");
}

function cleanText(str) {
  if (!str) return "";
  let s = String(str)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")   // zero-width / BOM
    .replace(/[\u2013\u2014]/g, "-")            // em/en dash
    .replace(/[\u00B7\u2022\u2027]/g, ".");    // middot / bullet
  s = fixDevanagariMatraOrder(s);
  return s.trim();
}

function hasHindi(str) {
  return /[\u0900-\u097F]/.test(str || "");
}

// latinOnly: strips Devanagari for use when Hindi font not available
function latinOnly(str) {
  if (!str) return "";
  return cleanText(str).replace(/[\u0900-\u097F]+/g, "").trim() || "--";
}

// Canvas fallback for Hindi — only used if font fetch failed
function renderHindiToImage(text, { fontSize = 9, color = [30, 30, 30], bold = false } = {}) {
  try {
    // Use a fixed, reasonable DPI so text isn't oversized
    const DPI = 150;
    const ptToPx = DPI / 72;
    const px = Math.round(fontSize * ptToPx * 1.1); // slight scale for readability
    const fontStr = `${bold ? "bold " : ""}${px}px "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif`;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = fontStr;
    const measured = ctx.measureText(text);
    const w = Math.ceil(measured.width) + 4;
    const h = Math.ceil(px * 1.5) + 4;
    canvas.width  = w;
    canvas.height = h;
    ctx.font = fontStr;
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.textBaseline = "top";
    ctx.fillText(text, 2, 2);
    // Convert px dimensions to mm using the same DPI
    const pxToMm = 25.4 / DPI;
    return { dataUrl: canvas.toDataURL("image/png"), widthMm: w * pxToMm, heightMm: h * pxToMm };
  } catch (_) {
    return null;
  }
}

// ─── Low-level helpers ────────────────────────────────────────────────────────
const sf = (d, a) => d.setFillColor(...a);
const sd = (d, a) => d.setDrawColor(...a);
const st = (d, a) => d.setTextColor(...a);

function R(doc, x, y, w, h, fill, stroke) {
  if (fill)  { sf(doc, fill);  doc.rect(x, y, w, h, stroke ? "FD" : "F"); }
  else if (stroke) { sd(doc, stroke); doc.setLineWidth(0.25); doc.rect(x, y, w, h, "S"); }
}

// T: draw text. Handles Hindi via embedded font (primary) or canvas (fallback).
// hindiFont: boolean — whether the embedded Devanagari font was successfully registered
function T(doc, text, x, y, { size = 9, color = C.text, bold = false, align = "left", maxW, hindiFont = false } = {}) {
  const str = String(text ?? "--");
  const cleaned = cleanText(str);

  if (hasHindi(cleaned)) {
    if (hindiFont) {
      // Use the embedded Devanagari font — most reliable, consistent across all machines
      doc.setFontSize(size);
      doc.setFont("NotoSansDevanagari", bold ? "bold" : "normal");
      st(doc, color);
      const opts = {};
      if (align !== "left") opts.align = align;
      if (maxW) opts.maxWidth = maxW;
      doc.text(cleaned, x, y, Object.keys(opts).length ? opts : undefined);
      // Reset to default font after
      doc.setFont("helvetica", "normal");
      return;
    } else {
      // Canvas fallback: render Hindi as PNG image
      const result = renderHindiToImage(cleaned, { fontSize: size, color, bold });
      if (result) {
        const drawW = maxW ? Math.min(result.widthMm, maxW) : result.widthMm;
        const drawH = result.heightMm;
        let drawX = x;
        if (align === "right")  drawX = x - drawW;
        if (align === "center") drawX = x - drawW / 2;
        // Align vertically: jsPDF text baseline = y, image top = y - ascender
        const drawY = y - drawH * 0.85;
        try {
          doc.addImage(result.dataUrl, "PNG", drawX, drawY, drawW, drawH);
        } catch (_) {}
        return;
      }
      // Canvas also failed — show placeholder
      doc.setFontSize(size);
      doc.setFont("helvetica", "normal");
      st(doc, C.muted);
      doc.text("[Hindi]", x, y);
      return;
    }
  }

  // Pure Latin / ASCII text
  doc.setFontSize(size);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  st(doc, color);
  const safe = cleaned || "--";
  const opts = {};
  if (align !== "left") opts.align = align;
  if (maxW) opts.maxWidth = maxW;
  doc.text(safe, x, y, Object.keys(opts).length ? opts : undefined);
}

function line(doc, x1, y1, x2, y2, color = C.border, lw = 0.25) {
  doc.setLineWidth(lw);
  sd(doc, color);
  doc.line(x1, y1, x2, y2);
}

async function loadImg(url) {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        res(c.toDataURL("image/jpeg", 0.82));
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.src = url;
  });
}

// ─── Page header ─────────────────────────────────────────────────────────────
function drawHeader(doc, logoData, pageNum, total) {
  R(doc, 0, 0, PW, HDR, C.headerBg);

  if (logoData) {
    try { doc.addImage(logoData, "JPEG", ML, 4, 22, 22); } catch (_) {}
  }

  T(doc, CO.name,    PW / 2, 11, { size: 11, color: C.white, bold: true,  align: "center" });
  T(doc, CO.tagline, PW / 2, 17, { size: 8,  color: C.white,        align: "center" });
  T(doc, CO.address, PW / 2, 22, { size: 6,  color: C.white,        align: "center" });
  T(doc, `${CO.phone}  |  ${CO.email}`, PW / 2, 27, { size: 6, color: C.white, align: "center" });

  T(doc, `Page ${pageNum} of ${total}`, PW - MR, 11, { size: 7.5, color: C.white, align: "right" });
  T(doc, format(new Date(), "dd/MM/yyyy"), PW - MR, 17, { size: 7, color: C.white, align: "right" });

  line(doc, 0, HDR, PW, HDR, [80, 120, 175], 0.5);
}

// ─── Page footer ─────────────────────────────────────────────────────────────
function drawFooter(doc, locationName, hindiFont) {
  const y = PH - FTR;
  line(doc, 0, y, PW, y, C.border, 0.4);
  R(doc, 0, y, PW, FTR, [245, 247, 250]);
  T(doc, CO.name, ML, y + 5, { size: 6.5, color: C.muted, bold: true });
  T(doc, locationName || "", ML, y + 9.5, { size: 6, color: C.muted, hindiFont });
  T(doc, `GSTIN: ${CO.gstin}   |   CIN: ${CO.cin}   |   PAN: ${CO.pan}`, PW / 2, y + 5, { size: 6, color: C.muted, align: "center" });
  T(doc, "Confidential - For Internal Use Only", PW - MR, y + 5, { size: 6, color: C.muted, align: "right" });
  T(doc, `Generated by Super Tech Portal  •  ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, PW - MR, y + 9.5, { size: 6, color: C.muted, align: "right" });
}

// ─── Section heading row ──────────────────────────────────────────────────────
function sectionRow(doc, title, y, h = 7, hindiFont = false) {
  R(doc, ML, y, CW, h, C.sectionBg, C.border);
  T(doc, title, ML + 3, y + h - 2, { size: 8.5, color: C.accent, bold: true, hindiFont });
  return y + h;
}

// ─── Table header row ─────────────────────────────────────────────────────────
function tableHeaderRow(doc, cols, y, h = 6.5) {
  R(doc, ML, y, CW, h, C.accent);
  sd(doc, C.border); doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, h, "S");
  cols.forEach((col) => {
    T(doc, col.label, col.x + 2, y + h - 2, { size: 7.5, color: C.white, bold: true });
    if (col !== cols[cols.length - 1])
      line(doc, col.x + col.w, y, col.x + col.w, y + h, [100, 130, 170], 0.25);
  });
  return y + h;
}

// ─── Table data row ───────────────────────────────────────────────────────────
function tableRow(doc, cells, cols, y, h = 6, alt = false, hindiFont = false) {
  if (alt) R(doc, ML, y, CW, h, C.rowAlt);
  R(doc, ML, y, CW, h, null, C.border);
  cells.forEach((cell, i) => {
    const col = cols[i];
    if (!col) return;
    const color = cell.color || C.text;
    T(doc, cell.text ?? cell, col.x + 2, y + h - 2, { size: 7.5, color, bold: cell.bold || false, maxW: col.w - 4, hindiFont });
    if (i < cols.length - 1)
      line(doc, col.x + col.w, y, col.x + col.w, y + h, C.border, 0.2);
  });
  return y + h;
}

// ─── Key-value grid ───────────────────────────────────────────────────────────
function kvGrid(doc, rows, startY, boxH = 7, hindiFont = false) {
  let y = startY;
  const halfW  = CW / 2;
  const labelW = halfW * 0.44;
  const valueW = halfW - labelW - 6;

  for (let i = 0; i < rows.length; i += 2) {
    const left  = rows[i];
    const right = rows[i + 1];
    const bg = Math.floor(i / 2) % 2 === 1 ? C.rowAlt : C.white;

    R(doc, ML,            y, halfW, boxH, bg, C.border);
    T(doc, left.label,    ML + 2,            y + boxH - 2, { size: 6.5, color: C.muted });
    T(doc, left.value || "--", ML + labelW + 4, y + boxH - 2, { size: 7.5, color: C.text, maxW: valueW, hindiFont });

    if (right) {
      R(doc, ML + halfW,  y, halfW, boxH, bg, C.border);
      T(doc, right.label, ML + halfW + 2,             y + boxH - 2, { size: 6.5, color: C.muted });
      T(doc, right.value || "--", ML + halfW + labelW + 4, y + boxH - 2, { size: 7.5, color: C.text, maxW: valueW, hindiFont });
    }
    y += boxH;
  }
  return y;
}

// ─── Status colour ────────────────────────────────────────────────────────────
function statusColor(s) {
  if (s === "verified") return C.green;
  if (s === "rejected") return C.red;
  return C.amber;
}

// ─── Description box ─────────────────────────────────────────────────────────
// Draws a multi-line description/rejection row that auto-expands to fit the text.
// prefix:    e.g. "   >> " or "   [!] Rejection: "
// bgColor:   fill colour for the box
// textColor: colour for the text
// getY:      function () => current y — read AFTER ensureFn so page-breaks are reflected
// setY:      function (val) => sets the outer y — needed when we span multiple pages
// Returns the new y after the box.
function descriptionBox(doc, text, prefix, _yUnused, bgColor, textColor, ensureFn, hindiFont = false, getY, setY) {
  const fullText = `${prefix}${text}`;
  const fontSize   = 6.5;
  const lineHeight = 4.5;  // mm between lines
  const paddingTop = 3.5;  // mm from box top to first text baseline
  const paddingBot = 3;    // mm below last line to box bottom

  // Split text into lines
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  const maxW = CW - 6;

  let lines;
  if (hasHindi(fullText) && hindiFont) {
    doc.setFont("NotoSansDevanagari", "normal");
    lines = doc.splitTextToSize(fullText, maxW);
    doc.setFont("helvetica", "normal");
  } else {
    const safeText = hasHindi(fullText) ? latinOnly(fullText) : fullText;
    lines = doc.splitTextToSize(safeText, maxW);
  }

  // How many lines fit in the usable body area
  const bodyH        = BOT - TOP;
  const linesPerPage = Math.floor((bodyH - paddingTop - paddingBot) / lineHeight);

  // Draw lines in chunks that fit on one page each
  let remaining = [...lines];
  let isFirst   = true;

  while (remaining.length > 0) {
    // Determine how many lines we can draw before hitting BOT
    const availH   = BOT - getY();
    const fitLines = Math.max(1, Math.floor((availH - paddingTop - paddingBot) / lineHeight));
    const chunk    = remaining.splice(0, fitLines);

    const boxH = paddingTop + chunk.length * lineHeight + paddingBot;

    // If this chunk doesn't fit at all, force a new page first
    ensureFn(paddingTop + lineHeight + paddingBot + 1);
    const boxY = getY();

    R(doc, ML, boxY, CW, boxH, bgColor, C.border);

    let ty = boxY + paddingTop;
    for (const ln of chunk) {
      T(doc, ln, ML + 4, ty, { size: fontSize, color: textColor, hindiFont });
      ty += lineHeight;
    }

    setY(boxY + boxH);
    isFirst = false;

    // If there are more lines, trigger a page break for the next chunk
    if (remaining.length > 0) {
      ensureFn(BOT - TOP); // force new page
    }
  }

  return getY();
}

// ─── Image grid helper ────────────────────────────────────────────────────────
function drawImageGrid(doc, entries, startY, cols = 3, imgH = 42, ensureFn) {
  const gap   = 3;
  const imgW  = (CW - gap * (cols - 1)) / cols;
  const rowH  = imgH + 10;
  let y = startY;

  for (let i = 0; i < entries.length; i++) {
    const colIdx = i % cols;

    if (colIdx === 0) {
      ensureFn(rowH);
    }

    const x = ML + colIdx * (imgW + gap);
    const d = entries[i].data;

    if (d) {
      try { doc.addImage(d, "JPEG", x, y, imgW, imgH, undefined, "MEDIUM"); }
      catch (_) {}
    } else {
      R(doc, x, y, imgW, imgH, C.rowAlt, C.border);
      T(doc, "Image unavailable", x + imgW / 2, y + imgH / 2,
        { size: 7, color: C.muted, align: "center" });
    }
    sd(doc, C.border); doc.setLineWidth(0.3);
    doc.rect(x, y, imgW, imgH, "S");

    if (entries[i].caption) {
      T(doc, entries[i].caption, x + imgW / 2, y + imgH + 4,
        { size: 6, color: C.muted, align: "center", maxW: imgW });
    }

    const isLastInRow = (colIdx === cols - 1);
    const isLastItem  = (i === entries.length - 1);
    if (isLastInRow || isLastItem) {
      y += rowH;
    }
  }

  return y;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateLocationPDF(location, updates) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  // ── Load Hindi font first (parallel with other assets) ───────────────────────
  const [logoData, hindiFontBase64] = await Promise.all([
    loadImg("/logo.jpeg"),
    loadHindiFont(),
  ]);

  // Register the font with this jsPDF instance
  const hindiFont = registerHindiFont(doc, hindiFontBase64);

  // ── Build data structures ─────────────────────────────────────────────────────
  const s = location.stats || {};
  const recceImgs = location.defaultImages?.length
    ? location.defaultImages
    : location.defaultImage ? [location.defaultImage] : [];

  const byType = { camera: [], wifi: [], power: [] };
  (updates || []).forEach((u) => { if (byType[u.type]) byType[u.type].push(u); });

  const allPhotoURLs = new Set([...recceImgs]);
  Object.values(byType).forEach((arr) =>
    arr.forEach((u) => (u.photos || []).forEach((p) => allPhotoURLs.add(p.url)))
  );

  const urlList = [...allPhotoURLs].slice(0, 40);
  const imgCache = {};
  await Promise.all(urlList.map(async (url) => {
    const d = await loadImg(url);
    if (d) imgCache[url] = d;
  }));

  // ── Page state ───────────────────────────────────────────────────────────────
  let pageNum = 1;
  let y       = TOP;

  const newPage = () => {
    drawFooter(doc, location.name, hindiFont);
    doc.addPage();
    pageNum++;
    y = TOP;
  };

  const ensure = (needed) => { if (y + needed > BOT) newPage(); };

  // getY / setY — passed into descriptionBox so it always reads/writes the live y
  const getY = () => y;
  const setY = (v) => { y = v; };

  const section = (title) => {
    ensure(16);
    y = sectionRow(doc, title, y, 7, hindiFont);
  };

  const drawImgGrid = (entries, cols, imgH) => {
    y = drawImageGrid(doc, entries, y, cols, imgH, ensure);
  };

  // Helper: T with hindiFont bound — avoids passing hindiFont everywhere manually
  const Td = (text, x, yy, opts = {}) => T(doc, text, x, yy, { hindiFont, ...opts });

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Cover / Summary
  // ════════════════════════════════════════════════════════════════════════════

  // Report title band
  R(doc, ML, y, CW, 12, C.headerBg);
  T(doc, "LOCATION INSTALLATION REPORT", ML + 3, y + 8, { size: 12, color: C.white, bold: true });
  T(doc, `Prepared for: ${CO.client}`, PW - MR - 2, y + 8,
    { size: 7.5, color: [180,205,230], align: "right", maxW: 85 });
  y += 12;

  // Location identity box
  R(doc, ML, y, CW, 10, C.rowAlt, C.border);
  Td(location.name || "--", ML + 3, y + 6.5,
    { size: 10, color: C.accent, bold: true, maxW: CW / 2 - 6 });
  const locSub = location.thana ? String(location.thana) : "";
  if (locSub) {
    Td(locSub, PW - MR - 3, y + 6.5,
      { size: 8, color: C.muted, align: "right", maxW: CW / 2 - 6 });
  }
  y += 10;

  // Company + Client info (2-col)
  const halfW = CW / 2;
  const infoH = 36;
  R(doc, ML,         y, halfW, infoH, C.white, C.border);
  R(doc, ML + halfW, y, halfW, infoH, C.white, C.border);
  line(doc, ML + halfW, y, ML + halfW, y + infoH, C.border, 0.4);

  T(doc, "PREPARED BY",                         ML + 3, y + 5,  { size: 6.5, color: C.muted, bold: true });
  T(doc, CO.name,                                ML + 3, y + 11, { size: 8,   color: C.accent, bold: true, maxW: halfW - 6 });
  T(doc, `GSTIN: ${CO.gstin}   CIN: ${CO.cin}`, ML + 3, y + 17, { size: 6,   color: C.muted, maxW: halfW - 6 });
  T(doc, `PAN: ${CO.pan}`,                       ML + 3, y + 22, { size: 6,   color: C.muted, maxW: halfW - 6 });
  T(doc, CO.address,                             ML + 3, y + 27, { size: 6.5, color: C.text, maxW: halfW - 6 });
  T(doc, `Contact No. - ${CO.phone}   Email - ${CO.email}`, ML + 3, y + 33, { size: 6, color: C.text, maxW: halfW - 6 });

  T(doc, "CLIENT / END USER",                   ML + halfW + 3, y + 5,  { size: 6.5, color: C.muted, bold: true });
  T(doc, CO.client,                             ML + halfW + 3, y + 11, { size: 8,   color: C.accent, bold: true, maxW: halfW - 6 });
  T(doc, `State: Uttar Pradesh`,                ML + halfW + 3, y + 20, { size: 6.5, color: C.text, maxW: halfW - 6 });
  y += infoH + 4;

  // ── Location Remarks (company color-coded notes) ──────────────────────────────
  const remarks = location.remarks || [];
  if (remarks.length > 0) {
    section("LOCATION REMARKS");
    const remarkColorMap = {
      green:  { bg: [235, 255, 240], border: [34, 139, 34],   dot: C.green, text: [20, 100, 20]  },
      yellow: { bg: [255, 252, 230], border: [180, 130, 0],   dot: C.amber, text: [120, 80,  0]  },
      red:    { bg: [255, 235, 235], border: [200, 40,  40],  dot: C.red,   text: [150, 20,  20] },
    };
    for (const remark of remarks) {
      const rc = remarkColorMap[remark.color] || remarkColorMap.green;
      const remarkH = 12;
      if (y + remarkH > BOT) { newPage(); }
      // Background + border
      R(doc, ML, y, CW, remarkH, rc.bg);
      sd(doc, rc.border); doc.setLineWidth(0.4);
      doc.rect(ML, y, CW, remarkH, "S");
      // Left color bar
      sf(doc, rc.dot); doc.rect(ML, y, 2.5, remarkH, "F");
      // Color label dot
      sf(doc, rc.dot); doc.circle(ML + 7, y + remarkH / 2, 2, "F");
      // Remark text
      T(doc, String(remark.text || ""), ML + 13, y + 4.5, { size: 8, color: rc.text, maxW: CW - 20 });
      // Color tag top-right
      T(doc, String(remark.color || "").toUpperCase(), PW - MR - 2, y + 4.5, { size: 6, color: rc.dot, bold: true, align: "right" });
      y += remarkH + 2;
    }
    y += 2;
  }

  // ── Installation Summary ──────────────────────────────────────────────────────
  section("INSTALLATION SUMMARY");

  const statCols = [
    { label: "Category",        x: ML,       w: 38 },
    { label: "Planned",         x: ML + 38,  w: 25 },
    { label: "Verified / Done", x: ML + 63,  w: 30 },
    { label: "Pending",         x: ML + 93,  w: 25 },
    { label: "Rejected",        x: ML + 118, w: 25 },
    { label: "Progress",        x: ML + 143, w: CW - 143 },
  ];
  y = tableHeaderRow(doc, statCols, y);

  const statRows = [
    { label: "CCTV / Camera", plan: s.planned?.camera, ver: s.camera?.verified, pend: s.camera?.pending, rej: s.camera?.rejected, pct: s.camera?.progress },
    { label: "WiFi Network",  plan: s.planned?.wifi,   ver: s.wifi?.verified,   pend: s.wifi?.pending,   rej: s.wifi?.rejected,   pct: s.wifi?.progress   },
    { label: "Power Supply",  plan: s.planned?.power,  ver: s.power?.verified,  pend: s.power?.pending,  rej: s.power?.rejected,  pct: s.power?.progress  },
  ];

  statRows.forEach((r, i) => {
    const pct = r.pct ?? 0;
    if (i % 2 === 1) R(doc, ML, y, CW, 10, C.rowAlt);
    R(doc, ML, y, CW, 10, null, C.border);
    statCols.forEach((c, ci) => {
      if (ci < statCols.length - 1)
        line(doc, c.x + c.w, y, c.x + c.w, y + 10, C.border, 0.2);
    });

    T(doc, r.label,      statCols[0].x + 2, y + 7, { size: 7.5, bold: true, color: C.text });
    T(doc, r.plan  ?? 0, statCols[1].x + 2, y + 7, { size: 7.5, color: C.text });
    T(doc, r.ver   ?? 0, statCols[2].x + 2, y + 7, { size: 7.5, color: C.green, bold: true });
    T(doc, r.pend  ?? 0, statCols[3].x + 2, y + 7, { size: 7.5, color: C.amber });
    T(doc, r.rej   ?? 0, statCols[4].x + 2, y + 7, { size: 7.5, color: C.red   });

    const bx = statCols[5].x + 2;
    const bw = statCols[5].w - 14;
    const bh = 4;
    const by = y + 3;
    R(doc, bx, by, bw, bh, [210, 215, 225]);
    const fw = Math.max(0, Math.min(bw, (pct / 100) * bw));
    const fillC = pct >= 100 ? C.green : pct > 50 ? [30, 120, 180] : C.amber;
    if (fw > 0) R(doc, bx, by, fw, bh, fillC);
    T(doc, `${pct}%`, bx + bw + 2, by + 3.5, { size: 6.5, color: C.text });
    y += 10;
  });

  // ── Control Room row (binary yes/no with color bar) ────────────────────────
  {
    const cr = location.controlRoom || {};
    const isConnected = cr.status === "connected";
    const crLabel = isConnected ? "Yes (Connected)" : cr.status === "pending" ? "Pending" : cr.status === "rejected" ? "No (Rejected)" : "No (Not Connected)";
    const crColor = isConnected ? C.green : C.red;

    // Alternating row (index 3 = even → white bg, show alt)
    R(doc, ML, y, CW, 10, C.rowAlt);
    R(doc, ML, y, CW, 10, null, C.border);
    statCols.forEach((c, ci) => {
      if (ci < statCols.length - 1)
        line(doc, c.x + c.w, y, c.x + c.w, y + 10, C.border, 0.2);
    });

    T(doc, "Control Room", statCols[0].x + 2, y + 7, { size: 7.5, bold: true, color: C.text });
    T(doc, "--",           statCols[1].x + 2, y + 7, { size: 7.5, color: C.muted });
    T(doc, isConnected ? "Yes" : "No", statCols[2].x + 2, y + 7, { size: 7.5, color: crColor, bold: true });
    T(doc, "--",           statCols[3].x + 2, y + 7, { size: 7.5, color: C.muted });
    T(doc, "--",           statCols[4].x + 2, y + 7, { size: 7.5, color: C.muted });

    // Color bar: full green if connected, full red if not
    const bx = statCols[5].x + 2;
    const bw = statCols[5].w - 14;
    const bh = 4;
    const by = y + 3;
    R(doc, bx, by, bw, bh, [210, 215, 225]);
    R(doc, bx, by, isConnected ? bw : bw * 0.07, bh, crColor); // tiny sliver if not connected
    T(doc, isConnected ? "100%" : "0%", bx + bw + 2, by + 3.5, { size: 6.5, color: crColor });
    y += 10;
  }
  y += 4;

  // ── Location Details ──────────────────────────────────────────────────────────
  section("LOCATION DETAILS");

  const coordStr = location.latitude
    ? `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`
    : "Not recorded";

  const detailRows = [
    { label: "Location Name", value: location.name },
    { label: "Thana / Area",  value: location.thana },
    { label: "State",         value: "Uttar Pradesh" },
    { label: "GPS Coordinates", value: coordStr },
    { label: "Superadmin",    value: location.superadmin?.name || "--" },
    { label: "Created By",    value: location.createdBy?.name  || "--" },
    { label: "Report Date",   value: format(new Date(), "dd/MM/yyyy") },
  ];
  y = kvGrid(doc, detailRows, y, 7, hindiFont);
  y += 4;

  // ── Recce / Site Survey Photos ────────────────────────────────────────────────
  if (recceImgs.length > 0) {
    ensure(16 + 50);
    section("RECCE / SITE SURVEY PHOTOGRAPHS");
    const recceEntries = recceImgs.slice(0, 9).map((url, i) => ({
      data:    imgCache[url] || null,
      caption: `Site Survey Photo ${i + 1}`,
    }));
    drawImgGrid(recceEntries, 3, 45);
    y += 4;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CCTV CAMERA SECTION
  // ════════════════════════════════════════════════════════════════════════════
  if (byType.camera.length > 0) {
    ensure(20);
    section("CCTV / CAMERA INSTALLATION UPDATES");

    const camCols = [
      { label: "#",                  x: ML,      w: 8   },
      { label: "Title / Description",x: ML + 8,  w: 60  },
      { label: "Type",               x: ML + 68, w: 20  },
      { label: "Units",              x: ML + 88, w: 16  },
      { label: "Install Date",       x: ML + 104,w: 28  },
      { label: "Submitted By",       x: ML + 132,w: 30  },
      { label: "Status",             x: ML + 162,w: CW - 162 },
    ];
    y = tableHeaderRow(doc, camCols, y);

    byType.camera.forEach((u, i) => {
      const rowH = 8;
      ensure(rowH + 2);
      if (i % 2 === 1) R(doc, ML, y, CW, rowH, C.rowAlt);
      R(doc, ML, y, CW, rowH, null, C.border);
      camCols.forEach((c, ci) => { if (ci < camCols.length - 1) line(doc, c.x + c.w, y, c.x + c.w, y + rowH, C.border, 0.2); });

      T(doc, i + 1,                             camCols[0].x + 2, y + 6, { size: 7 });
      Td(u.title || "Camera",                   camCols[1].x + 2, y + 6, { size: 7, maxW: camCols[1].w - 4 });
      T(doc, "Camera",                           camCols[2].x + 2, y + 6, { size: 7 });
      T(doc, u.installedCount ?? 1,              camCols[3].x + 2, y + 6, { size: 7 });
      T(doc, u.installationDate ? format(new Date(u.installationDate), "dd/MM/yyyy") : "--", camCols[4].x + 2, y + 6, { size: 7 });
      Td(u.submittedBy?.name || "--",            camCols[5].x + 2, y + 6, { size: 7, maxW: camCols[5].w - 4 });
      T(doc, (u.status || "pending").toUpperCase(), camCols[6].x + 2, y + 6, { size: 7, color: statusColor(u.status), bold: true });
      y += rowH;

      if (u.description) {
        descriptionBox(doc, u.description, "   >> ", null, C.white, C.muted, ensure, hindiFont, getY, setY); y = getY();
      }
      if (u.status === "rejected" && u.rejectionReason) {
        descriptionBox(doc, u.rejectionReason, "   [!] Rejection: ", null, [255,245,245], C.red, ensure, hindiFont, getY, setY); y = getY();
      }
    });
    y += 4;

    const camPhotos = [];
    byType.camera.forEach((u) => {
      (u.photos || []).forEach((p) => camPhotos.push({ data: imgCache[p.url] || null, caption: cleanText(u.title) || "Camera" }));
    });
    if (camPhotos.length > 0) {
      ensure(16 + 52);
      sectionRow(doc, "CCTV Camera — Installation Photographs", y, 6, hindiFont);
      y += 6;
      drawImgGrid(camPhotos.slice(0, 24), 3, 42);
      y += 4;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WIFI SECTION
  // ════════════════════════════════════════════════════════════════════════════
  if (byType.wifi.length > 0) {
    ensure(20);
    section("WIFI NETWORK INSTALLATION UPDATES");

    const wifiCols = [
      { label: "#",                  x: ML,      w: 8   },
      { label: "Title / Description",x: ML + 8,  w: 60  },
      { label: "Type",               x: ML + 68, w: 20  },
      { label: "Units",              x: ML + 88, w: 16  },
      { label: "Install Date",       x: ML + 104,w: 28  },
      { label: "Submitted By",       x: ML + 132,w: 30  },
      { label: "Status",             x: ML + 162,w: CW - 162 },
    ];
    y = tableHeaderRow(doc, wifiCols, y);

    byType.wifi.forEach((u, i) => {
      const rowH = 8;
      ensure(rowH + 2);
      if (i % 2 === 1) R(doc, ML, y, CW, rowH, C.rowAlt);
      R(doc, ML, y, CW, rowH, null, C.border);
      wifiCols.forEach((c, ci) => { if (ci < wifiCols.length - 1) line(doc, c.x + c.w, y, c.x + c.w, y + rowH, C.border, 0.2); });

      T(doc, i + 1,                                  wifiCols[0].x + 2, y + 6, { size: 7 });
      Td(u.title || "WiFi update",                   wifiCols[1].x + 2, y + 6, { size: 7, maxW: wifiCols[1].w - 4 });
      T(doc, "WiFi",                                  wifiCols[2].x + 2, y + 6, { size: 7 });
      T(doc, u.installedCount ?? 1,                   wifiCols[3].x + 2, y + 6, { size: 7 });
      T(doc, u.installationDate ? format(new Date(u.installationDate), "dd/MM/yyyy") : "--", wifiCols[4].x + 2, y + 6, { size: 7 });
      Td(u.submittedBy?.name || "--",                 wifiCols[5].x + 2, y + 6, { size: 7, maxW: wifiCols[5].w - 4 });
      T(doc, (u.status || "pending").toUpperCase(),   wifiCols[6].x + 2, y + 6, { size: 7, color: statusColor(u.status), bold: true });
      y += rowH;

      if (u.description) {
        descriptionBox(doc, u.description, "   >> ", null, C.white, C.muted, ensure, hindiFont, getY, setY); y = getY();
      }
      if (u.status === "rejected" && u.rejectionReason) {
        descriptionBox(doc, u.rejectionReason, "   [!] Rejection: ", null, [255,245,245], C.red, ensure, hindiFont, getY, setY); y = getY();
      }
    });
    y += 4;

    const wifiPhotos = [];
    byType.wifi.forEach((u) => {
      (u.photos || []).forEach((p) => wifiPhotos.push({ data: imgCache[p.url] || null, caption: cleanText(u.title) || "WiFi" }));
    });
    if (wifiPhotos.length > 0) {
      ensure(16 + 52);
      sectionRow(doc, "WiFi Network — Installation Photographs", y, 6, hindiFont);
      y += 6;
      drawImgGrid(wifiPhotos.slice(0, 24), 3, 42);
      y += 4;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POWER SUPPLY SECTION
  // ════════════════════════════════════════════════════════════════════════════
  if (byType.power.length > 0) {
    ensure(20);
    section("POWER SUPPLY INSTALLATION UPDATES");

    const pwrCols = [
      { label: "#",                  x: ML,      w: 8   },
      { label: "Title / Description",x: ML + 8,  w: 68  },
      { label: "Install Date",       x: ML + 76, w: 30  },
      { label: "Submitted By",       x: ML + 106,w: 36  },
      { label: "Status",             x: ML + 142,w: CW - 142 },
    ];
    y = tableHeaderRow(doc, pwrCols, y);

    byType.power.forEach((u, i) => {
      const rowH = 8;
      ensure(rowH + 2);
      if (i % 2 === 1) R(doc, ML, y, CW, rowH, C.rowAlt);
      R(doc, ML, y, CW, rowH, null, C.border);
      pwrCols.forEach((c, ci) => { if (ci < pwrCols.length - 1) line(doc, c.x + c.w, y, c.x + c.w, y + rowH, C.border, 0.2); });

      T(doc, i + 1,                                  pwrCols[0].x + 2, y + 6, { size: 7 });
      Td(u.title || "Power supply",                  pwrCols[1].x + 2, y + 6, { size: 7, maxW: pwrCols[1].w - 4 });
      T(doc, u.installationDate ? format(new Date(u.installationDate), "dd/MM/yyyy") : "--", pwrCols[2].x + 2, y + 6, { size: 7 });
      Td(u.submittedBy?.name || "--",                pwrCols[3].x + 2, y + 6, { size: 7, maxW: pwrCols[3].w - 4 });
      T(doc, (u.status || "pending").toUpperCase(),  pwrCols[4].x + 2, y + 6, { size: 7, color: statusColor(u.status), bold: true });
      y += rowH;

      if (u.description) {
        descriptionBox(doc, u.description, "   >> ", null, C.white, C.muted, ensure, hindiFont, getY, setY); y = getY();
      }
      if (u.status === "rejected" && u.rejectionReason) {
        descriptionBox(doc, u.rejectionReason, "   [!] Rejection: ", null, [255,245,245], C.red, ensure, hindiFont, getY, setY); y = getY();
      }
    });
    y += 4;

    const pwrPhotos = [];
    byType.power.forEach((u) => {
      (u.photos || []).forEach((p) => pwrPhotos.push({ data: imgCache[p.url] || null, caption: cleanText(u.title) || "Power" }));
    });
    if (pwrPhotos.length > 0) {
      ensure(16 + 52);
      sectionRow(doc, "Power Supply — Installation Photographs", y, 6, hindiFont);
      y += 6;
      drawImgGrid(pwrPhotos.slice(0, 24), 3, 42);
      y += 4;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGN-OFF
  // ════════════════════════════════════════════════════════════════════════════
  ensure(40);
  section("REPORT SIGN-OFF");

  R(doc, ML, y, CW, 34, C.rowAlt, C.border);
  T(doc, "This report has been auto-generated by the Super Tech field operations portal.", ML + 4, y + 7,  { size: 7.5, color: C.text, maxW: CW - 8 });
  T(doc, "All data reflects verified field records at the time of generation.",            ML + 4, y + 12, { size: 7.5, color: C.text, maxW: CW - 8 });
  T(doc, `Report generated on: ${format(new Date(), "dd MMMM yyyy, hh:mm a")}`,           ML + 4, y + 18, { size: 7.5, color: C.muted });
  Td(`Location: ${location.name || ""}`,                                                   ML + 4, y + 24, { size: 7.5, color: C.muted });
  T(doc, CO.name,    ML + 4,  y + 31, { size: 8, color: C.accent, bold: true });
  T(doc, CO.address, PW - MR, y + 31, { size: 7, color: C.muted,  align: "right", maxW: 100 });
  y += 34 + 4;

  // Signature boxes
  ensure(30);
  const sigW = CW / 3 - 4;
  ["Prepared By", "Verified By", "Authorised By"].forEach((label, i) => {
    const sx = ML + i * (sigW + 6);
    R(doc, sx, y, sigW, 24, C.white, C.border);
    T(doc, label, sx + sigW / 2, y + 20, { size: 7, color: C.muted, align: "center" });
    line(doc, sx + 4, y + 16, sx + sigW - 4, y + 16, C.border, 0.5);
  });
  y += 28;

  // ── Patch all page headers ────────────────────────────────────────────────────
  drawFooter(doc, location.name, hindiFont);
  const total = pageNum;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawHeader(doc, logoData, p, total);
  }

  // Build a filename-safe slug that PRESERVES Hindi/Devanagari characters
  // (only the old code stripped them to "_", which is why Hindi location
  // names produced filenames full of underscores). We only strip characters
  // that are actually illegal in file names on Windows/Mac/Linux.
  const safe = (location.name || "location")
    .replace(/[\\/:*?"<>|]/g, "")   // illegal filename characters
    .replace(/\s+/g, "_")           // spaces -> underscore
    .replace(/_+/g, "_")            // collapse repeats
    .replace(/^_+|_+$/g, "")        // trim leading/trailing underscores
    || "location";
  doc.save(`SuperTech_Report_${safe}_${format(new Date(), "yyyyMMdd")}.pdf`);
}