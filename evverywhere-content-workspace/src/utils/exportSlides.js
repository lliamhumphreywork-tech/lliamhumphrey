import JSZip from 'jszip';

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function captureElement(el, width, height) {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, {
    width,
    height,
    scale: 1,
    useCORS: true,
    backgroundColor: '#F5F0E8',
    logging: false,
  });
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function exportAllSlides(slideEls, title) {
  const zip = new JSZip();
  const slug = slugify(title || 'carousel');
  const date = new Date().toISOString().slice(0, 10);
  const folderName = `evvrywhere-${slug}-${date}`;

  for (let i = 0; i < slideEls.length; i++) {
    const el = slideEls[i];
    if (!el) continue;
    const canvas = await captureElement(el, 1080, 1350);
    const blob = await canvasToBlob(canvas);
    const num = String(i + 1).padStart(2, '0');
    zip.file(`${folderName}/slide-${num}.png`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, `${folderName}.zip`);
}

export async function exportLinkedinCrop(el) {
  const canvas = await (async () => {
    const { default: html2canvas } = await import('html2canvas');
    return html2canvas(el, {
      width: 1200,
      height: 627,
      scale: 1,
      useCORS: true,
      backgroundColor: '#F5F0E8',
      logging: false,
    });
  })();
  const blob = await canvasToBlob(canvas);
  triggerDownload(blob, 'evvrywhere-linkedin.png');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
