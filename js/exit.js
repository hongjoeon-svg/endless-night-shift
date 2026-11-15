// 1구역 임시 출구: 특정 매장의 창고 문 자리에 "비상구" 문을 덮어씌운다.
import * as THREE from 'three';

function tex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildExit(door) {
  const g = new THREE.Group();
  g.visible = false;

  const doorTex = tex(128, 256, (c, w, h) => {
    c.fillStyle = '#2f6b4a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1d4a32'; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#c9d2cc'; c.fillRect(14, 120, w - 28, 10); // 패닉바
    c.fillStyle = '#f2f2ea'; c.fillRect(24, 40, 80, 44);
    c.fillStyle = '#1f8a4c'; c.textAlign = 'center';
    c.font = 'bold 18px sans-serif'; c.fillText('비상구', 64, 66);
    c.font = 'bold 10px sans-serif'; c.fillText('EMERGENCY EXIT', 64, 79);
    c.fillStyle = '#244f37'; c.fillRect(6, h - 36, w - 12, 30);
  });
  const signTex = tex(256, 96, (c, w, h) => {
    c.fillStyle = '#18c45a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    // 달리는 사람
    c.beginPath(); c.arc(46, 22, 9, 0, 7); c.fill();
    c.lineWidth = 9; c.lineCap = 'round'; c.strokeStyle = '#fff';
    c.beginPath(); c.moveTo(44, 34); c.lineTo(36, 58); c.lineTo(22, 78); c.moveTo(36, 58); c.lineTo(54, 66); c.lineTo(58, 84);
    c.moveTo(42, 40); c.lineTo(24, 46); c.moveTo(42, 40); c.lineTo(62, 50); c.stroke();
    c.font = 'bold 38px sans-serif'; c.textAlign = 'center'; c.fillText('비상구', 160, 50);
    c.font = 'bold 18px sans-serif'; c.fillText('EXIT', 160, 78);
  });
  const glowTex = tex(128, 128, (c, w, h) => {
    const r = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(60,255,140,0.55)'); r.addColorStop(1, 'rgba(60,255,140,0)');
    c.fillStyle = r; c.fillRect(0, 0, w, h);
  });

  const cx = door.hx + door.w / 2;
  const dm = new THREE.Mesh(new THREE.BoxGeometry(door.w + 0.1, 2.25, 0.06), new THREE.MeshLambertMaterial({ map: doorTex }));
  dm.position.set(cx, 1.125, door.z - 0.1);
  g.add(dm);

  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 0.06), signMat);
  sign.position.set(cx, 2.5, door.z - 0.12);
  g.add(sign);

  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), glowMat);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(cx, 0.01, door.z - 1.2);
  g.add(floorGlow);
  const wallGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), glowMat);
  wallGlow.position.set(cx, 2.3, door.z - 0.13);
  g.add(wallGlow);

  return {
    group: g,
    worldPos: { x: cx, z: door.z }, // 청크 원점 기준
    // 표시등이 가끔 가물거림
    update(t) { const v = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 2.3); signMat.color.setScalar(v); glowMat.opacity = v; },
  };
}
