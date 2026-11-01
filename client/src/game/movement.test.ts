import { expect, test } from 'vitest';
import fixtures from '../../../shared/clamp_fixtures.json';
import { clampToFloor, step } from './movement';

test('step walks at 3.2m/s', () => expect(step({ x: 0, z: 3 }, { x: 1, z: 0 }, 0.5)).toEqual({ x: 1.6, z: 3 }));
test('clamps to floor edge', () => expect(clampToFloor({ x: 25, z: -30 })).toEqual({ x: 21.6, z: -21.6 }));
test('pushes out of tower', () => expect(clampToFloor({ x: 0.5, z: 1.0 })).toEqual({ x: 0.5, z: 1.6 }));

// 서버 server/tests/domain/test_store_rules.py와 같은 견본 — 기계·교환소에 막히는 결과가 같아야 한다
test.each(fixtures)('clamp matches shared fixture: $why', ({ in: [x, z], out }) => {
  const p = clampToFloor({ x, z });
  expect([+p.x.toFixed(3), +p.z.toFixed(3)]).toEqual(out);
});
