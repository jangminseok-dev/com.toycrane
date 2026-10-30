// 매장 배치(shared/store_layout.json, 서버 server/src/toycrane/domain/layout.py와 같은 파일)
import layout from '../../../shared/store_layout.json';
import type { Vec2 } from '../game/movement';

export type MachineSpot = { id: string; x: number; z: number; ry: number; set: string; row: 'wall' | 'island' };
export type CounterSpot = { id: number; x: number; z: number; ry: number; window: [number, number]; queue: [number, number][] };
export type MachineSpec = {
  front: number; reach: number; play_half: [number, number]; hole: [number, number, number]; claw_speed: number; play_seconds: number;
};

export const MACHINE_SPEC = layout.machine as MachineSpec;
export const MACHINES = layout.machines as MachineSpot[];
export const COUNTERS = layout.counters as CounterSpot[];
export const OBSTACLES = layout.obstacles as [number, number, number, number][];

// 기계 앞에 서서 하는 자리 (ry=0이면 +z 쪽)
export function frontSpot(m: MachineSpot): Vec2 {
  return { x: m.x + Math.sin(m.ry) * MACHINE_SPEC.front, z: m.z + Math.cos(m.ry) * MACHINE_SPEC.front };
}
