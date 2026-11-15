import * as THREE from 'three';
import { buildWorld, CHUNK, HEIGHT } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildExit } from './exit.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');

// ---------- 렌더러 / 씬 ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const FOG = 0x1c201e;
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 4, 25);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 40);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xeaf3f5, 0x5c5848, 1.15));
const lamp = new THREE.PointLight(0xf2f8ff, 3.2, 10, 1.6);
scene.add(lamp);

// ---------- 월드 (5x5 청크 풀 재사용) ----------
const W = buildWorld();
scene.add(W.floor, W.ceil);
const R = 2;
const pool = [];
for (let i = 0; i < (2 * R + 1) ** 2; i++) { const g = W.makeChunk(); scene.add(g); pool.push(g); }
let poolCX = null, poolCZ = null;
function layoutPool(cx, cz) {
  if (cx === poolCX && cz === poolCZ) return;
  poolCX = cx; poolCZ = cz;
  let i = 0;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const g = pool[i++];
    g.position.set((cx + dx) * CHUNK, 0, (cz + dz) * CHUNK);
    g.userData.cx = cx + dx; g.userData.cz = cz + dz;
  }
}

// ---------- 플레이어 ----------
const P = { x: W.spawn.x, z: W.spawn.z, yaw: 0.25, pitch: 0, vx: 0, vz: 0, eye: 1.62, crouch: false, phase: 0, bobAmt: 0 };
const RP = 0.28;
const EYE_STAND = 1.62, EYE_CROUCH = 0.95;
const SPEED = { crouch: 1.1, walk: 2.2, run: 4.2 };

// 창고 문
let doorOpen = false, doorAngle = 0;
const D = W.door;
const DOOR_CLOSED = { x0: D.hx, x1: D.hx + D.w, z0: D.z - 0.05, z1: D.z + 0.05 };
const DOOR_OPENED = { x0: D.hx - 0.05, x1: D.hx + 0.05, z0: D.z - D.w, z1: D.z };

function pushOut(c, ox, oz) {
  const x0 = c.x0 + ox, x1 = c.x1 + ox, z0 = c.z0 + oz, z1 = c.z1 + oz;
  const nx = Math.max(x0, Math.min(P.x, x1)), nz = Math.max(z0, Math.min(P.z, z1));
  const dx = P.x - nx, dz = P.z - nz, d2 = dx * dx + dz * dz;
  if (d2 >= RP * RP) return;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2), k = (RP - d) / d;
    P.x += dx * k; P.z += dz * k;
  } else {
    const l = P.x - x0, r = x1 - P.x, t = P.z - z0, b = z1 - P.z, m = Math.min(l, r, t, b);
    if (m === l) P.x = x0 - RP; else if (m === r) P.x = x1 + RP; else if (m === t) P.z = z0 - RP; else P.z = z1 + RP;
  }
}
function resolveCollisions() {
  const ccx = Math.round(P.x / CHUNK), ccz = Math.round(P.z / CHUNK);
  for (let it = 0; it < 2; it++) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ccx + dx, cz = ccz + dz, ox = cx * CHUNK, oz = cz * CHUNK;
      if (Math.abs(P.x - ox) > CHUNK / 2 + 1 || Math.abs(P.z - oz) > CHUNK / 2 + 1) continue;
      for (const c of W.colliders) pushOut(c, ox, oz);
      pushOut(cx === 0 && cz === 0 && doorAngle > 0.6 ? DOOR_OPENED : DOOR_CLOSED, ox, oz);
    }
  }
}

// ---------- UI ----------
const msgQueue = [];
let msgBusy = false;
function say(text, dur = 4.5) { msgQueue.push([text, dur]); if (!msgBusy) nextMsg(); }
function nextMsg() {
  const m = msgQueue.shift();
  const el = $('message');
  if (!m) { msgBusy = false; return; }
  msgBusy = true;
  el.textContent = m[0]; el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextMsg, 900); }, m[1] * 1000);
}
const promptEl = $('prompt'), actBtn = $('btnAct'), crouchBtn = $('btnCrouch');
let lastPrompt = null;
function setPrompt(text) {
  if (text === lastPrompt) return;
  lastPrompt = text;
  if (!text) { promptEl.style.display = 'none'; actBtn.classList.remove('ready'); return; }
  promptEl.innerHTML = isTouch ? text : `<b>E</b>${text}`;
  promptEl.style.display = 'block';
  actBtn.classList.add('ready');
}

