/**
 * generateQueriesReportPDF.js
 * PDF report for all queries shown on the Queries page (with filters/stats).
 * Design & structure mirrors generateQueryPDF.js — Super Tech Power Engineers Pvt. Ltd.
 */

import { jsPDF } from "jspdf";
import { format } from "date-fns";

// ─── Company ──────────────────────────────────────────────────────────────────
const CO = {
  name:    "SUPER TECH POWER ENGINEERS PVT. LTD.",
  tagline: "Service Query Report (SQR)",
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
  orange:    [220, 100, 0],
  accent:    [30,  58,  95],
  purple:    [100, 60, 160],
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

// ─── Logo loader ──────────────────────────────────────────────────────────────
let _cachedLogo = null;

async function loadLogo() {
  if (_cachedLogo !== null) return _cachedLogo;
  try {
    const res = await fetch("/logo.jpeg", { cache: "force-cache" });
    if (!res.ok) throw new Error("no logo");
    const blob = await res.blob();
    _cachedLogo = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_) { _cachedLogo = null; }
  return _cachedLogo;
}

// ─── Hindi font loader ────────────────────────────────────────────────────────
let _cachedHindiFont = null;

async function loadHindiFont() {
  if (_cachedHindiFont !== null) return _cachedHindiFont;
  const ttfSources = [
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
    "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf",
  ];
  for (const url of ttfSources) {
    try {
      const resp = await fetch(url, { cache: "force-cache" });
      if (!resp.ok) continue;
      const buf   = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary  = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      _cachedHindiFont = btoa(binary);
      return _cachedHindiFont;
    } catch (_) { continue; }
  }
  _cachedHindiFont = "";
  return null;
}

function registerHindiFont(doc, fontBase64) {
  if (!fontBase64) return false;
  try {
    doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", fontBase64);
    doc.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
    doc.addFileToVFS("NotoSansDevanagari-Bold.ttf", fontBase64);
    doc.addFont("NotoSansDevanagari-Bold.ttf", "NotoSansDevanagari", "bold");
    return true;
  } catch (_) { return false; }
}

// ─── Text helpers ─────────────────────────────────────────────────────────────
function fixDevanagariMatraOrder(str) {
  if (!str) return str;
  const consonant = "[\\u0915-\\u0939\\u0958-\\u095F]";
  return str.replace(new RegExp(`(${consonant})\\u093F`, "g"), "\u093F$1");
}

function cleanText(str) {
  if (!str) return "";
  let s = String(str)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u00B7\u2022\u2027]/g, ".");
  s = fixDevanagariMatraOrder(s);
  return s.trim();
}

function hasHindi(str) { return /[\u0900-\u097F]/.test(str || ""); }

function latinOnly(str) {
  if (!str) return "";
  return cleanText(str).replace(/[\u0900-\u097F]+/g, "").trim() || "--";
}

function renderHindiToImage(text, { fontSize = 9, color = [30,30,30], bold = false } = {}) {
  try {
    const DPI   = 150;
    const ptToPx = DPI / 72;
    const px    = Math.round(fontSize * ptToPx * 1.1);
    const fontStr = `${bold ? "bold " : ""}${px}px "Noto Sans Devanagari", "Mangal", sans-serif`;
    const canvas  = document.createElement("canvas");
    const ctx     = canvas.getContext("2d");
    ctx.font      = fontStr;
    const measured = ctx.measureText(text);
    const w = Math.ceil(measured.width) + 4;
    const h = Math.ceil(px * 1.5) + 4;
    canvas.width = w; canvas.height = h;
    ctx.font = fontStr;
    ctx.fillStyle   = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.textBaseline = "top";
    ctx.fillText(text, 2, 2);
    const pxToMm = 25.4 / DPI;
    return { dataUrl: canvas.toDataURL("image/png"), widthMm: w * pxToMm, heightMm: h * pxToMm };
  } catch (_) { return null; }
}

const sf = (d, a) => d.setFillColor(...a);
const sd = (d, a) => d.setDrawColor(...a);
const st = (d, a) => d.setTextColor(...a);

function R(doc, x, y, w, h, fill, stroke) {
  if (fill)        { sf(doc, fill); doc.rect(x, y, w, h, stroke ? "FD" : "F"); }
  else if (stroke) { sd(doc, stroke); doc.setLineWidth(0.25); doc.rect(x, y, w, h, "S"); }
}

