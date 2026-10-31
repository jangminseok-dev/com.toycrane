import { expect, test } from 'vitest';
import { aimHeight } from './aim';
import type { DollSpot } from '../net/protocol';
import { spot } from '../test/spots';

const FLOOR = 0.87;

// 겨냥 고리는 집게 바로 아래에서 가장 높은 면(인형 머리 위 또는 펠트 바닥)에 놓인다
test('ring rests on the floor where there is no doll', () => {
  expect(aimHeight([], 0, 0)).toBeCloseTo(FLOOR + 0.012);
  expect(aimHeight([spot('bear', 0.3, 0.2, 0)], -0.3, -0.2)).toBeCloseTo(FLOOR + 0.012);
});

test('ring climbs onto the head of a standing doll', () => {
  const top = aimHeight([spot('bear', 0.1, 0.05, 0)], 0.1, 0.05);
  expect(top).toBeGreaterThan(FLOOR + 0.3);
  const side = aimHeight([spot('bear', 0.1, 0.05, 0)], 0.17, 0.05);
  expect(side).toBeGreaterThan(FLOOR + 0.012);
  expect(side).toBeLessThan(top);
});

test('round dolls are lower than standing dolls', () => {
  expect(aimHeight([spot('penguin', 0, 0, 0)], 0, 0)).toBeLessThan(aimHeight([spot('bear', 0, 0, 0)], 0, 0));
});

// 위층 인형은 서버가 정한 얹힌 높이(y)만큼 높다
test('dolls resting on others are higher', () => {
  expect(aimHeight([spot('bear', 0, 0, 0, 0.22)], 0, 0)).toBeCloseTo(aimHeight([spot('bear', 0, 0, 0)], 0, 0) + 0.22);
});

// 높이가 다른 두 인형이 겹치는 자리에선 더 높은 면
test('the higher doll wins where two overlap', () => {
  const spots: DollSpot[] = [spot('bear', 0, 0, 0, 0), spot('cat', 0.05, 0, 0, 0.22)];
  expect(aimHeight(spots, 0.02, 0)).toBeCloseTo(aimHeight([spot('cat', 0.05, 0, 0, 0.22)], 0.02, 0));
});
