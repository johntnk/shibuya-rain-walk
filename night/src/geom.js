// Small plane-geometry helpers for footprints (x, z rings, counter-clockwise seen from above with z south).
// a ring's corners rounded (Chaikin), keeping its size
export function round(pts, n = 2, keep = 0.25) {
  let p = pts;
  for (let k = 0; k < n; k++) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([a[0] * (1 - keep) + b[0] * keep, a[1] * (1 - keep) + b[1] * keep], [a[0] * keep + b[0] * (1 - keep), a[1] * keep + b[1] * (1 - keep)]); } p = o; }
  return p;
}
// a ring pushed out (d > 0) or in, each corner moved along the average of its edges' normals
export function offset(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const n1 = norm2([b[1] - a[1], -(b[0] - a[0])]), n2 = norm2([c[1] - b[1], -(c[0] - b[0])]), m = norm2([n1[0] + n2[0], n1[1] + n2[1]]);
    const k = 1 / Math.max(0.3, m[0] * n2[0] + m[1] * n2[1]);
    out.push([b[0] + m[0] * d * k, b[1] + m[1] * d * k]);
  }
  return out;
}
export const norm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
// points every `step` metres round a ring, with the outward normal there
export function along(pts, step, closed = true) {
  const out = []; const n = pts.length; let carry = step / 2;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) continue;
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nn = [t[1], -t[0]];
    for (let s = carry; s < L; s += step) out.push({ x: a[0] + t[0] * s, z: a[1] + t[1] * s, nx: nn[0], nz: nn[1], tx: t[0], tz: t[1] });
    carry = (carry - L) % step; if (carry < 0) carry += step;
  }
  return out;
}
// the point of a ring nearest (x, z), and its outward normal
export function nearest(pts, x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (!L2) continue;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; const L = Math.sqrt(L2); best = { x: px, z: pz, nx: dz / L, nz: -dx / L, tx: dx / L, tz: dz / L }; }
  }
  return best;
}
export const yawOf = (nx, nz) => Math.atan2(nx, nz);
