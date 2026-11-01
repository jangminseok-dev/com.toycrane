import * as THREE from 'three';
import { CLAW } from '../data/claw';
import { PUSHER, isPusher } from '../data/pushers';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { CycleOptions } from '../physics/clawCycle';
import { CLAW_REST, DOLL_FLOOR, DOLL_SCALE } from '../world/machine';
import type { Vec2 } from './movement';

// 집게 기계 종류별 차이(설계 2026-11-02 ring-hook §4): 인형 기계와 미는 뽑기는 같은 몸통·집게·조작대(레버+잡기)이고
// 인형 크기, 집게가 서 있는 자리(= 잡은 인형을 옮겨 놓는 자리), 놓은 뒤 기다리기, 잡는 힘, 겨냥 고리 아래 바닥만 다르다
export type CraneSpec = {
  pusher: boolean;
  dollScale: number;
  start: Vec2; // 기계 안 좌표
  rest: THREE.Vector3; // 쉬는 집게 자리(start 위 천장)
  cycle: CycleOptions; // 집게 한 바퀴 옵션(인형 기계는 기본)
  floorAt(x: number, z: number): number; // 그 자리 바닥 높이 — 미는 뽑기 턱·판 집 위는 높다
};

const { ledge, plate, drop } = PUSHER;
const DOLL: CraneSpec = {
  pusher: false, dollScale: DOLL_SCALE, start: { x: MACHINE_SPEC.hole[0], z: MACHINE_SPEC.hole[1] }, rest: CLAW_REST.clone(), cycle: {},
  floorAt: () => DOLL_FLOOR,
};
const START = { x: drop[0], z: drop[1] };
const PUSHER_CRANE: CraneSpec = {
  pusher: true, dollScale: PUSHER.doll_scale, start: START, rest: new THREE.Vector3(START.x, CLAW_REST.y, START.z),
  cycle: { carryTo: START, settle: PUSHER.settle, baseForce: CLAW.base_force * PUSHER.grip },
  floorAt: (x, z) => {
    if (x < ledge.x0 || x > ledge.x1 || z > ledge.z1) return DOLL_FLOOR;
    return DOLL_FLOOR + ledge.h + (z < ledge.z0 ? plate.h : 0);
  },
};

export function craneSpec(id: string): CraneSpec {
  return isPusher(id) ? PUSHER_CRANE : DOLL;
}