// ---------- 오디오 / 입력 ----------
const audio = new AudioSys();
const input = new Input(canvas, isTouch);
let started = false, paused = false;

input.onLockChange = (locked) => {
  if (!started || isTouch) return;
  paused = !locked;
  $('pause').classList.toggle('hidden', locked);
};
$('pause').addEventListener('click', () => input.lock());

$('startBtn').addEventListener('click', () => {
  audio.init();
  $('start').classList.add('hidden');
  document.body.classList.add('playing');
  started = true;
  if (!isTouch) input.lock();
  setTimeout(() => $('fade').classList.add('clear'), 300);
  setTimeout(() => say('AM 03:33. 창고 재고 정리 끝. 이제 매장으로 나가자.', 5), 1800);
  setTimeout(() => say(isTouch ? '왼쪽 화면을 끌어 이동, 오른쪽 화면을 끌어 둘러보기' : 'WASD 이동 · 마우스로 둘러보기', 4.5), 2000);
});

// ---------- 상호작용 ----------
function chunkOf(x, z) { return [Math.round(x / CHUNK), Math.round(z / CHUNK)]; }
function getFocus() {
  const [cx, cz] = chunkOf(P.x, P.z);
  const ox = cx * CHUNK, oz = cz * CHUNK;
  const tx = ox + D.hx + D.w / 2 - P.x, tz = oz + D.z - P.z;
  const dist = Math.hypot(tx, tz);
  if (dist < 2.2) {
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    if ((fx * tx + fz * tz) / dist > 0.3) {
      if (story.exit && cx === story.exit.cx && cz === story.exit.cz && tz > 0) return { text: '비상구 열기 · 퇴근', act: clearZone };
      if (cx === 0 && cz === 0) return { text: doorOpen ? '창고 문 닫기' : '창고 문 열기', act: toggleDoor };
      return { text: '창고 문', act: () => lockedDoor(ox, oz) };
    }
  }
  return null;
}
function toggleDoor() {
  doorOpen = !doorOpen;
  audio.creak(D.hx + 0.6, 1.2, D.z);
  if (doorOpen && !story.doorOpened) { story.doorOpened = true; }
}
function lockedDoor(ox, oz) {
  audio.rattle(ox + D.hx + 0.6, 1.1, oz + D.z);
  say(story.lockedTries++ === 0 ? '잠겨 있다. ...내가 나온 창고가 아니다.' : '잠겨 있다.', 3);
}

// ---------- 이야기 진행 (1구역 튜토리얼) ----------
const story = { doorOpened: false, leftStock: false, visited: new Set(['0,0']), lockedTries: 0, nextChime: 0 };
function updateStory(cx, cz, lx, lz) {
  if (story.doorOpened && !story.leftStock && cx === 0 && cz === 0 && lz < 3.6) {
    story.leftStock = true;
    say('...매장이 이렇게 넓었나?', 3.5);
    setTimeout(() => {
      audio.chime(P.x - 10, 2.4, P.z - 14, 0.7);
      say('띵동— 자동문 차임벨. 이 시간에 손님?', 4);
    }, 4500);
  }
  const key = cx + ',' + cz;
  if (!story.visited.has(key)) {
    story.visited.add(key);
    const n = story.visited.size;
    if (n === 2) say('여기... 방금 지나온 매장이랑 똑같다.', 4);
    else if (n === 4) say('진열대도, 냉장고도, 계산대도. 전부 똑같다.', 4);
    else if (n === EXIT_AFTER) spawnExit(cx, cz);
    else if (story.exit && n % 6 === 0) say('삐— 삐— 경보음이 들리는 쪽으로 가 보자.', 3.5);
  }
}

