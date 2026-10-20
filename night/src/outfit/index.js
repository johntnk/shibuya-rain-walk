// What the character wears on top of what VRoid made: only for 陆叁昧 (by the name in the VRM) — the white
// T-shirt and jeans; his brows too.
import { dressWhiteTee } from './whitetee.js';
import { face } from './face.js';

export function dress(av) {
  const vrm = av.vrm; if ((vrm.meta?.name || vrm.meta?.title) !== '陆叁昧') return;
  dressWhiteTee(av);
  face(av);
}
