import { expect, test } from 'vitest';
import { DOLLS } from './catalog';
import { COUNTERS, MACHINES, frontSpot, nearestMachine } from './storeLayout';

test('catalog and layout match the shared files', () => {
  expect(Object.keys(DOLLS)).toHaveLength(24);
  expect(MACHINES).toHaveLength(24); // 캐릭터 하나에 기계 하나
  expect(new Set(MACHINES.map((m) => m.kind)).size).toBe(24);
  const c1 = MACHINES.find((m) => m.id === 'C-1')!;
  const f = frontSpot(c1);
  expect([+f.x.toFixed(2), +f.z.toFixed(2)]).toEqual([-15.25, 4.05]); // 큰 홀: 서쪽 둘째 줄, 광장(+x)을 봄
  expect(COUNTERS).toHaveLength(4); // 작은 교환소 4곳, 줄 자리 없음
});

// 손 닿는 거리(1.2m) 안의 가장 가까운 기계 (배치 순서가 아니라). 기계 사이를 2.7m로 넓힌 뒤(2026-11-01)에는 두 앞자리가
// 함께 닿는 곳이 없고, 기계 사이 빈틈 한가운데에 서면 어느 기계도 고르지 않는다
test('nearest machine in reach wins', () => {
  expect(nearestMachine({ x: -11.45, z: -3.2 })?.id).toBe('C-6'); // C-6 앞자리 (−11.45, −4.05), C-7 앞자리 (−11.45, −1.35)
  expect(nearestMachine({ x: -11.45, z: -2.2 })?.id).toBe('C-7');
  expect(nearestMachine({ x: -11.45, z: -2.7 })).toBeNull(); // 빈틈 앞
  expect(nearestMachine({ x: 0, z: 0 })).toBeNull();
});
