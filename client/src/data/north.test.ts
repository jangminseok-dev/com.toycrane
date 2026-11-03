import { expect, test } from 'vitest';
import type { Vec2 } from '../game/movement';
import { MAP_HALF, SPAWN_RADIUS } from '../world/layout';
import { PUSHERS, isPusher, nearestPusher } from './pushers';
import { RINGS, isRing, nearestRing } from './rings';
import { MACHINE_SPEC, OBSTACLES, frontSpot } from './storeLayout';

// 북쪽 구역(설계 2026-11-02 고리·미는 뽑기 §3·§4): 고리 10대(두 줄, 북쪽 벽 앞)와 미는 뽑기 4대가 모두 남쪽 광장 쪽(+z)을 본다.
// 고리 간격 2.1m(사용자 2026-11-03 '옆 기계 칸 간격을 살짝 벌려줘' — 1.84m는 옆 시점 카메라가 옆 기계에 걸렸다), 가운데 기계(R-3·R-8)는 제자리
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

test('ten ring machines R-1 to R-10 face the plaza in two rows', () => {
  expect(RINGS.map((r) => r.id)).toEqual(Array.from({ length: 10 }, (_, i) => `R-${i + 1}`));
  expect(RINGS.filter((r) => r.row === 'r1').map((r) => r.x)).toEqual([-11.4, -9.3, -7.2, -5.1, -3]);
  expect(RINGS.filter((r) => r.row === 'r2').map((r) => r.x)).toEqual([3, 5.1, 7.2, 9.3, 11.4]);
  for (const r of RINGS) { expect(r.z).toBe(-18); expect(r.ry).toBe(0); }
  expect(isRing('R-4')).toBe(true);
  expect(isRing('F-1')).toBe(false);
});

test('four pusher machines P-1 to P-4 face the plaza', () => {
  expect(PUSHERS.map((p) => [p.id, p.x, p.z, p.ry])).toEqual([['P-1', -4.2, -13.6, 0], ['P-2', -1.4, -13.6, 0], ['P-3', 1.4, -13.6, 0], ['P-4', 4.2, -13.6, 0]]);
  expect(isPusher('P-2')).toBe(true);
  expect(isPusher('R-2')).toBe(false);
});

test('every ring and pusher front is reachable and no obstacles overlap', () => {
  const fromSpawn = distancesFrom({ x: 0, z: -SPAWN_RADIUS });
  for (const m of [...RINGS, ...PUSHERS]) {
    expect(Number.isFinite(near(fromSpawn, frontSpot(m))), m.id).toBe(true);
    expect(free(frontSpot(m).x, frontSpot(m).z), `${m.id} front is clear`).toBe(true);
  }
  for (let a = 0; a < OBSTACLES.length; a++) for (let b = a + 1; b < OBSTACLES.length; b++) {
    const [ax0, az0, ax1, az1] = OBSTACLES[a], [bx0, bz0, bx1, bz1] = OBSTACLES[b];
    expect(Math.min(ax1, bx1) - Math.max(ax0, bx0) > 0 && Math.min(az1, bz1) - Math.max(az0, bz0) > 0, `${OBSTACLES[a]} × ${OBSTACLES[b]}`).toBe(false);
  }
  expect(nearestRing(frontSpot(RINGS[3]))?.id).toBe('R-4');
  expect(nearestPusher(frontSpot(PUSHERS[1]))?.id).toBe('P-2');
  expect(nearestRing({ x: 0, z: 0 })).toBeNull();
  expect(nearestPusher({ x: 0, z: 0 })).toBeNull();
});

// 미는 뽑기 사이로는 지나갈 수 있다(고리 줄은 북쪽 벽 앞이라 사이가 막다른 곳 — 인형 벽 쪽 줄과 같음)
test('players can walk between pusher machines', () => {
  for (let i = 0; i + 1 < PUSHERS.length; i++) expect(free((PUSHERS[i].x + PUSHERS[i + 1].x) / 2, PUSHERS[i].z), `${PUSHERS[i].id}|${PUSHERS[i + 1].id}`).toBe(true);
});
