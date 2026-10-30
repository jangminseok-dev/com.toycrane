import { expect, test } from 'vitest';
import { aimHeight } from './aim';
import type { DollSpot } from '../net/protocol';

const FLOOR = 0.87;

// 겨냥 고리는 집게 바로 아래에서 가장 높은 면(인형 머리 위 또는 펠트 바닥)에 놓인다
test('ring rests on the floor where there is no doll', () => {
  expect(aimHeight([], 0, 0)).toBeCloseTo(FLOOR + 0.012);
  expect(aimHeight([['bear', 0.3, 0.2, 0]], -0.3, -0.2)).toBeCloseTo(FLOOR + 0.012);
});

test('ring climbs onto the head of a standing doll', () => {
  const top = aimHeight([['bear', 0.1, 0.05, 0]], 0.1, 0.05);
  expect(top).toBeGreaterThan(FLOOR + 0.3);
  const side = aimHeight([['bear', 0.1, 0.05, 0]], 0.17, 0.05);
  expect(side).toBeGreaterThan(FLOOR + 0.012);
  expect(side).toBeLessThan(top);
});

test('round dolls are lower than standing dolls', () => {
  expect(aimHeight([['penguin', 0, 0, 0]], 0, 0)).toBeLessThan(aimHeight([['bear', 0, 0, 0]], 0, 0));
});

test('dolls stacked on top (7th and later) are higher', () => {
  const spots: DollSpot[] = Array.from({ length: 7 }, (_, i) => ['bear', i === 6 ? 0 : 0.4, i === 6 ? 0 : -0.3, 0]);
  expect(aimHeight(spots, 0, 0)).toBeGreaterThan(aimHeight([['bear', 0, 0, 0]], 0, 0));
});
