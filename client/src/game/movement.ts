import { OBSTACLES } from '../data/storeLayout';
import { MAP_HALF, WALK_SPEED } from '../world/layout';

export type Vec2 = { x: number; z: number };

// 서버 server/src/toycrane/domain/store_rules.py clamp_to_floor와 같은 규칙:
// 바닥 밖은 경계로 자르고, 장애물(탑·기계·교환소) 안이면 덜 파고든 축으로 가까운 변까지 밀어낸다
export function clampToFloor(p: Vec2): Vec2 {
  let x = Math.min(Math.max(p.x, -MAP_HALF), MAP_HALF);
  let z = Math.min(Math.max(p.z, -MAP_HALF), MAP_HALF);
  for (const [x0, z0, x1, z1] of OBSTACLES) {
    if (x0 < x && x < x1 && z0 < z && z < z1) {
      if (Math.min(z - z0, z1 - z) <= Math.min(x - x0, x1 - x)) z = pushOut(z, z0, z1);
      else x = pushOut(x, x0, x1);
    }
  }
  return { x, z };
}

// 가까운 변으로. 두 변까지 같으면 상자 가운데 기준 부호로(−0은 음수 쪽 — 파이썬 copysign과 같게)
function pushOut(v: number, lo: number, hi: number): number {
  if (v - lo !== hi - v) return v - lo < hi - v ? lo : hi;
  const d = v - (lo + hi) / 2;
  return d < 0 || Object.is(d, -0) ? lo : hi;
}

export function step(pos: Vec2, dir: Vec2, dt: number): Vec2 {
  return clampToFloor({ x: pos.x + dir.x * WALK_SPEED * dt, z: pos.z + dir.z * WALK_SPEED * dt });
}
