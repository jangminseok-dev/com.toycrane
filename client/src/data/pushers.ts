// 미는 뽑기 기계(설계 2026-11-02 §4): 자리는 shared/store_layout.json pushers, 수치는 shared/pusher.json
import pusher from '../../../shared/pusher.json';
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';
import { MACHINE_SPEC, frontSpot } from './storeLayout';

export type PusherSpot = { id: string; x: number; z: number; ry: number };
export type PusherSpec = Omit<typeof pusher, '_note'>;
export const PUSHERS = layout.pushers as PusherSpot[];
export const PUSHER: PusherSpec = pusher;
const IDS = new Set(PUSHERS.map((p) => p.id));

export function isPusher(id: string): boolean {
  return IDS.has(id);
}

// 손 닿는 거리(reach) 안의 앞자리 중 가장 가까운 미는 뽑기 기계
export function nearestPusher(pos: Vec2): PusherSpot | null {
  let best: PusherSpot | null = null, bestD = MACHINE_SPEC.reach;
  for (const p of PUSHERS) {
    const s = frontSpot(p), d = Math.hypot(pos.x - s.x, pos.z - s.z);
    if (d <= bestD) { best = p; bestD = d; }
  }
  return best;
}
