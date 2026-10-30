import * as THREE from 'three';
import { SPH, cap, part, toon } from './toon';

// 당첨 터짐: 작은 별 조각이 튀어 올랐다 떨어지며 작아진다 (시제품 burst)
const burstGeo = new THREE.OctahedronGeometry(0.05);
const bursts: THREE.Mesh[] = [];

export function burst(scene: THREE.Scene, pos: THREE.Vector3, colors: number[], n: number): void {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    m.position.copy(pos);
    const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.6;
    m.userData = { v: new THREE.Vector3(Math.cos(a) * sp, 1.6 + Math.random() * 2.2, Math.sin(a) * sp), life: 0.9 + Math.random() * 0.6 };
    scene.add(m); bursts.push(m);
  }
}

export function updateEffects(dt: number): void {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const m = bursts[i], u = m.userData as { v: THREE.Vector3; life: number };
    u.life -= dt; u.v.y -= 4.5 * dt;
    m.position.addScaledVector(u.v, dt); m.rotation.x += dt * 6; m.rotation.y += dt * 4;
    m.scale.setScalar(Math.max(u.life, 0));
    if (u.life <= 0) { m.removeFromParent(); (m.material as THREE.Material).dispose(); bursts.splice(i, 1); }
  }
}

// 실패하면 머리 위에 뜨는 먹구름 + 빗방울 (drops는 모션이 움직인다)
export function makeCloud(): THREE.Group {
  const c = new THREE.Group(); c.position.set(0, 0.85, 0);
  for (const [x, y, s] of [[-0.16, 0, 0.17], [0, 0.06, 0.21], [0.17, 0, 0.16]]) c.add(part(SPH, toon(0x9a95ad), [x, y, 0], [s, s * 0.8, s]));
  const drops: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const d = part(cap(0.018, 0.05), toon(0x8fd3ff), [-0.2 + i * 0.1, -0.2, 0], [1, 1, 1], [0, 0, 0], 0);
    d.userData.off = Math.random(); c.add(d); drops.push(d);
  }
  c.userData.drops = drops;
  return c;
}
