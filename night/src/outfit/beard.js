// A short goatee: a trimmed moustache over the upper lip and a small beard on the chin below the lower lip, grey
// shot with black, close to the skin (a patch laid on the face, its edge broken into the short hairs of the beard).
import * as THREE from 'three';
import { landmarks } from './jaw.js';

function stubble(dark, grey, vm, vh) {                                           // (vm: where the mouth's middle is down the patch; vh: half its height)
  const W = 256, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
  // the shapes, as how deep inside each a point lies (0 at the edge, 1 well in): a moustache in a shallow crescent
  // along the upper lip, thinning to its ends; a short beard on the chin, rounded at the bottom, narrowing up to the
  // lower lip — the patch's top is the nose, its bottom the chin
  const depth = (u, v) => {
    const top = vm - vh - 0.03, mc = top * 0.62, mh = top * 0.26;                    // (moustache: in the space between nose and upper lip, clear of the lip)
    const du = (u - 0.5) / 0.27, mo = 1 - Math.abs((v - (mc + 0.05 * du * du)) / (mh * (1 - 0.6 * du * du)));
    const b0 = vm + vh + 0.07, bc = (b0 + 1) / 2, bh = (1 - b0) / 2;                 // (chin beard: from a little under the lower lip to the chin)
    const cu = (u - 0.5) / (0.12 + 0.06 * Math.min(1, Math.max(0, (v - b0) / (2 * bh)))), cv2 = (v - bc) / bh, ch = 1 - Math.hypot(cu, Math.max(0, Math.abs(cv2) - 0.3) / 0.7);
    return Math.max(Math.abs(du) < 1 && v < top ? mo : -1, v > b0 ? ch : -1);
  };
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const img = g.createImageData(W, H), d = img.data;                                  // (underneath: the beard's own soft shade, fading out at its edge)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = depth(x / W, y / H); if (k <= 0) continue; const i = (y * W + x) * 4, m = rnd();
    d[i] = dark[0] + (grey[0] - dark[0]) * 0.3 * m; d[i + 1] = dark[1] + (grey[1] - dark[1]) * 0.3 * m; d[i + 2] = dark[2] + (grey[2] - dark[2]) * 0.3 * m; d[i + 3] = 170 * Math.min(1, k * 3); }
  g.putImageData(img, 0, 0);
  for (let n = 0; n < 14000; n++) {                                                   // (short hairs, each a little stroke; a few stray past the edge)
    const u = rnd(), v = rnd(), k = depth(u, v); if (k < -0.15 || (k < 0 && rnd() < 0.7)) continue;
    const c = rnd() < 0.5 ? dark : grey, len = 2.5 + rnd() * 3.5, a = Math.PI / 2 + (u - 0.5) * 1.4 + (rnd() - 0.5) * 0.6;
    g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.6 + rnd() * 0.4})`; g.lineWidth = 1 + rnd() * 0.9;
    g.beginPath(); g.moveTo(u * W, v * H); g.lineTo(u * W + Math.cos(a) * len, v * H + Math.sin(a) * len); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function goatee(av, { dark = [40, 40, 44], grey = [138, 138, 144] } = {}) {
  const vrm = av.vrm, L = landmarks(vrm), tri = [];
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, P = g.attributes.position, I = g.index;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) { const m = ms[gr.materialIndex ?? 0]; if (!m || !/Face_00_SKIN/.test(m.name) || /Outline/.test(m.name)) continue;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I.getX(k); tri.push(P.getX(i), P.getY(i), P.getZ(i)); } }
  });
  const front = (x, y) => { let z = -1e9; for (let t = 0; t < tri.length; t += 9) { const ax = tri[t], ay = tri[t + 1], bx = tri[t + 3], by = tri[t + 4], cx = tri[t + 6], cy = tri[t + 7], d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue; const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d; if (u < 0 || v < 0 || u + v > 1) continue; z = Math.max(z, u * tri[t + 2] + v * tri[t + 5] + (1 - u - v) * tri[t + 8]); } return z; };
  const y0 = L.chin + 0.001, y1 = L.nose.y - 0.003, half = (L.mouth.x1 - L.mouth.x0) * 0.85, NX = 28, NY = 30, pos = [], uv = [], idx = [];
  const mid = (L.mouth.y0 + L.mouth.y1) / 2, vm = (y1 - mid) / (y1 - y0), vh = 0.0085 / (y1 - y0);   // (the lip line, and the lips' half-height, down the patch)
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NY, x = L.cx + (u - 0.5) * 2 * half, y = y1 - (y1 - y0) * v, z = front(x, y);
    pos.push(x, y, (z > -1e8 ? z : L.nose.z - 0.02) + 0.0012); uv.push(u, 1 - v);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * (NX + 1) + i; idx.push(k, k + NX + 1, k + 1, k + 1, k + NX + 1, k + NX + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: stubble(dark, grey, vm, vh), transparent: true, alphaTest: 0.25, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.userData.noInk = true; mesh.renderOrder = 2;
  const b = vrm.humanoid.getRawBoneNode('head'); b.updateMatrixWorld(true); mesh.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert()); b.add(mesh); mesh.frustumCulled = false;
  return mesh;
}
