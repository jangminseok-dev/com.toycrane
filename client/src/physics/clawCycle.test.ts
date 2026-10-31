import { beforeAll, expect, test } from 'vitest';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { DollSpot } from '../net/protocol';
import { fillMachine, seededRandom, settleSpots } from '../../sim/world';
import { stubCanvas } from '../test/canvasStub';
import { DOLL_FLOOR } from '../world/machine';
import { ClawBody } from './clawBody';
import { CycleRunner, runCycle } from './clawCycle';
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

// 최종 리뷰 I4: 느린 기기(10fps)에서도 한 바퀴가 실제 시간에 가깝게 따라온다 — 한 프레임에 여러 걸음(최대 12)
test('a slow frame catches up with several steps', () => {
  const world = new MachineWorld(R, [standing(1, 0.3, -0.2)]);
  const runner = new CycleRunner(world, new ClawBody(R, world), 0.3, -0.2);
  const t0 = world.time;
  runner.advance(0.1);
  expect(world.time - t0).toBeCloseTo(12 / 120, 5);
  world.dispose();
});

// 집게에 맞은 인형이 탱탱볼처럼 튕겨 나가지 않는다 (사용자 2026-11-01): 기본 접촉 강성(30Hz)에서는 내려가는 손가락이 인형을 2.3m/s로 쳐 냈다 — 접촉을 부드럽게(8Hz)
test('a doll knocked by the descending claw never flies off', () => {
  let worst = 0;
  // 채워진 기계(시뮬의 무작위 배치) 속 두 인형 사이로 내려간다 — 손가락이 인형을 밀며 들어가는 흔한 자리
  for (let seed = 1; seed <= 3; seed++) {
    const spots = settleSpots(R, fillMachine('bear', seededRandom(seed)));
    const world = new MachineWorld(R, spots);
    const [x, z] = [(spots[0][1] + spots[1][1]) / 2, (spots[0][3] + spots[1][3]) / 2];
    runCycle(world, new ClawBody(R, world), x, z, {
      frame: (_c, _m, phase) => { if (phase === 'descend' || phase === 'close') for (const uid of world.uids()) { const v = world.bodyOf(uid)!.linvel(); worst = Math.max(worst, Math.hypot(v.x, v.y, v.z)); } },
    });
    world.dispose();
  }
  expect(worst).toBeLessThan(0.8);
});

// 쥐었다 놓친 뒤에는 손가락을 다 오므리고 올라간다 — 쥘 때의 벌림 그대로 벌린 채 올라가면 어색하다 (사용자 2026-11-01)
test('after the doll slips the claw closes its fingers while lifting', () => {
  const world = new MachineWorld(R, [standing(1, 0.3, -0.2)]);
  world.settle(1);
  let openAtTop = 1;
  const r = runCycle(world, new ClawBody(R, world), 0.3, -0.2, { baseForce: 0.3, frame: (c, _m, phase) => { if (phase === 'carry') openAtTop = Math.min(openAtTop, c.open); } });
  expect(r.held).toBe(1); expect(r.slipped).toBe(true);
  expect(openAtTop).toBeLessThan(0.05);
  world.dispose();
});
