import { beforeAll, expect, test } from 'vitest';
import { DOLLS } from '../data/catalog';
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

// 사용자: '끝까지 밀어 주는 게 아니라 1/3 정도만' — 턱 깊이의 30~34%
test('the plate pushes only about a third of the ledge', () => {
  const zs = Array.from({ length: 300 }, (_, i) => plateFront((i / 300) * plate.period));
  expect(Math.min(...zs)).toBeCloseTo(ledge.z0, 4);
  const share = (Math.max(...zs) - ledge.z0) / (ledge.z1 - ledge.z0);
  expect(share).toBeGreaterThanOrEqual(0.3); expect(share).toBeLessThanOrEqual(0.34);
});

test('dolls dropped on the ledge are pushed off the front edge as they pile up', () => {
  const one = new PusherWorld(R, dropped(1), true);
  one.setHoleOpen(true); run(one, 20);
  expect(one.fallen()).toEqual([]); // 하나만으로는 앞 끝까지 안 밀린다(3분의 1)
  const many = new PusherWorld(R, dropped(10), true);
  many.setHoleOpen(true); run(many, 40);
  expect(many.fallen().length).toBeGreaterThan(0);
}, 120_000);

// 판이 미는 자리(들어간 판 앞 16cm)에서 턱 오른쪽 끝에 걸친 인형 — 판에 밀려 깨어 옆으로 떨어진다(판이 안 닿는 자리의 걸친 인형은
// 저장된 무더기처럼 잠들어 그대로 있다)
test('a doll that rolls off the ledge side lands in the pile and is not won', () => {
  const w = new PusherWorld(R, [spot(1, ledge.x1 + 0.03, TOP + 0.02, ledge.z0 + 0.16)], true);
  w.setHoleOpen(true); run(w, 3);
  const [p] = w.poses();
  expect(w.fallen()).toEqual([]);
  expect(p.p[1]).toBeLessThan(TOP - 0.02);
  expect(p.p[0]).toBeGreaterThan(ledge.x1);
});

test('after settling the plate touches no doll', () => {
  const w = new PusherWorld(R, dropped(7), true);
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
    const w = new PusherWorld(R, spots, true);
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
  const a = new PusherWorld(R, dropped(6), true), b = new PusherWorld(R, dropped(6), true);
  a.setHoleOpen(true); b.setHoleOpen(true); run(a, 10); run(b, 10);
  expect(a.poses()).toEqual(b.poses());
}, 60_000);

// 판을 하는 화면은 판 시작 때의 벽시계 시각(phase)에서 판을 이어 움직인다 — 그림(판 사이 시계)과 끊기지 않게, 첫 걸음에 순간이동하지 않게
test('a plate phase starts the plate where the clock says', () => {
  const w = new PusherWorld(R, [], true, 1.2);
  expect(w.plateZ()).toBeCloseTo(plateFront(1.2), 4);
  run(w, 0.5);
  expect(w.plateZ()).toBeCloseTo(plateFront(1.7), 2);
  w.dispose();
});

// 화면은 기계 번호로 물리 세계를 고른다 — 미는 뽑기면 판이 있는 세계(시작 시각 phase), 아니면 인형 기계
test('the crane world of a pusher machine has the plate', async () => {
  const { craneWorld } = await import('./craneWorld');
  const p = craneWorld(R, 'P-2', [], true), d = craneWorld(R, 'A-1', []);
  expect(p).toBeInstanceOf(PusherWorld);
  expect((p as PusherWorld).running).toBe(true);
  expect(d).not.toBeInstanceOf(PusherWorld);
  p.dispose(); d.dispose();
});

