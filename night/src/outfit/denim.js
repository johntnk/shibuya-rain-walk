// Any close-fitting VRoid trousers or leggings turned into skinny blue jeans: the cloth's own folds and seams kept
// (as light against its average), over indigo denim — the fine diagonal of the twill, and a soft stone wash in
// blotches, paler here and there as worn jeans are.
import * as THREE from 'three';
import { blotch, repaint } from './kit.js';

// deep / pale: the denim's colour where the wash left it and where it took it pale (0–255)
export function denim(mat, { deep = [62, 92, 140], pale = [128, 158, 196], detail = 0.55, bold = false } = {}) {   // (bold: the twill, the slubby streaks and the fading made plain to see)   // (detail: how much of the cloth's own pattern shows through — low for a plaid or print underneath)
  const src = mat.map && mat.map.image; if (!src) return;
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height).data, ls = [];
  for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 128) ls.push((d[i] + d[i + 1] + d[i + 2]) / 765);
  ls.sort((p, q) => p - q); const mid = Math.max(0.02, ls.length ? ls[ls.length >> 1] : 0.5), S = cv.width / 512;   // (the cloth's usual shade, not pulled up by a pale panel or stripe)
  repaint(mat, (r, gg, b, u, v, x, y) => {
    const l = (r + gg + b) / 765, fold = l > mid * 1.45 ? 1 : Math.min(1.05, Math.pow(l / mid, detail));   // (the folds and seams kept; a sports stripe or pale panel goes: jeans have none)
    const twill = bold ? 0.86 + 0.14 * Math.pow(0.5 + 0.5 * Math.sin((x + y) * Math.PI / (2.2 * S)), 1.5) : 0.93 + 0.07 * (0.5 + 0.5 * Math.sin((x + y) * Math.PI * 0.85 / S));   // (diagonal ribs)
    const slub = bold ? 0.6 * (blotch(x * 1.0, y * 0.06, 2.5 * S, 3) - 0.5) : 0;                    // (streaks running down the cloth, the yarn uneven)
    const wash = Math.min(1, Math.max(0, 0.3 + (bold ? 0.6 : 0.38) * (blotch(x, y, 52 * S) - 0.5) + 0.14 * (blotch(x, y, 12 * S, 5) - 0.5) + slub));   // (the wash)
    const k = fold * twill;
    return [(deep[0] + (pale[0] - deep[0]) * wash) * k, (deep[1] + (pale[1] - deep[1]) * wash) * k, (deep[2] + (pale[2] - deep[2]) * wash) * k];
  });
  if (mat.shadeColorFactor) mat.shadeColorFactor.setRGB(0.6, 0.68, 0.84);           // (denim in shadow: cool, not VRoid's pink)
}

// a denim cloth of its own (for trousers made new): dark rinse indigo, the twill's fine diagonal, slubby streaks
// running down it and a soft uneven fade
export function denimTex(deep = [28, 36, 60], pale = [64, 80, 110]) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const twill = 0.95 + 0.05 * (0.5 + 0.5 * Math.sin((x + y) * Math.PI / 1.6)), slub = 0.35 * (blotch(x, y * 0.08, 2.2, 3) - 0.5);
    const wash = Math.min(1, Math.max(0, 0.22 + 0.4 * (blotch(x, y, 70, 1) - 0.5) + 0.15 * (blotch(x, y, 14, 5) - 0.5) + slub)), i = (y * S + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = (deep[c] + (pale[c] - deep[c]) * wash) * twill; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
