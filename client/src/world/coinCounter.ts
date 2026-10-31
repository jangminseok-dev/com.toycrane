import * as THREE from 'three';
import { COUNTERS } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { bakeByMaterial, fadeMaterials, materialCloner } from './bake';
import { COUNTER_SIGN } from './copy';
import { signTex } from './signs';
import { canvasTex, part, toon } from './toon';

// 작은 코인 교환소 (설계 2026-10-31 교환소 개편 §3.1·§4.5): 장애물 상자(폭 1.3m·깊이 0.7m)만 한 부스 — 흰 몸통, 빨간 카운터,
// 황동 창살(가운데 창구는 짧게), 분홍 뒷판, 지붕 간판 '코인 교환소', 창구 앞 발자국 한 쌍(정해진 줄 자리는 없음).
// 4곳을 재질별로 한 덩어리로 합쳐 그리기 호출을 늘리지 않는다 — 내 캐릭터를 가리면 4곳이 함께 흐려진다
const BODY = 0xf8f3fb, W = 1.3, D = 0.7;
// 4곳이 함께 쓰는 재질 (부스마다 새로 만들면 합칠 때 재질 수만큼 그리기 호출이 는다)
let shared: { stripe: THREE.Material; sign: THREE.Material } | null = null;

function booth(): THREE.Group {
  const b = new THREE.Group(); // 앞 = 로컬 +z
  const brass = toon(0xffc94d), body = toon(BODY);
  shared ??= { stripe: new THREE.MeshBasicMaterial({ color: 0xff6fb5 }), sign: new THREE.MeshBasicMaterial({ map: signTex(COUNTER_SIGN, 0xffb81f) }) };
  b.add(part(new THREE.BoxGeometry(W, 0.95, 0.5), body, [0, 0.475, 0.05], [1, 1, 1], [0, 0, 0], 1.02));
  b.add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.03, 0.02), shared.stripe).translateY(0.08).translateZ(0.305));
  b.add(part(new THREE.BoxGeometry(W + 0.06, 0.05, 0.6), toon(0xe8384f), [0, 0.975, 0.05], [1, 1, 1], [0, 0, 0], 0));
  b.add(part(new THREE.BoxGeometry(W, 1.25, 0.06), toon(0xffe6f0), [0, 1.6, -0.32], [1, 1, 1], [0, 0, 0], 0));
  for (const s of [-1, 1]) b.add(part(new THREE.BoxGeometry(0.06, 1.25, 0.66), body, [s * (W / 2 - 0.03), 1.6, -0.02], [1, 1, 1], [0, 0, 0], 1.02));
  for (let x = -W / 2 + 0.1; x <= W / 2 - 0.09; x += 0.1) {
    const y0 = Math.abs(x) < 0.26 ? 1.45 : 1.0; // 가운데는 창구라 창살이 짧다
    b.add(part(new THREE.BoxGeometry(0.02, 1.85 - y0, 0.02), brass, [x, (y0 + 1.85) / 2, 0.27], [1, 1, 1], [0, 0, 0], 0));
  }
  b.add(part(new THREE.BoxGeometry(W, 0.04, 0.04), brass, [0, 1.85, 0.27], [1, 1, 1], [0, 0, 0], 0));
  b.add(part(new THREE.CylinderGeometry(0.11, 0.09, 0.03, 18), brass, [0, 1.01, 0.22])); // 코인 접시
  b.add(part(new THREE.BoxGeometry(W + 0.1, 0.32, D), body, [0, 2.2, -0.02], [1, 1, 1], [0, 0, 0], 1.02));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.3), shared.sign);
  sign.position.set(0, 2.2, D / 2 - 0.01); b.add(sign);
  return b;
}

const footTex = () => canvasTex(128, 128, (g) => {
  g.fillStyle = 'rgba(255,214,107,.55)';
  for (const [x, r] of [[44, -0.15], [84, 0.15]]) {
    g.save(); g.translate(x, 64); g.rotate(r);
    g.beginPath(); g.ellipse(0, 8, 13, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0, -30, 10, 9, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
});

export function buildCoinCounters(scene: THREE.Scene): Occluder[] {
  const foot = new THREE.MeshBasicMaterial({ map: footTex(), transparent: true, depthWrite: false });
  const footGeo = new THREE.PlaneGeometry(0.45, 0.45);
  const root = new THREE.Group(), boxes: THREE.Box3[] = [];
  for (const c of COUNTERS) {
    const anchor = new THREE.Group(); anchor.position.set(c.x, 0, c.z); anchor.rotation.y = c.ry;
    anchor.add(booth()); root.add(anchor);
    const f = new THREE.Mesh(footGeo, foot);
    f.rotation.set(-Math.PI / 2, 0, c.ry + Math.PI); f.position.set(c.window[0], 0.013, c.window[1]);
    root.add(f);
    anchor.updateMatrixWorld(true);
    boxes.push(new THREE.Box3().setFromObject(anchor)); // 부스만 (발자국은 낮아서 가리지 않음)
  }
  root.traverse((o) => { o.castShadow = false; });
  const cloner = materialCloner(), group = new THREE.Group();
  group.name = 'coin-counters';
  root.updateMatrixWorld(true);
  for (const m of bakeByMaterial(root, cloner.remap)) group.add(m);
  scene.add(group);
  return boxes.map((box) => ({ box, setOpacity: (o: number) => fadeMaterials(cloner.materials, o) }));
}
