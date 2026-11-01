import { expect, test } from 'vitest';
import { aimHeight, aimVisible } from './aim';
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

// 집게가 상품 구멍 위(시작 자리)에 있으면 겨냥 고리를 숨긴다 — 인형이 없는 곳이고, 레버 공 뒤에 걸쳐 보였다 (교환소 개편 설계 §4.7)
test('the aim ring hides while the claw is over the prize hole', () => {
  expect(aimVisible({ x: -0.36, z: 0.27 })).toBe(false);
  expect(aimVisible({ x: -0.2, z: 0.3 })).toBe(false);
  expect(aimVisible({ x: 0, z: 0 })).toBe(true);
});

// 미는 뽑기(설계 ring-hook §4): 미니 인형(작은 크기)은 머리가 낮고, 턱 위에서는 턱 윗면에 놓인다
test('mini dolls are lower and the ring rests on the pusher ledge', () => {
  const doll = [spot('bear', 0.1, 0.05, 0)];
  const mini = aimHeight(doll, 0.1, 0.05, 0.18), big = aimHeight(doll, 0.1, 0.05);
  expect(mini).toBeLessThan(big - 0.08);
  expect(mini).toBeGreaterThan(FLOOR + 0.1);
  expect(aimHeight([], -0.34, 0, 0.18, FLOOR + 0.1)).toBeCloseTo(FLOOR + 0.1 + 0.012);
});
