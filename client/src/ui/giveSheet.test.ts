import { expect, test } from 'vitest';
import { clampGive } from './giveSheet';

// 주기 창: 1개부터 줄 수 있는 최대까지 (교환소 개편 설계 §4.4)
test('the give count stays between one and the most you can give', () => {
  expect(clampGive(0, 5)).toBe(1);
  expect(clampGive(9, 5)).toBe(5);
  expect(clampGive(3, 5)).toBe(3);
});