// ---------- 임시 출구 (1구역) ----------
const EXIT_AFTER = 5; // 서로 다른 매장 5곳을 지나면 출구가 생긴다
const exitObj = buildExit(W.door);
scene.add(exitObj.group);
function spawnExit(cx, cz) {
  // 바라보는 방향으로 매장 2칸 앞, 시작 매장(0,0)과 현재 매장은 피한다
  let ex = cx + Math.round(-Math.sin(P.yaw) * 2), ez = cz + Math.round(-Math.cos(P.yaw) * 2);
  if ((ex === cx && ez === cz) || (ex === 0 && ez === 0)) ex += 2;
  story.exit = { cx: ex, cz: ez, x: ex * CHUNK + exitObj.worldPos.x, z: ez * CHUNK + exitObj.worldPos.z, beepT: 1.5 };
  exitObj.group.position.set(ex * CHUNK, 0, ez * CHUNK);
  exitObj.group.visible = true;
  say('...삐— 삐— 어디선가 비상구 경보음이 울린다.', 4);
  say(isTouch ? '이어폰을 끼고 소리가 나는 방향으로 가 보자.' : '소리가 나는 방향으로 가 보자.', 4);
}
function updateExit(dt, now) {
  const e = story.exit;
  if (!e || story.cleared) return;
  exitObj.update(now / 1000);
  e.beepT -= dt;
  if (e.beepT <= 0) { audio.exitBeep(e.x, 2.4, e.z - 0.3); e.beepT = 2.2; }
  if (!e.seen && Math.hypot(P.x - e.x, P.z - e.z) < 9) { e.seen = true; say('초록색 비상구 표시등. 저기다!', 3); }
}
function clearZone() {
  if (story.cleared) return;
  story.cleared = true;
  audio.exitOpen();
  try { localStorage.setItem('ens_progress', JSON.stringify({ zone: 2, zone1ClearedAt: Date.now() })); } catch (_) {}
  setPrompt(null);
  $('fade').classList.remove('clear');
  setTimeout(() => {
    started = false;
    document.body.classList.remove('playing');
    if (document.pointerLockElement) document.exitPointerLock();
    $('clearStores').textContent = story.visited.size;
    $('clear').classList.remove('hidden');
  }, 3000);
}
$('retryBtn').addEventListener('click', () => location.reload());

// ---------- 형광등 깜빡임 ----------
let flickT = 3, flickOn = true, flickBurst = 0;
function updateFlicker(dt, cx, cz) {
  flickT -= dt;
  if (flickT > 0) return;
  if (flickBurst > 0) {
    flickOn = !flickOn; flickBurst--;
    flickT = 0.03 + Math.random() * 0.13;
    if (!flickOn) audio.tick(cx * CHUNK + W.flicker.x, HEIGHT - 0.1, cz * CHUNK + W.flicker.z);
  } else {
    flickOn = true;
    flickBurst = Math.random() < 0.5 ? 4 + ((Math.random() * 8) | 0) : 0;
    flickT = flickBurst ? 0.05 : 2 + Math.random() * 6;
  }
  W.mats.flicker.color.setHex(flickOn ? 0xf4faff : 0x3a3f42);
}

