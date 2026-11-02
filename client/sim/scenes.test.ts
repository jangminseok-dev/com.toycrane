import { beforeAll, expect, test } from 'vitest';
import { CLAW } from '../src/data/claw';
import { MACHINE_SPEC } from '../src/data/storeLayout';
import type { DollSpot } from '../src/net/protocol';
import { ClawBody } from '../src/physics/clawBody';
import { runCycle, type CyclePhase } from '../src/physics/clawCycle';
import { MachineWorld, type Rapier } from '../src/physics/machineWorld';
import { loadRapier } from '../src/physics/rapier';
import { DOLL_FLOOR } from '../src/world/machine';
import { headAt, settleSpots } from './world';

// 고수의 장면 재현 (물리 뽑기 설계 §1·§8.2): 손으로 짠 기계 상태에서 시작한다
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const [HX, HZ] = MACHINE_SPEC.hole, [W, D] = MACHINE_SPEC.play_half;
const drop = (uid: number, x: number, z: number): DollSpot => ['bear', x, null, z, 0, 0, 0, 1, 0, 'n', 0, '', uid];
const standing = (uid: number, x: number, z: number): DollSpot => ['bear', x, DOLL_FLOOR, z, 0, 0, 0, 1, 0, 'n', 0, '', uid];
const distHole = (s: DollSpot) => Math.hypot(s[1] - HX, s[3] - HZ);
const inBox = (p: [number, number, number]) => p[1] >= DOLL_FLOOR - 0.01 && Math.abs(p[0]) <= W + 0.15 && Math.abs(p[2]) <= D + 0.15;
const tiltOf = (q: [number, number, number, number]) => Math.acos(Math.min(1, Math.max(-1, 1 - 2 * (q[0] * q[0] + q[2] * q[2])))) * 180 / Math.PI;

// 구멍 옆 탑: 누운 인형 둘을 나란히 두고 그 위에 하나를 가로질러 얹어 물리로 앉힌다 (고수가 쌓아 둔 상태)
const S = Math.SQRT1_2;
// 눕힘: along 'x'면 머리가 +x 쪽(z축 −90°), 'z'면 머리가 +z 쪽(x축 +90°). 원점(발)이 (x, y, z)
const lying = (uid: number, x: number, y: number, z: number, along: 'x' | 'z'): DollSpot =>
  ['bear', x, y, z, along === 'x' ? 0 : S, 0, along === 'x' ? -S : 0, S, 0, 'n', 0, '', uid];
function towerBesideHole(): DollSpot[] {
  for (const dx of [0.16, 0.2, 0.24]) for (const dy of [0.3, 0.34]) {
    const x = HX + 0.17 + dx, z = HZ;
    const spots = settleSpots(R, [lying(1, x, DOLL_FLOOR + 0.11, z - 0.1, 'x'), lying(2, x, DOLL_FLOOR + 0.11, z + 0.1, 'x'), lying(3, x + 0.12, DOLL_FLOOR + dy, z - 0.16, 'z')]);
    const top = spots.filter((s) => (s[2] ?? 0) > DOLL_FLOOR + 0.12 && distHole(s) < 0.55);
    if (top.length) return spots;
  }
  throw new Error('no tower formed');
}

test('a doll resting on a tower beside the hole goes in with a small lift', () => {
  const spots = towerBesideHole();
  const top = spots.filter((s) => (s[2] ?? 0) > DOLL_FLOOR + 0.12 && distHole(s) < 0.55).sort((a, b) => (b[2] ?? 0) - (a[2] ?? 0))[0];
  const head = headAt(top);
  const world = new MachineWorld(R, spots);
  const r = runCycle(world, new ClawBody(R, world), head.x, head.z, { baseForce: 12 }); // 걸쳐진 인형이 구멍으로 넘어가는 모양을 보는 장면 — 힘은 넉넉히
  world.dispose();
  expect(r.held).toBe(top[12]);
  expect(r.won).toContain(top[12]);
});

// 구멍 옆에 누운 인형의 아랫부분(발 쪽)을 잡아 들면 머리가 처지며 기울고, 그대로 구멍으로 넘어간다 (설계 §1의 2, §9.6)
test('grabbing the lower body of a doll lying beside the hole tips it in', () => {
  const x0 = HX + 0.17 + 0.08; // 발이 구멍 쪽, 머리는 +x로 누움
  const world = new MachineWorld(R, [lying(1, x0, DOLL_FLOOR + 0.11, HZ, 'x')]);
  world.settle(2);
  const feet = world.poses()[0].p;
  let maxTilt = 0;
  const r = runCycle(world, new ClawBody(R, world), feet[0] + 0.06, feet[2], {
    baseForce: 20, // 기울어 넘어가는 모양을 보는 장면 — 힘은 넉넉히
    frame: (_c, _m, phase: CyclePhase) => { if (phase === 'lift' || phase === 'carry') { const p = world.poses().find((q) => q.uid === 1); if (p) maxTilt = Math.max(maxTilt, tiltOf(p.q)); } },
  });
  world.dispose();
  expect(r.held).toBe(1);
  expect(maxTilt).toBeGreaterThan(30);
  expect(r.won).toEqual([1]);
});

// 힘은 게임 집게 힘(base_force) 둘레에서 찾는다 — 숫자로 1.8~4를 박아 두었더니 구멍 38cm·기계 5% 키움(90896e9) 뒤로는 그 힘이 다
// 들어 올리다 놓쳐 이 장면이 안 나왔다(2026-11-02 사용자 '실패하면 안 되는 것 아닌가')
test('a far doll dropped mid-carry lands near the hole and stays in the box', () => {
  const far = { x: 0.4, z: -0.3 };
  let found: { force: number; pose: [number, number, number] } | null = null;
  for (const force of [0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.2, 1.3].map((k) => k * CLAW.base_force)) {
    const world = new MachineWorld(R, [standing(1, far.x, far.z)]);
    const head = headAt(standing(1, far.x, far.z));
    let dropPhase: CyclePhase | null = null, was = false;
    const claw = new ClawBody(R, world);
    const r = runCycle(world, claw, head.x, head.z, { baseForce: force, frame: (_c, _m, phase) => { const h = claw.held() !== null; if (was && !h && !dropPhase) dropPhase = phase; was = h; } });
    const pose = r.poses.find((p) => p.uid === 1)?.p;
    world.dispose();
    if (r.slipped && dropPhase === 'carry' && pose) { found = { force, pose }; break; }
  }
  expect(found).not.toBeNull();
  const p = found!.pose;
  expect(inBox(p)).toBe(true);
  expect(Math.hypot(p[0] - far.x, p[2] - far.z)).toBeGreaterThan(0.15); // 원래 자리에서 옮겨 왔다
});

test('towers survive a play that does not touch them', () => {
  const tower = towerBesideHole();
  const spots = [...tower, standing(9, 0.38, -0.3)];
  const world = new MachineWorld(R, spots);
  const before = new Map(world.poses().map((p) => [p.uid, p.p]));
  const head = headAt(standing(9, 0.38, -0.3));
  runCycle(world, new ClawBody(R, world), head.x, head.z, { baseForce: 60 });
  const after = new Map(world.poses().map((p) => [p.uid, p.p]));
  world.dispose();
  for (const s of tower) {
    const a = before.get(s[12])!, b = after.get(s[12]);
    expect(b).toBeTruthy();
    expect(Math.hypot(a[0] - b![0], a[1] - b![1], a[2] - b![2])).toBeLessThan(0.02);
  }
});
