// Rain on a shop's window, worked out on the glass itself (p: metres across the pane, x along, y up; H its height):
//   beads   two sizes stuck all over, each its own size, shape and how domed it sits (its contact angle) — a little
//           fuller at the foot, as water hangs
//   runners every few centimetres a column where now and then a drop has gathered enough to let go: it runs down in
//           jerks (stops, goes), wandering side to side, and behind it a trail — a thin wet line, the tiny drops it
//           leaves on it, and the beads it swept away either side; then it starts again higher up somewhere else
// Each drop is a lens, done as the freezing rain's (weather-wallpaper/ice): a cap of a sphere, the light through it
// bent as water bends it (δ = asin(1.333 sin α) − α, α the slope of its surface) — so each holds a small, upside-down
// picture of what is behind the glass, squeezed in from all round; where its side is steeper than 48.6° the light
// can't get out (it is turned back inside), and that ring shows the dark of this side instead; a spark of the light
// on its top. What is behind is the scene as last drawn (uBehind, main.js).
// The drops are drawn a little larger than life, and further off by octaves larger still (the next set, twice the
// size, takes over as the first gets too small), so from across the pavement they still read as drops.
export const GLASS_RAIN = /* glsl */`
  uniform sampler2D uBehind; uniform mat4 projectionMatrix;            // (the fragment shader isn't given the projection by three: asked for here)
  float grH(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }   // (no sine: cheap, and steady for big numbers)
  // a bead in its cell: (q.x, q.y, body, sine of its contact angle) — q its own coordinates (its edge at |q| = 1)
  vec4 grBead(vec2 p, float cell, float share, float rmin, float rmax, float seed, float fw){
    vec2 g = p / cell, id = floor(g), f = fract(g) - 0.5; float h = grH(id + seed);
    if (h > share) return vec4(0.0);
    vec2 c = (vec2(grH(id + seed + 1.3), grH(id + seed + 7.1)) - 0.5) * 0.36;
    float r = mix(rmin, rmax, pow(grH(id + seed + 3.7), 1.6));
    vec2 q = (f - c) / r; q.y *= 0.88 + 0.22 * grH(id + seed + 9.1); q.x *= 1.0 + 0.14 * clamp(q.y, -1.0, 1.0);
    float aa = clamp(fw / (r * cell) * 1.5, 0.12, 1.0), body = smoothstep(1.0, 1.0 - aa, length(q));
    return vec4(q, body, sin(radians(36.0 + 30.0 * grH(id + seed + 5.3))));
  }
  // by octaves: the set twice the size takes over (crossfading) where the first gets under a few pixels
  vec4 grBeads(vec2 p, float cell, float share, float rmin, float rmax, float seed, float fw, float fw0, float omax){
    float o = clamp(log2(max(fw, 1e-6) / fw0), 0.0, omax), o0 = floor(o), of = o - o0, s0 = exp2(o0);
    vec4 a = grBead(p, cell * s0, share, rmin, rmax, seed + o0 * 13.0, fw); a.z *= 1.0 - of;
    if (of > 0.01 && o0 < omax) { vec4 b = grBead(p, cell * s0 * 2.0, share, rmin, rmax, seed + o0 * 13.0 + 13.0, fw); b.z *= of; if (b.z > a.z) a = b; }
    return a;
  }
  // a column's runner (columns colW wide): (q.x, q.y, body, sine of its angle); swept: how much of the beads its
  // trail has wiped away here
  vec4 grRunner(vec2 p, float t, float H, float fw, float colW, out float swept){
    swept = 0.0;
    float ci = floor(p.x / colW), hc = grH(vec2(ci, 3.1)), hd = grH(vec2(ci, 8.3));
    float speed = 0.04 + 0.12 * hc, span = H + 0.6, tt = t * speed + hc * 17.0, cyc = floor(tt / span);
    vec2 hh = vec2(grH(vec2(ci, cyc * 1.71)), grH(vec2(ci, cyc + 0.5)));
    if (hh.x < 0.25) return vec4(0.0);
    // where it let go (anywhere on the upper part of the pane), how far down it has come since: in jerks — it holds,
    // then goes a few centimetres at once
    float y0 = H * (0.45 + 0.6 * hh.y);
    float stepL = 0.025 + 0.05 * hd, k = fract(tt / span) * span / stepL, fk = smoothstep(0.15, 1.0, fract(k)), y = y0 - (floor(k) + fk * fk) * stepL;
    float hs = (1.0 + 0.5 * hd) * clamp(fw / 0.002, 1.0, 3.0);             // (far off drawn bigger: still a few pixels)
    float dy = p.y - y, len = speed * (5.0 + 7.0 * hd);
    if (dy < -0.012 * hs || dy > len || p.y > y0) return vec4(0.0);      // (nowhere near it or its trail)
    float xAt = (ci + 0.5 + (fract(hh.x * 7.3) - 0.5) * 0.45) * colW + 0.0045 * sin(p.y * 9.0 + hc * 6.0 + cyc) + 0.0012 * sin(p.y * 37.0 + hd * 4.0);
    float dx = p.x - xAt;
    vec2 qh = vec2(dx / (0.004 * hs), dy / (0.0056 * hs)); qh.x *= 1.0 + 0.2 * clamp(qh.y, -1.0, 1.0);
    vec4 head = vec4(qh, smoothstep(1.0, 1.0 - clamp(fw / (0.004 * hs) * 1.5, 0.12, 1.0), length(qh)), 0.82);
    // the trail above it back to where it began, fading as it dries back into beads (some seconds): the wet line
    // (kept a pixel wide far off), the little drops it leaves on it (seen only near)
    float above = step(0.0, dy) * (1.0 - smoothstep(0.0, len, dy));
    float lw = 0.0018, aw = max(lw, fw * 0.7);
    vec4 line = vec4(dx / aw, 0.0, smoothstep(aw, aw * 0.25, abs(dx)) * pow(lw / aw, 0.3) * above * 0.7, 0.55);
    float kk = dy / 0.016, hk = grH(vec2(ci * 3.1 + cyc, floor(kk))), rd = 0.0013 + 0.001 * hk;
    vec2 qd = vec2(dx / rd, (fract(kk) - 0.5) * 0.016 / rd);
    vec4 dt = vec4(qd, step(0.5, hk) * step(1.0, kk) * above * (1.0 - smoothstep(0.0015, 0.005, fw)) * smoothstep(1.0, 0.55, length(qd)), 0.6);
    swept = (1.0 - smoothstep(0.005, 0.008, abs(dx))) * above;
    vec4 r = head; if (dt.z > r.z) r = dt; if (line.z > r.z) r = line;
    return r;
  }
  // The drops over what is behind the glass: how much of the pixel is taken (a) and what is put there (rgb) —
  // final = under * (1 - a) + rgb (premultiplied). wp: the point on the glass (world), T: the glass's x-axis (world),
  // fw: how big a pixel is on the glass (m), lit: the light on this side, side: what the ring of a steep-sided drop
  // shows (the dark of this side).
  vec4 rainOnGlass(vec2 p, float H, float t, float fw, vec3 wp, vec3 T, vec3 lit, vec3 side){
    if (fw > 0.08) return vec4(0.0);                                       // (too far off to tell)
    float ka = 1.0 - smoothstep(0.012, 0.02, fw), kb = 1.0 - smoothstep(0.028, 0.05, fw);
    float swept; vec4 d = grRunner(p, t, H, fw, 0.034, swept);
    vec4 a = ka > 0.0 ? grBeads(p, 0.012, 0.5, 0.15, 0.36, 0.0, fw, 0.0016, 2.0) : vec4(0.0); a.z *= ka * (1.0 - swept);
    vec4 b = kb > 0.0 ? grBeads(p + 0.37, 0.03, 0.25, 0.14, 0.3, 5.0, fw, 0.0032, 2.0) : vec4(0.0); b.z *= kb * (1.0 - swept);
    if (a.z > d.z) d = a; if (b.z > d.z) d = b;
    vec3 V = normalize(wp - cameraPosition);
    vec4 here = projectionMatrix * viewMatrix * vec4(wp + V * 4.0, 1.0);
    vec2 uv0 = clamp(here.xy / here.w * 0.5 + 0.5, 0.001, 0.999);
    // far off, what can't be drawn as drops is the glass a little misted, in patches (vnoise from GLSL_COMMON)
    float mist = (1.0 - ka) * 0.12 + (1.0 - kb) * 0.1;
    if (mist > 0.0) mist *= (0.35 + 0.8 * vnoise(p / 0.08) + 0.45 * vnoise(p / 0.025 + 3.0)) * (1.0 - smoothstep(0.05, 0.08, fw));
    vec3 add = (texture2D(uBehind, uv0).rgb * 0.25 + lit * 0.12) * mist; float take = mist * 0.3;
    if (d.z > 0.003) {
      // the lens: the slope at this point of a cap that meets the glass at its contact angle; the bend out of the
      // water; what lies that way behind the glass (4 m on, turned the other way: the picture is upside down)
      float r = length(d.xy), sa = clamp(r * d.w, 0.0, 0.999), e = 1.333 * sa;
      float tir = smoothstep(0.96, 1.0, e);
      float dl = asin(min(e, 0.999)) - asin(sa);
      vec2 dir = r > 1e-4 ? d.xy / r : vec2(0.0);
      vec3 W = -(T * dir.x + vec3(0.0, 1.0, 0.0) * dir.y) * tan(dl) * 4.0;
      vec4 c = projectionMatrix * viewMatrix * vec4(wp + V * 4.0 + W, 1.0);
      vec2 uv = clamp(c.xy / max(c.w, 1e-3) * 0.5 + 0.5, 0.001, 0.999);
      vec3 img = texture2D(uBehind, uv).rgb * 0.92;
      vec2 s = d.xy - vec2(-0.32, 0.4); float spark = exp(-dot(s, s) * 26.0) * step(r, 1.0);
      vec3 drop = mix(img, side, tir) + lit * 0.05 + (lit + 0.2) * 1.4 * spark;
      add = mix(add, drop, d.z); take = mix(take, 1.0, d.z);
    }
    return vec4(add, min(take, 1.0));
  }`;
