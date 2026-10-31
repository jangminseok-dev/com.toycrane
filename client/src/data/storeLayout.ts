// 매장 배치(shared/store_layout.json, 서버 server/src/toycrane/domain/layout.py와 같은 파일)
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';

export type MachineSpot = { id: string; x: number; z: number; ry: number; set: string; row: 'wall' | 'island' };
export type CounterSpot = { id: number; x: number; z: number; ry: number; window: [number, number]; queue: [number, number][] };
export type MachineSpec = {
  front: number; reach: number; play_half: [number, number]; hole: [number, number, number]; claw_speed: number; play_seconds: number; hold_seconds: number;
};

export const MACHINE_SPEC = layout.machine as MachineSpec;
export const MACHINES = layout.machines as MachineSpot[];
export const COUNTERS = layout.counters as CounterSpot[];
export const OBSTACLES = layout.obstacles as [number, number, number, number][];
// 빈 미니·피규어 구역의 "준비 중" 장식(누를 수 없음). rect는 장애물과 같은 상자 — 벽 쪽 변은 밀려날 때 늘 안쪽으로 가게 벽 너머(±14)까지
export type DecorSpot = { kind: 'mini' | 'figure' | 'shelf'; rect: [number, number, number, number]; ry: number };
export const DECOR = layout.decor as DecorSpot[];

// 기계 앞에 서서 하는 자리 (ry=0이면 +z 쪽)
export function frontSpot(m: MachineSpot): Vec2 {
  return { x: m.x + Math.sin(m.ry) * MACHINE_SPEC.front, z: m.z + Math.cos(m.ry) * MACHINE_SPEC.front };
}

// 손 닿는 거리(reach) 안의 앞자리 중 가장 가까운 기계
export function nearestMachine(pos: Vec2): MachineSpot | null {
  let best: MachineSpot | null = null, bestD = MACHINE_SPEC.reach;
  for (const m of MACHINES) {
    const f = frontSpot(m), d = Math.hypot(pos.x - f.x, pos.z - f.z);
    if (d <= bestD) { best = m; bestD = d; }
  }
  return best;
}
