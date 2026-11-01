import { expect, test } from 'vitest';
import { AD_SLOTS } from './ads';
import { AD_SIGNS } from './copy';

// 광고 자리는 공용 설정 파일(shared/ads.json) 하나 — 1~10 벽 간판, 11~14 광장 광고판 (큰 홀 설계 2026-11-01 §3)
test('there are fourteen ad slots, the first ten on the walls', () => {
  expect(AD_SLOTS.map((s) => s.id)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  expect(AD_SLOTS.every((s) => s.text === `광고문의${s.id}` && s.image === null)).toBe(true);
  expect(AD_SIGNS).toEqual(AD_SLOTS.slice(0, 10).map((s) => s.text));
});
