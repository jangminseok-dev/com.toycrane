import * as THREE from 'three';
import type { Hit } from './dolls';

// 말랑한 인형 다루기 (설계 2026-10-31 §3.6)

// 쥘 때 말랑하게 눌림: 가로로 amount만큼 줄고 세로로 0.75배만큼 늘되, 머리 꼭대기(인형 모양 좌표 높이 topLocal)는 제자리에 둔다 —
// 발 기준으로 늘리면 머리가 그 위에 얹힌 허브 속으로 들어간다
const top = new THREE.Vector3();
export function squeezeAboutTop(doll: THREE.Object3D, rest: { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number }, topLocal: number, amount: number): void {
  const sx = rest.scale * (1 - amount), sy = rest.scale * (1 + amount * 0.75);
  doll.scale.set(sx, sy, sx);
  // 머리 꼭대기 = 자리 + 회전·크기를 입힌 (0, topLocal, 0) — 크기가 바뀐 만큼 자리를 옮겨 그대로 둔다
  top.set(0, topLocal * (rest.scale - sy), 0).applyQuaternion(rest.quaternion);
  doll.position.copy(rest.position).add(top);
}

// 옆 인형 비켜 주기: 손가락 점(기계 안 좌표)이 옆 인형 공 안으로 들어오면 그 인형을 가로로 밀어 빼고(위치 기반 — 그 프레임 안에 겹침이 풀린다),
// 아무것도 누르지 않으면 초당 4 비율로 제자리로 돌아온다. 한 인형은 최대 8cm까지만 밀린다
export type Yielding = { doll: THREE.Object3D; base: THREE.Vector3; hits: Hit[]; offset: THREE.Vector3 };
const MAX_PUSH = 0.08, RELAX = 4, SKIN = 0.003;
const d = new THREE.Vector3(), c = new THREE.Vector3();
export function pushAway(items: Yielding[], probes: THREE.Vector3[], dt: number): void {
  for (const it of items) {
    it.offset.multiplyScalar(1 - Math.min(1, dt * RELAX));
    for (let pass = 0; pass < 3; pass++) {
      for (const p of probes) for (const h of it.hits) {
        c.copy(h.c).add(it.offset);
        d.subVectors(c, p);
        const overlap = h.r + SKIN - d.length();
        if (overlap <= 0) continue;
        d.y = 0; // 가로로만 민다 (바닥으로 꺼지거나 떠오르지 않게)
        if (d.lengthSq() < 1e-8) d.set(1, 0, 0);
        it.offset.addScaledVector(d.normalize(), overlap / Math.max(0.35, Math.hypot(c.x - p.x, c.z - p.z) / Math.max(1e-6, c.distanceTo(p))));
      }
    }
    if (it.offset.length() > MAX_PUSH) it.offset.setLength(MAX_PUSH);
    it.doll.position.copy(it.base).add(it.offset);
  }
}
