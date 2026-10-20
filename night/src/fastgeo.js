// Faster moving and turning of geometry. Building a room calls BufferGeometry's applyMatrix4/translate tens of
// thousands of times (every chair leg, every book is made at the origin and moved into place), and three.js does
// each vertex through Vector3 getters and setters. Here the same arithmetic runs straight over the arrays when the
// attributes are plain (not interleaved, not normalized) — the result is the same; anything else goes the old way.
// Imported once, first thing (main.js): it changes BufferGeometry for everyone. Rooms build about a third faster.
import * as THREE from 'three';

const P = THREE.BufferGeometry.prototype, apply0 = P.applyMatrix4, translate0 = P.translate;
const _n = new THREE.Matrix3();
const plain = a => a && !a.isInterleavedBufferAttribute && !a.normalized && a.itemSize === 3 && a.array instanceof Float32Array;

P.applyMatrix4 = function (m) {
  const pos = this.attributes.position, nrm = this.attributes.normal;
  if (!plain(pos) || (nrm && !plain(nrm)) || this.attributes.tangent) return apply0.call(this, m);
  const e = m.elements, a = pos.array, n = pos.count * 3, persp = e[3] !== 0 || e[7] !== 0 || e[11] !== 0 || e[15] !== 1;
  for (let i = 0; i < n; i += 3) {
    const x = a[i], y = a[i + 1], z = a[i + 2], w = persp ? 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]) : 1;
    a[i] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w; a[i + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w; a[i + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
  }
  pos.needsUpdate = true;
  if (nrm) {
    const q = _n.getNormalMatrix(m).elements, b = nrm.array, k = nrm.count * 3;
    for (let i = 0; i < k; i += 3) {
      const x = b[i], y = b[i + 1], z = b[i + 2];
      let u = q[0] * x + q[3] * y + q[6] * z, v = q[1] * x + q[4] * y + q[7] * z, t = q[2] * x + q[5] * y + q[8] * z;
      const l = Math.sqrt(u * u + v * v + t * t) || 1; b[i] = u / l; b[i + 1] = v / l; b[i + 2] = t / l;
    }
    nrm.needsUpdate = true;
  }
  if (this.boundingBox !== null) this.computeBoundingBox();
  if (this.boundingSphere !== null) this.computeBoundingSphere();
  return this;
};
P.translate = function (x, y, z) {
  const pos = this.attributes.position;
  if (!plain(pos)) return translate0.call(this, x, y, z);
  const a = pos.array, n = pos.count * 3;
  for (let i = 0; i < n; i += 3) { a[i] += x; a[i + 1] += y; a[i + 2] += z; }
  pos.needsUpdate = true;
  if (this.boundingBox !== null) this.computeBoundingBox();
  if (this.boundingSphere !== null) this.computeBoundingSphere();
  return this;
};
