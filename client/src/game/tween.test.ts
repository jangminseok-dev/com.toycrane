import { expect, test } from 'vitest';
import { Tweens, ease } from './tween';

test('tween resolves after its duration', async () => {
  const tw = new Tweens(); let k = 0; let done = false;
  tw.tween(1, (v) => { k = v; }, ease.lin).then(() => { done = true; });
  tw.update(0.5); expect(k).toBeCloseTo(0.5);
  tw.update(0.6); await Promise.resolve(); expect(k).toBe(1); expect(done).toBe(true);
});

test('wait is a tween that does nothing', async () => {
  const tw = new Tweens(); let done = false;
  tw.wait(0.3).then(() => { done = true; });
  tw.update(0.2); await Promise.resolve(); expect(done).toBe(false);
  tw.update(0.2); await Promise.resolve(); expect(done).toBe(true);
});

// 모든 모션은 시작·끝이 매끄러운 곡선 (설계 2026-10-31 §3.6)
test('smooth ease starts and ends with zero speed', () => {
  expect(ease.smooth(0)).toBe(0);
  expect(ease.smooth(1)).toBe(1);
  expect(ease.smooth(0.5)).toBeCloseTo(0.5);
  const slope = (k: number) => (ease.smooth(k + 1e-4) - ease.smooth(k)) / 1e-4;
  expect(slope(0)).toBeLessThan(1e-3);
  expect(slope(1 - 1e-4)).toBeLessThan(1e-3);
});
