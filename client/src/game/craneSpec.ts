import * as THREE from 'three';
import { CLAW } from '../data/claw';
import { PUSHER, isPusher } from '../data/pushers';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { CycleOptions } from '../physics/clawCycle';
import { CLAW_REST, DOLL_FLOOR, DOLL_SCALE } from '../world/machine';
import type { Vec2 } from './movement';
import { CLAW_EDGE } from './playSession';

// 집게 기계 종류별 차이(설계 2026-11-02 ring-hook §4): 인형 기계와 미는 뽑기는 같은 몸통·집게·조작대(레버+잡기)이고
// 인형 크기, 집게가 서 있는 자리(= 잡은 인형을 옮겨 놓는 자리), 놓은 뒤 기다리기, 잡는 힘, 겨냥 고리 아래 바닥만 다르다
export type CraneSpec = {
  pusher: boolean;
  dollScale: number;
  start: Vec2; // 기계 안 좌표
  rest: THREE.Vector3; // 쉬는 집게 자리(start 위 천장)
  cycle: CycleOptions; // 집게 한 바퀴 옵션(인형 기계는 기본)
  floorAt(x: number, z: number): number; // 그 자리 바닥 높이 — 미는 뽑기 턱·판 집 위는 높다
  range?: { x: [number, number]; z: [number, number] }; // 레버로 갈 수 있는 곳(없으면 놀이 영역 전체) — 미는 뽑기는 칸만
};

const { ledge, plate, drop, house } = PUSHER;
const SLOPE = Math.tan((house.slope_deg * Math.PI) / 180);
const DOLL: CraneSpec = {
  pusher: false, dollScale: DOLL_SCALE, start: { x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] }, rest: CLAW_REST.clone(), cycle: {},
  floorAt: () => DOLL_FLOOR,
};
const START = { x: drop[0], z: drop[1] };
const PUSHER_CRANE: CraneSpec = {
  pusher: true, dollScale: PUSHER.doll_scale, start: START, rest: new THREE.Vector3(START.x, CLAW_REST.y, START.z),
  cycle: { carryTo: START, settle: PUSHER.settle, baseForce: CLAW.base_force * PUSHER.grip, floor: (x, z) => pusherFloor(x, z) },
  floorAt: (x, z) => pusherFloor(x, z),
  // 집게는 미는 쪽(턱 위)으로는 레버로 못 간다 — 놓을 때만(사용자 2026-11-02 사진 205·206). 칸(턱 오른쪽 끝 + 6cm, 채우기 자리와 같음)만
  range: {
    x: [ledge.x1 + 0.06, MACHINE_SPEC.play_half[0] - CLAW_EDGE],
    z: [-(MACHINE_SPEC.play_half[1] - CLAW_EDGE), MACHINE_SPEC.play_half[1] - CLAW_EDGE],
  },
};
// 미는 뽑기 바닥: 턱 윗면, 판 집은 앞벽 위(판 윗면 + over)에서 뒤로 비탈만큼 높아진다(physics/pusherWorld와 같은 치수)
function pusherFloor(x: number, z: number): number {
  if (x < ledge.x0 || x > ledge.x1 || z > ledge.z1) return DOLL_FLOOR;
  const top = DOLL_FLOOR + ledge.h;
  return z >= ledge.z0 ? top : top + plate.h + house.over + (ledge.z0 - z) * SLOPE;
}

export function craneSpec(id: string): CraneSpec {
  return isPusher(id) ? PUSHER_CRANE : DOLL;
}
