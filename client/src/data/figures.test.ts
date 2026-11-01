import { expect, test } from 'vitest';
import type { Vec2 } from '../game/movement';
import { MAP_HALF, SPAWN_RADIUS } from '../world/layout';
import { FIGURE, FIGURES, boxKindOf, isFigure, nearestFigure, variantOf, type BoxKind } from './figures';
import { MACHINE_SPEC, OBSTACLES, frontSpot } from './storeLayout';

// 9단계 피규어 뽑기(설계 2026-11-01-toycrane-figure-machine-design.md §3.1): 동쪽 구역 14대 전부 진짜 기계, 광장 쪽(−x)을 본다
const STEP = 0.25, MARGIN = 0.35, N = Math.round((MAP_HALF * 2) / STEP) + 1;
const at = (i: number) => -MAP_HALF + i * STEP, cellOf = (v: number) => Math.max(0, Math.min(N - 1, Math.round((v + MAP_HALF) / STEP)));
const free = (x: number, z: number) => !OBSTACLES.some(([x0, z0, x1, z1]) => x > x0 - MARGIN && x < x1 + MARGIN && z > z0 - MARGIN && z < z1 + MARGIN);
function distancesFrom(p: Vec2): Float64Array {
  const d = new Float64Array(N * N).fill(Infinity), start = cellOf(p.x) * N + cellOf(p.z);
  d[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], ci = Math.floor(c / N), cj = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= N || j >= N || !free(at(i), at(j))) continue;
      const n = i * N + j;
      if (d[c] + STEP < d[n]) { d[n] = d[c] + STEP; queue.push(n); }
    }
  }
  return d;
}
const near = (d: Float64Array, p: Vec2) => {
  const i0 = Math.floor((p.x + MAP_HALF) / STEP), j0 = Math.floor((p.z + MAP_HALF) / STEP);
  return Math.min(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => d[Math.min(N - 1, i0 + a) * N + Math.min(N - 1, j0 + b)]));
};

test('fourteen figure machines F-1 to F-14 face the plaza in two rows', () => {
  expect(FIGURES.map((f) => f.id)).toEqual(Array.from({ length: 14 }, (_, i) => `F-${i + 1}`));
  for (const [row, x] of [['f1', 13.2], ['f2', 18.4]] as const) {
    const r = FIGURES.filter((f) => f.row === row);
    expect(r.map((f) => f.x)).toEqual(Array(7).fill(x));
    expect(r.map((f) => f.z)).toEqual([-8.1, -5.4, -2.7, 0, 2.7, 5.4, 8.1]);
  }
  for (const f of FIGURES) expect(f.ry).toBeCloseTo(-Math.PI / 2, 6);
  expect(isFigure('F-3')).toBe(true);
  expect(isFigure('C-6')).toBe(false);
});

test('every figure machine front is reachable and does not overlap anything', () => {
  const fromSpawn = distancesFrom({ x: SPAWN_RADIUS, z: 0 });
  for (const f of FIGURES) expect(Number.isFinite(near(fromSpawn, frontSpot(f))), f.id).toBe(true);
  for (let a = 0; a < OBSTACLES.length; a++) for (let b = a + 1; b < OBSTACLES.length; b++) {
    const [ax0, az0, ax1, az1] = OBSTACLES[a], [bx0, bz0, bx1, bz1] = OBSTACLES[b];
    expect(Math.min(ax1, bx1) - Math.max(ax0, bx0) > 0 && Math.min(az1, bz1) - Math.max(az0, bz0) > 0, `${OBSTACLES[a]} × ${OBSTACLES[b]}`).toBe(false);
  }
  expect(nearestFigure(frontSpot(FIGURES[2]))?.id).toBe('F-3');
  expect(nearestFigure({ x: 0, z: 0 })).toBeNull();
  const f = frontSpot(FIGURES[0]);
  expect(nearestFigure({ x: f.x, z: f.z + MACHINE_SPEC.reach + 0.1 })).toBeNull();
});

// 인형 기계처럼 기계 사이로 지나갈 수 있다(사용자 2026-11-01 "사이사이 칸을 넓혀서 지나갈 수 있게")
test('players can walk between neighbouring figure machines', () => {
  const row = FIGURES.filter((f) => f.row === 'f1');
  for (let i = 0; i + 1 < row.length; i++) expect(free(row[i].x, (row[i].z + row[i + 1].z) / 2), `${row[i].id}|${row[i + 1].id}`).toBe(true);
});

// 큰 상자 두 종류(설계 §8): 첫째 줄 F-1~F-7은 긴 상자, 둘째 줄 F-8~F-14는 넓은 정사각형 상자
test('every figure machine has a box kind', () => {
  FIGURES.forEach((f, i) => expect(boxKindOf(f.id), f.id).toBe(i < 7 ? 'long' : 'square'));
  expect(() => boxKindOf('C-1')).toThrow();
});

// 막대 사이 틈은 눕힌 상자 길이보다 좁고(눕힌 채로는 안 빠짐), 세운 상자의 단면보다는 넓다(세우면 빠짐) — 설계 §3.2·§8.3.
// 긴 상자는 어느 쪽으로 돌려 세워도 빠지고, 정사각형은 누운 채로는 어떻게 돌려도 걸치며 옆으로 세워야 빠진다
test('each box is longer than its bar gap but stands through it', () => {
  const span = (k: BoxKind) => variantOf(k).gap + 2 * FIGURE.bars.radius;
  const long = variantOf('long'), square = variantOf('square');
  expect(long.box.h).toBeGreaterThan(span('long'));
  expect(Math.hypot(long.box.w, long.box.d) + 0.016).toBeLessThan(long.gap);
  expect(square.box.h).toBeGreaterThan(span('square'));
  expect(square.box.w).toBeGreaterThan(span('square'));
  expect(square.box.d + 0.016).toBeLessThan(square.gap);
});

// 앞뒤 막힘(설계 §8.3): 앞 막대와 앞판, 뒤 막대와 받침 막대, 받침 막대와 뒤 벽 사이 틈이 모두 상자 두께보다 좁다 — 앞뒤로는 빠질 곳이 없다
test('the guards close the front and back', () => {
  const r = FIGURE.bars.radius, { front, back_bar, back_wall } = FIGURE.guards;
  for (const k of ['long', 'square'] as const) {
    const d = variantOf(k).box.d;
    expect(front - r, `${k} front`).toBeLessThan(d);
    expect(back_bar - 2 * r, `${k} support`).toBeLessThan(d);
    expect(back_wall - back_bar - r, `${k} wall`).toBeLessThan(d);
  }
});
