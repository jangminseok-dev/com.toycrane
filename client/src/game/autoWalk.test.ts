import { expect, test } from 'vitest';
import { COUNTERS, OBSTACLES } from '../data/storeLayout';
import { AutoWalk, nearestCounter, routeTo } from './autoWalk';
import type { Vec2 } from './movement';

const walkable = (from: Vec2, pts: Vec2[]) => {
  let at = from;
  for (const p of pts) {
    for (let k = 1; k <= 20; k++) if (inside({ x: at.x + ((p.x - at.x) * k) / 20, z: at.z + ((p.z - at.z) * k) / 20 })) return false;
    at = p;
  }
  return true;
};
const inside = (p: Vec2) => OBSTACLES.some(([x0, z0, x1, z1]) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1);

// "코인이 없어요 · 교환소로": 탑·기계·교환소를 돌아서 가는 길 (설계 2026-10-31 §3.11)
test('a route to the coin counter goes around obstacles and ends at the goal', () => {
  const goal = { x: COUNTERS[0].window[0], z: COUNTERS[0].window[1] };
  const from = { x: 3, z: -5.2 }; // 섬 줄 앞, 탑과 2번 교환소 건너편
  const pts = routeTo(from, goal);
  expect(pts.at(-1)).toEqual(goal);
  let at = from;
  for (const p of pts) {
    for (let k = 1; k <= 20; k++) expect(inside({ x: at.x + ((p.x - at.x) * k) / 20, z: at.z + ((p.z - at.z) * k) / 20 })).toBe(false);
    at = p;
  }
});

test('auto walk follows the route point by point and stops when a hand takes over', () => {
  const walk = new AutoWalk();
  walk.start([{ x: 1, z: 0 }, { x: 1, z: 2 }], 0);
  expect(walk.next({ x: 0, z: 0 })).toEqual({ x: 1, z: 0 });
  expect(walk.next({ x: 1, z: 0.05 })).toEqual({ x: 1, z: 2 });
  expect(walk.counter).toBe(0);
  walk.cancel();
  expect(walk.next({ x: 1, z: 0.05 })).toBeNull();
  expect(walk.counter).toBeNull();
});

// Review Focus 4 (설계 2026-10-31 교환소 개편): 탑 둘레 어디서 출발해도 교환소 4곳 창구까지 장애물을 지나지 않고 걸어간다
test('every window is reachable from the hub', () => {
  expect(COUNTERS).toHaveLength(4);
  for (const c of COUNTERS) {
    const goal = { x: c.window[0], z: c.window[1] };
    expect(inside(goal)).toBe(false);
    for (const a of [0, 1.6, 3.2, 4.8]) {
      const from = { x: Math.cos(a) * 2.4, z: Math.sin(a) * 2.4 };
      const pts = routeTo(from, goal);
      expect(pts.at(-1)).toEqual(goal);
      expect(walkable(from, pts), `${c.id} from ${a}`).toBe(true);
    }
  }
});

// '교환소 가기': 걸어서 가장 가까운 교환소 창구로
test('the nearest counter by walking is chosen', () => {
  for (const c of COUNTERS) {
    const from = { x: c.window[0] + 0.5, z: c.window[1] + 1.5 };
    expect(nearestCounter(from).counter).toBe(c.id);
  }
});