// ---------- 메인 업데이트 ----------
const fwd = new THREE.Vector3();
function update(dt) {
  const look = input.consumeLook();
  P.yaw -= look.dx;
  P.pitch = Math.max(-1.35, Math.min(1.35, P.pitch - look.dy));

  if (input.consumeCrouch()) P.crouch = !P.crouch;
  const mv = input.getMove();
  const moving = mv.x !== 0 || mv.y !== 0;
  const running = input.run && moving;
  if (running) P.crouch = false;
  crouchBtn.classList.toggle('on', P.crouch);
  const speed = running ? SPEED.run : P.crouch ? SPEED.crouch : SPEED.walk;

  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const tvx = (cy * mv.x - sy * mv.y) * speed, tvz = (-sy * mv.x - cy * mv.y) * speed;
  const a = 1 - Math.exp(-10 * dt);
  P.vx += (tvx - P.vx) * a; P.vz += (tvz - P.vz) * a;
  const ox = P.x, oz = P.z;
  P.x += P.vx * dt; P.z += P.vz * dt;
  resolveCollisions();
  const sp = Math.hypot(P.x - ox, P.z - oz) / Math.max(dt, 1e-4);

  // 시선 높이, 머리 흔들림, 발소리
  P.eye += ((P.crouch ? EYE_CROUCH : EYE_STAND) - P.eye) * (1 - Math.exp(-10 * dt));
  P.bobAmt += (Math.min(1, sp / 2) - P.bobAmt) * (1 - Math.exp(-8 * dt));
  if (sp > 0.3) {
    const prev = P.phase;
    P.phase += dt * Math.PI * (0.75 * sp + 0.3);
    if (Math.floor(P.phase / Math.PI) !== Math.floor(prev / Math.PI)) audio.footstep(running ? 1 : P.crouch ? 0.3 : 0.6);
  }
  const amp = (running ? 0.06 : P.crouch ? 0.02 : 0.035) * P.bobAmt;
  const bobY = Math.abs(Math.sin(P.phase)) * amp - amp * 0.5;
  const sway = Math.cos(P.phase) * amp * 0.4;
  camera.position.set(P.x + cy * sway, P.eye + bobY, P.z - sy * sway);
  camera.rotation.set(P.pitch, P.yaw, Math.cos(P.phase) * amp * 0.15);

  // 청크 풀, 바닥/천장, 문
  const [cx, cz] = chunkOf(P.x, P.z);
  layoutPool(cx, cz);
  W.snapPlanes(P.x, P.z);
  doorAngle += ((doorOpen ? 1.65 : 0) - doorAngle) * (1 - Math.exp(-5 * dt));
  for (const g of pool) g.userData.hinge.rotation.y = g.userData.cx === 0 && g.userData.cz === 0 ? doorAngle : 0;

  // 조명: 플레이어 머리 위 형광등 웅덩이 느낌 + 깜빡이는 등 근처에선 같이 흔들림
  updateFlicker(dt, cx, cz);
  const lx = P.x - cx * CHUNK, lz = P.z - cz * CHUNK;
  const nearFlick = Math.hypot(lx - W.flicker.x, lz - W.flicker.z) < 4.5;
  lamp.intensity = nearFlick && !flickOn ? 1.2 : 3.2;
  lamp.position.set(P.x - sy * 0.8, 2.75, P.z - cy * 0.8);

  // 오디오: 리스너 + 가장 가까운 냉장고 위치
  camera.getWorldDirection(fwd);
  audio.listener(camera.position.x, camera.position.y, camera.position.z, fwd.x, fwd.y, fwd.z);
  W.fridges.forEach((f, i) => {
    const fx = Math.round((P.x - f.x) / CHUNK) * CHUNK + f.x;
    const fz = Math.round((P.z - f.z) / CHUNK) * CHUNK + f.z;
    audio.setFridge(i, fx, 1.0, fz);
  });

  // 상호작용
  const focus = getFocus();
  setPrompt(focus ? focus.text : null);
  if (input.consumeAct() && focus) focus.act();

  updateStory(cx, cz, lx, lz);
  updateExit(dt, performance.now());

  // 가끔 먼 곳에서 울리는 차임벨 (1구역은 분위기용)
  if (story.leftStock) {
    story.nextChime -= dt;
    if (story.nextChime <= 0) {
      if (story.nextChime > -1) {
        const ang = Math.random() * Math.PI * 2;
        audio.chime(P.x + Math.cos(ang) * 22, 2.4, P.z + Math.sin(ang) * 22, 0.45);
      }
      story.nextChime = 50 + Math.random() * 60;
    }
  }
}

// 시작 화면 뒤에서도 매장이 보이도록 초기 배치
layoutPool(0, 0);
W.snapPlanes(P.x, P.z);
camera.position.set(P.x, P.eye, P.z);
camera.rotation.set(0, P.yaw, 0);
story.nextChime = 70;

// ---------- 루프 ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
const fpsEl = $('fps');
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (started && !paused) update(dt);
  renderer.render(scene, camera);
  if (DEBUG) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) {
      fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} fps\n${renderer.info.render.calls} calls\n${(renderer.info.render.triangles / 1000).toFixed(0)}k tris\n${P.x.toFixed(1)}, ${P.z.toFixed(1)}`;
      fpsAcc = 0; fpsN = 0;
    }
  }
}
requestAnimationFrame(frame);

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  $('rotate').classList.toggle('hidden', !(isTouch && innerHeight > innerWidth));
}
addEventListener('resize', onResize);
onResize();

// 디버그용 노출
if (DEBUG) window.__game = { P, W, scene, camera, renderer, audio, story, step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) update(dt); renderer.render(scene, camera); } };
