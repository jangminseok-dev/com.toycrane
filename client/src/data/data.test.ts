import { expect, test } from 'vitest';
import { DOLLS, isRare } from './catalog';
import { COUNTERS, MACHINES, frontSpot } from './storeLayout';

test('catalog and layout match the shared files', () => {
  expect(Object.keys(DOLLS)).toHaveLength(28);
  expect(isRare('pearlpenguin')).toBe(true);
  expect(MACHINES).toHaveLength(35);
  const b1 = MACHINES.find((m) => m.id === 'B-1')!;
  const f = frontSpot(b1);
  expect([+f.x.toFixed(2), +f.z.toFixed(2)]).toEqual([-9.25, -8.75]);
  expect(COUNTERS.map((c) => c.queue.length)).toEqual([6, 6]);
});
