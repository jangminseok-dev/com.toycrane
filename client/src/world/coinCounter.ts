import * as THREE from 'three';
import { COUNTERS, type CounterSpot } from '../data/storeLayout';
import type { Occluder } from '../game/occlusion';
import { bakeByMaterial, fadeMaterials, materialCloner } from './bake';
import { marqueeTex } from './machine';
import { SPH_LO, canvasTex, part, toon } from './toon';

// 코인 교환소: 창살 달린 전당포 카운터 + 줄 서기 차단봉 + 줄 자리 발자국 (시제품 spike-arcade-big-v3.html 815~850행).
// 시제품 크기(폭 3.1m)를 배치의 장애물 상자(2.4m × 1.0m)에 맞게 0.8배로 줄여 놓는다.
const BODY = 0xf8f3fb, SHRINK = 0.8, DEPTH_SHIFT = 0.2;

function booth(): THREE.Group {
  const b = new THREE.Group(); // 앞 = 로컬 +z, 길이는 로컬 x
  const brass = toon(0xffc94d), body = toon(BODY);
  b.add(part(new THREE.BoxGeometry(3.0, 1.05, 0.6), body, [0, 0.525, 0], [1, 1, 1], [0, 0, 0], 1.02));
  b.add(new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x4fd8ff })).translateY(0.06).translateZ(0.305));
  b.add(part(new THREE.BoxGeometry(3.1, 0.06, 0.72), toon(0x3b2a5a), [0, 1.08, 0.03], [1, 1, 1], [0, 0, 0], 0));
  b.add(part(new THREE.BoxGeometry(3.0, 2.6, 0.08), toon(0xffe6f0), [0, 1.3, -0.85], [1, 1, 1], [0, 0, 0], 0));
  for (const s of [-1, 1]) b.add(part(new THREE.BoxGeometry(0.08, 2.6, 0.95), body, [s * 1.5, 1.3, -0.42], [1, 1, 1], [0, 0, 0], 1.02));
  for (let x = -1.42; x <= 1.43; x += 0.12) {
    const y0 = Math.abs(x) < 0.4 ? 1.6 : 1.11; // 가운데는 창구라 창살이 짧다
    b.add(part(new THREE.BoxGeometry(0.025, 2.25 - y0, 0.025), brass, [x, (y0 + 2.25) / 2, 0.25], [1, 1, 1], [0, 0, 0], 0));
  }
  b.add(part(new THREE.BoxGeometry(3.0, 0.05, 0.05), brass, [0, 2.25, 0.25], [1, 1, 1], [0, 0, 0], 0));
  b.add(part(new THREE.BoxGeometry(0.84, 0.04, 0.04), brass, [0, 1.6, 0.25], [1, 1, 1], [0, 0, 0], 0));
  b.add(part(new THREE.CylinderGeometry(0.14, 0.12, 0.04, 20), toon(0xc9c9d6), [0, 1.13, 0.2]));
  b.add(part(new THREE.BoxGeometry(3.1, 0.38, 1.0), body, [0, 2.45, -0.3], [1, 1, 1], [0, 0, 0], 1.02));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.32), new THREE.MeshBasicMaterial({ map: marqueeTex('코인 교환소', 0xffb84d) }));
  sign.position.set(0, 2.45, 0.205); b.add(sign);
  b.scale.set(SHRINK, 1, SHRINK); b.position.z = DEPTH_SHIFT * SHRINK;
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

// 줄 선을 따라 양쪽에 황동 기둥 + 빨간 줄, 줄 자리마다 바닥 발자국 (세계 좌표로 바로 놓음)
function queueLine(c: CounterSpot, root: THREE.Group, foot: THREE.Material) {
  const brass = toon(0xffc94d), rope = toon(0xff3b6b);
  const post = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 10), base = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16);
  const [x0, z0] = c.queue[0], [xn] = c.queue[c.queue.length - 1];
  const dir = Math.sign(xn - x0);
  const posts = Math.ceil(Math.abs(xn - x0) / 1.1) + 1;
  for (const side of [-1, 1]) {
    for (let i = 0; i < posts; i++) {
      const x = x0 + dir * (0.35 + i * 1.1), z = z0 + side * 0.45;
      root.add(part(post, brass, [x, 0.45, z], [1, 1, 1], [0, 0, 0], 0));
      root.add(part(base, brass, [x, 0.015, z], [1, 1, 1], [0, 0, 0], 0));
      root.add(part(SPH_LO, brass, [x, 0.92, z], [0.045, 0.045, 0.045], [0, 0, 0], 0));
      if (i < posts - 1) root.add(part(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8), rope, [x + dir * 0.55, 0.82, z], [1, 1, 1], [0, 0, Math.PI / 2], 0));
    }
  }
  const footGeo = new THREE.PlaneGeometry(0.45, 0.45);
  for (const [x, z] of c.queue) {
    const f = new THREE.Mesh(footGeo, foot);
    f.rotation.set(-Math.PI / 2, 0, c.ry + Math.PI); f.position.set(x, 0.013, z);
    root.add(f);
  }
}

export function buildCoinCounters(scene: THREE.Scene): Occluder[] {
  const foot = new THREE.MeshBasicMaterial({ map: footTex(), transparent: true, depthWrite: false });
  return COUNTERS.map((c) => {
    const root = new THREE.Group();
    const anchor = new THREE.Group(); anchor.position.set(c.x, 0, c.z); anchor.rotation.y = c.ry;
    anchor.add(booth()); root.add(anchor);
    queueLine(c, root, foot);
    root.traverse((o) => { o.castShadow = false; });
    // 교환소마다 재질을 따로 둬서 내 캐릭터를 가리는 쪽만 흐리게
    const cloner = materialCloner(), group = new THREE.Group();
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(anchor); // 카운터 본체만 (차단봉·발자국은 낮아서 가리지 않음)
    for (const m of bakeByMaterial(root, cloner.remap)) group.add(m);
    scene.add(group);
    return { box, setOpacity: (o: number) => fadeMaterials(cloner.materials, o) };
  });
}
