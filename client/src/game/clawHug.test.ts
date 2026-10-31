import { expect, test } from 'vitest';
import { HUG_SINK, hugOpen } from './clawHug';

// 쥔 뒤 화면의 손가락은 봉제 인형을 감싸듯 조금 더 오므린다(물리는 닿는 순간 멈춘다) — 0.4초쯤에 걸쳐 (사용자 2026-10-31 밤: 감싸는 맛)
test('while holding, the shown opening eases below the physical one', () => {
  let shown = 0.5;
  for (let i = 0; i < 24; i++) shown = hugOpen(0.5, true, shown, 1 / 60);
  expect(shown).toBeLessThan(0.5 - HUG_SINK + 0.03);
  expect(shown).toBeGreaterThanOrEqual(0.5 - HUG_SINK);
});

test('without a hold the shown opening is the physical one', () => {
  expect(hugOpen(0.7, false, 0.2, 1 / 60)).toBe(0.7);
  const tight = hugOpen(0.1, true, 0.1, 1); expect(tight).toBeGreaterThanOrEqual(0); expect(tight).toBeLessThan(0.001); // 0 아래로는 안 간다
});
