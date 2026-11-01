// 고리 걸기 기계 자리(shared/store_layout.json rings)
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';
import { MACHINE_SPEC, frontSpot } from './storeLayout';

export type RingSpot = { id: string; x: number; z: number; ry: number; row: 'r1' | 'r2' };
export const RINGS = layout.rings as RingSpot[];
const IDS = new Set(RINGS.map((r) => r.id));

export function isRing(id: string): boolean {
  return IDS.has(id);
}

// 손 닿는 거리(reach) 안의 앞자리 중 가장 가까운 고리 기계
export function nearestRing(pos: Vec2): RingSpot | null {
  let best: RingSpot | null = null, bestD = MACHINE_SPEC.reach;
  for (const r of RINGS) {
    const s = frontSpot(r), d = Math.hypot(pos.x - s.x, pos.z - s.z);
    if (d <= bestD) { best = r; bestD = d; }
  }
  return best;
}
