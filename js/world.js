// 매장 모듈: 한 칸(16m x 16m)짜리 편의점을 템플릿으로 만들고,
// 인스턴싱으로 같은 매장을 사방에 복제한다. (청크당 드로우콜 ~7개)
import * as THREE from 'three';

export const CHUNK = 16;
export const HEIGHT = 3;
const HALF = CHUNK / 2;
const T = 0.1; // 벽 반두께

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAL = [0xd62828, 0xf77f00, 0xfcbf49, 0x2a9d8f, 0x264653, 0xe76f51, 0x8ac926, 0x1982c4, 0x6a4c93,
  0xff595e, 0xffca3a, 0xf1faee, 0xe9c46a, 0x3a86ff, 0xff006e, 0x8338ec, 0x06d6a0, 0x118ab2, 0x2b2d42, 0xffffff];
const PAL_CSS = PAL.map((c) => '#' + c.toString(16).padStart(6, '0'));

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function makeTextures() {
  const r = mulberry32(1234);
  const floor = canvasTex(256, 256, (g) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 220 + ((r() * 10) | 0);
      g.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
      g.fillRect(i * 64, j * 64, 64, 64);
    }
    for (let k = 0; k < 900; k++) {
      g.fillStyle = `rgba(60,55,45,${r() * 0.09})`;
      g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
    }
    g.fillStyle = '#8e8a80';
    for (let i = 0; i < 4; i++) { g.fillRect(i * 64, 0, 2, 256); g.fillRect(0, i * 64, 256, 2); }
  }, true);

  const ceil = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d5d4ca'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(90,88,80,${r() * 0.25})`; g.fillRect(r() * 256, r() * 256, 1, 1); }
    g.fillStyle = 'rgba(150,120,60,0.10)'; g.beginPath(); g.arc(186, 62, 26, 0, 7); g.fill();
    g.fillStyle = '#97958c';
    for (let i = 0; i < 2; i++) { g.fillRect(i * 128, 0, 3, 256); g.fillRect(0, i * 128, 256, 3); }
  }, true);

  const wall = canvasTex(16, 256, (g, w, h) => {
    const y = (m) => h - (m / HEIGHT) * h;
    g.fillStyle = '#e3dfcf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#16806f'; g.fillRect(0, y(1.32), w, y(1.08) - y(1.32));
    g.fillStyle = '#e8893a'; g.fillRect(0, y(1.08), w, y(1.03) - y(1.08));
    const grd = g.createLinearGradient(0, y(0.7), 0, h);
    grd.addColorStop(0, 'rgba(80,70,50,0)'); grd.addColorStop(1, 'rgba(80,70,50,0.2)');
    g.fillStyle = grd; g.fillRect(0, y(0.7), w, h - y(0.7));
    g.fillStyle = '#3f4447'; g.fillRect(0, y(0.12), w, h - y(0.12));
  });

  const product = canvasTex(32, 32, (g) => {
    g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ffffff'; g.fillRect(3, 9, 26, 11);
    g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 32, 4);
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 26, 32, 6);
  });

  const fridge = canvasTex(512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#eefafd'); grd.addColorStop(1, '#93b6c2');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (const sy of [62, 124, 186, 248]) {
      let x = 6;
      while (x < w - 10) {
        const bw = 8 + r() * 8, bh = 24 + r() * 26, col = PAL_CSS[(r() * PAL_CSS.length) | 0], n = 2 + ((r() * 4) | 0);
        for (let k = 0; k < n && x < w - 10; k++) {
          g.fillStyle = col; g.fillRect(x, sy - bh, bw, bh);
          g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 1, sy - bh + 3, 2, bh - 6);
          g.fillStyle = '#222'; g.fillRect(x + bw * 0.3, sy - bh - 4, bw * 0.4, 4);
          x += bw + 2;
        }
        x += 3;
      }
      g.fillStyle = '#9aa4a8'; g.fillRect(0, sy, w, 4);
    }
    g.fillStyle = 'rgba(255,255,255,.13)';
    for (let i = 0; i < 5; i++) {
      const x0 = (i * w) / 5 + 18;
      g.beginPath(); g.moveTo(x0, h); g.lineTo(x0 + 26, h); g.lineTo(x0 + 66, 0); g.lineTo(x0 + 40, 0); g.fill();
    }
    g.fillStyle = '#2f3538';
    for (let i = 0; i <= 5; i++) g.fillRect((i * w) / 5 - 3, 0, 6, h);
    g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
    g.fillStyle = '#c9d0d3';
    for (let i = 0; i < 5; i++) g.fillRect(i * (w / 5) + w / 5 - 14, 70, 4, 90);
  });

  const door = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#76838b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#525d63'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#f1f1ea'; g.fillRect(22, 50, 84, 42);
    g.fillStyle = '#b8322a'; g.fillRect(22, 50, 84, 8);
    g.fillStyle = '#222'; g.textAlign = 'center';
    g.font = 'bold 15px sans-serif'; g.fillText('직원 전용', 64, 77);
    g.font = '9px sans-serif'; g.fillText('STAFF ONLY', 64, 88);
    g.fillStyle = '#d5dadc'; g.fillRect(100, 128, 8, 26);
    g.fillStyle = '#596469'; g.fillRect(6, h - 36, w - 12, 30);
  });

  return { floor, ceil, wall, product, fridge, door };
}

