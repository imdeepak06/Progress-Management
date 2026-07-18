/**
 * Convert an SVG markup string into a PNG Blob (rendered at a high pixel
 * density so the QR is crisp when printed) and trigger a browser download.
 */

const SCALE = 2; // 2x for print sharpness

const svgToPngBlob = (svg, width = 720, height = 980) =>
  new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png'
      );
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

const triggerDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** Download a single SVG poster as PNG. */
export const downloadSvgAsPng = async (svg, fileName = 'qr.png') => {
  const blob = await svgToPngBlob(svg);
  triggerDownload(blob, fileName);
};

/** Download many posters one-by-one as PNGs (small stagger to avoid browser block). */
export const downloadManyAsPng = async (items, onProgress) => {
  for (let i = 0; i < items.length; i++) {
    const { svg, fileName } = items[i];
    const blob = await svgToPngBlob(svg);
    triggerDownload(blob, fileName);
    onProgress?.(i + 1, items.length);
    // tiny delay so the browser doesn't suppress rapid downloads
    await new Promise((r) => setTimeout(r, 350));
  }
};
