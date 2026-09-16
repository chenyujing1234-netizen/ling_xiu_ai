'use client';

/**
 * 把页面上的 SVG 导出为 PNG 图片（R-C3 / R-C4：生成一张图片）。
 * 做法：序列化 SVG → 画到离屏 canvas → toBlob → 触发下载。
 * 注意要内联 width/height 并铺白底，否则导出的图在深色背景下看不清。
 */
export async function svgToPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const width = Number(svg.getAttribute('width')) || svg.clientWidth || 800;
  const height = Number(svg.getAttribute('height')) || svg.clientHeight || 600;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    ctx.fillStyle = '#fbf8f1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('导出失败');
    download(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
