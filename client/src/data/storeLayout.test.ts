import { expect, test } from 'vitest';
import type { Vec2 } from '../game/movement';
import { MAP_HALF, PLAZA_RADIUS, SPAWN_RADIUS } from '../world/layout';
import { COUNTERS, MACHINES, OBSTACLES, frontSpot } from './storeLayout';

// 큰 홀 (설계 2026-11-01-toycrane-big-hall-design.md): 인형 24대는 번호·캐릭터 그대로 서쪽으로 옮기고, 모든 자리에 걸어갈 수 있다
const OLD_PAIRS = [
  'A-1:bunny', 'A-2:fox', 'A-3:penguin', 'A-4:chick', 'A-5:bear', 'A-6:raccoon', 'A-7:frog', 'A-8:pig', 'A-9:cat', 'A-10:squirrel', 'A-11:duck', 'A-12:sheep', 'A-13:dog',
  'C-1:owl', 'C-2:seal', 'C-3:cow', 'C-4:panda', 'C-5:deer', 'C-6:octopus', 'C-7:dino', 'C-8:hamster', 'C-9:hedgehog', 'C-10:whale', 'C-11:unicorn',
];

// 0.25m 격자, 장애물에서 0.35m 여유(e2e 길 찾기와 같은 규칙), 8방향 — 스폰에서 각 칸까지 걷는 거리(m)
const STEP = 0.25, MARGIN = 0.35, N = Math.round((MAP_HALF * 2) / STEP) + 1;
const at = (i: number) => -MAP_HALF + i * STEP, cellOf = (v: number) => Math.max(0, Math.min(N - 1, Math.round((v + MAP_HALF) / STEP)));
const free = (x: number, z: number) => !OBSTACLES.some(([x0, z0, x1, z1]) => x > x0 - MARGIN && x < x1 + MARGIN && z > z0 - MARGIN && z < z1 + MARGIN);
function distancesFrom(p: Vec2): Float64Array {
  const d = new Float64Array(N * N).fill(Infinity), start = cellOf(p.x) * N + cellOf(p.z);
  d[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= N || j >= N || !free(at(i), at(j))) continue;
      const n = i * N + j, nd = d[c] + STEP * Math.hypot(di, dj);
      if (nd < d[n] - 1e-9) { d[n] = nd; queue.push(n); }
    }
  }
  return d;
}
// 자리 둘레 네 칸 중 가장 가까운 거리 — 자리가 격자 사이에 있으면 반올림한 칸이 장애물 여유선에 걸릴 수 있다
const near = (d: Float64Array, p: Vec2) => {
  const i0 = Math.floor((p.x + MAP_HALF) / STEP), j0 = Math.floor((p.z + MAP_HALF) / STEP);
  return Math.min(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => d[Math.min(N - 1, i0 + a) * N + Math.min(N - 1, j0 + b)]));
};
const fromSpawn = distancesFrom({ x: SPAWN_RADIUS, z: 0 });
const reachable = (p: Vec2) => Number.isFinite(near(fromSpawn, p));
const routeLength = (from: Vec2, to: Vec2) => near(distancesFrom(from), to);

test('machine ids and kinds are unchanged', () => {
  expect(MACHINES.map((m) => `${m.id}:${m.kind}`)).toEqual(OLD_PAIRS);
});

test('doll machines stand in the west wing facing the plaza', () => {
  for (const m of MACHINES) { expect(m.x, m.id).toBeLessThan(-PLAZA_RADIUS); expect(m.ry, m.id).toBeCloseTo(Math.PI / 2); }
  expect(new Set(MACHINES.map((m) => m.row)).size).toBe(3);
});

test('every machine front and counter window is reachable from spawn', () => {
  for (const m of MACHINES) expect(reachable(frontSpot(m)), m.id).toBe(true);
  for (const c of COUNTERS) expect(reachable({ x: c.window[0], z: c.window[1] }), `counter ${c.id}`).toBe(true);
});

test('no two obstacles of machines, counters and decor overlap', () => {
  for (let a = 0; a < OBSTACLES.length; a++) for (let b = a + 1; b < OBSTACLES.length; b++) {
    const [ax0, az0, ax1, az1] = OBSTACLES[a], [bx0, bz0, bx1, bz1] = OBSTACLES[b];
    const w = Math.min(ax1, bx1) - Math.max(ax0, bx0), h = Math.min(az1, bz1) - Math.max(az0, bz0);
    expect(w > 0 && h > 0, `${OBSTACLES[a]} × ${OBSTACLES[b]}`).toBe(false);
  }
});

test('from the nearest counter every doll machine is a short walk', () => {
  const fromCounters = COUNTERS.map((c) => distancesFrom({ x: c.window[0], z: c.window[1] }));
  for (const m of MACHINES) {
    expect(Math.min(...fromCounters.map((d) => near(d, frontSpot(m)))), m.id).toBeLessThan(20);
  }
  expect(routeLength({ x: COUNTERS[0].window[0], z: COUNTERS[0].window[1] }, frontSpot(MACHINES[0]))).toBeLessThan(40);
});

// 걷기 카메라는 늘 북쪽(-z)을 보므로 교환소는 모두 남쪽(+z, ry 0)을 본다 (설계 2026-10-31 §3.12)
test('coin counters face the camera', () => {
  for (const c of COUNTERS) { expect(c.ry).toBe(0); expect(c.window[1]).toBeGreaterThan(c.z); }
});
