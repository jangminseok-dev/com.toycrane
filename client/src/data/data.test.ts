import { expect, test } from 'vitest';
import { DOLLS, isRare } from './catalog';
import { COUNTERS, MACHINES, frontSpot, nearestMachine } from './storeLayout';

test('catalog and layout match the shared files', () => {
  expect(Object.keys(DOLLS)).toHaveLength(28);
  expect(isRare('pearlpenguin')).toBe(true);
  expect(MACHINES).toHaveLength(35);
  const b1 = MACHINES.find((m) => m.id === 'B-1')!;
  const f = frontSpot(b1);
  expect([+f.x.toFixed(2), +f.z.toFixed(2)]).toEqual([-9.25, -8.75]);
  expect(COUNTERS.map((c) => c.queue.length)).toEqual([6, 6]);
});

// 앞자리 두 개가 손 닿는 거리 안이면 더 가까운 기계 (배치 순서가 아니라)
test('nearest machine in reach wins', () => {
  expect(nearestMachine({ x: 0.8, z: -5.4 })?.id).toBe('C-6');
  expect(nearestMachine({ x: 1.1, z: -5.4 })?.id).toBe('C-7');
  expect(nearestMachine({ x: 0, z: 0 })).toBeNull();
});
