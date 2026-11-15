// 입력: PC(WASD+마우스 포인터락) / 모바일(왼쪽 가상 조이스틱, 오른쪽 드래그 시점, 버튼 3개)
export class Input {
  constructor(canvas, isTouch) {
    this.canvas = canvas;
    this.keys = new Set();
    this.ldx = 0; this.ldy = 0;
    this.joy = { x: 0, y: 0 };
    this.runTouch = false;
    this._crouch = false;
    this._act = false;
    this.locked = false;
    this.onLockChange = null;
    this.mouseSens = 0.0022;
    this.touchSens = 0.0055;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE' || e.code === 'KeyF') this._act = true;
      if (e.code === 'KeyC') this._crouch = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.ldx += e.movementX * this.mouseSens;
      this.ldy += e.movementY * this.mouseSens;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });
    if (isTouch) this.setupTouch();
  }

  lock() { try { const p = this.canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch (_) {} }

  setupTouch() {
    const $ = (id) => document.getElementById(id);
    const joyZone = $('joyZone'), base = $('joyBase'), knob = $('joyKnob'), look = $('lookZone');
    const MAX = 55, opts = { passive: false };
    let joyId = null, jx = 0, jy = 0, lookId = null, lx = 0, ly = 0;

    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (joyId !== null) return;
      const t = e.changedTouches[0];
      joyId = t.identifier; jx = t.clientX; jy = t.clientY;
      base.style.left = jx + 'px'; base.style.top = jy + 'px';
      base.classList.add('active');
      knob.style.transform = 'translate(-50%,-50%)';
    }, opts);
    joyZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        e.preventDefault();
        let dx = t.clientX - jx, dy = t.clientY - jy;
        const d = Math.hypot(dx, dy);
        if (d > MAX) { dx *= MAX / d; dy *= MAX / d; }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.joy.x = dx / MAX; this.joy.y = -dy / MAX;
      }
    }, opts);
    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = null; this.joy.x = this.joy.y = 0;
        base.classList.remove('active');
        knob.style.transform = 'translate(-50%,-50%)';
      }
    };
    joyZone.addEventListener('touchend', joyEnd);
    joyZone.addEventListener('touchcancel', joyEnd);

    look.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (lookId !== null) return;
      const t = e.changedTouches[0];
      lookId = t.identifier; lx = t.clientX; ly = t.clientY;
    }, opts);
    look.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        e.preventDefault();
        this.ldx += (t.clientX - lx) * this.touchSens;
        this.ldy += (t.clientY - ly) * this.touchSens;
        lx = t.clientX; ly = t.clientY;
      }
    }, opts);
    const lookEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
    look.addEventListener('touchend', lookEnd);
    look.addEventListener('touchcancel', lookEnd);

    const btn = (id, down, up) => {
      const el = $(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('pressed'); down(); }, opts);
      const u = (e) => { e.preventDefault(); el.classList.remove('pressed'); up?.(); };
      el.addEventListener('touchend', u, opts);
      el.addEventListener('touchcancel', u, opts);
    };
    btn('btnRun', () => (this.runTouch = true), () => (this.runTouch = false));
    btn('btnCrouch', () => (this._crouch = true));
    btn('btnAct', () => (this._act = true));
  }

  getMove() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const kl = Math.hypot(x, y);
    if (kl > 0) return { x: x / kl, y: y / kl };
    x = this.joy.x; y = this.joy.y;
    const l = Math.hypot(x, y);
    if (l < 0.12) return { x: 0, y: 0 };
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  get run() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.runTouch; }
  consumeLook() { const r = { dx: this.ldx, dy: this.ldy }; this.ldx = this.ldy = 0; return r; }
  consumeAct() { const a = this._act; this._act = false; return a; }
  consumeCrouch() { const c = this._crouch; this._crouch = false; return c; }
}
