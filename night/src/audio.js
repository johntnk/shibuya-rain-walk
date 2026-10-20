// The sound of the Scramble on a wet night, made here (nothing recorded): the rain — a hiss over everything, and
// on your umbrella its own close patter; the murmur of the crowd, fuller where it is thick; tyres on the wet road
// as the cars go by; the low hum of the city; the music leaking from the big screens; your steps in the wet. And
// when the walkers' lights turn, the crossing's own birdsong — the two-note chirps Japanese crossings sing so
// that the blind know when to go, from the signal heads themselves.
// Starts only when you press start (a click), never by itself.
import * as THREE from 'three';

export class CityAudio {
  constructor() { this.ctx = null; this.muted = false; }
  start({ signals = [], screens = [] } = {}) {
    if (this.ctx) return;
    const C = this.ctx = new AudioContext();
    this.master = C.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(C.destination);
    const noise = this.noiseBuffer(4);
    const loop = (filter, gain, q = 0.7, type = 'bandpass', f = 1000) => {
      const s = C.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4;
      const b = C.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q;
      const g = C.createGain(); g.gain.value = gain; s.connect(b); b.connect(g); g.connect(this.master); s.start(0, Math.random() * 3);
      return { s, b, g };
    };
    // the rain's hiss, two bands; the hum of the city under everything
    this.rainHi = loop(null, 0.0, 0.5, 'highpass', 3500); this.rainMid = loop(null, 0.0, 0.6, 'bandpass', 1400);
    this.hum = loop(null, 0.06, 0.8, 'lowpass', 160);
    // the crowd: voices are noise shaped into a murmur by a few slowly wandering formants
    this.crowd = [600, 950, 1500, 2300].map(f => { const l = loop(null, 0.0, 3.5, 'bandpass', f); l.f0 = f; return l; });
    // tyres on wet road
    this.tyres = loop(null, 0.0, 0.7, 'bandpass', 700);
    // the screens' music, faint, from where they are
    this.music = screens.slice(0, 2).map((s, i) => this.musicFrom(s, i));
    this.signals = signals.map(p => this.panner(p));
    this.chirpT = 0; this.stepT = 0; this.umbT = 0;
  }
  noiseBuffer(sec) {
    const C = this.ctx, b = C.createBuffer(1, C.sampleRate * sec, C.sampleRate), d = b.getChannelData(0); let p = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; p = 0.97 * p + 0.03 * w; d[i] = w * 0.6 + p * 2.0; }   // (a little weight in the low end)
    return b;
  }
  panner(p) {
    const C = this.ctx, pn = C.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 4; pn.rolloffFactor = 1.2;
    pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; pn.connect(this.master); return pn;
  }
  // a little loop of chords and a beat, as a screen's advert plays it, out of a speaker by the screen
  musicFrom(s, k) {
    const C = this.ctx, out = this.panner({ x: s.x, y: s.y, z: s.z }); out.refDistance = 12;
    const g = C.createGain(); g.gain.value = 0.05; g.connect(out);
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(g);
    const chords = k ? [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] : [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]];
    const bpm = k ? 104 : 120, beat = 60 / bpm; let t0 = C.currentTime + 0.2 + k * 0.37;
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const sched = () => {
      while (t0 < C.currentTime + 2) {
        for (let bar = 0; bar < 4; bar++) {
          const ch = chords[bar % chords.length];
          for (const m of ch) { const o = C.createOscillator(), e = C.createGain(); o.type = 'triangle'; o.frequency.value = hz(m); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.18, t0 + 0.03); e.gain.exponentialRampToValueAtTime(0.01, t0 + beat * 3.8); o.connect(e); e.connect(lp); o.start(t0); o.stop(t0 + beat * 4); }
          for (let q = 0; q < 4; q++) { const tt = t0 + q * beat, o = C.createOscillator(), e = C.createGain(); o.frequency.setValueAtTime(110, tt); o.frequency.exponentialRampToValueAtTime(40, tt + 0.12); e.gain.setValueAtTime(0.5, tt); e.gain.exponentialRampToValueAtTime(0.001, tt + 0.16); o.connect(e); e.connect(lp); o.start(tt); o.stop(tt + 0.2); }
          t0 += beat * 4;
        }
      }
    };
    sched(); return { sched };
  }
  // the crossing's chirp: a falling whistle, twice ("piyo, piyo"), or the cuckoo's two notes for the other way
  chirp(pn, cuckoo) {
    const C = this.ctx, t = C.currentTime;
    const note = (t0, f0, f1, d) => { const o = C.createOscillator(), e = C.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.22, t0 + 0.01); e.gain.exponentialRampToValueAtTime(0.001, t0 + d); o.connect(e); e.connect(pn); o.start(t0); o.stop(t0 + d + 0.02); };
    if (cuckoo) { note(t, 1100, 1060, 0.18); note(t + 0.26, 880, 850, 0.26); }
    else { note(t, 2900, 2000, 0.09); note(t + 0.14, 2900, 2000, 0.09); }
  }
  // a step in the wet: a soft slap and a little splash
  step(k = 1) {
    const C = this.ctx, t = C.currentTime, s = C.createBufferSource(); s.buffer = this.noiseBuffer(0.2);
    const b = C.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 900 + Math.random() * 500; b.Q.value = 1.2;
    const e = C.createGain(); e.gain.setValueAtTime(0.0, t); e.gain.linearRampToValueAtTime(0.16 * k, t + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(b); b.connect(e); e.connect(this.master); s.start(t); s.stop(t + 0.2);
  }
  // rain on your umbrella: close ticks on the vinyl
  tick() {
    const C = this.ctx, t = C.currentTime, o = C.createBufferSource(); o.buffer = this._tick || (this._tick = this.noiseBuffer(0.05));
    const b = C.createBiquadFilter(); b.type = 'highpass'; b.frequency.value = 2500 + Math.random() * 3000;
    const e = C.createGain(); e.gain.setValueAtTime(0.05 + Math.random() * 0.06, t); e.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
    o.connect(b); b.connect(e); e.connect(this.master); o.start(t); o.stop(t + 0.05);
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1); }
  // each frame: where you hear from, how much rain, how many people and cars near, the signals, your steps
  update(dt, { camera, rain, umbrella, people, cars, walkOn, walked, stepLen }) {
    if (!this.ctx) return;
    const C = this.ctx, L = C.listener, p = camera.position, f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    const k = Math.min(1, dt * 2);
    const set = (g, v) => g.gain.setTargetAtTime(v, C.currentTime, 0.3);
    set(this.rainHi.g, 0.09 * rain); set(this.rainMid.g, 0.06 * rain);
    const crowdK = Math.min(1, people / 40);
    this.crowd.forEach((c, i) => { set(c.g, 0.035 * crowdK * (0.7 + 0.3 * Math.sin(C.currentTime * (0.7 + i * 0.31) + i))); c.b.frequency.setTargetAtTime(c.f0 * (0.85 + 0.3 * Math.random()), C.currentTime, 0.15); });
    set(this.tyres.g, 0.05 * Math.min(1, cars / 6) * (0.4 + 0.6 * rain));
    this.music.forEach(m => m.sched());
    // the birdsong while the walkers' lights are on
    this.chirpT -= dt;
    if (walkOn && this.chirpT <= 0) { this.chirpT = 1.25; this.signals.forEach((pn, i) => this.chirp(pn, i % 2 === 1)); }
    // your steps, and the rain on your umbrella
    if (walked > 0) { this.stepT += walked; if (this.stepT > stepLen) { this.stepT = 0; this.step(0.7 + 0.3 * rain); } }
    if (umbrella > 0.5 && rain > 0.3) { this.umbT -= dt; while (this.umbT < 0) { this.umbT += 0.025 + Math.random() * 0.08 / rain; this.tick(); } }
  }
}
