import { expect, test } from 'vitest';
import { routeTo } from '../game/autoWalk';
import { FIGURES } from './figures';
import { PUSHERS } from './pushers';
import { RINGS } from './rings';
import { STAFF, postOf, sideSpot, walkSeconds, zoneOf } from './staff';
import { MACHINES, OBSTACLES } from './storeLayout';

const ids = [...MACHINES, ...FIGURES, ...RINGS, ...PUSHERS].map((m) => m.id);
const free = (x: number, z: number) => !OBSTACLES.some(([x0, z0, x1, z1]) => x > x0 - 0.2 && x < x1 + 0.2 && z > z0 - 0.2 && z < z1 + 0.2);
const length = (from: { x: number; z: number }, pts: { x: number; z: number }[]) => pts.reduce((s, p, i) => s + Math.hypot(p.x - (i ? pts[i - 1] : from).x, p.z - (i ? pts[i - 1] : from).z), 0);

// 상주 직원(설계 2026-11-24): 서버 domain/staff.py와 같은 자리(숫자 고정, 서버 test_side_spots_match_the_screen과 같음)
test('zoneOf and sideSpot match the server', () => {
  expect([zoneOf('A-1'), zoneOf('F-1'), zoneOf('R-1'), zoneOf('P-1'), zoneOf('X-1')]).toEqual(['doll', 'figure', 'hook', 'pusher', null]);
  const expected: Record<string, [number, number]> = { 'A-1': [-16.65, -8.3], 'F-1': [9.65, -9.25], 'R-1': [-12.45, -17.45], 'P-1': [-5.35, -13.05] };
  for (const [m, [x, z]] of Object.entries(expected)) { const s = sideSpot(m); expect(s.x).toBeCloseTo(x, 3); expect(s.z).toBeCloseTo(z, 3); }
});

// 모든 기계: 그 구역 대기 자리에서 길이 있고, 걷는 시간이 5초 안쪽이며, 일정대로 걸으면 손님 걷기보다 35% 넘게 빠르지 않다
test('every machine side spot is reachable from its zone post within the walk time', () => {
  for (const id of ids) {
    const zone = zoneOf(id)!, post = postOf(zone), side = sideSpot(id);
    expect(free(post.x, post.z), zone).toBe(true);
    expect(free(side.x, side.z), id).toBe(true);
    const path = routeTo(post, side), t = walkSeconds(post, side), len = length(post, path);
    expect(path.at(-1), id).toEqual(side);
    expect(t, id).toBeLessThanOrEqual(STAFF.walk_max);
    expect(len / t, `${id} ${len.toFixed(2)}m in ${t.toFixed(2)}s`).toBeLessThanOrEqual(STAFF.speed * 1.35);
  }
});
