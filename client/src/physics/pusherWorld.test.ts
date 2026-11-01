import { beforeAll, expect, test } from 'vitest';
import { PUSHER, plateFront } from '../data/pushers';
import type { DollSpot } from '../net/protocol';
import { MACHINE_SPEC } from '../data/storeLayout';
import { DOLL_FLOOR } from '../world/machine';
import { PusherWorld } from './pusherWorld';
import { loadRapier, type Rapier } from './rapier';

// 미는 뽑기 물리(설계 2026-11-02 ring-hook §4): 턱 위 미니 인형을 3분의 1만 미는 판이 오가며 밀고, 쌓이면 앞 끝으로 떨어진다
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });
const { ledge, plate, drop } = PUSHER, TOP = DOLL_FLOOR + ledge.h;
const KINDS = ['bear', 'penguin', 'cat', 'duck', 'frog', 'bunny', 'chick', 'pig', 'seal', 'dog'];
const spot = (uid: number, x: number, y: number | null, z: number): DollSpot => [KINDS[uid % KINDS.length], x, y, z, 0, 0, 0, 1, uid % 6, 'n', 0, '', uid];
const run = (w: PusherWorld, s: number) => { for (let t = 0; t < s; t += 1 / 60) w.step(1 / 60); };
const dropped = (n: number) => Array.from({ length: n }, (_, i) => spot(i + 1, drop[0] + ((i % 3) - 1) * 0.04, null, drop[1]));

test('the plate pushes only a third of the ledge', () => {
  const zs = Array.from({ length: 300 }, (_, i) => plateFront((i / 300) * plate.period));
  expect(Math.min(...zs)).toBeCloseTo(ledge.z0, 4);
  expect(Math.max(...zs) - ledge.z0).toBeCloseTo((ledge.z1 - ledge.z0) / 3, 2);
});

test('dolls dropped on the ledge are pushed off the front edge as they pile up', () => {
  const one = new PusherWorld(R, dropped(1));
  one.setHoleOpen(true); run(one, 20);
  expect(one.fallen()).toEqual([]); // 하나만으로는 앞 끝까지 안 밀린다(3분의 1)
  const many = new PusherWorld(R, dropped(10));
  many.setHoleOpen(true); run(many, 40);
  expect(many.fallen().length).toBeGreaterThan(0);
}, 120_000);

test('a doll that rolls off the ledge side lands in the pile and is not won', () => {
  const w = new PusherWorld(R, [spot(1, ledge.x1 + 0.03, TOP + 0.02, 0)]);
  w.setHoleOpen(true); run(w, 3);
  const [p] = w.poses();
  expect(w.fallen()).toEqual([]);
  expect(p.p[1]).toBeLessThan(TOP - 0.02);
  expect(p.p[0]).toBeGreaterThan(ledge.x1);
});

test('after settling the plate touches no doll', () => {
  const w = new PusherWorld(R, dropped(7));
  w.setHoleOpen(true); run(w, 60);
  const before = new Map(w.poses().map((p) => [p.uid, p.p]));
  run(w, plate.period);
  for (const p of w.poses()) {
    const b = before.get(p.uid)!;
    expect(Math.hypot(p.p[0] - b[0], p.p[1] - b[1], p.p[2] - b[2]), `uid ${p.uid}`).toBeLessThan(0.003);
  }
}, 120_000);

test('no doll ends inside the plate or outside the walls', () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 8; k++) {
    const n = 3 + Math.floor(rand() * 8);
    const spots = Array.from({ length: n }, (_, i) => spot(i + 1, ledge.x0 + 0.08 + rand() * (ledge.x1 - ledge.x0 - 0.12), null, ledge.z0 + 0.04 + rand() * (ledge.z1 - ledge.z0 - 0.06)));
    const w = new PusherWorld(R, spots);
    w.setHoleOpen(true); run(w, 20);
    for (const p of w.poses()) {
      const [x, y, z] = p.p, out = y < DOLL_FLOOR - 0.15;
      if (out) continue; // 출구로 떨어짐
      expect(Math.abs(x)).toBeLessThan(0.57);
      expect(Math.abs(z)).toBeLessThan(0.51);
      expect(x < ledge.x1 && z < ledge.z0 - 0.01 && y < TOP + plate.h - 0.01, `uid ${p.uid} in the plate box`).toBe(false);
    }
  }
}, 180_000);