// 설계 ring-hook §4 '미는 판은 위에 인형이 얹히지 않는 모양': 판이 나와 있을 때 판 위에 떨어지거나 판 집 위에 떨어진 인형도
// 판이 들어갈 때 집 앞벽에 걸려 턱 위(판 앞)로 떨어진다 — 판 집 위나 판 뒤에 남아 영영 안 밀리는 인형이 없다
test('a doll dropped on the plate or its housing ends in front of the plate', () => {
  const cases: [number, number][] = [[ledge.z0 - 0.1, 0], [ledge.z0 + 0.06, plate.period / 2], [ledge.z0 - 0.04, plate.period / 2]];
  for (const [z, phase] of cases) {
    const w = new PusherWorld(R, [spot(1, drop[0], null, z)], true, phase);
    w.setHoleOpen(true); run(w, 20);
    const p = w.poses()[0];
    expect(w.fallen().length === 1 || p.p[2] > ledge.z0 + plate.stroke, `z ${p.p[2].toFixed(3)}`).toBe(true); // 판이 가장 나온 앞면보다 앞(최종 리뷰 M5 — z0만 넘으면 판 앞 어디든 참이었다)
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

// 사용자 2026-11-02: 놓은 뒤 결과까지 너무 길어 지루하다 — 판은 놓은 뒤 한 번 끝까지 밀고(3~6초) 멈추고, 그 뒤 잠깐 그대로면 끝
test('a pusher play ends within a few seconds of letting go', async () => {
  const { ClawBody } = await import('./clawBody');
  const { runCycle } = await import('./clawCycle');
  const { craneSpec } = await import('../game/craneSpec');
  const waits: number[] = [];
  for (const seed of [1, 2, 3, 4]) {
    const w = new PusherWorld(R, serverFresh(seed), true);
    w.settle(3);
    const target = w.poses().filter((p) => p.p[0] > ledge.x1 + 0.1).sort((a, b) => b.p[1] - a.p[1])[0];
    let settleFrom = 0;
    runCycle(w, new ClawBody(R, w), target.p[0], target.p[2], { ...craneSpec('P-1').cycle, phase: (n) => { if (n === 'settle') settleFrom = w.time; } });
    waits.push(w.time - settleFrom);
    w.dispose();
  }
  expect(Math.max(...waits), JSON.stringify(waits)).toBeLessThan(2 * plate.period + PUSHER.settle.still + 1);
}, 240_000);

// 사용자 2026-11-02: 코인을 넣지 않으면 판은 멈춰 있고(들어가 있음), 넣으면 들어가 있던 자리부터 앞뒤로 — 놓은 뒤 한 왕복이 지나고
// 처음 들어갈 때 멈춘다. 마지막 왕복은 늘 놓은 뒤에 시작해 떨어진 인형을 끝까지 민다(왕복 끝에 놓으면 인형이 닿기 전에 멈췄다, 사진 217)
test('the plate moves only during a play and stops in after the release', () => {
  const idle = new PusherWorld(R, []);
  run(idle, 2);
  expect(idle.plateZ()).toBeCloseTo(ledge.z0, 4);
  expect(idle.plateMoving()).toBe(false);
  idle.dispose();
  const w = new PusherWorld(R, [], true);
  expect(w.plateZ()).toBeCloseTo(ledge.z0, 4); // 들어가 있던 자리부터
  run(w, 1);
  expect(w.plateZ()).toBeGreaterThan(ledge.z0 + 0.05);
  w.afterRelease(); // 1초에 놓음 → 4초 뒤 처음 들어가는 6초에 멈춤
  run(w, 4.8);
  expect(w.plateMoving()).toBe(true);
  run(w, 0.4);
  expect(w.plateMoving()).toBe(false);
  expect(w.plateZ()).toBeCloseTo(ledge.z0, 3);
  run(w, 2);
  expect(w.plateZ()).toBeCloseTo(ledge.z0, 4);
  w.dispose();
});

test('after the release the plate still makes one full push', () => {
  const w = new PusherWorld(R, [], true);
  run(w, plate.period - 0.05); // 왕복이 막 끝나 갈 때 놓는다
  const from = w.time;
  w.afterRelease();
  let reach = 0;
  while (w.plateMoving()) { w.step(1 / 60); if (w.time > from + 0.5) reach = Math.max(reach, w.plateZ() - ledge.z0); }
  expect(reach).toBeCloseTo(plate.stroke, 2); // 인형이 내려앉은 뒤(0.5초)에도 끝까지 민다
  expect(w.time - from).toBeLessThanOrEqual(2 * plate.period + 0.02);
  w.dispose();
});

// I3: 턱(또는 판 집) 위에 인형 없이 내리면 손가락 끝은 턱 윗면에서 멈춘다 — 턱 속으로 꺼지지 않게(11cm 꺼졌다).
// 오므릴 때 끝이 2cm 안쪽으로 내려가는 것은 인형 기계 펠트 위에서와 같다
test('the claw stops on the ledge top where no doll is under it', async () => {
  const { ClawBody } = await import('./clawBody');
  const { runCycle } = await import('./clawCycle');
  const { craneSpec } = await import('../game/craneSpec');
  for (const [x, z] of [[drop[0], drop[1]], [-0.34, 0.15]] as const) {
    const w = new PusherWorld(R, [], true), claw = new ClawBody(R, w);
    let low = Infinity;
    runCycle(w, claw, x, z, { ...craneSpec('P-1').cycle, frame: (_c, _m, phase) => { if (phase === 'descend' || phase === 'close') low = Math.min(low, claw.tipsBottom()); } });
    expect(low).toBeGreaterThan(TOP - 0.02);
    w.dispose();
  }
}, 120_000);

// 라이브 휴대폰 점검(CPU 4배 느리게): 겨누는 동안 미는 뽑기만 프레임이 40fps로 떨어졌다 — 저장된 자리에서 시작한 칸 무더기가 잠들지 않고 기며
// 물리·꼭짓점 다시 쓰기를 매 프레임 했다. 앉은 인형은 잠든 채 시작하고, 판(턱 위)·집게가 건드린 인형만 깬다
test('a saved pile sleeps while aiming but the plate still pushes the ledge', () => {
  const settled = new PusherWorld(R, serverFresh(4));
  settled.settle(3);
  const saved = settled.poses().map((p) => { const s = settled.spotOf(p.uid)!; return [s[0], p.p[0], p.p[1], p.p[2], ...p.q, s[8], s[9], s[10], s[11], s[12]] as DollSpot; });
  settled.dispose();
  const front = spot(99, ledge.x0 + 0.1, TOP, ledge.z0 + plate.stroke * 0.6); // 판이 닿는 자리의 턱 위 인형 — 낮은 턱에서 멀리(깊은 턱에선 밀리다 옆으로 굴러 무더기에 떨어질 수 있다)
  const w = new PusherWorld(R, [...saved, front], true);
  w.setHoleOpen(true);
  run(w, 1 / 30); // 저장된 자리끼리 조금 겹친 것을 엔진이 첫 걸음에 풀고 나서부터 잰다(재우기는 첫 걸음 뒤)
  const before = w.poses();
  run(w, plate.period + 0.5);
  const after = w.poses(), moved = (uid: number) => { const a = before.find((p) => p.uid === uid)!.p, b = after.find((p) => p.uid === uid)!.p; return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2); };
  const pile = saved.filter((s) => s[1] > ledge.x1 + 0.04).map((s) => s[12]);
  // 무더기는 계속 기지 않고 잠든 채 끝난다 — 깊은 턱에선 낮은 턱에 기댄 인형이 판 끝에 한 번 스쳐 몇 mm 내려앉을 수 있다
  expect(Math.max(...pile.map(moved))).toBeLessThan(0.005);
  expect(pile.every((u) => w.bodyOf(u)!.isSleeping())).toBe(true);
  expect(moved(99)).toBeGreaterThan(0.01);
  w.dispose();
}, 120_000);

// 라이브 휴대폰 점검: 미는 뽑기에서 '잡기'를 누르는 순간 한 번 100ms 멈칫 — 집게가 내려갈 높이를 잴 때 손이 닿지 않는 인형 27개까지 다 봤다.
// 손 닿는 인형만 보면 인형 기계(9개)와 비슷한 시간, 잰 결과는 같다
test('the claw plans only against dolls within reach', async () => {
  const { ClawBody } = await import('./clawBody');
  const { MachineWorld } = await import('./machineWorld');
  const { fillMachine, seededRandom, settleSpots } = await import('../../sim/world');
  const pw = new PusherWorld(R, serverFresh(5)); pw.settle(3);
  const dw = new MachineWorld(R, settleSpots(R, fillMachine('bear', seededRandom(1))));
  const time = (w: InstanceType<typeof MachineWorld>) => { const c = new ClawBody(R, w); c.plan(0.1, 0); const t0 = performance.now(); for (let i = 0; i < 10; i++) c.plan(0.05 + i * 0.03, (i % 3) * 0.1 - 0.1); const ms = performance.now() - t0; c.dispose(); return ms; };
  time(dw);
  expect(time(pw) / 10).toBeLessThan(6); // 한 번 재기 6ms 안(모든 인형을 볼 때 7.5ms — 휴대폰 4배면 30ms에 다른 일이 겹쳐 100ms 멈칫)
  // 손 닿는 인형만 봐도 잰 결과(높이·벌림·노린 인형)는 같다
  const near = pw.poses().filter((p) => Math.hypot(p.p[0] - 0.2, p.p[2]) < 0.3).map((p) => { const s = pw.spotOf(p.uid)!; return [s[0], p.p[0], p.p[1], p.p[2], ...p.q, s[8], s[9], s[10], s[11], s[12]] as DollSpot; });
  const nw = new PusherWorld(R, near);
  expect(new ClawBody(R, nw).plan(0.2, 0)).toEqual(new ClawBody(R, pw).plan(0.2, 0));
  pw.dispose(); dw.dispose(); nw.dispose();
}, 120_000);


// 진짜 미는 판은 집에서 나오는 덩어리라 뒤에 틈이 없다 — 판이 나와 있을 때 판 뒤 턱에 떨어진 인형이 판이 들어갈 때 뒤로 밀려 집 앞벽과 판 사이에 끼어
// 판 위로 올라타 계속 흔들렸다(놓은 뒤 멈춤 판정이 15초를 다 채움). 판이 가장 나와도 판 뒤는 집 안
test('nothing can fall behind the plate', () => {
  const w = new PusherWorld(R, [], true, plate.period / 2); // 판이 가장 나온 때
  const back = w.plateZ() - w.plateDepth();
  expect(back).toBeLessThan(ledge.z0);
  w.dispose();
});

// 최종 리뷰 M4: 턱·판 집이 왼쪽 벽까지 — 벽과 턱 사이 2cm 바닥 없는 홈이 있었다(빠지면 당첨으로 셈)
test('the ledge and the plate housing reach the left wall', async () => {
  const { WALL_MARGIN } = await import('./machineWorld');
  expect(ledge.x0).toBeLessThanOrEqual(-(MACHINE_SPEC.play_half[0] + WALL_MARGIN) + 1e-9);
});

// 남겨 둔 것 고침: 집게가 건드려 깬 칸 무더기는 조용해지면 다시 잠든다 — 부드러운 맞닿음 때문에 가벼운 미니 인형이 1~3cm씩 계속 기었다
test('a disturbed pile goes back to sleep instead of creeping', async () => {
  const { ClawBody } = await import('./clawBody');
  const { runCycle } = await import('./clawCycle');
  const { craneSpec } = await import('../game/craneSpec');
  const worst: number[] = [];
  for (const seed of [8, 9, 10]) {
    const w = new PusherWorld(R, serverFresh(seed), true);
    w.settle(3);
    const target = w.poses().filter((p) => p.p[0] > ledge.x1 + 0.1).sort((a, b) => b.p[1] - a.p[1])[0];
    runCycle(w, new ClawBody(R, w), target.p[0], target.p[2], craneSpec('P-1').cycle);
    const pile = () => w.poses().filter((p) => p.p[0] > ledge.x1 + 0.04 && p.p[1] > DOLL_FLOOR - 0.1);
    run(w, 1); // 판이 끝난 직후 내려앉는 것은 빼고, 그 뒤 계속 기는지 본다
    const a = pile();
    run(w, 3);
    worst.push(furthest(pile(), a));
    w.dispose();
  }
  expect(Math.max(...worst), JSON.stringify(worst)).toBeLessThan(0.003);
}, 240_000);

// 턱 앞 끝을 넘은 인형은 출구로 빠진다(무게 중심이 덜 넘어 턱 위로 되돌아가는 것은 괜찮다) — 턱을 앞으로 늘려 출구(턱 앞 끝 ~ 앞 벽)가 14cm로 좁아지자 미니 인형이 턱과 앞 벽 사이에
// 끼어 안 나왔다(사용자 2026-11-02 사진 218). 24종 × 선 채·엎드림·옆으로 누움, 몸 가운데가 앞 끝을 막 넘은 자리
test('no doll gets wedged between the ledge front and the front wall', () => {
  const s2 = Math.SQRT1_2, poses: [number, number, number, number][] = [[0, 0, 0, 1], [s2, 0, 0, s2], [0, 0, s2, s2]];
  const stuck: string[] = [];
  Object.keys(DOLLS).forEach((kind, k) => poses.forEach((q, j) => {
    const at: DollSpot = [kind, (ledge.x0 + ledge.x1) / 2, TOP + 0.06, ledge.z1 + 0.03, ...q, k % 6, 'n', 0, '', 1];
    const w = new PusherWorld(R, [at], true);
    w.setHoleOpen(true); run(w, 3);
    const [p] = w.poses(), onLedge = p.p[2] < ledge.z1 && p.p[1] > TOP;
    if (w.fallen().length !== 1 && !onLedge) stuck.push(`${kind}#${j} ${p.p.map((v) => v.toFixed(2))}`); // 턱 위로 되돌아갔거나 빠졌거나, 그 사이에 끼면 안 된다
    w.dispose();
  }));
  expect(stuck).toEqual([]);
}, 120_000);
