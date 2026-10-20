// His face, whatever he wears: coffee-brown brows under the silver hair (VRoid exports them near black). The
// brow texture is repainted keeping its strokes: darker where VRoid drew them darker.
import { repaint, materials } from './kit.js';

const COFFEE = [118, 82, 56];

export function face(av) {
  for (const m of materials(av.vrm)('FaceBrow')) repaint(m, (r, g, b) => {
    const l = (r + g + b) / 3 / 255, k = Math.min(1.25, 0.62 + l * 2.2);
    return [COFFEE[0] * k, COFFEE[1] * k, COFFEE[2] * k];
  });
}