test('the same play gives the same ledge', () => {
  const a = new PusherWorld(R, dropped(6)), b = new PusherWorld(R, dropped(6));
  a.setHoleOpen(true); b.setHoleOpen(true); run(a, 10); run(b, 10);
  expect(a.poses()).toEqual(b.poses());
}, 60_000);

// 판을 하는 화면은 판 시작 때의 벽시계 시각(phase)에서 판을 이어 움직인다 — 그림(판 사이 시계)과 끊기지 않게, 첫 걸음에 순간이동하지 않게
test('a plate phase starts the plate where the clock says', () => {
  const w = new PusherWorld(R, [], 1.2);
  expect(w.plateZ()).toBeCloseTo(plateFront(1.2), 4);
  run(w, 0.5);
  expect(w.plateZ()).toBeCloseTo(plateFront(1.7), 2);
  w.dispose();
});

// 화면은 기계 번호로 물리 세계를 고른다 — 미는 뽑기면 판이 있는 세계(시작 시각 phase), 아니면 인형 기계
test('the crane world of a pusher machine has the plate', async () => {
  const { craneWorld } = await import('./craneWorld');
  const p = craneWorld(R, 'P-2', [], 0.4), d = craneWorld(R, 'A-1', []);
  expect(p).toBeInstanceOf(PusherWorld);
  expect((p as PusherWorld).phase).toBe(0.4);
  expect(d).not.toBeInstanceOf(PusherWorld);
  p.dispose(); d.dispose();
});

// 설계 ring-hook §4 '미는 판은 위에 인형이 얹히지 않는 모양': 판이 나와 있을 때 판 위에 떨어지거나 판 집 위에 떨어진 인형도
// 판이 들어갈 때 집 앞벽에 걸려 턱 위(판 앞)로 떨어진다 — 판 집 위나 판 뒤에 남아 영영 안 밀리는 인형이 없다
test('a doll dropped on the plate or its housing ends in front of the plate', () => {
  const cases: [number, number][] = [[ledge.z0 - 0.1, 0], [ledge.z0 + 0.06, plate.period / 2], [ledge.z0 - 0.04, plate.period / 2]];
  for (const [z, phase] of cases) {
    const w = new PusherWorld(R, [spot(1, drop[0], null, z)], phase);
    w.setHoleOpen(true); run(w, 20);
    const p = w.poses()[0];
    expect(w.fallen().length === 1 || p.p[2] > ledge.z0).toBe(true);
    w.dispose();
  }
});

// 최종 리뷰 I1·I2·I3 — 미는 뽑기 앉히기·멈춤 판정·턱 위 내리기
const rngOf = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };
// 서버 pusher_crane 처음 배치와 같은 규칙(칸 count개 + 턱 뒤쪽 on_ledge개, 모두 안 앉음)
const serverFresh = (seed: number): DollSpot[] => {
  const r = rngOf(seed), [W, D] = MACHINE_SPEC.play_half, out: DollSpot[] = [];
  for (let uid = 1; uid <= PUSHER.count + PUSHER.on_ledge; uid++) {
    const pile = uid <= PUSHER.count;
    const x = pile ? ledge.x1 + 0.06 + r() * (W - ledge.x1 - 0.06) : ledge.x0 + 0.08 + r() * (ledge.x1 - 0.06 - ledge.x0 - 0.08);
    const z = pile ? (r() * 2 - 1) * D : ledge.z0 + 0.04 + r() * 0.08;
    out.push([KINDS[Math.floor(r() * KINDS.length)], x, null, z, 0, 0, 0, 1, 0, 'n', 0, '', uid]);
  }
  return out;
};
const furthest = (a: { uid: number; p: number[] }[], b: { uid: number; p: number[] }[]) => Math.max(...a.map((p) => { const q = b.find((x) => x.uid === p.uid)!; return Math.sqrt((p.p[0] - q.p[0]) ** 2 + (p.p[1] - q.p[1]) ** 2 + (p.p[2] - q.p[2]) ** 2); }));

