import { beforeAll, expect, test } from 'vitest';
import { MACHINE_SPEC } from '../data/storeLayout';
import type { DollSpot } from '../net/protocol';
import { stubCanvas } from '../test/canvasStub';
import { DOLL_FLOOR } from '../world/machine';
import { MachineWorld, type Rapier } from './machineWorld';
import { MACHINES } from '../data/storeLayout';
import { loadRapier } from './rapier';

beforeAll(stubCanvas);
let R: Rapier;
beforeAll(async () => { R = await loadRapier(); });

const [HX, HZ] = MACHINE_SPEC.hole;
const [W, D] = MACHINE_SPEC.play_half;
const spot = (uid: number, x: number, z: number, y: number | null = null): DollSpot => ['bear', x, y, z, 0, 0, 0, 1, 0, 'n', 0, '', uid];
// 구멍을 피해 9자리에 흩어 놓는다
const nine = (): DollSpot[] => [[0.3, 0.2], [0.1, -0.25], [-0.2, -0.25], [0.35, -0.1], [-0.05, 0.05], [0.2, 0.3], [-0.35, -0.3], [0.05, 0.3], [-0.05, 0.3]]
  .map(([x, z], i) => spot(i + 1, x, z));
const inBox = (p: [number, number, number]) => p[1] >= DOLL_FLOOR - 0.01 && Math.abs(p[0]) <= W + 0.15 && Math.abs(p[2]) <= D + 0.15;

// 물리 뽑기 설계 §4.2·§4.6: 안 앉은 인형(y null)은 천장에서 번호 순서로 떨어져 상자 안에 멈춘다
test('unsettled dolls fall and come to rest inside the box', () => {
  const world = new MachineWorld(R, nine());
  const used = world.settle(6);
  const poses = world.poses();
  expect(poses).toHaveLength(9);
  for (const p of poses) expect(inBox(p.p)).toBe(true);
  expect(world.movingPoses()).toHaveLength(0);
  expect(used).toBeLessThanOrEqual(6);
  world.dispose();
});

// Review Focus 3: 채우기 때는 구멍이 뚜껑으로 덮여 있어 굴러가도 빠지지 않는다
test('a refill doll rolling onto the hole stays in the box', () => {
  const world = new MachineWorld(R, [spot(1, HX + 0.05, HZ + 0.02)]);
  world.settle(4);
  expect(world.fallen()).toEqual([]);
  expect(world.poses()[0].p[1]).toBeGreaterThanOrEqual(DOLL_FLOOR - 0.01);
  world.dispose();
});

test('with the hole open a doll over it falls through and is reported', () => {
  const world = new MachineWorld(R, [spot(1, HX, HZ)]);
  world.setHoleOpen(true);
  world.settle(4);
  expect(world.fallen()).toEqual([1]);
  world.dispose();
});

// Review Focus 4: 느린 휴대폰의 긴 프레임에도 한 번에 네 번까지만 돈다
test('a long frame steps at most four times', () => {
  const world = new MachineWorld(R, [spot(1, 0, 0, DOLL_FLOOR)]);
  world.step(0.5);
  expect(world.time).toBeCloseTo(4 / 120);
  world.step(1 / 120);
  expect(world.time).toBeCloseTo(5 / 120);
  world.dispose();
});

test('settling is deterministic', () => {
  const a = new MachineWorld(R, nine()), b = new MachineWorld(R, nine());
  a.settle(6); b.settle(6);
  expect(a.poses()).toEqual(b.poses());
  a.dispose(); b.dispose();
});

test('stacked dolls do not interpenetrate', () => {
  const stack: DollSpot[] = [spot(1, 0, 0), spot(2, 0.02, 0.01), spot(3, -0.02, 0.02), spot(4, 0.3, 0.2), spot(5, 0.31, 0.19)];
  const world = new MachineWorld(R, stack);
  world.settle(6);
  expect(world.overlaps()).toBe(0);
  world.dispose();
});

test('a doll can be removed and the rest keep their bodies', () => {
  const world = new MachineWorld(R, nine());
  world.settle(6);
  world.remove(3);
  expect(world.poses().map((p) => p.uid)).toEqual([1, 2, 4, 5, 6, 7, 8, 9]);
  expect(world.bodyOf(4)).toBeTruthy();
  world.dispose();
});

// 최종 리뷰 C2: 키 큰 인형(고래 등)도 천장에 끼지 않고 떨어져 앉는다 — 모든 캐릭터·체형
test('every kind and body falls from the ceiling and lands', () => {
  const kinds = [...new Set(MACHINES.map((m) => m.kind))];
  for (const kind of kinds) for (const body of ['n', 'c', 's'] as const) {
    const world = new MachineWorld(R, [[kind, 0.1, null, -0.1, 0, 0, 0, 1, 0, body, 0, '', 1]]);
    world.settle(4);
    const y = world.poses()[0].p[1];
    expect(y, `${kind}/${body}`).toBeLessThan(DOLL_FLOOR + 0.5);
    expect(world.movingPoses(), `${kind}/${body}`).toHaveLength(0);
    world.dispose();
  }
});

// 최종 리뷰 I9: 앉히기 시간은 마지막 인형이 떨어진 뒤부터 센다 — 9개를 0.25초 간격으로 떨어뜨려도 settle(3)이면 모두 앉는다
test('settle time counts from the last drop', () => {
  const world = new MachineWorld(R, nine());
  const used = world.settle();
  expect(used).toBeLessThanOrEqual(2 + 6 + 0.01);
  expect(world.movingPoses()).toHaveLength(0);
  for (const p of world.poses()) expect(p.p[1]).toBeLessThan(DOLL_FLOOR + 0.6);
  world.dispose();
});

// 채우기로 떨어진 인형이 구멍 위에 걸치면(몸 공 하나라도 구멍 네모 안) 구멍에서 먼 빈 칸에 다시 떨어뜨린다 — 처음부터 걸친 건 거저 뽑기 (사용자 2026-10-31 밤)
test('refilled dolls never end up lying across the hole', () => {
  const [hx, hz] = MACHINE_SPEC.hole, half = 0.17;
  const edge = (uid: number, x: number, z: number): DollSpot => [uid === 1 ? 'bear' : 'frog', x, null, z, 0, 0, 0, 1, 0, 'n', 0, '', uid];
  // 구멍 턱 바로 밖(18cm)에 떨어뜨리면 넘어지며 구멍을 가로질러 눕는다 (규칙을 끄면 둘 다 걸친 채 남는다)
  const world = new MachineWorld(R, [edge(1, hx, hz - half - 0.01), edge(2, hx + half + 0.01, hz)]);
  world.settle();
  expect(world.straddling()).toEqual([]);
  for (const p of world.poses()) expect(p.p[1]).toBeGreaterThan(DOLL_FLOOR - 0.05);
  expect(world.poses()).toHaveLength(2);
  world.dispose();
});