function T(doc, text, x, y, { size = 9, color = C.text, bold = false, align = "left", maxW, hindiFont = false } = {}) {
  const str     = String(text ?? "--");
  const cleaned = cleanText(str);
  if (hasHindi(cleaned)) {
    if (hindiFont) {
      doc.setFontSize(size);
      doc.setFont("NotoSansDevanagari", bold ? "bold" : "normal");
      st(doc, color);
      const opts = {};
      if (align !== "left") opts.align = align;
      if (maxW) opts.maxWidth = maxW;
      doc.text(cleaned, x, y, Object.keys(opts).length ? opts : undefined);
      doc.setFont("helvetica", "normal");
      return;
    } else {
      const result = renderHindiToImage(cleaned, { fontSize: size, color, bold });
      if (result) {
        const drawW = maxW ? Math.min(result.widthMm, maxW) : result.widthMm;
        doc.addImage(result.dataUrl, "PNG", x, y - result.heightMm * 0.75, drawW, result.heightMm);
        return;
      }
      const latin = latinOnly(cleaned);
      doc.setFontSize(size); doc.setFont("helvetica", bold ? "bold" : "normal");
      st(doc, color);
      doc.text(latin, x, y, align !== "left" ? { align } : undefined);
      return;
    }
  }
  doc.setFontSize(size);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  st(doc, color);
  const opts = {};
  if (align !== "left") opts.align = align;
  if (maxW) opts.maxWidth = maxW;
  doc.text(cleaned, x, y, Object.keys(opts).length ? opts : undefined);
}

// ─── Header / Footer ──────────────────────────────────────────────────────────
function drawHF(doc, pageNum, totalPages, reportTitle, hindiFont, logoDataUrl) {
  // Header background
  R(doc, 0, 0, PW, HDR, C.headerBg);

  // Logo (top-right)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "JPEG", PW - MR - 20, 3, 18, 18, undefined, "FAST");
    } catch (_) {}
  }

  const textMaxW = logoDataUrl ? CW - 22 : CW;
  T(doc, CO.name,    ML, 8,    { size: 10,  color: C.white,         bold: true, hindiFont, maxW: textMaxW });
  T(doc, CO.tagline, ML, 13.5, { size: 7.5, color: [180, 200, 230], hindiFont });
  T(doc, `GSTIN: ${CO.gstin}`,  ML, 18.5, { size: 6.5, color: [180,200,230], hindiFont });
  T(doc, CO.address, ML, 23,   { size: 6.5, color: [180,200,230], hindiFont });
  T(doc, `${CO.phone}  |  ${CO.email}`, ML, 27.5, { size: 6.5, color: [180,200,230], hindiFont });

  if (reportTitle) {
    if (logoDataUrl) T(doc, reportTitle, PW - MR, 24, { size: 7.5, color: C.white, bold: true, align: "right", hindiFont });
    else             T(doc, reportTitle, PW - MR, 10, { size: 8,   color: C.white, bold: true, align: "right", hindiFont });
  }
  T(doc, `Page ${pageNum} of ${totalPages}`, PW - MR, logoDataUrl ? 29 : 16, { size: 7.5, color: [180,200,230], align: "right", hindiFont });

  // Footer
  R(doc, 0, PH - FTR, PW, FTR, C.headerBg);
  T(doc, CO.name,             ML, PH - FTR + 5,  { size: 7,   color: [180,200,230], hindiFont });
  T(doc, `Client: ${CO.client}`, ML, PH - FTR + 9, { size: 6.5, color: [180,200,230], hindiFont });
  T(doc, `Page ${pageNum}`,   PW - MR, PH - FTR + 7, { size: 7, color: [180,200,230], align: "right", hindiFont });
}

function sectionBar(doc, y, label, hindiFont) {
  R(doc, ML, y, CW, 7, C.sectionBg);
  sd(doc, C.border); doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, 7, "S");
  T(doc, label, ML + 3, y + 5, { size: 8.5, color: C.accent, bold: true, hindiFont });
  return y + 9;
}

function kv(doc, x, y, label, value, w, hindiFont, opts = {}) {
  T(doc, label + ":", x, y, { size: 7.5, color: C.muted, bold: false, hindiFont });
  T(doc, value || "--", x, y + 4.5, {
    size:  opts.size  || 8.5,
    color: opts.color || C.text,
    bold:  opts.bold  || false,
    maxW:  w - 2,
    hindiFont,
  });
}