// I1: 화면이 새 기계를 앉히면(main.ts settleMachine과 같은 settling(3)) 턱·판 집 쪽 인형은 멈춘 채 끝나고(공중에 굳지 않음), 판 집 지붕 위로 옮겨진 인형이 없다
test('a fresh pusher machine settles at rest with nobody on the plate housing', () => {
  for (const seed of [2, 6, 7]) {
    const w = new PusherWorld(R, serverFresh(seed));
    const run_ = w.settling(3); while (!run_.next().done) { /* 끝까지 */ }
    const at = w.poses();
    expect(at.filter((p) => p.p[2] < ledge.z0 && p.p[0] < ledge.x1 && p.p[1] > TOP + 0.02).map((p) => p.uid)).toEqual([]);
    run(w, plate.period + 0.2);
    const side = (ps: { uid: number; p: number[] }[]) => ps.filter((p) => p.p[0] < ledge.x1 - 0.04); // 턱·판 집 쪽(칸 무더기와 낮은 턱에 걸친 인형은 무더기와 함께 조금씩 기어 따로 본다)
    expect(furthest(side(w.poses()), at)).toBeLessThan(0.01);
    w.dispose();
  }
}, 120_000);

// I2: 놓은 뒤 판이 한 주기 동안 아무것도 3mm 넘게 못 밀면 끝 — 늘 최대 15초를 채우지 않는다
test('a pusher play ends soon after the ledge goes quiet', async () => {
  const { ClawBody } = await import('./clawBody');
  const { runCycle } = await import('./clawCycle');
  const { craneSpec } = await import('../game/craneSpec');
  const w = new PusherWorld(R, serverFresh(3));
  w.settle(3);
  const target = w.poses().filter((p) => p.p[0] > ledge.x1 + 0.1).sort((a, b) => b.p[1] - a.p[1])[0];
  let settleFrom = 0;
  runCycle(w, new ClawBody(R, w), target.p[0], target.p[2], { ...craneSpec('P-1').cycle, phase: (n) => { if (n === 'settle') settleFrom = w.time; } });
  expect(w.time - settleFrom).toBeLessThan(PUSHER.settle.max - 2);
  w.dispose();
}, 120_000);

// I3: 턱(또는 판 집) 위에 인형 없이 내리면 손가락 끝은 턱 윗면에서 멈춘다 — 턱 속으로 꺼지지 않게(11cm 꺼졌다).
// 오므릴 때 끝이 2cm 안쪽으로 내려가는 것은 인형 기계 펠트 위에서와 같다
test('the claw stops on the ledge top where no doll is under it', async () => {
  const { ClawBody } = await import('./clawBody');
  const { runCycle } = await import('./clawCycle');
  const { craneSpec } = await import('../game/craneSpec');
  for (const [x, z] of [[drop[0], drop[1]], [-0.34, 0.15]] as const) {
    const w = new PusherWorld(R, []), claw = new ClawBody(R, w);
    let low = Infinity;
    runCycle(w, claw, x, z, { ...craneSpec('P-1').cycle, frame: (_c, _m, phase) => { if (phase === 'descend' || phase === 'close') low = Math.min(low, claw.tipsBottom()); } });
    expect(low).toBeGreaterThan(TOP - 0.02);
    w.dispose();
  }
}, 120_000);