export function buildWorld() {
  const tex = makeTextures();
  const mats = {
    wall: new THREE.MeshLambertMaterial({ map: tex.wall }),
    plain: new THREE.MeshLambertMaterial({ color: 0xe3dfcf }),
    fixture: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    product: new THREE.MeshLambertMaterial({ map: tex.product }),
    fridge: new THREE.MeshBasicMaterial({ map: tex.fridge }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    door: new THREE.MeshLambertMaterial({ map: tex.door }),
    flicker: new THREE.MeshBasicMaterial({ color: 0xf4faff }),
  };

  const cats = {};
  const colliders = [];
  const box = (cat, x0, x1, y0, y1, z0, z1, color = 0xffffff, collide = false) => {
    (cats[cat] ||= []).push([x0, x1, y0, y1, z0, z1, color]);
    if (collide) colliders.push({ x0, x1, z0, z1 });
  };
  const r = mulberry32(3333);

  // ---- 진열대(곤돌라) ----
  // axis 'x': 길이 방향이 x. 'z': 길이 방향이 z. sides: [+1,-1] 양면 / [+1] 또는 [-1] 단면(앞쪽 방향)
  function gondola(axis, cu, cw, len, depth, h, levels, sides) {
    const B = (cat, u0, u1, y0, y1, w0, w1, c) =>
      axis === 'x' ? box(cat, u0, u1, y0, y1, w0, w1, c) : box(cat, w0, w1, y0, y1, u0, u1, c);
    const u0 = cu - len / 2, u1 = cu + len / 2, w0 = cw - depth / 2, w1 = cw + depth / 2;
    colliders.push(axis === 'x' ? { x0: u0, x1: u1, z0: w0, z1: w1 } : { x0: w0, x1: w1, z0: u0, z1: u1 });
    let regions;
    if (sides.length === 2) {
      B('fixture', u0, u1, 0, h, cw - 0.03, cw + 0.03, 0xbfc4c7);
      regions = [[1, cw + 0.03, w1], [-1, w0, cw - 0.03]];
    } else if (sides[0] > 0) {
      B('fixture', u0, u1, 0, h, w0, w0 + 0.05, 0xbfc4c7);
      regions = [[1, w0 + 0.05, w1]];
    } else {
      B('fixture', u0, u1, 0, h, w1 - 0.05, w1, 0xbfc4c7);
      regions = [[-1, w0, w1 - 0.05]];
    }
    B('fixture', u0, u1, 0, levels[0], w0 + 0.02, w1 - 0.02, 0x596066);
    B('fixture', u0, u0 + 0.04, 0, h, w0, w1, 0xaeb3b6);
    B('fixture', u1 - 0.04, u1, 0, h, w0, w1, 0xaeb3b6);
    for (const [s, a, c] of regions) {
      const front = s > 0 ? c : a;
      levels.forEach((y, li) => {
        B('fixture', u0 + 0.04, u1 - 0.04, y - 0.03, y, a, c, 0xd7dadb);
        B('fixture', u0 + 0.04, u1 - 0.04, y - 0.065, y, s > 0 ? front - 0.012 : front, s > 0 ? front : front + 0.012, 0xf3f1e6);
        const maxH = li < levels.length - 1 ? levels[li + 1] - y - 0.06 : 0.32;
        let u = u0 + 0.07;
        while (u < u1 - 0.1) {
          if (r() < 0.04) { u += 0.15 + r() * 0.2; continue; }
          const pw = 0.08 + r() * 0.16, ph = Math.min(maxH, 0.1 + r() * 0.26), pd = Math.min(c - a - 0.04, 0.16 + r() * 0.2);
          const col = PAL[(r() * PAL.length) | 0], n = 1 + ((r() * 4) | 0);
          for (let k = 0; k < n && u + pw < u1 - 0.06; k++) {
            const f0 = s > 0 ? front - 0.015 - pd : front + 0.015;
            B('product', u, u + pw, y, y + ph, f0, f0 + pd, col);
            u += pw + 0.008;
          }
          u += 0.02;
        }
      });
    }
  }

  // ---- 외벽: 각 청크는 북(-z)·서(-x) 벽만 만든다 → 이웃 청크와 겹치지 않음. 가운데 6m 통로 ----
  box('wall', -HALF - T, -3, 0, HEIGHT, -HALF - T, -HALF + T, 0xffffff, true);
  box('wall', 3, HALF + T, 0, HEIGHT, -HALF - T, -HALF + T, 0xffffff, true);
  box('plain', -3, 3, 2.4, HEIGHT, -HALF - T, -HALF + T);
  box('wall', -HALF - T, -HALF + T, 0, HEIGHT, -HALF - T, -3, 0xffffff, true);
  box('wall', -HALF - T, -HALF + T, 0, HEIGHT, 3, HALF + T, 0xffffff, true);
  box('plain', -HALF - T, -HALF + T, 2.4, HEIGHT, -3, 3);

  // ---- 음료 냉장고 (북쪽 벽) ----
  const fridges = [];
  for (const [x0, x1] of [[-7.8, -3.2], [3.2, 7.8]]) {
    box('fixture', x0, x1, 0, 2.2, -7.9, -7.1, 0xe3e7e8, true);
    box('fridge', x0 + 0.05, x1 - 0.05, 0.22, 1.98, -7.1, -7.06);
    box('glow', x0 + 0.08, x1 - 0.08, 2.03, 2.15, -7.1, -7.07, 0x9fdcff);
    box('fixture', x0 + 0.05, x1 - 0.05, 0.03, 0.2, -7.1, -7.07, 0x2b3033);
    fridges.push({ x: (x0 + x1) / 2, z: -7.4 });
  }

  // ---- 진열대 ----
  for (const z of [-4.2, -1.2, 1.8]) gondola('x', -2, z, 8, 0.9, 1.62, [0.14, 0.56, 0.98, 1.4], [1, -1]);
  const wallLv = [0.12, 0.5, 0.88, 1.26, 1.64];
  gondola('z', -5.1, 7.45, 3.6, 0.7, 1.85, wallLv, [-1]);
  gondola('z', -5.1, -7.45, 3.6, 0.7, 1.85, wallLv, [1]);
  gondola('z', 5.45, -7.45, 4.3, 0.7, 1.85, wallLv, [1]);

  // ---- 아이스크림 냉동고 ----
  box('fixture', 3.6, 5.6, 0, 0.82, -1.7, -0.7, 0xeef1f2, true);
  box('glow', 3.68, 5.52, 0.82, 0.86, -1.62, -0.78, 0xcdeefa);

  // ---- 계산대 ----
  box('fixture', 0.2, 3.2, 0, 0.95, 4.6, 5.3, 0x6e5c49, true);
  box('fixture', 0.15, 3.25, 0.95, 1.0, 4.55, 5.35, 0xd8d2c4);
  box('fixture', 1.0, 1.45, 1.0, 1.3, 4.8, 5.1, 0x26292c);
  box('glow', 1.05, 1.4, 1.05, 1.27, 5.1, 5.112, 0x78d8c0);
  box('fixture', 2.2, 2.5, 1.0, 1.12, 4.75, 5.05, 0x3a3d40);
  gondola('x', 2.0, 7.5, 3.4, 0.7, 2.0, [0.9, 1.25, 1.6], [-1]);

  // ---- 창고 (남동쪽 모서리) ----
  const door = { hx: 5.0, w: 1.2, z: 4.0 };
  box('wall', 3.92, 4.08, 0, HEIGHT, 3.92, HALF + T, 0xffffff, true);
  box('wall', 4.08, door.hx, 0, HEIGHT, 3.92, 4.08, 0xffffff, true);
  box('wall', door.hx + door.w, HALF + T, 0, HEIGHT, 3.92, 4.08, 0xffffff, true);
  box('plain', door.hx, door.hx + door.w, 2.2, HEIGHT, 3.92, 4.08);
  for (const z of [4.4, 7.6]) for (const x of [7.3, 7.82]) box('fixture', x - 0.03, x + 0.03, 0, 2.0, z - 0.03, z + 0.03, 0x4b5257);
  for (const y of [0.1, 0.8, 1.5, 1.98]) box('fixture', 7.27, 7.85, y, y + 0.03, 4.37, 7.63, 0x8c9399);
  colliders.push({ x0: 7.27, x1: 7.85, z0: 4.37, z1: 7.63 });
  for (const y of [0.13, 0.83, 1.53]) {
    let z = 4.45;
    while (z < 7.2) {
      const d = 0.3 + r() * 0.35, hh = 0.25 + r() * 0.35;
      const tan = [0xa47b4a, 0xb38a57, 0x9c7444, 0xc09a66][(r() * 4) | 0];
      box('fixture', 7.32, 7.32 + 0.3 + r() * 0.2, y, y + hh, z, z + d, tan);
      z += d + 0.05 + r() * 0.1;
    }
  }
  box('fixture', 4.5, 5.2, 0, 0.5, 7.0, 7.7, 0xa47b4a, true);
  box('fixture', 4.55, 5.15, 0.5, 0.95, 7.05, 7.65, 0xb38a57);
  box('fixture', 4.3, 4.9, 0, 0.45, 6.1, 6.7, 0x9c7444, true);
  box('glow', 5.4, 6.6, HEIGHT - 0.04, HEIGHT - 0.01, 5.9, 6.1, 0xfff1d6);

  // ---- 천장 형광등 ----
  const flicker = { x: -2, z: 0 };
  const lights = [];
  for (const x of [-6, -2, 2]) for (const z of [-6, -3, 0, 3]) lights.push([x, z]);
  for (const z of [-6, -3, 0]) lights.push([6, z]);
  for (const [x, z] of lights) {
    box('fixture', x - 0.85, x + 0.85, HEIGHT - 0.06, HEIGHT, z - 0.16, z + 0.16, 0xb9bec0);
    if (x === flicker.x && z === flicker.z) continue;
    box('glow', x - 0.8, x + 0.8, HEIGHT - 0.075, HEIGHT - 0.055, z - 0.11, z + 0.11, 0xf4faff);
  }

  // ---- 템플릿 인스턴스 메시 ----
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const parts = [];
  for (const [cat, list] of Object.entries(cats)) {
    const m = new THREE.InstancedMesh(geo, mats[cat], list.length);
    const useColor = cat === 'fixture' || cat === 'product' || cat === 'glow';
    list.forEach((e, i) => {
      const [x0, x1, y0, y1, z0, z1, c] = e;
      dummy.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      dummy.scale.set(Math.max(x1 - x0, 1e-3), Math.max(y1 - y0, 1e-3), Math.max(z1 - z0, 1e-3));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (useColor) m.setColorAt(i, col.setHex(c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    parts.push(m);
  }
  const doorGeo = new THREE.BoxGeometry(door.w, 2.2, 0.05);

  // 청크 하나 = 템플릿 버퍼를 공유하는 인스턴스 메시 묶음 (메모리 거의 0)
  function makeChunk() {
    const g = new THREE.Group();
    for (const p of parts) {
      const m = new THREE.InstancedMesh(geo, p.material, p.count);
      m.instanceMatrix = p.instanceMatrix;
      m.instanceColor = p.instanceColor;
      m.boundingSphere = p.boundingSphere;
      m.matrixAutoUpdate = false;
      g.add(m);
    }
    const fl = new THREE.Mesh(geo, mats.flicker);
    fl.position.set(flicker.x, HEIGHT - 0.065, flicker.z);
    fl.scale.set(1.6, 0.02, 0.22);
    fl.updateMatrix(); fl.matrixAutoUpdate = false;
    g.add(fl);
    const hinge = new THREE.Group();
    hinge.position.set(door.hx, 0, door.z);
    const dm = new THREE.Mesh(doorGeo, mats.door);
    dm.position.set(door.w / 2, 1.1, 0);
    hinge.add(dm);
    g.add(hinge);
    g.userData.hinge = hinge;
    return g;
  }

  // 바닥/천장: 플레이어를 따라다니는 큰 판 1장씩 (타일 주기에 맞춰 스냅)
  tex.floor.repeat.set(48, 48);
  tex.ceil.repeat.set(80, 80);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), new THREE.MeshLambertMaterial({ map: tex.floor }));
  floor.rotation.x = -Math.PI / 2;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), new THREE.MeshBasicMaterial({ map: tex.ceil, color: 0x8a8984 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = HEIGHT;
  function snapPlanes(px, pz) {
    floor.position.x = Math.round(px / 2) * 2; floor.position.z = Math.round(pz / 2) * 2;
    ceil.position.x = Math.round(px / 1.2) * 1.2; ceil.position.z = Math.round(pz / 1.2) * 1.2;
  }

  return {
    makeChunk, colliders, floor, ceil, snapPlanes, mats,
    door, flicker, fridges,
    spawn: { x: 6.2, z: 6.0 },
    stockroom: { x0: 4, x1: 8, z0: 4, z1: 8 },
  };
}
