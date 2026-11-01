import { expect, test } from 'vitest';
import { AD_SLOTS, AD_TOWER } from './ads';
import { AD_SIGNS } from './copy';

// 광고 자리는 공용 설정 파일(shared/ads.json) 하나 — 광장 광고판 4개뿐 (사용자 2026-11-01: 광고는 광장 4개에만)
test('there are four ad slots, one per plaza board', () => {
  expect(AD_SLOTS.map((s) => s.id)).toEqual([1, 2, 3, 4]);
  expect(AD_SLOTS.every((s) => s.text === `광고문의${s.id}` && s.image === null)).toBe(true);
  expect(AD_SIGNS).toEqual([...AD_SLOTS, ...AD_TOWER].map((s) => s.text));
});

// 진열탑 전광판에는 광고 다섯 자리가 차례로 흐른다 — 번호는 광장 광고판 다음(5~9)이라 광고 자리 번호가 겹치지 않는다 (사용자 2026-11-01)
test('the tower board has five ad slots after the plaza ones', () => {
  expect(AD_TOWER.map((s) => s.id)).toEqual([5, 6, 7, 8, 9]);
  expect(AD_TOWER.every((s) => s.text === `광고문의${s.id}` && s.image === null)).toBe(true);
});
