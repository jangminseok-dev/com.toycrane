import { beforeAll, expect, test } from 'vitest';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { DollSpot } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { DOLL_FLOOR } from '../world/machine';
import { ClawBody } from './clawBody';
import { runCycle } from './clawCycle';
import { MachineWorld, type Rapier } from './machineWorld';
import { loadRapier } from './rapier';

beforeAll(stubCanvas);
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const standing = (uid: number, x: number, z: number): DollSpot => ['bear', x, DOLL_FLOOR, z, 0, 0, 0, 1, 0, 'n', 0, '', uid];
const [W, D] = MACHINE_SPEC.play_half;
const inBox = (p: [number, number, number]) => p[1] >= DOLL_FLOOR - 0.01 && Math.abs(p[0]) <= W + 0.15 && Math.abs(p[2]) <= D + 0.15;
const tiltOf = (q: [number, number, number, number]) => { const [x, y, z, w] = q; const upY = 1 - 2 * (x * x + z * z); return Math.acos(Math.min(1, Math.max(-1, upY))) * 180 / Math.PI; };

// 한 바퀴: 내려감 → 쥠 → 올림 → 구멍으로 옮김 → 놓음 → 멈춤 대기. 힘이 넉넉하면 머리를 잡아 구멍에 넣는다
test('a head grip on a normal doll with full strength lifts it into the hole', () => {
  const world = new MachineWorld(R, [standing(1, 0.3, -0.2)]);
  const r = runCycle(world, new ClawBody(R, world), 0.3, -0.2, { baseForce: 60 });
  expect(r.held).toBe(1);
  expect(r.won).toEqual([1]);
  expect(r.poses).toEqual([]);
  world.dispose();
});

test('a grip on the lower body hangs the doll tilted', () => {
  const world = new MachineWorld(R, [standing(1, 0.3, -0.2)]);
  let maxTilt = 0;
  runCycle(world, new ClawBody(R, world), 0.3 + 0.1, -0.2, {
    baseForce: 60,
    frame: (_c, _moving, phase) => { if (phase === 'lift' || phase === 'carry') { const p = world.poses().find((x) => x.uid === 1); if (p) maxTilt = Math.max(maxTilt, tiltOf(p.q)); } },
  });
  expect(maxTilt).toBeGreaterThan(30);
  world.dispose();
});

test('a weak grip drops the doll on the way and it rests back inside the box', () => {
  const world = new MachineWorld(R, [standing(1, 0.3, -0.2)]);
  const r = runCycle(world, new ClawBody(R, world), 0.3, -0.2, { baseForce: 0.3 });
  expect(r.held).toBe(1);
  expect(r.won).toEqual([]);
  expect(r.slipped).toBe(true);
  expect(r.poses).toHaveLength(1);
  expect(inBox(r.poses[0].p)).toBe(true);
  world.dispose();
});

test('an empty spot is a miss', () => {
  const world = new MachineWorld(R, [standing(1, 0.3, 0.3)]);
  const r = runCycle(world, new ClawBody(R, world), -0.1, -0.3);
  expect(r.held).toBeNull();
  expect(r.won).toEqual([]);
  expect(r.slipped).toBe(false);
  world.dispose();
});

test('the cycle is deterministic', () => {
  const run = () => { const w = new MachineWorld(R, [standing(1, 0.3, -0.2), standing(2, 0.1, -0.2)]); const r = runCycle(w, new ClawBody(R, w), 0.3, -0.2, { baseForce: 3 }); w.dispose(); return r; };
  const a = run(), b = run();
  expect(a.won).toEqual(b.won);
  expect(a.poses).toEqual(b.poses);
});
