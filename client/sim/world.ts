import { CLAW } from '../src/data/claw';
import { MACHINE_SPEC } from '../src/data/storeLayout';
import type { DollSpot } from '../src/net/protocol';
import { ClawBody } from '../src/physics/clawBody';
import { runCycle, type CycleOptions } from '../src/physics/clawCycle';
import { MachineWorld, type Rapier } from '../src/physics/machineWorld';
import { stubCanvas } from '../src/test/canvasStub';
import { DOLL_FLOOR } from '../src/world/machine';

// 시뮬레이션 틀 (물리 뽑기 설계 §5·§8): 서버 spawn_spot과 같은 규칙으로 9개를 떨어뜨려 앉힌 기계에서, 위가 막히지 않은 인형 하나를 골라
// 머리 위(또는 aimOff만큼 옆)로 집게 한 바퀴를 돌려 성공률을 잰다. 난수는 seed로 재현된다
stubCanvas();
export type Rng = () => number;
export function seededRandom(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const MIN_GAP = 0.22, FALLBACK_GAP = 0.16, HOLE_MARGIN = 0.05;
export function spawnSpot(spots: DollSpot[], rng: Rng): [number, number] {
  const [W, D] = MACHINE_SPEC.play_half, [hx, hz] = MACHINE_SPEC.hole, half = CLAW.hole.size / 2 + HOLE_MARGIN;
  for (const [gap, tries] of [[MIN_GAP, 400], [FALLBACK_GAP, 400], [0, 1000]] as const) {
    for (let i = 0; i < tries; i++) {
      const x = Math.round((rng() * 2 - 1) * W * 1000) / 1000, z = Math.round((rng() * 2 - 1) * D * 1000) / 1000;
      if ((Math.abs(x - hx) > half || Math.abs(z - hz) > half) && spots.every((s) => Math.hypot(x - s[1], z - s[3]) >= gap)) return [x, z];
    }
  }
  throw new Error('unreachable');
}
export type Look = { body?: 'n' | 'c' | 's'; rare?: string };
export function fillMachine(kind: string, rng: Rng, look: Look = {}): DollSpot[] {
  const spots: DollSpot[] = [];
  for (let uid = 1; uid <= 9; uid++) {
    const [x, z] = spawnSpot(spots, rng);
    const roll = rng(), body = look.body ?? (roll < 0.5 ? 'n' : roll < 0.75 ? 'c' : 's');
    spots.push([kind, x, null, z, 0, 0, 0, 1, Math.floor(rng() * 6), body, Math.floor(rng() * 5), look.rare ?? '', uid]);
  }
  return spots;
}
// 앉힌 기계 상태(자리·돌림이 채워진 spots)
export function settledMachine(R: Rapier, kind: string, rng: Rng, look: Look = {}): DollSpot[] {
  const world = new MachineWorld(R, fillMachine(kind, rng, look));
  world.settle(8);
  const poses = new Map(world.poses().map((p) => [p.uid, p]));
  const out = world.uids().map((uid) => { const s = world.spotOf(uid)!, p = poses.get(uid)!; return [s[0], p.p[0], p.p[1], p.p[2], ...p.q, s[8], s[9], s[10], s[11], s[12]] as DollSpot; });
  world.dispose();
  return out;
}
// 위가 막히지 않은 인형: 다른 인형 중심이 더 높고 수평 17cm 안이면 막힘
export function openDolls(spots: DollSpot[]): DollSpot[] {
  return spots.filter((s) => !spots.some((t) => t !== s && (t[2] ?? 0) > (s[2] ?? 0) + 0.05 && Math.hypot(t[1] - s[1], t[3] - s[3]) < 0.17));
}
// 머리 자리(기계 안 좌표): 인형 원점 위 머리 중심 — 돌림을 입힌다
import * as THREE from 'three';
import { DOLL_SCALE } from '../src/world/machine';
import { headOf } from '../src/world/dolls';
export function headAt(s: DollSpot): THREE.Vector3 {
  const q = new THREE.Quaternion(s[4], s[5], s[6], s[7]);
  return new THREE.Vector3(0, headOf(s[0]).c * DOLL_SCALE, 0).applyQuaternion(q).add(new THREE.Vector3(s[1], s[2] ?? DOLL_FLOOR, s[3]));
}
export function overlaps(world: MachineWorld): number { return world.overlaps(); }

export type AimOpts = { trials: number; aimOff?: number; look?: Look; kind?: string; baseForce?: number; where?: 'near' | 'far' | 'any'; onlyStanding?: boolean };
// 성공률: 판마다 새 기계(seed), 열린 보통 인형(또는 look) 하나를 골라 머리 위(aimOff만큼 임의 방향으로 비켜)로 한 바퀴
export function aimRate(R: Rapier, opts: AimOpts, seed = 7): number {
  const rng = seededRandom(seed);
  const [hx, hz] = MACHINE_SPEC.hole;
  let wins = 0, n = 0, guard = 0;
  while (n < opts.trials && guard++ < opts.trials * 20) {
    const spots = settledMachine(R, opts.kind ?? 'bear', rng, opts.look);
    let open = openDolls(spots);
    if (opts.where && opts.where !== 'any') {
      const dist = (s: DollSpot) => Math.hypot(s[1] - hx, s[3] - hz);
      const sorted = [...open].sort((a, b) => dist(a) - dist(b));
      open = opts.where === 'near' ? sorted.slice(0, Math.max(1, sorted.length >> 1)) : sorted.slice(sorted.length >> 1);
    }
    if (!open.length) continue;
    const pick = open[Math.floor(rng() * open.length)];
    const head = headAt(pick), a = rng() * Math.PI * 2, off = opts.aimOff ?? 0;
    const x = Math.min(Math.max(head.x + Math.cos(a) * off, -MACHINE_SPEC.play_half[0]), MACHINE_SPEC.play_half[0]);
    const z = Math.min(Math.max(head.z + Math.sin(a) * off, -MACHINE_SPEC.play_half[1]), MACHINE_SPEC.play_half[1]);
    const world = new MachineWorld(R, spots);
    const cyc: CycleOptions = { baseForce: opts.baseForce };
    const r = runCycle(world, new ClawBody(R, world), x, z, cyc);
    world.dispose();
    wins += r.won.includes(pick[12]) ? 1 : 0;
    n++;
  }
  return wins / Math.max(1, n);
}
