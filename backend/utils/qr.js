import QRCode from "qrcode";

/**
 * Generates a professional, modern, branded QR "poster" as an SVG string.
 * The QR encodes the public location URL; below it we print the company name
 * and the location details so the printed sheet is self-explanatory.
 *
 * Returned as an SVG data structure that the frontend renders / downloads as
 * PNG, OR directly as an SVG string for server-side bundling.
 */

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Build the branded QR poster SVG.
 * @param {object} opts
 * @param {string} opts.url        - URL the QR encodes (public location page)
 * @param {string} opts.companyName
 * @param {string} [opts.logoDataUri] - optional base64/data-uri logo to embed
 * @param {object} opts.location   - { name, thana, district, latitude, longitude, defaultImage }
 * @returns {Promise<string>} SVG markup
 */
export const buildQrPosterSvg = async ({
  url,
  companyName = "FieldOps",
  logoDataUri = "https://res.cloudinary.com/db1ds3nlf/image/upload/q_auto/f_auto/v1779267304/logo_kjages.jpg",
  location = {},
}) => {
  // Generate the QR as an SVG (QRCode renders a stroke-based path of 1px lines)
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H", // high — survives logo overlay & print wear
    margin: 1,
  });

  // The real QR is the path that has a stroke (the first path is just the bg rect).
  // Capture its `d` and stroke width so we can re-render it ourselves.
  const strokeMatch = qrSvg.match(
    /<path[^>]*stroke="[^"]*"[^>]*\bd="([^"]+)"[^>]*\/?>/,
  );
  const qrPath = strokeMatch ? strokeMatch[1] : "";
  const vbMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const qrSize = vbMatch ? parseInt(vbMatch[1], 10) : 33;

  const W = 720;
  const H = 980;
  const qrBox = 440; // rendered size of QR inside white card
  const qrX = (W - qrBox) / 2;
  const qrY = 250;
  const scale = qrBox / qrSize;

  const name = esc(location.name || "Location");
  const thana = esc(location.thana || "");
  const district = esc(location.district || "");
  const lat =
    location.latitude != null && location.latitude !== ""
      ? Number(location.latitude).toFixed(5)
      : "—";
  const lng =
    location.longitude != null && location.longitude !== ""
      ? Number(location.longitude).toFixed(5)
      : "—";

  const logoBlock = logoDataUri
    ? `<image href="${logoDataUri}" x="${W / 2 - 34}" y="48" width="68" height="68" preserveAspectRatio="xMidYMid meet" />`
    : `<g transform="translate(${W / 2 - 34}, 48)">
         <rect width="68" height="68" rx="18" fill="#ffffff" opacity="0.12"/>
         <path transform="translate(18,18) scale(1.4)" fill="#ffffff"
           d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9"/>
       </g>`;

  // Center logo chip inside the QR (works because errorCorrectionLevel H)
  const centerChip = logoDataUri
    ? `<g>
         <circle cx="${W / 2}" cy="${qrY + qrBox / 2}" r="52" fill="#ffffff"/>
         <clipPath id="cc"><circle cx="${W / 2}" cy="${qrY + qrBox / 2}" r="44"/></clipPath>
         <image href="${logoDataUri}" x="${W / 2 - 44}" y="${qrY + qrBox / 2 - 44}" width="88" height="88"
                clip-path="url(#cc)" preserveAspectRatio="xMidYMid slice"/>
       </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI', Arial, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a2880"/>
      <stop offset="55%" stop-color="#3b55e0"/>
      <stop offset="100%" stop-color="#4f6ef7"/>
    </linearGradient>
    <filter id="card" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="22" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="36" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" rx="36" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"/>

  <!-- Header / brand -->
  ${logoBlock}
  <text x="${W / 2}" y="160" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="800" letter-spacing="0.5">${esc(companyName)}</text>
  <text x="${W / 2}" y="198" text-anchor="middle" fill="#ffffff" fill-opacity="0.75" font-size="18" font-weight="500" letter-spacing="3">SCAN FOR LOCATION DETAILS</text>

  <!-- White QR card -->
  <rect x="${qrX - 24}" y="${qrY - 24}" width="${qrBox + 48}" height="${qrBox + 48}" rx="28" fill="#ffffff" filter="url(#card)"/>
  <g transform="translate(${qrX}, ${qrY}) scale(${scale})" shape-rendering="crispEdges">
    <path d="${qrPath}" stroke="#0e1726" stroke-width="1" fill="none"/>
  </g>
  ${centerChip}

  <!-- Location info -->
  <text x="${W / 2}" y="${qrY + qrBox + 78}" text-anchor="middle" fill="#ffffff" font-size="32" font-weight="800">${name}</text>
  <text x="${W / 2}" y="${qrY + qrBox + 116}" text-anchor="middle" fill="#ffffff" fill-opacity="0.85" font-size="19" font-weight="500">${[thana, district].filter(Boolean).join("  ·  ") || "&#160;"}</text>
  <text x="${W / 2}" y="${qrY + qrBox + 150}" text-anchor="middle" fill="#ffffff" fill-opacity="0.6" font-size="15" font-family="monospace">${lat}, ${lng}</text>

  <!-- Footer pill -->
  <rect x="${W / 2 - 140}" y="${H - 78}" width="280" height="44" rx="22" fill="#ffffff" fill-opacity="0.14"/>
  <text x="${W / 2}" y="${H - 49}" text-anchor="middle" fill="#ffffff" fill-opacity="0.9" font-size="15" font-weight="600">Scan to view &amp; raise an alert</text>
</svg>`;
};

/** Convenience: produce a plain QR PNG data URL (no branding). */
export const qrPngDataUrl = (text) =>
  QRCode.toDataURL(text, { errorCorrectionLevel: "H", margin: 1, width: 600 });
