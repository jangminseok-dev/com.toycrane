import { MAP_HALF, TOWER_HALF, WALK_SPEED } from '../world/layout';

export type Vec2 = { x: number; z: number };

// 서버 server/src/toycrane/domain/store_rules.py clamp_to_floor와 같은 규칙
export function clampToFloor(p: Vec2): Vec2 {
  let x = Math.min(Math.max(p.x, -MAP_HALF), MAP_HALF);
  let z = Math.min(Math.max(p.z, -MAP_HALF), MAP_HALF);
  if (Math.abs(x) < TOWER_HALF && Math.abs(z) < TOWER_HALF) {
    if (TOWER_HALF - Math.abs(z) <= TOWER_HALF - Math.abs(x)) z = z < 0 || Object.is(z, -0) ? -TOWER_HALF : TOWER_HALF;
    else x = x < 0 || Object.is(x, -0) ? -TOWER_HALF : TOWER_HALF;
  }
  return { x, z };
}

export function step(pos: Vec2, dir: Vec2, dt: number): Vec2 {
  return clampToFloor({ x: pos.x + dir.x * WALK_SPEED * dt, z: pos.z + dir.z * WALK_SPEED * dt });
}
