import { expect, test } from 'vitest';
import { DOLLS } from './catalog';
import { COUNTERS, MACHINES, frontSpot, nearestMachine } from './storeLayout';

test('catalog and layout match the shared files', () => {
  expect(Object.keys(DOLLS)).toHaveLength(24);
  expect(MACHINES).toHaveLength(24); // 캐릭터 하나에 기계 하나
  expect(new Set(MACHINES.map((m) => m.kind)).size).toBe(24);
  const c1 = MACHINES.find((m) => m.id === 'C-1')!;
  const f = frontSpot(c1);
  expect([+f.x.toFixed(2), +f.z.toFixed(2)]).toEqual([-9.25, -5.4]);
  expect(COUNTERS).toHaveLength(4); // 작은 교환소 4곳, 줄 자리 없음
});

// 앞자리 두 개가 손 닿는 거리 안이면 더 가까운 기계 (배치 순서가 아니라)
test('nearest machine in reach wins', () => {
  expect(nearestMachine({ x: 0.8, z: -5.4 })?.id).toBe('C-6');
  expect(nearestMachine({ x: 1.1, z: -5.4 })?.id).toBe('C-7');
  expect(nearestMachine({ x: 0, z: 0 })).toBeNull();
});
