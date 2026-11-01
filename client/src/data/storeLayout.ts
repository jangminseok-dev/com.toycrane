// 매장 배치(shared/store_layout.json, 서버 server/src/toycrane/domain/layout.py와 같은 파일)
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';

export type MachineSpot = { id: string; x: number; z: number; ry: number; kind: string; row: string }; // kind: 이 기계에 든 캐릭터, row: 같은 줄 기계끼리 묶어 그린다(d1·d2·d3)
export type CounterSpot = { id: number; x: number; z: number; ry: number; window: [number, number] }; // window: 창구 앞 (1.5m 안이면 코인 받기·조르기)
export type MachineSpec = {
  front: number; reach: number; play_half: [number, number]; hole: [number, number, number]; claw_speed: number; play_seconds: number; hold_seconds: number;
};

// 매장 치수(큰 홀, 설계 2026-11-01): 화면·서버가 같은 값 — room_half 벽까지 반폭, map_half 걸을 수 있는 반폭, 탑 반폭, 스폰 링, 가운데 광장 반지름
export type Hall = { room_half: number; map_half: number; tower_half: number; spawn_radius: number; plaza_radius: number };
export const HALL = layout.hall as Hall;
export const MACHINE_SPEC = layout.machine as MachineSpec;
export const MACHINES = layout.machines as MachineSpot[];
export const COUNTERS = layout.counters as CounterSpot[];
export const OBSTACLES = layout.obstacles as [number, number, number, number][];
// 아직 없는 기계 자리의 "준비 중" 장식과 쉼터(누를 수 없음). rect는 장애물과 같은 상자 — 벽 쪽 변은 밀려날 때 늘 안쪽으로 가게 벽 너머(±23)까지
export type DecorSpot = { kind: 'figure' | 'ring' | 'pusher' | 'shelf' | 'bench'; rect: [number, number, number, number]; ry: number };
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
