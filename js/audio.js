// Web Audio API로 모든 소리를 직접 합성. 위치 사운드는 PannerNode(HRTF).
export class AudioSys {
  constructor() { this.ctx = null; this.ready = false; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    // iOS 잠금 해제용 무음 버퍼
    const sb = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = sb; s.connect(ctx.destination); s.start(0);
    ctx.resume();

    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.white = this.noise(2, false);
    this.brown = this.noise(5, true);
    this.ambience();
    this.ready = true;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }

  noise(sec, brown) {
    const ctx = this.ctx, n = Math.floor(sec * ctx.sampleRate);
    const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    if (brown) { const drift = d[n - 1] - d[0]; for (let i = 0; i < n; i++) d[i] -= (drift * i) / n; } // 루프 끊김 방지
    return b;
  }
  loop(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); return s; }
  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  gain(v) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
  panner(ref = 1.2, roll = 1.2) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 60;
    p.connect(this.master);
    return p;
  }
  setP(p, x, y, z, smooth = 0) {
    if (p.positionX) {
      if (smooth) {
        const t = this.ctx.currentTime;
        p.positionX.setTargetAtTime(x, t, smooth); p.positionY.setTargetAtTime(y, t, smooth); p.positionZ.setTargetAtTime(z, t, smooth);
      } else { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    } else p.setPosition(x, y, z);
  }

  ambience() {
    const M = this.master;
    // 형광등 웅웅 (120Hz 계열) + 고주파 지직거림
    const hum = this.gain(0.028); hum.connect(M);
    this.osc('sawtooth', 120).connect(this.filt('lowpass', 480)).connect(hum);
    this.osc('sine', 240).connect(this.gain(0.35)).connect(hum);
    this.loop(this.white).connect(this.filt('bandpass', 4200, 8)).connect(this.gain(0.01)).connect(M);
    // 공조기 실내 잡음
    this.loop(this.brown).connect(this.filt('lowpass', 320)).connect(this.gain(0.1)).connect(M);
    // 냉장고 컴프레서 (위치 사운드 2개)
    this.fridgeP = [0, 1].map(() => {
      const p = this.panner(1.5, 1.4);
      const g = this.gain(0.9); g.connect(p);
      this.loop(this.brown).connect(this.filt('lowpass', 170)).connect(g);
      this.osc('sine', 50).connect(this.gain(0.06)).connect(g);
      this.osc('sawtooth', 100).connect(this.filt('lowpass', 260)).connect(this.gain(0.025)).connect(g);
      this.osc('sine', 0.12 + Math.random() * 0.1).connect(this.gain(0.25)).connect(g.gain);
      return p;
    });
  }

  listener(px, py, pz, fx, fy, fz) {
    if (!this.ready) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(px, py, pz); L.setOrientation(fx, fy, fz, 0, 1, 0); }
  }

  setFridge(i, x, y, z) { if (this.ready) this.setP(this.fridgeP[i], x, y, z, 0.25); }

  // 플레이어 발소리 (vol: 쭈그리기 0.3 / 걷기 0.6 / 뛰기 1)
  footstep(vol) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.white; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    s.connect(this.filt('bandpass', 700 + Math.random() * 500, 0.9)).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.5, 0.15);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    const og = this.gain(0);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.35 * vol, t + 0.005); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.12);
  }

  click(dest, t, vol) {
    const s = this.ctx.createBufferSource(); s.buffer = this.white;
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(this.filt('highpass', 1800)).connect(g).connect(dest);
    s.start(t, Math.random(), 0.06);
  }

  // 자동문 차임벨 "띵-동"
  chime(x, y, z, vol = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02;
    const p = this.panner(3, 1.0); this.setP(p, x, y, z);
    const out = this.gain(vol * 0.5); out.connect(p);
    for (const [f, d] of [[1318.5, 0], [1046.5, 0.45]]) {
      for (const [m, a] of [[1, 1], [2.01, 0.25], [3.98, 0.08]]) {
        const o = ctx.createOscillator(); o.frequency.value = f * m;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(a, t + d + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.8 / m);
        o.connect(g).connect(out); o.start(t + d); o.stop(t + d + 2);
      }
    }
    setTimeout(() => p.disconnect(), 3500);
  }

  // 창고 문 삐걱
  creak(x, y, z) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const p = this.panner(1, 1); this.setP(p, x, y, z);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(140, t + 0.35); o.frequency.linearRampToValueAtTime(80, t + 0.8);
    const g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.1); g.gain.linearRampToValueAtTime(0.18, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 22;
    lfo.connect(this.gain(0.1)).connect(g.gain); lfo.start(t); lfo.stop(t + 1);
    o.connect(this.filt('bandpass', 1100, 6)).connect(g).connect(p); o.start(t); o.stop(t + 1);
    this.click(p, t, 0.4);
    setTimeout(() => p.disconnect(), 1500);
  }

  // 잠긴 문 덜컥
  rattle(x, y, z) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const p = this.panner(1, 1); this.setP(p, x, y, z);
    for (let i = 0; i < 4; i++) this.click(p, t + i * 0.085 + Math.random() * 0.02, 0.6);
    const o = ctx.createOscillator(); o.frequency.value = 70;
    const g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(p); o.start(t); o.stop(t + 0.4);
    setTimeout(() => p.disconnect(), 1000);
  }

  // 형광등 깜빡임 틱
  tick(x, y, z) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const p = this.panner(1.5, 1.2); this.setP(p, x, y, z);
    this.click(p, t, 0.18);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
    const g = this.gain(0);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(p); o.start(t); o.stop(t + 0.08);
    setTimeout(() => p.disconnect(), 400);
  }
}