function statusColor(status) {
  switch (status) {
    case "open":        return C.amber;
    case "in_progress": return C.orange;
    case "resolved":    return C.green;
    case "rejected":    return C.red;
    default:            return C.muted;
  }
}

function priorityColor(priority) {
  switch (priority) {
    case "low":      return C.green;
    case "medium":   return C.amber;
    case "high":     return C.orange;
    case "critical": return C.red;
    default:         return C.muted;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * generateQueriesReportPDF(queries, stats, filters)
 *
 * @param {Array}  queries  — array of query documents from the queries page
 * @param {object} stats    — { open, in_progress, resolved, rejected }
 * @param {object} filters  — { status, category, priority, from, to } (for display in report)
 * @returns {Promise<void>}  saves PDF to disk (browser download)
 */
export async function generateQueriesReportPDF(queries = [], stats = null, filters = {}) {
  const hindiFont  = await loadHindiFont();
  const logoDataUrl = await loadLogo();

  const doc     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const hf_bool = !!hindiFont;

  if (hindiFont) registerHindiFont(doc, hindiFont);

  let pageNum    = 1;
  let totalPages = 1; // will fix at end

  const reportTitle = "All Service Queries Report";

  const newPage = () => {
    doc.addPage();
    pageNum++;
    drawHF(doc, pageNum, "?", reportTitle, hf_bool, logoDataUrl);
    return TOP;
  };

  const ensureSpace = (y, needed) => {
    if (y + needed > BOT) return newPage();
    return y;
  };

  // Draw first page header
  drawHF(doc, 1, "?", reportTitle, hf_bool, logoDataUrl);
  let y = TOP;

  // ── Cover: Report Summary ─────────────────────────────────────────────────
  y = sectionBar(doc, y, "REPORT SUMMARY", hf_bool);
  R(doc, ML, y, CW, 28, C.rowAlt);
  sd(doc, C.border); doc.setLineWidth(0.2); doc.rect(ML, y, CW, 28, "S");

  const col = CW / 4;
  kv(doc, ML + 3,           y + 3,  "Report Generated", format(new Date(), "dd MMM yyyy, HH:mm"), col, hf_bool);
  kv(doc, ML + col + 3,     y + 3,  "Total Queries",    String(queries.length), col, hf_bool, { bold: true });
  kv(doc, ML + col * 2 + 3, y + 3,  "Client",           CO.client, col * 2 - 3, hf_bool);

  // Stats row
  const statuses = ["open", "in_progress", "resolved", "rejected"];
  const statLabels = ["Open", "In Progress", "Resolved", "Rejected"];
  const statColors = [C.amber, C.orange, C.green, C.red];
  const counts = stats || {};
  statuses.forEach((s, i) => {
    const count = counts[s] ?? queries.filter(q => q.status === s).length;
    kv(doc, ML + 3 + (col * i), y + 16, statLabels[i], String(count), col, hf_bool, { color: statColors[i], bold: true, size: 10 });
  });

  y += 30;

  // ── Active Filters (if any) ───────────────────────────────────────────────
  const hasFilters = filters.status || filters.category || filters.priority || filters.from || filters.to;
  if (hasFilters) {
    y = ensureSpace(y, 18);
    R(doc, ML, y, CW, 14, [230, 238, 250]);
    sd(doc, C.border); doc.setLineWidth(0.2); doc.rect(ML, y, CW, 14, "S");
    T(doc, "ACTIVE FILTERS:", ML + 3, y + 5, { size: 7.5, color: C.accent, bold: true, hindiFont: hf_bool });
    const filterParts = [];
    if (filters.status)   filterParts.push(`Status: ${filters.status.replace("_", " ")}`);
    if (filters.category) filterParts.push(`Category: ${filters.category.replace("_", " ")}`);
    if (filters.priority) filterParts.push(`Priority: ${filters.priority}`);
    if (filters.from)     filterParts.push(`From: ${filters.from}`);
    if (filters.to)       filterParts.push(`To: ${filters.to}`);
    T(doc, filterParts.join("   |   "), ML + 3, y + 11, { size: 8, color: C.text, hindiFont: hf_bool });
    y += 16;
  }

  // ── Query Summary Table ───────────────────────────────────────────────────
  if (queries.length === 0) {
    y = ensureSpace(y, 20);
    T(doc, "No queries found matching the current filters.", ML + 3, y + 10, { size: 9, color: C.muted, bold: true, hindiFont: hf_bool });
    y += 20;
  } else {
    y = sectionBar(doc, y, `QUERY SUMMARY TABLE (${queries.length} queries)`, hf_bool);

    // Table headers
    const colWidths  = [10, 35, 22, 18, 20, 28, 25, 28];
    const colLabels  = ["#", "Title", "Category", "Priority", "Status", "Location", "Raised By", "Raised On"];
    const tableW     = colWidths.reduce((a, b) => a + b, 0);
    const startX     = ML + (CW - tableW) / 2;

    R(doc, ML, y, CW, 7, C.headerBg);
    let cx = startX;
    colLabels.forEach((lbl, i) => {
      T(doc, lbl, cx + 1, y + 5, { size: 7, color: C.white, bold: true, hindiFont: hf_bool });
      cx += colWidths[i];
    });
    y += 7;

    queries.forEach((q, idx) => {
      if (y + 8 > BOT) { y = newPage(); }
      const rowBg = idx % 2 === 0 ? C.white : C.rowAlt;
      R(doc, ML, y, CW, 8, rowBg);
      sd(doc, C.border); doc.setLineWidth(0.15);
      doc.rect(ML, y, CW, 8, "S");

      cx = startX;
      const vals = [
        String(idx + 1),
        cleanText(q.title).substring(0, 30),
        (q.category || "").replace(/_/g, " "),
        q.priority || "-",
        (q.status || "").replace(/_/g, " "),
        cleanText(q.locationName || "-").substring(0, 18),
        cleanText(q.superadmin?.name || q.superadminName || "-").substring(0, 16),
        q.createdAt ? format(new Date(q.createdAt), "dd/MM/yy") : "-",
      ];

      vals.forEach((val, i) => {
        let color = C.text;
        if (i === 4) color = statusColor(q.status);
        if (i === 3) color = priorityColor(q.priority);
        T(doc, val, cx + 1, y + 5.5, { size: 7, color, bold: i === 4, hindiFont: hf_bool });
        cx += colWidths[i];
      });
      y += 8;
    });
    y += 4;
  }

  // ── Detailed Query Cards ──────────────────────────────────────────────────
  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi];

    y = ensureSpace(y, 14);
    y = sectionBar(doc, y, `QUERY #${qi + 1}: ${cleanText(q.title).toUpperCase()}`, hf_bool);

    // Query info block
    const cardH = 40;
    y = ensureSpace(y, cardH);
    R(doc, ML, y, CW, cardH, C.rowAlt);
    sd(doc, C.border); doc.setLineWidth(0.2); doc.rect(ML, y, CW, cardH, "S");

    const col2 = CW / 4;
    kv(doc, ML + 3,             y + 3,  "Category",   (q.category || "").replace(/_/g, " ").toUpperCase(), col2, hf_bool, { bold: true });
    kv(doc, ML + col2 + 3,      y + 3,  "Priority",   (q.priority || "").toUpperCase(),                    col2, hf_bool, { color: priorityColor(q.priority), bold: true });
    kv(doc, ML + col2 * 2 + 3,  y + 3,  "Status",     (q.status || "").replace(/_/g, " ").toUpperCase(),  col2, hf_bool, { color: statusColor(q.status), bold: true });
    kv(doc, ML + col2 * 3 + 3,  y + 3,  "Query ID",   q._id?.toString().slice(-8).toUpperCase() || "-",   col2, hf_bool);

    kv(doc, ML + 3,             y + 14, "Raised By",  cleanText(q.superadmin?.name || q.superadminName || "-"),                      col2, hf_bool);
    kv(doc, ML + col2 + 3,      y + 14, "Location",   cleanText(q.locationName || "-"),                    col2, hf_bool);
    kv(doc, ML + col2 * 2 + 3,  y + 14, "Raised On",  q.createdAt ? format(new Date(q.createdAt), "dd MMM yyyy, HH:mm") : "-",       col2, hf_bool);
    kv(doc, ML + col2 * 3 + 3,  y + 14, "Thana / District", `${q.thana || "-"} / ${q.district || "-"}`,  col2, hf_bool);

    kv(doc, ML + 3,             y + 28, "Description", cleanText(q.description || "No description provided"), CW - 6, hf_bool, { size: 8 });

    y += cardH + 3;

    // Rejection block
    if (q.status === "rejected" && q.rejectionReason) {
      y = ensureSpace(y, 14);
      R(doc, ML, y, CW, 12, [255, 240, 240]);
      sd(doc, C.red); doc.setLineWidth(0.3); doc.rect(ML, y, CW, 12, "S");
      T(doc, "REJECTION REASON:", ML + 3, y + 5,  { size: 7.5, color: C.red,  bold: true, hindiFont: hf_bool });
      T(doc, cleanText(q.rejectionReason), ML + 3, y + 10, { size: 8,   color: C.text, maxW: CW - 6, hindiFont: hf_bool });
      y += 14;
    }

    // Resolution block
    if (q.status === "resolved" && q.resolution) {
      y = ensureSpace(y, 14);
      y = sectionBar(doc, y, "RESOLUTION DETAILS", hf_bool);

      const resH = 28;
      y = ensureSpace(y, resH);
      R(doc, ML, y, CW, resH, [240, 255, 245]);
      sd(doc, C.green); doc.setLineWidth(0.2); doc.rect(ML, y, CW, resH, "S");

      kv(doc, ML + 3,             y + 3,  "Resolved By (Person)", cleanText(q.resolution.resolverName || "-"),           col2, hf_bool, { bold: true, color: C.green });
      kv(doc, ML + col2 + 3,      y + 3,  "QueryAdmin Account",   cleanText(q.resolution.resolvedBy?.name || "-"),       col2, hf_bool);
      kv(doc, ML + col2 * 2 + 3,  y + 3,  "Resolved On",          q.resolution.resolvedAt ? format(new Date(q.resolution.resolvedAt), "dd MMM yyyy, HH:mm") : "-", col2, hf_bool);
      kv(doc, ML + col2 * 3 + 3,  y + 3,  "Proof Photos",         String(q.resolution.photos?.length || 0),             col2, hf_bool);

      kv(doc, ML + 3, y + 16, "Resolution Details", cleanText(q.resolution.details || "-"), CW - 6, hf_bool, { size: 8 });
      y += resH + 3;
    }

    // Timeline
    if (q.timeline?.length > 0) {
      y = ensureSpace(y, 14);
      y = sectionBar(doc, y, "QUERY TIMELINE", hf_bool);

      for (const ev of q.timeline) {
        const remarkText  = ev.remark ? cleanText(ev.remark) : "";
        const remarkLines = remarkText
          ? doc.setFontSize(7) && doc.splitTextToSize(remarkText, CW - 18)
          : [];
        const remarkHeight = remarkLines.length > 0 ? remarkLines.length * 4 + 2 : 0;
        const rowH = 10 + remarkHeight;

        y = ensureSpace(y, rowH + 1);
        R(doc, ML, y, CW, rowH, C.rowAlt);
        sd(doc, C.border); doc.setLineWidth(0.15); doc.rect(ML, y, CW, rowH, "S");

        sf(doc, C.accent); doc.circle(ML + 5, y + 5, 1.5, "F");

        T(doc, cleanText(ev.event), ML + 10, y + 4,  { size: 8,   color: C.text,   bold: false, maxW: CW * 0.55, hindiFont: hf_bool });
        T(doc, cleanText(ev.actor || "-"), PW - MR - 55, y + 4, { size: 7.5, color: C.accent, hindiFont: hf_bool });
        T(doc, ev.createdAt ? format(new Date(ev.createdAt), "dd/MM/yy HH:mm") : "-", PW - MR - 5, y + 4, { size: 7, color: C.muted, align: "right", hindiFont: hf_bool });

        if (remarkText) {
          doc.setFontSize(7);
          const lines = doc.splitTextToSize(remarkText, CW - 18);
          lines.forEach((line, li) => {
            T(doc, line, ML + 10, y + 9 + li * 4, { size: 7, color: C.muted, hindiFont: hf_bool });
          });
        }
        y += rowH + 1;
      }
      y += 4;
    }

    // Separator between queries
    if (qi < queries.length - 1) {
      y = ensureSpace(y, 6);
      sd(doc, C.border); doc.setLineWidth(0.4);
      doc.line(ML, y, ML + CW, y);
      y += 6;
    }
  }

  // ── Fix page numbers ──────────────────────────────────────────────────────
  totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawHF(doc, p, totalPages, reportTitle, hf_bool, logoDataUrl);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const dateStr = format(new Date(), "yyyyMMdd_HHmm");
  doc.save(`SQR_All_Queries_${dateStr}.pdf`);
}

export default generateQueriesReportPDF;