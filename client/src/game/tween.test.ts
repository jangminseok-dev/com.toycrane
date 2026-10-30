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
