// 고리 뽑기 기계(설계 2026-11-02 §3): 자리는 shared/store_layout.json rings, 수치는 shared/ring.json
import ring from '../../../shared/ring.json';
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';
import { MACHINE_SPEC, frontSpot } from './storeLayout';

export type RingSpot = { id: string; x: number; z: number; ry: number; row: 'r1' | 'r2' };
export type RingSpec = Omit<typeof ring, '_note'>;
export const RINGS = layout.rings as RingSpot[];
export const RING: RingSpec = ring;
const IDS = new Set(RINGS.map((r) => r.id));

export function isRing(id: string): boolean {
  return IDS.has(id);
}

// 걸이 i(왼쪽 위부터 줄마다)의 구멍판 위 자리(기계 좌표 x, y)
export function pegXY(i: number): [number, number] {
  const { cols, x0, dx, y0, dy } = RING.board, row = Math.floor(i / cols);
  return [x0 + (i % cols) * dx, y0 + (RING.board.rows - 1 - row) * dy];
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
