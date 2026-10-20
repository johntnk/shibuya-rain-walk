// 陆叁昧, everyday: a plain white T-shirt, wide-leg jeans in a pale stone wash, white sneakers (all VRoid's own
// pieces: the T-shirt, the denim jeans widened all the way, the white sneakers). What's done here: the jeans' dark
// indigo washed out to a pale blue — palest down the fronts of the thighs and over the knees and the seat, in soft
// blotches as stones leave it, the seams and folds of the texture kept darker; his cords and wristbands.
import * as THREE from 'three';
import { blotch, smooth, repaint, materials } from './kit.js';
import { necklaces, wristbands } from './jewellery.js';

const DEEP = [104, 134, 172], PALE = [178, 199, 222];                // (the wash: where it stayed bluer, where the stones took it pale)
const gauss = (x, w) => Math.exp(-(x * x) / (2 * w * w));

export function dressWhiteTee(av) {
  const find = materials(av.vrm);
  // the jeans: the texture lays the legs out as four upright panels — back, front, front, back — under the waistband
  for (const m of find('Bottoms')) {
    repaint(m, (r, g, b, u, v, x, y) => {
      if (r > b + 12) return null;                                    // (the leather patch, the copper rivets, the red tab: as they are)
      const l = (r + g + b) / 3 / 255, d = Math.min(1.35, Math.pow(l / 0.13, 0.85));   // (the folds, seams and twill of the dark texture, around its mean)
      const front = Math.max(gauss(u - 0.37, 0.06), gauss(u - 0.64, 0.06)), back = Math.max(gauss(u - 0.135, 0.065), gauss(u - 0.865, 0.065));
      let fade = front * (0.75 * gauss(v - 0.34, 0.13) + 0.6 * gauss(v - 0.6, 0.06) + 0.3)   // (thighs, knees, the shins a little)
        + back * (0.7 * gauss(v - 0.22, 0.09) + 0.25);                // (the seat)
      fade = fade * (0.7 + 0.5 * blotch(x, y, 38)) + 0.25 * (blotch(x, y, 9, 7) - 0.5) + 0.25 * smooth(0.95, 0.99, v);   // (stone-wash blotches; the hems worn pale)
      const k = Math.min(1, Math.max(0, fade));
      const c = [DEEP[0] + (PALE[0] - DEEP[0]) * k, DEEP[1] + (PALE[1] - DEEP[1]) * k, DEEP[2] + (PALE[2] - DEEP[2]) * k];
      return [c[0] * d, c[1] * d, c[2] * d];
    });
    if (m.shadeColorFactor) m.shadeColorFactor.setRGB(0.62, 0.7, 0.84);   // (VRoid shades these jeans pink: on pale blue denim the shadow should be cool)
  }
  for (const m of find('Tops')) if (m.shadeColorFactor) m.shadeColorFactor.setRGB(0.72, 0.75, 0.86);   // (white cotton in shadow: cool grey, a little less lilac)
  straightLegs(av);
  necklaces(av, /Body_00_SKIN|Tops/);
  wristbands(av);
}

// VRoid widens these jeans by flaring them: at the widest the legs bell out to 34 cm round each ankle and run into
// each other, over the shoes. Wide-leg jeans hang straight: below the knee each leg is drawn in round its own
// middle to a steady width (a touch wider at the hem), and the hem is taken up off the ground to the top of the
// sneakers so they show. Done on the mesh at rest; it moves on its bones as before.
function straightLegs(av) {
  let pm = null; av.vrm.scene.traverse(o => { if (o.isSkinnedMesh && (Array.isArray(o.material) ? o.material : [o.material]).some(m => /Bottoms/.test(m.name))) pm = o; });
  if (!pm) return;
  const g = pm.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, bones = pm.skeleton.bones, n = P.count;
  // which leg each point belongs to, by its bones (a flared hem crosses the middle, so not by which side it is on)
  const side = new Int8Array(n);
  for (let i = 0; i < n; i++) { let l = 0, r = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j), nm = bones[SI.getComponent(i, j)].name; if (/_L_/.test(nm)) l += w; else if (/_R_/.test(nm)) r += w; } side[i] = l > r ? 1 : r > l ? -1 : 0; }
  // each leg's middle and its widest reach, 2 cm at a time down the leg
  const B = 0.02, band = y => Math.max(0, Math.round(y / B)), stat = new Map(), key = (s, b) => s * 1000 + b;
  for (let i = 0; i < n; i++) { if (!side[i]) continue; const k = key(side[i], band(P.getY(i))); const t = stat.get(k) || { x0: 1, x1: -1, z0: 1, z1: -1 }; t.x0 = Math.min(t.x0, P.getX(i)); t.x1 = Math.max(t.x1, P.getX(i)); t.z0 = Math.min(t.z0, P.getZ(i)); t.z1 = Math.max(t.z1, P.getZ(i)); stat.set(k, t); }
  const KNEE = 0.85, HEM0 = -0.02, HEM = 0.05, LIFT_TOP = 0.24;       // (the bottom of the leg, up to 24 cm, folded up into the 5 cm above it)
  for (let i = 0; i < n; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (!side[i] || y > KNEE) continue;
    const t = stat.get(key(side[i], band(y))), cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2, reach = Math.max(t.x1 - t.x0, t.z1 - t.z0) / 2;
    const want = 0.125 + 0.015 * (KNEE - y) / KNEE, k = Math.min(1, want / reach), blend = smooth(KNEE, KNEE - 0.12, y);   // (eased in below the knee)
    const kk = 1 + (k - 1) * blend;
    x = cx + (x - cx) * kk; z = cz + (z - cz) * kk;
    if (y < LIFT_TOP) y = HEM + (y - HEM0) * (LIFT_TOP - HEM) / (LIFT_TOP - HEM0);
    P.setXYZ(i, x, y, z);
  }
  P.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere();
}
